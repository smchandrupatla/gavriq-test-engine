/**
 * Feedback loop between the test engine and the Sand Bench implementation manager.
 *
 * The Defect Manager (defects/service.ts) already turns each failing execution into
 * a defect report, and it already verifies or reopens a report after a rerun. What
 * was missing is the driver that moves a loop along without a person pressing the
 * buttons. This module is that driver. One row per application in feedback_loops;
 * the tick (server.ts) advances every loop whose state is `running`:
 *
 *   1. A full sweep runs while nothing is pending, and it is the baseline and the
 *      regression check.
 *   2. Reports the implementation manager is still working on (with_pm, fixing)
 *      stay open. Reports whose defects are all fixed get a rerun requested
 *      (requestRerun), which the engine verifies or reopens on completion.
 *   3. Reports still open or reopened wait for the implementation manager to claim
 *      them (the product-manager defect-loop poller does that from Sand Bench).
 *   4. The loop converges when nothing is outstanding and the last sweep was clean.
 *
 * Suspend leaves a run in flight on the workers and resumes collecting it later.
 * Stop does the same, but the loop does not start again by itself. Both survive an
 * API restart because the state is in the database.
 */
import { query } from './db/client.js';
import { queueRun, loadRun, summarize, onlineWorkers } from './routes/trigger.js';
import { requestRerun } from './defects/service.js';
import { RERUN_READY, type DefectStatus } from './defects/core.js';

export type LoopState = 'stopped' | 'running' | 'suspended';
export type LoopPhase = 'idle' | 'sweeping' | 'awaiting_pm' | 'awaiting_fixes' | 'rerunning' | 'converged';

/** A report as the loop sees it: its status and whether a rerun can be requested now. */
export interface ReportLite {
  key: string;
  status: string;
  ready: boolean;
}

export type Decision =
  | { action: 'rerun'; keys: string[] }
  | { action: 'wait'; phase: LoopPhase; open: number }
  | { action: 'sweep' }
  | { action: 'converged' };

const FIXING = new Set(['with_pm', 'fixing']);

/** What to do when no sweep is in flight. Pure, so the rules can be tested alone. */
export function decide(reports: ReportLite[], cleanSweep: boolean): Decision {
  const rerunning = reports.filter((r) => r.status === 'rerunning');
  if (rerunning.length) return { action: 'wait', phase: 'rerunning', open: rerunning.length };

  const ready = reports.filter((r) => r.ready && FIXING.has(r.status));
  if (ready.length) return { action: 'rerun', keys: ready.map((r) => r.key) };

  const awaitingPm = reports.filter((r) => r.status === 'open' || r.status === 'reopened');
  if (awaitingPm.length) return { action: 'wait', phase: 'awaiting_pm', open: awaitingPm.length };

  const fixing = reports.filter((r) => FIXING.has(r.status));
  if (fixing.length) return { action: 'wait', phase: 'awaiting_fixes', open: fixing.length };

  // Converged only after a full sweep came back clean with nothing changed since.
  if (cleanSweep) return { action: 'converged' };
  return { action: 'sweep' };
}

/** A report is ready for rerun when every defect is fixed, won't-fix or verified, and one is fixed. */
export function isReadyForRerun(defects: Array<{ status: string }>): boolean {
  return defects.length > 0 && defects.every((d) => RERUN_READY.has(d.status as DefectStatus)) && defects.some((d) => d.status === 'fixed');
}

export interface LoopRow {
  key: string;
  environment_key: string;
  state: LoopState;
  phase: LoopPhase;
  cycle: number;
  current_run_id: string | null;
  clean_sweep: boolean;
  note: string | null;
  last_error: string | null;
  started_at: string | null;
  updated_at: string;
}

export async function getLoop(appKey: string): Promise<LoopRow | null> {
  const { rows } = await query<LoopRow>(`SELECT * FROM feedback_loops WHERE key = $1`, [appKey]);
  return rows[0] ?? null;
}

