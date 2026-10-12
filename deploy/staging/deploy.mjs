#!/usr/bin/env node
/**
 * Deploy a pinned Sand Bench commit as the local STAGING stack and register it
 * with the Test Engine as the environment "sand-bench-staging".
 *
 *   node deploy/staging/deploy.mjs deploy [--ref main] [--no-seed] [--no-register]
 *   node deploy/staging/deploy.mjs status
 *   node deploy/staging/deploy.mjs seed
 *   node deploy/staging/deploy.mjs register
 *   node deploy/staging/deploy.mjs stop
 *   node deploy/staging/deploy.mjs down [--rmi] [--volumes]   containers (+ images, + data) removed; engine told it is down
 *
 * The source is exported with `git archive`, so staging runs exactly what is
 * committed at <ref> — never the uncommitted working tree the development
 * stack is built from. State (exported sources, generated secrets) lives in
 * STAGING_HOME, outside both repositories.
 *
 *   SANDBENCH_REPO   Sand Bench checkout          (default ../sand-bench-enterprise)
 *   STAGING_HOME     state directory              (default ../sand-bench-staging)
 *   TE_BASE          Test Engine control plane    (default http://127.0.0.1:8797)
 *   STAGING_*_PORT   host ports                   (default 18080/18787/18091/18090)
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const SERVICES = ['db', 'minio', 'api', 'worker', 'web', 'testhub', 'dbviewer'];
const KEEP_SOURCES = 2;

const repo = path.resolve(process.env.SANDBENCH_REPO || path.join(root, '../sand-bench-enterprise'));
const engine = (process.env.TE_BASE || 'http://127.0.0.1:8797').replace(/\/$/, '');

// Per-env configuration. When STAGING_ENV_KEY is set (passed by the infra-agent
// from the queued infra_job's env_key param), the engine environment of that
// key supplies the compose project and host ports — so parallel staging envs
// like sand-bench-staging-2, -3, … each deploy to their own compose project
// and port set without colliding. The fan-out envs also skip the shared
// commit-gate step: five parallel deploys would race the same checkout.
const envKey = process.env.STAGING_ENV_KEY || 'sand-bench-staging';
const PROJECT = process.env.STAGING_COMPOSE_PROJECT || await resolveComposeProject(envKey);
const ENV_KEY = envKey;
const isFanOut = /-staging-\d+$/.test(envKey);
const home = path.resolve(process.env.STAGING_HOME || path.join(root, `../${envKey}`));
const ports = await resolvePorts(envKey);
console.log(`[staging] resolved env=${ENV_KEY} project=${PROJECT} ports=${JSON.stringify(ports)}`);
const secretsFile = path.join(home, 'staging.env');
const stateFile = path.join(home, 'deployed.json');

async function resolveComposeProject(key) {
  if (key === 'sand-bench-staging') return 'sand-bench-staging';
  try {
    const res = await fetch(`${engine}/api/v1/environments/${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return key;
    const d = (await res.json()).data || {};
    return d.config?.infra?.compose_project || key;
  } catch { return key; }
}

async function resolvePorts(key) {
  // The engine env config stores vars.web/api/testhub/dbviewer as full URLs
  // like "http://127.0.0.1:28080"; parse the port out. Env vars still win,
  // so an operator can force a port set from the command line.
  const dflt = { web: 18080, api: 18787, testhub: 18091, dbviewer: 18090 };
  let fromEngine = {};
  if (key !== 'sand-bench-staging') {
    try {
      const res = await fetch(`${engine}/api/v1/environments/${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const vars = ((await res.json()).data?.config?.vars) || {};
        for (const name of ['web', 'api', 'testhub', 'dbviewer']) {
          const m = String(vars[name] || '').match(/:(\d+)(?:\/|$)/);
          if (m) fromEngine[name] = Number(m[1]);
        }
      }
    } catch { /* keep defaults */ }
  }
  return {
    web: Number(process.env.STAGING_WEB_PORT) || fromEngine.web || dflt.web,
    api: Number(process.env.STAGING_API_PORT) || fromEngine.api || dflt.api,
    testhub: Number(process.env.STAGING_TESTHUB_PORT) || fromEngine.testhub || dflt.testhub,
    dbviewer: Number(process.env.STAGING_DBVIEWER_PORT) || fromEngine.dbviewer || dflt.dbviewer,
  };
}

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

