// Client acceptance (UAT) — Ops Console shell + login gate (UC-sessionLogin), slice 2.
//
// Round 1 (sit/cases/98-client-uat-sessionlogin.sit.ts) covered the main sign-in/sign-out
// path and left idle expiry (AC-05), the per-user session cap/eviction (AC-07), sign-up,
// password-reset completion, and the forced password-change card for "the next slice" --
// see .claude/agent-memory/client-agent/MEMORY.md. This file is that slice.
//
// Same ground rules as 98-: every request goes through ENV.webBase (the console's own
// origin and nginx /api/ proxy), a fresh login's real Bearer token is used throughout, and
// each test opens its own session rather than sharing one.
//
// Every scenario here that needs a user beyond the shared SIT operator account (admin)
// creates and deletes its own disposable account through the admin Users API, tagged with
// a timestamp, so this file never touches a real shared identity and never signs in as
// ENV.username enough times to risk evicting a genuine operator's session on this shared
// stack (AC-07 is walked entirely on a throwaway account for exactly that reason).
//
// draft-autosave (alternate flow 11/12) is deliberately NOT covered by this file: it is a
// cross-screen feature (create-schema.html, test-case-form.html, test-suite-form.html,
// test-suite-new.html, plus the drafts CRUD API) that happens to be documented under
// UC-sessionLogin's alternate flows, not a behavior of the sign-in gate itself. Folding it
// in here would blur this file's scope (the gate and the session it creates) with a
// separate entity's full lifecycle (a personal draft). It is deferred again, explicitly,
// to its own slice -- see .claude/agent-memory/client-agent/MEMORY.md.
//
// AC-05 (idle expiry) is covered below as a documented, opt-in soak case rather than a
// real multi-hour wait -- see that test's own comment for why.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { withConsolePage } from "../lib/ui.ts";

const TIMEOUT_MS = 5000;
const LOGIN = `${ENV.webBase}/api/v1/session/login`;
const LOGOUT = `${ENV.webBase}/api/v1/session/logout`;
const ME = `${ENV.webBase}/api/v1/session/me`;
const SIGNUP = `${ENV.webBase}/api/v1/session/signup`;
const ADMIN_TENANTS = `${ENV.webBase}/api/v1/admin/tenants`;
const AUDIT = `${ENV.webBase}/api/v1/audit`;

// SESSION_MAX_PER_USER default (apps/api/src/modules/sessions.ts sessionPolicy). Confirmed
// this deployment carries no override via `docker exec sand-bench-enterprise-api-1 printenv`
// on 2026-10-31 -- no SESSION_* variable is set, so the documented default applies.
const EXPECTED_SESSION_CAP = 5;

function uniqueTag(): string {
  return `uat${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function jsonRequest(method: string, url: string, token: string | undefined, body?: unknown, extra: Record<string, string> = {}) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const postJson = (url: string, body: unknown) => jsonRequest("POST", url, undefined, body);
const getAuthed = (url: string, token: string) => jsonRequest("GET", url, token);

async function signIn(username: string, password: string) {
  return postJson(LOGIN, { username, password });
}

/** Creates a throwaway tenant member through the admin Users API; returns enough to sign in and clean up. */
async function createDisposableUser(tenantId: string, adminToken: string, input: { username: string; password: string; securityQuestion: string; securityAnswer: string }) {
  const created = await jsonRequest("POST", `${ADMIN_TENANTS}/${tenantId}/users`, adminToken, {
    username: input.username,
    displayName: `Client UAT ${input.username}`,
    email: `${input.username}@example.invalid`,
    password: input.password,
    securityQuestion: input.securityQuestion,
    securityAnswer: input.securityAnswer,
  });
  return created;
}

// This file runs on a shared stack where other sessions/agents may also be signing in as
// ENV.username (admin) at the same time. Holding one admin token for an entire test's
// duration (a loop of several logins, or several seconds of Playwright interaction) risks
// that token itself being evicted by SESSION_MAX_PER_USER before the test is done with it
// -- a real failure was observed exactly this way while writing this file (AC-07's own
// eviction assertions passed, but a later admin audit call on the same held-over token got
// 401). So: tenantId is cached (it never changes), but every admin call gets a BRAND NEW
// admin token immediately beforehand rather than reusing one captured earlier in the test.
let cachedTenantId: string | null = null;

/** A fresh admin token, obtained right before use so a long-running test never holds a stale one. */
async function adminLoginFresh(): Promise<string> {
  const adminLogin = await signIn(ENV.username, ENV.password);
  assert.equal(adminLogin.status, 200, `setup: the SIT operator's own admin sign-in must succeed (${JSON.stringify(adminLogin.json)})`);
  return adminLogin.json.token as string;
}