/** Start the loop, or restart it. A converged loop begins a fresh sweep; anything else resumes. */
export async function startLoop(appKey: string, envKey: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = await query(`SELECT key FROM applications WHERE key = $1`, [appKey]);
  if (!app.rows[0]) return { status: 404, body: { error: 'Application not found', application: appKey } };
  const env = await query(`SELECT key FROM environments WHERE key = $1 AND status = 'active'`, [envKey]);
  if (!env.rows[0]) return { status: 404, body: { error: 'Active environment not found', environment: envKey } };

  const { rows } = await query<LoopRow>(
    `INSERT INTO feedback_loops (key, environment_key, state, phase, started_at, note)
     VALUES ($1, $2, 'running', 'idle', now(), 'Started')
     ON CONFLICT (key) DO UPDATE SET
       environment_key = EXCLUDED.environment_key,
       state = 'running',
       phase = CASE WHEN feedback_loops.phase = 'converged' THEN 'idle' ELSE feedback_loops.phase END,
       clean_sweep = CASE WHEN feedback_loops.phase = 'converged' THEN false ELSE feedback_loops.clean_sweep END,
       started_at = COALESCE(feedback_loops.started_at, now()),
       last_error = NULL,
       note = 'Started',
       updated_at = now()
     RETURNING *`,
    [appKey, envKey]
  );
  return { status: 200, body: { data: rows[0] } };
}

export async function setLoopState(
  appKey: string,
  action: 'suspend' | 'resume' | 'stop'
): Promise<{ status: number; body: Record<string, unknown> }> {
  const loop = await getLoop(appKey);
  if (!loop) return { status: 404, body: { error: 'No feedback loop for this application; start one first', application: appKey } };
  const allowed: Record<typeof action, LoopState[]> = { suspend: ['running'], resume: ['suspended'], stop: ['running', 'suspended'] };
  const next: Record<typeof action, LoopState> = { suspend: 'suspended', resume: 'running', stop: 'stopped' };
  const note = { suspend: 'Suspended by operator', resume: 'Resumed by operator', stop: 'Stopped by operator' }[action];
  if (!allowed[action].includes(loop.state)) {
    if (action === 'stop') return { status: 200, body: { data: loop } };
    return { status: 409, body: { error: `Cannot ${action} a loop that is ${loop.state}`, data: loop } };
  }
  const { rows } = await query<LoopRow>(
    `UPDATE feedback_loops SET state = $2, note = $3, updated_at = now() WHERE key = $1 RETURNING *`,
    [appKey, next[action], note]
  );
  return { status: 200, body: { data: rows[0] } };
}

/** Reports of one application that are not verified yet, with whether each is ready for rerun. */
async function loadReports(appKey: string): Promise<Array<ReportLite & { defects: Array<{ key: string; status: string }> }>> {
  const { rows } = await query<{ key: string; status: string; defects: Array<{ key: string; status: string }> }>(
    `SELECT dr.key, dr.status,
            COALESCE(json_agg(json_build_object('key', d.key, 'status', d.status)) FILTER (WHERE d.id IS NOT NULL), '[]') AS defects
       FROM defect_reports dr
       JOIN executions e ON e.id = dr.execution_id
       LEFT JOIN defects d ON d.report_id = dr.id
      WHERE e.metadata->>'application_key' = $1 AND dr.status <> 'verified'
      GROUP BY dr.id, dr.key, dr.status, dr.created_at
      ORDER BY dr.created_at`,
    [appKey]
  );
  return rows.map((r) => ({ key: r.key, status: r.status, defects: r.defects, ready: isReadyForRerun(r.defects) }));
}

export async function getLoopStatus(appKey: string) {
  const loop = await getLoop(appKey);
  const reports = await loadReports(appKey);
  const counts: Record<string, number> = {};
  for (const r of reports) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return {
    loop,
    counts,
    reports: reports.map((r) => ({ key: r.key, status: r.status, ready_for_rerun: r.ready, defects: r.defects })),
  };
}

// ---------------------------------------------------------------- the tick

let ticking = false;

/** Advance every running loop once. Overlapping ticks are skipped. */
export async function feedbackLoopTick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const { rows } = await query<LoopRow>(`SELECT * FROM feedback_loops WHERE state = 'running' ORDER BY key`);
    for (const loop of rows) {
      try {
        await advance(loop);
      } catch (err) {
        const message = (err as Error).message;
        console.warn(`[feedback-loop] ${loop.key}: ${message}`);
        await query(`UPDATE feedback_loops SET last_error = $2, updated_at = now() WHERE key = $1`, [loop.key, message.slice(0, 500)]);
      }
    }
  } finally {
    ticking = false;
  }
}

