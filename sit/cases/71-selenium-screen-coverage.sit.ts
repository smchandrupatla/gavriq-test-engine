import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { WebDriver } from "selenium-webdriver";
import { newDriver, openConsole, openNav, pageTitle } from "../lib/selenium.ts";
import { ENV } from "../lib/env.ts";

// 50 Selenium screen tests for the deployed Sand Bench web console (apps/web, published
// on Render as sandbench-web), covering every screen in the *current* nav/page inventory
// read straight from apps/web/public/js/ops-console-preview.js's CONFIG.nav / CONFIG.pages.
//
// That inventory has grown since sit/cases/70-ui-pages.sit.ts was written: a "Message
// Schemes" nav group, an "Application Events" page, a full Configuration sub-menu, and a
// "Browse test cases" / "New test case" split under Test Cases all exist now that
// 70-ui-pages.sit.ts never asserts on — those are new coverage here. Where a page is
// already asserted in 70-ui-pages.sit.ts (Overview, Rule Bench, Datasets, ...), the
// assertion below is intentionally re-declared rather than skipped, since this file is
// meant to stand on its own as the current, complete screen inventory; the one place the
// two files would otherwise disagree is Message Designer → Import schema, which moved
// under the new Message Schemes group and is asserted that way here.
//
// Two nav items are deliberately left out of the 50: the "Test Cases" and "Configuration"
// top-level sidebar entries now declare both their own `page` AND `children`, and
// Sidebar's handleParentClick (ops-console-preview.js) only ever toggles the accordion
// for an item with children — it never calls onNavigate for that item's own page in that
// case. A bare click on either label therefore cannot deterministically land on the
// "Test Cases" / "Configuration" page itself (the previously-active page's header would
// still be showing), so no page-header assertion for those two is included here; every
// child page under them is still covered.
//
// One shared browser session drives all 41 authenticated console screens (module-level
// before/after, same reasoning as 70-ui-pages.sit.ts: opening ~40+ pages in a fresh
// browser each would dominate the SIT run). The final 9 cases are plain static HTML
// pages served next to the console (sign-in gate, help, about, demo, ...) that need no
// login, so they run the same driver directly against each URL after the console cases
// are done with it.
//
// Every test name below is a static, double-quoted string literal for the Test Hub
// coverage catalog / this engine's console to discover by scanning source text (see
// sit/README.md "Adding a case") — not built from a loop over a data table.

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

async function assertStaticPage(path: string, mustContain: string[]) {
  await driver.get(`${ENV.webBase}${path}`);
  const html = (await driver.getPageSource()) || "";
  const blob = html.toLowerCase();
  for (const needle of mustContain) {
    assert.ok(blob.includes(needle.toLowerCase()), `${path} did not contain expected text "${needle}"`);
  }
}

// -- Overview --

test("the Overview page renders its own real page header", async () => {
  await assertPage("Overview", undefined, "Good rules survive bad data.");
});

// -- Rule Bench --

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

// -- Message Designer --

test("the Message Designer → Create message definition page renders its own real page header", async () => {
  await assertPage("Message Designer", "Create message definition", "Build a schema-ready message");
});

test("the Message Designer → View saved definitions page renders its own real page header", async () => {
  await assertPage("Message Designer", "View saved definitions", "Saved message definitions");
});

test("the Message Designer → Export template page renders its own real page header", async () => {
  await assertPage("Message Designer", "Export template", "Export template");
});

// -- Message Schemes (new nav group not covered by 70-ui-pages.sit.ts) --

test("the Message Schemes → Import Scheme page renders its own real page header", async () => {
  await assertPage("Message Schemes", "Import Scheme", "Import schema");
});

test("the Message Schemes → Create schema page renders its own real page header", async () => {
  await assertPage("Message Schemes", "Create schema", "Create schema");
});

test("the Message Schemes → Schema canvas page renders its own real page header", async () => {
  await assertPage("Message Schemes", "Schema canvas", "Schema canvas");
});

test("the Message Schemes → Scheme Definitions page renders its own real page header", async () => {
  // ops-console-preview.js's SchemeDefinitionsPage renders hero title "Scheme
  // definitions" (lowercase d) — one letter off from the sidebar label "Scheme
  // Definitions". Same label-vs-title drift 70-ui-pages.sit.ts already documents for
  // "View saved definitions" / "Saved message definitions".
  await assertPage("Message Schemes", "Scheme Definitions", "Scheme definitions");
});

