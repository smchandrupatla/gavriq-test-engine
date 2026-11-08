// Sand Bench Aurora — test-cases screen, live-stack coverage.
// Own numeric range (97-), own Test Engine app ("web-aurora" in sit/lib/catalog.mjs),
// kept separate from the existing console's 60-76 GUI/e2e cases. If apps/web-aurora is
// ever deleted, delete this file with it.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson, correlationId } from "../lib/client.ts";
import { waitForHealth } from "../lib/wait.mjs";

const REQUEST_TIMEOUT_MS = 5000;

type TestCase = { id: string; name: string; etag: string; priority?: string; status?: string };

// Aurora is its own docker-compose service and is not in sit/lib/env.ts's shared
// SERVICES list (that list gates every SIT case, including the existing console's, on
// every entry being healthy -- adding Aurora there would fail the whole suite on any
// deployment that was configured, via the ADC tool, to ship without it). Waiting here
// instead keeps that startup race scoped to Aurora's own cases only.
before(async () => {
  await waitForHealth(`${ENV.auroraBase}/index.html`, { label: "Sand Bench Aurora", timeoutMs: 60000 });
});

async function fetchAurora(path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${ENV.auroraBase}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  return { status: res.status, body: await res.text() };
}

// Every other test in this file goes through sit/lib/client.ts's apiJson(), which talks
// directly to ENV.apiBase with a Bearer token -- it never exercises Aurora's own nginx
// /api/ proxy_pass, nor the HttpOnly cookie + x-sbe-csrf contract a real signed-in browser
// actually uses. A defect specific to that proxy or to the cookie surviving it would stay
// invisible to every other assertion here, so this one goes through Aurora's own origin
// with a real cookie jar and a real Origin header, the same way the screen's own fetch
// calls (aurora-auth.js) do -- an earlier version of this helper omitted Origin, which is
// exactly how it missed the nginx `Host $host` bug (strips the port, so Origin and Host
// disagree and apps/api/src/modules/sessionCookie.ts's csrfProblem() refuses every write)
// that the penetration-tester agent later found and fixed in this same PR.
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

test("the Aurora test-cases screen is served and wires the real test-cases API", async () => {
  const page = await fetchAurora("/test-cases.html");
  assert.equal(page.status, 200, "Aurora did not serve /test-cases.html");
  assert.match(page.body, /id="au-table"/, "expected the test-cases table to be in the served markup");
  assert.match(page.body, /id="au-create-form"/, "expected the create-test-case form to be in the served markup");
  assert.match(page.body, /\/api\/v1\/test-cases/, "expected the screen to call the real test-cases API, not a mock");
});

test("creating, updating and deleting a test case through the API round-trips through the real database", async () => {
  const name = correlationId("sit-aurora-tc");

  const created = await apiJson<TestCase>("/api/v1/test-cases", {
    method: "POST",
    body: JSON.stringify({ name, priority: "High", owner: "sit-aurora", environment: "sit" }),
  });
  assert.equal(created.status, 200, `create failed: ${JSON.stringify(created.body)}`);
  assert.ok(created.body.id, "create response had no id");
  const id = created.body.id;
  // Tracks whichever etag is currently valid on the server, so cleanup always presents
  // the right If-Match even if an assertion throws partway through -- a stale etag from
  // the original create would otherwise make the cleanup delete itself fail with 412
  // and silently orphan the row (swallowed below), rather than actually removing it.
  let currentEtag = created.body.etag;

  try {
    const fetched = await apiJson<{ data: TestCase & { priority: string; status: string } }>(`/api/v1/test-cases/${id}`);
    assert.equal(fetched.status, 200, "could not read back the test case that was just created");
    assert.equal(fetched.body.data.name, name, "the row read back does not match what was written — not hitting the real database");
    assert.equal(fetched.body.data.priority, "High");

    const list = await apiJson<{ data: TestCase[] }>("/api/v1/test-cases");
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((row) => row.id === id), "the new test case is missing from the list screen's own endpoint");

    const updated = await apiJson<{ data: TestCase & { status: string } }>(`/api/v1/test-cases/${id}`, {
      method: "PUT",
      headers: { "if-match": currentEtag },
      body: JSON.stringify({ status: "archived" }),
    });
    assert.equal(updated.status, 200, `update failed: ${JSON.stringify(updated.body)}`);
    currentEtag = updated.body.data.etag;
    assert.equal(updated.body.data.status, "archived", "status update did not persist");
    assert.notEqual(currentEtag, created.body.etag, "etag must change on update (optimistic concurrency)");

    const deleted = await apiJson<{ deleted: boolean; id: string }>(`/api/v1/test-cases/${id}`, {
      method: "DELETE",
      headers: { "if-match": currentEtag },
    });
    assert.equal(deleted.status, 200, `delete failed: ${JSON.stringify(deleted.body)}`);
    assert.equal(deleted.body.deleted, true);

    const afterDelete = await apiJson(`/api/v1/test-cases/${id}`);
    assert.equal(afterDelete.status, 404, "test case is still readable after delete — not a real delete");
  } finally {
    // Best-effort cleanup if an assertion above threw before the delete step ran, using
    // whichever etag is currently known to be valid.
    await apiJson(`/api/v1/test-cases/${id}`, { method: "DELETE", headers: { "if-match": currentEtag } }).catch(() => {});
  }
});

test("a real browser cookie session, through Aurora's own nginx /api/ proxy, can create and delete a test case", async () => {
  const session = await auroraCookieSession();
  const name = correlationId("sit-aurora-tc-cookie");

  const createRes = await session("/api/v1/test-cases", { method: "POST", body: JSON.stringify({ name }) });
  const created = (await createRes.json()) as TestCase;
  assert.equal(createRes.status, 200, `cookie-session create failed: ${JSON.stringify(created)}`);
  assert.ok(created.id, "cookie-session create response had no id");

  const listRes = await session("/api/v1/test-cases");
  const list = (await listRes.json()) as { data: TestCase[] };
  assert.equal(listRes.status, 200);
  assert.ok(list.data.some((row) => row.id === created.id), "the cookie-session-created case is missing from the cookie-session list call");

  const deleteRes = await session(`/api/v1/test-cases/${created.id}`, { method: "DELETE", headers: { "if-match": created.etag } });
  const deleted = (await deleteRes.json()) as { deleted: boolean };
  assert.equal(deleteRes.status, 200, `cookie-session delete failed: ${JSON.stringify(deleted)}`);
  assert.equal(deleted.deleted, true);
});

test("a stale If-Match is rejected (concurrent-edit safety the screen's inline editors rely on)", async () => {
  const name = correlationId("sit-aurora-tc-conflict");
  const created = await apiJson<TestCase>("/api/v1/test-cases", { method: "POST", body: JSON.stringify({ name }) });
  assert.equal(created.status, 200);
  const id = created.body.id;
  try {
    const conflict = await apiJson(`/api/v1/test-cases/${id}`, {
      method: "PUT",
      headers: { "if-match": "not-the-real-etag" },
      body: JSON.stringify({ status: "archived" }),
    });
    assert.equal(conflict.status, 412, "a stale If-Match should be rejected with 412, not silently applied");
  } finally {
    await apiJson(`/api/v1/test-cases/${id}`, { method: "DELETE", headers: { "if-match": created.body.etag } }).catch(() => {});
  }
});
