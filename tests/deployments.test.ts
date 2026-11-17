/**
 * Deploy-to-env trigger + gating, end to end against a disposable engine.
 *
 * Stands in for Sand Bench's own deploy API (sand-bench-enterprise/deploy/api)
 * with a tiny local HTTP server this test controls directly, so it never
 * needs a real Sand Bench checkout or Docker. Never point this at the shared
 * engine — it registers a throwaway application/environment and queues real
 * executions (deploy_and_run), which a worker attached to the shared engine
 * could pick up.
 *
 *   SANDBENCH_DEPLOY_KEY=test-secret DEPLOY_TEST_API=http://127.0.0.1:8799 \
 *     npx tsx --test tests/deployments.test.ts
 *
 * The disposable engine must already be running with SANDBENCH_DEPLOY_KEY set
 * in its own environment — the engine resolves config.deploy_api.key_env from
 * its own process env at request time, same as config.secret_env always has.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mergeEnvironmentConfig } from '../apps/api/src/routes/environments.ts';

const API = process.env.DEPLOY_TEST_API || '';
const DEPLOY_KEY = process.env.SANDBENCH_DEPLOY_KEY || '';
const APP = 'gavriq-test-engine'; // every seeded engine carries its own self-test catalogue
const HEADERS = { 'content-type': 'application/json' };

async function api(route: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${route}`, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) } });
  const body: any = res.status === 204 ? null : await res.json().catch(() => ({}));
  return { status: res.status, body };
}
const post = (route: string, body: unknown) => api(route, { method: 'POST', body: JSON.stringify(body) });

/** A fake Sand Bench deploy API: 202s immediately, then calls back after `delayMs` with `outcome`. */
function startMockDeployApi(outcome: (job_id: string) => Record<string, unknown>, delayMs = 50) {
  const server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/deploy') {
      res.writeHead(404).end();
      return;
    }
    if (req.headers['x-deploy-key'] !== DEPLOY_KEY) {
      res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'bad key' }));
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const job_id = `mock-${Date.now()}`;
      res.writeHead(202, { 'content-type': 'application/json' }).end(JSON.stringify({ job_id }));
      setTimeout(() => {
        fetch(body.callback_url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': DEPLOY_KEY },
          body: JSON.stringify({ job_id, ...outcome(job_id) }),
        }).catch(() => {});
      }, delayMs);
    });
  });
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

async function makeEnvironment(key: string, baseUrl: string) {
  const made = await post('/api/v1/environments', {
    key,
    name: key,
    env_type: 'localhost',
    base_url: API,
    config: { deploy_api: { base_url: baseUrl, key_env: 'SANDBENCH_DEPLOY_KEY' } },
  });
  assert.ok(made.status === 201 || made.status === 409 || made.status === 500, JSON.stringify(made.body));
  if (made.status !== 201) {
    // Re-run against a persistent disposable engine: the mock server's port changes every run.
    const existing = await api(`/api/v1/environments/${key}`);
    const id = existing.body.data.id as string;
    await api(`/api/v1/environments/${id}`, { method: 'PATCH', body: JSON.stringify({ config: { deploy_api: { base_url: baseUrl, key_env: 'SANDBENCH_DEPLOY_KEY' } } }) });
    return id;
  }
  return made.body.data.id as string;
}

async function pollDeployment(id: string, tries = 40): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const got = await api(`/api/v1/deployments/${id}`);
    if (got.body.data.status === 'succeeded' || got.body.data.status === 'failed') return got.body.data;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`deployment ${id} did not reach a terminal status`);
}

