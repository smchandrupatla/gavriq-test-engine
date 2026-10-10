/**
 * E2E runner — drives tester-army/e2e (https://e2e.tester.army) in a child
 * process so a catalog case can state its journey in plain English.
 *
 * One case = one scratch directory with a generated `e2e.config.ts` and a
 * generated test file; `npx e2e run` drives Playwright under the hood and the
 * agent either plans the actions on first run (needs a model) or replays the
 * recorded plan on later runs (no model needed, no outbound call).
 *
 * The model provider is wired through the OpenAI-compatible adapter pointing at
 * Ollama's own OpenAI-compatible endpoint. In this stack:
 *   E2E_MODEL_BASE_URL   defaults to http://host.docker.internal:11434/v1
 *   E2E_MODEL            defaults to qwen3:4b (any tool-call-capable model)
 * The adapter is deliberately provider-agnostic: swap `E2E_MODEL_BASE_URL` to
 * any OpenAI-compatible server (vLLM, LM Studio, LiteLLM, …) and it just works.
 *
 * Step vocabulary a catalog case uses (method === 'e2e'):
 *   { action: 'navigate',     value: '<path>' }         → app.open(path)
 *   { action: 'agent_act',    value: '<goal>' }         → agent.act(goal)
 *   { action: 'agent_assert', value: '<check>' }        → agent.assert(check)
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeEvidence, writeJsonEvidence, type EvidenceItem } from '../evidence.js';

export interface E2EStep {
  action: 'navigate' | 'agent_act' | 'agent_assert' | string;
  value?: string;
  description?: string;
  text?: string;
}

export interface E2ERunInput {
  baseUrl: string;
  steps?: E2EStep[];
  vars?: Record<string, string>;
  timeoutSeconds?: number;
  signal?: AbortSignal;
}

export interface E2ERunResult {
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration_ms: number;
  classification?: string;
  evidence?: EvidenceItem[];
  remarks?: string[];
  metrics?: Record<string, number>;
}

function substitute(value: string, vars: Record<string, string>): string {
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`);
}

/** Escape a user-supplied value so it can be dropped into a double-quoted TS string. */
function tsQuote(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function renderTestFile(steps: E2EStep[], vars: Record<string, string>): string {
  const body: string[] = [];
  for (const raw of steps) {
    const action = String(raw.action || '');
    const value = typeof raw.value === 'string' ? substitute(raw.value, vars) : '';
    switch (action) {
      case 'navigate':
        body.push(`  await app.open("${tsQuote(value || '/')}");`);
        break;
      case 'agent_act':
        body.push(`  await agent.act("${tsQuote(value)}");`);
        break;
      case 'agent_assert':
        body.push(`  await agent.assert("${tsQuote(value)}");`);
        break;
      default:
        body.push(`  // unsupported action in e2e runner: ${action}`);
    }
  }
  return [
    `import { test } from 'e2e';`,
    ``,
    `test('catalog case', async ({ app, agent }) => {`,
    ...body,
    `});`,
    ``,
  ].join('\n');
}

function renderConfig(appUrl: string, modelBaseUrl: string, modelName: string, testTimeoutMs: number): string {
  // e2e 0.5+ removed `defineConfig`: default-export the object and end it with
  // `satisfies E2EConfig` so the framework still gets its type guarantees.
  // The per-test timeout defaults to 120 s and is the one that bites first on a
  // slow CPU-bound Ollama agent — pass the case's own timeoutSeconds instead.
  return [
    `import { type E2EConfig } from 'e2e';`,
    `import { web } from '@e2e-dev/web';`,
    `import { createOpenAICompatible } from '@ai-sdk/openai-compatible';`,
    ``,
    `const provider = createOpenAICompatible({`,
    `  name: 'ollama',`,
    `  baseURL: ${JSON.stringify(modelBaseUrl)},`,
    `});`,
    ``,
    `export default {`,
    `  targets: [{ engine: web(), app: { url: ${JSON.stringify(appUrl)} } }],`,
    `  agents: { default: { model: provider(${JSON.stringify(modelName)}) } },`,
    `  timeout: ${testTimeoutMs},`,
    `} satisfies E2EConfig;`,
    ``,
  ].join('\n');
}

export async function runE2E(input: E2ERunInput): Promise<E2ERunResult> {
  const started = Date.now();
  const steps = Array.isArray(input.steps) ? input.steps : [];
  if (!steps.length) {
    return {
      status: 'error',
      message: 'No steps to run — an e2e case needs at least one step.',
      duration_ms: 0,
      classification: 'script_problem',
    };
  }

  // Where this case's generated files live. One directory per run keeps the
  // replay cache (./.e2e-cache) scoped to the case; we don't share plans across
  // cases because each one is a different user journey.
  const runRoot = process.env.E2E_RUN_ROOT || path.join(tmpdir(), 'e2e-runs');
  const runDir = path.join(runRoot, `run-${process.pid}-${started}`);
  mkdirSync(runDir, { recursive: true });

  const modelBaseUrl = process.env.E2E_MODEL_BASE_URL || 'http://host.docker.internal:11434/v1';
  const modelName = process.env.E2E_MODEL || 'qwen3:4b';
  const vars = input.vars || {};
  const rawAppUrl = substitute(input.baseUrl || vars.web || '', vars);

  // e2e refuses plain HTTP for any host that is not literal localhost / 127.x /
  // ::1 (apps/worker/node_modules/e2e/dist/internal/urls.js). Inside a
  // container those names point at the container itself, so a loopback
  // forwarder gives the e2e agent a URL it accepts while the traffic goes to
  // the host's real service. The proxy ends when the runner returns.
  const proxy = await startLoopbackProxy(rawAppUrl);
  const appUrl = proxy?.url ?? rawAppUrl;

  // Give the per-test timeout a bit more headroom than our spawn timeout so
  // e2e's own kill fires first with a clean "test timed out" classification.
  const spawnTimeoutMs = Math.max(30, Number(input.timeoutSeconds) || 180) * 1000;
  const testTimeoutMs = Math.max(60000, spawnTimeoutMs - 30000);
  writeFileSync(path.join(runDir, 'e2e.config.ts'), renderConfig(appUrl, modelBaseUrl, modelName, testTimeoutMs));
  // e2e discovers test files under tests/**/*.e2e.ts by default.
  const testsDir = path.join(runDir, 'tests');
  mkdirSync(testsDir, { recursive: true });
  const testPath = path.join(testsDir, 'case.e2e.ts');
  writeFileSync(testPath, renderTestFile(steps, vars));

  // The generated test file imports from "e2e", which Node resolves by walking
  // up for a node_modules directory. The scratch dir has none, so point it at
  // the worker's own node_modules via a symlink. E2E_PROJECT_ROOT overrides the
  // search for environments where the worker is laid out differently.
  const projectRoot = process.env.E2E_PROJECT_ROOT || findProjectRoot();
  if (projectRoot) {
    const nmLink = path.join(runDir, 'node_modules');
    if (!existsSync(nmLink)) {
      try { symlinkSync(path.join(projectRoot, 'node_modules'), nmLink, 'dir'); } catch { /* best effort */ }
    }
  }

  const timeoutMs = spawnTimeoutMs;
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolve) => {
    const child = spawn('npx', ['e2e', 'run', 'case.e2e.ts'], {
      cwd: runDir,
      env: { ...process.env, PATH: process.env.PATH, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const kill = () => { try { child.kill('SIGKILL'); } catch { /* already gone */ } };
    const to = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
    const onAbort = () => { timedOut = true; kill(); };
    input.signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout?.on('data', (c) => { stdout += c.toString('utf8'); });
    child.stderr?.on('data', (c) => { stderr += c.toString('utf8'); });
    child.on('exit', (code) => {
      clearTimeout(to);
      input.signal?.removeEventListener('abort', onAbort);
      resolve({ code, stdout, stderr, timedOut });
    });
    child.on('error', (err) => {
      clearTimeout(to);
      resolve({ code: null, stdout, stderr: stderr + `\n[spawn error] ${(err as Error).message}`, timedOut });
    });
  });

  proxy?.close();

  const duration_ms = Date.now() - started;
  const evidence: EvidenceItem[] = [];
  const push = (item: EvidenceItem | null) => { if (item) evidence.push(item); };
  push(writeEvidence({
    type: 'log',
    prefix: 'e2e-stdout',
    ext: 'log',
    content: result.stdout || '(empty)',
    contentType: 'text/plain',
  }));
  if (result.stderr) {
    push(writeEvidence({
      type: 'log',
      prefix: 'e2e-stderr',
      ext: 'log',
      content: result.stderr,
      contentType: 'text/plain',
    }));
  }
  // The generated test file is itself part of the audit trail.
  push(writeEvidence({
    type: 'script',
    prefix: 'e2e-case',
    ext: 'ts',
    content: readFileSync(testPath, 'utf8'),
    contentType: 'text/plain',
  }));
  push(writeJsonEvidence('config', 'e2e-config', {
    app_url: appUrl,
    model_base_url: modelBaseUrl,
    model: modelName,
    cwd: runDir,
    cache_present: existsSync(path.join(runDir, '.e2e-cache')),
  }));

  if (result.timedOut) {
    return {
      status: 'error',
      message: `e2e run timed out after ${timeoutMs / 1000} s`,
      duration_ms,
      classification: 'timeout',
      evidence,
      remarks: ['The agent did not finish in time; its plan may be slow against the model, or the model is unavailable.'],
    };
    // (classification values must stay in the failure_classification enum.)
  }
  if (result.code === 0) {
    return {
      status: 'passed',
      message: 'e2e case passed',
      duration_ms,
      evidence,
      remarks: summarise(result.stdout),
    };
  }
  const classification = classifyFailure(result.stdout + '\n' + result.stderr);
  // A missing provider / unreachable model is "error" (the test could not run);
  // a successful run that failed its assertion is "failed" (the test ran, verdict negative).
  const status = classification === 'network_failure' || classification === 'authentication_problem' || classification === 'dependency_failure' || classification === 'script_problem' ? 'error' : 'failed';
  return {
    status,
    message: tailOneLine(result.stderr || result.stdout) || `e2e run exited with code ${result.code}`,
    duration_ms,
    classification,
    evidence,
    remarks: summarise(result.stdout + '\n' + result.stderr),
  };
}

function tailOneLine(blob: string): string | undefined {
  const lines = (blob || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1];
  return last ? last.slice(0, 400) : undefined;
}

function summarise(blob: string): string[] {
  const out: string[] = [];
  for (const line of (blob || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    if (/^(agent|app|✓|✗|PASS|FAIL|error|cache)/i.test(t)) out.push(t.slice(0, 240));
    if (out.length >= 20) break;
  }
  return out;
}

/**
 * Map e2e-runner failure modes onto Postgres's `failure_classification` enum
 * (apps/api/src/db/schema.sql). The engine refuses any value outside that enum.
 */
function classifyFailure(blob: string): string {
  const lower = (blob || '').toLowerCase();
  if (lower.includes('econnrefused') || lower.includes('fetch failed') || lower.includes('enotfound')) return 'network_failure';
  if (lower.includes('unauthorized') || lower.includes('invalid api key') || lower.includes('401')) return 'authentication_problem';
  if (lower.includes('cannot find package') || lower.includes('cannot find module') || lower.includes('module not found')) return 'dependency_failure';
  if (lower.includes('config_load_failed') || lower.includes('configuration error')) return 'script_problem';
  if (lower.includes('timeout')) return 'timeout';
  return 'assertion_failure';
}

/**
 * Open a TCP proxy on 127.0.0.1 that forwards every connection to the actual
 * host:port of `targetUrl`. Returns the loopback URL (same path) so the e2e
 * config can declare it as its app URL. The runner closes the proxy once the
 * child process exits.
 */
async function startLoopbackProxy(targetUrl: string): Promise<{ url: string; close: () => void } | null> {
  let parsed: URL;
  try { parsed = new URL(targetUrl); } catch { return null; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const upstreamHost = parsed.hostname;
  const upstreamPort = Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80);
  // Already loopback (test harness, local run): no proxy needed.
  if (upstreamHost === 'localhost' || upstreamHost === '::1' || upstreamHost === '[::1]' || /^127(\.\d{1,3}){3}$/.test(upstreamHost)) {
    return null;
  }
  return await new Promise((resolve) => {
    const server = net.createServer((sock) => {
      const up = net.connect(upstreamPort, upstreamHost);
      sock.on('error', () => up.destroy());
      up.on('error', () => sock.destroy());
      sock.pipe(up); up.pipe(sock);
    });
    server.on('error', () => resolve(null));
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        url: `${parsed.protocol}//127.0.0.1:${port}${parsed.pathname}${parsed.search}`,
        close: () => { try { server.close(); } catch { /* best effort */ } },
      });
    });
  });
}

/** Walk up from __dirname to find a node_modules containing the e2e package. */
function findProjectRoot(): string | null {
  let dir = path.dirname(new URL(import.meta.url).pathname);
  // Strip a leading slash on Windows paths like "/C:/..." so fs can read them.
  if (/^\/[A-Za-z]:/.test(dir)) dir = dir.slice(1);
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, 'node_modules', 'e2e', 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
