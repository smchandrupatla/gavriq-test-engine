import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CronError, describeCron, isValidTimezone, nextRun, parseCron, upcoming } from '../apps/api/src/schedule/cron.ts';

const at = (iso: string) => new Date(iso);
const iso = (d: Date | null) => d?.toISOString() ?? null;

describe('parseCron', () => {
  it('parses lists, ranges, steps and names', () => {
    const s = parseCron('*/15 8-18/2 1,15 jan-mar mon-fri');
    assert.equal(s.kind, 'cron');
    if (s.kind !== 'cron') return;
    assert.deepEqual([...s.minute], [0, 15, 30, 45]);
    assert.deepEqual([...s.hour], [8, 10, 12, 14, 16, 18]);
    assert.deepEqual([...s.dom], [1, 15]);
    assert.deepEqual([...s.month], [1, 2, 3]);
    assert.deepEqual([...s.dow], [1, 2, 3, 4, 5]);
  });

  it('treats 7 as Sunday and accepts aliases and legacy forms', () => {
    const s = parseCron('0 0 * * 7');
    assert.ok(s.kind === 'cron' && s.dow.has(0) && !s.dow.has(7));
    assert.equal(parseCron('@daily').kind, 'cron');
    assert.deepEqual(parseCron('every:30'), { kind: 'interval', minutes: 30 });
    assert.equal(parseCron('hourly').kind, 'cron');
  });

  it('rejects malformed expressions with a reason', () => {
    for (const bad of ['', '* * * *', '60 * * * *', '* 24 * * *', '*/0 * * * *', '5-1 * * * *', 'every:0', '* * * foo *']) {
      assert.throws(() => parseCron(bad), CronError, bad);
    }
  });
});

describe('nextRun', () => {
  it('finds the next weekday 02:00 in UTC', () => {
    // 2026-09-26 is a Saturday.
    assert.equal(iso(nextRun(parseCron('0 2 * * 1-5'), at('2026-09-26T10:00:00Z'))), '2026-09-28T02:00:00.000Z');
  });

  it('is strictly after the given time', () => {
    assert.equal(iso(nextRun(parseCron('0 * * * *'), at('2026-09-26T10:00:00Z'))), '2026-09-26T11:00:00.000Z');
  });

  it('evaluates in the schedule timezone', () => {
    // 09:00 in Kolkata (UTC+5:30) is 03:30 UTC.
    assert.equal(iso(nextRun(parseCron('0 9 * * *'), at('2026-09-26T00:00:00Z'), 'Asia/Kolkata')), '2026-09-26T03:30:00.000Z');
  });

  it('handles a DST change day without skipping midnight', () => {
    // US spring-forward 2027-03-14; the next day's midnight must still fire.
    const runs = upcoming('0 0 * * *', at('2027-03-13T12:00:00Z'), 'America/New_York', 3);
    assert.deepEqual(runs.map(iso), [
      '2027-03-14T05:00:00.000Z', '2027-03-15T04:00:00.000Z', '2027-03-16T04:00:00.000Z',
    ]);
  });

  it('ORs day-of-month and day-of-week when both are restricted', () => {
    // 1st of the month OR a Monday; after Sat 2026-09-26 → Mon 09-28.
    assert.equal(iso(nextRun(parseCron('0 0 1 * 1'), at('2026-09-26T00:00:00Z'))), '2026-09-28T00:00:00.000Z');
  });

  it('returns null for dates that never occur', () => {
    assert.equal(nextRun(parseCron('0 0 31 2 *'), at('2026-01-01T00:00:00Z')), null);
  });

  it('anchors every:N on the last run and skips missed slots', () => {
    const spec = parseCron('every:60');
    assert.equal(iso(nextRun(spec, at('2026-09-26T10:30:00Z'), 'UTC', at('2026-09-26T10:00:00Z'))), '2026-09-26T11:00:00.000Z');
    assert.equal(iso(nextRun(spec, at('2026-09-26T15:10:00Z'), 'UTC', at('2026-09-26T10:00:00Z'))), '2026-09-26T16:00:00.000Z');
    assert.equal(iso(nextRun(spec, at('2026-09-26T10:30:20Z'))), '2026-09-26T10:31:00.000Z', 'never run → next minute');
  });
});

describe('upcoming', () => {
  it('lists the next N occurrences up to a horizon', () => {
    const runs = upcoming('*/30 * * * *', at('2026-09-26T10:00:00Z'), 'UTC', 10, at('2026-09-26T11:30:00Z'));
    assert.deepEqual(runs.map(iso), ['2026-09-26T10:30:00.000Z', '2026-09-26T11:00:00.000Z', '2026-09-26T11:30:00.000Z']);
  });
});

describe('describeCron', () => {
  it('reads common shapes in plain words', () => {
    assert.equal(describeCron('*/15 * * * *'), 'Every 15 minutes');
    assert.equal(describeCron('5 * * * *'), 'Hourly at :05');
    assert.equal(describeCron('0 2 * * *'), 'Daily at 02:00');
    assert.equal(describeCron('30 6 * * 1-5'), 'Weekdays at 06:30');
    assert.equal(describeCron('0 9,17 * * *'), 'Daily at 09:00, 17:00');
    assert.equal(describeCron('0 3 * * sat,sun'), 'Sun, Sat at 03:00');
    assert.equal(describeCron('0 4 1 * *'), 'Monthly on day 1 at 04:00');
    assert.equal(describeCron('every:45'), 'Every 45 minutes');
    assert.equal(describeCron('daily'), 'Daily at 00:00');
    assert.equal(describeCron('0 0 1 1 *'), 'Cron 0 0 1 1 *');
  });

  it('validates IANA timezones', () => {
    assert.ok(isValidTimezone('Europe/London'));
    assert.ok(!isValidTimezone('Mars/Olympus'));
  });
});
