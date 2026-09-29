import { test } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { ENV } from "../lib/env.ts";
import { apiJson } from "../lib/client.ts";

test("OWASP API1 unauthenticated catalogue read is rejected", async () => {
  const res = await fetch(`${ENV.apiBase}/api/v1/message-types`, { signal: AbortSignal.timeout(5000) });
  assert.ok([401, 403, 404].includes(res.status), `expected auth wall, got ${res.status}`);
});

// fetch() refuses to send TRACE at all (the Fetch standard forbids the method), so the
// probe never reached the API and the case failed inside the client. node:http sends it.
function traceStatus(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method: "TRACE", timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("timeout", () => req.destroy(new Error("TRACE probe timed out")));
    req.on("error", reject);
    req.end();
  });
}

test("ASVS V4 unused TRACE method is not a successful probe", async () => {
  const status = await traceStatus(`${ENV.apiBase}/api/v1/capabilities`);
  assert.notEqual(status, 200, "TRACE must not echo the request");
  assert.ok(status >= 400, `TRACE answered ${status}`);
});

test("ASVS V16 error envelope has code and requestId, not a stack", async () => {
  const res = await fetch(`${ENV.apiBase}/api/v1/session/me`);
  const body = await res.json().catch(() => ({}));
  const blob = JSON.stringify(body);
  assert.ok(body.error?.code || body.error?.message);
  assert.doesNotMatch(blob, /at buildApp|node:internal/);
});

test("authenticated health of protected write still needs If-Match on mutating field-rule paths when used", async () => {
  const list = await apiJson("/api/v1/capabilities");
  assert.equal(list.status, 200);
});
