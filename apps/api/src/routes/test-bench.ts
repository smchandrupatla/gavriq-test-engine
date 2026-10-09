/**
 * Test bench API — the Test cases / Test suites / Test runs representation
 * adopted from Sand Bench (its test-cases.html, test-case-form.html,
 * test-suites.html screens and /api/v1/test-cases|test-suites|runs routes),
 * served over the engine's own repository and execution tables.
 *
 *   GET   /api/v1/test-cases/summary            Total / Passing / Failing / Blocked / Not run / Last run
 *   GET   /api/v1/test-cases/analytics          14-day pass/fail trend, flaky cases, mean time to green, cases by tag
 *   GET   /api/v1/test-cases/check-id?id=       is this Test ID free and well-formed
 *   GET   /api/v1/test-cases/:id/runs           run history of one case (Run / Result / Env / Duration / When + remarks)
 *   GET   /api/v1/test-cases/:id/suites         suites containing the case
 *   POST  /api/v1/test-cases/:id/notes          add a note {text}
 *   POST  /api/v1/test-cases/:id/watch          watch / unwatch {watch}
 *   PATCH /api/v1/test-cases/:id/triage         {triageStatus, assignee, linkedIssueUrl}
 *   POST  /api/v1/test-cases/:id/run            queue a run of the case {environment}
 *   POST  /api/v1/test-cases/run-batch          queue one run of several cases {ids, environment}
 *   GET   /api/v1/test-suites                   suites with their member case ids
 *   POST  /api/v1/test-suites                   {name, caseIds, application_key}
 *   GET   /api/v1/test-suites/:id
 *   PUT   /api/v1/test-suites/:id               {name, caseIds}
 *   DELETE /api/v1/test-suites/:id
 *   POST  /api/v1/test-suites/:id/run           queue a run of every member case {environment}
 *   GET   /api/v1/test-suites/:id/runs          executions of the suite
 *   POST  /api/v1/test-suites/from-suites       {name, suiteIds} → one suite with the union of their cases
 *   POST  /api/v1/test-suites/run-batch         {ids, environment}
 *   GET   /api/v1/test-runs                     per-case runs: id, status, result, suite, case, environment,
 *                                               duration, triggered by, remarks, evidence
 *   GET   /api/v1/test-runs/:id                 one per-case run with its remarks and evidence
 *   POST  /api/v1/executions/:id/remarks        add an operator remark to a run {text}
 *
 * A "test run" here is one case's result inside an execution (Sand Bench stores
 * one test_runs row per case run, attributed to a suite); the execution is the
 * batch it was part of. Status words follow Sand Bench: result pass | fail |
 * blocked, status completed | failed | blocked | queued | running | cancelled.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../db/client.js';
import { audit } from '../middleware/rbac.js';
import { humanDateTime } from '../lib/naming.js';
import { evidenceUrl } from '../evidence-store.js';
import { LABEL_PRIORITY, PRIORITY_LABEL, TRIAGE_STATUSES } from '../catalog/types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CASE_KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,119}$/;
const FAILED = `('failed','error','timed_out')`;
const BLOCKED = `('blocked','skipped')`;

/** Sand Bench result word for a stored result status. */
export const RESULT_SQL = `CASE WHEN er.status = 'passed' THEN 'pass' WHEN er.status IN ${FAILED} THEN 'fail' WHEN er.status IN ${BLOCKED} THEN 'blocked' ELSE er.status::text END`;
/** Sand Bench run status word for a stored result status. */
export const RUN_STATUS_SQL = `CASE WHEN er.status = 'passed' THEN 'completed' WHEN er.status IN ${FAILED} THEN 'failed' WHEN er.status IN ${BLOCKED} THEN 'blocked' ELSE er.status::text END`;
/** Priority label the screen shows for the repository's p0..p4. */
export const PRIORITY_LABEL_SQL = `CASE tc.priority::text WHEN 'p0' THEN 'Critical' WHEN 'p1' THEN 'High' WHEN 'p2' THEN 'Medium' ELSE 'Low' END`;
/** Status word the screen shows for a case's latest result. */
export function statusLabel(result: string | null | undefined): 'Passed' | 'Failed' | 'Blocked' | 'Not run' {
  if (!result) return 'Not run';
  if (result === 'pass' || result === 'passed') return 'Passed';
  if (result === 'fail' || result === 'failed' || result === 'error' || result === 'timed_out') return 'Failed';
  if (result === 'blocked' || result === 'skipped') return 'Blocked';
  return 'Not run';
}

export function etagOf(row: { version?: number; updated_at?: string | Date }): string {
  return `"${row.version ?? 1}-${new Date(row.updated_at || 0).getTime()}"`;
}

async function resolveEnvironmentId(v: unknown): Promise<string | null> {
  if (typeof v !== 'string' || !v) return null;
  const { rows } = await query(
    UUID.test(v) ? 'SELECT id FROM environments WHERE id = $1::uuid' : 'SELECT id FROM environments WHERE key = $1',
    [v]
  );
  return rows[0]?.id ?? null;
}

