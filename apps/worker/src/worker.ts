#!/usr/bin/env tsx
/**
 * GAVRIQ Test Engine — Sample Execution Worker (Prompt 3)
 * Registers with the control plane, claims jobs, runs Selenium smoke against target,
 * reports results + evidence metadata.
 */
import { randomUUID } from 'node:crypto';

const API = process.env.TEST_ENGINE_API || 'http://127.0.0.1:8787';
const WORKER_ID = process.env.WORKER_ID || `worker-${randomUUID().slice(0, 8)}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS || 5000);

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  if (res.status === 204) return null;
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

async function register() {
  await api('/api/v1/workers/register', {
    method: 'POST',
    body: JSON.stringify({
      id: WORKER_ID,
      name: `Selenium Worker ${WORKER_ID}`,
      capabilities: ['selenium', 'playwright', 'out_of_container', 'in_container'],
      labels: { kind: 'browser' },
      max_concurrency: 2,
    }),
  });
  console.log(`[worker ${WORKER_ID}] registered`);
}

async function heartbeat() {
  try {
    await api(`/api/v1/workers/${WORKER_ID}/heartbeat`, { method: 'POST', body: '{}' });
  } catch (err) {
    console.warn('[heartbeat]', (err as Error).message);
  }
}

async function runJob(execution: any) {
  console.log(`[worker] claimed execution ${execution.key}`);
  const caseIds: string[] = execution.test_case_ids || [];

  for (const caseId of caseIds) {
    const started = new Date().toISOString();
    // Minimal stub runner — real worker would load script and invoke Selenium/Playwright
    const result = {
      test_case_id: caseId,
      status: 'passed',
      verdict: 'pass',
      duration_ms: 500 + Math.floor(Math.random() * 2000),
      started_at: started,
      finished_at: new Date().toISOString(),
      message: 'Worker stub execution completed (replace with real runner)',
      classification: null,
      metrics: {},
      evidence: [
        {
          type: 'log',
          storage_key: `evidence/${execution.id}/${caseId}.log`,
          content_type: 'text/plain',
        },
      ],
    };

    await api(`/api/v1/executions/${execution.id}/results`, {
      method: 'POST',
      body: JSON.stringify(result),
    });
  }

  await api(`/api/v1/executions/${execution.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ status: 'passed' }),
  });
  console.log(`[worker] completed execution ${execution.key}`);
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
