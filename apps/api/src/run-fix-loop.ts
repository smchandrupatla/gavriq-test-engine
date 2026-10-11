/**
 * Per-run auto-fix loop.
 *
 * Opted into on a run with `metadata.auto_fix: { enabled: true, max_attempts }`.
 * One row per original run_group in `run_fix_loops`. On every tick the loop:
 *
 *   1. Reads the latest attempt's results. If still in flight, waits.
 *   2. Classifies each failing case:
 *        - transient (environment / network / infra / target-unreachable / timeout)
 *          -> rerun the failing subset without redeploying;
 *        - real (assertion / application defect / anything else)
 *          -> redeploy the environment (if it is a managed stack) and rerun.
 *      Defect records for real failures are already filed by defects/service.ts
 *      on each execution's ingest, so by the time the loop parks there is a
 *      defect-log entry for every surviving failure.
 *   3. If `attempt >= max_attempts` and failures remain, the loop parks and the
 *      failing case keys land in `parked_case_keys` for the console to show.
 *   4. If no failures remain, the loop converges and stops.
 *
 * `decide` is pure, so the rules are tested without a database.
 *
 * Related:
 *   apps/api/src/routes/trigger.ts    (queueRun — original + scoped reruns)
 *   apps/api/src/feedback-loop.ts     (long-running per-application loop)
 *   apps/api/src/classify.ts          (isEnvironmentFailure helper)
 *   apps/api/src/infra.ts             (createDeployment for managed stacks)
 */
import type pg from 'pg';
import { createHash } from 'node:crypto';
import { query } from './db/client.js';
import { isEnvironmentFailure } from './classify.js';
import { queueRun, loadRun, summarize, onlineWorkers, type RunRequest } from './routes/trigger.js';
import { createDeployment, infraConfig } from './infra.js';
import { findCaseSource } from './routes/catalog-source.js';

export type FixLoopState = 'running' | 'converged' | 'parked' | 'stopped';
export type FixLoopPhase =
  | 'waiting_results'
  | 'classifying'
  | 'awaiting_patch'  // fixer agent is working on a proposal; rerun deferred until it lands
  | 'redeploying'
  | 'rerunning'
  | 'capped';

export const DEFAULT_FIX_LOOP_MAX_ATTEMPTS = 2;
const MIN_MAX_ATTEMPTS = 1;
const MAX_MAX_ATTEMPTS = 20;

export interface FailingCase {
  case_key: string;
  status: string;
  classification: string | null;
}

export type FixDecision =
  | { action: 'wait'; phase: 'waiting_results' }
  | { action: 'converge' }
  | { action: 'park'; failing_case_keys: string[]; reason: string }
  | { action: 'rerun'; case_keys: string[]; need_redeploy: boolean };

/**
 * Decide what the loop does given the completed attempt's failing cases.
 * Pure; the periodic tick turns the decision into database writes and API calls.
 */
export function decide(
  loop: { attempt: number; max_attempts: number; case_keys: string[] },
  failures: FailingCase[],
  state: 'in_flight' | 'completed' | 'cancelled'
): FixDecision {
  if (state === 'in_flight') return { action: 'wait', phase: 'waiting_results' };
  if (state === 'cancelled') {
    return { action: 'park', failing_case_keys: failures.map((f) => f.case_key), reason: 'The attempt was cancelled.' };
  }

  const tracked = new Set(loop.case_keys);
  const failing = failures.filter((f) => tracked.has(f.case_key));
  if (!failing.length) return { action: 'converge' };

  if (loop.attempt >= loop.max_attempts) {
    return {
      action: 'park',
      failing_case_keys: failing.map((f) => f.case_key),
      reason: `Hit the cap of ${loop.max_attempts} attempt(s); the remaining failures were logged as defects.`,
    };
  }

  const need_redeploy = failing.some((f) => !isEnvironmentFailure(f.status, f.classification));
  return { action: 'rerun', case_keys: failing.map((f) => f.case_key), need_redeploy };
}

export interface StartFixLoopInput {
  run_id: string;
  application_key: string;
  environment_key: string;
  case_keys: string[];
  max_attempts: number;
  requested_by?: string | null;
}

