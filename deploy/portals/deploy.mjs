#!/usr/bin/env node
/**
 * Deploy the four standalone portals Sand Bench talks to as external systems:
 *
 *   gavriq-kafka-desk  → http://127.0.0.1:8095   (SBE_STUB_BASE at staging testhub)
 *   gavriq-mq-desk     → http://127.0.0.1:8092   (SBE_STUB_BASE at staging testhub)
 *   gavriq-ftp-desk    → http://127.0.0.1:18102  (local FTP data volume)
 *   gavriq-api-desk    → http://127.0.0.1:8093   (SBE_APP_BASE at staging API)
 *
 * The portal repos each own their own compose.yaml; this script invokes them
 * with env overrides that point them at Sand Bench's staging stack and, for
 * ftp-desk, applies deploy/portals/ftp-desk.override.yaml to swap the external
 * volume + conflicting port.
 *
 * Usage:
 *   node deploy/portals/deploy.mjs deploy [kafka|mq|ftp|api|all]
 *   node deploy/portals/deploy.mjs status
 *   node deploy/portals/deploy.mjs down [kafka|mq|ftp|api|all]
 *
 * Env overrides (optional):
 *   PORTALS_SBE_TESTHUB_BASE   default http://host.docker.internal:18091
 *   PORTALS_SBE_APP_BASE       default http://host.docker.internal:18787
 *   PORTALS_REPO_ROOT          default C:/GitHub (one level above this repo)
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const engineRoot = path.resolve(here, '../..');
const defaultReposRoot = path.resolve(engineRoot, '..');
const reposRoot = process.env.PORTALS_REPO_ROOT || defaultReposRoot;
const testhubBase = process.env.PORTALS_SBE_TESTHUB_BASE || 'http://host.docker.internal:18091';
const appBase = process.env.PORTALS_SBE_APP_BASE || 'http://host.docker.internal:18787';

const PORTALS = {
  kafka: {
    project: 'gavriq-kafka-desk',
    repo: path.join(reposRoot, 'gavriq-kafka-desk'),
    composeArgs: ['-f', 'compose.yaml'],
    upArgs: ['--no-deps', 'kafkaportal'],
    env: { KAFKAPORTAL_SBE_STUB_BASE: testhubBase },
    healthUrl: 'http://127.0.0.1:8095/health',
  },
  mq: {
    project: 'gavriq-mq-desk',
    repo: path.join(reposRoot, 'gavriq-mq-desk'),
    composeArgs: ['-f', 'compose.yaml'],
    upArgs: [],
    env: { SBE_STUB_BASE: testhubBase },
    healthUrl: 'http://127.0.0.1:8092/health',
  },
  ftp: {
    project: 'gavriq-ftp-desk',
    repo: path.join(reposRoot, 'gavriq-ftp-desk'),
    composeArgs: ['-f', 'compose.yaml', '-f', path.join(engineRoot, 'deploy/portals/ftp-desk.override.yaml')],
    upArgs: [],
    env: {},
    healthUrl: 'http://127.0.0.1:18102/health',
  },
  api: {
    project: 'gavriq-api-desk',
    repo: path.join(reposRoot, 'gavriq-api-desk'),
    composeArgs: ['-f', 'compose.yaml'],
    upArgs: [],
    env: { SBE_APP_BASE: appBase },
    healthUrl: 'http://127.0.0.1:8093/health',
  },
};

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: 'inherit', ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${cmd} ${args.slice(0, 4).join(' ')} … exited ${res.status}`);
}

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: body.slice(0, 300) };
  } catch (err) {
    return { ok: false, status: 0, body: err.cause?.code || err.message };
  }
}

function portals(args) {
  const list = args.length ? args : ['all'];
  const picked = list.includes('all') ? Object.keys(PORTALS) : list.filter((n) => n in PORTALS);
  if (!picked.length) throw new Error(`Pick one of: ${Object.keys(PORTALS).join(', ')}, all`);
  return picked;
}

async function deployOne(name) {
  const p = PORTALS[name];
  if (!existsSync(p.repo)) throw new Error(`Portal repo missing: ${p.repo}`);
  console.log(`[portals] deploying ${name} (${p.project}) from ${p.repo}`);
  const env = { ...process.env, ...p.env };
  run('docker', ['compose', '-p', p.project, ...p.composeArgs, 'up', '-d', '--build', ...p.upArgs], { cwd: p.repo, env });
  const health = await probe(p.healthUrl);
  console.log(`[portals] ${name} /health → ${health.status} ${health.ok ? 'ok' : 'FAIL'}`);
  if (!health.ok) throw new Error(`${name} did not come up healthy: ${health.body}`);
}

async function downOne(name) {
  const p = PORTALS[name];
  console.log(`[portals] bringing ${name} down`);
  run('docker', ['compose', '-p', p.project, ...p.composeArgs, 'down'], { cwd: p.repo });
}

async function statusAll() {
  for (const name of Object.keys(PORTALS)) {
    const health = await probe(PORTALS[name].healthUrl);
    console.log(`[portals] ${name.padEnd(6)} ${PORTALS[name].healthUrl} → ${health.ok ? 'ok ' : 'FAIL'} ${health.status}`);
  }
}

const [action, ...rest] = process.argv.slice(2);
if (action === 'deploy') {
  for (const name of portals(rest)) await deployOne(name);
  await statusAll();
} else if (action === 'down') {
  for (const name of portals(rest)) await downOne(name);
} else if (action === 'status' || !action) {
  await statusAll();
} else {
  console.error('Usage: node deploy/portals/deploy.mjs [deploy|status|down] [kafka|mq|ftp|api|all]');
  process.exit(2);
}
