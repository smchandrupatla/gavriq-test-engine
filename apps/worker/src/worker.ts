#!/usr/bin/env tsx
/**
 * GAVRIQ Test Engine — Execution Worker
 * Dispatches to Selenium, Playwright, HTTP, Performance, or SIT file runners.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { runSelenium } from './runners/selenium.js';
import { runPlaywright } from './runners/playwright.js';
import { runHttp } from './runners/http.js';
import { runPerformance } from './runners/performance.js';
import { runSit, isSitScript } from './runners/sit.js';
import { runE2E } from './runners/e2e.js';
import { ensureEvidence, evidencePreflight, publishEvidence, secretValues } from './evidence.js';

const API = process.env.TEST_ENGINE_API || 'http://127.0.0.1:8787';
const WORKER_ID = process.env.WORKER_ID || `worker-${randomUUID().slice(0, 8)}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS || 4000);
const DEFAULT_BASE_URL = process.env.TARGET_BASE_URL || 'http://127.0.0.1:8001';
const WORKER_API_KEY = process.env.WORKER_API_KEY || '';
/** How often a running job asks whether it has been cancelled. */
const CANCEL_POLL_MS = Number(process.env.WORKER_CANCEL_POLL_MS || 5000);

/**
 * Inside a container "127.0.0.1"/"localhost" is the worker itself, not the
 * machine the deployment under test is published on. Environments written for
 * a host worker (local-dev, sand-bench-local, engine-local) would therefore
 * fail every case with "fetch failed" when a containerized worker claims the
 * job. Such targets are re-pointed at the host gateway so any environment
 * selected in the console runs on whichever worker is online.
 * WORKER_LOOPBACK_HOST overrides the gateway name; set it to "off" to disable.
 */
const IN_CONTAINER = process.env.WORKER_IN_CONTAINER
  ? process.env.WORKER_IN_CONTAINER === 'true'
  : existsSync('/.dockerenv');
const LOOPBACK_HOST = process.env.WORKER_LOOPBACK_HOST || (IN_CONTAINER ? 'host.docker.internal' : '');

function reachable(value: string): string {
  if (!LOOPBACK_HOST || LOOPBACK_HOST === 'off') return value;
  return value.replace(/(\bhttps?:\/\/)(?:127\.0\.0\.1|localhost|\[::1\])(?=[:/]|$)/gi, `$1${LOOPBACK_HOST}`);
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (WORKER_API_KEY) h['x-worker-key'] = WORKER_API_KEY;
  return h;
}

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...headers(), ...(opts.headers || {}) },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body === 'object' ? JSON.stringify(body) : String(body));
  return body;
}

async function register() {
  await api('/api/v1/workers/register', {
    method: 'POST',
    body: JSON.stringify({
      id: WORKER_ID,
      name: `Multi-runner Worker ${WORKER_ID}`,
      capabilities: [
        'selenium', 'playwright', 'http', 'rest', 'api', 'performance', 'load', 'sit', 'e2e',
        'out_of_container', 'in_container', 'ui', 'smoke',
      ],
      labels: { kind: 'multi', runtime: 'node' },
      max_concurrency: 3,
    }),
  });
  console.log(`[worker ${WORKER_ID}] registered at ${API}`);
}

async function heartbeat() {
  try {
    await api(`/api/v1/workers/${WORKER_ID}/heartbeat`, { method: 'POST', body: '{}' });
  } catch (err) {
    console.warn('[heartbeat]', (err as Error).message);
  }
}

async function fetchTestCase(id: string) {
  try {
    const res = await api(`/api/v1/test-cases/${id}`);
    return res?.data || null;
  } catch {
    return null;
  }
}

async function fetchEnvironment(id: string | null | undefined) {
  if (!id) return null;
  try {
    const res = await api(`/api/v1/environments/${id}`);
    return res?.data || null;
  } catch {
    return null;
  }
}

type EngineSettings = {
  test_type_timeout_minutes?: Record<string, number>;
  consecutive_failure_limit?: number;
};
const DEFAULT_CASE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FAILURE_LIMIT = 20;

async function fetchSettings(): Promise<EngineSettings> {
  try {
    const res = await api('/api/v1/settings');
    return res?.data || {};
  } catch (err) {
    console.warn('[worker] could not load settings, using defaults (24h timeout, 20 consecutive failures):', (err as Error).message);
    return {};
  }
}

