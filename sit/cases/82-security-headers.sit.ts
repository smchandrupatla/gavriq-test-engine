import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";

test("ASVS V4.1 Content-Type is present on JSON API errors", async () => {
  const res = await fetch(`${ENV.apiBase}/api/v1/session/me`, { signal: AbortSignal.timeout(5000) });
  const type = res.headers.get("content-type") || "";
  assert.match(type, /json/i);
});

test("ASVS V3 clickjacking header is not required on JSON API but X-Content-Type-Options should be safe when set", async () => {
  const res = await fetch(`${ENV.apiBase}/health`, { signal: AbortSignal.timeout(5000) });
  assert.ok(res.ok);
  const xcto = res.headers.get("x-content-type-options");
  if (xcto) assert.match(xcto, /nosniff/i);
});

test("OWASP API8 security misconfig — server header does not advertise a stack version", async () => {
  const res = await fetch(`${ENV.apiBase}/health`, { signal: AbortSignal.timeout(5000) });
  const server = res.headers.get("server") || "";
  assert.doesNotMatch(server, /express\/\d|fastify\/\d/i);
});