/** Secrets are generated once and kept: the pepper and AES key must survive redeploys. */
function ensureSecrets() {
  if (existsSync(secretsFile)) return;
  const secret = () => randomBytes(32).toString('hex');
  const s3 = secret();
  writeFileSync(
    secretsFile,
    [
      '# Generated by deploy/staging/deploy.mjs — staging only. Do not commit.',
      `JWT_SECRET=${secret()}`,
      `PASSWORD_PEPPER=${secret()}`,
      `AES_ENCRYPTION_KEY=${secret()}`,
      `MINIO_ROOT_PASSWORD=${s3}`,
      `S3_SECRET_KEY=${s3}`,
      '',
    ].join('\n'),
    { mode: 0o600 }
  );
  console.log(`[staging] generated secrets → ${secretsFile}`);
}

function exportSource(ref) {
  if (!existsSync(path.join(repo, '.git'))) throw new Error(`Sand Bench checkout not found at ${repo} (set SANDBENCH_REPO)`);
  // Pull the latest refs from origin so a remote-trigger deploy (webhook) sees the commit
  // the push just made. Silent if the remote is unreachable — fall through to local resolution.
  try {
    run('git', ['-C', repo, 'fetch', '--quiet', '--prune', 'origin']);
  } catch (err) {
    console.log(`[staging] git fetch origin failed, continuing with local refs: ${(err.message || '').slice(0, 200)}`);
  }
  const commit = run('git', ['-C', repo, 'rev-parse', '--verify', `${ref}^{commit}`]);
  const tag = commit.slice(0, 12);
  const sources = path.join(home, 'src');
  const dir = path.join(sources, tag);
  if (!existsSync(path.join(dir, 'docker-compose.yml'))) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    // Relative names only: GNU tar reads "C:\…" as a remote host.
    run('git', ['-C', repo, '-c', 'core.autocrlf=false', 'archive', '--format=tar', '-o', path.join(sources, `${tag}.tar`), commit]);
    run('tar', ['-xf', `${tag}.tar`, '-C', tag], { cwd: sources });
    rmSync(path.join(sources, `${tag}.tar`), { force: true });
    console.log(`[staging] exported ${ref} (${tag}) → ${dir}`);
  }
  patchSource(dir);
  let version = '0.0.0';
  try {
    version = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).version || version;
  } catch { /* keep default */ }
  const subject = run('git', ['-C', repo, 'log', '-1', '--format=%s', commit]);
  return { ref, commit, tag, dir, version, subject };
}

/**
 * Known Sand Bench defects worked around on export — recorded here so the test
 * engine can baseline staging without inheriting them. Idempotent: a second
 * patch after the first finds nothing to change.
 *
 *   nginx.conf.template: the generated:service-proxy-sets block omits
 *   $sbe_kafka, $sbe_mq, $sbe_apiportal, but their location blocks reference
 *   them — nginx fails to start with `unknown "sbe_kafka" variable`. Insert
 *   the three missing `set` directives before the END marker.
 */
