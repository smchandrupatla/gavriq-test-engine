import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, UnsecuredJWT } from "jose";
import { randomBytes } from "node:crypto";
import { ENV } from "../lib/env.ts";

const LOGIN = `${ENV.apiBase}/api/v1/session/login`;
const ME = `${ENV.apiBase}/api/v1/session/me`;
const LOGOUT = `${ENV.apiBase}/api/v1/session/logout`;
const SECURITY_QUESTION = `${ENV.apiBase}/api/v1/session/security-question`;
const PASSWORD_RESET = `${ENV.apiBase}/api/v1/session/password-reset`;
const AUTHENTICATOR_LOGIN = `${ENV.apiBase}/api/v1/auth/login`;

async function postLogin(body: unknown) {
  const res = await fetch(LOGIN, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, json };
}

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/** A random, never-registered username -- never collides with a seeded account. */
function randomUsername() {
  return `nobody-${randomBytes(6).toString("hex")}`;
}

test("ASVS V6 login rejects missing credentials (no 500)", async () => {
  const { status, json } = await postLogin({});
  assert.ok(status === 401 || status === 422, `expected 401/422 got ${status}`);
  assert.ok(json.error, "error envelope missing");
  assert.ok(!/password|stack|jwtSecret/i.test(JSON.stringify(json)), "secret leaked in login error");
});

test("ASVS V6 login rejects wrong password", async () => {
  const { status } = await postLogin({
    tenantSlug: ENV.tenantSlug,
    username: ENV.username,
    password: "definitely-not-the-password",
  });
  assert.ok(status === 401 || status === 422, `expected reject got ${status}`);
});

test("ASVS V1 login rejects injection-shaped username", async () => {
  const { status, json } = await postLogin({
    tenantSlug: ENV.tenantSlug,
    username: "' OR 1=1 --",
    password: "x",
  });
  assert.ok(status === 401 || status === 422);
  assert.ok(!String(json.error?.message || "").includes("syntax"));
});

test("ASVS V7 session/me requires a bearer token", async () => {
  const res = await fetch(`${ENV.apiBase}/api/v1/session/me`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 401);
});

// --- Account enumeration resistance --------------------------------------------------
//
// These attempts are deliberately kept small (at most one wrong-password attempt against
// the real ENV.username, the rest against throwaway random usernames) so this file never
// drives the real demo account -- or the SIT runner's own address -- into the account/IP
// lockout that login-throttle.test.ts already exercises end-to-end against a private
// database. Tripping that lockout here would 429 every other SIT case that signs in.

test("ASVS V2.1 a wrong password and an unknown username refuse identically", async () => {
  const wrongPassword = await postLogin({ username: ENV.username, password: "definitely-not-the-password" });
  const unknownUser = await postLogin({ username: randomUsername(), password: "whatever" });
  assert.equal(wrongPassword.status, unknownUser.status, "status must not reveal whether the account exists");
  assert.deepEqual(
    { code: wrongPassword.json.error?.code, message: wrongPassword.json.error?.message },
    { code: unknownUser.json.error?.code, message: unknownUser.json.error?.message },
    "a wrong password and an unknown username must look exactly the same"
  );
});

test("ASVS V2.1 the forgot-password security question does not reveal whether the account exists", async () => {
  const known = await getJson(`${SECURITY_QUESTION}?username=${encodeURIComponent(ENV.username)}`);
  const unknown = await getJson(`${SECURITY_QUESTION}?username=${encodeURIComponent(randomUsername())}`);
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(
    known.json.question,
    unknown.json.question,
    "a real account's security question must not be distinguishable from the generic fallback shown for an unknown one"
  );
});

// --- Password reset abuse ------------------------------------------------------------