/** Called from queueRun right after it creates the executions for an auto-fix run. */
export async function startFixLoop(input: StartFixLoopInput): Promise<void> {
  const max = clampAttempts(input.max_attempts);
  if (!input.case_keys.length) return;
  await query(
    `INSERT INTO run_fix_loops (run_id, application_key, environment_key, max_attempts, attempt, state, phase, current_run_id, case_keys, reason, requested_by)
     VALUES ($1, $2, $3, $4, 1, 'running', 'waiting_results', $1, $5, $6, $7)
     ON CONFLICT (run_id) DO UPDATE SET
       max_attempts = EXCLUDED.max_attempts,
       state = 'running',
       phase = 'waiting_results',
       case_keys = EXCLUDED.case_keys,
       reason = EXCLUDED.reason,
       updated_at = now()`,
    [
      input.run_id,
      input.application_key,
      input.environment_key,
      max,
      input.case_keys,
      `Auto-fix loop started: tracking ${input.case_keys.length} case(s), up to ${max} attempt(s).`,
      input.requested_by ?? null,
    ]
  );
}

export function clampAttempts(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_FIX_LOOP_MAX_ATTEMPTS;
  return Math.min(MAX_MAX_ATTEMPTS, Math.max(MIN_MAX_ATTEMPTS, Math.round(v)));
}

export async function getFixLoop(runId: string) {
  const { rows } = await query(`SELECT * FROM run_fix_loops WHERE run_id = $1`, [runId]);
  return rows[0] ?? null;
}

export async function listFixLoops(limit = 50) {
  const { rows } = await query(
    `SELECT * FROM run_fix_loops ORDER BY updated_at DESC LIMIT $1`,
    [Math.min(500, Math.max(1, limit))]
  );
  return rows;
}

/** Default max_attempts from settings; falls back to 2 if the row is missing. */
export async function fixLoopDefaultMaxAttempts(): Promise<number> {
  try {
    const { rows } = await query(`SELECT auto_fix_default_max_attempts AS n FROM settings WHERE id = true`);
    const n = Number(rows[0]?.n);
    return Number.isInteger(n) && n >= MIN_MAX_ATTEMPTS && n <= MAX_MAX_ATTEMPTS ? n : DEFAULT_FIX_LOOP_MAX_ATTEMPTS;
  } catch {
    return DEFAULT_FIX_LOOP_MAX_ATTEMPTS;
  }
}

// --- tick ---------------------------------------------------------------

let ticking = false;

export async function fixLoopTick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const { rows } = await query(`SELECT * FROM run_fix_loops WHERE state = 'running' ORDER BY updated_at`);
    for (const loop of rows) {
      try {
        await advance(loop);
      } catch (err) {
        const message = (err as Error).message;
        console.warn(`[run-fix-loop] ${loop.run_id}: ${message}`);
        await query(
          `UPDATE run_fix_loops SET last_error = $2, updated_at = now() WHERE run_id = $1`,
          [loop.run_id, message.slice(0, 500)]
        );
      }
    }
  } finally {
    ticking = false;
  }
}

/** Latest result per tracked case in the current attempt's run_group. */
async function failuresFor(runId: string, caseKeys: string[]): Promise<{
  state: 'in_flight' | 'completed' | 'cancelled';
  failures: FailingCase[];
}> {
  const run = await loadRun(runId);
  if (!run) return { state: 'cancelled', failures: [] };
  const summary = summarize(runId, run.executions, run.results, await onlineWorkers());
  if (summary.state !== 'completed' && summary.state !== 'cancelled') {
    return { state: 'in_flight', failures: [] };
  }
  const failingStatuses = new Set(['failed', 'error', 'timed_out', 'blocked']);
  const tracked = new Set(caseKeys);
  // run.results already dedupes to the latest result per case per execution (trigger.ts loadRun).
  const failures: FailingCase[] = [];
  for (const r of run.results) {
    const key = (r as any).case_key as string | undefined;
    if (!key || !tracked.has(key)) continue;
    const status = String((r as any).status || '').toLowerCase();
    if (!failingStatuses.has(status)) continue;
    failures.push({ case_key: key, status, classification: (r as any).classification ?? null });
  }
  return { state: summary.state as 'completed' | 'cancelled', failures };
}

