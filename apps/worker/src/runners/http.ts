/**
 * HTTP/API runner for health, REST smoke, contract and round-trip checks.
 *
 * Steps run in order and share a variable scope:
 *   - `url` may be absolute or templated ("{{api}}/api/v1/runs"); `path` stays
 *     relative to the execution's base URL. Variables come from the environment's
 *     config.vars (injected by the worker) plus anything captured with `save`.
 *   - `save` captures values out of a JSON response body by dot-path
 *     ({"token": "token"} → vars.token = body.token) for later steps
 *     (e.g. headers: {authorization: "Bearer {{token}}"}).
 *   - `expect_json` asserts on the body by dot-path (equals / contains / exists /
 *     matches, min and max for numbers, min_length and max_length for arrays
 *     and strings).
 *   - `poll` re-issues the same request until every expectation passes or the
 *     poll window closes — the async round-trip primitive (message sent via one
 *     system, its effect observed through another).
 *   - `allow_failure` marks a step whose expectations may fail without failing
 *     the case (used to probe optional surfaces).
 *   - `precondition` marks a step that establishes whether the target can host
 *     the case at all (fixtures seeded, nothing else draining the queue). When
 *     its expectations fail the case is reported skipped, not failed. A target
 *     that does not answer is still a failure.
 *
 * Every run leaves an `http_transcript` evidence file: each request as sent and
 * the response as received (secrets masked, bodies capped), pass or fail.
 */
import { redact, redactBody, redactText, secretValues, writeJsonEvidence, type EvidenceItem } from '../evidence.js';

export interface HttpStep {
  action: string; // 'request'
  method?: string;
  url?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
  /** Raw request body sent verbatim (for malformed-payload tests); wins over `body`. */
  body_raw?: string;
  expected_status?: number | number[];
  expected_body_contains?: string;
  expected_body_not_contains?: string;
  expect_json?: Array<{
    path: string;
    equals?: unknown;
    contains?: string;
    exists?: boolean;
    min_length?: number;
    /** Upper bound on an array's or string's length (inclusive). */
    max_length?: number;
    /** Numeric lower bound (inclusive). */
    min?: number;
    /** Numeric upper bound (inclusive). */
    max?: number;
    /** Regular expression the value (as a string) must match. */
    matches?: string;
  }>;
  expect_headers?: Array<{
    name: string;
    exists?: boolean;
    contains?: string;
    not_contains?: string;
  }>;
  save?: Record<string, string>;
  poll?: { timeout_ms?: number; interval_ms?: number };
  allow_failure?: boolean;
  precondition?: boolean;
  description?: string;
}

export interface HttpRunInput {
  baseUrl: string;
  script?: string;
  steps?: HttpStep[];
  timeoutSeconds?: number;
  vars?: Record<string, string>;
  /** Aborts the in-flight request and stops before the next step (e.g. the engine's per-test-type timeout, or a run cancel). */
  signal?: AbortSignal;
}

export interface HttpRunResult {
  status: 'passed' | 'failed' | 'error' | 'skipped';
  message: string;
  duration_ms: number;
  classification?: string;
  metrics?: Record<string, number>;
  evidence?: EvidenceItem[];
}

interface Exchange {
  step: number;
  description?: string;
  request: { method: string; url: string; headers?: Record<string, string>; body?: string };
  response?: { status: number; headers: Record<string, string>; body: string; latency_ms: number };
  attempts?: number;
  outcome?: 'passed' | 'failed' | 'tolerated' | 'precondition_not_met';
  failure?: string;
  error?: string;
}

/** What was put on the wire during a run; `current` is the request still awaiting its response. */
interface Trace {
  exchanges: Exchange[];
  current?: Exchange;
  vars: Record<string, string>;
}

function getPath(obj: unknown, dotPath: string): unknown {
  let cur: any = obj;
  for (const part of dotPath.split('.')) {
    if (cur == null) return undefined;
    // numeric segment doubles as array index
    cur = cur[/^\d+$/.test(part) ? Number(part) : part];
  }
  return cur;
}

function substitute(value: string, vars: Record<string, string>): string {
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => {
    const v = vars[name];
    return v === undefined ? `{{${name}}}` : String(v);
  });
}

function substituteDeep(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === 'string') return substitute(value, vars);
  if (Array.isArray(value)) return value.map((v) => substituteDeep(v, vars));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = substituteDeep(v, vars);
    return out;
  }
  return value;
}

