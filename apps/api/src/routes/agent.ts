import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { audit, hasAgentKey } from '../middleware/rbac.js';
import { query, withTransaction } from '../db/client.js';
import { fire, runSchedule, SchedulerError } from '../schedule/service.js';
import { normalizeTarget, TargetError } from '../schedule/target.js';
import {
  checkEvents, checkName, checkWebhookUrl, completionPayload, deliverDue, newSecret, summarise, WebhookError,
} from '../notify/webhooks.js';

/**
 * Agent API — the channel for an external automation party (the Sand Bench agent) to run the
 * nightly suites, be told when a run finishes, and read the results. See docs/AGENT-API.md.
 *
 * Every route needs AGENT_API_KEY (X-Agent-Key or Authorization: Bearer). Without the variable
 * the API answers 503 rather than running open.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAgent(req: FastifyRequest, reply: FastifyReply) {
  if (!process.env.AGENT_API_KEY) return reply.status(503).send({ error: 'Agent API is not configured: set AGENT_API_KEY on the engine.' });
  if (!hasAgentKey(req)) return reply.status(401).send({ error: 'A valid agent key is required (X-Agent-Key or Authorization: Bearer).' });
}

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof WebhookError) return reply.status(err.statusCode).send({ error: err.message });
  if (err instanceof SchedulerError) return reply.status(err.statusCode).send({ error: err.message });
  if (err instanceof TargetError) return reply.status(400).send({ error: err.message });
  throw err;
}

function text(v: unknown, max: number, field: string): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u001F\u007F]/.test(v)) throw new WebhookError(400, `${field} must be plain text of at most ${max} characters`);
  return v.trim();
}

async function findExecution(ref: string) {
  const { rows } = await query(`SELECT * FROM executions WHERE ${UUID.test(ref) ? 'id' : 'key'} = $1`, [ref]);
  return rows[0] as Record<string, any> | undefined;
}

/** What the agent needs to fix a failure: which case, what it said, where the evidence is, which defect it became. */
async function resultDetail(executionId: string, onlyProblems: boolean) {
  const { rows } = await query(
    `SELECT r.id, r.status::text AS status, r.verdict::text AS verdict, r.duration_ms, r.message, r.classification::text AS classification,
            r.started_at, r.finished_at, c.id AS case_id, c.key AS case_key, c.name AS case_name, c.test_type::text AS test_type,
            COALESCE((SELECT json_agg(json_build_object('id', e.id, 'type', e.evidence_type, 'content_type', e.content_type,
                        'url', '/api/v1/evidence/file?key=' || e.storage_key) ORDER BY e.created_at)
                      FROM evidence e WHERE e.execution_result_id = r.id), '[]'::json) AS evidence
       FROM execution_results r JOIN test_cases c ON c.id = r.test_case_id
      WHERE r.execution_id = $1 ORDER BY r.created_at`, [executionId]);
  const all = rows.map((r) => ({ ...r, passed: (r.verdict || r.status) === 'passed' || r.verdict === 'pass' })) as Array<Record<string, any> & { passed: boolean }>;
  const defects = await query(
    `SELECT d.id, d.key, d.status, d.severity, d.category, d.report_id, d.execution_result_id FROM defects d WHERE d.execution_id = $1`,
    [executionId]).catch(() => ({ rows: [] as any[] }));
  const byResult = new Map<string, any[]>();
  for (const d of defects.rows) { const k = String(d.execution_result_id); byResult.set(k, [...(byResult.get(k) || []), d]); }
  const shaped = all.map((r) => ({ ...r, defects: byResult.get(String(r.id)) || [] }));
  return { summary: summarise(rows as Array<{ status: string; verdict: string | null }>), results: onlyProblems ? shaped.filter((r) => !r.passed) : shaped, defect_count: defects.rows.length };
}

