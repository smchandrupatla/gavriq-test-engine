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

const API = process.env.TEST_ENGINE_API || 'http://127.0.0.1:8787';
const WORKER_ID = process.env.WORKER_ID || `worker-${randomUUID().slice(0, 8)}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS || 4000);
const DEFAULT_BASE_URL = process.env.TARGET_BASE_URL || 'http://127.0.0.1:8001';
const WORKER_API_KEY = process.env.WORKER_API_KEY || '';

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
        'selenium', 'playwright', 'http', 'rest', 'api', 'performance', 'load', 'sit',
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

type RunnerResult = {
  status: string;
  verdict?: string;
  duration_ms: number;
  message: string;
  classification?: string | null;
  metrics?: Record<string, unknown>;
  evidence?: any[];
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

async function executeCase(tc: any, baseUrl: string, env: any, headlessOverride?: boolean): Promise<RunnerResult> {
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

  // Imported SIT catalog entries
  if (isSitScript(script) || method === 'sit') {
    const r = await runSit({
      script,
      baseUrl,
      vars,
      timeoutSeconds: tc?.timeout_seconds || 120,
    });
    return {
      status: r.status === 'skipped' ? 'skipped' : r.status,
      verdict: r.status === 'passed' ? 'pass' : r.status === 'skipped' ? undefined : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      classification: r.classification || null,
      metrics: r.metrics || {},
      evidence: [],
    };
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
    });
    return {
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      classification: r.classification || null,
      metrics: r.metrics || {},
      evidence: r.evidence || [],
    };
  }

  if (method === 'http' || method === 'rest' || method === 'api') {
    const r = await runHttp(common);
    return {
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
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
    });
    return {
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      classification: r.classification || null,
      metrics: r.metrics,
      evidence: [],
    };
  }

  const r = await runSelenium({ ...common, viewport, headless });
  return {
    status: r.status,
    verdict: r.status === 'passed' ? 'pass' : 'fail',
    duration_ms: r.duration_ms,
    message: r.message,
    classification: r.classification || null,
    evidence: r.evidence || [],
  };
}

async function runJob(execution: any) {
  console.log(`[worker] claimed ${execution.key}`);
  const caseIds: string[] = execution.test_case_ids || [];
  const env = await fetchEnvironment(execution.environment_id);
  const baseUrl = reachable(env?.base_url || DEFAULT_BASE_URL);
  const headlessOverride = typeof execution?.metadata?.headless === 'boolean' ? execution.metadata.headless : undefined;
  let anyFailed = false;

  for (const caseId of caseIds) {
    const tc = await fetchTestCase(caseId);
    const started = new Date().toISOString();
    const result = await executeCase(tc || { execution_method: 'selenium' }, baseUrl, env, headlessOverride);
    if (result.status !== 'passed' && result.status !== 'skipped') anyFailed = true;

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
        classification: result.classification,
        metrics: result.metrics || {},
        evidence: result.evidence || [],
      }),
    });
  }

  await api(`/api/v1/executions/${execution.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ status: anyFailed ? 'failed' : 'passed' }),
  });
  console.log(`[worker] completed ${execution.key} → ${anyFailed ? 'failed' : 'passed'}`);
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
