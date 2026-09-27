/**
 * Lightweight performance runner (Prompt 5 foundation).
 * Concurrent HTTP load without requiring an external k6 binary.
 * Captures latency percentiles, throughput, error rate.
 */
export interface PerfRunInput {
  baseUrl: string;
  script?: string;
  path?: string;
  method?: string;
  concurrency?: number;
  requests?: number;
  timeoutSeconds?: number;
  headers?: Record<string, string>;
  body?: unknown;
  /** Optional SLA thresholds */
  sla?: {
    p95_ms?: number;
    error_rate_pct?: number;
    min_rps?: number;
  };
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
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] ?? 0;
}

export async function runPerformance(input: PerfRunInput): Promise<PerfRunResult> {
  const start = Date.now();
  const concurrency = Math.max(1, Math.min(input.concurrency || 5, 50));
  const total = Math.max(1, Math.min(input.requests || 20, 500));
  const path = input.path || (input.script === 'health' ? '/health' : '/');
  const method = (input.method || 'GET').toUpperCase();
  const url = `${input.baseUrl.replace(/\/$/, '')}${path}`;
  const timeout = (input.timeoutSeconds || 10) * 1000;

  const latencies: number[] = [];
  let success = 0;
  let failed = 0;

  let next = 0;
  async function worker() {
    while (next < total) {
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
        const ms = Date.now() - t0;
        latencies.push(ms);
        if (res.ok) success++;
        else failed++;
      } catch {
        latencies.push(Date.now() - t0);
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const duration = Date.now() - start;
  const sorted = [...latencies].sort((a, b) => a - b);
  const metrics = {
    total_requests: total,
    success,
    failed,
    error_rate_pct: total ? Math.round((failed / total) * 1000) / 10 : 0,
    rps: duration > 0 ? Math.round((total / duration) * 1000 * 10) / 10 : 0,
    latency_min_ms: sorted[0] || 0,
    latency_max_ms: sorted[sorted.length - 1] || 0,
    latency_avg_ms: sorted.length
      ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
      : 0,
    latency_p50_ms: percentile(sorted, 50),
    latency_p95_ms: percentile(sorted, 95),
    latency_p99_ms: percentile(sorted, 99),
  };

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
    };
  }

  return {
    status: failed === total ? 'failed' : 'passed',
    message: `perf ${method} ${path}: ${success}/${total} ok, p95=${metrics.latency_p95_ms}ms, rps=${metrics.rps}`,
    duration_ms: duration,
    classification: failed === total ? 'environment_problem' : undefined,
    metrics,
  };
}
