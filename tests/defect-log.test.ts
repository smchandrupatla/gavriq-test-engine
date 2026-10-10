import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canMoveLog, decodeAttachment, isBulkAction, isLogStatus, isSeverity, LogError, MAX_ATTACHMENT_BYTES, rollupDashboard, type DashRow } from '../apps/api/src/defect-log.ts';

describe('defect log lifecycle', () => {
  it('moves logged -> validated -> sent, or logged -> rejected', () => {
    assert.equal(canMoveLog('logged', 'validated'), true);
    assert.equal(canMoveLog('validated', 'sent'), true);
    assert.equal(canMoveLog('logged', 'rejected'), true);
  });

  it('lets a rejected defect be reopened, but a sent defect is final', () => {
    assert.equal(canMoveLog('rejected', 'logged'), true);
    assert.equal(canMoveLog('sent', 'logged'), false);
    assert.equal(canMoveLog('sent', 'rejected'), false);
  });

  it('does not skip validation on the way out, and staying put is always allowed', () => {
    assert.equal(canMoveLog('rejected', 'validated'), false);
    assert.equal(canMoveLog('validated', 'validated'), true);
  });

  it('accepts only known statuses and severities', () => {
    assert.equal(isLogStatus('validated'), true);
    assert.equal(isLogStatus('closed'), false);
    assert.equal(isSeverity('critical'), true);
    assert.equal(isSeverity('blocker'), false);
  });

  it('accepts only known bulk actions', () => {
    assert.equal(isBulkAction('delete'), true);
    assert.equal(isBulkAction('send'), true);
    assert.equal(isBulkAction('archive'), false);
    assert.equal(isBulkAction(42), false);
  });
});

describe('attachments', () => {
  it('decodes base64 content', () => {
    const bytes = decodeAttachment(Buffer.from('screen').toString('base64'));
    assert.equal(bytes.toString(), 'screen');
  });

  it('refuses empty and oversized content with a client error', () => {
    assert.throws(() => decodeAttachment(''), (e: unknown) => e instanceof LogError && e.statusCode === 400);
    const big = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1, 1).toString('base64');
    assert.throws(() => decodeAttachment(big), (e: unknown) => e instanceof LogError && e.statusCode === 413);
  });
});

describe('dashboard rollup', () => {
  const rows: DashRow[] = [
    { log_status: 'logged', application: 'sand-bench', environment: 'local-dev', severity: 'high', defect_status: null },
    { log_status: 'validated', application: 'sand-bench', environment: 'local-dev', severity: 'low', defect_status: null },
    { log_status: 'rejected', application: 'sand-bench', environment: 'staging', severity: 'low', defect_status: null },
    { log_status: 'sent', application: 'sand-bench', environment: 'staging', severity: 'high', defect_status: 'open' },
    { log_status: 'sent', application: 'other-app', environment: 'staging', severity: 'critical', defect_status: 'fixed' },
    { log_status: 'sent', application: 'other-app', environment: null, severity: 'high', defect_status: 'verified' },
  ];

  it('counts the lifecycle statuses', () => {
    const s = rollupDashboard(rows);
    assert.equal(s.total, 6);
    assert.deepEqual(s.by_status, { logged: 1, validated: 1, rejected: 1, sent: 3 });
  });

  it('maps a sent defect to its fix lane by the downstream defect status', () => {
    const s = rollupDashboard(rows);
    // not_sent = logged + validated + rejected = 3; in_progress = the sent/open one.
    assert.deepEqual(s.progress, { not_sent: 3, in_progress: 1, fixed: 1, verified: 1 });
    assert.equal(s.open, 4); // not_sent + in_progress
    assert.equal(s.done, 2); // fixed + verified
  });

  it('splits per application and per environment, newest group first by volume', () => {
    const s = rollupDashboard(rows);
    const byApp = Object.fromEntries(s.by_application.map((g) => [g.name, g.total]));
    assert.deepEqual(byApp, { 'sand-bench': 4, 'other-app': 2 });
    const staging = s.by_environment.find((g) => g.name === 'staging');
    assert.equal(staging?.total, 3);
    assert.ok(s.by_environment.some((g) => g.name === 'not recorded'));
  });
});
