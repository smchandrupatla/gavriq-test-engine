#!/usr/bin/env tsx
/**
 * Fixer agent — the process on the Docker host that proposes test-case
 * patches when the engine's auto-fix loop asks for one (see
 * apps/api/src/run-fix-loop.ts, awaiting_patch phase).
 *
 * It polls the engine for fix proposals, invokes the local `claude` CLI
 * non-interactively to produce a replacement CaseDef literal, and posts the
 * result back. It never touches the catalog files directly — the engine does
 * the file write when it accepts the proposal, so a patch cannot land unless
 * the engine authorizes it.
 *
 * Run on the host (not a container), where the `claude` CLI lives:
 *
 *   TEST_ENGINE_API=http://127.0.0.1:8797 npm run start:fixer-agent
 *
 *   TEST_ENGINE_API    engine control plane      (default http://127.0.0.1:8797)
 *   WORKER_API_KEY     sent as X-Worker-Key
 *   FIXER_AGENT_ID     this agent's id           (default fixer-<hostname>)
 *   FIXER_POLL_MS      how often to ask for a job (default 5000)
 *   CLAUDE_BIN         path to the claude CLI    (default `claude`)
 *   CLAUDE_TIMEOUT_MS  per-proposal CLI timeout  (default 180000)
 *
 * The guidance passed to Claude pins:
 *   - production (Sand Bench) is the baseline / source of truth
 *   - preserve the atomic-case contract: independence, cleanup, pool-based
 *     identity, baseline round-trip
 *   - if the failure looks like a production defect, say so and do not patch
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.TEST_ENGINE_API || 'http://127.0.0.1:8797').replace(/\/$/, '');
const POLL_MS = Math.max(2_000, Number(process.env.FIXER_POLL_MS) || 5_000);
const KEY = process.env.WORKER_API_KEY || '';
const AGENT_ID = process.env.FIXER_AGENT_ID || `fixer-${os.hostname().toLowerCase()}`;
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const CLAUDE_TIMEOUT_MS = Math.max(30_000, Number(process.env.CLAUDE_TIMEOUT_MS) || 180_000);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const log = (msg: string) => console.log(`[fixer-agent] ${new Date().toISOString()} ${msg}`);

async function api(route: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${route}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(KEY ? { 'x-worker-key': KEY } : {}), ...(opts.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${route} → HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

interface ClaimPayload {
  id: string;
  case_key: string;
  source_file: string;
  source: { case_key: string; file: string; text: string; start_line: number; end_line: number; file_text: string } | null;
  failure: { status?: string; message?: string; classification?: string | null; remarks?: unknown } | null;
  evidence: Array<{ evidence_type: string; storage_key: string }>;
  guidance: { source_of_truth: string; max_diff_lines: number; atomic_rule: string };
}

async function claim(): Promise<ClaimPayload | null> {
  const body = await api('/api/v1/fix-proposals/claim', { method: 'POST', body: JSON.stringify({ agent_id: AGENT_ID }) });
  return body?.data ?? null;
}

async function postComplete(id: string, payload: Record<string, unknown>): Promise<void> {
  await api(`/api/v1/fix-proposals/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function postProgress(id: string, logText: string): Promise<void> {
  try {
    await api(`/api/v1/fix-proposals/${encodeURIComponent(id)}/progress`, {
      method: 'POST',
      body: JSON.stringify({ log: logText.slice(0, 4096) }),
    });
  } catch {
    // progress is best-effort
  }
}

function buildPrompt(claim: ClaimPayload): string {
  if (!claim.source) throw new Error(`No source found for case ${claim.case_key}`);
  const failure = claim.failure || {};
  return [
    `You are the AI test-case fixer for the Gavriq Test Engine.`,
    ``,
    `GOAL: The test case below just failed. Production (Sand Bench) is the baseline / source of truth. Patch the test case to match what the production app actually does today. If the failure clearly indicates a production bug (5xx, contract break, data corruption, anything you cannot in good conscience "fix" by changing the test), reply with exactly PROD_DEFECT on a single line and nothing else.`,
    ``,
    `ATOMIC-CASE RULES THAT MUST BE PRESERVED:`,
    `- The case must run independently by its key, in parallel with others, from the single documented baseline.`,
    `- It must create any record it needs via the application's own API and remove it in cleanupSteps.`,
    `- Logins must use pickUser(caseKey) / pickAdmin(caseKey) from user-pool.ts (one-session-per-user).`,
    `- Baseline reads (/channel-targets, /message-types, TE-FIX-*, tenant_default, user_demo_*, fap_*, dap_*) are allowed.`,
    `- Any OTHER specific id must either be case-created or declare atomicityNote.`,
    ``,
    `OUTPUT REQUIREMENTS:`,
    `- Reply with ONLY the replacement JavaScript object literal (the full { ... } that defines the CaseDef).`,
    `- No markdown fences, no explanation, no leading or trailing text.`,
    `- Keep the same \`key:\` value. Keep the same shape (preconditions, steps[], cleanupSteps[], etc).`,
    `- Keep the diff small: change only what is needed to make the test match production behavior.`,
    `- Hard cap: ${claim.guidance.max_diff_lines} lines of diff vs. the original.`,
    ``,
    `CASE KEY: ${claim.case_key}`,
    `SOURCE FILE: ${claim.source.file} (lines ${claim.source.start_line}-${claim.source.end_line})`,
    ``,
    `FAILURE:`,
    `  status: ${failure.status ?? 'unknown'}`,
    `  classification: ${failure.classification ?? 'none'}`,
    `  message: ${(failure.message ?? '').toString().slice(0, 2000)}`,
    ``,
    `CURRENT CASE SOURCE:`,
    claim.source.text,
    ``,
  ].join('\n');
}

/** Call claude -p non-interactively; return the full stdout string. */
async function runClaude(prompt: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, ['-p', prompt], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      reject(new Error(`claude CLI timed out after ${CLAUDE_TIMEOUT_MS}ms`));
    }, CLAUDE_TIMEOUT_MS);
    child.stdout!.on('data', (d) => (out += String(d)));
    child.stderr!.on('data', (d) => (err += String(d)));
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude CLI exited ${code}: ${err.slice(0, 500)}`));
      resolve(out);
    });
  });
}

function extractLiteral(output: string): string | null {
  const t = output.trim();
  if (t === 'PROD_DEFECT') return null;
  // Pull the outermost { ... } object literal from the response. Everything
  // outside the braces is noise (model preamble, trailing newlines).
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first < 0 || last < 0 || last <= first) throw new Error(`Agent output did not contain a { ... } literal`);
  return t.slice(first, last + 1);
}

function simpleDiff(before: string, after: string): string {
  // A tiny unified-ish summary — enough for the UI, not a real diff engine.
  const b = before.split('\n');
  const a = after.split('\n');
  const added = a.filter((l) => !b.includes(l)).length;
  const removed = b.filter((l) => !a.includes(l)).length;
  return `--- before\n+++ after\n@@ ~${b.length} lines → ~${a.length} lines, +${added} / -${removed} @@\n`;
}

async function handleOne(claim: ClaimPayload): Promise<void> {
  log(`Claimed ${claim.id} for ${claim.case_key} (${claim.source_file})`);
  if (!claim.source) {
    await postComplete(claim.id, {
      status: 'failed',
      classification: 'unknown',
      reason: 'Catalog source not resolvable for this case key',
    });
    return;
  }
  const prompt = buildPrompt(claim);
  await postProgress(claim.id, `Invoking ${CLAUDE_BIN} for ${claim.case_key}; prompt ${prompt.length} chars.`);

  let output = '';
  try {
    output = await runClaude(prompt);
  } catch (err) {
    log(`claude failed: ${(err as Error).message}`);
    await postComplete(claim.id, {
      status: 'failed',
      classification: 'unknown',
      reason: (err as Error).message.slice(0, 500),
    });
    return;
  }

  let after: string | null;
  try {
    after = extractLiteral(output);
  } catch (err) {
    await postComplete(claim.id, {
      status: 'failed',
      classification: 'unknown',
      rationale: output.slice(0, 4000),
      reason: (err as Error).message,
    });
    return;
  }

  if (after === null) {
    log(`${claim.case_key}: classified as prod_defect`);
    await postComplete(claim.id, {
      status: 'applied', // the handler treats classification=prod_defect specially
      classification: 'prod_defect',
      rationale: output.slice(0, 4000),
    });
    return;
  }

  const before = claim.source.text;
  const diff = simpleDiff(before, after);
  const lineDelta = Math.abs(after.split('\n').length - before.split('\n').length);
  if (lineDelta > claim.guidance.max_diff_lines) {
    await postComplete(claim.id, {
      status: 'rejected',
      classification: 'unknown',
      rationale: output.slice(0, 4000),
      reason: `Proposed diff exceeds cap of ${claim.guidance.max_diff_lines} lines (delta ${lineDelta})`,
    });
    return;
  }

  log(`${claim.case_key}: proposing a ${lineDelta}-line patch`);
  await postComplete(claim.id, {
    status: 'applied',
    classification: 'test_broken',
    rationale: `Patched by ${AGENT_ID} via ${CLAUDE_BIN}.`,
    before_source: before,
    after_source: after,
    diff,
    signature: null,
  });
}

async function tick(): Promise<void> {
  const next = await claim();
  if (!next) return;
  try {
    await handleOne(next);
  } catch (err) {
    log(`fatal in handleOne: ${(err as Error).message}`);
    try {
      await postComplete(next.id, { status: 'failed', classification: 'unknown', reason: (err as Error).message.slice(0, 500) });
    } catch {}
  }
}

async function main(): Promise<void> {
  log(`Starting; API=${API} agent=${AGENT_ID} poll=${POLL_MS}ms claude=${CLAUDE_BIN}`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick();
    } catch (err) {
      log(`tick error: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error(`[fixer-agent] fatal: ${(err as Error).stack || err}`);
  process.exit(1);
});
