/**
 * Deploy-failure loop: the engine and the application repo's agent talk until
 * a deploy is green or the retry cap is hit.
 *
 * When a managed stack's deploy fails ([applyJobOutcome in infra.ts]), the
 * engine opens a defect report (kind='deploy') scoped to that environment and
 * fingerprints the error. The report rides the same lane every test defect
 * uses: the application repo's agent polls it, claims it, pushes a fix, and
 * marks the defect `fixed` (with the new commit in `fix_ref`, if there is one).
 *
 * The tick in this module watches those reports and, when every child defect
 * is ready, re-queues the deploy — at `fix_ref` if the agent gave one, else at
 * the ref that failed. On success the report is `verified` and the children
 * closed. On another failure the error is appended to the same report and the
 * loop continues. After `deploy_retry_cap` attempts (default 5) the report
 * goes to `parked` and a banner on the console asks a person to look.
 *
 * `decideDeploy` is pure, so the rules are tested without a database.
 *
 * Related: apps/api/src/feedback-loop.ts (same shape, for test defects),
 *          apps/api/src/infra.ts (the deploy pipeline that feeds this loop),
 *          apps/api/src/defects/service.ts (claim/fix API the agent uses).
 */
import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { query, withTransaction } from './db/client.js';
import { RERUN_READY, reportKey, type DefectStatus } from './defects/core.js';
import { isReadyForRerun } from './feedback-loop.js';
import { createDeployment, infraConfig } from './infra.js';

type Db = Pick<pg.PoolClient, 'query'>;

/** Default retries before the loop is parked for human investigation. */
export const DEFAULT_DEPLOY_RETRY_CAP = 5;

/** How the deploy loop sees one report. Pure, so the rules below are tested without a DB. */
export interface DeployReportLite {
  key: string;
  status: string;
  retry_count: number;
  retry_cap: number;
  defects: Array<{ status: string }>;
}

export type DeployDecision =
  | { action: 'wait'; phase: 'awaiting_pm' | 'awaiting_fixes' | 'rerunning' }
  | { action: 'retry' }
  | { action: 'park'; reason: string }
  | { action: 'verified' };

const FIXING = new Set(['with_pm', 'fixing']);

/**
 * What the loop should do for one deploy-failure report. "Retry" is only
 * returned once every child defect is fixed/wont-fix/verified (same rule the
 * test-defect loop uses), and only while the cap has room. The cap check runs
 * *before* a retry, so an exhausted report with ready defects parks instead of
 * firing one more deploy.
 */
export function decideDeploy(r: DeployReportLite): DeployDecision {
  if (r.status === 'verified') return { action: 'verified' };
  if (r.status === 'parked') return { action: 'park', reason: 'already parked' };
  if (r.status === 'rerunning') return { action: 'wait', phase: 'rerunning' };
  if (r.status === 'open' || r.status === 'reopened') return { action: 'wait', phase: 'awaiting_pm' };
  // with_pm | fixing
  if (!isReadyForRerun(r.defects)) return { action: 'wait', phase: 'awaiting_fixes' };
  if (r.retry_count >= r.retry_cap) {
    return { action: 'park', reason: `cap of ${r.retry_cap} retries reached` };
  }
  return { action: 'retry' };
}

/**
 * Fingerprint a deploy failure so a repeat of the same error updates one
 * child defect instead of opening a new one each cycle. Strips container ids,
 * ports, hex blobs and digits so a volatile line still matches itself.
 */
export function fingerprintDeployError(environmentKey: string, errorMessage: string): string {
  const normalized = (errorMessage || 'deploy failed')
    .replace(/0x[0-9a-fA-F]+/gi, 'HEX')
    // Docker container ids (short 8 / 12 chars, full 64), uuids, sha blobs.
    .replace(/\b[0-9a-f]{8,}\b/gi, 'HEX')
    .replace(/\d+/g, 'N')
    .replace(/[\s\r\n]+/g, ' ')
    .trim()
    .slice(0, 500);
  return createHash('sha256').update(`deploy:${environmentKey}:${normalized}`).digest('hex');
}