describe('deploy-to-env trigger and gating', () => {
  it('removes case-owned environment markers when a config patch value is null', () => {
    const baseline = {
      vars: { engine: 'http://engine.test', keep: 'baseline' },
      secret_env: { token: 'ENGINE_TOKEN' },
      unrelated: true,
    };
    assert.deepEqual(
      mergeEnvironmentConfig(baseline, { vars: { case_marker: 'test-value' } }),
      { ...baseline, vars: { ...baseline.vars, case_marker: 'test-value' } },
    );
    assert.deepEqual(
      mergeEnvironmentConfig({ ...baseline, vars: { ...baseline.vars, case_marker: 'test-value' } }, { vars: { case_marker: null } }),
      baseline,
    );
  });

  let ready = false;
  const mocks: Array<() => Promise<void>> = [];

  before(async () => {
    if (!API || !DEPLOY_KEY) return;
    try {
      ready = (await api('/health')).status === 200;
    } catch {
      ready = false;
    }
  });

  after(async () => {
    for (const close of mocks) await close();
  });

  it('rejects an unknown mode or a missing environment', async (t) => {
    if (!ready) return t.skip('set DEPLOY_TEST_API and SANDBENCH_DEPLOY_KEY to a disposable engine');
    assert.equal((await post('/api/v1/deployments', { environment_id: 'no-such-env', application: APP, mode: 'deploy_only' })).status, 404);
    const mock = await startMockDeployApi(() => ({ status: 'succeeded' }));
    mocks.push(mock.close);
    const envId = await makeEnvironment('deploy-test-env', mock.url);
    assert.equal((await post('/api/v1/deployments', { environment_id: envId, application: APP, mode: 'not-a-mode' })).status, 400);
  });

  it('deploy_only succeeds without ever queuing a run', async (t) => {
    if (!ready) return t.skip('set DEPLOY_TEST_API and SANDBENCH_DEPLOY_KEY to a disposable engine');
    const mock = await startMockDeployApi(() => ({ status: 'succeeded', commit: 'abc1234', version: '1.2.3-staging' }));
    mocks.push(mock.close);
    const envId = await makeEnvironment('deploy-test-only', mock.url);

    const triggered = await post('/api/v1/deployments', { environment_id: envId, application: APP, mode: 'deploy_only' });
    assert.equal(triggered.status, 202, JSON.stringify(triggered.body));
    assert.equal(triggered.body.data.status, 'deploying');

    const done = await pollDeployment(triggered.body.data.id);
    assert.equal(done.status, 'succeeded');
    assert.equal(done.commit, 'abc1234');
    assert.equal(done.run_id, null, 'deploy_only must never queue a run');
  });

  it('deploy_and_run queues a run only after the deploy succeeds', async (t) => {
    if (!ready) return t.skip('set DEPLOY_TEST_API and SANDBENCH_DEPLOY_KEY to a disposable engine');
    const mock = await startMockDeployApi(() => ({ status: 'succeeded', commit: 'def5678' }));
    mocks.push(mock.close);
    const envId = await makeEnvironment('deploy-test-run', mock.url);

    const triggered = await post('/api/v1/deployments', { environment_id: envId, application: APP, mode: 'deploy_and_run' });
    assert.equal(triggered.status, 202, JSON.stringify(triggered.body));

    const done = await pollDeployment(triggered.body.data.id);
    assert.equal(done.status, 'succeeded');
    assert.ok(done.run_id, 'expected a run to be queued after a successful deploy_and_run');

    const run = await api(`/api/v1/runs/${done.run_id}`);
    assert.equal(run.status, 200, JSON.stringify(run.body));
    assert.ok(run.body.data.totals.cases > 0, 'expected queued cases from the self-test catalogue');
    for (const e of run.body.data.executions) {
      await post(`/api/v1/executions/${e.id}/cancel`, {});
    }
  });

  it('a failed deploy never queues a run, even in deploy_and_run mode', async (t) => {
    if (!ready) return t.skip('set DEPLOY_TEST_API and SANDBENCH_DEPLOY_KEY to a disposable engine');
    const mock = await startMockDeployApi(() => ({ status: 'failed', error: 'docker compose up failed' }));
    mocks.push(mock.close);
    const envId = await makeEnvironment('deploy-test-fail', mock.url);

    const triggered = await post('/api/v1/deployments', { environment_id: envId, application: APP, mode: 'deploy_and_run' });
    const done = await pollDeployment(triggered.body.data.id);
    assert.equal(done.status, 'failed');
    assert.match(done.error, /docker compose up failed/);
    assert.equal(done.run_id, null);
  });

  it('marks the deployment failed immediately when the environment is unreachable, without polling', async (t) => {
    if (!ready) return t.skip('set DEPLOY_TEST_API and SANDBENCH_DEPLOY_KEY to a disposable engine');
    const envId = await makeEnvironment('deploy-test-unreachable', 'http://127.0.0.1:1'); // nothing listens here

    const triggered = await post('/api/v1/deployments', { environment_id: envId, application: APP, mode: 'deploy_only' });
    assert.equal(triggered.status, 202);
    assert.equal(triggered.body.data.status, 'failed');
    assert.ok(triggered.body.data.error, 'expected the connection failure to be recorded');

    const read = await api(`/api/v1/deployments/${triggered.body.data.id}`);
    assert.equal(read.body.data.status, 'failed');
  });
});
