import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

export async function applicationRoutes(app: FastifyInstance) {
  app.get('/api/v1/applications', async (_req, reply) => {
    const { rows } = await query('SELECT * FROM applications ORDER BY name');
    return reply.send({ data: rows });
  });

  app.get<{ Params: { id: string } }>('/api/v1/applications/:id', async (req, reply) => {
    const { rows } = await query(
      'SELECT * FROM applications WHERE id = $1 OR key = $1',
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Application not found' });
    return reply.send({ data: rows[0] });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/applications', async (req, reply) => {
    const b = req.body || {};
    if (!b.key || !b.name) return reply.status(400).send({ error: 'key and name are required' });
    const { rows } = await query(
      `INSERT INTO applications (key, name, description, owner_id, status, metadata, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5,'active'),COALESCE($6,'{}'::jsonb),$7)
       RETURNING *`,
      [b.key, b.name, b.description ?? null, b.owner_id ?? null, b.status ?? null,
       JSON.stringify(b.metadata ?? {}), b.created_by ?? null]
    );
    return reply.status(201).send({ data: rows[0] });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/applications/:id',
    async (req, reply) => {
      const b = req.body || {};
      const { rows } = await query(
        `UPDATE applications SET
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           owner_id = COALESCE($4, owner_id),
           status = COALESCE($5, status),
           metadata = COALESCE($6, metadata),
           updated_at = now(),
           updated_by = $7
         WHERE id = $1 OR key = $1
         RETURNING *`,
        [req.params.id, b.name ?? null, b.description ?? null, b.owner_id ?? null,
         b.status ?? null, b.metadata ? JSON.stringify(b.metadata) : null, b.updated_by ?? null]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Application not found' });
      return reply.send({ data: rows[0] });
    }
  );
}
