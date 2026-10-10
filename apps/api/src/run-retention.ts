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

/** Per-test-type run retention — keep the N most recent runs of each type. Each type
 *  without an override takes the default (2). Returns the number of runs deleted. */
export async function prunePerTypeRetention(): Promise<number> {
  const { rows: settingsRows } = await query('SELECT test_type_retention FROM settings WHERE id = true');
  const overrides: Record<string, number> = settingsRows[0]?.test_type_retention || {};
  const { rows: typeRows } = await query(
    `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'test_type'::regtype`
  );
  const types = typeRows.map((r: any) => r.enumlabel as string);
  let deleted = 0;
  for (const t of types) {
    const n = Number.isInteger(overrides[t]) && overrides[t] >= 1 ? Math.min(1000, overrides[t]) : 2;
    // Rank runs of this test type by most-recent; delete anything beyond the Nth.
    // A run that contains ANY case whose test_type matches is considered that type.
    const { rows: del } = await query(
      `WITH runs_of_type AS (
         SELECT DISTINCT e.id, e.created_at
         FROM executions e
         JOIN test_cases tc ON tc.id = ANY(e.test_case_ids)
         WHERE tc.test_type::text = $1
           AND e.status NOT IN ('queued','preparing','running')
       ), ranked AS (
         SELECT id, row_number() OVER (ORDER BY created_at DESC) AS rn FROM runs_of_type
       )
       DELETE FROM executions WHERE id IN (SELECT id FROM ranked WHERE rn > $2)
       RETURNING id`,
      [t, n]
    );
    deleted += del.length;
  }
  return deleted;
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
