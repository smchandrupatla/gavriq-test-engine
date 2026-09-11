import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";

test("UX first-run strip is published on the deployed API", async () => {
  const res = await fetch(`${ENV.apiBase}/api/v1/ux/first-run`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.lead, "Good rules survive bad data.");
  assert.equal(body.steps.length, 4);
});

test("N-2 demo script is the same walk after deploy", async () => {
  const res = await fetch(`${ENV.apiBase}/api/v1/ux/demo/n2`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.seconds, 90);
  assert.equal(body.defaultRun.channel, "mq");
});

test("channel targets list file, api, mq, kafka", async () => {
  const res = await fetch(`${ENV.apiBase}/api/v1/channel-targets`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  const body = await res.json();
  const channels = (body.data || []).map((row) => row.channel);
  for (const expected of ["file", "api", "mq", "kafka"]) {
    assert.ok(channels.includes(expected), `missing channel ${expected}`);
  }
});
