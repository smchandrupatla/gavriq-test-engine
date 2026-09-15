#!/usr/bin/env tsx
/**
 * Simple interval-based schedule poller (Prompt 7).
 * For production, replace with a real cron library or external scheduler.
 * Supports cron_expression values of the form "every:N" (minutes).
 */
const API = process.env.TEST_ENGINE_API || 'http://127.0.0.1:8787';
const POLL_MS = Number(process.env.SCHEDULER_POLL_MS || 60_000);

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

function due(schedule: any, now: Date): boolean {
  if (!schedule.enabled) return false;
  const expr = schedule.cron_expression as string | null;
  if (!expr) return false;

  // Support "every:N" minutes
  const m = /^every:(\d+)$/i.exec(expr.trim());
  if (m) {
    const mins = Number(m[1]);
    if (!mins) return false;
    if (!schedule.last_run_at) return true;
    const last = new Date(schedule.last_run_at).getTime();
    return now.getTime() - last >= mins * 60_000;
  }

  // Support "hourly"
  if (expr === 'hourly') {
    if (!schedule.last_run_at) return true;
    return now.getTime() - new Date(schedule.last_run_at).getTime() >= 60 * 60_000;
  }

  // Support "daily"
  if (expr === 'daily') {
    if (!schedule.last_run_at) return true;
    return now.getTime() - new Date(schedule.last_run_at).getTime() >= 24 * 60 * 60_000;
  }

  return false;
}

async function tick() {
  try {
    const { data: schedules } = await api('/api/v1/schedules');
    const now = new Date();
    for (const s of schedules || []) {
      if (due(s, now)) {
        console.log(`[scheduler] firing ${s.name} (${s.id})`);
        await api(`/api/v1/schedules/${s.id}/run`, {
          method: 'POST',
          body: JSON.stringify({ requested_by: 'scheduler-daemon' }),
        });
      }
    }
  } catch (err) {
    console.warn('[scheduler]', (err as Error).message);
  }
}

console.log(`[scheduler] polling every ${POLL_MS}ms against ${API}`);
tick();
setInterval(tick, POLL_MS);
