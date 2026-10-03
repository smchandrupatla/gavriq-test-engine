#!/usr/bin/env tsx
/**
 * Infra agent — the process on the Docker host that does what the engine's
 * infrastructure lifecycle decides (apps/api/src/infra.ts).
 *
 * It polls the engine for infra jobs and runs them one at a time:
 *   deploy    node deploy/<name>/deploy.mjs deploy --ref <ref>     (the environment's own script)
 *   teardown  node deploy/<name>/deploy.mjs down [--rmi] [--volumes], then a label-scoped sweep
 *             of anything the compose project left behind
 *   prune     Docker housekeeping scoped to the managed compose projects: their stopped
 *             containers and unused images, plus dangling images and old build cache
 *
 * It runs where `docker`, `git` and the sibling checkouts live — on this machine
 * the Windows host, not a container:
 *
 *   TEST_ENGINE_API=http://127.0.0.1:8797 npm run start:infra-agent
 *
 *   TEST_ENGINE_API      engine control plane            (default http://127.0.0.1:8797)
 *   WORKER_API_KEY       sent as X-Worker-Key when the engine runs with RBAC
 *   INFRA_AGENT_ID       this agent's id                 (default infra-<hostname>)
 *   INFRA_POLL_MS        how often to ask for a job      (default 5000)
 *   INFRA_REPO_ROOT      the engine checkout the deploy scripts live in (default: this one)
 *
 * Only scripts matching deploy/<name>/deploy.mjs under the repository root are
 * ever run, whatever a job says.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.TEST_ENGINE_API || 'http://127.0.0.1:8797').replace(/\/$/, '');
const POLL_MS = Math.max(2_000, Number(process.env.INFRA_POLL_MS) || 5_000);
const HEARTBEAT_MS = 30_000;
const KEY = process.env.WORKER_API_KEY || '';
const ROOT = path.resolve(process.env.INFRA_REPO_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..'));
const AGENT_ID = process.env.INFRA_AGENT_ID || `infra-${os.hostname().toLowerCase()}`;
const DOCKER = process.env.DOCKER_BIN || 'docker';
const SCRIPT_PATTERN = /^deploy\/[\w.-]+\/deploy\.mjs$/;
const TIMEOUTS_MS = { deploy: 40 * 60_000, teardown: 10 * 60_000, prune: 15 * 60_000 } as const;
const LOG_KEEP = 48 * 1024;

type Job = {
  id: string;
  kind: 'deploy' | 'teardown' | 'prune';
  params: Record<string, any>;
  environment?: { id: string; key: string; name: string } | null;
  reason?: string;
};

function version(): string {
  try {
    return String(JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

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

const log = (msg: string) => console.log(`[infra-agent] ${new Date().toISOString()} ${msg}`);

// ---------------------------------------------------------------------------
// Running commands
// ---------------------------------------------------------------------------
let current: ChildProcess | null = null;

interface RunResult { code: number | null; output: string }

function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs: number; onOutput?: (chunk: string) => void }): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd || ROOT, env: opts.env || process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    current = child;
    let output = '';
    const take = (buf: Buffer) => {
      const text = buf.toString('utf8');
      output = (output + text).slice(-LOG_KEEP * 4);
      opts.onOutput?.(text);
    };
    child.stdout?.on('data', take);
    child.stderr?.on('data', take);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${cmd} ${args.slice(0, 3).join(' ')} … timed out after ${Math.round(opts.timeoutMs / 60_000)} minutes\n${tail(output)}`));
    }, opts.timeoutMs);
    child.on('error', (err) => { clearTimeout(timer); current = null; reject(err); });
    child.on('close', (code) => { clearTimeout(timer); current = null; resolve({ code, output }); });
  });
}

const tail = (s: string, n = 2_000) => (s.length > n ? s.slice(-n) : s).trim();

async function docker(args: string[], timeoutMs = 120_000): Promise<string> {
  const res = await run(DOCKER, args, { timeoutMs });
  if (res.code !== 0) throw new Error(`docker ${args.slice(0, 3).join(' ')} exited ${res.code}: ${tail(res.output, 600)}`);
  return res.output.trim();
}

const lines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

async function dockerLines(args: string[]): Promise<string[]> {
  return lines(await docker(args));
}

function scriptPath(params: Record<string, any>): string {
  const script = String(params.script || '');
  if (!SCRIPT_PATTERN.test(script)) throw new Error(`refusing to run "${script}": only deploy/<name>/deploy.mjs scripts are allowed`);
  const file = path.join(ROOT, script);
  if (!existsSync(file)) throw new Error(`${script} not found under ${ROOT}`);
  return file;
}

/** The deploy scripts end with a line "RESULT {json}" describing what is deployed. */
function parseResult(output: string): Record<string, unknown> {
  const match = [...output.matchAll(/RESULT (\{.*\})\s*$/gm)].pop();
  if (!match) return {};
  try {
    return JSON.parse(match[1]!);
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Job handlers
// ---------------------------------------------------------------------------
type Progress = (text: string) => void;

async function deploy(job: Job, progress: Progress) {
  const file = scriptPath(job.params);
  const ref = String(job.params.ref || 'main');
  progress(`$ node ${path.relative(ROOT, file)} deploy --ref ${ref}\n`);
  const res = await run(process.execPath, [file, 'deploy', '--ref', ref], {
    env: { ...process.env, TE_BASE: API },
    timeoutMs: TIMEOUTS_MS.deploy,
    onOutput: progress,
  });
  if (res.code !== 0) throw new Error(`deploy --ref ${ref} exited ${res.code}\n${tail(res.output)}`);
  return { ref, ...parseResult(res.output) };
}

/** Everything a compose project left behind, by label — the safety net under `down`. */
async function sweepProject(project: string, opts: { images: boolean; volumes: boolean }, progress: Progress) {
  const removed = { containers: 0, networks: 0, images: 0, volumes: 0, not_removed: 0 };
  const filter = `label=com.docker.compose.project=${project}`;
  const containers = await dockerLines(['ps', '-aq', '--filter', filter]);
  if (containers.length) progress(`sweep: removing ${containers.length} container(s) of ${project}\n`);
  for (const id of containers) {
    // A daemon under memory pressure sometimes cannot remove a container it has already stopped
    // ("did not receive an exit event"); a stopped leftover is housekeeping's job, not a failure.
    try { await docker(['rm', '-f', id]); removed.containers++; } catch (err) { removed.not_removed++; progress(`could not remove ${id}: ${(err as Error).message.split('\n').pop()}\n`); }
  }
  const networks = await dockerLines(['network', 'ls', '-q', '--filter', filter]);
  for (const id of networks) {
    try { await docker(['network', 'rm', id]); removed.networks++; } catch { /* still in use by something else */ }
  }
  if (opts.images) {
    const images = await dockerLines(['images', '-q', '--filter', filter]);
    for (const id of [...new Set(images)]) {
      try { await docker(['rmi', id]); removed.images++; } catch { /* another container uses it */ }
    }
  }
  if (opts.volumes) {
    const volumes = await dockerLines(['volume', 'ls', '-q', '--filter', filter]);
    for (const name of volumes) {
      try { await docker(['volume', 'rm', name]); removed.volumes++; } catch { /* in use */ }
    }
  }
  return removed;
}

async function teardown(job: Job, progress: Progress) {
  const file = scriptPath(job.params);
  const project = typeof job.params.compose_project === 'string' ? job.params.compose_project : null;
  const removeImages = job.params.remove_images !== false;
  const removeVolumes = job.params.remove_volumes === true;
  const args = [file, 'down', ...(removeImages ? ['--rmi'] : []), ...(removeVolumes ? ['--volumes'] : [])];
  progress(`$ node ${path.relative(ROOT, file)} ${args.slice(1).join(' ')}\n`);
  let scriptError: string | null = null;
  const res = await run(process.execPath, args, { env: { ...process.env, TE_BASE: API }, timeoutMs: TIMEOUTS_MS.teardown, onOutput: progress });
  if (res.code !== 0) scriptError = `down exited ${res.code}: ${tail(res.output, 600)}`;

  let swept = null;
  if (project) swept = await sweepProject(project, { images: removeImages, volumes: removeVolumes }, progress);
  // Down means nothing of the stack is running. Stopped leftovers the daemon would not remove are reported;
  // housekeeping removes them when the daemon is well again.
  const running = project ? await dockerLines(['ps', '-q', '--filter', `label=com.docker.compose.project=${project}`]) : [];
  if (running.length) throw new Error(`${running.length} container(s) of ${project} are still running after teardown${scriptError ? `; ${scriptError}` : ''}`);
  if (scriptError && !project) throw new Error(scriptError);
  const leftover = project ? (await dockerLines(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`])).length : 0;
  if (leftover) progress(`${leftover} stopped container(s) of ${project} could not be removed yet; housekeeping will\n`);
  return { compose_project: project, remove_images: removeImages, remove_volumes: removeVolumes, swept, stopped_leftovers: leftover, script_error: scriptError };
}

const SIZE_UNITS: Record<string, number> = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3 };
function parseSize(text: string): number {
  const m = /([\d.]+)\s*([KMGT]?i?B)/i.exec(text || '');
  return m ? Math.round(Number(m[1]) * (SIZE_UNITS[m[2]!.toUpperCase()] || 1)) : 0;
}

async function systemDf() {
  const out: Record<string, { total: number; active: number; size: string; size_bytes: number; reclaimable: string; reclaimable_bytes: number }> = {};
  for (const line of await dockerLines(['system', 'df', '--format', '{{json .}}'])) {
    try {
      const row = JSON.parse(line);
      const key = String(row.Type || '').toLowerCase().replace(/\s+/g, '_');
      out[key] = {
        total: Number(row.TotalCount) || 0,
        active: Number(row.Active) || 0,
        size: String(row.Size || ''),
        size_bytes: parseSize(String(row.Size || '')),
        reclaimable: String(row.Reclaimable || ''),
        reclaimable_bytes: parseSize(String(row.Reclaimable || '')),
      };
    } catch { /* skip */ }
  }
  return out;
}

const totalBytes = (df: Awaited<ReturnType<typeof systemDf>>) => Object.values(df).reduce((n, t) => n + t.size_bytes, 0);

function matchesPrefix(repository: string, prefixes: string[]): boolean {
  const repo = repository.toLowerCase();
  return prefixes.some((p) => {
    const prefix = p.toLowerCase();
    return repo === prefix || repo.startsWith(`${prefix}-`) || repo.startsWith(`${prefix}_`) || repo.startsWith(`${prefix}/`);
  });
}

async function prune(job: Job, progress: Progress) {
  const dry = job.params.dry_run === true;
  const projects: string[] = Array.isArray(job.params.projects) ? job.params.projects.map(String) : [];
  const prefixes: string[] = Array.isArray(job.params.image_prefixes) ? job.params.image_prefixes.map(String) : [];
  const cacheHours = Number(job.params.build_cache_hours) || 0;
  const before = await systemDf();
  const removed = { containers: [] as string[], images: [] as string[], dangling_images: 0, build_cache: '', skipped_in_use: [] as string[] };
  progress(`${dry ? 'DRY RUN — ' : ''}housekeeping for projects [${projects.join(', ')}], image prefixes [${prefixes.join(', ')}]\n`);

  // 1. Stopped containers of the managed compose projects.
  for (const project of projects) {
    const ids = await dockerLines(['ps', '-a', '--filter', `label=com.docker.compose.project=${project}`,
      '--filter', 'status=exited', '--filter', 'status=created', '--filter', 'status=dead', '--format', '{{.ID}} {{.Names}}']);
    for (const entry of ids) {
      const [id, name] = entry.split(' ');
      removed.containers.push(`${project}/${name || id}`);
      if (!dry) await docker(['rm', '-f', id!]);
    }
  }
  progress(`stopped containers of managed projects: ${removed.containers.length}\n`);

  // 2. Images of the managed projects that no container uses (any tag, any commit).
  if (prefixes.length) {
    const inUseIds = new Set<string>();
    const inUseRefs = new Set<string>();
    const containerIds = await dockerLines(['ps', '-aq']);
    if (containerIds.length) {
      for (const l of await dockerLines(['inspect', '--format', '{{.Image}} {{.Config.Image}}', ...containerIds])) {
        const [id, ref] = l.split(' ');
        if (id) inUseIds.add(id.replace(/^sha256:/, ''));
        if (ref) inUseRefs.add(ref);
      }
    }
    for (const l of await dockerLines(['images', '--no-trunc', '--format', '{{.ID}}\t{{.Repository}}\t{{.Tag}}'])) {
      const [id = '', repo = '', tag = ''] = l.split('\t');
      if (!repo || repo === '<none>' || !matchesPrefix(repo, prefixes)) continue;
      const ref = `${repo}:${tag}`;
      if (inUseIds.has(id.replace(/^sha256:/, '')) || inUseRefs.has(ref) || inUseRefs.has(repo)) {
        removed.skipped_in_use.push(ref);
        continue;
      }
      removed.images.push(ref);
      if (!dry) {
        try { await docker(['rmi', ref]); } catch (err) { progress(`could not remove ${ref}: ${(err as Error).message}\n`); }
      }
    }
  }
  progress(`unused images of managed projects: ${removed.images.length} (${removed.skipped_in_use.length} in use kept)\n`);

  // 3. Dangling images (untagged layers nothing references) and 4. build cache older than the policy's window.
  if (dry) {
    removed.dangling_images = (await dockerLines(['images', '-q', '--filter', 'dangling=true'])).length;
    removed.build_cache = cacheHours > 0 ? `would prune build cache unused for ${cacheHours}h` : 'kept';
  } else {
    const dangling = await docker(['image', 'prune', '-f']);
    removed.dangling_images = (dangling.match(/^deleted: sha256:/gm) || []).length;
    progress(`dangling images: ${removed.dangling_images} removed\n`);
    if (cacheHours > 0) {
      const out = await docker(['builder', 'prune', '-f', '--filter', `until=${cacheHours}h`], 10 * 60_000);
      removed.build_cache = (/Total:?\s*reclaimed space:?\s*([^\n]+)/i.exec(out)?.[1] || out.split('\n').pop() || '').trim();
      progress(`build cache: ${removed.build_cache}\n`);
    } else {
      removed.build_cache = 'kept';
    }
  }

  const after = dry ? before : await systemDf();
  const reclaimed = Math.max(0, totalBytes(before) - totalBytes(after));
  progress(`${dry ? 'would reclaim (not computed in a dry run)' : `reclaimed ${(reclaimed / 1e9).toFixed(2)} GB`}\n`);
  return { dry_run: dry, before, after, reclaimed_bytes: dry ? null : reclaimed, removed };
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let stopping = false;
let busy = false;

async function heartbeat() {
  try {
    await api('/api/v1/infra/agents/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ id: AGENT_ID, name: AGENT_ID, host: os.hostname(), version: version(), metadata: { platform: process.platform, root: ROOT, pid: process.pid } }),
    });
  } catch (err) {
    log(`heartbeat failed: ${(err as Error).message}`);
  }
}

async function handle(job: Job) {
  let buffer = '';
  let lastSent = 0;
  let sending: Promise<unknown> | null = null;
  const progress: Progress = (text) => {
    buffer = (buffer + text).slice(-LOG_KEEP);
    process.stdout.write(text);
    if (Date.now() - lastSent > 5_000 && !sending) {
      lastSent = Date.now();
      sending = api(`/api/v1/infra/jobs/${job.id}/progress`, { method: 'POST', body: JSON.stringify({ log: buffer }) })
        .catch(() => {})
        .finally(() => { sending = null; });
    }
  };
  const started = Date.now();
  log(`job ${job.id} ${job.kind}${job.environment ? ` ${job.environment.key}` : ''} (${job.reason || 'requested'}) started`);
  let outcome: { status: 'succeeded' | 'failed'; result?: unknown; error?: string };
  try {
    const result = job.kind === 'deploy' ? await deploy(job, progress) : job.kind === 'teardown' ? await teardown(job, progress) : await prune(job, progress);
    outcome = { status: 'succeeded', result };
  } catch (err) {
    outcome = { status: 'failed', error: (err as Error).message.slice(0, 2_000) };
  }
  if (sending) await sending;
  const elapsed = Math.round((Date.now() - started) / 1000);
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await api(`/api/v1/infra/jobs/${job.id}/complete`, { method: 'POST', body: JSON.stringify({ ...outcome, log: buffer }) });
      break;
    } catch (err) {
      log(`could not report job ${job.id} (attempt ${attempt}): ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 5_000 * attempt));
    }
  }
  log(`job ${job.id} ${job.kind} ${outcome.status} after ${elapsed}s${outcome.error ? `: ${outcome.error.split('\n')[0]}` : ''}`);
}

