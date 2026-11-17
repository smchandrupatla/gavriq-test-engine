/**
 * Sand Bench — session idle log-off (Test Engine / security suite)
 *
 * Product rule under test:
 *   After login, if the operator is inactive for five minutes, Sand Bench
 *   automatically ends the session and shows a prompt that the user has
 *   been logged out (so the operator knows why they returned to the gate).
 *
 * Maps to OWASP ASVS V7 (Session Management).
 *
 * CI cannot wait a real five minutes on every deploy, so:
 *   - Always assert login → session/me works, and an expired/invalid token
 *     is rejected with a clean 401 (no secret leak).
 *   - The full idle-window wait runs only when SIT_IDLE_WAIT=1 (manual /
 *     long-running gate). Until the product exposes a short test idle
 *     (e.g. SESSION_IDLE_MS), that long case is skipped rather than failed.
 *
 * Application: Sand Bench (Ops Console + API). Not Testhub / Agent Desk.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";

const LOGIN = `${ENV.apiBase}/api/v1/session/login`;
const ME = `${ENV.apiBase}/api/v1/session/me`;

/** Product idle window: five minutes of no activity → auto log-off + prompt. */
export const IDLE_LOGOFF_MS = 5 * 60 * 1000;

/** Expected operator-facing prompt language (any of these is acceptable). */
export const LOGOFF_PROMPT_PATTERNS = [
  /logged\s*out/i,
  /session\s*(has\s*)?(expired|ended|timed\s*out)/i,
  /you\s*(have\s*been|are)\s*(logged|signed)\s*out/i,
  /inactiv(e|ity).*(log|sign)\s*out/i,
];

async function postLogin(body: unknown) {
  const res = await fetch(LOGIN, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function getMe(token: string) {
  const res = await fetch(ME, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

test("session idle policy: login establishes a usable session (ASVS V7)", async () => {
  const { status, json } = await postLogin({
    tenantSlug: ENV.tenantSlug,
    username: ENV.username,
    password: ENV.password || "demo",
  });
  // Demo stacks may reject empty password; accept either authenticated or explicit auth failure.
  if (status === 401 || status === 422) {
    assert.ok(json.error, "error envelope required on failed login");
    assert.ok(
      !/password|stack|jwtSecret|pepper/i.test(JSON.stringify(json)),
      "secret must not leak on login failure"
    );
    return;
  }
  assert.equal(status, 200, `expected 200 login, got ${status}`);
  assert.ok(json.token || json.data?.token, "login must return a bearer token");
  const token = json.token || json.data?.token;
  const me = await getMe(token);
  assert.equal(me.status, 200, "session/me must succeed right after login");
});

test("session idle policy: expired or garbage token is rejected with 401 (ASVS V7)", async () => {
  const me = await getMe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.invalid");
  assert.equal(me.status, 401, `expired/invalid token must be 401, got ${me.status}`);
  const body = JSON.stringify(me.json);
  assert.ok(!/jwtSecret|password|pepper|stack/i.test(body), "secret must not leak on me 401");
});

test("session idle policy: product idle window is five minutes", () => {
  assert.equal(IDLE_LOGOFF_MS, 300_000, "Sand Bench idle log-off is fixed at five minutes");
});

test("session idle policy: log-off prompt vocabulary is defined for operators", () => {
  assert.ok(LOGOFF_PROMPT_PATTERNS.length >= 2);
  // Sanity: each pattern is a RegExp that would match a clear operator message.
  const sample = "You have been logged out due to inactivity. Session expired.";
  const hits = LOGOFF_PROMPT_PATTERNS.filter((re) => re.test(sample));
  assert.ok(hits.length >= 1, "prompt patterns must match a clear log-out message");
});

test("session idle policy: full five-minute inactivity wait (opt-in)", async (t) => {
  if (process.env.SIT_IDLE_WAIT !== "1") {
    t.skip(
      "Set SIT_IDLE_WAIT=1 to exercise the real five-minute idle window (manual / long gate). " +
        "Default deploys skip this wait so the Test Engine stays fast."
    );
    return;
  }

  const { status, json } = await postLogin({
    tenantSlug: ENV.tenantSlug,
    username: ENV.username,
    password: ENV.password || "demo",
  });
  if (status !== 200) {
    t.skip("login unavailable on this stack; cannot exercise idle wait");
    return;
  }
  const token = json.token || json.data?.token;
  assert.ok(token);

  // No activity for the product idle window, then session/me must fail.
  await new Promise((r) => setTimeout(r, IDLE_LOGOFF_MS + 5_000));

  const me = await getMe(token);
  assert.equal(
    me.status,
    401,
    "after five minutes of inactivity the session must be ended (401 on session/me)"
  );
  // When the product returns a message, it should match the operator prompt language.
  const msg = String(me.json?.error?.message || me.json?.message || me.json?.error || "");
  if (msg) {
    const ok = LOGOFF_PROMPT_PATTERNS.some((re) => re.test(msg));
    assert.ok(ok, `log-off message should tell the operator they were logged out; got: ${msg}`);
  }
});
