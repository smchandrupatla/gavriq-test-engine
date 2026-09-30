#!/usr/bin/env tsx
/**
 * Schedule poller: every SCHEDULER_POLL_MS it asks the control plane for the
 * schedules and fires each one that is due (see cron.ts for the expressions).
 * Runs beside the API (compose service `scheduler`, or `npm run start:scheduler`)
 * and needs nothing but the API URL. Firing goes through
 * POST /api/v1/schedules/:id/run, so a schedule is queued the same way whether
 * this poller, a person, or a deploy hook fires it.
 */
import { defaultTimeZone, isDue, nextFire } from './cron.js';

const API = process.env.TEST_ENGINE_API || 'http://127.0.0.1:8787';
const POLL_MS = Number(process.env.SCHEDULER_POLL_MS || 60_000);
const TZ = defaultTimeZone();
const KEY = process.env.WORKER_API_KEY || '';

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(KEY ? { 'x-worker-key': KEY } : {}), ...(opts.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

let ticking = false;

async function tick() {
  // A slow poll must not overlap the next one: both would see the same schedule as due.
  if (ticking) return;
  ticking = true;
  try {
    const { data: schedules } = await api('/api/v1/schedules');
    const now = new Date();
    for (const s of schedules || []) {
      if (!isDue(s, now, TZ)) continue;
      console.log(`[scheduler] firing "${s.name}" (${s.cron_expression}) — next ${nextFire(s.cron_expression, now, TZ)?.toISOString() ?? 'n/a'}`);
      try {
        // expected_last_run_at makes the API claim this occurrence atomically (409 if another poll got there first).
        const fired = await api(`/api/v1/schedules/${s.id}/run`, {
          method: 'POST',
          body: JSON.stringify({ requested_by: 'scheduler-daemon', expected_last_run_at: s.last_run_at ?? null }),
        });
        console.log(`[scheduler] "${s.name}" → ${fired?.data?.run_id || fired?.data?.key || 'queued'}`);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('already_fired')) console.log(`[scheduler] "${s.name}" was already fired for this occurrence`);
        else console.warn(`[scheduler] "${s.name}" failed to fire:`, msg);
      }
    }
  } catch (err) {
    console.warn('[scheduler]', (err as Error).message);
  } finally {
    ticking = false;
  }
}

console.log(`[scheduler] polling every ${POLL_MS}ms against ${API}, time zone ${TZ}`);
tick();
setInterval(tick, POLL_MS);
