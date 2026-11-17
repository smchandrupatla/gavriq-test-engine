/**
 * Sand Bench — local user management (Test Engine)
 *
 * Covers:
 *  - Functional: user list/limit API shape, admin actions auth wall
 *  - GUI: user-management page + Configuration "User management" binder
 *  - Penetration: unauthenticated mutation rejected; injection-shaped username on login
 *
 * Sign-in: name (username) + password; secret question used for password reset
 * (POST /api/v1/session/password-reset). Product ceiling: 200 users per tenant.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";

const USERS = `${ENV.apiBase}/api/v1/users`;
const LIMIT = `${ENV.apiBase}/api/v1/users/limit`;
const LOGIN = `${ENV.apiBase}/api/v1/session/login`;
const RESET = `${ENV.apiBase}/api/v1/session/password-reset`;
const SECURITY_Q = `${ENV.apiBase}/api/v1/session/security-question`;

test("functional: users limit endpoint reports maxUsers 200 when API is up", async () => {
  const res = await fetch(LIMIT, { signal: AbortSignal.timeout(5000) });
  const json = await res.json().catch(() => ({}));
  assert.ok(!/jwtSecret|password_hash|pepper/i.test(JSON.stringify(json)));
  if (res.status === 200) {
    const max = json.data?.maxUsers ?? json.maxUsers;
    assert.equal(max, 200);
  } else {
    assert.ok([401, 403].includes(res.status), `expected 200/401/403 got ${res.status}`);
  }
});

test("functional: POST users/:id/actions without token is rejected", async () => {
  const res = await fetch(`${USERS}/usr_nobody/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "suspend" }),
    signal: AbortSignal.timeout(5000),
  });
  assert.ok([401, 403, 404].includes(res.status), `expected auth wall, got ${res.status}`);
});

test("functional: password-reset without fields is validation or unauthorized (not 500)", async () => {
  const res = await fetch(RESET, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(5000),
  });
  assert.ok([401, 422, 404].includes(res.status), `expected 401/422/404 got ${res.status}`);
  assert.notEqual(res.status, 500);
});

test("gui: user-management page is served", async () => {
  // 2026-11-02 (IMP-QA054): Configuration > Users and Configuration > User roles merged into
  // this one tabbed page. Its admin actions (reset password, suspend, delete) are rendered at
  // runtime by configuration-users.js per row, not static markup here, so this checks the page
  // itself for the shell and the user-limit figure, and the controller script for the real
  // action verbs (the old static mockup's "Force password reset"/"Disable account" wording is
  // gone -- this is the real, tested admin screen, not a mockup).
  const res = await fetch(`${ENV.webBase}/user-management.html`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /User management/i);
  assert.match(html, /200/);

  const scriptRes = await fetch(`${ENV.webBase}/js/configuration-users.js`, { signal: AbortSignal.timeout(5000) });
  assert.equal(scriptRes.status, 200);
  const script = await scriptRes.text();
  assert.match(script, /Reset password/i);
  assert.match(script, /Suspend/i);
  assert.match(script, /Delete/i);
});

test("gui: the console sidebar's User management entry points at the merged page", async () => {
  // Replaces the old user-admin-bind.js check: that script was a stop-gap workaround for the
  // page being unreachable from the real sidebar (IMP-QA054) and has been deleted now that the
  // real Configuration > User management sidebar entry links here directly.
  const res = await fetch(`${ENV.webBase}/js/ops-console-preview.js`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  const js = await res.text();
  assert.match(js, /User management/);
  assert.match(js, /user-management\.html/);
});

test("penetration: unauthenticated user create is rejected", async () => {
  const res = await fetch(USERS, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Pen Test",
      email: "pen@example.invalid",
      username: "pentest",
    }),
    signal: AbortSignal.timeout(5000),
  });
  assert.ok([401, 403, 404, 422].includes(res.status), `expected closed, got ${res.status}`);
  const body = await res.text();
  assert.ok(!/stack|jwtSecret|pepper/i.test(body));
});

test("penetration: login with injection-shaped name does not 500", async () => {
  const res = await fetch(LOGIN, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "' OR 1=1 --",
      password: "x",
      tenantSlug: ENV.tenantSlug,
    }),
    signal: AbortSignal.timeout(5000),
  });
  assert.ok([401, 422].includes(res.status), `expected 401/422 got ${res.status}`);
  assert.notEqual(res.status, 500);
});

test("penetration: security-question probe does not leak account existence via 500", async () => {
  const res = await fetch(`${SECURITY_Q}?username=definitely-not-a-user`, {
    signal: AbortSignal.timeout(5000),
  });
  assert.notEqual(res.status, 500);
  const json = await res.json().catch(() => ({}));
  assert.ok(!/stack|at signIn|password_hash/i.test(JSON.stringify(json)));
});

test("security: user limit and lifecycle matrix blocks suspended/deleted access and enforces force reset", async () => {
  const jsonRequest = (method: string, url: string, token: string | undefined, body?: unknown, extra: Record<string, string> = {}) =>
    fetch(url, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  const read = async (response: Response) => ({ response, body: await response.json().catch(() => ({})) as Record<string, any> });
  const login = async (username: string, password: string) => read(await jsonRequest("POST", LOGIN, undefined, { username, password }));
  const tag = `sit${Date.now().toString(36)}`;
  const password = `Initial-${tag}-Password`;
  let adminToken: string | undefined;
  let tenantId = "";
  let userId = "";
  let userEtag = "";
  let originalLimit = 100;
  let deleted = false;
  try {
    const adminLogin = await login(ENV.username, ENV.password);
    assert.equal(adminLogin.response.status, 200);
    adminToken = adminLogin.body.token;

    const tenants = await read(await jsonRequest("GET", `${ENV.apiBase}/api/v1/admin/tenants`, adminToken));
    assert.equal(tenants.response.status, 200);
    tenantId = tenants.body.data[0].id;

    const current = await read(await jsonRequest("GET", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/user-limit`, adminToken));
    assert.equal(current.response.status, 200);
    originalLimit = current.body.maxUsers;
    const boundary = current.body.used + 1;
    const configured = await read(await jsonRequest("PATCH", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/user-limit`, adminToken, { maxUsers: boundary }));
    assert.equal(configured.response.status, 200);
    assert.equal(configured.body.maxUsers, boundary);

    const create = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users`, adminToken, {
      username: `${tag}.user`, displayName: `SIT ${tag}`, email: `${tag}@example.invalid`, password,
      securityQuestion: "What is the SIT marker?", securityAnswer: tag,
    }));
    assert.equal(create.response.status, 201);
    userId = create.body.id;
    userEtag = create.body.etag;

    const overLimit = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users`, adminToken, {
      username: `${tag}.overflow`, displayName: "Should not be created", email: `${tag}.overflow@example.invalid`, password,
      securityQuestion: "Question", securityAnswer: "Answer",
    }));
    assert.equal(overLimit.response.status, 409);
    assert.match(JSON.stringify(overLimit.body), /User limit reached/i);

    // An admin-created password is usable, but login truthfully carries the mandatory reset flag.
    const firstLogin = await login(`${tag}.user`, password);
    assert.equal(firstLogin.response.status, 200);
    assert.equal(firstLogin.body.mustChangePassword, true);

    const suspended = await read(await jsonRequest("PATCH", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users/${userId}`, adminToken, { status: "suspended" }, { "if-match": userEtag }));
    assert.equal(suspended.response.status, 200);
    userEtag = suspended.body.etag;
    const suspendedLogin = await login(`${tag}.user`, password);
    assert.equal(suspendedLogin.response.status, 401, "suspended users cannot sign in");

    const active = await read(await jsonRequest("PATCH", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users/${userId}`, adminToken, { status: "active" }, { "if-match": userEtag }));
    assert.equal(active.response.status, 200);
    userEtag = active.body.etag;

    const reset = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users/${userId}/password-reset`, adminToken, {}));
    assert.equal(reset.response.status, 200);
    assert.equal(reset.body.mustChangePassword, true);
    assert.ok(reset.body.temporaryPassword, "temporary password is returned only to the administrator who requested it");
    const oldPassword = await login(`${tag}.user`, password);
    assert.equal(oldPassword.response.status, 401);
    const temporaryLogin = await login(`${tag}.user`, reset.body.temporaryPassword);
    assert.equal(temporaryLogin.response.status, 200);
    assert.equal(temporaryLogin.body.mustChangePassword, true);

    const deletedResponse = await read(await jsonRequest("DELETE", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users/${userId}`, adminToken, undefined, { "if-match": userEtag }));
    assert.equal(deletedResponse.response.status, 200);
    deleted = true;
    const deletedLogin = await login(`${tag}.user`, reset.body.temporaryPassword);
    assert.equal(deletedLogin.response.status, 401, "deleted users cannot sign in");
  } finally {
    if (adminToken && tenantId) {
      if (userId && !deleted) {
        const users = await read(await jsonRequest("GET", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users`, adminToken));
        const row = users.body.data?.find((item: { id: string }) => item.id === userId);
        if (row) {
          if (row.status !== "active") {
            const restored = await read(await jsonRequest("PATCH", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users/${userId}`, adminToken, { status: "active" }, { "if-match": row.etag }));
            row.etag = restored.body.etag;
          }
          await jsonRequest("DELETE", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users/${userId}`, adminToken, undefined, { "if-match": row.etag });
        }
      }
      await jsonRequest("PATCH", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/user-limit`, adminToken, { maxUsers: originalLimit });
    }
  }
});
