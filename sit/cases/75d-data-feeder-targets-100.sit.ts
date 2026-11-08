// Data feeder Test Engine coverage: one reusable 100-message set, every default target,
// connectivity checks, and a real Run now delivery for each target.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { apiJson, pollUntil } from "../lib/client.ts";
import { uniqueName } from "../lib/selenium/flow.mjs";

const targetIds = ["ext_sanctions", "ext_core", "ext_fraud", "ext_reporting", "ext_registry", "ext_ftp", "ext_kafka_desk"];
let datasetId: string | null = null;
const feederIds: string[] = [];

async function createMessageSet() {
  const name = uniqueName("DF100-message-set");
  const made = await apiJson<{ id: string }>("/api/v1/datasets", {
    method: "POST", body: JSON.stringify({ name, messageTypeCode: "pain.001.001.09" }),
  });
  assert.ok([200, 201].includes(made.status), `message set create: ${made.status}`);
  datasetId = made.body.id;
  const currentDatasetId = datasetId;
  assert.ok(currentDatasetId, "message set id must be returned");
  for (let offset = 0; offset < 100; offset += 50) {
    const messages = Array.from({ length: Math.min(50, 100 - offset) }, (_, i) => ({
      name: `${name}-${offset + i + 1}`,
      format: "json",
      content: JSON.stringify({ messageSet: name, sequence: offset + i + 1 }),
    }));
    const added = await apiJson<{ data?: unknown[] }>(`/api/v1/datasets/${currentDatasetId}/messages`, {
      method: "POST", body: JSON.stringify({ messages }),
    });
    assert.equal(added.status, 200, `message set fill batch ${offset}: ${added.status}`);
  }
  const listed = await apiJson<{ data?: unknown[] }>(`/api/v1/datasets/${currentDatasetId}/messages`);
  assert.equal(listed.status, 200);
  assert.equal((listed.body.data || []).length, 100, "the reusable message set must contain 100 messages");
}

async function createFeeder(targetId: string) {
  const start = new Date(Date.now() + 60_000).toISOString();
  const end = new Date(Date.now() + 62_000).toISOString();
  const response = await apiJson<{ id: string }>("/api/v1/data-feeders", {
    method: "POST",
    body: JSON.stringify({
      name: uniqueName(`DF100-${targetId}`), description: "Test Engine 100-message target coverage",
      datasets: [{ datasetId, weight: 100 }], repeatCount: 1, sendOrder: "sequential", externalSystemId: targetId,
      windowStart: start, windowEnd: end, pacing: { mode: "fixed", intervalSeconds: 0.01 }, spikes: [], seed: 100,
    }),
  });
  assert.equal(response.status, 201, `feeder create for ${targetId}: ${response.status}`);
  feederIds.push(response.body.id);
  return response.body.id;
}

test("DF100 every listed target passes connectivity and processes 100 messages from one message set", async () => {
  await createMessageSet();
  const systems = await apiJson<{ data: Array<{ id: string; enabled: boolean }> }>("/api/v1/external-systems");
  assert.equal(systems.status, 200);
  assert.deepEqual(systems.body.data.filter((s) => s.enabled).map((s) => s.id).sort(), [...targetIds].sort());

  for (const targetId of targetIds) {
    const probe = await apiJson<{ ok: boolean; results?: Array<{ ok: boolean }> }>(`/api/v1/external-systems/${targetId}/probe`, {
      method: "POST", body: "{}",
    });
    assert.equal(probe.status, 200, `connectivity probe for ${targetId}`);
    assert.equal(probe.body.ok, true, `connectivity for ${targetId}`);

    const feederId = await createFeeder(targetId);
    const started = await apiJson<{ id: string; messageCount: number }>(`/api/v1/data-feeders/${feederId}/runs`, {
      method: "POST", body: JSON.stringify({ startMode: "now" }),
    });
    assert.equal(started.status, 201, `run start for ${targetId}`);
    assert.equal(started.body.messageCount, 100, `run plan for ${targetId}`);
    const finished = await pollUntil(
      async () => apiJson<{ status: string; sent: number; failed: number; blocked: number }>(`/api/v1/data-feeder-runs/${started.body.id}`),
      (result) => result.status === 200 && ["completed", "failed", "cancelled"].includes(result.body.status),
      { timeoutMs: 20_000, intervalMs: 250 },
    );
    assert.equal(finished.status, 200);
    assert.equal(finished.body.status, "completed", `${targetId} run status`);
    assert.equal(finished.body.sent, 100, `${targetId} must successfully process all 100 messages`);
    assert.equal(finished.body.failed, 0, `${targetId} must not fail any message`);
    assert.equal(finished.body.blocked, 0, `${targetId} must not schema-block the message set`);
  }
});
after(async () => {
  for (const feederId of feederIds) {
    const row = await apiJson<{ etag?: string; status?: string }>(`/api/v1/data-feeders/${feederId}`);
    if (row.status === 200 && row.body.status !== "archived") {
      await apiJson(`/api/v1/data-feeders/${feederId}/archive`, { method: "POST", headers: { "if-match": row.body.etag || "" }, body: "{}" });
    }
  }
  if (datasetId) {
    const dataset = await apiJson<{ etag?: string }>(`/api/v1/datasets/${datasetId}`);
    if (dataset.status === 200) await apiJson(`/api/v1/datasets/${datasetId}`, { method: "DELETE", headers: { "if-match": dataset.body.etag || "" } });
  }
});

