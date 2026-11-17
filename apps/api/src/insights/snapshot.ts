/**
 * Quality Insights — the facts.
 *
 * One snapshot per application: what the catalogue holds, how each environment's
 * runs went inside the window, which build they tested, how failures break down
 * and how much each case actually verifies. The analyst (Claude, an external
 * agent, or the built-in rules) only ever interprets a snapshot — every number
 * shown on the Quality Insights screen comes from here, so a stored version stays
 * readable after run retention has deleted the runs it was computed from.
 *
 * loadSnapshot() reads the database; buildSnapshot() is the pure aggregation.
 */
import { query } from '../db/client.js';

const FAILED = new Set(['failed', 'error', 'timed_out']);
const TERMINAL_RUN = new Set(['passed', 'failed', 'error', 'timed_out', 'cancelled', 'skipped', 'blocked']);
const AUTOMATED_TRIGGER = /^(schedule|cron|ci|api|deploy|after_|before_|git-|agent|pipeline|webhook)/i;
/** Most production-like first: the environment whose results speak for the application. */
const ENV_RANK = ['production', 'pre_prod', 'staging', 'uat', 'sit', 'qa', 'integration', 'development', 'kubernetes', 'docker', 'aws', 'azure', 'gcp', 'remote', 'localhost'];
const LIST = 15;
export const MAX_RESULTS = 200_000;

export interface RawCase {
  id: string; key: string; name: string; test_type: string; execution_method: string | null;
  severity: string | null; priority: string | null; automation_status: string; lifecycle: string;
  steps: unknown; assertions: unknown; validation_rules: unknown; script: string | null;
  has_description: boolean; has_expected: boolean;
}
export interface RawExecution {
  id: string; status: string; trigger_source: string | null; environment_id: string | null;
  created_at: string; build: unknown;
}
export interface RawResult {
  test_case_id: string; execution_id: string; status: string; classification: string | null;
  duration_ms: number | null; message: string | null; created_at: string;
}
export interface RawEnvironment {
  id: string; key: string; name: string; env_type: string; status: string; base_url: string | null;
  deployment: unknown; listed: boolean;
}
export interface RawBuild {
  build_id: string; commit_sha: string | null; branch: string | null; reported_at: string;
  total: number; passed: number; failed: number;
}
export interface SnapshotInput {
  now: string;
  timeZone: string;
  windowDays: number;
  retentionDays: number | null;
  application: { id: string; key: string; name: string };
  cases: RawCase[];
  executions: RawExecution[];
  results: RawResult[];
  resultsTruncated: boolean;
  environments: RawEnvironment[];
  builds: RawBuild[];
  schedules: { total: number; enabled: number };
  suites: number;
  evidence: { verdicts: number; with_evidence: number };
}

export interface BuildRef { commit: string; ref: string | null; version: string | null; deployed_at: string | null }
export interface Tally { passed: number; failed: number; other: number }
export interface CaseRow {
  id: string; key: string; name: string; test_type: string; method: string | null; severity: string | null;
  environment: string;
  runs: number; failures: number; passes: number; flips: number; last_status: string; last_at: string;
  classification: string | null; message: string | null;
}
export interface EnvironmentFacts {
  id: string; key: string; name: string; env_type: string; status: string; base_url: string | null;
  deployed_build: BuildRef | null;
  runs: number; runs_by_status: Record<string, number>; runs_by_trigger: Record<string, number>;
  results: number; passed: number; failed: number; other: number; pass_rate: number | null;
  cases_executed: number; coverage_pct: number;
  latest: { passing: number; failing: number; other: number; never_run: number };
  flaky: number; regressed: number; always_failing: number; consistently_passing: number;
  first_run_at: string | null; last_run_at: string | null;
  avg_duration_ms: number | null; p95_duration_ms: number | null;
  days_with_runs: number;
  daily: Array<{ day: string; runs: number } & Tally>;
  failure_classes: Array<{ classification: string; count: number }>;
  builds: Array<{ commit: string | null; ref: string | null; version: string | null; inferred: boolean; runs: number; first_at: string; last_at: string } & Tally>;
  traceable_pct: number | null;
  top_failing: CaseRow[];
}
export type Snapshot = ReturnType<typeof buildSnapshot>;