async function resolveApplicationId(v: unknown): Promise<string | null> {
  if (typeof v !== 'string' || !v) return null;
  const { rows } = await query(
    UUID.test(v) ? 'SELECT id FROM applications WHERE id = $1::uuid' : 'SELECT id FROM applications WHERE key = $1',
    [v]
  );
  return rows[0]?.id ?? null;
}

async function findCase(ref: string) {
  const { rows } = await query('SELECT * FROM test_cases WHERE id::text = $1 OR key = $1', [ref]);
  return rows[0] ?? null;
}

async function findSuite(ref: string) {
  const { rows } = await query(
    `SELECT s.*, a.key AS application_key,
            COALESCE((SELECT array_agg(m.test_case_id::text ORDER BY m.sort_order) FROM test_case_suites m WHERE m.test_suite_id = s.id), '{}') AS case_ids
     FROM test_suites s JOIN applications a ON a.id = s.application_id
     WHERE s.id::text = $1 OR s.key = $1`,
    [ref]
  );
  return rows[0] ?? null;
}

function suiteView(s: any) {
  return {
    id: s.id,
    key: s.key,
    name: s.name,
    description: s.description,
    suite_type: s.suite_type,
    application_id: s.application_id,
    application_key: s.application_key,
    case_ids: s.case_ids || [],
    case_count: (s.case_ids || []).length,
    status: 'active',
    etag: etagOf({ version: 1, updated_at: s.updated_at }),
    created_at: s.created_at,
    updated_at: s.updated_at,
    created_by: s.created_by,
  };
}

