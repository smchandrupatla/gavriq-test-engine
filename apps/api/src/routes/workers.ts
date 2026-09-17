import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

export async function workerRoutes(app: FastifyInstance) {
  app.get('/api/v1/workers', async (_req, reply) => {
    const { rows } = await query('SELECT * FROM workers ORDER BY name');
    return reply.send({ data: rows });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/workers/register', async (req, reply) => {
    const b = req.body || {};
    if (!b.id || !b.name) return reply.status(400).send({ error: 'id and name required' });
    const { rows } = await query(
      `INSERT INTO workers (id, name, capabilities, labels, last_heartbeat, status, max_concurrency, metadata)
       VALUES ($1,$2,COALESCE($3,'[]'::jsonb),COALESCE($4,'{}'::jsonb),now(),'online',COALESCE($5,4),COALESCE($6,'{}'::jsonb))
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         capabilities = EXCLUDED.capabilities,
         labels = EXCLUDED.labels,
         last_heartbeat = now(),
         status = 'online',
         max_concurrency = EXCLUDED.max_concurrency,
         metadata = EXCLUDED.metadata
       RETURNING *`,
      [
        b.id, b.name, JSON.stringify(b.capabilities ?? []),
        JSON.stringify(b.labels ?? {}), b.max_concurrency ?? null,
        JSON.stringify(b.metadata ?? {}),
      ]
    );
    return reply.status(201).send({ data: rows[0] });
  });

  app.post<{ Params: { id: string } }>('/api/v1/workers/:id/heartbeat', async (req, reply) => {
    const { rows } = await query(
      `UPDATE workers SET last_heartbeat = now(),
         status = CASE WHEN status = 'offline' THEN 'online' ELSE status END
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Worker not found' });
    return reply.send({ data: rows[0] });
  });

  app.post<{ Params: { id: string } }>('/api/v1/workers/:id/drain', async (req, reply) => {
    const { rows } = await query(
      `UPDATE workers SET status = 'draining' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Worker not found' });
    return reply.send({ data: rows[0] });
  });
}