const pct = (n: number, d: number): number => (d ? Math.round((n / d) * 1000) / 10 : 0);
const rate = (passed: number, failed: number): number | null => (passed + failed ? pct(passed, passed + failed) : null);
const bump = (o: Record<string, number>, k: string, n = 1) => { o[k] = (o[k] || 0) + n; };

/** Calendar day (YYYY-MM-DD) of a timestamp in the engine's time zone — the same one schedules fire in. */
function dayBucket(timeZone: string): (iso: string) => string {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return (iso) => iso.slice(0, 10);
  }
  const seen = new Map<string, string>();
  return (iso) => {
    const minute = iso.slice(0, 16);
    return seen.get(minute) || seen.set(minute, fmt.format(new Date(iso))).get(minute)!;
  };
}
const tallyOf = (status: string): keyof Tally => (status === 'passed' ? 'passed' : FAILED.has(status) ? 'failed' : 'other');
const sorted = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

function asBuild(raw: unknown): BuildRef | null {
  if (typeof raw === 'string' && raw.trim()) return { commit: raw.trim(), ref: null, version: null, deployed_at: null };
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const commit = [b.commit, b.commit_sha, b.sha, b.hash].find((v) => typeof v === 'string' && v.trim());
  if (typeof commit !== 'string') return null;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return { commit: commit.trim(), ref: str(b.ref) ?? str(b.branch), version: str(b.version), deployed_at: str(b.deployed_at) };
}

function count(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') return Object.keys(v).length;
  return v == null || v === '' ? 0 : 1;
}

/**
 * How much a case verifies, read from its definition. A step contributes every
 * expectation it states (status code, JSON paths, body/heading text, assert_*
 * and wait_for actions); performance cases contribute their SLA thresholds.
 * Cases whose assertions live in code — a script (sit/…) or a compound runner
 * action such as sandbench_upload — cannot be read from the catalogue and are
 * reported as such rather than as zero.
 */
const PRIMITIVE_ACTIONS = new Set(['request', 'navigate', 'click', 'type', 'wait_for', 'wait_for_hidden']);
export function caseDepth(c: Pick<RawCase, 'steps' | 'assertions' | 'validation_rules' | 'script'>): { kind: 'inspectable' | 'script'; checks: number; steps: number } {
  const steps = Array.isArray(c.steps) ? (c.steps as Array<Record<string, unknown>>) : [];
  let checks = Array.isArray(c.assertions) ? c.assertions.length : 0;
  let inCode = typeof c.script === 'string' && c.script.trim() !== '';
  for (const s of steps) {
    if (!s || typeof s !== 'object') continue;
    if (s.expected_status != null) checks += 1;
    for (const k of ['expect_json', 'expect_headers', 'expected_body_contains', 'expected_body_not_contains']) checks += count(s[k]);
    const action = String(s.action || '');
    if (action.startsWith('assert_') || action === 'wait_for' || action === 'wait_for_hidden') checks += 1;
    else if (action && !PRIMITIVE_ACTIONS.has(action)) inCode = true;
  }
  const rules = c.validation_rules && typeof c.validation_rules === 'object' ? (c.validation_rules as Record<string, unknown>) : {};
  checks += count(rules.sla);
  if (!checks && inCode) return { kind: 'script', checks: 0, steps: steps.length };
  return { kind: 'inspectable', checks, steps: steps.length };
}

/** Failure messages differ by ids, ports and timings; the signature is what they have in common. */
export function failureSignature(message: string | null): string {
  const first = String(message || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '(no message)';
  return first
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\d{3,}/g, '#')
    .slice(0, 140);
}

