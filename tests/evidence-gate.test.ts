/**
 * Evidence gate + run trigger API, end to end, with this test acting as the worker.
 *
 * It claims executions, so it must never point at a shared engine: it only runs
 * when EVIDENCE_TEST_API names a disposable instance started with
 * EVIDENCE_GATE=enforce. Otherwise every case skips.
 *
 *   EVIDENCE_TEST_API=http://127.0.0.1:8799 npx tsx --test tests/evidence-gate.test.ts
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const API = process.env.EVIDENCE_TEST_API || '';
// Runners write locally first; keep that away from the repo's evidence folder.
process.env.EVIDENCE_DIR = mkdtempSync(path.join(os.tmpdir(), 'gte-evidence-'));

const { runHttp } = await import('../apps/worker/src/runners/http.js');
const { ensureEvidence, evidencePreflight, publishEvidence, redact, secretValues } = await import('../apps/worker/src/evidence.js');

const HEADERS = { 'content-type': 'application/json' };
const APP = 'gavriq-test-engine';
const ENV_KEY = 'evidence-gate-test';

async function api(route: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${route}`, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) } });
  const body: any = res.status === 204 ? null : await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const post = (route: string, body: unknown) => api(route, { method: 'POST', body: JSON.stringify(body) });

/** Queue a one-case run and claim it as a worker. */
async function startRun(caseKey: string) {
  const triggered = await post('/api/v1/runs', {
    application: APP,
    environment: ENV_KEY,
    scope: { case_keys: [caseKey] },
    reason: 'evidence gate test',
    trigger_source: 'ci',
  });
  assert.equal(triggered.status, 202, JSON.stringify(triggered.body));
  const runId: string = triggered.body.data.run_id;

  const workerId = `gate-test-${Date.now()}`;
  await post('/api/v1/workers/register', { id: workerId, name: 'Gate test worker', capabilities: ['http'] });
  const claimed = await post('/api/v1/executions/claim', { worker_id: workerId });
  assert.equal(claimed.status, 200, 'nothing to claim — is another worker attached to this instance?');
  assert.equal(claimed.body.data.metadata.run_group, runId, 'claimed an execution of another run');
  return { runId, execution: claimed.body.data, caseId: claimed.body.data.test_case_ids[0] as string };
}

