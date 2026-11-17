#!/usr/bin/env tsx
/**
 * Author-time harness: run catalogue cases through the worker's own runners
 * against a live deployment, without the engine queue in between. A case is
 * prepared exactly as the seeder prepares it (cleanup attached, sign-in rules
 * applied, plain-language step fields added) and executed the way the worker
 * executes it (pre-flight shape check, main steps, cleanup, identity lane), so
 * a pass here means the stored case will pass on a worker. It writes nothing to
 * the engine: no reseed, no execution rows.
 *
 *   npx tsx dev/scripts/run-catalog-local.ts --suite sb-smoke
 *   npx tsx dev/scripts/run-catalog-local.ts --key SB-PT-LOGIN-EMPTY,SB-PT-LOGIN-INJECTION
 *   npx tsx dev/scripts/run-catalog-local.ts --file sandbench-portal-cases --method http
 *
 *   --app <key>       sand-bench (default) | gavriq-test-engine
 *   --suite <a,b>     suite keys
 *   --key <a,b>       case keys; a trailing * matches a prefix (SB-API-GET-*)
 *   --file <text>     catalogue module the case is defined in (part of its path)
 *   --method <m>      http | playwright | selenium | performance | e2e
 *   --env <key>       engine environment whose targets and identities are used
 *                     (default sand-bench-staging; read from TE_BASE, default :8797)
 *   --lane <n>        identity lane to sign in with (default: the environment's last
 *                     lane, the one a running worker is least likely to hold). Two
 *                     harness runs at the same time must use different lanes.
 *   --list            print the matching case keys and stop
 *   --verbose         print every step remark, not only those of failures
 *   --json <file>     also write the results as JSON
 *
 * Targets are used as registered (http://127.0.0.1:…), so this runs on the host.
 * Browser cases need the Playwright browsers installed on the host
 * (node node_modules/playwright/cli.js install chromium firefox webkit).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SANDBENCH_ALL_CASES, SANDBENCH_ALL_SUITES } from '../../apps/api/src/catalog/sandbench-catalog.js';
import { ENGINE_CASES, ENGINE_SUITES } from '../../apps/api/src/catalog/engine-cases.js';
import { screenFields, type AppContext } from '../../apps/api/src/catalog/plain-language.js';
import { annotateAppendOnlyCases, autoAttachCleanups } from '../../apps/api/src/catalog/user-pool.js';
import { applySandbenchIdentityRules } from '../../apps/api/src/catalog/sandbench-identity.js';
import { validateCaseShape } from '../../apps/worker/src/case-shape.js';
import { withIdentityLane } from '../../apps/worker/src/identity-lane.js';
import type { CaseDef, SuiteDef } from '../../apps/api/src/catalog/types.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// The runners read EVIDENCE_DIR when they load: point it at a scratch folder before importing them.
process.env.EVIDENCE_DIR ||= path.join(root, '.tmp', 'harness-evidence');
mkdirSync(process.env.EVIDENCE_DIR, { recursive: true });
const { runHttp } = await import('../../apps/worker/src/runners/http.js');
const { runPlaywright, closeBrowserPool } = await import('../../apps/worker/src/runners/playwright.js');
const { runSelenium } = await import('../../apps/worker/src/runners/selenium.js');
const { runPerformance } = await import('../../apps/worker/src/runners/performance.js');

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(`--${name}`);
const list = (value: string | undefined) => (value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []);

const app = opt('app') || 'sand-bench';
const engine = (process.env.TE_BASE || 'http://127.0.0.1:8797').replace(/\/$/, '');
const envKey = opt('env') || (app === 'gavriq-test-engine' ? 'engine-local' : 'sand-bench-staging');

const APP_CONTEXT: Record<string, AppContext> = {
  'sand-bench': { appKey: 'sand-bench', defaultEnvironment: 'sand-bench-local', team: 'Sand Bench team' },
  'gavriq-test-engine': { appKey: 'gavriq-test-engine', defaultEnvironment: 'engine-local', fixtureEnvironment: 'engine-staging', team: 'Test Engine team' },
};

async function environmentVars(): Promise<{ vars: Record<string, string>; baseUrl: string }> {
  const res = await fetch(`${engine}/api/v1/environments/${encodeURIComponent(envKey)}`).catch(() => null);
  if (!res?.ok) throw new Error(`environment "${envKey}" could not be read from ${engine} (HTTP ${res?.status ?? 'no answer'})`);
  const env = ((await res.json()) as any).data || {};
  const cfg = env.config || {};
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg.vars || {})) vars[k] = String(v);
  for (const [k, name] of Object.entries(cfg.secret_env || {})) {
    const value = process.env[String(name)];
    if (value !== undefined) vars[k] = value;
  }
  const lanes = Object.keys(vars).map((k) => /^pool_user_(\d+)$/.exec(k)?.[1]).filter((n): n is string => !!n).map(Number);
  const lane = opt('lane') !== undefined ? Number(opt('lane')) : lanes.length ? Math.max(...lanes) : undefined;
  return { vars: withIdentityLane(vars, lane), baseUrl: String(env.base_url || vars.web || '') };
}

function prepared(): { cases: CaseDef[]; suites: SuiteDef[] } {
  const source = app === 'gavriq-test-engine' ? ENGINE_CASES : SANDBENCH_ALL_CASES;
  const cases = structuredClone(source) as CaseDef[];
  annotateAppendOnlyCases(cases);
  autoAttachCleanups(cases);
  if (app === 'sand-bench') applySandbenchIdentityRules(cases);
  return { cases, suites: app === 'gavriq-test-engine' ? ENGINE_SUITES : SANDBENCH_ALL_SUITES };
}

const { cases: allCases, suites } = prepared();
const suiteFilter = list(opt('suite'));
const keyFilter = list(opt('key'));
const fileFilter = opt('file');
const methodFilter = opt('method');
const matchesKey = (key: string) => !keyFilter.length || keyFilter.some((k) => (k.endsWith('*') ? key.startsWith(k.slice(0, -1)) : key === k));
const selected = allCases.filter((c) =>
  (!suiteFilter.length || suiteFilter.includes(c.suiteKey)) && matchesKey(c.key) &&
  (!fileFilter || String(c.sourceFile || '').includes(fileFilter)) && (!methodFilter || c.method === methodFilter));

if (flag('list')) {
  for (const c of selected) console.log(`${c.key}\t${c.method}\t${c.suiteKey}`);
  console.log(`${selected.length} case(s)`);
  process.exit(0);
}
if (!selected.length) {
  console.error('No case matches. Use --list to see what a filter selects.');
  process.exit(2);
}

const { vars, baseUrl } = await environmentVars();
console.log(`${selected.length} case(s) on ${envKey} (${vars.api || baseUrl}) as ${vars.username || '(no identity)'}${vars.identity_lane ? `, lane ${vars.identity_lane}` : ''}\n`);

type Outcome = { status: string; message: string; duration_ms: number; remarks?: string[]; classification?: string };

async function runCase(c: CaseDef): Promise<Outcome> {
  const suite = suites.find((s) => s.key === c.suiteKey)!;
  const steps = screenFields(c, suite, APP_CONTEXT[app]!).steps as any[];
  const rules = (c.validationRules || {}) as Record<string, any>;
  const cleanupSteps = (c.cleanupSteps || []) as any[];
  const cleanupTimeoutSeconds = c.cleanupTimeoutSeconds || 30;
  const problem = validateCaseShape({
    execution_method: c.method, steps,
    validation_rules: { cleanup_steps: cleanupSteps, ...(c.atomicityNote ? { atomicity_note: c.atomicityNote } : {}) },
  }, vars);
  if (problem) return { status: 'failed', message: problem, duration_ms: 0, classification: 'atomic_contract_violation' };

  const viewport = rules.viewport && Number(rules.viewport.width) > 0 ? { width: Number(rules.viewport.width), height: Number(rules.viewport.height) || 800 } : undefined;
  const common = { baseUrl, vars, timeoutSeconds: c.timeoutSeconds || 60, steps };
  // Every runner but http leaves cleanup to the worker; do the same here.
  const withCleanup = async (result: Outcome): Promise<Outcome> => {
    if (!cleanupSteps.length) return result;
    const cleanup = await runHttp({ baseUrl, vars, cleanupSteps, cleanupTimeoutSeconds });
    if (cleanup.status === 'passed') return result;
    return { ...result, status: result.status === 'passed' || result.status === 'skipped' ? 'failed' : result.status, message: `${result.message}; cleanup failed: ${cleanup.message}`, remarks: [...(result.remarks || []), `Cleanup failed: ${cleanup.message}.`] };
  };

  if (c.method === 'http') return runHttp({ ...common, cleanupSteps, cleanupTimeoutSeconds });
  if (c.method === 'playwright') {
    return withCleanup(await runPlaywright({ ...common, browser: rules.browser || 'chromium', viewport, extraHttpHeaders: rules.extra_http_headers }));
  }
  if (c.method === 'selenium') return withCleanup(await runSelenium({ ...common, viewport }) as Outcome);
  if (c.method === 'performance') {
    return withCleanup(await runPerformance({
      baseUrl, vars, url: rules.url, path: rules.path || '/health', method: rules.method || 'GET',
      concurrency: rules.concurrency || 5, requests: rules.requests || 20,
      durationSeconds: Number(rules.duration_seconds) > 0 ? Number(rules.duration_seconds) : undefined,
      timeoutSeconds: c.timeoutSeconds || 15, headers: rules.headers || undefined,
      body: rules.body !== undefined ? rules.body : undefined, expectStatus: rules.expect_status,
      sla: rules.sla || { p95_ms: 2000, error_rate_pct: 5 },
    } as any) as Outcome);
  }
  return { status: 'skipped', message: `the ${c.method} runner is not driven by this harness`, duration_ms: 0 };
}

let passed = 0;
let failed = 0;
let skipped = 0;
const results: Array<{ key: string; suite: string; method: string; status: string; message: string; duration_ms: number }> = [];
for (const c of selected) {
  const t0 = Date.now();
  let r: Outcome;
  try {
    r = await runCase(c);
  } catch (err) {
    r = { status: 'error', message: (err as Error).message, duration_ms: Date.now() - t0 };
  }
  const ok = r.status === 'passed';
  const skip = r.status === 'skipped';
  if (ok) passed++; else if (skip) skipped++; else failed++;
  results.push({ key: c.key, suite: c.suiteKey, method: c.method, status: r.status, message: r.message, duration_ms: Date.now() - t0 });
  console.log(`${ok ? 'PASS' : skip ? 'SKIP' : 'FAIL'}  ${c.key}  (${Date.now() - t0}ms)`);
  if (!ok || flag('verbose')) {
    if (!ok) console.log(`      ${String(r.message).slice(0, 700)}`);
    for (const line of (r.remarks || []).slice(-(flag('verbose') ? 200 : 4))) console.log(`      · ${String(line).slice(0, 400)}`);
  }
}
await closeBrowserPool().catch(() => undefined);
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped of ${selected.length}`);
const out = opt('json');
if (out) writeFileSync(path.resolve(out), JSON.stringify(results, null, 1));
process.exit(failed ? 1 : 0);
