import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ensureStagingUserPool, STAGING_POOL_OPERATORS, STAGING_POOL_PASSWORD } from '../deploy/staging/user-pool.mjs';

/**
 * A stand-in for the Sand Bench identity API, just enough of it for the seed:
 * an administrator creates users with a throwaway password ("must change
 * password"), the user signs in and sets its own password (which clears the
 * flag), an administrator can reset a password and delete a user.
 */
function fixtureApi(initial: Array<{ username: string; password: string; mustChange: boolean }> = []) {
  const users = new Map(initial.map((u, i) => [u.username, { id: `usr_${i}`, ...u }]));
  const tokens = new Map<string, string>();
  const calls: Array<{ method: string; path: string; forwardedFor: string | null }> = [];
  let nextId = initial.length;
  const request: typeof fetch = async (input, init) => {
    const path = String(input).replace('http://fixture', '');
    const method = String(init?.method || 'GET');
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const bearer = (headers.get('authorization') || '').replace(/^Bearer /, '');
    calls.push({ method, path, forwardedFor: headers.get('x-forwarded-for') });
    if (path === '/api/v1/session/login') {
      if (body.username === 'admin' && body.password === 'admin-secret') { tokens.set('admin-token', 'admin'); return Response.json({ token: 'admin-token' }); }
      const user = users.get(body.username);
      if (!user || user.password !== body.password) return Response.json({ error: 'invalid' }, { status: 401 });
      const token = `tok-${body.username}-${tokens.size}`;
      tokens.set(token, body.username);
      return Response.json({ token, mustChangePassword: user.mustChange });
    }
    if (path === '/api/v1/session/change-password') {
      const user = users.get(tokens.get(bearer) || '');
      if (!user) return Response.json({}, { status: 401 });
      if (String(body.newPassword).length < 12) return Response.json({ error: 'minLength' }, { status: 422 });
      user.password = body.newPassword;
      user.mustChange = false;
      return Response.json({ changed: true, mustChangePassword: false });
    }
    assert.equal(tokens.get(bearer), 'admin', `${method} ${path} must carry the administrator's token`);
    if (path === '/api/v1/admin/tenants/tenant_default/users' && method === 'GET') {
      return Response.json({ data: [...users.values()].map((u) => ({ id: u.id, username: u.username, etag: `"${u.id}"` })) });
    }
    if (path === '/api/v1/admin/tenants/tenant_default/users' && method === 'POST') {
      if (users.has(body.username)) return Response.json({ error: 'exists' }, { status: 409 });
      users.set(body.username, { id: `usr_${nextId++}`, username: body.username, password: body.password, mustChange: true });
      return Response.json({ id: body.username }, { status: 201 });
    }
    const reset = /\/users\/([^/]+)\/password-reset$/.exec(path);
    if (reset && method === 'POST') {
      const user = [...users.values()].find((u) => u.id === reset[1]);
      if (!user) return Response.json({}, { status: 404 });
      user.password = body.password;
      user.mustChange = true;
      return Response.json({ reset: true });
    }
    const removed = /\/users\/([^/]+)$/.exec(path);
    if (removed && method === 'DELETE') {
      const user = [...users.values()].find((u) => u.id === removed[1]);
      if (!user) return Response.json({}, { status: 404 });
      assert.equal(headers.get('if-match'), `"${user.id}"`, 'a delete carries the row version it read');
      users.delete(user.username);
      return Response.json({ deleted: true });
    }
    return Response.json({ error: `unexpected ${method} ${path}` }, { status: 500 });
  };
  return { users, calls, request };
}

