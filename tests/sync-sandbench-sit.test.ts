import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sync, check, hashContent } from '../scripts/sync-sandbench-sit.mjs';

const SYNCED = ['sit/cases', 'tests/helpers/r1.mjs'];

function put(root: string, rel: string, body: string) {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  writeFileSync(path.join(root, rel), body);
}

describe('sync-sandbench-sit', () => {
  let src: string;
  let dest: string;

  beforeEach(() => {
    src = mkdtempSync(path.join(os.tmpdir(), 'sbe-src-'));
    dest = mkdtempSync(path.join(os.tmpdir(), 'te-dest-'));
    put(src, 'sit/cases/00-health.sit.ts', 'health\n');
    put(src, 'sit/cases/71-e2e.sit.ts', 'e2e\n');
    put(src, 'tests/helpers/r1.mjs', 'r1\n');
    put(dest, 'sit/cases/90-agents.sit.ts', 'engine only\n');
  });

  it('copies synced files and keeps engine-only cases', () => {
    const r = sync({ src, dest, synced: SYNCED, sourceCommit: 'abc' });
    assert.equal(r.copied, 3);
    assert.equal(readFileSync(path.join(dest, 'sit/cases/71-e2e.sit.ts'), 'utf8'), 'e2e\n');
    assert.ok(existsSync(path.join(dest, 'sit/cases/90-agents.sit.ts')));
    assert.equal(check({ src, dest, synced: SYNCED }).clean, true);
  });

  it('reports a local edit to a synced file as drift, against Sand Bench and the manifest', () => {
    sync({ src, dest, synced: SYNCED });
    put(dest, 'sit/cases/00-health.sit.ts', 'edited in engine\n');
    const vsSource = check({ src, dest, synced: SYNCED });
    assert.deepEqual(vsSource.changed, ['sit/cases/00-health.sit.ts']);
    const vsManifest = check({ src: null, dest, synced: SYNCED });
    assert.equal(vsManifest.against, 'manifest');
    assert.deepEqual(vsManifest.changed, ['sit/cases/00-health.sit.ts']);
  });

  it('reports new Sand Bench cases as missing until re-synced', () => {
    sync({ src, dest, synced: SYNCED });
    put(src, 'sit/cases/72-new.sit.ts', 'new\n');
    assert.deepEqual(check({ src, dest, synced: SYNCED }).added, ['sit/cases/72-new.sit.ts']);
    sync({ src, dest, synced: SYNCED });
    assert.equal(check({ src, dest, synced: SYNCED }).clean, true);
  });

  it('deletes files removed from Sand Bench but never engine-only files', () => {
    sync({ src, dest, synced: SYNCED });
    rmSync(path.join(src, 'sit/cases/71-e2e.sit.ts'));
    const r = sync({ src, dest, synced: SYNCED });
    assert.deepEqual(r.deleted, ['sit/cases/71-e2e.sit.ts']);
    assert.ok(!existsSync(path.join(dest, 'sit/cases/71-e2e.sit.ts')));
    assert.ok(existsSync(path.join(dest, 'sit/cases/90-agents.sit.ts')));
  });

  it('ignores CRLF vs LF differences', () => {
    assert.equal(hashContent(Buffer.from('a\r\nb\r\n')), hashContent(Buffer.from('a\nb\n')));
  });
});
