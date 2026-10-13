#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ENV, SERVICES } from "./lib/env.ts";
import { runAllCases, reportToTesthub, listCaseFiles } from "./lib/runner.mjs";
import { TYPES, GROUPS, suiteOf, groupOf } from "./lib/catalog.mjs";
import { extractTestCases } from "../dev/scripts/extract-tests.mjs";
import { specificationCases, regressionCases, useCases, useCaseDocument } from './lib/use-cases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casesDir = path.join(root, "sit/cases");
const publicDir = path.join(root, "sit/public");
const port = Number(process.env.PORT || 8098);
const storePath = process.env.SIT_CONSOLE_STORE || "";
const databaseUrl = process.env.DATABASE_URL || "";

const state = { running: false, currentFile: null, log: [], lastRun: null, history: [] };
const MAX_LOG_LINES = 400;
const MAX_HISTORY = 50;
const MAX_ARTIFACT_ROWS = MAX_HISTORY * 4;

let pool = null;
if (databaseUrl) {
  pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
  pool.on("error", (err) => process.stderr.write(`sit-console pg error: ${String(err.message || err)}\n`));
}

function appendLog(line) {
  for (const part of line.split("\n")) {
    if (!part) continue;
    state.log.push(part);
  }
  if (state.log.length > MAX_LOG_LINES) state.log.splice(0, state.log.length - MAX_LOG_LINES);
}

async function ensureSchema() {
  if (!pool) return;
  await pool.query(await readFile(path.join(root, 'sit/db/001-use-case-traceability.sql'), 'utf8'));
  const registry = [...regressionCases(), ...specificationCases()].map(row => ({
    case_id: row.id, use_case_id: row.useCaseId, use_case_name: row.useCaseName,
    layer: row.layer || 'specification', executable: row.executable, definition: row,
  }));
  await pool.query(`INSERT INTO sit_case_registry (case_id, use_case_id, use_case_name, layer, executable, definition)
    SELECT case_id, use_case_id, use_case_name, layer, executable, definition
    FROM jsonb_to_recordset($1::jsonb) AS x(case_id text, use_case_id text, use_case_name text, layer text, executable boolean, definition jsonb)
    ON CONFLICT (case_id) DO UPDATE SET use_case_id=EXCLUDED.use_case_id, use_case_name=EXCLUDED.use_case_name,
      layer=EXCLUDED.layer, executable=EXCLUDED.executable, definition=EXCLUDED.definition, updated_at=now()`, [JSON.stringify(registry)]);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sit_runs (
      id BIGSERIAL PRIMARY KEY,
      at TIMESTAMPTZ NOT NULL,
      duration_ms INT NOT NULL DEFAULT 0,
      total INT NOT NULL DEFAULT 0,
      passed INT NOT NULL DEFAULT 0,
      failed INT NOT NULL DEFAULT 0,
      any_process_failed BOOLEAN NOT NULL DEFAULT false,
      reported_to_testhub BOOLEAN NOT NULL DEFAULT false,
      results JSONB NOT NULL DEFAULT '[]'::jsonb
    )
  `);
}

function rowToRun(row) {
  return {
    id: row.id,
    at: row.at.toISOString(),
    durationMs: row.duration_ms,
    total: row.total,
    passed: row.passed,
    failed: row.failed,
    skipped: (row.results || []).filter(result => result.status === 'skipped' || result.status === 'todo').length,
    anyProcessFailed: row.any_process_failed,
    reportedToTesthub: row.reported_to_testhub,
    results: row.results,
  };
}

function toHistoryEntry(run) {
  return {
    id: run.id, at: run.at, durationMs: run.durationMs, total: run.total, passed: run.passed, failed: run.failed,
    skipped: run.skipped || 0,
    results: (run.results || []).map((r) => ({ id: r.id, name: r.name, type: r.type, group: r.group, passed: r.passed, status: r.status, useCaseId: r.useCaseId, useCaseName: r.useCaseName })),
  };
}

async function loadHistory() {
  if (pool) {
    try {
      await ensureSchema();
      const { rows } = await pool.query(
        `SELECT id, at, duration_ms, total, passed, failed, any_process_failed, reported_to_testhub, results FROM sit_runs ORDER BY id DESC LIMIT $1`,
        [MAX_HISTORY]
      );
      const runs = rows.map(rowToRun).reverse();
      state.history = runs.map(toHistoryEntry);
      state.lastRun = runs[runs.length - 1] || null;
      return;
    } catch (err) {
      appendLog(`Postgres history load failed, falling back to file store: ${String(err.message || err)}`);
    }
  }
  if (!storePath || !existsSync(storePath)) return;
  try {
    const saved = JSON.parse(readFileSync(storePath, "utf8"));
    if (Array.isArray(saved.history)) state.history = saved.history.slice(-MAX_HISTORY);
    if (saved.lastRun) state.lastRun = saved.lastRun;
  } catch { /* start fresh */ }
}

async function persistHistoryFile() {
  if (!storePath) return;
  try {
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(storePath, JSON.stringify({ history: state.history, lastRun: state.lastRun }));
  } catch { /* memory only */ }
}

async function persistRun(run) {
  if (pool) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO sit_runs (at, duration_ms, total, passed, failed, any_process_failed, reported_to_testhub, results)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id`,
        [run.at, run.durationMs, run.total, run.passed, run.failed, Boolean(run.anyProcessFailed), Boolean(run.reportedToTesthub), JSON.stringify(run.results)]
      );
      run.id = rows[0].id;
      await pool.query(`DELETE FROM sit_runs WHERE id NOT IN (SELECT id FROM sit_runs ORDER BY id DESC LIMIT $1)`, [MAX_ARTIFACT_ROWS]);
      return;
    } catch (err) {
      appendLog(`Postgres run insert failed, falling back to file store: ${String(err.message || err)}`);
    }
  }
  await persistHistoryFile();
}

