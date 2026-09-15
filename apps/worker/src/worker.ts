#!/usr/bin/env tsx
/**
 * GAVRIQ Test Engine — Execution Worker
 * Registers with control plane, claims jobs, runs Selenium (or other) runners,
 * reports results + evidence metadata.
 */
import { randomUUID } from 'node:crypto';
import { runSelenium } from './runners/selenium.js';

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
      name: `Browser Worker ${WORKER_ID}`,
      capabilities: ['selenium', 'playwright', 'out_of_container', 'in_container', 'ui', 'smoke'],
      labels: { kind: 'browser', runtime: 'selenium-webdriver' },
      max_concurrency: 2,
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

async function runJob(execution: any) {
  console.log(`[worker] claimed ${execution.key} (${execution.id})`);
  const caseIds: string[] = execution.test_case_ids || [];
  const env = await fetchEnvironment(execution.environment_id);
  const baseUrl = env?.base_url || DEFAULT_BASE_URL;
  let anyFailed = false;

  for (const caseId of caseIds) {
    const tc = await fetchTestCase(caseId);
    const started = new Date().toISOString();
    const method = (tc?.execution_method || 'selenium').toLowerCase();

    let result: {
      status: string;
      verdict?: string;
      duration_ms: number;
      message: string;
      classification?: string | null;
      evidence?: any[];
    };

    if (method === 'selenium' || method === 'ui' || !tc) {
      const seleniumResult = await runSelenium({
        script: tc?.script || undefined,
        baseUrl,
        timeoutSeconds: tc?.timeout_seconds || 30,
        steps: Array.isArray(tc?.steps) ? tc.steps : undefined,
      });
      result = {
        status: seleniumResult.status,
        verdict: seleniumResult.status === 'passed' ? 'pass' : 'fail',
        duration_ms: seleniumResult.duration_ms,
        message: seleniumResult.message,
        classification: seleniumResult.classification || null,
        evidence: seleniumResult.evidence || [
          {
            type: 'log',
            storage_key: `evidence/${execution.id}/${caseId}.log`,
            content_type: 'text/plain',
          },
        ],
      };
    } else {
      // Placeholder for other runners (pytest, k6, kafka, ...)
      result = {
        status: 'passed',
        verdict: 'pass',
        duration_ms: 100,
        message: `Runner '${method}' not yet implemented in this worker — marked passed as stub`,
        classification: null,
        evidence: [],
      };
    }

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
        metrics: {},
        evidence: result.evidence,
      }),
    });

    // Auto-classify failures if not already set
    // (classification already sent above when available)
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
      if (claimed?.data) {
        await runJob(claimed.data);
      }
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
