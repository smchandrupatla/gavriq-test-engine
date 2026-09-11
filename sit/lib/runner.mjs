import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { caseId } from "../../dev/scripts/slug.mjs";
import { ENV } from "./env.ts";
import { suiteOf, groupOf, stepsFor } from "./catalog.mjs";
import { traceFor } from './use-cases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const casesDir = path.join(root, "sit/cases");
const tsxBin = path.join(root, "node_modules/tsx/dist/cli.mjs");

export { suiteOf };

export function listCaseFiles({ suites, groups, files } = {}) {
  const allowSuites = Array.isArray(suites) && suites.length ? new Set(suites) : null;
  const allowGroups = Array.isArray(groups) && groups.length ? new Set(groups) : null;
  const allowFiles = Array.isArray(files) && files.length ? new Set(files) : null;
  return readdirSync(casesDir)
    .filter((name) => name.endsWith(".sit.ts"))
    .sort()
    .filter((name) => !allowFiles || allowFiles.has(name) || allowFiles.has(name.slice(0, -".sit.ts".length)))
    .filter((name) => !allowSuites || allowSuites.has(suiteOf(name)))
    .filter((name) => !allowGroups || allowGroups.has(groupOf(name)))
    .map((name) => ({ fileKey: name.slice(0, -".sit.ts".length), fileName: name, absPath: path.join(casesDir, name), suite: suiteOf(name), group: groupOf(name) }));
}

function runCaseFile(file, onOutput, namePattern) {
  return new Promise((resolve) => {
    const bin = process.execPath;
    const extra = namePattern ? ["--test-name-pattern", namePattern] : [];
    const args = existsTsx()
      ? [tsxBin, "--test", "--test-reporter=tap", ...extra, file.absPath]
      : ["--test", "--test-reporter=tap", "--experimental-strip-types", ...extra, file.absPath];
    const child = spawn(bin, args, {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      onOutput?.(chunk.toString());
    });
    child.stderr.on("data", (chunk) => onOutput?.(chunk.toString()));
    child.on('error', error => {
      onOutput?.(`Runner could not start: ${error.message}\n`);
      resolve({ file, code: 1, stdout });
    });
    child.on("close", (code) => resolve({ file, code, stdout }));
  });
}

function existsTsx() {
  return existsSync(tsxBin);
}

const TAP_RESULT = /^(ok|not ok) \d+ - (.+)$/;

export function parseTapResults(fileKey, stdout) {
  const results = [];
  const seen = new Map();
  for (const line of stdout.split("\n")) {
    const match = TAP_RESULT.exec(line.trim());
    if (!match) continue;
    const directive = match[2].match(/\s+#\s+(SKIP|TODO)\b/i);
    const status = directive ? (directive[1].toUpperCase() === 'SKIP' ? 'skipped' : 'todo') : match[1] === 'ok' ? 'passed' : 'failed';
    const passed = status === 'passed';
    const name = match[2].replace(/\s+#\s+(SKIP|TODO)\b.*$/i, '').trim();
    const occurrence = seen.get(name) || 0;
    seen.set(name, occurrence + 1);
    results.push({
      id: caseId(fileKey, name, occurrence),
      name,
      passed,
      status,
      ...traceFor(name),
      file: `${fileKey}.sit.ts`,
      type: suiteOf(`${fileKey}.sit.ts`),
      group: groupOf(`${fileKey}.sit.ts`, name),
      steps: stepsFor(name, `${fileKey}.sit.ts`),
    });
  }
  return results;
}

export async function runAllCases({ onFileStart, onOutput, onFileResult, suites, groups, files: fileFilter, caseNames } = {}) {
  const files = listCaseFiles({ suites, groups, files: fileFilter });
  const namePattern = Array.isArray(caseNames) && caseNames.length
    ? `^(?:${caseNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`
    : "";
  const start = Date.now();
  const allResults = [];
  let anyProcessFailed = false;
  for (const file of files) {
    onFileStart?.(file);
    const outcome = await runCaseFile(file, (chunk) => onOutput?.(file, chunk), namePattern);
    if (outcome.code !== 0) anyProcessFailed = true;
    const results = parseTapResults(file.fileKey, outcome.stdout);
    if (!results.length && outcome.code !== 0) results.push({ id: `${file.fileKey}-process`, name: `${file.fileKey}: runner failed before reporting cases`, file: file.fileName, type: file.suite, group: file.group, passed: false, status: 'failed' });
    allResults.push(...results);
    onFileResult?.(file, results, outcome.code);
  }
  return { files, results: allResults, durationMs: Date.now() - start, anyProcessFailed };
}

export async function reportToTesthub(results, { durationMs, testhubBase = ENV.testhubBase } = {}) {
  const passed = results.filter((row) => row.passed);
  const failed = results.filter((row) => row.status === 'failed' || (!row.status && !row.passed));
  const at = new Date().toISOString();
  const calls = [];
  if (passed.length) {
    calls.push(
      fetch(`${testhubBase}/hub/coverage/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          at,
          suite: "sit-post-deploy",
          passed: passed.length,
          failed: 0,
          note: `Post-deploy SIT: ${passed.length} passed in ${Math.round(durationMs / 1000)}s`,
          caseIds: passed.map((row) => row.id),
        }),
        signal: AbortSignal.timeout(4000),
      })
    );
  }
  if (failed.length) {
    calls.push(
      fetch(`${testhubBase}/hub/coverage/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          at,
          suite: "sit-post-deploy",
          passed: 0,
          failed: failed.length,
          note: `Post-deploy SIT FAILED: ${failed.map((row) => row.name).join("; ")}`,
          caseIds: failed.map((row) => row.id),
        }),
        signal: AbortSignal.timeout(4000),
      })
    );
  }
  const outcomes = await Promise.allSettled(calls);
  return outcomes.length > 0 && outcomes.every((o) => o.status === "fulfilled" && o.value.ok);
}