describe('evidence gate and run trigger', () => {
  let ready = false;
  let caseKey = '';

  before(async () => {
    if (!API) return;
    try {
      const health = await api('/health');
      if (health.status !== 200) return;
      const made = await post('/api/v1/environments', { key: ENV_KEY, name: 'Evidence gate test', env_type: 'localhost', base_url: API, config: { vars: { engine: API, password: 'sup3r-s3cret-pw' } } });
      assert.ok(made.status === 201 || made.status === 500 || made.status === 409, JSON.stringify(made.body));
      const plan = await post('/api/v1/runs', { application: APP, environment: ENV_KEY, scope: { methods: ['http'] }, dry_run: true });
      if (plan.status !== 200 || plan.body.data.evidence_gate !== 'enforce' || !plan.body.data.total_cases) return;
      const cases = await api('/api/v1/test-cases?limit=200');
      const found = (cases.body.data || []).find((c: any) => c.execution_method === 'http' && String(c.key).startsWith('TE-'));
      caseKey = found?.key || '';
      ready = Boolean(caseKey);
    } catch {
      ready = false;
    }
  });

  it('masks secrets before they reach an evidence file', () => {
    const vars = { password: 'sup3r-s3cret-pw', token: 'abcdef123456', tenant: 'acme-demo' };
    const out = redact(
      { headers: { authorization: 'Bearer abcdef123456', accept: 'json' }, note: 'login as acme-demo with sup3r-s3cret-pw', nested: [{ api_key: 'k' }] },
      secretValues(vars)
    ) as any;
    assert.equal(out.headers.authorization, '[REDACTED]');
    assert.equal(out.headers.accept, 'json');
    assert.equal(out.nested[0].api_key, '[REDACTED]');
    assert.ok(!JSON.stringify(out).includes('sup3r-s3cret-pw'));
    assert.ok(out.note.includes('acme-demo'));
  });

  it('builds evidence for runners that report through metrics', () => {
    const items = ensureEvidence(
      { status: 'passed', message: 'perf ok', duration_ms: 900, metrics: { latency_p95_ms: 120, rps: 40 } },
      { method: 'performance', caseKey: 'TC-PERF', rules: { sla: { p95_ms: 2000 } } }
    );
    assert.equal(items.length, 1);
    assert.equal(items[0]!.type, 'metric');
    assert.deepEqual(ensureEvidence({ status: 'skipped', message: '', duration_ms: 0 }, { method: 'sit' }), []);
  });

  it('plans a run without queueing anything when dry_run is set', async (t) => {
    if (!ready) return t.skip('set EVIDENCE_TEST_API to a disposable engine running EVIDENCE_GATE=enforce');
    const plan = await post('/api/v1/runs', { application: APP, environment: ENV_KEY, dry_run: true });
    assert.equal(plan.status, 200);
    assert.ok(plan.body.data.total_cases > 0);
    assert.ok(Array.isArray(plan.body.data.suites));
    assert.equal((await post('/api/v1/runs', { application: 'no-such-app', environment: ENV_KEY })).status, 404);
    assert.equal((await post('/api/v1/runs', { application: APP, environment: 'no-such-env' })).status, 404);
    assert.equal((await post('/api/v1/runs', { application: APP })).status, 400);
  });

  it('does not count a pass that has no evidence', async (t) => {
    if (!ready) return t.skip('set EVIDENCE_TEST_API to a disposable engine running EVIDENCE_GATE=enforce');
    const { runId, execution, caseId } = await startRun(caseKey);

    const recorded = await post(`/api/v1/executions/${execution.id}/results`, {
      test_case_id: caseId,
      status: 'passed',
      verdict: 'pass',
      duration_ms: 12,
      message: 'claimed pass',
      evidence: [{ type: 'http_transcript', storage_key: 'evidence/never-written.json' }],
    });
    assert.equal(recorded.status, 201, JSON.stringify(recorded.body));
    assert.equal(recorded.body.data.status, 'error');
    assert.equal(recorded.body.data.verdict, 'inconclusive');
    assert.equal(recorded.body.data.metrics.evidence_gate.claimed_status, 'passed');

    const done = await post(`/api/v1/executions/${execution.id}/complete`, { status: 'passed' });
    assert.equal(done.body.data.status, 'failed', 'worker claimed passed; the gate decides');

    const run = await api(`/api/v1/runs/${runId}`);
    assert.equal(run.body.data.state, 'completed');
    assert.equal(run.body.data.verdict, 'inconclusive');
    assert.equal(run.body.data.exit_criteria.met, false);
    assert.equal(run.body.data.totals.evidence_items, 0);
  });

  it('rejects the wrong kind of evidence for the runner', async (t) => {
    if (!ready) return t.skip('set EVIDENCE_TEST_API to a disposable engine running EVIDENCE_GATE=enforce');
    const { execution, caseId } = await startRun(caseKey);
    const uploaded = await post('/api/v1/evidence/upload', {
      execution_id: execution.id,
      name: 'note.txt',
      evidence_type: 'log',
      content_type: 'text/plain',
      content_base64: Buffer.from('it worked, trust me').toString('base64'),
    });
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));

    const recorded = await post(`/api/v1/executions/${execution.id}/results`, {
      test_case_id: caseId,
      status: 'passed',
      verdict: 'pass',
      message: 'pass with a log only',
      evidence: [{ type: 'log', storage_key: uploaded.body.data.storage_key }],
    });
    assert.equal(recorded.body.data.status, 'error');
    assert.match(recorded.body.data.message, /needs http_transcript/);
    await post(`/api/v1/executions/${execution.id}/complete`, { status: 'passed' });
  });

  it('accepts a real HTTP run with its transcript and meets the exit criteria', async (t) => {
    if (!ready) return t.skip('set EVIDENCE_TEST_API to a disposable engine running EVIDENCE_GATE=enforce');
    const preflight = await evidencePreflight(API, HEADERS);
    assert.deepEqual(preflight, { ok: true });

    const { runId, execution, caseId } = await startRun(caseKey);
    const result = await runHttp({
      baseUrl: API,
      vars: { engine: API, password: 'sup3r-s3cret-pw' },
      steps: [
        { action: 'request', method: 'GET', url: '{{engine}}/health', expected_status: 200, expect_json: [{ path: 'status', equals: 'ok' }], description: 'health' },
        { action: 'request', method: 'POST', url: '{{engine}}/api/v1/runs', headers: { authorization: 'Bearer {{password}}' }, body: { application: APP, environment: ENV_KEY, dry_run: true, note: '{{password}}' }, expected_status: 200, description: 'dry run' },
      ],
    });
    assert.equal(result.status, 'passed', result.message);
    assert.equal(result.evidence?.length, 1);

    const evidence = await publishEvidence(result.evidence || [], { api: API, headers: HEADERS, executionId: execution.id, caseKey });
    assert.equal(evidence.length, 1);
    assert.ok(evidence[0]!.storage_key.startsWith(`evidence/${execution.id}/`));

    const recorded = await post(`/api/v1/executions/${execution.id}/results`, {
      test_case_id: caseId,
      status: result.status,
      verdict: 'pass',
      duration_ms: result.duration_ms,
      message: result.message,
      metrics: result.metrics,
      evidence,
    });
    assert.equal(recorded.body.data.status, 'passed', JSON.stringify(recorded.body));

    const done = await post(`/api/v1/executions/${execution.id}/complete`, { status: 'failed' });
    assert.equal(done.body.data.status, 'passed', 'the recorded results decide, not the claim');
    assert.equal(done.body.data.metadata.exit_criteria.met, true);
    assert.equal(done.body.data.metadata.exit_criteria.claimed_status, 'failed');

    const run = await api(`/api/v1/runs/${runId}`);
    assert.equal(run.body.data.verdict, 'pass');
    assert.equal(run.body.data.exit_criteria.met, true);
    assert.equal(run.body.data.totals.without_evidence, 0);

    const manifest = await api(`/api/v1/runs/${runId}/evidence`);
    const item = manifest.body.data.cases[0].evidence[0];
    assert.equal(item.type, 'http_transcript');
    assert.match(item.sha256, /^[0-9a-f]{64}$/);

    const file = await fetch(`${API}${item.url}`);
    assert.equal(file.status, 200);
    const transcript: any = await file.json();
    assert.equal(transcript.exchanges.length, 2);
    assert.equal(transcript.exchanges[0].response.status, 200);
    assert.equal(transcript.exchanges[1].request.headers.authorization, '[REDACTED]');
    assert.ok(!JSON.stringify(transcript).includes('sup3r-s3cret-pw'), 'secret leaked into evidence');
  });

  it('keeps a failure on record when the target never answers', async () => {
    const result = await runHttp({ baseUrl: 'http://127.0.0.1:9', timeoutSeconds: 2, steps: [{ action: 'request', path: '/health' }] });
    assert.equal(result.status, 'failed');
    assert.equal(result.evidence?.length, 1, 'a refused connection still leaves a transcript');
  });

  it('refuses keys that point outside the evidence store', async (t) => {
    if (!ready) return t.skip('set EVIDENCE_TEST_API to a disposable engine running EVIDENCE_GATE=enforce');
    for (const key of ['../package.json', 'evidence/../../package.json', 'evidence/a/b/c.png', '/etc/passwd']) {
      const res = await fetch(`${API}/api/v1/evidence/file?key=${encodeURIComponent(key)}`);
      assert.equal(res.status, 404, key);
    }
    const bad = await post('/api/v1/evidence/upload', { probe: true, name: '../escape.txt', content_base64: 'eA==' });
    assert.ok(bad.status === 201 || bad.status === 400);
    if (bad.status === 201) assert.equal(bad.body.data.storage_key, 'evidence/_probe/escape.txt');
  });
});