async function advance(loop: any): Promise<void> {
  const caseKeys: string[] = Array.isArray(loop.case_keys) ? loop.case_keys : [];
  if (!caseKeys.length) {
    await setParked(loop.run_id, [], 'No cases were tracked.');
    return;
  }

  // awaiting_patch: a fixer-agent is working on a proposal for one of our
  // tracked cases. Hold the rerun until every pending/claimed proposal for
  // this loop has moved to applied / rejected / failed / regressed.
  if (loop.phase === 'awaiting_patch') {
    const { rows: open } = await query(
      `SELECT COUNT(*)::int AS n FROM fix_proposals
        WHERE run_id = $1 AND status IN ('pending','claimed')`,
      [loop.run_id]
    );
    if ((open[0]?.n || 0) > 0) return;
    // Proposals landed; clear the phase so the normal path can rerun.
    await setPhase(loop.run_id, 'rerunning', `Patch step finished; preparing the next attempt.`);
    // Re-read so the local object matches the new phase for the rest of this tick.
    loop.phase = 'rerunning';
  }

  const { state, failures } = await failuresFor(loop.current_run_id, caseKeys);
  if (state === 'in_flight') {
    await setPhase(loop.run_id, 'waiting_results', `Attempt ${loop.attempt} of ${loop.max_attempts} is running.`);
    return;
  }

  const decision = decide(
    { attempt: loop.attempt, max_attempts: loop.max_attempts, case_keys: caseKeys },
    failures,
    state
  );

  if (decision.action === 'converge') {
    const reason = `All tracked cases passed on attempt ${loop.attempt}.`;
    await query(
      `UPDATE run_fix_loops SET state = 'converged', phase = 'rerunning', reason = $2, last_error = NULL, updated_at = now() WHERE run_id = $1`,
      [loop.run_id, reason]
    );
    await recordFixAction(loop.run_id, 'converge', reason, { attempt: loop.attempt });
    return;
  }

  if (decision.action === 'park') {
    await setParked(loop.run_id, decision.failing_case_keys, decision.reason);
    return;
  }

  // 'wait' is possible in theory but failuresFor already returned 'in_flight' above
  // and we exited before calling decide; still, narrow explicitly for the type checker.
  if (decision.action !== 'rerun') return;

  // Fixer step: when a failure classifies as a real defect (not transient) and
  // the fixer agent is enabled, open one fix_proposal per failing case and
  // enter awaiting_patch. The next advance() tick will resume once the proposal
  // completes. Transient failures skip the fixer and go straight to rerun.
  if (decision.need_redeploy) {
    const mode = await fixerMode();
    if (mode !== 'off') {
      const enqueued = await enqueueFixProposals(loop, decision.case_keys, failures);
      if (enqueued > 0) {
        await setPhase(loop.run_id, 'awaiting_patch',
          `Fixer agent is proposing a patch for ${enqueued} case(s). Rerun deferred.`);
        await recordFixAction(
          loop.run_id,
          'rerun',
          `Opened ${enqueued} fix proposal(s) for attempt ${loop.attempt + 1}.`,
          { attempt: loop.attempt + 1, case_keys: decision.case_keys, mode }
        );
        return;
      }
      // enqueue returned 0: either no source_file for the case (not in catalog),
      // or every case already had a pending proposal from a prior tick. Fall
      // through to the existing redeploy+rerun path.
    }
  }

  await setPhase(loop.run_id, decision.need_redeploy ? 'redeploying' : 'rerunning',
    `Preparing attempt ${loop.attempt + 1} of ${loop.max_attempts} for ${decision.case_keys.length} case(s).`);
  await recordFixAction(
    loop.run_id,
    decision.need_redeploy ? 'redeploy' : 'rerun',
    `Attempt ${loop.attempt + 1} of ${loop.max_attempts}: ${decision.case_keys.length} failing case(s) classified as ${decision.need_redeploy ? 'real defects (redeploy before rerun)' : 'transient (rerun without redeploy)'}.`,
    { attempt: loop.attempt + 1, case_keys: decision.case_keys }
  );

  const nextRunId = await startNextAttempt(loop, decision.case_keys, decision.need_redeploy);
  if (!nextRunId) return; // startNextAttempt already recorded an error / phase.

  await query(
    `UPDATE run_fix_loops SET
       attempt = attempt + 1,
       current_run_id = $2,
       case_keys = $3,
       phase = 'rerunning',
       reason = $4,
       last_error = NULL,
       updated_at = now()
     WHERE run_id = $1`,
    [
      loop.run_id,
      nextRunId,
      decision.case_keys,
      `Attempt ${loop.attempt + 1} of ${loop.max_attempts} queued for ${decision.case_keys.length} case(s)${decision.need_redeploy ? ' after a redeploy' : ''}.`,
    ]
  );
}

