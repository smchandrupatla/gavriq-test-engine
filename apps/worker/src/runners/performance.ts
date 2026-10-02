/**
 * Lightweight performance runner (Prompt 5 foundation).
 * Concurrent HTTP load without requiring an external k6 binary.
 * Captures latency percentiles, throughput, error rate.
 */
export interface PerfRunInput {
  baseUrl: string;
  script?: string;
  /** Absolute or {{var}}-templated target; overrides baseUrl + path when set. */
  url?: string;
  vars?: Record<string, string>;
  path?: string;
  method?: string;
  concurrency?: number;
  requests?: number;
  /**
   * Soak mode: keep issuing requests for this long instead of stopping at a
   * fixed request count (endurance cases). Capped at 15 minutes.
   */
  durationSeconds?: number;
  timeoutSeconds?: number;
  headers?: Record<string, string>;
  body?: unknown;
  /** Optional SLA thresholds */
  sla?: {
    p95_ms?: number;
    error_rate_pct?: number;
    min_rps?: number;
  };
  /** Stops issuing new requests once aborted (e.g. the engine's per-test-type timeout, or a run cancel). */
  signal?: AbortSignal;
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
  const soakMs = input.durationSeconds ? Math.min(input.durationSeconds, 900) * 1000 : 0;
  const deadline = soakMs ? start + soakMs : 0;
  const limit = soakMs ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(input.requests || 20, 500));
  const path = input.path || (input.script === 'health' ? '/health' : '/');
  const method = (input.method || 'GET').toUpperCase();
  const vars: Record<string, string> = { base: input.baseUrl.replace(/\/$/, ''), ...(input.vars || {}) };
  const url = input.url
    ? input.url.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`)
    : `${vars.base}${path}`;
  const timeout = (input.timeoutSeconds || 10) * 1000;

  const latencies: number[] = [];
  let success = 0;
  let failed = 0;
  // First failure seen, so a fully failing run says why (unreachable target,
  // 401, ...) instead of only reporting an error rate.
  let firstError = '';

  let next = 0;
  async function worker() {
    while (next < limit && (!deadline || Date.now() < deadline) && !input.signal?.aborted) {
      next++;
      const t0 = Date.now();
      try {
        const signal = input.signal ? AbortSignal.any([AbortSignal.timeout(timeout), input.signal]) : AbortSignal.timeout(timeout);
        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json', ...(input.headers || {}) },
          body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
          signal,
        });
        // Drain the body so the connection returns to the pool.
        await res.arrayBuffer().catch(() => undefined);
        const ms = Date.now() - t0;
        latencies.push(ms);
        if (res.ok) success++;
        else {
          failed++;
          firstError ||= `HTTP ${res.status}`;
        }
      } catch (err) {
        latencies.push(Date.now() - t0);
        failed++;
        const e = err as Error & { cause?: { code?: string; message?: string } };
        firstError ||= [e.message, e.cause?.code || e.cause?.message].filter(Boolean).join(': ');
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const total = success + failed;
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

  // Nothing answered at all: the target is unreachable or rejects the probe.
  // That is an environment verdict, not a latency/SLA measurement.
  if (total > 0 && failed === total) {
    const unreachable = !/^HTTP \d+/.test(firstError);
    return {
      status: 'failed',
      message: `perf ${method} ${url}: 0/${total} requests succeeded (${firstError || 'no response'})`,
      duration_ms: duration,
      classification: unreachable ? 'network_failure' : 'environment_problem',
      metrics,
    };
  }

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
    status: 'passed',
    message: `perf ${method} ${input.url ? url : path}: ${success}/${total} ok${soakMs ? ` over ${Math.round(duration / 1000)}s` : ''}, p95=${metrics.latency_p95_ms}ms, rps=${metrics.rps}`,
    duration_ms: duration,
    metrics,
  };
}
