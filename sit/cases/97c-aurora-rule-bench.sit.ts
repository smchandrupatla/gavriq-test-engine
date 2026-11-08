// Sand Bench Aurora — Rule Bench screen, live-stack coverage.
// Shares the 97-block Aurora reserves in sit/lib/catalog.mjs (/^97[a-z]?-/ -> app
// "web-aurora"), same pattern as 97-aurora-test-cases.sit.ts and 97b-aurora-test-suites.sit.ts.
// If apps/web-aurora is ever deleted, delete this file with it.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson, correlationId } from "../lib/client.ts";
import { waitForHealth } from "../lib/wait.mjs";

const REQUEST_TIMEOUT_MS = 5000;

type DetectionRule = {
  id: string;
  name: string;
  etag: string;
  status: string;
  category: string;
  severity: string;
};

before(async () => {
  await waitForHealth(`${ENV.auroraBase}/index.html`, { label: "Sand Bench Aurora", timeoutMs: 60000 });
});

async function fetchAurora(path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${ENV.auroraBase}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  return { status: res.status, body: await res.text() };
}

// Copied verbatim from 97-aurora-test-cases.sit.ts, not imported -- this repo's established
// pattern for sit cases is a small, self-contained file per screen, never a cross-file helper
// import. Exercises Aurora's own nginx /api/ proxy with a real HttpOnly cookie and a real
// Origin header, the same contract aurora-auth.js's own fetch calls rely on.
async function auroraCookieSession(): Promise<(path: string, init?: RequestInit) => Promise<Response>> {
  const loginRes = await fetch(`${ENV.auroraBase}/api/v1/session/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sbe-client": "browser", "x-sbe-csrf": "1", origin: ENV.auroraBase },
    body: JSON.stringify({ username: ENV.username, password: ENV.password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!loginRes.ok) throw new Error(`Aurora cookie-session login failed: ${loginRes.status} ${await loginRes.text()}`);
  const cookie = loginRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return (path: string, init: RequestInit = {}) =>
    fetch(`${ENV.auroraBase}${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-sbe-client": "browser", "x-sbe-csrf": "1", origin: ENV.auroraBase, cookie, ...(init.headers || {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
}

test("the Aurora Rule Bench screen is served and wires the real rules API", async () => {
  const page = await fetchAurora("/rule-bench.html");
  assert.equal(page.status, 200, "Aurora did not serve /rule-bench.html");
  assert.match(page.body, /id="au-table"/, "expected the rules table to be in the served markup");
  assert.match(page.body, /id="au-create-form"/, "expected the create-rule form to be in the served markup");
  assert.match(page.body, /\/api\/v1\/rules/, "expected the screen to call the real rules API, not a mock");
});

test("a rule's full lifecycle — create, read, list, stage, edit-guard, back to review, edit, delete — round-trips through the real database", async () => {
  const name = correlationId("sit-aurora-rule");

  const created = await apiJson<DetectionRule>("/api/v1/rules", {
    method: "POST",
    body: JSON.stringify({
      name,
      category: "fraud",
      severity: "high",
      condition: { kind: "amount_gte", field: "amount", value: 10000 },
    }),
  });
  assert.equal(created.status, 200, `create failed: ${JSON.stringify(created.body)}`);
  assert.ok(created.body.id, "create response had no id");
  assert.equal(created.body.status, "in_review", "a newly created rule must start in_review");
  const id = created.body.id;
  // Tracks whichever etag is currently valid on the server, so cleanup always presents the
  // right If-Match even if an assertion throws partway through — same lesson as the test-suites
  // sit case: a stale etag from an earlier step would otherwise make the final cleanup delete
  // fail with 412 and silently orphan the row (swallowed below).
  let currentEtag = created.body.etag;

  try {
    const fetched = await apiJson<{ data: DetectionRule }>(`/api/v1/rules/${id}`);
    assert.equal(fetched.status, 200, "could not read back the rule that was just created");
    assert.equal(fetched.body.data.name, name, "the row read back does not match what was written — not hitting the real database");
    assert.equal(fetched.body.data.category, "fraud");

    const list = await apiJson<{ data: DetectionRule[] }>("/api/v1/rules");
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((row) => row.id === id), "the new rule is missing from the list screen's own endpoint");

    const staged = await apiJson<DetectionRule>(`/api/v1/rules/${id}/transitions`, {
      method: "POST",
      headers: { "if-match": currentEtag },
      body: JSON.stringify({ transition: "stage", environment: "sit" }),
    });
    assert.equal(staged.status, 200, `stage transition failed: ${JSON.stringify(staged.body)}`);
    currentEtag = staged.body.etag;
    assert.equal(staged.body.status, "staged", "stage transition did not persist");

    // A staged rule is no longer in_review, so the new server-side guard must refuse a direct
    // edit with a validation error (422), not a crash and not a silent no-op success.
    const blockedEdit = await apiJson(`/api/v1/rules/${id}`, {
      method: "PUT",
      headers: { "if-match": currentEtag },
      body: JSON.stringify({ name, category: "fraud", severity: "high", condition: { kind: "amount_gte", field: "amount", value: 10000 } }),
    });
    assert.equal(blockedEdit.status, 422, `editing a staged rule should be refused with 422, got ${blockedEdit.status}: ${JSON.stringify(blockedEdit.body)}`);

    const backToReview = await apiJson<DetectionRule>(`/api/v1/rules/${id}/transitions`, {
      method: "POST",
      headers: { "if-match": currentEtag },
      body: JSON.stringify({ transition: "review" }),
    });
    assert.equal(backToReview.status, 200, `review transition failed: ${JSON.stringify(backToReview.body)}`);
    currentEtag = backToReview.body.etag;
    assert.equal(backToReview.body.status, "in_review", "review transition did not persist");

    const renamed = correlationId("sit-aurora-rule-renamed");
    const updated = await apiJson<DetectionRule>(`/api/v1/rules/${id}`, {
      method: "PUT",
      headers: { "if-match": currentEtag },
      body: JSON.stringify({ name: renamed, category: "aml", severity: "critical", condition: { kind: "field_equals", field: "status", value: "blocked" } }),
    });
    assert.equal(updated.status, 200, `edit after returning to review should succeed: ${JSON.stringify(updated.body)}`);
    currentEtag = updated.body.etag;
    assert.equal(updated.body.name, renamed, "rename did not persist");
    assert.equal(updated.body.category, "aml", "category change did not persist");
    assert.notEqual(currentEtag, staged.body.etag, "etag must change on update (optimistic concurrency)");

    const deleted = await apiJson<{ deleted: boolean; id: string }>(`/api/v1/rules/${id}`, {
      method: "DELETE",
      headers: { "if-match": currentEtag },
    });
    assert.equal(deleted.status, 200, `delete failed: ${JSON.stringify(deleted.body)}`);
    assert.equal(deleted.body.deleted, true);

    const afterDelete = await apiJson(`/api/v1/rules/${id}`);
    assert.equal(afterDelete.status, 404, "rule is still readable after delete — not a real delete");
  } finally {
    // Best-effort cleanup if an assertion above threw before the delete step ran, using
    // whichever etag is currently known to be valid.
    await apiJson(`/api/v1/rules/${id}`, { method: "DELETE", headers: { "if-match": currentEtag } }).catch(() => {});
  }
});

test("a stale If-Match on a rule update is rejected (concurrent-edit safety the screen's edit panel relies on)", async () => {
  const created = await apiJson<DetectionRule>("/api/v1/rules", {
    method: "POST",
    body: JSON.stringify({ name: correlationId("sit-aurora-rule-conflict"), category: "sanctions", severity: "medium", condition: { kind: "amount_gte", field: "amount", value: 1 } }),
  });
  assert.equal(created.status, 200);
  const id = created.body.id;
  try {
    const conflict = await apiJson(`/api/v1/rules/${id}`, {
      method: "PUT",
      headers: { "if-match": "not-the-real-etag" },
      body: JSON.stringify({ name: "should not apply", category: "sanctions", severity: "medium", condition: { kind: "amount_gte", field: "amount", value: 1 } }),
    });
    assert.equal(conflict.status, 412, "a stale If-Match should be rejected with 412, not silently applied");
  } finally {
    await apiJson(`/api/v1/rules/${id}`, { method: "DELETE", headers: { "if-match": created.body.etag } }).catch(() => {});
  }
});

test("deleting a rule without If-Match is refused — the delete route must require it like every other write on this entity", async () => {
  const created = await apiJson<DetectionRule>("/api/v1/rules", {
    method: "POST",
    body: JSON.stringify({ name: correlationId("sit-aurora-rule-no-if-match"), category: "fraud", severity: "low", condition: { kind: "amount_gte", field: "amount", value: 1 } }),
  });
  assert.equal(created.status, 200);
  const id = created.body.id;
  try {
    const noIfMatch = await apiJson(`/api/v1/rules/${id}`, { method: "DELETE" });
    assert.equal(noIfMatch.status, 412, "DELETE /api/v1/rules/:id must require If-Match, not silently delete without one");
  } finally {
    await apiJson(`/api/v1/rules/${id}`, { method: "DELETE", headers: { "if-match": created.body.etag } }).catch(() => {});
  }
});

test("a real browser cookie session, through Aurora's own nginx /api/ proxy, can create and delete a rule", async () => {
  const session = await auroraCookieSession();
  const name = correlationId("sit-aurora-rule-cookie");

  const createRes = await session("/api/v1/rules", {
    method: "POST",
    body: JSON.stringify({ name, category: "fraud", severity: "medium", condition: { kind: "amount_gte", field: "amount", value: 1 } }),
  });
  const created = (await createRes.json()) as DetectionRule;
  assert.equal(createRes.status, 200, `cookie-session create failed: ${JSON.stringify(created)}`);
  assert.ok(created.id, "cookie-session create response had no id");

  const listRes = await session("/api/v1/rules");
  const list = (await listRes.json()) as { data: DetectionRule[] };
  assert.equal(listRes.status, 200);
  assert.ok(list.data.some((row) => row.id === created.id), "the cookie-session-created rule is missing from the cookie-session list call");

  const deleteRes = await session(`/api/v1/rules/${created.id}`, { method: "DELETE", headers: { "if-match": created.etag } });
  const deleted = (await deleteRes.json()) as { deleted: boolean };
  assert.equal(deleteRes.status, 200, `cookie-session delete failed: ${JSON.stringify(deleted)}`);
  assert.equal(deleted.deleted, true);
});