/** The configured per-test-type timeout, in ms — 24h for any type without an override. */
function caseTimeoutMs(settings: EngineSettings, testType: string | undefined): number {
  const minutes = settings.test_type_timeout_minutes?.[String(testType || 'other')];
  return Number.isFinite(minutes) && (minutes as number) > 0 ? (minutes as number) * 60_000 : DEFAULT_CASE_TIMEOUT_MS;
}

function failureLimitOf(settings: EngineSettings): number {
  const n = settings.consecutive_failure_limit;
  return Number.isInteger(n) && (n as number) > 0 ? (n as number) : DEFAULT_FAILURE_LIMIT;
}

type RunnerResult = {
  status: string;
  verdict?: string;
  duration_ms: number;
  message: string;
  classification?: string | null;
  metrics?: Record<string, unknown>;
  evidence?: any[];
  /** Raw runner output (SIT TAP), turned into log evidence when the runner wrote no file of its own. */
  output?: string;
  /** What happened, in plain words — one line per step, then the outcome; stored on the result as its remarks. */
  remarks?: string[];
};

/**
 * Variables shared with runners: environment config.vars verbatim, plus any
 * config.secret_env entries resolved from this worker's process environment
 * (the DB stores which env var holds a secret, never the secret itself).
 */
function buildVars(env: any): Record<string, string> {
  const vars: Record<string, string> = {};
  const cfg = env?.config || {};
  for (const [k, v] of Object.entries(cfg.vars || {})) vars[k] = reachable(String(v));
  for (const [k, envName] of Object.entries(cfg.secret_env || {})) {
    const resolved = process.env[String(envName)];
    if (resolved !== undefined) vars[k] = resolved;
  }
  return vars;
}

async function executeCase(tc: any, baseUrl: string, env: any, headlessOverride?: boolean, signal?: AbortSignal): Promise<RunnerResult> {
  const method = (tc?.execution_method || 'selenium').toLowerCase();
  const script = tc?.script || '';
  const rules = tc?.validation_rules || {};
  const vars = buildVars(env);
  const viewport =
    rules.viewport && Number(rules.viewport.width) > 0
      ? { width: Number(rules.viewport.width), height: Number(rules.viewport.height) || 800 }
      : undefined;
  // Priority: an explicit per-run request (execution.metadata.headless) beats
  // the case's own validation_rules.headless, which beats each runner's default.
  const headless =
    typeof headlessOverride === 'boolean' ? headlessOverride : typeof rules.headless === 'boolean' ? rules.headless : undefined;

  const cleanupSteps = Array.isArray(rules.cleanup_steps) ? rules.cleanup_steps : [];
  const withCleanup = async (result: RunnerResult): Promise<RunnerResult> => {
    if (!cleanupSteps.length) return result;
    const cleanup = await runHttp({
      baseUrl,
      vars,
      cleanupSteps,
      cleanupTimeoutSeconds: Number(rules.cleanup_timeout_seconds) > 0 ? Number(rules.cleanup_timeout_seconds) : 30,
    });
    if (cleanup.status === 'passed') return { ...result, evidence: [...(result.evidence || []), ...(cleanup.evidence || [])] };
    const status = result.status === 'passed' || result.status === 'skipped' ? 'failed' : result.status;
    return {
      ...result,
      status,
      verdict: status === 'skipped' ? undefined : 'fail',
      classification: cleanup.classification || 'cleanup_failure',
      message: `${result.message}; cleanup failed: ${cleanup.message}`.slice(0, 900),
      remarks: [...(result.remarks || [result.message]), `Cleanup failed: ${cleanup.message}.`],
      evidence: [...(result.evidence || []), ...(cleanup.evidence || [])],
    };
  };

  // Imported SIT catalog entries
  if (isSitScript(script) || method === 'sit') {
    const r = await runSit({
      script,
      baseUrl,
      vars,
      timeoutSeconds: tc?.timeout_seconds || 120,
      signal,
    });
    return withCleanup({
      status: r.status === 'skipped' ? 'skipped' : r.status,
      verdict: r.status === 'passed' ? 'pass' : r.status === 'skipped' ? undefined : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      remarks: r.remarks,
      classification: r.classification || null,
      metrics: r.metrics || {},
      evidence: [],
      output: r.output,
    });
  }

  const common = {
    script: script || undefined,
    baseUrl,
    timeoutSeconds: tc?.timeout_seconds || 30,
    steps: Array.isArray(tc?.steps) && tc.steps.length ? tc.steps : undefined,
    vars,
  };

  if (method === 'playwright') {
    const r = await runPlaywright({
      ...common,
      browser: rules.browser || 'chromium',
      viewport,
      headless,
      signal,
    });
    return withCleanup({
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      remarks: r.remarks,
      classification: r.classification || null,
      metrics: r.metrics || {},
      evidence: r.evidence || [],
    });
  }

  if (method === 'e2e') {
    const r = await runE2E({
      baseUrl,
      steps: Array.isArray(tc?.steps) && tc.steps.length ? tc.steps : undefined,
      vars,
      timeoutSeconds: tc?.timeout_seconds || 180,
      signal,
    });
    return withCleanup({
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : r.status === 'skipped' ? undefined : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      remarks: r.remarks,
      classification: r.classification || null,
      metrics: r.metrics || {},
      evidence: r.evidence || [],
    });
  }

  if (method === 'http' || method === 'rest' || method === 'api') {
    const r = await runHttp({
      ...common,
      signal,
      cleanupSteps: Array.isArray(rules.cleanup_steps) ? rules.cleanup_steps : undefined,
      cleanupTimeoutSeconds: Number(rules.cleanup_timeout_seconds) > 0 ? Number(rules.cleanup_timeout_seconds) : 30,
    });
    return {
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : r.status === 'skipped' ? undefined : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      remarks: r.remarks,
      classification: r.classification || null,
      metrics: r.metrics || {},
      evidence: (r as { evidence?: any[] }).evidence || [],
    };
  }

  if (method === 'performance' || method === 'load' || method === 'k6' || method === 'endurance' || method === 'soak') {
    const r = await runPerformance({
      baseUrl,
      vars,
      script: tc?.script,
      url: rules.url,
      path: rules.path || '/health',
      method: rules.method || 'GET',
      concurrency: rules.concurrency || 5,
      requests: rules.requests || 20,
      durationSeconds: Number(rules.duration_seconds) > 0 ? Number(rules.duration_seconds) : undefined,
      timeoutSeconds: tc?.timeout_seconds || 15,
      sla: rules.sla || { p95_ms: 2000, error_rate_pct: 5 },
      signal,
    });
    return withCleanup({
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      remarks: r.remarks,
      classification: r.classification || null,
      metrics: r.metrics,
      evidence: [],
    });
  }

  const r = await runSelenium({ ...common, viewport, headless, signal });
  return withCleanup({
    status: r.status,
    verdict: r.status === 'passed' ? 'pass' : 'fail',
    duration_ms: r.duration_ms,
    message: r.message,
    classification: r.classification || null,
    evidence: r.evidence || [],
  });
}