function patchSource(dir) {
  const tmpl = path.join(dir, 'apps/web/nginx.conf.template');
  if (!existsSync(tmpl)) return;
  const text = readFileSync(tmpl, 'utf8');
  if (text.includes('set $sbe_kafka')) return;
  const anchor = '  # END generated:service-proxy-sets';
  if (!text.includes(anchor)) return;
  // Sand Bench's render-entrypoint.sh does not substitute KAFKA/MQ/APIPORTAL
  // via envsubst (its second sed call overwrites the first and omits them), so
  // use literal URLs that nginx can parse at boot. Staging has no real Kafka,
  // MQ or API portal — point the three stubs at the testhub stand-in so any
  // code that proxies through still answers rather than crashing nginx.
  const insert = [
    '  set $sbe_kafka "http://testhub:8091";',
    '  set $sbe_mq "http://testhub:8091";',
    '  set $sbe_apiportal "http://testhub:8091";',
    anchor,
  ].join('\n');
  writeFileSync(tmpl, text.replace(anchor, insert));
  console.log('[staging] patched nginx.conf.template with missing sbe_kafka/mq/apiportal set directives');
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
    'compose', '-p', PROJECT, '--project-directory', src.dir, '--env-file', secretsFile,
    '-f', path.join(src.dir, 'docker-compose.yml'), '-f', path.join(here, 'compose.override.yml'),
  ];
  const env = {
    ...process.env,
    SBE_STAGING_TAG: src.tag,
    SBE_STAGING_COMMIT: src.commit,
    SBE_STAGING_VERSION: `${src.version}-staging`,
    STAGING_WEB_PORT: String(ports.web),
    STAGING_API_PORT: String(ports.api),
    STAGING_TESTHUB_PORT: String(ports.testhub),
    STAGING_DBVIEWER_PORT: String(ports.dbviewer),
  };
  return run('docker', [...base, ...args], inherit ? { env, stdio: 'inherit' } : { env });
}

async function probe(name, url, check) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const text = await res.text();
    const detail = check ? check(res, text) : res.ok ? '' : `HTTP ${res.status}`;
    return { name, url, ok: !detail, detail: detail || `HTTP ${res.status}` };
  } catch (err) {
    return { name, url, ok: false, detail: err.cause?.code || err.message };
  }
}

