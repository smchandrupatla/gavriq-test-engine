/**
 * The worker's buildVars shape — specifically the per-worker user-pool pin
 * it adds on top of the environment's config.vars + secret_env. This lets
 * every GUI case reference the same `{{worker_user}}` / `{{worker_pass}}`
 * placeholders without the catalog knowing which worker will drain it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER = readFileSync(path.join(here, '..', 'apps', 'worker', 'src', 'worker.ts'), 'utf8');

describe('worker buildVars — per-worker user pool pin', () => {
  it('declares POOL_SIZE + ADMIN_POOL_SIZE matching the catalog', () => {
    assert.match(WORKER, /const POOL_SIZE = 8;/);
    assert.match(WORKER, /const ADMIN_POOL_SIZE = 2;/);
  });

  it('hashes WORKER_ID to pin the worker to a stable slot (same algorithm as user-pool.ts)', () => {
    const fn = WORKER.match(/function workerPoolSlot\(workerId: string, mod: number\): number \{([\s\S]*?)\n\}/);
    assert.ok(fn, 'workerPoolSlot must be present');
    // The 32-bit djb2 variant used by catalog/user-pool.ts.
    assert.match(fn![1], /\(\(h << 5\) - h \+ workerId\.charCodeAt\(i\)\) \| 0/);
    assert.match(fn![1], /Math\.abs\(h\) % mod/);
  });

  it('exposes {{worker_id}} / {{worker_slot}} / {{worker_user}} / {{worker_pass}} / {{worker_admin}} to runners', () => {
    const start = WORKER.indexOf('function buildVars(env: any): Record<string, string> {');
    assert.ok(start > -1);
    const after = WORKER.indexOf('\nasync function executeCase', start + 1);
    const body = WORKER.slice(start, after);
    assert.match(body, /vars\.worker_id = WORKER_ID;/);
    assert.match(body, /vars\.worker_slot = String\(uSlot\);/);
    assert.match(body, /vars\.worker_admin_slot = String\(aSlot\);/);
    assert.match(body, /vars\.worker_token_var = `token_u\${uSlot}`;/);
    assert.match(body, /vars\.worker_admin_token_var = `token_a\${aSlot}`;/);
    assert.match(body, /vars\.worker_user = uu;/);
    assert.match(body, /vars\.worker_pass = up;/);
    assert.match(body, /vars\.worker_admin = au;/);
    assert.match(body, /vars\.worker_adminpass = ap;/);
  });

  it('reads pool_user_<slot> / pool_pass_<slot> from the environment (not hard-coded credentials)', () => {
    const start = WORKER.indexOf('function buildVars(env: any): Record<string, string> {');
    const after = WORKER.indexOf('\nasync function executeCase', start + 1);
    const body = WORKER.slice(start, after);
    assert.match(body, /vars\[`pool_user_\$\{uSlot\}`\]/);
    assert.match(body, /vars\[`pool_pass_\$\{uSlot\}`\]/);
    assert.match(body, /vars\[`pool_admin_\$\{aSlot\}`\]/);
    assert.match(body, /vars\[`pool_adminpass_\$\{aSlot\}`\]/);
  });

  it('leaves worker_user / worker_pass unset when the env does not carry the pool creds (graceful fallback)', () => {
    const start = WORKER.indexOf('function buildVars(env: any): Record<string, string> {');
    const after = WORKER.indexOf('\nasync function executeCase', start + 1);
    const body = WORKER.slice(start, after);
    // The conditional assignments only fire when the env var is defined, so
    // an environment with no pool still works — cases just do not resolve
    // the generic worker_* vars.
    assert.match(body, /if \(uu !== undefined\) vars\.worker_user = uu;/);
    assert.match(body, /if \(up !== undefined\) vars\.worker_pass = up;/);
  });
});
