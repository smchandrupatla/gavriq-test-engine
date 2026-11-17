/**
 * Schedule expressions, evaluated at minute resolution in one time zone
 * (SCHEDULER_TZ, default UTC):
 *
 *   "0 2 * * *"          five-field cron: minute hour day-of-month month day-of-week
 *                        (*, lists, ranges, steps, jan-dec / sun-sat names, 7 = sunday)
 *   @hourly @daily @midnight @weekly, hourly, daily      cron shorthands
 *   every:N              every N minutes since the last run (interval, not aligned)
 *   at:<ISO-8601>         one-time: due once now >= the timestamp, never again
 *                        once last_run_at is set (see isDue)
 */
export interface CronSpec {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
  domAny: boolean;
  dowAny: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SHORTHANDS: Record<string, string> = {
  '@hourly': '0 * * * *',
  hourly: '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  daily: '0 0 * * *',
  '@weekly': '0 0 * * 0',
  weekly: '0 0 * * 0',
};

export function defaultTimeZone(): string {
  const tz = process.env.SCHEDULER_TZ || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function parseField(field: string, min: number, max: number, names: string[] = []): { values: Set<number>; any: boolean } | null {
  const values = new Set<number>();
  let any = false;
  const num = (token: string): number | null => {
    const t = token.toLowerCase();
    const named = names.indexOf(t.slice(0, 3));
    if (named >= 0) return named + min;
    if (!/^\d+$/.test(t)) return null;
    return Number(t);
  };
  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!rangePart || !Number.isInteger(step) || step < 1) return null;
    let lo: number | null;
    let hi: number | null;
    if (rangePart === '*') {
      lo = min;
      hi = max;
      if (step === 1) any = true;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-');
      lo = num(a || '');
      hi = num(b || '');
    } else {
      lo = num(rangePart);
      hi = stepPart === undefined ? lo : max;
    }
    if (lo === null || hi === null) return null;
    // Sunday may be written as 7.
    if (names === DAYS) {
      if (lo === 7) lo = 0;
      if (hi === 7) hi = 0;
    }
    if (lo < min || hi > max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return { values, any };
}

export function parseCron(expr: string): CronSpec | null {
  const text = SHORTHANDS[expr.trim().toLowerCase()] || expr.trim();
  const fields = text.split(/\s+/);
  if (fields.length !== 5) return null;
  const minute = parseField(fields[0]!, 0, 59);
  const hour = parseField(fields[1]!, 0, 23);
  const dom = parseField(fields[2]!, 1, 31);
  const month = parseField(fields[3]!, 1, 12, MONTHS);
  const dow = parseField(fields[4]!, 0, 6, DAYS);
  if (!minute || !hour || !dom || !month || !dow) return null;
  return {
    minute: minute.values,
    hour: hour.values,
    dom: dom.values,
    month: month.values,
    dow: dow.values,
    domAny: dom.any,
    dowAny: dow.any,
  };
}

// Building a DateTimeFormat costs far more than using one; the scanners below call this per minute.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      minute: 'numeric',
      hour: 'numeric',
      day: 'numeric',
      month: 'numeric',
      weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a time zone. */
export function partsIn(date: Date, tz: string): { minute: number; hour: number; dom: number; month: number; dow: number } {
  const parts = formatter(tz).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return {
    minute: Number(get('minute')),
    hour: Number(get('hour')) % 24,
    dom: Number(get('day')),
    month: Number(get('month')),
    dow: DAYS.indexOf(get('weekday').toLowerCase().slice(0, 3)),
  };
}

export function cronMatches(spec: CronSpec, date: Date, tz: string): boolean {
  const p = partsIn(date, tz);
  if (!spec.minute.has(p.minute) || !spec.hour.has(p.hour) || !spec.month.has(p.month)) return false;
  const domOk = spec.dom.has(p.dom);
  const dowOk = spec.dow.has(p.dow);
  // Standard cron: when both day fields are restricted, either one matching fires.
  if (!spec.domAny && !spec.dowAny) return domOk || dowOk;
  return domOk && dowOk;
}

function floorMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000);
}

