import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

export async function suitePlanRoutes(app: FastifyInstance) {
  // Suites
  app.get('/api/v1/suites', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const params: unknown[] = [];
    let where = '';
    if (q.application_id) {
      where = 'WHERE application_id = $1';
      params.push(q.application_id);
    }
    const { rows } = await query(`SELECT * FROM test_suites ${where} ORDER BY name`, params);
    return reply.send({ data: rows });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/suites', async (req, reply) => {
    const b = req.body || {};
    if (!b.key || !b.name || !b.application_id) {
      return reply.status(400).send({ error: 'key, name, application_id required' });
    }
    const { rows } = await query(
      `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [b.key, b.name, b.description ?? null, b.application_id, b.suite_type ?? null, b.created_by ?? null]
    );
    return reply.status(201).send({ data: rows[0] });
  });

  app.post<{ Params: { id: string }; Body: { test_case_ids: string[] } }>(
    '/api/v1/suites/:id/cases',
    async (req, reply) => {
      const ids = req.body?.test_case_ids || [];
      for (let i = 0; i < ids.length; i++) {
        await query(
          `INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [ids[i], req.params.id, i]
        );
      }
      return reply.send({ data: { added: ids.length } });
    }
  );

  // Plans
  app.get('/api/v1/plans', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const params: unknown[] = [];
    let where = '';
    if (q.application_id) {
      where = 'WHERE application_id = $1';
      params.push(q.application_id);
    }
    const { rows } = await query(`SELECT * FROM test_plans ${where} ORDER BY name`, params);
    return reply.send({ data: rows });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/plans', async (req, reply) => {
    const b = req.body || {};
    if (!b.key || !b.name || !b.application_id) {
      return reply.status(400).send({ error: 'key, name, application_id required' });
    }
    const { rows } = await query(
      `INSERT INTO test_plans (key, name, description, application_id, release_id, status, created_by)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'draft'),$7) RETURNING *`,
      [b.key, b.name, b.description ?? null, b.application_id, b.release_id ?? null,
       b.status ?? null, b.created_by ?? null]
    );
    return reply.status(201).send({ data: rows[0] });
  });
}
