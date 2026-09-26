/**
 * What runs behind a test case: classification, source extraction, and the
 * placeholder rule that stops script-less cases from reporting a fake pass.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NAMED_SCRIPTS, RUNNER_FILES, classifyCase, extractNamedScript, extractTestBlock, matchBrace, resolveDefinition,
} from '../apps/api/src/case-definition.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('classifyCase', () => {
  it('treats a seeded case with no script, steps or config as a placeholder', () => {
    const c = classifyCase({ key: 'SB-UNIT-U1-X', execution_method: 'http', script: null, steps: [], validation_rules: {} });
    assert.equal(c.kind, 'placeholder');
    assert.equal(c.executable, false);
    assert.match(c.reason, /only load the base URL/);
  });

  it('flags an unknown named script instead of silently loading the base URL', () => {
    const c = classifyCase({ execution_method: 'selenium', script: 'no_such_script' });
    assert.equal(c.kind, 'placeholder');
    assert.equal(c.executable, false);
  });

  it('recognises SIT files, named scripts, steps and performance profiles', () => {
    assert.equal(classifyCase({ script: 'sit/cases/00-health.sit.ts::Health endpoint returns 200' }).kind, 'sit-file');
    assert.equal(classifyCase({ execution_method: 'selenium', script: 'smoke_home' }).kind, 'named-script');
    assert.equal(classifyCase({ execution_method: 'http', script: 'health' }).kind, 'named-script');
    assert.equal(classifyCase({ execution_method: 'playwright', steps: [{ action: 'navigate' }] }).kind, 'steps');
    const perf = classifyCase({ execution_method: 'performance', validation_rules: { path: '/health', requests: 50 } });
    assert.equal(perf.kind, 'performance');
    assert.equal(perf.executable, true);
    assert.equal(classifyCase({ execution_method: 'endurance', validation_rules: { duration_seconds: 60 } }).runner, 'performance');
  });

  it('treats a performance case with no profile as a placeholder', () => {
    assert.equal(classifyCase({ execution_method: 'performance', validation_rules: {} }).kind, 'placeholder');
  });
});

describe('NAMED_SCRIPTS matches the runner sources', () => {
  for (const runner of ['selenium', 'playwright'] as const) {
    it(`${runner} named scripts`, () => {
      const src = readFileSync(path.join(root, RUNNER_FILES[runner]!), 'utf8');
      const block = src.slice(src.indexOf('Record<string,'), src.indexOf('};', src.indexOf('Record<string,')));
      const defined = [...block.matchAll(/^\s{2}async\s+(\w+)\s*\(/gm)].map((m) => m[1]).sort();
      assert.deepEqual(defined, [...NAMED_SCRIPTS[runner]!].sort());
    });
  }
});

describe('source extraction', () => {
  it('matches braces across strings, templates and comments', () => {
    const src = 'x = { a: "}", b: `${ {c:1}.c }}`, // }\n d: /* } */ 1 } tail';
    const end = matchBrace(src, src.indexOf('{'));
    assert.equal(src.slice(end), ' tail');
  });

  it('extracts one test block from a SIT file', () => {
    const src = [
      "import test from 'node:test';",
      "test('first one', async () => {",
      "  const s = '}';",
      '  assert.ok(true);',
      '});',
      'test("second", async () => {',
      '  assert.equal(1, 1);',
      '});',
    ].join('\n');
    const block = extractTestBlock(src, 'first one');
    assert.ok(block?.startsWith("test('first one'"));
    assert.ok(block?.endsWith('});'));
    assert.ok(!block?.includes('second'));
    assert.equal(extractTestBlock(src, 'missing'), null);
  });

  it('extracts a named selenium script from the real runner', () => {
    const src = readFileSync(path.join(root, RUNNER_FILES.selenium!), 'utf8');
    const block = extractNamedScript(src, 'selenium', 'smoke_home');
    assert.ok(block?.includes('async smoke_home'));
    assert.ok(!block?.includes('nav_to_login'));
  });
});

describe('resolveDefinition', () => {
  it('returns the SIT test source for an imported case', () => {
    const def = resolveDefinition({ script: 'sit/cases/00-health.sit.ts' }, root);
    assert.equal(def.kind, 'sit-file');
    assert.equal(def.file, 'sit/cases/00-health.sit.ts');
    assert.ok(def.source && def.source.length > 50);
    assert.equal(def.language, 'typescript');
  });

  it('marks a SIT case stale when its test is no longer in the file', () => {
    const def = resolveDefinition({ script: 'sit/cases/00-health.sit.ts::this test does not exist' }, root);
    assert.equal(def.executable, false);
    assert.match(def.reason, /stale import/);
  });

  it('refuses paths outside the repository', () => {
    const def = resolveDefinition({ script: 'sit/cases/../../../../etc/passwd.sit.ts' }, root);
    assert.equal(def.executable, false);
    assert.equal(def.file_source, null);
  });

  it('returns the performance profile and runner body', () => {
    const def = resolveDefinition({ execution_method: 'performance', validation_rules: { path: '/health', requests: 10 } }, root);
    assert.equal(def.kind, 'performance');
    assert.deepEqual(def.config, { path: '/health', requests: 10 });
    assert.ok(def.file_source?.includes('export async function runPerformance'));
  });
});
