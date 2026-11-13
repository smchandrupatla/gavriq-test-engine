/**
 * The operator pool of a staging installation: one ready-to-use identity per
 * identity lane (pool.op0 … pool.opN-1).
 *
 * The engine hands every running execution its own lane, so no two cases that
 * run at the same time are signed in as the same user (apps/api/src/routes/
 * executions.ts leaseIdentityLane). That only works when each pool identity can
 * sign in straight away, in a browser as well as over the API. A user created by
 * an administrator starts with "must change password": the console then shows
 * the forced-password card instead of the application, and a browser case would
 * change the shared password under every other case. So each identity is taken
 * through that first sign-in here, once: created (or its password reset) with a
 * throwaway password, then it sets the pool password itself, which clears the
 * flag. The seed can be repeated: an identity that already signs in with the
 * pool password is left exactly as it is, and one that has drifted (a case left
 * its password changed) is repaired the same way.
 *
 * There are no pool administrators. On current Sand Bench only the built-in
 * administrator is administrator-equivalent — a role cannot make another user
 * one — so cases that need administrator rights use that account and share one
 * session per worker (catalog/sandbench-identity.ts). The `pool.adm*` users an
 * earlier seed created are ordinary users nothing signs in as; they are removed.
 */
import { randomBytes } from 'node:crypto';

/** Fictional, staging-only. At least 12 characters: the application's minimum for a password a user sets. */
export const STAGING_POOL_PASSWORD = 'SandBench-Pool-Stage-01';
/**
 * How many lanes staging has. The engine leases the lowest free lane first, so a
 * worker with five slots holds lanes 0–4; the higher ones are spare for a second
 * worker and for author-time harness runs (dev/scripts/run-catalog-local.ts
 * defaults to the last lane), which must not share an identity with a live run.
 */
export const STAGING_POOL_OPERATORS = 12;

const TENANT = 'tenant_default';

export async function ensureStagingUserPool(api, {
  password,
  poolPassword = STAGING_POOL_PASSWORD,
  operatorSlots = STAGING_POOL_OPERATORS,
  request = fetch,
  log = console.log,
}) {
  if (String(poolPassword).length < 12) throw new Error('user-pool seed: the pool password must be at least 12 characters');
  const call = async (method, path, { token, body, headers, timeout = 30000 } = {}) => {
    const response = await request(`${api}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
    const text = await response.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
    return { status: response.status, ok: response.ok, json, text };
  };
  // A sign-in that may be refused is sent from a made-up client address, so a
  // refusal never counts against the address the deploy host signs in from.
  const signIn = (username, secret, slot) => call('POST', '/api/v1/session/login', {
    body: { username, password: secret },
    headers: slot === undefined ? undefined : { 'x-forwarded-for': `198.18.255.${1 + (slot % 254)}` },
    timeout: 10000,
  });

  const admin = await signIn('admin', password);
  if (!admin.ok) throw new Error(`user-pool seed: admin login returned HTTP ${admin.status}`);
  const token = admin.json.token;
  if (typeof token !== 'string' || !token) throw new Error('user-pool seed: admin login returned no token');

  let listed = null;
  const users = async () => {
    if (!listed) {
      const res = await call('GET', `/api/v1/admin/tenants/${TENANT}/users`, { token });
      if (!res.ok) throw new Error(`user-pool seed: user list returned HTTP ${res.status}`);
      listed = Array.isArray(res.json.data) ? res.json.data : [];
    }
    return listed;
  };

  /** The identity signs in with a throwaway password and sets the pool password itself: that clears "must change password". */
  const takeThroughFirstSignIn = async (username, temporary, slot) => {
    const first = await signIn(username, temporary, slot);
    if (!first.ok || !first.json.token) throw new Error(`user-pool seed: first sign-in of ${username} returned HTTP ${first.status}`);
    const changed = await call('POST', '/api/v1/session/change-password', { token: first.json.token, body: { newPassword: poolPassword } });
    if (!changed.ok) throw new Error(`user-pool seed: ${username} could not set the pool password (HTTP ${changed.status})`);
  };

  let created = 0;
  let ready = 0;
  let repaired = 0;
  for (let slot = 0; slot < operatorSlots; slot++) {
    const username = `pool.op${slot}`;
    const probe = await signIn(username, poolPassword, slot);
    if (probe.ok && probe.json.mustChangePassword !== true) { ready++; continue; }

    const temporary = `Tmp-${randomBytes(9).toString('base64url')}-1a`;
    const made = await call('POST', `/api/v1/admin/tenants/${TENANT}/users`, {
      token,
      body: {
        username, displayName: `Pool operator ${username}`, email: `${username}@example.invalid`, password: temporary,
        securityQuestion: 'pool', securityAnswer: 'pool',
      },
    });
    if (made.status === 201) {
      created++;
    } else if (made.status === 409 || (made.status === 422 && /unique|exists|duplicate/i.test(made.text))) {
      // Already there but not usable with the pool password: an administrator reset puts it back at a first sign-in.
      const existing = (await users()).find((u) => u.username === username);
      if (!existing) throw new Error(`user-pool seed: ${username} exists but is not in the user list`);
      const reset = await call('POST', `/api/v1/admin/tenants/${TENANT}/users/${existing.id}/password-reset`, { token, body: { password: temporary } });
      if (!reset.ok) throw new Error(`user-pool seed: password reset of ${username} returned HTTP ${reset.status}`);
      repaired++;
    } else {
      throw new Error(`user-pool seed: ${username} returned HTTP ${made.status}`);
    }
    await takeThroughFirstSignIn(username, temporary, slot);
    const check = await signIn(username, poolPassword, slot);
    if (!check.ok || check.json.mustChangePassword === true) {
      throw new Error(`user-pool seed: ${username} still cannot sign in with the pool password (HTTP ${check.status})`);
    }
  }

  // Ordinary users an earlier seed created as "pool administrators"; nothing signs in as them any more.
  let retired = 0;
  for (const user of (await users()).filter((u) => /^pool\.adm\d+$/.test(String(u.username)))) {
    const gone = await call('DELETE', `/api/v1/admin/tenants/${TENANT}/users/${user.id}`, { token, headers: user.etag ? { 'if-match': user.etag } : undefined });
    if (gone.ok) retired++;
    else log(`[staging] user pool: could not remove retired ${user.username} (HTTP ${gone.status})`);
  }

  log(`[staging] user pool: ${operatorSlots} operators — ${ready} ready, ${created} created, ${repaired} repaired${retired ? `; ${retired} retired pool administrator(s) removed` : ''}`);
  return { created, ready, repaired, retired };
}
