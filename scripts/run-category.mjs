#!/usr/bin/env node
/**
 * Queue a run of the Sand Bench E2E GUI cases that carry a given cat:<name>
 * tag. One category per invocation; prints the run id and the status URL.
 *
 *   node scripts/run-category.mjs <category> [--env sand-bench-staging]
 *
 * Categories are the ones defined in docs/E2E-GUI-COVERAGE-STATUS.md:
 *   smoke, forms, nav, auth, visual, responsive, accessibility,
 *   performance, resilience, localization, state
 *
 * The engine URL defaults to http://127.0.0.1:8797; override with
 *   TEST_ENGINE_URL=https://engine.example.com node scripts/run-category.mjs smoke
 */
import process from 'node:process';

const ENGINE = (process.env.TEST_ENGINE_URL || 'http://127.0.0.1:8797').replace(/\/+$/, '');
const args = process.argv.slice(2);
const category = args[0];
const envFlagIdx = args.indexOf('--env');
const environment = envFlagIdx >= 0 ? args[envFlagIdx + 1] : 'sand-bench-staging';

if (!category) {
  console.error('usage: node scripts/run-category.mjs <category> [--env <env-key>]');
  console.error('available categories: smoke, forms, nav, auth, visual, responsive, accessibility, performance, resilience, localization, state');
  process.exit(2);
}

async function fetchJson(path, init) {
  const res = await fetch(`${ENGINE}${path}`, init);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${res.status} ${path}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 400)}`);
  return body;
}

// Pull the full list of Sand Bench cases from the engine, keep only those
// carrying our cat:<category> tag that also live in the sb-e2e-gui suite.
const summary = await fetchJson(`/api/v1/ui/summary?application=sand-bench`);
const cases = Array.isArray(summary?.data?.cases) ? summary.data.cases : [];
const tag = `cat:${category}`;
const matching = cases
  .filter((c) => Array.isArray(c.tags) && c.tags.includes(tag))
  .filter((c) => Array.isArray(c.tags) && c.tags.includes('e2e-gui'))
  .map((c) => c.key);

if (matching.length === 0) {
  console.error(`no E2E GUI cases carry tag "${tag}" — nothing to run`);
  process.exit(1);
}

console.log(`[${category}] ${matching.length} case(s) match tag "${tag}"; environment=${environment}`);

const outcome = await fetchJson(`/api/v1/runs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    application: 'sand-bench',
    environment,
    scope: { case_keys: matching },
    reason: `run E2E GUI category ${category}`,
    trigger_source: 'manual',
  }),
});

const runId = outcome?.data?.run_id;
if (!runId) {
  console.error('engine refused to queue the run:', outcome);
  process.exit(1);
}

console.log(`queued run ${runId}`);
console.log(`status: ${ENGINE}/api/v1/runs/${runId}`);
console.log(`console: ${ENGINE}/#/run/${runId}`);
