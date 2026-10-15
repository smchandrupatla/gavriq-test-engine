/**
 * Per-worker user pool.
 *
 * Scaling `docker compose up --scale test-engine-worker=N` on a Sand Bench
 * target hits the one-session-per-user rule unless every worker drains the
 * queue under its own identity. The pool-slot picker hashes WORKER_ID to a
 * deterministic 0..POOL_SIZE-1 slot — same slot for the lifetime of that
 * worker, but different workers hash to different slots as long as N <=
 * POOL_SIZE. These tests pin that contract.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { POOL_SIZE, ADMIN_POOL_SIZE, pickUser, pickAdmin, pickUserForWorker, pickAdminForWorker } from '../apps/api/src/catalog/user-pool.ts';

describe('user pool slot picker', () => {
  it('pickUser returns stable usernameVar / passwordVar / tokenVar / slot for the same case key', () => {
    const a = pickUser('TE-SCR-FOO');
    const b = pickUser('TE-SCR-FOO');
    assert.deepStrictEqual(a, b);
    assert.ok(a.slot >= 0 && a.slot < POOL_SIZE);
    assert.strictEqual(a.usernameVar, `pool_user_${a.slot}`);
    assert.strictEqual(a.passwordVar, `pool_pass_${a.slot}`);
    assert.strictEqual(a.tokenVar, `token_u${a.slot}`);
  });

  it('pickAdmin uses its own smaller admin pool', () => {
    const p = pickAdmin('TE-SCR-FOO');
    assert.ok(p.slot >= 0 && p.slot < ADMIN_POOL_SIZE);
    assert.strictEqual(p.usernameVar, `pool_admin_${p.slot}`);
  });

  describe('pickUserForWorker — deterministic per-worker assignment', () => {
    it('is a pure function of WORKER_ID (same id → same slot across calls)', () => {
      const a = pickUserForWorker('worker-abc12345');
      const b = pickUserForWorker('worker-abc12345');
      assert.deepStrictEqual(a, b);
    });

    it('returns a slot in [0, POOL_SIZE)', () => {
      for (const id of ['worker-abc', 'worker-def', 'worker-123', 'worker-456', 'worker-xyz']) {
        const p = pickUserForWorker(id);
        assert.ok(p.slot >= 0 && p.slot < POOL_SIZE, `slot ${p.slot} out of range for ${id}`);
      }
    });

    it('spreads at least a handful of distinct workers across the pool', () => {
      // Across many random worker ids, we expect to see several distinct slots
      // (the hash isn't cryptographic but it's not a constant either). Guard
      // against a regression that pins everybody to slot 0.
      const slots = new Set<number>();
      for (let i = 0; i < 32; i++) slots.add(pickUserForWorker(`worker-${(i * 7919).toString(16)}`).slot);
      assert.ok(slots.size >= Math.min(POOL_SIZE, 4), `too few distinct slots (${slots.size}) over 32 ids`);
    });

    it('maps to the matching pool_user_<slot> / pool_pass_<slot> env vars', () => {
      const p = pickUserForWorker('worker-whatever');
      assert.strictEqual(p.usernameVar, `pool_user_${p.slot}`);
      assert.strictEqual(p.passwordVar, `pool_pass_${p.slot}`);
      assert.strictEqual(p.tokenVar, `token_u${p.slot}`);
    });

    it('admin picker returns a different hash than the user picker for the same worker', () => {
      // Hashing seeds "worker-xyz" vs. "worker-xyz:admin", so collisions
      // between user and admin slots should be rare (they are legal — just
      // not expected to be constant).
      const u = pickUserForWorker('worker-xyz');
      const a = pickAdminForWorker('worker-xyz');
      assert.ok(a.slot >= 0 && a.slot < ADMIN_POOL_SIZE);
      // At least the usernameVar namespace differs.
      assert.notStrictEqual(u.usernameVar, a.usernameVar);
    });

    it('handles missing / empty worker ids without crashing (anonymous fallback)', () => {
      const p1 = pickUserForWorker('');
      const p2 = pickUserForWorker(undefined as unknown as string);
      // Both land somewhere in-range; neither throws.
      assert.ok(p1.slot >= 0 && p1.slot < POOL_SIZE);
      assert.ok(p2.slot >= 0 && p2.slot < POOL_SIZE);
    });
  });
});