describe('staging baseline identities', () => {
  it('creates every operator, takes each through its first sign-in, and leaves a repeat seed with nothing to do', async () => {
    const api = fixtureApi();
    const messages: string[] = [];
    const options = { password: 'admin-secret', request: api.request, log: (message: string) => messages.push(message) };

    assert.deepEqual(await ensureStagingUserPool('http://fixture', options), { created: STAGING_POOL_OPERATORS, ready: 0, repaired: 0, retired: 0 });
    assert.equal(api.users.size, STAGING_POOL_OPERATORS);
    for (let i = 0; i < STAGING_POOL_OPERATORS; i++) {
      const user = api.users.get(`pool.op${i}`)!;
      assert.equal(user.password, STAGING_POOL_PASSWORD, `pool.op${i} signs in with the pool password`);
      assert.equal(user.mustChange, false, `pool.op${i} is past its forced password change, so a browser sign-in opens the console`);
    }

    const before = JSON.stringify([...api.users]);
    assert.deepEqual(await ensureStagingUserPool('http://fixture', options), { created: 0, ready: STAGING_POOL_OPERATORS, repaired: 0, retired: 0 });
    assert.equal(JSON.stringify([...api.users]), before, 'a repeat seed changes nothing');
    assert.ok(messages.every((m) => !m.includes('admin-secret') && !m.includes(STAGING_POOL_PASSWORD) && !/tok-|admin-token/.test(m)), 'seed logs must not contain credentials');
  });

  it('repairs an identity whose password drifted and removes the retired pool administrators', async () => {
    const api = fixtureApi([
      { username: 'pool.op0', password: 'left-behind-by-a-case', mustChange: false },
      { username: 'pool.op1', password: 'password', mustChange: true },
      { username: 'pool.adm0', password: 'password', mustChange: true },
      { username: 'pool.adm1', password: 'password', mustChange: true },
    ]);
    const result = await ensureStagingUserPool('http://fixture', { password: 'admin-secret', request: api.request, log: () => undefined });
    assert.deepEqual(result, { created: STAGING_POOL_OPERATORS - 2, ready: 0, repaired: 2, retired: 2 });
    assert.equal(api.users.get('pool.op0')!.password, STAGING_POOL_PASSWORD);
    assert.equal(api.users.get('pool.op1')!.mustChange, false);
    assert.ok(!api.users.has('pool.adm0') && !api.users.has('pool.adm1'));
  });

  it('sends every sign-in that may be refused from a made-up address, never the deploy host\'s own', async () => {
    const api = fixtureApi();
    await ensureStagingUserPool('http://fixture', { password: 'admin-secret', request: api.request, log: () => undefined });
    const operatorSignIns = api.calls.filter((c) => c.path === '/api/v1/session/login').slice(1);
    assert.ok(operatorSignIns.length >= STAGING_POOL_OPERATORS);
    for (const call of operatorSignIns) assert.match(String(call.forwardedFor), /^198\.18\.255\.\d+$/);
  });

  it('does not try unauthenticated user creation after sign-in fails', async () => {
    let calls = 0;
    const request: typeof fetch = async () => { calls++; return Response.json({}, { status: 401 }); };
    await assert.rejects(ensureStagingUserPool('http://fixture', { password: 'fixture-password', request }), /login returned HTTP 401/);
    assert.equal(calls, 1);
  });

  it('rejects a successful sign-in response without a session token', async () => {
    let calls = 0;
    const request: typeof fetch = async () => { calls++; return Response.json({}); };
    await assert.rejects(ensureStagingUserPool('http://fixture', { password: 'fixture-password', request }), /no token/);
    assert.equal(calls, 1);
  });

  it('does not mistake an unrelated validation failure for an existing identity', async () => {
    const request: typeof fetch = async (input, init) => {
      if (!String(input).endsWith('/session/login')) return Response.json({ error: 'invalid security question' }, { status: 422 });
      const body = JSON.parse(String(init?.body));
      return body.username === 'admin' ? Response.json({ token: 'fixture-token' }) : Response.json({}, { status: 401 });
    };
    await assert.rejects(ensureStagingUserPool('http://fixture', { password: 'fixture-password', request }), /pool.op0 returned HTTP 422/);
  });

  it('refuses a pool password shorter than the application accepts from a user', async () => {
    await assert.rejects(ensureStagingUserPool('http://fixture', { password: 'x', poolPassword: 'short', request: fetch }), /at least 12 characters/);
  });
});
