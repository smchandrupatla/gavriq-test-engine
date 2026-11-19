// Engine-owned SIT case (not synced from Sand Bench). Backs the engine catalog's
// Unit, Regression, Rolling-upgrade and Use-case cases about detection rules.
//
// Rule validation is deterministic: /api/v1/rules/:id/validate generates `count`
// messages from `seed`, and /api/v1/definitions/preview with the same seed yields the
// same payloads. So each unit test recomputes the expected hits itself from the
// previewed payloads and compares them with what the rule engine reports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson, correlationId } from "../lib/client.ts";

type Field = { id: string; type: string };
type Rule = { id: string; name: string; status: string; etag: string; condition_json?: unknown };
type ValidateResult = { cases: number; triggered: number; result: string; passRate: number };
type Condition = { kind: string; field?: string; value?: string | number; values?: string[] };

const COUNT = 60;

async function fields(): Promise<Field[]> {
  const res = await apiJson<{ fields: Field[] }>(`/api/v1/message-types/${encodeURIComponent(ENV.messageTypeCode)}`);
  assert.equal(res.status, 200);
  return res.body.fields;
}

async function payloads(seed: string): Promise<Array<Record<string, unknown>>> {
  const res = await apiJson<{ messages: Array<{ payload: Record<string, unknown> }> }>("/api/v1/definitions/preview", {
    method: "POST",
    body: JSON.stringify({ messageTypeCode: ENV.messageTypeCode, count: COUNT, seed }),
  });
  assert.equal(res.status, 200);
  return res.body.messages.map((m) => m.payload);
}

async function createRule(condition: Condition, label: string): Promise<Rule> {
  const res = await apiJson<Rule>("/api/v1/rules", {
    method: "POST",
    body: JSON.stringify({ name: `SIT-TE ${label} ${correlationId("r")}`, category: "aml", severity: "high", condition }),
  });
  assert.ok(res.status < 300, `rule create failed: ${res.status} ${JSON.stringify(res.body)}`);
  assert.ok(res.body.id, "rule create returned no id");
  return res.body;
}

async function validateRule(id: string, seed: string): Promise<ValidateResult> {
  const res = await apiJson<ValidateResult>(`/api/v1/rules/${encodeURIComponent(id)}/validate`, {
    method: "POST",
    body: JSON.stringify({ messageTypeCode: ENV.messageTypeCode, count: COUNT, seed }),
  });
  assert.equal(res.status, 200, `validate failed for ${id}: ${JSON.stringify(res.body).slice(0, 200)}`);
  assert.equal(res.body.cases, COUNT);
  return res.body;
}

async function listRules(): Promise<Rule[]> {
  const res = await apiJson<{ data?: Rule[] } | Rule[]>("/api/v1/rules");
  assert.equal(res.status, 200);
  return Array.isArray(res.body) ? res.body : res.body.data || [];
}

test("unit: amount_gte 10,000 triggers exactly on amounts of 10,000 or more", async (t) => {
  const amount = (await fields()).find((f) => f.type === "amount");
  if (!amount) return t.skip(`${ENV.messageTypeCode} has no amount field`);
  const seed = correlationId("te-amount");
  const expected = (await payloads(seed)).filter((p) => Number(p[amount.id]) >= 10000).length;
  const rule = await createRule({ kind: "amount_gte", field: amount.id, value: 10000 }, "amount >= 10000");
  const got = await validateRule(rule.id, seed);
  assert.equal(got.triggered, expected, `rule engine triggered ${got.triggered}, payloads say ${expected}`);
});

test("unit: country_in triggers exactly on countries in the high-risk list", async (t) => {
  const country = (await fields()).find((f) => f.type === "country");
  if (!country) return t.skip(`${ENV.messageTypeCode} has no country field`);
  const seed = correlationId("te-country");
  const sample = await payloads(seed);
  // FATF high-risk jurisdictions plus one country the generator produced, so the rule
  // must both match and not match within the same batch.
  const list = ["IR", "KP", "MM", String(sample[0]![country.id])];
  const expected = sample.filter((p) => list.includes(String(p[country.id]))).length;
  const rule = await createRule({ kind: "country_in", field: country.id, values: list }, "high-risk country");
  const got = await validateRule(rule.id, seed);
  assert.equal(got.triggered, expected);
  assert.ok(got.triggered > 0 && got.triggered < COUNT, "batch should contain both matches and non-matches");
});

