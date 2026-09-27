/**
 * Cron for the Scheduler — standard 5-field expressions evaluated in an IANA
 * timezone, plus @aliases and the legacy every:N / hourly / daily forms.
 *
 *   ┌ minute 0-59 ┌ hour 0-23 ┌ day of month 1-31 ┌ month 1-12|jan-dec ┌ day of week 0-7|sun-sat
 *   *             *           *                   *                    *
 *
 * Supports lists (1,15), ranges (1-5), steps (*\/15, 8-18/2) and names. As in
 * Vixie cron, when both day fields are restricted a day matches either one.
 */

export type CronSpec =
  | { kind: 'cron'; minute: Set<number>; hour: Set<number>; dom: Set<number>; month: Set<number>; dow: Set<number>; domStar: boolean; dowStar: boolean }
  | { kind: 'interval'; minutes: number };

const ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *',
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export class CronError extends Error {}

function field(src: string, min: number, max: number, names?: string[], nameBase = 0): Set<number> {
  const out = new Set<number>();
  const val = (token: string) => {
    const lower = token.toLowerCase();
    const idx = names ? names.indexOf(lower) : -1;
    const n = idx >= 0 ? idx + nameBase : Number(token);
    if (!Number.isInteger(n) || n < min || n > max) throw new CronError(`"${token}" is outside ${min}-${max}`);
    return n;
  };
  for (const part of src.split(',')) {
    if (!part) throw new CronError('empty list item');
    const [range, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new CronError(`bad step "${stepText}"`);
    let lo: number;
    let hi: number;
    if (range === '*') { lo = min; hi = max; }
    else if (range!.includes('-')) {
      const [a, b] = range!.split('-');
      lo = val(a!); hi = val(b!);
      if (lo > hi) throw new CronError(`range ${range} runs backwards`);
    } else {
      lo = val(range!);
      hi = stepText === undefined ? lo : max;
    }
    for (let n = lo; n <= hi; n += step) out.add(n);
  }
  return out;
}

export function parseCron(expr: string): CronSpec {
  const raw = String(expr || '').trim();
  if (!raw) throw new CronError('cron expression is empty');
  const lower = raw.toLowerCase();

  const every = /^every:(\d+)$/.exec(lower);
  if (every) {
    const minutes = Number(every[1]);
    if (minutes < 1 || minutes > 525_600) throw new CronError('every:N needs 1 to 525600 minutes');
    return { kind: 'interval', minutes };
  }
  if (lower === 'hourly') return parseCron('@hourly');
  if (lower === 'daily') return parseCron('@daily');

  const text = ALIASES[lower] ?? raw;
  const parts = text.split(/\s+/);
  if (parts.length !== 5) throw new CronError('use 5 fields: minute hour day-of-month month day-of-week');
  const [mi, ho, dm, mo, dw] = parts as [string, string, string, string, string];
  const dow = field(dw, 0, 7, DAYS);
  if (dow.has(7)) { dow.delete(7); dow.add(0); }
  return {
    kind: 'cron',
    minute: field(mi, 0, 59),
    hour: field(ho, 0, 23),
    dom: field(dm, 1, 31),
    month: field(mo, 1, 12, MONTHS, 1),
    dow,
    domStar: dm === '*' || dm.startsWith('*/'),
    dowStar: dw === '*' || dw.startsWith('*/'),
  };
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

type Wall = { year: number; month: number; day: number; hour: number; minute: number; dow: number };

const formatters = new Map<string, Intl.DateTimeFormat>();
function wall(ms: number, tz: string): Wall {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', weekday: 'short',
    });
    formatters.set(tz, f);
  }
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(ms)) p[part.type] = part.value;
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour) % 24, minute: Number(p.minute),
    dow: DAYS.indexOf(String(p.weekday).toLowerCase().slice(0, 3)),
  };
}

function dayMatches(spec: Extract<CronSpec, { kind: 'cron' }>, w: Wall): boolean {
  const dom = spec.dom.has(w.day);
  const dow = spec.dow.has(w.dow);
  if (spec.domStar && spec.dowStar) return true;
  if (spec.domStar) return dow;
  if (spec.dowStar) return dom;
  return dom || dow;
}

