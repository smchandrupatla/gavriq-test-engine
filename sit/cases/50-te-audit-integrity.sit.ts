// Engine-owned SIT case (not synced from Sand Bench). Backs the engine catalog's
// Non-functional and Compliance cases about the audit trail and run history.
// The db viewer reads the database directly, so these checks do not trust the
// application's own API to report what it wrote.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson, correlationId, dbviewerJson, pollUntil } from "../lib/client.ts";

type DbRows<T> = { total: number; columns: string[]; data: T[] };
type AuditRow = Record<string, unknown> & { action?: string; resource_id?: string };

async function startRun(): Promise<string> {
  const run = await apiJson<{ runId: string; status: string }>("/api/v1/runs", {
    method: "POST",
    body: JSON.stringify({ messageTypeCode: ENV.messageTypeCode, count: 1, channel: "file", seed: correlationId("te-audit") }),
  });
  assert.equal(run.status, 202, `run rejected: ${JSON.stringify(run.body)}`);
  assert.ok(run.body.runId);
  return run.body.runId;
}

async function auditRows(): Promise<DbRows<AuditRow>> {
  const res = await dbviewerJson<DbRows<AuditRow>>("/api/rows?table=audit_events&page_size=500");
  assert.equal(res.status, 200, "db viewer could not read audit_events");
  return res.body;
}

test("compliance: every audit event carries an action, an actor or system source, and a timestamp", async () => {
  const rows = await auditRows();
  assert.ok(rows.data.length > 0, "audit_events is empty");
  const timeCol = rows.columns.find((c) => /^(created_at|occurred_at|at)$/.test(c));
  const actorCol = rows.columns.find((c) => /actor/.test(c));
  assert.ok(timeCol, `audit_events has no timestamp column (${rows.columns.join(", ")})`);
  assert.ok(actorCol, `audit_events has no actor column (${rows.columns.join(", ")})`);
  const incomplete = rows.data.filter((r) => !r.action || !r[timeCol!]);
  assert.deepEqual(incomplete.slice(0, 5), [], `${incomplete.length} audit rows lack an action or timestamp`);
});

test("compliance: every re-run is recorded in the audit log", async () => {
  const ids = [await startRun(), await startRun()];
  const rows = await pollUntil(
    auditRows,
    (r) => ids.every((id) => r.data.some((row) => row.resource_id === id)),
    { timeoutMs: 8000 }
  );
  for (const id of ids) {
    const row = rows.data.find((r) => r.resource_id === id);
    assert.ok(row, `run ${id} has no audit event`);
    assert.equal(row?.action, "run.recorded");
  }
});

test("non-functional: run history cannot be rewritten through the API", async () => {
  const id = await startRun();
  const before = await apiJson<{ data?: Record<string, unknown> } & Record<string, unknown>>(`/api/v1/runs/${encodeURIComponent(id)}`);
  assert.equal(before.status, 200);
  const run = (before.body.data || before.body) as { status: string; totals?: unknown; etag?: string };
  const patch = await apiJson(`/api/v1/runs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "if-match": run.etag || "*" },
    body: JSON.stringify({ status: "failed", totals: { sent: 999 }, notes: "SIT-TE tamper attempt" }),
  });
  assert.ok(patch.status < 500, `PATCH errored: ${patch.status}`);
  const after = await apiJson<{ data?: Record<string, unknown> } & Record<string, unknown>>(`/api/v1/runs/${encodeURIComponent(id)}`);
  const now = (after.body.data || after.body) as { status: string; totals?: unknown };
  assert.equal(now.status, run.status, "run status was rewritten");
  assert.deepEqual(now.totals, run.totals, "run totals were rewritten");
});
