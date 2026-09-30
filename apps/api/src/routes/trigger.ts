/**
 * Run trigger API — start the tests of one application against one environment
 * from outside the console (a deploy pipeline, the application itself, a cron).
 *
 *   POST /api/v1/runs                 queue a run            → 202 { run_id, status_url, … }
 *   GET  /api/v1/runs                 recent runs (filter by application / environment)
 *   GET  /api/v1/runs/:runId          state, verdict and exit criteria of a run
 *   GET  /api/v1/runs/:runId/evidence evidence manifest of a run
 *
 * A run is a group of executions (one per suite) sharing metadata.run_group, the
 * same grouping /executions/run-all uses, so those groups resolve here as well;
 * a plain execution id/key is accepted too and reads as a one-execution run.
 */
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { query } from '../db/client.js';
import { audit } from '../middleware/rbac.js';
import { gateMode } from '../evidence-gate.js';
import { evidenceUrl } from '../evidence-store.js';
import { humanDateTime } from '../lib/naming.js';

const ACTIVE = ['queued', 'preparing', 'running'];
const VERDICT_STATUSES = new Set(['passed', 'failed']);

interface Scope {
  suites?: string[];
  tags?: string[];
  test_types?: string[];
  methods?: string[];
  case_keys?: string[];
}

function strings(value: unknown): string[] | undefined {
  if (typeof value === 'string' && value.trim()) return value.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(value)) {
    const out = value.map(String).map((s) => s.trim()).filter(Boolean);
    return out.length ? out : undefined;
  }
  return undefined;
}

/** Safety category a case falls under, matched against the environment's safety_policy. */
function safetyCategory(c: { execution_method?: string | null; test_type?: string | null; tags?: string[] | null }): string {
  const method = String(c.execution_method || '').toLowerCase();
  const tags = (c.tags || []).map((t) => t.toLowerCase());
  if (tags.includes('chaos') || c.test_type === 'resilience') return 'chaos';
  if (method === 'endurance' || method === 'soak' || tags.includes('endurance')) return 'soak';
  if (['performance', 'load', 'k6'].includes(method) || c.test_type === 'performance') return 'load';
  if (c.test_type === 'security') return 'security_scan';
  return 'functional_smoke';
}

async function onlineWorkers(): Promise<number> {
  const { rows } = await query(
    `SELECT count(*)::int AS c FROM workers
     WHERE last_heartbeat > now() - interval '60 seconds' AND status <> 'draining'`
  );
  return rows[0]?.c ?? 0;
}

async function loadRun(runId: string) {
  let { rows: executions } = await query(
    `SELECT * FROM executions WHERE metadata->>'run_group' = $1 ORDER BY created_at`,
    [runId]
  );
  if (!executions.length) {
    ({ rows: executions } = await query(`SELECT * FROM executions WHERE id::text = $1 OR key = $1`, [runId]));
  }
  if (!executions.length) return null;

  const ids = executions.map((e: any) => e.id);
  const { rows: results } = await query(
    `SELECT DISTINCT ON (er.execution_id, er.test_case_id)
            er.id, er.execution_id, er.test_case_id, er.status, er.verdict, er.classification,
            er.message, er.duration_ms, er.finished_at,
            tc.key AS case_key, tc.name AS case_name, tc.execution_method,
            (SELECT count(*)::int FROM evidence ev WHERE ev.execution_result_id = er.id) AS evidence_count
     FROM execution_results er
     JOIN test_cases tc ON tc.id = er.test_case_id
     WHERE er.execution_id = ANY($1::uuid[])
     ORDER BY er.execution_id, er.test_case_id, er.created_at DESC`,
    [ids]
  );
  return { executions, results };
}

