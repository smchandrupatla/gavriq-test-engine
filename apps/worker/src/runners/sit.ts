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
}

export interface SitRunResult {
  status: 'passed' | 'failed' | 'error' | 'skipped';
  message: string;
  duration_ms: number;
  classification?: string;
  metrics?: Record<string, unknown>;
  /** Raw TAP output of the run (truncated), kept as the case's evidence. */
  output?: string;
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

/** Anchored regex for one test name; `${...}` placeholders match any text. */
export function namePattern(testName: string): string {
  const literal = testName
    .split(/\$\{[^}]*\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return `^${literal.join('.+')}$`;
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
  const child = spawn(bin, [`--port=${port}`], { stdio: 'ignore' });
  child.on('exit', () => {
    if (driver?.child === child) driver = null;
  });
  process.once('exit', () => child.kill());
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

function usesRawWebDriver(abs: string): boolean {
  try {
    return readFileSync(abs, 'utf8').includes('lib/selenium/webdriver.mjs');
  } catch {
    return false;
  }
}

function sitEnv(input: SitRunInput): NodeJS.ProcessEnv {
  const vars = input.vars || {};
  const env: NodeJS.ProcessEnv = { ...process.env };
  const set = (name: string, value: string | undefined) => {
    if (value !== undefined && value !== '') env[name] = value;
  };
  set('SIT_WEB_BASE', vars.web || input.baseUrl);
  set('TARGET_BASE_URL', vars.web || input.baseUrl);
  set('SIT_API_BASE', vars.api);
  set('SIT_TESTHUB_BASE', vars.testhub);
  set('SIT_DBVIEWER_BASE', vars.dbviewer);
  set('SIT_TENANT_SLUG', vars.tenant);
  set('SIT_USERNAME', vars.username);
  // An empty password is meaningful (passwordless demo sign-in), so it is
  // forwarded as-is rather than dropped by set().
  if (vars.password !== undefined && env.SIT_PASSWORD === undefined) env.SIT_PASSWORD = vars.password;
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

  const abs = path.join(root, parsed.fileRel);
  if (!existsSync(abs)) {
    return {
      status: 'failed',
      message: `SIT file not found: ${parsed.fileRel}`,
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
  if (usesRawWebDriver(abs)) {
    const url = await seleniumUrl();
    if (url) env.SIT_SELENIUM_URL = url;
  }
  if (!env.SIT_EVIDENCE_DIR && process.env.EVIDENCE_DIR) env.SIT_EVIDENCE_DIR = process.env.EVIDENCE_DIR;

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
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
      resolve({ ...result, output: (stdout || stderr).slice(0, MAX_OUTPUT) });
    };
    const metrics = { file: parsed.fileRel, test_name: parsed.testName || null };
    const timer = setTimeout(() => {
      killTree(child.pid);
      finish({
        status: 'failed',
        message: `SIT timed out after ${timeoutSeconds}s`,
        duration_ms: Date.now() - start,
        classification: 'timeout',
        metrics,
      });
    }, timeoutMs);

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

export function isSitScript(script?: string | null): boolean {
  if (!script) return false;
  return script.includes('sit/cases/') || script.endsWith('.sit.ts') || script.includes('.sit.ts::');
}
