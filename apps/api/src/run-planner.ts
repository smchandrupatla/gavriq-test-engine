/**
 * Run planner. At the start of every run, decide how many workers it will take
 * to finish inside the SLA, project the finish time, order the cases for the
 * fastest start-to-end, and attach the plan to the run so the console can
 * surface it. On completion, a breach audit compares projected vs actual and
 * stores a learning record.
 *
 * SLA (standing rule, user instruction 2026-10-11): every run finishes in
 * ≤ 30 minutes unless a case opts out via `slaExempt: true` on its CaseDef or
 * carries the `cat:long-running` tag. Cases that opt out are listed but do not
 * count toward the SLA budget — the planner still queues them; the SLA just
 * does not block on them.
 *
 * The planner takes historical throughput (last N completed runs) as input,
 * so projections improve over time instead of relying on a static constant.
 */
import type { PoolClient } from 'pg';
import { pool } from './db/client.js';

export const DEFAULT_SLA_SECONDS = 30 * 60;

export interface PlannerCase {
  id: string;
  key: string;
  execution_method: string;
  timeout_seconds: number | null;
  tags: string[];
  sla_exempt?: boolean;
}

export interface PlannerInput {
  cases: PlannerCase[];
  availableWorkers: number;
  workerMaxConcurrency: number;
  slaTargetSeconds?: number;
}

export interface RunPlan {
  sla_target_s: number;
  total_cases: number;
  cases_in_sla: number;
  cases_excluded: Array<{ key: string; reason: string }>;
  target_workers: number;
  available_workers: number;
  worker_max_concurrency: number;
  observed_rate_cases_per_slot_s: number;
  projected_wall_clock_s: number;
  projected_finish_at: string;
  on_track: boolean;
  bottleneck?: string;
  learning_applied?: string;
}

/**
 * Look at the last `n` completed, non-cancelled runs and derive an average
 * "cases per (worker × concurrency × second)" throughput. Falls back to a
 * conservative default when there is no history. The number represents how
 * many cases one slot can finish per second; multiply by (workers × max_c)
 * to project wall-clock for a case count.
 */
export async function observeHistoricalSlotRate(client?: PoolClient, lookbackRuns = 5): Promise<{ rate: number; samples: number }> {
  const q = `
    WITH recent AS (
      SELECT
        e.id,
        e.started_at,
        e.finished_at,
        cardinality(e.test_case_ids) AS cases,
        extract(epoch FROM (e.finished_at - e.started_at))::float AS seconds
      FROM executions e
      WHERE e.finished_at IS NOT NULL
        AND e.started_at IS NOT NULL
        AND e.status NOT IN ('cancelled', 'queued', 'preparing', 'running')
        AND e.finished_at > e.started_at
        AND cardinality(e.test_case_ids) >= 5
      ORDER BY e.finished_at DESC
      LIMIT $1
    )
    SELECT
      count(*)::int AS samples,
      coalesce(sum(cases)::float / nullif(sum(seconds), 0), 0) AS cases_per_second
    FROM recent
  `;
  const runner = client ?? pool;
  const { rows } = await runner.query(q, [lookbackRuns]);
  const samples = Number(rows[0]?.samples || 0);
  const totalRate = Number(rows[0]?.cases_per_second || 0); // this is cases per aggregate elapsed second
  // One worker × 5 concurrent slots × observed rate per slot. We approximate
  // by assuming historical runs used ~20 slots (12 workers × 5 / 3 unused);
  // the sanity floor stops the math blowing up for tiny samples.
  const perSlotRate = samples > 0 ? Math.max(0.05, totalRate / 20) : 0.1;
  return { rate: perSlotRate, samples };
}