// -- Datasets / Test Cases / Test Suites --

test("the Datasets page renders its own real page header", async () => {
  await assertPage("Datasets", undefined, "Datasets");
});

test("the Test Cases → Browse test cases page renders its own real page header", async () => {
  await assertPage("Test Cases", "Browse test cases", "Browse test cases");
});

test("the Test Cases → New test case page renders its own real page header", async () => {
  await assertPage("Test Cases", "New test case", "New test case");
});

test("the Test Suites page renders its own real page header", async () => {
  await assertPage("Test Suites", undefined, "Test Suites");
});

// -- Test Runs --

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

// -- Schedules --

test("the Schedules → Upcoming schedules page renders its own real page header", async () => {
  await assertPage("Schedules", "Upcoming schedules", "Upcoming schedules");
});

test("the Schedules → All schedules page renders its own real page header", async () => {
  await assertPage("Schedules", "All schedules", "All schedules");
});

test("the Schedules → New schedule page renders its own real page header", async () => {
  await assertPage("Schedules", "New schedule", "New schedule");
});

// -- Reports --

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

// -- Configuration sub-menu (not previously covered item-by-item) --

test("the Configuration → Environment defaults page renders its own real page header", async () => {
  await assertPage("Configuration", "Environment defaults", "Environment defaults");
});

test("the Configuration → Notifications page renders its own real page header", async () => {
  await assertPage("Configuration", "Notifications", "Notifications");
});

test("the Configuration → API access page renders its own real page header", async () => {
  await assertPage("Configuration", "API access", "API access");
});

test("the Configuration → Data retention page renders its own real page header", async () => {
  await assertPage("Configuration", "Data retention", "Data retention");
});

test("the Configuration → User roles page renders its own real page header", async () => {
  await assertPage("Configuration", "User roles", "User roles");
});

test("the Configuration → Eventing page renders its own real page header", async () => {
  await assertPage("Configuration", "Eventing", "Eventing");
});

test("the Configuration → App configs page renders its own real page header", async () => {
  await assertPage("Configuration", "App configs", "App configs");
});

test("the Configuration → Use-case templates page renders its own real page header", async () => {
  await assertPage("Configuration", "Use-case templates", "Use-case templates");
});

test("the Configuration → Feature IDs page renders its own real page header", async () => {
  await assertPage("Configuration", "Feature IDs", "Feature IDs");
});

test("the Configuration → Use-case review page renders its own real page header", async () => {
  await assertPage("Configuration", "Use-case review", "Use-case review");
});

// -- Standalone configuration-group pages --

test("the Naming conventions page renders its own real page header", async () => {
  await assertPage("Naming conventions", undefined, "Naming conventions");
});

test("the External systems page renders its own real page header", async () => {
  await assertPage("External systems", undefined, "External systems");
});

test("the Application Events page renders its own real page header", async () => {
  await assertPage("Application Events", undefined, "Application Events");
});

// -- Static, unauthenticated pages served alongside the console --
// These need no sign-in, so they drive the same shared browser straight at each URL
// instead of going through openNav — the console session above is done being used by
// the time these run.

test("the sign-in gate page renders Sand Bench branding and the local sign-in form", async () => {
  await assertStaticPage("/", ["SAND BENCH", "login", "tenant"]);
});

test("the Help page renders operator help content", async () => {
  await assertStaticPage("/help.html", ["Help", "GARVIQ"]);
});

test("the About page renders the Sand Bench product description", async () => {
  await assertStaticPage("/about.html", ["GARVIQ", "Sand Bench"]);
});

test("the 90-second demo page renders the N-2 walkthrough script", async () => {
  await assertStaticPage("/demo.html", ["sben", "demo"]);
});

test("the Not production page renders the sandbox-not-production disclosure", async () => {
  await assertStaticPage("/not-production.html", ["not production", "Testhub"]);
});

test("the Bring your own XSD page renders schema import guidance", async () => {
  await assertStaticPage("/bring-your-own-xsd.html", ["XSD", "MDR"]);
});

test("the Masking slide page renders the two-tenant masking comparison", async () => {
  await assertStaticPage("/mask-demo.html", ["mask", "tenant"]);
});

test("the Administration portal renders its own sign-in form", async () => {
  await assertStaticPage("/admin.html", ["SAND BENCH", "ADMIN"]);
});

test("the Help Center renders its topic tree shell", async () => {
  await assertStaticPage("/help-center.html", ["Help Center", "GARVIQ"]);
});