function checkExpectations(
  step: HttpStep,
  status: number,
  text: string,
  json: unknown,
  headers: Headers,
  vars: Record<string, string>
): string | null {
  const expected = step.expected_status ?? 200;
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(status)) {
    return `expected status ${allowed.join('/')} got ${status}: ${text.slice(0, 160)}`;
  }
  if (step.expected_body_contains) {
    const needle = substitute(step.expected_body_contains, vars);
    if (!text.includes(needle)) return `body missing expected fragment "${needle}"`;
  }
  if (step.expected_body_not_contains) {
    const needle = substitute(step.expected_body_not_contains, vars);
    if (text.includes(needle)) return `body unexpectedly contains "${needle}"`;
  }
  for (const ex of step.expect_json || []) {
    const actual = getPath(json, ex.path);
    if (ex.exists !== undefined) {
      const exists = actual !== undefined && actual !== null;
      if (exists !== ex.exists) return `expect_json ${ex.path}: exists=${exists}, wanted ${ex.exists}`;
    }
    if (ex.equals !== undefined) {
      const want = typeof ex.equals === 'string' ? substitute(ex.equals, vars) : ex.equals;
      // A captured variable is always text; compared with a number or boolean it means that value's text.
      const templated = typeof ex.equals === 'string' && ex.equals.includes('{{');
      const same = templated && (typeof actual === 'number' || typeof actual === 'boolean') ? String(actual) === want : actual === want;
      if (!same) {
        return `expect_json ${ex.path}: got ${JSON.stringify(actual)}, wanted ${JSON.stringify(want)}`;
      }
    }
    if (ex.contains !== undefined) {
      const needle = substitute(ex.contains, vars);
      const found = Array.isArray(actual)
        ? actual.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).some((v) => v.includes(needle))
        : String(actual ?? '').includes(needle);
      if (!found) return `expect_json ${ex.path}: ${JSON.stringify(actual)?.slice(0, 160)} does not contain "${needle}"`;
    }
    if (ex.min_length !== undefined) {
      const len = Array.isArray(actual) ? actual.length : typeof actual === 'string' ? actual.length : -1;
      if (len < ex.min_length) return `expect_json ${ex.path}: length ${len} < ${ex.min_length}`;
    }
    if (ex.max_length !== undefined) {
      const len = Array.isArray(actual) ? actual.length : typeof actual === 'string' ? actual.length : -1;
      if (len < 0 || len > ex.max_length) return `expect_json ${ex.path}: length ${len} > ${ex.max_length}`;
    }
    if (ex.min !== undefined) {
      const num = Number(actual);
      if (!Number.isFinite(num) || num < ex.min) return `expect_json ${ex.path}: ${JSON.stringify(actual)} < ${ex.min}`;
    }
    if (ex.max !== undefined) {
      const num = Number(actual);
      if (actual === null || actual === undefined || !Number.isFinite(num) || num > ex.max) return `expect_json ${ex.path}: ${JSON.stringify(actual)} > ${ex.max}`;
    }
    if (ex.matches !== undefined) {
      const text = typeof actual === 'string' ? actual : actual === undefined ? '' : JSON.stringify(actual);
      if (!new RegExp(substitute(ex.matches, vars)).test(text)) return `expect_json ${ex.path}: ${JSON.stringify(actual)?.slice(0, 160)} does not match /${ex.matches}/`;
    }
  }
  for (const eh of step.expect_headers || []) {
    const value = headers.get(eh.name);
    if (eh.exists !== undefined) {
      const exists = value !== null && value !== '';
      if (exists !== eh.exists) return `header ${eh.name}: exists=${exists}, wanted ${eh.exists}`;
    }
    if (eh.contains !== undefined && !(value || '').toLowerCase().includes(eh.contains.toLowerCase())) {
      return `header ${eh.name}: "${value}" does not contain "${eh.contains}"`;
    }
    if (eh.not_contains !== undefined && (value || '').toLowerCase().includes(eh.not_contains.toLowerCase())) {
      return `header ${eh.name}: "${value}" contains forbidden "${eh.not_contains}"`;
    }
  }
  return null;
}

export async function runHttp(input: HttpRunInput): Promise<HttpRunResult> {
  const trace: Trace = { exchanges: [], vars: {} };
  const result = await execute(input, trace);
  // A request that never got its response (refused, timed out) is evidence too.
  if (trace.current) trace.exchanges.push({ ...trace.current, outcome: 'failed', error: result.message });

  const secrets = secretValues(trace.vars);
  const item = writeJsonEvidence('http_transcript', 'http', {
    captured_at: new Date().toISOString(),
    base_url: input.baseUrl,
    status: result.status,
    message: redactText(result.message, secrets),
    duration_ms: result.duration_ms,
    exchanges: trace.exchanges.map((e) => ({
      ...e,
      request: {
        method: e.request.method,
        url: redactText(e.request.url, secrets),
        headers: redact(e.request.headers, secrets),
        body: redactBody(e.request.body, secrets),
      },
      response: e.response && {
        ...e.response,
        headers: redact(e.response.headers, secrets),
        body: redactBody(e.response.body, secrets),
      },
    })),
  });
  return { ...result, evidence: item ? [item] : [] };
}

