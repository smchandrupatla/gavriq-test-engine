// Client acceptance (UAT) — Ops Console shell + login gate (UC-sessionLogin).
//
// The client-agent plays the paying customer: it walks the documented use case
// (docs/use-cases/UC-sessionLogin.md) against the real, deployed console the way an
// operator actually experiences it, not through sit/lib/client.ts's shared cached token.
// Every request here goes through ENV.webBase — the console's own origin and nginx
// /api/ proxy — exactly what the browser's own fetches hit, not ENV.apiBase directly.
//
// Own numeric range (98-, own group "client-uat" under the e2e suite type in
// sit/lib/catalog.mjs), growing one lettered file per feature area (98b, 98c, ...) the
// same way 74/74b.. and 75/75b.. already do, so later client-agent slices never need a
// new two-digit number.
//
// Scope for this first slice: the main sign-in/sign-out path (UC-sessionLogin main flow,
// AC-01, AC-02, AC-03, AC-04, AC-06, AC-08) plus a few realistic invented variations a real
// customer would hit (a blank password, a pasted username with stray whitespace, the
// "Forgot password?" entry point actually working). Idle expiry (AC-05), the per-user
// session cap/eviction (AC-07), sign-up, password reset completion, the forced
// password-change card and draft-autosave are deliberately left for the next slice —
// see .claude/agent-memory/client-agent/MEMORY.md.
//
// A fresh login's real token (Authorization: Bearer, apps/web/public/js/live-bind.js and
// session-end.js's actual mechanism) is used throughout, not the HttpOnly session-cookie +
// x-sbe-csrf path in apps/api/src/modules/sessionCookie.ts: the real console never sends
// x-sbe-client: browser on login, so that cookie path is never entered today and testing
// it here would misrepresent what a customer's browser actually does.
//
// node:test runs a file's top-level tests sequentially, but each test below still opens
// its own fresh session rather than sharing one across tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { withConsolePage } from "../lib/ui.ts";

const TIMEOUT_MS = 5000;
const LOGIN = `${ENV.webBase}/api/v1/session/login`;
const LOGOUT = `${ENV.webBase}/api/v1/session/logout`;
const ME = `${ENV.webBase}/api/v1/session/me`;
const BOOTSTRAP = `${ENV.webBase}/api/v1/console/bootstrap`;
const SECURITY_QUESTION = `${ENV.webBase}/api/v1/session/security-question`;
const NO_INTERNAL_LEAK = /stack|node:internal|password_hash/i;

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function getAuthed(url: string, token: string) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function signIn(username: string, password: string) {
  return postJson(LOGIN, { username, password });
}

