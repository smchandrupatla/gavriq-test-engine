import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

/**
 * In-container / build-time test status (original product requirement).
 *
 * In-container tests run as part of the application build and are NOT re-executed
 * by the Test Engine. The engine only stores and surfaces their last-known status.
 *
 * CI/build systems POST results here; the UI and agents query them.
 */
export async function buildStatusRoutes(app: FastifyInstance) {
  // Ensure table exists (lightweight, idempotent)
  await query(`
    CREATE TABLE IF NOT EXISTS build_test_results (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      application_key TEXT NOT NULL,
      build_id        TEXT NOT NULL,
      commit_sha      TEXT,
      branch          TEXT,
      test_key        TEXT NOT NULL,
      test_name       TEXT,
      suite           TEXT,
      location        TEXT NOT NULL DEFAULT 'in_container',
      status          TEXT NOT NULL,  -- passed|failed|skipped|error
      duration_ms     INT,
      message         TEXT,
      evidence_url    TEXT,
      metadata        JSONB NOT NULL DEFAULT '{}',
      reported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (application_key, build_id, test_key)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_build_test_app_build ON build_test_results(application_key, build_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_build_test_reported ON build_test_results(reported_at DESC)`);

  /** CI reports a batch of in-container results for a build */
  app.post<{ Body: Record<string, unknown> }>('/api/v1/build-results', async (req, reply) => {
    const b = req.body || {};
    const applicationKey = b.application_key as string;
    const buildId = b.build_id as string;
    if (!applicationKey || !buildId) {
      return reply.status(400).send({ error: 'application_key and build_id required' });
    }
    const results = Array.isArray(b.results) ? b.results : [];
    if (!results.length) {
      return reply.status(400).send({ error: 'results array required' });
    }

    let upserted = 0;
    for (const r of results) {
      await query(
        `INSERT INTO build_test_results (
           application_key, build_id, commit_sha, branch, test_key, test_name, suite,
           location, status, duration_ms, message, evidence_url, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'in_container'),$9,$10,$11,$12,COALESCE($13,'{}'::jsonb))
         ON CONFLICT (application_key, build_id, test_key) DO UPDATE SET
           status = EXCLUDED.status,
           duration_ms = EXCLUDED.duration_ms,
           message = EXCLUDED.message,
           evidence_url = EXCLUDED.evidence_url,
           metadata = EXCLUDED.metadata,
           reported_at = now()`,
        [
          applicationKey,
          buildId,
          b.commit_sha ?? null,
          b.branch ?? null,
          r.test_key || r.id || r.name,
          r.test_name || r.name || null,
          r.suite ?? null,
          r.location ?? 'in_container',
          r.status || 'passed',
          r.duration_ms ?? null,
          r.message ?? null,
          r.evidence_url ?? null,
          JSON.stringify(r.metadata ?? {}),
        ]
      );
      upserted++;
    }

    return reply.status(201).send({
      data: { application_key: applicationKey, build_id: buildId, upserted },
    });
  });

  /** Latest build results for an application */
  app.get('/api/v1/build-results', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';

    if (q.build_id) {
      const { rows } = await query(
        `SELECT * FROM build_test_results
         WHERE application_key = $1 AND build_id = $2
         ORDER BY test_key`,
        [appKey, q.build_id]
      );
      return reply.send({ data: rows, application_key: appKey, build_id: q.build_id });
    }

    // Resolve latest build_id
    const latest = await query(
      `SELECT build_id, max(reported_at) AS at
       FROM build_test_results
       WHERE application_key = $1
       GROUP BY build_id
       ORDER BY at DESC
       LIMIT 1`,
      [appKey]
    );
    if (!latest.rows[0]) {
      return reply.send({ data: [], application_key: appKey, build_id: null, message: 'No build results yet' });
    }

    const buildId = latest.rows[0].build_id;
    const { rows } = await query(
      `SELECT * FROM build_test_results
       WHERE application_key = $1 AND build_id = $2
       ORDER BY test_key`,
      [appKey, buildId]
    );

    const passed = rows.filter((r: any) => r.status === 'passed').length;
    const failed = rows.filter((r: any) => r.status === 'failed' || r.status === 'error').length;
    const skipped = rows.filter((r: any) => r.status === 'skipped').length;

    return reply.send({
      data: rows,
      application_key: appKey,
      build_id: buildId,
      summary: { total: rows.length, passed, failed, skipped },
    });
  });

  /** Status of a specific in-container test key across recent builds */
  app.get<{ Params: { testKey: string } }>(
    '/api/v1/build-results/test/:testKey',
    async (req, reply) => {
      const q = req.query as Record<string, string>;
      const appKey = q.application_key || 'sand-bench';
      const { rows } = await query(
        `SELECT * FROM build_test_results
         WHERE application_key = $1 AND test_key = $2
         ORDER BY reported_at DESC
         LIMIT 20`,
        [appKey, req.params.testKey]
      );
      return reply.send({
        data: rows,
        latest: rows[0] || null,
        application_key: appKey,
        test_key: req.params.testKey,
      });
    }
  );

  /** Combined view: engine-executed + in-container for an application */
  app.get('/api/v1/test-status', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';

    // Engine-side cases
    const cases = await query(
      `SELECT tc.id, tc.key, tc.name, tc.test_type, tc.execution_method, tc.lifecycle,
              tc.execution_location_default, tc.automation_status
       FROM test_cases tc
       JOIN applications a ON a.id = tc.application_id
       WHERE a.key = $1
       ORDER BY tc.key`,
      [appKey]
    );

    // Latest engine execution result per case
    const latestEngine = await query(
      `SELECT DISTINCT ON (er.test_case_id)
         er.test_case_id, er.status, er.verdict, er.duration_ms, er.message, er.created_at
       FROM execution_results er
       JOIN test_cases tc ON tc.id = er.test_case_id
       JOIN applications a ON a.id = tc.application_id
       WHERE a.key = $1
       ORDER BY er.test_case_id, er.created_at DESC`,
      [appKey]
    );
    const engineByCase = new Map(latestEngine.rows.map((r: any) => [r.test_case_id, r]));

    // Latest in-container build results
    const buildLatest = await query(
      `SELECT DISTINCT ON (test_key)
         test_key, test_name, status, duration_ms, message, build_id, reported_at, location
       FROM build_test_results
       WHERE application_key = $1
       ORDER BY test_key, reported_at DESC`,
      [appKey]
    );

    const engine = cases.rows.map((tc: any) => ({
      ...tc,
      source: 'test_engine',
      last_result: engineByCase.get(tc.id) || null,
    }));

    const inContainer = buildLatest.rows.map((r: any) => ({
      key: r.test_key,
      name: r.test_name,
      source: 'in_container',
      location: r.location,
      last_result: {
        status: r.status,
        duration_ms: r.duration_ms,
        message: r.message,
        build_id: r.build_id,
        reported_at: r.reported_at,
      },
    }));

    return reply.send({
      data: {
        application_key: appKey,
        engine_executed: engine,
        in_container: inContainer,
      },
    });
  });
}
