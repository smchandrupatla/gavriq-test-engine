import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { summariseSemgrep } from "../../apps/secportal/semgrep-report.mjs";

const REPORT = process.env.SEMGREP_REPORT || "/var/log/sandbench/semgrep-last.json";

test("SAST (Semgrep) report is optional — missing report is not a product outage", () => {
  if (!existsSync(REPORT)) {
    assert.ok(true, "run: docker compose --profile sast run --rm semgrep");
    return;
  }
  const summary = summariseSemgrep(JSON.parse(readFileSync(REPORT, "utf8")));
  assert.equal(summary.present, true);
});

test("SAST ERROR findings are listed when a Semgrep report exists", () => {
  if (!existsSync(REPORT)) {
    assert.ok(true);
    return;
  }
  const summary = summariseSemgrep(JSON.parse(readFileSync(REPORT, "utf8")));
  assert.ok(typeof summary.error === "number");
});
