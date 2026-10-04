/**
 * Infrastructure lifecycle (apps/api/src/infra.ts).
 *
 * The decision logic is pure and tested here without a database. The API
 * round trip — deploy queued for the agent, a fake agent claims and completes
 * it, the run follows, the tick queues the teardown — runs only against a
 * disposable engine:
 *
 *   INFRA_TEST_API=http://127.0.0.1:8799 npx tsx --test tests/infra.test.ts
 *
 * Never point it at the shared engine: it creates a throwaway environment,
 * queues real executions and runs the lifecycle tick there.
 */
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INFRA_POLICY,
  PolicyError,
  decideTeardowns,
  environmentState,
  infraConfig,
  nextTeardown,
  normalizePolicy,
  type EnvActivity,
} from '../apps/api/src/infra.js';

const API = process.env.INFRA_TEST_API || '';
// A fixture application of its own, so the test needs no seeded catalogue and queues nothing real.
const APP = 'infra-test-app';
const HEADERS = { 'content-type': 'application/json' };

async function api(route: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${route}`, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) } });
  const body: any = res.status === 204 ? null : await res.json().catch(() => ({}));
  return { status: res.status, body };
}
const post = (route: string, body: unknown) => api(route, { method: 'POST', body: JSON.stringify(body) });

const hoursAgo = (h: number, now: Date) => new Date(now.getTime() - h * 3_600_000).toISOString();

function env(over: Partial<EnvActivity>): EnvActivity {
  return {
    id: over.id || 'env-1',
    key: over.key || 'stack',
    state: 'up',
    deployed_at: null,
    last_run_at: null,
    active_runs: 0,
    pending_job: false,
    recent_failure: false,
    ...over,
  };
}

describe('infra policy', () => {
  it('fills defaults and ignores damaged values when not strict', () => {
    assert.deepEqual(normalizePolicy(undefined), DEFAULT_INFRA_POLICY);
    assert.deepEqual(normalizePolicy({ idle_teardown_hours: 'soon', remove_images_on_teardown: 'yes' }), DEFAULT_INFRA_POLICY);
    assert.equal(normalizePolicy({ idle_teardown_hours: 3 }).idle_teardown_hours, 3);
    assert.equal(normalizePolicy({ remove_volumes_on_teardown: true }).remove_volumes_on_teardown, true);
  });

  it('rejects unknown keys and out-of-range values when strict', () => {
    assert.throws(() => normalizePolicy({ nope: 1 }, { strict: true }), PolicyError);
    assert.throws(() => normalizePolicy({ idle_teardown_hours: -1 }, { strict: true }), PolicyError);
    assert.throws(() => normalizePolicy({ job_timeout_minutes: 1 }, { strict: true }), PolicyError);
    assert.throws(() => normalizePolicy({ auto_deploy_when_down: 'true' }, { strict: true }), PolicyError);
    assert.equal(normalizePolicy({ max_uptime_hours: 0 }, { strict: true }).max_uptime_hours, 0);
  });
});

describe('managed environment config', () => {
  it('recognises a compose-managed environment and only safe script paths', () => {
    const ok = infraConfig({ config: { infra: { driver: 'compose', script: 'deploy/staging/deploy.mjs' }, deployment: { compose_project: 'sand-bench-staging' } } });
    assert.ok(ok);
    assert.equal(ok.compose_project, 'sand-bench-staging');
    assert.deepEqual(ok.image_prefixes, ['sand-bench-staging']);
    assert.equal(infraConfig({ config: {} }), null);
    assert.equal(infraConfig({ config: { infra: { driver: 'compose', script: '../../etc/passwd' } } }), null);
    assert.equal(infraConfig({ config: { infra: { driver: 'compose', script: 'deploy/x/deploy.mjs; rm -rf /' } } }), null);
    assert.equal(infraConfig({ config: { infra: { driver: 'k8s', script: 'deploy/x/deploy.mjs' } } }), null);
  });

  it('reads the stack state, treating a registered deployment without one as up', () => {
    assert.equal(environmentState({ config: { deployment: { state: 'down' } } }), 'down');
    assert.equal(environmentState({ config: { deployment: { deployed_at: '2026-01-01T00:00:00Z' } } }), 'up');
    assert.equal(environmentState({ config: {} }), 'unknown');
    assert.equal(environmentState({ config: { deployment: { state: 'bogus', deployed_at: 'x' } } }), 'up');
  });
});

describe('teardown decisions', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  const policy = { ...DEFAULT_INFRA_POLICY };

  it('tears down a stack nothing has run on for the idle window', () => {
    const idle = env({ key: 'idle', deployed_at: hoursAgo(20, now), last_run_at: hoursAgo(13, now) });
    const busyRecently = env({ key: 'fresh', deployed_at: hoursAgo(20, now), last_run_at: hoursAgo(2, now) });
    const decisions = decideTeardowns([idle, busyRecently], policy, now);
    assert.deepEqual(decisions.map((d) => [d.key, d.reason]), [['idle', 'idle']]);
  });

  it('tears down a stack that has been up longer than the maximum, even if used recently', () => {
    const old = env({ key: 'old', deployed_at: hoursAgo(49, now), last_run_at: hoursAgo(1, now) });
    const decisions = decideTeardowns([old], policy, now);
    assert.deepEqual(decisions.map((d) => [d.key, d.reason]), [['old', 'max_uptime']]);
  });

  it('never tears down while a run is active, a job is pending, or a job just failed', () => {
    const base = { deployed_at: hoursAgo(72, now), last_run_at: hoursAgo(30, now) };
    assert.equal(decideTeardowns([env({ ...base, active_runs: 1 })], policy, now).length, 0);
    assert.equal(decideTeardowns([env({ ...base, pending_job: true })], policy, now).length, 0);
    assert.equal(decideTeardowns([env({ ...base, recent_failure: true })], policy, now).length, 0);
    assert.equal(decideTeardowns([env(base)], policy, now).length, 1);
  });

  it('leaves alone what is already down or in transition, and respects per-environment hours and disabled rules', () => {
    const base = { deployed_at: hoursAgo(72, now), last_run_at: hoursAgo(30, now) };
    assert.equal(decideTeardowns([env({ ...base, state: 'down' })], policy, now).length, 0);
    assert.equal(decideTeardowns([env({ ...base, state: 'deploying' })], policy, now).length, 0);
    assert.equal(decideTeardowns([env({ ...base, state: 'tearing_down' })], policy, now).length, 0);
    // Per-environment override: this one may live for a week and idle for two days.
    assert.equal(decideTeardowns([env({ ...base, idle_teardown_hours: 48, max_uptime_hours: 24 * 7 })], policy, now).length, 0);
    // Both rules off: nothing is ever automatic.
    assert.equal(decideTeardowns([env(base)], { ...policy, idle_teardown_hours: 0, max_uptime_hours: 0 }, now).length, 0);
    // A failed deploy is still a stack that may be up: it is eligible.
    assert.equal(decideTeardowns([env({ ...base, state: 'failed' })], policy, now).length, 1);
  });

  it('reports when the next automatic teardown is due and why', () => {
    const e = env({ deployed_at: hoursAgo(10, now), last_run_at: hoursAgo(4, now) });
    const next = nextTeardown(e, policy)!;
    assert.equal(next.reason, 'idle');
    assert.equal(next.at.toISOString(), new Date(now.getTime() + 8 * 3_600_000).toISOString());
    const soonOld = env({ deployed_at: hoursAgo(47, now), last_run_at: hoursAgo(0.5, now) });
    assert.equal(nextTeardown(soonOld, policy)!.reason, 'max_uptime');
    assert.equal(nextTeardown(env({ state: 'down', deployed_at: hoursAgo(99, now) }), policy), null);
    assert.equal(nextTeardown(env({}), policy), null, 'nothing to measure from');
  });
});

describe('lifecycle round trip (disposable engine)', () => {
  const ENV_KEY = 'infra-test-stack';
  let ready = false;
  let savedPruneEvery: number | null = null;

  // The tick queues housekeeping on its own cadence; a housekeeping job queued in the middle of the
  // test would be claimed by the fake agent ahead of the teardown it is waiting for. Pause it here.
  before(async () => {
    if (!API) return;
    const policy = await api('/api/v1/infra/policy');
    savedPruneEvery = policy.body?.data?.prune_every_hours ?? null;
    await api('/api/v1/infra/policy', { method: 'PUT', body: JSON.stringify({ prune_every_hours: 0 }) });
  });

  after(async () => {
    if (!API || savedPruneEvery === null) return;
    await api('/api/v1/infra/policy', { method: 'PUT', body: JSON.stringify({ prune_every_hours: savedPruneEvery }) });
  });

  async function up() {
    if (!API) return false;
    try {
      return (await api('/health')).status === 200;
    } catch {
      return false;
    }
  }

  /** One application with one automated case: enough for the planner to queue a run. */
  async function ensureFixtures() {
    const apps = await api('/api/v1/applications');
    let app = (apps.body.data || []).find((a: any) => a.key === APP);
    if (!app) {
      const made = await post('/api/v1/applications', { key: APP, name: 'Infra lifecycle test app', description: 'Fixture for tests/infra.test.ts; safe to delete.', created_by: 'tests/infra' });
      assert.equal(made.status, 201, JSON.stringify(made.body));
      app = made.body.data;
    }
    const caseKey = 'INFRA-TEST-PROBE';
    if ((await api(`/api/v1/test-cases/${caseKey}`)).status !== 200) {
      const made = await post('/api/v1/test-cases', {
        key: caseKey,
        name: 'Infra lifecycle fixture · health probe',
        description: 'Fixture for tests/infra.test.ts. Not a test of any product.',
        application_id: app.id,
        test_type: 'smoke',
        execution_method: 'http',
        steps: [{ action: 'request', method: 'GET', url: '{{engine}}/health', expected_status: 200, description: 'probe' }],
        automation_status: 'automated',
        lifecycle: 'active',
        tags: ['infra-test-fixture'],
        expected_results: 'n/a',
        created_by: 'tests/infra',
      });
      assert.equal(made.status, 201, JSON.stringify(made.body));
    }
  }

  async function ensureEnvironment() {
    await ensureFixtures();
    const body = {
      key: ENV_KEY,
      name: 'Infra lifecycle test stack',
      env_type: 'staging',
      base_url: API,
      status: 'active',
      config: {
        applications: [APP],
        vars: { engine: API },
        infra: { driver: 'compose', script: 'deploy/engine-staging/deploy.mjs', compose_project: 'infra-test-project' },
        deployment: { compose_project: 'infra-test-project', state: 'down' },
      },
    };
    const existing = await api(`/api/v1/environments/${ENV_KEY}`);
    if (existing.status === 200) {
      await api(`/api/v1/environments/${ENV_KEY}`, { method: 'PATCH', body: JSON.stringify({ config: body.config }) });
      return existing.body.data.id as string;
    }
    const made = await post('/api/v1/environments', body);
    assert.equal(made.status, 201, JSON.stringify(made.body));
    return made.body.data.id as string;
  }

  /** Stand in for the agent: claim whatever is queued and complete it with the given outcome. */
  async function actAsAgent(outcome: (job: any) => { status: 'succeeded' | 'failed'; result?: unknown; error?: string }) {
    await post('/api/v1/infra/agents/heartbeat', { id: 'test-agent', name: 'test-agent', host: 'test' });
    const claimed = await post('/api/v1/infra/jobs/claim', { agent_id: 'test-agent' });
    if (claimed.status === 204) return null;
    assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
    const job = claimed.body.data;
    const done = await post(`/api/v1/infra/jobs/${job.id}/complete`, { ...outcome(job), log: 'fake agent' });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    return job;
  }

  async function cancelRun(runId: string) {
    const run = await api(`/api/v1/runs/${runId}`);
    for (const e of run.body?.data?.executions || []) await post(`/api/v1/executions/${e.id}/cancel`, {});
  }

  it('a down stack deploys first when a run is asked for, runs, and is torn down after the run', async (t) => {
    ready = await up();
    if (!ready) return t.skip('set INFRA_TEST_API to a disposable engine');
    const envId = await ensureEnvironment();
    // Drain anything a previous run of this test left queued.
    while (await actAsAgent(() => ({ status: 'failed', error: 'drained by test setup' })));
    await api(`/api/v1/environments/${ENV_KEY}`, { method: 'PATCH', body: JSON.stringify({ config: { deployment: { compose_project: 'infra-test-project', state: 'down' } } }) });

    const asked = await post('/api/v1/runs', { application: APP, environment: ENV_KEY, reason: 'infra test' });
    assert.equal(asked.status, 202, JSON.stringify(asked.body));
    assert.equal(asked.body.data.run_id, null, 'the run must wait for the deploy');
    const deploymentId = asked.body.data.deployment_id as string;
    assert.ok(deploymentId);

    let overview = await api('/api/v1/infra');
    let stack = overview.body.data.environments.find((e: any) => e.key === ENV_KEY);
    assert.equal(stack.state, 'deploying');
    assert.equal(stack.pending_job.kind, 'deploy');

    const job = await actAsAgent(() => ({ status: 'succeeded', result: { commit: 'abc1234', version: '0.0.0-test' } }));
    assert.equal(job.kind, 'deploy');
    assert.equal(job.deployment_id, deploymentId);

    const deployment = await api(`/api/v1/deployments/${deploymentId}`);
    assert.equal(deployment.body.data.status, 'succeeded', JSON.stringify(deployment.body.data));
    assert.equal(deployment.body.data.commit, 'abc1234');
    assert.equal(deployment.body.data.teardown_after_run, true);
    assert.ok(deployment.body.data.run_id, 'the deferred run was queued after the deploy');

    overview = await api('/api/v1/infra');
    stack = overview.body.data.environments.find((e: any) => e.key === ENV_KEY);
    assert.equal(stack.state, 'up');

    // While the run is active the tick must not tear the stack down.
    let tick = await post('/api/v1/infra/tick', {});
    assert.equal(tick.status, 200);
    assert.ok(!tick.body.data.after_run.includes(ENV_KEY));

    // The run ends (cancelled counts as finished — "irrespective of the status").
    await cancelRun(deployment.body.data.run_id);
    tick = await post('/api/v1/infra/tick', {});
    assert.ok(tick.body.data.after_run.includes(ENV_KEY), JSON.stringify(tick.body.data));

    overview = await api('/api/v1/infra');
    stack = overview.body.data.environments.find((e: any) => e.key === ENV_KEY);
    assert.equal(stack.state, 'tearing_down');
    assert.equal(stack.pending_job.kind, 'teardown');

    const teardown = await actAsAgent((j) => {
      assert.equal(j.kind, 'teardown');
      assert.equal(j.params.compose_project, 'infra-test-project');
      assert.equal(j.params.remove_images, true);
      return { status: 'succeeded', result: { swept: { containers: 0 } } };
    });
    assert.ok(teardown);
    overview = await api('/api/v1/infra');
    stack = overview.body.data.environments.find((e: any) => e.key === ENV_KEY);
    assert.equal(stack.state, 'down');
    assert.equal(stack.deployed.torn_down_at ? true : false, true);
  });

  it('deploy_only keeps the stack up and never queues a run; a failed deploy never runs either', async (t) => {
    if (!ready) return t.skip('set INFRA_TEST_API to a disposable engine');
    const only = await post('/api/v1/deployments', { environment_id: ENV_KEY, application: APP, mode: 'deploy_only', ref: 'main' });
    assert.equal(only.status, 202, JSON.stringify(only.body));
    assert.equal(only.body.data.status, 'queued');
    assert.equal(only.body.data.teardown_after_run, false);
    await actAsAgent(() => ({ status: 'succeeded', result: { commit: 'def5678' } }));
    const done = await api(`/api/v1/deployments/${only.body.data.id}`);
    assert.equal(done.body.data.status, 'succeeded');
    assert.equal(done.body.data.run_id, null);
    const tick = await post('/api/v1/infra/tick', {});
    assert.ok(!tick.body.data.after_run.includes(ENV_KEY), 'deploy_only has no run to wait for and no teardown');

    const failing = await post('/api/v1/deployments', { environment_id: ENV_KEY, application: APP, mode: 'deploy_and_run' });
    assert.equal(failing.status, 202);
    await actAsAgent(() => ({ status: 'failed', error: 'docker compose up failed' }));
    const failed = await api(`/api/v1/deployments/${failing.body.data.id}`);
    assert.equal(failed.body.data.status, 'failed');
    assert.equal(failed.body.data.run_id, null, 'a failed deploy never queues a run');
    assert.match(failed.body.data.error, /compose up failed/);
    const overview = await api('/api/v1/infra');
    assert.equal(overview.body.data.environments.find((e: any) => e.key === ENV_KEY).state, 'failed');
  });

  it('a person can tear down and ask for housekeeping; the policy is validated', async (t) => {
    if (!ready) return t.skip('set INFRA_TEST_API to a disposable engine');
    const td = await post('/api/v1/infra/jobs', { kind: 'teardown', environment_id: ENV_KEY });
    assert.ok(td.status === 202 || td.status === 200, JSON.stringify(td.body));
    const job = await actAsAgent(() => ({ status: 'succeeded' }));
    assert.equal(job?.kind, 'teardown');

    const prune = await post('/api/v1/infra/jobs', { kind: 'prune', dry_run: true });
    assert.ok(prune.status === 202 || prune.status === 200, JSON.stringify(prune.body));
    const pruneJob = await actAsAgent((j) => {
      assert.equal(j.kind, 'prune');
      assert.ok(Array.isArray(j.params.projects));
      assert.equal(j.params.dry_run, true);
      return { status: 'succeeded', result: { dry_run: true, removed: { containers: [], images: [] } } };
    });
    assert.ok(pruneJob);

    const bad = await api('/api/v1/infra/policy', { method: 'PUT', body: JSON.stringify({ idle_teardown_hours: -5 }) });
    assert.equal(bad.status, 400);
    const good = await api('/api/v1/infra/policy', { method: 'PUT', body: JSON.stringify({ idle_teardown_hours: 6 }) });
    assert.equal(good.status, 200);
    assert.equal(good.body.data.idle_teardown_hours, 6);
    await api('/api/v1/infra/policy', { method: 'PUT', body: JSON.stringify({ idle_teardown_hours: DEFAULT_INFRA_POLICY.idle_teardown_hours }) });
  });
});
