import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { WebDriver } from "selenium-webdriver";
import { newDriver, openConsole, openNav, pageTitle } from "../lib/selenium.ts";

// Selenium-driven per-page coverage: every leaf page reachable from the Ops Console
// sidebar (apps/web/public/js/ops-console-preview.js CONFIG.nav) is navigated to the
// same way a person would — clicking the real nav item, and the real sub-item under it
// — and asserted to render its own real page header. This is the "every page in the
// application gets a test case" phase; sit/cases/80-ui-workflows.sit.ts goes further
// for the pages backed by a real, database-writing workflow.
//
// One browser session is shared across every test in this file (module-level
// before/after) purely for run time: opening ~26 pages in a fresh browser each would
// dominate the SIT run. Each page still gets its own node:test case with a static
// string name — deliberately not built in a loop from a data table, because both the
// Test Hub coverage catalog (dev/scripts/generate-testhub-catalog.mjs) and this
// engine's own console (sit/console.mjs) discover case names by scanning source for a
// literal test call with a double-quoted string argument; a name assembled at runtime
// (e.g. inside a template literal built from a loop variable) would not be visible to
// either.
//
// title values below are copied verbatim from CONFIG.pages / CONFIG.overview.hero /
// CONFIG.messageDesigner in ops-console-preview.js — several diverge from their
// sidebar label (e.g. "View saved definitions" routes to a page titled "Saved message
// definitions"), which is exactly the kind of drift this case exists to catch.

let driver: WebDriver;

before(async () => {
  driver = await newDriver();
  await openConsole(driver);
});

after(async () => {
  if (driver) await driver.quit();
});

async function assertPage(top: string, sub: string | undefined, expectedTitle: string) {
  await openNav(driver, top, sub);
  const title = await pageTitle(driver);
  const label = sub ? `${top} → ${sub}` : top;
  assert.equal(title, expectedTitle, `navigating to "${label}" did not render the expected page header`);
}

test("the Overview page renders its own real page header", async () => {
  await assertPage("Overview", undefined, "Good rules survive bad data.");
});

test("the Rule Bench → Existing rules page renders its own real page header", async () => {
  await assertPage("Rule Bench", "Existing rules", "Existing rules");
});

test("the Rule Bench → Create new rule page renders its own real page header", async () => {
  await assertPage("Rule Bench", "Create new rule", "Create new rule");
});

test("the Rule Bench → Stage rules page renders its own real page header", async () => {
  await assertPage("Rule Bench", "Stage rules", "Stage rules");
});

test("the Rule Bench → Validate rules page renders its own real page header", async () => {
  await assertPage("Rule Bench", "Validate rules", "Validate rules");
});

test("the Rule Bench → Export rules page renders its own real page header", async () => {
  await assertPage("Rule Bench", "Export rules", "Export rules");
});

test("the Message Designer → Create message definition page renders its own real page header", async () => {
  await assertPage("Message Designer", "Create message definition", "Build a schema-ready message");
});

test("the Message Designer → View saved definitions page renders its own real page header", async () => {
  await assertPage("Message Designer", "View saved definitions", "Saved message definitions");
});

test("the Message Designer → Import schema page renders its own real page header", async () => {
  await assertPage("Message Designer", "Import schema", "Import schema");
});

test("the Message Designer → Export template page renders its own real page header", async () => {
  await assertPage("Message Designer", "Export template", "Export template");
});

test("the Datasets page renders its own real page header", async () => {
  await assertPage("Datasets", undefined, "Datasets");
});

test("the Test Cases page renders its own real page header", async () => {
  await assertPage("Test Cases", undefined, "Test Cases");
});

test("the Test Suites page renders its own real page header", async () => {
  await assertPage("Test Suites", undefined, "Test Suites");
});

test("the Test Runs → Active runs page renders its own real page header", async () => {
  await assertPage("Test Runs", "Active runs", "Active runs");
});

test("the Test Runs → All test runs page renders its own real page header", async () => {
  await assertPage("Test Runs", "All test runs", "All test runs");
});

test("the Test Runs → Run history page renders its own real page header", async () => {
  await assertPage("Test Runs", "Run history", "Run history");
});

test("the Test Runs → New test run page renders its own real page header", async () => {
  await assertPage("Test Runs", "New test run", "New test run");
});

test("the Schedules → Upcoming schedules page renders its own real page header", async () => {
  await assertPage("Schedules", "Upcoming schedules", "Upcoming schedules");
});

test("the Schedules → All schedules page renders its own real page header", async () => {
  await assertPage("Schedules", "All schedules", "All schedules");
});

test("the Schedules → New schedule page renders its own real page header", async () => {
  await assertPage("Schedules", "New schedule", "New schedule");
});

test("the Reports → All reports page renders its own real page header", async () => {
  await assertPage("Reports", "All reports", "All reports");
});

test("the Reports → Coverage reports page renders its own real page header", async () => {
  await assertPage("Reports", "Coverage reports", "Coverage reports");
});

test("the Reports → Compliance reports page renders its own real page header", async () => {
  await assertPage("Reports", "Compliance reports", "Compliance reports");
});

test("the Reports → Scheduled exports page renders its own real page header", async () => {
  await assertPage("Reports", "Scheduled exports", "Scheduled exports");
});

test("the Configuration page renders its own real page header", async () => {
  await assertPage("Configuration", undefined, "Configuration");
});

test("the Naming conventions page renders its own real page header", async () => {
  await assertPage("Naming conventions", undefined, "Naming conventions");
});
