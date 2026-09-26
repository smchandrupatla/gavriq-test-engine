#!/usr/bin/env node
// Sync Sand Bench's SIT cases into this repo. Sand Bench (sand-bench-enterprise) is the
// source of truth for everything listed in SYNCED; this repo keeps a copy so the engine
// can run the cases without a Sand Bench checkout. Engine-only files placed alongside are
// never touched.
//
// By default files are read from a git ref of the Sand Bench checkout (origin/main), not
// its working tree, so whatever branch or uncommitted edits that checkout has never leak
// in. --working-tree reads files on disk instead (to try unmerged Sand Bench changes).
//
// Usage:
//   node scripts/sync-sandbench-sit.mjs                 copy from origin/main, write the manifest
//   node scripts/sync-sandbench-sit.mjs --check         exit 1 if the copy has drifted
//   node scripts/sync-sandbench-sit.mjs --working-tree  copy from the checkout's files on disk
//   node scripts/sync-sandbench-sit.mjs --no-fetch      skip `git fetch` before reading the ref
//
// --check compares against the Sand Bench ref when the checkout is present, otherwise
// against the hashes in the manifest (so CI without Sand Bench still catches local edits
// to synced files — change those in Sand Bench, then re-sync).
//
// Env: SANDBENCH_REPO_DIR (default ../sand-bench-enterprise next to this repo),
//      SANDBENCH_REF (default origin/main).
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

/**
 * @typedef {{ label: string, commit: string | null, list: (rel: string) => string[], read: (file: string) => Buffer }} Source
 */

/** Line endings differ between checkouts on Windows; hash content with LF only. */
export function hashContent(buf) {
  return createHash("sha256").update(buf.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
}

/**
 * Files on disk under `root`.
 * @param {string} root
 * @returns {Source}
 */
export function dirSource(root) {
  /** @param {string} rel @returns {string[]} */
  const list = (rel) => {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) return [];
    if (statSync(abs).isFile()) return [rel];
    return readdirSync(abs, { withFileTypes: true }).flatMap((d) => list(path.posix.join(rel, d.name)));
  };
  return { label: root, commit: null, list, read: (file) => readFileSync(path.join(root, file)) };
}

/**
 * Files at `ref` in the git repository `repo`.
 * @param {string} repo
 * @param {string} ref
 * @returns {Source}
 */
export function gitSource(repo, ref) {
  const git = (/** @type {string[]} */ args) =>
    execFileSync("git", ["-C", repo, ...args], { maxBuffer: 64 * 1024 * 1024 });
  const commit = git(["rev-parse", "--verify", `${ref}^{commit}`]).toString().trim();
  return {
    label: `${ref} (${commit.slice(0, 8)})`,
    commit,
    list: (rel) => git(["ls-tree", "-r", "--name-only", commit, "--", rel]).toString().split("\n").filter(Boolean),
    read: (file) => git(["show", `${commit}:${file}`]),
  };
}

/** @param {string | Source} src @returns {Source} */
const asSource = (src) => (typeof src === "string" ? dirSource(src) : src);

/**
 * Hash every synced file in `src`, keyed by posix relative path.
 * @param {string | Source} src
 * @param {string[]} [synced]
 * @returns {Record<string, string>}
 */
export function snapshot(src, synced = SYNCED) {
  const source = asSource(src);
  /** @type {Record<string, string>} */
  const out = {};
  for (const rel of synced) for (const file of source.list(rel)) out[file] = hashContent(source.read(file));
  return out;
}

/**
 * Differences between an expected and an actual snapshot.
 * @param {Record<string, string>} expected
 * @param {Record<string, string>} actual
 */
export function diffSnapshots(expected, actual) {
  /** @type {string[]} */ const added = [];
  /** @type {string[]} */ const changed = [];
  /** @type {string[]} */ const removed = [];
  for (const [file, hash] of Object.entries(expected)) {
    if (!(file in actual)) added.push(file);
    else if (actual[file] !== hash) changed.push(file);
  }
  for (const file of Object.keys(actual)) if (!(file in expected)) removed.push(file);
  return { added, changed, removed, clean: !added.length && !changed.length && !removed.length };
}

