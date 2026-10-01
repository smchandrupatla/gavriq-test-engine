/**
 * Deploy `ref` (default `main`) to an environment's own deploy control plane
 * (see sand-bench-enterprise/deploy/api), then — once that deploy reports
 * back — optionally queue "everything" for the run. This is the Test Engine
 * side of that round trip:
 *
 *   POST /api/v1/deployments                 trigger a deploy → 202 { data }
 *   GET  /api/v1/deployments                  recent deployments (filter by environment)
 *   GET  /api/v1/deployments/:id              one deployment's state
 *   POST /api/v1/deployments/:id/callback     the environment's own deploy API reports in here
 *
 * A failed deploy (either the trigger call itself failing, or the callback
 * reporting `status: "failed"`) never queues a run — mode = deploy_and_run
 * only calls runAllCases() after a `succeeded` callback.
 */
import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { audit } from '../middleware/rbac.js';
import { runAllCases } from './executions.js';

const ENGINE_PUBLIC_URL = (process.env.ENGINE_PUBLIC_URL || 'http://127.0.0.1:8797').replace(/\/$/, '');

function callbackUrl(id: string): string {
  return `${ENGINE_PUBLIC_URL}/api/v1/deployments/${encodeURIComponent(id)}/callback`;
}

export async function deploymentRoutes(app: FastifyInstance) {
  app.post<{ Body: Record<string, unknown> }>('/api/v1/deployments', async (req, reply) => {
    const b = req.body || {};
    const envRef = typeof b.environment_id === 'string' ? b.environment_id : '';
    const application = typeof b.application === 'string' ? b.application : '';
    const mode = b.mode === 'deploy_and_run' ? 'deploy_and_run' : b.mode === 'deploy_only' ? 'deploy_only' : null;
    const ref = typeof b.ref === 'string' && b.ref.trim() ? b.ref.trim() : 'main';
    if (!envRef || !application || !mode) {
      return reply.status(400).send({ error: 'environment_id, application and mode ("deploy_only"|"deploy_and_run") are required' });
    }

    const { rows: envRows } = await query(
      'SELECT id, key, name, config FROM environments WHERE id::text = $1 OR key = $1',
      [envRef]
    );
    const environment = envRows[0];
    if (!environment) return reply.status(404).send({ error: 'Environment not found', environment: envRef });

    const deployApi = (environment.config || {}).deploy_api as { base_url?: string; key_env?: string } | undefined;
    if (!deployApi?.base_url || !deployApi?.key_env) {
      return reply.status(409).send({
        error: `Environment "${environment.key}" has no config.deploy_api {base_url, key_env} — nothing to deploy to`,
      });
    }
    const deployKey = process.env[deployApi.key_env];
    if (!deployKey) {
      return reply.status(500).send({ error: `${deployApi.key_env} is not set on the Test Engine` });
    }

    const requestedBy = (typeof b.requested_by === 'string' && b.requested_by) || req.actor?.id || null;
    const { rows } = await query(
      `INSERT INTO deployments (application, environment_id, ref, mode, status, requested_by)
       VALUES ($1,$2,$3,$4,'queued',$5)
       RETURNING *`,
      [application, environment.id, ref, mode, requestedBy]
    );
    const row = rows[0]!;

    await audit(req, 'deployment.trigger', 'environment', environment.id, { deployment_id: row.id, application, ref, mode });

    try {
      const res = await fetch(`${deployApi.base_url.replace(/\/$/, '')}/v1/deploy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-deploy-key': deployKey },
        body: JSON.stringify({ ref, callback_url: callbackUrl(row.id), requested_by: requestedBy }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`deploy API returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const { job_id } = await res.json().catch(() => ({ job_id: null }));

      const { rows: updated } = await query(
        `UPDATE deployments SET status = 'deploying', key = $2, started_at = now() WHERE id = $1 RETURNING *`,
        [row.id, job_id ?? null]
      );
      return reply.status(202).send({ data: updated[0] });
    } catch (err) {
      const { rows: failed } = await query(
        `UPDATE deployments SET status = 'failed', error = $2, started_at = now(), finished_at = now() WHERE id = $1 RETURNING *`,
        [row.id, (err as Error).message.slice(0, 2000)]
      );
      return reply.status(202).send({ data: failed[0] });
    }
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
    const { rows } = await query(
      `SELECT d.*, env.key AS environment_key, env.name AS environment_name
       FROM deployments d JOIN environments env ON env.id = d.environment_id
       ${where} ORDER BY d.created_at DESC LIMIT $${params.length}`,
      params
    );
    return reply.send({ data: rows });
  });

  app.get<{ Params: { id: string } }>('/api/v1/deployments/:id', async (req, reply) => {
    const { rows } = await query(
      `SELECT d.*, env.key AS environment_key, env.name AS environment_name
       FROM deployments d JOIN environments env ON env.id = d.environment_id
       WHERE d.id::text = $1 OR d.key = $1`,
      [req.params.id]
    );
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

      if (status === 'failed') {
        const { rows: updated } = await query(
          `UPDATE deployments SET status = 'failed', error = $2, finished_at = now() WHERE id = $1 RETURNING *`,
          [row.id, typeof b.error === 'string' ? b.error.slice(0, 2000) : 'Deploy failed']
        );
        await audit(req, 'deployment.completed', 'environment', row.environment_id, { deployment_id: row.id, status, error: b.error });
        return reply.send({ data: updated[0] });
      }

      let runId: string | null = null;
      if (row.mode === 'deploy_and_run') {
        const outcome = await runAllCases(
          { application_key: row.application, environment_id: row.environment_id, trigger_source: 'deploy', requested_by: row.requested_by },
          req.actor?.id
        );
        runId = (outcome.body?.data?.run_group as string) ?? null;
      }

      const { rows: updated } = await query(
        `UPDATE deployments SET status = 'succeeded', commit = $2, version = $3, run_id = $4, finished_at = now() WHERE id = $1 RETURNING *`,
        [row.id, typeof b.commit === 'string' ? b.commit : null, typeof b.version === 'string' ? b.version : null, runId]
      );
      await audit(req, 'deployment.completed', 'environment', row.environment_id, { deployment_id: row.id, status, run_id: runId });
      return reply.send({ data: updated[0] });
    }
  );
}
