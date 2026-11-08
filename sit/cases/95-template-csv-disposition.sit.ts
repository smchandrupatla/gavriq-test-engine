import { test } from "node:test";
import assert from "node:assert/strict";
import { as } from "../lib/pentest/http.ts";
import { IDENTITIES } from "../lib/pentest/identities.ts";
import { ENV } from "../lib/env.ts";

// System test: authenticated catalogue reader downloads a template CSV.
// Header injection is covered without mutating catalogue data by using a code
// that is not stored (404, no disposition) and the seeded message type (200).

const reader = IDENTITIES.acmeAnalyst;

test("template.csv rejects an unauthenticated download", async () => {
  const res = await fetch(`${ENV.apiBase}/api/v1/message-types/${encodeURIComponent(ENV.messageTypeCode)}/template.csv`, {
    signal: AbortSignal.timeout(8000),
  });
  assert.equal(res.status, 401);
});

test("authenticated catalogue reader downloads template.csv as an attachment", async () => {
  const res = await as(reader, "GET", `/api/v1/message-types/${encodeURIComponent(ENV.messageTypeCode)}/template.csv`);
  assert.equal(res.status, 200, res.text.slice(0, 200));
  const disposition = res.headers.get("content-disposition") || "";
  assert.match(disposition, /^attachment; filename="[^"]+\.csv"; filename\*=UTF-8''/);
  assert.equal(disposition.includes("\n"), false);
  assert.match(res.text, /test_case_number/);
});

test("a message type code with quote and CR cannot inject a second download header", async () => {
  const hostile = 'pain"\r\nContent-Type: text/html';
  const res = await as(reader, "GET", `/api/v1/message-types/${encodeURIComponent(hostile)}/template.csv`);
  assert.ok([400, 404, 422].includes(res.status), `expected validation or not-found, got ${res.status}`);
  const disposition = res.headers.get("content-disposition") || "";
  assert.equal(disposition.includes("\r"), false);
  assert.equal(disposition.includes("\n"), false);
  assert.doesNotMatch(disposition, /text\/html/);
  assert.doesNotMatch(res.text, /root:x:0:0/);
});