test("ASVS V2.1 password reset with a wrong security answer refuses like a failed login, not a 500", async () => {
  const { status, json } = await postJson(PASSWORD_RESET, {
    username: randomUsername(),
    securityAnswer: "definitely-wrong",
    newPassword: `Reset-${randomBytes(9).toString("hex")}`,
  });
  assert.ok(status === 401 || status === 404, `expected reject got ${status}`);
  assert.ok(!/stack|node:internal|password_hash/i.test(JSON.stringify(json)), "secret/internal detail leaked");
});

test("ASVS V5 password reset rejects a missing field without touching the database", async () => {
  const { status, json } = await postJson(PASSWORD_RESET, { username: randomUsername() });
  assert.ok(status === 401 || status === 422, `expected reject got ${status}`);
  assert.ok(!/stack|node:internal/i.test(JSON.stringify(json)));
});

// --- Token integrity -------------------------------------------------------------------

test("ASVS V3.5 session/me rejects a token with a tampered signature", async () => {
  const forged = await new SignJWT({ user_id: "usr_forged", tenant_id: "tnt_forged", membership_id: "mem_forged" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("usr_forged")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(new TextEncoder().encode("not-the-real-jwt-secret"));
  const res = await fetch(ME, { headers: { authorization: `Bearer ${forged}` }, signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 401);
});

test("ASVS V3.5 session/me rejects an unsigned alg=none token (algorithm confusion)", async () => {
  const none = new UnsecuredJWT({ user_id: "usr_forged", tenant_id: "tnt_forged", membership_id: "mem_forged" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .encode();
  const res = await fetch(ME, { headers: { authorization: `Bearer ${none}` }, signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 401);
});

// --- Session lifecycle -----------------------------------------------------------------
//
// Uses its own, independent login -- never the shared cached token from sit/lib/client.ts
// -- so logging this session out cannot break any other case's authenticated calls.

test("ASVS V7.1 logging out revokes the session so the same token is refused afterward", async () => {
  const { status, json } = await postLogin({ username: ENV.username, password: ENV.password });
  assert.equal(status, 200, "setup: SIT credentials must still sign in");
  const token = json.token as string;
  const auth = { authorization: `Bearer ${token}` };

  const beforeLogout = await fetch(ME, { headers: auth, signal: AbortSignal.timeout(5000) });
  assert.equal(beforeLogout.status, 200, "the fresh token must work before logout");

  const logout = await fetch(LOGOUT, { method: "POST", headers: auth, signal: AbortSignal.timeout(5000) });
  assert.equal(logout.status, 200);

  const afterLogout = await fetch(ME, { headers: auth, signal: AbortSignal.timeout(5000) });
  assert.equal(afterLogout.status, 401, "a logged-out token must be refused, not just expired 8h later");
});

test("ASVS V7 a successful login never returns credential material", async () => {
  const { status, json } = await postLogin({ username: ENV.username, password: ENV.password });
  assert.equal(status, 200);
  const blob = JSON.stringify(json);
  assert.ok(!/passwordHash|password_hash|securityAnswer|jwtSecret|pepper/i.test(blob), "credential material leaked in login response");
});

// --- Cross-cutting ---------------------------------------------------------------------

test("ASVS V5.3 login rejects script-tag-shaped credentials without reflecting them unescaped", async () => {
  const payload = `<script>alert(1)</script>`;
  const { status, json } = await postLogin({ username: payload, password: payload });
  assert.ok(status === 401 || status === 422, `expected reject got ${status}`);
  assert.ok(!JSON.stringify(json).includes("<script>"), "XSS payload reflected unescaped in the login error body");
});

test("the TOTP authenticator login path stays fail-closed on this deployment", async () => {
  const res = await fetch(AUTHENTICATOR_LOGIN, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "123456" }),
    signal: AbortSignal.timeout(5000),
  });
  // Disabled by default (DEFAULT_AUTHENTICATOR.enabled=false): routes are not even
  // registered, so this is a 404, never a successful sign-in.
  assert.notEqual(res.status, 200, "the default admin code must never sign anyone in");
});
