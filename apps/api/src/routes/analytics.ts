import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

/** Prompt 8 — Search, Dashboard, Reporting */
export async function analyticsRoutes(app: FastifyInstance) {
  // Global search
  app.get('/api/v1/search', async (req, reply) => {
    const q = (req.query as any).q || '';
    if (!q || q.length < 2) return reply.status(400).send({ error: 'q must be at least 2 characters' });
    const pattern = `%${q}%`;

    const [cases, apps, suites, envs] = await Promise.all([
      query(
        `SELECT id, key, name, 'test_case' AS resource_type, lifecycle, test_type
         FROM test_cases WHERE name ILIKE $1 OR key ILIKE $1 OR description ILIKE $1 LIMIT 20`,
        [pattern]
      ),
      query(
        `SELECT id, key, name, 'application' AS resource_type FROM applications
         WHERE name ILIKE $1 OR key ILIKE $1 LIMIT 10`,
        [pattern]
      ),
      query(
        `SELECT id, key, name, 'suite' AS resource_type FROM test_suites
         WHERE name ILIKE $1 OR key ILIKE $1 LIMIT 10`,
        [pattern]
      ),
      query(
        `SELECT id, key, name, 'environment' AS resource_type FROM environments
         WHERE name ILIKE $1 OR key ILIKE $1 LIMIT 10`,
        [pattern]
      ),
    ]);

    return reply.send({
      data: {
        test_cases: cases.rows,
        applications: apps.rows,
        suites: suites.rows,
        environments: envs.rows,
      },
    });
  });

  // Dashboard summary
  app.get('/api/v1/dashboard', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appFilter = q.application_id ? 'AND application_id = $1' : '';
    const params = q.application_id ? [q.application_id] : [];

    const [totals, byLifecycle, byType, recentExec, failed] = await Promise.all([
      query(`SELECT count(*)::int AS total FROM test_cases WHERE 1=1 ${appFilter}`, params),
      query(
        `SELECT lifecycle, count(*)::int AS count FROM test_cases WHERE 1=1 ${appFilter} GROUP BY lifecycle`,
        params
      ),
      query(
        `SELECT test_type, count(*)::int AS count FROM test_cases WHERE 1=1 ${appFilter} GROUP BY test_type`,
        params
      ),
      query(
        `SELECT status, count(*)::int AS count FROM executions
         WHERE created_at > now() - interval '7 days' GROUP BY status`
      ),
      query(
        `SELECT count(*)::int AS failed FROM execution_results
         WHERE status = 'failed' AND created_at > now() - interval '7 days'`
      ),
    ]);

    const automated = await query(
      `SELECT count(*)::int AS c FROM test_cases
       WHERE automation_status IN ('automated','partially_automated') ${appFilter}`,
      params
    );

    return reply.send({
      data: {
        total_tests: totals.rows[0]?.total ?? 0,
        automated: automated.rows[0]?.c ?? 0,
        by_lifecycle: byLifecycle.rows,
        by_type: byType.rows,
        executions_last_7d: recentExec.rows,
        failed_last_7d: failed.rows[0]?.failed ?? 0,
      },
    });
  });

  // Test Summary Report for an execution
  app.get<{ Params: { id: string } }>('/api/v1/reports/summary/:id', async (req, reply) => {
    const exec = await query(
      'SELECT * FROM executions WHERE id = $1 OR key = $1',
      [req.params.id]
    );
    if (!exec.rows[0]) return reply.status(404).send({ error: 'Execution not found' });

    const results = await query(
      `SELECT er.*, tc.key AS test_key, tc.name AS test_name, tc.severity
       FROM execution_results er
       JOIN test_cases tc ON tc.id = er.test_case_id
       WHERE er.execution_id = $1`,
      [exec.rows[0].id]
    );

    const rows = results.rows;
    const passed = rows.filter((r: any) => r.status === 'passed').length;
    const failed = rows.filter((r: any) => r.status === 'failed').length;
    const skipped = rows.filter((r: any) => r.status === 'skipped').length;
    const blocked = rows.filter((r: any) => r.status === 'blocked').length;
    const total = rows.length;
    const passRate = total ? Math.round((passed / total) * 1000) / 10 : 0;

    let verdict: string = 'INCONCLUSIVE';
    if (total > 0 && failed === 0 && blocked === 0) verdict = 'PASS';
    else if (failed > 0) verdict = 'FAIL';
    else if (blocked > 0) verdict = 'PASS WITH CONDITIONS';

    const criticalFailures = rows.filter(
      (r: any) => r.status === 'failed' && (r.severity === 'critical' || r.severity === 'high')
    );

    const report = {
      executive_summary: {
        verdict,
        pass_rate: passRate,
        total,
        passed,
        failed,
        skipped,
        blocked,
      },
      execution: exec.rows[0],
      scope: {
        test_case_ids: exec.rows[0].test_case_ids,
        test_suite_id: exec.rows[0].test_suite_id,
        test_plan_id: exec.rows[0].test_plan_id,
      },
      results: rows,
      critical_failures: criticalFailures,
      recommendations:
        failed > 0
          ? ['Investigate critical/high severity failures before release', 'Review evidence and classify root causes']
          : ['All executed tests passed — proceed with release readiness check'],
      overall_verdict: verdict,
      generated_at: new Date().toISOString(),
    };

    return reply.send({ data: report });
  });
}
