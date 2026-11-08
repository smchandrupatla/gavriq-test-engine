// Sand Bench Aurora — Test runs screen, live-stack coverage.
// Shares the 97-block Aurora reserves in sit/lib/catalog.mjs (/^97[a-z]?-/ -> app
// "web-aurora"), same pattern as 97-aurora-test-cases.sit.ts, 97b-aurora-test-suites.sit.ts
// and 97c-aurora-rule-bench.sit.ts. If apps/web-aurora is ever deleted, delete this file with it.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson, correlationId } from "../lib/client.ts";
import { waitForHealth } from "../lib/wait.mjs";

const REQUEST_TIMEOUT_MS = 5000;

type Dataset = { id: string; name: string; etag: string; message_type_code?: string };
type TestCase = { id: string; name: string; etag: string; dataset_id?: string };
type TestSuite = { id: string; name: string; etag: string };
type RunOutcome = {
  runId: string;
  caseId: string;
  suiteId?: string;
  status: "completed" | "failed" | "blocked";
  result: "pass" | "fail" | "blocked";
  reason?: string;
  totals: { generated: number; sent: number; simulated?: number; blocked: number; failed: number };
};
type RunRow = {
  id: string;
  name?: string;
  notes?: string;
  etag: string;
  status: string;
  environment?: string;
  suite_id?: string;
  case_id?: string;
};

before(async () => {
  await waitForHealth(`${ENV.auroraBase}/index.html`, { label: "Sand Bench Aurora", timeoutMs: 60000 });
});

