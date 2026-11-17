/**
 * Quality Insights — versioned, per-application reviews of test quality.
 *
 *   GET  /api/v1/insights?application_key=    versions of an application, newest first (no bodies)
 *   GET  /api/v1/insights/:id                 one version: snapshot (facts) + analysis (review)
 *   GET  /api/v1/insights/snapshot            the facts as of now; nothing is stored
 *   POST /api/v1/insights                     write a new version
 *
 * A version pairs a snapshot (insights/snapshot.ts) with a review of it. POST
 * computes the snapshot, stores the version as "generating", answers 202 and
 * writes the review in the background: by Claude when AI credentials are
 * configured, by the built-in rules otherwise. An agent that has read
 * /insights/snapshot can instead post its own review in `analysis` (with
 * `analyst`); that version is stored ready at once. Versions are never
 * rewritten — each refresh adds one — and they outlive run retention.
 */
import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { audit } from '../middleware/rbac.js';
import { loadSnapshot, resolveApplication, type Snapshot } from '../insights/snapshot.js';
import { AnalysisSchema, reviewOf, rulesAnalysis, type Analysis, type PreviousReview } from '../insights/analysis.js';
import { INSIGHTS_MODEL, aiAnalysis, aiAvailable, describeAiError } from '../insights/analyst.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUMMARY = `id, application_id, version, status, analyst, model, trigger_source, requested_by, window_days,
                 notice, error, created_at, completed_at,
                 analysis->>'headline' AS headline, analysis->>'verdict' AS verdict, snapshot->'kpis' AS kpis`;

function windowDays(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 90) : 30;
}

const aiInfo = () => ({ available: aiAvailable(), model: INSIGHTS_MODEL });

async function previousReview(applicationId: string, beforeVersion: number): Promise<PreviousReview | null> {
  const { rows } = await query(
    `SELECT version, created_at, snapshot->'kpis' AS kpis, analysis FROM quality_insights
     WHERE application_id = $1 AND status = 'ready' AND version < $2
     ORDER BY version DESC LIMIT 1`,
    [applicationId, beforeVersion]
  );
  const r = rows[0];
  return r ? reviewOf(r.version, new Date(r.created_at).toISOString(), r.kpis, r.analysis as Analysis) : null;
}

async function insertVersion(applicationId: string, fields: { status: string; analyst: string | null; trigger: string; requestedBy: string | null; window: number; snapshot: Snapshot; analysis: Analysis | null }) {
  const insert = () =>
    query(
      `INSERT INTO quality_insights (application_id, version, status, analyst, trigger_source, requested_by, window_days, snapshot, analysis, completed_at)
       SELECT $1, COALESCE(max(version), 0) + 1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, CASE WHEN $2 = 'ready' THEN now() END
       FROM quality_insights WHERE application_id = $1
       RETURNING ${SUMMARY}`,
      [applicationId, fields.status, fields.analyst, fields.trigger, fields.requestedBy, fields.window, JSON.stringify(fields.snapshot), fields.analysis ? JSON.stringify(fields.analysis) : null]
    );
  try {
    return (await insert()).rows[0]!;
  } catch (err) {
    // Two refreshes raced for the same version number: the loser takes the next one.
    if ((err as { code?: string }).code !== '23505') throw err;
    return (await insert()).rows[0]!;
  }
}

/** Writes the review for a stored snapshot. Never throws: the outcome is the row's status. */
async function generate(id: string, applicationId: string, version: number, snapshot: Snapshot, log: FastifyInstance['log']) {
  try {
    const previous = await previousReview(applicationId, version);
    let analysis: Analysis | null = null;
    let analyst = 'Built-in rules';
    let model: string | null = null;
    let usage: Record<string, unknown> = {};
    let notice: string | null = null;
    if (aiAvailable()) {
      try {
        ({ analysis, model, usage } = await aiAnalysis(snapshot, previous));
        analyst = 'Claude';
      } catch (err) {
        log.warn({ err }, 'insights: AI analysis failed');
        notice = `The AI analysis failed (${describeAiError(err)}), so this version was written by the built-in rules.`;
      }
    } else {
      notice = 'No AI credentials are configured on the engine (ANTHROPIC_API_KEY), so this version was written by the built-in rules.';
    }
    analysis ??= rulesAnalysis(snapshot, previous);
    await query(
      `UPDATE quality_insights SET status = 'ready', analysis = $2::jsonb, analyst = $3, model = $4, usage = $5::jsonb, notice = $6, completed_at = now()
       WHERE id = $1`,
      [id, JSON.stringify(analysis), analyst, model, JSON.stringify(usage), notice]
    );
  } catch (err) {
    log.error({ err }, 'insights: generation failed');
    await query(`UPDATE quality_insights SET status = 'failed', error = $2, completed_at = now() WHERE id = $1`, [id, (err as Error).message]).catch(() => {});
  }
}

export async function insightRoutes(app: FastifyInstance) {
  app.get('/api/v1/insights', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const application = await resolveApplication(q.application_key || q.application_id || 'sand-bench');
    if (!application) return reply.status(404).send({ error: 'Application not found' });
    // A version left "generating" by an engine restart would otherwise block every later refresh.
    await query(
      `UPDATE quality_insights SET status = 'failed', error = 'Generation was interrupted', completed_at = now()
       WHERE application_id = $1 AND status = 'generating' AND created_at < now() - interval '20 minutes'`,
      [application.id]
    );
    const { rows } = await query(`SELECT ${SUMMARY} FROM quality_insights WHERE application_id = $1 ORDER BY version DESC LIMIT 100`, [application.id]);
    return reply.send({ data: rows, application, ai: aiInfo() });
  });

  app.get('/api/v1/insights/snapshot', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const application = await resolveApplication(q.application_key || q.application_id || 'sand-bench');
    if (!application) return reply.status(404).send({ error: 'Application not found' });
    return reply.send({ data: await loadSnapshot(application, windowDays(q.window_days)) });
  });

  app.get<{ Params: { id: string } }>('/api/v1/insights/:id', async (req, reply) => {
    if (!UUID.test(req.params.id)) return reply.status(404).send({ error: 'Insight version not found' });
    const { rows } = await query(`SELECT ${SUMMARY}, snapshot, analysis, usage FROM quality_insights WHERE id = $1`, [req.params.id]);
    const row = rows[0];
    if (!row) return reply.status(404).send({ error: 'Insight version not found' });
    const prev = await query(
      `SELECT version, created_at, snapshot->'kpis' AS kpis FROM quality_insights
       WHERE application_id = $1 AND status = 'ready' AND version < $2 ORDER BY version DESC LIMIT 1`,
      [row.application_id, row.version]
    );
    return reply.send({ data: { ...row, previous: prev.rows[0] || null }, ai: aiInfo() });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/insights', async (req, reply) => {
    const b = req.body || {};
    const application = await resolveApplication(String(b.application_key || b.application_id || ''));
    if (!application) return reply.status(404).send({ error: 'Application not found' });

    let supplied: Analysis | null = null;
    if (b.analysis != null) {
      const parsed = AnalysisSchema.safeParse(b.analysis);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'analysis does not match the review shape', issues: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`) });
      }
      supplied = parsed.data;
    }

    const busy = await query(
      `SELECT ${SUMMARY} FROM quality_insights
       WHERE application_id = $1 AND status = 'generating' AND created_at > now() - interval '20 minutes'
       ORDER BY version DESC LIMIT 1`,
      [application.id]
    );
    if (busy.rows[0] && !supplied) {
      return reply.status(409).send({ error: 'Insights are already being refreshed for this application', data: busy.rows[0] });
    }

    const window = windowDays(b.window_days);
    const snapshot = await loadSnapshot(application, window);
    const requestedBy = req.actor?.id ?? null;
    const row = await insertVersion(application.id, {
      status: supplied ? 'ready' : 'generating',
      analyst: supplied ? String(b.analyst || 'External analyst').slice(0, 120) : null,
      trigger: supplied ? 'agent' : 'manual',
      requestedBy, window, snapshot, analysis: supplied,
    });
    await audit(req, 'insights.refresh', 'application', application.id, { version: row.version, analyst: row.analyst });

    if (supplied) return reply.status(201).send({ data: row, ai: aiInfo() });
    void generate(row.id, application.id, row.version, snapshot, app.log);
    return reply.status(202).send({ data: row, ai: aiInfo(), message: `Writing version ${row.version}` });
  });
}
