/**
 * Defect Manager service — applies the rules in core.ts to Postgres.
 *
 * Called when an execution completes: a normal run files a defect report; a
 * rerun the PM asked for decides verified / reopened for that report's defects.
 */
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { query, withTransaction } from '../db/client.js';
import {
  candidatesFrom, canMoveDefect, canMoveReport, ENGINE_ONLY_STATUSES, evaluateRerun,
  isDefectStatus, planIngest, reportKey, rerunBlockers, summarize,
  type DefectStatus, type ExistingDefect, type ReportStatus, type ResultRow,
} from './core.js';

export class DefectError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
  }
}

type Db = Pick<pg.PoolClient, 'query'>;

function entry(by: string, action: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify([{ at: new Date().toISOString(), by, action, ...extra }]);
}

async function nextDefectKey(db: Db): Promise<string> {
  const { rows } = await db.query<{ n: string }>(`SELECT nextval('defect_key_seq')::text AS n`);
  return `DEF-${String(rows[0]!.n).padStart(5, '0')}`;
}

async function resultsFor(db: Db, executionId: string): Promise<ResultRow[]> {
  // Latest result per case wins when a worker retried a case in the same run.
  const { rows } = await db.query<ResultRow>(
    `SELECT DISTINCT ON (r.test_case_id)
            r.id AS execution_result_id, r.test_case_id, tc.key AS case_key, tc.name AS case_name,
            tc.test_type::text AS test_type, r.status::text AS status, r.message,
            r.classification::text AS classification
       FROM execution_results r
       LEFT JOIN test_cases tc ON tc.id = r.test_case_id
      WHERE r.execution_id = $1
      ORDER BY r.test_case_id, r.created_at DESC`,
    [executionId]
  );
  return rows;
}

export type IngestResult = {
  outcome: 'report' | 'recurring_only' | 'clean' | 'rerun' | 'already_ingested' | 'not_found' | 'not_finished';
  report_id?: string | null;
  report_key?: string | null;
  created?: number;
  regressed?: number;
  recurring?: number;
};

const FINISHED = new Set(['passed', 'failed', 'error', 'timed_out', 'blocked', 'skipped']);

/** Read one finished execution into the defect register. Safe to call twice. */
export async function ingestExecution(executionId: string): Promise<IngestResult> {
  return withTransaction(async (db) => {
    const { rows: execs } = await db.query(
      `SELECT id, key, status::text AS status, metadata FROM executions WHERE id::text = $1 OR key = $1 FOR UPDATE`,
      [executionId]
    );
    const exec = execs[0];
    if (!exec) return { outcome: 'not_found' };
    if (!FINISHED.has(exec.status)) return { outcome: 'not_finished' };

    const seen = await db.query(`SELECT outcome FROM defect_ingests WHERE execution_id = $1`, [exec.id]);
    if (seen.rows[0]) return { outcome: 'already_ingested' };

    const results = await resultsFor(db, exec.id);
    const reportRef = exec.metadata?.defect_report_id as string | undefined;
    if (reportRef) {
      await applyRerun(db, reportRef, exec.id, results);
      await db.query(`INSERT INTO defect_ingests (execution_id, report_id, outcome) VALUES ($1,$2,'rerun')`, [exec.id, reportRef]);
      return { outcome: 'rerun', report_id: reportRef };
    }

    const candidates = candidatesFrom(results);
    if (!candidates.length) {
      await db.query(`INSERT INTO defect_ingests (execution_id, outcome) VALUES ($1,'clean')`, [exec.id]);
      return { outcome: 'clean' };
    }

    const { rows: existing } = await db.query<ExistingDefect>(
      `SELECT DISTINCT ON (fingerprint) id, fingerprint, status
         FROM defects WHERE fingerprint = ANY($1::text[])
        ORDER BY fingerprint, created_at DESC`,
      [candidates.map((c) => c.fingerprint)]
    );
    const plan = planIngest(candidates, existing);

    for (const { defect } of plan.recur) {
      await db.query(
        `UPDATE defects SET occurrences = occurrences + 1, last_seen = now(), updated_at = now(),
                history = history || $2::jsonb WHERE id = $1`,
        [defect.id, entry('defect-manager', 'seen_again', { execution: exec.key })]
      );
    }

    if (!plan.create.length && !plan.regress.length) {
      await db.query(`INSERT INTO defect_ingests (execution_id, outcome) VALUES ($1,'recurring_only')`, [exec.id]);
      return { outcome: 'recurring_only', recurring: plan.recur.length };
    }

    const key = reportKey(new Date(), randomUUID().replace(/-/g, ''));
    const { rows: reports } = await db.query(
      `INSERT INTO defect_reports (key, execution_id, source, status, history)
       VALUES ($1,$2,'execution','open',$3::jsonb) RETURNING id, key`,
      [key, exec.id, entry('defect-manager', 'created', { execution: exec.key })]
    );
    const report = reports[0]!;

    // A regression is a new defect linked to the verified one, so the report
    // that verified it keeps its record intact.
    const toInsert = [
      ...plan.create.map((c) => ({ c, regressionOf: null as string | null })),
      ...plan.regress.map(({ defect, candidate }) => ({ c: candidate, regressionOf: defect.id })),
    ];
    for (const { c, regressionOf } of toInsert) {
      await db.query(
        `INSERT INTO defects (key, report_id, fingerprint, test_case_id, case_key, case_name, test_type,
                              category, severity, status, message, execution_id, execution_result_id,
                              regression_of, history)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',$10,$11,$12,$13,$14::jsonb)`,
        [
          await nextDefectKey(db), report.id, c.fingerprint, c.test_case_id, c.case_key, c.case_name,
          c.test_type, c.category, c.severity, c.message, exec.id, c.execution_result_id, regressionOf,
          entry('defect-manager', regressionOf ? 'regressed' : 'opened', { execution: exec.key }),
        ]
      );
    }

    await db.query(`INSERT INTO defect_ingests (execution_id, report_id, outcome) VALUES ($1,$2,'report')`, [exec.id, report.id]);
    return {
      outcome: 'report', report_id: report.id, report_key: report.key,
      created: plan.create.length, regressed: plan.regress.length, recurring: plan.recur.length,
    };
  });
}

