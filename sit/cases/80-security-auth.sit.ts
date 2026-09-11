import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";

const LOGIN = `${ENV.apiBase}/api/v1/session/login`;

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
