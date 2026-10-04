/**
 * Defect Manager core — pure rules, no I/O.
 *
 * The engine records every failed test result as a defect, groups the new ones
 * into a defect report, and hands that report to the Sand Bench Product Manager
 * through the Defect API. Fixes come back as a rerun request; the rerun's
 * results decide whether each defect is verified or reopened. Only the engine
 * may verify: agents can say "fixed", never "verified".
 */
import { createHash } from 'node:crypto';

export const DEFECT_STATUSES = [
  'open', 'acknowledged', 'in_fix', 'fixed', 'verified', 'reopened', 'wont_fix',
] as const;
export type DefectStatus = (typeof DEFECT_STATUSES)[number];

export const REPORT_STATUSES = [
  'open', 'with_pm', 'fixing', 'rerunning', 'verified', 'reopened',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Statuses the engine sets itself after a rerun; agents may not set them. */
export const ENGINE_ONLY_STATUSES: ReadonlySet<DefectStatus> = new Set(['verified', 'reopened']);

/** Defect statuses that count as "done from the fixer's side" before a rerun. */
export const RERUN_READY: ReadonlySet<DefectStatus> = new Set(['fixed', 'wont_fix', 'verified']);

const DEFECT_TRANSITIONS: Record<DefectStatus, DefectStatus[]> = {
  open: ['acknowledged', 'in_fix', 'fixed', 'wont_fix'],
  acknowledged: ['in_fix', 'fixed', 'wont_fix'],
  in_fix: ['fixed', 'acknowledged', 'wont_fix'],
  fixed: ['in_fix', 'verified', 'reopened'],
  reopened: ['acknowledged', 'in_fix', 'fixed', 'wont_fix'],
  verified: ['reopened'],
  wont_fix: ['acknowledged', 'in_fix'],
};

const REPORT_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  open: ['with_pm'],
  with_pm: ['fixing', 'rerunning'],
  fixing: ['rerunning', 'with_pm'],
  rerunning: ['verified', 'reopened'],
  reopened: ['with_pm'],
  verified: ['reopened'],
};

export function isDefectStatus(value: unknown): value is DefectStatus {
  return typeof value === 'string' && (DEFECT_STATUSES as readonly string[]).includes(value);
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === 'string' && (REPORT_STATUSES as readonly string[]).includes(value);
}

export function canMoveDefect(from: DefectStatus, to: DefectStatus): boolean {
  return from === to || DEFECT_TRANSITIONS[from].includes(to);
}

export function canMoveReport(from: ReportStatus, to: ReportStatus): boolean {
  return from === to || REPORT_TRANSITIONS[from].includes(to);
}

/** Result statuses that open a defect. Skipped/cancelled/passed never do. */
const FAILING = new Set(['failed', 'error', 'timed_out', 'blocked']);

export function isFailingStatus(status: unknown): boolean {
  return FAILING.has(String(status || '').toLowerCase());
}

/**
 * Strip the parts of an error message that change run to run (ids, numbers,
 * timestamps, ports, paths with hashes) so the same bug fingerprints the same.
 */
