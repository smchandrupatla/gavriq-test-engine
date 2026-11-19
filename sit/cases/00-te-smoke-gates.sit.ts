// Engine-owned SIT case (not synced from Sand Bench). Backs the engine catalog's
// Smoke tests: the pre-cycle and post-deploy gates run before a full test cycle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson } from "../lib/client.ts";

const timed = () => ({ signal: AbortSignal.timeout(8000) });

function rowsOf(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  const data = (body as { data?: unknown })?.data;
  return Array.isArray(data) ? data : null;
}

test("smoke: target is reachable and reports a non-production classification", async () => {
  const res = await fetch(`${ENV.apiBase}/health`, timed());
  assert.equal(res.status, 200, "health endpoint did not answer 200");
  const body = (await res.json()) as { status?: string; classification?: string };
  assert.equal(body.status, "ok");
  assert.ok(body.classification, "health must report which classification is deployed");
  assert.notEqual(body.classification, "production", "the test bench must never point at a production classification");
});

test("smoke: rule engine answers detection-rule and field-rule reads", async () => {
  const rules = await apiJson("/api/v1/rules");
  assert.equal(rules.status, 200, "GET /api/v1/rules failed");
  assert.ok(rowsOf(rules.body), "rules response is not a list");
  const fieldRules = await apiJson("/api/v1/field-rules");
  assert.equal(fieldRules.status, 200, "GET /api/v1/field-rules failed");
  assert.ok(rowsOf(fieldRules.body), "field-rules response is not a list");
});

test("smoke: evidence export service builds a suite evidence pack", async () => {
  const cases = await apiJson<{ data?: Array<{ id: string }> }>("/api/v1/test-cases");
  assert.equal(cases.status, 200);
  const caseIds = (rowsOf(cases.body) as Array<{ id: string }> | null ?? []).slice(0, 2).map((c) => c.id);
  const created = await apiJson<{ id?: string; data?: { id: string } }>("/api/v1/test-suites", {
    method: "POST",
    body: JSON.stringify({ name: `SIT-TE evidence gate ${Date.now()}`, caseIds }),
  });
  assert.ok(created.status < 300, `suite create failed: ${created.status} ${JSON.stringify(created.body)}`);
  const suiteId = created.body.id || created.body.data?.id;
  assert.ok(suiteId, "suite create returned no id");
  try {
    const pack = await apiJson<{ kind: string; suite: { id: string }; totals: { cases: number }; cases: Array<{ id: string }> }>(
      `/api/v1/test-suites/${encodeURIComponent(suiteId!)}/evidence`
    );
    assert.equal(pack.status, 200, "evidence export failed");
    assert.equal(pack.body.kind, "sand-bench-suite-evidence");
    assert.equal(pack.body.suite.id, suiteId);
    assert.equal(pack.body.totals.cases, caseIds.length, "evidence pack case count does not match the suite");
    assert.deepEqual(pack.body.cases.map((c) => c.id).sort(), [...caseIds].sort());
  } finally {
    await apiJson(`/api/v1/test-suites/${encodeURIComponent(suiteId!)}`, { method: "DELETE" });
  }
});

test("smoke: console loads with every script and stylesheet it references", async () => {
  const res = await fetch(`${ENV.webBase}/index.html`, timed());
  assert.equal(res.status, 200, "console index.html is not served");
  const html = await res.text();
  const refs = [...html.matchAll(/<(?:script[^>]+src|link[^>]+href)="([^"#]+)"/g)]
    .map((m) => m[1]!)
    .filter((u) => !/^(https?:)?\/\//.test(u) && !u.startsWith("data:"));
  assert.ok(refs.length > 0, "console references no local assets");
  const broken: string[] = [];
  for (const ref of refs) {
    const url = new URL(ref, `${ENV.webBase}/index.html`).toString();
    const asset = await fetch(url, timed());
    if (asset.status !== 200) broken.push(`${ref} -> ${asset.status}`);
    await asset.arrayBuffer();
  }
  assert.deepEqual(broken, [], `console assets failed to load: ${broken.join(", ")}`);
});

test("smoke: auth gate rejects a wrong password and accepts the operator", async () => {
  const login = (password: string) =>
    fetch(`${ENV.apiBase}/api/v1/session/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantSlug: ENV.tenantSlug, username: ENV.username, password }),
      ...timed(),
    });
  const bad = await login(`${ENV.password}-wrong`);
  assert.ok([400, 401, 403].includes(bad.status), `wrong password answered ${bad.status}`);
  const good = await login(ENV.password);
  assert.equal(good.status, 200, "operator login failed");
  const body = (await good.json()) as { token?: string };
  assert.ok(body.token && body.token.split(".").length === 3, "login did not return a signed session token");
});