test("UC-sessionLogin main flow: the sign-in gate serves the controls a customer actually sees", async () => {
  const res = await fetch(`${ENV.webBase}/`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  assert.equal(res.status, 200, "the console shell / login gate must be reachable at /");
  const html = await res.text();
  assert.match(html, /id="gate"/, "sign-in gate container missing");
  assert.match(html, /id="username"/, "Username field missing from the sign-in card");
  assert.match(html, /id="password"/, "Password field missing from the sign-in card");
  assert.match(html, /id="login"/, "Sign in button missing from the sign-in card");
  assert.match(html, /id="forgot-password-link"/, "Forgot password? entry point missing");
});

test("UC-sessionLogin AC-01/AC-04: a sign-in submitted with a field left blank is rejected and issues no token", async () => {
  const bothBlank = await signIn("", "");
  assert.ok([401, 422].includes(bothBlank.status), `expected a validation/auth rejection, got ${bothBlank.status}`);
  assert.equal(bothBlank.json.token, undefined, "a token must never be issued for a blank sign-in");

  const passwordBlank = await signIn(ENV.username, "");
  assert.ok([401, 422].includes(passwordBlank.status), `expected a validation/auth rejection, got ${passwordBlank.status}`);
  assert.equal(passwordBlank.json.token, undefined, "a token must never be issued when the password field is left blank");
  assert.ok(!NO_INTERNAL_LEAK.test(JSON.stringify(passwordBlank.json)), "no internal detail must leak in the rejection body");
});

test("UC-sessionLogin AC-02/AC-03: correct credentials let the customer into the console", async () => {
  const login = await signIn(ENV.username, ENV.password);
  assert.equal(login.status, 200, `setup: the SIT operator's own credentials must sign in (${JSON.stringify(login.json)})`);
  assert.ok(login.json.token, "a successful sign-in must return a usable token");
  assert.ok(!String(login.json.token).includes("none"), "a real token must be issued, not an unsigned placeholder");

  const me = await getAuthed(ME, login.json.token);
  assert.equal(me.status, 200, "/session/me must accept the token the console just received");
  assert.equal(me.json.username, ENV.username);
  assert.ok(Array.isArray(me.json.menuKeys) && me.json.menuKeys.length > 0, "a signed-in operator must get a non-empty menu so the sidebar can render");
  assert.ok(me.json.tenant && me.json.tenant.slug, "the profile must carry the tenant the console binds navigation to");

  const bootstrap = await getAuthed(BOOTSTRAP, login.json.token);
  assert.equal(bootstrap.status, 200, "console bootstrap must accept the freshly issued token");
});

test("UC-sessionLogin AC-08 (two tabs): one sign-in keeps serving concurrent requests from the same browser", async () => {
  const login = await signIn(ENV.username, ENV.password);
  assert.equal(login.status, 200, "setup: sign-in must succeed before the two-tabs check");
  assert.ok(login.json.token, `setup: a 200 sign-in must carry a usable token (${JSON.stringify(login.json)})`);
  const token = login.json.token as string;

  const [tabOne, tabTwo] = await Promise.all([getAuthed(ME, token), getAuthed(ME, token)]);
  assert.equal(tabOne.status, 200, "the first tab must stay signed in");
  assert.equal(tabTwo.status, 200, "the second tab must stay signed in on the same shared session");
  assert.equal(tabOne.json.userId, tabTwo.json.userId, "both tabs must see the same signed-in identity");
});

test("UC-sessionLogin AC-06: Sign out ends the session so the same token is refused afterward", async () => {
  const login = await signIn(ENV.username, ENV.password);
  assert.equal(login.status, 200, "setup: sign-in must succeed before the sign-out check");
  assert.ok(login.json.token, `setup: a 200 sign-in must carry a usable token (${JSON.stringify(login.json)})`);
  const token = login.json.token as string;

  const beforeSignOut = await getAuthed(ME, token);
  assert.equal(beforeSignOut.status, 200, "the fresh token must work before Sign out is clicked");

  const signOut = await fetch(LOGOUT, { method: "POST", headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  assert.equal(signOut.status, 200, "Sign out must succeed for a live session");
  const signOutBody = await signOut.json().catch(() => ({}));
  assert.equal(signOutBody.revoked, true, "Sign out must report the session as revoked");

  const afterSignOut = await getAuthed(ME, token);
  assert.equal(afterSignOut.status, 401, "a copy of the signed-out token must be refused, not merely expired hours later");
});

test("a pasted username with stray leading/trailing whitespace does not sign in or silently create an ambiguous session", async () => {
  const padded = await signIn(`  ${ENV.username}  `, ENV.password);
  assert.equal(padded.status, 401, "a padded username must not be treated as the exact seeded account");
  assert.equal(padded.json.token, undefined, "a rejected, padded-username sign-in must never issue a token");
  assert.ok(!NO_INTERNAL_LEAK.test(JSON.stringify(padded.json)), "no internal detail must leak in the rejection body");
});

test("UC-sessionLogin main flow, walked by click: a customer types into the real fields, clicks Sign in, and reaches the mounted console", async () => {
  await withConsolePage(async (page) => {
    await page.goto(`${ENV.webBase}/`, { waitUntil: "networkidle", timeout: 30000 });
    assert.ok(await page.locator("#gate").isVisible(), "the sign-in gate must be showing before sign-in");
    await page.locator("#username").fill(ENV.username);
    await page.locator("#password").fill(ENV.password);
    await page.locator("#login").click();
    await page.waitForSelector("#gate", { state: "hidden", timeout: 20000 });
    await page.waitForSelector("#console-root .opsc-sidebar", { timeout: 20000 });
    assert.ok(await page.locator("#console-root .opsc-sidebar").isVisible(), "the console sidebar must mount after a real sign-in click");

    const token = await page.evaluate(() => window.localStorage.getItem("sbe_token"));
    if (token) {
      await fetch(LOGOUT, { method: "POST", headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    }
  });
});

test("UC-sessionLogin AC-01, walked by click: clicking Sign in with both fields left blank shows a real, readable error and keeps the customer on the gate", async () => {
  await withConsolePage(async (page) => {
    await page.goto(`${ENV.webBase}/`, { waitUntil: "networkidle", timeout: 30000 });
    await page.locator("#login").click();
    const errorText = (await page.locator("#login-err").textContent()) || "";
    assert.ok(errorText.trim().length > 0, "the gate must show a readable error for a blank submission, not fail silently");
    assert.ok(await page.locator("#gate").isVisible(), "a blank submission must never leave the gate or open the console");
  });
});

test("UC-sessionLogin alternate flow 7: Forgot password? loads a real, usable security question", async () => {
  const res = await fetch(`${SECURITY_QUESTION}?username=${encodeURIComponent(ENV.username)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  assert.equal(res.status, 200, "the Forgot password? entry point must answer for a real account");
  const body = await res.json();
  assert.equal(typeof body.question, "string");
  assert.ok(body.question.trim().length > 0, "a real account must get back an actual security question, not an empty placeholder");
});
