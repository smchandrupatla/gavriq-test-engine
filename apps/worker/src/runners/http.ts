/**
 * Lightweight HTTP/API runner for health, REST smoke, and contract-style checks.
 */
export interface HttpRunInput {
  baseUrl: string;
  script?: string;
  steps?: Array<{
    action: string;
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: unknown;
    expected_status?: number;
    expected_body_contains?: string;
  }>;
  timeoutSeconds?: number;
}

export interface HttpRunResult {
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration_ms: number;
  classification?: string;
  metrics?: Record<string, number>;
}

export async function runHttp(input: HttpRunInput): Promise<HttpRunResult> {
  const start = Date.now();
  const timeout = (input.timeoutSeconds || 15) * 1000;

  try {
    // Named scripts
    if (input.script === 'health' || input.script === 'smoke_health') {
      const url = `${input.baseUrl.replace(/\/$/, '')}/health`;
      const t0 = Date.now();
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      const latency = Date.now() - t0;
      const text = await res.text();
      if (!res.ok) {
        return {
          status: 'failed',
          message: `health returned ${res.status}: ${text.slice(0, 200)}`,
          duration_ms: Date.now() - start,
          classification: res.status >= 500 ? 'environment_problem' : 'assertion_failure',
          metrics: { latency_ms: latency, status_code: res.status },
        };
      }
      return {
        status: 'passed',
        message: `health OK (${res.status}) in ${latency}ms`,
        duration_ms: Date.now() - start,
        metrics: { latency_ms: latency, status_code: res.status },
      };
    }

    // Step chain
    if (input.steps?.length) {
      const results: string[] = [];
      for (const step of input.steps) {
        if (step.action !== 'request') throw new Error(`Unknown http action: ${step.action}`);
        const method = (step.method || 'GET').toUpperCase();
        const url = `${input.baseUrl.replace(/\/$/, '')}${step.path || '/'}`;
        const t0 = Date.now();
        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json', ...(step.headers || {}) },
          body: step.body !== undefined ? JSON.stringify(step.body) : undefined,
          signal: AbortSignal.timeout(timeout),
        });
        const latency = Date.now() - t0;
        const text = await res.text();
        const expected = step.expected_status ?? 200;
        if (res.status !== expected) {
          return {
            status: 'failed',
            message: `${method} ${step.path} expected ${expected} got ${res.status}`,
            duration_ms: Date.now() - start,
            classification: 'assertion_failure',
            metrics: { latency_ms: latency, status_code: res.status },
          };
        }
        if (step.expected_body_contains && !text.includes(step.expected_body_contains)) {
          return {
            status: 'failed',
            message: `Body missing expected fragment: ${step.expected_body_contains}`,
            duration_ms: Date.now() - start,
            classification: 'assertion_failure',
            metrics: { latency_ms: latency, status_code: res.status },
          };
        }
        results.push(`${method} ${step.path || '/'} → ${res.status} (${latency}ms)`);
      }
      return {
        status: 'passed',
        message: results.join('; '),
        duration_ms: Date.now() - start,
      };
    }

    // Default: GET baseUrl
    const res = await fetch(input.baseUrl, { signal: AbortSignal.timeout(timeout) });
    return {
      status: res.ok ? 'passed' : 'failed',
      message: `GET ${input.baseUrl} → ${res.status}`,
      duration_ms: Date.now() - start,
      metrics: { status_code: res.status },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let classification = 'unknown';
    if (/timeout|aborted/i.test(msg)) classification = 'timeout';
    else if (/ECONNREFUSED|fetch failed|network/i.test(msg)) classification = 'network_failure';
    return {
      status: 'failed',
      message: msg.slice(0, 500),
      duration_ms: Date.now() - start,
      classification,
    };
  }
}