function summarize(runId: string, executions: any[], results: any[], workers: number) {
  const expected = executions.reduce((n, e) => n + (e.test_case_ids?.length || 0), 0);
  const count = (pred: (r: any) => boolean) => results.filter(pred).length;
  const passed = count((r) => r.status === 'passed');
  const failed = count((r) => r.status === 'failed');
  const skipped = count((r) => r.status === 'skipped');
  const inconclusive = results.length - passed - failed - skipped;
  const withoutEvidence = count((r) => VERDICT_STATUSES.has(r.status) && !r.evidence_count);

  const active = executions.filter((e) => ACTIVE.includes(e.status));
  const cancelled = executions.length > 0 && executions.every((e) => e.status === 'cancelled');
  let state: string;
  if (active.length) {
    const started = active.some((e) => e.status !== 'queued') || results.length > 0;
    state = workers === 0 ? 'stalled' : started ? 'running' : 'queued';
  } else {
    state = cancelled ? 'cancelled' : 'completed';
  }

  const criteria = {
    all_cases_reported: results.length >= expected,
    evidence_complete: withoutEvidence === 0,
    all_passed: results.length > 0 && failed === 0 && inconclusive === 0,
  };
  const met = criteria.all_cases_reported && criteria.evidence_complete && criteria.all_passed;
  const verdict = state !== 'completed' ? null : met ? 'pass' : failed > 0 ? 'fail' : 'inconclusive';

  const first = executions[0] || {};
  const byExecution = new Map<string, any[]>();
  for (const r of results) {
    const list = byExecution.get(r.execution_id) || [];
    list.push(r);
    byExecution.set(r.execution_id, list);
  }

  return {
    run_id: runId,
    application: first.metadata?.application_key ?? null,
    environment_id: first.environment_id ?? null,
    environment: first.metadata?.environment_key ?? null,
    trigger_source: first.trigger_source,
    requested_by: first.requested_by,
    reason: first.metadata?.trigger?.reason ?? null,
    state,
    verdict,
    exit_criteria: { met: state === 'completed' && met, gate: gateMode(), ...criteria },
    totals: {
      cases: expected,
      reported: results.length,
      passed,
      failed,
      skipped,
      inconclusive,
      without_evidence: withoutEvidence,
      evidence_items: results.reduce((n, r) => n + (r.evidence_count || 0), 0),
    },
    workers_online: workers,
    created_at: first.created_at ?? null,
    started_at: executions.map((e) => e.started_at).filter(Boolean).sort()[0] ?? null,
    finished_at: active.length ? null : executions.map((e) => e.finished_at).filter(Boolean).sort().pop() ?? null,
    executions: executions.map((e) => {
      const rs = byExecution.get(e.id) || [];
      return {
        id: e.id,
        key: e.key,
        suite_key: e.metadata?.suite_key ?? null,
        status: e.status,
        worker_id: e.worker_id,
        cases: e.test_case_ids?.length || 0,
        reported: rs.length,
        passed: rs.filter((r) => r.status === 'passed').length,
        failed: rs.filter((r) => r.status !== 'passed' && r.status !== 'skipped').length,
        started_at: e.started_at,
        finished_at: e.finished_at,
      };
    }),
    links: {
      self: `/api/v1/runs/${encodeURIComponent(runId)}`,
      evidence: `/api/v1/runs/${encodeURIComponent(runId)}/evidence`,
    },
  };
}

export interface RunRequest {
  application: string;
  environment: string;
  scope?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
  requested_by?: string | null;
  trigger_source?: string;
  exclusive?: boolean;
  approved_categories?: string[] | string;
  dry_run?: boolean;
}

export interface RunOutcome {
  status: number;
  body: Record<string, any>;
  /** Set when executions were queued: what to audit. */
  queued?: { run_id: string; application_id: string; environment: string; executions: number; total_cases: number; excluded: number; trigger_source: string };
}

/**
 * Plan and queue a run of one application on one environment. Shared by the
 * trigger API and by schedules, so both honor the same scope filters, safety
 * policy and grouping. Never throws for a caller mistake: the outcome carries
 * the HTTP status and body to answer with.
 */
