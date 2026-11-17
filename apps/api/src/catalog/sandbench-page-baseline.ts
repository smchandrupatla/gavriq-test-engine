/**
 * Page identity — what the browser tab and the visible heading say on every page the
 * Sand Bench deployment serves. Verified against Sand Bench commit a8d72039ae8e (main, as
 * deployed on staging) on 2026-11-14 by opening every page in a signed-in browser; the
 * values are what a user sees once the page has settled, not what the HTML source starts with.
 *
 * Kept explicit: a missing page, a redirect to the sign-in page or a fall-back to another
 * screen must fail instead of looking like a successful deep link.
 *
 * How the current application serves a page, which is why these values differ from the file:
 *   - Every descriptive address (/test-cases.html) is redirected to an opaque one (/v/<id>);
 *     the page shown is the same document.
 *   - Five addresses open a screen of the console itself instead of their own document
 *     (apps/web/public/js/console-screen.js, CONSOLE_SCREENS): Overview, Create message
 *     definition, Imported schemes (now "Scheme definitions"), Application events, and
 *     Patterns. They carry the console's tab title and the screen's own heading.
 *   - Four retired addresses forward to the screen that replaced them: Users and User roles
 *     to User management, Kafka endpoints and External systems to Connections.
 *   - Some headings are written by the page's script after it loads (All feeders, New data
 *     feeder, All stubs, Audit); the steps below therefore wait for the settled heading.
 *   - Three pages have no heading element at all; their identity is the nearest visible
 *     title (flagged as an accessibility gap by the element checks, not hidden here).
 */
