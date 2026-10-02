import { test } from "node:test";
import assert from "node:assert/strict";
import { apiFetch, correlationId, dbviewerJson, pollUntil, withCaseCleanup } from "../lib/client.ts";
import { openConsole, openNav, selectFirstNamedOption, selectNamedOption, setNamedField, submitScreen, withDriver } from "../lib/selenium.ts";

// Selenium-driven workflow + data-integrity coverage: for each real, database-writing
// form in the Ops Console, this drives the actual UI workflow (fill the real fields,
// click the real submit button, read the screen's own outcome line — sit/lib/selenium.ts),
// then independently confirms through the read-only db viewer that the row the UI
// claims to have saved actually exists and actually carries the values submitted. The
// UI's own success message is never treated as proof by itself — same principle as
// sit/cases/60-ui-eventing.sit.ts applied to the MQ/Kafka/API eventing panel.
//
// The forms are the console's current ones (checked against the deployment on
// 2026-09-30): each control has a name attribute, the primary button is #screen-action
// and the outcome is reported in #screen-status. They submit what the operator picked —
// the earlier console posted fixed category/severity/cadence values whatever was on
// screen, and these cases used to assert those fixed values. They now assert the
// operator's own choices reach the database, which is the contract worth holding.
//
// Only forms that are real, standalone, and safely repeatable are covered here. The
// Message Designer wizard's "Create message(s)" action also writes to the database
// (POST /api/v1/message-types) but always submits the same default code
// ("custom.type") — a second UI-driven run would collide with the tenant's own
// code-uniqueness constraint, so it stays covered only as page/navigation coverage
// (see sit/cases/70-ui-pages.sit.ts) rather than as a repeatable workflow case here.

type DbRows<T> = { total: number; columns: string[]; data: T[] };

// The viewer pages oldest-first, 100 rows at most: a row written a moment ago is on the
// last page, not the first.
async function newestRows<T>(table: string): Promise<{ status: number; body: DbRows<T> }> {
  const first = await dbviewerJson<DbRows<T>>(`/api/rows?table=${table}&page_size=100`);
  const lastPage = Math.max(1, Math.ceil((first.body.total || 0) / 100));
  return lastPage === 1 ? first : dbviewerJson<DbRows<T>>(`/api/rows?table=${table}&page_size=100&page=${lastPage}`);
}

test("Rule Bench: creating a rule from the console UI persists it, and the database row reflects what the console actually submitted", async () => {
  const ruleName = correlationId("sit-ui-rule");

  const outcome = await withDriver(async (driver) => {
    await openConsole(driver);
    await openNav(driver, "Rule Bench", "Create new rule");
    await setNamedField(driver, "name", ruleName);
    await selectNamedOption(driver, "category", "Fraud");
    await selectNamedOption(driver, "severity", "Critical");
    await setNamedField(driver, "condition", JSON.stringify({ kind: "amount_gte", field: "amount", value: 10000 }));
    return submitScreen(driver, "Save rule");
  });
  assert.equal(outcome, "Saved.", "the console did not report the rule as saved");

  const rows = await pollUntil(
    () => newestRows<{ id: string; name: string; category: string; severity: string }>("detection_rules"),
    (result) => Boolean(result.body.data?.some((row) => row.name === ruleName)),
    { timeoutMs: 8000 }
  );
  const persisted = rows.body.data?.find((row) => row.name === ruleName);
  assert.ok(persisted, `rule "${ruleName}" was created in the console UI but never appears in detection_rules`);
  assert.equal(persisted?.category, "fraud", "the saved rule does not carry the category chosen on screen");
  assert.equal(persisted?.severity, "critical", "the saved rule does not carry the severity chosen on screen");
});

test("Test Runs: starting a run from the console UI persists it with the fields the console actually submitted", async () => {
  const before = await newestRows<{ id: string }>("test_runs");
  const beforeTotal = before.body.total || 0;
  const beforeIds = new Set((before.body.data || []).map((row) => row.id));

  const seed = correlationId("sit-ui-run");
  const outcome = await withDriver(async (driver) => {
    await openConsole(driver);
    await openNav(driver, "Test Runs", "New test run");
    await setNamedField(driver, "messageTypeCode", "pain.001.001.09");
    await setNamedField(driver, "count", "1");
    await selectNamedOption(driver, "channel", "File");
    await setNamedField(driver, "seed", seed);
    return submitScreen(driver, "Start run");
  });
  assert.equal(outcome, "Saved.", "the console did not report the run as started");

  const after = await pollUntil(
    () => newestRows<{ id: string; message_type_code: string; channel: string }>("test_runs"),
    (result) => (result.body.total || 0) > beforeTotal && (result.body.data || []).some((row) => !beforeIds.has(row.id)),
    { timeoutMs: 8000 }
  );
  // test_runs has no column that round-trips the seed typed on screen, so "a new row for
  // this message type and channel appeared since before the submit" is the identity
  // check and these field values are the integrity check.
  const created = (after.body.data || []).filter((row) => !beforeIds.has(row.id));
  const mine = created.find((row) => row.message_type_code === "pain.001.001.09" && row.channel === "file");
  assert.ok(mine, `starting a run from the console UI (seed ${seed}) never produced a pain.001.001.09 file row in test_runs`);
});

test("Schedules: creating a schedule from the console UI persists it, and the database row reflects what the console actually submitted", async () => {
  const scheduleName = correlationId("sit-ui-schedule");

  await withCaseCleanup(async () => {
  const outcome = await withDriver(async (driver) => {
    await openConsole(driver);
    await openNav(driver, "Schedules", "New schedule");
    await setNamedField(driver, "name", scheduleName);
    await selectNamedOption(driver, "targetType", "A test suite");
    await selectFirstNamedOption(driver, "targetId");
    await selectNamedOption(driver, "cadence", "Weekly");
    return submitScreen(driver, "Create schedule");
  });
  assert.equal(outcome, "Saved.", "the console did not report the schedule as created");

  const rows = await pollUntil(
    () => newestRows<{ id: string; name: string; cadence: string }>("run_schedules"),
    (result) => Boolean(result.body.data?.some((row) => row.name === scheduleName)),
    { timeoutMs: 8000 }
  );
  const persisted = rows.body.data?.find((row) => row.name === scheduleName);
  assert.ok(persisted, `schedule "${scheduleName}" was created in the console UI but never appears in run_schedules`);
  assert.equal(persisted?.cadence, "weekly", "the saved schedule does not carry the cadence chosen on screen");
  }, async () => {
    const rows = await newestRows<{ id: string; name: string; etag: string }>("run_schedules");
    const owned = rows.body.data?.find((row) => row.name === scheduleName);
    if (!owned) return;
    const response = await apiFetch(`/api/v1/schedules/${encodeURIComponent(owned.id)}`, {
      method: "DELETE",
      headers: owned.etag ? { "if-match": owned.etag } : {},
    });
    if (response.status !== 204 && response.status !== 404) throw new Error(`schedule cleanup returned ${response.status}: ${await response.text()}`);
  });
});
