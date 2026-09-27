#!/usr/bin/env node
// Test coverage report for Sand Bench, as seen by the GAVRIQ Test Engine. Deterministic
// input for the Test Manager agent (.claude/agents/test-manager.md): which test types
// have runnable cases, which Sand Bench API routes and use cases no case touches.
//
// Sources:
//   - engine catalog   GET {TEST_ENGINE_API}/api/v1/test-cases (paged)
//   - SIT cases        sit/cases/*.sit.ts (synced from Sand Bench + engine-owned NN-te-*)
//   - Sand Bench       API routes and use-case pages at SANDBENCH_REF (default origin/main)
//
// Writes docs/test-manager/coverage.json and docs/test-manager/COVERAGE.md.
// Usage: node scripts/test-coverage-report.mjs [--no-engine]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suiteOf } from "../sit/lib/catalog.mjs";

/** Engine test types (schema.sql test_type enum), in report order. */
export const TEST_TYPES = [
  "smoke", "sanity", "unit", "component", "service", "api", "contract", "integration",
  "database", "event", "file", "batch", "scheduler", "workflow", "ui", "selenium-baseline",
  "e2e", "acceptance", "regression", "system", "performance", "security", "resilience",
  "deployment", "other",
];

/** A catalog case can run only when it carries something a runner executes. */
export function isRunnable(c) {
  if (c.script && String(c.script).trim()) return true;
  return Array.isArray(c.steps) && c.steps.length > 0 && ["http", "rest", "api"].includes(c.execution_method);
}

/**
 * Per engine test type: total and runnable catalog cases.
 * @param {Array<{ test_type?: string, script?: string | null, steps?: unknown[], execution_method?: string | null }>} cases
 */
export function summariseTypes(cases) {
  /** @type {Record<string, { total: number, runnable: number }>} */
  const out = Object.fromEntries(TEST_TYPES.map((t) => [t, { total: 0, runnable: 0 }]));
  for (const c of cases) {
    const t = c.test_type && out[c.test_type] ? c.test_type : "other";
    out[t].total++;
    if (isRunnable(c)) out[t].runnable++;
  }
  return out;
}