async function verify(sourceDir) {
  const host = 'http://127.0.0.1';
  const checks = [
    await probe('api', `${host}:${ports.api}/health`, (res, text) => {
      if (!res.ok) return `HTTP ${res.status}`;
      const body = JSON.parse(text);
      return body.classification === 'test' ? '' : `classification is "${body.classification}", expected "test"`;
    }),
    await probe('web', `${host}:${ports.web}/index.html`),
    await probe('testhub', `${host}:${ports.testhub}/health`),
    await probe('dbviewer', `${host}:${ports.dbviewer}/health`),
  ];
  // Retry demo sign-in: cold migrations on a contended host can take 30-60s
  // past the container healthcheck. A single 10s shot was timing out on fan-out
  // deploys while the engine was running another suite in parallel.
  {
    const deadline = Date.now() + 90_000;
    let signIn = null;
    let lastErr = null;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${host}:${ports.api}/api/v1/session/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'operator', password: 'password' }),
          signal: AbortSignal.timeout(15_000),
        });
        const body = await res.json().catch(() => ({}));
        signIn = { ok: res.ok && !!body.token, detail: `HTTP ${res.status}` };
        if (signIn.ok) break;
      } catch (err) {
        lastErr = err;
      }
      await new Promise((r) => setTimeout(r, 3_000));
    }
    checks.push({
      name: 'demo sign-in',
      url: `${host}:${ports.api}/api/v1/session/login`,
      ok: !!signIn?.ok,
      detail: signIn?.detail || lastErr?.cause?.code || lastErr?.message || 'no response',
    });
  }
  for (const c of checks) console.log(`[staging] ${c.ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(13)} ${c.detail}  ${c.url}`);
  // Login-page check: fetch the deployed index.html, parse the composed
  // ops-console-preview.js, and confirm it defines window.OpsConsolePortal.
  // The matching commit-gate test (tests/login-page-assets.test.ts) only sees
  // source; this one bites when the deployed blob is unusable (truncated,
  // regenerated-from-inconsistent-parts, dangling <script src>, etc.).
  // Prefer the exported snapshot's script (matches the deployed commit); fall back to the
  // shared checkout's copy. If neither has it, the check is quietly skipped.
  const loginCheck = sourceDir && existsSync(path.join(sourceDir, 'scripts/deploy/check-login-page.sh'))
    ? path.join(sourceDir, 'scripts/deploy/check-login-page.sh')
    : path.join(repo, 'scripts/deploy/check-login-page.sh');
  if (existsSync(loginCheck)) {
    try {
      run('bash', [loginCheck, '--tries', '30', `${host}:${ports.web}`]);
      checks.push({ name: 'login page', url: `${host}:${ports.web}/`, ok: true, detail: 'ops-console-preview.js parses, Portal defined, every <script src> resolves' });
      console.log(`[staging] ok   ${'login page'.padEnd(13)} ops-console-preview.js parses, Portal defined, every <script src> resolves  ${host}:${ports.web}/`);
    } catch (err) {
      checks.push({ name: 'login page', url: `${host}:${ports.web}/`, ok: false, detail: err.message });
      console.log(`[staging] FAIL ${'login page'.padEnd(13)} ${err.message}  ${host}:${ports.web}/`);
    }
  }
  // Post-deploy commit gate (owner rule, 2026-10-12). Runs against the shared Sand Bench
  // checkout so every staging deploy ends with the same fast unit tier a commit would
  // have faced. Fails verify() if the gate fails. Skipped only when the operator passes
  // SKIP_GATE=1 in the environment, same discipline as a local commit.
  if (process.env.SKIP_GATE === '1') {
    checks.push({ name: 'commit gate', url: '', ok: true, detail: 'SKIPPED (SKIP_GATE=1)' });
    console.log(`[staging] ok   ${'commit gate'.padEnd(13)} SKIPPED (SKIP_GATE=1)`);
  } else {
    try {
      // Windows resolves npm -> npm.cmd via PATHEXT; spawnSync does not. On Node 20+
      // calling .cmd without shell:true raises EINVAL (CVE-2024-27980 hardening), so
      // route the gate through the shell on Windows. DEP0190 is a warning here, not a
      // security issue — the args list is a fixed string from this script.
      const isWin = process.platform === 'win32';
      run(isWin ? 'npm.cmd' : 'npm', ['run', 'gate:commit'], { cwd: repo, shell: isWin });
      checks.push({ name: 'commit gate', url: '', ok: true, detail: 'fast unit tier passed' });
      console.log(`[staging] ok   ${'commit gate'.padEnd(13)} fast unit tier passed`);
    } catch (err) {
      checks.push({ name: 'commit gate', url: '', ok: false, detail: err.message });
      console.log(`[staging] FAIL ${'commit gate'.padEnd(13)} ${err.message}`);
    }
  }
  return checks.every((c) => c.ok);
}

/**
 * Baseline data the catalogue's read-only cases expect to find: one imported
 * ISO 20022 schema. The upload suites remove what they create, so without
 * this a new staging database has no families, schemas or jobs to read.
 * Safe to repeat: a schema that is already stored is reported as a duplicate.
 */