async function adminTenantId(adminToken: string): Promise<string> {
  if (cachedTenantId) return cachedTenantId;
  const tenants = await getAuthed(ADMIN_TENANTS, adminToken);
  assert.equal(tenants.status, 200, "setup: admin must be able to list tenants");
  cachedTenantId = tenants.json.data[0].id as string;
  return cachedTenantId;
}

/** Deletes a disposable user by id, re-authenticating and re-reading its current etag first. Never throws. */
async function deleteDisposableUserById(tenantId: string, userId: string): Promise<void> {
  const adminToken = await adminLoginFresh().catch(() => "");
  if (!adminToken) return;
  const users = await getAuthed(`${ADMIN_TENANTS}/${tenantId}/users`, adminToken);
  const row = (users.json.data || []).find((u: { id: string }) => u.id === userId);
  if (!row) return;
  await jsonRequest("DELETE", `${ADMIN_TENANTS}/${tenantId}/users/${userId}`, adminToken, undefined, { "if-match": row.etag }).catch(() => {});
}

/** Deletes a disposable user by username (when its id was never captured), re-authenticating first. Never throws. */
async function deleteDisposableUserByUsername(tenantId: string, username: string): Promise<void> {
  const adminToken = await adminLoginFresh().catch(() => "");
  if (!adminToken) return;
  const users = await getAuthed(`${ADMIN_TENANTS}/${tenantId}/users`, adminToken);
  const row = (users.json.data || []).find((u: { username: string }) => u.username === username);
  if (row) await jsonRequest("DELETE", `${ADMIN_TENANTS}/${tenantId}/users/${row.id}`, adminToken, undefined, { "if-match": row.etag }).catch(() => {});
}

test("UC-sessionLogin AC-07: signing in beyond the per-user session cap evicts only the oldest session", async () => {
  const tag = uniqueTag();
  const username = `${tag}.cap`;
  const password = `Cap-${tag}-Pw1`;
  let tenantId = "";
  let userId = "";
  try {
    const setupToken = await adminLoginFresh();
    tenantId = await adminTenantId(setupToken);
    const created = await createDisposableUser(tenantId, setupToken, {
      username, password, securityQuestion: "What is the client-uat cap marker?", securityAnswer: tag,
    });
    assert.equal(created.status, 201, `setup: disposable user must be created (${JSON.stringify(created.json)})`);
    userId = created.json.id;

    // One more sign-in than the cap allows, all on the same throwaway identity so a real
    // operator's session on this shared stack is never at risk of eviction.
    const tokens: string[] = [];
    for (let i = 0; i < EXPECTED_SESSION_CAP + 1; i++) {
      const login = await signIn(username, password);
      assert.equal(login.status, 200, `setup: disposable sign-in #${i + 1} of ${EXPECTED_SESSION_CAP + 1} must succeed`);
      tokens.push(login.json.token as string);
    }

    const oldest = await getAuthed(ME, tokens[0]);
    assert.equal(oldest.status, 401, "the oldest session beyond the cap must be evicted, not left live");

    for (let i = 1; i < tokens.length; i++) {
      const stillLive = await getAuthed(ME, tokens[i]);
      assert.equal(stillLive.status, 200, `session #${i + 1} (within the cap of ${EXPECTED_SESSION_CAP}) must remain live`);
    }

    // A fresh admin token for the audit check: the loop above took real time, and this is a
    // shared stack, so the setup token above is not assumed to still be live.
    const auditToken = await adminLoginFresh();
    const audit = await getAuthed(`${AUDIT}?action=session.evicted&resourceId=${userId}`, auditToken);
    assert.equal(audit.status, 200, "an administrator must be able to read the eviction audit trail");
    assert.ok(Array.isArray(audit.json.data) && audit.json.data.length >= 1, "a session.evicted audit row must exist for the evicted user");
    const detail = audit.json.data[0].detail || {};
    assert.equal(detail.reason, "session_limit");
    assert.equal(detail.limit, EXPECTED_SESSION_CAP);
    assert.equal(Array.isArray(detail.sessionIds) ? detail.sessionIds.length : -1, 1, "exactly one session (the oldest beyond the cap) must be recorded as evicted");
  } finally {
    if (tenantId && userId) await deleteDisposableUserById(tenantId, userId);
  }
});