async function fetchRunById(id) {
  if (!pool) return null;
  try {
    const { rows } = await pool.query(
      `SELECT id, at, duration_ms, total, passed, failed, any_process_failed, reported_to_testhub, results FROM sit_runs WHERE id = $1`,
      [id]
    );
    return rows[0] ? rowToRun(rows[0]) : null;
  } catch {
    return null;
  }
}

// Human-meaningful grouping for the console's case catalog, shown as a heading over
// each file's cases so a visitor can see at a glance what kind of check each file is
// (a health probe, a channel round trip, a UI workflow...) without opening the source.
// Every *.sit.ts file must be mapped here — same discipline as
// dev/scripts/generate-testhub-catalog.mjs's CATEGORY_BY_FILE, so a new case file can
// never silently show up unlabeled.
const CATEGORY_BY_FILE = {
  "00-health": "Deployment health & readiness",
  "10-mq-round-trip": "MQ round trip",
  "20-kafka-round-trip": "Kafka round trip",
  "30-api-round-trip": "External API round trip",
  "40-worker-job": "Worker job queue",
  "50-dbviewer-cross-check": "Database cross-check",
  "60-ui-eventing": "UI — Eventing panel (Playwright)",
  "70-ui-pages": "UI — page coverage (Selenium)",
  "71-selenium-screen-coverage": "UI — screen coverage (Selenium)",
  "80-ui-workflows": "UI — workflow & data integrity (Selenium)",
};

function listCatalog() {
  const files = readdirSync(casesDir).filter((name) => name.endsWith(".sit.ts")).sort();
  return files.map((name) => {
    const fileKey = name.slice(0, -".sit.ts".length);
    const source = readFileSync(path.join(casesDir, name), "utf8");
    const type = suiteOf(name);
    const registered = regressionCases().filter(row => row.file === `sit/cases/${name}`);
    const staticCases = registered.length ? registered : extractTestCases(fileKey, `sit/cases/${name}`, source).map((row) => ({ ...row, type, group: groupOf(name, row.name), executable: true }));
    // Template-literal test names (e.g. `GUI page ${path}...`) can't be statically
    // parsed — backfill any cases the last real run reported for this file so they
    // still show up as tiles instead of silently disappearing from the catalog.
    const seenIds = new Set(staticCases.map((row) => row.id));
    const discovered = (state.lastRun?.results || [])
      .filter((row) => row.file === `${fileKey}.sit.ts` && !seenIds.has(row.id))
      .map((row) => ({ id: row.id, name: row.name, file: `sit/cases/${name}`, type, group: groupOf(name, row.name) }));
    return { file: `sit/cases/${name}`, fileName: name, type, cases: [...staticCases, ...discovered] };
  });
}

