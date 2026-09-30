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
}

export async function currentRunRetentionDays(): Promise<number> {
  const { rows } = await query('SELECT run_retention_days FROM settings WHERE id = true');
  return rows[0]?.run_retention_days ?? 5;
}

export async function pruneRuns(days: number): Promise<RunPruneResult> {
  const result: RunPruneResult = { older_than_days: days, deleted_executions: 0 };
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