// Idle expiry cannot be walked end to end inside a normal test run: SESSION_IDLE_HOURS
// defaults to 24 hours and the product bounds any override to a minimum of 1 hour
// (apps/api/src/modules/sessions.ts sessionPolicy's num(..., 24, 1, 720)); this deployment
// carries no override (confirmed via `docker exec sand-bench-enterprise-api-1 printenv`,
// 2026-10-31 -- no SESSION_* variable is set). No API exposes the configured value, and
// there is no short-TTL test hook, so a genuine wait is never practical here. Rather than
// fake it (a unit-level check of sessionPolicy()'s own arithmetic would just prove the
// product agrees with itself) or skip it silently, this is a real, bounded-timeout soak
// case that is skipped by default with its reason printed, and only actually runs -- and
// only then counts as coverage -- when an operator deliberately redeploys with a short
// window and opts in with a matching environment variable.
test("UC-sessionLogin AC-05: an idle session is refused with 401 once SESSION_IDLE_HOURS elapses (soak, opt-in)", async (t) => {
  const overrideHours = Number(process.env.SIT_IDLE_EXPIRY_TEST_HOURS || 0);
  if (!(overrideHours > 0)) {
    t.skip(
      "Skipped by default: SESSION_IDLE_HOURS defaults to 24h and is bounded to a minimum of 1h; " +
      "this deployment carries no override. There is no API that exposes the configured value and " +
      "no short-TTL test hook, so waiting out a real idle window is not practical in a normal test " +
      "run. To exercise this for real: redeploy with SESSION_IDLE_HOURS=1 (the shortest the product " +
      "allows), then re-run this file with SIT_IDLE_EXPIRY_TEST_HOURS=1 so the wait below matches " +
      "the deployed window."
    );
    return;
  }
  const login = await signIn(ENV.username, ENV.password);
  assert.equal(login.status, 200, "setup: sign-in must succeed before the idle-expiry soak");
  const token = login.json.token as string;
  const before = await getAuthed(ME, token);
  assert.equal(before.status, 200, "the fresh token must work before the idle window elapses");
  const waitMs = overrideHours * 60 * 60 * 1000 + 30000;
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  const after = await getAuthed(ME, token);
  assert.equal(after.status, 401, "a session must be refused once its idle deadline has passed");
});

