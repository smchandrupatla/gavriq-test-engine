/**
 * Execute an imported SIT case file (sit/cases/*.sit.ts) via node/tsx --test.
 * Script field formats from import-sit-catalog:
 *   sit/cases/00-health.sit.ts
 *   sit/cases/00-health.sit.ts::Health endpoint returns 200
 *   sit/cases/60-gui-smoke.sit.ts::GUI page ${page.path} is served after deploy
 *
 * The last form is a parameterised test: the importer recorded the template
 * literal from the source, so the placeholder stands for every generated
 * instance (one per page) and the case passes only when all of them pass.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SitRunInput {
  script: string;
  baseUrl?: string;
  /**
   * Environment variables of the selected environment (web/api/testhub/
   * dbviewer/tenant/username/password). Mapped onto the SIT_* contract that
   * sit/lib/env.ts reads, so a SIT case targets the same deployment as every
   * other runner instead of its compiled-in compose hostnames.
   */
  vars?: Record<string, string>;
  timeoutSeconds?: number;
  /** Aborted when the run is cancelled: the case's process tree and any browser it left open are killed. */
  signal?: AbortSignal;
  /**
   * Where `sit/cases/…` is read from. The application team's SIT suite belongs to a
   * commit: run against a deployment, it must be the suite of the commit deployed
   * there, not whatever copy this repository last synced. Set by the worker from
   * the environment's recorded deployment (sitSourceRoot); when absent the copy
   * bundled with the worker is used.
   */
  sourceRoot?: string;
}

/** One SIT file run once for several catalogue cases (each case = one test of the file). */
export interface SitGroupInput extends Omit<SitRunInput, 'script'> {
  /** `sit/cases/<file>.sit.ts` */
  file: string;
  /** The cases to answer: an id of the caller's choosing and the test name (absent = the whole file). */
  tests: Array<{ id: string; name?: string }>;
}

export interface SitRunResult {
  status: 'passed' | 'failed' | 'error' | 'skipped';
  message: string;
  duration_ms: number;
  classification?: string;
  metrics?: Record<string, unknown>;
  /** Raw TAP output of the run (truncated), kept as the case's evidence. */
  output?: string;
  remarks?: string[];
}

const MAX_OUTPUT = 200_000;

// apps/worker/src/runners → repo root is FOUR levels up.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function parseScript(script: string): { fileRel: string; testName?: string } | null {
  const s = script.trim();
  if (!s.startsWith('sit/cases/') && !s.includes('.sit.ts')) return null;
  const [filePart, ...rest] = s.split('::');
  const fileRel = (filePart || '').trim();
  if (!fileRel) return null;
  const testName = rest.length ? rest.join('::').trim() : undefined;
  return { fileRel, testName };
}

