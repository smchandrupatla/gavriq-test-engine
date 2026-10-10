# E2E GUI tests — coverage status per category

Honest snapshot of how far the "every category" spec in `apps/api/src/catalog/sandbench-e2e-gui-cases.ts` is actually implemented against the engine's current model.

The engine runs catalog cases through four runner methods: `http`, `playwright`, `selenium`, `performance`, plus `e2e` (tester-army/e2e, agent-driven). The runner methods are code in `apps/worker/src/runners/`; adding a method is a non-trivial change (new runner, new worker capability, new catalog step vocabulary).

## Standing rule set 2026-10-10

**Every new GUI test case must fan out across all screen sizes AND all browsers.** The matrix flatMaps in `sandbench-e2e-gui-cases.ts` handle this automatically: appending a page to `PAGES`, a viewport to `VIEWPORTS`, or a browser to `BROWSERS` regenerates the full cartesian product. New hand-written GUI cases that don't fit a flatMap must still be explicitly spread across the six browsers (chromium, chrome, edge, firefox, webkit, safari) and, where behaviour is viewport-sensitive, across the thirteen viewports.

The worker image installs five browser channels: Playwright's bundled Chromium / Firefox / WebKit, plus Google Chrome stable and Microsoft Edge stable via `playwright install chrome msedge`. On Linux workers "Safari" uses the same Playwright WebKit engine; on a macOS worker it drives real Safari.

## Covered end to end

Every category below has real, executable cases attached to the `sb-e2e-gui` suite under Quality assurance → E2E GUI tests. Filter the suite by the `cat:*` tag listed next to each name.

| Category | Tag | Status |
|---|---|---|
| Smoke | `cat:smoke` | ✅ HTTP-sweep over every public page |
| End-to-end flows | (no tag; the whole suite) | ✅ Sign-in, forgot-password, deep links, journey chains |
| Forms and validation | `cat:forms` | ✅ Required fields, invalid input, Enter/Tab, button state, error visibility |
| Navigation and routing | `cat:nav` | ✅ 404, deep links, redirect to gate, back/forward |
| Auth and permissions | `cat:auth` | ✅ 12 signed-in deep links, 8 anonymous-blocked checks |
| Visual (snapshot evidence) | `cat:visual` | ⚠ Partial — screenshots captured as human-review evidence; see "pending" below for true baseline-diff |
| Responsive layout | `cat:responsive` | ✅ 320 / 375 / 820 / 1440 / 1920 widths on gate + About |
| Cross-browser | (`firefox`, `webkit` tags) | ✅ Gate + About + Help + Disclosure + Demo in Firefox + WebKit; full sign-in in both |
| Accessibility (structural) | `cat:accessibility` | ⚠ Partial — label-for, html lang, tab order, keyboard submit; see "pending" for full axe scan |
| Performance | `cat:performance` | ✅ p95 latency bench on gate + About via `method: 'performance'` |
| Error and resilience | `cat:resilience` | ⚠ Partial — "API-down surfaces error" probe added as expected-failure-until-resilience-env; needs dedicated environment |
| Localization | `cat:localization` | ⚠ Partial — html lang + Content-Language header; see "pending" for RTL and translation surfaces |
| State persistence | `cat:state` | ✅ Session survives reload, hash fragment survives, deep-link while signed-in |

## Pending — needs infrastructure the engine does not currently ship

The spec items below are genuinely useful but the engine does not have the runner or workflow needed to execute them today. Each one is documented here instead of being faked as a passing case.

### Component tests (`cat:component`) — needs a component harness

The engine runs full-page browser cases only. "Mount a component in isolation and exercise its states, props, and events" needs a different build target (Storybook / Playwright Component Testing) that:
- builds the Sand Bench Web component bundle in isolation,
- exposes a test-only HTML harness per component,
- lets the catalog step reference a component by name instead of a page URL.

**What to add when this lands:** a `component` runner method, a `mount` step that takes a component name + props, and a per-component CaseDef for every shared component the Sand Bench repo exports.