function historyEntry(by: string, action: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify([{ at: new Date().toISOString(), by, action, ...extra }]);
}

async function nextDefectKey(db: Db): Promise<string> {
  const { rows } = await db.query<{ n: string }>(`SELECT nextval('defect_key_seq')::text AS n`);
  return `DEF-${String(rows[0]!.n).padStart(5, '0')}`;
}

export interface DeployFailureInput {
  environmentId: string;
  environmentKey: string;
  applicationKey: string;
  deploymentId: string;
  ref: string;
  errorMessage: string;
  logTail?: string | null;
  retryCap?: number;
}

/**
 * Open or append to a deploy-failure report for one environment. If a live
 * report already exists (not parked, not verified), the new failure is
 * appended: a matching child defect's occurrences count goes up, or a new
 * child is opened. The report is moved back to `open` or `reopened` so the
 * agent sees it in their queue again.
 */
export async function recordDeployFailure(input: DeployFailureInput): Promise<{
  reportId: string;
  reportKey: string;
  status: string;
  retry_count: number;
  parked: boolean;
}> {
  return withTransaction(async (db) => {
    const { rows: existing } = await db.query(
      `SELECT * FROM defect_reports
         WHERE kind = 'deploy' AND environment_id = $1 AND status NOT IN ('parked', 'verified')
         FOR UPDATE`,
      [input.environmentId]
    );
    const fingerprint = fingerprintDeployError(input.environmentKey, input.errorMessage);
    const message = (input.errorMessage || 'deploy failed').slice(0, 2000);
    const retryCap = Math.max(1, input.retryCap ?? DEFAULT_DEPLOY_RETRY_CAP);

    let report = existing[0];
    if (!report) {
      const rkey = reportKey(new Date(), randomUUID().replace(/-/g, ''));
      const { rows: inserted } = await db.query(
        `INSERT INTO defect_reports
           (key, source, status, kind, application_key, environment_id, deploy_retry_count,
            deploy_retry_cap, deploy_last_ref, deploy_last_error, history)
         VALUES ($1, 'deploy', 'open', 'deploy', $2, $3, 0, $4, $5, $6, $7::jsonb)
         RETURNING *`,
        [
          rkey,
          input.applicationKey,
          input.environmentId,
          retryCap,
          input.ref,
          message,
          historyEntry('engine', 'created', {
            environment: input.environmentKey,
            deployment: input.deploymentId,
            ref: input.ref,
          }),
        ]
      );
      report = inserted[0];
    } else {
      // A new failure after the previous one was handed off: wake the report up again.
      const nextStatus =
        report.status === 'rerunning' ? 'reopened'
        : report.status === 'with_pm' || report.status === 'fixing' ? 'reopened'
        : report.status;
      const { rows: woken } = await db.query(
        `UPDATE defect_reports
            SET status = $2, deploy_last_ref = $3, deploy_last_error = $4,
                history = history || $5::jsonb, updated_at = now()
          WHERE id = $1 RETURNING *`,
        [
          report.id,
          nextStatus,
          input.ref,
          message,
          historyEntry('engine', 'deploy_failure_appended', {
            environment: input.environmentKey,
            deployment: input.deploymentId,
            ref: input.ref,
            retry_count: report.deploy_retry_count,
          }),
        ]
      );
      report = woken[0];
    }

    const { rows: child } = await db.query(
      `SELECT * FROM defects WHERE report_id = $1 AND fingerprint = $2 FOR UPDATE`,
      [report.id, fingerprint]
    );
    if (child[0]) {
      // Same error signature as before: bump occurrences and reopen if it had been fixed.
      const resetStatus = child[0].status === 'fixed' || child[0].status === 'verified' ? 'reopened' : child[0].status;
      await db.query(
        `UPDATE defects
            SET occurrences = occurrences + 1, status = $2, message = $3, last_seen = now(),
                history = history || $4::jsonb, updated_at = now()
          WHERE id = $1`,
        [
          child[0].id,
          resetStatus,
          message,
          historyEntry('engine', 'seen_again', { deployment: input.deploymentId, ref: input.ref }),
        ]
      );
    } else {
      const dkey = await nextDefectKey(db);
      await db.query(
        `INSERT INTO defects
           (key, report_id, fingerprint, case_key, case_name, test_type, category, severity,
            status, message, history)
         VALUES ($1, $2, $3, $4, $5, 'deployment', 'deploy', 'high', 'open', $6, $7::jsonb)`,
        [
          dkey,
          report.id,
          fingerprint,
          `DEPLOY-${input.environmentKey}`,
          `Deploy failure on ${input.environmentKey}`,
          truncateLog(input.logTail, message),
          historyEntry('engine', 'opened', { deployment: input.deploymentId, ref: input.ref }),
        ]
      );
    }

    const parked = report.deploy_retry_count >= report.deploy_retry_cap;
    if (parked) {
      await db.query(
        `UPDATE defect_reports SET status = 'parked', updated_at = now(),
                history = history || $2::jsonb WHERE id = $1`,
        [
          report.id,
          historyEntry('engine', 'parked', { reason: `cap of ${report.deploy_retry_cap} retries reached` }),
        ]
      );
      report.status = 'parked';
    }

    return {
      reportId: report.id as string,
      reportKey: report.key as string,
      status: report.status as string,
      retry_count: report.deploy_retry_count as number,
      parked,
    };
  });
}

