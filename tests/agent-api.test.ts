/**
 * Agent API: an external party (the Sand Bench agent) starts a run, is told when it
 * finishes, reads the failures, and starts it again.
 *
 * The pure rules (signatures, URL checks, backoff) always run. The end-to-end flow needs a
 * disposable engine started with AGENT_API_KEY, because it claims queued executions as a
 * fake worker:
 *   AGENT_API_KEY=it-key ENGINE_IT_BASE=http://127.0.0.1:8897 ENGINE_IT_AGENT_KEY=it-key \
 *     npx tsx --test tests/agent-api.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { backoffSeconds, checkEvents, checkName, checkWebhookUrl, sign, summarise, verifySignature } from '../apps/api/src/notify/webhooks.ts';

describe('webhook rules', () => {
  it('signs and verifies, and rejects a tampered body, timestamp or secret', () => {
    const sig = sign('s3cret', '1700000000', '{"a":1}');
    assert.equal(verifySignature('s3cret', '1700000000', '{"a":1}', 'sha256=' + sig), true);
    assert.equal(verifySignature('s3cret', '1700000000', '{"a":2}', sig), false);
    assert.equal(verifySignature('s3cret', '1700000001', '{"a":1}', sig), false);
    assert.equal(verifySignature('other', '1700000000', '{"a":1}', sig), false);
    assert.equal(verifySignature('s3cret', '1700000000', '{"a":1}', 'short'), false);
  });

  it('accepts receivers on private networks but refuses schemes, credentials and metadata hosts', () => {
    assert.equal(checkWebhookUrl('http://sandbench-agent:9000/hooks/engine'), 'http://sandbench-agent:9000/hooks/engine');
    assert.equal(checkWebhookUrl('https://agent.example.com/x'), 'https://agent.example.com/x');
    for (const bad of ['ftp://x/y', 'javascript:alert(1)', 'file:///etc/passwd', 'http://u:p@host/x', 'http://169.254.169.254/latest', 'http://metadata.google.internal/', 'not a url', '', 'http://host/a b', 'http://h/' + 'x'.repeat(2100)]) {
      assert.throws(() => checkWebhookUrl(bad), /url|host|address/i, `should refuse ${bad.slice(0, 40)}`);
    }
  });

  it('honours WEBHOOK_ALLOWED_HOSTS', () => {
    process.env.WEBHOOK_ALLOWED_HOSTS = 'agent.internal';
    try {
      assert.doesNotThrow(() => checkWebhookUrl('http://agent.internal/x'));
      assert.throws(() => checkWebhookUrl('http://other.internal/x'), /WEBHOOK_ALLOWED_HOSTS/);
    } finally { delete process.env.WEBHOOK_ALLOWED_HOSTS; }
  });

  it('validates names and events', () => {
    assert.equal(checkName('Sand Bench agent'), 'Sand Bench agent');
    assert.throws(() => checkName('<b>x</b>'));
    assert.throws(() => checkName(''));
    assert.deepEqual(checkEvents(undefined), ['execution.completed']);
    assert.throws(() => checkEvents(['nope']));
    assert.throws(() => checkEvents([]));
  });

  it('backs off 10 s, 30 s, 2 min, 10 min, 30 min, 2 h and stays there', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(backoffSeconds), [10, 30, 120, 600, 1800, 7200, 7200]);
  });

  it('summarises verdicts', () => {
    assert.deepEqual(summarise([{ status: 'passed' }, { status: 'failed', verdict: 'fail' }, { status: 'error' }, { status: 'skipped' }, { status: 'running' }]),
      { total: 5, passed: 1, failed: 1, errored: 1, skipped: 1, other: 1 });
  });
});

const BASE = process.env.ENGINE_IT_BASE?.replace(/\/$/, '');
const KEY = process.env.ENGINE_IT_AGENT_KEY || '';
const tag = Date.now().toString(36);

async function call(method: string, path: string, body?: unknown, key: string | null = KEY) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(key ? { 'x-agent-key': key } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, body: json as any };
}

type Hit = { headers: http.IncomingHttpHeaders; body: string; json: any };
function receiver() {
  const hits: Hit[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { hits.push({ headers: req.headers, body: raw, json: JSON.parse(raw || '{}') }); res.writeHead(204).end(); });
  });
  return new Promise<{ url: string; hits: Hit[]; close: () => void }>((resolve) => server.listen(0, '127.0.0.1', () =>
    resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`, hits, close: () => server.close() })));
}
async function waitFor<T>(fn: () => T | undefined | false, what: string, ms = 20000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 250)); }
  throw new Error(`timed out waiting for ${what}`);
}

/** Claim the next queued execution as a fake worker, report one result per case, complete it. */
async function runAsWorker(outcomes: Record<string, 'passed' | 'failed'>) {
  await call('POST', '/api/v1/workers/register', { id: `it-agent-worker-${tag}`, name: 'agent API IT' }, null);
  const claimed = await call('POST', '/api/v1/executions/claim', { worker_id: `it-agent-worker-${tag}` }, null);
  assert.equal(claimed.status, 200, 'expected a queued execution to claim');
  const exec = claimed.body.data;
  let anyFailed = false;
  for (const caseId of exec.test_case_ids as string[]) {
    const status = outcomes[caseId] ?? 'passed';
    anyFailed ||= status === 'failed';
    const r = await call('POST', `/api/v1/executions/${exec.id}/results`, {
      test_case_id: caseId, status, message: status === 'failed' ? 'expected 200 got 500 on /api/v1/payments' : null,
      classification: status === 'failed' ? 'assertion_failure' : null,
    }, null);
    assert.equal(r.status, 201);
  }
  return call('POST', `/api/v1/executions/${exec.id}/complete`, { status: anyFailed ? 'failed' : 'passed' }, null);
}

