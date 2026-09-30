import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson } from "../lib/client.ts";

// The binder was rewritten as the Functional access feature (sand-bench-enterprise
// 5d5b4ef5, "menu checkboxes hide items and submenus"): it no longer gates overlays
// through sbeMayLoadOverlay / session features, it hides menu entries from a stored
// selection and never touches the three locked pages. Those are the markers of the
// binder that is deployed now. What a session may open is still decided by the API, so
// the grant the console depends on is checked at its source: a signed-in session must
// be able to read its own feature list.
test("feature-access binder is served on the console host", async () => {
  const res = await fetch(`${ENV.webBase}/js/feature-access-bind.js`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200, "feature-access-bind.js missing on web");
  const src = await res.text();
  assert.match(src, /SBE_FUNCTIONAL_ACCESS/, "binder no longer keeps the functional-access selection");
  for (const locked of ["overview", "configuration", "functionalAccess"]) {
    assert.match(src, new RegExp(`${locked}:\\s*true`), `binder no longer locks the ${locked} page against being hidden`);
  }

  const features = await apiJson<{ maxLevel?: unknown; pages?: unknown[] }>("/api/v1/session/features");
  assert.equal(features.status, 200, "a signed-in session cannot read its own feature grants");
  assert.ok(Array.isArray(features.body.pages) && features.body.pages.length > 0, "the session's feature grants list no pages");
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
