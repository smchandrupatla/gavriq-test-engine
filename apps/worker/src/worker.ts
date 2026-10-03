#!/usr/bin/env tsx
/**
 * GAVRIQ Test Engine — Execution Worker
 * Dispatches to Selenium, Playwright, HTTP, Performance, or SIT file runners.
 */
import { randomUUID } from 'node:crypto';
import { runSelenium } from './runners/selenium.js';
import { runPlaywright } from './runners/playwright.js';
import { runHttp } from './runners/http.js';
import { runPerformance } from './runners/performance.js';
import { runSit } from './runners/sit.js';
import { classifyCase } from '../../api/src/case-definition.js';
import { compact, saveJson, saveLog } from './evidence.js';

const API = process.env.TEST_ENGINE_API || 'http://127.0.0.1:8787';
const WORKER_ID = process.env.WORKER_ID || `worker-${randomUUID().slice(0, 8)}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS || 4000);
const DEFAULT_BASE_URL = process.env.TARGET_BASE_URL || 'http://127.0.0.1:8001';
const WORKER_API_KEY = process.env.WORKER_API_KEY || '';

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

async function executeCase(tc: any, baseUrl: string, prefix: string): Promise<RunnerResult> {
  const script = tc?.script || '';
  const plan = classifyCase(tc || {});

  // A case with nothing behind it must not pass: it used to fall through to
  // "load the base URL" and report green, which proved nothing.
  if (!plan.executable) {
    const log = saveLog(`${prefix}-blocked`, [
      `# ${tc?.key || 'unknown case'} was not run`,
      `reason: ${plan.reason}`,
      `execution_method: ${tc?.execution_method || '(none)'}`,
      `script: ${script || '(none)'}`,
      `steps: ${Array.isArray(tc?.steps) ? tc.steps.length : 0}`,
    ]);
    return {
      status: 'blocked',
      duration_ms: 0,
      message: `Not executable: ${plan.reason}`,
      classification: 'script_problem',
      metrics: { definition: plan.kind },
      evidence: compact([log]),
    };
  }

  // Imported SIT catalog entries
  if (plan.kind === 'sit-file') {
    const r = await runSit({
      script,
      baseUrl,
      timeoutSeconds: tc?.timeout_seconds || 120,
      evidencePrefix: prefix,
    });
    return {
      status: r.status === 'skipped' ? 'skipped' : r.status,
      verdict: r.status === 'passed' ? 'pass' : r.status === 'skipped' ? undefined : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      classification: r.classification || null,
      metrics: r.metrics || {},
      evidence: r.evidence || [],
    };
  }

  const common = {
    script: script || undefined,
    baseUrl,
    timeoutSeconds: tc?.timeout_seconds || 30,
    steps: Array.isArray(tc?.steps) ? tc.steps : undefined,
    evidencePrefix: prefix,
  };

  if (plan.runner === 'playwright') {
    const r = await runPlaywright(common);
    return {
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      classification: r.classification || null,
      evidence: r.evidence,
    };
  }

  if (plan.runner === 'http') {
    const r = await runHttp(common);
    return {
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      classification: r.classification || null,
      metrics: r.metrics || {},
      evidence: compact([saveLog(`${prefix}-http`, r.transcript)]),
    };
  }

  if (plan.runner === 'performance') {
    const rules = tc?.validation_rules || {};
    const profile = {
      path: rules.path || '/health',
      method: rules.method || 'GET',
      concurrency: rules.concurrency || 5,
      requests: rules.requests || 20,
      durationSeconds: rules.duration_seconds || 0,
      sla: rules.sla || { p95_ms: 2000, error_rate_pct: 5 },
    };
    const r = await runPerformance({
      baseUrl,
      script: tc?.script,
      ...profile,
      timeoutSeconds: tc?.timeout_seconds || 15,
    });
    return {
      status: r.status,
      verdict: r.status === 'passed' ? 'pass' : 'fail',
      duration_ms: r.duration_ms,
      message: r.message,
      classification: r.classification || null,
      // The per-window series is small enough to live on the result so the console can graph it.
      metrics: { ...r.metrics, profile, timeseries: r.timeseries },
      evidence: compact([
        saveJson(`${prefix}-perf-samples`, 'metric', { target: `${baseUrl}${profile.path}`, profile, metrics: r.metrics, samples: r.samples }),
      ]),
    };
  }

  const r = await runSelenium(common);
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
  const baseUrl = env?.base_url || DEFAULT_BASE_URL;
  let anyFailed = false;

  for (const caseId of caseIds) {
    const tc = await fetchTestCase(caseId);
    const started = new Date().toISOString();
    const prefix = `${execution.key}-${tc?.key || caseId}`;
    const result = await executeCase(tc || { key: caseId }, baseUrl, prefix);
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