export async function agentRoutes(app: FastifyInstance) {
  const auth = { preHandler: requireAgent };

  /** The suites an agent can trigger: every schedule (nightly ones first). */
  app.get('/api/v1/agent/schedules', auth, async (_req, reply) => {
    const { rows } = await query(
      `SELECT id, name, cron_expression, event_trigger, enabled, next_run_at, last_run_at, last_outcome, last_execution_id, environment_id
         FROM schedules ORDER BY (cron_expression IS NULL), name`);
    return reply.send({ data: rows });
  });

  /**
   * Start a run. Give schedule_id (run that saved schedule now) or target (same shape as /scheduler/run-now).
   * callback_url: optional per-run completion webhook, signed with the agent key.
   */
  app.post<{ Body: Record<string, unknown> }>('/api/v1/agent/runs', auth, async (req, reply) => {
    try {
      const b = req.body || {};
      const by = text(b.requested_by, 120, 'requested_by') || 'sandbench-agent';
      const label = text(b.label, 200, 'label');
      const callback = b.callback_url == null ? null : checkWebhookUrl(b.callback_url);
      const env = b.environment_id == null ? null : String(b.environment_id);
      if (env && !UUID.test(env)) throw new WebhookError(400, 'environment_id must be a UUID');
      let result;
      if (b.schedule_id != null) {
        const id = String(b.schedule_id);
        if (!UUID.test(id)) throw new WebhookError(400, 'schedule_id must be a UUID');
        result = await runSchedule(id, 'api', by);
      } else if (b.target != null) {
        const target = normalizeTarget(b.target);
        result = await withTransaction((db) => fire(db, { target, trigger: 'api', requested_by: by, environment_id: env, label }));
      } else throw new WebhookError(400, 'Give schedule_id or target');
      if (!result) throw new SchedulerError(409, 'Schedule is not due');
      if (result.outcome === 'skipped_overlap') return reply.status(409).send({ error: 'The previous run of this schedule is still running; wait for its completion notification.', data: result });
      if (result.outcome === 'skipped_empty' || !result.execution) return reply.status(400).send({ error: 'That selection matches no test cases', data: result });
      const exec = result.execution;
      await query(
        `UPDATE executions SET metadata = metadata || $2::jsonb WHERE id = $1`,
        [exec.id, JSON.stringify({ ...(callback ? { callback_url: callback } : {}), ...(label ? { label } : {}), triggered_via: 'agent-api' })]);
      await audit(req, 'agent.run', 'execution', exec.id, { schedule_id: b.schedule_id ?? null, cases: result.case_count, callback: Boolean(callback) });
      return reply.status(202).send({ data: { execution_id: exec.id, key: exec.key, status: 'queued', case_count: result.case_count, status_url: `/api/v1/agent/runs/${exec.id}`, results_url: `/api/v1/agent/runs/${exec.id}/results` }, message: 'Run queued' });
    } catch (err) { return fail(reply, err); }
  });

  app.get<{ Params: { id: string } }>('/api/v1/agent/runs/:id', auth, async (req, reply) => {
    const ex = await findExecution(req.params.id);
    if (!ex) return reply.status(404).send({ error: 'Run not found' });
    const finished = ['passed', 'failed', 'error', 'timed_out', 'blocked', 'skipped', 'cancelled'].includes(ex.status);
    const payload = await completionPayload(ex.id);
    return reply.send({ data: { id: ex.id, key: ex.key, status: ex.status, finished, started_at: ex.started_at, finished_at: ex.finished_at, trigger_source: ex.trigger_source, label: ex.metadata?.label ?? null, schedule_id: ex.metadata?.schedule_id ?? null, summary: payload?.summary, outcome: finished ? payload?.outcome : null } });
  });

  /** Verdicts for one run. Failures only by default; ?all=1 returns every case. */
  app.get<{ Params: { id: string }; Querystring: { all?: string } }>('/api/v1/agent/runs/:id/results', auth, async (req, reply) => {
    const ex = await findExecution(req.params.id);
    if (!ex) return reply.status(404).send({ error: 'Run not found' });
    const detail = await resultDetail(ex.id, req.query.all !== '1');
    const payload = await completionPayload(ex.id);
    return reply.send({ data: { execution: payload?.execution, outcome: payload?.outcome, ...detail } });
  });

  // ---- completion notifications --------------------------------------------------------

  app.post<{ Body: Record<string, unknown> }>('/api/v1/agent/webhooks', auth, async (req, reply) => {
    try {
      const b = req.body || {};
      const name = checkName(b.name);
      const url = checkWebhookUrl(b.url);
      const events = checkEvents(b.events);
      const label = text(b.label, 200, 'label');
      let scheduleId: string | null = null;
      if (b.schedule_id != null) { scheduleId = String(b.schedule_id); if (!UUID.test(scheduleId)) throw new WebhookError(400, 'schedule_id must be a UUID'); }
      const count = await query(`SELECT count(*)::int AS n FROM webhook_subscriptions`);
      if (Number(count.rows[0]?.n) >= 50) throw new WebhookError(409, 'At most 50 webhooks; delete one first');
      const secret = newSecret();
      const { rows } = await query(
        `INSERT INTO webhook_subscriptions (name, url, secret, events, schedule_id, label, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, name, url, events, schedule_id, label, enabled, created_at`,
        [name, url, secret, events, scheduleId, label, req.actor?.id ?? null]);
      await audit(req, 'agent.webhook.create', 'webhook', rows[0]!.id, { url });
      // The secret is shown once; store it to verify X-Gavriq-Signature.
      return reply.status(201).send({ data: { ...rows[0]!, secret }, message: 'Store the secret now; it is not shown again.' });
    } catch (err) {
      if ((err as { code?: string }).code === '23503') return reply.status(400).send({ error: 'schedule_id does not exist' });
      return fail(reply, err);
    }
  });

  app.get('/api/v1/agent/webhooks', auth, async (_req, reply) => {
    const { rows } = await query(
      `SELECT s.id, s.name, s.url, s.events, s.schedule_id, s.label, s.enabled, s.created_at,
              (SELECT count(*)::int FROM webhook_deliveries d WHERE d.subscription_id = s.id AND d.status = 'pending') AS pending,
              (SELECT count(*)::int FROM webhook_deliveries d WHERE d.subscription_id = s.id AND d.status = 'dead') AS dead
         FROM webhook_subscriptions s ORDER BY s.created_at DESC`);
    return reply.send({ data: rows });
  });

  app.delete<{ Params: { id: string } }>('/api/v1/agent/webhooks/:id', auth, async (req, reply) => {
    if (!UUID.test(req.params.id)) return reply.status(404).send({ error: 'Webhook not found' });
    const { rowCount } = await query(`DELETE FROM webhook_subscriptions WHERE id = $1`, [req.params.id]);
    if (!rowCount) return reply.status(404).send({ error: 'Webhook not found' });
    await audit(req, 'agent.webhook.delete', 'webhook', req.params.id, {});
    return reply.status(204).send();
  });

  /** Send a signed ping so the receiver can prove its signature check works. */
  app.post<{ Params: { id: string } }>('/api/v1/agent/webhooks/:id/test', auth, async (req, reply) => {
    if (!UUID.test(req.params.id)) return reply.status(404).send({ error: 'Webhook not found' });
    const { rows } = await query(`SELECT id, url FROM webhook_subscriptions WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return reply.status(404).send({ error: 'Webhook not found' });
    await query(
      `INSERT INTO webhook_deliveries (subscription_id, event, url, payload) VALUES ($1,'webhook.test',$2,$3::jsonb)`,
      [rows[0].id, rows[0].url, JSON.stringify({ event: 'webhook.test', message: 'Signed test delivery from the GAVRIQ Test Engine' })]);
    void deliverDue().catch(() => undefined);
    return reply.status(202).send({ message: 'Test delivery queued' });
  });

  app.get<{ Querystring: { run?: string; status?: string } }>('/api/v1/agent/webhook-deliveries', auth, async (req, reply) => {
    const ex = req.query.run ? await findExecution(req.query.run) : undefined;
    if (req.query.run && !ex) return reply.send({ data: [] });
    const status = ['pending', 'delivered', 'dead'].includes(String(req.query.status)) ? req.query.status : null;
    const { rows } = await query(
      `SELECT id, subscription_id, execution_id, event, url, status, attempts, next_attempt_at, last_status_code, last_error, created_at, delivered_at
         FROM webhook_deliveries WHERE ($1::uuid IS NULL OR execution_id = $1) AND ($2::text IS NULL OR status = $2)
        ORDER BY created_at DESC LIMIT 100`, [ex?.id ?? null, status]);
    return reply.send({ data: rows });
  });

  /** Re-queue a dead delivery (for example after the receiver was fixed). */
  app.post<{ Params: { id: string } }>('/api/v1/agent/webhook-deliveries/:id/retry', auth, async (req, reply) => {
    if (!UUID.test(req.params.id)) return reply.status(404).send({ error: 'Delivery not found' });
    const { rowCount } = await query(`UPDATE webhook_deliveries SET status='pending', attempts=0, next_attempt_at=now(), last_error=NULL WHERE id=$1 AND status <> 'delivered'`, [req.params.id]);
    if (!rowCount) return reply.status(404).send({ error: 'Delivery not found or already delivered' });
    void deliverDue().catch(() => undefined);
    return reply.status(202).send({ message: 'Delivery re-queued' });
  });
}