async function applyRerun(db: Db, reportId: string, executionId: string, results: ResultRow[]) {
  const { rows: reports } = await db.query(`SELECT id, key, status FROM defect_reports WHERE id = $1 FOR UPDATE`, [reportId]);
  const report = reports[0];
  if (!report) return;
  const { rows: defects } = await db.query(
    `SELECT id, key, status, test_case_id, case_key FROM defects WHERE report_id = $1`,
    [reportId]
  );
  const outcome = evaluateRerun(defects, results);
  for (const v of outcome.verdicts) {
    await db.query(
      `UPDATE defects SET status = $2, rerun_attempts = rerun_attempts + 1, updated_at = now(),
              last_seen = CASE WHEN $2 = 'reopened' THEN now() ELSE last_seen END,
              history = history || $3::jsonb WHERE id = $1`,
      [v.id, v.to, entry('defect-manager', v.to, { reason: v.reason, execution: executionId })]
    );
  }
  await db.query(
    `UPDATE defect_reports SET status = $2, updated_at = now(), history = history || $3::jsonb WHERE id = $1`,
    [reportId, outcome.report, entry('defect-manager', `rerun_${outcome.report}`, {
      execution: executionId,
      verified: outcome.verdicts.filter((v) => v.to === 'verified').length,
      reopened: outcome.verdicts.filter((v) => v.to === 'reopened').length,
    })]
  );
}

// ---------------------------------------------------------------------------
// Read side
// ---------------------------------------------------------------------------