async function advance(loop: LoopRow): Promise<void> {
  if (loop.current_run_id) return collectSweep(loop);

  const reports = await loadReports(loop.key);
  const decision = decide(reports, loop.clean_sweep);

  if (decision.action === 'wait') {
    const note =
      decision.phase === 'awaiting_pm'
        ? `Waiting for the implementation manager to claim ${decision.open} report(s).`
        : decision.phase === 'awaiting_fixes'
          ? `Waiting for the implementation manager to fix the defects in ${decision.open} report(s).`
          : `Waiting for ${decision.open} rerun(s) to finish.`;
    await setPhase(loop.key, decision.phase, note);
    return;
  }

  if (decision.action === 'converged') {
    await query(
      `UPDATE feedback_loops SET state = 'stopped', phase = 'converged', note = $2, updated_at = now() WHERE key = $1`,
      [loop.key, 'Converged: a full sweep passed and no report is outstanding. Loop stopped.']
    );
    return;
  }

  if (decision.action === 'rerun') {
    // Anything that changes the application invalidates the last sweep.
    await query(`UPDATE feedback_loops SET clean_sweep = false, updated_at = now() WHERE key = $1`, [loop.key]);
    const done: string[] = [];
    const refused: string[] = [];
    for (const key of decision.keys) {
      try {
        await requestRerun(key, 'feedback-loop', 'Requested by the feedback loop after the fix was reported.');
        done.push(key);
      } catch (err) {
        refused.push(`${key}: ${(err as Error).message}`);
      }
    }
    await query(
      `UPDATE feedback_loops SET phase = 'rerunning', note = $2, last_error = $3, updated_at = now() WHERE key = $1`,
      [
        loop.key,
        done.length ? `Rerun requested for ${done.length} report(s): ${done.join(', ')}.` : 'No rerun could be requested yet.',
        refused.length ? refused.join('; ').slice(0, 500) : null,
      ]
    );
    return;
  }

  // Full sweep: the baseline, and the regression check before converging.
  const outcome = await queueRun({
    application: loop.key,
    environment: loop.environment_key,
    scope: {},
    exclusive: true,
    trigger_source: 'feedback-loop',
    reason: 'Feedback loop full sweep',
    metadata: { feedback_loop: loop.key, kind: 'sweep', cycle: loop.cycle + 1 },
    requested_by: 'feedback-loop',
  });

  if (outcome.status === 202 && outcome.body.data?.run_id) {
    const runId = outcome.body.data.run_id as string;
    await query(
      `UPDATE feedback_loops
          SET current_run_id = $2, cycle = cycle + 1, phase = 'sweeping', clean_sweep = false,
              note = $3, last_error = NULL, updated_at = now()
        WHERE key = $1`,
      [loop.key, runId, `Cycle ${loop.cycle + 1}: full sweep ${runId} queued.`]
    );
    return;
  }
  if (outcome.status === 409) {
    await setPhase(loop.key, 'sweeping', `Waiting: another run is in progress (${outcome.body.run_id ?? 'unknown'}).`);
    return;
  }
  if (outcome.deferred) {
    await setPhase(loop.key, 'sweeping', `Environment is down; a deploy is running (${outcome.deferred.deployment_id}). The sweep starts when it succeeds.`);
    return;
  }
  const message = String(outcome.body.error ?? `status ${outcome.status}`);
  await query(`UPDATE feedback_loops SET last_error = $2, note = $3, updated_at = now() WHERE key = $1`, [
    loop.key,
    message.slice(0, 500),
    `Could not queue the sweep: ${message}`,
  ]);
}

/** Read the sweep in flight; clean only if every case was reported and none failed. */
async function collectSweep(loop: LoopRow): Promise<void> {
  const runId = loop.current_run_id as string;
  const run = await loadRun(runId);
  if (!run) {
    await query(
      `UPDATE feedback_loops SET current_run_id = NULL, last_error = $2, updated_at = now() WHERE key = $1`,
      [loop.key, `Run ${runId} was not found; the loop moved on.`]
    );
    return;
  }
  const summary = summarize(runId, run.executions, run.results, await onlineWorkers());
  if (summary.state !== 'completed' && summary.state !== 'cancelled') return;

  const failing = summary.totals.failed + summary.totals.inconclusive;
  const clean = summary.state === 'completed' && summary.totals.reported >= summary.totals.cases && failing === 0;
  const note = clean
    ? `Cycle ${loop.cycle}: sweep ${runId} passed every case.`
    : `Cycle ${loop.cycle}: sweep ${runId} ended (${summary.state}) with ${failing} failing case(s); their reports are with the implementation manager.`;
  await query(
    `UPDATE feedback_loops SET current_run_id = NULL, clean_sweep = $2, note = $3, updated_at = now() WHERE key = $1`,
    [loop.key, clean, note]
  );
}

async function setPhase(loopKey: string, phase: LoopPhase, note: string): Promise<void> {
  await query(`UPDATE feedback_loops SET phase = $2, note = $3, updated_at = now() WHERE key = $1`, [loopKey, phase, note]);
}
