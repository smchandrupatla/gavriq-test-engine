/**
 * Security scans — pure rules (no database). A scanner such as Sand Bench's
 * scripts/security/scan.mjs posts one report per run; the engine keeps every scan
 * and a register of findings with a lifecycle across scans:
 *
 *   open      seen in the latest scan that covered its category, not accepted
 *   accepted  seen, and the project's baseline accepts it (reason recorded)
 *   fixed     not seen by a later scan whose check for that category ran cleanly
 *
 * A fixed finding that shows up again is reopened (open or accepted again) and the
 * reopen is counted, so regressions stay visible.
 */
import { createHash } from 'node:crypto';

export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const FINDING_STATUSES = ['open', 'accepted', 'fixed'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export const SCAN_RESULTS = ['passed', 'failed', 'error'] as const;
export type ScanResult = (typeof SCAN_RESULTS)[number];

export const MAX_FINDINGS = 5000;

export class SecurityScanError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export type ScanTool = { name: string; status: string; findings: number; detail: string; ms: number | null };

export type ScanFinding = {
  fingerprint: string;
  rule: string;
  category: string;
  severity: Severity;
  title: string;
  file: string;
  line: number;
  detail: string;
  status: 'new' | 'accepted';
  acceptedReason: string | null;
  reference: string | null;
  url: string | null;
};

export type NormalizedScan = {
  project: string;
  repository: string;
  branch: string;
  commit: string;
  dirty: boolean;
  trigger: string;
  failOn: Severity | 'none';
  result: ScanResult;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  tools: ScanTool[];
  blocking: string[];
  findings: ScanFinding[];
};

const text = (value: unknown, max: number, fallback = ''): string =>
  (typeof value === 'string' ? value : value == null ? fallback : String(value)).slice(0, max);

function iso(value: unknown, fallback: string): string {
  const date = new Date(typeof value === 'string' || typeof value === 'number' ? value : NaN);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);
}

export function severityRank(value: string): number {
  const rank = (SEVERITIES as readonly string[]).indexOf(value);
  return rank < 0 ? 0 : rank;
}

/** Validates and trims a posted report. Throws SecurityScanError(422) on bad input. */
export function normalizeReport(body: unknown, now = new Date()): NormalizedScan {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SecurityScanError(422, 'Report must be a JSON object');
  const b = body as Record<string, unknown>;
  const project = text(b.project, 120).trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(project)) throw new SecurityScanError(422, 'project is required (letters, digits, . _ -)');
  if (!Array.isArray(b.findings)) throw new SecurityScanError(422, 'findings must be an array');
  if (b.findings.length > MAX_FINDINGS) throw new SecurityScanError(413, `At most ${MAX_FINDINGS} findings per report`);
  const result = text(b.result, 20) as ScanResult;
  if (!(SCAN_RESULTS as readonly string[]).includes(result)) throw new SecurityScanError(422, 'result must be passed, failed or error');
  const nowIso = now.toISOString();
  const findings: ScanFinding[] = [];
  const seen = new Set<string>();
  for (const raw of b.findings as unknown[]) {
    if (!raw || typeof raw !== 'object') throw new SecurityScanError(422, 'each finding must be an object');
    const f = raw as Record<string, unknown>;
    const fingerprint = text(f.fingerprint, 64).trim();
    if (!/^[a-z0-9]{8,64}$/i.test(fingerprint)) throw new SecurityScanError(422, 'each finding needs a fingerprint');
    if (seen.has(fingerprint)) continue; // the same finding reported twice counts once
    seen.add(fingerprint);
    findings.push({
      fingerprint,
      rule: text(f.rule, 120, 'unknown'),
      category: text(f.category, 40, 'other').toLowerCase(),
      severity: isSeverity(f.severity) ? f.severity : 'medium',
      title: text(f.title, 300, 'Finding'),
      file: text(f.file, 500),
      line: Number.isInteger(f.line) && (f.line as number) >= 0 ? (f.line as number) : 0,
      detail: text(f.detail, 2000),
      status: f.status === 'accepted' ? 'accepted' : 'new',
      acceptedReason: f.status === 'accepted' ? text(f.acceptedReason, 1000) || null : null,
      reference: f.reference ? text(f.reference, 200) : null,
      url: typeof f.url === 'string' && /^https?:\/\//i.test(f.url) ? f.url.slice(0, 500) : null,
    });
  }
  const tools: ScanTool[] = Array.isArray(b.tools)
    ? (b.tools as unknown[]).slice(0, 50).map((t) => {
        const r = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
        return {
          name: text(r.name, 60, 'tool'),
          status: text(r.status, 30, 'ok'),
          findings: Number.isFinite(Number(r.findings)) ? Number(r.findings) : 0,
          detail: text(r.detail, 300),
          ms: Number.isFinite(Number(r.ms)) ? Number(r.ms) : null,
        };
      })
    : [];
  const failOn = b.failOn === 'none' ? 'none' : isSeverity(b.failOn) ? b.failOn : 'medium';
  return {
    project,
    repository: text(b.repository, 300),
    branch: text(b.branch, 200, 'unknown'),
    commit: text(b.commit, 64, 'unknown'),
    dirty: b.dirty === true,
    trigger: text(b.trigger, 30, 'manual'),
    failOn,
    result,
    startedAt: iso(b.startedAt, nowIso),
    finishedAt: iso(b.finishedAt, nowIso),
    durationMs: Number.isFinite(Number(b.durationMs)) ? Math.max(0, Math.round(Number(b.durationMs))) : 0,
    tools,
    blocking: Array.isArray(b.blocking) ? (b.blocking as unknown[]).map((x) => text(x, 64)).filter((x) => seen.has(x)) : [],
    findings,
  };
}

