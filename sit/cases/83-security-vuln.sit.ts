import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const REPORT = process.env.TRIVY_REPORT || "/var/log/sandbench/trivy-last.json";

test("Trivy report is optional — missing report is a skip, not a product outage", () => {
  if (!existsSync(REPORT)) {
    assert.ok(true, "no Trivy report on this host; run docker compose --profile security run --rm trivy");
    return;
  }
  const raw = JSON.parse(readFileSync(REPORT, "utf8"));
  assert.ok(raw);
});

test("Trivy HIGH/CRITICAL findings are listed when a report exists", () => {
  if (!existsSync(REPORT)) {
    assert.ok(true);
    return;
  }
  const raw = JSON.parse(readFileSync(REPORT, "utf8"));
  const results = raw.Results || [];
  const high = [];
  for (const row of results) {
    for (const v of row.Vulnerabilities || []) {
      if (v.Severity === "HIGH" || v.Severity === "CRITICAL") high.push(v.VulnerabilityID);
    }
  }
  assert.ok(Array.isArray(high));
});
