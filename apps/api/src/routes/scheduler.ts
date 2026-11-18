import type { FastifyInstance, FastifyReply } from 'fastify';
import { audit } from '../middleware/rbac.js';
import {
  DEFAULT_TZ, executionPlan, fire, previewCron, previewTarget, schedulerOptions, SchedulerError,
} from '../schedule/service.js';
import { normalizeTarget, TargetError } from '../schedule/target.js';
import { withTransaction } from '../db/client.js';

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof SchedulerError) return reply.status(err.statusCode).send({ error: err.message });
  if (err instanceof TargetError) return reply.status(400).send({ error: err.message });
  throw err;
}

/**
 * Scheduler page API: Run now, target preview, cron preview and the Execution Plan.
 * Cron schedules themselves stay in routes/schedules.ts and are fired by the
 * scheduler poller (apps/api/src/scheduler.ts), so no in-process ticker runs here.
 */
export async function schedulerRoutes(app: FastifyInstance) {
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
