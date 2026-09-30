/**
 * Schedules: fire a run on a cron expression (see cron.ts) or on a named event
 * (after_build, after_deploy, …). A schedule names either
 *   - an application + environment (+ optional scope): the whole application is
 *     planned through the same planner as POST /api/v1/runs — one execution per
 *     suite, safety policy honored, grouped as one run; or
 *   - a legacy target: test_plan_id / test_suite_id / test_case_ids, queued as
 *     one execution.
 */
import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { audit } from '../middleware/rbac.js';
import { defaultTimeZone, isValidExpression, nextFire, parseOneTime } from '../cron.js';
import { queueRun } from './trigger.js';

async function resolveId(table: 'applications' | 'environments', ref: unknown): Promise<string | null | undefined> {
  if (ref === null) return null;
  if (typeof ref !== 'string' || !ref) return undefined;
  const { rows } = await query(`SELECT id FROM ${table} WHERE id::text = $1 OR key = $1`, [ref]);
  return rows[0]?.id ?? undefined;
}

function withNextRun(s: any, tz: string) {
  const oneTime = s.cron_expression ? parseOneTime(s.cron_expression) : null;
  let next: string | null;
  if (oneTime) {
    // A one-time schedule's "next" is its timestamp until it fires, then nothing.
    next = s.enabled && !s.last_run_at ? oneTime.toISOString() : null;
  } else if (s.enabled && s.cron_expression && !/^every:/i.test(s.cron_expression)) {
    next = nextFire(s.cron_expression, new Date(), tz)?.toISOString() ?? null;
  } else {
    next = s.next_run_at ?? null;
  }
  return { ...s, next_run_at: next, time_zone: tz };
}

/** Queue whatever a schedule targets. Returns the HTTP status and body to answer with. */
async function fire(s: any, opts: { requested_by: string; trigger_source: string; environment_id?: string | null; event?: string; metadata?: Record<string, unknown> }) {
  const environment = opts.environment_id || s.environment_id;
  const meta = { schedule_id: s.id, schedule_name: s.name, ...(opts.event ? { event: opts.event } : {}), ...(opts.metadata || {}) };

  if (s.application_id) {
    if (!environment) return { status: 400, body: { error: `Schedule "${s.name}" has no environment` } };
    const outcome = await queueRun(
      {
        application: s.application_id,
        environment,
        scope: s.scope || {},
        reason: opts.event ? `${s.name} (${opts.event})` : s.name,
        trigger_source: opts.trigger_source,
        requested_by: opts.requested_by,
        metadata: meta,
      },
      opts.requested_by
    );
    if (outcome.queued) await query(`UPDATE schedules SET last_run_at = now() WHERE id = $1`, [s.id]);
    return { status: outcome.status, body: outcome.body, queued: outcome.queued };
  }

  let caseIds: string[] = s.test_case_ids || [];
  if (!caseIds.length && s.test_suite_id) {
    const suiteCases = await query('SELECT test_case_id FROM test_case_suites WHERE test_suite_id = $1', [s.test_suite_id]);
    caseIds = suiteCases.rows.map((r: any) => r.test_case_id);
  }
  if (!caseIds.length && !s.test_plan_id) {
    return { status: 400, body: { error: `Schedule "${s.name}" has no application, test cases or plan` } };
  }
  const key = `${opts.event ? `evt-${opts.event}` : 'sched'}-${Date.now().toString(36)}`;
  const exec = await query(
    `INSERT INTO executions (
       key, requested_by, test_plan_id, test_suite_id, test_case_ids,
       environment_id, status, trigger_source, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,'queued',$7,$8::jsonb)
     RETURNING *`,
    [key, opts.requested_by, s.test_plan_id, s.test_suite_id, caseIds, environment, opts.trigger_source, JSON.stringify(meta)]
  );
  await query(`UPDATE schedules SET last_run_at = now() WHERE id = $1`, [s.id]);
  return { status: 202, body: { data: exec.rows[0], message: 'Execution queued from schedule' } };
}