const MIN = 60_000;
const HORIZON_MS = 400 * 24 * 60 * MIN;

/**
 * First fire time strictly after `after`. `lastRun` anchors interval specs.
 * Returns null when nothing matches within ~13 months (e.g. "0 0 31 2 *").
 */
export function nextRun(spec: CronSpec, after: Date, tz = 'UTC', lastRun?: Date | null): Date | null {
  if (spec.kind === 'interval') {
    const step = spec.minutes * MIN;
    if (!lastRun) return new Date(Math.floor(after.getTime() / MIN) * MIN + MIN);
    let t = lastRun.getTime() + step;
    if (t <= after.getTime()) t += Math.ceil((after.getTime() - t + 1) / step) * step;
    return new Date(t);
  }
  let t = Math.floor(after.getTime() / MIN) * MIN + MIN;
  const end = after.getTime() + HORIZON_MS;
  while (t <= end) {
    const w = wall(t, tz);
    if (!spec.month.has(w.month) || !dayMatches(spec, w)) {
      t += ((23 - w.hour) * 60 + (60 - w.minute)) * MIN; // next local midnight…
      const landed = wall(t, tz);
      if (landed.day !== w.day && (landed.hour || landed.minute)) {
        t -= (landed.hour * 60 + landed.minute) * MIN; // …snapped back on a short DST day
      }
      continue;
    }
    if (!spec.hour.has(w.hour)) {
      t += (60 - w.minute) * MIN;
      continue;
    }
    if (!spec.minute.has(w.minute)) {
      t += MIN;
      continue;
    }
    return new Date(t);
  }
  return null;
}

/** The next `count` fire times after `after`, stopping at `until` if given. */
export function upcoming(expr: string, after: Date, tz = 'UTC', count = 5, until?: Date, lastRun?: Date | null): Date[] {
  const spec = parseCron(expr);
  const out: Date[] = [];
  let cursor = after;
  let anchor = lastRun ?? null;
  while (out.length < count) {
    const next = nextRun(spec, cursor, tz, anchor);
    if (!next || (until && next > until)) break;
    out.push(next);
    cursor = next;
    anchor = next;
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Short human reading for the UI, e.g. "Weekdays at 02:00" or "Every 15 minutes". */
export function describeCron(expr: string): string {
  const lower = String(expr || '').trim().toLowerCase();
  const spec = parseCron(expr);
  if (spec.kind === 'interval') return spec.minutes === 1 ? 'Every minute' : `Every ${spec.minutes} minutes`;
  const alias = lower === 'hourly' || lower === 'daily' ? `@${lower}` : lower;
  const text = ALIASES[alias] ?? expr.trim();
  const [mi, ho, dm, mo, dw] = text.split(/\s+/) as [string, string, string, string, string];
  const stepMin = /^\*\/(\d+)$/.exec(mi);
  if (stepMin && ho === '*' && dm === '*' && mo === '*' && dw === '*') return `Every ${stepMin[1]} minutes`;
  if (/^\d+$/.test(mi) && ho === '*' && dm === '*' && mo === '*' && dw === '*') return `Hourly at :${pad(Number(mi))}`;
  if (/^\d+$/.test(mi) && /^\d+(,\d+)*$/.test(ho) && mo === '*') {
    const times = ho.split(',').map((h) => `${pad(Number(h))}:${pad(Number(mi))}`).join(', ');
    if (dm === '*' && dw === '*') return `Daily at ${times}`;
    if (dm === '*' && (dw === '1-5' || dw.toLowerCase() === 'mon-fri')) return `Weekdays at ${times}`;
    if (dm === '*' && /^[0-7a-z,]+$/i.test(dw)) {
      const names = [...spec.dow].sort().map((d) => DAYS[d]!.replace(/^./, (c) => c.toUpperCase())).join(', ');
      return `${names} at ${times}`;
    }
    if (/^\d+$/.test(dm) && dw === '*') return `Monthly on day ${dm} at ${times}`;
  }
  return `Cron ${text}`;
}
