/**
 * Scheduler against a live, disposable engine (it queues executions):
 *   SCHEDULER_TICK_MS=2000 on the engine, then
 *   ENGINE_IT_BASE=http://127.0.0.1:8897 npx tsx --test tests/scheduler-api.test.ts
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

describe('scheduler API', { skip: !BASE && 'set ENGINE_IT_BASE to run' }, () => {
  it('runs now, schedules, skips overlaps, plans and fires on time', { timeout: 120_000 }, async () => {
    const app = (await call('GET', '/api/v1/applications')).body.data.find((a: any) => a.key === 'sand-bench');
    const mk = async (k: string, extra: Record<string, unknown>) => (await call('POST', '/api/v1/test-cases', {
      key: `SCH-${tag}-${k}`, name: `Scheduler ${k}`, application_id: app.id, ...extra,
    })).body.data.id as string;
    const apiCase = await mk('api', { test_type: 'api', tags: [`t${tag}`] });
    const sitCase = await mk('sit', { tags: ['sit'] });
    const suite = (await call('POST', '/api/v1/suites', { key: `sch-${tag}`, name: `Sched suite ${tag}`, application_id: app.id })).body.data;
    assert.ok(suite?.id, 'suite created');
    await call('POST', `/api/v1/suites/${suite.id}/cases`, { test_case_ids: [apiCase] });

    // Options + previews
    const opts = (await call('GET', '/api/v1/scheduler/options')).body.data;
    assert.ok(opts.types.some((t: any) => t.id === 'sit'));
    assert.ok(opts.presets.length >= 3);
    const byTag = (await call('POST', '/api/v1/scheduler/preview', { target: { scope: 'types', types: [`t${tag}`] } })).body.data;
    assert.equal(byTag.case_count, 1, 'type matches by tag');
    const sitOnly = (await call('POST', '/api/v1/scheduler/preview', { target: { scope: 'types', types: ['sit'] } })).body.data;
    assert.ok(sitOnly.case_count >= 1);
    const apiType = (await call('POST', '/api/v1/scheduler/preview', { target: { scope: 'types', types: ['api'] } })).body.data;
    assert.ok(apiType.case_count >= 1);
    assert.equal((await call('POST', '/api/v1/scheduler/preview', { target: { scope: 'types', types: [] } })).status, 400);
    assert.equal((await call('POST', '/api/v1/scheduler/preview', { target: { scope: 'nope' } })).status, 400);

    const cp = (await call('POST', '/api/v1/scheduler/cron-preview', { cron_expression: '30 6 * * 1-5', timezone: 'UTC' })).body.data;
    assert.equal(cp.description, 'Weekdays at 06:30');
    assert.equal(cp.next.length, 5);
    assert.equal((await call('POST', '/api/v1/scheduler/cron-preview', { cron_expression: '61 * * * *' })).status, 400);
    assert.equal((await call('POST', '/api/v1/scheduler/cron-preview', { cron_expression: '* * * * *', timezone: 'Mars/Base' })).status, 400);

    // Run now
    const rn = await call('POST', '/api/v1/scheduler/run-now', { target: { scope: 'suites', suite_ids: [suite.id] } });
    assert.equal(rn.status, 202);
    assert.equal(rn.body.data.case_count, 1);
    const exec = (await call('GET', `/api/v1/executions/${rn.body.data.execution.id}`)).body.data;
    assert.deepEqual(exec.test_case_ids, [apiCase]);
    assert.equal(exec.trigger_source, 'manual');
    const empty = await call('POST', '/api/v1/scheduler/run-now', { target: { scope: 'cases', case_ids: ['00000000-0000-4000-8000-000000000000'] } });
    assert.equal(empty.status, 400);

    // Schedule validation + create
    assert.equal((await call('POST', '/api/v1/schedules', { name: 'bad', cron_expression: 'nope', target: { scope: 'all' } })).status, 400);
    assert.equal((await call('POST', '/api/v1/schedules', { name: 'no target', cron_expression: '0 2 * * *' })).status, 400);
    const created = await call('POST', '/api/v1/schedules', {
      name: `Nightly ${tag}`, cron_expression: '0 2 * * *', timezone: 'Asia/Kolkata', target: { scope: 'types', types: [`t${tag}`] },
    });
    assert.equal(created.status, 201);
    const sch = created.body.data;
    assert.equal(sch.cron_description, 'Daily at 02:00');
    assert.equal(sch.target_description, `Types: t${tag}`);
    assert.ok(sch.next_run_at && new Date(sch.next_run_at) > new Date());
    assert.equal(new Date(sch.next_run_at).getUTCHours() * 60 + new Date(sch.next_run_at).getUTCMinutes(), 20 * 60 + 30, '02:00 IST = 20:30 UTC');

    // Pause clears next run; resume restores it
    const paused = (await call('PATCH', `/api/v1/schedules/${sch.id}`, { enabled: false })).body.data;
    assert.equal(paused.next_run_at, null);
    const resumed = (await call('PATCH', `/api/v1/schedules/${sch.id}`, { enabled: true })).body.data;
    assert.ok(resumed.next_run_at);

    // Manual run, then a second run while the first is still queued → overlap skip
    const first = await call('POST', `/api/v1/schedules/${sch.id}/run`, {});
    assert.equal(first.status, 202);
    assert.equal(first.body.data.outcome, 'queued');
    const second = await call('POST', `/api/v1/schedules/${sch.id}/run`, {});
    assert.equal(second.body.data.outcome, 'skipped_overlap');

    // Ticker: an every-minute schedule fires by itself
    const minutely = (await call('POST', '/api/v1/schedules', {
      name: `Minutely ${tag}`, cron_expression: '* * * * *', target: { scope: 'cases', case_ids: [sitCase] },
    })).body.data;
    let fired: any = null;
    for (let i = 0; i < 45 && !fired; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const list = (await call('GET', '/api/v1/schedules')).body.data;
      const row = list.find((x: any) => x.id === minutely.id);
      if (row?.last_run_at) fired = row;
    }
    assert.ok(fired, 'ticker fired the every-minute schedule within 90s');
    assert.equal(fired.last_outcome, 'queued');
    assert.ok(new Date(fired.next_run_at) > new Date(fired.last_run_at));

    // Plan shows upcoming occurrences and recent firings
    const plan = (await call('GET', '/api/v1/scheduler/plan?hours=48')).body.data;
    assert.ok(plan.ticker.running);
    assert.ok(plan.upcoming.some((u: any) => u.schedule_id === sch.id));
    assert.ok(plan.upcoming.filter((u: any) => u.schedule_id === minutely.id).length >= 40, 'minutely has many upcoming slots');
    const recentForSch = plan.recent.filter((r: any) => r.schedule_id === sch.id).map((r: any) => r.outcome);
    assert.deepEqual(recentForSch.sort(), ['queued', 'skipped_overlap']);
    assert.ok(plan.recent.some((r: any) => r.schedule_id === null && r.trigger === 'manual'), 'Run now is in the log');
    assert.ok(plan.defects && typeof plan.defects.awaiting_pm === 'number');

    // Delete keeps history
    assert.equal((await call('DELETE', `/api/v1/schedules/${minutely.id}`)).status, 204);
    assert.equal((await call('DELETE', `/api/v1/schedules/${minutely.id}`)).status, 404);
    await call('DELETE', `/api/v1/schedules/${sch.id}`);
    const after = (await call('GET', '/api/v1/scheduler/plan?hours=48')).body.data;
    assert.ok(!after.upcoming.some((u: any) => u.schedule_id === sch.id));
    assert.ok(after.recent.some((r: any) => r.execution_id === first.body.data.execution.id));
  });
});
