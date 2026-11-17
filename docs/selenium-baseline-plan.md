# Sand Bench — Screen-Based Selenium Baseline Test Plan

> **App:** Sand Bench · GARVIQ Labs (http://localhost:8080/)
> **Framework:** `apps/selenium-baseline/` (TypeScript, Selenium WebDriver 4.x)
> **Date:** 2026-09-27

---

## App Navigation Structure (from sidebar)

| # | Section | Sub-items |
|---|---------|-----------|
| 1 | **Overview** | — |
| 2 | **Patterns** | — |
| 3 | **Rule Bench** | Existing rules, Create new rule, Stage rules, Validate rules, Export rules |
| 4 | **Message Designer** | Create message definition, View saved definitions, Saved test data, Import schema, Export template, Schema register, Create schema, Schema canvas |
| 5 | **Message Schemes** | — |
| 6 | **Datasets** | — |
| 7 | **Data Feeders** | — |
| 8 | **Test Cases** | All test cases, New test case |
| 9 | **Test Suites** | All test suites, New test suite |
| 10 | **Test Runs** | Active, All test runs, history, New test run |
| 11 | **Schedules** | Upcoming, All schedules, New schedule |
| 12 | **Reports** | All reports, Test run reports, Test suite reports, Coverage, Compliance, Scheduled exports |
| 13 | **Configuration** | Environment defaults, Notifications, API access, Data retention, User roles, Eventing, App configs, Functional access, Naming, External systems, Use-case templates, Feature IDs, Use-case review, Application Events |

**Static pages:** `/`, `/help.html`, `/about.html`, `/demo.html`, `/not-production.html`, `/bring-your-own-xsd.html`, `/mask-demo.html`, `/security.html`

---

## Baseline Test Plan — Screen-by-Screen

### Tier 1: Critical Path (run every baseline cycle)

These screens are the highest-risk user journeys. A failure here blocks production readiness.

| Priority | Screen | Menu Path | What to Validate |
|----------|--------|-----------|-----------------|
| P0 | Overview | Overview | Hero text "Good rules survive bad data.", stats cards (Active runs, Messages, Rules, Accuracy), chart renders |
| P0 | Rule Bench → Existing rules | Rule Bench → Existing rules | Rules table loads, "Create" button present |
| P0 | Rule Bench → Create new rule | Rule Bench → Create new rule | Name + Category fields, Save button |
| P0 | Test Runs → New test run | Test Runs → New test run | Channel selectors (File/API/MQ/Kafka), Start button |
| P0 | Configuration | Configuration | MQ + Kafka sections, test-connection controls |
| P0 | Login gate | — (initial load) | Tenant + username + password fields, auto-mount after sign-in |

### Tier 2: Full navigation coverage (run weekly / pre-release)

Every leaf page in the sidebar, validated for correct page header render.

| Section | Screen | Expected Page Header |
|---------|--------|---------------------|
| Overview | Overview | "Good rules survive bad data." |
| Rule Bench | Existing rules | "Existing rules" |
| Rule Bench | Create new rule | "Create new rule" |
| Rule Bench | Stage rules | "Stage rules" |
| Rule Bench | Validate rules | "Validate rules" |
| Rule Bench | Export rules | "Export rules" |
| Message Designer | Create message definition | "Build a schema-ready message" |
| Message Designer | View saved definitions | "Saved message definitions" |
| Message Designer | Import schema | "Import schema" |
| Message Designer | Export template | "Export template" |
| Message Designer | Schema register | (check for "Schema register" content) |
| Message Designer | Create schema | (check for "Generate schema" control) |
| Message Designer | Schema canvas | (check for "Add child" control) |
| Datasets | Datasets | "Datasets" |
| Test Cases | All test cases | "All test cases" |
| Test Cases | New test case | "New test case" |
| Test Suites | All test suites | "All test suites" |
| Test Suites | New test suite | "New test suite" |
| Test Runs | Active runs | "Active runs" |
| Test Runs | All test runs | "All test runs" |
| Test Runs | Run history | "Run history" |
| Test Runs | New test run | "New test run" |
| Schedules | Upcoming schedules | "Upcoming schedules" |
| Schedules | All schedules | "All schedules" |
| Schedules | New schedule | "New schedule" |
| Reports | All reports | "All reports" |
| Reports | Coverage reports | "Coverage reports" |
| Reports | Compliance reports | "Compliance reports" |
| Reports | Scheduled exports | "Scheduled exports" |
| Configuration | Environment defaults | "Environment defaults" |
| Configuration | Notifications | "Notifications" |
| Configuration | API access | "API access" |
| Configuration | Data retention | "Data retention" |
| Configuration | User roles | "User roles" |
| Configuration | Eventing | "Eventing" |
| Configuration | App configs | "App configs" |
| Configuration | Functional access | "Functional access" |
| Configuration | Naming conventions | "Naming conventions" |
| Configuration | External systems | "External systems" |
| Configuration | Use-case templates | "Use-case templates" |
| Configuration | Feature IDs | "Feature IDs" |
| Configuration | Use-case review | "Use-case review" |
| Configuration | Application Events | "Application Events" |
| Static | /help.html | "Help" |
| Static | /about.html | "About" |
| Static | /demo.html | "N-2 demo" |
| Static | /not-production.html | "Not production" |
| Static | /bring-your-own-xsd.html | "BYO XSD" |
| Static | /mask-demo.html | "Mask demo" |
| Static | /security.html | "Security" |

### Tier 3: Field & control presence (run on demand / post-deploy)

For each screen, verify the expected form fields and controls are present.

| Screen | Expected Fields | Expected Controls |
|--------|----------------|-------------------|
| Rule Bench → Create new rule | name, category | Save |
| Message Designer → Create message definition | name | Save, Generate |
| Message Designer → Import schema | name | Upload |
| Datasets → Create new dataset | name | Save |
| Test Cases → New test case | name | Save draft, Create and close |
| Test Suites → New test suite | name | Save |
| Schedules → New schedule | name | Save |
| Configuration → Naming | prefix | Save |

### Tier 4: Workflow + data integrity (run pre-release)

End-to-end flows that write to the database and verify persistence.

| Workflow | Steps | DB Verification |
|----------|-------|-----------------|
| Rule creation | Open Rule Bench → Create new rule → set name + category → Save | `detection_rules` row matches submitted values |
| Test run start | Open Test Runs → New test run → set name → Start | `test_runs` row appears with correct channel |
| Schedule creation | Open Schedules → New schedule → set name + frequency → Create | `run_schedules` row matches submitted values |

---

## Running the Baseline

### Prerequisites

```bash
# Selenium Grid or standalone ChromeDriver must be reachable
export SIT_SELENIUM_URL=http://127.0.0.1:4444   # default
export TARGET_BASE_URL=http://localhost:8080
export SELENIUM_BROWSER=chrome
export SELENIUM_HEADLESS=true
```

### CLI

```bash
# Full baseline — all menu items
npm run selenium:baseline

# Subset of critical screens
TARGET_BASE_URL=http://localhost:8080 \
npm run selenium:baseline -- --menuFilter "Overview" "Rule Bench" "Test Runs" "Configuration"
```

### Programmatic API

```typescript
import { runBaseline } from '@gavriq/selenium-baseline';

const result = await runBaseline({
  config: { baseUrl: 'http://localhost:8080' },
  menuFilter: ['Overview', 'Rule Bench', 'Configuration'],
});

if (!result.passed) {
  console.error(result.jsonReport);
  process.exit(1);
}
```

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TARGET_BASE_URL` | `http://localhost:8001` | App base URL |
| `SELENIUM_TIMEOUT_MS` | `15000` | Operation timeout |
| `SELENIUM_BROWSER` | `chrome` | chrome / firefox / edge |
| `SELENIUM_HEADLESS` | `true` | Headless mode |
| `REPORTING_DIR` | `./evidence/selenium-baseline` | Screenshot output |
| `LOCATOR_STRATEGY` | `css` | css / xpath / id / name |
| `MENU_CONTAINER_SELECTOR` | `.opsc-nav` | Sidebar nav container |
| `MENU_ITEM_SELECTOR` | `.opsc-navitem` | Nav item selector |
| `NAVIGATION_DELAY_MS` | `500` | SPA transition wait |

---

## Output Formats

- **Prompt-style** (stdout) — human-readable, suitable for issue trackers
- **JSON** (`jsonReport`) — machine-readable for CI pipelines
- **Screenshots** — saved to `REPORTING_DIR/` as `baseline-<screen-name>.png`
- **Stability rating** — Stable / Partially Stable / Unstable
- **Failure classification** — Navigation / UI Missing / Menu Changed / Error Message

---

## Gap Analysis: Existing SIT Cases vs. Baseline Plan

| Coverage | SIT Cases | Baseline Framework |
|----------|-----------|-------------------|
| Per-page header check | ✅ 70-ui-pages.sit.ts | ✅ ScreenValidator |
| Field/control presence | ✅ 62-selenium-fields.sit.ts | ✅ custom ValidationCheck |
| Workflow + DB integrity | ✅ 80-ui-workflows.sit.ts | ✅ workflow.ts (runWorkflowChecks) |
| Static page look-and-feel | ✅ 61-selenium-screens.sit.ts | ✅ STATIC_PAGES contract |
| Menu structure stability | ✅ 90-menu-stability.sit.ts | ✅ MenuNavigator.compareMenuStates |
| Screenshot evidence | ✅ saveShot() | ✅ captureScreenshot() |
| CI/CD integration | node:test runner | CLI exit codes + JSON report |
| Configuration sub-pages | ✅ 70-ui-pages.sit.ts (filled) | ✅ ScreenValidator |

**Recommendation:** The baseline framework covers navigation + screen validation + stability tracking + DB-persistence workflows. The SIT cases cover page headers, field presence, menu stability, and DB integrity. Use both: baseline for regression detection on every commit, SIT for pre-release data-integrity validation.
