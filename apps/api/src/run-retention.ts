/**
 * Run retention: drop executions (and their results) older than the
 * configured window. Evidence is pruned first in the same tick so its files
 * never outlive the run they belong to, and never get orphaned on disk
 * (see evidence-store.ts's pruneEvidence).
 */
import { query } from './db/client.js';
import { pruneEvidence } from './evidence-store.js';

export interface RunPruneResult {
  older_than_days: number;
  deleted_executions: number;
  per_type_deleted: number;
  evidence_empty_deleted: number;
}

/** A completed run with no evidence captured anywhere is proof of nothing — the
 *  user wants those pruned, so the retention sweep deletes them. Live/queued
 *  runs are left alone; a tiny grace window keeps us from deleting a run whose
 *  worker has just not uploaded yet. */
export async function pruneEvidencelessRuns(graceSeconds = 60): Promise<number> {
  const { rows } = await query(
    `DELETE FROM executions e
       WHERE e.status NOT IN ('queued','preparing','running')
         AND COALESCE(e.finished_at, e.created_at) < now() - make_interval(secs => $1)
         AND NOT EXISTS (
           SELECT 1 FROM evidence v
             JOIN execution_results r ON r.id = v.execution_result_id
            WHERE r.execution_id = e.id
         )
       RETURNING id`,
    [graceSeconds]
  );
  return rows.length;
}

export async function currentRunRetentionDays(): Promise<number> {
  const { rows } = await query('SELECT run_retention_days FROM settings WHERE id = true');
  return rows[0]?.run_retention_days ?? 5;
}

/**
 * Which executions per-type retention removes: keep the N most recent RUNS of
 * each test type (default 2 for a type without an override).
 *
 * A run is everything queued together — the executions that share a run group
 * (one per suite, or several parts of a large suite) — or a single execution
 * that was started on its own. A run counts for every test type it has a case
 * of, and it is kept whole while it is among the N most recent runs of ANY of
 * those types, or while any of its executions is still queued or running.
 *
 * It used to rank individual executions. A run of eighty suites was then cut
 * down to its last two executions per type within the hour — before the run had
 * even finished — and the record of a full run could never be read back.
 */
const PER_TYPE_SURPLUS_SQL = `
  WITH per_type(test_type, keep) AS (SELECT * FROM unnest($1::text[], $2::int[])),
  run_of AS (
    SELECT e.id, e.status, e.created_at, e.test_case_ids, COALESCE(e.metadata->>'run_group', e.id::text) AS run
    FROM executions e
  ),
  run_types AS (
    SELECT r.run, tc.test_type::text AS test_type, max(r.created_at) AS last_created
    FROM run_of r JOIN test_cases tc ON tc.id = ANY(r.test_case_ids)
    GROUP BY 1, 2
  ),
  ranked AS (
    SELECT rt.run, pt.keep, row_number() OVER (PARTITION BY rt.test_type ORDER BY rt.last_created DESC, rt.run) AS rn
    FROM run_types rt JOIN per_type pt ON pt.test_type = rt.test_type
  ),
  kept AS (
    SELECT run FROM ranked WHERE rn <= keep
    UNION
    SELECT run FROM run_of WHERE status IN ('queued','preparing','running')
  )
  SELECT r.id FROM run_of r
  WHERE r.run IN (SELECT run FROM ranked) AND r.run NOT IN (SELECT run FROM kept)`;

async function perTypeKeep(): Promise<{ types: string[]; keeps: number[] }> {
  const { rows: settingsRows } = await query('SELECT test_type_retention FROM settings WHERE id = true');
  const overrides: Record<string, number> = settingsRows[0]?.test_type_retention || {};
  const { rows: typeRows } = await query(
    `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'test_type'::regtype`
  );
  const types = typeRows.map((r: any) => r.enumlabel as string);
  const keeps = types.map((t) => (Number.isInteger(overrides[t]) && overrides[t]! >= 1 ? Math.min(1000, overrides[t]!) : 2));
  return { types, keeps };
}

/** The executions per-type retention would remove now, without removing them. */
export async function perTypeRetentionSurplus(): Promise<string[]> {
  const { types, keeps } = await perTypeKeep();
  const { rows } = await query(PER_TYPE_SURPLUS_SQL, [types, keeps]);
  return rows.map((r: any) => r.id as string);
}

/** Per-test-type run retention — keep the N most recent runs of each type. Each type
 *  without an override takes the default (2). Returns the number of executions deleted. */
export async function prunePerTypeRetention(): Promise<number> {
  const { types, keeps } = await perTypeKeep();
  const { rows } = await query(`DELETE FROM executions WHERE id IN (${PER_TYPE_SURPLUS_SQL}) RETURNING id`, [types, keeps]);
  return rows.length;
}

export async function pruneRuns(days: number): Promise<RunPruneResult> {
  const result: RunPruneResult = { older_than_days: days, deleted_executions: 0, per_type_deleted: 0, evidence_empty_deleted: 0 };

  // 1) Delete finished runs that captured no evidence — they prove nothing.
  result.evidence_empty_deleted = await pruneEvidencelessRuns();

  // 2) Per-type retention: keep the N most-recent runs of each test type.
  //    This runs even when the day-based sweep is disabled so the user's
  //    per-type cap always applies.
  result.per_type_deleted = await prunePerTypeRetention();

  if (!(days > 0)) return result;

  await pruneEvidence(days);

  const { rows } = await query(
    `DELETE FROM executions
     WHERE created_at < now() - ($1::int * interval '1 day')
       AND status NOT IN ('queued','preparing','running')
     RETURNING id`,
    [Math.floor(days)]
  );
  result.deleted_executions = rows.length;
  return result;
}
