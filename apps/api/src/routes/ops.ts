import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

export async function opsRoutes(app: FastifyInstance) {
  app.get('/api/v1/preflight', async (req, reply) => {
    const q = req.query as Record<string, string>;
    const base = (q.base_url || process.env.TARGET_BASE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
    const paths = ['/', '/health', '/api/health', '/login'];
    const probes: Array<Record<string, unknown>> = [];
    let reachable = false;
    for (const p of paths) {
      const url = `${base}${p}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
        const ok = [200, 201, 204, 301, 302, 303, 307, 308, 401, 403].includes(res.status);
        if (ok) reachable = true;
        probes.push({ url, status: res.status, ok });
      } catch (err) {
        probes.push({ url, status: 0, ok: false, error: (err as Error).message });
      }
    }
    return reply.send({
      data: {
        base_url: base,
        reachable,
        recommendation: reachable ? 'run' : 'blocked',
        classification: reachable ? null : 'target_unreachable',
        probes,
      },
    });
  });

  app.get('/api/v1/intelligence/flakes', async (_req, reply) => {
    const { rows } = await query(
      `SELECT test_case_id,
              count(*) FILTER (WHERE status = 'passed')::int AS passed,
              count(*) FILTER (WHERE status = 'failed')::int AS failed,
              count(*) FILTER (WHERE status = 'blocked')::int AS blocked,
              count(*)::int AS total
       FROM execution_results
       WHERE created_at > now() - interval '14 days'
         AND test_case_id IS NOT NULL
       GROUP BY test_case_id
       HAVING count(*) FILTER (WHERE status = 'passed') > 0
          AND count(*) FILTER (WHERE status = 'failed') > 0
       ORDER BY failed DESC
       LIMIT 30`
    );
    return reply.send({ data: rows, window_days: 14 });
  });

  /** Catalog counts for post-seed verification (Render / ops). */
  app.get('/api/v1/ops/catalog-counts', async (_req, reply) => {
    const cases = await query(`SELECT count(*)::int AS c FROM test_cases`);
    const sandbench = await query(
      `SELECT count(*)::int AS c FROM test_cases WHERE 'sandbench' = ANY(tags)`
    );
    const suites = await query(`SELECT count(*)::int AS c FROM test_suites`);
    const sbSuites = await query(
      `SELECT count(*)::int AS c FROM test_suites WHERE key LIKE 'sb-%'`
    );
    const apps = await query(
      `SELECT key, name, metadata FROM applications WHERE key = 'sand-bench'`
    );
    const byTag = await query(
      `SELECT t.tag, count(*)::int AS c
       FROM test_cases tc, LATERAL unnest(tc.tags) AS t(tag)
       WHERE t.tag IN (
         'unit','integration','screen','usecase','regression','smoke','dataQuality',
         'endurance','performance','rollingUpgrade','nonFunctional','vulnerabilityScanning',
         'penTesting','compatibility','chaos','compliance','drRecovery'
       )
       GROUP BY t.tag
       ORDER BY t.tag`
    );
    const meta = apps.rows[0]?.metadata as { sandbench_types?: unknown[] } | undefined;
    return reply.send({
      data: {
        test_cases_total: cases.rows[0]?.c ?? 0,
        test_cases_sandbench: sandbench.rows[0]?.c ?? 0,
        test_suites_total: suites.rows[0]?.c ?? 0,
        test_suites_sandbench: sbSuites.rows[0]?.c ?? 0,
        sand_bench_app: apps.rows[0]
          ? { key: apps.rows[0].key, name: apps.rows[0].name, type_count: meta?.sandbench_types?.length ?? 0 }
          : null,
        cases_by_type_tag: Object.fromEntries(byTag.rows.map((r) => [r.tag, r.c])),
      },
    });
  });

  /**
   * Trigger Sand Bench taxonomy seed (idempotent upsert).
   * Protect with SEED_TOKEN if set: header x-seed-token must match.
   */
  app.post('/api/v1/ops/seed-sandbench', async (req, reply) => {
    const expected = process.env.SEED_TOKEN;
    if (expected) {
      const got = String(req.headers['x-seed-token'] || '');
      if (got !== expected) {
        return reply.status(401).send({ error: 'invalid or missing x-seed-token' });
      }
    }
    try {
      const { spawn } = await import('node:child_process');
      await new Promise<void>((resolve, reject) => {
        const child = spawn('npx', ['tsx', 'apps/api/src/seed-sandbench-catalog.ts'], {
          stdio: 'inherit',
          env: process.env,
        });
        child.on('exit', (code) =>
          code === 0 ? resolve() : reject(new Error(`seed exit ${code}`))
        );
      });
      const counts = await query(
        `SELECT
           (SELECT count(*)::int FROM test_cases WHERE 'sandbench' = ANY(tags)) AS cases,
           (SELECT count(*)::int FROM test_suites WHERE key LIKE 'sb-%') AS suites`
      );
      return reply.send({
        data: {
          ok: true,
          sandbench_cases: counts.rows[0]?.cases ?? 0,
          sandbench_suites: counts.rows[0]?.suites ?? 0,
        },
      });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}
