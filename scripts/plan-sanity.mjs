// Quick sanity check for the run planner. Node 20+.
// Usage: npx tsx scripts/plan-sanity.mjs
import { planRun } from '../apps/api/src/run-planner.ts';

const cases = Array.from({ length: 5094 }, (_, i) => ({
  id: String(i),
  key: 'K-' + i,
  execution_method: i < 100 ? 'http' : 'playwright',
  timeout_seconds: null,
  tags: i < 50 ? ['public'] : ['signed-in'],
  sla_exempt: false,
}));
for (const workers of [1, 4, 12, 30, 60]) {
  const plan = await planRun(
    { cases, availableWorkers: workers, workerMaxConcurrency: 5 },
    { rate: 0.1, samples: 0 },
  );
  console.log(
    `workers=${workers} → target=${plan.target_workers} projected_min=${Math.round(plan.projected_wall_clock_s / 60)} on_track=${plan.on_track} ${plan.bottleneck ? 'bottleneck=' + plan.bottleneck : ''}`,
  );
}
