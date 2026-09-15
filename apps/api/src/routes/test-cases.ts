import type { FastifyInstance } from 'fastify';
import { query, withTransaction } from '../db/client.js';

export async function testCaseRoutes(app: FastifyInstance) {
  // List with filters
  app.get('/api/v1/test-cases', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const clauses: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (q.application_id) { clauses.push(`application_id = $${i++}`); params.push(q.application_id); }
    if (q.lifecycle) { clauses.push(`lifecycle = $${i++}`); params.push(q.lifecycle); }
    if (q.test_type) { clauses.push(`test_type = $${i++}`); params.push(q.test_type); }
    if (q.tag) { clauses.push(`$${i++} = ANY(tags)`); params.push(q.tag); }
    if (q.q) {
      clauses.push(`(name ILIKE $${i} OR key ILIKE $${i} OR description ILIKE $${i})`);
      params.push(`%${q.q}%`);
      i++;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Number(q.limit) || 50, 200);
    const offset = Number(q.offset) || 0;

    const { rows } = await query(
      `SELECT * FROM test_cases ${where} ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const countRes = await query(`SELECT count(*)::int AS total FROM test_cases ${where}`, params);
    return reply.send({ data: rows, total: countRes.rows[0]?.total ?? rows.length });
  });

  // Get one
  app.get<{ Params: { id: string } }>('/api/v1/test-cases/:id', async (req, reply) => {
    const { rows } = await query(
      'SELECT * FROM test_cases WHERE id = $1 OR key = $1',
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Test case not found' });

    const versions = await query(
      'SELECT id, version, change_summary, created_by, created_at FROM test_case_versions WHERE test_case_id = $1 ORDER BY version DESC',
      [rows[0].id]
    );
    return reply.send({ data: { ...rows[0], versions: versions.rows } });
  });

  // Create
  app.post<{ Body: Record<string, unknown> }>('/api/v1/test-cases', async (req, reply) => {
    const b = req.body || {};
    if (!b.key || !b.name || !b.application_id) {
      return reply.status(400).send({ error: 'key, name, application_id are required' });
    }

    const row = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO test_cases (
           key, name, description, application_id, component_id, feature_id, requirement_id,
           scenario_id, test_type, test_level, preconditions, dependencies, test_data_ref,
           environment_requirements, execution_location_default, execution_method, script,
           steps, expected_results, assertions, validation_rules, timeout_seconds, retry_policy,
           severity, priority, tags, owner_id, author_id, automation_status, lifecycle,
           created_by
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'other'),$10,$11,COALESCE($12,'[]'::jsonb),
           $13,COALESCE($14,'{}'::jsonb),$15,$16,$17,COALESCE($18,'[]'::jsonb),$19,
           COALESCE($20,'[]'::jsonb),COALESCE($21,'{}'::jsonb),COALESCE($22,300),
           COALESCE($23,'{"max":0}'::jsonb),COALESCE($24,'medium'),COALESCE($25,'p2'),
           COALESCE($26,'{}'),$27,$28,COALESCE($29,'manual'),COALESCE($30,'draft'),$31
         ) RETURNING *`,
        [
          b.key, b.name, b.description ?? null, b.application_id,
          b.component_id ?? null, b.feature_id ?? null, b.requirement_id ?? null,
          b.scenario_id ?? null, b.test_type ?? null, b.test_level ?? null,
          b.preconditions ?? null, JSON.stringify(b.dependencies ?? []),
          b.test_data_ref ?? null, JSON.stringify(b.environment_requirements ?? {}),
          b.execution_location_default ?? null, b.execution_method ?? null, b.script ?? null,
          JSON.stringify(b.steps ?? []), b.expected_results ?? null,
          JSON.stringify(b.assertions ?? []), JSON.stringify(b.validation_rules ?? {}),
          b.timeout_seconds ?? null, JSON.stringify(b.retry_policy ?? { max: 0 }),
          b.severity ?? null, b.priority ?? null, b.tags ?? [],
          b.owner_id ?? null, b.author_id ?? null, b.automation_status ?? null,
          b.lifecycle ?? null, b.created_by ?? null,
        ]
      );

      // Initial version snapshot
      await client.query(
        `INSERT INTO test_case_versions (test_case_id, version, snapshot, change_summary, created_by)
         VALUES ($1, 1, $2::jsonb, 'Initial version', $3)`,
        [rows[0].id, JSON.stringify(rows[0]), b.created_by ?? null]
      );

      // Link to suites if provided
      if (Array.isArray(b.suite_ids)) {
        for (let i = 0; i < b.suite_ids.length; i++) {
          await client.query(
            `INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [rows[0].id, b.suite_ids[i], i]
          );
        }
      }

      return rows[0];
    });

    return reply.status(201).send({ data: row });
  });

  // Update (creates new version)
  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/test-cases/:id',
    async (req, reply) => {
      const b = req.body || {};
      const existing = await query(
        'SELECT * FROM test_cases WHERE id = $1 OR key = $1',
        [req.params.id]
      );
      if (!existing.rows[0]) return reply.status(404).send({ error: 'Test case not found' });

      const tc = existing.rows[0];
      const newVersion = tc.version + 1;

      const row = await withTransaction(async (client) => {
        const { rows } = await client.query(
          `UPDATE test_cases SET
             name = COALESCE($2, name),
             description = COALESCE($3, description),
             test_type = COALESCE($4, test_type),
             preconditions = COALESCE($5, preconditions),
             script = COALESCE($6, script),
             steps = COALESCE($7, steps),
             assertions = COALESCE($8, assertions),
             expected_results = COALESCE($9, expected_results),
             severity = COALESCE($10, severity),
             priority = COALESCE($11, priority),
             tags = COALESCE($12, tags),
             lifecycle = COALESCE($13, lifecycle),
             automation_status = COALESCE($14, automation_status),
             timeout_seconds = COALESCE($15, timeout_seconds),
             version = $16,
             updated_at = now(),
             updated_by = $17
           WHERE id = $1
           RETURNING *`,
          [
            tc.id, b.name ?? null, b.description ?? null, b.test_type ?? null,
            b.preconditions ?? null, b.script ?? null,
            b.steps ? JSON.stringify(b.steps) : null,
            b.assertions ? JSON.stringify(b.assertions) : null,
            b.expected_results ?? null, b.severity ?? null, b.priority ?? null,
            b.tags ?? null, b.lifecycle ?? null, b.automation_status ?? null,
            b.timeout_seconds ?? null, newVersion, b.updated_by ?? null,
          ]
        );

        await client.query(
          `INSERT INTO test_case_versions (test_case_id, version, snapshot, change_summary, created_by)
           VALUES ($1,$2,$3::jsonb,$4,$5)`,
          [tc.id, newVersion, JSON.stringify(rows[0]), b.change_summary ?? `Version ${newVersion}`, b.updated_by ?? null]
        );

        return rows[0];
      });

      return reply.send({ data: row });
    }
  );

  // Clone
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/test-cases/:id/clone',
    async (req, reply) => {
      const { rows } = await query(
        'SELECT * FROM test_cases WHERE id = $1 OR key = $1',
        [req.params.id]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Test case not found' });

      const src = rows[0];
      const newKey = (req.body as any)?.key || `${src.key}-clone-${Date.now().toString(36)}`;
      const { rows: created } = await query(
        `INSERT INTO test_cases (
           key, name, description, application_id, component_id, feature_id, requirement_id,
           test_type, test_level, preconditions, dependencies, script, steps, assertions,
           expected_results, severity, priority, tags, automation_status, lifecycle, author_id, created_by
         )
         SELECT $2, $3, description, application_id, component_id, feature_id, requirement_id,
                test_type, test_level, preconditions, dependencies, script, steps, assertions,
                expected_results, severity, priority, tags, automation_status, 'draft', $4, $4
         FROM test_cases WHERE id = $1
         RETURNING *`,
        [src.id, newKey, `Clone of ${src.name}`, (req.body as any)?.created_by ?? null]
      );

      return reply.status(201).send({ data: created[0] });
    }
  );
}