export function normalizeMessage(message: unknown): string {
  return String(message ?? '')
    .toLowerCase()
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, '<uuid>')
    .replace(/\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(?:\.\d+)?z?/g, '<ts>')
    .replace(/\b[0-9a-f]{16,}\b/g, '<hex>')
    .replace(/\d+(?:\.\d+)?/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/** One defect per (test case, normalized first line of the failure). */
export function fingerprint(caseRef: string, message: unknown): string {
  const firstLine = normalizeMessage(String(message ?? '').split('\n').find((l) => l.trim()) ?? '');
  return createHash('sha1').update(`${caseRef}\u0000${firstLine}`).digest('hex').slice(0, 16);
}

export type ResultRow = {
  execution_result_id?: string | null;
  test_case_id?: string | null;
  case_key?: string | null;
  case_name?: string | null;
  test_type?: string | null;
  status: string;
  message?: string | null;
  classification?: string | null;
};

export type DefectCandidate = {
  fingerprint: string;
  execution_result_id: string | null;
  test_case_id: string | null;
  case_key: string;
  case_name: string;
  test_type: string | null;
  category: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
};

const ENV_CATEGORIES = new Set(['target_unreachable', 'environment_problem', 'network_failure', 'infrastructure_failure']);

export function severityFor(status: string, category: string): DefectCandidate['severity'] {
  if (ENV_CATEGORIES.has(category) || status === 'blocked') return 'low';
  if (category === 'application_defect' || category === 'assertion_failure' || category === 'authentication_problem') return 'high';
  return 'medium';
}

/** Failing results → one candidate per fingerprint (first occurrence wins). */
export function candidatesFrom(results: ResultRow[]): DefectCandidate[] {
  const out = new Map<string, DefectCandidate>();
  for (const r of results) {
    const status = String(r.status || '').toLowerCase();
    if (!isFailingStatus(status)) continue;
    const caseKey = String(r.case_key || r.test_case_id || r.case_name || 'unknown-case');
    const message = String(r.message || `Test ${status} without a message`).slice(0, 4000);
    const fp = fingerprint(caseKey, message);
    if (out.has(fp)) continue;
    const category = String(r.classification || (status === 'blocked' ? 'environment_problem' : 'unknown'));
    out.set(fp, {
      fingerprint: fp,
      execution_result_id: r.execution_result_id ?? null,
      test_case_id: r.test_case_id ?? null,
      case_key: caseKey,
      case_name: String(r.case_name || caseKey),
      test_type: r.test_type ?? null,
      category,
      severity: severityFor(status, category),
      message,
    });
  }
  return [...out.values()];
}

export type ExistingDefect = { id: string; fingerprint: string; status: DefectStatus };

export type IngestPlan = {
  create: DefectCandidate[];
  /** Verified before, failing again: reopen and move into the new report. */
  regress: { defect: ExistingDefect; candidate: DefectCandidate }[];
  /** Still-open defects seen again: bump occurrences only. */
  recur: { defect: ExistingDefect; candidate: DefectCandidate }[];
};

/**
 * Decide what a failing run does to the defect register. `existing` holds the
 * latest defect per fingerprint.
 */
export function planIngest(candidates: DefectCandidate[], existing: ExistingDefect[]): IngestPlan {
  const byFp = new Map(existing.map((d) => [d.fingerprint, d]));
  const plan: IngestPlan = { create: [], regress: [], recur: [] };
  for (const c of candidates) {
    const d = byFp.get(c.fingerprint);
    if (!d) plan.create.push(c);
    else if (d.status === 'verified') plan.regress.push({ defect: d, candidate: c });
    else plan.recur.push({ defect: d, candidate: c });
  }
  return plan;
}

export type RerunDefect = {
  id: string;
  status: DefectStatus;
  test_case_id: string | null;
  case_key: string;
};

export type RerunOutcome = {
  verdicts: { id: string; to: DefectStatus; reason: string }[];
  report: ReportStatus;
};

/**
 * A rerun decides each defect by its test case's latest result in that run.
 * Passed → verified. Failed → reopened. Not run → reopened (it was not proven).
 * wont_fix stays as is and does not block verification.
 */
export function evaluateRerun(defects: RerunDefect[], results: ResultRow[]): RerunOutcome {
  const latest = new Map<string, string>();
  for (const r of results) {
    const status = String(r.status || '').toLowerCase();
    if (r.test_case_id) latest.set(`id:${r.test_case_id}`, status);
    if (r.case_key) latest.set(`key:${r.case_key}`, status);
  }
  const verdicts: RerunOutcome['verdicts'] = [];
  let allGood = true;
  for (const d of defects) {
    if (d.status === 'wont_fix' || d.status === 'verified') continue;
    const status = (d.test_case_id && latest.get(`id:${d.test_case_id}`)) || latest.get(`key:${d.case_key}`);
    if (status === 'passed') {
      verdicts.push({ id: d.id, to: 'verified', reason: 'rerun passed' });
    } else {
      allGood = false;
      verdicts.push({ id: d.id, to: 'reopened', reason: status ? `rerun ${status}` : 'case not run in rerun' });
    }
  }
  return { verdicts, report: allGood ? 'verified' : 'reopened' };
}

/** Why a report cannot be sent for rerun yet (empty list = ready). */
export function rerunBlockers(defects: { key: string; status: DefectStatus }[]): string[] {
  return defects.filter((d) => !RERUN_READY.has(d.status)).map((d) => `${d.key} is ${d.status}`);
}

export function summarize(defects: { status: DefectStatus; severity?: string }[]) {
  const by: Record<string, number> = {};
  for (const d of defects) by[d.status] = (by[d.status] || 0) + 1;
  return {
    total: defects.length,
    high: defects.filter((d) => d.severity === 'high').length,
    by_status: by,
  };
}

/** DR-20260926-4f1a style keys; the random tail keeps same-second reports unique. */
export function reportKey(now: Date, rand: string): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `DR-${day}-${rand.slice(0, 6)}`;
}