/** Same report posted twice (a retry) maps to the same key. */
export function ingestKey(scan: NormalizedScan): string {
  return createHash('sha256').update(`${scan.project}|${scan.commit}|${scan.trigger}|${scan.finishedAt}`).digest('hex').slice(0, 32);
}

export function scanKey(finishedAt: string, random: string): string {
  return `SS-${finishedAt.slice(0, 10).replace(/-/g, '')}-${random.slice(0, 6)}`;
}

/** Which tool covers which finding category. */
const TOOL_CATEGORIES: Record<string, string[]> = {
  dependencies: ['dependencies'],
  secrets: ['secrets'],
  gitleaks: ['secrets'],
  routes: ['routes'],
  code: ['code'],
  xss: ['xss'],
  config: ['config'],
};

/** Categories this scan checked cleanly: only their absent findings count as fixed. */
export function coveredCategories(tools: ScanTool[]): Set<string> {
  const covered = new Set<string>();
  for (const tool of tools) {
    if (tool.status !== 'ok') continue;
    for (const category of TOOL_CATEGORIES[tool.name] || []) covered.add(category);
  }
  return covered;
}

export type ExistingFinding = { fingerprint: string; category: string; status: FindingStatus };

export type FindingPlan = {
  upserts: Array<{ finding: ScanFinding; status: Exclude<FindingStatus, 'fixed'>; reopened: boolean; isNew: boolean }>;
  fixed: string[];
};

export function planFindings(existing: ExistingFinding[], scan: NormalizedScan): FindingPlan {
  const known = new Map(existing.map((row) => [row.fingerprint, row]));
  const reported = new Set(scan.findings.map((f) => f.fingerprint));
  const covered = coveredCategories(scan.tools);
  const upserts = scan.findings.map((finding) => {
    const before = known.get(finding.fingerprint);
    return {
      finding,
      status: (finding.status === 'accepted' ? 'accepted' : 'open') as 'open' | 'accepted',
      reopened: before?.status === 'fixed',
      isNew: !before,
    };
  });
  const fixed = existing
    .filter((row) => row.status !== 'fixed' && !reported.has(row.fingerprint) && covered.has(row.category))
    .map((row) => row.fingerprint);
  return { upserts, fixed };
}

export type FindingRow = { severity: string; status: string; category: string };

/** Counts for the overview cards: open by severity, accepted, fixed. */
export function registerSummary(rows: FindingRow[]) {
  const open = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  let openTotal = 0;
  let accepted = 0;
  let fixed = 0;
  const byCategory: Record<string, number> = {};
  for (const row of rows) {
    if (row.status === 'fixed') { fixed += 1; continue; }
    if (row.status === 'accepted') { accepted += 1; continue; }
    openTotal += 1;
    if (isSeverity(row.severity)) open[row.severity] += 1;
    byCategory[row.category] = (byCategory[row.category] || 0) + 1;
  }
  return { open, openTotal, accepted, fixed, byCategory };
}