/** Count `test(` / `it(` calls in a SIT source file. */
export function countSitTests(source) {
  return (source.match(/\b(?:test|it)\s*\(\s*[`'"]/g) || []).length;
}

/**
 * Express-style route → regex that matches how a test would write the URL:
 * `:param` segments match any literal or `${...}` template segment.
 * @param {string} route
 */
export function routePattern(route) {
  const body = route
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "(?:\\$\\{[^}]+\\}|[^/\"'`?${}]+)" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`${body}(?=["'\`?/#]|\\$\\{|$)`);
}

/**
 * Routes no source mentions. Method-agnostic on purpose: a mention of the path is the
 * signal; the agent confirms the method when it writes the case.
 * @param {Array<{ method: string, path: string }>} routes
 * @param {string} haystack all test sources joined
 */
export function uncoveredRoutes(routes, haystack) {
  return routes.filter((r) => !routePattern(r.path).test(haystack));
}

/**
 * Parse `app.<verb>("/api/...")` registrations from `git grep` output lines.
 * @param {string} text
 */
export function parseRoutes(text) {
  const seen = new Set();
  /** @type {Array<{ method: string, path: string }>} */
  const routes = [];
  const re = /\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*["'`](\/api\/[^"'`]+)["'`]/g;
  for (const m of text.matchAll(re)) {
    const key = `${m[1].toUpperCase()} ${m[2]}`;
    if (!seen.has(key)) { seen.add(key); routes.push({ method: m[1].toUpperCase(), path: m[2] }); }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

async function fetchCatalog(api) {
  const all = [];
  for (let offset = 0; ; offset += 200) {
    const res = await fetch(`${api}/api/v1/test-cases?limit=200&offset=${offset}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const page = (await res.json()).data || [];
    all.push(...page);
    if (page.length < 200) return all;
  }
}

function sandBench(repo, ref) {
  const git = (/** @type {string[]} */ args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const commit = git(["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  let grep = "";
  try { grep = git(["grep", "-h", "-E", "\\.(get|post|put|patch|delete)\\s*(<[^>]*>)?\\s*\\(\\s*[\"'`]/api/", commit, "--", "apps/api/src"]); } catch { /* no matches */ }
  const useCases = git(["ls-tree", "--name-only", commit, "docs/use-cases/"])
    .split("\n").map((f) => path.posix.basename(f)).filter((f) => /^UC-.+\.md$/.test(f)).map((f) => f.slice(0, -3));
  return { commit, routes: parseRoutes(grep), useCases };
}

function pct(n, d) { return d ? `${Math.round((100 * n) / d)}%` : "—"; }

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const api = (process.env.TEST_ENGINE_API || `http://127.0.0.1:${process.env.TEST_ENGINE_HOST_PORT || 8787}`).replace(/\/$/, "");
  const repo = path.resolve(process.env.SANDBENCH_REPO_DIR || path.join(root, "..", "sand-bench-enterprise"));
  const ref = process.env.SANDBENCH_REF || "origin/main";

  let catalog = [];
  let catalogError = null;
  if (!process.argv.includes("--no-engine")) {
    try { catalog = await fetchCatalog(api); } catch (e) { catalogError = `${api}: ${e.message}`; }
  }

  const casesDir = path.join(root, "sit/cases");
  const sitFiles = readdirSync(casesDir).filter((f) => f.endsWith(".sit.ts")).sort();
  const sources = sitFiles.map((f) => ({ file: f, text: readFileSync(path.join(casesDir, f), "utf8") }));
  /** @type {Record<string, { files: number, tests: number, engineOwned: number }>} */
  const sitByType = {};
  for (const s of sources) {
    const t = suiteOf(s.file);
    sitByType[t] ??= { files: 0, tests: 0, engineOwned: 0 };
    sitByType[t].files++;
    sitByType[t].tests += countSitTests(s.text);
    if (/^\d+-te-/.test(s.file)) sitByType[t].engineOwned++;
  }

  const haystack = [
    ...sources.map((s) => s.text),
    ...catalog.map((c) => `${c.script ?? ""}\n${JSON.stringify(c.steps ?? [])}`),
  ].join("\n");

  let sb = null;
  if (existsSync(path.join(repo, ".git")) || existsSync(path.join(repo, "sit"))) {
    try { sb = sandBench(repo, ref); } catch (e) { sb = { error: e.message }; }
  }
  const routes = sb && !("error" in sb) ? sb.routes : [];
  const missingRoutes = uncoveredRoutes(routes, haystack);
  const useCaseIds = sb && !("error" in sb) ? sb.useCases : [];
  const ucHaystack = haystack + (existsSync(path.join(root, "docs/use-cases/test-cases.json"))
    ? readFileSync(path.join(root, "docs/use-cases/test-cases.json"), "utf8") : "");
  const missingUseCases = useCaseIds.filter((id) => !ucHaystack.includes(id.replace(/^UC-/, "")));

  const report = {
    generatedAt: new Date().toISOString(),
    engine: { api, cases: catalog.length, error: catalogError },
    sandBench: sb && !("error" in sb) ? { ref, commit: sb.commit } : { ref, error: sb?.error ?? `not found at ${repo}` },
    types: summariseTypes(catalog),
    sit: sitByType,
    routes: { total: routes.length, uncovered: missingRoutes },
    useCases: { total: useCaseIds.length, uncovered: missingUseCases },
  };

  const outDir = path.join(root, "docs/test-manager");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "coverage.json"), JSON.stringify(report, null, 2) + "\n");

  const lines = [
    "# Sand Bench test coverage",
    "",
    `Generated ${report.generatedAt} by \`npm run coverage:report\`. Input for the Test Manager agent.`,
    "",
    `- Engine catalog: ${catalog.length} cases${catalogError ? ` (unavailable: ${catalogError})` : ""}`,
    `- Sand Bench: ${report.sandBench.commit ? `${ref} @ ${report.sandBench.commit.slice(0, 8)}` : report.sandBench.error}`,
    `- API routes mentioned by a test: ${routes.length - missingRoutes.length}/${routes.length} (${pct(routes.length - missingRoutes.length, routes.length)})`,
    `- Use cases referenced by a test: ${useCaseIds.length - missingUseCases.length}/${useCaseIds.length} (${pct(useCaseIds.length - missingUseCases.length, useCaseIds.length)})`,
    "",
    "## Catalog cases by test type",
    "",
    "| Type | Cases | Runnable | Placeholders |",
    "|---|---:|---:|---:|",
    ...TEST_TYPES.filter((t) => report.types[t].total).map((t) => {
      const { total, runnable } = report.types[t];
      return `| ${t} | ${total} | ${runnable} | ${total - runnable} |`;
    }),
    `| **types with no cases** | ${TEST_TYPES.filter((t) => !report.types[t].total).join(", ") || "none"} | | |`,
    "",
    "## SIT cases by suite",
    "",
    "| Suite | Files | Tests | Engine-owned files |",
    "|---|---:|---:|---:|",
    ...Object.entries(sitByType).sort().map(([t, v]) => `| ${t} | ${v.files} | ${v.tests} | ${v.engineOwned} |`),
    "",
    `## Uncovered API routes (${missingRoutes.length})`,
    "",
    ...missingRoutes.slice(0, 300).map((r) => `- \`${r.method} ${r.path}\``),
    missingRoutes.length > 300 ? `- … ${missingRoutes.length - 300} more in coverage.json` : "",
    "",
    `## Use cases with no test reference (${missingUseCases.length})`,
    "",
    ...missingUseCases.map((id) => `- ${id}`),
    "",
  ];
  writeFileSync(path.join(outDir, "COVERAGE.md"), lines.join("\n"));
  console.log(`coverage: ${catalog.length} catalog cases, ${sources.length} SIT files, routes ${routes.length - missingRoutes.length}/${routes.length}, use cases ${useCaseIds.length - missingUseCases.length}/${useCaseIds.length} → docs/test-manager/COVERAGE.md`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
