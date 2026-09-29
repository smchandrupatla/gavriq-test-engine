/**
 * Evidence gate — the exit criterion of a test run.
 *
 * A result only counts as passed/failed when the control plane can serve the
 * evidence behind it. The gate runs as a hook in front of the worker-facing
 * result endpoints, so every worker (container, host, remote) is held to it:
 *
 *   POST /executions/:id/results   evidence is verified against the store; a
 *                                  passed/failed result without the evidence
 *                                  its runner must produce is recorded as
 *                                  error / inconclusive instead.
 *   POST /executions/:id/complete  the final status is derived from what was
 *                                  recorded, not from what the worker claims,
 *                                  and metadata.exit_criteria is written.
 *
 * EVIDENCE_GATE = enforce | report | off. `report` annotates without changing
 * any status — used while older workers are still draining.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { query } from './db/client.js';
import { hashEvidence, statEvidence } from './evidence-store.js';

export type GateMode = 'enforce' | 'report' | 'off';

export function gateMode(): GateMode {
  const raw = (process.env.EVIDENCE_GATE || 'report').toLowerCase();
  return raw === 'enforce' || raw === 'off' ? raw : 'report';
}

/** Evidence types that prove a PASS, per execution method. A FAIL needs any verified item. */
const BROWSER = ['screenshot'];
const TRANSCRIPT = ['http_transcript', 'request', 'response'];
const MEASURED = ['metric'];
export const REQUIRED_FOR_PASS: Record<string, string[]> = {
  playwright: BROWSER,
  selenium: BROWSER,
  http: TRANSCRIPT,
  rest: TRANSCRIPT,
  api: TRANSCRIPT,
  performance: MEASURED,
  load: MEASURED,
  k6: MEASURED,
  endurance: MEASURED,
  soak: MEASURED,
  sit: ['log', 'metric'],
};

/**
 * The runner that actually executes a case. Imported SIT cases keep the method
 * they were catalogued under (http / selenium / playwright) but run as a SIT
 * file, so their evidence is the SIT output, not a transcript or screenshot.
 */
export function effectiveMethod(executionMethod: string | null | undefined, script: string | null | undefined): string {
  const s = String(script || '');
  if (s.includes('sit/cases/') || s.endsWith('.sit.ts') || s.includes('.sit.ts::')) return 'sit';
  return String(executionMethod || 'selenium').toLowerCase();
}

const VERDICT_STATUSES = new Set(['passed', 'failed']);
const NOT_A_FAILURE = new Set(['passed', 'skipped']);

export interface EvidenceVerdict {
  required: boolean;
  satisfied: boolean;
  method: string;
  accepted_types: string[] | 'any';
  verified: number;
  unverified: string[];
  reason?: string;
}

interface ClaimedEvidence {
  type?: string;
  storage_key?: string;
  metadata?: Record<string, unknown>;
  [k: string]: unknown;
}

export function evaluateEvidence(status: string, method: string, claimed: ClaimedEvidence[]): { verdict: EvidenceVerdict; verified: ClaimedEvidence[] } {
  const verified: ClaimedEvidence[] = [];
  const unverified: string[] = [];
  for (const ev of claimed) {
    const key = String(ev?.storage_key || '');
    const found = key ? statEvidence(key) : null;
    if (!found) {
      unverified.push(key || '(no storage_key)');
      continue;
    }
    verified.push({
      ...ev,
      size_bytes: found.size,
      metadata: { ...(ev.metadata || {}), verified: true, sha256: hashEvidence(key) },
    });
  }

  const required = VERDICT_STATUSES.has(status);
  const accepted = status === 'passed' ? REQUIRED_FOR_PASS[method] : undefined;
  const satisfied = !required
    ? true
    : accepted
      ? verified.some((ev) => accepted.includes(String(ev.type)))
      : verified.length > 0;

  let reason: string | undefined;
  if (!satisfied) {
    if (!claimed.length) reason = 'no evidence was submitted';
    else if (!verified.length) reason = 'none of the submitted evidence exists in the evidence store';
    else reason = `a ${method} pass needs ${accepted?.join(' or ')} evidence; got ${verified.map((v) => v.type).join(', ')}`;
  }
  return {
    verified,
    verdict: { required, satisfied, method, accepted_types: accepted || 'any', verified: verified.length, unverified, reason },
  };
}

async function resolveExecutionId(idOrKey: string): Promise<string | null> {
  const { rows } = await query('SELECT id FROM executions WHERE id::text = $1 OR key = $1', [idOrKey]);
  return rows[0]?.id ?? null;
}

