#!/usr/bin/env node
/**
 * Seed the per-worker user pool against a target application.
 *
 * Workers are deterministically pinned to a slot (hash of WORKER_ID mod
 * POOL_SIZE), so N workers scaled with `docker compose up --scale
 * test-engine-worker=N` take N distinct identities when the pool is
 * populated. This script creates those identities on the target app so
 * the Sand Bench one-session-per-user rule can never kick a worker's login.
 *
 *   node scripts/seed-user-pool.mjs \
 *     --api  http://127.0.0.1:8080   \
 *     --admin-user admin --admin-pass admin \
 *     [--pool-size 8] [--admin-pool-size 2] \
 *     [--prefix te-worker] \
 *     [--dry-run]
 *
 * Env vars (also accepted):
 *   TARGET_API, TARGET_ADMIN_USER, TARGET_ADMIN_PASS, POOL_SIZE, ADMIN_POOL_SIZE
 *
 * Output: prints the credentials the engine's environment should carry on
 * config.vars so each worker resolves its slot. Pipe to a `.env` file or
 * paste into Settings · Environments.
 */

const args = (() => {
  const o = Object.create(null);
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const [k, inline] = a.slice(2).split('=');
    o[k] = inline !== undefined ? inline : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true);
  }
  return o;
})();

const API = args.api || process.env.TARGET_API || 'http://127.0.0.1:8080';
const ADMIN_USER = args['admin-user'] || process.env.TARGET_ADMIN_USER || 'admin';
const ADMIN_PASS = args['admin-pass'] || process.env.TARGET_ADMIN_PASS || 'admin';
const POOL_SIZE = Number(args['pool-size'] || process.env.POOL_SIZE || 8);
const ADMIN_POOL_SIZE = Number(args['admin-pool-size'] || process.env.ADMIN_POOL_SIZE || 2);
const PREFIX = String(args.prefix || 'te-worker');
const DRY = !!args['dry-run'];

function password(slot, kind) {
  // Deterministic — anyone with the pool-size + prefix can reproduce the
  // credential pair, but the password itself is a 16-char hex blob rather
  // than something humans would guess. Still: these are test-only users.
  const seed = `${PREFIX}:${kind}:${slot}:gavriq`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return `${hex}${hex.split('').reverse().join('')}`;
}

async function login(username, password) {
  const r = await fetch(`${API}/api/v1/session/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error(`admin login failed: ${r.status} ${await r.text().catch(() => '')}`);
  const b = await r.json().catch(() => ({}));
  return b.token || b.data?.token || null;
}

async function createUser(token, { username, password, role }) {
  // The target app's user API is intentionally lenient about shape — we send
  // the standard fields and let the server reject what it doesn't accept.
  const r = await fetch(`${API}/api/v1/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ username, password, email: `${username}@example.test`, role }),
  });
  if (r.ok) return 'created';
  // 409 / "already exists" is a normal re-run outcome; carry on.
  const text = await r.text().catch(() => '');
  if (r.status === 409 || /exists/i.test(text)) return 'exists';
  throw new Error(`create ${username} failed: ${r.status} ${text}`);
}

async function main() {
  console.log(`[seed-user-pool] target=${API} pool=${POOL_SIZE} admin-pool=${ADMIN_POOL_SIZE} prefix=${PREFIX} dry-run=${DRY}`);
  let token = null;
  if (!DRY) {
    try { token = await login(ADMIN_USER, ADMIN_PASS); console.log(`[seed-user-pool] admin logged in${token ? ' (token acquired)' : ''}`); }
    catch (e) { console.warn(`[seed-user-pool] admin login failed — will try unauth creates: ${e.message}`); }
  }
  const results = { user: [], admin: [] };
  for (let slot = 0; slot < POOL_SIZE; slot++) {
    const username = `${PREFIX}-user-${slot}`;
    const pw = password(slot, 'user');
    if (DRY) { results.user.push({ slot, username, password: pw, action: 'dry' }); continue; }
    try { const action = await createUser(token, { username, password: pw, role: 'operator' }); results.user.push({ slot, username, password: pw, action }); }
    catch (e) { results.user.push({ slot, username, action: 'error', error: e.message }); }
  }
  for (let slot = 0; slot < ADMIN_POOL_SIZE; slot++) {
    const username = `${PREFIX}-admin-${slot}`;
    const pw = password(slot, 'admin');
    if (DRY) { results.admin.push({ slot, username, password: pw, action: 'dry' }); continue; }
    try { const action = await createUser(token, { username, password: pw, role: 'tenant_admin' }); results.admin.push({ slot, username, password: pw, action }); }
    catch (e) { results.admin.push({ slot, username, action: 'error', error: e.message }); }
  }

  console.log('\n[seed-user-pool] results:');
  for (const r of [...results.user, ...results.admin]) {
    console.log(`  ${r.username.padEnd(28)} slot=${r.slot}  ${r.action}${r.error ? `  (${r.error})` : ''}`);
  }

  // Config block for the environment: paste into Settings · Environments →
  // config.vars (passwords may go to config.secret_env + process env instead).
  const configVars = {};
  for (const u of results.user) {
    if (u.action === 'error') continue;
    configVars[`pool_user_${u.slot}`] = u.username;
    configVars[`pool_pass_${u.slot}`] = u.password;
  }
  for (const a of results.admin) {
    if (a.action === 'error') continue;
    configVars[`pool_admin_${a.slot}`] = a.username;
    configVars[`pool_adminpass_${a.slot}`] = a.password;
  }
  console.log('\n[seed-user-pool] environment config.vars (merge into Settings · Environments):');
  console.log(JSON.stringify(configVars, null, 2));

  const failed = [...results.user, ...results.admin].filter((r) => r.action === 'error');
  if (failed.length) {
    console.error(`\n[seed-user-pool] ${failed.length} account(s) failed to seed — see errors above.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('[seed-user-pool] fatal:', e); process.exit(1); });
