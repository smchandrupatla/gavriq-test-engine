// Navigation health: every screen of the console opens, is titled, is highlighted in the sidebar and
// throws no uncaught JavaScript error while it loads.
//
// Why: the "page opens" cases missed a page whose script did not even parse (external-systems.html had
// `.replace(/"/g, """)`): the page opened, showed its heading, and did nothing. So each case below
//   1. opens the screen the way a person does (console home, then the sidebar), and again by its address,
//   2. checks the real title (.opsc-pagehead-title / h1, see pageTitle in sit/lib/selenium.ts),
//   3. checks the sidebar highlights the entry,
//   4. checks the "Official console JS did not boot" text is absent, and
//   5. reads the BROWSER CONSOLE LOG (goog:loggingPrefs) and fails on any uncaught error from the app's own scripts.
// Known noise on this local stack is ignored (unpkg.com CDN loads, /js/sync-button.js and /js/row-identity-bind.js
// which index.html names but are absent); every other SEVERE console line is printed as a diagnostic.
// Each screen is written out as its own case (the Test Engine catalogue lists cases by scanning for calls named test with a quoted name).
import http from "node:http";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import { saveShot, waitFor } from "../lib/selenium/flow.mjs";
import {
  apiJson, click, clickSidebar, gateSignIn, loggedConsole, openConsoleHome, openLoggedSession, readBrowserLog, scriptErrors, sidebarLists,
  sidebarState, sleep, storedTokens, text, titleInfo, visit, otherSevere,
} from "../lib/selenium/feeder-nav.mjs";
import { enterConsole } from "../lib/selenium/console.mjs";

let handlePromise: Promise<any> | null = null;
const handle = () => (handlePromise ||= loggedConsole());
after(async () => { const h = await handlePromise?.catch(() => null); if (h) await h.close(); });

const brief = (entries: any[]) => entries.map((e) => String(e.message).slice(0, 220));

function report(t: any, how: string, r: any) {
  for (const line of brief(r.otherSevere)) t.diagnostic(`other console SEVERE (${how}): ${line}`);
}

function check(t: any, how: string, spec: any, r: any, opts: { highlight: boolean }) {
  assert.equal(r.boot, false, `${how}: the page shows "Official console JS did not boot"`);
  assert.deepEqual(brief(r.scriptErrors), [], `${how}: uncaught JavaScript errors while the page loaded`);
  if (spec.title instanceof RegExp) assert.match(r.title, spec.title, `${how}: title`);
  else assert.equal(r.title, spec.title, `${how}: title (found via ${r.titleSource})`);
  if (spec.docTitle) assert.equal(r.docTitle, spec.docTitle, `${how}: document title`);
  if (spec.finalUrl) assert.ok(r.url.includes(spec.finalUrl), `${how}: ends on ${spec.finalUrl}, was ${r.url}`);
  if (opts.highlight) {
    assert.ok(r.sidebar.present, `${how}: the page has no sidebar`);
    assert.ok(r.sidebar.active.includes(spec.active || spec.label), `${how}: sidebar should highlight "${spec.active || spec.label}", highlighted: ${JSON.stringify(r.sidebar.active)}`);
  }
  report(t, how, r);
}

/** One sidebar screen: click path, then direct address. */
async function screen(t: any, spec: any) {
  const h = await handle();
  if (!h) { t.skip("Selenium not reachable"); return; }
  try {
    if (spec.offered === false) {
      await openConsoleHome(h.sess);
      assert.equal(await sidebarLists(h.sess, spec.label), false, `${spec.label} must not be listed for an operator without that admin right`);
    } else if (spec.header) {
      await openConsoleHome(h.sess);
      await readBrowserLog(h);
      await clickSidebar(h.sess, spec.group, spec.label);
      await sleep(600);
      const s = await sidebarState(h.sess);
      assert.ok(s.expanded.includes(spec.group), `clicking ${spec.group} opens the group: ${JSON.stringify(s.expanded)}`);
      for (const child of spec.header) assert.ok(s.items.includes(child), `${child} is listed under ${spec.group}`);
      assert.deepEqual(brief(scriptErrors(await readBrowserLog(h))), [], "uncaught errors after opening the group");
    } else {
      const r = await visit(h, { via: "click", group: spec.group, label: spec.label, url: spec.url, title: spec.clickTitle ?? spec.title });
      check(t, "sidebar click", { ...spec, title: spec.clickTitle ?? spec.title, active: spec.clickActive ?? spec.active }, r, { highlight: spec.sidebar !== false });
    }
    const d = await visit(h, { via: "url", group: spec.group, label: spec.label, url: spec.url, title: spec.title });
    check(t, "direct URL", spec, d, { highlight: spec.sidebar !== false && spec.activeDirect !== false });
  } catch (error) { await saveShot(h.sess, `nav-${spec.id}`); throw error; }
}

/** A page with no menu entry: direct address only. */
async function staticPage(t: any, spec: any) {
  const h = await handle();
  if (!h) { t.skip("Selenium not reachable"); return; }
  try {
    const r = await visit(h, { via: "url", url: spec.url, title: spec.title });
    check(t, "direct URL", spec, r, { highlight: false });
  } catch (error) { await saveShot(h.sess, `nav-${spec.id}`); throw error; }
}