test("UC-sessionLogin alternate flow 8 (API path): a prospective customer can self sign up and sign in right away", async (t) => {
  const tag = uniqueTag();
  const username = `${tag}.signup`;
  const password = `Signup-${tag}-Pw1`;
  try {
    const signup = await postJson(SIGNUP, { username, password, securityQuestion: "What is the client-uat signup marker?", securityAnswer: tag });
    // POST /api/v1/session/signup counts every attempt -- success or failure -- against a
    // per-source-IP throttle (SIGNUP_MAX_ATTEMPTS, default 10 per hour; loginThrottle.ts
    // signupThrottleSettings). Re-running this file repeatedly from the same host (as while
    // developing it, or several gate/SIT runs in the same hour) can genuinely exhaust that
    // bucket -- a real 429 from the real throttle, not a defect in sign-up itself. Treat it
    // as a skip rather than a failure so this test stays honest about what it could check,
    // and keep the real assertions below for every run where the throttle has room.
    if (signup.status === 429) {
      t.skip(`Skipped: this host's signup IP throttle is exhausted right now (${JSON.stringify(signup.json)}). Re-run after SIGNUP_WINDOW_MINUTES (default 60) or from a different source IP.`);
      return;
    }
    assert.equal(signup.status, 201, `a valid self sign-up must be accepted (${JSON.stringify(signup.json)})`);
    assert.match(String(signup.json.message || ""), /created/i, "a successful sign-up must tell the customer their account is ready");

    const duplicate = await postJson(SIGNUP, { username, password, securityQuestion: "Different question", securityAnswer: "different" });
    assert.equal(duplicate.status, 409, "signing up a second time with the same username must be rejected, not silently accepted");

    const login = await signIn(username, password);
    assert.equal(login.status, 200, "a freshly self-signed-up account must be able to sign in right away");
    assert.ok(login.json.token, "sign-in after self sign-up must return a usable token");
    assert.notEqual(login.json.mustChangePassword, true, "a self sign-up must not force a password change on its own first sign-in");
  } finally {
    const adminToken = await adminLoginFresh().catch(() => "");
    if (adminToken) {
      const tenantId = await adminTenantId(adminToken);
      await deleteDisposableUserByUsername(tenantId, username);
    }
  }
});

test("UC-sessionLogin alternate flow 8, walked by click: the Create an account entry point must open the sign-up card", async () => {
  await withConsolePage(async (page) => {
    await page.goto(`${ENV.webBase}/`, { waitUntil: "networkidle", timeout: 30000 });
    assert.ok(await page.locator("#gate").isVisible(), "setup: the sign-in gate must be visible");

    // FINDING: apps/web/public/index.html has no element with id="signup-link", even though
    // live-bind.js wires a click handler to #signup-link and the sign-up card itself
    // (#signup-card, fully built with all its fields) is already in the page, hidden. A
    // real prospective customer has no visible, clickable way to reach "Create an account"
    // from the sign-in gate today -- the entry point the use case and the screen contract
    // both document (ALT-session-login-8, asset "signup-link") does not exist in the DOM.
    const entryPoint = page.locator("#signup-link");
    assert.equal(
      await entryPoint.count(),
      1,
      "a 'Create an account' entry point (#signup-link) must exist on the sign-in gate so a " +
      "prospective customer can reach the sign-up card the backend and the gate's own script " +
      "already support"
    );
    await entryPoint.click();
    await page.waitForSelector("#signup-card:not(.hidden)", { timeout: 5000 });
    assert.ok(await page.locator("#signup-card").isVisible(), "clicking Create an account must reveal the sign-up card");
    assert.ok(!(await page.locator("#signin-card").isVisible()), "opening the sign-up card must hide the sign-in card");
  });
});

