import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

/**
 * Lean read models for the unified console (apps/api/public/catalog).
 *
 * The console used to boot from ~12 calls returning full rows (scripts, steps,
 * evidence). These endpoints return only what the tiles, nav and tables draw;
 * details (case body, run evidence, history) are fetched lazily on demand.
 *
 *   GET  /api/v1/ui/summary          one call: cases (compact + last status), suites, envs, build summary
 *   GET  /api/v1/ui/live?since=      poll: executions with progress, workers, case statuses changed since
 *   GET  /api/v1/ui/executions/:id   run screen: per-case results without evidence bodies
 *   POST /api/v1/ui/history          tile graph: per-run pass/fail for a set of cases
 *   GET  /api/v1/ui/build-history    tile graph: per-build pass/fail for in-container results
 */

const ACTIVE = `('queued','preparing','running')`;
const FAILED = `('failed','error','timed_out')`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clampInt(v: unknown, def: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : def;
}

function parseSince(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function uiRoutes(app: FastifyInstance) {
  app.get('/api/v1/ui/summary', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';

    const [cases, suites, envs, application, build, stats] = await Promise.all([
      query(
        `SELECT tc.id, tc.key, tc.name, tc.tags, tc.test_type, tc.execution_method,
                COALESCE(m.suite_ids, '{}') AS suite_ids,
                lr.status AS last_status,
                COALESCE(lr.finished_at, lr.created_at) AS last_at,
                lr.duration_ms AS last_duration_ms
         FROM test_cases tc
         LEFT JOIN LATERAL (
           SELECT array_agg(s.test_suite_id ORDER BY s.sort_order) AS suite_ids
           FROM test_case_suites s WHERE s.test_case_id = tc.id
         ) m ON true
         LEFT JOIN LATERAL (
           SELECT er.status, er.finished_at, er.created_at, er.duration_ms
           FROM execution_results er WHERE er.test_case_id = tc.id
           ORDER BY er.created_at DESC LIMIT 1
         ) lr ON true
         ORDER BY tc.key`
      ),
      query(`SELECT id, key, name, suite_type FROM test_suites ORDER BY name`),
      query(`SELECT id, key, name FROM environments ORDER BY name`),
      query(
        `SELECT id, key, name, metadata->'sandbench_types' AS types
         FROM applications ORDER BY (key = $1) DESC, name LIMIT 1`,
        [appKey]
      ),
      query(
        `WITH latest AS (
           SELECT build_id FROM build_test_results WHERE application_key = $1
           GROUP BY build_id ORDER BY max(reported_at) DESC LIMIT 1
         )
         SELECT b.build_id, max(b.reported_at) AS reported_at, max(b.commit_sha) AS commit_sha,
                max(b.branch) AS branch, count(*)::int AS total,
                count(*) FILTER (WHERE b.status = 'passed')::int AS passed,
                count(*) FILTER (WHERE b.status IN ('failed','error'))::int AS failed,
                count(*) FILTER (WHERE lower(COALESCE(b.suite,'')) = 'unit' OR b.test_key LIKE 'unit%')::int AS unit_total,
                count(*) FILTER (WHERE (lower(COALESCE(b.suite,'')) = 'unit' OR b.test_key LIKE 'unit%') AND b.status = 'passed')::int AS unit_passed
         FROM build_test_results b JOIN latest l ON l.build_id = b.build_id
         WHERE b.application_key = $1
         GROUP BY b.build_id`,
        [appKey]
      ),
      query(
        `SELECT now() AS now,
                (SELECT count(*)::int FROM execution_results
                 WHERE status IN ${FAILED} AND created_at > now() - interval '7 days') AS failed_7d,
                (SELECT count(*)::int FROM executions
                 WHERE created_at > now() - interval '7 days') AS runs_7d`
      ),
    ]);

    return reply.send({
      data: {
        now: stats.rows[0]?.now,
        application: application.rows[0] || null,
        cases: cases.rows,
        suites: suites.rows,
        environments: envs.rows,
        build: build.rows[0] || null,
        stats: { failed_7d: stats.rows[0]?.failed_7d ?? 0, runs_7d: stats.rows[0]?.runs_7d ?? 0 },
      },
    });
  });

  app.get('/api/v1/ui/live', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const limit = clampInt(q.limit, 50, 200);
    const since = parseSince(q.since);

    const [executions, workers, changed, sig] = await Promise.all([
      query(
        `SELECT e.id, e.key, e.status, e.trigger_source, e.test_suite_id, e.worker_id,
                e.created_at, e.started_at, e.finished_at,
                cardinality(e.test_case_ids)::int AS total,
                COALESCE(r.done, 0)::int AS done,
                COALESCE(r.passed, 0)::int AS passed,
                COALESCE(r.failed, 0)::int AS failed,
                GREATEST(e.started_at, r.last_at) AS last_activity_at,
                CASE WHEN e.status IN ${ACTIVE} THEN e.test_case_ids END AS case_ids,
                CASE WHEN e.status = 'running' THEN (
                  SELECT u.cid FROM unnest(e.test_case_ids) WITH ORDINALITY AS u(cid, ord)
                  WHERE NOT EXISTS (
                    SELECT 1 FROM execution_results x WHERE x.execution_id = e.id AND x.test_case_id = u.cid
                  )
                  ORDER BY u.ord LIMIT 1
                ) END AS current_case_id
         FROM executions e
         LEFT JOIN LATERAL (
           SELECT count(*) AS done,
                  count(*) FILTER (WHERE status = 'passed') AS passed,
                  count(*) FILTER (WHERE status IN ${FAILED}) AS failed,
                  max(created_at) AS last_at
           FROM execution_results WHERE execution_id = e.id
         ) r ON true
         WHERE e.status IN ${ACTIVE}
            OR e.id IN (SELECT id FROM executions ORDER BY created_at DESC LIMIT $1)
         ORDER BY e.created_at DESC`,
        [limit]
      ),
      query(`SELECT id, name, status, last_heartbeat, current_load FROM workers ORDER BY name`),
      since
        ? query(
            // Margin covers results whose insert committed after an earlier poll's snapshot.
            `SELECT DISTINCT ON (test_case_id)
                    test_case_id, status, COALESCE(finished_at, created_at) AS last_at, duration_ms
             FROM execution_results
             WHERE created_at > $1::timestamptz - interval '10 seconds'
             ORDER BY test_case_id, created_at DESC`,
            [since]
          )
        : Promise.resolve({ rows: [] as any[] }),
      query(
        `SELECT now() AS now,
                (SELECT count(*) FROM test_cases)::text || ':' ||
                COALESCE((SELECT max(updated_at) FROM test_cases)::text, '') || ':' ||
                (SELECT count(*) FROM test_suites)::text || ':' ||
                (SELECT count(*) FROM test_case_suites)::text || ':' ||
                COALESCE((SELECT max(reported_at) FROM build_test_results WHERE application_key = $1)::text, '')
                  AS catalog_sig`,
        [appKey]
      ),
    ]);

    return reply.send({
      data: {
        now: sig.rows[0]?.now,
        catalog_sig: sig.rows[0]?.catalog_sig,
        executions: executions.rows,
        workers: workers.rows,
        changed: changed.rows,
      },
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/ui/executions/:id', async (req, reply) => {
    const { rows } = await query(
      `SELECT e.id, e.key, e.status, e.trigger_source, e.test_suite_id, e.test_case_ids, e.worker_id,
              e.environment_id, e.created_at, e.started_at, e.finished_at, e.requested_by,
              env.name AS environment_name, s.name AS suite_name
       FROM executions e
       LEFT JOIN environments env ON env.id = e.environment_id
       LEFT JOIN test_suites s ON s.id = e.test_suite_id
       WHERE e.id::text = $1 OR e.key = $1`,
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Execution not found' });
    const exec = rows[0];

    const [results, cases] = await Promise.all([
      query(
        `SELECT er.id, er.test_case_id, er.status, er.duration_ms, er.message, er.classification,
                er.started_at, COALESCE(er.finished_at, er.created_at) AS finished_at,
                (SELECT count(*)::int FROM evidence ev WHERE ev.execution_result_id = er.id) AS evidence_count
         FROM execution_results er
         WHERE er.execution_id = $1
         ORDER BY er.created_at`,
        [exec.id]
      ),
      query(`SELECT id, key, name, execution_method FROM test_cases WHERE id = ANY($1::uuid[])`, [
        exec.test_case_ids || [],
      ]),
    ]);

    return reply.send({ data: { ...exec, results: results.rows, cases: cases.rows } });
  });

  app.post<{ Body: { case_ids?: unknown; limit?: unknown } }>('/api/v1/ui/history', async (req, reply) => {
    const raw = Array.isArray(req.body?.case_ids) ? req.body.case_ids : [];
    const ids = [...new Set(raw.map(String).filter((id) => UUID.test(id)))];
    const limit = clampInt(req.body?.limit, 20, 100);
    if (!ids.length) return reply.send({ data: { runs: [], top_failing: [], totals: { cases_run: 0, results: 0 } } });

    const [runs, top, totals] = await Promise.all([
      query(
        `SELECT e.id, e.key, e.status, e.trigger_source, e.created_at, e.started_at, e.finished_at,
                count(*)::int AS total,
                count(*) FILTER (WHERE er.status = 'passed')::int AS passed,
                count(*) FILTER (WHERE er.status IN ${FAILED})::int AS failed,
                count(*) FILTER (WHERE er.status NOT IN ('passed','failed','error','timed_out'))::int AS other,
                COALESCE(sum(er.duration_ms), 0)::bigint AS duration_ms
         FROM execution_results er
         JOIN executions e ON e.id = er.execution_id
         WHERE er.test_case_id = ANY($1::uuid[])
         GROUP BY e.id
         ORDER BY e.created_at DESC
         LIMIT $2`,
        [ids, limit]
      ),
      query(
        `SELECT er.test_case_id, tc.key, tc.name,
                count(*)::int AS runs,
                count(*) FILTER (WHERE er.status IN ${FAILED})::int AS failures,
                max(er.created_at) FILTER (WHERE er.status IN ${FAILED}) AS last_failed_at
         FROM execution_results er
         JOIN test_cases tc ON tc.id = er.test_case_id
         WHERE er.test_case_id = ANY($1::uuid[])
         GROUP BY er.test_case_id, tc.key, tc.name
         HAVING count(*) FILTER (WHERE er.status IN ${FAILED}) > 0
         ORDER BY failures DESC, last_failed_at DESC
         LIMIT 5`,
        [ids]
      ),
      query(
        `SELECT count(DISTINCT test_case_id)::int AS cases_run, count(*)::int AS results, min(created_at) AS first_at
         FROM execution_results WHERE test_case_id = ANY($1::uuid[])`,
        [ids]
      ),
    ]);

    return reply.send({
      data: {
        runs: runs.rows.map((r: any) => ({ ...r, duration_ms: Number(r.duration_ms) })),
        top_failing: top.rows,
        totals: totals.rows[0],
      },
    });
  });

  app.get('/api/v1/ui/build-history', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const appKey = q.application_key || 'sand-bench';
    const limit = clampInt(q.limit, 20, 100);

    const [builds, top] = await Promise.all([
      query(
        `SELECT build_id AS id, build_id AS key, max(reported_at) AS created_at,
                max(commit_sha) AS commit_sha, max(branch) AS branch,
                count(*)::int AS total,
                count(*) FILTER (WHERE status = 'passed')::int AS passed,
                count(*) FILTER (WHERE status IN ('failed','error'))::int AS failed,
                count(*) FILTER (WHERE status NOT IN ('passed','failed','error'))::int AS other,
                COALESCE(sum(duration_ms), 0)::bigint AS duration_ms
         FROM build_test_results WHERE application_key = $1
         GROUP BY build_id ORDER BY max(reported_at) DESC LIMIT $2`,
        [appKey, limit]
      ),
      query(
        `SELECT test_key AS key, max(test_name) AS name, count(*)::int AS runs,
                count(*) FILTER (WHERE status IN ('failed','error'))::int AS failures,
                max(reported_at) FILTER (WHERE status IN ('failed','error')) AS last_failed_at
         FROM build_test_results WHERE application_key = $1
         GROUP BY test_key
         HAVING count(*) FILTER (WHERE status IN ('failed','error')) > 0
         ORDER BY failures DESC, last_failed_at DESC
         LIMIT 5`,
        [appKey]
      ),
    ]);

    return reply.send({
      data: {
        runs: builds.rows.map((r: any) => ({ ...r, duration_ms: Number(r.duration_ms) })),
        top_failing: top.rows,
      },
    });
  });
}
