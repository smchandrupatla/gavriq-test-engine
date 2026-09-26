import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../db/client.js';
import { audit } from '../middleware/rbac.js';

export async function executionRoutes(app: FastifyInstance) {
  app.get('/api/v1/executions', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const clauses: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (q.status) { clauses.push(`status = $${i++}`); params.push(q.status); }
    if (q.environment_id) { clauses.push(`environment_id = $${i++}`); params.push(q.environment_id); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM executions ${where} ORDER BY created_at DESC LIMIT 50`,
      params
    );
    return reply.send({ data: rows });
  });

  app.get<{ Params: { id: string } }>('/api/v1/executions/:id', async (req, reply) => {
    const { rows } = await query(
      'SELECT * FROM executions WHERE id::text = $1 OR key = $1',
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Execution not found' });
    const results = await query(
      'SELECT * FROM execution_results WHERE execution_id = $1 ORDER BY created_at',
      [rows[0].id]
    );

    const enriched = [];
    for (const r of results.rows) {
      const ev = await query(
        `SELECT * FROM evidence WHERE execution_result_id = $1 ORDER BY created_at`,
        [r.id]
      );
      enriched.push({
        ...r,
        evidence: ev.rows.map((e: any) => ({
          ...e,
          url: e.storage_key
            ? `/api/v1/evidence/file?key=${encodeURIComponent(e.storage_key)}`
            : null,
        })),
      });
    }

    return reply.send({ data: { ...rows[0], results: enriched } });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/executions', async (req, reply) => {
    const b = req.body || {};
    const testCaseIds: string[] = Array.isArray(b.test_case_ids) ? b.test_case_ids : [];
    if (!testCaseIds.length && !b.test_suite_id && !b.test_plan_id) {
      return reply.status(400).send({ error: 'Provide test_case_ids, test_suite_id, or test_plan_id' });
    }

    let resolvedIds = [...testCaseIds];
    if (b.test_suite_id && !resolvedIds.length) {
      const suiteCases = await query(
        'SELECT test_case_id FROM test_case_suites WHERE test_suite_id = $1',
        [b.test_suite_id]
      );
      resolvedIds = suiteCases.rows.map((r: any) => r.test_case_id);
    }

    if (b.environment_id && b.safety_category) {
      const env = await query(
        'SELECT safety_policy FROM environments WHERE id::text = $1 OR key = $1',
        [b.environment_id]
      );
      if (env.rows[0]) {
        const decision = (env.rows[0].safety_policy || {})[b.safety_category as string] || 'prohibited';
        if (decision === 'prohibited') {
          return reply.status(403).send({
            error: 'Safety policy prohibits this test category on the selected environment',
            category: b.safety_category,
            decision,
          });
        }
      }
    }

    let environmentId = b.environment_id ?? null;
    if (typeof environmentId === 'string' && environmentId && !/^[0-9a-f-]{36}$/i.test(environmentId)) {
      const envRow = await query('SELECT id FROM environments WHERE key = $1', [environmentId]);
      environmentId = envRow.rows[0]?.id ?? null;
    }

    const key = `exec-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const { rows } = await query(
      `INSERT INTO executions (
         key, requested_by, test_plan_id, test_suite_id, test_case_ids,
         environment_id, execution_location, status, trigger_source, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::execution_location,'out_of_container'),'queued',COALESCE($8,'manual'),COALESCE($9,'{}'::jsonb))
       RETURNING *`,
      [
        key, b.requested_by ?? req.actor?.id ?? null, b.test_plan_id ?? null, b.test_suite_id ?? null,
        resolvedIds, environmentId, b.execution_location ?? null,
        b.trigger_source ?? null, JSON.stringify(b.metadata ?? {}),
      ]
    );

    await audit(req, 'execution.queue', 'execution', rows[0]!.id, {
      key,
      case_count: resolvedIds.length,
      environment_id: environmentId,
      trigger_source: b.trigger_source || 'manual',
    });

    return reply.status(202).send({ data: rows[0], message: 'Execution queued' });
  });

  app.post<{ Params: { id: string } }>('/api/v1/executions/:id/cancel', async (req, reply) => {
    const { rows } = await query(
      `UPDATE executions SET status = 'cancelled', finished_at = now()
       WHERE (id::text = $1 OR key = $1) AND status IN ('queued','preparing','running')
       RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Execution not found or not cancellable' });
    await audit(req, 'execution.cancel', 'execution', rows[0].id, {});
    return reply.send({ data: rows[0] });
  });

  app.post<{ Body: { worker_id: string; capabilities?: string[] } }>(
    '/api/v1/executions/claim',
    async (req, reply) => {
      const workerId = req.body?.worker_id;
      if (!workerId) return reply.status(400).send({ error: 'worker_id required' });

      const row = await withTransaction(async (client) => {
        const { rows } = await client.query(
          `SELECT * FROM executions
           WHERE status = 'queued'
           ORDER BY created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 1`
        );
        if (!rows[0]) return null;
        const { rows: updated } = await client.query(
          `UPDATE executions SET status = 'running', worker_id = $2, started_at = now()
           WHERE id = $1 RETURNING *`,
          [rows[0].id, workerId]
        );
        await client.query(
          `UPDATE workers SET last_heartbeat = now(), status = 'busy', current_load = current_load + 1
           WHERE id = $1`,
          [workerId]
        );
        return updated[0];
      });

      if (!row) return reply.status(204).send();
      return reply.send({ data: row });
    }
  );

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/executions/:id/results',
    async (req, reply) => {
      const b = req.body || {};
      const exec = await query(
        'SELECT id FROM executions WHERE id::text = $1 OR key = $1',
        [req.params.id]
      );
      if (!exec.rows[0]) return reply.status(404).send({ error: 'Execution not found' });

      const { rows } = await query(
        `INSERT INTO execution_results (
           execution_id, test_case_id, status, verdict, duration_ms,
           started_at, finished_at, message, classification, metrics
         ) VALUES ($1,$2,$3::execution_status,$4,$5,$6,$7,$8,$9::failure_classification,COALESCE($10,'{}'::jsonb))
         RETURNING *`,
        [
          exec.rows[0].id, b.test_case_id, b.status, b.verdict ?? null,
          b.duration_ms ?? null, b.started_at ?? null, b.finished_at ?? new Date().toISOString(),
          b.message ?? null, b.classification ?? null, JSON.stringify(b.metrics ?? {}),
        ]
      );

      if (Array.isArray(b.evidence)) {
        for (const ev of b.evidence) {
          await query(
            `INSERT INTO evidence (execution_result_id, evidence_type, storage_key, content_type, size_bytes, redacted, metadata)
             VALUES ($1,$2,$3,$4,$5,COALESCE($6,false),COALESCE($7,'{}'::jsonb))`,
            [
              rows[0]!.id, ev.type, ev.storage_key, ev.content_type ?? null,
              ev.size_bytes ?? null, ev.redacted ?? false, JSON.stringify(ev.metadata ?? {}),
            ]
          );
        }
      }

      return reply.status(201).send({ data: rows[0] });
    }
  );

  app.post<{ Params: { id: string }; Body: { status?: string } }>(
    '/api/v1/executions/:id/complete',
    async (req, reply) => {
      const status = req.body?.status || 'passed';
      const { rows } = await query(
        `UPDATE executions SET status = $2::execution_status, finished_at = now()
         WHERE id::text = $1 OR key = $1 RETURNING *`,
        [req.params.id, status]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Execution not found' });
      if (rows[0].worker_id) {
        await query(
          `UPDATE workers SET current_load = GREATEST(current_load - 1, 0),
             status = CASE WHEN current_load <= 1 THEN 'online' ELSE status END
           WHERE id = $1`,
          [rows[0].worker_id]
        );
      }
      return reply.send({ data: rows[0] });
    }
  );
}