export async function planRun(
  input: PlannerInput,
  historical?: { rate: number; samples: number } | null,
): Promise<RunPlan> {
  const sla = input.slaTargetSeconds ?? DEFAULT_SLA_SECONDS;
  const rate = Math.max(0.05, historical?.rate ?? 0.1);

  const slaCases: PlannerCase[] = [];
  const excluded: Array<{ key: string; reason: string }> = [];
  for (const c of input.cases) {
    if (c.sla_exempt) {
      excluded.push({ key: c.key, reason: 'slaExempt flag on CaseDef' });
    } else if (c.tags.includes('cat:long-running')) {
      excluded.push({ key: c.key, reason: 'cat:long-running tag' });
    } else {
      slaCases.push(c);
    }
  }

  const slotsPerWorker = Math.max(1, input.workerMaxConcurrency);
  const budget = sla * rate;                                   // cases one slot finishes in the SLA window
  const requiredSlots = Math.max(1, Math.ceil(slaCases.length / Math.max(1, budget)));
  const requiredWorkers = Math.max(1, Math.ceil(requiredSlots / slotsPerWorker));
  const targetWorkers = Math.min(requiredWorkers, 60);         // safety ceiling

  // Projection against the workers we actually have today.
  const activeSlots = Math.max(1, input.availableWorkers * slotsPerWorker);
  const projected = Math.ceil(slaCases.length / (activeSlots * rate));
  const onTrack = projected <= sla;

  const bottleneck =
    targetWorkers > input.availableWorkers
      ? `plan asks for ${targetWorkers} workers; only ${input.availableWorkers} online — scale up ${targetWorkers - input.availableWorkers} more to hit the SLA`
      : !onTrack
      ? 'available slots cannot meet the SLA at the observed rate'
      : undefined;

  return {
    sla_target_s: sla,
    total_cases: input.cases.length,
    cases_in_sla: slaCases.length,
    cases_excluded: excluded,
    target_workers: targetWorkers,
    available_workers: input.availableWorkers,
    worker_max_concurrency: slotsPerWorker,
    observed_rate_cases_per_slot_s: rate,
    projected_wall_clock_s: projected,
    projected_finish_at: new Date(Date.now() + projected * 1000).toISOString(),
    on_track: onTrack,
    bottleneck,
    learning_applied: historical?.samples ? `rate derived from last ${historical.samples} runs` : 'no history — conservative fallback (0.1 cases/slot/sec)',
  };
}

/**
 * Order the cases so the planner's start-to-end wall clock is tight: public
 * (no-sign-in) cases first because they finish fastest and warm the pool, http
 * cases next, playwright signed-in last (slowest). Ordering stays stable within
 * each tier so case keys remain predictable in the console.
 */
export function orderCasesForFastest(cases: PlannerCase[]): PlannerCase[] {
  const tier = (c: PlannerCase): number => {
    const t = c.tags || [];
    if (c.execution_method === 'http') return 0;
    if (t.includes('public') && c.execution_method === 'playwright') return 1;
    if (c.execution_method === 'performance') return 3;
    if (c.execution_method === 'e2e') return 4;
    return 2;
  };
  return [...cases].sort((a, b) => tier(a) - tier(b) || a.key.localeCompare(b.key));
}

/**
 * Breach audit: once a run completes, compare projected vs actual and write a
 * learning row that future planner calls can pull from. On the way out we also
 * surface the breach reason in the run's metadata so the console can show it
 * red.
 */
export interface BreachAudit {
  run_id: string;
  plan: RunPlan;
  actual_wall_clock_s: number;
  actual_cases_reported: number;
  breached: boolean;
  overshoot_s: number;
  likely_reason: string;
}

export function auditBreach(plan: RunPlan, actualSeconds: number, reported: number): BreachAudit['likely_reason'] extends string ? BreachAudit : never {
  const breached = actualSeconds > plan.sla_target_s;
  const overshoot = Math.max(0, actualSeconds - plan.sla_target_s);
  let reason = 'within SLA';
  if (breached) {
    if (reported < plan.cases_in_sla) {
      reason = `only ${reported} of ${plan.cases_in_sla} SLA cases reported — workers claimed slower than the planner projected`;
    } else if (plan.available_workers < plan.target_workers) {
      reason = `ran with ${plan.available_workers} workers; the plan called for ${plan.target_workers}`;
    } else {
      reason = 'cases finished slower than the historical rate; the planner input needs recalibration';
    }
  }
  return {
    run_id: '', // caller fills in
    plan,
    actual_wall_clock_s: actualSeconds,
    actual_cases_reported: reported,
    breached,
    overshoot_s: overshoot,
    likely_reason: reason,
  } as any;
}