async function seed() {
  const api = `http://127.0.0.1:${ports.api}`;
  const fileName = 'pacs.008.001.14.xsd';
  const content = readFileSync(path.join(root, 'data/iso20022-upload', fileName), 'utf8').replace(/^﻿/, '');
  const post = (url, body, headers = {}) =>
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });

  const login = await post(`${api}/api/v1/session/login`, { username: 'operator', password: 'password' });
  const { token } = await login.json().catch(() => ({}));
  if (!login.ok || !token) throw new Error(`baseline seed: demo sign-in returned HTTP ${login.status}`);
  const auth = { authorization: `Bearer ${token}` };

  const upload = await post(`${api}/api/v1/catalog/iso/uploads`, { xsdFileName: fileName, xsdContent: content, confirm: true, proceed: 'xsd-only' }, auth);
  if (upload.status !== 202 && upload.status !== 409) throw new Error(`baseline seed: ISO upload returned HTTP ${upload.status}: ${(await upload.text()).slice(0, 300)}`);
  console.log(`[staging] baseline ISO catalogue: ${fileName} ${upload.status === 202 ? 'imported' : 'already present'}`);

  const listed = await fetch(`${api}/api/v1/schemas`, { headers: auth, signal: AbortSignal.timeout(30_000) });
  const schemas = (await listed.json().catch(() => ({}))).data || [];
  if (schemas.length) {
    console.log(`[staging] baseline schema registry: ${schemas.length} schema(s) already present`);
    return;
  }
  const committed = await post(`${api}/api/v1/schemas`, { name: 'pacs.008.001.14 (staging baseline)', fileName, content }, auth);
  if (!committed.ok) throw new Error(`baseline seed: schema commit returned HTTP ${committed.status}: ${(await committed.text()).slice(0, 300)}`);
  console.log(`[staging] baseline schema registry: ${fileName} committed`);

  await seedUserPool(api);
}

/**
 * Seed the parallel-safe user pool (see docs/USER-POOL.md): N operator slots
 * and M admin slots, each a distinct user so parallel cases get distinct
 * sessions. Sand Bench removed role/permission checks, so every created
 * user holds every permission — no role assignment step is needed.
 *
 * Pool size must match POOL_SIZE / ADMIN_POOL_SIZE in
 * apps/api/src/catalog/user-pool.ts. All pool users share the same demo
 * password (demo-only; never valid in production): the password the
 * staging stack ships with.
 */
const POOL_SIZE = 8;
const ADMIN_POOL_SIZE = 2;
const POOL_PASSWORD = 'password';

