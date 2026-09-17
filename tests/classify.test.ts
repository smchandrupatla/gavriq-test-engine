import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyOutcome, isEnvironmentFailure } from '../apps/api/src/classify.ts';

describe('classifyOutcome', () => {
  it('keeps passed results', () => {
    const r = classifyOutcome({ status: 'passed', message: 'ok' });
    assert.equal(r.status, 'passed');
  });

  it('marks connection refused as blocked / target_unreachable', () => {
    const r = classifyOutcome({ status: 'failed', message: 'fetch failed: ECONNREFUSED 127.0.0.1:8001' });
    assert.equal(r.status, 'blocked');
    assert.equal(r.classification, 'target_unreachable');
    assert.equal(isEnvironmentFailure(r.status, r.classification), true);
  });

  it('marks assertion mismatches as failed', () => {
    const r = classifyOutcome({ status: 'failed', message: 'expected 200 got 500' });
    assert.equal(r.status, 'failed');
    assert.equal(r.classification, 'assertion_failure');
    assert.equal(isEnvironmentFailure(r.status, r.classification), false);
  });
});
