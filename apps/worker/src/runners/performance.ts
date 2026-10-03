/**
 * Lightweight performance runner (Prompt 5 foundation).
 * Concurrent HTTP load without requiring an external k6 binary.
 * Captures latency percentiles, throughput, error rate, and a per-window time series
 * so the console can graph each run.
 */
export interface PerfRunInput {
  baseUrl: string;
  script?: string;
  path?: string;
  method?: string;
  concurrency?: number;
  requests?: number;
  timeoutSeconds?: number;
  /** Endurance mode: keep issuing requests until this many seconds pass (capped at 1800). */
  durationSeconds?: number;
  headers?: Record<string, string>;
  body?: unknown;
  /** Optional SLA thresholds */
  sla?: {
    p95_ms?: number;
    error_rate_pct?: number;
    min_rps?: number;
  };
}

export interface Sample {
  t_ms: number;
  latency_ms: number;
  ok: boolean;
  status: number;
}

export interface TimeBucket {
  t_s: number;
  requests: number;
  errors: number;
  latency_avg_ms: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_max_ms: number;
}

export interface PerfRunResult {
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration_ms: number;
  classification?: string;
  metrics: {
    total_requests: number;
    success: number;
    failed: number;
    error_rate_pct: number;
    rps: number;
    latency_min_ms: number;
    latency_max_ms: number;
    latency_avg_ms: number;
    latency_p50_ms: number;
    latency_p95_ms: number;
    latency_p99_ms: number;
  };
  /** One point per window of the run, for latency and throughput graphs. */
  timeseries: TimeBucket[];
  /** Every request, for the raw-samples evidence file. */
  samples: Sample[];
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] ?? 0;
}

/** Group samples into fixed windows (default 1s) keyed by when each request started. */
export function bucketize(samples: Sample[], bucketMs = 1000): TimeBucket[] {
  if (!samples.length) return [];
  const byBucket = new Map<number, Sample[]>();
  for (const s of samples) {
    const b = Math.floor(s.t_ms / bucketMs);
    const list = byBucket.get(b);
    if (list) list.push(s);
    else byBucket.set(b, [s]);
  }
  const last = Math.max(...byBucket.keys());
  const out: TimeBucket[] = [];
  for (let b = 0; b <= last; b++) {
    const list = byBucket.get(b) || [];
    const lat = list.map((s) => s.latency_ms).sort((x, y) => x - y);
    out.push({
      t_s: (b * bucketMs) / 1000,
      requests: list.length,
      errors: list.filter((s) => !s.ok).length,
      latency_avg_ms: lat.length ? Math.round(lat.reduce((a, v) => a + v, 0) / lat.length) : 0,
      latency_p50_ms: percentile(lat, 50),
      latency_p95_ms: percentile(lat, 95),
      latency_max_ms: lat[lat.length - 1] || 0,
    });
  }
  return out;
}

export async function runPerformance(input: PerfRunInput): Promise<PerfRunResult> {
  const start = Date.now();
  const concurrency = Math.max(1, Math.min(input.concurrency || 5, 50));
  const durationMs = Math.min(Math.max(0, input.durationSeconds || 0), 1800) * 1000;
  // A duration-bound (endurance) run is limited by time, not by a request count.
  const total = durationMs ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(input.requests || 20, 500));
  const path = input.path || (input.script === 'health' ? '/health' : '/');
  const method = (input.method || 'GET').toUpperCase();
  const url = `${input.baseUrl.replace(/\/$/, '')}${path}`;
  const timeout = (input.timeoutSeconds || 10) * 1000;

  const latencies: number[] = [];
  const samples: Sample[] = [];
  let success = 0;
  let failed = 0;

  let next = 0;
  async function worker() {
    while (next < total) {
      if (durationMs && Date.now() - start >= durationMs) return;
      const i = next++;
      if (i >= total) return;
      const t0 = Date.now();
      try {
        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json', ...(input.headers || {}) },
          body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
          signal: AbortSignal.timeout(timeout),
        });
        await res.arrayBuffer().catch(() => undefined);
        const ms = Date.now() - t0;
        latencies.push(ms);
        samples.push({ t_ms: t0 - start, latency_ms: ms, ok: res.ok, status: res.status });
        if (res.ok) success++;
        else failed++;
      } catch {
        const ms = Date.now() - t0;
        latencies.push(ms);
        samples.push({ t_ms: t0 - start, latency_ms: ms, ok: false, status: 0 });
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const duration = Date.now() - start;
  const sent = samples.length;
  const sorted = [...latencies].sort((a, b) => a - b);
  const metrics = {
    total_requests: sent,
    success,
    failed,
    error_rate_pct: sent ? Math.round((failed / sent) * 1000) / 10 : 0,
    rps: duration > 0 ? Math.round((sent / duration) * 1000 * 10) / 10 : 0,
    latency_min_ms: sorted[0] || 0,
    latency_max_ms: sorted[sorted.length - 1] || 0,
    latency_avg_ms: sorted.length
      ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
      : 0,
    latency_p50_ms: percentile(sorted, 50),
    latency_p95_ms: percentile(sorted, 95),
    latency_p99_ms: percentile(sorted, 99),
  };
  const timeseries = bucketize(samples, durationMs > 120_000 ? 5000 : 1000);

  const sla = input.sla || {};
  const violations: string[] = [];
  if (sla.p95_ms != null && metrics.latency_p95_ms > sla.p95_ms) {
    violations.push(`p95 ${metrics.latency_p95_ms}ms > ${sla.p95_ms}ms`);
  }
  if (sla.error_rate_pct != null && metrics.error_rate_pct > sla.error_rate_pct) {
    violations.push(`error_rate ${metrics.error_rate_pct}% > ${sla.error_rate_pct}%`);
  }
  if (sla.min_rps != null && metrics.rps < sla.min_rps) {
    violations.push(`rps ${metrics.rps} < ${sla.min_rps}`);
  }

  if (violations.length) {
    return {
      status: 'failed',
      message: `SLA violated: ${violations.join('; ')} | p95=${metrics.latency_p95_ms}ms err=${metrics.error_rate_pct}% rps=${metrics.rps}`,
      duration_ms: duration,
      classification: 'assertion_failure',
      metrics,
      timeseries,
      samples,
    };
  }

  return {
    status: failed === sent ? 'failed' : 'passed',
    message: `perf ${method} ${path}: ${success}/${sent} ok, p95=${metrics.latency_p95_ms}ms, rps=${metrics.rps}`,
    duration_ms: duration,
    classification: failed === sent ? 'environment_problem' : undefined,
    metrics,
    timeseries,
    samples,
  };
}
