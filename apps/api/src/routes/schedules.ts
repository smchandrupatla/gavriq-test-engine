import type { FastifyInstance, FastifyReply } from 'fastify';
import { audit } from '../middleware/rbac.js';
import {
  deleteSchedule, executionPlan, fire, fireEvent, listSchedules, previewCron, previewTarget,
  runSchedule, saveSchedule, schedulerOptions, SchedulerError, DEFAULT_TZ,
} from '../schedule/service.js';
import { normalizeTarget, TargetError } from '../schedule/target.js';
import { withTransaction } from '../db/client.js';

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof SchedulerError) return reply.status(err.statusCode).send({ error: err.message });
  if (err instanceof TargetError) return reply.status(400).send({ error: err.message });
  throw err;
}

/** Scheduler — Run now, cron schedules, event triggers and the Execution Plan. */
export async function scheduleRoutes(app: FastifyInstance) {
  app.get('/api/v1/schedules', async (_req, reply) => reply.send({ data: await listSchedules() }));

  app.post<{ Body: Record<string, unknown> }>('/api/v1/schedules', async (req, reply) => {
    try {
      const data = await saveSchedule(null, req.body || {}, req.actor?.id ?? (req.body?.created_by as string) ?? null);
      await audit(req, 'schedule.create', 'schedule', data.id, { name: data.name, cron: data.cron_expression });
      return reply.status(201).send({ data });
    } catch (err) { return fail(reply, err); }
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/schedules/:id', async (req, reply) => {
    try {
      const data = await saveSchedule(req.params.id, req.body || {}, req.actor?.id ?? null);
      await audit(req, 'schedule.update', 'schedule', data.id, { fields: Object.keys(req.body || {}) });
      return reply.send({ data });
    } catch (err) { return fail(reply, err); }
  });

  app.delete<{ Params: { id: string } }>('/api/v1/schedules/:id', async (req, reply) => {
    try {
      await deleteSchedule(req.params.id);
      await audit(req, 'schedule.delete', 'schedule', req.params.id, {});
      return reply.status(204).send();
    } catch (err) { return fail(reply, err); }
  });

  /** Fire a schedule immediately. */
  app.post<{ Params: { id: string }; Body?: { requested_by?: string } }>('/api/v1/schedules/:id/run', async (req, reply) => {
    try {
      const data = await runSchedule(req.params.id, 'manual', req.body?.requested_by || req.actor?.id || 'operator');
      if (data?.outcome === 'skipped_empty') return reply.status(400).send({ error: 'Schedule has no test cases or target', data });
      return reply.status(202).send({ data: { ...data, ...(data?.execution ?? {}) }, message: 'Execution queued from schedule' });
    } catch (err) { return fail(reply, err); }
  });

  /** Event-based trigger (after_build, after_deploy, ...). */
  app.post<{ Body: { event: string; environment_id?: string } }>('/api/v1/schedules/trigger', async (req, reply) => {
    const event = req.body?.event;
    if (!event) return reply.status(400).send({ error: 'event required' });
    const results = await fireEvent(String(event).slice(0, 64), req.body?.environment_id ?? null, 'event');
    return reply.status(202).send({
      data: { event, executions_started: results.filter((r) => r!.outcome === 'queued').length, executions: results },
    });
  });

  app.get('/api/v1/scheduler/options', async (_req, reply) => reply.send({ data: await schedulerOptions() }));

  app.get('/api/v1/scheduler/plan', async (req, reply) => {
    const q = req.query as { hours?: string };
    return reply.send({ data: await executionPlan(Number(q.hours) || 168) });
  });

  app.post<{ Body: { target?: unknown } }>('/api/v1/scheduler/preview', async (req, reply) => {
    try {
      return reply.send({ data: await previewTarget(normalizeTarget(req.body?.target)) });
    } catch (err) { return fail(reply, err); }
  });

  app.post<{ Body: { cron_expression?: string; timezone?: string; count?: number } }>('/api/v1/scheduler/cron-preview', async (req, reply) => {
    try {
      return reply.send({ data: previewCron(String(req.body?.cron_expression ?? ''), req.body?.timezone || DEFAULT_TZ, req.body?.count ?? 5) });
    } catch (err) { return fail(reply, err); }
  });

  /** On demand: all tests, chosen types, chosen suites or chosen cases. */
  app.post<{ Body: { target?: unknown; environment_id?: string; label?: string; requested_by?: string } }>(
    '/api/v1/scheduler/run-now',
    async (req, reply) => {
      try {
        const target = normalizeTarget(req.body?.target);
        const by = req.body?.requested_by || req.actor?.id || 'operator';
        const data = await withTransaction((db) => fire(db, {
          target, trigger: 'manual', requested_by: String(by).slice(0, 120),
          environment_id: req.body?.environment_id ?? null, label: req.body?.label?.slice(0, 200) ?? null,
        }));
        if (data.outcome === 'skipped_empty') return reply.status(400).send({ error: 'That selection matches no test cases', data });
        await audit(req, 'scheduler.run_now', 'execution', data.execution?.id, { target, cases: data.case_count });
        return reply.status(202).send({ data, message: 'Execution queued' });
      } catch (err) { return fail(reply, err); }
    }
  );
}