describe('agent API end to end', { skip: !BASE && 'set ENGINE_IT_BASE and ENGINE_IT_AGENT_KEY to run' }, () => {
  it('requires the agent key on every route', async () => {
    for (const [m, p] of [['GET', '/api/v1/agent/schedules'], ['POST', '/api/v1/agent/runs'], ['GET', '/api/v1/agent/runs/x'], ['GET', '/api/v1/agent/webhooks'], ['POST', '/api/v1/agent/webhooks']] as const) {
      assert.equal((await call(m, p, m === 'POST' ? {} : undefined, null)).status, 401, `${m} ${p} without a key`);
      assert.equal((await call(m, p, m === 'POST' ? {} : undefined, 'wrong-key')).status, 401, `${m} ${p} with a wrong key`);
    }
  });

  it('runs a nightly schedule on request, notifies the subscriber with a signed webhook, serves failures, and the agent can run it again', async () => {
    const hook = await receiver();
    try {
      const apps = await call('GET', '/api/v1/applications', undefined, null);
      const app = apps.body.data.find((a: any) => a.key === 'sand-bench');
      const mk = async (k: string) => (await call('POST', '/api/v1/test-cases', { key: `AG-${tag}-${k}`, name: `Agent API ${k}`, application_id: app.id, test_type: 'api' }, null)).body.data;
      const good = await mk('good');
      const bad = await mk('bad');

      const sched = await call('POST', '/api/v1/schedules', { name: `Nightly agent IT ${tag}`, cron_expression: '0 2 * * *', target: { scope: 'cases', case_ids: [good.id, bad.id] } }, null);
      assert.equal(sched.status, 201);
      const scheduleId = sched.body.data.id as string;
      const listed = await call('GET', '/api/v1/agent/schedules');
      assert.ok(listed.body.data.some((s: any) => s.id === scheduleId));

      // Receiver registration: bad URLs are refused, the secret is shown once.
      assert.equal((await call('POST', '/api/v1/agent/webhooks', { name: 'bad', url: 'http://169.254.169.254/x' })).status, 400);
      assert.equal((await call('POST', '/api/v1/agent/webhooks', { name: 'bad', url: 'ftp://h/x' })).status, 400);
      const sub = await call('POST', '/api/v1/agent/webhooks', { name: `Sand Bench agent ${tag}`, url: hook.url, schedule_id: scheduleId });
      assert.equal(sub.status, 201);
      const secret = sub.body.data.secret as string;
      assert.match(secret, /^whsec_/);
      const listedSubs = await call('GET', '/api/v1/agent/webhooks');
      assert.ok(!JSON.stringify(listedSubs.body).includes(secret), 'the secret must not be listed');

      // 1. The agent starts the nightly run.
      const started = await call('POST', '/api/v1/agent/runs', { schedule_id: scheduleId, requested_by: 'sandbench-agent' });
      assert.equal(started.status, 202);
      assert.equal(started.body.data.case_count, 2);
      const runId = started.body.data.execution_id as string;
      // While it is queued, starting the same schedule again is refused rather than doubled.
      assert.equal((await call('POST', '/api/v1/agent/runs', { schedule_id: scheduleId })).status, 409);
      assert.equal((await call('GET', `/api/v1/agent/runs/${runId}`)).body.data.finished, false);

      // 2. The run fails; the engine notifies the receiver, signed.
      await runAsWorker({ [bad.id]: 'failed' });
      const hit = await waitFor(() => hook.hits.find((h) => h.json.execution?.id === runId), 'the completion webhook');
      assert.equal(hit.headers['x-gavriq-event'], 'execution.completed');
      assert.equal(verifySignature(secret, String(hit.headers['x-gavriq-timestamp']), hit.body, String(hit.headers['x-gavriq-signature'])), true, 'signature must verify with the subscription secret');
      assert.equal(hit.json.outcome, 'fail');
      assert.equal(hit.json.summary.failed, 1);
      assert.equal(hit.json.summary.passed, 1);
      assert.equal(hit.json.execution.schedule_id, scheduleId);
      assert.ok(!hit.body.includes('expected 200 got 500'), 'the notification carries verdicts only; details come from the results call');

      // 3. The agent reads the failures.
      const results = await call('GET', `/api/v1/agent/runs/${runId}/results`);
      assert.equal(results.status, 200);
      assert.equal(results.body.data.outcome, 'fail');
      assert.equal(results.body.data.results.length, 1, 'failures only by default');
      const failure = results.body.data.results[0];
      assert.equal(failure.case_key, `AG-${tag}-bad`);
      assert.match(failure.message, /expected 200 got 500/);
      assert.ok(failure.defects.length >= 1, 'the failure is linked to its defect');
      assert.equal((await call('GET', `/api/v1/agent/runs/${runId}/results?all=1`)).body.data.results.length, 2);
      assert.equal((await call('GET', `/api/v1/agent/runs/${runId}`)).body.data.finished, true);

      // The delivery is recorded, and re-delivery of the same completion does not duplicate it.
      const deliveries = await call('GET', `/api/v1/agent/webhook-deliveries?run=${runId}`);
      assert.equal(deliveries.body.data.length, 1);
      assert.equal(deliveries.body.data[0].status, 'delivered');

      // 4. After the fix the agent triggers again, this time with a per-run callback.
      const again = await call('POST', '/api/v1/agent/runs', { schedule_id: scheduleId, callback_url: hook.url });
      assert.equal(again.status, 202);
      const secondId = again.body.data.execution_id as string;
      await runAsWorker({});
      const hits = await waitFor(() => { const h = hook.hits.filter((x) => x.json.execution?.id === secondId); return h.length >= 2 ? h : undefined; }, 'both notifications for the rerun');
      assert.equal(hits.length, 2, 'one for the subscription, one for the callback_url');
      assert.ok(hits.every((h) => h.json.outcome === 'pass'));
      const callbackHit = hits.find((h) => verifySignature(KEY, String(h.headers['x-gavriq-timestamp']), h.body, String(h.headers['x-gavriq-signature'])));
      assert.ok(callbackHit, 'the callback_url delivery is signed with the agent key');

      // Test ping and cleanup.
      assert.equal((await call('POST', `/api/v1/agent/webhooks/${sub.body.data.id}/test`)).status, 202);
      await waitFor(() => hook.hits.find((h) => h.json.event === 'webhook.test'), 'the test ping');
      assert.equal((await call('DELETE', `/api/v1/agent/webhooks/${sub.body.data.id}`)).status, 204);
      await call('DELETE', `/api/v1/schedules/${scheduleId}`, undefined, null);
    } finally { hook.close(); }
  });

  it('runs an ad-hoc target and rejects malformed requests', async () => {
    assert.equal((await call('POST', '/api/v1/agent/runs', {})).status, 400);
    assert.equal((await call('POST', '/api/v1/agent/runs', { schedule_id: 'nope' })).status, 400);
    assert.equal((await call('POST', '/api/v1/agent/runs', { target: { scope: 'types', types: [] } })).status, 400);
    assert.equal((await call('POST', '/api/v1/agent/runs', { target: { scope: 'all' }, callback_url: 'http://169.254.169.254/' })).status, 400);
    assert.equal((await call('GET', '/api/v1/agent/runs/00000000-0000-0000-0000-000000000000')).status, 404);
  });
});