export function buildSnapshot(input: SnapshotInput) {
  const { cases, executions, results, environments } = input;
  const day = dayBucket(input.timeZone);
  const active =cases.filter((c) => c.lifecycle !== 'deprecated' && c.lifecycle !== 'archived');
  const activeIds = new Set(active.map((c) => c.id));
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const execById = new Map(executions.map((e) => [e.id, e]));
  const envById = new Map(environments.map((e) => [e.id, e]));

  // ---- Catalogue -----------------------------------------------------------
  const by = (f: (c: RawCase) => string) => {
    const o: Record<string, number> = {};
    for (const c of active) bump(o, f(c) || 'unspecified');
    return sorted(o).map(([name, total]) => ({ name, total }));
  };
  const depthBuckets: Record<string, number> = { 'Defined in code': 0, 'No checks': 0, '1 check': 0, '2–3 checks': 0, '4–6 checks': 0, '7+ checks': 0 };
  const depthOf = new Map<string, ReturnType<typeof caseDepth>>();
  let inspectable = 0, deep = 0, totalChecks = 0;
  for (const c of active) {
    const d = caseDepth(c);
    depthOf.set(c.id, d);
    if (d.kind === 'script') { bump(depthBuckets, 'Defined in code'); continue; }
    inspectable++;
    totalChecks += d.checks;
    if (d.checks >= 2) deep++;
    bump(depthBuckets, d.checks === 0 ? 'No checks' : d.checks === 1 ? '1 check' : d.checks <= 3 ? '2–3 checks' : d.checks <= 6 ? '4–6 checks' : '7+ checks');
  }
  const sevRank = (s: string | null) => ['critical', 'high', 'medium', 'low', 'trivial'].indexOf(s || 'medium');
  const shallow = active
    .filter((c) => { const d = depthOf.get(c.id)!; return d.kind === 'inspectable' && d.checks <= 1; })
    .sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || a.key.localeCompare(b.key));

  // ---- Runs, per environment ----------------------------------------------
  type Series = { caseId: string; envId: string; statuses: Array<{ status: string; at: string; classification: string | null; message: string | null }> };
  const series = new Map<string, Series>();
  const envResults = new Map<string, RawResult[]>();
  const ordered = results.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const r of ordered) {
    const envId = execById.get(r.execution_id)?.environment_id;
    if (!envId || !envById.has(envId)) continue;
    (envResults.get(envId) || envResults.set(envId, []).get(envId)!).push(r);
    if (!activeIds.has(r.test_case_id)) continue;
    const k = envId + ':' + r.test_case_id;
    const s = series.get(k) || series.set(k, { caseId: r.test_case_id, envId, statuses: [] }).get(k)!;
    s.statuses.push({ status: r.status, at: r.created_at, classification: r.classification, message: r.message });
  }

  const caseRow = (s: Series): CaseRow => {
    const c = caseById.get(s.caseId)!;
    const verdicts = s.statuses.filter((x) => x.status === 'passed' || FAILED.has(x.status));
    let flips = 0;
    for (let i = 1; i < verdicts.length; i++) if ((verdicts[i]!.status === 'passed') !== (verdicts[i - 1]!.status === 'passed')) flips++;
    const last = s.statuses[s.statuses.length - 1]!;
    const lastFail = [...s.statuses].reverse().find((x) => x.status !== 'passed');
    return {
      id: c.id, key: c.key, name: c.name, test_type: c.test_type, method: c.execution_method, severity: c.severity,
      environment: envById.get(s.envId)!.key,
      runs: s.statuses.length,
      failures: verdicts.filter((x) => x.status !== 'passed').length,
      passes: verdicts.filter((x) => x.status === 'passed').length,
      flips, last_status: last.status, last_at: last.at,
      classification: lastFail?.classification ?? null,
      message: lastFail?.message ? failureSignature(lastFail.message) : null,
    };
  };
  const rowsByEnv = new Map<string, CaseRow[]>();
  for (const s of series.values()) (rowsByEnv.get(s.envId) || rowsByEnv.set(s.envId, []).get(s.envId)!).push(caseRow(s));

  const isFlaky = (r: CaseRow) => r.flips >= 2;
  const isRegressed = (r: CaseRow) => r.flips === 1 && FAILED.has(r.last_status);
  const isAlwaysFailing = (r: CaseRow) => r.passes === 0 && r.failures >= 2;
  const isSteady = (r: CaseRow) => r.failures === 0 && r.passes >= 3;
  const byFailures = (a: CaseRow, b: CaseRow) => b.failures - a.failures || b.last_at.localeCompare(a.last_at);

  const envFacts: EnvironmentFacts[] = [];
  for (const env of environments) {
    // An environment scoped to other applications is not one of this application's targets,
    // even if a stray run of one of its cases landed there.
    if (!env.listed) continue;
    const runs = executions.filter((e) => e.environment_id === env.id);
    const res = envResults.get(env.id) || [];
    if (!runs.length && !res.length && env.status !== 'active') continue;
    const deployed = asBuild(env.deployment);
    const runsByStatus: Record<string, number> = {}, runsByTrigger: Record<string, number> = {}, classes: Record<string, number> = {};
    for (const e of runs) { bump(runsByStatus, e.status); bump(runsByTrigger, e.trigger_source || 'manual'); }

    const tally: Tally = { passed: 0, failed: 0, other: 0 };
    const daily = new Map<string, { day: string; runs: number } & Tally>();
    const builds = new Map<string, EnvironmentFacts['builds'][number]>();
    const durations: number[] = [];
    let traceable = 0;
    const buildOf = (e: RawExecution) => {
      const stamped = asBuild(e.build);
      if (stamped) return { build: stamped, inferred: false };
      // Runs recorded before builds were stamped: the deployment has not changed since it was registered.
      if (deployed && deployed.deployed_at && e.created_at >= deployed.deployed_at) return { build: deployed, inferred: true };
      return { build: null, inferred: false };
    };
    const dayRow = (d: string) => daily.get(d) || daily.set(d, { day: d, runs: 0, passed: 0, failed: 0, other: 0 }).get(d)!;
    const buildRow = (e: RawExecution) => {
      const { build, inferred } = buildOf(e);
      const k = build?.commit || '';
      return builds.get(k) || builds.set(k, { commit: build?.commit ?? null, ref: build?.ref ?? null, version: build?.version ?? null, inferred, runs: 0, passed: 0, failed: 0, other: 0, first_at: e.created_at, last_at: e.created_at }).get(k)!;
    };
    for (const e of runs) {
      dayRow(day(e.created_at)).runs++;
      const b = buildRow(e);
      b.runs++;
      if (e.created_at < b.first_at) b.first_at = e.created_at;
      if (e.created_at > b.last_at) b.last_at = e.created_at;
    }
    for (const r of res) {
      const t = tallyOf(r.status);
      tally[t]++;
      dayRow(day(r.created_at))[t]++;
      const e = execById.get(r.execution_id)!;
      const b = buildRow(e);
      b[t]++;
      if (b.commit) traceable++;
      if (r.duration_ms != null) durations.push(r.duration_ms);
      if (r.status !== 'passed') bump(classes, r.classification || (FAILED.has(r.status) ? 'unclassified' : r.status));
    }
    durations.sort((a, b) => a - b);

    const rows = rowsByEnv.get(env.id) || [];
    const latest = { passing: 0, failing: 0, other: 0, never_run: 0 };
    for (const r of rows) latest[r.last_status === 'passed' ? 'passing' : FAILED.has(r.last_status) ? 'failing' : 'other']++;
    latest.never_run = Math.max(0, active.length - rows.length);

    envFacts.push({
      id: env.id, key: env.key, name: env.name, env_type: env.env_type, status: env.status, base_url: env.base_url,
      deployed_build: deployed,
      runs: runs.length, runs_by_status: runsByStatus, runs_by_trigger: runsByTrigger,
      results: res.length, ...tally, pass_rate: rate(tally.passed, tally.failed),
      cases_executed: rows.length, coverage_pct: pct(rows.length, active.length),
      latest,
      flaky: rows.filter(isFlaky).length, regressed: rows.filter(isRegressed).length,
      always_failing: rows.filter(isAlwaysFailing).length, consistently_passing: rows.filter(isSteady).length,
      first_run_at: runs.length ? runs.reduce((m, e) => (e.created_at < m ? e.created_at : m), runs[0]!.created_at) : null,
      last_run_at: runs.length ? runs.reduce((m, e) => (e.created_at > m ? e.created_at : m), runs[0]!.created_at) : null,
      avg_duration_ms: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      p95_duration_ms: durations.length ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]! : null,
      days_with_runs: [...daily.values()].filter((d) => d.runs).length,
      daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
      failure_classes: sorted(classes).map(([classification, n]) => ({ classification, count: n })),
      builds: [...builds.values()].sort((a, b) => b.last_at.localeCompare(a.last_at)),
      traceable_pct: res.length ? pct(traceable, res.length) : null,
      top_failing: rows.filter((r) => r.failures).sort(byFailures).slice(0, 8),
    });
  }
  const rank = (e: EnvironmentFacts) => { const i = ENV_RANK.indexOf(e.env_type); return i < 0 ? ENV_RANK.length : i; };
  envFacts.sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || rank(a) - rank(b) || b.results - a.results);
  const live = envFacts.filter((e) => e.status === 'active');
  const reference = live.filter((e) => e.results).sort((a, b) => rank(a) - rank(b) || b.results - a.results)[0] || live[0] || null;

  // ---- Application-wide views ----------------------------------------------
  const liveIds = new Set(live.map((e) => e.id));
  const liveRows = [...rowsByEnv.entries()].filter(([id]) => liveIds.has(id)).flatMap(([, rows]) => rows);
  const refRows = reference ? rowsByEnv.get(reference.id) || [] : [];
  const refStatus = new Map(refRows.map((r) => [r.id, r.last_status]));

  const trend = new Map<string, { day: string; runs: number } & Tally>();
  for (const e of envFacts) for (const d of e.daily) {
    const t = trend.get(d.day) || trend.set(d.day, { day: d.day, runs: 0, passed: 0, failed: 0, other: 0 }).get(d.day)!;
    t.runs += d.runs; t.passed += d.passed; t.failed += d.failed; t.other += d.other;
  }

  const coverageByType: Record<string, { type: string; total: number; passing: number; failing: number; other: number; never_run: number }> = {};
  for (const c of active) {
    const row = coverageByType[c.test_type] || (coverageByType[c.test_type] = { type: c.test_type, total: 0, passing: 0, failing: 0, other: 0, never_run: 0 });
    row.total++;
    const st = refStatus.get(c.id);
    row[!st ? 'never_run' : st === 'passed' ? 'passing' : FAILED.has(st) ? 'failing' : 'other']++;
  }

  const signatures = new Map<string, { signature: string; count: number; classes: Record<string, number>; cases: Set<string>; environments: Set<string> }>();
  for (const e of live) for (const r of envResults.get(e.id) || []) {
    if (r.status === 'passed') continue;
    const sig = failureSignature(r.message);
    const s = signatures.get(sig) || signatures.set(sig, { signature: sig, count: 0, classes: {}, cases: new Set(), environments: new Set() }).get(sig)!;
    s.count++;
    bump(s.classes, r.classification || 'unclassified');
    s.environments.add(e.key);
    const c = caseById.get(r.test_case_id);
    if (c) s.cases.add(c.key);
  }
  const failureClasses: Record<string, number> = {};
  for (const e of live) for (const f of e.failure_classes) bump(failureClasses, f.classification, f.count);

  // Same case, different verdict on two live environments.
  const latestByCase = new Map<string, Record<string, string>>();
  for (const r of liveRows) (latestByCase.get(r.id) || latestByCase.set(r.id, {}).get(r.id)!)[r.environment] = r.last_status;
  const divergent = [...latestByCase.entries()]
    .filter(([, st]) => { const v = Object.values(st); return v.includes('passed') && v.some((x) => FAILED.has(x)); })
    .map(([id, statuses]) => { const c = caseById.get(id)!; return { id, key: c.key, name: c.name, statuses }; });

  const durationsByCase = new Map<string, number[]>();
  for (const e of live) for (const r of envResults.get(e.id) || []) {
    if (r.duration_ms != null && activeIds.has(r.test_case_id)) (durationsByCase.get(r.test_case_id) || durationsByCase.set(r.test_case_id, []).get(r.test_case_id)!).push(r.duration_ms);
  }
  const slowest = [...durationsByCase.entries()]
    .map(([id, d]) => { const c = caseById.get(id)!; return { id, key: c.key, name: c.name, method: c.execution_method, runs: d.length, avg_ms: Math.round(d.reduce((a, b) => a + b, 0) / d.length), max_ms: Math.max(...d) }; })
    .sort((a, b) => b.avg_ms - a.avg_ms).slice(0, 10);

  const neverRun = active.filter((c) => !refStatus.has(c.id)).sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || a.key.localeCompare(b.key));
  const lite = (c: RawCase) => ({ id: c.id, key: c.key, name: c.name, test_type: c.test_type, method: c.execution_method, severity: c.severity });

  const triggers: Record<string, number> = {};
  for (const e of executions) bump(triggers, e.trigger_source || 'manual');
  const automatedRuns = executions.filter((e) => AUTOMATED_TRIGGER.test(e.trigger_source || '')).length;
  const last7 = new Date(new Date(input.now).getTime() - 7 * 86_400_000).toISOString();
  const daysActive7 = new Set(executions.filter((e) => e.created_at >= last7).map((e) => day(e.created_at))).size;
  const unfinished = executions.filter((e) => !TERMINAL_RUN.has(e.status)).length;

  const totals = live.reduce((t, e) => ({ runs: t.runs + e.runs, results: t.results + e.results, passed: t.passed + e.passed, failed: t.failed + e.failed, other: t.other + e.other }), { runs: 0, results: 0, passed: 0, failed: 0, other: 0 });
  const traceableResults = live.reduce((n, e) => n + Math.round(((e.traceable_pct ?? 0) / 100) * e.results), 0);

  // ---- Score: six transparent components, each 0–100 ------------------------
  const ref = reference;
  const executed = ref ? ref.cases_executed : 0;
  const components = [
    { key: 'reliability', label: 'Reliability', weight: 30, value: ref && executed ? pct(ref.latest.passing, executed) : 0, basis: ref ? `${ref.latest.passing} of ${executed} executed cases pass on ${ref.name}` : 'no runs recorded' },
    { key: 'coverage', label: 'Coverage', weight: 25, value: ref ? ref.coverage_pct : 0, basis: ref ? `${executed} of ${active.length} cases have run on ${ref.name}` : 'no runs recorded' },
    { key: 'stability', label: 'Stability', weight: 15, value: ref && executed ? pct(executed - ref.flaky, executed) : 0, basis: ref ? `${ref.flaky} flaky of ${executed} executed cases` : 'no runs recorded' },
    { key: 'cadence', label: 'Cadence', weight: 10, value: Math.round((daysActive7 / 7) * 70 + (executions.length ? (automatedRuns / executions.length) * 30 : 0)), basis: `runs on ${daysActive7} of the last 7 days; ${automatedRuns} of ${executions.length} runs started by automation` },
    { key: 'traceability', label: 'Traceability', weight: 10, value: pct(traceableResults, totals.results), basis: `${traceableResults} of ${totals.results} results tied to a build hash` },
    { key: 'depth', label: 'Test depth', weight: 10, value: pct(deep, inspectable), basis: `${deep} of ${inspectable} inspectable cases state two or more checks` },
  ];
  const score = Math.round(components.reduce((s, c) => s + c.value * c.weight, 0) / 100);

  return {
    schema: 1,
    generated_at: input.now,
    time_zone: input.timeZone,
    window_days: input.windowDays,
    retention_days: input.retentionDays,
    results_truncated: input.resultsTruncated,
    application: input.application,
    reference_environment: ref ? { key: ref.key, name: ref.name } : null,
    score: { value: score, grade: score >= 85 ? 'good' : score >= 70 ? 'watch' : score >= 50 ? 'at_risk' : 'critical', components },
    kpis: {
      score,
      pass_rate: ref ? ref.pass_rate : null,
      coverage_pct: ref ? ref.coverage_pct : 0,
      failing_cases: ref ? ref.latest.failing : 0,
      flaky_cases: ref ? ref.flaky : 0,
      never_run: ref ? ref.latest.never_run : active.length,
      runs: totals.runs,
      results: totals.results,
    },
    catalog: {
      total: cases.length, active: active.length, suites: input.suites,
      by_type: by((c) => c.test_type), by_method: by((c) => c.execution_method || ''), by_severity: by((c) => c.severity || ''),
      by_automation: by((c) => c.automation_status),
      with_description_pct: pct(active.filter((c) => c.has_description).length, active.length),
      with_expected_results_pct: pct(active.filter((c) => c.has_expected).length, active.length),
    },
    depth: {
      inspectable, script_defined: depthBuckets['Defined in code']!,
      avg_checks: inspectable ? Math.round((totalChecks / inspectable) * 10) / 10 : 0,
      buckets: Object.entries(depthBuckets).map(([label, n]) => ({ label, count: n })),
      shallow_total: shallow.length,
      shallow: shallow.slice(0, LIST).map((c) => ({ ...lite(c), checks: depthOf.get(c.id)!.checks, steps: depthOf.get(c.id)!.steps })),
    },
    totals: { ...totals, pass_rate: rate(totals.passed, totals.failed), unfinished_runs: unfinished },
    environments: envFacts,
    trend: [...trend.values()].sort((a, b) => a.day.localeCompare(b.day)),
    coverage_by_type: Object.values(coverageByType).sort((a, b) => b.total - a.total),
    failures: {
      classes: sorted(failureClasses).map(([classification, n]) => ({ classification, count: n })),
      signatures: [...signatures.values()].sort((a, b) => b.count - a.count).slice(0, 12).map((s) => ({
        signature: s.signature, count: s.count, classification: sorted(s.classes)[0]?.[0] ?? 'unclassified',
        cases: s.cases.size, sample_cases: [...s.cases].slice(0, 5), environments: [...s.environments],
      })),
    },
    cases: {
      top_failing: liveRows.filter((r) => r.failures).sort(byFailures).slice(0, LIST),
      flaky_total: liveRows.filter(isFlaky).length,
      flaky: liveRows.filter(isFlaky).sort((a, b) => b.flips - a.flips).slice(0, LIST),
      regressed_total: liveRows.filter(isRegressed).length,
      regressed: liveRows.filter(isRegressed).sort(byFailures).slice(0, LIST),
      always_failing_total: liveRows.filter(isAlwaysFailing).length,
      always_failing: liveRows.filter(isAlwaysFailing).sort(byFailures).slice(0, LIST),
      consistently_passing_total: liveRows.filter(isSteady).length,
      never_run_total: neverRun.length,
      never_run: neverRun.slice(0, LIST).map(lite),
      divergent_total: divergent.length,
      divergent: divergent.slice(0, LIST),
      slowest,
    },
    cadence: {
      days_with_runs: trend.size, days_with_runs_last_7: daysActive7,
      runs_by_trigger: sorted(triggers).map(([trigger, n]) => ({ trigger, runs: n })),
      automated_runs: automatedRuns, manual_runs: executions.length - automatedRuns,
      schedules: input.schedules,
    },
    evidence: { ...input.evidence, pct: pct(input.evidence.with_evidence, input.evidence.verdicts) },
    in_container_builds: input.builds,
  };
}

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));