/** Regex source for one test name, unanchored; `${...}` placeholders match any text. */
function nameSource(testName: string): string {
  return testName
    .split(/\$\{[^}]*\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.+');
}

/** Anchored regex for one test name; `${...}` placeholders match any text. */
export function namePattern(testName: string): string {
  return `^${nameSource(testName)}$`;
}

/**
 * The SIT source of a deployed commit, when the worker has it: exported sources
 * live under SIT_SOURCES_DIR (default `<worker root>/sbe-src`, where the compose
 * file mounts the staging exports) in a folder named after the first twelve
 * characters of the commit — the layout deploy/staging/deploy.mjs writes.
 */
export function sitSourceRoot(commit: unknown): string | undefined {
  if (typeof commit !== 'string' || commit.length < 12) return undefined;
  const base = process.env.SIT_SOURCES_DIR || path.join(root, 'sbe-src');
  const dir = path.join(base, commit.slice(0, 12));
  return existsSync(path.join(dir, 'sit', 'cases')) ? dir : undefined;
}

/**
 * The 61-63 screen/field/workflow cases speak raw WebDriver to SIT_SELENIUM_URL
 * and skip themselves when nothing answers there. ChromeDriver is itself a
 * WebDriver server, so the worker starts the one in its image on a free port
 * and keeps it for the life of the process; without this every one of those
 * cases reports "skipped" and the screens are never actually opened.
 */
let driver: { url: string; child: ChildProcess } | null = null;

async function driverReady(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/status`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

async function seleniumUrl(): Promise<string | undefined> {
  if (process.env.SIT_SELENIUM_URL) return process.env.SIT_SELENIUM_URL;
  if (driver && (await driverReady(driver.url))) return driver.url;
  driver = null;

  const bin = process.env.SIT_CHROMEDRIVER_PATH || process.env.CHROMEDRIVER_PATH;
  if (!bin || !existsSync(bin)) return undefined;

  const port = await freePort();
  // Own process group: the browsers it launches belong to it, not to the case
  // that asked for them, so the whole group can be taken down together.
  const child = spawn(bin, [`--port=${port}`], { stdio: 'ignore', detached: process.platform !== 'win32' });
  child.on('exit', () => {
    if (driver?.child === child) driver = null;
  });
  process.once('exit', () => killTree(child.pid));
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await driverReady(url)) {
      driver = { url, child };
      return url;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  return undefined;
}

/**
 * Does this case file drive a browser through the raw WebDriver helpers? Most
 * files reach them through another helper in sit/lib/selenium (feeder-nav, flow,
 * console, …) rather than importing webdriver.mjs themselves, so any import from
 * that folder counts; without a driver URL those cases skip themselves.
 */
function usesRawWebDriver(abs: string): boolean {
  try {
    return /lib\/selenium\/|SIT_SELENIUM_URL/.test(readFileSync(abs, 'utf8'));
  } catch {
    return false;
  }
}

function sitEnv(input: SitRunInput): NodeJS.ProcessEnv {
  const vars = input.vars || {};
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Set by node:test for the files it runs; inherited, it makes the SIT file's own
  // `node --test` believe it is a nested run and skip every test.
  delete env.NODE_TEST_CONTEXT;
  const set = (name: string, value: string | undefined) => {
    if (value !== undefined && value !== '') env[name] = value;
  };
  set('SIT_WEB_BASE', vars.web || input.baseUrl);
  set('TARGET_BASE_URL', vars.web || input.baseUrl);
  set('SIT_API_BASE', vars.api);
  set('SIT_TESTHUB_BASE', vars.testhub);
  set('SIT_DBVIEWER_BASE', vars.dbviewer);
  set('SIT_AURORA_BASE', vars.aurora);
  // A few business end-to-end files read these older names for the same two targets.
  set('SBE_API_BASE', vars.api);
  set('SBE_GUI_BASE', vars.web || input.baseUrl);
  set('WEB_BASE', vars.web || input.baseUrl);
  set('SIT_TENANT_SLUG', vars.tenant);
  // The application team's suite is written for the administrator (its own default
  // is admin): it creates the throwaway users and tenants its cases need. An
  // environment that names an administrator runs the suite as that identity; one
  // that does not (an older registration) keeps its single username.
  const asAdmin = vars.admin_username !== undefined && vars.admin_username !== '';
  set('SIT_USERNAME', asAdmin ? vars.admin_username : vars.username);
  // An empty password is meaningful (passwordless demo sign-in), so it is
  // forwarded as-is rather than dropped by set().
  const password = asAdmin ? vars.admin_password : vars.password;
  if (password !== undefined && env.SIT_PASSWORD === undefined) env.SIT_PASSWORD = password;
  // The worker image pins one Chrome/ChromeDriver pair for every runner.
  set('SIT_CHROME_BINARY', process.env.SIT_CHROME_BINARY || process.env.CHROME_BIN);
  set('SIT_CHROMEDRIVER_PATH', process.env.SIT_CHROMEDRIVER_PATH || process.env.CHROMEDRIVER_PATH);
  set('SIT_CHROMIUM_PATH', process.env.SIT_CHROMIUM_PATH || process.env.CHROME_BIN);
  return env;
}

function killTree(pid: number | undefined) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']);
    else process.kill(-pid, 'SIGKILL');
  } catch {
    /* already gone */
  }
}

/**
 * A case that is killed (timeout, cancel) or crashes never sends the WebDriver
 * "delete session", so the browser it opened on the shared ChromeDriver would
 * run forever. The driver and every browser under it are dropped instead; the
 * next case that needs one starts a fresh driver.
 */
function recycleDriver() {
  if (!driver) return;
  const stale = driver;
  driver = null;
  killTree(stale.child.pid);
}

interface TapSummary {
  tests: number;
  pass: number;
  fail: number;
  skipped: number;
  lines: string[];
  errors: string[];
}

function parseTap(stdout: string): TapSummary {
  const count = (name: string) => Number(new RegExp(`^# ${name} (\\d+)`, 'm').exec(stdout)?.[1] ?? 0);
  const all = stdout.split(/\r?\n/);
  const lines = all.filter((l) => /^(ok|not ok) /.test(l));
  // First line of each top-level failure's `error:` field (block scalars put
  // the text on the following line).
  const errors: string[] = [];
  for (let i = 0; i < all.length; i++) {
    if (!/^not ok /.test(all[i]!)) continue;
    const name = all[i]!.replace(/^not ok \d+ - /, '');
    let detail = '';
    for (let j = i + 1; j < all.length && !/^(ok|not ok) /.test(all[j]!); j++) {
      const m = /^\s+error: (.*)$/.exec(all[j]!);
      if (!m) continue;
      detail = /^[|>]/.test(m[1]!) ? (all[j + 1] || '').trim() : m[1]!.replace(/^['"]|['"]$/g, '');
      break;
    }
    errors.push(detail ? `${name}: ${detail}` : name);
  }
  return { tests: count('tests'), pass: count('pass'), fail: count('fail'), skipped: count('skipped'), lines, errors };
}

export async function runSit(input: SitRunInput): Promise<SitRunResult> {
  const start = Date.now();
  const parsed = parseScript(input.script || '');
  if (!parsed) {
    return {
      status: 'skipped',
      message: `Not a SIT script path: ${input.script}`,
      duration_ms: Date.now() - start,
      classification: 'script_problem',
    };
  }

  const base = input.sourceRoot || root;
  const abs = path.join(base, parsed.fileRel);
  if (!existsSync(abs)) {
    return {
      status: 'failed',
      message: `SIT file not found: ${parsed.fileRel}${input.sourceRoot ? ' in the suite of the deployed commit' : ''}`,
      duration_ms: Date.now() - start,
      classification: 'script_problem',
    };
  }

  const tsxBin = path.join(root, 'node_modules/tsx/dist/cli.mjs');
  // A whole file or a parameterised name is dozens of tests (one browser
  // session per page), so it gets a multiple of the single-test budget.
  const multi = !parsed.testName || /\$\{/.test(parsed.testName);
  const timeoutSeconds = (input.timeoutSeconds || 120) * (multi ? 4 : 1);
  const timeoutMs = timeoutSeconds * 1000;
  const extra = parsed.testName ? ['--test-name-pattern', namePattern(parsed.testName)] : [];

  const args = existsSync(tsxBin)
    ? [tsxBin, '--test', '--test-reporter=tap', ...extra, abs]
    : ['--test', '--test-reporter=tap', '--experimental-strip-types', ...extra, abs];

  const env = sitEnv(input);
  const sharedDriver = usesRawWebDriver(abs);
  if (sharedDriver) {
    const url = await seleniumUrl();
    if (url) env.SIT_SELENIUM_URL = url;
  }
  if (!env.SIT_EVIDENCE_DIR && process.env.EVIDENCE_DIR) env.SIT_EVIDENCE_DIR = process.env.EVIDENCE_DIR;

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: base,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Own process group, so a timeout also takes down the browsers and
      // drivers the case started rather than leaking them into later cases.
      detached: process.platform !== 'win32',
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result: SitRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', onAbort);
      resolve({ ...result, output: (stdout || stderr).slice(0, MAX_OUTPUT) });
    };
    const metrics = { file: parsed.fileRel, test_name: parsed.testName || null };
    /** Stop the case now: its own process tree, and the browsers it left on the shared driver. */
    const stop = () => {
      killTree(child.pid);
      if (sharedDriver) recycleDriver();
    };
    const onAbort = () => {
      stop();
      finish({ status: 'error', message: 'Run cancelled', duration_ms: Date.now() - start, classification: 'unknown', metrics });
    };
    const timer = setTimeout(() => {
      stop();
      finish({
        status: 'failed',
        message: `SIT timed out after ${timeoutSeconds}s`,
        duration_ms: Date.now() - start,
        classification: 'timeout',
        metrics,
      });
    }, timeoutMs);
    if (input.signal?.aborted) onAbort();
    else input.signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', (err) => {
      finish({
        status: 'error',
        message: err.message,
        duration_ms: Date.now() - start,
        classification: 'environment_problem',
        metrics,
      });
    });
    child.on('close', (code) => {
      // A case that died without a clean exit may not have closed its browser session.
      if (sharedDriver && code !== 0 && !settled) recycleDriver();
      const tap = parseTap(stdout);
      const counts = { ...metrics, exit_code: code, tests: tap.tests, passed: tap.pass, failed: tap.fail, skipped: tap.skipped };
      const duration_ms = Date.now() - start;

      // A filter that matches nothing exits 0 with zero tests: that is a
      // stale catalogue entry, never a pass.
      if (code === 0 && tap.tests === 0) {
        return finish({
          status: 'failed',
          message: parsed.testName
            ? `No test in ${parsed.fileRel} is named "${parsed.testName}" — the case file changed since it was imported`
            : `${parsed.fileRel} contains no tests`,
          duration_ms,
          classification: 'script_problem',
          metrics: counts,
        });
      }

      const ok = code === 0 && tap.fail === 0;
      if (ok) {
        const ran = tap.pass + tap.skipped;
        return finish({
          status: tap.pass === 0 ? 'skipped' : 'passed',
          message:
            tap.lines.length === 1
              ? tap.lines[0]!.replace(/^ok \d+ - /, '')
              : `${tap.pass}/${ran} passed${tap.skipped ? `, ${tap.skipped} skipped` : ''}`,
          duration_ms,
          metrics: counts,
        });
      }

      const loadFailure = /ERR_MODULE_NOT_FOUND|Cannot find (module|package)|SyntaxError/.exec(stdout + stderr);
      const detail = tap.errors.slice(0, 4).join(' | ');
      finish({
        status: 'failed',
        message: (detail || stderr.trim().slice(0, 400) || `exit ${code}`).slice(0, 900),
        duration_ms,
        classification: loadFailure
          ? 'script_problem'
          : /fetch failed|ECONNREFUSED|ENOTFOUND|net::ERR/i.test(stdout + stderr)
            ? 'network_failure'
            : 'assertion_failure',
        metrics: counts,
      });
    });
  });
}

