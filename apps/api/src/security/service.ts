/**
 * Security scans service — applies the rules in core.ts to Postgres.
 */
import { randomUUID } from 'node:crypto';
import { query, withTransaction } from '../db/client.js';
import {
  FINDING_STATUSES, SecurityScanError, ingestKey, isSeverity, normalizeReport, planFindings, registerSummary, scanKey,
  type ExistingFinding,
} from './core.js';

export { SecurityScanError };

const SCAN_COLUMNS = `id, key, project, repository, branch, commit_sha, dirty, trigger, result, fail_on,
  started_at, finished_at, duration_ms, total, new_count, accepted_count, blocking_count, by_severity, tools, created_at`;

export type IngestOutcome = {
  scan: Record<string, unknown>;
  duplicate: boolean;
  findings: { new: number; reopened: number; fixed: number; open: number; accepted: number };
};

export async function ingestScan(body: unknown): Promise<IngestOutcome> {
  const scan = normalizeReport(body);
  const dedupe = ingestKey(scan);
  const existing = await query(`SELECT ${SCAN_COLUMNS} FROM security_scans WHERE ingest_key = $1`, [dedupe]);
  if (existing.rows[0]) {
    return { scan: existing.rows[0], duplicate: true, findings: { new: 0, reopened: 0, fixed: 0, open: 0, accepted: 0 } };
  }
  const bySeverity: Record<string, number> = {};
  for (const f of scan.findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  const accepted = scan.findings.filter((f) => f.status === 'accepted').length;

  return withTransaction(async (db) => {
    const inserted = await db.query(
      `INSERT INTO security_scans (key, ingest_key, project, repository, branch, commit_sha, dirty, trigger, result, fail_on,
         started_at, finished_at, duration_ms, total, new_count, accepted_count, blocking_count, by_severity, tools, findings, blocking)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20::jsonb,$21::jsonb)
       ON CONFLICT (ingest_key) DO NOTHING
       RETURNING ${SCAN_COLUMNS}`,
      [
        scanKey(scan.finishedAt, randomUUID().replace(/-/g, '')), dedupe, scan.project, scan.repository, scan.branch, scan.commit,
        scan.dirty, scan.trigger, scan.result, scan.failOn, scan.startedAt, scan.finishedAt, scan.durationMs,
        scan.findings.length, scan.findings.length - accepted, accepted, scan.blocking.length,
        JSON.stringify(bySeverity), JSON.stringify(scan.tools), JSON.stringify(scan.findings), JSON.stringify(scan.blocking),
      ]
    );
    const row = inserted.rows[0];
    if (!row) {
      // A concurrent post of the same report won the race.
      const again = await db.query(`SELECT ${SCAN_COLUMNS} FROM security_scans WHERE ingest_key = $1`, [dedupe]);
      return { scan: again.rows[0], duplicate: true, findings: { new: 0, reopened: 0, fixed: 0, open: 0, accepted: 0 } };
    }
    const known = await db.query<ExistingFinding>(
      `SELECT fingerprint, category, status FROM security_findings WHERE project = $1 FOR UPDATE`,
      [scan.project]
    );
    const plan = planFindings(known.rows, scan);
    for (const { finding, status, reopened } of plan.upserts) {
      await db.query(
        `INSERT INTO security_findings (project, fingerprint, rule, category, severity, title, file, line, detail, url, status,
           accepted_reason, reference, first_seen_scan_id, last_seen_scan_id, first_seen, last_seen)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,now(),now())
         ON CONFLICT (project, fingerprint) DO UPDATE SET
           rule = EXCLUDED.rule, category = EXCLUDED.category, severity = EXCLUDED.severity, title = EXCLUDED.title,
           file = EXCLUDED.file, line = EXCLUDED.line, detail = EXCLUDED.detail, url = EXCLUDED.url,
           status = EXCLUDED.status, accepted_reason = EXCLUDED.accepted_reason, reference = EXCLUDED.reference,
           last_seen_scan_id = EXCLUDED.last_seen_scan_id, last_seen = now(),
           occurrences = security_findings.occurrences + 1,
           reopen_count = security_findings.reopen_count + $15,
           fixed_at = NULL, fixed_scan_id = NULL`,
        [
          scan.project, finding.fingerprint, finding.rule, finding.category, finding.severity, finding.title, finding.file,
          finding.line, finding.detail, finding.url, status, finding.acceptedReason, finding.reference, row.id, reopened ? 1 : 0,
        ]
      );
    }
    if (plan.fixed.length) {
      await db.query(
        `UPDATE security_findings SET status = 'fixed', fixed_at = now(), fixed_scan_id = $3
          WHERE project = $1 AND fingerprint = ANY($2::text[])`,
        [scan.project, plan.fixed, row.id]
      );
    }
    return {
      scan: row,
      duplicate: false,
      findings: {
        new: plan.upserts.filter((u) => u.isNew).length,
        reopened: plan.upserts.filter((u) => u.reopened).length,
        fixed: plan.fixed.length,
        open: plan.upserts.filter((u) => u.status === 'open').length,
        accepted: plan.upserts.filter((u) => u.status === 'accepted').length,
      },
    };
  });
}

export async function listScans(opts: { project?: string; limit?: number }) {
  const limit = Math.max(1, Math.min(opts.limit || 50, 200));
  const params: unknown[] = [];
  let where = '';
  if (opts.project) { params.push(opts.project); where = `WHERE project = $1`; }
  params.push(limit);
  const { rows } = await query(`SELECT ${SCAN_COLUMNS} FROM security_scans ${where} ORDER BY finished_at DESC LIMIT $${params.length}`, params);
  return rows;
}

export async function getScan(idOrKey: string) {
  const byId = /^[0-9a-f-]{36}$/i.test(idOrKey);
  const { rows } = await query(
    `SELECT ${SCAN_COLUMNS}, findings, blocking FROM security_scans WHERE ${byId ? 'id = $1::uuid' : 'key = $1'}`,
    [idOrKey]
  );
  return rows[0] || null;
}

export async function listFindings(opts: { project?: string; status?: string; severity?: string; category?: string; limit?: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
  if (opts.project) add('f.project = ?', opts.project);
  const statuses = String(opts.status || '').split(',').filter((s) => (FINDING_STATUSES as readonly string[]).includes(s));
  if (statuses.length) add('f.status = ANY(?::text[])', statuses);
  if (opts.severity && isSeverity(opts.severity)) add('f.severity = ?', opts.severity);
  if (opts.category) add('f.category = ?', opts.category.slice(0, 40));
  params.push(Math.max(1, Math.min(opts.limit || 500, 2000)));
  const { rows } = await query(
    `SELECT f.*, s1.key AS first_seen_scan_key, s2.key AS last_seen_scan_key, s3.key AS fixed_scan_key
       FROM security_findings f
       LEFT JOIN security_scans s1 ON s1.id = f.first_seen_scan_id
       LEFT JOIN security_scans s2 ON s2.id = f.last_seen_scan_id
       LEFT JOIN security_scans s3 ON s3.id = f.fixed_scan_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY CASE f.status WHEN 'open' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END,
               CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
               f.last_seen DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

export async function projects(): Promise<string[]> {
  const { rows } = await query<{ project: string }>(`SELECT DISTINCT project FROM security_scans ORDER BY project`);
  return rows.map((r) => r.project);
}

export async function securityOverview(project?: string) {
  const name = project || (await projects())[0] || null;
  if (!name) return { project: null, projects: [], latest: null, register: registerSummary([]), trend: [], scans: 0 };
  const [latest, findings, trend, count, all] = await Promise.all([
    query(`SELECT ${SCAN_COLUMNS}, blocking FROM security_scans WHERE project = $1 ORDER BY finished_at DESC LIMIT 1`, [name]),
    query<{ severity: string; status: string; category: string }>(`SELECT severity, status, category FROM security_findings WHERE project = $1`, [name]),
    query(
      `SELECT key, finished_at, result, total, new_count, accepted_count, blocking_count, commit_sha, trigger
         FROM security_scans WHERE project = $1 ORDER BY finished_at DESC LIMIT 20`,
      [name]
    ),
    query<{ n: string }>(`SELECT count(*)::text AS n FROM security_scans WHERE project = $1`, [name]),
    projects(),
  ]);
  const fixedRecently = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM security_findings WHERE project = $1 AND status = 'fixed' AND fixed_at > now() - interval '30 days'`,
    [name]
  );
  return {
    project: name,
    projects: all,
    latest: latest.rows[0] || null,
    register: { ...registerSummary(findings.rows), fixedLast30Days: Number(fixedRecently.rows[0]?.n || 0) },
    trend: trend.rows.reverse(),
    scans: Number(count.rows[0]?.n || 0),
  };
}
