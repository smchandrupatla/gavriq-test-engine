/**
 * Engine-owned SIT files (sit/cases/*-te-*.sit.ts) are not part of the application's
 * deployed export, so the runner must fall back to the worker's own copy for them,
 * and only for them.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sitBaseFor } from '../apps/worker/src/runners/sit.js';

const repoRoot = path.resolve(import.meta.dirname, '..');

function exportWith(...files: string[]): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'gte-sit-export-'));
  for (const f of files) {
    mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    writeFileSync(path.join(dir, f), '// x\n');
  }
  return dir;
}

describe('sitBaseFor', () => {
  it('uses the worker copy when no deployed export is recorded', () => {
    assert.equal(sitBaseFor(undefined, 'sit/cases/86-te-pentest.sit.ts'), repoRoot);
  });

  it('runs an engine-owned file from the worker copy when the export lacks it', () => {
    const dir = exportWith('sit/cases/10-other.sit.ts');
    for (const f of ['00-te-smoke-gates', '50-te-audit-integrity', '50-te-detection-rules', '50-te-message-quality', '86-te-pentest']) {
      assert.equal(sitBaseFor(dir, `sit/cases/${f}.sit.ts`), repoRoot, f);
    }
  });

  it('keeps the deployed export for files it contains, engine-owned or not', () => {
    const dir = exportWith('sit/cases/10-other.sit.ts', 'sit/cases/86-te-pentest.sit.ts');
    assert.equal(sitBaseFor(dir, 'sit/cases/10-other.sit.ts'), dir);
    assert.equal(sitBaseFor(dir, 'sit/cases/86-te-pentest.sit.ts'), dir);
  });

  it('does not borrow an application file the export lacks (that stays a "not found")', () => {
    const dir = exportWith('sit/cases/10-other.sit.ts');
    assert.equal(sitBaseFor(dir, 'sit/cases/74f-selenium-create-schema-iso-catalog.sit.ts'), dir);
    assert.equal(sitBaseFor(dir, 'sit/cases/99-te-missing.sit.ts'), dir);
  });
});