/** @param {string} dest */
function readManifest(dest) {
  try { return JSON.parse(readFileSync(path.join(dest, MANIFEST), "utf8")); } catch { return null; }
}

/**
 * Copy synced files from `src` to `dest`. Files that disappeared from Sand Bench are
 * deleted only if the previous manifest says we synced them, so engine-only files survive.
 * @param {{ src: string | Source, dest: string, synced?: string[], sourceCommit?: string | null }} opts
 */
export function sync({ src, dest, synced = SYNCED, sourceCommit }) {
  const source = asSource(src);
  const previous = readManifest(dest)?.files ?? {};
  /** @type {Record<string, string>} */
  const files = {};
  for (const rel of synced) {
    for (const file of source.list(rel)) {
      const body = source.read(file);
      files[file] = hashContent(body);
      const target = path.join(dest, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, body);
    }
  }
  const deleted = Object.keys(previous).filter((f) => !(f in files));
  for (const file of deleted) rmSync(path.join(dest, file), { force: true });
  const manifest = { source: "sand-bench-enterprise", sourceCommit: sourceCommit ?? source.commit, synced, files };
  writeFileSync(path.join(dest, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
  return { copied: Object.keys(files).length, deleted };
}

/**
 * Drift check. Compares the synced files in `dest` with `src` when given, otherwise with
 * the manifest. Only files Sand Bench owns are compared.
 * @param {{ src: string | Source | null, dest: string, synced?: string[] }} opts
 * @returns {{ clean: boolean, added: string[], changed: string[], removed: string[], against: string | null, reason?: string }}
 */
export function check({ src, dest, synced = SYNCED }) {
  const manifest = readManifest(dest);
  const source = src ? asSource(src) : null;
  /** @type {Record<string, string> | undefined} */
  const expected = source ? snapshot(source, synced) : manifest?.files;
  if (!expected) return { clean: false, added: [], changed: [], removed: [], against: null, reason: "no manifest and no Sand Bench checkout" };
  const owned = new Set([...Object.keys(expected), ...Object.keys(manifest?.files ?? {})]);
  const actual = Object.fromEntries(Object.entries(snapshot(dest, synced)).filter(([f]) => owned.has(f)));
  return { ...diffSnapshots(expected, actual), against: source ? source.label : "manifest" };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const repo = path.resolve(process.env.SANDBENCH_REPO_DIR || path.join(root, "..", "sand-bench-enterprise"));
  const ref = process.env.SANDBENCH_REF || "origin/main";
  const haveRepo = existsSync(path.join(repo, "sit", "cases"));

  /** @type {Source | null} */
  let source = null;
  if (haveRepo) {
    if (args.has("--working-tree")) {
      source = dirSource(repo);
    } else {
      if (!args.has("--no-fetch") && ref.startsWith("origin/")) {
        try { execFileSync("git", ["-C", repo, "fetch", "--quiet", "origin"], { stdio: "ignore" }); } catch { /* offline: use the last fetched ref */ }
      }
      source = gitSource(repo, ref);
    }
  }

  if (args.has("--check")) {
    const r = check({ src: source, dest: root });
    if (r.clean) {
      console.log(`sit sync: clean (checked against ${r.against})`);
      return;
    }
    console.error(`sit sync: DRIFT against ${r.against ?? "nothing"}${r.reason ? ` (${r.reason})` : ""}`);
    for (const f of r.added) console.error(`  missing  ${f}`);
    for (const f of r.changed) console.error(`  changed  ${f}`);
    for (const f of r.removed) console.error(`  stale    ${f}`);
    console.error("Edit these in sand-bench-enterprise, merge to main, then run: npm run sync:sit");
    process.exitCode = 1;
    return;
  }

  if (!source) {
    console.error(`sit sync: Sand Bench checkout not found at ${repo} (set SANDBENCH_REPO_DIR)`);
    process.exitCode = 1;
    return;
  }
  const r = sync({ src: source, dest: root });
  console.log(`sit sync: copied ${r.copied} files from ${source.label}`);
  for (const f of r.deleted) console.log(`  deleted  ${f}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
