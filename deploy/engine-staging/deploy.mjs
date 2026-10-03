#!/usr/bin/env node
/**
 * Deploy a pinned commit of the Test Engine as its own STAGING stack and
 * register it with the engine that runs the tests, as the environment
 * "engine-staging" of the application "gavriq-test-engine".
 *
 *   node deploy/engine-staging/deploy.mjs deploy [--ref HEAD] [--no-seed] [--no-register]
 *   node deploy/engine-staging/deploy.mjs status
 *   node deploy/engine-staging/deploy.mjs seed [--engine URL]
 *   node deploy/engine-staging/deploy.mjs register
 *   node deploy/engine-staging/deploy.mjs stop
 *   node deploy/engine-staging/deploy.mjs down [--rmi] [--volumes]   containers (+ images, + data) removed; engine told it is down
 *   node deploy/engine-staging/deploy.mjs reset
 *
 * The source is exported with `git archive`, so staging runs exactly what is
 * committed at <ref> — never the uncommitted working tree the development
 * engine is built from. State lives in ENGINE_STAGING_HOME, outside the
 * repository.
 *
 *   ENGINE_STAGING_HOME   state directory              (default ../gavriq-test-engine-staging)
 *   TE_BASE               engine that runs the tests   (default http://127.0.0.1:8797)
 *   STAGING_ENGINE_PORT   host port of staging         (default 18797)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const PROJECT = 'gavriq-test-engine-staging';
const ENV_KEY = 'engine-staging';
const APP_KEY = 'gavriq-test-engine';
const SERVICES = ['sit-console-db', 'test-engine', 'scheduler'];
const KEEP_SOURCES = 2;

const home = path.resolve(process.env.ENGINE_STAGING_HOME || path.join(root, '../gavriq-test-engine-staging'));
const controller = (process.env.TE_BASE || 'http://127.0.0.1:8797').replace(/\/$/, '');
const port = Number(process.env.STAGING_ENGINE_PORT) || 18797;
const staging = `http://127.0.0.1:${port}`;
const stateFile = path.join(home, 'deployed.json');

/**
 * Sandbox data the self-test catalogue writes into, kept apart from every real
 * application: one application, one environment and a few cases whose
 * automation status, tags and method put them in different safety categories.
 * A target without these is not prepared for the catalogue's write cases —
 * they report "skipped: precondition not met" there.
 */