async function startNextAttempt(loop: any, caseKeys: string[], needRedeploy: boolean): Promise<string | null> {
  const runRequest: RunRequest = {
    application: loop.application_key,
    environment: loop.environment_key,
    scope: { case_keys: caseKeys },
    reason: `Auto-fix loop retry for run ${loop.run_id} (attempt ${loop.attempt + 1} of ${loop.max_attempts})`,
    trigger_source: 'auto-fix-loop',
    requested_by: loop.requested_by ?? 'auto-fix-loop',
    metadata: {
      auto_fix_parent: loop.run_id,
      auto_fix_attempt: loop.attempt + 1,
      // Do NOT include auto_fix.enabled here — we don't want queueRun to open a nested loop.
    },
  };

  // Managed stack with a redeploy requested: use deploy_and_run so the deploy
  // succeeds before the rerun fires. For an unmanaged env (or when the deploy
  // path is not configured) fall back to a direct rerun.
  if (needRedeploy) {
    const { rows: envRows } = await query(
      `SELECT id, key, config FROM environments WHERE key = $1`,
      [loop.environment_key]
    );
    const env = envRows[0];
    const infra = infraConfig(env);
    const deployApi = (env?.config || {}).deploy_api as { base_url?: string; key_env?: string } | undefined;
    if (env && (infra || (deployApi?.base_url && deployApi?.key_env))) {
      const deploy = await createDeployment({
        environment: loop.environment_key,
        application: loop.application_key,
        mode: 'deploy_and_run',
        reason: `Auto-fix loop retry (attempt ${loop.attempt + 1} of ${loop.max_attempts})`,
        requested_by: loop.requested_by ?? 'auto-fix-loop',
        run_request: runRequest as unknown as Record<string, unknown>,
      } as any);
      if (deploy.status >= 400) {
        await setPhase(loop.run_id, 'redeploying', `Deploy request refused: ${JSON.stringify(deploy.body).slice(0, 300)}`);
        return null;
      }
      // The run itself is replayed from the deploy pipeline (applyJobOutcome in infra.ts).
      // We don't learn the final run_group until the replay happens, so we poll by metadata.
      const deployId = (deploy.body as any)?.data?.id as string | undefined;
      if (!deployId) return null;
      // We mark current_run_id with a placeholder — the real one lands once the replay queues.
      // Readers resolve by looking at the deployment row.
      const placeholder = `deploy:${deployId}`;
      await query(
        `UPDATE run_fix_loops SET current_run_id = $2, phase = 'redeploying', reason = $3, updated_at = now() WHERE run_id = $1`,
        [loop.run_id, placeholder, `Deploy ${deployId} queued; the run will start when it succeeds.`]
      );
      // Return null here — the attempt counter advances on the next tick when the real run_group is known.
      return null;
    }
  }

  const outcome = await queueRun(runRequest, loop.requested_by ?? null);
  if (outcome.status === 202 && outcome.body.data?.run_id) {
    return outcome.body.data.run_id as string;
  }
  if (outcome.status === 409) {
    await setPhase(loop.run_id, 'rerunning', `Another run is in progress; waiting.`);
    return null;
  }
  const message = String(outcome.body?.error ?? `status ${outcome.status}`);
  await setPhase(loop.run_id, 'rerunning', `Rerun could not be queued: ${message.slice(0, 300)}`);
  await query(`UPDATE run_fix_loops SET last_error = $2, updated_at = now() WHERE run_id = $1`, [loop.run_id, message.slice(0, 500)]);
  return null;
}

async function setPhase(runId: string, phase: FixLoopPhase, reason: string): Promise<void> {
  await query(`UPDATE run_fix_loops SET phase = $2, reason = $3, updated_at = now() WHERE run_id = $1`, [runId, phase, reason]);
}

async function setParked(runId: string, parked: string[], reason: string): Promise<void> {
  await query(
    `UPDATE run_fix_loops SET state = 'parked', phase = 'capped', parked_case_keys = $2, reason = $3, updated_at = now() WHERE run_id = $1`,
    [runId, parked, reason]
  );
  await recordFixAction(runId, 'park', reason, { parked_case_keys: parked });
}

/**
 * Append a human-readable step to run_fix_loops.fix_actions. These are the
 * records surfaced to the user as "what the loop did" — one row per decision
 * (rerun / redeploy / park / converge / stop). jsonb || concatenates arrays.
 */
