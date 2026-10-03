import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../db/client.js';
import { audit } from '../middleware/rbac.js';

/** Suites people build in the console. Seeded and SIT-imported suites stay read-only. */
export const CUSTOM_SUITE_TYPE = 'custom';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function slugKey(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'suite';
  return `custom-${slug}-${randomUUID().slice(0, 6)}`;
}

/** Validate and de-duplicate a case id list, keeping first-seen order. */
export function cleanCaseIds(raw: unknown): { ids: string[]; invalid: unknown[] } {
  const list = Array.isArray(raw) ? raw : [];
  const invalid = list.filter((v) => typeof v !== 'string' || !UUID_RE.test(v));
  const ids = [...new Set(list.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v)))];
  return { ids, invalid };
}

/** Executions with pass / fail / blocked counts from their results. */
export const EXECUTION_SUMMARY_SQL = `
  SELECT e.id, e.key, e.status, e.trigger_source, e.requested_by, e.test_suite_id, s.name AS suite_name,
         e.environment_id, e.created_at, e.started_at, e.finished_at,
         cardinality(e.test_case_ids)::int AS total_cases,
         count(er.id)::int AS reported,
         count(er.id) FILTER (WHERE er.status = 'passed')::int AS passed,
         count(er.id) FILTER (WHERE er.status IN ('failed','error','timed_out'))::int AS failed,
         count(er.id) FILTER (WHERE er.status IN ('blocked','skipped','cancelled'))::int AS blocked,
         COALESCE(sum(er.duration_ms), 0)::bigint AS duration_ms
  FROM executions e
  LEFT JOIN test_suites s ON s.id = e.test_suite_id
  LEFT JOIN execution_results er ON er.execution_id = e.id`;

async function findSuite(idOrKey: string) {
  const { rows } = await query('SELECT * FROM test_suites WHERE id::text = $1 OR key = $1', [idOrKey]);
  return rows[0] || null;
}

async function existingCaseIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { rows } = await query<{ id: string }>('SELECT id::text AS id FROM test_cases WHERE id = ANY($1::uuid[])', [ids]);
  return new Set(rows.map((r) => r.id));
}

