import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';

// Timeouts are stored in `test_type_timeout_minutes` (JSONB) in minutes, which
// may be fractional (e.g. 0.5 = 30 seconds). The API exposes them to the UI
// as whole seconds under `test_type_timeout_seconds`; the DB column name stays
// so existing deployments do not need a migration.
export const DEFAULT_TIMEOUT_SECONDS = 30;
export const DEFAULT_TIMEOUT_MINUTES = DEFAULT_TIMEOUT_SECONDS / 60; // 0.5 min = 30 s
const MIN_TIMEOUT_SECONDS = 5;
const MAX_TIMEOUT_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MIN_FAILURE_LIMIT = 1;
const MAX_FAILURE_LIMIT = 1000;
export const DEFAULT_PER_TYPE_RETENTION = 2;
const MIN_PER_TYPE_RETENTION = 1;
const MAX_PER_TYPE_RETENTION = 1000;
const MIN_AUTO_FIX_ATTEMPTS = 1;
const MAX_AUTO_FIX_ATTEMPTS = 20;

async function testTypes(): Promise<string[]> {
  const { rows } = await query(
    `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'test_type'::regtype ORDER BY enumsortorder`
  );
  return rows.map((r: any) => r.enumlabel as string);
}

/** Every known test_type populated — the stored override if set, else the default (30 s). */
function withDefaultsSeconds(types: string[], overridesInMinutes: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of types) {
    const v = Number((overridesInMinutes || {})[t]);
    out[t] = Number.isFinite(v) && v > 0 ? Math.max(MIN_TIMEOUT_SECONDS, Math.round(v * 60)) : DEFAULT_TIMEOUT_SECONDS;
  }
  return out;
}
/** Every known test_type populated — the stored override if set, else the default (2 runs retained). */
function withDefaultsRetention(types: string[], overrides: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of types) {
    const v = Number((overrides || {})[t]);
    out[t] = Number.isInteger(v) && v >= MIN_PER_TYPE_RETENTION ? Math.min(MAX_PER_TYPE_RETENTION, v) : DEFAULT_PER_TYPE_RETENTION;
  }
  return out;
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/v1/settings', async (_req, reply) => {
    const [{ rows }, types] = await Promise.all([
      query(
        `SELECT run_retention_days, test_type_timeout_minutes, test_type_retention, consecutive_failure_limit,
                rolling_fail_cancel_enabled, rolling_fail_cancel_window, rolling_fail_cancel_threshold_pct,
                auto_fix_default_max_attempts, fixer_agent_mode, fixer_agent_diff_cap_lines,
                updated_at FROM settings WHERE id = true`
      ),
      testTypes(),
    ]);
    const row = rows[0] || {};
    return reply.send({
      data: {
        run_retention_days: row.run_retention_days ?? 5,
        test_type_timeout_seconds: withDefaultsSeconds(types, row.test_type_timeout_minutes || {}),
        test_type_retention: withDefaultsRetention(types, row.test_type_retention || {}),
        consecutive_failure_limit: row.consecutive_failure_limit ?? 20,
        rolling_fail_cancel_enabled: row.rolling_fail_cancel_enabled ?? true,
        rolling_fail_cancel_window: row.rolling_fail_cancel_window ?? 20,
        rolling_fail_cancel_threshold_pct: row.rolling_fail_cancel_threshold_pct ?? 50,
        auto_fix_default_max_attempts: row.auto_fix_default_max_attempts ?? 2,
        fixer_agent_mode: row.fixer_agent_mode ?? 'auto',
        fixer_agent_diff_cap_lines: row.fixer_agent_diff_cap_lines ?? 400,
        updated_at: row.updated_at ?? null,
      },
    });
  });

  app.put<{
    Body: {
      run_retention_days?: unknown;
      test_type_timeout_seconds?: unknown;
      test_type_retention?: unknown;
      consecutive_failure_limit?: unknown;
      rolling_fail_cancel_enabled?: unknown;
      rolling_fail_cancel_window?: unknown;
      rolling_fail_cancel_threshold_pct?: unknown;
      auto_fix_default_max_attempts?: unknown;
      fixer_agent_mode?: unknown;
      fixer_agent_diff_cap_lines?: unknown;
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
    if (b.test_type_timeout_seconds !== undefined) {
      const raw = b.test_type_timeout_seconds;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return reply.status(400).send({ error: 'test_type_timeout_seconds must be an object of test_type -> seconds' });
      }
      timeouts = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!types.includes(k)) return reply.status(400).send({ error: `Unknown test_type "${k}"` });
        const secs = Number(v);
        if (!Number.isInteger(secs) || secs < MIN_TIMEOUT_SECONDS || secs > MAX_TIMEOUT_SECONDS) {
          return reply.status(400).send({
            error: `test_type_timeout_seconds.${k} must be a whole number of seconds between ${MIN_TIMEOUT_SECONDS} and ${MAX_TIMEOUT_SECONDS}`,
          });
        }
        // Store in minutes under the existing column — fractional values are allowed and the worker
        // multiplies by 60_000 to get ms, so sub-minute values map through cleanly.
        timeouts[k] = secs / 60;
      }
    }

    let retention: Record<string, number> | null = null;
    if (b.test_type_retention !== undefined) {
      const raw = b.test_type_retention;
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return reply.status(400).send({ error: 'test_type_retention must be an object of test_type -> integer' });
      }
      retention = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!types.includes(k)) return reply.status(400).send({ error: `Unknown test_type "${k}"` });
        const n = Number(v);
        if (!Number.isInteger(n) || n < MIN_PER_TYPE_RETENTION || n > MAX_PER_TYPE_RETENTION) {
          return reply.status(400).send({
            error: `test_type_retention.${k} must be a whole integer between ${MIN_PER_TYPE_RETENTION} and ${MAX_PER_TYPE_RETENTION}`,
          });
        }
        retention[k] = n;
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

    let rollingEnabled: boolean | null = null;
    if (b.rolling_fail_cancel_enabled !== undefined) {
      rollingEnabled = !!b.rolling_fail_cancel_enabled;
    }
    let rollingWindow: number | null = null;
    if (b.rolling_fail_cancel_window !== undefined) {
      const n = Number(b.rolling_fail_cancel_window);
      if (!Number.isInteger(n) || n < 5 || n > 500) {
        return reply.status(400).send({ error: 'rolling_fail_cancel_window must be a whole number between 5 and 500' });
      }
      rollingWindow = n;
    }
    let rollingThreshold: number | null = null;
    if (b.rolling_fail_cancel_threshold_pct !== undefined) {
      const n = Number(b.rolling_fail_cancel_threshold_pct);
      if (!Number.isInteger(n) || n < 10 || n > 100) {
        return reply.status(400).send({ error: 'rolling_fail_cancel_threshold_pct must be a whole number between 10 and 100' });
      }
      rollingThreshold = n;
    }

    let autoFixAttempts: number | null = null;
    if (b.auto_fix_default_max_attempts !== undefined) {
      const n = Number(b.auto_fix_default_max_attempts);
      if (!Number.isInteger(n) || n < MIN_AUTO_FIX_ATTEMPTS || n > MAX_AUTO_FIX_ATTEMPTS) {
        return reply.status(400).send({
          error: `auto_fix_default_max_attempts must be a whole number between ${MIN_AUTO_FIX_ATTEMPTS} and ${MAX_AUTO_FIX_ATTEMPTS}`,
        });
      }
      autoFixAttempts = n;
    }

    let fixerMode: string | null = null;
    if (b.fixer_agent_mode !== undefined) {
      const m = String(b.fixer_agent_mode).toLowerCase();
      if (m !== 'off' && m !== 'propose' && m !== 'auto') {
        return reply.status(400).send({ error: 'fixer_agent_mode must be off | propose | auto' });
      }
      fixerMode = m;
    }

    let diffCap: number | null = null;
    if (b.fixer_agent_diff_cap_lines !== undefined) {
      const n = Number(b.fixer_agent_diff_cap_lines);
      if (!Number.isInteger(n) || n < 10 || n > 100000) {
        return reply.status(400).send({ error: 'fixer_agent_diff_cap_lines must be a whole number between 10 and 100000' });
      }
      diffCap = n;
    }

    const { rows } = await query(
      `UPDATE settings SET
         run_retention_days = COALESCE($1, run_retention_days),
         test_type_timeout_minutes = COALESCE($2::jsonb, test_type_timeout_minutes),
         consecutive_failure_limit = COALESCE($3, consecutive_failure_limit),
         rolling_fail_cancel_enabled = COALESCE($5, rolling_fail_cancel_enabled),
         rolling_fail_cancel_window = COALESCE($6, rolling_fail_cancel_window),
         rolling_fail_cancel_threshold_pct = COALESCE($7, rolling_fail_cancel_threshold_pct),
         test_type_retention = COALESCE($8::jsonb, test_type_retention),
         auto_fix_default_max_attempts = COALESCE($9, auto_fix_default_max_attempts),
         fixer_agent_mode = COALESCE($10, fixer_agent_mode),
         fixer_agent_diff_cap_lines = COALESCE($11, fixer_agent_diff_cap_lines),
         updated_at = now(), updated_by = $4
       WHERE id = true
       RETURNING run_retention_days, test_type_timeout_minutes, test_type_retention,
                 consecutive_failure_limit,
                 rolling_fail_cancel_enabled, rolling_fail_cancel_window, rolling_fail_cancel_threshold_pct,
                 auto_fix_default_max_attempts, fixer_agent_mode, fixer_agent_diff_cap_lines,
                 updated_at`,
      [days, timeouts ? JSON.stringify(timeouts) : null, failureLimit, req.actor?.id ?? null,
       rollingEnabled, rollingWindow, rollingThreshold,
       retention ? JSON.stringify(retention) : null,
       autoFixAttempts, fixerMode, diffCap]
    );
    const { test_type_timeout_minutes: storedMinutes, test_type_retention: storedRetention, ...rest } = rows[0] || ({} as any);
    return reply.send({
      data: {
        ...rest,
        test_type_timeout_seconds: withDefaultsSeconds(types, storedMinutes || {}),
        test_type_retention: withDefaultsRetention(types, storedRetention || {}),
      },
    });
  });
}
