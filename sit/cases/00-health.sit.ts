import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiFetch, dbviewerJson } from "../lib/client.ts";

test("main application is healthy and reports its deployed classification", async () => {
  const res = await fetch(`${ENV.apiBase}/health`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.role, "api");
});

test("main application is ready (database migrated and reachable)", async () => {
  const res = await fetch(`${ENV.apiBase}/ready`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "ready");
});

test("main application authenticates the SIT operator persona", async () => {
  const res = await apiFetch("/api/v1/session/me");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.tenantSlug, ENV.tenantSlug);
  assert.ok(body.functionalPermissions.includes("runs:execute"), "operator persona must be able to execute runs");
});

test("test hub (MQ/Kafka/API mimic) is healthy and decoupled from the app", async () => {
  const res = await fetch(`${ENV.testhubBase}/health`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.service, "testhub");
  assert.equal(body.decoupled, true);
});

test("db viewer is healthy and can reach the same database as the app", async () => {
  const { status, body } = await dbviewerJson<{ status: string; role: string; apps: number }>("/health");
  assert.equal(status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.role, "dbviewer");
  assert.ok(body.apps > 0);
  const tables = await dbviewerJson<{ data: Array<{ table_name: string }> }>('/api/tables?app=sandbench');
  assert.equal(tables.status, 200);
  assert.ok(tables.body.data.some(row => row.table_name === 'test_cases'), 'viewer must read the application database');
});

test("web front end serves the deployed console", async () => {
  const res = await fetch(`${ENV.webBase}/index.html`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Sand Bench/);
});
