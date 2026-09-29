import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coveredCategories, ingestKey, normalizeReport, planFindings, registerSummary, scanKey, SecurityScanError,
} from '../apps/api/src/security/core.ts';

const finding = (fingerprint: string, extra: Record<string, unknown> = {}) => ({
  fingerprint, rule: 'code.eval', category: 'code', severity: 'high', title: 'Dynamic code evaluation',
  file: 'apps/x.ts', line: 3, detail: 'eval(x)', status: 'new', ...extra,
});

const report = (findings: unknown[], extra: Record<string, unknown> = {}) => ({
  schema: 'sandbench.security-scan/v1', project: 'sand-bench-enterprise', branch: 'main', commit: 'abc1234',
  trigger: 'gate', failOn: 'medium', result: 'failed', startedAt: '2026-09-29T00:00:00Z', finishedAt: '2026-09-29T00:01:00Z',
  durationMs: 60000, tools: [{ name: 'code', status: 'ok', findings: findings.length }, { name: 'dependencies', status: 'unavailable', findings: 0 }],
  findings, blocking: [], ...extra,
});

describe('normalizeReport', () => {
  it('accepts a scanner report and keeps what the register needs', () => {
    const scan = normalizeReport(report([finding('aaaaaaaaaaaaaaaa', { status: 'accepted', acceptedReason: 'static data', reference: 'IMP-1' })]));
    assert.equal(scan.project, 'sand-bench-enterprise');
    assert.equal(scan.findings[0]!.status, 'accepted');
    assert.equal(scan.findings[0]!.acceptedReason, 'static data');
    assert.equal(scan.tools.length, 2);
  });

  it('refuses reports without a project, findings array or valid result', () => {
    assert.throws(() => normalizeReport({}), SecurityScanError);
    assert.throws(() => normalizeReport(report([], { project: '../etc' })), /project/);
    assert.throws(() => normalizeReport(report([], { result: 'maybe' })), /result/);
    assert.throws(() => normalizeReport(report([{ rule: 'x' }])), /fingerprint/);
  });

  it('coerces unknown severities, drops duplicate fingerprints, keeps only http(s) advisory links', () => {
    const scan = normalizeReport(report([
      finding('bbbbbbbbbbbbbbbb', { severity: 'apocalyptic', url: 'javascript:alert(1)' }),
      finding('bbbbbbbbbbbbbbbb'),
    ]));
    assert.equal(scan.findings.length, 1);
    assert.equal(scan.findings[0]!.severity, 'medium');
    assert.equal(scan.findings[0]!.url, null);
  });

  it('keys a retried post to the same scan', () => {
    const a = normalizeReport(report([]));
    const b = normalizeReport(report([finding('cccccccccccccccc')]));
    assert.equal(ingestKey(a), ingestKey(b));
    assert.notEqual(ingestKey(a), ingestKey(normalizeReport(report([], { commit: 'def5678' }))));
    assert.match(scanKey(a.finishedAt, 'f00ba7deadbeef'), /^SS-20260929-f00ba7$/);
  });
});

describe('planFindings lifecycle', () => {
  it('opens new findings and marks accepted ones accepted', () => {
    const scan = normalizeReport(report([finding('dddddddddddddddd'), finding('eeeeeeeeeeeeeeee', { status: 'accepted' })]));
    const plan = planFindings([], scan);
    assert.deepEqual(plan.upserts.map((u) => [u.finding.fingerprint, u.status, u.isNew]), [
      ['dddddddddddddddd', 'open', true], ['eeeeeeeeeeeeeeee', 'accepted', true],
    ]);
    assert.deepEqual(plan.fixed, []);
  });

  it('marks a finding fixed only when a clean run of its check no longer reports it', () => {
    const existing = [
      { fingerprint: 'ffffffffffffffff', category: 'code', status: 'open' as const },
      { fingerprint: '1111111111111111', category: 'dependencies', status: 'open' as const },
    ];
    const plan = planFindings(existing, normalizeReport(report([])));
    assert.deepEqual(plan.fixed, ['ffffffffffffffff'], 'the dependency check did not run, so its finding stays open');
  });

  it('reopens a fixed finding that comes back', () => {
    const plan = planFindings([{ fingerprint: '2222222222222222', category: 'code', status: 'fixed' }], normalizeReport(report([finding('2222222222222222')])));
    assert.equal(plan.upserts[0]!.reopened, true);
    assert.equal(plan.upserts[0]!.status, 'open');
  });

  it('only counts checks that ran cleanly as coverage', () => {
    const covered = coveredCategories([{ name: 'gitleaks', status: 'ok', findings: 0, detail: '', ms: 1 }, { name: 'routes', status: 'error', findings: 0, detail: '', ms: 1 }]);
    assert.deepEqual([...covered], ['secrets']);
  });
});

describe('registerSummary', () => {
  it('counts open by severity and keeps accepted and fixed apart', () => {
    const sum = registerSummary([
      { severity: 'high', status: 'open', category: 'code' },
      { severity: 'critical', status: 'open', category: 'secrets' },
      { severity: 'medium', status: 'accepted', category: 'xss' },
      { severity: 'high', status: 'fixed', category: 'code' },
    ]);
    assert.equal(sum.openTotal, 2);
    assert.equal(sum.open.critical, 1);
    assert.equal(sum.open.high, 1);
    assert.equal(sum.accepted, 1);
    assert.equal(sum.fixed, 1);
  });
});