export async function resolveApplication(ref: string): Promise<{ id: string; key: string; name: string } | null> {
  const { rows } = await query(`SELECT id, key, name FROM applications WHERE id::text = $1 OR key = $1`, [ref]);
  return (rows[0] as { id: string; key: string; name: string } | undefined) ?? null;
}

export async function loadSnapshot(application: { id: string; key: string; name: string }, windowDays: number): Promise<Snapshot> {
  const caseRows = await query(
    `SELECT id, key, name, test_type::text AS test_type, execution_method, severity::text AS severity,
            priority::text AS priority, automation_status::text AS automation_status, lifecycle::text AS lifecycle,
            steps, assertions, validation_rules, left(script, 200) AS script,
            COALESCE(length(description), 0) > 0 AS has_description,
            COALESCE(length(expected_results), 0) > 0 AS has_expected
     FROM test_cases WHERE application_id = $1 ORDER BY key`,
    [application.id]
  );
  const caseIds = caseRows.rows.map((c: any) => c.id);

  const [execRows, envRows, buildRows, scheduleRows, suiteRows, settingRows, now] = await Promise.all([
    query(
      `SELECT e.id, e.status::text AS status, e.trigger_source, e.environment_id, e.created_at,
              COALESCE(e.metadata->'build', e.metadata->'commit_sha', e.metadata->'commit') AS build
       FROM executions e
       WHERE e.created_at > now() - make_interval(days => $3)
         AND (e.metadata->>'application_key' = $1 OR e.test_case_ids && $2::uuid[])`,
      [application.key, caseIds, windowDays]
    ),
    query(
      `SELECT id, key, name, env_type::text AS env_type, status, base_url, config->'deployment' AS deployment,
              (NOT (config ? 'applications') OR config->'applications' ? $1) AS listed
       FROM environments`,
      [application.key]
    ),
    query(
      `SELECT build_id, max(commit_sha) AS commit_sha, max(branch) AS branch, max(reported_at) AS reported_at,
              count(*)::int AS total,
              count(*) FILTER (WHERE status = 'passed')::int AS passed,
              count(*) FILTER (WHERE status IN ('failed','error'))::int AS failed
       FROM build_test_results WHERE application_key = $1
       GROUP BY build_id ORDER BY max(reported_at) DESC LIMIT 10`,
      [application.key]
    ),
    query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE enabled)::int AS enabled FROM schedules WHERE application_id = $1`, [application.id]),
    query(`SELECT count(*)::int AS c FROM test_suites WHERE application_id = $1`, [application.id]),
    query(`SELECT run_retention_days FROM settings WHERE id = true`).catch(() => ({ rows: [] as any[] })),
    query(`SELECT now() AS now`),
  ]);
  const execIds = execRows.rows.map((e: any) => e.id);

  const [resultRows, evidenceRows] = await Promise.all([
    query(
      `SELECT test_case_id, execution_id, status::text AS status, classification::text AS classification,
              duration_ms, left(message, 400) AS message, created_at
       FROM execution_results
       WHERE execution_id = ANY($1::uuid[]) AND test_case_id = ANY($2::uuid[])
       ORDER BY created_at DESC LIMIT ${MAX_RESULTS + 1}`,
      [execIds, caseIds]
    ),
    query(
      `SELECT count(*)::int AS verdicts, count(ev.result_id)::int AS with_evidence
       FROM execution_results er
       LEFT JOIN (SELECT DISTINCT execution_result_id AS result_id FROM evidence) ev ON ev.result_id = er.id
       WHERE er.execution_id = ANY($1::uuid[]) AND er.test_case_id = ANY($2::uuid[]) AND er.status IN ('passed','failed')`,
      [execIds, caseIds]
    ),
  ]);

  return buildSnapshot({
    now: iso(now.rows[0]!.now),
    timeZone: process.env.SCHEDULER_TZ || 'UTC',
    windowDays,
    retentionDays: settingRows.rows[0]?.run_retention_days ?? null,
    application,
    cases: caseRows.rows as RawCase[],
    executions: execRows.rows.map((e: any) => ({ ...e, created_at: iso(e.created_at) })),
    results: resultRows.rows.slice(0, MAX_RESULTS).map((r: any) => ({ ...r, created_at: iso(r.created_at) })),
    resultsTruncated: resultRows.rows.length > MAX_RESULTS,
    environments: envRows.rows as RawEnvironment[],
    builds: buildRows.rows.map((b: any) => ({ ...b, reported_at: iso(b.reported_at) })),
    schedules: { total: scheduleRows.rows[0]?.total ?? 0, enabled: scheduleRows.rows[0]?.enabled ?? 0 },
    suites: suiteRows.rows[0]?.c ?? 0,
    evidence: { verdicts: evidenceRows.rows[0]?.verdicts ?? 0, with_evidence: evidenceRows.rows[0]?.with_evidence ?? 0 },
  });
}
