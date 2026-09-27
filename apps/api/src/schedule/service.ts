/**
 * Scheduler service — Run now, cron schedules and the Execution Plan.
 *
 * Every firing (scheduled, manual, event) goes through fire(): resolve the
 * target to test cases, queue one engine execution, and record a schedule_runs
 * row so the plan shows what ran and what was skipped.
 */
import type pg from 'pg';
import { pool, query, withTransaction } from '../db/client.js';
import { defectOverview } from '../defects/service.js';
import { CronError, describeCron, isValidTimezone, nextRun, parseCron, upcoming } from './cron.js';
import { describeTarget, legacyTarget, normalizeTarget, TargetError, type RunTarget } from './target.js';

export { CronError, TargetError };

type Db = Pick<pg.PoolClient, 'query'>;

export class SchedulerError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export const DEFAULT_TZ = process.env.SCHEDULER_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const RETIRED = `tc.lifecycle NOT IN ('deprecated','archived')`;
const SIT = `(tc.key LIKE 'SIT-%' OR tc.key LIKE 'sit-%' OR 'sit' = ANY(tc.tags))`;

/** Test case ids for a target, in a stable order. Mirrors the UI's type rules. */
export async function resolveTarget(db: Db, target: RunTarget): Promise<string[]> {
  let sql: string;
  let params: unknown[] = [];
  switch (target.scope) {
    case 'all':
      sql = `SELECT tc.id FROM test_cases tc WHERE ${RETIRED} ORDER BY tc.key`;
      break;
    case 'cases':
      sql = `SELECT tc.id FROM test_cases tc WHERE tc.id = ANY($1::uuid[]) ORDER BY tc.key`;
      params = [target.case_ids];
      break;
    case 'suites':
      sql = `SELECT DISTINCT tc.id, tc.key FROM test_cases tc
               JOIN test_case_suites m ON m.test_case_id = tc.id
              WHERE m.test_suite_id = ANY($1::uuid[]) AND ${RETIRED} ORDER BY tc.key`;
      params = [target.suite_ids];
      break;
    case 'types': {
      const wantSit = target.types.includes('sit');
      const types = target.types.filter((t) => t !== 'sit');
      sql = `SELECT tc.id FROM test_cases tc
              WHERE ${RETIRED} AND (
                ($2 AND ${SIT})
                OR (NOT ${SIT} AND (
                  tc.test_type::text = ANY($1::text[])
                  OR tc.tags && $1::text[]
                  OR EXISTS (
                    SELECT 1 FROM test_case_suites m JOIN test_suites s ON s.id = m.test_suite_id
                     WHERE m.test_case_id = tc.id
                       AND (s.suite_type = ANY($1::text[])
                            OR (split_part(s.key,'-',1) = 'sb' AND split_part(s.key,'-',2) = ANY($1::text[])))
                  )
                ))
              ) ORDER BY tc.key`;
      params = [types, wantSit];
      break;
    }
  }
  const { rows } = await db.query<{ id: string }>(sql, params);
  return rows.map((r) => r.id);
}

export type FireInput = {
  target: RunTarget;
  trigger: 'schedule' | 'manual' | 'event';
  requested_by: string;
  environment_id?: string | null;
  schedule?: { id: string; name: string; last_execution_id?: string | null } | null;
  label?: string | null;
};

export type FireResult = {
  outcome: 'queued' | 'skipped_overlap' | 'skipped_empty';
  run_id: string;
  execution?: { id: string; key: string } | null;
  case_count: number;
};

async function environmentId(db: Db, ref?: string | null): Promise<string | null> {
  if (ref) {
    const { rows } = await db.query(`SELECT id FROM environments WHERE id::text = $1 OR key = $1`, [ref]);
    if (!rows[0]) throw new SchedulerError(400, `Unknown environment ${ref}`);
    return rows[0].id;
  }
  const { rows } = await db.query(`SELECT id FROM environments WHERE key IN ('local-dev','sandbox') ORDER BY key LIMIT 1`);
  return rows[0]?.id ?? null;
}

