import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideDeploy,
  fingerprintDeployError,
  isDeployDefectReady,
  DEFAULT_DEPLOY_RETRY_CAP,
  type DeployReportLite,
} from '../apps/api/src/deploy-loop.ts';

const base = (over: Partial<DeployReportLite> = {}): DeployReportLite => ({
  key: 'DR-20261008-abcdef',
  status: 'fixing',
  retry_count: 0,
  retry_cap: DEFAULT_DEPLOY_RETRY_CAP,
  defects: [{ status: 'fixed' }],
  ...over,
});

describe('deploy loop decisions', () => {
  it('waits for the implementation manager to claim an open or reopened report', () => {
    assert.deepEqual(decideDeploy(base({ status: 'open' })).action, 'wait');
    assert.deepEqual(decideDeploy(base({ status: 'reopened' })).action, 'wait');
  });

  it('waits for fixes when the agent has claimed the report but nothing is fixed yet', () => {
    const d = decideDeploy(base({ status: 'with_pm', defects: [{ status: 'acknowledged' }] }));
    assert.equal(d.action, 'wait');
    if (d.action === 'wait') assert.equal(d.phase, 'awaiting_fixes');
  });

  it('retries when every child defect is ready and the cap has room', () => {
    assert.equal(decideDeploy(base({ status: 'fixing', retry_count: 2 })).action, 'retry');
  });

  it('parks at the retry cap, even when every child is fixed', () => {
    const d = decideDeploy(base({ status: 'fixing', retry_count: 5, retry_cap: 5 }));
    assert.equal(d.action, 'park');
    if (d.action === 'park') assert.match(d.reason, /cap of 5/);
  });

  it('does not retry while a previous retry is in flight', () => {
    const d = decideDeploy(base({ status: 'rerunning' }));
    assert.equal(d.action, 'wait');
    if (d.action === 'wait') assert.equal(d.phase, 'rerunning');
  });

  it('reports verified for a report the engine has already closed', () => {
    assert.equal(decideDeploy(base({ status: 'verified' })).action, 'verified');
  });

  it('leaves a parked report parked (operator un-parks explicitly)', () => {
    assert.equal(decideDeploy(base({ status: 'parked' })).action, 'park');
  });
});

describe('deploy error fingerprint', () => {
  it('matches the same error across retries, after stripping volatile bits', () => {
    const a = fingerprintDeployError('sb', 'container 7f3a2b1c failed on port 18080 after 42s');
    const b = fingerprintDeployError('sb', 'container 9e2d1a4f failed on port 18090 after 311s');
    assert.equal(a, b);
  });

  it('separates different error signatures and different environments', () => {
    const a = fingerprintDeployError('sb', 'docker build failed: npm run build exit 1');
    const b = fingerprintDeployError('sb', 'docker build failed: postgres init exit 1');
    assert.notEqual(a, b);
    const c = fingerprintDeployError('sb-staging', 'docker build failed: npm run build exit 1');
    assert.notEqual(a, c);
  });
});

describe('deploy defect readiness', () => {
  it('reuses the same ready set as the test-defect loop', () => {
    assert.equal(isDeployDefectReady('fixed'), true);
    assert.equal(isDeployDefectReady('wont_fix'), true);
    assert.equal(isDeployDefectReady('verified'), true);
    assert.equal(isDeployDefectReady('open'), false);
    assert.equal(isDeployDefectReady('in_fix'), false);
  });
});
