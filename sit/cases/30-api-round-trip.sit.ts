import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson, correlationId, pollUntil, testhubJson } from "../lib/client.ts";

type InboundEvent = { id: string; channel: string; systemId: string; payload: Record<string, unknown> };
type TesthubInboxRow = { at: string; channel: string; payload: Record<string, unknown> };

test("external API client posts a message and the application records receipt", async () => {
  const msgId = correlationId("SIT-API-IN");
  const { status, body } = await testhubJson<{ forwarded: boolean }>("/hub/to-app", {
    method: "POST",
    body: JSON.stringify({
      channel: "api",
      systemId: "ext_reporting",
      systemName: "SIT reporting API client",
      headers: { "x-correlation-id": msgId },
      payload: { MsgId: msgId, scheme: "sit.api.inbound" },
    }),
  });
  assert.equal(status, 202, "test hub should accept the simulated API delivery");
  assert.equal(body.forwarded, true, "test hub could not reach the main application over the deployment network");

  const events = await apiJson<{ data: InboundEvent[] }>("/api/v1/inbound/events");
  assert.equal(events.status, 200);
  const received = events.body.data.find((row) => row.payload?.MsgId === msgId);
  assert.ok(received, `application did not record inbound API event ${msgId}`);
  assert.equal(received?.channel, "api");
});

test("application posts a message to an external API and delivery is confirmed there", async () => {
  const before = await testhubJson<{ total: number }>("/hub/inbox?channel=api");

  const run = await apiJson<{
    delivery: { sent: number; blocked: number; failed: number };
  }>("/api/v1/runs", {
    method: "POST",
    body: JSON.stringify({ messageTypeCode: ENV.messageTypeCode, count: 1, channel: "api", seed: correlationId("seed") }),
  });
  assert.equal(run.status, 202, "run request was rejected");
  assert.equal(run.body.delivery.blocked, 0, "generated message failed schema validation and was never dispatched");
  assert.equal(run.body.delivery.failed, 0, "API adapter reported a failed send");
  assert.equal(run.body.delivery.sent, 1);

  const after = await pollUntil(
    () => testhubJson<{ data: TesthubInboxRow[]; total: number }>("/hub/inbox?channel=api"),
    (result) => result.body.total > before.body.total,
    { timeoutMs: 8000 }
  );
  assert.ok(after.body.total > before.body.total, "external API endpoint (test hub) never received the request the application sent");
  const latest = after.body.data[after.body.data.length - 1];
  assert.equal(latest?.channel, "api");
  assert.ok(latest?.payload && Object.keys(latest.payload).length > 0, "captured API request had no payload");
});
