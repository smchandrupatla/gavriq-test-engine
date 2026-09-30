#!/usr/bin/env tsx
/**
 * Author-time harness: execute catalog case definitions directly through the
 * worker runners, without the engine/queue in between. For validating that
 * case steps really run against a live deployment while writing them.
 *
 *   npx tsx dev/scripts/run-catalog-local.ts [--app sand-bench] [--method http] [--suite sb-smoke] [--key SB-...]
 *
 * The engine self-test cases (--app gavriq-test-engine) target TE_BASE:
 *   TE_BASE=http://127.0.0.1:18797 npx tsx dev/scripts/run-catalog-local.ts --app gavriq-test-engine
 */
import { runHttp } from '../../apps/worker/src/runners/http.js';
import { runPlaywright } from '../../apps/worker/src/runners/playwright.js';
import { runSelenium } from '../../apps/worker/src/runners/selenium.js';
import { runPerformance } from '../../apps/worker/src/runners/performance.js';
import { SANDBENCH_CASES } from '../../apps/api/src/catalog/sandbench-cases.js';
import { ENGINE_CASES } from '../../apps/api/src/catalog/engine-cases.js';
import type { CaseDef } from '../../apps/api/src/catalog/types.js';

const VARS: Record<string, string> = {
  web: process.env.SB_WEB || 'http://127.0.0.1:8080',
  api: process.env.SB_API || 'http://127.0.0.1:8787',
  testhub: process.env.SB_TESTHUB || 'http://127.0.0.1:8091',
  dbviewer: process.env.SB_DBVIEWER || 'http://127.0.0.1:8090',
  engine: process.env.TE_BASE || 'http://127.0.0.1:8797',
  tenant: process.env.SIT_TENANT_SLUG || 'acme-demo',
  username: process.env.SIT_USERNAME || 'operator.acme',
  password: process.env.SB_DEMO_PASSWORD || process.env.SIT_PASSWORD || 'DemoOnly!Operator-2026#Change',
};

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const methodFilter = opt('method');
const suiteFilter = opt('suite');
const keyFilter = opt('key');

const ENGINE_KEYS = new Set(ENGINE_CASES.map((c) => c.key));

async function runCase(c: CaseDef) {
  const baseUrl = ENGINE_KEYS.has(c.key) ? VARS.engine : VARS.web;
  const rules = (c.validationRules || {}) as any;
  const common = { baseUrl, vars: VARS, timeoutSeconds: c.timeoutSeconds || 60, steps: c.steps as any };
  if (c.method === 'http') return runHttp(common);
  if (c.method === 'playwright') return runPlaywright({ ...common, browser: rules.browser || 'chromium', viewport: rules.viewport });
  if (c.method === 'selenium') return runSelenium({ ...common, viewport: rules.viewport });
  if (c.method === 'performance')
    return runPerformance({
      baseUrl, vars: VARS, url: rules.url, path: rules.path, method: rules.method,
      requests: rules.requests, concurrency: rules.concurrency, sla: rules.sla,
      durationSeconds: rules.duration_seconds,
      timeoutSeconds: c.timeoutSeconds || 120,
    });
  return { status: 'error' as const, message: `unknown method ${c.method}`, duration_ms: 0 };
}

const appFilter = opt('app');
const pool = appFilter === 'gavriq-test-engine' ? ENGINE_CASES : appFilter === 'sand-bench' ? SANDBENCH_CASES : [...SANDBENCH_CASES, ...ENGINE_CASES];
const all = pool.filter(
  (c) =>
    (!methodFilter || c.method === methodFilter) &&
    (!suiteFilter || c.suiteKey === suiteFilter) &&
    (!keyFilter || c.key === keyFilter)
);

let passed = 0, failed = 0, skipped = 0;
const failures: string[] = [];
for (const c of all) {
  const t0 = Date.now();
  try {
    const r = await runCase(c);
    const ok = r.status === 'passed';
    const skip = (r.status as string) === 'skipped';
    if (ok) passed++; else if (skip) skipped++; else { failed++; failures.push(`${c.key}: ${r.message}`); }
    console.log(`${ok ? 'PASS' : skip ? 'SKIP' : 'FAIL'}  ${c.key}  (${Date.now() - t0}ms)${ok ? '' : `\n      ${r.message}`}`);
  } catch (err) {
    failed++;
    failures.push(`${c.key}: ${(err as Error).message}`);
    console.log(`ERR   ${c.key}: ${(err as Error).message}`);
  }
}
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped of ${all.length}`);
if (failures.length) process.exitCode = 1;
