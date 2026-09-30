import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { query, withTransaction } from '../db/client.js';

/**
 * Completion notifications for external parties (the Sand Bench agent).
 *
 * When an execution finishes, every matching webhook subscription and the run's own
 * callback_url get a signed POST. Delivery is at-least-once with backoff, so receivers
 * must treat (execution.id, event) as an idempotency key. The body carries the verdict
 * and counts only; the receiver fetches details from GET /api/v1/agent/runs/:id/results.
 */

export const EVENT_COMPLETED = 'execution.completed';
export const EVENTS = [EVENT_COMPLETED, 'webhook.test'] as const;
export const MAX_ATTEMPTS = 6;
const BACKOFF_SECONDS = [10, 30, 120, 600, 1800, 7200];
const TERMINAL = new Set(['passed', 'failed', 'error', 'timed_out', 'blocked', 'skipped', 'cancelled']);

export class WebhookError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

// ---- pure helpers ---------------------------------------------------------------------

/** Hex HMAC-SHA256 over `${timestamp}.${body}`; receivers recompute it and compare in constant time. */
export function sign(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifySignature(secret: string, timestamp: string, body: string, signature: string): boolean {
  const expected = Buffer.from(sign(secret, timestamp, body));
  const given = Buffer.from(String(signature || '').replace(/^sha256=/, ''));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function newSecret(): string { return 'whsec_' + randomBytes(24).toString('hex'); }

export function backoffSeconds(attempt: number): number {
  return BACKOFF_SECONDS[Math.min(Math.max(attempt - 1, 0), BACKOFF_SECONDS.length - 1)]!;
}

const BLOCKED_HOST = /^(169\.254\.|0\.|fe80:|\[fe80:|metadata\.google\.internal$|100\.100\.100\.200$)/i;

/**
 * Receivers are chosen by whoever holds the agent key, so refuse what could never be a
 * legitimate receiver: non-http(s) schemes, credentials in the URL, and link-local / cloud
 * metadata addresses. Private and docker-network hosts stay allowed (the agent usually
 * lives on the same network). WEBHOOK_ALLOWED_HOSTS (comma list) narrows it further.
 */
export function checkWebhookUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new WebhookError(400, 'url is required');
  const value = raw.trim();
  if (value.length > 2048 || /[\u0000-\u001F\u007F\s]/.test(value)) throw new WebhookError(400, 'url must be a single http(s) address of at most 2048 characters');
  let u: URL;
  try { u = new URL(value); } catch { throw new WebhookError(400, 'url is not a valid address'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new WebhookError(400, 'url must start with http:// or https://');
  if (u.username || u.password) throw new WebhookError(400, 'url must not contain credentials');
  if (BLOCKED_HOST.test(u.hostname)) throw new WebhookError(400, 'that host is not allowed as a webhook receiver');
  const allowed = (process.env.WEBHOOK_ALLOWED_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(u.hostname.toLowerCase())) throw new WebhookError(400, `host ${u.hostname} is not in WEBHOOK_ALLOWED_HOSTS`);
  return u.toString();
}

export function checkEvents(raw: unknown): string[] {
  if (raw == null) return [EVENT_COMPLETED];
  if (!Array.isArray(raw) || !raw.length || raw.length > 5) throw new WebhookError(400, 'events must be a non-empty list');
  for (const e of raw) if (!EVENTS.includes(e as never)) throw new WebhookError(400, `unknown event ${JSON.stringify(e)}; use ${EVENTS.join(', ')}`);
  return [...new Set(raw as string[])];
}

export function checkName(raw: unknown): string {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v || v.length > 120 || !/^[\p{L}\p{N}][\p{L}\p{N} ._\-:/()&,'#+@]*$/u.test(v)) throw new WebhookError(400, 'name is required (up to 120 characters: letters, digits and . _ - : / ( ) & , \' # + @)');
  return v;
}

// ---- payload --------------------------------------------------------------------------

export type Summary = { total: number; passed: number; failed: number; errored: number; skipped: number; other: number };

export function summarise(rows: Array<{ status: string; verdict?: string | null }>): Summary {
  const s: Summary = { total: rows.length, passed: 0, failed: 0, errored: 0, skipped: 0, other: 0 };
  for (const r of rows) {
    const v = r.verdict || r.status;
    if (v === 'passed' || v === 'pass') s.passed++;
    else if (v === 'failed' || v === 'fail') s.failed++;
    else if (v === 'error' || v === 'timed_out') s.errored++;
    else if (v === 'skipped' || v === 'blocked') s.skipped++;
    else s.other++;
  }
  return s;
}

export async function completionPayload(executionId: string) {
  const { rows } = await query(`SELECT * FROM executions WHERE id = $1`, [executionId]);
  const ex = rows[0];
  if (!ex) return null;
  const results = await query(`SELECT status::text AS status, verdict::text AS verdict FROM execution_results WHERE execution_id = $1`, [ex.id]);
  const summary = summarise(results.rows as Array<{ status: string; verdict: string | null }>);
  const meta = (ex.metadata || {}) as Record<string, unknown>;
  return {
    event: EVENT_COMPLETED,
    execution: {
      id: ex.id, key: ex.key, status: ex.status, trigger_source: ex.trigger_source,
      started_at: ex.started_at, finished_at: ex.finished_at, requested_by: ex.requested_by,
      label: meta.label ?? null, schedule_id: meta.schedule_id ?? null, schedule_name: meta.schedule_name ?? null,
      defect_report_id: meta.defect_report_id ?? null,
    },
    summary,
    outcome: ex.status === 'passed' && summary.failed === 0 && summary.errored === 0 ? 'pass' : ex.status === 'cancelled' ? 'cancelled' : 'fail',
    results_url: `/api/v1/agent/runs/${ex.id}/results`,
  };
}

// ---- queueing and delivery ------------------------------------------------------------

/** Queue a delivery for every matching subscription and for the run's own callback_url. Idempotent per execution. */
export async function enqueueCompletion(executionId: string): Promise<number> {
  const payload = await completionPayload(executionId);
  if (!payload || !TERMINAL.has(payload.execution.status)) return 0;
  const meta = await query(`SELECT metadata FROM executions WHERE id = $1`, [executionId]);
  const callback = (meta.rows[0]?.metadata as Record<string, unknown> | undefined)?.callback_url;
  return withTransaction(async (db) => {
    const already = await db.query(`SELECT 1 FROM webhook_deliveries WHERE execution_id = $1 AND event = $2 LIMIT 1`, [executionId, EVENT_COMPLETED]);
    if (already.rowCount) return 0;
    const subs = await db.query(
      `SELECT id, url FROM webhook_subscriptions
        WHERE enabled AND $1 = ANY(events)
          AND (schedule_id IS NULL OR schedule_id::text = $2)
          AND (label IS NULL OR label = $3)`,
      [EVENT_COMPLETED, payload.execution.schedule_id, payload.execution.label]
    );
    let n = 0;
    for (const s of subs.rows) {
      await db.query(
        `INSERT INTO webhook_deliveries (subscription_id, execution_id, event, url, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`,
        [s.id, executionId, EVENT_COMPLETED, s.url, JSON.stringify(payload)]
      );
      n++;
    }
    if (typeof callback === 'string' && callback) {
      await db.query(
        `INSERT INTO webhook_deliveries (subscription_id, execution_id, event, url, payload) VALUES (NULL,$1,$2,$3,$4::jsonb)`,
        [executionId, EVENT_COMPLETED, callback, JSON.stringify(payload)]
      );
      n++;
    }
    return n;
  });
}

/** Never let a notification problem fail the completion the worker already reported. */
export async function notifyCompleted(executionId: string, log?: { warn: (o: unknown, m?: string) => void }) {
  try {
    if (await enqueueCompletion(executionId)) void deliverDue().catch(() => undefined);
  } catch (err) { log?.warn({ err }, 'webhook enqueue failed'); }
}

async function secretFor(subscriptionId: string | null): Promise<string | null> {
  if (subscriptionId) {
    const { rows } = await query(`SELECT secret FROM webhook_subscriptions WHERE id = $1`, [subscriptionId]);
    return (rows[0]?.secret as string | undefined) ?? null;
  }
  // Per-run callback_url: signed with the agent key, which the receiver already holds.
  return process.env.AGENT_API_KEY || null;
}

async function deliverOne(d: { id: string; subscription_id: string | null; event: string; url: string; payload: unknown; attempts: number }) {
  const secret = await secretFor(d.subscription_id);
  const body = JSON.stringify(d.payload);
  const ts = String(Math.floor(Date.now() / 1000));
  let code: number | null = null;
  let error: string | null = null;
  try {
    checkWebhookUrl(d.url);
    const headers: Record<string, string> = {
      'content-type': 'application/json', 'user-agent': 'gavriq-test-engine-webhook/1',
      'x-gavriq-event': d.event, 'x-gavriq-delivery': d.id, 'x-gavriq-timestamp': ts,
    };
    if (secret) headers['x-gavriq-signature'] = 'sha256=' + sign(secret, ts, body);
    const res = await fetch(d.url, { method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    code = res.status;
    if (!res.ok) error = `receiver answered HTTP ${res.status}`;
  } catch (err) { error = (err as Error).message.slice(0, 500); }
  const attempts = d.attempts + 1;
  if (!error) {
    await query(`UPDATE webhook_deliveries SET status='delivered', attempts=$2, last_status_code=$3, last_error=NULL, delivered_at=now() WHERE id=$1`, [d.id, attempts, code]);
  } else if (attempts >= MAX_ATTEMPTS || (code !== null && code >= 400 && code < 500 && code !== 408 && code !== 429)) {
    await query(`UPDATE webhook_deliveries SET status='dead', attempts=$2, last_status_code=$3, last_error=$4 WHERE id=$1`, [d.id, attempts, code, error]);
  } else {
    await query(`UPDATE webhook_deliveries SET attempts=$2, last_status_code=$3, last_error=$4, next_attempt_at = now() + ($5 || ' seconds')::interval WHERE id=$1`, [d.id, attempts, code, error, String(backoffSeconds(attempts))]);
  }
}

let delivering = false;
/** Send everything that is due. Safe to call often; rows are claimed with SKIP LOCKED so replicas do not double-send. */
export async function deliverDue(limit = 20): Promise<number> {
  if (delivering) return 0;
  delivering = true;
  try {
    const due = await withTransaction(async (db) => {
      const { rows } = await db.query(
        `SELECT id, subscription_id, event, url, payload, attempts FROM webhook_deliveries
          WHERE status = 'pending' AND next_attempt_at <= now()
          ORDER BY next_attempt_at LIMIT $1 FOR UPDATE SKIP LOCKED`, [limit]);
      // Push the claimed rows out so a slow receiver is not retried by another tick mid-request.
      if (rows.length) await db.query(`UPDATE webhook_deliveries SET next_attempt_at = now() + interval '60 seconds' WHERE id = ANY($1::uuid[])`, [rows.map((r) => r.id)]);
      return rows;
    });
    for (const d of due) await deliverOne(d);
    return due.length;
  } finally { delivering = false; }
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startWebhookDispatcher(intervalMs = Number(process.env.WEBHOOK_TICK_MS || 5000)) {
  if (timer) return;
  timer = setInterval(() => { deliverDue().catch((err) => console.warn('[webhooks] dispatch', (err as Error).message)); }, intervalMs);
  timer.unref?.();
}
export function stopWebhookDispatcher() { if (timer) clearInterval(timer); timer = null; }