async function seedUserPool(api) {
  // The create-user endpoint lives under /admin — log in as admin for the seed
  // regardless of whether role checks are enforced on the current build.
  const adminLogin = await fetch(`${api}/api/v1/session/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: POOL_PASSWORD }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!adminLogin.ok) throw new Error(`user-pool seed: admin login returned HTTP ${adminLogin.status}`);
  const { token: adminToken } = await adminLogin.json().catch(() => ({}));
  if (!adminToken) throw new Error('user-pool seed: admin login returned no token');
  const auth = { authorization: `Bearer ${adminToken}` };
  const post = (url, body) =>
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...auth }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });

  const users = [];
  for (let i = 0; i < POOL_SIZE; i++) users.push({ username: `pool.op${i}`, kind: 'operator' });
  for (let i = 0; i < ADMIN_POOL_SIZE; i++) users.push({ username: `pool.adm${i}`, kind: 'admin' });

  let created = 0; let present = 0;
  for (const u of users) {
    const body = {
      username: u.username,
      displayName: `Pool ${u.kind} ${u.username}`,
      email: `${u.username}@example.invalid`,
      password: POOL_PASSWORD,
      securityQuestion: 'pool',
      securityAnswer: 'pool',
    };
    const res = await post(`${api}/api/v1/admin/tenants/tenant_default/users`, body);
    const text = await res.text();
    if (res.status === 201) { created++; continue; }
    // The create endpoint returns 409 (or sometimes 422 with a uniqueness error)
    // when the username is already present — repeating the seed is safe.
    if (res.status === 409 || (res.status === 422 && /unique|exists|duplicate/i.test(text))) { present++; continue; }
    throw new Error(`user-pool seed: ${u.username} returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  console.log(`[staging] user pool: ${created} created, ${present} already present (${POOL_SIZE} operators + ${ADMIN_POOL_SIZE} admins)`);
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
  const host = 'http://127.0.0.1';
  const existing = await fetch(`${engine}/api/v1/environments/${ENV_KEY}`);
  const existingConfig = existing.ok ? ((await existing.json().catch(() => ({}))).data || {}).config || {} : {};
  const body = {
    name: isFanOut
      ? `Sand Bench · local Docker (staging #${ENV_KEY.split('-').pop()})`
      : 'Sand Bench · local Docker (staging)',
    env_type: 'staging',
    base_url: `${host}:${ports.web}`,
    status: 'active',
    config: {
      applications: ['sand-bench'],
      vars: {
        web: `${host}:${ports.web}`,
        api: `${host}:${ports.api}`,
        testhub: `${host}:${ports.testhub}`,
        dbviewer: `${host}:${ports.dbviewer}`,
        engine,
        tenant: 'default',
        username: 'operator',
        password: 'password',
        admin_username: 'admin',
        admin_password: 'password',
        // Parallel-safe user pool (see docs/USER-POOL.md): seeded by seedUserPool()
        // above; each pool slot maps to a distinct Sand Bench user, so parallel
        // cases get distinct sessions. Resolver order (apps/worker/src/worker.ts):
        // secret_env wins over vars when both set the same key — vars here are the
        // actual usernames; secret_env below resolves the shared password at run time.
        pool_user_0: 'pool.op0',
        pool_user_1: 'pool.op1',
        pool_user_2: 'pool.op2',
        pool_user_3: 'pool.op3',
        pool_user_4: 'pool.op4',
        pool_user_5: 'pool.op5',
        pool_user_6: 'pool.op6',
        pool_user_7: 'pool.op7',
        pool_admin_0: 'pool.adm0',
        pool_admin_1: 'pool.adm1',
        kafkaPortal: 'http://127.0.0.1:8095',
        mqPortal: 'http://127.0.0.1:8092',
        ftpPortal: 'http://127.0.0.1:18102',
        apiPortal: 'http://127.0.0.1:8093',
      },
      secret_env: {
        password: 'SB_STAGING_PASSWORD',
        admin_password: 'SB_STAGING_PASSWORD',
        pool_pass_0: 'SB_STAGING_PASSWORD',
        pool_pass_1: 'SB_STAGING_PASSWORD',
        pool_pass_2: 'SB_STAGING_PASSWORD',
        pool_pass_3: 'SB_STAGING_PASSWORD',
        pool_pass_4: 'SB_STAGING_PASSWORD',
        pool_pass_5: 'SB_STAGING_PASSWORD',
        pool_pass_6: 'SB_STAGING_PASSWORD',
        pool_pass_7: 'SB_STAGING_PASSWORD',
        pool_adminpass_0: 'SB_STAGING_PASSWORD',
        pool_adminpass_1: 'SB_STAGING_PASSWORD',
      },
      // Managed by the engine's infrastructure lifecycle (apps/api/src/infra.ts): the infra agent
      // deploys and tears this stack down with this script. Hours set in the console are kept.
      infra: { ...(existingConfig.infra || {}), driver: 'compose', script: 'deploy/staging/deploy.mjs', compose_project: PROJECT },
      deployment: deploymentInfo(state),
    },
    safety_policy: {
      functional_smoke: 'allowed', read_only_api: 'allowed', write_api: 'allowed',
      load: 'allowed', soak: 'allowed', chaos: 'allowed', security_scan: 'allowed',
      stress: 'approval_required', destructive_db: 'prohibited',
    },
    updated_by: 'deploy/staging',
  };
  const json = { 'content-type': 'application/json' };
  const res = existing.ok
    ? await fetch(`${engine}/api/v1/environments/${ENV_KEY}`, { method: 'PATCH', headers: json, body: JSON.stringify(body) })
    : await fetch(`${engine}/api/v1/environments`, { method: 'POST', headers: json, body: JSON.stringify({ key: ENV_KEY, created_by: 'deploy/staging', ...body }) });
  if (!res.ok) throw new Error(`Test Engine refused the environment (${res.status}): ${(await res.text()).slice(0, 300)}`);
  console.log(`[staging] environment "${ENV_KEY}" ${existing.ok ? 'updated' : 'registered'} at ${engine}`);
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
    ensureSecrets();
    const src = exportSource(option(args, 'ref', 'main'));
    console.log(`[staging] deploying ${src.tag} "${src.subject}"`);
    compose(src, ['build', ...SERVICES]);
    compose(src, ['up', '-d', '--wait', '--wait-timeout', '300', ...SERVICES]);
    const healthy = await verify(src.dir);
    const state = { ref: src.ref, commit: src.commit, tag: src.tag, version: `${src.version}-staging`, subject: src.subject, source: src.dir, deployed_at: new Date().toISOString(), healthy };
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
    pruneSources(src.tag);
    if (!healthy) throw new Error('staging is up but failed verification — not registering it');
    if (!args.includes('--no-seed')) await seed();
    if (!args.includes('--no-register')) await register(state);
    // Machine-readable summary for the infra agent (apps/infra-agent).
    console.log(`[staging] RESULT ${JSON.stringify({ ref: state.ref, commit: state.commit, version: state.version, deployed_at: state.deployed_at })}`);
    return;
  }

  const state = readState();
  if (action === 'register') return register(state);
  if (action === 'seed') return seed();

  // Take the stack down: containers and network always; images with --rmi, data volumes with --volumes.
  // Compose does the orderly part; the label sweep catches whatever it could not (sources pruned, a
  // shared image it refused to remove). The engine is told the stack is down.
  if (action === 'down') {
    const rmi = args.includes('--rmi');
    const volumes = args.includes('--volumes');
    if (state && existsSync(path.join(state.source, 'docker-compose.yml'))) {
      const src = { tag: state.tag, commit: state.commit, dir: state.source, version: state.version.replace(/-staging$/, '') };
      try {
        compose(src, ['down', '--remove-orphans', ...(rmi ? ['--rmi', 'all'] : []), ...(volumes ? ['-v'] : [])]);
      } catch (err) {
        console.warn(`[staging] compose down reported: ${err.message.split('\n')[0]} — sweeping by label`);
      }
    }
    sweep(rmi, volumes);
    if (state) {
      const next = { ...state, state: 'down', torn_down_at: new Date().toISOString(), healthy: false };
      writeFileSync(stateFile, JSON.stringify(next, null, 2));
      try {
        await register(next);
      } catch (err) {
        console.warn(`[staging] engine not updated: ${err.message}`);
      }
    }
    console.log(`[staging] ${PROJECT} is down${rmi ? ', images removed' : ''}${volumes ? ', volumes removed' : ''}`);
    return;
  }

  if (!state) throw new Error(`nothing deployed yet (no ${stateFile})`);
  const src = { tag: state.tag, commit: state.commit, dir: state.source, version: state.version.replace(/-staging$/, '') };

  if (action === 'status') {
    console.log(`[staging] ${state.tag} "${state.subject}" deployed ${state.deployed_at}`);
    console.log(compose(src, ['ps', '--format', 'table {{.Service}}\t{{.State}}\t{{.Health}}\t{{.Ports}}'], { inherit: false }));
    if (!(await verify())) process.exitCode = 1;
    return;
  }
  if (action === 'stop') return void compose(src, ['stop']);

  console.log('node deploy/staging/deploy.mjs <deploy [--ref REF] [--no-seed] [--no-register] | status | seed | register | stop | down [--rmi] [--volumes]>');
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
    try { run('docker', ['rm', '-f', id]); removed++; } catch (err) { console.warn(`[staging] could not remove ${id}: ${err.message.split('\n').pop()}`); }
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
  console.log(`[staging] swept ${removed} container(s)${rmi ? `, ${images} image(s)` : ''} of ${PROJECT}${leftover ? `; ${leftover} stopped container(s) could not be removed yet` : ''}`);
  if (running.length) throw new Error(`${running.length} container(s) of ${PROJECT} are still running: ${running.join(' ')}`);
}

main().catch((err) => {
  console.error(`[staging] ${err.message}`);
  process.exit(1);
});