async function fetchAurora(path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${ENV.auroraBase}${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  return { status: res.status, body: await res.text() };
}

// apiJson (sit/lib/client.ts) never rejects on a non-2xx response -- it always resolves
// {status, body} -- so a bare ".catch(() => {})" around a cleanup delete only ever guards a
// transport failure, never a real 409/412 response. That silently discarded exactly the
// failure this test most needs to see: an assertion that threw right after a write changed an
// entity's etag would leave the finally-block cleanup 412ing with nothing logged, and the
// dataset/case/suite/run genuinely orphaned in the live database. This logs instead (the sit
// console still shows the test as passed/failed on its real assertions; cleanup is best-effort
// but must never be silent about failing).
async function cleanupDelete(path: string, ifMatch: string, label: string): Promise<void> {
  try {
    const res = await apiJson(path, { method: "DELETE", headers: { "if-match": ifMatch } });
    if (res.status !== 200 && res.status !== 404) {
      console.error(`sit cleanup: could not delete ${label} (${path}): HTTP ${res.status} ${JSON.stringify(res.body)}`);
    }
  } catch (error) {
    console.error(`sit cleanup: delete ${label} (${path}) threw: ${(error as Error).message}`);
  }
}

// Reuses the same "runnable dataset + linked test case" shape 97-aurora-test-cases.sit.ts's
// sibling suite-bundle case and the backend's own testExecution.ts expect: a dataset with a
// real messageTypeCode (ENV.messageTypeCode, the repo's standard runnable default -- see
// sit/lib/env.ts), and a case whose datasetId points at it, so POST /test-cases/:id/run
// resolves a real message type instead of coming back "blocked" for lack of one.
async function createRunnableCase(tag: string): Promise<{ dataset: Dataset; testCase: TestCase }> {
  const dataset = await apiJson<Dataset>("/api/v1/datasets", {
    method: "POST",
    body: JSON.stringify({ name: correlationId(`sit-aurora-run-ds-${tag}`), messageTypeCode: ENV.messageTypeCode }),
  });
  assert.equal(dataset.status, 200, `dataset create failed: ${JSON.stringify(dataset.body)}`);
  const testCase = await apiJson<TestCase>("/api/v1/test-cases", {
    method: "POST",
    body: JSON.stringify({ name: correlationId(`sit-aurora-run-case-${tag}`), datasetId: dataset.body.id }),
  });
  assert.equal(testCase.status, 200, `case create failed: ${JSON.stringify(testCase.body)}`);
  return { dataset: dataset.body, testCase: testCase.body };
}

test("the Aurora test-runs screen is served and wires the real runs API", async () => {
  const page = await fetchAurora("/test-runs.html");
  assert.equal(page.status, 200, "Aurora did not serve /test-runs.html");
  assert.match(page.body, /id="au-table"/);
  assert.match(page.body, /id="au-create-form"/);
  assert.match(page.body, /\/api\/v1\/runs/);
  assert.match(page.body, /\/api\/v1\/test-cases\/" \+ encodeURIComponent\(caseId\) \+ "\/run"/);
});

test(
  "triggering a real test case persists a non-blocked run; it is listed, narrowed by the just-fixed suiteId/environment filters, renamed, and deleted -- all with real If-Match enforcement",
  async () => {
    const tag = `${Date.now()}`;
    const { dataset, testCase } = await createRunnableCase(tag);
    // A second, independent runnable case: its run deliberately has a DIFFERENT environment
    // and is never attributed to the suite below, so the environment/suiteId "narrows"
    // assertions further down have a real non-matching sibling row to prove excluded -- not
    // just the one row they created (a filter that is silently a no-op would otherwise pass
    // trivially, since it would still return that single row).
    const { dataset: siblingDataset, testCase: siblingCase } = await createRunnableCase(`${tag}-sibling`);
    const suite = await apiJson<TestSuite>("/api/v1/test-suites", {
      method: "POST",
      body: JSON.stringify({ name: correlationId(`sit-aurora-run-suite-${tag}`), caseIds: [testCase.id] }),
    });
    assert.equal(suite.status, 200, `suite create failed: ${JSON.stringify(suite.body)}`);
    const environment = correlationId("sit-aurora-run-env");
    const siblingEnvironment = correlationId("sit-aurora-run-env-sibling");

    let runId = "";
    let runDeleted = false;
    let suiteEtag = suite.body.etag;
    let caseEtag = testCase.etag;
    let datasetEtag = dataset.etag;
    let runEtag = "";
    let siblingRunId = "";
    const siblingCaseEtag = siblingCase.etag;
    const siblingDatasetEtag = siblingDataset.etag;

    try {
      const siblingTriggered = await apiJson<{ accepted: boolean; run: RunOutcome }>(`/api/v1/test-cases/${siblingCase.id}/run`, {
        method: "POST",
        body: JSON.stringify({ environment: siblingEnvironment, count: 1 }),
      });
      assert.equal(siblingTriggered.status, 200, `sibling trigger failed: ${JSON.stringify(siblingTriggered.body)}`);
      assert.notEqual(siblingTriggered.body.run.status, "blocked", `sibling run unexpectedly blocked: ${siblingTriggered.body.run.reason}`);
      siblingRunId = siblingTriggered.body.run.runId;

      // suiteId is accepted by POST /api/v1/test-cases/:id/run (registerOrchestrationDesk.ts)
      // even though the Aurora create-run form deliberately never sends it -- this sit case
      // calls the real API directly so the suiteId list filter has something real to narrow by.
      const triggered = await apiJson<{ accepted: boolean; run: RunOutcome }>(`/api/v1/test-cases/${testCase.id}/run`, {
        method: "POST",
        body: JSON.stringify({ environment, suiteId: suite.body.id, count: 2 }),
      });
      assert.equal(triggered.status, 200, `trigger failed: ${JSON.stringify(triggered.body)}`);
      const run = triggered.body.run;
      assert.ok(run, "trigger response had no run outcome");
      // A dataset wired to a real, registered message type must not come back blocked --
      // if it ever does, run.reason carries the real cause so this fails with a useful message
      // rather than a bare status mismatch.
      assert.notEqual(run.status, "blocked", `expected a non-blocked run, got blocked: ${run.reason}`);
      assert.ok(["completed", "failed"].includes(run.status), `unexpected run status: ${run.status}`);
      assert.ok(run.runId, "trigger response had no runId");
      assert.equal(run.caseId, testCase.id);
      assert.ok(run.totals.generated > 0, "a non-blocked run must have generated at least one message");
      runId = run.runId;

      // GET /api/v1/runs/:id (registerSpecGaps.ts) answers the bare row, not {data: row} --
      // unlike the list endpoint ({data: [...]}) and PATCH ({data: updatedRow}) -- needed here
      // only to read back the real etag the trigger response does not carry.
      const fetchedAfterTrigger = await apiJson<RunRow>(`/api/v1/runs/${runId}`);
      assert.equal(fetchedAfterTrigger.status, 200, "could not read back the run that was just triggered");
      runEtag = fetchedAfterTrigger.body.etag;
      assert.ok(runEtag, "triggered run has no etag");

      const list = await apiJson<{ data: RunRow[] }>("/api/v1/runs");
      assert.equal(list.status, 200);
      assert.ok(list.body.data.some((row) => row.id === runId), "the new run is missing from the list screen's own endpoint");

      // Keyset pagination (listPagination.ts), the contract the screen's "Load 100 more from
      // server" button relies on: with the two runs this test just created in the tenant,
      // limit=1 must answer a nextCursor, and sending it back must advance past the first page
      // on a real Postgres (the cursor's timestamp has to parse as timestamptz there).
      const firstPage = await apiJson<{ data: RunRow[]; nextCursor: string | null }>("/api/v1/runs?limit=1");
      assert.equal(firstPage.status, 200);
      assert.equal(firstPage.body.data.length, 1, "limit=1 must answer exactly one row");
      const cursor = firstPage.body.nextCursor;
      assert.ok(typeof cursor === "string" && cursor.length > 0, "more than one run exists for this tenant, so limit=1 must answer a nextCursor string");
      const secondPage = await apiJson<{ data: RunRow[]; nextCursor: string | null }>(`/api/v1/runs?limit=1&cursor=${encodeURIComponent(cursor)}`);
      assert.equal(secondPage.status, 200, `the cursor page failed: ${JSON.stringify(secondPage.body)}`);
      assert.ok(secondPage.body.data.length > 0, "the cursor page must answer rows while runs remain beyond the first page");
      const firstPageIds = new Set(firstPage.body.data.map((row) => row.id));
      assert.ok(
        secondPage.body.data.every((row) => !firstPageIds.has(row.id)),
        "the cursor page repeated a row from the first page -- the keyset predicate is not advancing"
      );

      // The live proof of the suiteId/environment fix (runListStore.ts's listRunsFiltered):
      // before the fix these two params were accepted and silently ignored, so every row
      // would have come back regardless of filter.
      const byEnvironment = await apiJson<{ data: RunRow[] }>(`/api/v1/runs?environment=${encodeURIComponent(environment)}`);
      assert.equal(byEnvironment.status, 200);
      assert.ok(byEnvironment.body.data.some((row) => row.id === runId), "environment filter dropped the run it should have matched");
      assert.ok(
        byEnvironment.body.data.every((row) => row.environment === environment),
        "environment filter let through a row with a different environment -- not a real SQL predicate"
      );
      // The real exclusion proof: a completely no-op environment filter (the pre-fix behaviour)
      // would return the sibling run too, since it is a real row in this tenant with a
      // different environment -- the .every() check above alone can't catch that because it
      // was the only row ever created before this sibling existed.
      assert.ok(
        !byEnvironment.body.data.some((row) => row.id === siblingRunId),
        "environment filter let through the sibling run, which has a different environment -- the filter excludes nothing"
      );

      const bySuite = await apiJson<{ data: RunRow[] }>(`/api/v1/runs?suiteId=${encodeURIComponent(suite.body.id)}`);
      assert.equal(bySuite.status, 200);
      assert.ok(bySuite.body.data.some((row) => row.id === runId), "suiteId filter dropped the run it should have matched");
      assert.ok(
        bySuite.body.data.every((row) => row.suite_id === suite.body.id),
        "suiteId filter let through a row attributed to a different suite -- not a real SQL predicate"
      );
      assert.ok(
        !bySuite.body.data.some((row) => row.id === siblingRunId),
        "suiteId filter let through the sibling run, which is not attributed to this suite -- the filter excludes nothing"
      );

      // Real, server-paginated deliveries for a non-blocked run (runDeliveries.ts).
      const deliveries = await apiJson<{ data: unknown[]; pagination: { hasNextPage: boolean; nextCursor: string | null } }>(
        `/api/v1/runs/${runId}/deliveries`
      );
      assert.equal(deliveries.status, 200, `deliveries fetch failed: ${JSON.stringify(deliveries.body)}`);
      assert.ok(deliveries.body.data.length > 0, "a non-blocked run must have at least one real delivery row");
      assert.equal(typeof deliveries.body.pagination.hasNextPage, "boolean", "expected the real pagination envelope, not a guessed shape");

      // Rename (PATCH, If-Match always required).
      const renamed = correlationId("sit-aurora-run-renamed");
      const updated = await apiJson<{ data: RunRow }>(`/api/v1/runs/${runId}`, {
        method: "PATCH",
        headers: { "if-match": runEtag },
        body: JSON.stringify({ name: renamed, notes: "sit note" }),
      });
      assert.equal(updated.status, 200, `rename failed: ${JSON.stringify(updated.body)}`);
      assert.equal(updated.body.data.name, renamed, "rename did not persist");
      runEtag = updated.body.data.etag;

      // Stale If-Match is rejected with 412 on both write routes (opsStore.ts) -- and, unlike a
      // bare status check, each is followed by a real re-GET to prove the row's name/existence
      // is actually unchanged. A non-atomic check-then-act bug (412 returned but the write or
      // delete still committed) would answer 412 here too; only the re-GET catches it.
      const stalePatch = await apiJson(`/api/v1/runs/${runId}`, {
        method: "PATCH",
        headers: { "if-match": "not-the-real-etag" },
        body: JSON.stringify({ name: "should not apply" }),
      });
      assert.equal(stalePatch.status, 412, "a stale If-Match on PATCH should be rejected, not silently applied");
      const afterStalePatch = await apiJson<RunRow>(`/api/v1/runs/${runId}`);
      assert.equal(afterStalePatch.status, 200, "the run must still exist after a rejected stale PATCH");
      assert.equal(afterStalePatch.body.name, renamed, "a stale If-Match PATCH must not have changed the row's name despite returning 412");
      assert.equal(afterStalePatch.body.etag, runEtag, "a stale If-Match PATCH must not have rotated the row's etag");

      const staleDelete = await apiJson(`/api/v1/runs/${runId}`, { method: "DELETE", headers: { "if-match": "not-the-real-etag" } });
      assert.equal(staleDelete.status, 412, "a stale If-Match on DELETE should be rejected, not silently applied");
      const afterStaleDelete = await apiJson<RunRow>(`/api/v1/runs/${runId}`);
      assert.equal(afterStaleDelete.status, 200, "the run must still exist after a rejected stale DELETE");
      assert.equal(afterStaleDelete.body.etag, runEtag, "a stale If-Match DELETE must not have rotated the row's etag");

      // Real delete with the current etag, then confirm it is actually gone.
      const deleted = await apiJson<{ deleted: boolean; id: string }>(`/api/v1/runs/${runId}`, {
        method: "DELETE",
        headers: { "if-match": runEtag },
      });
      assert.equal(deleted.status, 200, `delete failed: ${JSON.stringify(deleted.body)}`);
      assert.equal(deleted.body.deleted, true);

      const afterDelete = await apiJson(`/api/v1/runs/${runId}`);
      assert.equal(afterDelete.status, 404, "run is still readable after delete -- not a real delete");
      runDeleted = true; // the finally block below must not try to delete it again
    } finally {
      if (runId && !runDeleted) await cleanupDelete(`/api/v1/runs/${runId}`, runEtag, `run ${runId}`);
      if (siblingRunId) {
        const fetchedSibling = await apiJson<RunRow>(`/api/v1/runs/${siblingRunId}`).catch(() => null);
        if (fetchedSibling && fetchedSibling.status === 200) {
          await cleanupDelete(`/api/v1/runs/${siblingRunId}`, fetchedSibling.body.etag, `sibling run ${siblingRunId}`);
        }
      }
      await cleanupDelete(`/api/v1/test-suites/${suite.body.id}`, suiteEtag, `suite ${suite.body.id}`);
      await cleanupDelete(`/api/v1/test-cases/${testCase.id}`, caseEtag, `case ${testCase.id}`);
      await cleanupDelete(`/api/v1/test-cases/${siblingCase.id}`, siblingCaseEtag, `sibling case ${siblingCase.id}`);
      await cleanupDelete(`/api/v1/datasets/${dataset.id}`, datasetEtag, `dataset ${dataset.id}`);
      await cleanupDelete(`/api/v1/datasets/${siblingDataset.id}`, siblingDatasetEtag, `sibling dataset ${siblingDataset.id}`);
    }
  }
);

test("a case with no linked dataset is a real, correctly-persisted blocked run, not an error", async () => {
  const testCase = await apiJson<TestCase>("/api/v1/test-cases", {
    method: "POST",
    body: JSON.stringify({ name: correlationId("sit-aurora-run-no-dataset") }),
  });
  assert.equal(testCase.status, 200);
  let caseEtag = testCase.body.etag;
  let runId = "";
  try {
    const triggered = await apiJson<{ accepted: boolean; run: RunOutcome }>(`/api/v1/test-cases/${testCase.body.id}/run`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(triggered.status, 200, `trigger failed: ${JSON.stringify(triggered.body)}`);
    const run = triggered.body.run;
    assert.equal(run.status, "blocked", "a case with no linked dataset must be blocked, not completed/failed");
    assert.equal(run.result, "blocked");
    assert.ok(run.reason && run.reason.length > 0, "a blocked run must carry a human-readable reason");
    runId = run.runId;

    // A blocked run is still a real, persisted row -- it must show up in the list like any other.
    const list = await apiJson<{ data: RunRow[] }>("/api/v1/runs");
    assert.ok(list.body.data.some((row) => row.id === runId), "a blocked run is missing from the run list");
  } finally {
    if (runId) {
      const fetched = await apiJson<RunRow>(`/api/v1/runs/${runId}`).catch(() => null);
      if (fetched && fetched.status === 200) await cleanupDelete(`/api/v1/runs/${runId}`, fetched.body.etag, `run ${runId}`);
    }
    await cleanupDelete(`/api/v1/test-cases/${testCase.body.id}`, caseEtag, `case ${testCase.body.id}`);
  }
});
