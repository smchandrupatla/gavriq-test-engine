import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve an application by UUID or key. `id` is compared as text so a key never hits a uuid cast. */
async function findApplication(idOrKey: string) {
  const { rows } = await query('SELECT * FROM applications WHERE id::text = $1 OR key = $1', [idOrKey]);
  return rows[0];
}

export async function applicationRoutes(app: FastifyInstance) {
  // List applications
  app.get('/api/v1/applications', async (_req, reply) => {
    const { rows } = await query('SELECT * FROM applications ORDER BY name');
    return reply.send({ data: rows });
  });

  // Application detail with related data — home screen for an application
  app.get<{ Params: { id: string } }>('/api/v1/applications/:id', async (req, reply) => {
    const application = await findApplication(req.params.id);
    if (!application) return reply.status(404).send({ error: 'Application not found' });

    // Fetch related test cases for this application
    const testCases = await query(
      `SELECT tc.*,
              (SELECT count(*)::int FROM execution_results er
               WHERE er.test_case_id = tc.id AND er.status = 'failed') AS failed_execution_count,
              (SELECT count(*)::int FROM execution_results er
               WHERE er.test_case_id = tc.id AND er.status = 'passed') AS passed_execution_count
       FROM test_cases tc
       WHERE tc.application_id = $1
       ORDER BY tc.lifecycle DESC, tc.updated_at DESC`,
      [application.id]
    );

    // Executions have no application column: an execution belongs to the application
    // when any of its test cases does.
    const recentExecutions = await query(
      `SELECT e.*,
              (SELECT count(*)::int FROM execution_results er
               WHERE er.execution_id = e.id AND er.status = 'failed') AS failed_results
       FROM executions e
       WHERE EXISTS (SELECT 1 FROM test_cases tc
                     WHERE tc.id = ANY(e.test_case_ids) AND tc.application_id = $1)
       ORDER BY e.created_at DESC
       LIMIT 5`,
      [application.id]
    );

    return reply.send({
      data: {
        ...application,
        test_cases: testCases.rows,
        recent_executions: recentExecutions.rows,
      },
    });
  });

  // Create application
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

  // Update application
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
         WHERE id::text = $1 OR key = $1
         RETURNING *`,
        [req.params.id, b.name ?? null, b.description ?? null, b.owner_id ?? null,
         b.status ?? null, b.metadata ? JSON.stringify(b.metadata) : null, b.updated_by ?? null]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Application not found' });
      return reply.send({ data: rows[0] });
    }
  );

  // Run tests against application — queue an execution for this application's cases
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/applications/:id/run-tests',
    async (req, reply) => {
      const b = req.body || {};
      const application = await findApplication(req.params.id);
      if (!application) return reply.status(404).send({ error: 'Application not found' });

      for (const field of ['test_suite_id', 'test_plan_id', 'environment_id'] as const) {
        if (b[field] != null && !UUID_RE.test(String(b[field]))) {
          return reply.status(400).send({ error: `${field} must be a UUID` });
        }
      }

      // Resolve test cases: by suite, by plan, or explicit test_case_ids
      let testCaseIds: string[] = [];

      if (b.test_suite_id) {
        const suiteCases = await query<{ test_case_id: string }>(
          'SELECT test_case_id FROM test_case_suites WHERE test_suite_id = $1',
          [b.test_suite_id]
        );
        testCaseIds = suiteCases.rows.map((r) => r.test_case_id);
      } else if (b.test_plan_id) {
        // Mandatory suites of the plan
        const suiteCases = await query<{ test_case_id: string }>(
          `SELECT tcs.test_case_id
           FROM test_plan_suites tps
           JOIN test_case_suites tcs ON tcs.test_suite_id = tps.test_suite_id
           WHERE tps.test_plan_id = $1 AND tps.mandatory = true`,
          [b.test_plan_id]
        );
        testCaseIds = suiteCases.rows.map((r) => r.test_case_id);
      } else if (Array.isArray(b.test_case_ids)) {
        testCaseIds = b.test_case_ids.map(String);
        const bad = testCaseIds.find((id) => !UUID_RE.test(id));
        if (bad) return reply.status(400).send({ error: `test_case_ids must be UUIDs (got ${JSON.stringify(bad)})` });
      } else {
        return reply.status(400).send({
          error: 'Provide test_suite_id, test_plan_id, or test_case_ids',
        });
      }

      // Only run cases that belong to this application.
      const owned = await query<{ id: string }>(
        'SELECT id FROM test_cases WHERE application_id = $1 AND id = ANY($2::uuid[])',
        [application.id, [...new Set(testCaseIds)]]
      );
      testCaseIds = owned.rows.map((r) => r.id);

      if (!testCaseIds.length) {
        return reply.status(400).send({ error: 'No test cases resolved for this application' });
      }

      const { rows } = await query(
        `INSERT INTO executions (
             key, test_suite_id, test_plan_id, test_case_ids, environment_id,
             execution_location, status, trigger_source, metadata
           )
           VALUES ($1, $2, $3, $4::uuid[], $5, 'out_of_container', 'queued', 'manual', $6::jsonb)
           RETURNING *`,
        [
          `run-${application.key}-${Date.now()}`,
          b.test_suite_id ?? null,
          b.test_plan_id ?? null,
          testCaseIds,
          b.environment_id ?? null,
          JSON.stringify({ application_id: application.id, application_key: application.key }),
        ]
      );

      return reply.status(201).send({
        data: {
          ...rows[0],
          note:
            'Execution created. Test execution workers will run the tests and update results automatically.',
        },
      });
    }
  );

  // View failures for application — failure analysis dashboard
  app.get<{ Params: { id: string } }>('/api/v1/applications/:id/failures', async (req, reply) => {
    const application = await findApplication(req.params.id);
    if (!application) return reply.status(404).send({ error: 'Application not found' });

    // Failed results with the newest piece of evidence for each
    const failedResults = await query(
      `SELECT er.*, tc.key AS test_key, tc.name AS test_name, tc.description AS test_description,
              tc.severity, tc.priority, tc.lifecycle,
              e.trigger_source, e.created_at AS execution_started_at,
              e.finished_at AS execution_finished_at,
              CASE WHEN ev.id IS NULL THEN NULL ELSE jsonb_build_object(
                'storage_key', ev.storage_key,
                'content_type', ev.content_type,
                'redacted', ev.redacted
              ) END AS evidence_info
       FROM execution_results er
       JOIN test_cases tc ON tc.id = er.test_case_id
       JOIN executions e ON e.id = er.execution_id
       LEFT JOIN LATERAL (
         SELECT id, storage_key, content_type, redacted FROM evidence
         WHERE execution_result_id = er.id ORDER BY created_at DESC LIMIT 1
       ) ev ON true
       WHERE tc.application_id = $1
         AND er.status = 'failed'
       ORDER BY er.created_at DESC
       LIMIT 50`,
      [application.id]
    );

    // Get failure classifications and patterns
    const failurePatterns = await query(
      `SELECT classification, count(*)::int AS failure_count,
              count(DISTINCT tc.id)::int AS affected_test_cases,
              array_agg(DISTINCT tc.key) AS affected_test_case_keys
       FROM execution_results er
       JOIN test_cases tc ON tc.id = er.test_case_id
       WHERE tc.application_id = $1
         AND er.status = 'failed'
         AND er.classification IS NOT NULL
       GROUP BY classification
       ORDER BY failure_count DESC`,
      [application.id]
    );

    // Get defect links for failed tests
    const defectLinks = await query(
      `SELECT dl.*, tc.key AS test_key
       FROM defect_links dl
       JOIN execution_results er ON er.id = dl.execution_result_id
       JOIN test_cases tc ON tc.id = er.test_case_id
       WHERE tc.application_id = $1
         AND er.status = 'failed'
       ORDER BY dl.linked_at DESC`,
      [application.id]
    );

    return reply.send({
      data: {
        failed_executions: failedResults.rows,
        failure_patterns: failurePatterns.rows,
        defect_links: defectLinks.rows,
        total_failed: failedResults.rows.length,
      },
    });
  });
}