export interface ExitCriteria {
  met: boolean;
  gate: GateMode;
  expected_cases: number;
  reported_cases: number;
  passed: number;
  failed: number;
  skipped: number;
  inconclusive: number;
  without_evidence: number;
  all_cases_reported: boolean;
  evidence_complete: boolean;
  all_passed: boolean;
  evaluated_at: string;
}

/** Exit criteria over the latest result of every case the execution was asked to run. */
export async function exitCriteria(executionId: string): Promise<ExitCriteria | null> {
  const exec = await query('SELECT id, test_case_ids FROM executions WHERE id = $1', [executionId]);
  if (!exec.rows[0]) return null;
  const expected: string[] = exec.rows[0].test_case_ids || [];
  const { rows } = await query(
    `SELECT DISTINCT ON (er.test_case_id) er.test_case_id, er.status,
            (SELECT count(*)::int FROM evidence ev WHERE ev.execution_result_id = er.id) AS evidence_count
     FROM execution_results er
     WHERE er.execution_id = $1
     ORDER BY er.test_case_id, er.created_at DESC`,
    [executionId]
  );
  const count = (pred: (r: any) => boolean) => rows.filter(pred).length;
  const reported = new Set(rows.map((r: any) => r.test_case_id));
  const withoutEvidence = count((r) => VERDICT_STATUSES.has(r.status) && !r.evidence_count);
  const c: Omit<ExitCriteria, 'met'> = {
    gate: gateMode(),
    expected_cases: expected.length,
    reported_cases: reported.size,
    passed: count((r) => r.status === 'passed'),
    failed: count((r) => r.status === 'failed'),
    skipped: count((r) => r.status === 'skipped'),
    inconclusive: count((r) => !VERDICT_STATUSES.has(r.status) && r.status !== 'skipped'),
    without_evidence: withoutEvidence,
    all_cases_reported: expected.every((id) => reported.has(id)),
    evidence_complete: withoutEvidence === 0,
    all_passed: rows.length > 0 && rows.every((r: any) => NOT_A_FAILURE.has(r.status)),
    evaluated_at: new Date().toISOString(),
  };
  return { ...c, met: c.all_cases_reported && c.evidence_complete && c.all_passed };
}

function routeOf(req: FastifyRequest): string {
  return `${req.method} ${req.routeOptions?.url || ''}`;
}

export function registerEvidenceGate(app: FastifyInstance) {
  app.addHook('preHandler', async (req) => {
    const mode = gateMode();
    if (mode === 'off') return;
    const route = routeOf(req);

    if (route === 'POST /api/v1/executions/:id/results') {
      const b = (req.body || {}) as Record<string, any>;
      const tc = b.test_case_id
        ? await query('SELECT execution_method, script FROM test_cases WHERE id::text = $1', [String(b.test_case_id)]).catch(() => ({ rows: [] as any[] }))
        : { rows: [] as any[] };
      const method = effectiveMethod(tc.rows[0]?.execution_method, tc.rows[0]?.script);
      const status = String(b.status || '');
      const { verdict, verified } = evaluateEvidence(status, method, Array.isArray(b.evidence) ? b.evidence : []);

      b.evidence = verified;
      b.metrics = { ...(b.metrics || {}), evidence_gate: { mode, ...verdict } };
      if (mode === 'enforce' && verdict.required && !verdict.satisfied) {
        b.metrics.evidence_gate.claimed_status = status;
        b.status = 'error';
        b.verdict = 'inconclusive';
        b.classification = 'infrastructure_failure';
        b.message = `Evidence gate: result claimed "${status}" but ${verdict.reason}. Not counted. ${b.message || ''}`.trim().slice(0, 900);
        req.log.warn({ test_case_id: b.test_case_id, claimed: status, reason: verdict.reason }, 'evidence gate rejected result');
      }
      req.body = b;
      return;
    }

    if (route === 'POST /api/v1/executions/:id/complete') {
      const id = await resolveExecutionId((req.params as { id: string }).id);
      if (!id) return;
      const criteria = await exitCriteria(id);
      if (!criteria) return;
      const b = (req.body || {}) as Record<string, any>;
      const claimed = b.status || 'passed';
      // cancelled / blocked describe why the run stopped, not a verdict — keep them.
      if (mode === 'enforce' && claimed !== 'cancelled' && claimed !== 'blocked') {
        b.status = criteria.met ? 'passed' : 'failed';
      }
      await query(
        `UPDATE executions SET metadata = metadata || $2::jsonb WHERE id = $1`,
        [id, JSON.stringify({ exit_criteria: { ...criteria, claimed_status: claimed } })]
      );
      req.body = b;
    }
  });
}
