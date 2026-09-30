import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/v1/settings', async (_req, reply) => {
    const { rows } = await query('SELECT run_retention_days, updated_at FROM settings WHERE id = true');
    return reply.send({ data: rows[0] || { run_retention_days: 5, updated_at: null } });
  });

  app.put<{ Body: { run_retention_days?: unknown } }>('/api/v1/settings', async (req, reply) => {
    const days = Number(req.body?.run_retention_days);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return reply.status(400).send({ error: 'run_retention_days must be an integer between 1 and 365' });
    }
    const { rows } = await query(
      `UPDATE settings SET run_retention_days = $1, updated_at = now(), updated_by = $2
       WHERE id = true RETURNING run_retention_days, updated_at`,
      [days, req.actor?.id ?? null]
    );
    return reply.send({ data: rows[0] });
  });
}
