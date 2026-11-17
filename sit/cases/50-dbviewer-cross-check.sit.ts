import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson, correlationId, dbviewerJson, pollUntil, withTestRunCleanup } from "../lib/client.ts";

type DbRows<T> = { total: number; columns: string[]; data: T[] };

// Independently confirms — through the read-only db viewer, not the application's own
// API — that a run the application reports as "completed" actually persisted a row.
// This is the cross-check that catches an app that reports success while silently
// failing to write its own audit trail.
test("a completed run is independently visible through the db viewer", async () => {
  const seed = correlationId("sit-dbviewer");
  const run = await apiJson<{ runId: string; status: string }>("/api/v1/runs", {
    method: "POST",
    body: JSON.stringify({ messageTypeCode: ENV.messageTypeCode, count: 1, channel: "file", seed }),
  });
  await withTestRunCleanup(run.body.runId, async () => {
  assert.equal(run.status, 202);
  assert.equal(run.body.status, "completed");

  // The viewer pages oldest-first, 100 rows at most, so a run created a moment ago is on
  // the LAST page. Reading only page 1 stopped finding new runs as soon as the table
  // outgrew one page -- the row was there, the case was looking in the wrong place.
  const newestRows = async () => {
    const first = await dbviewerJson<DbRows<{ id: string; status: string }>>(`/api/rows?table=test_runs&page_size=100`);
    const lastPage = Math.max(1, Math.ceil((first.body.total || 0) / 100));
    return lastPage === 1
      ? first
      : dbviewerJson<DbRows<{ id: string; status: string }>>(`/api/rows?table=test_runs&page_size=100&page=${lastPage}`);
  };
  const rows = await pollUntil(
    newestRows,
    (result) => result.body.data?.some((row) => row.id === run.body.runId),
    { timeoutMs: 6000 }
  );
  const persisted = rows.body.data?.find((row) => row.id === run.body.runId);
  assert.ok(persisted, `run ${run.body.runId} was reported completed but never appears in test_runs`);
  assert.equal(persisted?.status, "completed");
  });
});

test("audit events for the SIT session are independently visible through the db viewer", async () => {
  const rows = await dbviewerJson<DbRows<{ action: string }>>("/api/rows?table=audit_events&page_size=100");
  assert.equal(rows.status, 200);
  assert.ok(
    rows.body.data.some((row) => row.action === "session.login"),
    "no session.login audit row found — the application's own audit trail is not being written"
  );
});
