/**
 * The application team's SIT suite in the engine: read as an inventory
 * (apps/api/src/sit-inventory.ts) and run from the source of the deployed
 * commit, one file once for all of its cases (apps/worker/src/runners/sit.ts).
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { extractTestNames, listSitTests, sitKeyFor, sitLinkFor, sitMetaFor, sitObjectiveFor, sitScriptFor } from '../apps/api/src/sit-inventory.js';
import { namePattern, parseTapTests, runSitGroup, sitSourceRoot, sitTestOf } from '../apps/worker/src/runners/sit.js';

describe('SIT inventory', () => {
  it('finds tests declared with the usual name, an import alias, or a local wrapper', () => {
    assert.deepEqual(extractTestNames(`import { test } from "node:test";\ntest("first check", async () => {});\ntest('second "quoted" check', () => {});`), ['first check', 'second "quoted" check']);
    assert.deepEqual(extractTestNames('import { after, test as nodeTest } from "node:test";\nnodeTest("aliased", () => {});\n'), ['aliased']);
    // A local wrapper named test wins over the alias: that is why those files declare it.
    assert.deepEqual(
      extractTestNames('import { test as nodeTest } from "node:test";\nfunction test(name: string, fn: () => void) { nodeTest(name, fn); }\ntest("through the wrapper", () => {});\n'),
      ['through the wrapper']
    );
    assert.deepEqual(extractTestNames('import { test } from "node:test";\ntest(`GUI page ${page.path} is served`, () => {});\n'), ['GUI page ${page.path} is served']);
  });

  it('names a test the way the application side does, so both sides agree on it', () => {
    assert.equal(sitKeyFor('00-health', 'main application is healthy'), 'SIT-00_HEALTH-MAIN-APPLICATION-IS-HEALTHY');
    assert.equal(sitKeyFor('97c-aurora-rule-bench', 'TC5'), 'SIT-97C_AURORA_RULE_BENCH-TC5');
    assert.ok(sitKeyFor('76-selenium-navigation-health', 'x'.repeat(300)).length <= 120);
    assert.equal(sitLinkFor('00-health.sit.ts', 'db is up'), 'sit/cases/00-health.sit.ts::db is up (SIT runner, node:test)');
    assert.equal(sitScriptFor('00-health.sit.ts', null), 'sit/cases/00-health.sit.ts');
  });

  it('classifies a file it has no entry for from its name', () => {
    assert.deepEqual(sitMetaFor('00-health'), { suite: 'sit-health', type: 'smoke', method: 'http', tags: [] });
    assert.equal(sitMetaFor('76-selenium-navigation-health').method, 'selenium');
    assert.equal(sitMetaFor('86-pentest-authn').type, 'security');
    assert.deepEqual(sitMetaFor('101-business-use-case-card-payments-fraud-rule-engineering').tags, ['business-use-case']);
    assert.equal(sitMetaFor('78-data-responder-crud').suite, 'sit-78-data-responder-crud');
  });

  it('words the objective for a person: no reference codes, addresses, request verbs or status numbers', () => {
    const nav = sitObjectiveFor('NAV01 Overview opens with its title, highlights its sidebar entry and has no script errors', '76.sit.ts');
    assert.match(nav, /^Confirm that Overview opens with its title/);
    const api = sitObjectiveFor('TCG-GAP2 every gap and waiver route refuses anonymous calls: GET /api/v1/test-coverage/gaps answers 401', '111.sit.ts');
    assert.doesNotMatch(api, /\/api\/v1|GET |401|TCG-GAP2/);
    assert.match(api, /reading the test coverage gaps service answers a sign-in refusal/);
    assert.match(sitObjectiveFor('A user signs in and sees the console', 'x.sit.ts'), /^Confirm that a user signs in/);
    assert.match(sitObjectiveFor(null, '00-health.sit.ts'), /every check in the application team's SIT file 00-health\.sit\.ts/);
  });

  it('lists every test of a suite on disk, and a file with no listable test as one whole-file entry', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'te-sit-inv-'));
    try {
      mkdirSync(path.join(dir, 'sit/cases'), { recursive: true });
      writeFileSync(path.join(dir, 'sit/cases/00-health.sit.ts'), 'import { test } from "node:test";\ntest("a", () => {});\ntest("b", () => {});\ntest("a", () => {});\n');
      writeFileSync(path.join(dir, 'sit/cases/99-computed.sit.ts'), 'import { test } from "node:test";\nfor (const n of names) test(n, () => {});\n');
      const { files, tests } = await listSitTests(dir);
      assert.deepEqual(files, ['00-health.sit.ts', '99-computed.sit.ts']);
      assert.deepEqual(tests.map((t) => `${t.file}::${t.name}`), ['00-health.sit.ts::a', '00-health.sit.ts::b', '99-computed.sit.ts::null']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('SIT results per test', () => {
  const tap = [
    'TAP version 13',
    '# Subtest: passes',
    'ok 1 - passes',
    '  ---',
    '  duration_ms: 12.5',
    "  type: 'test'",
    '  ...',
    '# Subtest: breaks \\# 2',
    'not ok 2 - breaks \\# 2',
    '  ---',
    '  duration_ms: 3',
    "  failureType: 'testCodeFailure'",
    "  error: 'expected 200, got 500'",
    "  code: 'ERR_ASSERTION'",
    '  ...',
    '# Subtest: not here',
    'ok 3 - not here # SKIP Selenium not reachable',
    '  ---',
    '  duration_ms: 0.2',
    '  ...',
    '1..3',
    '# tests 3',
  ].join('\n');

  it('reads each test of a stream: name, verdict, skip, duration, first error line', () => {
    const tests = parseTapTests(tap);
    assert.deepEqual(tests.map((t) => [t.name, t.ok, t.skipped, t.duration_ms, t.error]), [
      ['passes', true, false, 12.5, undefined],
      ['breaks # 2', false, false, 3, 'expected 200, got 500'],
      ['not here', true, true, 0.2, undefined],
    ]);
    assert.match(tests[1]!.block, /ERR_ASSERTION/);
    assert.doesNotMatch(tests[1]!.block, /not here/);
  });

  it('matches a parameterised name against every generated instance', () => {
    const re = new RegExp(namePattern('GUI page ${page.path} is served'));
    assert.ok(re.test('GUI page /index.html is served'));
    assert.ok(!re.test('GUI page /index.html is served twice'));
  });

  it('reads the file and test out of a catalogue script', () => {
    assert.deepEqual(sitTestOf('sit/cases/00-health.sit.ts::main application is healthy'), { file: 'sit/cases/00-health.sit.ts', name: 'main application is healthy' });
    assert.deepEqual(sitTestOf('sit/cases/00-health.sit.ts'), { file: 'sit/cases/00-health.sit.ts', name: undefined });
    assert.equal(sitTestOf('health'), null);
    assert.equal(sitTestOf(''), null);
  });
});

describe('one SIT file, run once for all of its cases', () => {
  let source = '';
  const loads = () => readFileSync(path.join(source, 'loads.txt'), 'utf8').trim().split('\n').length;

  before(() => {
    source = mkdtempSync(path.join(tmpdir(), 'te-sit-src-'));
    mkdirSync(path.join(source, 'sit/cases'), { recursive: true });
    // Appends a line every time the file is loaded, i.e. once per process that runs it.
    writeFileSync(path.join(source, 'sit/cases/10-demo.sit.ts'), [
      'import { test } from "node:test";',
      'import assert from "node:assert/strict";',
      'import { appendFileSync } from "node:fs";',
      'appendFileSync(new URL("../../loads.txt", import.meta.url), "loaded\\n");',
      'test("alpha is fine", () => { assert.equal(process.env.SIT_API_BASE, "http://api.example"); });',
      'test("beta breaks", () => { assert.equal(1, 2, "one is not two"); });',
      'test("gamma is skipped", (t) => { t.skip("nothing to drive a browser with"); });',
      'test("delta is not asked for", () => { throw new Error("must not run"); });',
      'test("signs in as the administrator", () => { assert.equal(process.env.SIT_USERNAME, "admin"); assert.equal(process.env.SIT_PASSWORD, "admin-pw"); });',
    ].join('\n'));
  });
  after(() => rmSync(source, { recursive: true, force: true }));

  it('answers each case from one run of the file', async () => {
    const results = await runSitGroup({
      file: 'sit/cases/10-demo.sit.ts',
      sourceRoot: source,
      baseUrl: 'http://web.example',
      vars: { api: 'http://api.example', username: 'pool.op3', password: 'op-pw', admin_username: 'admin', admin_password: 'admin-pw' },
      timeoutSeconds: 60,
      tests: [
        { id: 'a', name: 'alpha is fine' },
        { id: 'b', name: 'beta breaks' },
        { id: 'c', name: 'gamma is skipped' },
        { id: 'e', name: 'signs in as the administrator' },
        { id: 'x', name: 'a test the file does not have' },
      ],
    });
    assert.equal(loads(), 1, 'the file ran in one process');
    assert.equal(results.get('a')!.status, 'passed', results.get('a')!.message);
    assert.equal(results.get('b')!.status, 'failed');
    assert.match(results.get('b')!.message, /one is not two/);
    assert.equal(results.get('b')!.classification, 'assertion_failure');
    assert.equal(results.get('c')!.status, 'skipped');
    assert.equal(results.get('e')!.status, 'passed', 'the suite runs as the environment\'s administrator');
    assert.equal(results.get('x')!.status, 'failed');
    assert.equal(results.get('x')!.classification, 'script_problem');
    assert.match(results.get('x')!.message, /No test in sit\/cases\/10-demo\.sit\.ts is named/);
    // Each case keeps only its own part of the output as its evidence.
    assert.match(results.get('a')!.output || '', /alpha is fine/);
    assert.doesNotMatch(results.get('a')!.output || '', /beta breaks|delta/);
  });

  it('fails every case with the reason when the file is not in the deployed suite', async () => {
    const results = await runSitGroup({ file: 'sit/cases/404.sit.ts', sourceRoot: source, baseUrl: 'http://web.example', tests: [{ id: 'a', name: 'x' }, { id: 'b', name: 'y' }] });
    for (const id of ['a', 'b']) {
      assert.equal(results.get(id)!.status, 'failed');
      assert.match(results.get(id)!.message, /SIT file not found: sit\/cases\/404\.sit\.ts in the suite of the deployed commit/);
    }
  });

  it('finds the exported source of a deployed commit by its first twelve characters', () => {
    const base = mkdtempSync(path.join(tmpdir(), 'te-sit-exports-'));
    const before = process.env.SIT_SOURCES_DIR;
    try {
      mkdirSync(path.join(base, 'a8d72039ae8e', 'sit', 'cases'), { recursive: true });
      process.env.SIT_SOURCES_DIR = base;
      assert.equal(sitSourceRoot('a8d72039ae8edc7374d41305cab21af44a2c1f25'), path.join(base, 'a8d72039ae8e'));
      assert.equal(sitSourceRoot('ffffffffffffffffffffffffffffffffffffffff'), undefined, 'a commit that was never exported');
      assert.equal(sitSourceRoot(undefined), undefined);
      assert.equal(sitSourceRoot('main'), undefined);
    } finally {
      if (before === undefined) delete process.env.SIT_SOURCES_DIR; else process.env.SIT_SOURCES_DIR = before;
      rmSync(base, { recursive: true, force: true });
    }
  });
});