test("NAV01 Overview opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav01", group: "Overview", label: "Overview", url: "/?page=overview", title: "Good rules survive bad data." });
});
test("NAV02 Patterns opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav02", group: "Patterns", label: "Patterns", url: "/?page=patterns", title: "Patterns" });
});
test("NAV03 Rule Bench -> Existing rules opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav03", group: "Rule Bench", label: "Existing rules", url: "/rule-bench-existing.html", title: "Existing rules" });
});
test("NAV04 Rule Bench -> Create new rule opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav04", group: "Rule Bench", label: "Create new rule", url: "/rule-bench-create.html", title: "Create new rule" });
});
test("NAV05 Rule Bench -> Stage rules opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav05", group: "Rule Bench", label: "Stage rules", url: "/rule-bench-stage.html", title: "Stage rules" });
});
test("NAV06 Rule Bench -> Validate rules opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav06", group: "Rule Bench", label: "Validate rules", url: "/rule-bench-validate.html", title: "Validate rules" });
});
test("NAV07 Rule Bench -> Export rules opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav07", group: "Rule Bench", label: "Export rules", url: "/rule-bench-export.html", title: "Export rules" });
});
test("NAV08 Message Designer -> Create message definition opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav08", group: "Message Designer", label: "Create message definition", url: "/?page=messageDesigner", title: "Build a schema-ready message" });
});
test("NAV09 Message Designer -> View saved definitions opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav09", group: "Message Designer", label: "View saved definitions", url: "/message-designer-saved.html", title: "Saved message definitions" });
});
test("NAV10 Message Designer -> Export template opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav10", group: "Message Designer", label: "Export template", url: "/message-designer-export-template.html", title: "Export template" });
});
test("NAV11 Message Schemes -> Import Scheme opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav11", group: "Message Schemes", label: "Import Scheme", url: "/?page=msgImportSchema", title: "Import schema" });
});
test("NAV12 Message Schemes -> Schema Converter opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav12", group: "Message Schemes", label: "Schema Converter", url: "/schema-converter.html", title: "Schema Converter" });
});
test("NAV13 Message Schemes -> Scheme Definitions opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav13", group: "Message Schemes", label: "Scheme Definitions", url: "/?page=schemeDefinitions", title: "Scheme definitions" });
});
test("NAV14 Datasets header opens its group, and its page opens with its title and no script errors", async (t) => {
  await screen(t, { id: "nav14", group: "Datasets", label: "Datasets", url: "/datasets.html", title: "Saved datasets", header: ["Saved datasets", "Create new dataset"], active: "Saved datasets" });
});
test("NAV15 Datasets -> Saved datasets opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav15", group: "Datasets", label: "Saved datasets", url: "/datasets.html", title: "Saved datasets" });
});
test("NAV16 Datasets -> Create new dataset opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav16", group: "Datasets", label: "Create new dataset", url: "/datasets-new.html", title: "Create new dataset" });
});
test("NAV17 Data Feeders -> New feeder opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav17", group: "Data Feeders", label: "New feeder", url: "/data-feeder-form.html", title: "New data feeder" });
});
test("NAV18 Data Feeders -> All feeders opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav18", group: "Data Feeders", label: "All feeders", url: "/data-feeders.html", title: "All feeders" });
});
test("NAV19 Test Cases header opens its group, and its page opens with its title and no script errors", async (t) => {
  await screen(t, { id: "nav19", group: "Test Cases", label: "Test Cases", url: "/?page=testCases", title: "Test cases", header: ["Browse test cases", "New test case"], active: "Browse test cases", finalUrl: "/test-cases.html" });
});
test("NAV20 Test Cases -> Browse test cases opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav20", group: "Test Cases", label: "Browse test cases", url: "/test-cases.html", title: "Test cases" });
});
test("NAV21 Test Cases -> New test case opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav21", group: "Test Cases", label: "New test case", url: "/test-case-form.html", title: "New test case" });
});
test("NAV22 Test Suites header opens its group, and its page opens with its title and no script errors", async (t) => {
  await screen(t, { id: "nav22", group: "Test Suites", label: "Test Suites", url: "/?page=testSuites", title: "Test suites", header: ["All test suites", "New test suite"], active: "All test suites", finalUrl: "/test-suites.html" });
});
test("NAV23 Test Suites -> All test suites opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav23", group: "Test Suites", label: "All test suites", url: "/test-suites.html", title: "Test suites" });
});
test("NAV24 Test Suites -> New test suite opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav24", group: "Test Suites", label: "New test suite", url: "/test-suite-form.html", title: "New test suite" });
});
test("NAV25 AI Authoring -> Generate from story opens with its title and no script errors", async (t) => {
  await screen(t, { id: "nav25", group: "AI Authoring", label: "Generate from story", url: "/ai-authoring-generate.html", title: "AI draft generate", sidebar: false });
});
test("NAV26 AI Authoring -> Generate from use case opens with its title and no script errors", async (t) => {
  await screen(t, { id: "nav26", group: "AI Authoring", label: "Generate from use case", url: "/ai-authoring-from-use-case.html", title: "Generate from use-case text", sidebar: false });
});
test("NAV27 AI Authoring -> Drafts opens with its title and no script errors", async (t) => {
  await screen(t, { id: "nav27", group: "AI Authoring", label: "Drafts", url: "/ai-authoring-drafts.html", title: "AI draft list", sidebar: false });
});
test("NAV28 AI Authoring -> Review queue opens with its title and no script errors", async (t) => {
  await screen(t, { id: "nav28", group: "AI Authoring", label: "Review queue", url: "/ai-authoring-review.html", title: "AI draft review", sidebar: false });
});
test("NAV29 Test Runs -> Active runs opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav29", group: "Test Runs", label: "Active runs", url: "/test-runs-active.html", title: "Active runs" });
});
test("NAV30 Test Runs -> All test runs opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav30", group: "Test Runs", label: "All test runs", url: "/test-runs-all.html", title: "All test runs" });
});
test("NAV31 Test Runs -> Run history opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav31", group: "Test Runs", label: "Run history", url: "/?page=trHistory", title: "Run history", clickTitle: "All test runs", clickActive: "All test runs" });
});
test("NAV32 Test Runs -> New test run opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav32", group: "Test Runs", label: "New test run", url: "/test-runs-new.html", title: "New test run" });
});
test("NAV33 Schedules -> Upcoming schedules opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav33", group: "Schedules", label: "Upcoming schedules", url: "/schedules-upcoming.html", title: "Upcoming schedules" });
});
test("NAV34 Schedules -> All schedules opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav34", group: "Schedules", label: "All schedules", url: "/schedules-all.html", title: "All schedules" });
});
test("NAV35 Schedules -> New schedule opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav35", group: "Schedules", label: "New schedule", url: "/schedules-new.html", title: "New schedule" });
});
test("NAV36 Reports -> All reports opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav36", group: "Reports", label: "All reports", url: "/reports-all.html", title: "All reports" });
});
test("NAV37 Reports -> Coverage reports opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav37", group: "Reports", label: "Coverage reports", url: "/reports-coverage.html", title: "Coverage reports" });
});
test("NAV38 Reports -> Compliance reports opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav38", group: "Reports", label: "Compliance reports", url: "/reports-compliance.html", title: "Compliance reports" });
});
test("NAV39 Reports -> Scheduled exports opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav39", group: "Reports", label: "Scheduled exports", url: "/reports-scheduled.html", title: "Scheduled exports" });
});
test("NAV40 Configuration header opens its group, and its page opens with its title and no script errors", async (t) => {
  await screen(t, { id: "nav40", group: "Configuration", label: "Configuration", url: "/?page=configuration", title: "Configuration", header: ["Environment defaults", "Notifications", "API access", "Naming conventions"], activeDirect: false });
});
test("NAV41 Configuration -> Environment defaults opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav41", group: "Configuration", label: "Environment defaults", url: "/?page=configurationEnvironmentDefaults", title: "Environment defaults", activeDirect: false });
});
test("NAV42 Configuration -> Notifications opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav42", group: "Configuration", label: "Notifications", url: "/?page=configurationNotifications", title: "Notifications", activeDirect: false });
});
test("NAV43 Configuration -> API access opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav43", group: "Configuration", label: "API access", url: "/?page=configurationApiAccess", title: "API access", activeDirect: false });
});
test("NAV44 Configuration -> Data retention opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav44", group: "Configuration", label: "Data retention", url: "/?page=configurationDataRetention", title: "Data retention", activeDirect: false });
});
test("NAV45 Configuration -> User management is not offered to this operator, and its direct URL opens with its title and no script errors", async (t) => {
  // 2026-11-02 (IMP-QA054): Configuration > Users and Configuration > User roles merged into
  // one tabbed screen, user-management.html (relabelled "User management" in the sidebar).
  await screen(t, { id: "nav45", group: "Configuration", label: "User management", url: "/user-management.html", title: "User management", offered: false, sidebar: false });
});
test("NAV46 User management's #roles deep link opens the User roles tab with its title and no script errors", async (t) => {
  // configuration-user-roles.html is now a thin redirect to /user-management.html#roles (same
  // page, same title "User management" -- the Users/User roles split is now an in-page tab,
  // not a separate screen or sidebar entry; "User roles" never had its own sidebar entry even
  // before the merge).
  await screen(t, { id: "nav46", group: "Configuration", label: "User management", url: "/user-management.html#roles", title: "User management", offered: false, sidebar: false });
});
test("NAV47 Configuration -> Eventing opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav47", group: "Configuration", label: "Eventing", url: "/?page=configurationEventing", title: "Eventing", activeDirect: false });
});
test("NAV48 Configuration -> App configs opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav48", group: "Configuration", label: "App configs", url: "/?page=configurationAppConfigs", title: "App configs", activeDirect: false });
});
test("NAV49 Configuration -> List boxes opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav49", group: "Configuration", label: "List boxes", url: "/configuration-list-boxes.html", title: "List boxes" });
});
test("NAV50 Configuration -> Improvements Log opens with its title and no script errors", async (t) => {
  await screen(t, { id: "nav50", group: "Configuration", label: "Improvements Log", url: "/improvements.html", title: "Improvements Log", sidebar: false });
});
test("NAV51 Configuration -> Functional access opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav51", group: "Configuration", label: "Functional access", url: "/?page=functionalAccess", title: "Functional access", activeDirect: false });
});
test("NAV52 Configuration -> Naming conventions opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav52", group: "Configuration", label: "Naming conventions", url: "/?page=naming", title: "Naming conventions", activeDirect: false });
});
test("NAV53 Configuration -> External systems opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav53", group: "Configuration", label: "External systems", url: "/?page=externalSystems", title: "External systems", activeDirect: false });
});
test("NAV54 Configuration -> Event Catalog opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav54", group: "Configuration", label: "Event Catalog", url: "/?page=eventCatalog", title: "Event Catalog", activeDirect: false });
});
test("NAV55 Configuration -> Application events opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav55", group: "Configuration", label: "Application events", url: "/?page=applicationEvents", title: "Application Events", activeDirect: false });
});
test("NAV56 Configuration -> Use-case templates opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav56", group: "Configuration", label: "Use-case templates", url: "/?page=useCaseTemplates", title: "Use-case templates", activeDirect: false });
});
test("NAV57 Configuration -> Feature IDs opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav57", group: "Configuration", label: "Feature IDs", url: "/?page=featureIds", title: "Feature IDs", activeDirect: false });
});
test("NAV58 Configuration -> Use-case review opens with its title, highlights its sidebar entry and has no script errors", async (t) => {
  await screen(t, { id: "nav58", group: "Configuration", label: "Use-case review", url: "/?page=useCaseReview", title: "Use-case review", activeDirect: false });
});
test("PG01 about.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg01", url: "/about.html", title: "Good rules survive bad data.", docTitle: "About — GARVIQ Labs" });
});
test("PG03 analytics-coverage-drift.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg03", url: "/analytics-coverage-drift.html", title: "Coverage drift" });
});
test("PG04 analytics-dashboard.html opens with its title and no script errors", { todo: "analytics-dashboard.html line ~101 uses slowestHost but never declares it: Uncaught ReferenceError: slowestHost is not defined (the slowest-cases list never loads)" }, async (t) => {
  await staticPage(t, { id: "pg04", url: "/analytics-dashboard.html", title: "Analytics dashboard" });
});
test("PG05 analytics-suite-compare.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg05", url: "/analytics-suite-compare.html", title: "Suite pass-rate comparison" });
});
test("PG06 analytics-suite-health.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg06", url: "/analytics-suite-health.html", title: "Suite health" });
});
test("PG07 attacks.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg07", url: "/attacks.html", title: "Attack history" });
});
test("PG08 authenticator.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg08", url: "/authenticator.html", title: "Authenticator login" });
});
test("PG09 bring-your-own-xsd.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg09", url: "/bring-your-own-xsd.html", title: "Bring your own XSD" });
});
test("PG10 configuration-api-access.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg10", url: "/configuration-api-access.html", title: "API access" });
});
test("PG11 configuration-app-configs.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg11", url: "/configuration-app-configs.html", title: "Application configuration" });
});
test("PG12 configuration-data-retention.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg12", url: "/configuration-data-retention.html", title: "Data retention" });
});
test("PG13 configuration-environment-defaults.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg13", url: "/configuration-environment-defaults.html", title: "Environment defaults" });
});
test("PG14 configuration-eventing.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg14", url: "/configuration-eventing.html", title: "Eventing" });
});
test("PG15 configuration-notifications.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg15", url: "/configuration-notifications.html", title: "Notifications" });
});
test("PG16 create-schema.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg16", url: "/create-schema.html", title: "Create schema" });
});
test("PG17 demo.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg17", url: "/demo.html", title: "Good rules survive bad data.", docTitle: "90-second demo — Sand Bench" });
});
test("PG18 event-framework.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg18", url: "/event-framework.html", title: "Event framework" });
});
test("PG19 external-systems.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg19", url: "/external-systems.html", title: "External systems" });
});
test("PG20 feature-ids.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg20", url: "/feature-ids.html", title: "Feature IDs" });
});
test("PG21 field-rules.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg21", url: "/field-rules.html", title: "Field rules" });
});
test("PG22 help-center.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg22", url: "/help-center.html", title: "Help Center" });
});
test("PG23 help.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg23", url: "/help.html", title: "Help" });
});
test("PG24 logging.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg24", url: "/logging.html", title: "System logging" });
});
test("PG25 mask-demo.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg25", url: "/mask-demo.html", title: "Same run, two tenants" });
});
test("PG26 message-data-files.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg26", url: "/message-data-files.html", title: "Saved test data files" });
});
test("PG27 message-designer-schema-register.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg27", url: "/message-designer-schema-register.html", title: "Schema register" });
});
test("PG28 naming.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg28", url: "/naming.html", title: "Naming conventions" });
});
test("PG29 not-production.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg29", url: "/not-production.html", title: "Sand Bench is the bench" });
});
test("PG30 pitch.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg30", url: "/pitch.html", title: "Good rules survive bad data.", docTitle: "Sand Bench — public URLs" });
});
test("PG31 postgres-inventory.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg31", url: "/postgres-inventory.html", title: "Postgres inventory" });
});
test("PG32 reference.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg32", url: "/reference.html", title: "ISO 20022 family reference" });
});
test("PG33 reports-runs.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg33", url: "/reports-runs.html", title: "Test run reports" });
});
test("PG34 reports-suites.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg34", url: "/reports-suites.html", title: "Test suite reports" });
});
test("PG35 rule-canvas.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg35", url: "/rule-canvas.html", title: "Rule Canvas" });
});
test("PG36 schema-canvas.html opens with its title and no script errors", { todo: "schema-canvas.html loads vendor/schema-canvas-flow.js, which needs a global React, but the page includes no React script at all: Uncaught ReferenceError: React is not defined" }, async (t) => {
  await staticPage(t, { id: "pg36", url: "/schema-canvas.html", title: "Schema canvas" });
});
test("PG37 schema-tree.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg37", url: "/schema-tree.html", title: "Import schema" });
});
test("PG38 security.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg38", url: "/security.html", title: "Security & cryptography" });
});
test("PG39 suite-evidence.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg39", url: "/suite-evidence.html", title: "Suite evidence pack" });
});
test("PG40 test-suite-new.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg40", url: "/test-suite-new.html", title: "New test suite" });
});
test("PG41 use-case.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg41", url: "/use-case.html", title: "Use case" });
});
test("PG42 use-case-acceptance.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg42", url: "/use-case-acceptance.html", title: "Use case", docTitle: "Use case — Acceptance criteria" });
});
test("PG43 use-case-contract.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg43", url: "/use-case-contract.html", title: "Use case", docTitle: "Use case — Action contract" });
});
test("PG44 use-case-coverage.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg44", url: "/use-case-coverage.html", title: "Use case", docTitle: "Use case — Coverage" });
});
test("PG45 use-case-diagram.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg45", url: "/use-case-diagram.html", title: "Use case", docTitle: "Use case — Diagram" });
});
test("PG46 use-case-flow.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg46", url: "/use-case-flow.html", title: "Use case", docTitle: "Use case — Cockburn flow" });
});
test("PG47 use-case-history.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg47", url: "/use-case-history.html", title: "Use case", docTitle: "Use case — History" });
});
test("PG48 use-case-identity.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg48", url: "/use-case-identity.html", title: "Use case", docTitle: "Use case — Identity" });
});
test("PG49 use-case-issues.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg49", url: "/use-case-issues.html", title: "Use case", docTitle: "Use case — Issue log" });
});
test("PG50 use-case-markdown.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg50", url: "/use-case-markdown.html", title: "Use case", docTitle: "Use case — Markdown" });
});
test("PG51 use-case-notes.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg51", url: "/use-case-notes.html", title: "Use case", docTitle: "Use case — Additional notes" });
});
test("PG52 use-case-review.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg52", url: "/use-case-review.html", title: "Use case review" });
});
test("PG53 use-case-steps.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg53", url: "/use-case-steps.html", title: "Use case", docTitle: "Use case — Steps" });
});
test("PG54 use-case-tables.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg54", url: "/use-case-tables.html", title: "Use case", docTitle: "Use case — Structured tables" });
});
test("PG55 use-case-templates.html opens with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg55", url: "/use-case-templates.html", title: "Use-case templates" });
});
test("PG56 application-events.html hands over to the console screen /?page=applicationEvents with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg56", url: "/application-events.html", title: "Application Events", finalUrl: "/?page=applicationEvents" });
});
test("PG57 configuration.html hands over to the console screen /?page=configuration with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg57", url: "/configuration.html", title: "Configuration", finalUrl: "/?page=configuration" });
});
test("PG58 imported-schemes.html hands over to the console screen /?page=schemeDefinitions with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg58", url: "/imported-schemes.html", title: "Scheme definitions", finalUrl: "/?page=schemeDefinitions" });
});
test("PG59 message-designer.html hands over to the console screen /?page=messageDesigner with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg59", url: "/message-designer.html", title: "Build a schema-ready message", finalUrl: "/?page=messageDesigner" });
});
test("PG60 overview.html hands over to the console screen /?page=overview with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg60", url: "/overview.html", title: "Good rules survive bad data.", finalUrl: "/?page=overview" });
});
test("PG61 patterns.html hands over to the console screen /?page=patterns with its title and no script errors", async (t) => {
  await staticPage(t, { id: "pg61", url: "/patterns.html", title: "Patterns", finalUrl: "/?page=patterns" });
});

