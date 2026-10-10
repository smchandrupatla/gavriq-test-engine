/**
 * Deploy-failure loop routes — the Sand Bench repo's agent lists failures to
 * work on, the console reads the status for the banner, and an operator can
 * un-park a report after an offline fix.
 *
 *   GET  /api/v1/deploy-failures
 *     ?application=sand-bench&status=open      list for the application repo's agent
 *   GET  /api/v1/deploy-failures/current
 *     ?application=sand-bench&environment=sb   current loop for one app+env (banner)
 *   POST /api/v1/deploy-failures/:key/retry    reset a parked report so the loop runs again
 *
 * The child defects of a kind='deploy' report move through the same claim/fix
 * endpoints as test defects (apps/api/src/routes/defects.ts): the agent calls
 * POST /api/v1/defects/reports/:key/claim and PATCH /api/v1/defects/:key.
 */
import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { currentDeployLoop, listDeployLoops } from '../deploy-loop.js';

export async function deployLoopRoutes(app: FastifyInstance) {
  app.get('/api/v1/deploy-failures', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const loops = await listDeployLoops({
      application: q.application || undefined,
      status: q.status || undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
    return reply.send({ data: loops });
  });

  app.get('/api/v1/deploy-failures/current', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const application = q.application || 'sand-bench';
    const environment = q.environment;
    if (!environment) return reply.status(400).send({ error: 'environment is required' });
    const loop = await currentDeployLoop(application, environment);
    return reply.send({ data: loop });
  });

  app.post<{ Params: { key: string } }>('/api/v1/deploy-failures/:key/retry', async (req, reply) => {
    const by = req.actor?.id || 'operator';
    const { rows } = await query(
      `UPDATE defect_reports
          SET status = 'open', deploy_retry_count = 0, updated_at = now(),
              history = history || $2::jsonb
        WHERE (id::text = $1 OR key = $1) AND kind = 'deploy'
        RETURNING *`,
      [
        req.params.key,
        JSON.stringify([{ at: new Date().toISOString(), by, action: 'retry_after_park' }]),
      ]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'deploy-failure report not found' });
    return reply.send({ data: rows[0] });
  });
}
