// Common search framework coverage. These cases exercise the deployed API contract that
// protects the application before a search reaches SQL: validation, allow-listed sorting,
// bounded page sizes, and cursor-based navigation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { apiJson } from "../lib/client.ts";

type DeliveryList = {
  data?: Array<{ seq: number; created_at: string }>;
  total?: number;
  hasNextPage?: boolean;
  nextCursor?: string | null;
};

async function sampleRunId(): Promise<string> {
  const response = await apiJson<{ data?: Array<{ id: string }> }>("/api/v1/runs?limit=1");
  assert.equal(response.status, 200, "runs list must be available for search coverage");
  const id = response.body.data?.[0]?.id;
  assert.ok(id, "a run with deliveries is required for search coverage");
  return id;
}

test("SF1 run delivery search rejects an oversized page before executing the search", async () => {
  const runId = await sampleRunId();
  const response = await apiJson(`/api/v1/runs/${encodeURIComponent(runId)}/deliveries?pageSize=101`);
  assert.equal(response.status, 422);
  assert.equal((response.body as any).error?.code, "validation_failed");
});

test("SF2 run delivery search rejects an unapproved sort field", async () => {
  const runId = await sampleRunId();
  const response = await apiJson(`/api/v1/runs/${encodeURIComponent(runId)}/deliveries?sort=request_payload:asc`);
  assert.equal(response.status, 422);
  assert.equal((response.body as any).error?.code, "validation_failed");
});

test("SF3 run delivery search returns stable sorted pages and a continuation cursor", async () => {
  const runId = await sampleRunId();
  const first = await apiJson<DeliveryList>(`/api/v1/runs/${encodeURIComponent(runId)}/deliveries?pageSize=1&sort=seq:asc`);
  assert.equal(first.status, 200);
  if (!first.body.hasNextPage) return;
  assert.equal(first.body.data?.length, 1);
  assert.ok(first.body.nextCursor, "a non-final page exposes a continuation cursor");

  const second = await apiJson<DeliveryList>(`/api/v1/runs/${encodeURIComponent(runId)}/deliveries?pageSize=1&sort=seq:asc&cursor=${encodeURIComponent(first.body.nextCursor!)}`);
  assert.equal(second.status, 200);
  assert.equal(second.body.data?.length, 1);
  assert.ok((second.body.data?.[0]?.seq ?? 0) > (first.body.data?.[0]?.seq ?? 0));
});
