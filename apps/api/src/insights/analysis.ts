/**
 * Quality Insights — the review written over a snapshot.
 *
 * One shape, three authors: Claude (analyst.ts), an external agent that posts
 * its own review, and rulesAnalysis() below — the deterministic fallback used
 * when no AI credentials are configured, so "Refresh insights" always yields a
 * version. The schema is deliberately flat (strings, enums, arrays) so it can
 * be used as a structured-output format.
 */
import { z } from 'zod';
import type { EnvironmentFacts, Snapshot } from './snapshot.js';

const Verdict = z.enum(['good', 'watch', 'at_risk', 'critical']);

export const AnalysisSchema = z.object({
  headline: z.string().describe('One sentence: the state of quality for this application right now.'),
  verdict: Verdict,
  summary: z.array(z.string()).describe('Two to four short paragraphs for an engineering lead.'),
  changes_since_last: z.array(z.string()).describe('What moved since the previous review; empty for the first review.'),
  findings: z.array(z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    area: z.enum(['reliability', 'coverage', 'test_quality', 'cadence', 'environment', 'traceability', 'performance']),
    title: z.string(),
    detail: z.string(),
    evidence: z.array(z.string()).describe('Numbers and facts from the snapshot that support the finding.'),
    recommendation: z.string(),
    environment: z.string().nullable().describe('Environment key the finding is about, or null when application-wide.'),
    case_keys: z.array(z.string()),
  })),
  failure_themes: z.array(z.object({
    title: z.string(),
    nature: z.enum(['product_defect', 'test_defect', 'environment', 'infrastructure', 'test_data', 'unknown']),
    count: z.number().describe('Failed results attributed to this theme.'),
    detail: z.string(),
    case_keys: z.array(z.string()),
  })),
  environments: z.array(z.object({
    key: z.string(),
    verdict: Verdict,
    assessment: z.string(),
    actions: z.array(z.string()),
  })),
  test_quality: z.object({ assessment: z.string(), strengths: z.array(z.string()), weaknesses: z.array(z.string()) }),
  coverage: z.object({ assessment: z.string(), gaps: z.array(z.string()) }),
  suggestions: z.array(z.object({
    priority: z.enum(['now', 'next', 'later']),
    title: z.string(),
    detail: z.string(),
    impact: z.string(),
    effort: z.enum(['S', 'M', 'L']),
  })),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
type Finding = Analysis['findings'][number];
type Suggestion = Analysis['suggestions'][number];

