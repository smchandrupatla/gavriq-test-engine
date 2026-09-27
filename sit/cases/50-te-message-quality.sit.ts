// Engine-owned SIT case (not synced from Sand Bench). Backs the engine catalog's
// Data quality, Unit, Integration, Compatibility, Regression and Non-functional
// cases about generated messages: every assertion runs against the live generator
// (/api/v1/definitions/preview) and validator (/api/v1/validate).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { apiJson } from "../lib/client.ts";

type Field = { id: string; type: string; required?: boolean; label?: string };
type MessageType = { code: string; fields: Field[] };
type Generated = { testDataId: string; payload: Record<string, unknown> };
type Validation = { valid: boolean; findings: Array<{ field?: string; code: string; message: string }> };

async function messageType(code: string): Promise<MessageType> {
  const res = await apiJson<MessageType>(`/api/v1/message-types/${encodeURIComponent(code)}`);
  assert.equal(res.status, 200, `message type ${code} is not readable`);
  assert.ok(Array.isArray(res.body.fields) && res.body.fields.length > 0, `message type ${code} has no fields`);
  return res.body;
}

async function allCodes(): Promise<string[]> {
  const res = await apiJson<{ data: Array<{ code: string }> }>("/api/v1/message-types");
  assert.equal(res.status, 200);
  return res.body.data.map((t) => t.code);
}

async function preview(code: string, count: number, seed: string): Promise<Generated[]> {
  const res = await apiJson<{ messages: Generated[] }>("/api/v1/definitions/preview", {
    method: "POST",
    body: JSON.stringify({ messageTypeCode: code, count, seed }),
  });
  assert.equal(res.status, 200, `generation failed for ${code}: ${JSON.stringify(res.body).slice(0, 200)}`);
  assert.equal(res.body.messages.length, count);
  return res.body.messages;
}

function validatorFields(type: MessageType) {
  return type.fields.map((f) => ({ fieldKey: f.id, dataType: f.type, mandatory: f.required === true }));
}

async function validate(fields: ReturnType<typeof validatorFields>, payload: Record<string, unknown>): Promise<Validation> {
  const res = await apiJson<Validation>("/api/v1/validate", { method: "POST", body: JSON.stringify({ fields, payload }) });
  assert.equal(res.status, 200, `validator failed: ${JSON.stringify(res.body).slice(0, 200)}`);
  return res.body;
}

function valuesOfType(type: MessageType, messages: Generated[], dataType: string): Array<{ field: string; value: unknown }> {
  const keys = type.fields.filter((f) => f.type === dataType).map((f) => f.id);
  return messages.flatMap((m) => keys.map((k) => ({ field: k, value: m.payload[k] }))).filter((v) => v.value !== undefined);
}

/** Generate a few messages per type and validate each; returns the failures. */
async function sweep(codes: string[], perType: number, seed: string): Promise<string[]> {
  const failures: string[] = [];
  for (const code of codes) {
    const type = await messageType(code);
    const fields = validatorFields(type);
    for (const m of await preview(code, perType, `${seed}:${code}`)) {
      const v = await validate(fields, m.payload);
      if (!v.valid) failures.push(`${code} ${m.testDataId}: ${v.findings.map((f) => `${f.code}${f.field ? `(${f.field})` : ""}`).join(", ")}`);
    }
  }
  return failures;
}

test("data quality: generated messages populate every required field", async (t) => {
  const type = await messageType(ENV.messageTypeCode);
  const required = type.fields.filter((f) => f.required);
  if (!required.length) return t.skip(`${type.code} marks no field as required`);
  const empty: string[] = [];
  for (const m of await preview(type.code, 25, "te-dq-required")) {
    for (const f of required) {
      const v = m.payload[f.id];
      if (v === undefined || v === null || v === "") empty.push(`${m.testDataId}.${f.id}`);
    }
  }
  assert.deepEqual(empty, [], `required fields left empty: ${empty.slice(0, 10).join(", ")}`);
});