const FIXTURE_APP = { key: 'te-selftest-fixtures', name: 'Self-test fixtures', description: 'Sandbox data for the Test Engine self-test catalogue (application gavriq-test-engine). Holds nothing real; safe to delete.' };
const FIXTURE_ENV_KEY = 'te-selftest-target';
const FIXTURE_POLICY = {
  functional_smoke: 'allowed', read_only_api: 'allowed', write_api: 'allowed', security_scan: 'allowed',
  load: 'approval_required', stress: 'approval_required',
  chaos: 'prohibited', soak: 'prohibited', destructive_db: 'prohibited',
};
const probe = (urlPath) => [{ action: 'request', method: 'GET', url: `{{engine}}${urlPath}`, expected_status: 200, description: `fixture probe ${urlPath}` }];
const FIXTURE_CASES = [
  { key: 'TE-FIX-PASS', name: 'Self-test fixture · readiness probe', test_type: 'smoke', execution_method: 'http', steps: probe('/ready'), automation_status: 'automated', lifecycle: 'active', tags: ['selftest-fixture'] },
  { key: 'TE-FIX-SECOND', name: 'Self-test fixture · health probe', test_type: 'smoke', execution_method: 'http', steps: probe('/health'), automation_status: 'automated', lifecycle: 'active', tags: ['selftest-fixture'] },
  { key: 'TE-FIX-MANUAL', name: 'Self-test fixture · manual case', test_type: 'acceptance', execution_method: 'http', steps: probe('/ready'), automation_status: 'manual', lifecycle: 'active', tags: ['selftest-fixture'] },
  { key: 'TE-FIX-CHAOS', name: 'Self-test fixture · chaos-tagged case', test_type: 'api', execution_method: 'http', steps: probe('/ready'), automation_status: 'automated', lifecycle: 'active', tags: ['selftest-fixture', 'chaos'] },
  { key: 'TE-FIX-LOAD', name: 'Self-test fixture · load case', test_type: 'performance', execution_method: 'performance', steps: [], validation_rules: { url: '{{engine}}/ready', requests: 5, concurrency: 1 }, automation_status: 'automated', lifecycle: 'active', tags: ['selftest-fixture'] },
  { key: 'TE-FIX-ARCHIVED', name: 'Self-test fixture · archived case', test_type: 'smoke', execution_method: 'http', steps: probe('/ready'), automation_status: 'automated', lifecycle: 'archived', tags: ['selftest-fixture'] },
];

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.slice(0, 4).join(' ')} … exited ${res.status}\n${(res.stderr || res.stdout || '').trim().slice(-2000)}`);
  }
  return (res.stdout || '').trim();
}

function option(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function exportSource(ref) {
  const commit = run('git', ['-C', root, 'rev-parse', '--verify', `${ref}^{commit}`]);
  const tag = commit.slice(0, 12);
  const sources = path.join(home, 'src');
  const dir = path.join(sources, tag);
  if (!existsSync(path.join(dir, 'compose.yaml'))) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    // Relative names only: GNU tar reads "C:\…" as a remote host.
    run('git', ['-C', root, '-c', 'core.autocrlf=false', 'archive', '--format=tar', '-o', path.join(sources, `${tag}.tar`), commit]);
    run('tar', ['-xf', `${tag}.tar`, '-C', tag], { cwd: sources });
    rmSync(path.join(sources, `${tag}.tar`), { force: true });
    console.log(`[engine-staging] exported ${ref} (${tag}) → ${dir}`);
  }
  let version = '0.0.0';
  try {
    version = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).version || version;
  } catch { /* keep default */ }
  const subject = run('git', ['-C', root, 'log', '-1', '--format=%s', commit]);
  // A symbolic ref would say nothing a day later; record the branch it named.
  const branch = ref === 'HEAD' ? run('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD']) : ref;
  return { ref: branch, commit, tag, dir, version, subject };
}

function pruneSources(keepTag) {
  const sources = path.join(home, 'src');
  const dirs = readdirSync(sources)
    .filter((name) => name !== keepTag && statSync(path.join(sources, name)).isDirectory())
    .sort((a, b) => statSync(path.join(sources, b)).mtimeMs - statSync(path.join(sources, a)).mtimeMs);
  for (const name of dirs.slice(KEEP_SOURCES - 1)) rmSync(path.join(sources, name), { recursive: true, force: true });
}

function compose(src, args, { inherit = true } = {}) {
  const base = [
    'compose', '-p', PROJECT, '--project-directory', src.dir,
    '-f', path.join(src.dir, 'compose.yaml'), '-f', path.join(here, 'compose.override.yml'),
  ];
  // The repository's own .env configures the development engine (profiles,
  // host port, SIT targets); none of it may leak into staging.
  const env = { ...process.env, GTE_STAGING_TAG: src.tag, STAGING_ENGINE_PORT: String(port), COMPOSE_PROFILES: '' };
  for (const name of Object.keys(env)) {
    if (/^(SIT_|TEST_ENGINE_HOST_PORT|EVIDENCE_|TARGET_BASE_URL|WORKER_API_KEY|TRIGGER_API_KEYS|SCHEDULER_TZ)/.test(name)) delete env[name];
  }
  return run('docker', [...base, ...args], inherit ? { env, stdio: 'inherit' } : { env });
}

async function call(base, method, urlPath, body) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = undefined; }
  return { ok: res.ok, status: res.status, json, text };
}

/**
 * On an empty database the engine seeds its whole catalogue before it listens,
 * which outlasts the container health check's window; `compose up --wait`
 * would report a boot that is still in progress as failed.
 */
async function waitForEngine(timeoutMs = 15 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  process.stdout.write('[engine-staging] waiting for the engine to answer');
  while (Date.now() < deadline) {
    try {
      if ((await call(staging, 'GET', '/health')).json?.service === 'gavriq-test-engine') {
        process.stdout.write(' up\n');
        return;
      }
    } catch { /* not listening yet */ }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
  process.stdout.write('\n');
  throw new Error(`staging did not answer ${staging}/health within ${Math.round(timeoutMs / 60_000)} minutes`);
}

async function verify() {
  const checks = [];
  const check = async (name, urlPath, test) => {
    try {
      const res = await call(staging, 'GET', urlPath);
      const detail = res.ok ? test(res) : `HTTP ${res.status}`;
      checks.push({ name, url: `${staging}${urlPath}`, ok: !detail, detail: detail || `HTTP ${res.status}` });
    } catch (err) {
      checks.push({ name, url: `${staging}${urlPath}`, ok: false, detail: err.cause?.code || err.message });
    }
  };
  await check('api', '/health', (r) => (r.json?.service === 'gavriq-test-engine' ? '' : `service is "${r.json?.service}"`));
  await check('ready', '/ready', (r) => (r.json?.status === 'ready' ? '' : `status is "${r.json?.status}"`));
  await check('console', '/', (r) => (r.text.includes('GAVRIQ Test Engine') ? '' : 'console shell not served'));
  await check('sit console', '/sit/health', () => '');
  await check('catalogue', '/api/v1/test-cases?limit=1', (r) => (r.json?.total > 0 ? '' : 'no test cases seeded'));
  for (const c of checks) console.log(`[engine-staging] ${c.ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(12)} ${c.detail}  ${c.url}`);
  return checks.every((c) => c.ok);
}

/** Create the self-test fixtures on an engine. Safe to repeat: existing rows are left as they are. */
async function seed(target) {
  const must = (res, what) => {
    if (!res.ok) throw new Error(`fixture seed: ${what} returned HTTP ${res.status}: ${res.text.slice(0, 300)}`);
    return res.json?.data;
  };
  const created = [];

  const apps = must(await call(target, 'GET', '/api/v1/applications'), 'application list');
  let app = apps.find((a) => a.key === FIXTURE_APP.key);
  if (!app) {
    app = must(await call(target, 'POST', '/api/v1/applications', { ...FIXTURE_APP, created_by: 'deploy/engine-staging' }), 'application create');
    created.push(`application ${app.key}`);
  }

  const envBody = {
    name: 'Self-test fixtures · policy target',
    env_type: 'integration',
    base_url: target,
    status: 'active',
    config: { applications: [FIXTURE_APP.key], vars: { engine: target } },
    safety_policy: FIXTURE_POLICY,
  };
  if ((await call(target, 'GET', `/api/v1/environments/${FIXTURE_ENV_KEY}`)).ok) {
    must(await call(target, 'PATCH', `/api/v1/environments/${FIXTURE_ENV_KEY}`, { ...envBody, updated_by: 'deploy/engine-staging' }), 'environment update');
  } else {
    must(await call(target, 'POST', '/api/v1/environments', { key: FIXTURE_ENV_KEY, ...envBody, created_by: 'deploy/engine-staging' }), 'environment create');
    created.push(`environment ${FIXTURE_ENV_KEY}`);
  }

  for (const c of FIXTURE_CASES) {
    if ((await call(target, 'GET', `/api/v1/test-cases/${c.key}`)).ok) continue;
    must(
      await call(target, 'POST', '/api/v1/test-cases', {
        ...c,
        application_id: app.id,
        description: 'Fixture for the engine self-test catalogue. Not a test of any product.',
        expected_results: 'n/a',
        created_by: 'deploy/engine-staging',
      }),
      `case ${c.key}`
    );
    created.push(`case ${c.key}`);
  }
  console.log(`[engine-staging] fixtures on ${target}: ${created.length ? `created ${created.join(', ')}` : 'already present'}`);
}

/**
 * Targets are written for the host (127.0.0.1); a containerized worker
 * re-points them at the host gateway (apps/worker/src/worker.ts).
 */
/** What the engine shows as "deployed": the pinned commit, and whether the stack is up or down. */
function deploymentInfo(state) {
  if (!state) return { compose_project: PROJECT };
  return {
    compose_project: PROJECT, ref: state.ref, commit: state.commit, version: state.version, deployed_at: state.deployed_at,
    state: state.state || 'up',
    ...(state.torn_down_at ? { torn_down_at: state.torn_down_at } : {}),
  };
}

async function register(state) {
  const existing = await call(controller, 'GET', `/api/v1/environments/${ENV_KEY}`);
  const existingConfig = (existing.ok && existing.json?.data?.config) || {};
  const body = {
    name: 'Test Engine · local Docker (staging)',
    env_type: 'staging',
    base_url: staging,
    status: 'active',
    config: {
      applications: [APP_KEY],
      vars: { engine: staging },
      // Managed by the engine's infrastructure lifecycle (apps/api/src/infra.ts): the infra agent
      // deploys and tears this stack down with this script. The console's "Deploy" redeploys the
      // branch deployed here unless a default_ref was set in the console; hours set there are kept.
      infra: {
        ...(state?.ref ? { default_ref: state.ref } : {}),
        ...(existingConfig.infra || {}),
        driver: 'compose', script: 'deploy/engine-staging/deploy.mjs', compose_project: PROJECT,
      },
      deployment: deploymentInfo(state),
    },
    safety_policy: {
      functional_smoke: 'allowed', read_only_api: 'allowed', write_api: 'allowed',
      load: 'allowed', soak: 'allowed', chaos: 'allowed', security_scan: 'allowed',
      stress: 'approval_required', destructive_db: 'prohibited',
    },
    updated_by: 'deploy/engine-staging',
  };
  const res = existing.ok
    ? await call(controller, 'PATCH', `/api/v1/environments/${ENV_KEY}`, body)
    : await call(controller, 'POST', '/api/v1/environments', { key: ENV_KEY, created_by: 'deploy/engine-staging', ...body });
  if (!res.ok) throw new Error(`Test Engine refused the environment (${res.status}): ${res.text.slice(0, 300)}`);
  console.log(`[engine-staging] environment "${ENV_KEY}" ${existing.ok ? 'updated' : 'registered'} at ${controller}`);
}

function readState() {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'help';

  if (action === 'deploy') {
    mkdirSync(path.join(home, 'src'), { recursive: true });
    const src = exportSource(option(args, 'ref', 'HEAD'));
    console.log(`[engine-staging] deploying ${src.tag} "${src.subject}"`);
    compose(src, ['build', 'test-engine']);
    compose(src, ['up', '-d', '--no-build', 'sit-console-db', 'test-engine']);
    await waitForEngine();
    compose(src, ['up', '-d', '--no-build', ...SERVICES]);
    const healthy = await verify();
    const state = { ref: src.ref, commit: src.commit, tag: src.tag, version: `${src.version}-staging`, subject: src.subject, source: src.dir, deployed_at: new Date().toISOString(), healthy };
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
    pruneSources(src.tag);
    if (!healthy) throw new Error('staging is up but failed verification — not registering it');
    if (!args.includes('--no-seed')) await seed(staging);
    if (!args.includes('--no-register')) await register(state);
    // Machine-readable summary for the infra agent (apps/infra-agent).
    console.log(`[engine-staging] RESULT ${JSON.stringify({ ref: state.ref, commit: state.commit, version: state.version, deployed_at: state.deployed_at })}`);
    return;
  }

  const state = readState();
  if (action === 'register') return register(state);
  if (action === 'seed') return seed(option(args, 'engine', staging).replace(/\/$/, ''));

  // Take the stack down: containers and network always; images with --rmi, data volumes with --volumes.
  // Compose does the orderly part; the label sweep catches whatever it could not. The engine is told
  // the stack is down.
  if (action === 'down') {
    const rmi = args.includes('--rmi');
    const volumes = args.includes('--volumes');
    if (state && existsSync(path.join(state.source, 'compose.yaml'))) {
      const src = { tag: state.tag, commit: state.commit, dir: state.source, version: state.version.replace(/-staging$/, '') };
      try {
        compose(src, ['down', '--remove-orphans', ...(rmi ? ['--rmi', 'all'] : []), ...(volumes ? ['-v'] : [])]);
      } catch (err) {
        console.warn(`[engine-staging] compose down reported: ${err.message.split('\n')[0]} — sweeping by label`);
      }
    }
    sweep(rmi, volumes);
    if (state) {
      const next = { ...state, state: 'down', torn_down_at: new Date().toISOString(), healthy: false };
      writeFileSync(stateFile, JSON.stringify(next, null, 2));
      try {
        await register(next);
      } catch (err) {
        console.warn(`[engine-staging] engine not updated: ${err.message}`);
      }
    }
    console.log(`[engine-staging] ${PROJECT} is down${rmi ? ', images removed' : ''}${volumes ? ', volumes removed' : ''}`);
    return;
  }

  if (!state) throw new Error(`nothing deployed yet (no ${stateFile})`);
  const src = { tag: state.tag, commit: state.commit, dir: state.source, version: state.version.replace(/-staging$/, '') };

  if (action === 'status') {
    console.log(`[engine-staging] ${state.tag} "${state.subject}" deployed ${state.deployed_at}`);
    console.log(compose(src, ['ps', '--format', 'table {{.Service}}\t{{.State}}\t{{.Health}}\t{{.Ports}}'], { inherit: false }));
    if (!(await verify())) process.exitCode = 1;
    return;
  }
  if (action === 'stop') return void compose(src, ['stop']);
  // Throws the staging database and evidence away; the next deploy boots from an empty one.
  if (action === 'reset') return void compose(src, ['down', '-v']);

  console.log('node deploy/engine-staging/deploy.mjs <deploy [--ref REF] [--no-seed] [--no-register] | status | seed [--engine URL] | register | stop | down [--rmi] [--volumes] | reset>');
}

/**
 * Remove everything still carrying this compose project's label. Each removal is best effort — an
 * image another project shares stays, and a daemon under memory pressure sometimes cannot remove a
 * container it has already stopped ("did not receive an exit event"). The stack is down when nothing
 * of it is RUNNING; a stopped leftover is reported and removed by the engine's housekeeping later.
 */
function sweep(rmi, volumes) {
  const filter = `label=com.docker.compose.project=${PROJECT}`;
  const ids = (out) => out.split(/\s+/).filter(Boolean);
  let removed = 0;
  for (const id of ids(run('docker', ['ps', '-aq', '--filter', filter]))) {
    try { run('docker', ['rm', '-f', id]); removed++; } catch (err) { console.warn(`[engine-staging] could not remove ${id}: ${err.message.split('\n').pop()}`); }
  }
  for (const id of ids(run('docker', ['network', 'ls', '-q', '--filter', filter]))) {
    try { run('docker', ['network', 'rm', id]); } catch { /* in use elsewhere */ }
  }
  let images = 0;
  if (rmi) {
    for (const id of new Set(ids(run('docker', ['images', '-q', '--filter', filter])))) {
      try { run('docker', ['rmi', id]); images++; } catch { /* another container uses it */ }
    }
  }
  if (volumes) {
    for (const name of ids(run('docker', ['volume', 'ls', '-q', '--filter', filter]))) {
      try { run('docker', ['volume', 'rm', name]); } catch { /* in use */ }
    }
  }
  const running = ids(run('docker', ['ps', '-q', '--filter', filter]));
  const leftover = ids(run('docker', ['ps', '-aq', '--filter', filter])).length;
  console.log(`[engine-staging] swept ${removed} container(s)${rmi ? `, ${images} image(s)` : ''} of ${PROJECT}${leftover ? `; ${leftover} stopped container(s) could not be removed yet` : ''}`);
  if (running.length) throw new Error(`${running.length} container(s) of ${PROJECT} are still running: ${running.join(' ')}`);
}

main().catch((err) => {
  console.error(`[engine-staging] ${err.message}`);
  process.exit(1);
});
