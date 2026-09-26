import { test } from "node:test";
import assert from "node:assert/strict";
import { testhubJson, pollUntil } from "../lib/client.ts";
import { openConfigurationPage, openConsole, sendDummyMessage, withConsolePage } from "../lib/ui.ts";

// The UI phase: instead of calling the app's API directly like sit/cases/10-30 do, these
// cases drive a real headless browser against the deployed web console — the same
// Configuration → Eventing panel a person would use — then independently confirm
// through test hub (standing in for the MQ manager / Kafka broker / external API) that
// the message the browser action produced actually arrived there. Console UI action and
// external-system verification are deliberately two separate checks: a status message
// the console prints is not proof by itself.

async function sendAndVerify(channel: "mq" | "kafka" | "api") {
  const before = await testhubJson<{ total: number }>(`/hub/inbox?channel=${channel}`);

  const status = await withConsolePage(async (page) => {
    await openConsole(page);
    await openConfigurationPage(page);
    return sendDummyMessage(page, channel);
  });
  assert.match(status, new RegExp(`^Dummy sent on ${channel} \\S+`), `console did not report channel and destination for ${channel}: "${status}"`);

  const after = await pollUntil(
    () => testhubJson<{ total: number; data: Array<{ channel: string; payload: Record<string, unknown> }> }>(`/hub/inbox?channel=${channel}`),
    (result) => result.body.total > before.body.total,
    { timeoutMs: 8000 }
  );
  assert.ok(
    after.body.total > before.body.total,
    `the browser sent a message over ${channel} from the Configuration page, but it never arrived at test hub`
  );
  const latest = after.body.data[after.body.data.length - 1];
  assert.equal(latest?.channel, channel);
}

test("a user sends a message from the Configuration page and it is received by the MQ manager", async () => {
  await sendAndVerify("mq");
});

test("a user sends a message from the Configuration page and it is received by the Kafka broker", async () => {
  await sendAndVerify("kafka");
});

test("a user sends a message from the Configuration page and it is received by the external API endpoint", async () => {
  await sendAndVerify("api");
});
