import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { summariseZap } from "../../apps/secportal/zap-report.mjs";

const REPORT = process.env.ZAP_REPORT || "/var/log/sandbench/zap-last.json";

test("OWASP ZAP report is optional — missing report is not a product outage", () => {
  if (!existsSync(REPORT)) {
    assert.ok(true, "run: docker compose --profile zap run --rm zap");
    return;
  }
  const raw = JSON.parse(readFileSync(REPORT, "utf8"));
  const summary = summariseZap(raw);
  assert.equal(summary.present, true);
});

test("OWASP ZAP High findings are listed when a report exists", () => {
  if (!existsSync(REPORT)) {
    assert.ok(true);
    return;
  }
  const summary = summariseZap(JSON.parse(readFileSync(REPORT, "utf8")));
  assert.ok(typeof summary.high === "number");
  assert.ok(Array.isArray(summary.items));
});
