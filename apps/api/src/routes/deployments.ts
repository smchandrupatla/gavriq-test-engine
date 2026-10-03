/**
 * Deploy `ref` (default `main`) to an environment, then — once the deploy has
 * finished — optionally run the application's tests, and tear the stack down
 * again after that run. Two ways to deploy, chosen by the environment's config:
 *
 *   config.infra {driver: "compose", script}  a local Docker stack: the infra
 *                                              agent on the Docker host runs the
 *                                              deploy script (see ../infra.ts)
 *   config.deploy_api {base_url, key_env}     a remote deploy control plane
 *                                              (e.g. sand-bench-enterprise/deploy/api)
 *                                              that reports back to the callback
 *
 *   POST /api/v1/deployments                 trigger → 202 { data }
 *        {environment_id, application, mode: "deploy_only"|"deploy_and_run",
 *         ref?, teardown_after_run?}
 *   GET  /api/v1/deployments                 recent deployments (filter by environment)
 *   GET  /api/v1/deployments/:id             one deployment, with its infra job and teardown state
 *   POST /api/v1/deployments/:id/callback    a remote deploy API reports in here
 *
 * A failed deploy never queues a run: mode = deploy_and_run only runs after a
 * `succeeded` outcome, from the agent or the callback.
 */
import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { audit } from '../middleware/rbac.js';
import { completeDeployment, createDeployment } from '../infra.js';

const WITH_JOBS = `
  SELECT d.*, env.key AS environment_key, env.name AS environment_name,
         env.config->'deployment'->>'state' AS environment_state,
         (SELECT jsonb_build_object('id', j.id, 'status', j.status, 'agent_id', j.agent_id, 'started_at', j.started_at,
                                    'updated_at', j.updated_at, 'finished_at', j.finished_at, 'error', j.error,
                                    'log_tail', right(j.log, 1200))
            FROM infra_jobs j WHERE j.deployment_id = d.id AND j.kind = 'deploy' ORDER BY j.created_at DESC LIMIT 1) AS job,
         (SELECT jsonb_build_object('id', t.id, 'status', t.status, 'reason', t.reason, 'created_at', t.created_at,
                                    'finished_at', t.finished_at, 'error', t.error)
            FROM infra_jobs t WHERE t.id = d.teardown_job_id) AS teardown,
         EXISTS (SELECT 1 FROM infra_agents a WHERE a.last_heartbeat > now() - interval '90 seconds') AS agent_online
  FROM deployments d JOIN environments env ON env.id = d.environment_id`;

export async function deploymentRoutes(app: FastifyInstance) {
  app.post<{ Body: Record<string, unknown> }>('/api/v1/deployments', async (req, reply) => {
    const b = req.body || {};
    const mode = b.mode === 'deploy_and_run' ? 'deploy_and_run' : b.mode === 'deploy_only' ? 'deploy_only' : null;
    const envRef = typeof b.environment_id === 'string' ? b.environment_id : typeof b.environment === 'string' ? b.environment : '';
    const application = typeof b.application === 'string' ? b.application : '';
    if (!envRef || !application || !mode) {
      return reply.status(400).send({ error: 'environment_id, application and mode ("deploy_only"|"deploy_and_run") are required' });
    }
    const outcome = await createDeployment(
      {
        environment: envRef,
        application,
        mode,
        ref: typeof b.ref === 'string' ? b.ref : null,
        teardown_after_run: typeof b.teardown_after_run === 'boolean' ? b.teardown_after_run : null,
        requested_by: (typeof b.requested_by === 'string' && b.requested_by) || req.actor?.id || null,
      },
      req.actor?.id
    );
    if (outcome.audit) await audit(req, 'deployment.trigger', 'environment', outcome.audit.environment_id, outcome.audit.details);
    return reply.status(outcome.status).send(outcome.body);
  });

  app.get('/api/v1/deployments', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const limit = Math.max(1, Math.min(Number(q.limit) || 20, 100));
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (q.environment_id) {
      params.push(q.environment_id);
      clauses.push(`(d.environment_id::text = $${params.length} OR env.key = $${params.length})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(limit);
    const { rows } = await query(`${WITH_JOBS} ${where} ORDER BY d.created_at DESC LIMIT $${params.length}`, params);
    return reply.send({ data: rows });
  });

  app.get<{ Params: { id: string } }>('/api/v1/deployments/:id', async (req, reply) => {
    const { rows } = await query(`${WITH_JOBS} WHERE d.id::text = $1 OR d.key = $1`, [req.params.id]);
    if (!rows[0]) return reply.status(404).send({ error: 'Deployment not found' });
    return reply.send({ data: rows[0] });
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/deployments/:id/callback',
    async (req, reply) => {
      const { rows } = await query('SELECT * FROM deployments WHERE id::text = $1', [req.params.id]);
      const row = rows[0];
      if (!row) return reply.status(404).send({ error: 'Deployment not found' });

      const b = req.body || {};
      const status = b.status === 'succeeded' || b.status === 'failed' ? b.status : null;
      if (!status) return reply.status(400).send({ error: 'status must be "succeeded" or "failed"' });
      if (row.status === 'succeeded' || row.status === 'failed') {
        return reply.status(409).send({ error: `Deployment already ${row.status}`, data: row });
      }

      const updated = await completeDeployment(
        row,
        {
          status,
          commit: typeof b.commit === 'string' ? b.commit : null,
          version: typeof b.version === 'string' ? b.version : null,
          error: typeof b.error === 'string' ? b.error : null,
        },
        req.actor?.id
      );
      await audit(req, 'deployment.completed', 'environment', row.environment_id, { deployment_id: row.id, status, run_id: updated.run_id, error: updated.error });
      return reply.send({ data: updated });
    }
  );
}