/** One reported test of a TAP stream, at any nesting depth. */
export interface TapTest {
  name: string;
  ok: boolean;
  skipped: boolean;
  depth: number;
  duration_ms?: number;
  /** First line of the failure's `error:` field. */
  error?: string;
  /** The test's own lines of the stream (result line and its detail block). */
  block: string;
}

/** Every `ok` / `not ok` line of a node:test TAP stream with its detail block. */
export function parseTapTests(stdout: string): TapTest[] {
  const lines = stdout.split(/\r?\n/);
  const head = /^(\s*)(ok|not ok) \d+ - (.*)$/;
  const tests: TapTest[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = head.exec(lines[i]!);
    if (!m) continue;
    let name = m[3]!;
    let skipped = false;
    const directive = /\s+# (SKIP|TODO)\b.*$/i.exec(name);
    if (directive) {
      // A TODO test is a known, tracked defect: node:test does not count its failure
      // (exit code 0). It is reported as not run (skipped) with its ticket in the name,
      // and a TODO that passes counts as a pass.
      skipped = /skip/i.test(directive[1]!) || (/todo/i.test(directive[1]!) && m[2] === 'not ok');
      name = name.slice(0, directive.index);
    }
    const block = [lines[i]!];
    let duration: number | undefined;
    let error: string | undefined;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]!;
      if (head.test(line) || /^\s*# Subtest: /.test(line) || /^\s*1\.\.\d+/.test(line)) break;
      block.push(line);
      const d = /^\s+duration_ms: ([\d.]+)/.exec(line);
      if (d) duration = Number(d[1]);
      const e = /^\s+error: (.*)$/.exec(line);
      if (e && error === undefined) error = /^[|>]/.test(e[1]!) ? (lines[j + 1] || '').trim() : e[1]!.replace(/^['"]|['"]$/g, '');
      if (/^\s+\.\.\.\s*$/.test(line)) break;
    }
    tests.push({
      // The reporter escapes "#" and "\" in a test name.
      name: name.trim().replace(/\\([#\\])/g, '$1'),
      ok: m[2] === 'ok',
      skipped,
      depth: Math.floor(m[1]!.length / 4),
      duration_ms: duration,
      error,
      block: block.join('\n'),
    });
  }
  return tests;
}

/**
 * Run one SIT file ONCE and answer several catalogue cases from it — each case
 * is one test of the file. The application team writes a file's tests to share
 * one signed-in session (and one browser); run test by test, every case would
 * sign in again and start its own browser, which is slow and, on an application
 * that caps sessions per user, ends the sessions of the cases before it.
 *
 * Returns one result per requested id. A test the file does not have is a stale
 * catalogue entry and fails as such; a file that never got as far as running its
 * tests fails every case with the reason.
 */
export async function runSitGroup(input: SitGroupInput): Promise<Map<string, SitRunResult>> {
  const start = Date.now();
  const results = new Map<string, SitRunResult>();
  const answerAll = (result: SitRunResult) => {
    for (const t of input.tests) if (!results.has(t.id)) results.set(t.id, result);
    return results;
  };

  const base = input.sourceRoot || root;
  const abs = path.join(base, input.file);
  if (!existsSync(abs)) {
    return answerAll({
      status: 'failed',
      message: `SIT file not found: ${input.file}${input.sourceRoot ? ' in the suite of the deployed commit' : ''}`,
      duration_ms: 0,
      classification: 'script_problem',
    });
  }

  const wholeFile = input.tests.some((t) => !t.name);
  const names = [...new Set(input.tests.map((t) => t.name).filter((n): n is string => !!n))];
  const extra = wholeFile || !names.length ? [] : ['--test-name-pattern', `^(?:${names.map(nameSource).join('|')})$`];
  // Each test keeps its own budget; a whole file, like a parameterised name, is many tests.
  const perTest = input.timeoutSeconds || 120;
  const timeoutSeconds = Math.min(4 * 3600, perTest * Math.max(wholeFile ? 4 : 1, names.length));
  const tsxBin = path.join(root, 'node_modules/tsx/dist/cli.mjs');
  const args = existsSync(tsxBin)
    ? [tsxBin, '--test', '--test-reporter=tap', ...extra, abs]
    : ['--test', '--test-reporter=tap', '--experimental-strip-types', ...extra, abs];

  const env = sitEnv({ ...input, script: input.file });
  const sharedDriver = usesRawWebDriver(abs);
  if (sharedDriver) {
    const url = await seleniumUrl();
    if (url) env.SIT_SELENIUM_URL = url;
  }
  if (!env.SIT_EVIDENCE_DIR && process.env.EVIDENCE_DIR) env.SIT_EVIDENCE_DIR = process.env.EVIDENCE_DIR;

  const run = await new Promise<{ code: number | null; stdout: string; stderr: string; ended: 'exit' | 'timeout' | 'cancelled' | 'error'; error?: string }>((resolve) => {
    const child = spawn(process.execPath, args, { cwd: base, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (ended: 'exit' | 'timeout' | 'cancelled' | 'error', code: number | null, error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', onAbort);
      resolve({ code, stdout, stderr, ended, error });
    };
    const stop = () => {
      killTree(child.pid);
      if (sharedDriver) recycleDriver();
    };
    const onAbort = () => { stop(); finish('cancelled', null); };
    const timer = setTimeout(() => { stop(); finish('timeout', null); }, timeoutSeconds * 1000);
    if (input.signal?.aborted) onAbort();
    else input.signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', (err) => finish('error', null, err.message));
    child.on('close', (code) => {
      if (sharedDriver && code !== 0 && !settled) recycleDriver();
      finish('exit', code);
    });
  });

  const tests = parseTapTests(run.stdout);
  const elapsed = Date.now() - start;
  const loadFailure = /ERR_MODULE_NOT_FOUND|Cannot find (module|package)|SyntaxError/.exec(run.stdout + run.stderr);
  const cap = (text: string) => text.slice(0, MAX_OUTPUT);

  for (const t of input.tests) {
    const metrics = { file: input.file, test_name: t.name || null, exit_code: run.code, ran_with: input.tests.length };
    const matched = t.name
      ? tests.filter((x) => new RegExp(namePattern(t.name!)).test(x.name))
      : tests.filter((x) => x.depth === 0);
    if (!matched.length) {
      if (run.ended === 'cancelled') {
        results.set(t.id, { status: 'error', message: 'Run cancelled', duration_ms: elapsed, classification: 'unknown', metrics });
      } else if (run.ended === 'timeout') {
        results.set(t.id, { status: 'failed', message: `SIT timed out after ${timeoutSeconds}s before this test reported`, duration_ms: elapsed, classification: 'timeout', metrics, output: cap(run.stdout || run.stderr) });
      } else if (run.ended === 'error') {
        results.set(t.id, { status: 'error', message: run.error || 'could not start the SIT file', duration_ms: elapsed, classification: 'environment_problem', metrics });
      } else if (!tests.length && run.code !== 0) {
        results.set(t.id, {
          status: 'failed',
          message: (run.stderr.trim().slice(0, 400) || `the SIT file exited ${run.code} before running a test`).slice(0, 900),
          duration_ms: elapsed,
          classification: loadFailure ? 'script_problem' : 'environment_problem',
          metrics,
          output: cap(run.stdout || run.stderr),
        });
      } else {
        results.set(t.id, {
          status: 'failed',
          message: t.name
            ? `No test in ${input.file} is named "${t.name}" — the case file changed since it was imported`
            : `${input.file} contains no tests`,
          duration_ms: 0,
          classification: 'script_problem',
          metrics,
        });
      }
      continue;
    }
    const failed = matched.filter((x) => !x.ok);
    const ranOk = matched.filter((x) => x.ok && !x.skipped);
    const text = matched.map((x) => x.block).join('\n');
    const duration_ms = Math.round(matched.reduce((n, x) => n + (x.duration_ms || 0), 0));
    const counts = { ...metrics, tests: matched.length, passed: ranOk.length, failed: failed.length, skipped: matched.length - ranOk.length - failed.length };
    if (failed.length) {
      results.set(t.id, {
        status: 'failed',
        message: failed.slice(0, 4).map((x) => (x.error ? `${x.name}: ${x.error}` : x.name)).join(' | ').slice(0, 900),
        duration_ms,
        classification: /fetch failed|ECONNREFUSED|ENOTFOUND|net::ERR/i.test(text) ? 'network_failure' : 'assertion_failure',
        metrics: counts,
        output: cap(text),
      });
    } else {
      results.set(t.id, {
        status: ranOk.length ? 'passed' : 'skipped',
        message: matched.length === 1 ? matched[0]!.name : `${ranOk.length}/${matched.length} passed${counts.skipped ? `, ${counts.skipped} skipped` : ''}`,
        duration_ms,
        metrics: counts,
        output: cap(text),
      });
    }
  }
  return results;
}

/** The SIT file and test a catalogue script names (`sit/cases/x.sit.ts::test name`), or null when it is not a SIT script. */
export function sitTestOf(script?: string | null): { file: string; name?: string } | null {
  if (!isSitScript(script)) return null;
  const parsed = parseScript(String(script));
  return parsed ? { file: parsed.fileRel, name: parsed.testName } : null;
}

export function isSitScript(script?: string | null): boolean {
  if (!script) return false;
  return script.includes('sit/cases/') || script.endsWith('.sit.ts') || script.includes('.sit.ts::');
}