export async function fire(db: Db, input: FireInput): Promise<FireResult> {
  const record = async (outcome: FireResult['outcome'], caseCount: number, execId: string | null, message: string | null) => {
    const { rows } = await db.query(
      `INSERT INTO schedule_runs (schedule_id, trigger, target, case_count, execution_id, outcome, requested_by, message)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8) RETURNING id`,
      [input.schedule?.id ?? null, input.trigger, JSON.stringify(input.target), caseCount, execId, outcome, input.requested_by, message]
    );
    return rows[0]!.id as string;
  };

  if (input.schedule?.last_execution_id) {
    const { rows } = await db.query(`SELECT key, status::text AS status FROM executions WHERE id = $1`, [input.schedule.last_execution_id]);
    if (rows[0] && ['queued', 'preparing', 'running'].includes(rows[0].status)) {
      const run_id = await record('skipped_overlap', 0, null, `previous run ${rows[0].key} is still ${rows[0].status}`);
      return { outcome: 'skipped_overlap', run_id, case_count: 0 };
    }
  }

  const caseIds = await resolveTarget(db, input.target);
  if (!caseIds.length) {
    const run_id = await record('skipped_empty', 0, null, 'target matched no test cases');
    return { outcome: 'skipped_empty', run_id, case_count: 0 };
  }

  const env = await environmentId(db, input.environment_id);
  const prefix = input.trigger === 'schedule' ? 'sched' : input.trigger === 'event' ? 'evt' : 'run';
  const key = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { rows } = await db.query(
    `INSERT INTO executions (key, requested_by, test_case_ids, environment_id, status, trigger_source, metadata)
     VALUES ($1,$2,$3,$4,'queued',$5,$6::jsonb) RETURNING id, key`,
    [
      key, input.requested_by, caseIds, env,
      input.trigger === 'event' ? 'ci' : input.trigger,
      JSON.stringify({
        target: input.target, label: input.label ?? null,
        ...(input.schedule ? { schedule_id: input.schedule.id, schedule_name: input.schedule.name } : {}),
      }),
    ]
  );
  const execution = rows[0] as { id: string; key: string };
  const run_id = await record('queued', caseIds.length, execution.id, null);
  return { outcome: 'queued', run_id, execution, case_count: caseIds.length };
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export function validateCron(expr: unknown, tz: string) {
  if (typeof expr !== 'string') throw new SchedulerError(400, 'cron_expression is required');
  try {
    parseCron(expr);
  } catch (err) {
    throw new SchedulerError(400, `Invalid cron: ${(err as Error).message}`);
  }
  if (!isValidTimezone(tz)) throw new SchedulerError(400, `Unknown timezone ${tz}`);
}

export function computeNext(expr: string | null, tz: string, after = new Date(), lastRun?: Date | null): Date | null {
  if (!expr) return null;
  try {
    return nextRun(parseCron(expr), after, tz, lastRun ?? null);
  } catch {
    return null;
  }
}

function targetOf(s: any): RunTarget | null {
  if (s.target) {
    try { return normalizeTarget(s.target); } catch { return null; }
  }
  return legacyTarget(s);
}

async function suiteNames(): Promise<Map<string, string>> {
  const { rows } = await query<{ id: string; name: string }>(`SELECT id, COALESCE(name, key) AS name FROM test_suites`);
  return new Map(rows.map((r) => [r.id, r.name]));
}

function present(s: any, names: Map<string, string>) {
  let cron_description: string | null = null;
  try { cron_description = s.cron_expression ? describeCron(s.cron_expression) : null; } catch { /* invalid legacy row */ }
  const target = targetOf(s);
  return { ...s, target, target_description: describeTarget(target, names), cron_description };
}

export async function listSchedules() {
  const [{ rows }, names] = await Promise.all([
    query(
      `SELECT s.*, e.key AS last_execution_key, e.status::text AS last_execution_status
         FROM schedules s LEFT JOIN executions e ON e.id = s.last_execution_id
        ORDER BY s.enabled DESC, s.next_run_at NULLS LAST, s.name`
    ),
    suiteNames(),
  ]);
  return rows.map((s) => present(s, names));
}

export async function saveSchedule(id: string | null, b: Record<string, unknown>, by: string | null) {
  const existing = id ? (await query(`SELECT * FROM schedules WHERE id::text = $1`, [id])).rows[0] : null;
  if (id && !existing) throw new SchedulerError(404, 'Schedule not found');

  const name = b.name !== undefined ? String(b.name).trim().slice(0, 200) : existing?.name;
  if (!name) throw new SchedulerError(400, 'name is required');
  const tz = String(b.timezone ?? existing?.timezone ?? DEFAULT_TZ);
  const cron = b.cron_expression !== undefined ? b.cron_expression : existing?.cron_expression;
  const event = b.event_trigger !== undefined ? (b.event_trigger ? String(b.event_trigger).slice(0, 64) : null) : existing?.event_trigger ?? null;
  if (cron !== null && cron !== undefined && cron !== '') validateCron(cron, tz);
  else if (!event) throw new SchedulerError(400, 'cron_expression or event_trigger is required');
  else if (!isValidTimezone(tz)) throw new SchedulerError(400, `Unknown timezone ${tz}`);

  let target: RunTarget | null = existing ? targetOf(existing) : null;
  if (b.target !== undefined) {
    try { target = normalizeTarget(b.target); } catch (err) { throw new SchedulerError(400, (err as Error).message); }
  }
  if (!target) throw new SchedulerError(400, 'target is required');

  const enabled = b.enabled !== undefined ? Boolean(b.enabled) : existing?.enabled ?? true;
  const cronText = cron ? String(cron).trim() : null;
  const next = enabled ? computeNext(cronText, tz, new Date(), existing?.last_run_at ? new Date(existing.last_run_at) : null) : null;
  const env = b.environment_id !== undefined ? (b.environment_id || null) : existing?.environment_id ?? null;
  const description = b.description !== undefined ? (b.description ? String(b.description).slice(0, 1000) : null) : existing?.description ?? null;

  const params = [name, cronText, event, JSON.stringify(target), tz, env, enabled, next, description];
  if (existing) {
    const { rows } = await query(
      `UPDATE schedules SET name=$2, cron_expression=$3, event_trigger=$4, target=$5::jsonb, timezone=$6,
              environment_id=$7, enabled=$8, next_run_at=$9, description=$10, updated_at=now()
        WHERE id = $1 RETURNING *`,
      [existing.id, ...params]
    );
    return present(rows[0], await suiteNames());
  }
  const { rows } = await query(
    `INSERT INTO schedules (name, cron_expression, event_trigger, target, timezone, environment_id, enabled, next_run_at, description, created_by)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [...params, by]
  );
  return present(rows[0], await suiteNames());
}

export async function deleteSchedule(id: string) {
  const { rowCount } = await query(`DELETE FROM schedules WHERE id::text = $1`, [id]);
  if (!rowCount) throw new SchedulerError(404, 'Schedule not found');
}

/** Fire one schedule now (the Run button, or the ticker). */
export async function runSchedule(id: string, trigger: 'schedule' | 'manual', by: string, dueBy?: Date): Promise<FireResult | null> {
  return withTransaction(async (db) => {
    const { rows } = await db.query(`SELECT * FROM schedules WHERE id::text = $1 FOR UPDATE`, [id]);
    const s = rows[0];
    if (!s) throw new SchedulerError(404, 'Schedule not found');
    // The ticker re-checks under the row lock: another replica may have fired it.
    if (dueBy && (!s.enabled || !s.next_run_at || new Date(s.next_run_at) > dueBy)) return null;
    const target = targetOf(s);
    if (!target) throw new SchedulerError(400, 'Schedule has no test cases or target');
    const result = await fire(db, { target, trigger, requested_by: by, environment_id: s.environment_id, schedule: s });
    const now = new Date();
    await db.query(
      `UPDATE schedules SET last_run_at = $2, last_outcome = $3,
              last_execution_id = COALESCE($4, last_execution_id), next_run_at = $5
        WHERE id = $1`,
      [s.id, now, result.outcome, result.execution?.id ?? null,
        s.enabled ? computeNext(s.cron_expression, s.timezone || DEFAULT_TZ, now, now) : null]
    );
    return result;
  });
}

/** Event triggers (after_build, after_deploy, …) fire every matching schedule. */
export async function fireEvent(event: string, environmentId: string | null, by: string) {
  const { rows } = await query(`SELECT id FROM schedules WHERE enabled AND event_trigger = $1`, [event]);
  const results = [];
  for (const r of rows) {
    results.push(await withTransaction(async (db) => {
      const { rows: s } = await db.query(`SELECT * FROM schedules WHERE id = $1 FOR UPDATE`, [r.id]);
      const target = targetOf(s[0]);
      if (!target) return null;
      const out = await fire(db, {
        target, trigger: 'event', requested_by: by, schedule: s[0],
        environment_id: environmentId ?? s[0].environment_id,
      });
      await db.query(
        `UPDATE schedules SET last_run_at = now(), last_outcome = $2, last_execution_id = COALESCE($3, last_execution_id) WHERE id = $1`,
        [s[0].id, out.outcome, out.execution?.id ?? null]
      );
      return out;
    }));
  }
  return results.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Ticker
// ---------------------------------------------------------------------------

/**
 * Fire every due schedule once. runSchedule re-checks "still due" under the
 * row lock, so several API replicas can tick safely; a schedule that missed several slots (engine down) fires once, then
 * moves to its next future slot — no catch-up storm.
 */
export async function tick(now = new Date()): Promise<number> {
  const { rows } = await query(
    `SELECT id FROM schedules WHERE enabled AND cron_expression IS NOT NULL AND next_run_at IS NOT NULL AND next_run_at <= $1`,
    [now]
  );
  let fired = 0;
  for (const r of rows) {
    try {
      if (await runSchedule(r.id, 'schedule', 'scheduler', now)) fired++;
    } catch (err) {
      console.warn('[scheduler] fire failed', r.id, (err as Error).message);
      const { rows: s } = await query(`SELECT cron_expression, timezone FROM schedules WHERE id = $1`, [r.id]);
      await query(`UPDATE schedules SET last_outcome = 'error', next_run_at = $2 WHERE id = $1`, [
        r.id, computeNext(s[0]?.cron_expression ?? null, s[0]?.timezone || DEFAULT_TZ, now, now),
      ]);
    }
  }
  return fired;
}

/** Give schedules saved before next_run_at was maintained a next slot. */
export async function backfillNextRuns() {
  const { rows } = await query(
    `SELECT id, cron_expression, timezone, last_run_at FROM schedules WHERE enabled AND cron_expression IS NOT NULL AND next_run_at IS NULL`
  );
  for (const s of rows) {
    await query(`UPDATE schedules SET next_run_at = $2 WHERE id = $1`, [
      s.id, computeNext(s.cron_expression, s.timezone || DEFAULT_TZ, new Date(), s.last_run_at ? new Date(s.last_run_at) : null),
    ]);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
let ticking = false;

export function startScheduler(intervalMs = Number(process.env.SCHEDULER_TICK_MS || 30_000)) {
  if (timer || process.env.SCHEDULER_IN_PROCESS === 'false') return;
  backfillNextRuns().catch((err) => console.warn('[scheduler] backfill', (err as Error).message));
  timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try { await tick(); } catch (err) { console.warn('[scheduler] tick', (err as Error).message); }
    finally { ticking = false; }
  }, intervalMs);
  timer.unref?.();
  console.log(`[scheduler] in-process ticker every ${intervalMs}ms (tz default ${DEFAULT_TZ})`);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

// ---------------------------------------------------------------------------
// Execution Plan
// ---------------------------------------------------------------------------

export async function executionPlan(hours = 168, perSchedule = 48) {
  const now = new Date();
  const horizon = new Date(now.getTime() + Math.min(Math.max(hours, 1), 24 * 31) * 3_600_000);
  const schedules = await listSchedules();
  const upcomingRuns: Record<string, unknown>[] = [];
  for (const s of schedules) {
    if (!s.enabled || !s.cron_expression) continue;
    let times: Date[] = [];
    try {
      times = upcoming(s.cron_expression, now, s.timezone || DEFAULT_TZ, perSchedule, horizon, s.last_run_at ? new Date(s.last_run_at) : null);
    } catch { /* invalid legacy cron */ }
    for (const at of times) {
      upcomingRuns.push({
        schedule_id: s.id, name: s.name, at: at.toISOString(),
        target_description: s.target_description, cron_description: s.cron_description,
      });
    }
  }
  upcomingRuns.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  const { rows: recent } = await query(
    `SELECT r.*, s.name AS schedule_name, e.key AS execution_key, e.status::text AS execution_status,
            (SELECT COUNT(*) FROM execution_results x WHERE x.execution_id = r.execution_id AND x.status = 'passed')::int AS passed,
            (SELECT COUNT(*) FROM execution_results x WHERE x.execution_id = r.execution_id
               AND x.status IN ('failed','error','timed_out','blocked'))::int AS failed
       FROM schedule_runs r
       LEFT JOIN schedules s ON s.id = r.schedule_id
       LEFT JOIN executions e ON e.id = r.execution_id
      ORDER BY r.fired_at DESC LIMIT 50`
  );

  let defects: unknown = null;
  try { defects = await defectOverview(); } catch { /* defect tables absent */ }

  return {
    now: now.toISOString(), horizon: horizon.toISOString(), default_timezone: DEFAULT_TZ,
    ticker: { in_process: process.env.SCHEDULER_IN_PROCESS !== 'false', running: Boolean(timer) },
    schedules, upcoming: upcomingRuns.slice(0, 500), recent, defects,
  };
}

/** Choices for the Run now / schedule forms. */
export async function schedulerOptions() {
  const [apps, suites, typeCounts] = await Promise.all([
    query(`SELECT metadata FROM applications WHERE key = 'sand-bench' LIMIT 1`),
    query(
      `SELECT s.id, s.key, s.name, s.suite_type, COUNT(m.test_case_id)::int AS cases
         FROM test_suites s LEFT JOIN test_case_suites m ON m.test_suite_id = s.id
        GROUP BY s.id ORDER BY s.name`
    ),
    query(`SELECT test_type::text AS id, COUNT(*)::int AS cases FROM test_cases GROUP BY test_type`),
  ]);
  const meta = (apps.rows[0]?.metadata?.sandbench_types ?? []) as { key: string; label?: string; category?: string }[];
  const types = new Map<string, { id: string; title: string; category: string }>();
  types.set('sit', { id: 'sit', title: 'SIT (Sand Bench integration)', category: 'sit' });
  for (const t of meta) types.set(t.key, { id: t.key, title: t.label || t.key, category: t.category === 'qc' ? 'qc' : 'qa' });
  for (const t of typeCounts.rows) if (!types.has(t.id) && t.id !== 'other') types.set(t.id, { id: t.id, title: t.id, category: 'qa' });

  const counts = new Map<string, number>();
  await Promise.all([...types.keys()].map(async (id) => {
    counts.set(id, (await resolveTarget(pool, { scope: 'types', types: [id] })).length);
  }));
  return {
    default_timezone: DEFAULT_TZ,
    types: [...types.values()].map((t) => ({ ...t, cases: counts.get(t.id) ?? 0 })).filter((t) => t.cases > 0 || t.id === 'sit'),
    suites: suites.rows,
    presets: [
      { label: 'Every 15 minutes', cron: '*/15 * * * *' },
      { label: 'Hourly', cron: '0 * * * *' },
      { label: 'Nightly 02:00', cron: '0 2 * * *' },
      { label: 'Weekdays 06:30', cron: '30 6 * * 1-5' },
      { label: 'Weekly Sunday 03:00', cron: '0 3 * * 0' },
    ],
  };
}

export async function previewTarget(target: RunTarget) {
  const ids = await resolveTarget(pool, target);
  return { case_count: ids.length };
}

export function previewCron(expr: string, tz: string, count = 5) {
  validateCron(expr, tz);
  return {
    description: describeCron(expr),
    next: upcoming(expr, new Date(), tz, Math.min(Math.max(count, 1), 20)).map((d) => d.toISOString()),
  };
}