export async function listReports(filter: { status?: string; limit?: number }) {
  const params: unknown[] = [];
  let where = '';
  if (filter.status) {
    const wanted = filter.status.split(',').map((s) => s.trim()).filter(Boolean);
    params.push(wanted);
    where = `WHERE r.status = ANY($1::text[])`;
  }
  params.push(Math.min(Math.max(filter.limit || 50, 1), 200));
  const { rows } = await query(
    `SELECT r.id, r.key, r.status, r.source, r.claimed_by, r.claimed_at, r.rerun_count,
            r.created_at, r.updated_at, e.key AS execution_key,
            COUNT(d.id)::int AS defects,
            COUNT(d.id) FILTER (WHERE d.severity = 'high')::int AS high,
            COUNT(d.id) FILTER (WHERE d.status IN ('open','acknowledged','in_fix','reopened'))::int AS unresolved
       FROM defect_reports r
       LEFT JOIN executions e ON e.id = r.execution_id
       LEFT JOIN defects d ON d.report_id = r.id
       ${where}
      GROUP BY r.id, e.key
      ORDER BY r.created_at DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

export async function getReport(ref: string) {
  const { rows } = await query(
    `SELECT r.*, e.key AS execution_key, re.key AS rerun_execution_key
       FROM defect_reports r
       LEFT JOIN executions e ON e.id = r.execution_id
       LEFT JOIN executions re ON re.id = r.rerun_execution_id
      WHERE r.id::text = $1 OR r.key = $1`,
    [ref]
  );
  if (!rows[0]) return null;
  const defects = await query<{ status: DefectStatus; severity: string }>(
    `SELECT d.*, p.key AS regression_of_key FROM defects d
       LEFT JOIN defects p ON p.id = d.regression_of
      WHERE d.report_id = $1 ORDER BY
       CASE d.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, d.key`,
    [rows[0].id]
  );
  return { ...rows[0], summary: summarize(defects.rows), defects: defects.rows };
}

export async function listDefects(filter: { status?: string; report?: string; limit?: number }) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    params.push(filter.status.split(',').map((s) => s.trim()).filter(Boolean));
    clauses.push(`d.status = ANY($${params.length}::text[])`);
  }
  if (filter.report) {
    params.push(filter.report);
    clauses.push(`(r.id::text = $${params.length} OR r.key = $${params.length})`);
  }
  params.push(Math.min(Math.max(filter.limit || 100, 1), 500));
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT d.*, r.key AS report_key FROM defects d JOIN defect_reports r ON r.id = d.report_id
     ${where} ORDER BY d.updated_at DESC LIMIT $${params.length}`,
    params
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Write side (PM / Implementation Manager / developer agents)
// ---------------------------------------------------------------------------

async function lockReport(db: Db, ref: string) {
  const { rows } = await db.query(
    `SELECT * FROM defect_reports WHERE id::text = $1 OR key = $1 FOR UPDATE`,
    [ref]
  );
  if (!rows[0]) throw new DefectError(404, 'Defect report not found');
  return rows[0];
}

export async function claimReport(ref: string, by: string) {
  return withTransaction(async (db) => {
    const r = await lockReport(db, ref);
    if (r.status === 'with_pm' && r.claimed_by === by) return r;
    if (!canMoveReport(r.status as ReportStatus, 'with_pm')) {
      throw new DefectError(409, `Report ${r.key} is ${r.status}; only open or reopened reports can be claimed`);
    }
    const { rows } = await db.query(
      `UPDATE defect_reports SET status = 'with_pm', claimed_by = $2, claimed_at = now(), updated_at = now(),
              history = history || $3::jsonb WHERE id = $1 RETURNING *`,
      [r.id, by, entry(by, 'claimed', { from: r.status })]
    );
    await db.query(
      `UPDATE defects SET status = 'acknowledged', updated_at = now(),
              history = history || $2::jsonb
        WHERE report_id = $1 AND status IN ('open','reopened')`,
      [r.id, entry(by, 'acknowledged')]
    );
    return rows[0];
  });
}

export async function updateDefect(
  ref: string,
  patch: { status?: unknown; fix_ref?: unknown; assignee?: unknown; note?: unknown; by?: unknown }
) {
  const by = String(patch.by || 'unknown');
  return withTransaction(async (db) => {
    const { rows } = await db.query(
      `SELECT d.*, r.status AS report_status, r.id AS rid FROM defects d
         JOIN defect_reports r ON r.id = d.report_id
        WHERE d.id::text = $1 OR d.key = $1 FOR UPDATE OF d, r`,
      [ref]
    );
    const d = rows[0];
    if (!d) throw new DefectError(404, 'Defect not found');

    let status: DefectStatus = d.status;
    if (patch.status !== undefined) {
      if (!isDefectStatus(patch.status)) throw new DefectError(400, `Unknown status ${String(patch.status)}`);
      if (ENGINE_ONLY_STATUSES.has(patch.status) && patch.status !== d.status) {
        throw new DefectError(403, `Only the engine sets ${patch.status}, after a rerun. Mark it fixed and request a rerun.`);
      }
      if (!canMoveDefect(d.status, patch.status)) {
        throw new DefectError(409, `Cannot move ${d.key} from ${d.status} to ${patch.status}`);
      }
      status = patch.status;
    }
    if (status === 'wont_fix' && !patch.note) {
      throw new DefectError(400, 'wont_fix needs a note explaining why');
    }

    const { rows: updated } = await db.query(
      `UPDATE defects SET status = $2, fix_ref = COALESCE($3, fix_ref), assignee = COALESCE($4, assignee),
              updated_at = now(), history = history || $5::jsonb
        WHERE id = $1 RETURNING *`,
      [
        d.id, status,
        typeof patch.fix_ref === 'string' ? patch.fix_ref.slice(0, 500) : null,
        typeof patch.assignee === 'string' ? patch.assignee.slice(0, 120) : null,
        entry(by, 'updated', {
          from: d.status, to: status,
          ...(patch.note ? { note: String(patch.note).slice(0, 2000) } : {}),
          ...(patch.fix_ref ? { fix_ref: String(patch.fix_ref).slice(0, 500) } : {}),
        }),
      ]
    );

    // First fixer activity moves the report from with_pm to fixing.
    if (d.report_status === 'with_pm' && (status === 'in_fix' || status === 'fixed')) {
      await db.query(
        `UPDATE defect_reports SET status = 'fixing', updated_at = now(), history = history || $2::jsonb WHERE id = $1`,
        [d.rid, entry(by, 'fixing')]
      );
    }
    return updated[0];
  });
}

/**
 * PM → engine: every defect is fixed or wont_fix, rerun the failing cases.
 * Queues one execution tagged with the report, which the worker runs like any
 * other; its completion calls ingestExecution → applyRerun.
 */
export async function requestRerun(ref: string, by: string, note?: string, environmentId?: string | null) {
  return withTransaction(async (db) => {
    const r = await lockReport(db, ref);
    if (r.status === 'rerunning') {
      throw new DefectError(409, `Report ${r.key} already has a rerun in flight`);
    }
    if (!canMoveReport(r.status as ReportStatus, 'rerunning')) {
      throw new DefectError(409, `Report ${r.key} is ${r.status}; claim it and fix its defects before a rerun`);
    }
    const { rows: defects } = await db.query(
      `SELECT key, status, test_case_id FROM defects WHERE report_id = $1`,
      [r.id]
    );
    const blockers = rerunBlockers(defects);
    if (blockers.length) throw new DefectError(409, 'Some defects are not fixed yet', { blockers });

    const caseIds = [...new Set(defects.filter((d) => d.status === 'fixed' && d.test_case_id).map((d) => d.test_case_id as string))];
    if (!caseIds.length) throw new DefectError(409, 'No fixed defect is linked to a test case the engine can rerun');

    let envId = environmentId ?? null;
    if (!envId && r.execution_id) {
      const src = await db.query(`SELECT environment_id FROM executions WHERE id = $1`, [r.execution_id]);
      envId = src.rows[0]?.environment_id ?? null;
    }

    const key = `rerun-${r.key.toLowerCase()}-${r.rerun_count + 1}`;
    const { rows: exec } = await db.query(
      `INSERT INTO executions (key, requested_by, test_case_ids, environment_id, status, trigger_source, metadata)
       VALUES ($1,$2,$3,$4,'queued','agent',$5::jsonb) RETURNING id, key`,
      [key, by, caseIds, envId, JSON.stringify({ defect_report_id: r.id, defect_report_key: r.key, note: note ?? null })]
    );
    const { rows: updated } = await db.query(
      `UPDATE defect_reports SET status = 'rerunning', rerun_execution_id = $2, rerun_count = rerun_count + 1,
              updated_at = now(), history = history || $3::jsonb WHERE id = $1 RETURNING *`,
      [r.id, exec[0]!.id, entry(by, 'rerun_requested', { execution: exec[0]!.key, cases: caseIds.length, ...(note ? { note } : {}) })]
    );
    return { report: updated[0], execution: exec[0] };
  });
}

/** Loop health for the Scheduler / Overview and the PM's poller. */
export async function defectOverview() {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM defect_reports WHERE status IN ('open','reopened'))::int AS awaiting_pm,
       (SELECT COUNT(*) FROM defect_reports WHERE status IN ('with_pm','fixing'))::int AS in_fix,
       (SELECT COUNT(*) FROM defect_reports WHERE status = 'rerunning')::int AS rerunning,
       (SELECT COUNT(*) FROM defect_reports WHERE status = 'verified')::int AS verified,
       (SELECT COUNT(*) FROM defects WHERE status NOT IN ('verified','wont_fix'))::int AS unresolved_defects`
  );
  return rows[0];
}
