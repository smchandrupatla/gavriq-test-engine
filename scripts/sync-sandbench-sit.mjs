#!/usr/bin/env node
// Sync Sand Bench's SIT cases into this repo. Sand Bench (sand-bench-enterprise) is the
// source of truth for everything listed in SYNCED; this repo keeps a copy so the engine
// can run the cases without a Sand Bench checkout. Engine-only cases (e.g.
// sit/cases/90-agents.sit.ts) sit alongside and are never touched.
//
// Usage:
//   node scripts/sync-sandbench-sit.mjs           copy from Sand Bench, write the manifest
//   node scripts/sync-sandbench-sit.mjs --check   exit 1 if the copy has drifted
//
// --check compares against the Sand Bench checkout when present, otherwise against the
// hashes in the manifest (so CI without Sand Bench still catches local edits to synced
// files — change those in Sand Bench, then re-sync).
//
// Env: SANDBENCH_REPO_DIR (default ../sand-bench-enterprise next to this repo).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Paths copied from Sand Bench, relative to both repo roots. Directories are recursive. */
export const SYNCED = [
  "sit/cases",
  "sit/lib",
  "apps/secportal/zap-report.mjs",
  "apps/secportal/semgrep-report.mjs",
  "tests/helpers/e2e-business-catalog.mjs",
  "tests/helpers/r1.mjs",
  "tests/fixtures/r1",
];

export const MANIFEST = "sit/SYNCED-FROM-SANDBENCH.json";

/** Line endings differ between checkouts on Windows; hash content with LF only. */
export function hashContent(buf) {
  return createHash("sha256").update(buf.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
}

function listFiles(root, rel) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [rel];
  return readdirSync(abs, { withFileTypes: true }).flatMap((d) =>
    listFiles(root, path.posix.join(rel, d.name)));
}

/** Hash every synced file under `root`, keyed by posix relative path. */
export function snapshot(root, synced = SYNCED) {
  const out = {};
  for (const rel of synced) {
    for (const file of listFiles(root, rel)) out[file] = hashContent(readFileSync(path.join(root, file)));
  }
  return out;
}

/** Differences between an expected and an actual snapshot. */
export function diffSnapshots(expected, actual) {
  const added = [], changed = [], removed = [];
  for (const [file, hash] of Object.entries(expected)) {
    if (!(file in actual)) added.push(file);
    else if (actual[file] !== hash) changed.push(file);
  }
  for (const file of Object.keys(actual)) if (!(file in expected)) removed.push(file);
  return { added, changed, removed, clean: !added.length && !changed.length && !removed.length };
}

function readManifest(dest) {
  try { return JSON.parse(readFileSync(path.join(dest, MANIFEST), "utf8")); } catch { return null; }
}

/**
 * Copy synced files from `src` to `dest`. Files that disappeared from Sand Bench are
 * deleted only if the previous manifest says we synced them, so engine-only files survive.
 */
export function sync({ src, dest, synced = SYNCED, sourceCommit = null }) {
  const previous = readManifest(dest)?.files ?? {};
  const files = snapshot(src, synced);
  for (const file of Object.keys(files)) {
    const target = path.join(dest, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(path.join(src, file)));
  }
  const deleted = Object.keys(previous).filter((f) => !(f in files));
  for (const file of deleted) rmSync(path.join(dest, file), { force: true });
  const manifest = { source: "sand-bench-enterprise", sourceCommit, synced, files };
  writeFileSync(path.join(dest, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
  return { copied: Object.keys(files).length, deleted };
}

/**
 * Drift check. Compares the synced files in `dest` with Sand Bench when `src` exists,
 * otherwise with the manifest. Only files Sand Bench owns are compared.
 */
export function check({ src, dest, synced = SYNCED }) {
  const manifest = readManifest(dest);
  const expected = src && existsSync(src) ? snapshot(src, synced) : manifest?.files;
  if (!expected) return { clean: false, added: [], changed: [], removed: [], reason: "no manifest and no Sand Bench checkout" };
  const owned = new Set([...Object.keys(expected), ...Object.keys(manifest?.files ?? {})]);
  const actual = Object.fromEntries(Object.entries(snapshot(dest, synced)).filter(([f]) => owned.has(f)));
  return { ...diffSnapshots(expected, actual), against: src && existsSync(src) ? "sand-bench" : "manifest" };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const src = path.resolve(process.env.SANDBENCH_REPO_DIR || path.join(root, "..", "sand-bench-enterprise"));
  const haveSrc = existsSync(path.join(src, "sit", "cases"));

  if (process.argv.includes("--check")) {
    const r = check({ src: haveSrc ? src : null, dest: root });
    if (r.clean) {
      console.log(`sit sync: clean (checked against ${r.against})`);
      return;
    }
    console.error(`sit sync: DRIFT against ${r.against ?? "nothing"}${r.reason ? ` (${r.reason})` : ""}`);
    for (const f of r.added) console.error(`  missing  ${f}`);
    for (const f of r.changed) console.error(`  changed  ${f}`);
    for (const f of r.removed) console.error(`  stale    ${f}`);
    console.error("Edit these in sand-bench-enterprise, then run: npm run sync:sit");
    process.exitCode = 1;
    return;
  }

  if (!haveSrc) {
    console.error(`sit sync: Sand Bench checkout not found at ${src} (set SANDBENCH_REPO_DIR)`);
    process.exitCode = 1;
    return;
  }
  let sourceCommit = null;
  try { sourceCommit = execFileSync("git", ["-C", src, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }
  const r = sync({ src, dest: root, sourceCommit });
  console.log(`sit sync: copied ${r.copied} files from ${src}${sourceCommit ? ` @ ${sourceCommit.slice(0, 8)}` : ""}`);
  for (const f of r.deleted) console.log(`  deleted  ${f}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
