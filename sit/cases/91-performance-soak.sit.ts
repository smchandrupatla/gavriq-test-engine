// Bounded-duration soak/endurance proxy for the main application.
//
// The Test Engine runs every case to completion within one blocking pass (sit/run.mjs
// is a synchronous CLI gate; sit/console.mjs guards all runs behind a single
// state.running flag) -- there is no background/continuous execution model here, so a
// soak test that ran for hours would starve every other Test Engine run for its entire
// duration. This instead issues sustained, steady load for a bounded window and looks
// for the actual soak signal -- latency/error-rate drift between the start and end of
// the window -- which is real endurance testing, just time-boxed to fit the engine.
// Raise SIT_SOAK_DURATION_MS (and SIT_SOAK_CONCURRENCY) for a deliberate, longer
// endurance run outside the normal CI/deploy-gate path; defaults are kept short so this
// doesn't meaningfully slow down a regular Test Engine pass.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiFetch } from "../lib/client.ts";

type Sample = { ok: boolean; ms: number };

async function sustainedLoad(fetchOne: () => Promise<Response>, durationMs: number, concurrency: number): Promise<Sample[]> {
  const samples: Sample[] = [];
  const stopAt = Date.now() + durationMs;
  async function worker() {
    while (Date.now() < stopAt) {
      const started = Date.now();
      try {
        const res = await fetchOne();
        await res.text().catch(() => {});
        samples.push({ ok: res.ok, ms: Date.now() - started });
      } catch {
        samples.push({ ok: false, ms: Date.now() - started });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return samples;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

function summarize(samples: Sample[]) {
  const latencies = samples.map((s) => s.ms);
  return {
    count: samples.length,
    errorRate: samples.length ? samples.filter((s) => !s.ok).length / samples.length : 1,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    max: latencies.length ? Math.max(...latencies) : 0,
  };
}

test("sustained load against /ready shows no meaningful error-rate or latency drift over the soak window", async () => {
  const samples = await sustainedLoad(
    () => fetch(`${ENV.apiBase}/ready`, { signal: AbortSignal.timeout(5000) }),
    ENV.soakDurationMs,
    ENV.soakConcurrency
  );
  assert.ok(samples.length > 10, `expected a meaningful sample size over ${ENV.soakDurationMs}ms, got ${samples.length}`);

  const cut = Math.max(1, Math.floor(samples.length / 4));
  const early = summarize(samples.slice(0, cut));
  const late = summarize(samples.slice(-cut));
  const overall = summarize(samples);

  console.log(`[soak] /ready over ${ENV.soakDurationMs}ms @ concurrency ${ENV.soakConcurrency}: ${overall.count} requests, ${(overall.errorRate * 100).toFixed(1)}% errors, p50=${overall.p50}ms p95=${overall.p95}ms max=${overall.max}ms`);
  console.log(`[soak] early window: ${early.count} reqs, p95=${early.p95}ms, errorRate=${(early.errorRate * 100).toFixed(1)}%`);
  console.log(`[soak] late window: ${late.count} reqs, p95=${late.p95}ms, errorRate=${(late.errorRate * 100).toFixed(1)}%`);

  assert.ok(overall.errorRate <= 0.05, `error rate too high across the soak window: ${(overall.errorRate * 100).toFixed(1)}%`);
  // Generous multiplier -- this runs against a shared/local dev stack, not an isolated
  // perf rig, so some variance is expected; the point is catching real, gross
  // degradation (a slow leak, a starved connection pool), not single-digit-percent noise.
  const lateP95Ceiling = Math.max(early.p95 * 3, early.p95 + 200);
  assert.ok(late.p95 <= lateP95Ceiling, `late-window p95 (${late.p95}ms) degraded too far past early-window p95 (${early.p95}ms)`);
});

test("main application stays reachable throughout the soak window with no sustained outage", async () => {
  const durationMs = Math.min(ENV.soakDurationMs, 10000);
  const samples = await sustainedLoad(
    () => fetch(`${ENV.apiBase}/health`, { signal: AbortSignal.timeout(5000) }),
    durationMs,
    Math.max(1, Math.floor(ENV.soakConcurrency / 2))
  );
  assert.ok(samples.length > 5, `expected multiple /health samples, got ${samples.length}`);
  const summary = summarize(samples);
  console.log(`[soak] /health reachability over ${durationMs}ms: ${summary.count} requests, ${(summary.errorRate * 100).toFixed(1)}% errors`);
  assert.ok(summary.errorRate <= 0.02, `main application had a sustained reachability problem during the soak window: ${(summary.errorRate * 100).toFixed(1)}% errors`);
});

test("sustained authenticated reads against /api/v1/message-types show no error-rate drift", async () => {
  const samples = await sustainedLoad(() => apiFetch("/api/v1/message-types"), ENV.soakDurationMs, ENV.soakConcurrency);
  assert.ok(samples.length > 10, `expected a meaningful sample size over ${ENV.soakDurationMs}ms, got ${samples.length}`);

  const cut = Math.max(1, Math.floor(samples.length / 4));
  const early = summarize(samples.slice(0, cut));
  const late = summarize(samples.slice(-cut));
  const overall = summarize(samples);

  console.log(`[soak] /api/v1/message-types over ${ENV.soakDurationMs}ms: ${overall.count} requests, ${(overall.errorRate * 100).toFixed(1)}% errors, p50=${overall.p50}ms p95=${overall.p95}ms`);
  assert.ok(overall.errorRate <= 0.05, `authenticated read error rate too high across the soak window: ${(overall.errorRate * 100).toFixed(1)}%`);
  assert.ok(late.errorRate <= early.errorRate + 0.1, `error rate rose meaningfully from the early window (${(early.errorRate * 100).toFixed(1)}%) to the late window (${(late.errorRate * 100).toFixed(1)}%)`);
});
