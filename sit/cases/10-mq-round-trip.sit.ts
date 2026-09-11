import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson, correlationId, pollUntil, testhubJson } from "../lib/client.ts";

type InboundEvent = { id: string; channel: string; systemId: string; payload: Record<string, unknown> };
type TesthubInboxRow = { at: string; channel: string; queue: string | null; payload: Record<string, unknown> };

// "MQ manager sends a message to the app": test hub plays the role of the external MQ
// manager and posts an inbound delivery straight at the app's inbound-events endpoint —
// the same path a real MQ bridge would call. We then read the event back from the app
// itself to prove the application actually received and recorded it, not just that
// test hub accepted the call.
test("MQ manager delivers a message and the application records receipt", async () => {
  const msgId = correlationId("SIT-MQ-IN");
  const { status, body } = await testhubJson<{ forwarded: boolean; status?: number }>("/hub/to-app", {
    method: "POST",
    body: JSON.stringify({
      channel: "mq",
      systemId: "ext_core",
      systemName: "SIT core banking MQ",
      headers: { "x-correlation-id": msgId },
      payload: { MsgId: msgId, DbtrNm: "SIT Probe", scheme: "sit.mq.inbound" },
    }),
  });
  assert.equal(status, 202, "test hub should accept the simulated MQ delivery");
  assert.equal(body.forwarded, true, "test hub could not reach the main application over the deployment network");

  const events = await apiJson<{ data: InboundEvent[] }>("/api/v1/inbound/events");
  assert.equal(events.status, 200);
  const received = events.body.data.find((row) => row.payload?.MsgId === msgId);
  assert.ok(received, `application did not record inbound MQ event ${msgId}`);
  assert.equal(received?.channel, "mq");
  assert.equal(received?.systemId, "ext_core");
});

// "app sends a message to the MQ manager": trigger the application's own run/delivery
// pipeline on the mq channel, then verify — independently, via test hub's own inbox,
// the system standing in for the MQ manager's web portal — that the message actually
// arrived there, with the events (capture call) the delivery path is meant to produce.
test("application sends a message to the MQ manager and delivery is confirmed there", async () => {
  const before = await testhubJson<{ total: number }>("/hub/inbox?channel=mq");

  const run = await apiJson<{
    accepted: boolean;
    delivery: { sent: number; blocked: number; failed: number; results: Array<{ channel: string; status: string }> };
  }>("/api/v1/runs", {
    method: "POST",
    body: JSON.stringify({ messageTypeCode: ENV.messageTypeCode, count: 1, channel: "mq", seed: correlationId("seed") }),
  });
  assert.equal(run.status, 202, "run request was rejected");
  assert.equal(run.body.delivery.blocked, 0, "generated message failed schema validation and was never dispatched");
  assert.equal(run.body.delivery.failed, 0, "MQ adapter reported a failed send");
  assert.equal(run.body.delivery.sent, 1);
  assert.equal(run.body.delivery.results[0]?.status, "acknowledged");

  const after = await pollUntil(
    () => testhubJson<{ data: TesthubInboxRow[]; total: number }>("/hub/inbox?channel=mq"),
    (result) => result.body.total > before.body.total,
    { timeoutMs: 8000 }
  );
  assert.ok(
    after.body.total > before.body.total,
    "MQ manager (test hub) never received the message the application says it sent"
  );
  const latest = after.body.data[after.body.data.length - 1];
  assert.equal(latest?.channel, "mq");
  assert.ok(latest?.payload && Object.keys(latest.payload).length > 0, "captured MQ message had no payload");
});
