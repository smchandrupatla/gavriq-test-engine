import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

export const DEFAULT_TIMEOUT_MINUTES = 1440; // 24 hours
const MIN_TIMEOUT_MINUTES = 1;
const MAX_TIMEOUT_MINUTES = 10_080; // 7 days
const MIN_FAILURE_LIMIT = 1;
const MAX_FAILURE_LIMIT = 1000;

async function testTypes(): Promise<string[]> {
  const { rows } = await query(
    `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'test_type'::regtype ORDER BY enumsortorder`
  );
  return rows.map((r: any) => r.enumlabel as string);
}

/** Every known test_type populated — the stored override if set, else the 24h default. */
function withDefaults(types: string[], overrides: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of types) {
    const v = Number((overrides || {})[t]);
    out[t] = Number.isFinite(v) && v > 0 ? v : DEFAULT_TIMEOUT_MINUTES;
  }
  return out;
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/v1/settings', async (_req, reply) => {
    const [{ rows }, types] = await Promise.all([
      query(
        'SELECT run_retention_days, test_type_timeout_minutes, consecutive_failure_limit, updated_at FROM settings WHERE id = true'
      ),
      testTypes(),
    ]);
    const row = rows[0] || {};
    return reply.send({
      data: {
        run_retention_days: row.run_retention_days ?? 5,
        test_type_timeout_minutes: withDefaults(types, row.test_type_timeout_minutes || {}),
        consecutive_failure_limit: row.consecutive_failure_limit ?? 20,
        updated_at: row.updated_at ?? null,
      },
    });
  });

  app.put<{
    Body: {
      run_retention_days?: unknown;
      test_type_timeout_minutes?: unknown;
      consecutive_failure_limit?: unknown;
    };
  }>('/api/v1/settings', async (req, reply) => {
    const b = req.body || {};
    const types = await testTypes();

    let days: number | null = null;
    if (b.run_retention_days !== undefined) {
      days = Number(b.run_retention_days);
      if (!Number.isInteger(days) || days < 5 || days > 365) {
        return reply.status(400).send({ error: 'run_retention_days must be a whole number between 5 and 365' });
      }
    }

    let timeouts: Record<string, number> | null = null;
    if (b.test_type_timeout_minutes !== undefined) {
      const raw = b.test_type_timeout_minutes;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return reply.status(400).send({ error: 'test_type_timeout_minutes must be an object of test_type -> minutes' });
      }
      timeouts = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!types.includes(k)) return reply.status(400).send({ error: `Unknown test_type "${k}"` });
        const n = Number(v);
        if (!Number.isInteger(n) || n < MIN_TIMEOUT_MINUTES || n > MAX_TIMEOUT_MINUTES) {
          return reply.status(400).send({
            error: `test_type_timeout_minutes.${k} must be a whole number of minutes between ${MIN_TIMEOUT_MINUTES} and ${MAX_TIMEOUT_MINUTES}`,
          });
        }
        timeouts[k] = n;
      }
    }

    let failureLimit: number | null = null;
    if (b.consecutive_failure_limit !== undefined) {
      const n = Number(b.consecutive_failure_limit);
      if (!Number.isInteger(n) || n < MIN_FAILURE_LIMIT || n > MAX_FAILURE_LIMIT) {
        return reply.status(400).send({
          error: `consecutive_failure_limit must be a whole number between ${MIN_FAILURE_LIMIT} and ${MAX_FAILURE_LIMIT}`,
        });
      }
      failureLimit = n;
    }

    const { rows } = await query(
      `UPDATE settings SET
         run_retention_days = COALESCE($1, run_retention_days),
         test_type_timeout_minutes = COALESCE($2::jsonb, test_type_timeout_minutes),
         consecutive_failure_limit = COALESCE($3, consecutive_failure_limit),
         updated_at = now(), updated_by = $4
       WHERE id = true
       RETURNING run_retention_days, test_type_timeout_minutes, consecutive_failure_limit, updated_at`,
      [days, timeouts ? JSON.stringify(timeouts) : null, failureLimit, req.actor?.id ?? null]
    );
    return reply.send({
      data: {
        ...rows[0],
        test_type_timeout_minutes: withDefaults(types, rows[0]!.test_type_timeout_minutes || {}),
      },
    });
  });
}
