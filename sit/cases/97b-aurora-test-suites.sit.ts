// Sand Bench Aurora — test-suites screen, live-stack coverage.
// Shares the 97-block Aurora reserves in sit/lib/catalog.mjs (/^97[a-z]?-/ -> app
// "web-aurora"), same pattern as the repo's existing 74b-/75c- lettered splits. If
// apps/web-aurora is ever deleted, delete this file with it.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson, correlationId } from "../lib/client.ts";
import { waitForHealth } from "../lib/wait.mjs";

const REQUEST_TIMEOUT_MS = 5000;

type TestSuite = { id: string; name: string; etag: string; case_ids?: string[] };
type TestCase = { id: string; name: string; etag: string };

before(async () => {
  await waitForHealth(`${ENV.auroraBase}/index.html`, { label: "Sand Bench Aurora", timeoutMs: 60000 });
});

async function fetchAurora(path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${ENV.auroraBase}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  return { status: res.status, body: await res.text() };
}

test("the Aurora test-suites screen is served and wires the real test-suites API", async () => {
  const page = await fetchAurora("/test-suites.html");
  assert.equal(page.status, 200, "Aurora did not serve /test-suites.html");
  assert.match(page.body, /id="au-table"/);
  assert.match(page.body, /id="au-create-form"/);
  assert.match(page.body, /\/api\/v1\/test-suites/);
});

test("creating a suite with real case IDs, renaming it, re-bundling it and deleting it round-trips through the real database", async () => {
  const caseA = await apiJson<TestCase>("/api/v1/test-cases", { method: "POST", body: JSON.stringify({ name: correlationId("sit-aurora-suite-case-a") }) });
  const caseB = await apiJson<TestCase>("/api/v1/test-cases", { method: "POST", body: JSON.stringify({ name: correlationId("sit-aurora-suite-case-b") }) });
  assert.equal(caseA.status, 200);
  assert.equal(caseB.status, 200);
  let caseAEtag = caseA.body.etag;
  let caseBEtag = caseB.body.etag;

  const suiteName = correlationId("sit-aurora-suite");
  const created = await apiJson<TestSuite>("/api/v1/test-suites", {
    method: "POST",
    body: JSON.stringify({ name: suiteName, caseIds: [caseA.body.id] }),
  });
  assert.equal(created.status, 200, `create failed: ${JSON.stringify(created.body)}`);
  assert.ok(created.body.id, "create response had no id");
  const suiteId = created.body.id;
  let currentEtag = created.body.etag;

  try {
    const fetched = await apiJson<{ data: TestSuite }>(`/api/v1/test-suites/${suiteId}`);
    assert.equal(fetched.status, 200, "could not read back the suite that was just created");
    assert.equal(fetched.body.data.name, suiteName);
    assert.deepEqual(fetched.body.data.case_ids, [caseA.body.id], "the case bundle written at create time did not persist");

    const list = await apiJson<{ data: TestSuite[] }>("/api/v1/test-suites");
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((row) => row.id === suiteId), "the new suite is missing from the list screen's own endpoint");

    const renamed = correlationId("sit-aurora-suite-renamed");
    const updated = await apiJson<{ data: TestSuite }>(`/api/v1/test-suites/${suiteId}`, {
      method: "PUT",
      headers: { "if-match": currentEtag },
      body: JSON.stringify({ name: renamed, caseIds: [caseA.body.id, caseB.body.id] }),
    });
    assert.equal(updated.status, 200, `update failed: ${JSON.stringify(updated.body)}`);
    currentEtag = updated.body.data.etag;
    assert.equal(updated.body.data.name, renamed, "rename did not persist");
    assert.deepEqual(
      [...updated.body.data.case_ids ?? []].sort(),
      [caseA.body.id, caseB.body.id].sort(),
      "re-bundled case list did not persist"
    );

    const deleted = await apiJson<{ deleted: boolean; id: string }>(`/api/v1/test-suites/${suiteId}`, {
      method: "DELETE",
      headers: { "if-match": currentEtag },
    });
    assert.equal(deleted.status, 200, `delete failed: ${JSON.stringify(deleted.body)}`);
    assert.equal(deleted.body.deleted, true);

    const afterDelete = await apiJson(`/api/v1/test-suites/${suiteId}`);
    assert.equal(afterDelete.status, 404, "suite is still readable after delete — not a real delete");
  } finally {
    await apiJson(`/api/v1/test-suites/${suiteId}`, { method: "DELETE", headers: { "if-match": currentEtag } }).catch(() => {});
    await apiJson(`/api/v1/test-cases/${caseA.body.id}`, { method: "DELETE", headers: { "if-match": caseAEtag } }).catch(() => {});
    await apiJson(`/api/v1/test-cases/${caseB.body.id}`, { method: "DELETE", headers: { "if-match": caseBEtag } }).catch(() => {});
  }
});

test("deleting a bundled test case removes it from the suite, instead of leaving a dangling reference", async () => {
  const kept = await apiJson<TestCase>("/api/v1/test-cases", { method: "POST", body: JSON.stringify({ name: correlationId("sit-aurora-suite-kept") }) });
  const removed = await apiJson<TestCase>("/api/v1/test-cases", { method: "POST", body: JSON.stringify({ name: correlationId("sit-aurora-suite-removed") }) });
  assert.equal(kept.status, 200);
  assert.equal(removed.status, 200);

  const suite = await apiJson<TestSuite>("/api/v1/test-suites", {
    method: "POST",
    body: JSON.stringify({ name: correlationId("sit-aurora-suite-dangling-check"), caseIds: [kept.body.id, removed.body.id] }),
  });
  assert.equal(suite.status, 200);
  const suiteId = suite.body.id;

  try {
    const deletedCase = await apiJson<{ deleted: boolean }>(`/api/v1/test-cases/${removed.body.id}`, {
      method: "DELETE",
      headers: { "if-match": removed.body.etag },
    });
    assert.equal(deletedCase.status, 200, `deleting the bundled case failed: ${JSON.stringify(deletedCase.body)}`);

    const fetched = await apiJson<{ data: TestSuite }>(`/api/v1/test-suites/${suiteId}`);
    assert.equal(fetched.status, 200);
    assert.deepEqual(fetched.body.data.case_ids, [kept.body.id], "the deleted case must be dropped from the suite's bundle, and the still-live case must stay");
  } finally {
    const current = await apiJson<{ data: TestSuite }>(`/api/v1/test-suites/${suiteId}`);
    await apiJson(`/api/v1/test-suites/${suiteId}`, { method: "DELETE", headers: { "if-match": current.body.data.etag } }).catch(() => {});
    await apiJson(`/api/v1/test-cases/${kept.body.id}`, { method: "DELETE", headers: { "if-match": kept.body.etag } }).catch(() => {});
  }
});

test("a stale If-Match on a suite update is rejected (concurrent-edit safety the screen's inline editor relies on)", async () => {
  const created = await apiJson<TestSuite>("/api/v1/test-suites", { method: "POST", body: JSON.stringify({ name: correlationId("sit-aurora-suite-conflict") }) });
  assert.equal(created.status, 200);
  const suiteId = created.body.id;
  try {
    const conflict = await apiJson(`/api/v1/test-suites/${suiteId}`, {
      method: "PUT",
      headers: { "if-match": "not-the-real-etag" },
      body: JSON.stringify({ name: "should not apply" }),
    });
    assert.equal(conflict.status, 412, "a stale If-Match should be rejected with 412, not silently applied");
  } finally {
    await apiJson(`/api/v1/test-suites/${suiteId}`, { method: "DELETE", headers: { "if-match": created.body.etag } }).catch(() => {});
  }
});
