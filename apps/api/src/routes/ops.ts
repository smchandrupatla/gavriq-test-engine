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
}