async function poll() {
  if (busy || stopping) return;
  busy = true;
  try {
    const res = await api('/api/v1/infra/jobs/claim', { method: 'POST', body: JSON.stringify({ agent_id: AGENT_ID }) });
    if (res?.data) await handle(res.data as Job);
  } catch (err) {
    log(`poll failed: ${(err as Error).message}`);
  } finally {
    busy = false;
  }
}

async function main() {
  try {
    const v = await docker(['version', '--format', '{{.Server.Version}}'], 30_000);
    log(`docker ${v} available`);
  } catch (err) {
    console.error(`[infra-agent] docker is not usable here: ${(err as Error).message}`);
    process.exit(1);
  }
  log(`agent ${AGENT_ID} · engine ${API} · repo ${ROOT} · polling every ${POLL_MS}ms`);
  await heartbeat();
  setInterval(heartbeat, HEARTBEAT_MS).unref();
  await poll();
  setInterval(poll, POLL_MS);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (stopping) process.exit(130);
    stopping = true;
    log(`${signal}: stopping${current ? ' (killing the running command)' : ''}`);
    current?.kill();
    setTimeout(() => process.exit(130), busy ? 15_000 : 0).unref();
  });
}

main().catch((err) => {
  console.error('[infra-agent]', err);
  process.exit(1);
});