export interface PreviousReview {
  version: number;
  created_at: string;
  kpis: Snapshot['kpis'];
  analysis: Pick<Analysis, 'headline' | 'verdict'> & { findings: string[]; suggestions: string[] };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const short = (commit: string) => commit.slice(0, 12);

const NATURE: Record<string, Analysis['failure_themes'][number]['nature']> = {
  script_problem: 'test_defect', test_data_problem: 'test_data', assertion_failure: 'product_defect', application_defect: 'product_defect',
  network_failure: 'environment', target_unreachable: 'environment', environment_problem: 'environment', authentication_problem: 'environment',
  infrastructure_failure: 'infrastructure', dependency_failure: 'infrastructure', deployment_problem: 'infrastructure',
  timeout: 'unknown', unknown: 'unknown', unclassified: 'unknown',
};

function envVerdict(e: EnvironmentFacts): Analysis['verdict'] {
  if (!e.results) return 'watch';
  const r = e.pass_rate ?? 0;
  return r >= 95 && e.coverage_pct >= 80 ? 'good' : r >= 85 ? 'watch' : r >= 60 ? 'at_risk' : 'critical';
}

/** Threshold-driven review: every statement is a direct reading of the snapshot. */
export function rulesAnalysis(s: Snapshot, previous: PreviousReview | null): Analysis {
  const ref = s.environments.find((e) => e.key === s.reference_environment?.key) || null;
  const live = s.environments.filter((e) => e.status === 'active');
  const findings: Finding[] = [];
  const suggestions: Suggestion[] = [];
  const add = (f: Omit<Finding, 'environment' | 'case_keys'> & Partial<Pick<Finding, 'environment' | 'case_keys'>>) => findings.push({ environment: null, case_keys: [], ...f });

  if (!s.totals.results) {
    add({ severity: 'high', area: 'cadence', title: 'No runs recorded in the window', detail: `Nothing has run for ${s.application.name} in the last ${s.window_days} days, so quality cannot be assessed.`, evidence: [`${s.catalog.active} active cases, 0 results`], recommendation: 'Run the catalogue against an environment, then refresh the insights.' });
  }
  if (ref) {
    const failShare = ref.cases_executed ? (ref.latest.failing / ref.cases_executed) * 100 : 0;
    if (ref.latest.failing) {
      add({
        severity: failShare >= 20 ? 'critical' : failShare >= 5 ? 'high' : 'medium', area: 'reliability', environment: ref.key,
        title: `${plural(ref.latest.failing, 'case')} failing on ${ref.name}`,
        detail: `The latest result of ${ref.latest.failing} of ${ref.cases_executed} executed cases is a failure on the reference environment.`,
        evidence: [`Pass rate ${ref.pass_rate ?? '—'}% over ${ref.results} results`, ...ref.top_failing.slice(0, 3).map((c) => `${c.key}: failed ${c.failures} of ${c.runs} runs`)],
        recommendation: 'Triage the most frequent failures first; separate product defects from broken tests before the next run.',
        case_keys: ref.top_failing.slice(0, 8).map((c) => c.key),
      });
    }
    if (ref.latest.never_run) {
      const share = (ref.latest.never_run / Math.max(1, s.catalog.active)) * 100;
      add({
        severity: share >= 40 ? 'high' : share >= 10 ? 'medium' : 'low', area: 'coverage', environment: ref.key,
        title: `${plural(ref.latest.never_run, 'case')} never run on ${ref.name}`,
        detail: `${ref.coverage_pct}% of the active catalogue has a result on the reference environment inside the window.`,
        evidence: s.coverage_by_type.filter((t) => t.never_run).slice(0, 4).map((t) => `${t.type}: ${t.never_run} of ${t.total} not run`),
        recommendation: 'Run the whole application on this environment, or schedule it, so every case has a current verdict.',
        case_keys: s.cases.never_run.slice(0, 8).map((c) => c.key),
      });
    }
  }
  if (s.cases.flaky_total) {
    add({ severity: s.cases.flaky_total >= 10 ? 'high' : 'medium', area: 'reliability', title: `${plural(s.cases.flaky_total, 'flaky case')}`, detail: 'These cases switched between pass and fail at least twice on the same environment, so a single result from them cannot be trusted.', evidence: s.cases.flaky.slice(0, 4).map((c) => `${c.key} on ${c.environment}: ${c.flips} flips in ${c.runs} runs`), recommendation: 'Stabilise or quarantine them: look for timing waits, shared data and order dependence.', case_keys: s.cases.flaky.slice(0, 8).map((c) => c.key) });
  }
  if (s.cases.regressed_total) {
    add({ severity: 'high', area: 'reliability', title: `${plural(s.cases.regressed_total, 'case')} regressed`, detail: 'These cases passed earlier in the window and now fail.', evidence: s.cases.regressed.slice(0, 4).map((c) => `${c.key} on ${c.environment}: ${c.message || c.last_status}`), recommendation: 'Compare the build that last passed with the one that fails now.', case_keys: s.cases.regressed.slice(0, 8).map((c) => c.key) });
  }
  if (s.cases.always_failing_total) {
    add({ severity: 'medium', area: 'test_quality', title: `${plural(s.cases.always_failing_total, 'case')} never passed`, detail: 'A case that fails every time is either reporting a long-standing defect or is itself broken; either way it carries no signal until resolved.', evidence: s.cases.always_failing.slice(0, 4).map((c) => `${c.key}: ${c.failures} failures, ${c.classification || 'unclassified'}`), recommendation: 'Fix the test or file the defect, and link it to the case.', case_keys: s.cases.always_failing.slice(0, 8).map((c) => c.key) });
  }
  if (s.cases.divergent_total) {
    add({ severity: 'medium', area: 'environment', title: `${plural(s.cases.divergent_total, 'case')} disagree between environments`, detail: 'The same case passes on one environment and fails on another: a difference in build, configuration or data between them.', evidence: s.cases.divergent.slice(0, 4).map((c) => `${c.key}: ${Object.entries(c.statuses).map(([k, v]) => `${k} ${v}`).join(', ')}`), recommendation: 'Diff the builds and configuration of the two environments for these cases.', case_keys: s.cases.divergent.slice(0, 8).map((c) => c.key) });
  }
  for (const e of live) {
    if (e.results && (e.traceable_pct ?? 0) < 50) {
      add({ severity: 'medium', area: 'traceability', environment: e.key, title: `Runs on ${e.name} are not tied to a build`, detail: `Only ${e.traceable_pct ?? 0}% of results on this environment carry a build hash, so a failure cannot be traced to the change that caused it.`, evidence: [`${e.results} results, deployed build ${e.deployed_build ? short(e.deployed_build.commit) : 'not registered'}`], recommendation: 'Register the deployed commit on the environment (config.deployment) or pass metadata.build when triggering runs.' });
    }
  }
  const testDefects = s.failures.classes.filter((c) => NATURE[c.classification] === 'test_defect').reduce((n, c) => n + c.count, 0);
  const allFailures = s.failures.classes.reduce((n, c) => n + c.count, 0);
  if (allFailures && testDefects / allFailures >= 0.25) {
    add({ severity: 'high', area: 'test_quality', title: 'A large share of failures are test problems, not product problems', detail: `${testDefects} of ${allFailures} non-passing results are classified as script problems.`, evidence: s.failures.signatures.filter((x) => NATURE[x.classification] === 'test_defect').slice(0, 3).map((x) => `${x.count}× ${x.signature}`), recommendation: 'Fix the runner or packaging problem behind these before reading the pass rate as a product signal.' });
  }
  if (s.depth.inspectable && s.depth.shallow_total / s.depth.inspectable >= 0.15) {
    add({ severity: 'medium', area: 'test_quality', title: `${plural(s.depth.shallow_total, 'case')} verify one thing or nothing`, detail: `${s.depth.shallow_total} of ${s.depth.inspectable} inspectable cases state at most one check — typically a status code only.`, evidence: s.depth.buckets.map((b) => `${b.label}: ${b.count}`), recommendation: 'Add assertions on the response body or page content to the highest-severity shallow cases.', case_keys: s.depth.shallow.slice(0, 8).map((c) => c.key) });
  }
  if (s.cadence.automated_runs === 0 && s.totals.runs) {
    add({ severity: 'medium', area: 'cadence', title: 'Every run was started by hand', detail: `${s.cadence.manual_runs} runs in the window, none from a schedule, pipeline or deploy hook; ${s.cadence.schedules.enabled} of ${s.cadence.schedules.total} schedules are enabled.`, evidence: s.cadence.runs_by_trigger.slice(0, 4).map((t) => `${t.trigger}: ${t.runs} runs`), recommendation: 'Enable a nightly schedule on the reference environment and an after-deploy smoke run.' });
  }
  if (s.evidence.verdicts && s.evidence.pct < 90) {
    add({ severity: 'low', area: 'test_quality', title: 'Some verdicts have no evidence', detail: `${s.evidence.pct}% of pass/fail results carry at least one evidence item.`, evidence: [`${s.evidence.with_evidence} of ${s.evidence.verdicts} verdicts`], recommendation: 'Keep the evidence gate enforced so every verdict can be audited.' });
  }

  const order = ['critical', 'high', 'medium', 'low', 'info'];
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  for (const f of findings.slice(0, 8)) {
    suggestions.push({ priority: f.severity === 'critical' || f.severity === 'high' ? 'now' : f.severity === 'medium' ? 'next' : 'later', title: f.title, detail: f.recommendation, impact: `Addresses a ${f.severity} ${f.area.replace('_', ' ')} finding`, effort: f.area === 'cadence' || f.area === 'traceability' ? 'S' : 'M' });
  }

  const changes: string[] = [];
  if (previous) {
    const d = (label: string, now: number | null, was: number | null, unit = '') => {
      if (now == null || was == null || now === was) return;
      changes.push(`${label} ${now > was ? 'rose' : 'fell'} from ${was}${unit} to ${now}${unit} since version ${previous.version}.`);
    };
    d('Quality score', s.kpis.score, previous.kpis.score);
    d('Pass rate', s.kpis.pass_rate, previous.kpis.pass_rate, '%');
    d('Coverage', s.kpis.coverage_pct, previous.kpis.coverage_pct, '%');
    d('Failing cases', s.kpis.failing_cases, previous.kpis.failing_cases);
    d('Flaky cases', s.kpis.flaky_cases, previous.kpis.flaky_cases);
    if (!changes.length) changes.push(`No headline number moved since version ${previous.version}.`);
  }

  const verdict = s.score.grade as Analysis['verdict'];
  const refLine = ref ? `On ${ref.name}, ${ref.latest.passing} cases pass, ${ref.latest.failing} fail and ${ref.latest.never_run} have not run (pass rate ${ref.pass_rate ?? '—'}%, coverage ${ref.coverage_pct}%).` : 'No environment has results in the window.';
  return {
    headline: `${s.application.name} scores ${s.score.value}/100: ${findings[0]?.title ?? 'no issues found by the built-in rules'}.`,
    verdict,
    summary: [
      `${s.catalog.active} active test cases; ${s.totals.runs} runs and ${s.totals.results} results across ${plural(live.length, 'live environment')} in the last ${s.window_days} days. ${refLine}`,
      allFailures ? `Non-passing results break down as ${s.failures.classes.slice(0, 4).map((c) => `${c.classification.replace(/_/g, ' ')} ${c.count}`).join(', ')}.` : 'No failures were recorded in the window.',
      `Score components: ${s.score.components.map((c) => `${c.label} ${c.value}`).join(', ')}.`,
    ],
    changes_since_last: changes,
    findings,
    failure_themes: s.failures.signatures.slice(0, 8).map((x) => ({ title: x.signature, nature: NATURE[x.classification] ?? 'unknown', count: x.count, detail: `${x.count} results across ${plural(x.cases, 'case')} on ${x.environments.join(', ')}; classified ${x.classification.replace(/_/g, ' ')}.`, case_keys: x.sample_cases })),
    environments: s.environments.map((e) => ({
      key: e.key,
      verdict: envVerdict(e),
      assessment: e.results
        ? `${e.runs} runs, ${e.results} results, pass rate ${e.pass_rate ?? '—'}%, ${e.coverage_pct}% of the catalogue executed. ${e.deployed_build ? `Deployed build ${short(e.deployed_build.commit)}.` : 'No deployed build registered.'}${e.status !== 'active' ? ' This environment is retired.' : ''}`
        : 'No results in the window.',
      actions: [
        ...(e.status === 'active' && e.latest.failing ? [`Triage ${plural(e.latest.failing, 'failing case')}.`] : []),
        ...(e.status === 'active' && e.latest.never_run ? [`Run the ${e.latest.never_run} cases that have no result here.`] : []),
        ...(e.status === 'active' && !e.deployed_build ? ['Register the deployed commit so runs are traceable.'] : []),
      ],
    })),
    test_quality: {
      assessment: `${s.depth.inspectable} cases are defined as steps with an average of ${s.depth.avg_checks} checks each; ${s.depth.script_defined} are script-backed and their assertions live in code.`,
      strengths: [
        ...(s.cases.consistently_passing_total ? [`${plural(s.cases.consistently_passing_total, 'case')} passed every time over three or more runs.`] : []),
        ...(s.evidence.pct >= 90 ? [`${s.evidence.pct}% of verdicts carry evidence.`] : []),
        ...(s.catalog.with_description_pct >= 90 ? [`${s.catalog.with_description_pct}% of cases are described.`] : []),
      ],
      weaknesses: findings.filter((f) => f.area === 'test_quality').map((f) => f.title),
    },
    coverage: {
      assessment: ref ? `${ref.coverage_pct}% of active cases have run on ${ref.name}.` : 'No coverage recorded.',
      gaps: s.coverage_by_type.filter((t) => t.never_run).slice(0, 8).map((t) => `${t.type}: ${t.never_run} of ${t.total} cases not run`),
    },
    suggestions,
  };
}

export function reviewOf(version: number, createdAt: string, kpis: Snapshot['kpis'], analysis: Analysis): PreviousReview {
  return {
    version, created_at: createdAt, kpis,
    analysis: { headline: analysis.headline, verdict: analysis.verdict, findings: analysis.findings.map((f) => `[${f.severity}] ${f.title}`), suggestions: analysis.suggestions.map((x) => `[${x.priority}] ${x.title}`) },
  };
}