export async function queueRun(r: RunRequest, actorId?: string | null): Promise<RunOutcome> {
  const appRef = typeof r.application === 'string' ? r.application : '';
  const envRef = typeof r.environment === 'string' ? r.environment : '';
  if (!appRef || !envRef) {
    return { status: 400, body: { error: 'application and environment are required (key or id)' } };
  }

  const appRow = await query(`SELECT id, key, name, status FROM applications WHERE id::text = $1 OR key = $1`, [appRef]);
  const application = appRow.rows[0];
  if (!application) return { status: 404, body: { error: 'Application not found', application: appRef } };

  const envRow = await query(
    `SELECT id, key, name, env_type, base_url, status, safety_policy FROM environments WHERE id::text = $1 OR key = $1`,
    [envRef]
  );
  const environment = envRow.rows[0];
  if (!environment) return { status: 404, body: { error: 'Environment not found', environment: envRef } };
  if (environment.status !== 'active') {
    return { status: 409, body: { error: `Environment is ${environment.status}`, environment: environment.key } };
  }

  if (r.exclusive === true) {
    const busy = await query(
      `SELECT DISTINCT metadata->>'run_group' AS run_id FROM executions
       WHERE status = ANY($1::execution_status[]) AND environment_id = $2
         AND metadata->>'application_key' = $3 AND metadata->>'run_group' IS NOT NULL`,
      [ACTIVE, environment.id, application.key]
    );
    if (busy.rows[0]) {
      const active = busy.rows[0].run_id;
      return {
        status: 409,
        body: {
          error: 'A run for this application and environment is already in progress',
          run_id: active,
          status_url: `/api/v1/runs/${encodeURIComponent(active)}`,
        },
      };
    }
  }

  const raw = (r.scope && typeof r.scope === 'object' ? r.scope : {}) as Record<string, unknown>;
  const scope: Scope = {
    suites: strings(raw.suites),
    tags: strings(raw.tags),
    test_types: strings(raw.test_types),
    methods: strings(raw.methods)?.map((m) => m.toLowerCase()),
    case_keys: strings(raw.case_keys),
  };

  const { rows: candidates } = await query(
    `SELECT tc.id, tc.key, tc.execution_method, tc.test_type::text AS test_type, tc.tags,
            tc.automation_status::text AS automation_status,
            s.id AS suite_id, s.key AS suite_key, s.name AS suite_name
     FROM test_cases tc
     LEFT JOIN test_case_suites m ON m.test_case_id = tc.id
     LEFT JOIN test_suites s ON s.id = m.test_suite_id
     WHERE tc.application_id = $1 AND tc.lifecycle NOT IN ('deprecated','archived')
     ORDER BY s.key NULLS LAST, m.sort_order, tc.key`,
    [application.id]
  );

  const policy = (environment.safety_policy || {}) as Record<string, string>;
  const approved = new Set(strings(r.approved_categories) || []);
  const seen = new Set<string>();
  const excluded: Array<{ case_key: string; reason: string }> = [];
  type Group = { suite_id: string | null; suite_key: string; suite_name: string; case_ids: string[] };
  const plan = new Map<string, Group>();

  for (const c of candidates) {
    if (scope.suites && !scope.suites.includes(c.suite_key)) continue;
    if (scope.case_keys && !scope.case_keys.includes(c.key)) continue;
    if (scope.test_types && !scope.test_types.includes(c.test_type)) continue;
    if (scope.methods && !scope.methods.includes(String(c.execution_method || '').toLowerCase())) continue;
    if (scope.tags && !scope.tags.some((t) => (c.tags || []).includes(t))) continue;
    if (seen.has(c.id)) continue;
    seen.add(c.id);

    if (!['automated', 'partially_automated'].includes(c.automation_status)) {
      excluded.push({ case_key: c.key, reason: `not automated (${c.automation_status})` });
      continue;
    }
    const category = safetyCategory(c);
    const decision = policy[category];
    if (decision === 'prohibited' || (decision === 'approval_required' && !approved.has(category))) {
      excluded.push({ case_key: c.key, reason: `${category} is ${decision} on ${environment.key}` });
      continue;
    }

    const suiteKey = c.suite_key || 'unassigned';
    const group: Group = plan.get(suiteKey) || { suite_id: c.suite_id ?? null, suite_key: suiteKey, suite_name: c.suite_name || 'Unassigned cases', case_ids: [] };
    group.case_ids.push(c.id);
    plan.set(suiteKey, group);
  }

  const groups = [...plan.values()];
  const totalCases = groups.reduce((n, g) => n + g.case_ids.length, 0);
  const workers = await onlineWorkers();
  const planView = {
    application: application.key,
    environment: environment.key,
    base_url: environment.base_url,
    total_cases: totalCases,
    suites: groups.map((g) => ({ key: g.suite_key, name: g.suite_name, cases: g.case_ids.length })),
    excluded,
    workers_online: workers,
    evidence_gate: gateMode(),
  };

  if (r.dry_run === true) return { status: 200, body: { data: planView } };
  if (!totalCases) {
    return { status: 422, body: { error: 'No runnable cases match this application, environment and scope', data: planView } };
  }

  const runId = `run-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const requestedBy = (typeof r.requested_by === 'string' && r.requested_by) || actorId || null;
  const source = typeof r.trigger_source === 'string' && /^[\w-]{1,40}$/.test(r.trigger_source) ? r.trigger_source : 'api';
  const callerMeta = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
  const created: any[] = [];
  // Display name, same shape as console-queued runs: "<what> — <timestamp>".
  const stamp = humanDateTime(new Date());
  const scheduleName = typeof (callerMeta as any).schedule_name === 'string' ? String((callerMeta as any).schedule_name) : null;

  for (const g of groups) {
    const key = `exec-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const what = scheduleName ? (groups.length > 1 ? `${scheduleName} · ${g.suite_name}` : scheduleName) : g.suite_name;
    const { rows } = await query(
      `INSERT INTO executions (
         key, name, requested_by, test_suite_id, test_case_ids, environment_id,
         execution_location, status, trigger_source, metadata
       ) VALUES ($1,$8,$2,$3,$4,$5,'out_of_container','queued',$6,$7::jsonb)
       RETURNING id, key, name, status, created_at`,
      [
        key, requestedBy, g.suite_id, g.case_ids, environment.id, source,
        JSON.stringify({
          ...callerMeta,
          run_group: runId,
          suite_key: g.suite_key,
          application_key: application.key,
          environment_key: environment.key,
          trigger: { reason: typeof r.reason === 'string' ? r.reason.slice(0, 300) : null, scope },
        }),
        `${what} — ${stamp}`,
      ]
    );
    created.push({ ...rows[0], suite_key: g.suite_key, cases: g.case_ids.length });
  }

  return {
    status: 202,
    body: {
      data: {
        run_id: runId,
        ...planView,
        executions: created,
        status_url: `/api/v1/runs/${runId}`,
        evidence_url: `/api/v1/runs/${runId}/evidence`,
      },
      message: `Queued ${totalCases} cases in ${created.length} executions`,
      ...(workers === 0 ? { warning: 'No worker is online — the run stays queued until one registers' } : {}),
    },
    queued: {
      run_id: runId,
      application_id: application.id,
      environment: environment.key,
      executions: created.length,
      total_cases: totalCases,
      excluded: excluded.length,
      trigger_source: source,
    },
  };
}