test("UC-sessionLogin alternate flow 7, walked by click: Forgot password? resets a real account's password end to end", async () => {
  const tag = uniqueTag();
  const username = `${tag}.reset`;
  const initialPassword = `Initial-${tag}-Pw1`;
  const newPassword = `Reset-${tag}-NewPw1`;
  const question = "What is the client-uat reset marker?";
  const answer = tag;
  let tenantId = "";
  let userId = "";
  try {
    const adminToken = await adminLoginFresh();
    tenantId = await adminTenantId(adminToken);
    const created = await createDisposableUser(tenantId, adminToken, { username, password: initialPassword, securityQuestion: question, securityAnswer: answer });
    assert.equal(created.status, 201, `setup: disposable user must be created (${JSON.stringify(created.json)})`);
    userId = created.json.id;

    await withConsolePage(async (page) => {
      await page.goto(`${ENV.webBase}/`, { waitUntil: "networkidle", timeout: 30000 });
      await page.locator("#forgot-password-link").click();
      await page.waitForSelector("#reset-card:not(.hidden)", { timeout: 5000 });
      await page.locator("#reset-username").fill(username);
      await page.locator("#reset-load-question").click();
      await page.waitForSelector("#reset-step-2:not(.hidden)", { timeout: 5000 });
      const shownQuestion = ((await page.locator("#reset-question-text").textContent()) || "").trim();
      assert.equal(shownQuestion, question, "the reset card must show this account's real security question, not a placeholder");

      // A wrong answer must be refused and keep the customer on the reset card.
      await page.locator("#reset-answer").fill("definitely-the-wrong-answer");
      await page.locator("#reset-new-password").fill(newPassword);
      await page.locator("#reset-submit").click();
      await page.waitForFunction(() => {
        const el = document.getElementById("reset-err");
        return Boolean(el && el.textContent && el.textContent.trim().length > 0);
      }, { timeout: 5000 });
      assert.ok(await page.locator("#reset-card").isVisible(), "a wrong security answer must not advance past the reset card");

      // The real answer completes the reset and returns to the sign-in card.
      await page.locator("#reset-answer").fill(answer);
      await page.locator("#reset-new-password").fill(newPassword);
      await page.locator("#reset-submit").click();
      await page.waitForSelector("#signin-card:not(.hidden)", { timeout: 5000 });
      assert.ok(await page.locator("#signin-card").isVisible(), "a successful reset must return to the sign-in card");
    });

    const oldLogin = await signIn(username, initialPassword);
    assert.equal(oldLogin.status, 401, "the old password must stop working once the reset completes");
    const newLogin = await signIn(username, newPassword);
    assert.equal(newLogin.status, 200, "the new password set through Forgot password? must actually work");
  } finally {
    if (tenantId && userId) await deleteDisposableUserById(tenantId, userId);
  }
});

test("UC-sessionLogin alternate flow 9: the forced password-change card rejects a short or mismatched password and never opens the console", async () => {
  const tag = uniqueTag();
  const username = `${tag}.forced1`;
  const temporaryPassword = `Temp-${tag}-Pw1`;
  let tenantId = "";
  let userId = "";
  try {
    const adminToken = await adminLoginFresh();
    tenantId = await adminTenantId(adminToken);
    const created = await createDisposableUser(tenantId, adminToken, { username, password: temporaryPassword, securityQuestion: "Client UAT forced-change marker?", securityAnswer: tag });
    assert.equal(created.status, 201, `setup: disposable user must be created (${JSON.stringify(created.json)})`);
    userId = created.json.id;

    await withConsolePage(async (page) => {
      await page.goto(`${ENV.webBase}/`, { waitUntil: "networkidle", timeout: 30000 });
      await page.locator("#username").fill(username);
      await page.locator("#password").fill(temporaryPassword);
      await page.locator("#login").click();
      await page.waitForSelector("#forced-password-card:not(.hidden)", { timeout: 20000 });
      assert.ok(await page.locator("#gate").isVisible(), "a pending forced password change must keep the operator on the gate");

      await page.locator("#forced-new-password").fill("Short1!");
      await page.locator("#forced-confirm-password").fill("Short1!");
      await page.locator("#forced-password-submit").click();
      const shortErr = ((await page.locator("#forced-password-err").textContent()) || "");
      assert.match(shortErr, /at least 12 characters/i, "a password under 12 characters must be rejected client-side with a readable reason");
      assert.ok(await page.locator("#forced-password-card").isVisible(), "a rejected short password must not advance past the forced-password card");

      await page.locator("#forced-new-password").fill("LongEnoughPassword1");
      await page.locator("#forced-confirm-password").fill("DoesNotMatchAtAll1");
      await page.locator("#forced-password-submit").click();
      const mismatchErr = ((await page.locator("#forced-password-err").textContent()) || "");
      assert.match(mismatchErr, /do not match/i, "a confirmation that does not match must be rejected with a readable reason");

      assert.ok(await page.locator("#gate").isVisible(), "the console must never open while a forced password change is rejected");
      const sidebarVisible = await page.locator("#console-root .opsc-sidebar").isVisible().catch(() => false);
      assert.equal(sidebarVisible, false, "the console sidebar must not mount while a forced password change is pending");
    });
  } finally {
    if (tenantId && userId) await deleteDisposableUserById(tenantId, userId);
  }
});

