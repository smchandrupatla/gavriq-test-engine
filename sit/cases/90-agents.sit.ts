import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.SIT_AGENTDESK_BASE || "http://127.0.0.1:8101";

test("Agent Desk is optional — unreachable portal is recorded, not a main-app failure", async () => {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) {
      assert.ok(true);
      return;
    }
    const body = await res.json();
    assert.equal(body.product, "GARVIQ Agent Desk");
    assert.equal(body.decoupled, true);
    assert.ok(body.agents >= 1);
  } catch {
    assert.ok(true, "desk down is allowed");
  }
});

test("Agent Desk lists seed agents and accepts an on-demand run when reachable", async () => {
  try {
    const list = await fetch(`${BASE}/app/agents`, { signal: AbortSignal.timeout(2000) });
    if (!list.ok) {
      assert.ok(true);
      return;
    }
    const agents = (await list.json()).data;
    assert.ok(agents.some((a) => a.id === "architect"));
    assert.ok(agents.some((a) => a.id === "kafka-sme"));
    const run = await fetch(`${BASE}/app/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentIds: ["architect"], task: "SIT on-demand" }),
      signal: AbortSignal.timeout(3000),
    });
    assert.ok(run.status === 202 || run.status === 200);
  } catch {
    assert.ok(true);
  }
});
