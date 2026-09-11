// Burst / concurrency-spike testing for the main application: fire many requests at
// once (rather than the sustained, steady load 91-performance-soak.sit.ts uses) and
// check the API absorbs a sudden spike without cascading failure, and recovers cleanly
// between repeated waves instead of degrading wave over wave (a proxy for connection
// pool exhaustion / backpressure problems that only show up under real concurrency).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiFetch } from "../lib/client.ts";

type BurstResult = { ok: boolean; ms: number };

async function fireBurst(fetchOne: () => Promise<Response>, size: number): Promise<BurstResult[]> {
  return Promise.all(
    Array.from({ length: size }, async () => {
      const started = Date.now();
      try {
        const res = await fetchOne();
        await res.text().catch(() => {});
        return { ok: res.ok, ms: Date.now() - started };
      } catch {
        return { ok: false, ms: Date.now() - started };
      }
    })
  );
}

function successRate(results: BurstResult[]): number {
  return results.length ? results.filter((r) => r.ok).length / results.length : 0;
}

test("a sudden burst of concurrent requests to /ready mostly succeeds without cascading failure", async () => {
  const started = Date.now();
  const results = await fireBurst(() => fetch(`${ENV.apiBase}/ready`, { signal: AbortSignal.timeout(8000) }), ENV.burstSize);
  const elapsedMs = Date.now() - started;
  const rate = successRate(results);
  console.log(`[burst] ${ENV.burstSize} concurrent /ready requests: ${(rate * 100).toFixed(1)}% succeeded in ${elapsedMs}ms`);
  assert.ok(rate >= 0.9, `burst success rate too low: ${(rate * 100).toFixed(1)}% of ${ENV.burstSize} concurrent requests succeeded`);
  assert.ok(elapsedMs <= 10000, `burst of ${ENV.burstSize} requests took too long to settle: ${elapsedMs}ms`);
});

test("repeated bursts against the API recover between waves instead of degrading wave over wave", async () => {
  const waveRates: number[] = [];
  for (let wave = 0; wave < ENV.burstWaves; wave += 1) {
    const results = await fireBurst(() => apiFetch("/api/v1/message-types"), ENV.burstSize);
    const rate = successRate(results);
    waveRates.push(rate);
    console.log(`[burst] wave ${wave + 1}/${ENV.burstWaves} against /api/v1/message-types: ${(rate * 100).toFixed(1)}% succeeded`);
    if (wave < ENV.burstWaves - 1) await new Promise((resolve) => setTimeout(resolve, ENV.burstWaveGapMs));
  }
  waveRates.forEach((rate, i) => {
    assert.ok(rate >= 0.85, `wave ${i + 1} success rate too low: ${(rate * 100).toFixed(1)}%`);
  });
  const first = waveRates[0] ?? 0;
  const last = waveRates[waveRates.length - 1] ?? 0;
  assert.ok(
    last >= first - 0.2,
    `later burst wave (${(last * 100).toFixed(1)}%) degraded significantly vs the first wave (${(first * 100).toFixed(1)}%) -- possible resource exhaustion under repeated bursts`
  );
});

test("a burst immediately following a prior burst does not compound failures", async () => {
  await fireBurst(() => fetch(`${ENV.apiBase}/health`, { signal: AbortSignal.timeout(5000) }), ENV.burstSize);
  const results = await fireBurst(() => fetch(`${ENV.apiBase}/health`, { signal: AbortSignal.timeout(5000) }), ENV.burstSize);
  const rate = successRate(results);
  console.log(`[burst] back-to-back /health burst (no gap): ${(rate * 100).toFixed(1)}% succeeded`);
  assert.ok(rate >= 0.9, `back-to-back burst success rate too low: ${(rate * 100).toFixed(1)}%`);
});
