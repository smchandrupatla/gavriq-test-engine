import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cronMatches, isDue, isValidExpression, lastFire, nextFire, parseCron, parseOneTime, partsIn } from '../apps/api/src/cron.js';

const utc = (iso: string) => new Date(iso);

describe('cron expressions', () => {
  it('parses fields, lists, ranges, steps and names', () => {
    const spec = parseCron('*/15 2,14 1-7 jan-mar mon-fri')!;
    assert.deepEqual([...spec.minute], [0, 15, 30, 45]);
    assert.deepEqual([...spec.hour], [2, 14]);
    assert.deepEqual([...spec.dom], [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual([...spec.month], [1, 2, 3]);
    assert.deepEqual([...spec.dow], [1, 2, 3, 4, 5]);
    assert.equal(parseCron('@daily')!.hour.size, 1);
    assert.deepEqual([...parseCron('0 0 * * 7')!.dow], [0], '7 is sunday');
  });

  it('rejects malformed expressions', () => {
    for (const bad of ['', '* * * *', '60 * * * *', '* 24 * * *', 'a b c d e', '0 2 * * 8', '*/0 * * * *']) {
      assert.equal(parseCron(bad), null, bad);
      assert.equal(isValidExpression(bad), false, bad);
    }
    assert.equal(isValidExpression('every:15'), true);
    assert.equal(isValidExpression('every:0'), false);
    assert.equal(isValidExpression('0 2 * * *'), true);
  });

  it('evaluates in the schedule time zone', () => {
    // 2026-09-30T16:00Z is 02:00 on 1 Oct in Sydney (UTC+10).
    const t = utc('2026-09-30T16:00:00Z');
    assert.deepEqual(partsIn(t, 'Australia/Sydney'), { minute: 0, hour: 2, dom: 1, month: 10, dow: 4 });
    assert.equal(cronMatches(parseCron('0 2 * * *')!, t, 'Australia/Sydney'), true);
    assert.equal(cronMatches(parseCron('0 2 * * *')!, t, 'UTC'), false);
    assert.equal(cronMatches(parseCron('0 16 * * wed')!, t, 'UTC'), true);
  });

  it('applies the either-or rule when both day fields are restricted', () => {
    const spec = parseCron('0 0 1 * mon')!; // the 1st, or any monday
    assert.equal(cronMatches(spec, utc('2026-10-01T00:00:00Z'), 'UTC'), true, 'thursday the 1st');
    assert.equal(cronMatches(spec, utc('2026-10-05T00:00:00Z'), 'UTC'), true, 'monday the 5th');
    assert.equal(cronMatches(spec, utc('2026-10-06T00:00:00Z'), 'UTC'), false, 'tuesday the 6th');
  });

  it('finds the previous and next firing minute', () => {
    const now = utc('2026-09-30T11:26:40Z');
    assert.equal(lastFire('0 2 * * *', now, 'UTC')!.toISOString(), '2026-09-30T02:00:00.000Z');
    assert.equal(nextFire('0 2 * * *', now, 'UTC')!.toISOString(), '2026-10-01T02:00:00.000Z');
    assert.equal(lastFire('*/15 * * * *', now, 'UTC')!.toISOString(), '2026-09-30T11:15:00.000Z');
    assert.equal(nextFire('0 0 29 feb *', now, 'UTC'), null, 'nothing within a year');
  });

  it('is due once per firing, and not at creation', () => {
    const tz = 'UTC';
    const nightly = { cron_expression: '0 2 * * *', enabled: true, created_at: '2026-09-30T11:00:00Z', updated_at: '2026-09-30T11:00:00Z', last_run_at: null };
    assert.equal(isDue(nightly, utc('2026-09-30T11:26:00Z'), tz), false, 'created after today 02:00 → waits for tomorrow');
    assert.equal(isDue(nightly, utc('2026-10-01T02:00:30Z'), tz), true, 'fires at 02:00');
    assert.equal(isDue({ ...nightly, last_run_at: '2026-10-01T02:00:40Z' }, utc('2026-10-01T02:03:00Z'), tz), false, 'not again in the same window');
    assert.equal(isDue({ ...nightly, last_run_at: '2026-10-01T02:00:40Z' }, utc('2026-10-02T02:01:00Z'), tz), true, 'next night');
    assert.equal(isDue({ ...nightly, enabled: false }, utc('2026-10-01T02:00:30Z'), tz), false);
    assert.equal(isDue({ ...nightly, last_run_at: '2026-10-01T02:00:40Z' }, utc('2026-10-01T09:00:00Z'), tz), false, 'a poller that was down catches up only once');
  });

  it('keeps the interval semantics of every:N', () => {
    const s = { cron_expression: 'every:30', enabled: true, last_run_at: '2026-09-30T11:00:00Z' };
    assert.equal(isDue(s, utc('2026-09-30T11:29:00Z'), 'UTC'), false);
    assert.equal(isDue(s, utc('2026-09-30T11:30:00Z'), 'UTC'), true);
    assert.equal(isDue({ ...s, last_run_at: null }, utc('2026-09-30T11:00:00Z'), 'UTC'), true, 'an interval schedule starts at once');
  });

  it('fires a one-time at:<iso> schedule exactly once', () => {
    assert.equal(isValidExpression('at:2026-10-05T14:00:00Z'), true);
    assert.equal(isValidExpression('at:not-a-date'), false);
    assert.equal(isValidExpression('at:'), false);
    assert.deepEqual(parseOneTime('at:2026-10-05T14:00:00Z'), utc('2026-10-05T14:00:00Z'));
    assert.equal(parseOneTime('0 2 * * *'), null, 'cron expressions are not one-time');

    const once = { cron_expression: 'at:2026-10-05T14:00:00Z', enabled: true, last_run_at: null };
    assert.equal(isDue(once, utc('2026-10-05T13:59:59Z'), 'UTC'), false, 'not yet');
    assert.equal(isDue(once, utc('2026-10-05T14:00:00Z'), 'UTC'), true, 'due at the timestamp');
    assert.equal(isDue(once, utc('2026-10-06T09:00:00Z'), 'UTC'), true, 'still due while never fired, even if the poller was down');
    assert.equal(isDue({ ...once, last_run_at: '2026-10-05T14:00:10Z' }, utc('2026-10-06T09:00:00Z'), 'UTC'), false, 'never again once fired');
    assert.equal(isDue({ ...once, enabled: false }, utc('2026-10-05T14:00:00Z'), 'UTC'), false);
  });
});