export async function recordFixAction(
  runId: string,
  action: 'rerun' | 'redeploy' | 'park' | 'converge' | 'stop' | 'error',
  reason: string,
  details?: Record<string, unknown>
): Promise<void> {
  const entry = {
    at: new Date().toISOString(),
    action,
    reason: reason.slice(0, 500),
    ...(details || {}),
  };
  await query(
    `UPDATE run_fix_loops SET fix_actions = fix_actions || $2::jsonb, updated_at = now() WHERE run_id = $1`,
    [runId, JSON.stringify([entry])]
  );
}

/** Settings-driven fixer mode: 'off' | 'propose' | 'auto'. Defaults to 'auto'. */
export async function fixerMode(): Promise<'off' | 'propose' | 'auto'> {
  try {
    const { rows } = await query<{ m: string }>(`SELECT fixer_agent_mode AS m FROM settings WHERE id = true`);
    const m = String(rows[0]?.m || 'auto').toLowerCase();
    if (m === 'off' || m === 'propose' || m === 'auto') return m;
    return 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * Open one fix_proposal per failing case that lives in a catalog file. Returns
 * the number of proposals created. A case we can't resolve to a catalog file
 * (not seeded by seed-realistic-catalog) is skipped — the loop falls back to
 * the existing redeploy+rerun path for those.
 *
 * The signature prevents infinite fix chains: if a prior proposal in this
 * loop targeted the same (case_key, step, status, message_first_line), park.
 */
async function enqueueFixProposals(loop: any, caseKeys: string[], failures: FailingCase[]): Promise<number> {
  let created = 0;
  for (const caseKey of caseKeys) {
    const src = findCaseSource(caseKey);
    if (!src) continue;
    const failure = failures.find((f) => f.case_key === caseKey);
    const signature = fixSignature(caseKey, failure);

    const { rows: priors } = await query(
      `SELECT id FROM fix_proposals WHERE run_id = $1 AND case_key = $2 AND signature = $3 LIMIT 1`,
      [loop.run_id, caseKey, signature]
    );
    if (priors[0]) {
      await setParked(loop.run_id, [caseKey], `Fixer did not converge for ${caseKey} (same failure signature twice).`);
      return 0;
    }

    // The unique partial index on (case_key) WHERE status IN ('pending','claimed')
    // prevents two concurrent proposals for the same case; a duplicate insert
    // raises and we silently skip (another loop is already waiting on one).
    try {
      await query(
        `INSERT INTO fix_proposals (run_id, attempt, case_key, source_file, signature)
         VALUES ($1, $2, $3, $4, $5)`,
        [loop.run_id, loop.attempt + 1, caseKey, src.file, signature]
      );
      created++;
    } catch (err) {
      const message = (err as Error).message;
      if (!/fix_proposals_pending_per_case/.test(message)) throw err;
    }
  }
  return created;
}

function fixSignature(caseKey: string, failure?: FailingCase): string {
  const status = failure?.status || '';
  const classification = failure?.classification || '';
  return createHash('sha1').update(`${caseKey}|${status}|${classification}`).digest('hex').slice(0, 32);
}

/**
 * Called by apps/api/src/routes/fix-proposals.ts after a complete/apply/reject
 * handler, to move the loop out of awaiting_patch so the next tick picks up
 * the rerun. We only clear phase, never change state — the tick decides
 * whether to converge, park, or rerun based on the next attempt's results.
 */
export async function resumeAfterPatch(runId: string, outcome: 'applied' | 'rejected'): Promise<void> {
  await query(
    `UPDATE run_fix_loops
        SET phase = 'rerunning',
            reason = $2,
            updated_at = now()
      WHERE run_id = $1 AND state = 'running' AND phase = 'awaiting_patch'`,
    [runId, outcome === 'applied'
      ? 'Patch applied; next attempt will fire on the next tick.'
      : 'Patch not applied; falling back to redeploy+rerun on the next tick.']
  );
}

export async function stopFixLoop(runId: string, reason?: string): Promise<boolean> {
  const text = (reason || 'Stopped by operator').slice(0, 500);
  const { rowCount } = await query(
    `UPDATE run_fix_loops SET state = 'stopped', reason = $2, updated_at = now() WHERE run_id = $1 AND state = 'running'`,
    [runId, text]
  );
  if ((rowCount ?? 0) > 0) await recordFixAction(runId, 'stop', text);
  return (rowCount ?? 0) > 0;
}
