import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, caseDepth, failureSignature, type RawCase, type RawExecution, type RawResult, type SnapshotInput } from '../apps/api/src/insights/snapshot.js';
import { AnalysisSchema, reviewOf, rulesAnalysis } from '../apps/api/src/insights/analysis.js';

const kase = (n: number, over: Partial<RawCase> = {}): RawCase => ({
  id: `c${n}`, key: `TC-${n}`, name: `Case ${n}`, test_type: 'api', execution_method: 'http', severity: 'medium', priority: 'p2',
  automation_status: 'automated', lifecycle: 'active',
  steps: [{ action: 'request', expected_status: 200, expect_json: [{ path: 'status', equals: 'ok' }] }],
  assertions: [], validation_rules: {}, script: null, has_description: true, has_expected: true, ...over,
});
const at = (day: number, hour = 10) => `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
const exec = (id: string, env: string | null, day: number, over: Partial<RawExecution> = {}): RawExecution => ({ id, status: 'passed', trigger_source: 'manual', environment_id: env, created_at: at(day), build: null, ...over });
const result = (caseN: number, execution: string, status: string, day: number, over: Partial<RawResult> = {}): RawResult => ({
  test_case_id: `c${caseN}`, execution_id: execution, status, classification: status === 'passed' ? null : 'assertion_failure', duration_ms: 1000,
  message: status === 'passed' ? null : 'expected 200 but got 500', created_at: at(day, 11), ...over,
});

function input(over: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    now: at(30), timeZone: 'UTC', windowDays: 30, retentionDays: 5,
    application: { id: 'app', key: 'demo', name: 'Demo' },
    cases: [kase(1), kase(2), kase(3), kase(4)],
    executions: [], results: [], resultsTruncated: false,
    environments: [
      { id: 'stg', key: 'staging', name: 'Staging', env_type: 'staging', status: 'active', base_url: null, deployment: { commit: 'abcdef1234567890', ref: 'main', version: '1.0', deployed_at: at(20) }, listed: true },
      { id: 'dev', key: 'dev', name: 'Development', env_type: 'docker', status: 'active', base_url: null, deployment: null, listed: true },
      { id: 'old', key: 'old', name: 'Old', env_type: 'localhost', status: 'retired', base_url: null, deployment: null, listed: true },
    ],
    builds: [], schedules: { total: 1, enabled: 0 }, suites: 0, evidence: { verdicts: 0, with_evidence: 0 },
    ...over,
  };
}

describe('test depth', () => {
  it('counts every expectation a step states', () => {
    const d = caseDepth({
      steps: [
        { action: 'request', expected_status: 200, expect_json: [{}, {}], expected_body_contains: ['a'], expect_headers: { 'x-a': '1' } },
        { action: 'assert_text', expected: 'Hello' },
        { action: 'click' },
        { action: 'wait_for', selector: '#x' },
      ],
      assertions: [{}], validation_rules: { sla: { p95_ms: 1000, error_rate_pct: 1 }, requests: 200 }, script: null,
    });
    assert.deepEqual(d, { kind: 'inspectable', checks: 10, steps: 4 });
  });

  it('reports script-backed cases as not inspectable instead of as zero checks', () => {
    assert.equal(caseDepth({ steps: [], assertions: [], validation_rules: {}, script: 'sit/cases/00-health.sit.ts::is healthy' }).kind, 'script');
    // A compound runner action verifies inside the runner, not in the step definition.
    assert.equal(caseDepth({ steps: [{ action: 'sandbench_upload', description: 'upload and verify' }], assertions: [], validation_rules: {}, script: null }).kind, 'script');
    assert.deepEqual(caseDepth({ steps: [], assertions: [], validation_rules: {}, script: null }), { kind: 'inspectable', checks: 0, steps: 0 });
  });
});

describe('failure signatures', () => {
  it('groups messages that differ only by ids and numbers', () => {
    assert.equal(failureSignature('Timeout 10000ms exceeded\n  at foo'), failureSignature('Timeout 30000ms exceeded'));
    assert.equal(failureSignature('row 3f2b1c9e-1111-2222-3333-444455556666 missing'), 'row <id> missing');
    assert.equal(failureSignature(null), '(no message)');
  });
});

describe('snapshot', () => {
  const executions = [
    exec('e1', 'stg', 27), exec('e2', 'stg', 28), exec('e3', 'stg', 29, { build: { commit: 'feedbeef00000000' }, trigger_source: 'schedule' }),
    exec('d1', 'dev', 28), exec('o1', 'old', 25),
  ];
  const results = [
    // case 1: steady pass on staging, fails on dev -> divergent
    result(1, 'e1', 'passed', 27), result(1, 'e2', 'passed', 28), result(1, 'e3', 'passed', 29), result(1, 'd1', 'failed', 28),
    // case 2: pass, fail, pass -> flaky
    result(2, 'e1', 'passed', 27), result(2, 'e2', 'failed', 28), result(2, 'e3', 'passed', 29),
    // case 3: pass then fail -> regressed
    result(3, 'e1', 'passed', 27), result(3, 'e3', 'failed', 29, { classification: 'script_problem', message: 'SIT file not found: sit/cases/x.sit.ts' }),
    // retired environment only
    result(4, 'o1', 'failed', 25),
  ];
  const s = buildSnapshot(input({ executions, results, evidence: { verdicts: 9, with_evidence: 9 } }));

  it('reads headline numbers from the most production-like live environment', () => {
    assert.equal(s.reference_environment?.key, 'staging');
    assert.deepEqual(s.environments.map((e) => e.key), ['staging', 'dev', 'old']);
    const stg = s.environments[0]!;
    assert.deepEqual(stg.latest, { passing: 2, failing: 1, other: 0, never_run: 1 });
    assert.equal(stg.coverage_pct, 75);
    assert.equal(stg.pass_rate, 75, '6 passed, 2 failed');
    assert.equal(s.kpis.failing_cases, 1);
    assert.equal(s.kpis.never_run, 1);
    assert.equal(s.totals.runs, 4, 'retired environments are left out of the totals');
  });

  it('classifies case histories per environment', () => {
    assert.deepEqual(s.cases.flaky.map((c) => c.key), ['TC-2']);
    assert.deepEqual(s.cases.regressed.map((c) => c.key), ['TC-3']);
    assert.deepEqual(s.cases.divergent.map((c) => c.key), ['TC-1']);
    assert.deepEqual(s.cases.divergent[0]!.statuses, { staging: 'passed', dev: 'failed' });
    assert.deepEqual(s.cases.never_run.map((c) => c.key), ['TC-4'], 'a result on a retired environment is not coverage');
    assert.equal(s.cases.consistently_passing_total, 1);
  });

  it('attributes runs to the build they tested', () => {
    const stg = s.environments[0]!;
    // e3 was stamped at claim time; e1/e2 predate stamping and fall back to the deployment record.
    assert.deepEqual(stg.builds.map((b) => [b.commit, b.runs, b.inferred]), [['feedbeef00000000', 1, false], ['abcdef1234567890', 2, true]]);
    assert.equal(stg.traceable_pct, 100);
    assert.equal(s.environments[1]!.traceable_pct, 0, 'no deployment registered on dev');
    assert.equal(s.environments[1]!.builds[0]!.commit, null);
  });

  it('groups failures by cause on live environments only', () => {
    assert.deepEqual(s.failures.classes, [{ classification: 'assertion_failure', count: 2 }, { classification: 'script_problem', count: 1 }]);
    assert.equal(s.failures.signatures[0]!.count, 2);
    assert.deepEqual(s.failures.signatures[0]!.environments.sort(), ['dev', 'staging']);
  });

  it('builds a daily trend and a score from stated components', () => {
    assert.deepEqual(s.trend.map((d) => [d.day, d.runs]), [['2026-09-25', 1], ['2026-09-27', 1], ['2026-09-28', 2], ['2026-09-29', 1]]);
    assert.equal(s.score.components.reduce((n, c) => n + c.weight, 0), 100);
    assert.equal(s.score.value, Math.round(s.score.components.reduce((n, c) => n + c.value * c.weight, 0) / 100));
    assert.equal(s.cadence.automated_runs, 1);
  });

  it('buckets days in the engine time zone', () => {
    // 23:00 UTC on the 28th is already the 29th in Sydney.
    const late = buildSnapshot(input({ timeZone: 'Australia/Sydney', executions: [exec('e1', 'stg', 28, { created_at: at(28, 23) })], results: [result(1, 'e1', 'passed', 28, { created_at: at(28, 23) })] }));
    assert.deepEqual(late.trend.map((d) => d.day), ['2026-09-29']);
    assert.equal(late.time_zone, 'Australia/Sydney');
  });

  it('is safe on an application with no runs', () => {
    const empty = buildSnapshot(input());
    assert.equal(empty.kpis.pass_rate, null);
    assert.equal(empty.kpis.never_run, 4);
    assert.equal(empty.totals.results, 0);
    assert.doesNotThrow(() => AnalysisSchema.parse(rulesAnalysis(empty, null)));
  });

  it('rules review matches the review shape and names what it found', () => {
    const a = AnalysisSchema.parse(rulesAnalysis(s, null));
    assert.deepEqual(a.changes_since_last, []);
    assert.ok(a.findings.some((f) => f.title.includes('flaky')));
    assert.ok(a.findings.some((f) => f.area === 'traceability' && f.environment === 'dev'));
    assert.deepEqual(a.environments.map((e) => e.key), ['staging', 'dev', 'old']);
    assert.equal(a.failure_themes.find((t) => t.title.startsWith('SIT file not found'))?.nature, 'test_defect');

    const later = buildSnapshot(input({ executions, results: results.filter((r) => r.test_case_id !== 'c3'), evidence: { verdicts: 7, with_evidence: 7 } }));
    const next = rulesAnalysis(later, reviewOf(1, at(29), s.kpis, a));
    assert.ok(next.changes_since_last.some((c) => c.startsWith('Failing cases fell from 1 to 0')));
  });
});
