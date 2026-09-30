/**
 * Security service: stores scan reports from the core scanner, and runs the CVE Watch agent.
 *
 * CVE Watch re-checks every configured inventory against OSV.dev on a timer, so a CVE published
 * tomorrow for a package installed today is found without anyone running a scan. It validates
 * each hit, opens a vulnerability (source `cve-watch`), and closes it once a later run no longer
 * sees it (the engine verifies; agents cannot mark a vulnerability fixed themselves).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, withTransaction } from '../db/client.js';
import {
  lockfileComponents, osvLookup, parseKev, planRun, severityRank,
  type CveFinding, type Http,
} from './cve-core.js';

export class SecurityError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const KEV_URL = process.env.CVE_KEV_URL || 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export interface Source { project: string; location: string }

/** CVE_WATCH_SOURCES="project=path-or-url,project2=..." (lockfile locations). */
export function watchSources(env: NodeJS.ProcessEnv = process.env): Source[] {
  const raw = env.CVE_WATCH_SOURCES
    || `gavriq-test-engine=${path.join(ROOT, 'package-lock.json')},`
     + 'sand-bench-enterprise=https://raw.githubusercontent.com/smchandrupatla/sand-bench-enterprise/main/package-lock.json';
  return raw.split(',').map((s) => s.trim()).filter(Boolean).map((pair) => {
    const at = pair.indexOf('=');
    if (at < 1) throw new Error(`CVE_WATCH_SOURCES entry "${pair}" must be project=location`);
    return { project: pair.slice(0, at).trim(), location: pair.slice(at + 1).trim() };
  });
}

