/**
 * In-process schedule ticker: every SCHEDULER_TICK_MS (default 30 s) the API
 * checks the enabled schedules and fires each one that is due, with the same
 * rules and the same atomic claim as the standalone poller (scheduler.ts), so
 * the two can run together without queueing a run twice.
 *
 * Set SCHEDULER_IN_PROCESS=false to turn it off, e.g. when only the standalone
 * poller should fire schedules.
 */
import { query } from './db/client.js';
import { defaultTimeZone, isDue } from './cron.js';
import { claimAndFire } from './routes/schedules.js';
import { setTickerRunning } from './schedule/service.js';

let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

/** Fire every due schedule once. Returns how many were queued. */
export async function tickSchedules(now = new Date()): Promise<number> {
  const tz = defaultTimeZone();
  const { rows } = await query(`SELECT * FROM schedules WHERE enabled AND cron_expression IS NOT NULL`);
  let fired = 0;
  for (const s of rows) {
    if (!isDue(s, now, tz)) continue;
    try {
      const out = await claimAndFire(s, {
        requested_by: 'scheduler',
        claiming: true,
        expectedLastRunAt: s.last_run_at ?? null,
      });
      if (out.claimed && out.status === 202) {
        fired++;
        console.log(`[scheduler] fired "${s.name}" (${s.cron_expression})`);
      } else if (out.claimed) {
        console.warn(`[scheduler] "${s.name}" not queued: ${out.body?.error ?? out.status}`);
      }
    } catch (err) {
      console.warn(`[scheduler] "${s.name}" failed to fire:`, (err as Error).message);
    }
  }
  return fired;
}

export function startScheduleTicker(intervalMs = Number(process.env.SCHEDULER_TICK_MS || 30_000)) {
  if (timer || process.env.SCHEDULER_IN_PROCESS === 'false') return;
  timer = setInterval(async () => {
    // A slow tick must not overlap the next: both would see the same schedule as due.
    if (ticking) return;
    ticking = true;
    try { await tickSchedules(); } catch (err) { console.warn('[scheduler] tick', (err as Error).message); }
    finally { ticking = false; }
  }, intervalMs);
  timer.unref?.();
  setTickerRunning(true);
  console.log(`[scheduler] in-process ticker every ${intervalMs}ms`);
}

export function stopScheduleTicker() {
  if (timer) clearInterval(timer);
  timer = null;
  setTickerRunning(false);
}
