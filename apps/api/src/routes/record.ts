/**
 * Record & play — HTTP endpoints that drive a `playwright codegen` session and
 * save its result as a normal test case.
 *
 *   POST /api/v1/record/start         { url, application_key, environment? }
 *     spawn codegen on the host (opens a Chromium window on the user's screen
 *     when the engine runs locally)
 *
 *   GET  /api/v1/record/:id           → current state + last codegen log line
 *   POST /api/v1/record/:id/stop      kill codegen, parse the recording, save
 *                                     a new case, return it
 *
 *   POST /api/v1/record/import        { script, application_key, url?, title? }
 *     fallback path when the engine runs without a display: user pastes a
 *     codegen script they recorded locally with `npx playwright codegen`.
 *
 * The saved case lives in the application's "Record & play" suite with
 * `created_by = 'record-and-play'`. Reseeding leaves it alone (the seed only
 * prunes rows it created itself).
 */
import type { FastifyInstance } from 'fastify';
import { query, withTransaction } from '../db/client.js';
import { uniqueName } from '../lib/naming.js';
import { caseView } from './test-cases.js';
import { startRecording, stopRecording, getRecording, cleanupRecording, viewSession } from '../record/codegen.js';
import { parseCodegen, recordingTitle, type RecordedStep } from '../record/parser.js';
import { RECORD_AND_PLAY_TYPE, recordAndPlaySuite } from '../catalog/record-and-play-cases.js';
import { TYPE_TO_ENUM } from '../catalog/types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveApplication(idOrKey: unknown): Promise<{ id: string; key: string } | null> {
  if (typeof idOrKey !== 'string' || !idOrKey) return null;
  const { rows } = await query(
    UUID.test(idOrKey)
      ? 'SELECT id, key FROM applications WHERE id = $1::uuid'
      : 'SELECT id, key FROM applications WHERE key = $1',
    [idOrKey]
  );
  return rows[0] ? { id: rows[0].id as string, key: rows[0].key as string } : null;
}