async function probeTargets() {
  return Promise.all(SERVICES.map(async (service) => {
    try {
      const res = await fetch(service.healthUrl, { signal: AbortSignal.timeout(2500) });
      return { name: service.name, url: service.healthUrl, reachable: res.ok, status: res.status };
    } catch (error) {
      return { name: service.name, url: service.healthUrl, reachable: false, error: String(error.message || error) };
    }
  }));
}

async function triggerRun(filter = {}) {
  if (state.running) return { started: false, reason: "a run is already in progress" };
  const known = listCatalog();
  if (filter.caseNames?.length && filter.caseNames.some(name => !known.some(file => file.cases.some(row => row.name === name)))) {
    return { started: false, reason: 'Unknown or specification-only test case; executable cases must be selected.' };
  }
  state.running = true;
  state.currentFile = null;
  state.log = [];
  const label = filter.caseNames?.length ? `case(s): ${filter.caseNames.join(", ")}`
    : filter.groups?.length ? `sub-type(s): ${filter.groups.join(", ")}`
    : filter.suites?.length ? `type(s): ${filter.suites.join(", ")}`
    : "all cases";
  appendLog(`Run started ${new Date().toISOString()}, targeting ${ENV.apiBase} (${label})`);
  // A caseNames-only filter still narrows *within* each spawned file via
  // --test-name-pattern, but every other file would still be spawned and (having zero
  // matching tests) emit a vacuous whole-file "pass". Restrict to the file(s) that
  // actually declare the requested case name(s) so "run this case" runs just that case.
  let files = filter.files;
  if (!files?.length && filter.caseNames?.length && !filter.suites?.length && !filter.groups?.length) {
    const wanted = new Set(filter.caseNames);
    const matches = new Set();
    for (const entry of listCatalog()) {
      for (const c of entry.cases) if (wanted.has(c.name)) matches.add(entry.fileName);
    }
    files = [...matches];
  }
  (async () => {
    try {
      const { results, durationMs, anyProcessFailed } = await runAllCases({
        suites: filter.suites, groups: filter.groups, files, caseNames: filter.caseNames,
        onFileStart: (file) => { state.currentFile = file.fileName; appendLog(`\n=== ${file.fileName} ===`); },
        onOutput: (_file, chunk) => appendLog(chunk),
      });
      const failedCount = results.filter((row) => row.status === 'failed' || (!row.status && !row.passed)).length;
      const skipped = results.filter(row => row.status === 'skipped' || row.status === 'todo').length;
      const reportedToTesthub = await reportToTesthub(results, { durationMs });
      const run = { at: new Date().toISOString(), durationMs, total: results.length, passed: results.filter(row => row.passed).length, failed: failedCount, skipped, anyProcessFailed, reportedToTesthub, results };
      state.lastRun = run;
      state.history.push(toHistoryEntry(run));
      if (state.history.length > MAX_HISTORY) state.history.splice(0, state.history.length - MAX_HISTORY);
      await persistRun(run);
      state.history[state.history.length - 1] = toHistoryEntry(run);
      await persistHistoryFile();
      appendLog(`\nRun finished: ${run.passed}/${run.total} passed in ${Math.round(durationMs / 1000)}s`);
    } catch (error) {
      appendLog(`\nRun crashed: ${error instanceof Error ? error.message : String(error)}`);
      state.lastRun = { at: new Date().toISOString(), crashed: true, error: String(error) };
    } finally {
      state.running = false;
      state.currentFile = null;
    }
  })();
  return { started: true };
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1048576) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected an object');
    return body;
  } catch {
    throw Object.assign(new Error('Request body must be a JSON object'), { statusCode: 400 });
  }
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://sit-console.local");
  // Reached both directly (standalone dev, this port) and proxied under /sit inside the
  // consolidated container — strip the prefix once so every route below matches either way.
  let pathname = url.pathname;
  if (pathname === "/sit") pathname = "/";
  else if (pathname.startsWith("/sit/")) pathname = pathname.slice("/sit".length);
  try {
    if (pathname === "/health" || pathname === "/ready") {
      return json(res, 200, { status: "ok", service: "sit-console", product: "GARVIQ Test Engine", decoupled: true, port });
    }
    if (pathname === "/api/targets" && req.method === "GET") return json(res, 200, { data: await probeTargets() });
    if (pathname === "/api/taxonomy" && req.method === "GET") return json(res, 200, { types: TYPES, groups: GROUPS });
    if (pathname === "/api/cases" && req.method === "GET") return json(res, 200, { data: listCatalog() });
    if (pathname === '/api/specifications' && req.method === 'GET') return json(res, 200, { data: specificationCases() });
    if (pathname === '/api/use-cases' && req.method === 'GET') return json(res, 200, { data: useCases() });
    if (pathname.startsWith('/api/use-cases/') && req.method === 'GET') {
      const doc = useCaseDocument(decodeURIComponent(pathname.slice('/api/use-cases/'.length)));
      if (doc === null) return json(res, 404, { error: 'Unknown use case' });
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(doc);
    }
    if (pathname === "/api/status" && req.method === "GET") {
      return json(res, 200, {
        running: state.running,
        currentFile: state.currentFile,
        log: state.log.slice(-200),
        lastRun: state.lastRun ? { ...state.lastRun, id: state.lastRun.id ?? null, crashed: Boolean(state.lastRun.crashed) } : null,
      });
    }
    if (pathname === "/api/runs" && req.method === "GET") return json(res, 200, { data: [...state.history].reverse() });
    if (pathname === "/api/evidence" && req.method === "GET") {
      const evidenceDir = path.join(publicDir, "evidence");
      const files = existsSync(evidenceDir) ? readdirSync(evidenceDir).sort() : [];
      return json(res, 200, { data: files.map((name) => ({ name, path: `/sit/evidence/${name}` })) });
    }
    if (pathname.startsWith("/api/runs/") && req.method === "GET") {
      const id = Number(pathname.slice("/api/runs/".length));
      if (!Number.isFinite(id)) return json(res, 400, { error: "run id must be numeric (Postgres-backed runs only)" });
      const run = state.lastRun?.id === id ? state.lastRun : await fetchRunById(id);
      return json(res, run ? 200 : 404, run ? { data: run } : { error: "run not found (full artifacts require DATABASE_URL)" });
    }
    if (pathname === "/api/run" && req.method === "POST") {
      const body = await readBody(req);
      for (const key of ['suites', 'groups', 'files', 'caseNames']) {
        if (body[key] !== undefined && (!Array.isArray(body[key]) || body[key].some(value => typeof value !== 'string' || !value.trim()))) return json(res, 400, { error: `${key} must be an array of nonempty strings` });
      }
      if (!listCaseFiles({ suites: body.suites, groups: body.groups, files: body.files }).length) return json(res, 400, { error: 'No executable files match this selection' });
      const outcome = await triggerRun({ suites: body.suites, groups: body.groups, files: body.files, caseNames: body.caseNames });
      return json(res, outcome.started ? 202 : 409, outcome);
    }
    if (pathname === "/" || pathname === "/index.html") {
      const html = await readFile(path.join(publicDir, "index.html"), "utf8");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }
    if (pathname.startsWith('/evidence/') && req.method === 'GET') {
      const name = decodeURIComponent(pathname.slice('/evidence/'.length));
      if (!/^[a-zA-Z0-9_.-]+\.(json|png)$/.test(name)) return json(res, 404, { error: 'Unknown evidence' });
      const file = path.join(publicDir, 'evidence', name);
      if (!existsSync(file)) return json(res, 404, { error: 'Unknown evidence' });
      res.writeHead(200, { 'content-type': name.endsWith('.png') ? 'image/png' : 'application/json', 'x-content-type-options': 'nosniff' });
      return res.end(await readFile(file));
    }
    res.writeHead(404).end("not found");
  } catch (error) {
    json(res, error.statusCode || 500, { error: { code: "console_error", message: String(error?.message || error) } });
  }
});

loadHistory().then(() => {
  server.listen(port, "0.0.0.0", () => {
    console.log(`sit-console listening on :${port} (independent of the main application)`);
  });
});
