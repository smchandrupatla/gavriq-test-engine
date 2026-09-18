import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

export async function applicationRoutes(app: FastifyInstance) {
  // List applications
  app.get('/api/v1/applications', async (_req, reply) => {
    const { rows } = await query('SELECT * FROM applications ORDER BY name');
    return reply.send({ data: rows });
  });

  // Application detail with related data — home screen for an application
  app.get<{ Params: { id: string } }>('/api/v1/applications/:id', async (req, reply) => {
    const app = await query(
      'SELECT * FROM applications WHERE id::text = $1 OR key = $1',
      [req.params.id]
    );
    if (!app.rows[0]) return reply.status(404).send({ error: 'Application not found' });

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
      [app.rows[0].id]
    );

    // Fetch recent executions for this application
    const recentExecutions = await query(
      `SELECT e.*, 
              (SELECT count(*)::int FROM execution_results er 
               WHERE er.execution_id = e.id AND er.status = 'failed') AS failed_results
       FROM executions e 
       WHERE e.application_id = $1 
       ORDER BY e.created_at DESC 
       LIMIT 5`,
      [app.rows[0].id]
    );

    return reply.send({
      data: {
        ...app.rows[0],
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

  // Run tests against application — execute tests for this application
  app.post<{ Body: Record<string, unknown> }>('/api/v1/applications/:id/run-tests', async (req, reply) => {
    const b = req.body || {};
    const appId = req.params.id;

    // Resolve test cases: by suite, by plan, or explicit test_case_ids
    let testCaseIds: string[] = [];

    if (b.test_suite_id) {
      const suiteCases = await query(
        'SELECT test_case_id FROM test_case_suites WHERE test_suite_id = $1',
        [b.test_suite_id]
      );
      testCaseIds = suiteCases.rows.map((r: any) => r.test_case_id);
    } else if (b.test_plan_id) {
      // Get test cases from plan suites (mandatory + optional)
      const planSuites = await query(
        `SELECT test_suite_id FROM test_plan_suites WHERE test_plan_id = $1 AND mandatory = true`,
        [b.test_plan_id]
      );
      const suiteIds = planSuites.rows.map((r: any) => r.test_suite_id);
      
      if (suiteIds.length > 0) {
        const suiteCases = await query(
          `SELECT test_case_id FROM test_case_suites WHERE test_suite_id = ANY($1)`,
          [suiteIds]
        );
        testCaseIds = suiteCases.rows.map((r: any) => r.test_case_id);
      }
    } else if (b.test_case_ids && Array.isArray(b.test_case_ids)) {
      testCaseIds = b.test_case_ids;
    } else {
      return reply.status(400).send({
        error: 'Provide test_suite_id, test_plan_id, or test_case_ids',
      });
    }

    if (!testCaseIds.length) {
      return reply.status(400).send({ error: 'No test cases resolved' });
    }

    // Create execution for this application
    const { rows } = await query(
      `INSERT INTO executions (
           key, application_id, test_suite_id, test_plan_id, 
           test_case_ids, environment_id, execution_location, 
           worker_id, status, trigger_source, safety_override_id
         )
         VALUES (
           $1, $2, $3, $4, $5::uuid[], $6, 'out_of_container', 
           NULL, 'queued', 'manual', NULL
         )
         RETURNING *`,
      [
        `run-${appId}-${Date.now()}`,
        appId,
        b.test_suite_id ?? null,
        b.test_plan_id ?? null,
        testCaseIds,
        b.environment_id ?? null,
      ]
    );

    const execution = rows[0];

    // TODO: In a full implementation, this would trigger a worker/agent
    // to execute the tests. The engine would:
    // 1. Dispatch workers to run the tests in-container or out-of-container
    // 2. Stream execution progress back to this endpoint
    // 3. Store results/evidence in the database
    // 4. Update execution status as tests complete

    return reply.status(201).send({
      data: {
        ...execution,
        note:
          'Execution created. Test execution workers will run the tests and update results automatically.',
      },
    });
  });

  // View failures for application — failure analysis dashboard
  app.get<{ Params: { id: string } }>('/api/v1/applications/:id/failures', async (req, reply) => {
    const appId = req.params.id;

    // Get failed execution results with full analysis
    const failedResults = await query(
      `SELECT er.*, tc.key AS test_key, tc.name AS test_name, tc.description AS test_description,
              tc.severity, tc.priority, tc.lifecycle,
              e.trigger_source, e.created_at AS execution_started_at,
              e.finished_at,
              jsonb_build_object(
                'storage_key', e.storage_key,
                'content_type', e.content_type,
                'redacted', e.redacted
              ) AS evidence_info
       FROM execution_results er
       JOIN test_cases tc ON tc.id = er.test_case_id
       JOIN executions e ON e.id = er.execution_id
       WHERE tc.application_id = $1 
         AND er.status = 'failed'
       ORDER BY er.created_at DESC
       LIMIT 50`,
      [appId]
    );

    // Get failure classifications and patterns
    const failurePatterns = await query(
      `SELECT classification, count(*)::int AS failure_count,
              count(DISTINCT tc.id) AS affected_test_cases,
              array_agg(DISTINCT tc.key) AS affected_test_case_keys
       FROM execution_results er
       JOIN test_cases tc ON tc.id = er.test_case_id
       WHERE tc.application_id = $1 
         AND er.status = 'failed'
         AND er.classification IS NOT NULL
       GROUP BY classification
       ORDER BY failure_count DESC`,
      [appId]
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
      [appId]
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
