/**
 * What the Execution Plan records for one schedule firing, from whatever the
 * firing code answered with (summarizeFiring in routes/schedules.ts).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://unused:unused@127.0.0.1:1/unused';
const { summarizeFiring } = await import('../apps/api/src/routes/schedules.js');

describe('summarizeFiring', () => {
  it('a legacy schedule that queued one execution records its id and case count', () => {
    const f = summarizeFiring({ status: 202, body: { data: { id: 'e1', test_case_ids: ['a', 'b', 'c'] } } });
    assert.deepEqual(f, { outcome: 'queued', case_count: 3, execution_id: 'e1', message: null });
  });

  it('an application run records the first execution and notes how many there were', () => {
    const f = summarizeFiring({
      status: 202,
      body: { data: { run_id: 'r1', executions: [{ id: 'x1' }, { id: 'x2' }] } },
      queued: { run_id: 'r1', total_cases: 40 },
    });
    assert.equal(f.outcome, 'queued');
    assert.equal(f.case_count, 40);
    assert.equal(f.execution_id, 'x1');
    assert.equal(f.message, '2 executions in run r1');
  });

  it('a single-execution application run has no extra message', () => {
    const f = summarizeFiring({ status: 202, body: { data: { executions: [{ id: 'x1' }] } }, queued: { run_id: 'r1', total_cases: 5 } });
    assert.equal(f.message, null);
  });

  it('a deployment or deferred run is queued with no execution yet', () => {
    const f = summarizeFiring({ status: 202, body: { message: 'Deployment queued' } });
    assert.deepEqual(f, { outcome: 'queued', case_count: 0, execution_id: null, message: 'Deployment queued' });
  });

  it('a schedule with nothing to run is recorded as skipped, with the reason', () => {
    const f = summarizeFiring({ status: 400, body: { error: 'Schedule "x" has no application, test cases or plan' } });
    assert.equal(f.outcome, 'skipped_empty');
    assert.match(f.message!, /no application/);
  });

  it('any other failure is recorded as an error', () => {
    const f = summarizeFiring({ status: 409, body: { error: 'reached its 3-run limit; paused.' } });
    assert.equal(f.outcome, 'error');
    assert.match(f.message!, /3-run limit/);
  });
});