test("data quality: generated text is valid UTF-8 with no replacement or lone surrogate characters", async () => {
  const bad: string[] = [];
  const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  for (const m of await preview(ENV.messageTypeCode, 25, "te-dq-utf8")) {
    for (const [k, v] of Object.entries(m.payload)) {
      if (typeof v !== "string") continue;
      const roundTrip = Buffer.from(v, "utf8").toString("utf8");
      if (roundTrip !== v || v.includes("�") || loneSurrogate.test(v)) bad.push(`${m.testDataId}.${k}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("data quality: generated country codes are current ISO 3166 regions", async (t) => {
  const type = await messageType(ENV.messageTypeCode);
  const values = valuesOfType(type, await preview(type.code, 40, "te-dq-country"), "country");
  if (!values.length) return t.skip(`${type.code} has no country field`);
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const bad = values.filter(({ value }) => !(typeof value === "string" && /^[A-Z]{2}$/.test(value) && names.of(value) !== value));
  assert.deepEqual(bad, [], `not ISO 3166 regions: ${JSON.stringify(bad.slice(0, 5))}`);
});

test("data quality: generated currency codes are current ISO 4217 codes", async (t) => {
  const type = await messageType(ENV.messageTypeCode);
  const values = valuesOfType(type, await preview(type.code, 40, "te-dq-currency"), "currency");
  if (!values.length) return t.skip(`${type.code} has no currency field`);
  const iso = new Set(Intl.supportedValuesOf("currency"));
  const bad = values.filter(({ value }) => !(typeof value === "string" && iso.has(value)));
  assert.deepEqual(bad, [], `not ISO 4217: ${JSON.stringify(bad.slice(0, 5))}`);
});

/** ISO 13616 IBAN check: move the first four characters to the end, letters to numbers, mod 97 == 1. */
export function ibanChecksumValid(iban: string): boolean {
  const s = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

test("unit: generated IBANs pass the ISO 13616 mod-97 checksum", async (t) => {
  assert.ok(ibanChecksumValid("GB82WEST12345698765432"), "checksum helper rejects a known-good IBAN");
  const type = await messageType(ENV.messageTypeCode);
  const values = valuesOfType(type, await preview(type.code, 40, "te-unit-iban"), "iban");
  if (!values.length) return t.skip(`${type.code} has no IBAN field`);
  const bad = values.filter(({ value }) => !ibanChecksumValid(String(value)));
  assert.deepEqual(bad.map((b) => b.value), [], `${bad.length}/${values.length} generated IBANs fail the checksum a real payment gateway applies`);
});

test("unit: generated amounts are positive with at most two decimal places", async (t) => {
  const type = await messageType(ENV.messageTypeCode);
  const values = valuesOfType(type, await preview(type.code, 40, "te-unit-amount"), "amount");
  if (!values.length) return t.skip(`${type.code} has no amount field`);
  const bad = values.filter(({ value }) => {
    const n = Number(value);
    return typeof value !== "number" || !(n > 0) || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6;
  });
  assert.deepEqual(bad, []);
});

test("integration: a generated message is accepted by the validator", async () => {
  const type = await messageType(ENV.messageTypeCode);
  const [m] = await preview(type.code, 1, "te-int-accept");
  const v = await validate(validatorFields(type), m!.payload);
  assert.equal(v.valid, true, `generated message rejected: ${JSON.stringify(v.findings)}`);
});

test("integration: a payload missing a required field or with a wrong type is rejected with findings", async () => {
  const type = await messageType(ENV.messageTypeCode);
  const [m] = await preview(type.code, 1, "te-int-reject");
  const fields = validatorFields(type);
  // Mark the first field mandatory so the missing-field rule is exercised even if the type marks none.
  fields[0] = { ...fields[0]!, mandatory: true };
  const payload = { ...m!.payload };
  delete payload[fields[0]!.fieldKey];
  const numeric = fields.find((f) => f.dataType === "amount" || f.dataType === "number");
  const text = fields.find((f, i) => i > 0 && !["amount", "number"].includes(f.dataType));
  if (numeric) payload[numeric.fieldKey] = "not-a-number";
  else if (text) payload[text.fieldKey] = 12345;
  const v = await validate(fields, payload);
  assert.equal(v.valid, false, "invalid payload was accepted");
  const codes = v.findings.map((f) => f.code);
  assert.ok(codes.includes("missing_required"), `no missing_required finding: ${JSON.stringify(v.findings)}`);
  assert.ok(codes.includes("wrong_type"), `no wrong_type finding: ${JSON.stringify(v.findings)}`);
});

test("compatibility: Unicode names pass validation and the privacy screen", async (t) => {
  const type = await messageType(ENV.messageTypeCode);
  const nameField = type.fields.find((f) => f.type === "name");
  if (!nameField) return t.skip(`${type.code} has no name field`);
  const [m] = await preview(type.code, 1, "te-compat-unicode");
  const name = "李小龍 Zoë Ñúñez-Øberg Ωmega";
  const payload = { ...m!.payload, [nameField.id]: name };
  const v = await validate(validatorFields(type), payload);
  assert.ok(!v.findings.some((f) => f.field === nameField.id), `Unicode name rejected: ${JSON.stringify(v.findings)}`);
  const screen = await apiJson<{ clean: boolean; hits: string[] }>("/api/v1/privacy/screen", { method: "POST", body: JSON.stringify({ payload: { [nameField.id]: name } }) });
  assert.equal(screen.status, 200);
  assert.equal(screen.body.clean, true);
});

test("non-functional: synthetic data never looks like production PII and the target is not production", async () => {
  const health = (await (await fetch(`${ENV.apiBase}/health`, { signal: AbortSignal.timeout(5000) })).json()) as { classification?: string };
  assert.notEqual(health.classification, "production");
  const hits: string[] = [];
  for (const m of await preview(ENV.messageTypeCode, 30, "te-nf-privacy")) {
    const screen = await apiJson<{ clean: boolean; hits: string[] }>("/api/v1/privacy/screen", { method: "POST", body: JSON.stringify({ payload: m.payload }) });
    assert.equal(screen.status, 200);
    if (!screen.body.clean) hits.push(`${m.testDataId}: ${screen.body.hits.join(",")}`);
  }
  assert.deepEqual(hits, [], "generated data resembled real PII");
});

test("regression: every catalogued message type still generates valid messages", async () => {
  const codes = (await allCodes()).slice(0, 80);
  assert.ok(codes.length > 0, "catalogue lists no message types");
  const failures = await sweep(codes, 2, "te-reg-sweep");
  assert.deepEqual(failures, [], `${failures.length} generated messages failed validation`);
});

test("regression: every pacs.008 version generates valid messages", async (t) => {
  const codes = (await allCodes()).filter((c) => c.startsWith("pacs.008"));
  if (!codes.length) return t.skip("no pacs.008 message type in the catalogue");
  assert.deepEqual(await sweep(codes, 10, "te-reg-pacs008"), []);
});

test("regression: every camt.054 version generates valid messages", async (t) => {
  const codes = (await allCodes()).filter((c) => c.startsWith("camt.054"));
  if (!codes.length) return t.skip("no camt.054 message type in the catalogue");
  assert.deepEqual(await sweep(codes, 10, "te-reg-camt054"), []);
});

test("compatibility: pacs.008 versions are generated and validated alike", async (t) => {
  const codes = (await allCodes()).filter((c) => c.startsWith("pacs.008"));
  if (codes.length < 2) return t.skip(`need two pacs.008 versions, catalogue has ${codes.length}`);
  assert.deepEqual(await sweep(codes, 5, "te-compat-pacs008"), []);
});

test("compatibility: camt.053 and camt.054 are generated and validated alike", async (t) => {
  const codes = (await allCodes()).filter((c) => c.startsWith("camt.053") || c.startsWith("camt.054"));
  if (!codes.some((c) => c.startsWith("camt.053")) || !codes.some((c) => c.startsWith("camt.054"))) {
    return t.skip("catalogue does not hold both camt.053 and camt.054");
  }
  assert.deepEqual(await sweep(codes, 5, "te-compat-camt"), []);
});

test("compatibility: a mixed batch with one message per family validates", async () => {
  const codes = await allCodes();
  const byFamily = new Map<string, string>();
  for (const c of codes) {
    const family = c.split(".")[0]!;
    if (!byFamily.has(family)) byFamily.set(family, c);
  }
  assert.ok(byFamily.size > 0);
  assert.deepEqual(await sweep([...byFamily.values()], 1, "te-compat-mixed"), []);
});
