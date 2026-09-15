#!/usr/bin/env tsx
/**
 * GAVRIQ Test Engine — Execution Worker
 * Dispatches to Selenium, Playwright, HTTP, or Performance runners.
 */
import { randomUUID } from 'node:crypto';
import { runSelenium } from './runners/selenium.js';
import { runPlaywright } from './runners/playwright.js';
import { runHttp } from './runners/http.js';
import { runPerformance } from './runners/performance.js';

const API = process.env.TEST_ENGINE_API || 'http://127.0.0.1:8787';
const WORKER_ID = process.env.WORKER_ID || `worker-${randomUUID().slice(0, 8)}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS || 4000);
const DEFAULT_BASE_URL = process.env.TARGET_BASE_URL || 'http://127.0.0.1:8001';

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
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
        'selenium', 'playwright', 'http', 'rest', 'api', 'performance', 'load',
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

async function executeCase(tc: any, baseUrl: string): Promise<RunnerResult> {
  const method = (tc?.execution_method || 'selenium').toLowerCase();
  const common = {
    script: tc?.script || undefined,
    baseUrl,
    timeoutSeconds: tc?.timeout_seconds || 30,
    steps: Array.isArray(tc?.steps) ? tc.steps : undefined,
  };

  if (method === 'playwright') {
    const r = await runPlaywright(common);
    return {
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      classification: r.classification || null,
      evidence: [{ type: 'log', storage_key: `evidence/pw-${Date.now()}.log`, content_type: 'text/plain' }],
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
      evidence: [],
    };
  }

  if (method === 'performance' || method === 'load' || method === 'k6') {
    const rules = tc?.validation_rules || {};
    const r = await runPerformance({
      baseUrl,
      script: tc?.script,
      path: rules.path || '/health',
      method: rules.method || 'GET',
      concurrency: rules.concurrency || 5,
      requests: rules.requests || 20,
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

  const r = await runSelenium(common);
  return {
    status: r.status,
    verdict: r.status === 'passed' ? 'pass' : 'fail',
    duration_ms: r.duration_ms,
    message: r.message,
    classification: r.classification || null,
    evidence: r.evidence || [
      { type: 'log', storage_key: `evidence/sel-${Date.now()}.log`, content_type: 'text/plain' },
    ],
  };
}

async function runJob(execution: any) {
  console.log(`[worker] claimed ${execution.key}`);
  const caseIds: string[] = execution.test_case_ids || [];
  const env = await fetchEnvironment(execution.environment_id);
  const baseUrl = env?.base_url || DEFAULT_BASE_URL;
  let anyFailed = false;

  for (const caseId of caseIds) {
    const tc = await fetchTestCase(caseId);
    const started = new Date().toISOString();
    const result = await executeCase(tc || { execution_method: 'selenium' }, baseUrl);
    if (result.status !== 'passed') anyFailed = true;

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