/** Most recent minute at or before `now` that the expression matches, within the look-back window. */
export function lastFire(expr: string, now: Date, tz: string, lookbackMinutes = 24 * 60): Date | null {
  const spec = parseCron(expr);
  if (!spec) return null;
  let t = floorMinute(now);
  for (let i = 0; i <= lookbackMinutes; i++) {
    if (cronMatches(spec, t, tz)) return t;
    t = new Date(t.getTime() - 60_000);
  }
  return null;
}

/**
 * First minute after `from` that the expression matches, within the look-ahead
 * window. Skips whole days and hours that cannot match instead of stepping
 * through every minute of a year.
 */
export function nextFire(expr: string, from: Date, tz: string, lookaheadMinutes = 366 * 24 * 60): Date | null {
  const spec = parseCron(expr);
  if (!spec) return null;
  const end = floorMinute(from).getTime() + lookaheadMinutes * 60_000;
  let t = floorMinute(from).getTime() + 60_000;
  while (t <= end) {
    const date = new Date(t);
    const p = partsIn(date, tz);
    const domOk = spec.dom.has(p.dom);
    const dowOk = spec.dow.has(p.dow);
    const dayOk = spec.month.has(p.month) && (!spec.domAny && !spec.dowAny ? domOk || dowOk : domOk && dowOk);
    if (!dayOk) {
      t += (24 * 60 - (p.hour * 60 + p.minute)) * 60_000; // start of the next day (re-checked after DST shifts)
    } else if (!spec.hour.has(p.hour)) {
      t += (60 - p.minute) * 60_000;
    } else if (!spec.minute.has(p.minute)) {
      t += 60_000;
    } else {
      return date;
    }
  }
  return null;
}

/** Parses `at:<ISO-8601>`; null if the expression isn't that form or the timestamp is unparseable. */
export function parseOneTime(expr: string): Date | null {
  const m = /^at:(.+)$/i.exec(expr.trim());
  if (!m) return null;
  const d = new Date(m[1]!.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isValidExpression(expr: string | null | undefined): boolean {
  if (!expr) return false;
  const trimmed = expr.trim();
  if (/^every:\d+$/i.test(trimmed)) return Number(trimmed.slice(6)) > 0;
  if (/^at:/i.test(trimmed)) return parseOneTime(trimmed) !== null;
  return parseCron(expr) !== null;
}

export interface ScheduleLike {
  enabled?: boolean;
  cron_expression?: string | null;
  last_run_at?: string | Date | null;
  updated_at?: string | Date | null;
  created_at?: string | Date | null;
}

/**
 * A schedule is due when a matching minute has passed since it last ran — or,
 * for a schedule that never ran, since it was created or last edited, so a
 * "nightly at 02:00" created at 11:00 waits for tonight instead of firing at once.
 */
export function isDue(schedule: ScheduleLike, now: Date, tz: string): boolean {
  if (schedule.enabled === false) return false;
  const expr = (schedule.cron_expression || '').trim();
  if (!expr) return false;

  const interval = /^every:(\d+)$/i.exec(expr);
  if (interval) {
    const mins = Number(interval[1]);
    if (!mins) return false;
    if (!schedule.last_run_at) return true;
    return now.getTime() - new Date(schedule.last_run_at).getTime() >= mins * 60_000;
  }

  const at = parseOneTime(expr);
  if (at) {
    if (schedule.last_run_at) return false; // one-shot: already fired
    return now.getTime() >= at.getTime();
  }

  const fire = lastFire(expr, now, tz);
  if (!fire) return false;
  const floor = schedule.last_run_at || schedule.updated_at || schedule.created_at;
  return !floor || fire.getTime() > new Date(floor).getTime();
}