export async function suitePlanRoutes(app: FastifyInstance) {
  // Suites
  app.get('/api/v1/suites', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const params: unknown[] = [];
    let where = '';
    if (q.application_id) {
      where = 'WHERE s.application_id = $1';
      params.push(q.application_id);
    }
    const { rows } = await query(
      `SELECT s.*, (SELECT count(*)::int FROM test_case_suites m WHERE m.test_suite_id = s.id) AS case_count,
              (s.suite_type = '${CUSTOM_SUITE_TYPE}') AS editable
       FROM test_suites s ${where} ORDER BY s.name`,
      params
    );
    return reply.send({ data: rows });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/suites', async (req, reply) => {
    const b = req.body || {};
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!name || name.length > 200) {
      return reply.status(400).send({ error: 'name is required (1-200 characters)' });
    }
    const { ids, invalid } = cleanCaseIds(b.test_case_ids);
    if (invalid.length) return reply.status(400).send({ error: 'test_case_ids must be test case UUIDs', invalid });

    let applicationId = typeof b.application_id === 'string' ? b.application_id : null;
    if (!applicationId) {
      const appRow = await query(`SELECT id FROM applications ORDER BY (key = 'sand-bench') DESC, created_at LIMIT 1`);
      applicationId = appRow.rows[0]?.id ?? null;
    }
    if (!applicationId) return reply.status(400).send({ error: 'application_id required (no application exists yet)' });

    const found = await existingCaseIds(ids);
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length) return reply.status(400).send({ error: 'Unknown test case ids', missing });

    const key = typeof b.key === 'string' && b.key.trim() ? b.key.trim() : slugKey(name);
    const suiteType = typeof b.suite_type === 'string' && b.suite_type ? b.suite_type : CUSTOM_SUITE_TYPE;
    try {
      const suite = await withTransaction(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [key, name, typeof b.description === 'string' ? b.description : null, applicationId, suiteType,
           (b.created_by as string) ?? req.actor?.id ?? null]
        );
        for (let i = 0; i < ids.length; i++) {
          await client.query(
            'INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
            [ids[i], rows[0].id, i]
          );
        }
        return rows[0];
      });
      await audit(req, 'suite.create', 'test_suite', suite.id, { key, case_count: ids.length });
      return reply.status(201).send({ data: { ...suite, case_count: ids.length, editable: suiteType === CUSTOM_SUITE_TYPE } });
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return reply.status(409).send({ error: `A suite with key "${key}" already exists` });
      }
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>('/api/v1/suites/:id', async (req, reply) => {
    const suite = await findSuite(req.params.id);
    if (!suite) return reply.status(404).send({ error: 'Suite not found' });
    const cases = await query(
      `SELECT c.id, c.key, c.name, c.test_type, c.execution_method, c.script, c.tags, m.sort_order,
              lr.status AS last_status, lr.finished_at AS last_finished_at, lr.duration_ms AS last_duration_ms
       FROM test_case_suites m
       JOIN test_cases c ON c.id = m.test_case_id
       LEFT JOIN LATERAL (
         SELECT er.status, er.finished_at, er.duration_ms FROM execution_results er
         WHERE er.test_case_id = c.id ORDER BY er.created_at DESC LIMIT 1
       ) lr ON true
       WHERE m.test_suite_id = $1
       ORDER BY m.sort_order, c.key`,
      [suite.id]
    );
    const runs = await query(
      `${EXECUTION_SUMMARY_SQL} WHERE e.test_suite_id = $1 GROUP BY e.id, s.name ORDER BY e.created_at DESC LIMIT 25`,
      [suite.id]
    );
    return reply.send({
      data: { ...suite, editable: suite.suite_type === CUSTOM_SUITE_TYPE, cases: cases.rows, executions: runs.rows },
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/suites/:id/executions', async (req, reply) => {
    const suite = await findSuite(req.params.id);
    if (!suite) return reply.status(404).send({ error: 'Suite not found' });
    const { rows } = await query(
      `${EXECUTION_SUMMARY_SQL} WHERE e.test_suite_id = $1 GROUP BY e.id, s.name ORDER BY e.created_at DESC LIMIT 50`,
      [suite.id]
    );
    return reply.send({ data: rows });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/v1/suites/:id', async (req, reply) => {
    const suite = await findSuite(req.params.id);
    if (!suite) return reply.status(404).send({ error: 'Suite not found' });
    if (suite.suite_type !== CUSTOM_SUITE_TYPE) {
      return reply.status(409).send({ error: 'Seeded and imported suites are read-only. Copy it into a new suite to change it.' });
    }
    const b = req.body || {};
    const name = typeof b.name === 'string' ? b.name.trim() : undefined;
    if (name !== undefined && (!name || name.length > 200)) {
      return reply.status(400).send({ error: 'name must be 1-200 characters' });
    }
    const { rows } = await query(
      `UPDATE test_suites SET name = COALESCE($2, name), description = COALESCE($3, description),
         updated_at = now(), updated_by = $4
       WHERE id = $1 RETURNING *`,
      [suite.id, name ?? null, typeof b.description === 'string' ? b.description : null, req.actor?.id ?? null]
    );
    await audit(req, 'suite.update', 'test_suite', suite.id, { name: name ?? null });
    return reply.send({ data: rows[0] });
  });

  app.delete<{ Params: { id: string } }>('/api/v1/suites/:id', async (req, reply) => {
    const suite = await findSuite(req.params.id);
    if (!suite) return reply.status(404).send({ error: 'Suite not found' });
    if (suite.suite_type !== CUSTOM_SUITE_TYPE) {
      return reply.status(409).send({ error: 'Seeded and imported suites cannot be deleted here.' });
    }
    // Past executions keep their results; test_suite_id is set to NULL by the FK.
    await query('DELETE FROM test_suites WHERE id = $1', [suite.id]);
    await audit(req, 'suite.delete', 'test_suite', suite.id, { key: suite.key });
    return reply.send({ data: { deleted: suite.id } });
  });

  // Bulk suite membership (test_case_id -> test_suite_id), for building a
  // consolidated categorized catalog view without an N+1 fetch per suite.
  app.get('/api/v1/test-case-suites', async (_req, reply) => {
    const { rows } = await query('SELECT test_case_id, test_suite_id FROM test_case_suites');
    return reply.send({ data: rows });
  });

  app.post<{ Params: { id: string }; Body: { test_case_ids: string[] } }>(
    '/api/v1/suites/:id/cases',
    async (req, reply) => {
      const suite = await findSuite(req.params.id);
      if (!suite) return reply.status(404).send({ error: 'Suite not found' });
      const { ids, invalid } = cleanCaseIds(req.body?.test_case_ids);
      if (invalid.length) return reply.status(400).send({ error: 'test_case_ids must be test case UUIDs', invalid });
      const found = await existingCaseIds(ids);
      const missing = ids.filter((id) => !found.has(id));
      if (missing.length) return reply.status(400).send({ error: 'Unknown test case ids', missing });
      const max = await query('SELECT COALESCE(max(sort_order), -1)::int AS m FROM test_case_suites WHERE test_suite_id = $1', [suite.id]);
      let order = (max.rows[0]?.m ?? -1) + 1;
      let added = 0;
      for (const id of ids) {
        const r = await query(
          `INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [id, suite.id, order++]
        );
        added += r.rowCount || 0;
      }
      return reply.send({ data: { added } });
    }
  );

  // Replace a custom suite's membership with an ordered list.
  app.put<{ Params: { id: string }; Body: { test_case_ids?: unknown } }>(
    '/api/v1/suites/:id/cases',
    async (req, reply) => {
      const suite = await findSuite(req.params.id);
      if (!suite) return reply.status(404).send({ error: 'Suite not found' });
      if (suite.suite_type !== CUSTOM_SUITE_TYPE) {
        return reply.status(409).send({ error: 'Seeded and imported suites are read-only. Copy it into a new suite to change it.' });
      }
      if (!Array.isArray(req.body?.test_case_ids)) return reply.status(400).send({ error: 'test_case_ids array required' });
      const { ids, invalid } = cleanCaseIds(req.body.test_case_ids);
      if (invalid.length) return reply.status(400).send({ error: 'test_case_ids must be test case UUIDs', invalid });
      const found = await existingCaseIds(ids);
      const missing = ids.filter((id) => !found.has(id));
      if (missing.length) return reply.status(400).send({ error: 'Unknown test case ids', missing });
      await withTransaction(async (client) => {
        await client.query('DELETE FROM test_case_suites WHERE test_suite_id = $1', [suite.id]);
        for (let i = 0; i < ids.length; i++) {
          await client.query(
            'INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order) VALUES ($1,$2,$3)',
            [ids[i], suite.id, i]
          );
        }
        await client.query('UPDATE test_suites SET updated_at = now(), updated_by = $2 WHERE id = $1', [suite.id, req.actor?.id ?? null]);
      });
      await audit(req, 'suite.set_cases', 'test_suite', suite.id, { case_count: ids.length });
      return reply.send({ data: { suite_id: suite.id, case_count: ids.length } });
    }
  );

  app.delete<{ Params: { id: string; caseId: string } }>(
    '/api/v1/suites/:id/cases/:caseId',
    async (req, reply) => {
      const suite = await findSuite(req.params.id);
      if (!suite) return reply.status(404).send({ error: 'Suite not found' });
      if (suite.suite_type !== CUSTOM_SUITE_TYPE) {
        return reply.status(409).send({ error: 'Seeded and imported suites are read-only.' });
      }
      if (!UUID_RE.test(req.params.caseId)) return reply.status(400).send({ error: 'caseId must be a UUID' });
      const r = await query('DELETE FROM test_case_suites WHERE test_suite_id = $1 AND test_case_id = $2', [suite.id, req.params.caseId]);
      if (!r.rowCount) return reply.status(404).send({ error: 'Case is not in this suite' });
      await audit(req, 'suite.remove_case', 'test_suite', suite.id, { test_case_id: req.params.caseId });
      return reply.send({ data: { removed: req.params.caseId } });
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
