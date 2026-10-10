/**
 * Cycle runs — deploy → run → tear down, repeated N times from one click.
 *
 * The user wants to hammer an environment: deploy, run every test, tear down,
 * then do it all again. One call to startCycleRun creates a cycle_runs row and
 * fires the first deploy with a cycle_run_id stamped on it. When the deploy's
 * teardown succeeds, infra.ts applyJobOutcome calls advanceCycle, which starts
 * the next iteration or marks the cycle done. A deploy or teardown that fails
 * marks the cycle failed; cancelCycle stops the chain and cancels any live
 * executions.
 *
 * Related:
 *   apps/api/src/infra.ts   createDeployment / applyJobOutcome / teardown logic
 *   apps/api/src/routes/cycle-runs.ts   REST surface for the console
 */
import { query } from './db/client.js';
import { createDeployment, environmentState, infraConfig, infraPolicy, queuePrune, queueTeardown } from './infra.js';

export interface CycleRunRow {
  id: string;
  key: string;
  application: string;
  environment_id: string;
  iterations_total: number;
  iterations_done: number;
  status: 'running' | 'completed' | 'cancelled' | 'failed';
  current_deployment_id: string | null;
  last_error: string | null;
  requested_by: string | null;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
  clean_start?: boolean;
  preparation_phase?: 'tearing_down' | 'pruning' | 'ready' | null;
  preparation_prune_job_id?: string | null;
}

export interface StartCycleInput {
  application: string;
  environment: string; // id or key
  iterations: number;
  /** Teardown + Docker prune before the first iteration — "clean slate" cycle. */
  clean_start?: boolean;
  requestedBy?: string | null;
}

export interface StartCycleOutcome {
  status: number;
  body: Record<string, unknown>;
}

const MAX_ITERATIONS = 100;

async function cycleKey(): Promise<string> {
  const { rows } = await query<{ n: string }>(`SELECT nextval('cycle_run_key_seq')::text AS n`);
  return `CY-${String(rows[0]!.n).padStart(5, '0')}`;
}

/**
 * Start a deploy → run → teardown cycle for `iterations` iterations. Refuses if
 * another cycle is already running for the same environment: a second cycle
 * would race the first on the same stack.
 *
 * When `clean_start` is true the cycle begins with a preparation phase:
 *   tearing_down → pruning → ready
 * The first iteration's deploy fires only once preparation is done, so the
 * stack starts from an actually clean state. Dependency components (Kafka, MQ,
 * portals, …) are brought up by the compose stack's deploy script as usual.
 */