/** Ensure the application has the Record & play suite; return its id. */
async function ensureRecordSuite(appId: string, appKey: string): Promise<string> {
  const suite = recordAndPlaySuite(appKey);
  const { rows } = await query(
    `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
     VALUES ($1, $2, $3, $4, $5, 'record-and-play')
     ON CONFLICT (application_id, key) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [suite.key, suite.name, suite.description, appId, suite.typeKey]
  );
  return rows[0]!.id as string;
}

async function uniqueCaseName(name: string): Promise<string> {
  return uniqueName(name, async (n) => {
    const { rows } = await query('SELECT 1 FROM test_cases WHERE lower(name) = lower($1) LIMIT 1', [n]);
    return rows.length > 0;
  });
}

async function createRecordedCase(opts: {
  applicationId: string;
  suiteId: string;
  name: string;
  startUrl: string | null;
  steps: RecordedStep[];
  objective: string;
  preconditions: string;
  warnings: string[];
  actor: string | null;
  source: string;
}) {
  const base = opts.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'recording';
  const key = `REC-${base.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const name = await uniqueCaseName(opts.name);
  const notes = opts.warnings.length ? `Codegen lines that were not translated into runnable steps:\n- ${opts.warnings.join('\n- ')}` : null;

  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO test_cases (
         key, name, description, application_id, test_type, test_level,
         preconditions, execution_method, steps, expected_results,
         severity, priority, tags, author_id, created_by, updated_by,
         automation_status, lifecycle,
         objective, environment, visibility, automation_link,
         known_workarounds
       ) VALUES (
         $1, $2, $3, $4, $5::test_type, 'system',
         $6, 'playwright', $7::jsonb, $8,
         'medium', 'p2', $9::text[], $10, 'record-and-play', 'record-and-play',
         'automated', 'draft',
         $11, NULL, 'Team', $12,
         $13
       ) RETURNING *`,
      [
        key,
        name,
        `Recorded Playwright flow captured by the engine's screen recorder. Starting URL: ${opts.startUrl || '(unknown)'}. ${opts.steps.length} step${opts.steps.length === 1 ? '' : 's'} replayed by the Playwright runner on the application's environment.`,
        opts.applicationId,
        TYPE_TO_ENUM[RECORD_AND_PLAY_TYPE.key] || 'ui',
        opts.preconditions,
        JSON.stringify(opts.steps),
        opts.steps.length ? `All ${opts.steps.length} recorded steps replay without an error.` : 'The recorded flow replays without an error.',
        ['record-and-play', 'playwright'],
        opts.actor,
        opts.objective,
        opts.source,
        notes,
      ]
    );
    await client.query(
      `INSERT INTO test_case_versions (test_case_id, version, snapshot, change_summary, created_by)
       VALUES ($1, 1, $2::jsonb, 'Initial recording', $3)`,
      [rows[0].id, JSON.stringify(rows[0]), opts.actor]
    );
    await client.query(
      `INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order)
       VALUES ($1, $2, 0) ON CONFLICT DO NOTHING`,
      [rows[0].id, opts.suiteId]
    );
    return rows[0];
  });

  return caseView(row);
}

export async function recordRoutes(app: FastifyInstance) {
  app.post<{ Body: { url?: string; application_key?: string; application_id?: string } }>(
    '/api/v1/record/start',
    async (req, reply) => {
      const b = req.body || {};
      if (!b.url || typeof b.url !== 'string') return reply.status(400).send({ error: 'url is required' });
      const appRef = await resolveApplication(b.application_id || b.application_key);
      if (!appRef) return reply.status(400).send({ error: 'application_id or application_key is required and must resolve to a known application' });
      try {
        const s = await startRecording(b.url);
        return reply.status(202).send({ data: { ...viewSession(s), application: appRef } });
      } catch (err) {
        return reply.status(409).send({ error: (err as Error).message });
      }
    }
  );

  app.get<{ Params: { id: string } }>('/api/v1/record/:id', async (req, reply) => {
    const s = getRecording(req.params.id);
    if (!s) return reply.status(404).send({ error: 'No such recording session.' });
    return reply.send({ data: viewSession(s) });
  });

  app.post<{ Params: { id: string }; Body: { application_key?: string; application_id?: string; title?: string; preconditions?: string } }>(
    '/api/v1/record/:id/stop',
    async (req, reply) => {
      const b = req.body || {};
      const appRef = await resolveApplication(b.application_id || b.application_key);
      if (!appRef) return reply.status(400).send({ error: 'application_id or application_key is required' });
      const s = stopRecording(req.params.id);

      // Wait up to 20s for codegen's exit handler to flush the file.
      const deadline = Date.now() + 20_000;
      while ((s.state === 'closing' || s.state === 'recording') && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (s.state !== 'done') {
        return reply.status(409).send({ error: `recording did not finish cleanly: ${s.error || s.state}`, data: viewSession(s) });
      }

      const parsed = parseCodegen(s.output);
      if (!parsed.steps.length) {
        return reply.status(422).send({ error: 'the recording captured no runnable actions', data: viewSession(s) });
      }

      const suiteId = await ensureRecordSuite(appRef.id, appRef.key);
      const title = (b.title || '').trim() || recordingTitle(parsed.startUrl || s.url, 'Recorded flow');
      const extra = (b.preconditions || '').trim();
      const snap = s.snapshot;
      const snapLine = snap
        ? `Before the recording began the page at ${parsed.startUrl || s.url} showed “${snap.title || '(no title)'}”${snap.summary ? ` — opening text: ${snap.summary.slice(0, 240)}${snap.summary.length > 240 ? '…' : ''}` : ''}.`
        : '';
      const precondBody = extra
        ? extra
        : 'The user has whatever access the recorded flow needed (sign-in, permissions, pre-existing data).';
      const createdCase = await createRecordedCase({
        applicationId: appRef.id,
        suiteId,
        name: title,
        startUrl: parsed.startUrl || s.url,
        steps: parsed.steps,
        objective: `Replay the ${parsed.steps.length} action${parsed.steps.length === 1 ? '' : 's'} a user performed on ${parsed.startUrl || s.url} and confirm each one still works.`,
        preconditions: [`The application is reachable at ${parsed.startUrl || s.url}.`, precondBody, snapLine].filter(Boolean).join(' '),
        warnings: parsed.warnings,
        actor: req.actor?.id ?? null,
        source: 'codegen',
      });

      await cleanupRecording(s.id);
      return reply.status(201).send({ data: createdCase, warnings: parsed.warnings });
    }
  );

  app.post<{ Body: { script?: string; application_key?: string; application_id?: string; url?: string; title?: string; preconditions?: string } }>(
    '/api/v1/record/import',
    async (req, reply) => {
      const b = req.body || {};
      if (!b.script || typeof b.script !== 'string') return reply.status(400).send({ error: 'script is required (the codegen output)' });
      const appRef = await resolveApplication(b.application_id || b.application_key);
      if (!appRef) return reply.status(400).send({ error: 'application_id or application_key is required' });
      const parsed = parseCodegen(b.script);
      if (!parsed.steps.length) return reply.status(422).send({ error: 'the pasted script contains no runnable actions' });

      const suiteId = await ensureRecordSuite(appRef.id, appRef.key);
      const startUrl = parsed.startUrl || b.url || null;
      const title = (b.title || '').trim() || recordingTitle(startUrl, 'Recorded flow');
      const extra = (b.preconditions || '').trim();
      const createdCase = await createRecordedCase({
        applicationId: appRef.id,
        suiteId,
        name: title,
        startUrl,
        steps: parsed.steps,
        objective: `Replay the ${parsed.steps.length} action${parsed.steps.length === 1 ? '' : 's'} a user performed on ${startUrl || 'the application'} and confirm each one still works.`,
        preconditions: `The application is reachable at ${startUrl || '(the recorded URL)'}.${extra ? ` ${extra}` : ' The user has whatever access the recorded flow needed (sign-in, permissions, pre-existing data).'}`,
        warnings: parsed.warnings,
        actor: req.actor?.id ?? null,
        source: 'import',
      });

      return reply.status(201).send({ data: createdCase, warnings: parsed.warnings });
    }
  );
}