### True visual regression (`cat:visual` baseline-diff)

The engine already captures screenshots as evidence (the two `SB-E2E-GUI-VISUAL-SNAPSHOT-*` cases do this). Converting that to baseline-diff visual regression needs:
- a baseline store (S3 bucket or git-LFS tracked folder) keyed by `<case-key, viewport, browser>`,
- a diff tool (odiff / pixelmatch) that fails when the diff ratio crosses a threshold,
- a baseline-update workflow (approve new baseline on purpose, not by accident).

**What to add when this lands:** a `visual_diff` step action in the Playwright runner that compares the current screenshot to the stored baseline and emits a diff image as evidence.

### Full accessibility scan (`cat:accessibility` with axe-core)

The structural a11y cases (labels, html lang, tab order) catch concrete regressions, but they don't substitute for an axe-core scan. Needs:
- `axe-core` loaded into the page via Playwright (`page.addScriptTag`),
- an `axe_scan` step action that runs `axe.run()` and fails on violations above a configured severity,
- a severity policy per page.

**What to add when this lands:** an `axe_scan` step action and a `maxViolations: {critical: 0, serious: 0, moderate: n}` field on CaseDef.

### Error / resilience with network mocks (`cat:resilience`)

The live-API-down case is in but needs a dedicated resilience environment. The richer vision — "slow responses, timeouts, offline, degraded JSON" — needs Playwright network interception (`page.route(...)`) wired into the runner:
- a `mock_route` step: pattern → fulfilled response (status, body, delay),
- a `go_offline` step,
- a per-case mock catalogue.

**What to add when this lands:** `mock_route` + `go_offline` step actions in the Playwright runner, plus a `mocks` field on CaseDef.

### Localization — translated strings + RTL (`cat:localization`)

The content-language header case is in. The deeper spec items — "translated strings render correctly", "RTL layout flows the right way" — need:
- a translated build of Sand Bench (which the current pinned staging commit does not ship),
- a locale selector in the environment config, so the catalog can run the same case under `en`, `he`, `ar`.

**What to add when the Sand Bench side ships a translation surface:** a `locale` field on the environment, and language-specific assertion strings in the catalog.

### Real-time updates (`cat:realtime`)

Needs Sand Bench to expose a WebSocket or SSE endpoint that the catalog can subscribe to, plus a `wait_for_event` step action in the Playwright runner.

### Concurrency (`cat:concurrency`)

Needs a multi-session harness that drives two browsers in parallel from one case and asserts conflict handling. The current Playwright runner opens one browser per case.

**What to add when this lands:** a `peer_session` block in CaseDef that spawns a second browser and runs a sub-sequence, plus assertions on cross-session state.

## Rules this catalog follows

Taken from the spec in the issue and worth re-stating:

- **Selectors.** The gate's own IDs are used (`#gate #username`, `#login`, …) because that is the actual Sand Bench shell. Not XPath, not brittle CSS compounds.
- **No fixed sleeps where it can be helped.** All waits are either `wait_for` on a selector or `wait_for_hidden`; the few `wait value="X"` are intentional debounces, each annotated with why.
- **Independent setup.** Every case starts from a cold navigate; none depend on earlier cases.
- **Expected failures are kept.** When a case probes a defect we know about (`SB-E2E-GUI-RESILIENCE-API-DOWN-SIGN-IN-FAILS-VISIBLY`), the `preconditions` and `flakinessNotes` fields spell out the environment it needs and the behaviour it is actually probing. The case stays in the catalog; it is not deleted to make the run green.
- **Credentials.** `{{username}}`/`{{password}}` are substituted from the environment's `config.vars`; nothing real is checked in.

## Running by category

Each case carries a `cat:<category>` tag. The console filters on tags; the npm scripts added in `package.json` (`test:e2e-gui:smoke`, `test:e2e-gui:nav`, …) call `scripts/run-category.mjs` which queues a run of just the cases matching one tag.