export async function startCycleRun(input: StartCycleInput, actorId?: string | null): Promise<StartCycleOutcome> {
  const iterations = Math.floor(Number(input.iterations));
  if (!Number.isFinite(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    return { status: 400, body: { error: `iterations must be between 1 and ${MAX_ITERATIONS}` } };
  }
  if (!input.application || !input.environment) {
    return { status: 400, body: { error: 'application and environment are required' } };
  }
  const { rows: envRows } = await query(
    `SELECT id, key, config FROM environments WHERE id::text = $1 OR key = $1`,
    [input.environment]
  );
  const environment = envRows[0];
  if (!environment) return { status: 404, body: { error: 'Environment not found', environment: input.environment } };

  const { rows: inFlight } = await query(
    `SELECT key FROM cycle_runs WHERE environment_id = $1 AND status = 'running' LIMIT 1`,
    [environment.id]
  );
  if (inFlight[0]) {
    return {
      status: 409,
      body: { error: `A cycle is already running on this environment (${inFlight[0].key}); cancel it first` },
    };
  }

  const cleanStart = Boolean(input.clean_start);
  const infra = infraConfig(environment);
  if (cleanStart && !infra) {
    return {
      status: 409,
      body: { error: `Environment "${environment.key}" is not managed by the infra agent — a clean-start cycle needs a compose-managed stack` },
    };
  }

  const key = await cycleKey();
  const requestedBy = input.requestedBy ?? actorId ?? null;
  const { rows: created } = await query<CycleRunRow>(
    `INSERT INTO cycle_runs (key, application, environment_id, iterations_total, status, requested_by,
                             clean_start, preparation_phase)
     VALUES ($1, $2, $3, $4, 'running', $5, $6, $7) RETURNING *`,
    [key, input.application, environment.id, iterations, requestedBy, cleanStart, cleanStart ? 'tearing_down' : null]
  );
  const cycle = created[0]!;

  if (cleanStart) {
    const prepped = await beginPreparation(cycle, environment as { id: string; key: string; config?: Record<string, any> | null });
    if (!prepped.ok) {
      await query(
        `UPDATE cycle_runs SET status = 'failed', last_error = $2, finished_at = now(), updated_at = now()
           WHERE id = $1`,
        [cycle.id, prepped.error.slice(0, 500)]
      );
      return { status: 409, body: { error: `cycle ${key} aborted: ${prepped.error}` } };
    }
    return {
      status: 202,
      body: {
        data: { ...cycle, preparation_phase: prepped.phase },
        message: `Cycle ${key} started: ${prepped.phase === 'tearing_down' ? 'tearing the stack down' : prepped.phase === 'pruning' ? 'pruning Docker' : 'ready'} before iteration 1 of ${iterations}`,
      },
    };
  }

  return fireIteration(cycle, 1, iterations, actorId);
}

/** Queue the right preparation step given the environment's current state. */
async function beginPreparation(
  cycle: CycleRunRow,
  environment: { id: string; key: string; config?: Record<string, any> | null }
): Promise<{ ok: true; phase: 'tearing_down' | 'pruning' | 'ready' } | { ok: false; error: string }> {
  const infra = infraConfig(environment);
  if (!infra) return { ok: false, error: 'environment is no longer managed by the infra agent' };
  const state = environmentState(environment);

  if (state === 'up' || state === 'failed' || state === 'unknown') {
    const policy = await infraPolicy();
    try {
      await queueTeardown(
        { id: environment.id, key: environment.key, infra, state },
        'clean_cycle_prep',
        { policy, requested_by: cycle.requested_by ?? null }
      );
    } catch (err) {
      return { ok: false, error: `teardown could not be queued: ${(err as Error).message}` };
    }
    await setPreparationPhase(cycle.id, 'tearing_down');
    return { ok: true, phase: 'tearing_down' };
  }

  // Stack is already down (or in transition — queuePrune waits either way).
  return queuePreparationPrune(cycle.id, cycle.requested_by ?? null);
}

async function queuePreparationPrune(
  cycleId: string,
  requestedBy: string | null
): Promise<{ ok: true; phase: 'pruning' | 'ready' } | { ok: false; error: string }> {
  try {
    const { job, created } = await queuePrune('clean_cycle_prep', { requested_by: requestedBy ?? 'cycle-run' });
    await query(
      `UPDATE cycle_runs SET preparation_phase = 'pruning', preparation_prune_job_id = $2, updated_at = now()
         WHERE id = $1`,
      [cycleId, job.id]
    );
    void created; // whether the job was created or an existing one was reused is fine
    return { ok: true, phase: 'pruning' };
  } catch (err) {
    return { ok: false, error: `prune could not be queued: ${(err as Error).message}` };
  }
}

async function setPreparationPhase(cycleId: string, phase: 'tearing_down' | 'pruning' | 'ready' | null): Promise<void> {
  await query(
    `UPDATE cycle_runs SET preparation_phase = $2, updated_at = now() WHERE id = $1`,
    [cycleId, phase]
  );
}

/** Fire one iteration's deploy and stamp the cycle on it. Shared by startCycleRun and advanceCycle. */
async function fireIteration(
  cycle: CycleRunRow,
  iteration: number,
  iterationsTotal: number,
  actorId?: string | null
): Promise<StartCycleOutcome> {
  const outcome = await createDeployment(
    {
      environment: cycle.environment_id,
      application: cycle.application,
      mode: 'deploy_and_run',
      teardown_after_run: true,
      requested_by: cycle.requested_by ?? null,
      reason: `cycle ${cycle.key} iteration ${iteration}/${iterationsTotal}`,
    },
    actorId
  );
  if (outcome.status !== 202 || !outcome.body?.data?.id) {
    const message = String(outcome.body?.error || `deploy could not be queued (HTTP ${outcome.status})`);
    await query(
      `UPDATE cycle_runs SET status = 'failed', last_error = $2, finished_at = now(), updated_at = now()
         WHERE id = $1`,
      [cycle.id, message.slice(0, 500)]
    );
    return { status: outcome.status, body: { error: `cycle ${cycle.key} aborted: ${message}` } };
  }
  const deploymentId = outcome.body.data.id as string;
  await query(`UPDATE deployments SET cycle_run_id = $2 WHERE id = $1`, [deploymentId, cycle.id]);
  await query(
    `UPDATE cycle_runs SET current_deployment_id = $2, preparation_phase = NULL, updated_at = now()
       WHERE id = $1`,
    [cycle.id, deploymentId]
  );
  return {
    status: 202,
    body: {
      data: { ...cycle, current_deployment_id: deploymentId, iteration_in_flight: iteration },
      message: `Cycle ${cycle.key} started: iteration ${iteration} of ${iterationsTotal}`,
    },
  };
}

/**
 * The teardown of one iteration finished. If the cycle is still running and
 * iterations are left, queue the next deploy with the same cycle id. Else
 * mark it completed. Called from applyJobOutcome.
 */
export async function advanceCycle(cycleId: string, teardownSucceeded: boolean): Promise<void> {
  const { rows } = await query<CycleRunRow>(`SELECT * FROM cycle_runs WHERE id = $1 FOR UPDATE`, [cycleId]);
  const cycle = rows[0];
  if (!cycle) return;
  if (cycle.status !== 'running') return;

  if (!teardownSucceeded) {
    await query(
      `UPDATE cycle_runs SET status = 'failed', last_error = $2, finished_at = now(), updated_at = now()
         WHERE id = $1`,
      [cycle.id, `Iteration ${cycle.iterations_done + 1} teardown failed`]
    );
    return;
  }

  const done = cycle.iterations_done + 1;
  if (done >= cycle.iterations_total) {
    await query(
      `UPDATE cycle_runs SET iterations_done = $2, status = 'completed', current_deployment_id = NULL,
              finished_at = now(), updated_at = now() WHERE id = $1`,
      [cycle.id, done]
    );
    return;
  }

  await query(`UPDATE cycle_runs SET iterations_done = $2, updated_at = now() WHERE id = $1`, [cycle.id, done]);
  await fireIteration({ ...cycle, iterations_done: done }, done + 1, cycle.iterations_total, cycle.requested_by);
}

/**
 * A teardown job for a managed environment just finished. If a running cycle on that
 * environment is in its "tearing_down" preparation phase, advance it to the prune step.
 * Called from applyJobOutcome after a teardown succeeds.
 */
export async function onPrepTeardownFinished(environmentId: string, succeeded: boolean): Promise<void> {
  const { rows } = await query<CycleRunRow>(
    `SELECT * FROM cycle_runs
       WHERE environment_id = $1 AND status = 'running' AND clean_start = true AND preparation_phase = 'tearing_down'
       FOR UPDATE`,
    [environmentId]
  );
  const cycle = rows[0];
  if (!cycle) return;
  if (!succeeded) {
    await query(
      `UPDATE cycle_runs SET status = 'failed', last_error = $2, finished_at = now(), updated_at = now()
         WHERE id = $1`,
      [cycle.id, 'preparation teardown failed']
    );
    return;
  }
  const prepped = await queuePreparationPrune(cycle.id, cycle.requested_by);
  if (!prepped.ok) {
    await query(
      `UPDATE cycle_runs SET status = 'failed', last_error = $2, finished_at = now(), updated_at = now()
         WHERE id = $1`,
      [cycle.id, prepped.error.slice(0, 500)]
    );
  }
}

/**
 * A prune job finished. If a cycle is waiting on this specific prune (by job id),
 * advance it to ready and fire iteration 1. Called from applyJobOutcome.
 */
export async function onPrepPruneFinished(pruneJobId: string, succeeded: boolean): Promise<void> {
  const { rows } = await query<CycleRunRow>(
    `SELECT * FROM cycle_runs
       WHERE status = 'running' AND preparation_phase = 'pruning' AND preparation_prune_job_id = $1
       FOR UPDATE`,
    [pruneJobId]
  );
  const cycle = rows[0];
  if (!cycle) return;
  if (!succeeded) {
    await query(
      `UPDATE cycle_runs SET status = 'failed', last_error = $2, finished_at = now(), updated_at = now()
         WHERE id = $1`,
      [cycle.id, 'preparation prune failed']
    );
    return;
  }
  await setPreparationPhase(cycle.id, 'ready');
  await fireIteration(cycle, 1, cycle.iterations_total, cycle.requested_by);
}

/** A deploy failed mid-cycle: stop the chain and record the error. */
export async function failCycle(cycleId: string, error: string): Promise<void> {
  await query(
    `UPDATE cycle_runs SET status = 'failed', last_error = $2, finished_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'running'`,
    [cycleId, (error || 'deploy failed').slice(0, 500)]
  );
}

/**
 * Cancel a cycle: mark it cancelled, cancel the active run (if any), and
 * cancel the queued deploy job (if any). The current teardown is allowed to
 * run so the stack lands in a clean state. Returns {cancelled_runs} so the UI
 * can toast it.
 */
export async function cancelCycle(cycleId: string, by: string): Promise<{ cancelled_runs: number }> {
  const { rows } = await query<CycleRunRow>(`SELECT * FROM cycle_runs WHERE id::text = $1 OR key = $1 FOR UPDATE`, [cycleId]);
  const cycle = rows[0];
  if (!cycle) return { cancelled_runs: 0 };
  if (cycle.status !== 'running') return { cancelled_runs: 0 };

  // Cancel the queued deploy job if the agent has not started it yet; a running one is left to finish.
  if (cycle.current_deployment_id) {
    await query(
      `UPDATE infra_jobs SET status = 'cancelled', error = COALESCE(error, 'cycle cancelled by ' || $2),
              finished_at = now(), updated_at = now()
         WHERE deployment_id = $1 AND status = 'queued'`,
      [cycle.current_deployment_id, by]
    );
  }
  // Cancel any preparation job (teardown or prune) still queued for this cycle.
  if (cycle.preparation_prune_job_id) {
    await query(
      `UPDATE infra_jobs SET status = 'cancelled', error = COALESCE(error, 'cycle cancelled by ' || $2),
              finished_at = now(), updated_at = now()
         WHERE id = $1 AND status = 'queued'`,
      [cycle.preparation_prune_job_id, by]
    );
  }
  await query(
    `UPDATE infra_jobs SET status = 'cancelled', error = COALESCE(error, 'cycle cancelled by ' || $2),
            finished_at = now(), updated_at = now()
       WHERE kind = 'teardown' AND environment_id = $1 AND status = 'queued' AND reason = 'clean_cycle_prep'`,
    [cycle.environment_id, by]
  );

  // Cancel every live execution on this cycle's environment+application.
  const { rows: cancelled } = await query(
    `UPDATE executions SET status = 'cancelled', finished_at = now()
       WHERE environment_id = $1 AND metadata->>'application_key' = $2 AND status IN ('queued','preparing','running')
       RETURNING id`,
    [cycle.environment_id, cycle.application]
  );

  await query(
    `UPDATE cycle_runs SET status = 'cancelled', last_error = COALESCE(last_error, 'cancelled by ' || $2),
            finished_at = now(), updated_at = now() WHERE id = $1`,
    [cycle.id, by]
  );
  return { cancelled_runs: cancelled.length };
}

/** The one running cycle for an application+environment, or the newest completed/failed/cancelled one. */
export async function currentCycle(application: string, environmentKeyOrId: string): Promise<CycleRunRow | null> {
  const { rows } = await query<CycleRunRow>(
    `SELECT cr.*, e.key AS environment_key, e.name AS environment_name
       FROM cycle_runs cr
       JOIN environments e ON e.id = cr.environment_id
      WHERE cr.application = $1
        AND (e.id::text = $2 OR e.key = $2)
      ORDER BY (cr.status = 'running') DESC, cr.started_at DESC
      LIMIT 1`,
    [application, environmentKeyOrId]
  );
  return rows[0] ?? null;
}

export async function getCycle(idOrKey: string): Promise<CycleRunRow | null> {
  const { rows } = await query<CycleRunRow>(
    `SELECT cr.*, e.key AS environment_key, e.name AS environment_name
       FROM cycle_runs cr JOIN environments e ON e.id = cr.environment_id
      WHERE cr.id::text = $1 OR cr.key = $1`,
    [idOrKey]
  );
  return rows[0] ?? null;
}

export async function listCycles(filter: { application?: string; environment?: string; status?: string; limit?: number } = {}): Promise<CycleRunRow[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (filter.application) {
    params.push(filter.application);
    where.push(`cr.application = $${params.length}`);
  }
  if (filter.environment) {
    params.push(filter.environment);
    where.push(`(e.id::text = $${params.length} OR e.key = $${params.length})`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`cr.status = $${params.length}`);
  }
  params.push(Math.min(Math.max(filter.limit ?? 20, 1), 200));
  const { rows } = await query<CycleRunRow>(
    `SELECT cr.*, e.key AS environment_key, e.name AS environment_name
       FROM cycle_runs cr JOIN environments e ON e.id = cr.environment_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY cr.started_at DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

// ---------------------------------------------------------------- pure helpers for tests

export interface CycleTickInput {
  status: CycleRunRow['status'];
  iterations_total: number;
  iterations_done: number;
}

export type CycleDecision =
  | { action: 'next'; iteration: number }
  | { action: 'done' }
  | { action: 'stop'; reason: string };

/**
 * What the cycle should do after an iteration's teardown. Pure, so the rules
 * are tested without a DB.
 */
export function decideCycle(cycle: CycleTickInput, teardownSucceeded: boolean): CycleDecision {
  if (cycle.status !== 'running') return { action: 'stop', reason: `cycle is ${cycle.status}` };
  if (!teardownSucceeded) return { action: 'stop', reason: 'teardown failed' };
  const next = cycle.iterations_done + 1;
  if (next >= cycle.iterations_total) return { action: 'done' };
  return { action: 'next', iteration: next + 1 };
}
