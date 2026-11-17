import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideCycle } from '../apps/api/src/cycle-run.ts';

describe('cycle run decisions', () => {
  it('starts the next iteration when teardown of iteration N succeeded and more are left', () => {
    const d = decideCycle({ status: 'running', iterations_total: 5, iterations_done: 2 }, true);
    assert.deepEqual(d, { action: 'next', iteration: 4 });
  });

  it('marks done when the last iteration finished', () => {
    assert.deepEqual(
      decideCycle({ status: 'running', iterations_total: 3, iterations_done: 2 }, true),
      { action: 'done' }
    );
  });

  it('bumps iterations_done once per teardown (iteration count never exceeds total)', () => {
    const d = decideCycle({ status: 'running', iterations_total: 1, iterations_done: 0 }, true);
    assert.deepEqual(d, { action: 'done' });
  });

  it('stops the chain when a teardown failed', () => {
    const d = decideCycle({ status: 'running', iterations_total: 5, iterations_done: 0 }, false);
    assert.equal(d.action, 'stop');
    if (d.action === 'stop') assert.match(d.reason, /teardown failed/);
  });

  it('leaves a cancelled cycle alone (idempotent)', () => {
    const d = decideCycle({ status: 'cancelled', iterations_total: 5, iterations_done: 2 }, true);
    assert.equal(d.action, 'stop');
    if (d.action === 'stop') assert.match(d.reason, /cycle is cancelled/);
  });

  it('leaves a completed cycle alone (a late teardown report cannot restart it)', () => {
    const d = decideCycle({ status: 'completed', iterations_total: 3, iterations_done: 3 }, true);
    assert.equal(d.action, 'stop');
  });

  it('leaves a failed cycle alone (iterations stop)', () => {
    const d = decideCycle({ status: 'failed', iterations_total: 3, iterations_done: 1 }, true);
    assert.equal(d.action, 'stop');
  });
});