function truncateLog(logTail: string | null | undefined, fallback: string): string {
  const body = logTail && logTail.trim() ? `Agent error: ${fallback}\n\nLog tail:\n${logTail.slice(-4000)}` : fallback;
  return body.slice(0, 8000);
}

/**
 * Mark the deploy-failure report for an environment as verified: a deploy at
 * last succeeded. Every child defect is closed. If there is no open report
 * (the normal case), this is a no-op.
 */
export async function recordDeploySuccess(environmentId: string, deploymentId: string): Promise<void> {
  await withTransaction(async (db) => {
    const { rows } = await db.query(
      `SELECT * FROM defect_reports
         WHERE kind = 'deploy' AND environment_id = $1 AND status NOT IN ('parked', 'verified')
         FOR UPDATE`,
      [environmentId]
    );
    const report = rows[0];
    if (!report) return;
    await db.query(
      `UPDATE defect_reports
          SET status = 'verified', updated_at = now(),
              history = history || $2::jsonb WHERE id = $1`,
      [report.id, historyEntry('engine', 'rerun_verified', { deployment: deploymentId })]
    );
    await db.query(
      `UPDATE defects
          SET status = 'verified', updated_at = now(),
              history = history || $2::jsonb
        WHERE report_id = $1 AND status NOT IN ('verified', 'wont_fix')`,
      [report.id, historyEntry('engine', 'rerun_verified', { deployment: deploymentId })]
    );
  });
}

/** The one live deploy-failure row for one application+environment, or null when the loop is quiet. */
export async function currentDeployLoop(applicationKey: string, environmentKey: string): Promise<DeployLoopStatus | null> {
  const { rows } = await query(
    `SELECT dr.id, dr.key, dr.status, dr.kind, dr.application_key, dr.environment_id,
            dr.deploy_retry_count, dr.deploy_retry_cap, dr.deploy_last_ref, dr.deploy_last_error,
            dr.created_at, dr.updated_at, e.key AS environment_key, e.name AS environment_name,
            COALESCE(json_agg(json_build_object('key', d.key, 'status', d.status, 'message', d.message,
                                                 'occurrences', d.occurrences, 'fix_ref', d.fix_ref))
                     FILTER (WHERE d.id IS NOT NULL), '[]') AS defects
       FROM defect_reports dr
       LEFT JOIN environments e ON e.id = dr.environment_id
       LEFT JOIN defects d ON d.report_id = dr.id
      WHERE dr.kind = 'deploy'
        AND dr.application_key = $1
        AND e.key = $2
        AND dr.status NOT IN ('verified')
      GROUP BY dr.id, e.key, e.name
      ORDER BY dr.created_at DESC
      LIMIT 1`,
    [applicationKey, environmentKey]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    report_id: r.id,
    report_key: r.key,
    status: r.status,
    application: r.application_key,
    environment_key: r.environment_key,
    environment_name: r.environment_name,
    retry_count: r.deploy_retry_count,
    retry_cap: r.deploy_retry_cap,
    attempts_remaining: Math.max(0, r.deploy_retry_cap - r.deploy_retry_count),
    last_ref: r.deploy_last_ref,
    last_error: r.deploy_last_error,
    parked: r.status === 'parked',
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString(),
    defects: r.defects,
  };
}

