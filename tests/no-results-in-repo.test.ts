/**
 * Test results, evidence and screenshots belong in the engine's database, never in git.
 * Fails when one is tracked, or when the API evidence store writes to disk again.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);

describe('no test results in the repository', () => {
  it('tracks no evidence, screenshot or result files', () => {
    const offenders = tracked.filter((f) =>
      /^evidence\//.test(f) ||
      /^sit\/public\/evidence\//.test(f) ||
      /^\.tmp\/.*\.(png|jpe?g|json)$/.test(f) ||
      /(^|\/)(test-results|playwright-report)\//.test(f) ||
      /(^|\/)[\w.-]*-results?\.json$/.test(f) ||
      /\.(png|jpe?g|webm|har)$/.test(f) && /screenshot|evidence|overview|fail-/.test(f)
    );
    assert.deepEqual(offenders, [], 'results/evidence must be recorded in the database, not committed');
  });

  it('keeps the API evidence store off the filesystem', () => {
    const src = readFileSync('apps/api/src/evidence-store.ts', 'utf8');
    assert.ok(!/writeFileSync|mkdirSync/.test(src), 'evidence-store.ts must store bytes in evidence_blobs');
    assert.ok(/evidence_blobs/.test(src));
  });
});
