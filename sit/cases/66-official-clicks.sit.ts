import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";

test("official-clicks binder is served on the console host", async () => {
  const res = await fetch(`${ENV.webBase}/js/official-clicks.js`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200, "official-clicks.js missing on web");
  const src = await res.text();
  assert.match(src, /overlayPrimaryClicks/);
  assert.match(src, /data-sbe-api/);
  assert.match(src, /\/api\/v1\/rules/);
  assert.match(src, /\/api\/v1\/runs/);
});

test("index.html loads official-clicks after live-bind", async () => {
  const res = await fetch(`${ENV.webBase}/index.html`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  const html = await res.text();
  const live = html.indexOf("live-bind.js");
  const clicks = html.indexOf("official-clicks.js");
  assert.ok(live >= 0 && clicks > live, "official-clicks must load after live-bind");
});
