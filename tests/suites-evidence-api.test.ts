/**
 * Suites built in the console, the runs linked to them, the script behind each
 * case, and the catalog audit. Runs against a live engine; skips when it is down.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

try { process.loadEnvFile(); } catch { /* .env is optional */ }
const API = process.env.TEST_ENGINE_API
  || `http://127.0.0.1:${process.env.TEST_ENGINE_HOST_PORT || 8787}`;

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    // Fastify rejects an empty body sent as JSON, so only bodies get a content type.
    headers: { ...(opts.body ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

describe('suites, run links, definitions and audit', () => {
  let available = false;
  let caseA = '';
  let caseB = '';
  let sitCase: { id: string; script: string } | null = null;
  let suiteId = '';

  before(async () => {
    try {
      const meta = await api('/api/v1/meta');
      available = meta.status === 200 && meta.body.service === 'gavriq-test-engine';
    } catch {
      available = false;
    }
    if (!available) return;
    const cases = await api('/api/v1/test-cases?limit=200');
    const rows = cases.body.data as Array<{ id: string; key: string; script: string | null }>;
    assert.ok(rows.length >= 2, 'engine has test cases');
    caseA = rows[0]!.id;
    caseB = rows[1]!.id;
    const sit = rows.find((r) => r.script && r.script.includes('sit/cases/'));
    sitCase = sit ? { id: sit.id, script: sit.script! } : null;
  });

  after(async () => {
    if (available && suiteId) await api(`/api/v1/suites/${suiteId}`, { method: 'DELETE' });
  });

  it('creates a suite from cases of any category, edits it and removes a case', async (t) => {
    if (!available) return t.skip('engine not reachable');
    const bad = await api('/api/v1/suites', json('POST', { name: '' }));
    assert.equal(bad.status, 400);
    const unknown = await api('/api/v1/suites', json('POST', { name: 'x', test_case_ids: ['00000000-0000-0000-0000-000000000000'] }));
    assert.equal(unknown.status, 400);

    const created = await api('/api/v1/suites', json('POST', { name: 'API test suite', description: 'made by a test', test_case_ids: [caseA] }));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    suiteId = created.body.data.id;
    assert.equal(created.body.data.suite_type, 'custom');
    assert.equal(created.body.data.editable, true);

    const put = await api(`/api/v1/suites/${suiteId}/cases`, json('PUT', { test_case_ids: [caseB, caseA] }));
    assert.equal(put.status, 200);
    let view = await api(`/api/v1/suites/${suiteId}`);
    assert.deepEqual(view.body.data.cases.map((c: { id: string }) => c.id), [caseB, caseA]);

    const patched = await api(`/api/v1/suites/${suiteId}`, json('PATCH', { name: 'API test suite (renamed)' }));
    assert.equal(patched.body.data.name, 'API test suite (renamed)');

    const removed = await api(`/api/v1/suites/${suiteId}/cases/${caseB}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    view = await api(`/api/v1/suites/${suiteId}`);
    assert.deepEqual(view.body.data.cases.map((c: { id: string }) => c.id), [caseA]);
  });

  it('keeps seeded suites read-only', async (t) => {
    if (!available) return t.skip('engine not reachable');
    const suites = await api('/api/v1/suites');
    const seeded = (suites.body.data as Array<{ id: string; suite_type: string }>).find((s) => s.suite_type !== 'custom');
    if (!seeded) return t.skip('no seeded suite');
    const r = await api(`/api/v1/suites/${seeded.id}`, json('PATCH', { name: 'nope' }));
    assert.equal(r.status, 409);
    const d = await api(`/api/v1/suites/${seeded.id}`, { method: 'DELETE' });
    assert.equal(d.status, 409);
  });

  it('links a suite run to the suite and to each case, with evidence', async (t) => {
    if (!available || !suiteId) return t.skip('engine not reachable');
    const envs = await api('/api/v1/environments');
    const queued = await api('/api/v1/executions', json('POST', {
      test_suite_id: suiteId, test_case_ids: [caseA], environment_id: envs.body.data[0]?.id, trigger_source: 'api',
    }));
    assert.equal(queued.status, 202);
    const exec = queued.body.data;
    const posted = await api(`/api/v1/executions/${exec.id}/results`, json('POST', {
      test_case_id: caseA, status: 'passed', verdict: 'pass', duration_ms: 42, message: 'ok',
      metrics: { timeseries: [{ t_s: 0, requests: 3, errors: 0, latency_p50_ms: 5, latency_p95_ms: 9 }] },
      evidence: [{ type: 'log', storage_key: 'evidence/api-test.log', content_type: 'text/plain' }],
    }));
    assert.equal(posted.status, 201);
    await api(`/api/v1/executions/${exec.id}/complete`, json('POST', { status: 'passed' }));

    const detail = await api(`/api/v1/executions/${exec.id}`);
    assert.equal(detail.body.data.suite_name, 'API test suite (renamed)');
    const mine = detail.body.data.results.find((r: { test_case_id: string }) => r.test_case_id === caseA);
    assert.ok(mine.test_case_name, 'result carries the case name');
    assert.ok(mine.evidence[0].url.startsWith('/api/v1/evidence/file?key='));

    const runs = await api(`/api/v1/suites/${suiteId}/executions`);
    const run = runs.body.data.find((r: { id: string }) => r.id === exec.id);
    assert.ok(run, 'run listed under the suite');
    assert.ok(run.passed >= 1);

    const history = await api(`/api/v1/test-cases/${caseA}/results`);
    const hit = history.body.data.find((r: { execution_id: string }) => r.execution_id === exec.id);
    assert.equal(hit.execution_key, exec.key);
    assert.equal(hit.suite_name, 'API test suite (renamed)');
    assert.equal(hit.evidence.length, 1);

    const list = await api('/api/v1/executions');
    const row = list.body.data.find((r: { id: string }) => r.id === exec.id);
    assert.equal(row.suite_name, 'API test suite (renamed)');
  });

  it('shows the script behind a SIT case', async (t) => {
    if (!available || !sitCase) return t.skip('no SIT case in this engine');
    const def = await api(`/api/v1/test-cases/${sitCase.id}/definition`);
    assert.equal(def.status, 200);
    assert.equal(def.body.data.kind, 'sit-file');
    assert.ok(def.body.data.file.startsWith('sit/cases/'));
    if (def.body.data.executable) assert.ok(def.body.data.source.length > 20);
  });

  it('lists placeholder cases in the catalog audit', async (t) => {
    if (!available) return t.skip('engine not reachable');
    const a = await api('/api/v1/catalog-audit');
    assert.equal(a.status, 200);
    const d = a.body.data;
    assert.equal(d.total, d.executable + d.placeholders.length + d.stale.length);
    for (const p of d.placeholders) assert.ok(p.reason);
  });
});
