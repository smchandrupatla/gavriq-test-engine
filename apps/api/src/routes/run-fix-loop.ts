/**
 * Per-run auto-fix loop API — see apps/api/src/run-fix-loop.ts for the engine behaviour.
 *
 *   GET  /api/v1/run-fix-loops          recent loops (default 50, max 500)
 *   GET  /api/v1/run-fix-loops/:runId   state of one loop (404 if the run never opted in)
 *   POST /api/v1/run-fix-loops/:runId/stop   mark a running loop stopped (does not cancel the current rerun)
 */
import type { FastifyInstance } from 'fastify';
import { getFixLoop, listFixLoops, stopFixLoop } from '../run-fix-loop.js';

export async function fixLoopRoutes(app: FastifyInstance) {
  app.get('/api/v1/run-fix-loops', async (req, reply) => {
    const limit = Number((req.query as any)?.limit) || 50;
    const rows = await listFixLoops(limit);
    return reply.send({ data: rows });
  });

  app.get<{ Params: { runId: string } }>('/api/v1/run-fix-loops/:runId', async (req, reply) => {
    const loop = await getFixLoop(req.params.runId);
    if (!loop) return reply.status(404).send({ error: 'No auto-fix loop for this run', run_id: req.params.runId });
    return reply.send({ data: loop });
  });

  app.post<{ Params: { runId: string }; Body: { reason?: string } }>(
    '/api/v1/run-fix-loops/:runId/stop',
    async (req, reply) => {
      const ok = await stopFixLoop(req.params.runId, req.body?.reason);
      if (!ok) return reply.status(409).send({ error: 'Loop is not in a running state (already converged, parked or stopped)', run_id: req.params.runId });
      const loop = await getFixLoop(req.params.runId);
      return reply.send({ data: loop });
    }
  );
}
