import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson, correlationId, pollUntil, testhubJson } from "../lib/client.ts";

type InboundEvent = { id: string; channel: string; systemId: string; payload: Record<string, unknown> };
type TesthubInboxRow = { at: string; channel: string; topic: string | null; payload: Record<string, unknown> };

test("Kafka producer delivers a message and the application records receipt", async () => {
  const msgId = correlationId("SIT-KAFKA-IN");
  const { status, body } = await testhubJson<{ forwarded: boolean }>("/hub/to-app", {
    method: "POST",
    body: JSON.stringify({
      channel: "kafka",
      systemId: "ext_fraud",
      systemName: "SIT fraud stream",
      headers: { "x-correlation-id": msgId },
      payload: { MsgId: msgId, scheme: "sit.kafka.inbound" },
    }),
  });
  assert.equal(status, 202, "test hub should accept the simulated Kafka delivery");
  assert.equal(body.forwarded, true, "test hub could not reach the main application over the deployment network");

  const events = await apiJson<{ data: InboundEvent[] }>("/api/v1/inbound/events");
  assert.equal(events.status, 200);
  const received = events.body.data.find((row) => row.payload?.MsgId === msgId);
  assert.ok(received, `application did not record inbound Kafka event ${msgId}`);
  assert.equal(received?.channel, "kafka");
});

test("application publishes a message to Kafka and delivery is confirmed on the topic", async () => {
  const before = await testhubJson<{ total: number }>("/hub/inbox?channel=kafka");

  const run = await apiJson<{
    delivery: { sent: number; blocked: number; failed: number; results: Array<{ status: string }> };
  }>("/api/v1/runs", {
    method: "POST",
    body: JSON.stringify({ messageTypeCode: ENV.messageTypeCode, count: 1, channel: "kafka", seed: correlationId("seed") }),
  });
  assert.equal(run.status, 202, "run request was rejected");
  assert.equal(run.body.delivery.blocked, 0, "generated message failed schema validation and was never dispatched");
  assert.equal(run.body.delivery.failed, 0, "Kafka adapter reported a failed send");
  assert.equal(run.body.delivery.sent, 1);

  const after = await pollUntil(
    () => testhubJson<{ data: TesthubInboxRow[]; total: number }>("/hub/inbox?channel=kafka"),
    (result) => result.body.total > before.body.total,
    { timeoutMs: 8000 }
  );
  assert.ok(after.body.total > before.body.total, "Kafka broker (test hub) never received the message the application sent");
  const latest = after.body.data[after.body.data.length - 1];
  assert.equal(latest?.channel, "kafka");
  assert.ok(latest?.payload && Object.keys(latest.payload).length > 0, "captured Kafka message had no payload");
});
