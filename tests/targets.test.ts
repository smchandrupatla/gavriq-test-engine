import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { environmentType, readManifests, registerTarget, registerTargets, validateManifest } from '../apps/api/src/targets.ts';

const good = { key: 'demo-app', name: 'Demo', environments: [{ name: 'local', base_url: 'http://localhost:3000' }] };

function dirWith(files: Record<string, unknown>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'targets-'));
  for (const [key, manifest] of Object.entries(files)) {
    mkdirSync(path.join(dir, key));
    writeFileSync(path.join(dir, key, 'target.json'), JSON.stringify(manifest));
  }
  return dir;
}

describe('target manifests', () => {
  it('accepts a minimal manifest', () => assert.deepEqual(validateManifest(good), []));

  it('rejects bad key, missing environments and bad urls', () => {
    assert.ok(validateManifest({ ...good, key: 'Bad Key' }).length > 0);
    assert.ok(validateManifest({ ...good, environments: [] }).length > 0);
    assert.ok(validateManifest({ ...good, environments: [{ name: 'x', base_url: 'ftp://h' }] }).length > 0);
    assert.ok(validateManifest({ ...good, environments: [{ name: 'x', base_url: 'http://h', type: 'moon' }] }).length > 0);
  });

  it('derives environment type from the url unless given', () => {
    assert.equal(environmentType({ base_url: 'http://127.0.0.1:1' }), 'localhost');
    assert.equal(environmentType({ base_url: 'https://x.example.com' }), 'remote');
    assert.equal(environmentType({ base_url: 'https://x.example.com', type: 'staging' }), 'staging');
  });

  it('requires the key to equal its directory name', () => {
    assert.throws(() => readManifests(dirWith({ other: good })), /must equal its directory name/);
  });

  it('missing targets directory registers nothing', async () => {
    assert.deepEqual(await registerTargets(async () => ({}), path.join(tmpdir(), 'no-such-dir-xyz')), []);
  });

  it('registers one application and one environment per manifest environment, namespaced by key', async () => {
    const calls: { text: string; params: unknown[] }[] = [];
    const m = { ...good, environments: [{ name: 'local', base_url: 'http://localhost:3000' }, { name: 'prod', base_url: 'https://app.example.com', type: 'production' }] };
    await registerTarget(m, async (text, params = []) => { calls.push({ text, params }); return {}; });
    assert.equal(calls.length, 3);
    assert.equal(calls[0]!.params[0], 'demo-app');
    assert.deepEqual(calls.slice(1).map((c) => c.params[0]), ['demo-app-local', 'demo-app-prod']);
    assert.equal(calls[2]!.params[2], 'production');
    assert.ok(calls.every((c) => /ON CONFLICT/.test(c.text)), 'idempotent upserts');
  });

  it('the committed sand-bench manifest is valid and registers', async () => {
    const keys = await registerTargets(async () => ({}), 'targets');
    assert.ok(keys.includes('sand-bench'));
  });
});
