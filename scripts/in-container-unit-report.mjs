#!/usr/bin/env node
/**
 * In-container unit job for Sand Bench (or this repo).
 *
 * 1. Runs a small unit suite (node:test / exit code fallback).
 * 2. POSTs results to Test Engine /api/v1/build-results so
 *    "Last build" + unit category light up without re-running tests in TE.
 *
 * Env:
 *   TEST_ENGINE_URL   default https://gavriq-test-engine.onrender.com
 *   APPLICATION_KEY   default sand-bench
 *   BUILD_ID          default RENDER_GIT_COMMIT or timestamp
 *   COMMIT_SHA        optional
 *   BRANCH            optional
 *   UNIT_CMD          optional shell command (default: npm run test:unit)
 *
 * Usage (inside Sand Bench image / CI):
 *   node scripts/in-container-unit-report.mjs
 *   UNIT_CMD="npm test" node scripts/in-container-unit-report.mjs
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';

const ENGINE = (process.env.TEST_ENGINE_URL || 'https://gavriq-test-engine.onrender.com').replace(/\/$/, '');
const APP_KEY = process.env.APPLICATION_KEY || 'sand-bench';
const BUILD_ID =
  process.env.BUILD_ID ||
  process.env.RENDER_GIT_COMMIT ||
  process.env.GITHUB_RUN_ID ||
  `local-${Date.now()}`;
const COMMIT =
  process.env.COMMIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || null;
const BRANCH =
  process.env.BRANCH || process.env.RENDER_GIT_BRANCH || process.env.GITHUB_REF_NAME || null;
const UNIT_CMD = process.env.UNIT_CMD || 'npm run test:unit';

function mapStatus(ok) {
  return ok ? 'passed' : 'failed';
}

function runUnit() {
  const started = Date.now();
  console.log(`[in-container-unit] running: ${UNIT_CMD}`);
  const child = spawnSync(UNIT_CMD, {
    shell: true,
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const duration_ms = Date.now() - started;
  const ok = child.status === 0;
  const out = `${child.stdout || ''}\n${child.stderr || ''}`.trim();
  if (out) console.log(out.slice(-4000));
  console.log(`[in-container-unit] exit=${child.status} duration_ms=${duration_ms}`);
  return {
    ok,
    duration_ms,
    message: ok ? 'Unit suite passed' : (out.slice(0, 1500) || `exit ${child.status}`),
  };
}

async function postResults(results) {
  const body = {
    application_key: APP_KEY,
    build_id: String(BUILD_ID),
    commit_sha: COMMIT,
    branch: BRANCH,
    results,
  };
  const url = `${ENGINE}/api/v1/build-results`;
  console.log(`[in-container-unit] POST ${url} (${results.length} results, build ${BUILD_ID})`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`build-results HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  console.log('[in-container-unit] reported:', text.slice(0, 400));
  return text;
}

async function main() {
  const { ok, duration_ms, message } = runUnit();

  // One aggregate unit result + optional fine-grained keys for the dashboard
  const results = [
    {
      test_key: 'unit-suite',
      test_name: 'In-container unit suite',
      suite: 'unit',
      location: 'in_container',
      status: mapStatus(ok),
      duration_ms,
      message,
      metadata: { unit_cmd: UNIT_CMD },
    },
    {
      test_key: 'unit-smoke',
      test_name: 'Unit smoke gate',
      suite: 'unit',
      location: 'in_container',
      status: mapStatus(ok),
      duration_ms,
      message: ok ? 'smoke ok' : message,
    },
  ];

  const outFile = process.env.RESULTS_JSON || 'build-unit-results.json';
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`[in-container-unit] wrote ${outFile}`);

  await postResults(results);

  // Non-zero exit if unit failed so CI still fails the build
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error('[in-container-unit] fatal:', err.message || err);
  process.exit(2);
});