export interface DeployLoopStatus {
  report_id: string;
  report_key: string;
  status: string;
  application: string;
  environment_key: string;
  environment_name: string | null;
  retry_count: number;
  retry_cap: number;
  attempts_remaining: number;
  last_ref: string | null;
  last_error: string | null;
  parked: boolean;
  created_at: string;
  updated_at: string;
  defects: Array<{ key: string; status: string; message: string; occurrences: number; fix_ref: string | null }>;
}

/** Open deploy-failure reports for the Sand Bench agent (and the console). */
export async function listDeployLoops(filter: { application?: string; status?: string; limit?: number } = {}): Promise<DeployLoopStatus[]> {
  const params: unknown[] = [];
  const where: string[] = [`dr.kind = 'deploy'`];
  if (filter.application) {
    params.push(filter.application);
    where.push(`dr.application_key = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`dr.status = $${params.length}`);
  }
  params.push(Math.min(Math.max(filter.limit ?? 100, 1), 500));
  const { rows } = await query(
    `SELECT dr.id, dr.key, dr.status, dr.application_key, dr.environment_id,
            dr.deploy_retry_count, dr.deploy_retry_cap, dr.deploy_last_ref, dr.deploy_last_error,
            dr.created_at, dr.updated_at, e.key AS environment_key, e.name AS environment_name,
            COALESCE(json_agg(json_build_object('key', d.key, 'status', d.status, 'message', d.message,
                                                 'occurrences', d.occurrences, 'fix_ref', d.fix_ref))
                     FILTER (WHERE d.id IS NOT NULL), '[]') AS defects
       FROM defect_reports dr
       LEFT JOIN environments e ON e.id = dr.environment_id
       LEFT JOIN defects d ON d.report_id = dr.id
      WHERE ${where.join(' AND ')}
      GROUP BY dr.id, e.key, e.name
      ORDER BY dr.updated_at DESC
      LIMIT $${params.length}`,
    params
  );
  return rows.map((r: any) => ({
    report_id: r.id,
    report_key: r.key,
    status: r.status,
    application: r.application_key,
    environment_key: r.environment_key,
    environment_name: r.environment_name,
    retry_count: r.deploy_retry_count,
    retry_cap: r.deploy_retry_cap,
    attempts_remaining: Math.max(0, r.deploy_retry_cap - r.deploy_retry_count),
    last_ref: r.deploy_last_ref,
    last_error: r.deploy_last_error,
    parked: r.status === 'parked',
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString(),
    defects: r.defects,
  }));
}

// ---------------------------------------------------------------- the tick

let ticking = false;

/** Advance every open deploy-failure report once. Overlapping ticks are skipped. */
export async function deployLoopTick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const { rows } = await query(
      `SELECT dr.id, dr.key, dr.status, dr.application_key, dr.environment_id,
              dr.deploy_retry_count, dr.deploy_retry_cap, dr.deploy_last_ref,
              e.key AS environment_key, e.config AS environment_config,
              COALESCE(json_agg(json_build_object('status', d.status, 'fix_ref', d.fix_ref))
                       FILTER (WHERE d.id IS NOT NULL), '[]') AS defects
         FROM defect_reports dr
         LEFT JOIN environments e ON e.id = dr.environment_id
         LEFT JOIN defects d ON d.report_id = dr.id
        WHERE dr.kind = 'deploy' AND dr.status IN ('open', 'with_pm', 'fixing', 'reopened', 'rerunning')
        GROUP BY dr.id, e.key, e.config
        ORDER BY dr.updated_at`
    );
    for (const row of rows as unknown as RowFromTick[]) {
      try {
        await advance(row);
      } catch (err) {
        const message = (err as Error).message.slice(0, 500);
        console.warn(`[deploy-loop] ${row.key}: ${message}`);
        await query(
          `UPDATE defect_reports SET deploy_last_error = $2, updated_at = now() WHERE id = $1`,
          [row.id, message]
        );
      }
    }
  } finally {
    ticking = false;
  }
}

type RowFromTick = {
  id: string;
  key: string;
  status: string;
  application_key: string;
  environment_id: string;
  environment_key: string | null;
  environment_config: Record<string, any> | null;
  deploy_retry_count: number;
  deploy_retry_cap: number;
  deploy_last_ref: string | null;
  defects: Array<{ status: string; fix_ref: string | null }>;
};

async function advance(row: RowFromTick): Promise<void> {
  const lite: DeployReportLite = {
    key: row.key,
    status: row.status,
    retry_count: row.deploy_retry_count,
    retry_cap: row.deploy_retry_cap,
    defects: row.defects,
  };
  const decision = decideDeploy(lite);

  if (decision.action === 'wait' || decision.action === 'verified') return;

  if (decision.action === 'park') {
    await query(
      `UPDATE defect_reports SET status = 'parked', updated_at = now(),
              history = history || $2::jsonb WHERE id = $1 AND status <> 'parked'`,
      [row.id, historyEntry('engine', 'parked', { reason: decision.reason })]
    );
    return;
  }

  // Retry: pick the newest fix_ref the agent gave, else the ref that failed.
  const fixRef = row.defects
    .map((d) => (typeof d.fix_ref === 'string' && d.fix_ref.trim() ? d.fix_ref.trim() : null))
    .filter(Boolean)
    .pop() as string | null;
  const ref = fixRef || row.deploy_last_ref || 'main';
  const infra = infraConfig({ config: row.environment_config || {} });
  if (!infra) {
    await query(
      `UPDATE defect_reports SET status = 'parked', updated_at = now(),
              deploy_last_error = $2, history = history || $3::jsonb WHERE id = $1`,
      [
        row.id,
        'environment is no longer managed by the infra agent; cannot retry',
        historyEntry('engine', 'parked', { reason: 'environment no longer managed' }),
      ]
    );
    return;
  }

  // Flip to rerunning *before* we fire the deploy, so a second tick cannot double-trigger.
  await query(
    `UPDATE defect_reports
        SET status = 'rerunning', deploy_retry_count = deploy_retry_count + 1,
            deploy_last_ref = $2, updated_at = now(),
            history = history || $3::jsonb
      WHERE id = $1`,
    [
      row.id,
      ref,
      historyEntry('engine', 'rerun_requested', {
        ref,
        attempt: row.deploy_retry_count + 1,
        cap: row.deploy_retry_cap,
      }),
    ]
  );

  const outcome = await createDeployment({
    environment: row.environment_id,
    application: row.application_key,
    mode: 'deploy_only',
    ref,
    requested_by: 'deploy-loop',
    reason: 'deploy_loop_retry',
  });

  if (outcome.status !== 202) {
    // Could not queue the deploy at all — treat as a fresh failure of the same report.
    await query(
      `UPDATE defect_reports
          SET status = 'reopened', deploy_last_error = $2, updated_at = now(),
              history = history || $3::jsonb
        WHERE id = $1`,
      [
        row.id,
        String(outcome.body?.error || `could not queue deploy (HTTP ${outcome.status})`).slice(0, 500),
        historyEntry('engine', 'rerun_queue_failed', { status: outcome.status, error: outcome.body?.error }),
      ]
    );
  }
}

/** For tests: whether a defect status counts as ready-for-rerun on the deploy side (same set as test defects). */
export function isDeployDefectReady(status: string): boolean {
  return RERUN_READY.has(status as DefectStatus);
}