async function execute(input: HttpRunInput, trace: Trace): Promise<HttpRunResult> {
  const start = Date.now();
  const timeout = (input.timeoutSeconds || 15) * 1000;
  const base = input.baseUrl.replace(/\/$/, '');
  const vars: Record<string, string> = {
    base,
    // Per-run uniqueness for correlation ids: "TE-{{ts}}-{{rand}}" never collides
    // across runs, so poll-until steps can find exactly the record this run created.
    ts: String(Date.now()),
    rand: Math.random().toString(16).slice(2, 8),
    ...(input.vars || {}),
  };
  trace.vars = vars;

  /** One traced round trip: the request is on record before the response (or the failure) arrives. */
  const exchange = async (
    step: number,
    description: string | undefined,
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: string
  ) => {
    trace.current = { step, description, request: { method, url, headers, body } };
    const t0 = Date.now();
    const signal = input.signal ? AbortSignal.any([AbortSignal.timeout(timeout), input.signal]) : AbortSignal.timeout(timeout);
    const res = await fetch(url, { method, headers, body, signal });
    const latency = Date.now() - t0;
    const text = await res.text();
    const recorded: Exchange = {
      ...trace.current,
      response: { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: text, latency_ms: latency },
    };
    trace.current = undefined;
    return { res, text, latency, recorded };
  };

  try {
    // Named scripts (legacy)
    if (input.script === 'health' || input.script === 'smoke_health') {
      const url = `${vars.base}/health`;
      const { res, text, latency, recorded } = await exchange(1, 'health', 'GET', url);
      trace.exchanges.push({ ...recorded, attempts: 1, outcome: res.ok ? 'passed' : 'failed' });
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

    if (input.steps?.length) {
      const results: string[] = [];
      let lastLatency = 0;
      let lastStatus = 0;

      for (const [idx, step] of input.steps.entries()) {
        if (input.signal?.aborted) throw new Error('aborted: run timed out or was cancelled');
        if (step.action !== 'request') throw new Error(`Unknown http action: ${step.action}`);
        const method = (step.method || 'GET').toUpperCase();

        const doRequest = async () => {
          const rawUrl = step.url
            ? substitute(step.url, vars)
            : `${vars.base}${substitute(step.path || '/', vars)}`;
          const body =
            step.body_raw !== undefined
              ? step.body_raw
              : step.body !== undefined
                ? JSON.stringify(substituteDeep(step.body, vars))
                : undefined;
          const headers: Record<string, string> = { 'content-type': 'application/json' };
          for (const [k, v] of Object.entries(step.headers || {})) headers[k.toLowerCase()] = substitute(v, vars);
          const { res, text, latency, recorded } = await exchange(idx + 1, step.description, method, rawUrl, headers, body);
          lastLatency = latency;
          lastStatus = res.status;
          let json: unknown = undefined;
          try { json = JSON.parse(text); } catch { /* non-JSON body */ }
          return { rawUrl, res, text, json, recorded };
        };

        let attempts = 1;
        let outcome = await doRequest();
        let failure = checkExpectations(step, outcome.res.status, outcome.text, outcome.json, outcome.res.headers, vars);

        if (failure && step.poll) {
          const deadline = Date.now() + (step.poll.timeout_ms ?? 8000);
          const interval = step.poll.interval_ms ?? 500;
          while (failure && Date.now() < deadline && !input.signal?.aborted) {
            await new Promise((r) => setTimeout(r, interval));
            attempts++;
            outcome = await doRequest();
            failure = checkExpectations(step, outcome.res.status, outcome.text, outcome.json, outcome.res.headers, vars);
          }
        }

        trace.exchanges.push({
          ...outcome.recorded,
          attempts,
          outcome: !failure ? 'passed' : step.allow_failure ? 'tolerated' : step.precondition ? 'precondition_not_met' : 'failed',
          failure: failure || undefined,
        });

        if (failure) {
          if (step.allow_failure) {
            results.push(`step ${idx + 1} (${step.description || method}) tolerated: ${failure}`);
            continue;
          }
          if (step.precondition) {
            return {
              status: 'skipped',
              message: `Precondition not met — step ${idx + 1}${step.description ? ` (${step.description})` : ''}: ${failure}`,
              duration_ms: Date.now() - start,
              metrics: { latency_ms: lastLatency, status_code: lastStatus, skipped_at_step: idx + 1 },
            };
          }
          return {
            status: 'failed',
            message: `step ${idx + 1}${step.description ? ` (${step.description})` : ''}: ${failure}`,
            duration_ms: Date.now() - start,
            classification: /status 401|status 403/.test(failure) ? 'authentication_problem' : 'assertion_failure',
            metrics: { latency_ms: lastLatency, status_code: lastStatus, failed_step: idx + 1 },
          };
        }

        for (const [name, jsonPath] of Object.entries(step.save || {})) {
          const captured = getPath(outcome.json, jsonPath);
          if (captured !== undefined) vars[name] = String(captured);
        }

        results.push(`${method} ${step.description || outcome.rawUrl.replace(/^https?:\/\/[^/]+/, '')} → ${outcome.res.status} (${lastLatency}ms)`);
      }

      return {
        status: 'passed',
        message: results.join('; ').slice(0, 900),
        duration_ms: Date.now() - start,
        metrics: { latency_ms: lastLatency, status_code: lastStatus, steps: input.steps.length },
      };
    }

    // Default: GET baseUrl
    const { res, recorded } = await exchange(1, 'default GET', 'GET', base);
    trace.exchanges.push({ ...recorded, attempts: 1, outcome: res.ok ? 'passed' : 'failed' });
    return {
      status: res.ok ? 'passed' : 'failed',
      message: `GET ${base} → ${res.status}`,
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
