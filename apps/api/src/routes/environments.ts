import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

export async function environmentRoutes(app: FastifyInstance) {
  app.get('/api/v1/environments', async (_req, reply) => {
    const { rows } = await query('SELECT * FROM environments ORDER BY name');
    return reply.send({ data: rows });
  });

  app.get<{ Params: { id: string } }>('/api/v1/environments/:id', async (req, reply) => {
    const { rows } = await query(
      'SELECT * FROM environments WHERE id::text = $1 OR key = $1',
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Environment not found' });
    return reply.send({ data: rows[0] });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/environments', async (req, reply) => {
    const b = req.body || {};
    if (!b.key || !b.name) return reply.status(400).send({ error: 'key and name required' });
    const { rows } = await query(
      `INSERT INTO environments (key, name, env_type, base_url, config, secrets_ref, safety_policy, worker_affinity, created_by)
       VALUES ($1,$2,COALESCE($3,'development'),$4,COALESCE($5,'{}'::jsonb),$6,COALESCE($7,'{}'::jsonb),$8,$9)
       RETURNING *`,
      [
        b.key, b.name, b.env_type ?? null, b.base_url ?? null,
        JSON.stringify(b.config ?? {}), b.secrets_ref ?? null,
        JSON.stringify(b.safety_policy ?? {}),
        b.worker_affinity ?? null, b.created_by ?? null,
      ]
    );
    return reply.status(201).send({ data: rows[0] });
  });

  app.get<{ Params: { id: string } }>('/api/v1/environments/:id/policy', async (req, reply) => {
    const { rows } = await query(
      'SELECT key, name, safety_policy FROM environments WHERE id::text = $1 OR key = $1',
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Environment not found' });
    return reply.send({ data: rows[0] });
  });

  /** Check whether a safety category is allowed on this environment */
  app.post<{ Params: { id: string }; Body: { category: string } }>(
    '/api/v1/environments/:id/policy/check',
    async (req, reply) => {
      const { rows } = await query(
        'SELECT safety_policy FROM environments WHERE id::text = $1 OR key = $1',
        [req.params.id]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Environment not found' });
      const policy = rows[0].safety_policy || {};
      const category = req.body?.category;
      const decision = policy[category] || 'prohibited';
      return reply.send({
        data: {
          category,
          decision,
          allowed: decision === 'allowed',
          requires_approval: decision === 'approval_required',
          prohibited: decision === 'prohibited',
        },
      });
    }
  );
}
