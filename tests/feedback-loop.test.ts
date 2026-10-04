import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decide, isReadyForRerun, type ReportLite } from '../apps/api/src/feedback-loop.ts';

const r = (key: string, status: string, ready = false): ReportLite => ({ key, status, ready });

describe('feedback loop decisions', () => {
  it('sweeps when nothing is outstanding and no sweep has come back clean', () => {
    assert.deepEqual(decide([], false), { action: 'sweep' });
  });

  it('converges only when the last sweep was clean and nothing is outstanding', () => {
    assert.deepEqual(decide([], true), { action: 'converged' });
  });

  it('requests reruns for fixed reports, not for reports the manager has not fixed yet', () => {
    const reports = [r('DR-1', 'fixing', true), r('DR-2', 'with_pm', false), r('DR-3', 'reopened', true)];
    assert.deepEqual(decide(reports, false), { action: 'rerun', keys: ['DR-1'] });
  });

  it('waits for the implementation manager to claim open or reopened reports', () => {
    assert.deepEqual(decide([r('DR-1', 'open')], false), { action: 'wait', phase: 'awaiting_pm', open: 1 });
    assert.deepEqual(decide([r('DR-1', 'reopened')], true), { action: 'wait', phase: 'awaiting_pm', open: 1 });
  });

  it('waits for fixes on claimed reports that are not ready', () => {
    assert.deepEqual(decide([r('DR-1', 'with_pm'), r('DR-2', 'fixing')], false), {
      action: 'wait',
      phase: 'awaiting_fixes',
      open: 2,
    });
  });

  it('waits for a rerun in flight before doing anything else', () => {
    const reports = [r('DR-1', 'rerunning'), r('DR-2', 'fixing', true)];
    assert.deepEqual(decide(reports, false), { action: 'wait', phase: 'rerunning', open: 1 });
  });

  it('never converges while a report is still outstanding, even after a clean sweep', () => {
    assert.equal(decide([r('DR-1', 'with_pm')], true).action, 'wait');
  });
});

describe('rerun readiness', () => {
  it('is ready when every defect is fixed, won’t-fix or verified and one is fixed', () => {
    assert.equal(isReadyForRerun([{ status: 'fixed' }, { status: 'wont_fix' }]), true);
    assert.equal(isReadyForRerun([{ status: 'verified' }, { status: 'fixed' }]), true);
  });

  it('is not ready while a defect is still open or in fix, or when nothing is fixed', () => {
    assert.equal(isReadyForRerun([{ status: 'fixed' }, { status: 'in_fix' }]), false);
    assert.equal(isReadyForRerun([{ status: 'acknowledged' }]), false);
    assert.equal(isReadyForRerun([{ status: 'wont_fix' }]), false);
    assert.equal(isReadyForRerun([]), false);
  });
});