const PAGE_IDENTITIES: Record<string, { title: string; selector: string; text: string }> = {
  "/?page=msgImportSchema": {"title":"Sand Bench · GAVRIQ Labs","selector":"h1.opsc-hero-title:visible","text":"Import schema"},
  "/?page=schemeDefinitions": {"title":"Sand Bench · GAVRIQ Labs","selector":"h1.opsc-hero-title:visible","text":"Scheme definitions"},
  "/about.html": {"title":"About — GAVRIQ Labs","selector":"h1:visible","text":"Good rules survive bad data."},
  "/administration.html": {"title":"Administration","selector":"h1:visible","text":"Administration"},
  "/ai-authoring-drafts.html": {"title":"AI draft list","selector":"h1:visible","text":"AI draft list"},
  "/ai-authoring-from-use-case.html": {"title":"Generate from use-case text","selector":"h1:visible","text":"Generate from use-case text"},
  "/ai-authoring-generate.html": {"title":"AI draft generate","selector":"h1:visible","text":"AI draft generate"},
  "/ai-authoring-review.html": {"title":"AI draft review","selector":"h1:visible","text":"AI draft review"},
  "/analytics-coverage-drift.html": {"title":"Coverage drift — c8 summary","selector":"h1:visible","text":"Coverage drift"},
  "/analytics-dashboard.html": {"title":"Analytics dashboard","selector":"h1:visible","text":"Analytics dashboard"},
  "/analytics-env-compare.html": {"title":"Environment pass-rate comparison","selector":"h1:visible","text":"Environment pass-rate comparison"},
  "/analytics-pass-fail-heatmap.html": {"title":"Pass/fail heatmap by day of week","selector":"h1:visible","text":"Pass/fail heatmap by day of week"},
  "/analytics-suite-compare.html": {"title":"Suite pass-rate comparison","selector":"h1:visible","text":"Suite pass-rate comparison"},
  "/analytics-suite-health.html": {"title":"Suite health score","selector":"h1:visible","text":"Suite health"},
  "/api-keys.html": {"title":"API Keys · Sand Bench","selector":"h1:visible","text":"API Keys"},
  "/application-events.html": {"title":"Sand Bench · GAVRIQ Labs","selector":"h1.opsc-hero-title:visible","text":"Application Events"},
  "/attacks.html": {"title":"Sand Bench · Attack history","selector":"h1:visible","text":"Attack history"},
  "/authenticator.html": {"title":"Authenticator login","selector":"h1:visible","text":"Authenticator login"},
  "/bring-your-own-xsd.html": {"title":"Bring your own XSD — Sand Bench","selector":"h1:visible","text":"Bring your own XSD"},
  "/business-use-cases.html": {"title":"Sand Bench — Business Use Cases","selector":".buc-topbar-title:visible","text":"Business use cases"},
  "/configuration-api-access.html": {"title":"API access","selector":"h1:visible","text":"API access"},
  "/configuration-app-configs.html": {"title":"Application configuration","selector":"h1:visible","text":"Application configuration"},
  "/configuration-data-retention.html": {"title":"Data retention","selector":"h1:visible","text":"Data retention"},
  "/configuration-environment-defaults.html": {"title":"Environment defaults","selector":"h1:visible","text":"Environment defaults"},
  "/configuration-eventing.html": {"title":"Eventing","selector":"h1:visible","text":"Eventing"},
  "/configuration-import-schema-limits.html": {"title":"Import schema limits","selector":"h1:visible","text":"Import schema limits"},
  "/configuration-list-boxes.html": {"title":"List boxes","selector":"h1:visible","text":"List boxes"},
  "/configuration-notifications.html": {"title":"Notifications","selector":"h1:visible","text":"Notifications"},
  "/configuration-onboarding-journey.html": {"title":"Onboarding Journey","selector":"h1:visible","text":"Onboarding Journey"},
  "/configuration-user-roles.html": {"title":"User management","selector":"h1:visible","text":"User management"},
  "/configuration-users.html": {"title":"User management","selector":"h1:visible","text":"User management"},
  "/configuration.html": {"title":"Configuration","selector":"h1:visible","text":"Configuration"},
  "/connections.html": {"title":"Kafka connections — Sand Bench","selector":"h1:visible","text":"Connections · Kafka"},
  "/create-schema.html": {"title":"Create schema · Sand Bench","selector":"h1:visible","text":"Create schema"},
  "/data-access.html": {"title":"Data access","selector":"h1:visible","text":"Data access"},
  "/data-feeder-current-runs.html": {"title":"Current feeder runs","selector":"h1:visible","text":"Current runs"},
  "/data-feeder-form.html": {"title":"New feeder","selector":"h1:visible","text":"New data feeder"},
  "/data-feeder-past-runs.html": {"title":"Past feeder runs","selector":"h1:visible","text":"Past runs"},
  "/data-feeders.html": {"title":"All feeders","selector":"h1:visible","text":"All feeders"},
  "/data-responder-audit.html": {"title":"Data Responder Audit","selector":"h1:visible","text":"Audit"},
  "/data-responder-detail.html": {"title":"Stub detail","selector":"h1:visible","text":"Stub detail"},
  "/data-responder-form.html": {"title":"New stub","selector":"h1:visible","text":"New Data Responder stub"},
  "/data-responders.html": {"title":"All stubs","selector":"h1:visible","text":"All stubs"},
  "/datasets-new.html": {"title":"Create new dataset","selector":"h1:visible","text":"Create new dataset"},
  "/datasets.html": {"title":"Saved datasets","selector":"h1:visible","text":"Saved datasets"},
  "/demo.html": {"title":"90-second demo — Sand Bench","selector":"h1:visible","text":"Good rules survive bad data."},
  "/event-framework.html": {"title":"Event framework","selector":"h1:visible","text":"Event framework"},
  "/external-systems.html": {"title":"Kafka connections — Sand Bench","selector":"h1:visible","text":"Connections · Kafka"},
  "/feature-ids.html": {"title":"Feature IDs","selector":"h1:visible","text":"Feature IDs"},
  "/field-rules.html": {"title":"Field rules","selector":"h1:visible","text":"Field rules"},
  "/help-center.html": {"title":"Help Center — Sand Bench","selector":"h1:visible","text":"Help Center"},
  "/help.html": {"title":"Help — GAVRIQ Labs Sand Bench","selector":"h1:visible","text":"Help"},
  "/imported-schemes.html": {"title":"Sand Bench · GAVRIQ Labs","selector":"h1.opsc-hero-title:visible","text":"Scheme definitions"},
  "/improvements.html": {"title":"Improvements Log · Sand Bench","selector":"h1:visible","text":"Improvements Log"},
  "/kafka-endpoints.html": {"title":"Kafka connections — Sand Bench","selector":"h1:visible","text":"Connections · Kafka"},
  "/logging.html": {"title":"System logging","selector":"h1:visible","text":"System logging"},
  "/mask-demo.html": {"title":"Masking slide — Sand Bench","selector":"h1:visible","text":"Same run, two tenants"},
  "/message-data-files.html": {"title":"Saved test data files","selector":"h1:visible","text":"Saved test data files"},
  "/message-designer-export-template.html": {"title":"Export message definition","selector":"h1:visible","text":"Export message definition"},
  "/message-designer-import-definition.html": {"title":"Import message definition","selector":"h1:visible","text":"Import message definition"},
  "/message-designer-saved.html": {"title":"View saved definitions","selector":"h1:visible","text":"Saved message definitions"},
  "/message-designer-schema-register.html": {"title":"Schema register","selector":"h1:visible","text":"Schema register"},
  "/message-designer.html": {"title":"Sand Bench · GAVRIQ Labs","selector":"h1.opsc-hero-title:visible","text":"Build a schema-ready message"},
  "/my-sessions.html": {"title":"My sessions","selector":"h1:visible","text":"My sessions"},
  "/naming.html": {"title":"Naming conventions","selector":"h1:visible","text":"Naming conventions"},
  "/not-found.html": {"title":"Not found — Sand Bench","selector":"h1:visible","text":"Page not found"},
  "/not-production.html": {"title":"Not production — Sand Bench","selector":"h1:visible","text":"Sand Bench is the bench"},
  "/overview.html": {"title":"Sand Bench · GAVRIQ Labs","selector":"h1.opsc-hero-title:visible","text":"Good rules survive bad data."},
  "/patterns.html": {"title":"Sand Bench · GAVRIQ Labs","selector":"h1.opsc-hero-title:visible","text":"Patterns"},
  "/pitch.html": {"title":"Sand Bench — public URLs","selector":"h1:visible","text":"Good rules survive bad data."},
  "/postgres-inventory.html": {"title":"Postgres inventory","selector":"h1:visible","text":"Postgres inventory"},
  "/reference.html": {"title":"ISO 20022 family reference","selector":"h1:visible","text":"ISO 20022 family reference"},
  "/reports-all.html": {"title":"All reports","selector":"h1:visible","text":"All reports"},
  "/reports-compliance.html": {"title":"Compliance reports","selector":"h1:visible","text":"Compliance reports"},
  "/reports-coverage.html": {"title":"Coverage reports","selector":"h1:visible","text":"Coverage reports"},
  "/reports-runs.html": {"title":"Test run reports","selector":"h1:visible","text":"Test run reports"},
  "/reports-scheduled.html": {"title":"Scheduled exports","selector":"h1:visible","text":"Scheduled exports"},
  "/reports-suites.html": {"title":"Test suite reports","selector":"h1:visible","text":"Test suite reports"},
  "/rule-bench-create.html": {"title":"Create new rule","selector":"h1:visible","text":"Create new rule"},
  "/rule-bench-detail.html": {"title":"Sand Bench · Rule detail","selector":"h1:visible","text":"Rule detail"},
  "/rule-bench-existing.html": {"title":"Sand Bench · Existing rules","selector":"h1:visible","text":"Existing rules"},
  "/rule-bench-export.html": {"title":"Export rules","selector":"h1:visible","text":"Export rules"},
  "/rule-bench-stage.html": {"title":"Stage rules","selector":"h1:visible","text":"Stage rules"},
  "/rule-bench-validate.html": {"title":"Validate rules","selector":"h1:visible","text":"Validate rules"},
  "/rule-canvas.html": {"title":"Rule Canvas","selector":"h1:visible","text":"Rule Canvas"},
  "/rule-canvas/": {"title":"Sand Bench Rule Canvas","selector":"header strong:visible","text":"Rule Canvas"},
  "/schedules-all.html": {"title":"All schedules","selector":"h1:visible","text":"All schedules"},
  "/schedules-new.html": {"title":"New schedule","selector":"h1:visible","text":"New schedule"},
  "/schedules-upcoming.html": {"title":"Upcoming schedules","selector":"h1:visible","text":"Upcoming schedules"},
  "/schema-canvas.html": {"title":"Schema canvas — Sand Bench","selector":"h1:visible","text":"Schema canvas"},
  "/schema-converter.html": {"title":"Sand Bench · Schema Converter","selector":"h1:visible","text":"Schema Converter"},
  "/schema-tree.html": {"title":"Sand Bench · Schema and file tree","selector":".opsc-pagehead-title:visible","text":"Import schema"},
  "/security.html": {"title":"Sand Bench security","selector":"h1:visible","text":"Security & cryptography"},
  "/shell-demo.html": {"title":"Shell demo — Sand Bench","selector":"h1:visible","text":"Application shell demo"},
  "/suite-evidence.html": {"title":"Suite evidence pack","selector":"h1:visible","text":"Suite evidence pack"},
  "/test-case-form.html": {"title":"Test case form","selector":"h1:visible","text":"New test case"},
  "/test-cases.html": {"title":"Test cases","selector":"h1:visible","text":"Test cases"},
  "/test-coverage.html": {"title":"Test coverage","selector":"h1:visible","text":"Test coverage"},
  "/test-runs-active.html": {"title":"Active runs","selector":"h1:visible","text":"Active runs"},
  "/test-runs-all.html": {"title":"All test runs","selector":"h1:visible","text":"All test runs"},
  "/test-runs-new.html": {"title":"New test run","selector":"h1:visible","text":"New test run"},
  "/test-suite-form.html": {"title":"New test suite","selector":".opsc-crumbs b:visible","text":"New test suite"},
  "/test-suite-new.html": {"title":"New test suite","selector":"h1:visible","text":"New test suite"},
  "/test-suites.html": {"title":"Test suites","selector":"h1:visible","text":"Test suites"},
  "/use-case-acceptance.html": {"title":"Use case — Acceptance criteria","selector":"h1:visible","text":"Use case"},
  "/use-case-contract.html": {"title":"Use case — Action contract","selector":"h1:visible","text":"Use case"},
  "/use-case-coverage.html": {"title":"Use case — Coverage","selector":"h1:visible","text":"Use case"},
  "/use-case-diagram.html": {"title":"Use case — Diagram","selector":"h1:visible","text":"Use case"},
  "/use-case-flow.html": {"title":"Use case — Cockburn flow","selector":"h1:visible","text":"Use case"},
  "/use-case-history.html": {"title":"Use case — History","selector":"h1:visible","text":"Use case"},
  "/use-case-identity.html": {"title":"Use case — Identity","selector":"h1:visible","text":"Use case"},
  "/use-case-issues.html": {"title":"Use case — Issue log","selector":"h1:visible","text":"Use case"},
  "/use-case-markdown.html": {"title":"Use case — Markdown","selector":"h1:visible","text":"Use case"},
  "/use-case-notes.html": {"title":"Use case — Additional notes","selector":"h1:visible","text":"Use case"},
  "/use-case-review.html": {"title":"Use case review","selector":"h1:visible","text":"Use case review"},
  "/use-case-steps.html": {"title":"Use case — Steps","selector":"h1:visible","text":"Use case"},
  "/use-case-tables.html": {"title":"Use case — Structured tables","selector":"h1:visible","text":"Use case"},
  "/use-case-templates.html": {"title":"Use-case templates","selector":"h1:visible","text":"Use-case templates"},
  "/use-case.html": {"title":"Sand Bench — Use case sections","selector":"h1:visible","text":"Use case"},
  "/user-management.html": {"title":"User management","selector":"h1:visible","text":"User management"},
};

/** The identity recorded for a page, or undefined when the page is not in the baseline. */
export function pageIdentity(path: string) {
  return PAGE_IDENTITIES[path];
}

export function pageIdentitySteps(path: string, name: string) {
  // A page absent from the baseline still gets real assertions.
  // Its missing identity remains a failure for review; no generic body fallback.
  const identity = PAGE_IDENTITIES[path] || { title: name, selector: "h1:visible", text: name };
  // The heading is looked for by its own words, so a page that is still being drawn (or is on
  // its way to the screen that replaced it) is waited for rather than read half-finished.
  const heading = `${identity.selector}:has-text(${JSON.stringify(identity.text)})`;
  return [
    { action: "wait_for", selector: heading, timeout_ms: 20000, description: "the page heading is visible", text: `Wait until the page heading "${identity.text}" is shown` },
    { action: "assert_title", expected: identity.title, description: "the browser title identifies the requested page" },
    { action: "assert_selector_text", selector: heading, expected: identity.text, description: "the visible heading identifies the requested page", text: `Check the page heading reads "${identity.text}"` },
  ];
}