// FINDING: this reproduces live. Root cause traced with a throwaway diagnostic script
// (not checked in) against this deployment: apps/web/public/js/skip-link.js's ensureMain()
// is invoked on every "sbe:session" event (live-bind.js dispatches it unconditionally right
// after login, in BOTH the normal-console and the forced-password-change branches). When it
// finds no #main, no .opsc-screen-body and no .opsc-content yet -- true the very first time
// a brand-new, must-change-password account signs in, because that branch
// (showForcedPasswordChange) deliberately never mounts the console -- it falls through to
// `document.getElementById("console-root")` and PERMANENTLY RENAMES that element's id to
// "main" (skip-link.js lines ~32-40). #console-root never exists again for the rest of the
// page's life. So when the customer then saves a valid new password,
// completeForcedPasswordChange()'s own call to openConsole() does
// `document.getElementById("console-root")`, gets null, and silently mounts nothing: the
// gate hides, but no sidebar, no screen, nothing -- a real customer who was just told their
// administrator requires a new password is left on a blank page after doing exactly what
// was asked. A normal (not-forced) first sign-in does not hit this, because openConsole()
// mounts the console into #console-root (producing .opsc-content) before skip-link.js's
// ensureMain() ever runs for that session.
test("UC-sessionLogin alternate flow 9: saving a strong, matching new password on the forced card opens the console", async () => {
  const tag = uniqueTag();
  const username = `${tag}.forced2`;
  const temporaryPassword = `Temp-${tag}-Pw1`;
  const newPassword = `Forced-${tag}-StrongPw1`;
  let tenantId = "";
  let userId = "";
  try {
    const adminToken = await adminLoginFresh();
    tenantId = await adminTenantId(adminToken);
    const created = await createDisposableUser(tenantId, adminToken, { username, password: temporaryPassword, securityQuestion: "Client UAT forced-change marker?", securityAnswer: tag });
    assert.equal(created.status, 201, `setup: disposable user must be created (${JSON.stringify(created.json)})`);
    userId = created.json.id;

    await withConsolePage(async (page) => {
      await page.goto(`${ENV.webBase}/`, { waitUntil: "networkidle", timeout: 30000 });
      await page.locator("#username").fill(username);
      await page.locator("#password").fill(temporaryPassword);
      await page.locator("#login").click();
      await page.waitForSelector("#forced-password-card:not(.hidden)", { timeout: 20000 });

      await page.locator("#forced-new-password").fill(newPassword);
      await page.locator("#forced-confirm-password").fill(newPassword);
      await page.locator("#forced-password-submit").click();
      await page.waitForSelector("#gate", { state: "hidden", timeout: 20000 });
      await page.waitForSelector("#console-root .opsc-sidebar", { timeout: 20000 });
      assert.ok(await page.locator("#console-root .opsc-sidebar").isVisible(), "a successful forced password change must open the console");

      const token = await page.evaluate(() => window.localStorage.getItem("sbe_token"));
      if (token) await fetch(LOGOUT, { method: "POST", headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => {});
    });

    const reLogin = await signIn(username, newPassword);
    assert.equal(reLogin.status, 200, "the new password set via the forced-password card must work on a fresh sign-in");
    assert.notEqual(reLogin.json.mustChangePassword, true, "mustChangePassword must be cleared once the forced change is complete");
  } finally {
    if (tenantId && userId) await deleteDisposableUserById(tenantId, userId);
  }
});
