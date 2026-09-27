/**
 * End-to-end control-plane flow (no browser).
 * Requires DATABASE_URL and a reachable API on TEST_ENGINE_API
 * (default: 127.0.0.1 on TEST_ENGINE_HOST_PORT from .env, else :8787, the compose host port).
 * Skips cleanly when API is down so local unit runs stay green, but fails if a different
 * service answers on that port (Sand Bench's API also uses :8787).
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

try { process.loadEnvFile(); } catch { /* .env is optional */ }
const API = process.env.TEST_ENGINE_API
  || `http://127.0.0.1:${process.env.TEST_ENGINE_HOST_PORT || 8787}`;

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

describe('e2e api flow', () => {
  let available = false;

  before(async () => {
    try {
      const { status, body } = await api('/health');
      available = status === 200 && body.status === 'ok';
    } catch {
      available = false;
    }
    if (available) {
      const meta = await api('/api/v1/meta');
      assert.equal(meta.body.service, 'gavriq-test-engine',
        `${API} is not the test engine (set TEST_ENGINE_API or TEST_ENGINE_HOST_PORT)`);
    }
  });

  it('health reports ok when API is up', async (t) => {
    if (!available) {
      t.skip('API not reachable — start with npm run start:api');
      return;
    }
    const { status, body } = await api('/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
  });

  it('lists applications and seeded cases', async (t) => {
    if (!available) {
      t.skip('API not reachable');
      return;
    }
    const apps = await api('/api/v1/applications');
    assert.equal(apps.status, 200);
    assert.ok(Array.isArray(apps.body.data));

    const cases = await api('/api/v1/test-cases?limit=20');
    assert.equal(cases.status, 200);
    assert.ok(Array.isArray(cases.body.data));
  });

  it('queues, claims, reports, and completes an HTTP health execution', async (t) => {
    if (!available) {
      t.skip('API not reachable');
      return;
    }

    const cases = await api('/api/v1/test-cases?limit=50');
    const healthCase = (cases.body.data || []).find(
      (c: any) => c.key === 'TC-SB-HEALTH' || c.execution_method === 'http'
    );
    if (!healthCase) {
      t.skip('No HTTP test case — run npm run seed');
      return;
    }

    const envs = await api('/api/v1/environments');
    const env = (envs.body.data || []).find((e: any) => e.key === 'local-dev');

    // Point environment at the engine's own health endpoint for a reliable target
    const baseUrl = process.env.E2E_TARGET_URL || `${API}`;

    const queued = await api('/api/v1/executions', {
      method: 'POST',
      body: JSON.stringify({
        test_case_ids: [healthCase.id],
        environment_id: env?.id || env?.key,
        trigger_source: 'ci',
        metadata: { e2e: true, baseUrl },
      }),
    });
    assert.equal(queued.status, 202, JSON.stringify(queued.body));
    const execId = queued.body.data.id;

    // Register ephemeral worker and claim
    const workerId = `e2e-worker-${Date.now()}`;
    await api('/api/v1/workers/register', {
      method: 'POST',
      body: JSON.stringify({
        id: workerId,
        name: 'E2E Worker',
        capabilities: ['http', 'api'],
      }),
    });

    const claimed = await api('/api/v1/executions/claim', {
      method: 'POST',
      body: JSON.stringify({ worker_id: workerId }),
    });
    assert.ok(claimed.status === 200 || claimed.status === 204);

    // Simulate HTTP runner against API health
    const health = await fetch(`${baseUrl}/health`);
    const ok = health.ok;

    const result = await api(`/api/v1/executions/${execId}/results`, {
      method: 'POST',
      body: JSON.stringify({
        test_case_id: healthCase.id,
        status: ok ? 'passed' : 'failed',
        verdict: ok ? 'pass' : 'fail',
        duration_ms: 50,
        message: ok ? 'e2e health OK' : 'e2e health failed',
        metrics: { status_code: health.status },
      }),
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));

    const done = await api(`/api/v1/executions/${execId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ status: ok ? 'passed' : 'failed' }),
    });
    assert.equal(done.status, 200);
    assert.equal(done.body.data.status, ok ? 'passed' : 'failed');

    const report = await api(`/api/v1/reports/summary/${execId}`);
    assert.equal(report.status, 200);
    assert.ok(report.body.data.executive_summary);
  });

  it('completes an execution addressed by its key', async (t) => {
    if (!available) {
      t.skip('API not reachable');
      return;
    }
    const cases = await api('/api/v1/test-cases?limit=1');
    const testCase = (cases.body.data || [])[0];
    if (!testCase) {
      t.skip('No test cases — run npm run seed');
      return;
    }
    const queued = await api('/api/v1/executions', {
      method: 'POST',
      body: JSON.stringify({ test_case_ids: [testCase.id], trigger_source: 'ci', metadata: { e2e: true } }),
    });
    assert.equal(queued.status, 202, JSON.stringify(queued.body));
    const done = await api(`/api/v1/executions/${queued.body.data.key}/complete`, {
      method: 'POST',
      body: JSON.stringify({ status: 'passed' }),
    });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.data.id, queued.body.data.id);
    assert.equal(done.body.data.status, 'passed');
  });

  it('serves application detail, run-tests, and failures by key', async (t) => {
    if (!available) {
      t.skip('API not reachable');
      return;
    }
    const apps = await api('/api/v1/applications');
    const application = (apps.body.data || [])[0];
    if (!application) {
      t.skip('No applications — run npm run seed');
      return;
    }

    const detail = await api(`/api/v1/applications/${application.key}`);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.data.id, application.id);
    assert.ok(Array.isArray(detail.body.data.test_cases));
    assert.ok(Array.isArray(detail.body.data.recent_executions));

    const missing = await api('/api/v1/applications/no-such-application');
    assert.equal(missing.status, 404);

    const failures = await api(`/api/v1/applications/${application.key}/failures`);
    assert.equal(failures.status, 200, JSON.stringify(failures.body));
    assert.equal(typeof failures.body.data.total_failed, 'number');

    const badIds = await api(`/api/v1/applications/${application.key}/run-tests`, {
      method: 'POST',
      body: JSON.stringify({ test_case_ids: ['not-a-uuid'] }),
    });
    assert.equal(badIds.status, 400);

    const testCase = detail.body.data.test_cases[0];
    if (!testCase) return;
    const run = await api(`/api/v1/applications/${application.key}/run-tests`, {
      method: 'POST',
      body: JSON.stringify({ test_case_ids: [testCase.id] }),
    });
    assert.equal(run.status, 201, JSON.stringify(run.body));
    assert.deepEqual(run.body.data.test_case_ids, [testCase.id]);
    assert.equal(run.body.data.metadata.application_key, application.key);

    const after = await api(`/api/v1/applications/${application.id}`);
    assert.ok(after.body.data.recent_executions.some((e: any) => e.id === run.body.data.id));
    await api(`/api/v1/executions/${run.body.data.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ status: 'cancelled' }),
    });
  });

  it('accepts build-results and exposes test-status', async (t) => {
    if (!available) {
      t.skip('API not reachable');
      return;
    }

    const post = await api('/api/v1/build-results', {
      method: 'POST',
      body: JSON.stringify({
        application_key: 'sand-bench',
        build_id: `e2e-build-${Date.now()}`,
        commit_sha: 'deadbeef',
        results: [
          { test_key: 'e2e-unit-1', test_name: 'E2E unit', status: 'passed', duration_ms: 10 },
          { test_key: 'e2e-unit-2', test_name: 'E2E unit 2', status: 'passed', duration_ms: 12 },
        ],
      }),
    });
    assert.equal(post.status, 201, JSON.stringify(post.body));

    const status = await api('/api/v1/test-status?application_key=sand-bench');
    assert.equal(status.status, 200);
    assert.ok(status.body.data);
    assert.ok(Array.isArray(status.body.data.in_container));
  });
});