// ------------------------------------------------------------------------------------------
// Proof that the error check bites: serve a broken copy of a page from a tiny proxy in front of
// the web tier (no repository file is touched) and see the very same check fail.
// ------------------------------------------------------------------------------------------
async function withProxy(mutate: (path: string, body: string) => string, fn: (base: string) => Promise<void>) {
  const server = http.createServer(async (req, res) => {
    try {
      const upstream = await fetch(`${ENV.webBase}${req.url}`, { headers: { accept: String(req.headers.accept || "*/*") } });
      let body = Buffer.from(await upstream.arrayBuffer());
      const type = upstream.headers.get("content-type") || "";
      if (/html/.test(type)) body = Buffer.from(mutate(String(req.url).split("?")[0]!, body.toString("utf8")));
      res.writeHead(upstream.status, { "content-type": type });
      res.end(body);
    } catch (error) { res.writeHead(502); res.end(String(error)); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  try { await fn(`http://127.0.0.1:${(server.address() as any).port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("NAVX1 the error check bites: external-systems.html with its old `.replace(/\"/g, \"\"\")` bug is reported as an uncaught SyntaxError, the fixed page is not", async (t) => {
  const h = await handle();
  if (!h) { t.skip("Selenium not reachable"); return; }
  const broken = (path: string, body: string) => (path === "/external-systems.html" ? body.replace('.replace(/"/g, "&quot;")', '.replace(/"/g, """)') : body);
  await withProxy(broken, async (base) => {
    const bad = await visit(h, { via: "url", url: `${base}/external-systems.html`, title: "External systems" });
    assert.equal(bad.title, "External systems", "the broken page still shows its heading, which is why 'page opens' cases missed it");
    assert.ok(bad.scriptErrors.some((e: any) => /SyntaxError/.test(e.message)), `the console log must show the SyntaxError, got ${JSON.stringify(brief(bad.otherSevere))}`);
  });
  await withProxy((_p, body) => body, async (base) => {
    const good = await visit(h, { via: "url", url: `${base}/external-systems.html`, title: "External systems" });
    assert.deepEqual(brief(good.scriptErrors), [], "the unmodified page through the same proxy has no script error");
  });
});

test("NAVX2 the error check bites: a runtime exception thrown while a page loads (ReferenceError) is caught too", async (t) => {
  const h = await handle();
  if (!h) { t.skip("Selenium not reachable"); return; }
  const injected = (path: string, body: string) => (path === "/naming.html" ? body.replace("</body>", "<script>doesNotExistAnywhere.value = 1;</script></body>") : body);
  await withProxy(injected, async (base) => {
    const bad = await visit(h, { via: "url", url: `${base}/naming.html`, title: "Naming conventions" });
    assert.ok(bad.scriptErrors.some((e: any) => /ReferenceError/.test(e.message) && /doesNotExistAnywhere/.test(e.message)), "the ReferenceError must be reported");
  });
});

test("NAVX3 the boot check bites: a page that says 'Official console JS did not boot' is flagged", async (t) => {
  const h = await handle();
  if (!h) { t.skip("Selenium not reachable"); return; }
  const injected = (path: string, body: string) => (path === "/about.html" ? body.replace("</body>", "<p>Official console JS did not boot.</p></body>") : body);
  await withProxy(injected, async (base) => {
    const bad = await visit(h, { via: "url", url: `${base}/about.html`, title: "Good rules survive bad data." });
    assert.equal(bad.boot, true);
    const good = await visit(h, { via: "url", url: `${ENV.webBase}/about.html`, title: "Good rules survive bad data." });
    assert.equal(good.boot, false);
  });
});

// ------------------------------------------------------------------------------------------
// Sign in / sign out
// ------------------------------------------------------------------------------------------
async function freshSession() {
  const { seleniumReady } = await import("../lib/selenium/webdriver.mjs");
  if (!(await seleniumReady())) return null;
  return openLoggedSession();
}
const gateShown = (sess: any) => sess.exec("const g=document.getElementById('gate'),r=document.getElementById('console-root');return !!g&&!g.classList.contains('hidden')&&(!r||r.classList.contains('hidden'));");

test("AUTH1 Sign out returns to the sign-in gate, removes the token from sessionStorage and localStorage, and the API rejects the old token with 401", async (t) => {
  const s = await freshSession();
  if (!s) { t.skip("Selenium not reachable"); return; }
  try {
    await enterConsole(s.sess);
    const token = (await storedTokens(s.sess)).session;
    assert.ok(token, "signed in: a token is held");
    assert.equal((await fetch(`${ENV.apiBase}/api/v1/datasets`, { headers: { authorization: `Bearer ${token}` } })).status, 200, "the token works before sign-out");
    await click(s.sess, "button.opsc-signout");
    await waitFor(() => gateShown(s.sess), { timeout: 20000, message: "the sign-in gate" });
    assert.deepEqual(await storedTokens(s.sess), { session: null, local: null });
    assert.equal(await s.sess.exec("return !document.getElementById('signed-out-note').classList.contains('hidden');"), true, "the 'You have been signed out' note is shown");
    for (const path of ["/api/v1/datasets", "/api/v1/session/me"]) {
      assert.equal((await fetch(`${ENV.apiBase}${path}`, { headers: { authorization: `Bearer ${token}` } })).status, 401, `${path} with the old token`);
    }
    await s.sess.go(`${ENV.webBase}/?page=msgImportSchema`);
    await sleep(1500);
    assert.equal(await gateShown(s.sess), true, "a deep link after sign-out shows the gate, not the page");
  } catch (error) { await saveShot(s.sess, "auth1"); throw error; } finally { await s.close(); }
});

test("AUTH2 Sign out on a standalone page (All feeders) also ends the session and returns to the gate", async (t) => {
  const s = await freshSession();
  if (!s) { t.skip("Selenium not reachable"); return; }
  try {
    await enterConsole(s.sess);
    const token = (await storedTokens(s.sess)).session;
    await s.sess.go(`${ENV.webBase}/data-feeders.html`);
    await waitFor(async () => (await text(s.sess, "h1")) === "All feeders", { message: "All feeders" });
    await click(s.sess, "[data-sbe-signout]");
    await waitFor(() => gateShown(s.sess), { timeout: 20000, message: "the sign-in gate" });
    assert.deepEqual(await storedTokens(s.sess), { session: null, local: null });
    assert.equal((await fetch(`${ENV.apiBase}/api/v1/data-feeders`, { headers: { authorization: `Bearer ${token}` } })).status, 401);
  } catch (error) { await saveShot(s.sess, "auth2"); throw error; } finally { await s.close(); }
});

test("AUTH3 a wrong password shows 'Sign-in failed', stays on the gate with no token, and the right password then signs in", async (t) => {
  const s = await freshSession();
  if (!s) { t.skip("Selenium not reachable"); return; }
  try {
    await s.sess.go(`${ENV.webBase}/`);
    await gateSignIn(s.sess, { password: "not-the-password" });
    await waitFor(async () => /Sign-in failed/.test(await text(s.sess, "#login-err")), { message: "the sign-in error" });
    assert.equal(await text(s.sess, "#login-err"), "Sign-in failed. Check the tenant, username and password.");
    assert.equal(await gateShown(s.sess), true);
    assert.deepEqual(await storedTokens(s.sess), { session: null, local: null });
    await gateSignIn(s.sess);
    await waitFor(() => s.sess.find("css selector", "#console-root:not(.hidden) .opsc-sidebar"), { timeout: 30000, message: "the console" });
    assert.ok((await storedTokens(s.sess)).session);
  } catch (error) { await saveShot(s.sess, "auth3"); throw error; } finally { await s.close(); }
});

test("AUTH4 an unknown tenant and an unknown user get the same error as a wrong password (nothing tells which part was wrong)", async (t) => {
  const s = await freshSession();
  if (!s) { t.skip("Selenium not reachable"); return; }
  try {
    await s.sess.go(`${ENV.webBase}/`);
    const messages: string[] = [];
    for (const who of [{ tenant: "no-such-tenant" }, { user: "no.such.user" }, { password: "wrong" }]) {
      await s.sess.exec("document.getElementById('login-err').textContent='';");
      await gateSignIn(s.sess, who);
      await waitFor(async () => /Sign-in failed/.test(await text(s.sess, "#login-err")), { message: "the sign-in error" });
      messages.push(await text(s.sess, "#login-err"));
    }
    assert.deepEqual([...new Set(messages)], ["Sign-in failed. Check the tenant, username and password."]);
    assert.deepEqual(await storedTokens(s.sess), { session: null, local: null });
    const api = await fetch(`${ENV.apiBase}/api/v1/session/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantSlug: ENV.tenantSlug, username: ENV.username, password: "wrong" }) });
    assert.equal(api.status, 401);
  } catch (error) { await saveShot(s.sess, "auth4"); throw error; } finally { await s.close(); }
});

test("AUTH5 the API is deny-by-default: no token and a garbage token both get 401 on a data route", async () => {
  for (const headers of [{}, { authorization: "Bearer not.a.token" }] as Array<Record<string, string>>) {
    const res = await fetch(`${ENV.apiBase}/api/v1/data-feeders`, { headers });
    assert.equal(res.status, 401, JSON.stringify(headers));
  }
});

test("AUTH6 the session survives a reload: the console comes back with the same token and no gate", async (t) => {
  const s = await freshSession();
  if (!s) { t.skip("Selenium not reachable"); return; }
  try {
    await enterConsole(s.sess);
    const token = (await storedTokens(s.sess)).session;
    await s.sess.refresh();
    await waitFor(() => s.sess.find("css selector", "#console-root:not(.hidden) .opsc-sidebar"), { timeout: 30000, message: "the console after reload" });
    assert.equal((await storedTokens(s.sess)).session, token);
  } catch (error) { await saveShot(s.sess, "auth6"); throw error; } finally { await s.close(); }
});

test("AUTH7 signing in on a deep link (/?page=msgImportSchema) lands on that screen", async (t) => {
  const s = await freshSession();
  if (!s) { t.skip("Selenium not reachable"); return; }
  try {
    await s.sess.go(`${ENV.webBase}/?page=msgImportSchema`);
    await gateSignIn(s.sess);
    await waitFor(async () => (await titleInfo(s.sess)).text === "Import schema", { timeout: 30000, message: "Import schema after sign-in" });
  } catch (error) { await saveShot(s.sess, "auth7"); throw error; } finally { await s.close(); }
});

// ------------------------------------------------------------------------------------------
// Deep links: /?page=<id> reloads into the right screen
// ------------------------------------------------------------------------------------------
async function deepLink(t: any, id: string, title: string) {
  const h = await handle();
  if (!h) { t.skip("Selenium not reachable"); return; }
  try {
    const first = await visit(h, { via: "url", url: `/?page=${id}`, title });
    assert.equal(first.title, title, "opens on the wanted screen");
    await readBrowserLog(h);
    await h.sess.refresh();
    await waitFor(async () => (await titleInfo(h.sess)).text === title, { timeout: 20000, message: `${title} after a reload` });
    assert.ok(String(await h.sess.url()).includes(`page=${id}`), "the address keeps ?page=");
    await sleep(1000);
    assert.deepEqual(brief(scriptErrors(await readBrowserLog(h))), [], "uncaught errors after the reload");
  } catch (error) { await saveShot(h.sess, `deep-${id}`); throw error; }
}

test("DEEP1 /?page=msgImportSchema opens Import schema and a reload stays there", async (t) => { await deepLink(t, "msgImportSchema", "Import schema"); });
test("DEEP2 /?page=schemeDefinitions opens Scheme definitions and a reload stays there", async (t) => { await deepLink(t, "schemeDefinitions", "Scheme definitions"); });
test("DEEP3 /?page=trHistory opens Run history and a reload stays there", async (t) => { await deepLink(t, "trHistory", "Run history"); });
test("DEEP4 /?page=configurationEventing opens Eventing and a reload stays there", async (t) => { await deepLink(t, "configurationEventing", "Eventing"); });
test("DEEP5 /?page=externalSystems opens External systems and a reload stays there", async (t) => { await deepLink(t, "externalSystems", "External systems"); });
test("DEEP6 /?page=patterns opens Patterns and a reload stays there", async (t) => { await deepLink(t, "patterns", "Patterns"); });

test("DEEP7 a sidebar click puts ?page=<id> in the address, and reloading reopens that screen instead of Overview", async (t) => {
  const h = await handle();
  if (!h) { t.skip("Selenium not reachable"); return; }
  try {
    await openConsoleHome(h.sess);
    await clickSidebar(h.sess, "Message Schemes", "Scheme Definitions");
    await waitFor(async () => (await titleInfo(h.sess)).text === "Scheme definitions", { message: "Scheme definitions" });
    assert.ok(String(await h.sess.url()).includes("page=schemeDefinitions"), String(await h.sess.url()));
    await h.sess.refresh();
    await waitFor(async () => (await titleInfo(h.sess)).text === "Scheme definitions", { timeout: 20000, message: "Scheme definitions after reload" });
  } catch (error) { await saveShot(h.sess, "deep7"); throw error; }
});

test("DEEP8 an unknown page id (/?page=doesNotExist) does not break the console: no script errors, and the shell and sidebar still work", async (t) => {
  const h = await handle();
  if (!h) { t.skip("Selenium not reachable"); return; }
  try {
    await readBrowserLog(h);
    await h.sess.go(`${ENV.webBase}/?page=doesNotExist`);
    await waitFor(() => h.sess.find("css selector", "#console-root:not(.hidden) .opsc-sidebar"), { timeout: 30000, message: "the console shell" });
    await sleep(1500);
    assert.deepEqual(brief(scriptErrors(await readBrowserLog(h))), []);
    await clickSidebar(h.sess, "Patterns", "Patterns");
    await waitFor(async () => (await titleInfo(h.sess)).text === "Patterns", { message: "Patterns after the unknown page" });
  } catch (error) { await saveShot(h.sess, "deep8"); throw error; }
});

// ------------------------------------------------------------------------------------------
// Known gaps, kept truthful (todo: they run, show in the engine, and do not fail the gate)
// ------------------------------------------------------------------------------------------
const CONFIG_CONSOLE_PAGES: Array<[string, string]> = [
  ["configuration", "Configuration"], ["configurationEnvironmentDefaults", "Environment defaults"], ["configurationNotifications", "Notifications"],
  ["configurationApiAccess", "API access"], ["configurationDataRetention", "Data retention"], ["configurationEventing", "Eventing"],
  ["configurationAppConfigs", "App configs"], ["functionalAccess", "Functional access"], ["naming", "Naming conventions"],
  ["externalSystems", "External systems"], ["eventCatalog", "Event Catalog"], ["applicationEvents", "Application events"],
  ["useCaseTemplates", "Use-case templates"], ["featureIds", "Feature IDs"], ["useCaseReview", "Use-case review"],
];

test("NAVH1 a deep link or reload on any Configuration screen keeps the Configuration group open and its entry highlighted", { todo: "part-02.js Sidebar.findParentKey() only searches CONFIG.nav.workspace, so /?page=<configuration page> loads with nothing expanded or highlighted (clicking the entry does highlight it)" }, async (t) => {
  const h = await handle();
  if (!h) { t.skip("Selenium not reachable"); return; }
  const lost: string[] = [];
  for (const [id, label] of CONFIG_CONSOLE_PAGES) {
    await h.sess.go(`${ENV.webBase}/?page=${id}`);
    await waitFor(() => h.sess.find("css selector", "#console-root:not(.hidden) .opsc-sidebar"), { timeout: 30000, message: "the console" });
    await sleep(1200);
    const s = await sidebarState(h.sess);
    if (!(s.expanded.includes("Configuration") && s.active.includes(label))) lost.push(label);
  }
  assert.deepEqual(lost, [], "these Configuration screens lose their sidebar position on a deep link");
});

test("NAVH2 AI Authoring pages and the Improvements Log keep the console sidebar so the person can see where they are", { todo: "ai-authoring-*.html and improvements.html are bare documents with no sidebar: after one sidebar click the menu is gone" }, async (t) => {
  const h = await handle();
  if (!h) { t.skip("Selenium not reachable"); return; }
  const bare: string[] = [];
  for (const url of ["/ai-authoring-generate.html", "/ai-authoring-from-use-case.html", "/ai-authoring-drafts.html", "/ai-authoring-review.html", "/improvements.html"]) {
    await h.sess.go(`${ENV.webBase}${url}`);
    await sleep(1500);
    if (!(await sidebarState(h.sess)).present) bare.push(url);
  }
  assert.deepEqual(bare, []);
});