export async function triggerRoutes(app: FastifyInstance) {
  app.post<{ Body: Record<string, unknown> }>('/api/v1/runs', async (req, reply) => {
    const b = req.body || {};
    const outcome = await queueRun(b as unknown as RunRequest, req.actor?.id);
    if (outcome.queued) {
      await audit(req, 'run.trigger', 'application', outcome.queued.application_id, outcome.queued);
    }
    return reply.status(outcome.status).send(outcome.body);
  });

  app.get('/api/v1/runs', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const limit = Math.max(1, Math.min(Number(q.limit) || 20, 100));
    const params: unknown[] = [];
    const clauses = [`e.metadata->>'run_group' IS NOT NULL`];
    if (q.application) {
      params.push(q.application);
      clauses.push(`e.metadata->>'application_key' = $${params.length}`);
    }
    if (q.environment) {
      params.push(q.environment);
      clauses.push(`(env.key = $${params.length} OR env.id::text = $${params.length})`);
    }
    params.push(limit);
    const { rows } = await query(
      `SELECT e.metadata->>'run_group' AS run_id,
              max(e.metadata->>'application_key') AS application,
              max(env.key) AS environment,
              max(e.trigger_source) AS trigger_source,
              min(e.created_at) AS created_at,
              max(e.finished_at) AS finished_at,
              count(*)::int AS executions,
              sum(cardinality(e.test_case_ids))::int AS cases,
              count(*) FILTER (WHERE e.status = ANY('{queued,preparing,running}'::execution_status[]))::int AS active,
              count(*) FILTER (WHERE e.status = 'passed')::int AS passed,
              count(*) FILTER (WHERE e.status NOT IN ('passed','queued','preparing','running','cancelled'))::int AS failed
       FROM executions e
       LEFT JOIN environments env ON env.id = e.environment_id
       WHERE ${clauses.join(' AND ')}
       GROUP BY 1
       ORDER BY min(e.created_at) DESC
       LIMIT $${params.length}`,
      params
    );
    return reply.send({
      data: rows.map((r: any) => ({
        ...r,
        state: r.active ? 'running' : 'completed',
        status_url: `/api/v1/runs/${encodeURIComponent(r.run_id)}`,
      })),
    });
  });

  app.get<{ Params: { runId: string } }>('/api/v1/runs/:runId', async (req, reply) => {
    const run = await loadRun(req.params.runId);
    if (!run) return reply.status(404).send({ error: 'Run not found' });
    const summary = summarize(req.params.runId, run.executions, run.results, await onlineWorkers());
    const problems = run.results
      .filter((r: any) => r.status !== 'passed' && r.status !== 'skipped')
      .slice(0, 100)
      .map((r: any) => ({
        result_id: r.id,
        case_key: r.case_key,
        name: r.case_name,
        method: r.execution_method,
        status: r.status,
        classification: r.classification,
        message: r.message,
        evidence_count: r.evidence_count,
        evidence_url: `/api/v1/execution-results/${r.id}/evidence`,
      }));
    const missingEvidence = run.results
      .filter((r: any) => VERDICT_STATUSES.has(r.status) && !r.evidence_count)
      .slice(0, 100)
      .map((r: any) => ({ result_id: r.id, case_key: r.case_key, status: r.status }));
    return reply.send({ data: { ...summary, problems, missing_evidence: missingEvidence } });
  });

  app.get<{ Params: { runId: string } }>('/api/v1/runs/:runId/evidence', async (req, reply) => {
    const run = await loadRun(req.params.runId);
    if (!run) return reply.status(404).send({ error: 'Run not found' });
    const resultIds = run.results.map((r: any) => r.id);
    const { rows } = resultIds.length
      ? await query(
          `SELECT id, execution_result_id, evidence_type, storage_key, content_type, size_bytes, redacted, metadata, created_at
           FROM evidence WHERE execution_result_id = ANY($1::uuid[]) ORDER BY created_at`,
          [resultIds]
        )
      : { rows: [] as any[] };
    const byResult = new Map<string, any[]>();
    for (const ev of rows) {
      const list = byResult.get(ev.execution_result_id) || [];
      list.push({
        id: ev.id,
        type: ev.evidence_type,
        content_type: ev.content_type,
        size_bytes: ev.size_bytes,
        sha256: ev.metadata?.sha256 ?? null,
        redacted: ev.redacted,
        created_at: ev.created_at,
        url: evidenceUrl(ev.storage_key),
      });
      byResult.set(ev.execution_result_id, list);
    }
    return reply.send({
      data: {
        run_id: req.params.runId,
        evidence_items: rows.length,
        cases: run.results.map((r: any) => ({
          case_key: r.case_key,
          name: r.case_name,
          method: r.execution_method,
          status: r.status,
          evidence: byResult.get(r.id) || [],
        })),
      },
    });
  });
}
