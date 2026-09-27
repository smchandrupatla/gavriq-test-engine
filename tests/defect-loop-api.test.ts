/**
 * Defect loop against a live engine: failing run → defect report → PM claims →
 * fixer marks fixed → PM requests rerun → rerun passes → verified.
 *
 * Needs a disposable engine (it claims queued executions as a fake worker):
 *   ENGINE_IT_BASE=http://127.0.0.1:8897 npx tsx --test tests/defect-loop-api.test.ts
 * Skipped when ENGINE_IT_BASE is unset.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.ENGINE_IT_BASE?.replace(/\/$/, '');
const tag = Date.now().toString(36);

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, body: json as any };
}

/** Claim the next queued execution, report one result per case, complete it. */
async function runAsWorker(outcomes: Record<string, 'passed' | 'failed'>) {
  await call('POST', '/api/v1/workers/register', { id: `it-worker-${tag}`, name: 'defect loop IT' });
  const claimed = await call('POST', '/api/v1/executions/claim', { worker_id: `it-worker-${tag}` });
  assert.equal(claimed.status, 200, 'expected a queued execution to claim');
  const exec = claimed.body.data;
  let anyFailed = false;
  for (const caseId of exec.test_case_ids as string[]) {
    const status = outcomes[caseId] ?? 'passed';
    anyFailed ||= status === 'failed';
    const r = await call('POST', `/api/v1/executions/${exec.id}/results`, {
      test_case_id: caseId, status,
      message: status === 'failed' ? `expected 200 got 500 (req ${Math.random()})` : null,
      classification: status === 'failed' ? 'assertion_failure' : null,
    });
    assert.equal(r.status, 201);
  }
  return call('POST', `/api/v1/executions/${exec.id}/complete`, { status: anyFailed ? 'failed' : 'passed' });
}

describe('defect loop API', { skip: !BASE && 'set ENGINE_IT_BASE to run' }, () => {
  it('files, fixes, reruns and verifies a defect; refuses shortcuts', async () => {
    const apps = await call('GET', '/api/v1/applications');
    const app = apps.body.data.find((a: any) => a.key === 'sand-bench');
    const mk = async (k: string) => (await call('POST', '/api/v1/test-cases', {
      key: `IT-${tag}-${k}`, name: `Defect loop ${k}`, application_id: app.id, test_type: 'api',
    })).body.data.id as string;
    const good = await mk('good');
    const bad = await mk('bad');

    // 1. A failing run files a report with one defect.
    const q = await call('POST', '/api/v1/executions', { test_case_ids: [good, bad] });
    assert.equal(q.status, 202);
    const done = await runAsWorker({ [bad]: 'failed' });
    assert.equal(done.body.defects.outcome, 'report');
    assert.equal(done.body.defects.created, 1);
    const reportKey = done.body.defects.report_key as string;

    // Replaying the ingest is a no-op.
    const again = await call('POST', `/api/v1/executions/${done.body.data.id}/ingest-defects`);
    assert.equal(again.body.data.outcome, 'already_ingested');

    const open = await call('GET', '/api/v1/defect-reports?status=open');
    assert.ok(open.body.data.some((r: any) => r.key === reportKey));
    let report = (await call('GET', `/api/v1/defect-reports/${reportKey}`)).body.data;
    assert.equal(report.defects.length, 1);
    const defect = report.defects[0];
    assert.equal(defect.test_case_id, bad);
    assert.equal(defect.severity, 'high');

    // 2. Rerun before claim/fix is refused; agents cannot self-verify.
    assert.equal((await call('POST', `/api/v1/defect-reports/${reportKey}/rerun`, { by: 'it' })).status, 409);
    assert.equal((await call('PATCH', `/api/v1/defects/${defect.key}`, { status: 'verified', by: 'it' })).status, 403);

    // 3. PM claims, fixer fixes, PM asks for the rerun.
    const claim = await call('POST', `/api/v1/defect-reports/${reportKey}/claim`, { by: 'product-manager' });
    assert.equal(claim.body.data.status, 'with_pm');
    assert.equal((await call('POST', `/api/v1/defect-reports/${reportKey}/rerun`, { by: 'pm' })).status, 409, 'unfixed defect blocks rerun');
    const fixed = await call('PATCH', `/api/v1/defects/${defect.key}`, {
      status: 'fixed', fix_ref: 'https://github.com/example/pr/1', by: 'developer-1',
    });
    assert.equal(fixed.body.data.status, 'fixed');
    assert.equal((await call('GET', `/api/v1/defect-reports/${reportKey}`)).body.data.status, 'fixing');

    const rerun = await call('POST', `/api/v1/defect-reports/${reportKey}/rerun`, { by: 'product-manager' });
    assert.equal(rerun.status, 202);
    assert.deepEqual(rerun.body.data.execution && [rerun.body.data.report.status], ['rerunning']);
    assert.equal((await call('POST', `/api/v1/defect-reports/${reportKey}/rerun`, { by: 'pm' })).status, 409, 'one rerun at a time');

    // 4. The rerun still fails → reopened, back to the PM.
    const fail = await runAsWorker({ [bad]: 'failed' });
    assert.equal(fail.body.defects.outcome, 'rerun');
    report = (await call('GET', `/api/v1/defect-reports/${reportKey}`)).body.data;
    assert.equal(report.status, 'reopened');
    assert.equal(report.defects[0].status, 'reopened');

    // 5. Second round passes → verified.
    await call('POST', `/api/v1/defect-reports/${reportKey}/claim`, { by: 'product-manager' });
    await call('PATCH', `/api/v1/defects/${defect.key}`, { status: 'fixed', by: 'developer-2' });
    assert.equal((await call('POST', `/api/v1/defect-reports/${reportKey}/rerun`, { by: 'product-manager' })).status, 202);
    await runAsWorker({ [bad]: 'passed' });
    report = (await call('GET', `/api/v1/defect-reports/${reportKey}`)).body.data;
    assert.equal(report.status, 'verified');
    assert.equal(report.defects[0].status, 'verified');
    assert.equal(report.defects[0].rerun_attempts, 2);
    assert.equal(report.rerun_count, 2);

    // 6. The same failure later is a regression: a new report with a new defect
    //    linked to the verified one; the verified report keeps its record.
    await call('POST', '/api/v1/executions', { test_case_ids: [bad] });
    const regress = await runAsWorker({ [bad]: 'failed' });
    assert.equal(regress.body.defects.outcome, 'report');
    assert.equal(regress.body.defects.regressed, 1);
    assert.equal(regress.body.defects.created, 0);
    const fresh = (await call('GET', `/api/v1/defect-reports/${regress.body.defects.report_key}`)).body.data;
    assert.equal(fresh.defects.length, 1);
    assert.equal(fresh.defects[0].status, 'open');
    assert.equal(fresh.defects[0].regression_of, defect.id);
    assert.equal(fresh.defects[0].regression_of_key, defect.key);
    const old = (await call('GET', `/api/v1/defect-reports/${reportKey}`)).body.data;
    assert.equal(old.status, 'verified');
    assert.equal(old.defects.length, 1);
    assert.equal(old.defects[0].status, 'verified');

    // A further failure of the same signature only counts against the new defect.
    await call('POST', '/api/v1/executions', { test_case_ids: [bad] });
    const again2 = await runAsWorker({ [bad]: 'failed' });
    assert.equal(again2.body.defects.outcome, 'recurring_only');

    const overview = await call('GET', '/api/v1/defect-manager/overview');
    assert.ok(overview.body.data.awaiting_pm >= 1);
  });
});