export async function scheduleRoutes(app: FastifyInstance) {
  const tz = defaultTimeZone();

  app.get('/api/v1/schedules', async (_req, reply) => {
    const { rows } = await query(
      `SELECT s.*, a.key AS application_key, e.key AS environment_key
       FROM schedules s
       LEFT JOIN applications a ON a.id = s.application_id
       LEFT JOIN environments e ON e.id = s.environment_id
       ORDER BY s.name`
    );
    return reply.send({ data: rows.map((s) => withNextRun(s, tz)) });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/schedules', async (req, reply) => {
    const b = req.body || {};
    if (!b.name) return reply.status(400).send({ error: 'name required' });
    if (!b.cron_expression && !b.event_trigger) {
      return reply.status(400).send({ error: 'cron_expression or event_trigger required' });
    }
    if (b.cron_expression && !isValidExpression(String(b.cron_expression))) {
      return reply.status(400).send({ error: 'cron_expression must be five cron fields ("0 2 * * *"), @hourly/@daily/@weekly, every:N, or at:<ISO date-time> for a one-time run' });
    }

    const applicationId = await resolveId('applications', b.application ?? b.application_key ?? b.application_id);
    if (applicationId === undefined && (b.application || b.application_key || b.application_id)) {
      return reply.status(404).send({ error: 'Application not found' });
    }
    const environmentId = await resolveId('environments', b.environment ?? b.environment_key ?? b.environment_id);
    if (environmentId === undefined && (b.environment || b.environment_key || b.environment_id)) {
      return reply.status(404).send({ error: 'Environment not found' });
    }
    if (!applicationId && !b.test_plan_id && !b.test_suite_id && !(Array.isArray(b.test_case_ids) && b.test_case_ids.length)) {
      return reply.status(400).send({ error: 'Provide application (with environment), or test_plan_id / test_suite_id / test_case_ids' });
    }
    if (applicationId && !environmentId) {
      return reply.status(400).send({ error: 'An application schedule needs an environment' });
    }

    const { rows } = await query(
      `INSERT INTO schedules (
         name, cron_expression, event_trigger, application_id, scope, test_plan_id, test_suite_id,
         test_case_ids, environment_id, enabled, created_by
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,COALESCE($10,true),$11)
       RETURNING *`,
      [
        b.name,
        b.cron_expression ?? null,
        b.event_trigger ?? null,
        applicationId ?? null,
        JSON.stringify(b.scope && typeof b.scope === 'object' ? b.scope : {}),
        b.test_plan_id ?? null,
        b.test_suite_id ?? null,
        b.test_case_ids ?? [],
        environmentId ?? null,
        b.enabled ?? true,
        b.created_by ?? req.actor?.id ?? null,
      ]
    );
    await audit(req, 'schedule.create', 'schedule', rows[0]!.id, { name: b.name, cron_expression: b.cron_expression ?? null, event_trigger: b.event_trigger ?? null });
    return reply.status(201).send({ data: withNextRun(rows[0], tz) });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/schedules/:id',
    async (req, reply) => {
      const b = req.body || {};
      if (b.cron_expression && !isValidExpression(String(b.cron_expression))) {
        return reply.status(400).send({ error: 'cron_expression must be five cron fields ("0 2 * * *"), @hourly/@daily/@weekly, or every:N' });
      }
      const applicationId = await resolveId('applications', b.application ?? b.application_key ?? b.application_id);
      if (applicationId === undefined && (b.application || b.application_key || b.application_id)) {
        return reply.status(404).send({ error: 'Application not found' });
      }
      const environmentId = await resolveId('environments', b.environment ?? b.environment_key ?? b.environment_id);
      if (environmentId === undefined && (b.environment || b.environment_key || b.environment_id)) {
        return reply.status(404).send({ error: 'Environment not found' });
      }
      const { rows } = await query(
        `UPDATE schedules SET
           name = COALESCE($2, name),
           cron_expression = COALESCE($3, cron_expression),
           event_trigger = COALESCE($4, event_trigger),
           enabled = COALESCE($5, enabled),
           environment_id = COALESCE($6, environment_id),
           application_id = COALESCE($7, application_id),
           scope = COALESCE($8::jsonb, scope),
           test_case_ids = COALESCE($9, test_case_ids),
           updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          req.params.id,
          b.name ?? null,
          b.cron_expression ?? null,
          b.event_trigger ?? null,
          b.enabled ?? null,
          environmentId ?? null,
          applicationId ?? null,
          b.scope && typeof b.scope === 'object' ? JSON.stringify(b.scope) : null,
          b.test_case_ids ?? null,
        ]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Schedule not found' });
      await audit(req, 'schedule.update', 'schedule', rows[0].id, { changed_fields: Object.keys(b) });
      return reply.send({ data: withNextRun(rows[0], tz) });
    }
  );

  app.delete<{ Params: { id: string } }>('/api/v1/schedules/:id', async (req, reply) => {
    const { rows } = await query('DELETE FROM schedules WHERE id = $1 RETURNING id, name', [req.params.id]);
    if (!rows[0]) return reply.status(404).send({ error: 'Schedule not found' });
    await audit(req, 'schedule.delete', 'schedule', rows[0].id, { name: rows[0].name });
    return reply.status(204).send();
  });

  /**
   * Fire a schedule now (the poller, a person, or a deploy hook).
   *
   * The poller sends `expected_last_run_at` — the last_run_at it saw when it
   * judged the schedule due. The run is then claimed with a compare-and-set, so
   * two overlapping polls (or two pollers) that both saw "due" queue one run,
   * not two; the loser gets 409. A person pressing "Run now" sends no such field
   * and always fires.
   */
  app.post<{ Params: { id: string }; Body?: { requested_by?: string; environment?: string; expected_last_run_at?: string | null } }>(
    '/api/v1/schedules/:id/run',
    async (req, reply) => {
      const { rows } = await query('SELECT * FROM schedules WHERE id = $1', [req.params.id]);
      if (!rows[0]) return reply.status(404).send({ error: 'Schedule not found' });
      const environmentId = await resolveId('environments', req.body?.environment);
      if (environmentId === undefined && req.body?.environment) return reply.status(404).send({ error: 'Environment not found' });

      const claiming = !!req.body && 'expected_last_run_at' in req.body;
      const expected = claiming ? req.body!.expected_last_run_at ?? null : null;
      if (claiming) {
        // JSON carries milliseconds; the column holds microseconds.
        const claimed = await query(
          `UPDATE schedules SET last_run_at = now()
           WHERE id = $1 AND date_trunc('milliseconds', last_run_at) IS NOT DISTINCT FROM date_trunc('milliseconds', $2::timestamptz)
           RETURNING id`,
          [rows[0].id, expected]
        );
        if (!claimed.rows[0]) return reply.status(409).send({ error: 'Schedule was already fired for this occurrence', code: 'already_fired' });
      }

      const outcome = await fire(rows[0], {
        requested_by: req.body?.requested_by || req.actor?.id || 'scheduler',
        trigger_source: 'schedule',
        environment_id: environmentId ?? null,
      });
      // Nothing was queued: give the claim back so the occurrence is not silently consumed.
      if (claiming && outcome.status !== 202) {
        await query(`UPDATE schedules SET last_run_at = $2::timestamptz WHERE id = $1`, [rows[0].id, expected]);
      }
      if (outcome.status === 202) await audit(req, 'schedule.run', 'schedule', rows[0].id, outcome.queued || {});
      return reply.status(outcome.status).send(outcome.body);
    }
  );

  /** Event-based trigger (after_build, after_deploy, ...) fires every enabled schedule bound to the event. */
  app.post<{ Body: { event: string; environment?: string; environment_id?: string; metadata?: Record<string, unknown> } }>(
    '/api/v1/schedules/trigger',
    async (req, reply) => {
      const event = req.body?.event;
      if (!event) return reply.status(400).send({ error: 'event required' });
      const environmentId = await resolveId('environments', req.body?.environment ?? req.body?.environment_id);
      if (environmentId === undefined && (req.body?.environment || req.body?.environment_id)) {
        return reply.status(404).send({ error: 'Environment not found' });
      }

      const { rows } = await query(`SELECT * FROM schedules WHERE enabled = true AND event_trigger = $1`, [event]);
      const started: any[] = [];
      const skipped: any[] = [];
      for (const s of rows) {
        const outcome = await fire(s, {
          requested_by: req.actor?.id || 'event',
          trigger_source: 'ci',
          environment_id: environmentId ?? null,
          event,
          metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {},
        });
        if (outcome.status === 202) started.push({ schedule: s.name, ...(outcome.body.data || {}) });
        else skipped.push({ schedule: s.name, ...outcome.body });
      }
      await audit(req, 'schedule.event', 'event', event, { started: started.length, skipped: skipped.length });
      return reply.status(202).send({ data: { event, executions_started: started.length, executions: started, skipped } });
    }
  );
}