/** Queues one execution for the given cases (and optional suite), named the way the console names runs. */
export async function queueCaseRun(
  req: FastifyRequest,
  input: { caseIds: string[]; suiteId?: string | null; environment?: unknown; triggerSource?: string; requestedBy?: string | null; metadata?: Record<string, unknown>; applicationVersion?: string | null }
) {
  const envId = await resolveEnvironmentId(input.environment);
  const { rows: cases } = await query(
    `SELECT tc.id, tc.key, tc.name, a.key AS app_key, a.id AS app_id FROM test_cases tc JOIN applications a ON a.id = tc.application_id
     WHERE tc.id = ANY($1::uuid[])`,
    [input.caseIds]
  );
  const first = cases[0];
  if (!first) return null;
  const suite = input.suiteId ? await findSuite(input.suiteId) : null;
  const stamp = humanDateTime(new Date());
  const name = cases.length === 1 ? `${first.name} — ${stamp}` : suite ? `${suite.name} — ${stamp}` : `Run — ${stamp}`;
  const key = `exec-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const envRow = envId ? await query('SELECT key FROM environments WHERE id = $1', [envId]) : { rows: [] as any[] };
  const applicationVersion = typeof input.applicationVersion === 'string' && input.applicationVersion.trim()
    ? input.applicationVersion.trim()
    : (input.metadata && typeof (input.metadata as any).application_version === 'string'
        ? ((input.metadata as any).application_version as string).trim()
        : null);
  const metadata = {
    ...(input.metadata || {}),
    application_key: first.app_key,
    ...(envRow.rows[0]?.key ? { environment_key: envRow.rows[0].key } : {}),
    ...(suite ? { suite_key: suite.key } : {}),
    ...(applicationVersion ? { application_version: applicationVersion } : {}),
  };
  const { rows } = await query(
    `INSERT INTO executions (key, name, requested_by, test_suite_id, test_case_ids, environment_id, execution_location, status, trigger_source, metadata)
     VALUES ($1,$2,$3,$4,$5::uuid[],$6,'out_of_container','queued',$7,$8::jsonb)
     RETURNING id, key, name, status, test_case_ids, environment_id, created_at`,
    [key, name, input.requestedBy ?? req.actor?.id ?? null, suite?.id ?? null, cases.map((c: any) => c.id), envId, input.triggerSource || 'manual', JSON.stringify(metadata)]
  );
  const execution = rows[0]!;
  await audit(req, 'execution.queue', 'execution', execution.id, { key, case_count: cases.length, environment_id: envId, trigger_source: input.triggerSource || 'manual', suite_id: suite?.id ?? null });
  return { ...execution, application_key: first.app_key, suite_id: suite?.id ?? null, case_count: cases.length };
}

function remarksOf(row: any): string[] {
  const list = Array.isArray(row.remarks) ? row.remarks.map((r: unknown) => (typeof r === 'string' ? r : String((r as any)?.text ?? ''))).filter(Boolean) : [];
  if (!list.length && row.message) return String(row.message).split(/;\s+(?=[A-Z0-9a-z])/).map((s: string) => s.trim()).filter(Boolean);
  return list;
}

/** Sand Bench test_runs row shape for one execution result. */
function runView(r: any) {
  return {
    id: r.id,
    run_id: r.execution_key,
    execution_id: r.execution_id,
    execution_name: r.execution_name,
    case_id: r.test_case_id,
    case_key: r.case_key,
    case_name: r.case_name,
    suite_id: r.suite_id,
    suite_name: r.suite_name,
    status: r.run_status,
    result: r.result,
    raw_status: r.status,
    verdict: r.verdict,
    classification: r.classification,
    channel: r.execution_method,
    environment: r.environment_key,
    environment_id: r.environment_id,
    environment_name: r.environment_name,
    duration_ms: r.duration_ms,
    triggered_by: r.requested_by || r.trigger_source,
    trigger_source: r.trigger_source,
    worker_id: r.worker_id,
    message: r.message,
    remarks: remarksOf(r),
    logs: remarksOf(r),
    evidence_count: Number(r.evidence_count || 0),
    started_at: r.started_at,
    finished_at: r.finished_at,
    created_at: r.created_at,
    totals: { steps: r.metrics?.steps ?? null, failed_step: r.metrics?.failed_step ?? null, ...(r.metrics && typeof r.metrics === 'object' ? { latency_ms: r.metrics.latency_ms ?? null } : {}) },
  };
}

const RUN_SELECT = `
  SELECT er.id, er.execution_id, er.test_case_id, er.status, er.verdict, er.classification, er.duration_ms,
         er.message, er.metrics, er.remarks, er.started_at, er.finished_at, er.created_at,
         ${RESULT_SQL} AS result, ${RUN_STATUS_SQL} AS run_status,
         e.key AS execution_key, e.name AS execution_name, e.test_suite_id AS suite_id, e.requested_by, e.trigger_source,
         e.worker_id, e.environment_id, env.key AS environment_key, env.name AS environment_name,
         s.name AS suite_name, tc.key AS case_key, tc.name AS case_name, tc.execution_method,
         (SELECT count(*)::int FROM evidence ev WHERE ev.execution_result_id = er.id) AS evidence_count
  FROM execution_results er
  JOIN executions e ON e.id = er.execution_id
  JOIN test_cases tc ON tc.id = er.test_case_id
  LEFT JOIN environments env ON env.id = e.environment_id
  LEFT JOIN test_suites s ON s.id = e.test_suite_id`;

export async function testBenchRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------------------
  // Test cases — screen summary, analytics, id check
  // ---------------------------------------------------------------------------
  app.get('/api/v1/test-cases/summary', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appId = await resolveApplicationId(q.application_key || q.application_id);
    const envId = await resolveEnvironmentId(q.environment_id);
    const { rows } = await query(
      `SELECT tc.id, lr.status AS last_status, lr.created_at AS last_run_at
       FROM test_cases tc
       LEFT JOIN LATERAL (
         SELECT er.status, er.created_at FROM execution_results er
         JOIN executions ex ON ex.id = er.execution_id
         WHERE er.test_case_id = tc.id AND ($2::uuid IS NULL OR ex.environment_id = $2::uuid)
         ORDER BY er.created_at DESC LIMIT 1
       ) lr ON true
       WHERE ($1::uuid IS NULL OR tc.application_id = $1::uuid)
         AND tc.lifecycle NOT IN ('archived','deprecated')`,
      [appId, envId]
    );
    const label = (r: any) => statusLabel(r.last_status);
    const passing = rows.filter((r) => label(r) === 'Passed').length;
    const failing = rows.filter((r) => label(r) === 'Failed').length;
    const blocked = rows.filter((r) => label(r) === 'Blocked').length;
    const notRun = rows.filter((r) => label(r) === 'Not run').length;
    const lastRunAt = rows.reduce((max: string | null, r) => (r.last_run_at && (!max || r.last_run_at > max) ? r.last_run_at : max), null as string | null);
    const queued = await query(
      `SELECT count(*)::int AS n FROM executions WHERE status IN ('queued','preparing','running') AND ($1::text IS NULL OR metadata->>'application_key' = $1)`,
      [q.application_key || null]
    );
    return reply.send({ total: rows.length, passing, failing, blocked, notRun, lastRunAt, queuedRuns: queued.rows[0]?.n || 0 });
  });

  app.get('/api/v1/test-cases/analytics', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appId = await resolveApplicationId(q.application_key || q.application_id);
    const envId = await resolveEnvironmentId(q.environment_id);
    const [trend, flaky, mttr, byTag] = await Promise.all([
      query(
        `SELECT date_trunc('day', er.created_at)::date AS day,
                count(*) FILTER (WHERE er.status = 'passed')::int AS passed,
                count(*) FILTER (WHERE er.status IN ${FAILED})::int AS failed,
                count(*) FILTER (WHERE er.status IN ${BLOCKED})::int AS blocked
         FROM execution_results er JOIN executions ex ON ex.id = er.execution_id JOIN test_cases tc ON tc.id = er.test_case_id
         WHERE er.created_at > now() - interval '14 days'
           AND ($1::uuid IS NULL OR tc.application_id = $1::uuid) AND ($2::uuid IS NULL OR ex.environment_id = $2::uuid)
         GROUP BY 1 ORDER BY 1`,
        [appId, envId]
      ),
      query(
        `SELECT tc.id, tc.key, tc.name, recent.total, recent.failed
         FROM test_cases tc
         JOIN LATERAL (
           SELECT count(*)::int AS total, count(*) FILTER (WHERE r.status IN ${FAILED})::int AS failed
           FROM (SELECT er.status FROM execution_results er JOIN executions ex ON ex.id = er.execution_id
                 WHERE er.test_case_id = tc.id AND ($2::uuid IS NULL OR ex.environment_id = $2::uuid)
                 ORDER BY er.created_at DESC LIMIT 10) r
         ) recent ON true
         WHERE ($1::uuid IS NULL OR tc.application_id = $1::uuid)
           AND recent.total >= 3 AND recent.failed > 0 AND recent.failed < recent.total
         ORDER BY (recent.failed::float / recent.total) DESC LIMIT 10`,
        [appId, envId]
      ),
      query(
        `WITH ordered AS (
           SELECT er.test_case_id, er.status, er.created_at,
                  lag(er.status) OVER (PARTITION BY er.test_case_id ORDER BY er.created_at) AS prev_status,
                  lag(er.created_at) OVER (PARTITION BY er.test_case_id ORDER BY er.created_at) AS prev_at
           FROM execution_results er JOIN executions ex ON ex.id = er.execution_id JOIN test_cases tc ON tc.id = er.test_case_id
           WHERE ($1::uuid IS NULL OR tc.application_id = $1::uuid) AND ($2::uuid IS NULL OR ex.environment_id = $2::uuid)
         )
         SELECT avg(extract(epoch FROM (created_at - prev_at)) / 3600) AS mttr_hours
         FROM ordered WHERE status = 'passed' AND prev_status IN ${FAILED}`,
        [appId, envId]
      ),
      query(
        `SELECT tag, count(*)::int AS n FROM test_cases tc, unnest(tc.tags) AS tag
         WHERE ($1::uuid IS NULL OR tc.application_id = $1::uuid) GROUP BY tag ORDER BY n DESC LIMIT 12`,
        [appId]
      ),
    ]);
    return reply.send({
      trend: trend.rows,
      flaky: flaky.rows.map((r) => ({ id: r.id, key: r.key, name: r.name, failureRate: Number(r.failed) / Number(r.total), runs: Number(r.total) })),
      mttrHours: mttr.rows[0]?.mttr_hours != null ? Number(mttr.rows[0].mttr_hours) : null,
      byTag: byTag.rows,
    });
  });

  app.get('/api/v1/test-cases/check-id', async (req, reply) => {
    const id = String((req.query as Record<string, string>).id || '').trim();
    if (!id) return reply.send({ available: false, validFormat: false });
    const { rows } = await query('SELECT 1 FROM test_cases WHERE key = $1 OR lower(key) = lower($1)', [id]);
    return reply.send({ available: !rows.length, validFormat: CASE_KEY.test(id) });
  });

  // ---------------------------------------------------------------------------
  // Test cases — run history, suites, notes, watchers, triage, run
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/api/v1/test-cases/:id/runs', async (req, reply) => {
    const tc = await findCase(req.params.id);
    if (!tc) return reply.status(404).send({ error: 'Test case not found' });
    const q = req.query as Record<string, string>;
    const envId = await resolveEnvironmentId(q.environment_id);
    const limit = Math.max(1, Math.min(Number(q.limit) || 100, 500));
    const { rows } = await query(
      `${RUN_SELECT}
       WHERE er.test_case_id = $1 AND ($2::uuid IS NULL OR e.environment_id = $2::uuid)
       ORDER BY er.created_at DESC LIMIT $3`,
      [tc.id, envId, limit]
    );
    const runs = rows.map(runView);
    const passed = runs.filter((r) => r.result === 'pass').length;
    const failed = runs.filter((r) => r.result === 'fail').length;
    const blocked = runs.filter((r) => r.result === 'blocked').length;
    const recent = runs.slice(0, 10);
    const recentFailed = recent.filter((r) => r.result === 'fail').length;
    return reply.send({
      data: runs,
      totals: { ran: runs.length, passed, failed, blocked, failureRate: recent.length ? recentFailed / recent.length : null },
    });
  });

  /**
   * Catalog coverage — for every active case, which plain-language fields are missing or thin.
   *   objective         < 40 chars
   *   preconditions     empty
   *   steps             empty
   *   expected_results  empty
   *   test_data         both test_data and test_data_ref empty
   * Returns a summary and a row per case so the console can show what needs fleshing out.
   */
  app.get('/api/v1/test-cases/coverage', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const where: string[] = [`tc.lifecycle NOT IN ('archived','deprecated')`];
    const params: unknown[] = [];
    if (q.application_key) {
      params.push(q.application_key);
      where.push(`tc.application_id = (SELECT id FROM applications WHERE key = $${params.length})`);
    }
    const minObjective = Math.max(10, Math.min(Number(q.min_objective) || 40, 200));
    const { rows } = await query(
      `SELECT tc.id, tc.key, tc.name, tc.objective, tc.preconditions, tc.expected_results,
              tc.test_data, tc.test_data_ref, tc.test_type::text AS test_type,
              tc.execution_method, tc.script,
              jsonb_array_length(COALESCE(tc.steps, '[]'::jsonb)) AS step_count,
              a.key AS application_key, a.name AS application_name
         FROM test_cases tc JOIN applications a ON a.id = tc.application_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY tc.key`,
      params
    );
    type Row = { id: string; key: string; name: string; application_key: string; application_name: string;
      test_type: string; execution_method: string | null; script: string | null; step_count: number;
      objective: string | null; preconditions: string | null; expected_results: string | null;
      test_data: string | null; test_data_ref: string | null };
    const findings: Array<{ case_id: string; case_key: string; name: string; application: string; test_type: string;
      missing: string[]; thin: string[]; severity: 'high' | 'medium' | 'low' }> = [];
    let allClean = 0;
    for (const r of rows as Row[]) {
      const missing: string[] = [];
      const thin: string[] = [];
      // A script-driven case keeps its steps inside the script; the UI already covers that case.
      const scriptDriven = !!(r.script && (!r.execution_method || r.execution_method === 'playwright' || r.execution_method === 'selenium'));
      if (!r.objective) missing.push('objective');
      else if (r.objective.trim().length < minObjective) thin.push(`objective (${r.objective.trim().length} chars)`);
      if (!r.preconditions) missing.push('preconditions');
      if (!scriptDriven && (!r.step_count || r.step_count < 1)) missing.push('steps');
      if (!r.expected_results) missing.push('expected_results');
      if (!r.test_data && !r.test_data_ref) missing.push('test_data');
      if (!missing.length && !thin.length) { allClean++; continue; }
      // Severity: a case missing more than one of (objective, steps, expected_results) is "high".
      const criticalMissing = ['objective', 'steps', 'expected_results'].filter((f) => missing.includes(f));
      const severity: 'high' | 'medium' | 'low' = criticalMissing.length >= 2 ? 'high' : criticalMissing.length === 1 || missing.length >= 3 ? 'medium' : 'low';
      findings.push({
        case_id: r.id, case_key: r.key, name: r.name, application: r.application_key,
        test_type: r.test_type, missing, thin, severity,
      });
    }
    return reply.send({
      data: {
        total: rows.length,
        clean: allClean,
        with_findings: findings.length,
        by_severity: {
          high: findings.filter((f) => f.severity === 'high').length,
          medium: findings.filter((f) => f.severity === 'medium').length,
          low: findings.filter((f) => f.severity === 'low').length,
        },
        min_objective_chars: minObjective,
        findings,
      },
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/test-cases/:id/suites', async (req, reply) => {
    const tc = await findCase(req.params.id);
    if (!tc) return reply.status(404).send({ error: 'Test case not found' });
    const { rows } = await query(
      `SELECT s.id, s.key, s.name, s.suite_type, 'active' AS status
       FROM test_suites s JOIN test_case_suites m ON m.test_suite_id = s.id
       WHERE m.test_case_id = $1 ORDER BY s.name`,
      [tc.id]
    );
    return reply.send({ data: rows });
  });

  app.post<{ Params: { id: string }; Body: { text?: string; author?: string } }>('/api/v1/test-cases/:id/notes', async (req, reply) => {
    const tc = await findCase(req.params.id);
    if (!tc) return reply.status(404).send({ error: 'Test case not found' });
    const text = String(req.body?.text || '').trim();
    if (!text) return reply.status(400).send({ error: 'text is required' });
    const note = { author: req.body?.author || req.actor?.id || 'console', text: text.slice(0, 2000), at: new Date().toISOString() };
    const { rows } = await query(
      `UPDATE test_cases SET notes = notes || $1::jsonb, updated_at = now() WHERE id = $2 RETURNING *`,
      [JSON.stringify([note]), tc.id]
    );
    await audit(req, 'test_case.note', 'test_case', tc.id, { key: tc.key });
    const updated = rows[0]!;
    return reply.send({ data: { ...updated, etag: etagOf(updated) } });
  });

  app.post<{ Params: { id: string }; Body: { watch?: boolean; user?: string } }>('/api/v1/test-cases/:id/watch', async (req, reply) => {
    const tc = await findCase(req.params.id);
    if (!tc) return reply.status(404).send({ error: 'Test case not found' });
    const user = String(req.body?.user || req.actor?.id || 'console');
    const current: string[] = Array.isArray(tc.watchers) ? tc.watchers : [];
    const watch = req.body?.watch !== false;
    const next = watch ? [...new Set([...current, user])] : current.filter((w) => w !== user);
    await query('UPDATE test_cases SET watchers = $1::jsonb WHERE id = $2', [JSON.stringify(next), tc.id]);
    return reply.send({ watchers: next, watching: watch });
  });

  app.patch<{ Params: { id: string }; Body: { triageStatus?: string; assignee?: string; linkedIssueUrl?: string } }>('/api/v1/test-cases/:id/triage', async (req, reply) => {
    const tc = await findCase(req.params.id);
    if (!tc) return reply.status(404).send({ error: 'Test case not found' });
    const b = req.body || {};
    if (b.triageStatus && !TRIAGE_STATUSES.includes(b.triageStatus as any)) {
      return reply.status(400).send({ error: `triageStatus must be one of ${TRIAGE_STATUSES.join(', ')}` });
    }
    const ifMatch = req.headers['if-match'];
    if (typeof ifMatch === 'string' && ifMatch && ifMatch !== etagOf(tc)) return reply.status(412).send({ error: 'Stale If-Match — reopen the case' });
    const { rows } = await query(
      `UPDATE test_cases SET
         triage_status = COALESCE($1, triage_status),
         assignee = CASE WHEN $2::text IS NULL THEN assignee ELSE NULLIF($2, '') END,
         linked_issue_url = CASE WHEN $3::text IS NULL THEN linked_issue_url ELSE NULLIF($3, '') END,
         updated_at = now()
       WHERE id = $4 RETURNING *`,
      [b.triageStatus ?? null, b.assignee ?? null, b.linkedIssueUrl ?? null, tc.id]
    );
    const updated = rows[0]!;
    await audit(req, 'test_case.triage', 'test_case', tc.id, { key: tc.key, triage_status: updated.triage_status, assignee: updated.assignee });
    return reply.send({ data: { ...updated, etag: etagOf(updated) } });
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/test-cases/:id/run', async (req, reply) => {
    const tc = await findCase(req.params.id);
    if (!tc) return reply.status(404).send({ error: 'Test case not found' });
    const b = req.body || {};
    const run = await queueCaseRun(req, {
      caseIds: [tc.id],
      suiteId: typeof b.suiteId === 'string' ? b.suiteId : null,
      environment: b.environment ?? b.environment_id,
      triggerSource: typeof b.trigger_source === 'string' ? b.trigger_source : 'manual',
      metadata: b.headless === false ? { headless: false } : undefined,
      applicationVersion: typeof b.application_version === 'string' ? b.application_version : null,
    });
    if (!run) return reply.status(404).send({ error: 'Test case not found' });
    return reply.status(202).send({ accepted: true, run });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/test-cases/run-batch', async (req, reply) => {
    const b = req.body || {};
    const refs = Array.isArray(b.ids) ? b.ids.map(String) : [];
    if (!refs.length) return reply.status(400).send({ error: 'ids is required' });
    const { rows } = await query('SELECT id FROM test_cases WHERE id::text = ANY($1::text[]) OR key = ANY($1::text[])', [refs]);
    const ids = rows.map((r) => r.id as string);
    if (!ids.length) return reply.status(404).send({ error: 'No matching test cases' });
    const run = await queueCaseRun(req, { caseIds: ids, environment: b.environment ?? b.environment_id, triggerSource: 'manual', applicationVersion: typeof b.application_version === 'string' ? b.application_version : null });
    return reply.status(202).send({ accepted: true, selected: ids.length, runs: run ? [run] : [] });
  });

  // ---------------------------------------------------------------------------
  // Test suites
  // ---------------------------------------------------------------------------
  app.get('/api/v1/test-suites', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appId = await resolveApplicationId(q.application_key || q.application_id);
    const { rows } = await query(
      `SELECT s.*, a.key AS application_key,
              COALESCE((SELECT array_agg(m.test_case_id::text ORDER BY m.sort_order) FROM test_case_suites m WHERE m.test_suite_id = s.id), '{}') AS case_ids
       FROM test_suites s JOIN applications a ON a.id = s.application_id
       WHERE ($1::uuid IS NULL OR s.application_id = $1::uuid)
       ORDER BY s.created_at DESC`,
      [appId]
    );
    return reply.send({ data: rows.map(suiteView) });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/test-suites', async (req, reply) => {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return reply.status(400).send({ error: 'name is required' });
    const appId = await resolveApplicationId(b.application_key ?? b.application_id ?? b.applicationKey);
    if (!appId) return reply.status(400).send({ error: 'application_key is required' });
    const caseRefs = Array.isArray(b.caseIds) ? b.caseIds.map(String) : Array.isArray(b.case_ids) ? b.case_ids.map(String) : [];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'suite';
    const key = typeof b.key === 'string' && b.key.trim() ? b.key.trim() : `suite-${slug}-${Date.now().toString(36)}`;
    const row = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [key, name, (b.description as string) ?? null, appId, (b.suite_type as string) ?? 'custom', (b.created_by as string) ?? req.actor?.id ?? 'console']
      );
      if (caseRefs.length) {
        const found = await client.query('SELECT id FROM test_cases WHERE id::text = ANY($1::text[]) OR key = ANY($1::text[])', [caseRefs]);
        const ids = caseRefs.map((r) => found.rows.find((x) => x.id === r)?.id ?? found.rows.find((x) => x.key === r)?.id).filter(Boolean);
        for (let i = 0; i < found.rows.length; i++) {
          await client.query('INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [found.rows[i].id, rows[0].id, i]);
        }
        void ids;
      }
      return rows[0];
    });
    await audit(req, 'test_suite.create', 'test_suite', row.id, { key: row.key, cases: caseRefs.length });
    const full = (await findSuite(row.id))!;
    return reply.status(201).send({ ...suiteView(full), data: suiteView(full) });
  });

  app.get<{ Params: { id: string } }>('/api/v1/test-suites/:id', async (req, reply) => {
    const s = await findSuite(req.params.id);
    if (!s) return reply.status(404).send({ error: 'Test suite not found' });
    const { rows: cases } = await query(
      `SELECT tc.id, tc.key, tc.name, ${PRIORITY_LABEL_SQL} AS priority, tc.execution_method, tc.test_type
       FROM test_case_suites m JOIN test_cases tc ON tc.id = m.test_case_id WHERE m.test_suite_id = $1 ORDER BY m.sort_order`,
      [s.id]
    );
    return reply.send({ data: { ...suiteView(s), cases } });
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/test-suites/:id', async (req, reply) => {
    const s = await findSuite(req.params.id);
    if (!s) return reply.status(404).send({ error: 'Test suite not found' });
    const b = req.body || {};
    const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim() : null;
    const caseRefs = Array.isArray(b.caseIds) ? b.caseIds.map(String) : Array.isArray(b.case_ids) ? b.case_ids.map(String) : null;
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE test_suites SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = now(), updated_by = $3 WHERE id = $4`,
        [name, (b.description as string) ?? null, req.actor?.id ?? 'console', s.id]
      );
      if (caseRefs) {
        await client.query('DELETE FROM test_case_suites WHERE test_suite_id = $1', [s.id]);
        const found = caseRefs.length ? await client.query('SELECT id, key FROM test_cases WHERE id::text = ANY($1::text[]) OR key = ANY($1::text[])', [caseRefs]) : { rows: [] as any[] };
        let i = 0;
        for (const ref of caseRefs) {
          const hit = found.rows.find((x) => x.id === ref || x.key === ref);
          if (!hit) continue;
          await client.query('INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [hit.id, s.id, i++]);
        }
      }
    });
    await audit(req, 'test_suite.update', 'test_suite', s.id, { key: s.key, cases: caseRefs ? caseRefs.length : undefined });
    return reply.send({ data: suiteView((await findSuite(s.id))!) });
  });

  app.delete<{ Params: { id: string } }>('/api/v1/test-suites/:id', async (req, reply) => {
    const s = await findSuite(req.params.id);
    if (!s) return reply.status(404).send({ error: 'Test suite not found' });
    await query('DELETE FROM test_suites WHERE id = $1', [s.id]);
    await audit(req, 'test_suite.delete', 'test_suite', s.id, { key: s.key });
    return reply.send({ deleted: true, id: s.id, data: { deleted: s.id } });
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/test-suites/:id/run', async (req, reply) => {
    const s = await findSuite(req.params.id);
    if (!s) return reply.status(404).send({ error: 'Test suite not found' });
    const ids: string[] = s.case_ids || [];
    if (!ids.length) return reply.status(400).send({ error: 'This suite has no member cases to run' });
    const b = req.body || {};
    const run = await queueCaseRun(req, { caseIds: ids, suiteId: s.id, environment: b.environment ?? b.environment_id, triggerSource: 'manual', applicationVersion: typeof b.application_version === 'string' ? b.application_version : null });
    return reply.status(202).send({ accepted: true, run, outcome: { suiteId: s.id, ranCases: ids.length, queued: ids.length } });
  });

  app.get<{ Params: { id: string } }>('/api/v1/test-suites/:id/runs', async (req, reply) => {
    const s = await findSuite(req.params.id);
    if (!s) return reply.status(404).send({ error: 'Test suite not found' });
    const { rows } = await query(
      `SELECT e.id, e.key, e.name, e.status, e.trigger_source, e.requested_by, e.environment_id, env.key AS environment, e.created_at, e.started_at, e.finished_at,
              cardinality(e.test_case_ids)::int AS total,
              (SELECT count(*)::int FROM execution_results er WHERE er.execution_id = e.id AND er.status = 'passed') AS passed,
              (SELECT count(*)::int FROM execution_results er WHERE er.execution_id = e.id AND er.status IN ${FAILED}) AS failed,
              (SELECT count(*)::int FROM execution_results er WHERE er.execution_id = e.id AND er.status IN ${BLOCKED}) AS blocked
       FROM executions e LEFT JOIN environments env ON env.id = e.environment_id
       WHERE e.test_suite_id = $1 ORDER BY e.created_at DESC LIMIT 100`,
      [s.id]
    );
    return reply.send({ data: rows.map((r) => ({ ...r, suite_id: s.id, result: r.status === 'passed' ? 'pass' : ['failed', 'error', 'timed_out'].includes(r.status) ? 'fail' : r.status })) });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/test-suites/from-suites', async (req, reply) => {
    const b = req.body || {};
    const suiteIds = Array.isArray(b.suiteIds) ? b.suiteIds.map(String) : [];
    if (suiteIds.length < 1) return reply.status(400).send({ error: 'suiteIds is required' });
    const sources = (await Promise.all(suiteIds.map(findSuite))).filter(Boolean) as any[];
    const primary = sources[0];
    if (!primary) return reply.status(404).send({ error: 'No matching suites' });
    const caseIds = [...new Set(sources.flatMap((s: any) => s.case_ids || []))];
    const name = String(b.name || 'Combined suite').trim();
    const key = `suite-combined-${Date.now().toString(36)}`;
    const row = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by) VALUES ($1,$2,$3,$4,'custom',$5) RETURNING *`,
        [key, name, `Composed from ${sources.map((s: any) => s.name).join(', ')}`, primary.application_id, req.actor?.id ?? 'console']
      );
      for (let i = 0; i < caseIds.length; i++) {
        await client.query('INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [caseIds[i], rows[0].id, i]);
      }
      return rows[0];
    });
    await audit(req, 'test_suite.compose', 'test_suite', row.id, { key, source_suites: suiteIds, cases: caseIds.length });
    return reply.status(201).send({ id: row.id, key, name, case_ids: caseIds, source_suites: suiteIds, data: suiteView((await findSuite(row.id))!) });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/test-suites/run-batch', async (req, reply) => {
    const b = req.body || {};
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const runs: any[] = [];
    for (const ref of ids) {
      const s = await findSuite(ref);
      if (!s || !(s.case_ids || []).length) continue;
      const run = await queueCaseRun(req, { caseIds: s.case_ids, suiteId: s.id, environment: b.environment ?? b.environment_id, triggerSource: 'manual', applicationVersion: typeof b.application_version === 'string' ? b.application_version : null });
      if (run) runs.push(run);
    }
    return reply.status(202).send({ accepted: true, selected: ids.length, runs });
  });

  // ---------------------------------------------------------------------------
  // Test runs (per-case results, Sand Bench test_runs shape) + remarks
  // ---------------------------------------------------------------------------
  app.get('/api/v1/test-runs', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appId = await resolveApplicationId(q.application_key || q.application_id);
    const envId = await resolveEnvironmentId(q.environment_id);
    const limit = Math.max(1, Math.min(Number(q.limit) || 50, 500));
    const offset = Math.max(0, Math.floor(Number(q.offset) || 0));
    const clauses: string[] = ['true'];
    const params: unknown[] = [];
    if (appId) { params.push(appId); clauses.push(`tc.application_id = $${params.length}::uuid`); }
    if (envId) { params.push(envId); clauses.push(`e.environment_id = $${params.length}::uuid`); }
    if (q.case_id) { params.push(q.case_id); clauses.push(`(tc.id::text = $${params.length} OR tc.key = $${params.length})`); }
    if (q.suite_id) { params.push(q.suite_id); clauses.push(`(e.test_suite_id::text = $${params.length} OR s.key = $${params.length})`); }
    if (q.execution_id) { params.push(q.execution_id); clauses.push(`(e.id::text = $${params.length} OR e.key = $${params.length})`); }
    if (q.result === 'pass') clauses.push(`er.status = 'passed'`);
    else if (q.result === 'fail') clauses.push(`er.status IN ${FAILED}`);
    else if (q.result === 'blocked') clauses.push(`er.status IN ${BLOCKED}`);
    const where = clauses.join(' AND ');
    const [rows, total] = await Promise.all([
      query(`${RUN_SELECT} WHERE ${where} ORDER BY er.created_at DESC LIMIT ${limit} OFFSET ${offset}`, params),
      query(`SELECT count(*)::int AS c FROM execution_results er JOIN executions e ON e.id = er.execution_id JOIN test_cases tc ON tc.id = er.test_case_id LEFT JOIN test_suites s ON s.id = e.test_suite_id WHERE ${where}`, params),
    ]);
    return reply.send({ data: rows.rows.map(runView), total: total.rows[0]?.c ?? 0, limit, offset });
  });

  app.get<{ Params: { id: string } }>('/api/v1/test-runs/:id', async (req, reply) => {
    if (!UUID.test(req.params.id)) return reply.status(404).send({ error: 'Test run not found' });
    const { rows } = await query(`${RUN_SELECT} WHERE er.id = $1::uuid`, [req.params.id]);
    const run = rows[0];
    if (!run) return reply.status(404).send({ error: 'Test run not found' });
    const ev = await query('SELECT id, evidence_type, content_type, size_bytes, storage_key, redacted, metadata, created_at FROM evidence WHERE execution_result_id = $1 ORDER BY created_at', [run.id]);
    const exec = await query('SELECT remarks FROM executions WHERE id = $1', [run.execution_id]);
    return reply.send({
      data: {
        ...runView(run),
        metrics: run.metrics,
        evidence: ev.rows.map((e) => ({ ...e, url: evidenceUrl(e.storage_key) })),
        execution_remarks: Array.isArray(exec.rows[0]?.remarks) ? exec.rows[0].remarks : [],
      },
    });
  });

  app.post<{ Params: { id: string }; Body: { text?: string; author?: string } }>('/api/v1/executions/:id/remarks', async (req, reply) => {
    const { rows: exec } = await query('SELECT id, key FROM executions WHERE id::text = $1 OR key = $1', [req.params.id]);
    const target = exec[0];
    if (!target) return reply.status(404).send({ error: 'Execution not found' });
    const text = String(req.body?.text || '').trim();
    if (!text) return reply.status(400).send({ error: 'text is required' });
    const remark = { author: req.body?.author || req.actor?.id || 'console', text: text.slice(0, 2000), at: new Date().toISOString() };
    const { rows } = await query('UPDATE executions SET remarks = remarks || $1::jsonb WHERE id = $2 RETURNING remarks', [JSON.stringify([remark]), target.id]);
    await audit(req, 'execution.remark', 'execution', target.id, { key: target.key });
    return reply.status(201).send({ data: rows[0]?.remarks ?? [] });
  });

  // Priority labels are what the screen edits; the repository stores p0..p4.
  app.get('/api/v1/test-cases/options', async (_req, reply) => {
    return reply.send({
      priorities: Object.keys(LABEL_PRIORITY),
      priority_label: PRIORITY_LABEL,
      triage_statuses: TRIAGE_STATUSES,
      estimated_durations: ['Under 1m', '1-5m', '5-15m', '15-60m', '60m+'],
      visibilities: ['Public', 'Team', 'Private'],
      statuses: ['draft', 'active', 'archived'],
    });
  });
}