async function loadLockfile(location: string, http: Http): Promise<unknown> {
  if (!/^https?:\/\//.test(location)) return JSON.parse(readFileSync(location, 'utf8'));
  const token = process.env.GITHUB_TOKEN;
  const res = await http(location, { headers: token ? { authorization: `token ${token}` } : {}, signal: AbortSignal.timeout(30000) } as RequestInit);
  if (!res.ok) throw new Error(`lockfile ${location} answered HTTP ${res.status}`);
  return res.json();
}

async function nextKey(prefix: string, seq: string): Promise<string> {
  const { rows } = await query<{ n: string }>(`SELECT nextval('${seq}')::text AS n`);
  return `${prefix}-${rows[0]!.n.padStart(5, '0')}`;
}

/** Stores a scanner report (POST /api/v1/security-scans) and mirrors its findings. */
export async function recordScan(report: any) {
  if (!report || typeof report !== 'object' || !report.project || !Array.isArray(report.findings)) {
    throw new SecurityError(400, 'report needs project and findings');
  }
  const key = await nextKey('SCAN', 'security_scan_key_seq');
  const result = ['passed', 'failed', 'error'].includes(report.result) ? report.result : 'error';
  const { rows } = await query(
    `INSERT INTO security_scans (key, project, branch, commit_ref, trigger, result, summary, report)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, key, project, result, created_at`,
    [key, String(report.project).slice(0, 120), report.branch ?? null, report.commit ?? null, report.trigger ?? null,
     result, JSON.stringify(report.summary ?? {}), JSON.stringify(report)],
  );
  // Category checks that ran cleanly close their own findings; unavailable checks change nothing.
  const cleanCategories = new Set<string>(
    (report.tools ?? []).filter((t: any) => t.status === 'ok').map((t: any) => String(t.name)));
  const seen = new Set<string>();
  for (const f of report.findings) {
    seen.add(String(f.fingerprint));
    const key2 = await nextKey('VULN', 'vulnerability_key_seq');
    await query(
      `INSERT INTO vulnerabilities (key, fingerprint, project, source, category, cve, advisory_id, severity, status, title, detail, url)
       VALUES ($1,$2,$3,'scan',$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (project, source, fingerprint) DO UPDATE
          SET last_seen = now(), severity = EXCLUDED.severity, title = EXCLUDED.title, detail = EXCLUDED.detail,
              status = CASE WHEN vulnerabilities.status = 'fixed' THEN EXCLUDED.status ELSE vulnerabilities.status END,
              fixed_at = CASE WHEN vulnerabilities.status = 'fixed' THEN NULL ELSE vulnerabilities.fixed_at END`,
      [key2, f.fingerprint, report.project, f.category ?? 'other', String(f.cve ?? '').split(',')[0] || null, f.rule ?? null,
       f.severity ?? 'medium', f.status === 'accepted' ? 'accepted' : 'open', String(f.title ?? f.rule).slice(0, 300),
       f.detail ?? null, f.url ?? null],
    );
  }
  await query(
    `UPDATE vulnerabilities SET status = 'fixed', fixed_at = now(), last_seen = now()
      WHERE project = $1 AND source = 'scan' AND status <> 'fixed'
        AND category = ANY($2::text[]) AND NOT (fingerprint = ANY($3::text[]))`,
    [report.project, [...cleanCategories].flatMap((t) => (t === 'dependencies' || t === 'cve' ? ['dependencies'] : [t])), [...seen]],
  );
  return rows[0];
}

export async function listVulnerabilities(f: { status?: string; project?: string; severity?: string; source?: string; limit?: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.status) { params.push(f.status.split(',')); where.push(`status = ANY($${params.length}::text[])`); }
  if (f.project) { params.push(f.project); where.push(`project = $${params.length}`); }
  if (f.source) { params.push(f.source); where.push(`source = $${params.length}`); }
  if (f.severity) { params.push(f.severity); where.push(`severity = $${params.length}`); }
  params.push(Math.min(f.limit ?? 200, 1000));
  const { rows } = await query(
    `SELECT * FROM vulnerabilities ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC,
               first_seen DESC LIMIT $${params.length}`, params);
  return rows;
}

export async function listScans(limit = 50) {
  const { rows } = await query(
    `SELECT id, key, project, branch, commit_ref, trigger, result, summary, created_at
       FROM security_scans ORDER BY created_at DESC LIMIT $1`, [Math.min(limit, 500)]);
  return rows;
}

/** Agents may accept a risk (with a note); only the scanner / CVE Watch mark a finding fixed. */
export async function setVulnerabilityStatus(idOrKey: string, status: string, note: string, by: string) {
  if (status === 'fixed') throw new SecurityError(403, 'only the scanner or CVE Watch can mark a vulnerability fixed');
  if (!['open', 'accepted'].includes(status)) throw new SecurityError(400, 'status must be open or accepted');
  if (status === 'accepted' && !note.trim()) throw new SecurityError(400, 'accepting a risk needs a note');
  const { rows } = await query(
    `UPDATE vulnerabilities SET status = $2, history = history || $3::jsonb
      WHERE key = $1 OR id::text = $1 RETURNING *`,
    [idOrKey, status, JSON.stringify([{ at: new Date().toISOString(), by, action: status, note }])]);
  if (!rows[0]) throw new SecurityError(404, 'vulnerability not found');
  return rows[0];
}

export interface WatchOptions { http?: Http; sources?: Source[]; trigger?: 'timer' | 'manual' | 'startup' }

/** One CVE Watch pass over every source. Safe to run from several processes (advisory lock). */
export async function runCveWatch(opts: WatchOptions = {}) {
  const http = opts.http ?? (fetch as unknown as Http);
  const sources = opts.sources ?? watchSources();
  return withTransaction(async (db) => {
    const lock = await db.query<{ ok: boolean }>(`SELECT pg_try_advisory_xact_lock(hashtext('cve-watch')) AS ok`);
    if (!lock.rows[0]!.ok) return { skipped: 'another CVE Watch run holds the lock' as const };
    const run = (await db.query<{ id: string }>(
      `INSERT INTO cve_watch_runs (trigger) VALUES ($1) RETURNING id`, [opts.trigger ?? 'manual'])).rows[0]!;

    let kev = new Set<string>();
    let kevError: string | null = null;
    try {
      const res = await http(KEV_URL, { signal: AbortSignal.timeout(30000) } as RequestInit);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      kev = parseKev(await res.json());
    } catch (e) { kevError = String((e as Error).message); } // no KEV: severities stay as scored

    const projects: Record<string, unknown>[] = [];
    let added = 0; let resolved = 0; let failed = 0;
    for (const src of sources) {
      try {
        const components = lockfileComponents(await loadLockfile(src.location, http));
        const found = await osvLookup(src.project, components, kev, { http });
        const open = await db.query<{ fingerprint: string }>(
          `SELECT fingerprint FROM vulnerabilities WHERE project = $1 AND source = 'cve-watch' AND status <> 'fixed'`, [src.project]);
        const plan = planRun(open.rows.map((r) => r.fingerprint), found);
        for (const f of found) await upsert(db, f);
        if (plan.resolved.length) {
          await db.query(
            `UPDATE vulnerabilities SET status = 'fixed', fixed_at = now(),
                    history = history || $3::jsonb
              WHERE project = $1 AND source = 'cve-watch' AND fingerprint = ANY($2::text[])`,
            [src.project, plan.resolved, JSON.stringify([{ at: new Date().toISOString(), by: 'cve-watch', action: 'fixed', note: 'no longer reported by OSV for the installed versions' }])]);
        }
        added += plan.added.length; resolved += plan.resolved.length;
        projects.push({ project: src.project, components: components.length, found: found.length,
          added: plan.added.map((f) => ({ cve: f.cve, package: f.package, severity: f.severity, verdict: f.verdict })), resolved: plan.resolved.length });
      } catch (e) {
        failed += 1; // this project's open findings are left untouched: an outage is not a fix
        projects.push({ project: src.project, error: String((e as Error).message).slice(0, 300) });
      }
    }
    const status = failed === 0 ? 'ok' : failed === sources.length ? 'failed' : 'partial';
    await db.query(
      `UPDATE cve_watch_runs SET finished_at = now(), status = $2, projects = $3, added = $4, resolved = $5 WHERE id = $1`,
      [run.id, status, JSON.stringify(projects), added, resolved]);
    const alert = projects.flatMap((p: any) => (p.added ?? []).filter((a: any) => severityRank(a.severity) >= severityRank('high')));
    return { id: run.id, status, added, resolved, kevError, projects, alert };
  });
}

async function upsert(db: { query: (sql: string, p?: unknown[]) => Promise<any> }, f: CveFinding) {
  const seq = (await db.query(`SELECT nextval('vulnerability_key_seq')::text AS n`)).rows[0].n as string;
  await db.query(
    `INSERT INTO vulnerabilities (key, fingerprint, project, source, category, cve, advisory_id, package, version, severity, verdict, exploited, status, title, detail, fixed_in, url, history)
     VALUES ($1,$2,$3,'cve-watch','dependencies',$4,$5,$6,$7,$8,$9,$10,'open',$11,$12,$13,$14,$15::jsonb)
     ON CONFLICT (project, source, fingerprint) DO UPDATE
        SET last_seen = now(), severity = EXCLUDED.severity, verdict = EXCLUDED.verdict, exploited = EXCLUDED.exploited,
            fixed_in = EXCLUDED.fixed_in,
            status = CASE WHEN vulnerabilities.status = 'fixed' THEN 'open' ELSE vulnerabilities.status END,
            fixed_at = NULL`,
    [`VULN-${seq.padStart(5, '0')}`, f.fingerprint, f.project, f.cve, f.advisory_id, f.package, f.version, f.severity, f.verdict, f.exploited,
     f.title.slice(0, 300), `${f.package} ${f.version}${f.dev ? ' (dev)' : ''} — ${f.fixed_in.length ? `fixed in ${f.fixed_in.join(', ')}` : 'no fix published'}`,
     f.fixed_in, f.url, JSON.stringify([{ at: new Date().toISOString(), by: 'cve-watch', action: 'opened', verdict: f.verdict }])]);
}

export async function watchStatus() {
  const runs = (await query(`SELECT * FROM cve_watch_runs ORDER BY started_at DESC LIMIT 10`)).rows;
  const open = (await query(
    `SELECT severity, count(*)::int AS n FROM vulnerabilities WHERE status = 'open' GROUP BY severity`)).rows;
  return { enabled: process.env.CVE_WATCH_ENABLED !== 'false', interval_minutes: watchIntervalMinutes(), sources: watchSources(), runs, open };
}

export function watchIntervalMinutes(): number {
  return Math.max(5, Number(process.env.CVE_WATCH_INTERVAL_MINUTES) || 360);
}

let timer: NodeJS.Timeout | undefined;
/** Starts the agent: first pass shortly after boot, then every CVE_WATCH_INTERVAL_MINUTES. */
export function startCveWatch(log: (m: string) => void = console.log) {
  if (process.env.CVE_WATCH_ENABLED === 'false' || timer) return;
  const pass = (trigger: 'timer' | 'startup') => runCveWatch({ trigger }).then(
    (r) => log(`[cve-watch] ${'skipped' in r ? r.skipped : `${r.status}: ${r.added} new, ${r.resolved} resolved${r.kevError ? ` (KEV unavailable: ${r.kevError})` : ''}`}`),
    (e) => log(`[cve-watch] run failed: ${(e as Error).message}`));
  setTimeout(() => void pass('startup'), Number(process.env.CVE_WATCH_STARTUP_DELAY_MS) || 30000).unref();
  timer = setInterval(() => void pass('timer'), watchIntervalMinutes() * 60000);
  timer.unref();
}
