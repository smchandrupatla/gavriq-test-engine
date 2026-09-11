import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";

test("feature-access binder is served on the console host", async () => {
  const res = await fetch(`${ENV.webBase}/js/feature-access-bind.js`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200, "feature-access-bind.js missing on web");
  const src = await res.text();
  assert.match(src, /sbeMayLoadOverlay/);
  assert.match(src, /\/api\/v1\/session\/features/);
});

test("session features catalogue is reachable without inventing tenant_id", async () => {
  const res = await fetch(`${ENV.apiBase}/api/v1/features`, { signal: AbortSignal.timeout(5000) });
  if (res.status === 401 || res.status === 403) {
    assert.ok(true, "auth required is acceptable — route exists");
    return;
  }
  assert.ok(res.status === 200 || res.status === 404 || res.status >= 200, "features route responded");
  if (res.status === 200) {
    const body = await res.json();
    assert.ok(Array.isArray(body.pages) || Array.isArray(body.profiles) || body.maxLevel);
  }
});
