/**
 * Cycle runs — deploy, run, tear down, repeated N times from one click.
 *
 *   POST /api/v1/cycle-runs                   {application, environment, iterations}
 *   GET  /api/v1/cycle-runs                   list (filter by application, environment, status)
 *   GET  /api/v1/cycle-runs/current           ?application=…&environment=…  the running or newest cycle
 *   GET  /api/v1/cycle-runs/:idOrKey          one cycle
 *   POST /api/v1/cycle-runs/:idOrKey/cancel   cancel: stop the chain and cancel any live run
 */
import type { FastifyInstance } from 'fastify';
import { cancelCycle, currentCycle, getCycle, listCycles, startCycleRun } from '../cycle-run.js';
import { audit } from '../middleware/rbac.js';

export async function cycleRunRoutes(app: FastifyInstance) {
  app.post<{ Body: Record<string, unknown> }>('/api/v1/cycle-runs', async (req, reply) => {
    const b = req.body || {};
    const outcome = await startCycleRun(
      {
        application: typeof b.application === 'string' ? b.application : '',
        environment: typeof b.environment === 'string' ? b.environment : (typeof b.environment_id === 'string' ? b.environment_id : ''),
        iterations: Number(b.iterations),
        clean_start: Boolean(b.clean_start),
        requestedBy: typeof b.requested_by === 'string' ? b.requested_by : req.actor?.id || null,
      },
      req.actor?.id
    );
    if (outcome.status === 202 && outcome.body.data) {
      const data = outcome.body.data as any;
      await audit(req, 'cycle_run.start', 'environment', data.environment_id, {
        cycle_run_id: data.id,
        iterations: data.iterations_total,
        application: data.application,
      });
    }
    return reply.status(outcome.status).send(outcome.body);
  });

  app.get('/api/v1/cycle-runs', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const data = await listCycles({
      application: q.application || undefined,
      environment: q.environment || q.environment_id || undefined,
      status: q.status || undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
    return reply.send({ data });
  });

  app.get('/api/v1/cycle-runs/current', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const application = q.application || 'sand-bench';
    const environment = q.environment || q.environment_id;
    if (!environment) return reply.status(400).send({ error: 'environment is required' });
    const cycle = await currentCycle(application, environment);
    return reply.send({ data: cycle });
  });

  app.get<{ Params: { id: string } }>('/api/v1/cycle-runs/:id', async (req, reply) => {
    const cycle = await getCycle(req.params.id);
    if (!cycle) return reply.status(404).send({ error: 'Cycle run not found' });
    return reply.send({ data: cycle });
  });

  app.post<{ Params: { id: string } }>('/api/v1/cycle-runs/:id/cancel', async (req, reply) => {
    const cycle = await getCycle(req.params.id);
    if (!cycle) return reply.status(404).send({ error: 'Cycle run not found' });
    const by = req.actor?.id || 'operator';
    const result = await cancelCycle(cycle.id, by);
    await audit(req, 'cycle_run.cancel', 'environment', cycle.environment_id, {
      cycle_run_id: cycle.id, cancelled_runs: result.cancelled_runs,
    });
    const latest = await getCycle(cycle.id);
    return reply.send({ data: latest, cancelled_runs: result.cancelled_runs });
  });
}
