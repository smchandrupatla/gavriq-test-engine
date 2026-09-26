import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  candidatesFrom, canMoveDefect, canMoveReport, evaluateRerun, fingerprint, normalizeMessage,
  planIngest, reportKey, rerunBlockers, severityFor, summarize,
} from '../apps/api/src/defects/core.ts';

describe('defect fingerprint', () => {
  it('ignores ids, numbers and timestamps that change every run', () => {
    const a = fingerprint('SIT-API-01', 'expected 200 got 500 at 2026-09-26T08:01:02.123Z id 0f8fad5b-d9cb-469f-a165-70867728950e');
    const b = fingerprint('SIT-API-01', 'Expected 201 got 503 at 2026-09-27T11:22:33Z id 7c9e6679-7425-40de-944b-e07fc1f90ae7');
    assert.equal(a, b);
  });

  it('separates different cases and different first lines', () => {
    assert.notEqual(fingerprint('A', 'boom'), fingerprint('B', 'boom'));
    assert.notEqual(fingerprint('A', 'timeout waiting for queue'), fingerprint('A', 'assertion failed: row missing'));
  });

  it('keys on the first non-empty line only', () => {
    assert.equal(fingerprint('A', '\nboom\n  at stack 1'), fingerprint('A', 'boom\n  at other stack 99'));
  });

  it('normalizes whitespace and caps length', () => {
    assert.equal(normalizeMessage('  A   b\n\tc '), 'a b c');
    assert.equal(normalizeMessage('x'.repeat(1000)).length, 400);
  });
});

describe('candidatesFrom', () => {
  it('opens defects for failing results only, one per fingerprint', () => {
    const out = candidatesFrom([
      { test_case_id: '1', case_key: 'TC-1', status: 'passed' },
      { test_case_id: '2', case_key: 'TC-2', status: 'failed', message: 'expected 1 got 2', classification: 'assertion_failure' },
      { test_case_id: '2', case_key: 'TC-2', status: 'failed', message: 'expected 1 got 3', classification: 'assertion_failure' },
      { test_case_id: '3', case_key: 'TC-3', status: 'skipped' },
      { test_case_id: '4', case_key: 'TC-4', status: 'blocked', message: 'ECONNREFUSED' },
      { test_case_id: '5', case_key: 'TC-5', status: 'timed_out' },
    ]);
    assert.deepEqual(out.map((c) => c.case_key), ['TC-2', 'TC-4', 'TC-5']);
    assert.equal(out[0]!.severity, 'high');
    assert.equal(out[1]!.category, 'environment_problem');
    assert.equal(out[1]!.severity, 'low');
    assert.match(out[2]!.message, /timed_out without a message/);
  });

  it('grades severity by category', () => {
    assert.equal(severityFor('failed', 'application_defect'), 'high');
    assert.equal(severityFor('failed', 'script_problem'), 'medium');
    assert.equal(severityFor('failed', 'target_unreachable'), 'low');
  });
});

describe('planIngest', () => {
  const c = (fp: string) => ({ fingerprint: fp } as ReturnType<typeof candidatesFrom>[number]);
  it('creates new, reopens verified regressions, and bumps still-open ones', () => {
    const plan = planIngest([c('new'), c('back'), c('still')], [
      { id: 'd1', fingerprint: 'back', status: 'verified' },
      { id: 'd2', fingerprint: 'still', status: 'in_fix' },
    ]);
    assert.deepEqual(plan.create.map((x) => x.fingerprint), ['new']);
    assert.deepEqual(plan.regress.map((x) => x.defect.id), ['d1']);
    assert.deepEqual(plan.recur.map((x) => x.defect.id), ['d2']);
  });

  it('treats wont_fix repeats as recurring, not new', () => {
    const plan = planIngest([c('x')], [{ id: 'd', fingerprint: 'x', status: 'wont_fix' }]);
    assert.equal(plan.recur.length, 1);
    assert.equal(plan.create.length, 0);
  });
});

describe('lifecycle rules', () => {
  it('lets fixers move a defect to fixed but never skip to verified', () => {
    assert.ok(canMoveDefect('open', 'fixed'));
    assert.ok(canMoveDefect('in_fix', 'fixed'));
    assert.ok(!canMoveDefect('open', 'verified'));
    assert.ok(!canMoveDefect('in_fix', 'verified'));
    assert.ok(canMoveDefect('fixed', 'verified'));
  });

  it('only claims open or reopened reports and reruns from with_pm or fixing', () => {
    assert.ok(canMoveReport('open', 'with_pm'));
    assert.ok(canMoveReport('reopened', 'with_pm'));
    assert.ok(!canMoveReport('rerunning', 'with_pm'));
    assert.ok(canMoveReport('fixing', 'rerunning'));
    assert.ok(!canMoveReport('open', 'rerunning'));
  });

  it('blocks a rerun until every defect is fixed or wont_fix', () => {
    assert.deepEqual(rerunBlockers([
      { key: 'DEF-1', status: 'fixed' },
      { key: 'DEF-2', status: 'in_fix' },
      { key: 'DEF-3', status: 'wont_fix' },
    ]), ['DEF-2 is in_fix']);
  });
});

describe('evaluateRerun', () => {
  const defects = [
    { id: 'a', status: 'fixed' as const, test_case_id: 'c1', case_key: 'TC-1' },
    { id: 'b', status: 'fixed' as const, test_case_id: 'c2', case_key: 'TC-2' },
    { id: 'c', status: 'wont_fix' as const, test_case_id: 'c3', case_key: 'TC-3' },
  ];

  it('verifies the report when every fixed case passes', () => {
    const out = evaluateRerun(defects, [
      { test_case_id: 'c1', status: 'passed' },
      { test_case_id: 'c2', status: 'passed' },
    ]);
    assert.equal(out.report, 'verified');
    assert.deepEqual(out.verdicts.map((v) => [v.id, v.to]), [['a', 'verified'], ['b', 'verified']]);
  });

  it('reopens failing and not-run cases and reopens the report', () => {
    const out = evaluateRerun(defects, [{ test_case_id: 'c1', status: 'failed' }]);
    assert.equal(out.report, 'reopened');
    assert.deepEqual(out.verdicts.map((v) => [v.id, v.to, v.reason]), [
      ['a', 'reopened', 'rerun failed'],
      ['b', 'reopened', 'case not run in rerun'],
    ]);
  });

  it('matches by case key when the id is missing', () => {
    const out = evaluateRerun([{ id: 'x', status: 'fixed', test_case_id: null, case_key: 'SIT-9' }], [
      { case_key: 'SIT-9', status: 'passed' },
    ]);
    assert.equal(out.report, 'verified');
  });
});

describe('helpers', () => {
  it('summarizes by status and severity', () => {
    const s = summarize([{ status: 'fixed', severity: 'high' }, { status: 'fixed' }, { status: 'open', severity: 'high' }]);
    assert.deepEqual(s, { total: 3, high: 2, by_status: { fixed: 2, open: 1 } });
  });

  it('builds dated report keys', () => {
    assert.equal(reportKey(new Date('2026-09-26T10:00:00Z'), 'abcdef1234'), 'DR-20260926-abcdef');
  });
});