test("unit: field_equals matches exact values only", async (t) => {
  const f = (await fields()).find((x) => x.type === "country") || (await fields())[0];
  if (!f) return t.skip("no field to match on");
  const seed = correlationId("te-equals");
  const sample = await payloads(seed);
  const value = String(sample[0]![f.id]);
  const expected = sample.filter((p) => String(p[f.id]) === value).length;
  const rule = await createRule({ kind: "field_equals", field: f.id, value }, "exact match");
  const got = await validateRule(rule.id, seed);
  assert.equal(got.triggered, expected);
  // A near miss (different case) must not match.
  const near = await createRule({ kind: "field_equals", field: f.id, value: value.toLowerCase() === value ? value.toUpperCase() : value.toLowerCase() }, "exact match near miss");
  const miss = await validateRule(near.id, seed);
  assert.equal(miss.triggered, sample.filter((p) => String(p[f.id]) === (value.toLowerCase() === value ? value.toUpperCase() : value.toLowerCase())).length);
});

test("rolling upgrade: an unknown or retired condition kind is rejected", async () => {
  for (const kind of ["amount_between", "velocity_24h", ""]) {
    const res = await apiJson("/api/v1/rules", {
      method: "POST",
      body: JSON.stringify({ name: `SIT-TE bad kind ${correlationId("r")}`, category: "aml", severity: "low", condition: { kind, field: "amt", value: 1 } }),
    });
    assert.ok(res.status >= 400 && res.status < 500, `condition kind "${kind}" was accepted (${res.status})`);
  }
});

test("use case: a control owner creates a rule and approves it into active", async () => {
  const amount = (await fields()).find((f) => f.type === "amount");
  const rule = await createRule({ kind: "amount_gte", field: amount?.id || "amt", value: 5000 }, "approve path");
  assert.equal(rule.status, "in_review", "a new rule must start in review");
  const res = await apiJson<Rule>(`/api/v1/rules/${encodeURIComponent(rule.id)}/transitions`, {
    method: "POST",
    headers: { "if-match": rule.etag },
    body: JSON.stringify({ transition: "activate", reason: "SIT-TE approval" }),
  });
  assert.ok(res.status < 300, `activate failed: ${res.status} ${JSON.stringify(res.body)}`);
  const after = await apiJson<{ data: Rule }>(`/api/v1/rules/${encodeURIComponent(rule.id)}`);
  assert.equal(after.body.data.status, "active");
  const stale = await apiJson(`/api/v1/rules/${encodeURIComponent(rule.id)}/transitions`, {
    method: "POST",
    headers: { "if-match": rule.etag },
    body: JSON.stringify({ transition: "deprecate" }),
  });
  assert.ok(stale.status >= 400, "a transition with a stale If-Match must be refused");
});

test("regression: the full rule pack re-validates without errors", async () => {
  const rules = (await listRules()).slice(0, 40);
  assert.ok(rules.length > 0, "no detection rules to re-run");
  const bad: string[] = [];
  for (const r of rules) {
    const res = await apiJson<ValidateResult>(`/api/v1/rules/${encodeURIComponent(r.id)}/validate`, {
      method: "POST",
      body: JSON.stringify({ messageTypeCode: ENV.messageTypeCode, count: 20, seed: "te-pack" }),
    });
    if (res.status !== 200 || !["passed", "warning", "failed"].includes(res.body.result)) bad.push(`${r.name}: ${res.status}`);
  }
  assert.deepEqual(bad, []);
});

test("regression: adding a rule does not change existing rules' coverage", async () => {
  const existing = (await listRules()).filter((r) => !r.name.startsWith("SIT-TE")).slice(0, 5);
  if (!existing.length) existing.push(...(await listRules()).slice(0, 5));
  assert.ok(existing.length > 0);
  const seed = correlationId("te-stable");
  const before = new Map<string, number>();
  for (const r of existing) before.set(r.id, (await validateRule(r.id, seed)).triggered);
  await createRule({ kind: "country_in", field: "ctry", values: ["KP"] }, "coverage probe");
  for (const r of existing) {
    assert.equal((await validateRule(r.id, seed)).triggered, before.get(r.id), `coverage of "${r.name}" changed after an unrelated rule was added`);
  }
});