async function runJob(execution: any) {
  console.log(`[worker] claimed ${execution.key}`);
  const caseIds: string[] = execution.test_case_ids || [];
  const env = await fetchEnvironment(execution.environment_id);
  const baseUrl = reachable(env?.base_url || DEFAULT_BASE_URL);
  const headlessOverride = typeof execution?.metadata?.headless === 'boolean' ? execution.metadata.headless : undefined;
  let anyFailed = false;
  const settings = await fetchSettings();
  const failureLimit = failureLimitOf(settings);
  let consecutiveFailures = 0;
  let circuitBroken = false;

  // No evidence, no run: a case whose proof cannot be stored is not executed.
  const store = await evidencePreflight(API, headers());
  if (!store.ok) {
    console.error(`[worker] ${execution.key} blocked — ${store.reason}`);
    for (const caseId of caseIds) {
      await api(`/api/v1/executions/${execution.id}/results`, {
        method: 'POST',
        body: JSON.stringify({
          test_case_id: caseId,
          status: 'blocked',
          duration_ms: 0,
          message: `Not run: ${store.reason}`,
          remarks: [`Not run: ${store.reason}.`],
          classification: 'infrastructure_failure',
        }),
      });
    }
    await api(`/api/v1/executions/${execution.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ status: 'blocked' }),
    });
    return;
  }
  const secrets = secretValues(buildVars(env));

  // Cancelling a run in the console must stop the work, not just relabel it:
  // the execution's status is watched while the job runs, and a cancel aborts
  // the case in hand (its browser is closed) and skips the rest.
  const cancel = new AbortController();
  const watch = setInterval(async () => {
    try {
      const res = await api(`/api/v1/executions/${execution.id}/status`);
      if (res?.data?.status === 'cancelled') cancel.abort();
    } catch {
      /* an API that cannot answer is not a cancel */
    }
  }, CANCEL_POLL_MS);
  const stopped = async () => {
    console.log(`[worker] ${execution.key} was cancelled — stopped`);
    // Frees this worker's slot; the API keeps the status "cancelled".
    await api(`/api/v1/executions/${execution.id}/complete`, { method: 'POST', body: JSON.stringify({ status: 'cancelled' }) }).catch(() => undefined);
  };

  try {
  for (const caseId of caseIds) {
    if (cancel.signal.aborted) return stopped();
    const tc = await fetchTestCase(caseId);
    const started = new Date().toISOString();
    const testType = tc?.test_type || 'other';
    const caseLimitMs = caseTimeoutMs(settings, testType);
    const caseSignal = AbortSignal.any([cancel.signal, AbortSignal.timeout(caseLimitMs)]);
    let result = await executeCase(tc || { execution_method: 'selenium' }, baseUrl, env, headlessOverride, caseSignal);
    // The result of a case that was cut short by a run cancel is not a verdict: it is not reported.
    if (cancel.signal.aborted) return stopped();
    // The per-test-type timeout fired instead: the case is killed and recorded as timed out,
    // regardless of what status the runner itself returned on abort, and the run continues.
    if (caseSignal.aborted && result.status !== 'passed' && result.status !== 'skipped') {
      result = {
        ...result,
        status: 'timed_out',
        verdict: 'fail',
        classification: 'timeout',
        message: `Timed out after ${Math.round(caseLimitMs / 60_000)} minute(s) — limit for test type "${testType}"`,
        remarks: [...(result.remarks || []), `Stopped: timed out after ${Math.round(caseLimitMs / 60_000)} minute(s), the limit for ${testType} tests.`],
      };
    }
    if (result.status !== 'passed' && result.status !== 'skipped') anyFailed = true;
    if (result.status === 'passed') consecutiveFailures = 0;
    else if (result.status !== 'skipped') consecutiveFailures++;

    const evidence = await publishEvidence(
      ensureEvidence(result, {
        method: isSitScript(tc?.script) ? 'sit' : String(tc?.execution_method || 'selenium').toLowerCase(),
        caseKey: tc?.key,
        caseName: tc?.name,
        target: baseUrl,
        rules: tc?.validation_rules,
        secrets,
      }),
      { api: API, headers: headers(), executionId: execution.id, caseKey: tc?.key }
    );

    try {
      await api(`/api/v1/executions/${execution.id}/results`, {
        method: 'POST',
        body: JSON.stringify({
          test_case_id: caseId,
          status: result.status,
          verdict: result.verdict,
          duration_ms: result.duration_ms,
          started_at: started,
          finished_at: new Date().toISOString(),
          message: result.message,
          remarks: result.remarks && result.remarks.length ? result.remarks : [result.message],
          classification: result.classification,
          metrics: result.metrics || {},
          evidence,
        }),
      });
    } catch (err) {
      // The API refuses results for a cancelled run (409): same outcome as the watcher noticing.
      if (String((err as Error).message).includes('execution_cancelled')) return stopped();
      throw err;
    }

    // N test cases in a row failed — whether at the start of the run or partway through it —
    // so the rest of this execution is stopped rather than burning through a broken build.
    if (consecutiveFailures >= failureLimit) {
      circuitBroken = true;
      console.log(`[worker] ${execution.key} circuit breaker: ${consecutiveFailures} consecutive failures (limit ${failureLimit}) — stopping`);
      break;
    }
  }
  } finally {
    clearInterval(watch);
  }

  await api(`/api/v1/executions/${execution.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      status: anyFailed ? 'failed' : 'passed',
      ...(circuitBroken
        ? { metadata: { circuit_breaker: { triggered: true, consecutive_failures: consecutiveFailures, limit: failureLimit } } }
        : {}),
    }),
  });
  console.log(`[worker] completed ${execution.key} → ${anyFailed ? 'failed' : 'passed'}${circuitBroken ? ' (circuit breaker stopped the run early)' : ''}`);
}

async function pollLoop() {
  await register();
  setInterval(heartbeat, 15_000);
  for (;;) {
    try {
      const claimed = await api('/api/v1/executions/claim', {
        method: 'POST',
        body: JSON.stringify({ worker_id: WORKER_ID }),
      });
      if (claimed?.data) await runJob(claimed.data);
    } catch (err) {
      console.warn('[poll]', (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

pollLoop().catch((err) => {
  console.error(err);
  process.exit(1);
});
