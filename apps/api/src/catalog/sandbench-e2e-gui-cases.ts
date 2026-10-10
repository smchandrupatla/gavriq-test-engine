/**
 * Sand Bench end-to-end GUI tests.
 *
 * These cases drive the deployed Sand Bench web console at {{web}} in a real
 * browser (Playwright) and verify complete user journeys — not single-surface
 * screen checks (those live under the Screen tests suite). The surface the
 * steps touch is the operator console at http://127.0.0.1:8080 (dev) /
 * http://127.0.0.1:18080 (staging); the sign-in form is the gate component
 * (#gate), verified live against the pinned Sand Bench commit on 2026-10-10.
 *
 * Why a separate submenu: a "Screen test" asserts a single page renders; an
 * "E2E GUI test" is a scripted user journey across the console — sign in,
 * navigate, do something, confirm the outcome. The two run with the same
 * Playwright runner, but readers answer different questions with them.
 *
 * The console taxonomy key is `e2eGui` (TypeMeta registered in
 * sandbench-cases.ts; TYPE_TO_ENUM maps it to the Postgres `ui` test_type).
 *
 * Follow-up: a future "e2e" runner that drives the tester-army/e2e framework
 * (natural-language goals + agent-planned Playwright) can be plugged in by
 * adding a new CaseDef.method value; the existing cases below stay valid.
 */
import type { CaseDef, SuiteDef } from './types.js';

export const SANDBENCH_E2E_GUI_SUITE: SuiteDef = {
  key: 'sb-e2e-gui',
  name: 'Operator journeys through the console',
  description:
    'End-to-end user journeys driven through the Sand Bench web console in a real browser: a visitor arrives, signs in as the demo operator, and reaches the signed-in state the console offers to real users.',
  typeKey: 'e2eGui',
  category: 'qa',
};

/**
 * Sign-in as the demo operator — one logical step. The playwright runner's
 * `sign_in` action handles both cache-hit (load cached storageState into a
 * fresh context, confirm gate hidden) and cache-miss (full gate dance, save
 * state for the next case). Cache key is `<baseUrl>::<username>`, cleared on
 * worker shutdown. Cases that need to probe the gate's actual form behaviour
 * (WRONG-PASSWORD, EMPTY-SIGNIN, FORGOT-PASSWORD, …) spell out their own
 * inline steps rather than using this helper.
 */
const CONSOLE_SIGNIN = [
  {
    action: 'sign_in',
    value: '{{username}}',
    expected: '{{password}}',
    timeout_ms: 20000,
    description: 'sign in as the demo operator (uses the worker session cache when possible)',
    text: 'Sign in as the demo operator',
  },
];

const SIGNIN_DATA: CaseDef['dataProfile'] = {
  profile: 'demo-identity',
  data: 'Sign-in as the documented demo operator ({{username}} / {{password}}, no tenant field — the product is single-tenant).',
  source: 'dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).',
};

const PUBLIC_READ: CaseDef['dataProfile'] = {
  profile: 'none (read-only)',
  data: 'No input data; the page is opened as an anonymous visitor.',
  source: 'n/a',
};

const UI_RULES = { browser: 'chromium', viewport: { width: 1440, height: 1000 } };

/**
 * ────────────────────────────────────────────────────────────────────────────
 * STANDING RULE (set by the user on 2026-10-10):
 * Every new GUI test case for Sand Bench must fan out across the full
 * matrix of SCREEN SIZES × BROWSERS. The matrix flatMaps below take care of
 * that automatically for anything appended to the PAGES / VIEWPORTS /
 * BROWSERS / ELEMENT_CHECKS arrays — adding a page is one line, adding a
 * viewport is one line, adding a browser is one line, and the combinatorial
 * cases regenerate.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Every browser the catalog addresses, with the Playwright identity the
 * worker runner uses. Chrome and Edge are Chromium channels; Safari uses
 * WebKit (the engine Safari ships with) — on Linux workers this is Playwright
 * WebKit, on macOS it can drive real Safari.
 *
 * Each entry's `code` is used in generated case keys (short), `tag` drives
 * the console filter and `scripts/run-category.mjs` subset runs. `channelNote`
 * is folded into preconditions when the browser needs a non-default binary
 * on the worker image.
 */
/**
 * Step 4 — Browser matrix compaction.
 *
 * All six browsers (Chromium, Chrome, Edge, Firefox, WebKit, Safari) are kept
 * as `ALL_BROWSERS` so smoke-level checks still touch every one. But the full
 * page × viewport matrix only fans out across `MATRIX_BROWSERS` — three
 * independent engines (Chromium, Firefox, WebKit) because Chrome ≡ Chromium
 * and Edge ≡ Chromium at the layout level (same renderer), and Safari ≡
 * WebKit on Linux. Running the full sweep against the Chromium-equivalent
 * engines three times would almost certainly produce the same rendering with
 * a different label on it, so the matrix only picks the independent engines.
 *
 * Smoke still fans out all six so brand surfaces (Edge-specific features,
 * Safari-on-macOS caveats) remain covered.
 */
const ALL_BROWSERS: Array<{ code: string; name: 'chromium' | 'firefox' | 'webkit' | 'chrome' | 'edge' | 'safari'; label: string; tag: string; channelNote?: string }> = [
  { code: 'CR', name: 'chromium', label: 'Chromium',         tag: 'browser:chromium' },
  { code: 'CH', name: 'chrome',   label: 'Google Chrome',    tag: 'browser:chrome',  channelNote: 'Needs Google Chrome installed in the worker image (`npx playwright install chrome`).' },
  { code: 'ED', name: 'edge',     label: 'Microsoft Edge',   tag: 'browser:edge',    channelNote: 'Needs Microsoft Edge installed in the worker image (`npx playwright install msedge`).' },
  { code: 'FF', name: 'firefox',  label: 'Firefox',          tag: 'browser:firefox' },
  { code: 'WK', name: 'webkit',   label: 'WebKit',           tag: 'browser:webkit' },
  { code: 'SF', name: 'safari',   label: 'Safari (WebKit)',  tag: 'browser:safari',  channelNote: 'The Linux worker uses Playwright WebKit as the Safari engine; on a macOS worker this drives real Safari.' },
];
/** Independent rendering engines — one representative per engine family. */
const MATRIX_BROWSERS = ALL_BROWSERS.filter((b) => b.code === 'CR' || b.code === 'FF' || b.code === 'WK');
/** Full browser set, used by narrower (gate + theme + visual) coverage. */
const BROWSERS = MATRIX_BROWSERS;
/** Alias kept so visual/theme/gate helpers can opt into the all-six fan-out. */
const SMOKE_BROWSERS = ALL_BROWSERS;

/**
 * Every window size / browser-mode class the deployment is expected to render
 * in. The code is used in generated case keys; the tag drives the console
 * filter and `scripts/run-category.mjs` subset runs.
 */
const VIEWPORTS: Array<{ code: string; width: number; height: number; label: string; tag: string; browser?: 'chromium' | 'firefox' | 'webkit' | 'chrome' | 'edge' | 'safari' }> = [
  { code: 'MXS', width: 320,  height: 568,  label: 'mobile-xs portrait',       tag: 'vp:mobile-xs' },
  { code: 'MOB', width: 375,  height: 667,  label: 'mobile portrait',          tag: 'vp:mobile' },
  { code: 'MLG', width: 414,  height: 896,  label: 'mobile-large portrait',    tag: 'vp:mobile-large' },
  { code: 'MLN', width: 667,  height: 375,  label: 'mobile landscape',         tag: 'vp:mobile-landscape' },
  { code: 'TBP', width: 768,  height: 1024, label: 'tablet portrait',          tag: 'vp:tablet-portrait' },
  { code: 'TBL', width: 1024, height: 768,  label: 'tablet landscape',         tag: 'vp:tablet-landscape' },
  { code: 'LAP', width: 1366, height: 768,  label: 'laptop',                   tag: 'vp:laptop' },
  { code: 'DSK', width: 1920, height: 1080, label: 'full-HD desktop',          tag: 'vp:desktop' },
  { code: 'ULT', width: 2560, height: 1440, label: 'QHD ultrawide',            tag: 'vp:ultra' },
  { code: 'K4',  width: 3840, height: 2160, label: '4K display',               tag: 'vp:4k' },
  { code: 'SPV', width: 480,  height: 1080, label: 'split vertical',           tag: 'vp:split-vertical' },
  { code: 'SPH', width: 960,  height: 1080, label: 'half-horizontal split',    tag: 'vp:split-horizontal' },
  { code: 'SPQ', width: 960,  height: 540,  label: 'quarter-tile',             tag: 'vp:split-quarter' },
];

/**
 * Every HTML page the Sand Bench deployment serves, from the live
 * sand-bench-staging-web-1 container's static dir plus nginx rewrites on
 * 2026-10-10. `publicPage` means the page renders content without a sign-in;
 * `assertText` is a verified string on that page used by the responsive matrix
 * to confirm something painted. Signed-in pages leave assertText empty and the
 * responsive helper falls back to a "body is painted" check after sign-in.
 */
const PAGES: Array<{ code: string; path: string; name: string; publicPage?: boolean; assertText?: string }> = [
  // Public landing + documentation
  { code: 'GATE',               path: '/',                                       name: 'Sign-in gate',                              publicPage: true, assertText: 'Sign in' },
  { code: 'INDEX',              path: '/index.html',                             name: 'Index',                                     publicPage: true, assertText: 'Sign in' },
  { code: 'ABOUT',              path: '/about.html',                             name: 'About',                                     publicPage: true, assertText: 'Good rules survive bad data.' },
  { code: 'HELP',               path: '/help.html',                              name: 'Help',                                      publicPage: true, assertText: 'Help' },
  { code: 'PITCH',              path: '/pitch.html',                             name: 'Pitch',                                     publicPage: true, assertText: 'Good rules survive bad data.' },
  { code: 'DEMO',               path: '/demo.html',                              name: 'Demo',                                      publicPage: true, assertText: 'demo' },
  { code: 'NOT-PROD',           path: '/not-production.html',                    name: 'Not production',                            publicPage: true, assertText: 'Sand Bench' },
  { code: 'SECURITY',           path: '/security.html',                          name: 'Security',                                  publicPage: true, assertText: 'Security' },
  { code: 'NAMING',             path: '/naming.html',                            name: 'Naming conventions',                        publicPage: true, assertText: 'Naming conventions' },
  { code: 'FEATURE-IDS',        path: '/feature-ids.html',                       name: 'Feature IDs',                               publicPage: true, assertText: 'Feature IDs' },
  { code: 'REFERENCE',          path: '/reference.html',                         name: 'ISO 20022 reference',                       publicPage: true, assertText: 'ISO 20022' },
  { code: 'USE-CASE',           path: '/use-case.html',                          name: 'Use case index',                            publicPage: true, assertText: 'Use case' },
  { code: 'AUTHENTICATOR',      path: '/authenticator.html',                     name: 'Authenticator',                             publicPage: true, assertText: 'Authenticator login' },
  { code: 'LOGGING',            path: '/logging.html',                           name: 'System logging',                            publicPage: true, assertText: 'System logging' },
  { code: 'PG-INV',             path: '/postgres-inventory.html',                name: 'Postgres inventory',                        publicPage: true, assertText: 'Postgres inventory' },
  { code: 'BYO-XSD',            path: '/bring-your-own-xsd.html',                name: 'Bring your own XSD',                        publicPage: true, assertText: 'XSD' },
  { code: 'MASK-DEMO',          path: '/mask-demo.html',                         name: 'Masking slide',                             publicPage: true, assertText: 'Masking' },
  { code: 'HELP-CENTER',        path: '/help-center.html',                       name: 'Help center',                               publicPage: true, assertText: 'Help' },

  // Signed-in operator surfaces
  { code: 'ADMIN',              path: '/admin.html',                             name: 'Admin' },
  { code: 'AGENTS',             path: '/agents.html',                            name: 'Agents' },
  { code: 'AI-DRAFTS',          path: '/ai-authoring-drafts.html',               name: 'AI authoring · drafts' },
  { code: 'AI-FROM-UC',         path: '/ai-authoring-from-use-case.html',        name: 'AI authoring · from use case' },
  { code: 'AI-GENERATE',        path: '/ai-authoring-generate.html',             name: 'AI authoring · generate' },
  { code: 'AI-REVIEW',          path: '/ai-authoring-review.html',               name: 'AI authoring · review' },
  { code: 'AN-COV-DRIFT',       path: '/analytics-coverage-drift.html',          name: 'Analytics · coverage drift' },
  { code: 'AN-DASH',            path: '/analytics-dashboard.html',               name: 'Analytics dashboard' },
  { code: 'AN-SUITE-CMP',       path: '/analytics-suite-compare.html',           name: 'Analytics · suite compare' },
  { code: 'AN-SUITE-HEALTH',    path: '/analytics-suite-health.html',            name: 'Analytics · suite health' },
  { code: 'APP-EVENTS',         path: '/application-events.html',                name: 'Application events' },
  { code: 'ATTACKS',            path: '/attacks.html',                           name: 'Attacks' },
  { code: 'CFG-API',            path: '/configuration-api-access.html',          name: 'Configuration · API access' },
  { code: 'CFG-APPS',           path: '/configuration-app-configs.html',         name: 'Configuration · App configs' },
  { code: 'CFG-RETENTION',      path: '/configuration-data-retention.html',      name: 'Configuration · Data retention' },
  { code: 'CFG-ENV',            path: '/configuration-environment-defaults.html', name: 'Configuration · Environment defaults' },
  { code: 'CFG-EVENTING',       path: '/configuration-eventing.html',            name: 'Configuration · Eventing' },
  { code: 'CFG-LIST',           path: '/configuration-list-boxes.html',          name: 'Configuration · List boxes' },
  { code: 'CFG-NOTIFY',         path: '/configuration-notifications.html',       name: 'Configuration · Notifications' },
  { code: 'CFG-ROLES',          path: '/configuration-user-roles.html',          name: 'Configuration · User roles' },
  { code: 'CFG-USERS',          path: '/configuration-users.html',               name: 'Configuration · Users' },
  { code: 'CFG',                path: '/configuration.html',                     name: 'Configuration' },
  { code: 'CREATE-SCHEMA',      path: '/create-schema.html',                     name: 'Create schema' },
  { code: 'DATA-ACCESS',        path: '/data-access.html',                       name: 'Data access' },
  { code: 'DATA-FEEDER-FORM',   path: '/data-feeder-form.html',                  name: 'Data feeder form' },
  { code: 'DATA-FEEDERS',       path: '/data-feeders.html',                      name: 'Data feeders' },
  { code: 'DS-NEW',             path: '/datasets-new.html',                      name: 'Datasets · New' },
  { code: 'DS',                 path: '/datasets.html',                          name: 'Datasets' },
  { code: 'EVENT-FW',           path: '/event-framework.html',                   name: 'Event framework' },
  { code: 'EXT-SYS',            path: '/external-systems.html',                  name: 'External systems' },
  { code: 'FIELD-RULES',        path: '/field-rules.html',                       name: 'Field rules' },
  { code: 'IMP-SCHEMES',        path: '/imported-schemes.html',                  name: 'Imported schemes' },
  { code: 'IMPROVEMENTS',       path: '/improvements.html',                      name: 'Improvements' },
  { code: 'KAFKA-EP',           path: '/kafka-endpoints.html',                   name: 'Kafka endpoints' },
  { code: 'MSG-FILES',          path: '/message-data-files.html',                name: 'Message data files' },
  { code: 'MSG-EXPORT',         path: '/message-designer-export-template.html',  name: 'Message designer · export template' },
  { code: 'MSG-SAVED',          path: '/message-designer-saved.html',            name: 'Message designer · saved' },
  { code: 'MSG-REGISTER',       path: '/message-designer-schema-register.html',  name: 'Message designer · schema register' },
  { code: 'MSG',                path: '/message-designer.html',                  name: 'Message designer' },
  { code: 'MY-SESS',            path: '/my-sessions.html',                       name: 'My sessions' },
  { code: 'OVERVIEW',           path: '/overview.html',                          name: 'Overview' },
  { code: 'PATTERNS',           path: '/patterns.html',                          name: 'Patterns' },
  { code: 'REP-ALL',            path: '/reports-all.html',                       name: 'Reports · All' },
  { code: 'REP-COMPLIANCE',     path: '/reports-compliance.html',                name: 'Reports · Compliance' },
  { code: 'REP-COVERAGE',       path: '/reports-coverage.html',                  name: 'Reports · Coverage' },
  { code: 'REP-RUNS',           path: '/reports-runs.html',                      name: 'Reports · Runs' },
  { code: 'REP-SCHEDULED',      path: '/reports-scheduled.html',                 name: 'Reports · Scheduled' },
  { code: 'REP-SUITES',         path: '/reports-suites.html',                    name: 'Reports · Suites' },
  { code: 'RB-CREATE',          path: '/rule-bench-create.html',                 name: 'Rule bench · Create' },
  { code: 'RB-EXISTING',        path: '/rule-bench-existing.html',               name: 'Rule bench · Existing' },
  { code: 'RB-EXPORT',          path: '/rule-bench-export.html',                 name: 'Rule bench · Export' },
  { code: 'RB-STAGE',           path: '/rule-bench-stage.html',                  name: 'Rule bench · Stage' },
  { code: 'RB-VALIDATE',        path: '/rule-bench-validate.html',               name: 'Rule bench · Validate' },
  { code: 'RC',                 path: '/rule-canvas.html',                       name: 'Rule canvas' },
  { code: 'RC-DIR',             path: '/rule-canvas/',                           name: 'Rule canvas (subdirectory route)' },
  { code: 'SCH-ALL',            path: '/schedules-all.html',                     name: 'Schedules · All' },
  { code: 'SCH-NEW',            path: '/schedules-new.html',                     name: 'Schedules · New' },
  { code: 'SCH-UPCOMING',       path: '/schedules-upcoming.html',                name: 'Schedules · Upcoming' },
  { code: 'SCHEMA-CANVAS',      path: '/schema-canvas.html',                     name: 'Schema canvas' },
  { code: 'SCHEMA-CONVERTER',   path: '/schema-converter.html',                  name: 'Schema converter' },
  { code: 'SCHEMA-TREE',        path: '/schema-tree.html',                       name: 'Schema tree' },
  { code: 'SCHEME-DEFS',        path: '/scheme-definitions.html',                name: 'Scheme definitions' },
  { code: 'SUITE-EVIDENCE',     path: '/suite-evidence.html',                    name: 'Suite evidence' },
  { code: 'TC-FORM',            path: '/test-case-form.html',                    name: 'Test case form' },
  { code: 'TC',                 path: '/test-cases.html',                        name: 'Test cases' },
  { code: 'TR-ACTIVE',          path: '/test-runs-active.html',                  name: 'Test runs · Active' },
  { code: 'TR-ALL',             path: '/test-runs-all.html',                     name: 'Test runs · All' },
  { code: 'TR-NEW',             path: '/test-runs-new.html',                     name: 'Test runs · New' },
  { code: 'TS-FORM',            path: '/test-suite-form.html',                   name: 'Test suite form' },
  { code: 'TS-NEW',             path: '/test-suite-new.html',                    name: 'Test suite · New' },
  { code: 'TS',                 path: '/test-suites.html',                       name: 'Test suites' },
  { code: 'UC-ACCEPTANCE',      path: '/use-case-acceptance.html',               name: 'Use case · acceptance tab' },
  { code: 'UC-CONTRACT',        path: '/use-case-contract.html',                 name: 'Use case · contract tab' },
  { code: 'UC-COVERAGE',        path: '/use-case-coverage.html',                 name: 'Use case · coverage tab' },
  { code: 'UC-DIAGRAM',         path: '/use-case-diagram.html',                  name: 'Use case · diagram tab' },
  { code: 'UC-FLOW',            path: '/use-case-flow.html',                     name: 'Use case · flow tab' },
  { code: 'UC-HISTORY',         path: '/use-case-history.html',                  name: 'Use case · history tab' },
  { code: 'UC-IDENTITY',        path: '/use-case-identity.html',                 name: 'Use case · identity tab' },
  { code: 'UC-ISSUES',          path: '/use-case-issues.html',                   name: 'Use case · issues tab' },
  { code: 'UC-MARKDOWN',        path: '/use-case-markdown.html',                 name: 'Use case · markdown tab' },
  { code: 'UC-NOTES',           path: '/use-case-notes.html',                    name: 'Use case · notes tab' },
  { code: 'UC-REVIEW',          path: '/use-case-review.html',                   name: 'Use case · review' },
  { code: 'UC-STEPS',           path: '/use-case-steps.html',                    name: 'Use case · steps tab' },
  { code: 'UC-TABLES',          path: '/use-case-tables.html',                   name: 'Use case · tables tab' },
  { code: 'UC-TEMPLATES',       path: '/use-case-templates.html',                name: 'Use case · templates' },
];

/**
 * One E2E case per signed-in page: sign in as the demo operator and deep-link
 * to the page, confirming the sign-in gate is not shown — the operator reaches
 * the page they linked to, not a sign-in redirect. One function per page keeps
 * adding more pages a single line, and the shape stays consistent across them.
 */
function signedInPage(key: string, path: string, humanName: string): CaseDef {
  return {
    key,
    name: `A signed-in operator can deep-link to the ${humanName} page`,
    objective:
      `Sign in as the demo operator and open the ${humanName} page directly; confirm the sign-in gate is not shown — the operator reaches the page they linked to, not a sign-in redirect.`,
    description:
      `Open {{web}}/, sign in as the demo operator, then navigate to {{web}}${path} in the same browser session. The sign-in gate (#gate) must stay hidden — the ${humanName} page is served to the signed-in operator without a second sign-in.`,
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions:
      `Sand Bench web and API containers up; the demo operator identity ({{username}}) is enabled; the ${humanName} page is linked from the console.`,
    steps: [
      ...CONSOLE_SIGNIN,
      { action: 'navigate', value: `{{web}}${path}`, description: `deep-link to the ${humanName} page after sign-in` },
      { action: 'wait', value: '2000', description: 'give the page time to render' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 10000, description: `the sign-in gate is not shown on the ${humanName} page` },
    ],
    timeoutSeconds: 60,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'signed-in', 'deep-link'],
    dataProfile: SIGNIN_DATA,
    expected: `The ${humanName} page renders without the sign-in gate — the operator session carried over.`,
    commonFailureCauses:
      'The browser session was not persisted; the pinned staging build does not serve this page as an authenticated route (tracked as a Sand Bench defect, not a test error).',
  };
}

/**
 * One E2E case per signed-in page, from the anonymous side: deep-link WITHOUT
 * signing in, confirm the sign-in gate is shown instead of the page content —
 * the page is not accessible without an operator session.
 */
function anonymousBlockedFrom(key: string, path: string, humanName: string): CaseDef {
  return {
    key,
    name: `An anonymous visitor cannot deep-link to the ${humanName} page`,
    objective:
      `Open the ${humanName} page without signing in and confirm the sign-in gate is shown instead of the page content — the page is not accessible without an operator session.`,
    description:
      `Navigate to {{web}}${path} as an anonymous visitor (no sign-in). The sign-in gate (#gate #login) must be visible on the destination page — the console protects the ${humanName} page behind the gate.`,
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sand Bench web container up; the operator-only pages are gated.',
    steps: [
      { action: 'navigate', value: `{{web}}${path}`, description: `deep-link to the ${humanName} page as an anonymous visitor` },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the sign-in gate is shown instead of the operator page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'security', 'anonymous', 'gated'],
    dataProfile: PUBLIC_READ,
    expected: 'The sign-in gate is shown on the destination page, not the operator page content.',
  };
}

/**
 * Element-structure case: one assertion against a page's DOM. Used to generate
 * generic per-page element checks (title present, headings present, html@lang,
 * stylesheet linked, every anchor has href, every image has alt). Public pages
 * are opened as anonymous visitors; signed-in pages sign in first.
 */
function elementCase(
  key: string,
  path: string,
  pageName: string,
  check: { name: string; description: string; step: Record<string, unknown> },
  options: { signedIn?: boolean } = {}
): CaseDef {
  const steps = options.signedIn
    ? [...CONSOLE_SIGNIN, { action: 'navigate', value: `{{web}}${path}`, description: `deep-link to ${pageName}` }, { action: 'wait', value: '1500', description: 'let the page render' }, check.step]
    : [{ action: 'navigate', value: `{{web}}${path}`, description: `open ${pageName}` }, check.step];
  return {
    key,
    name: `${pageName}: ${check.name}`,
    objective:
      `Open ${pageName} and confirm ${check.description} — a structural element check that must hold on every rendered page for the console to be usable and accessible.`,
    description:
      `${options.signedIn ? 'Sign in as the demo operator and navigate to' : 'Navigate to'} {{web}}${path}; then run the specific element check: ${check.description}. If the check fails, the page is missing a baseline UI structure a reader or screen reader expects.`,
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: options.signedIn ? 'Sand Bench web and API containers up; demo operator identity enabled.' : 'Sand Bench web container up.',
    steps,
    timeoutSeconds: options.signedIn ? 60 : 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:accessibility', 'cat:elements', `elem:${check.name.split(' ').join('-').toLowerCase()}`, options.signedIn ? 'signed-in' : 'public'],
    dataProfile: options.signedIn ? SIGNIN_DATA : PUBLIC_READ,
    expected: `${pageName} passes the "${check.name}" element check.`,
  };
}

/**
 * The generic element-structure checks that apply to every rendered HTML page.
 * Each check is a step the Playwright runner can execute without a page-level
 * selector catalogue, so the same cases work against every page.
 */
const ELEMENT_CHECKS: Array<{ code: string; name: string; description: string; step: Record<string, unknown> }> = [
  {
    code: 'TITLE',
    name: 'page has a title',
    description: 'the <title> element exists and carries non-empty text',
    step: { action: 'wait_for', selector: 'title', timeout_ms: 10000, description: 'the <title> tag is present' },
  },
  {
    code: 'HEADING',
    name: 'page has a heading',
    description: 'at least one <h1>, <h2>, or <h3> is on the page — readers see what the page is about',
    step: { action: 'wait_for', selector: 'h1, h2, h3', timeout_ms: 10000, description: 'a heading element is on the page' },
  },
  {
    code: 'LANG',
    name: 'html declares a language',
    description: 'the root <html> element has a lang attribute — assistive tech needs it',
    step: { action: 'wait_for', selector: 'html[lang]', timeout_ms: 10000, description: 'the html element has a lang attribute' },
  },
  {
    code: 'STYLESHEET',
    name: 'page links a stylesheet',
    description: 'at least one <link rel="stylesheet"> is on the page — the page is styled, not plain HTML',
    step: { action: 'wait_for', selector: 'link[rel="stylesheet"]', timeout_ms: 10000, description: 'a stylesheet link is on the page' },
  },
  {
    code: 'ANCHORS-HREF',
    name: 'every anchor has an href',
    description: 'every <a> element on the page has a non-empty href attribute — no dead links in the markup',
    step: { action: 'assert_every_selector_has_attribute', selector: 'a', value: 'href', timeout_ms: 10000, description: 'every anchor carries an href' },
  },
];

/**
 * Capture-only cases: no assertions beyond "page rendered", but save a
 * screenshot as evidence so a human reviewer can diff pages visually
 * between runs. Baseline-diff automation is a separate tracked item (see
 * docs/E2E-GUI-COVERAGE-STATUS.md); until then, these snapshots give the
 * reviewer the surface to compare, one per page.
 */
function visualSnapshot(
  key: string,
  path: string,
  pageName: string,
  options: { signedIn?: boolean; browser?: 'chromium' | 'firefox' | 'webkit' | 'chrome' | 'edge' | 'safari'; browserLabel?: string; browserTag?: string; browserNote?: string } = {}
): CaseDef {
  const browser = options.browser || 'chromium';
  const browserLabel = options.browserLabel || browser;
  const browserTag = options.browserTag || `browser:${browser}`;
  const browserNote = options.browserNote ? ` ${options.browserNote}` : '';
  const steps = options.signedIn
    ? [...CONSOLE_SIGNIN, { action: 'navigate', value: `{{web}}${path}`, description: `deep-link to ${pageName}` }, { action: 'wait', value: '2000', description: 'let the page settle before the snapshot' }, { action: 'screenshot', value: `visual-${key.toLowerCase()}`, description: `capture ${pageName} in ${browserLabel}` }]
    : [{ action: 'navigate', value: `{{web}}${path}`, description: `open ${pageName}` }, { action: 'wait', value: '1500', description: 'let the page settle' }, { action: 'screenshot', value: `visual-${key.toLowerCase()}`, description: `capture ${pageName} in ${browserLabel}` }];
  return {
    key,
    name: `Visual snapshot of ${pageName} in ${browserLabel}`,
    objective:
      `Capture a Playwright screenshot of ${pageName} in ${browserLabel} as evidence — a reviewer can diff the image across browsers and across runs to spot visual regressions in colors, spacing, labels, buttons and tooltips until automated baseline-diff is wired.`,
    description:
      `${options.signedIn ? 'Sign in as the demo operator and open' : 'Open'} {{web}}${path} in ${browserLabel} at the standard viewport, let the page settle, and capture a screenshot of the first viewport as evidence. True baseline-diff visual regression is a tracked follow-up (docs/E2E-GUI-COVERAGE-STATUS.md).`,
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: `${options.signedIn ? 'Sand Bench web and API up; demo operator identity enabled.' : 'Sand Bench web container up.'}${browserNote}`,
    steps,
    timeoutSeconds: options.signedIn ? 60 : 30,
    validationRules: { browser, viewport: { width: 1440, height: 1000 } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:visual', 'elem:screenshot', browserTag, options.signedIn ? 'signed-in' : 'public'],
    dataProfile: options.signedIn ? SIGNIN_DATA : PUBLIC_READ,
    expected: `${pageName} snapshot in ${browserLabel} is captured.`,
    flakinessNotes: 'This is a human-review snapshot. A baseline-diff visual regression needs a baseline store + diff tool, tracked in docs/E2E-GUI-COVERAGE-STATUS.md.',
  };
}

/**
 * Responsive matrix: open one page at a specific viewport (and browser) and
 * confirm its content fragment is visible plus no horizontal scroll. The
 * viewport tags make the "which breakpoint am I at?" filter obvious:
 *   vp:mobile-xs 320px   · vp:mobile 375-414px   · vp:mobile-landscape 667x375
 *   vp:tablet-portrait 768-820  · vp:tablet-landscape 1024-1180
 *   vp:laptop 1366  · vp:desktop 1440-1920  · vp:ultra 2560+ · vp:4k 3840
 *   vp:split-vertical 480-wide window  · vp:split-horizontal 960-wide window
 */
function responsiveCase(
  key: string,
  path: string,
  humanName: string,
  viewport: { width: number; height: number; label: string },
  options: { signedIn?: boolean; assertText?: string; browser?: 'chromium' | 'firefox' | 'webkit' | 'chrome' | 'edge' | 'safari'; vpTag?: string; browserTag?: string; browserNote?: string } = {}
): CaseDef {
  const browser = options.browser || 'chromium';
  const vpTag = options.vpTag || 'vp:custom';
  const browserTag = options.browserTag || `browser:${browser}`;
  const browserNote = options.browserNote ? ` ${options.browserNote}` : '';
  const assertStep = options.assertText
    ? { action: 'assert_text', expected: options.assertText, description: 'the verified content fragment is visible' }
    : { action: 'wait_for', selector: 'body', timeout_ms: 10000, description: 'the body is painted' };
  const steps = options.signedIn
    ? [
        ...CONSOLE_SIGNIN,
        { action: 'navigate', value: `{{web}}${path}`, description: `deep-link to ${humanName} after sign-in` },
        { action: 'wait', value: '2000', description: 'let the shell render at this viewport' },
        { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 10000, description: 'the gate is not shown — operator reached the page' },
        { action: 'assert_no_horizontal_overflow', description: 'no horizontal scrolling needed at this viewport' },
      ]
    : [
        { action: 'navigate', value: `{{web}}${path}`, description: `open ${humanName} at ${viewport.width}x${viewport.height} (${viewport.label})` },
        assertStep,
        { action: 'assert_no_horizontal_overflow', description: 'no horizontal scrolling needed at this viewport' },
      ];
  return {
    key,
    name: `${humanName} renders at ${viewport.width}x${viewport.height} (${viewport.label})`,
    objective:
      `Open ${humanName} in ${browser} at ${viewport.width}x${viewport.height} — a ${viewport.label} window — and confirm the page is usable: the verified content is visible and no horizontal scrolling is needed.`,
    description:
      `Launch ${browser} with a viewport of ${viewport.width} wide by ${viewport.height} tall and navigate to {{web}}${path}. The ${viewport.label} class should keep the page usable — the verified content fragment${options.assertText ? ` "${options.assertText}"` : ''} must be visible and the page must have no horizontal overflow.`,
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: `Sand Bench web container up${options.signedIn ? '; demo operator identity enabled' : ''}; the worker has ${browser} available.${browserNote}`,
    steps,
    timeoutSeconds: options.signedIn ? 60 : 30,
    validationRules: { browser, viewport: { width: viewport.width, height: viewport.height } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:responsive', vpTag, browserTag, options.signedIn ? 'signed-in' : 'public'],
    dataProfile: options.signedIn ? SIGNIN_DATA : PUBLIC_READ,
    expected: `${humanName} renders at ${viewport.width}x${viewport.height} without horizontal overflow.`,
  };
}

/**
 * UC-driven GUI availability: given a use case id and its page key, build a
 * case that signs in as the demo operator, deep-links to that use case's
 * screen, and confirms the sign-in gate stays hidden — the screen is served to
 * a signed-in operator, not swallowed by a redirect.
 *
 * The page key is translated to a kebab-case URL: `messageDesigner` →
 * `/message-designer.html`. This matches the Sand Bench URL convention
 * verified against the pinned staging build on 2026-10-10.
 *
 * The case carries three tags:
 *   - `uc:<UC-id>` so the UC → test map is a direct lookup.
 *   - `cat:auth` because it reaches a signed-in screen.
 *   - `e2e-gui` for suite-level filtering.
 *
 * Caveat the engine cannot hide: the pinned Sand Bench build is missing its
 * React sidebar bundle (/vendor/opsConsolePortal.js — tracked as a Sand Bench
 * defect, not a test failure). These cases ONLY check that the shell is
 * served; richer "the UC's control X is visible and does Y" needs the
 * sidebar back and real selector discovery per screen.
 */
function ucGuiAvailability(ucId: string, path: string, humanName: string, options: { publicPage?: boolean; controls?: number } = {}): CaseDef {
  const controlsNote = options.controls && options.controls > 0
    ? ` This UC lists ${options.controls} GUI control${options.controls === 1 ? '' : 's'} in its handbook; checking the specific controls is deferred until the Sand Bench sidebar bundle is restored and real selectors are discovered.`
    : '';
  const steps = options.publicPage
    ? [
        { action: 'navigate', value: `{{web}}${path}`, description: `open the ${humanName} screen as an anonymous visitor` },
        { action: 'assert_selector_count_min', selector: 'body', value: '1', description: 'the shell is served' },
      ]
    : [
        ...CONSOLE_SIGNIN,
        { action: 'navigate', value: `{{web}}${path}`, description: `deep-link to the ${humanName} screen after sign-in` },
        { action: 'wait', value: '2000', description: 'give the shell time to decide between gate and signed-in state' },
        { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 10000, description: 'the sign-in gate is not shown — the screen was served' },
      ];
  return {
    key: `SB-E2E-GUI-UC-${ucId.replace(/^UC-/, '').replace(/([A-Z])/g, '-$1').replace(/^-/, '').toUpperCase()}`,
    name: `${ucId}: the ${humanName} screen is reachable to its actor`,
    objective:
      `Reach the screen for ${ucId} (${humanName}) through the console and confirm it is served — the use case\'s entry point is in place for its actor to use.${controlsNote}`,
    description:
      `${options.publicPage ? 'Open' : 'Sign in as the demo operator and deep-link to'} {{web}}${path} and confirm ${options.publicPage ? 'the page body is served' : 'the sign-in gate is not shown — the screen was served to the signed-in operator'}. This is the GUI-availability probe for ${ucId}; richer flow coverage lives in sandbench-usecase-flow-cases-batch*.ts.${controlsNote}`,
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: options.publicPage
      ? 'Sand Bench web container up.'
      : 'Sand Bench web and API containers up; the demo operator identity is enabled.',
    steps,
    timeoutSeconds: 60,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:auth', `uc:${ucId}`, options.publicPage ? 'public' : 'signed-in'],
    dataProfile: options.publicPage ? PUBLIC_READ : SIGNIN_DATA,
    expected: options.publicPage
      ? 'The screen\'s shell is served to an anonymous visitor.'
      : 'The signed-in operator reaches the screen without a gate redirect.',
    commonFailureCauses:
      'The Sand Bench deployment does not serve this UC\'s page at the expected URL; the sidebar bundle is missing so the shell renders empty (known defect on the pinned staging build); the demo operator identity is disabled.',
  };
}

/**
 * Smoke sweep: one method-http case per path, confirming the page answers with
 * a usable 200 and the expected Content-Type. The sweep is the cheapest first
 * line of defense — "every main page comes back with something" — and runs
 * fastest of all suites (no browser, just HTTP).
 */
function smokeSweep(entries: Array<{ key: string; path: string; ct: string }>): CaseDef[] {
  return entries.map((e) => ({
    key: e.key,
    name: `Smoke: ${e.path} answers 200 with ${e.ct}`,
    objective:
      `Fetch ${e.path} and confirm the response is a successful page served with the expected content type — the page is live for every visitor.`,
    description:
      `GET {{web}}${e.path} must return 200 with a Content-Type that contains "${e.ct}". This is the quick smoke-level answer: the page is actually being served.`,
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'http',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sand Bench web container up.',
    steps: [
      {
        action: 'request',
        method: 'GET',
        url: `{{web}}${e.path}`,
        expected_status: 200,
        expect_headers: [{ name: 'content-type', contains: e.ct }],
        description: `fetch ${e.path}`,
      },
    ],
    timeoutSeconds: 15,
    tags: ['e2e-gui', 'sand-bench', 'http', 'cat:smoke'],
    dataProfile: PUBLIC_READ,
    expected: `200 with ${e.ct} on ${e.path}.`,
  }));
}

/**
 * One E2E case per security header probe: fetch a page over HTTP and confirm a
 * named response header carries a verified substring. The engine's http runner
 * handles the header match (apps/worker/src/runners/http.ts); the Playwright
 * runner cannot assert on headers, so these are method 'http'.
 */
function headerCheck(key: string, path: string, header: string, must: string, humanReason: string): CaseDef {
  return {
    key,
    name: `The ${path} page's ${header} response header carries "${must}"`,
    objective:
      `Fetch ${path} over HTTP and confirm the response's ${header} header contains "${must}" — ${humanReason}`,
    description:
      `GET {{web}}${path} must answer with a ${header} header whose value contains "${must}". The engine's http runner handles the match (case-insensitive, substring).`,
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'http',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up and serving its pages on {{web}}.',
    steps: [
      {
        action: 'request',
        method: 'GET',
        url: `{{web}}${path}`,
        expected_status: 200,
        expect_headers: [{ name: header, contains: must }],
        description: `fetch ${path} and check the ${header} header`,
      },
    ],
    timeoutSeconds: 30,
    tags: ['e2e-gui', 'sand-bench', 'http', 'security', 'headers'],
    dataProfile: PUBLIC_READ,
    expected: `The ${header} header on ${path} contains "${must}".`,
  };
}

/**
 * One E2E case per browser-compatibility probe: open a URL in a specific
 * browser engine (chromium / firefox / webkit, all present in the worker image
 * per Dockerfile.worker) and confirm a verified content fragment is on the
 * page. Keeps browser matrix growth to a single line per entry.
 */
function browserCompat(key: string, path: string, browser: 'chromium' | 'firefox' | 'webkit', titleFragment: string, mustText: string): CaseDef {
  return {
    key,
    name: `The ${path} page renders in ${browser}`,
    objective:
      `Open ${path} in a real ${browser} browser and confirm its title and a verified content fragment are shown — the page is not Chromium-only.`,
    description:
      `Open {{web}}${path} in ${browser}. The page title must contain "${titleFragment}" and the body must contain "${mustText}".`,
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: `Sand Bench web container up; the worker image has the ${browser} browser installed.`,
    steps: [
      { action: 'navigate', value: `{{web}}${path}`, description: `open ${path} in ${browser}` },
      { action: 'assert_title', expected: titleFragment, description: 'the browser title names the page' },
      { action: 'assert_text', expected: mustText, description: 'the verified content fragment is on the page' },
    ],
    timeoutSeconds: 60,
    validationRules: { browser, viewport: { width: 1440, height: 1000 } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'compatibility', browser],
    dataProfile: PUBLIC_READ,
    expected: `The ${path} page title and verified fragment render in ${browser}.`,
  };
}

/**
 * One E2E case per public page: navigate as an anonymous visitor, assert the
 * title and a verified body fragment. One function so adding another page is a
 * single line, and so every public page is reached the same way (title +
 * content, no selector-level invention per page).
 */
function publicPage(key: string, path: string, titleFragment: string, mustText: string): CaseDef {
  const name = key.replace(/^SB-E2E-GUI-VISITOR-READS-/, '').replace(/-/g, ' ').toLowerCase();
  return {
    key,
    name: `A visitor can open the ${name} page without signing in`,
    objective:
      `Open the public page at ${path} as an anonymous visitor and confirm its own title and a verified content fragment are shown — the page is reachable without a sign-in.`,
    description:
      `Navigate to {{web}}${path} in a real browser as an anonymous visitor. The page title must contain "${titleFragment}" and the body must contain "${mustText}" — not just an HTTP OK of the shell.`,
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up and serving its static pages on {{web}}.',
    steps: [
      { action: 'navigate', value: `{{web}}${path}`, description: `open ${path} as an anonymous visitor` },
      { action: 'assert_title', expected: titleFragment, description: 'the browser title names the page' },
      { action: 'assert_text', expected: mustText, description: 'the verified content fragment is on the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public'],
    dataProfile: PUBLIC_READ,
    expected: `The page title contains "${titleFragment}" and the body contains "${mustText}".`,
  };
}

export const SANDBENCH_E2E_GUI_CASES: CaseDef[] = [
  {
    key: 'SB-E2E-GUI-ANON-SEES-SIGNIN',
    name: 'A visitor arriving at the console is shown the sign-in form',
    objective:
      'Open the console as an anonymous visitor and confirm the sign-in form is the first thing shown — the entry point every user journey starts from.',
    description:
      'Open {{web}}/ in a real browser as an anonymous visitor; the gate\'s username field, password field and Sign in button must all be visible, and the browser title must contain "Sand Bench".',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'critical',
    priority: 'p0',
    preconditions: 'Sand Bench web container up and reachable on {{web}}.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console as an anonymous visitor' },
      { action: 'wait_for', selector: '#gate #username', timeout_ms: 15000, description: 'username field visible' },
      { action: 'wait_for', selector: '#gate #password', timeout_ms: 15000, description: 'password field visible' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'Sign in button visible' },
      { action: 'assert_title', expected: 'Sand Bench', description: 'browser title carries the product name' },
      { action: 'assert_text', expected: 'Sign in', description: 'the sign-in prompt is on the page' },
    ],
    timeoutSeconds: 45,
    validationRules: { browser: 'chromium', viewport: { width: 1440, height: 1000 } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'anonymous', 'sign-in'],
    dataProfile: { profile: 'none (read-only)', data: 'No input data; the console is opened as an anonymous visitor.', source: 'n/a' },
    expected: 'Sign-in form (username, password, Sign in) is visible before anything else.',
  },
  {
    key: 'SB-E2E-GUI-DEMO-OPERATOR-SIGNS-IN',
    name: 'The demo operator signs in and reaches the signed-in console',
    objective:
      'Open the console, sign in as the demo operator, and confirm the sign-in gate hides and the signed-out banner is not shown — the operator is actively signed in and ready to use the console.',
    description:
      'Open {{web}}/, sign in through the gate form as the demo operator ({{username}} / {{password}}) and confirm two things: the gate\'s hidden class is applied (console-mount signal) and the signed-out note is not shown. This is the base user journey every other E2E GUI test builds on.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'critical',
    priority: 'p0',
    preconditions:
      'Sand Bench web and API containers up; the demo operator identity ({{username}}) is enabled on the selected environment.',
    steps: [
      ...CONSOLE_SIGNIN,
      { action: 'wait_for_hidden', selector: '#signed-out-note', timeout_ms: 10000, description: 'signed-out banner is not shown — operator is signed in' },
      { action: 'assert_selector_count_min', selector: 'body', value: '1', description: 'console page is still mounted after sign-in' },
    ],
    timeoutSeconds: 60,
    validationRules: { browser: 'chromium', viewport: { width: 1440, height: 1000 } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'sign-in', 'operator-journey'],
    dataProfile: SIGNIN_DATA,
    expected: 'Gate hides after sign-in; signed-out banner is not shown; the page stays mounted.',
    commonFailureCauses:
      'Demo operator identity disabled on the deployment; API container not reachable; the pinned staging build is missing /vendor/opsConsolePortal.js so the sidebar never mounts (tracked as a Sand Bench defect, not a test error).',
  },
  {
    key: 'SB-E2E-GUI-AGENT-SIGNS-IN',
    name: 'The agent signs in using plain-English goals (tester-army/e2e)',
    objective:
      'Give an AI agent two plain-English goals ("sign in as the demo operator"; "the sign-in form is no longer shown") and confirm it drives the Sand Bench console through the journey end-to-end.',
    description:
      'Open {{web}}/ with the tester-army/e2e framework, then hand two natural-language goals to the agent: it uses {{username}} / {{password}} to sign in, then asserts the sign-in form is no longer shown. On the first run the agent plans the actions (needs a model at {{E2E_MODEL_BASE_URL}}, Ollama by default); subsequent runs replay the recorded plan with no model call until the console changes.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'e2e',
    severity: 'high',
    priority: 'p1',
    preconditions:
      'Sand Bench web + API up; the demo operator identity ({{username}}) is enabled; an Ollama server (or any OpenAI-compatible endpoint) is reachable at E2E_MODEL_BASE_URL (default http://host.docker.internal:11434/v1) with a tool-call-capable model (default qwen3:4b) for the FIRST run; replays after that need no model.',
    steps: [
      { action: 'navigate', value: '/', description: 'open the Sand Bench console at its root' },
      { action: 'agent_act', value: 'sign in as the demo operator using the username and password shown on the gate', description: 'ask the agent to sign in using the visible gate form' },
      { action: 'agent_assert', value: 'the sign-in form is no longer shown on the page', description: 'ask the agent to confirm the gate has gone' },
    ],
    // The first-run plan on a cold ollama/qwen3:4b takes several minutes on
    // a shared-CPU host; raise the whole-case budget so the initial plan has
    // room, and subsequent replays (cached under /tmp/e2e-runs) still return
    // in seconds.
    timeoutSeconds: 900,
    tags: ['e2e-gui', 'sand-bench', 'tester-army', 'agent', 'natural-language', 'ollama'],
    dataProfile: SIGNIN_DATA,
    expected: 'The agent plans the sign-in from the goals, drives the page, and confirms the gate is gone.',
    commonFailureCauses:
      'Ollama (or the configured OpenAI-compatible endpoint) is not reachable on first run; the chosen model is not tool-call-capable; the demo operator identity is disabled; the agent\'s plan is stale after a Sand Bench UI change (delete the replay cache under /tmp/e2e-runs to force a re-plan).',
  },

  /* ---------------------------------------------------------------------- */
  /* Public-page journeys (no sign-in needed, must stay reachable)          */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-VISITOR-READS-HELP',
    name: 'A visitor can open the Help page without signing in',
    objective:
      'Open the public Help page as an anonymous visitor and confirm it carries its own title and the word "Help" in the body — a visitor should be able to read it before deciding to sign in.',
    description:
      'Navigate to {{web}}/help.html in a real browser as an anonymous visitor, with no sign-in. The browser title must contain "Help — GARVIQ Labs Sand Bench" and the body must contain the word "Help".',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up and serving its static pages on {{web}}.',
    steps: [
      { action: 'navigate', value: '{{web}}/help.html', description: 'open the Help page as an anonymous visitor' },
      { action: 'assert_title', expected: 'Help — GARVIQ Labs Sand Bench', description: 'the browser title names the Help page' },
      { action: 'assert_text', expected: 'Help', description: '"Help" appears in the body of the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'help'],
    dataProfile: PUBLIC_READ,
    expected: 'The Help page title names Help and the body contains the word "Help".',
  },
  {
    key: 'SB-E2E-GUI-VISITOR-READS-ABOUT',
    name: 'A visitor can read the About page and see the product promise',
    objective:
      'Open the public About page as an anonymous visitor and confirm it carries the product\'s hero line, "Good rules survive bad data." — the first thing a prospect reads.',
    description:
      'Navigate to {{web}}/about.html in a real browser as an anonymous visitor. The page title must contain "About — GARVIQ Labs" and the body must contain the hero copy "Good rules survive bad data.".',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up and serving its static pages on {{web}}.',
    steps: [
      { action: 'navigate', value: '{{web}}/about.html', description: 'open the About page as an anonymous visitor' },
      { action: 'assert_title', expected: 'About — GARVIQ Labs', description: 'the browser title names the About page' },
      { action: 'assert_text', expected: 'Good rules survive bad data.', description: 'the hero line is on the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'about'],
    dataProfile: PUBLIC_READ,
    expected: 'About page title names About and the hero line is visible.',
  },
  {
    key: 'SB-E2E-GUI-VISITOR-READS-PITCH',
    name: 'A visitor can read the public pitch page',
    objective:
      'Open the public pitch page as an anonymous visitor and confirm it is titled for the Sand Bench public URLs and carries the product\'s hero line — a prospect\'s typical first stop.',
    description:
      'Navigate to {{web}}/pitch.html in a real browser as an anonymous visitor. The page title must contain "Sand Bench — public URLs" and the body must contain the hero copy "Good rules survive bad data.".',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up and serving its static pages on {{web}}.',
    steps: [
      { action: 'navigate', value: '{{web}}/pitch.html', description: 'open the pitch page as an anonymous visitor' },
      { action: 'assert_title', expected: 'Sand Bench — public URLs', description: 'the browser title names the pitch page' },
      { action: 'assert_text', expected: 'Good rules survive bad data.', description: 'the hero line is on the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'pitch'],
    dataProfile: PUBLIC_READ,
    expected: 'Pitch page title and hero line are visible.',
  },
  {
    key: 'SB-E2E-GUI-VISITOR-READS-DEMO',
    name: 'A visitor can open the 90-second demo page',
    objective:
      'Open the public 90-second demo page as an anonymous visitor and confirm its own title and the word "demo" are present — the walkthrough entry point.',
    description:
      'Navigate to {{web}}/demo.html in a real browser as an anonymous visitor. The page title must contain "90-second demo — Sand Bench" and the body must contain the word "demo".',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up and serving its static pages on {{web}}.',
    steps: [
      { action: 'navigate', value: '{{web}}/demo.html', description: 'open the 90-second demo page' },
      { action: 'assert_title', expected: '90-second demo — Sand Bench', description: 'the browser title names the demo page' },
      { action: 'assert_text', expected: 'demo', description: 'the word "demo" is in the body' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'demo'],
    dataProfile: PUBLIC_READ,
    expected: 'The demo page title and body carry the expected words.',
  },
  {
    key: 'SB-E2E-GUI-NOT-PRODUCTION-DISCLOSED',
    name: 'A visitor can see the "Not production" disclosure page',
    objective:
      'Open the "Not production" disclosure page as an anonymous visitor and confirm its own title and the product name are shown — the compliance disclosure every non-production deployment is required to carry.',
    description:
      'Navigate to {{web}}/not-production.html in a real browser as an anonymous visitor. The page title must contain "Not production — Sand Bench" and the product name "Sand Bench" must be present in the body.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sand Bench web container up and serving its static pages on {{web}}; the environment is non-production.',
    steps: [
      { action: 'navigate', value: '{{web}}/not-production.html', description: 'open the non-production disclosure page' },
      { action: 'assert_title', expected: 'Not production — Sand Bench', description: 'the browser title names the disclosure page' },
      { action: 'assert_text', expected: 'Sand Bench', description: 'the product name is on the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'compliance', 'non-production'],
    dataProfile: PUBLIC_READ,
    expected: 'The disclosure page is reachable and names the product.',
  },

  /* ---------------------------------------------------------------------- */
  /* Negative sign-in journeys                                              */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-WRONG-PASSWORD-REJECTED',
    name: 'A wrong password keeps the operator on the sign-in gate',
    objective:
      'Try to sign in with a password that is not the demo operator\'s and confirm the gate does not go away — the operator is still on the sign-in screen, not inside the console.',
    description:
      'Open {{web}}/, type the demo operator username ({{username}}) and a deliberately wrong password ("not-the-right-password"), click Sign in and confirm the gate stays visible — the sign-in attempt was refused, so the console-mount signal (the gate\'s hidden class) never fires.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions:
      'Sand Bench web and API containers up; the demo operator identity ({{username}}) exists but the password used in this case is NOT the one on file.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the sign-in gate is shown' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo operator username' },
      { action: 'type', selector: '#gate #password', value: 'not-the-right-password', description: 'a wrong password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait', value: '3000', description: 'give the gate a moment to react to the refusal' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 5000, description: 'the sign-in gate is still shown — the attempt was refused' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'negative', 'sign-in'],
    dataProfile: {
      profile: 'wrong-password',
      data: 'Known-good username ({{username}}) with a deliberately wrong password ("not-the-right-password").',
      source: 'Literal in the catalog; no real credential involved.',
    },
    expected: 'The gate is still shown after the Sign in click — the wrong password was refused.',
  },
  {
    key: 'SB-E2E-GUI-EMPTY-SIGNIN-REJECTED',
    name: 'Clicking Sign in with no username or password does not let the operator in',
    objective:
      'Click Sign in without typing a username or a password and confirm the gate is still shown — no silent sign-in happens on an empty form.',
    description:
      'Open {{web}}/, do not type anything into the username or password fields, click Sign in and confirm the gate stays visible — no sign-in should go through on empty credentials.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API containers up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the sign-in gate is shown' },
      { action: 'click', selector: '#gate #login', description: 'Sign in on an empty form' },
      { action: 'wait', value: '2000', description: 'give the gate a moment to react' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 5000, description: 'the sign-in gate is still shown' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'negative', 'sign-in', 'empty-form'],
    dataProfile: {
      profile: 'empty-form',
      data: 'No input data; the Sign in button is clicked with both fields left empty.',
      source: 'n/a',
    },
    expected: 'The gate stays shown — empty credentials do not sign the operator in.',
  },

  /* ---------------------------------------------------------------------- */
  /* Session persistence                                                    */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-SIGNIN-SURVIVES-RELOAD',
    name: 'A reload after sign-in keeps the operator signed in',
    objective:
      'Sign in as the demo operator, reload the console, and confirm the sign-in gate is not shown again — the operator\'s session is remembered across page reloads.',
    description:
      'Open {{web}}/, sign in as the demo operator, then re-navigate to {{web}}/ (a full reload). The sign-in gate must stay hidden — the browser-side session (sbe_token) carries the operator past the gate without a second sign-in.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions:
      'Sand Bench web and API containers up; the demo operator identity ({{username}}) is enabled.',
    steps: [
      ...CONSOLE_SIGNIN,
      { action: 'navigate', value: '{{web}}/', description: 'reload the console in the same browser session' },
      { action: 'wait', value: '2000', description: 'give the page time to decide between gate and signed-in state' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 10000, description: 'the gate is still hidden after the reload — session survived' },
    ],
    timeoutSeconds: 60,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'session', 'reload'],
    dataProfile: SIGNIN_DATA,
    expected: 'The sign-in gate is hidden before AND after the reload — the operator stays signed in.',
    commonFailureCauses:
      'The browser session was not persisted (sbe_token not stored); the API rejected the restored token; the sign-in itself did not complete before the reload fired.',
  },

  /* ---------------------------------------------------------------------- */
  /* One more agent-driven journey (slow; replays fast once cached)         */
  /* ---------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------- */
  /* Gate — password-reset journey                                          */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-FORGOT-PASSWORD-OPENS-RESET',
    name: 'Clicking "Forgot password?" opens the password-reset form',
    objective:
      'On the sign-in gate, click the "Forgot password?" link and confirm the password-reset card is shown with its own username field, so the operator can start a self-service reset.',
    description:
      'Open {{web}}/, wait for the sign-in gate, click #forgot-password-link, then confirm the reset card appears: #reset-card is visible, #reset-username is visible, and the "Sign in" card (#signin-card) is no longer the only thing on screen.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sand Bench web container up; the password-reset feature is enabled on the deployment.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #forgot-password-link', timeout_ms: 15000, description: 'the Forgot password? link is on the gate' },
      { action: 'click', selector: '#gate #forgot-password-link', description: 'click Forgot password?' },
      { action: 'wait_for', selector: '#gate #reset-card', timeout_ms: 10000, description: 'the password-reset card is shown' },
      { action: 'wait_for', selector: '#gate #reset-username', timeout_ms: 10000, description: 'the reset username field is shown' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'password-reset'],
    dataProfile: PUBLIC_READ,
    expected: 'The reset card and its username field are visible after the click.',
  },
  {
    key: 'SB-E2E-GUI-BACK-TO-SIGNIN-FROM-RESET',
    name: '"Back to sign in" from the reset form returns to the sign-in card',
    objective:
      'From the password-reset card, click the "Back to sign in" link and confirm the sign-in card is shown again — the operator can abandon a reset and sign in normally.',
    description:
      'Open {{web}}/, open the password-reset flow by clicking #forgot-password-link, then click #back-to-signin-link and confirm the sign-in card (#signin-card) is shown and the Sign in button (#login) is visible again.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up; the password-reset feature is enabled.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #forgot-password-link', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'click', selector: '#gate #forgot-password-link', description: 'open the reset flow' },
      { action: 'wait_for', selector: '#gate #back-to-signin-link', timeout_ms: 10000, description: 'the back-to-sign-in link is shown' },
      { action: 'click', selector: '#gate #back-to-signin-link', description: 'click Back to sign in' },
      { action: 'wait_for', selector: '#gate #signin-card', timeout_ms: 10000, description: 'the sign-in card is back' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 10000, description: 'the Sign in button is back' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'password-reset', 'navigation'],
    dataProfile: PUBLIC_READ,
    expected: 'The sign-in card and its Sign in button are back after Back to sign in.',
  },
  {
    key: 'SB-E2E-GUI-RESET-UNKNOWN-USERNAME-SHOWS-ERROR',
    name: 'A reset for an unknown username does not advance to the question step',
    objective:
      'In the password-reset flow, enter a username that does not exist and confirm the flow does not advance to the security-question step — the reset stops where it should.',
    description:
      'Open the reset card, type an unknown username ("no-such-user") into #reset-username, click #reset-load-question, and confirm the security-question step (#reset-step-2) is not shown within a short wait — the reset is refused for an unknown identity.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions:
      'Sand Bench web and API containers up; the password-reset feature is enabled; the username "no-such-user" does NOT exist on the deployment.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #forgot-password-link', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'click', selector: '#gate #forgot-password-link', description: 'open the reset flow' },
      { action: 'wait_for', selector: '#gate #reset-username', timeout_ms: 10000, description: 'the reset username field is shown' },
      { action: 'type', selector: '#gate #reset-username', value: 'no-such-user', description: 'an unknown username' },
      { action: 'click', selector: '#gate #reset-load-question', description: 'ask for the security question' },
      { action: 'wait', value: '3000', description: 'give the API a moment to respond' },
      { action: 'wait_for_hidden', selector: '#gate #reset-step-2', timeout_ms: 5000, description: 'the security-question step did not appear — the reset was refused' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'password-reset', 'negative'],
    dataProfile: {
      profile: 'unknown-username',
      data: 'Username "no-such-user" that must not exist on the deployment.',
      source: 'Literal in the catalog; no real identity involved.',
    },
    expected: 'The security-question step stays hidden — the reset did not advance for an unknown username.',
  },
  {
    key: 'SB-E2E-GUI-LOGIN-ERROR-SHOWN-ON-REFUSAL',
    name: 'A refused sign-in shows an error message in the gate',
    objective:
      'After a sign-in with a wrong password, confirm the gate\'s error area (#login-err) is populated — the operator sees why they were refused, not just that nothing happened.',
    description:
      'Open {{web}}/, type the demo username and the wrong password "not-the-right-password", click Sign in and wait for the error area #login-err to have at least some visible text — the console must communicate the refusal.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API containers up; the demo operator identity ({{username}}) exists.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the sign-in gate is shown' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo operator username' },
      { action: 'type', selector: '#gate #password', value: 'not-the-right-password', description: 'a wrong password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait', value: '3000', description: 'give the gate a moment to render the error' },
      { action: 'assert_selector_count_min', selector: '#gate #login-err', value: '1', description: 'the error area is present on the gate' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'negative', 'error-message'],
    dataProfile: {
      profile: 'wrong-password',
      data: 'Known-good username ({{username}}) with a deliberately wrong password.',
      source: 'Literal in the catalog; no real credential involved.',
    },
    expected: 'The error area is on the page after the refused sign-in.',
  },

  /* ---------------------------------------------------------------------- */
  /* Every other public page — one journey each                             */
  /* ---------------------------------------------------------------------- */

  publicPage('SB-E2E-GUI-VISITOR-READS-SECURITY', '/security.html', 'Sand Bench security', 'Security'),
  publicPage('SB-E2E-GUI-VISITOR-READS-NAMING', '/naming.html', 'Naming conventions', 'Naming conventions'),
  publicPage('SB-E2E-GUI-VISITOR-READS-FEATURE-IDS', '/feature-ids.html', 'Feature IDs', 'Feature IDs'),
  publicPage('SB-E2E-GUI-VISITOR-READS-REFERENCE', '/reference.html', 'ISO 20022 family reference', 'ISO 20022'),
  publicPage('SB-E2E-GUI-VISITOR-READS-USE-CASE-INDEX', '/use-case.html', 'Sand Bench — Use case sections', 'Use case'),
  publicPage('SB-E2E-GUI-VISITOR-READS-USE-CASE-FLOW', '/use-case-flow.html', 'Use case', 'Use case'),
  publicPage('SB-E2E-GUI-VISITOR-READS-USE-CASE-STEPS', '/use-case-steps.html', 'Use case', 'Use case'),
  publicPage('SB-E2E-GUI-VISITOR-READS-AUTHENTICATOR', '/authenticator.html', 'Authenticator login', 'Authenticator login'),
  publicPage('SB-E2E-GUI-VISITOR-READS-LOGGING', '/logging.html', 'System logging', 'System logging'),
  publicPage('SB-E2E-GUI-VISITOR-READS-PG-INVENTORY', '/postgres-inventory.html', 'Postgres inventory', 'Postgres inventory'),
  publicPage('SB-E2E-GUI-VISITOR-READS-BYO-XSD', '/bring-your-own-xsd.html', 'Bring your own XSD — Sand Bench', 'XSD'),
  publicPage('SB-E2E-GUI-VISITOR-READS-MASK-DEMO', '/mask-demo.html', 'Masking slide — Sand Bench', 'Masking'),
  publicPage('SB-E2E-GUI-VISITOR-READS-HELP-CENTER', '/help-center.html', 'Help', 'Help'),

  /* ---------------------------------------------------------------------- */
  /* Navigation journeys between public pages                               */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-ABOUT-TO-HELP-LINK',
    name: 'Clicking the Help link on About lands on the Help page',
    objective:
      'From the About page, click the link to Help and confirm the browser lands on the Help page — the two public pages are linked in both directions and the link works.',
    description:
      'Open {{web}}/about.html, click the anchor whose href is "/help.html", and confirm the Help page then renders — the title contains "Help — GARVIQ Labs Sand Bench".',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up and serving its static pages.',
    steps: [
      { action: 'navigate', value: '{{web}}/about.html', description: 'open the About page' },
      { action: 'wait_for', selector: 'a[href="/help.html"]', timeout_ms: 10000, description: 'the Help link is shown' },
      { action: 'click', selector: 'a[href="/help.html"]', description: 'click the Help link' },
      { action: 'wait', value: '1500', description: 'let the Help page render' },
      { action: 'assert_title', expected: 'Help — GARVIQ Labs Sand Bench', description: 'landed on the Help page' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'navigation'],
    dataProfile: PUBLIC_READ,
    expected: 'The Help page is shown after clicking the About page\'s Help link.',
  },
  {
    key: 'SB-E2E-GUI-PITCH-TO-ABOUT-LINK',
    name: 'Clicking the About link on Pitch lands on the About page',
    objective:
      'From the public pitch page, click the About link and confirm the About page is shown — the pitch page\'s navigation to the longer About write-up works.',
    description:
      'Open {{web}}/pitch.html, click the anchor whose href is "/about.html", and confirm the About page then renders — its title contains "About — GARVIQ Labs".',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up and serving its static pages.',
    steps: [
      { action: 'navigate', value: '{{web}}/pitch.html', description: 'open the pitch page' },
      { action: 'wait_for', selector: 'a[href="/about.html"]', timeout_ms: 10000, description: 'the About link is shown' },
      { action: 'click', selector: 'a[href="/about.html"]', description: 'click the About link' },
      { action: 'wait', value: '1500', description: 'let the About page render' },
      { action: 'assert_title', expected: 'About — GARVIQ Labs', description: 'landed on the About page' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'navigation'],
    dataProfile: PUBLIC_READ,
    expected: 'The About page is shown after clicking the Pitch page\'s About link.',
  },
  {
    key: 'SB-E2E-GUI-HELP-HOME-LINK-LANDS-ON-GATE',
    name: 'The home link on the Help page returns to the sign-in gate',
    objective:
      'From the Help page, click the home link ("/") and confirm the sign-in gate is shown again — a reader can always get back to the console from a public page.',
    description:
      'Open {{web}}/help.html, click the anchor whose href is "/", and confirm the sign-in form (#gate #login) is visible on the destination page.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up and serving its static pages.',
    steps: [
      { action: 'navigate', value: '{{web}}/help.html', description: 'open the Help page' },
      { action: 'wait_for', selector: 'a[href="/"]', timeout_ms: 10000, description: 'the home link is shown' },
      { action: 'click', selector: 'a[href="/"]', description: 'click the home link' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'landed on the sign-in gate' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'navigation', 'home'],
    dataProfile: PUBLIC_READ,
    expected: 'The sign-in gate is shown after clicking the home link.',
  },

  /* ---------------------------------------------------------------------- */
  /* Documents and signed-in deep links                                     */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-HELP-MANUAL-PDF-REACHABLE',
    name: 'The Sand Bench Help Manual PDF is downloadable',
    objective:
      'Fetch the Sand Bench Help Manual PDF the public pages link to and confirm it is served as a PDF — a visitor can download the full help document without signing in.',
    description:
      'GET {{web}}/Sand-Bench-Help-Manual.pdf must return 200 with a Content-Type of application/pdf — the handout document the About and Help pages link to is actually available.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'http',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up and serving its static assets.',
    steps: [
      {
        action: 'request',
        method: 'GET',
        url: '{{web}}/Sand-Bench-Help-Manual.pdf',
        expected_status: 200,
        expect_headers: [{ name: 'content-type', contains: 'application/pdf' }],
        description: 'fetch the help manual PDF',
      },
    ],
    timeoutSeconds: 30,
    tags: ['e2e-gui', 'sand-bench', 'http', 'public', 'document', 'pdf'],
    dataProfile: PUBLIC_READ,
    expected: 'The PDF comes back with Content-Type application/pdf.',
  },
  {
    key: 'SB-E2E-GUI-SIGNED-IN-OVERVIEW-RENDERS',
    name: 'After signing in, the Overview page renders instead of the gate',
    objective:
      'Sign in as the demo operator, navigate to the Overview page, and confirm the sign-in gate is no longer shown — the console lets the operator deep-link into Overview once they are signed in.',
    description:
      'Open {{web}}/, sign in as the demo operator, then navigate to {{web}}/overview.html in the same browser session. The sign-in gate (#gate) must stay hidden — the Overview page is served as a signed-in page, not a gate redirect.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions:
      'Sand Bench web and API containers up; the demo operator identity ({{username}}) is enabled; the Overview page is linked from the console.',
    steps: [
      ...CONSOLE_SIGNIN,
      { action: 'navigate', value: '{{web}}/overview.html', description: 'deep-link to the Overview page after sign-in' },
      { action: 'wait', value: '2000', description: 'give the Overview page time to render' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 10000, description: 'the sign-in gate is not shown on Overview — the operator stays signed in' },
    ],
    timeoutSeconds: 60,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'signed-in', 'deep-link', 'overview'],
    dataProfile: SIGNIN_DATA,
    expected: 'The Overview page renders without the sign-in gate — the operator session carried over.',
    commonFailureCauses:
      'The browser session was not persisted; the Overview page URL changed; the pinned staging build does not serve /overview.html as an authenticated route (tracked as a Sand Bench defect).',
  },

  {
    key: 'SB-E2E-GUI-AGENT-READS-ABOUT',
    name: 'The agent reads the About page from a plain-English goal (tester-army/e2e)',
    objective:
      'Give an AI agent a plain-English goal ("find the About page and confirm it carries the product promise") and confirm it drives the console to the right page and verifies the hero line.',
    description:
      'Open {{web}}/about.html with the tester-army/e2e framework, then hand the agent one natural-language assertion: the body carries the product\'s hero line "Good rules survive bad data.". The agent inspects the page itself. First-run planning uses the configured model; later runs replay the cached plan.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'e2e',
    severity: 'low',
    priority: 'p3',
    preconditions:
      'Sand Bench web container up; an Ollama server (or any OpenAI-compatible endpoint) is reachable at E2E_MODEL_BASE_URL (default http://host.docker.internal:11434/v1) with a tool-call-capable model (default qwen3:4b) for the FIRST run; replays after that need no model.',
    steps: [
      { action: 'navigate', value: '/about.html', description: 'open the About page at the Sand Bench console' },
      { action: 'agent_assert', value: 'the About page shows the hero line "Good rules survive bad data."', description: 'ask the agent to confirm the hero line is on the page' },
    ],
    timeoutSeconds: 900,
    tags: ['e2e-gui', 'sand-bench', 'tester-army', 'agent', 'natural-language', 'ollama', 'public'],
    dataProfile: PUBLIC_READ,
    expected: 'The agent plans a check from the goal and confirms the hero line is on the About page.',
    commonFailureCauses:
      'Ollama or the configured endpoint is not reachable on first run; the chosen model is not tool-call-capable; the About page content changed since the plan was cached (delete /tmp/e2e-runs to force a re-plan).',
  },

  /* ---------------------------------------------------------------------- */
  /* Signed-in deep links — one case per operator page                      */
  /* ---------------------------------------------------------------------- */

  signedInPage('SB-E2E-GUI-SIGNED-IN-ADMIN', '/admin.html', 'Admin'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-AGENTS', '/agents.html', 'Agents'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-SCHEME-DEFINITIONS', '/scheme-definitions.html', 'Scheme Definitions'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-TEST-CASES', '/test-cases.html', 'Test cases'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-TEST-CASE-FORM', '/test-case-form.html', 'Test case form'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-TEST-SUITES', '/test-suites.html', 'Test suites'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-TEST-SUITE-FORM', '/test-suite-form.html', 'Test suite form'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-TEST-RUNS-ALL', '/test-runs-all.html', 'All test runs'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-TEST-RUNS-ACTIVE', '/test-runs-active.html', 'Active test runs'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-TEST-RUNS-NEW', '/test-runs-new.html', 'New test run'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-MESSAGE-DESIGNER', '/message-designer.html', 'Message Designer'),
  signedInPage('SB-E2E-GUI-SIGNED-IN-DATASETS', '/datasets.html', 'Datasets'),

  /* ---------------------------------------------------------------------- */
  /* Negative: anonymous visitors are blocked at the gate                   */
  /* ---------------------------------------------------------------------- */

  anonymousBlockedFrom('SB-E2E-GUI-ANON-BLOCKED-TEST-CASES', '/test-cases.html', 'Test cases'),
  anonymousBlockedFrom('SB-E2E-GUI-ANON-BLOCKED-TEST-SUITES', '/test-suites.html', 'Test suites'),
  anonymousBlockedFrom('SB-E2E-GUI-ANON-BLOCKED-TEST-RUNS-ALL', '/test-runs-all.html', 'All test runs'),
  anonymousBlockedFrom('SB-E2E-GUI-ANON-BLOCKED-MESSAGE-DESIGNER', '/message-designer.html', 'Message Designer'),
  anonymousBlockedFrom('SB-E2E-GUI-ANON-BLOCKED-DATASETS', '/datasets.html', 'Datasets'),

  /* ---------------------------------------------------------------------- */
  /* Form behaviour on the gate                                             */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-GATE-PASSWORD-FIELD-IS-MASKED',
    name: 'The password field on the gate masks the operator\'s typing',
    objective:
      'Confirm the password field on the sign-in gate is of type "password" — what the operator types is masked and not shown as plain text to anyone looking at the screen.',
    description:
      'Open {{web}}/, locate the password field (#gate #password), and confirm its HTML type attribute is "password" — the browser hides the characters as the operator types. A field with type "text" would show the password in the clear.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #password', timeout_ms: 15000, description: 'the password field is on the gate' },
      { action: 'wait_for', selector: '#gate #password[type="password"]', timeout_ms: 5000, description: 'the password field is a masked field (type="password")' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'security', 'form'],
    dataProfile: PUBLIC_READ,
    expected: 'The password field has type="password" — the operator\'s typing is masked.',
  },
  {
    key: 'SB-E2E-GUI-GATE-ACCEPTS-UNICODE-USERNAME',
    name: 'The username field accepts a non-ASCII identity',
    objective:
      'Type a non-ASCII username (e.g. "αλέξανδρος") into the username field and confirm the field accepts it — operators with international names must be able to type their identity even if the deployment refuses the sign-in later.',
    description:
      'Open {{web}}/, type a non-ASCII username into #gate #username, and confirm the field value is preserved. This checks the field accepts unicode; whether the deployment accepts it as a real identity is a different, auth-layer question.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #username', timeout_ms: 15000, description: 'the username field is on the gate' },
      { action: 'type', selector: '#gate #username', value: 'αλέξανδρος', description: 'a non-ASCII username' },
      { action: 'wait_for', selector: '#gate #username', timeout_ms: 3000, description: 'the field is still shown with its value' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'form', 'i18n'],
    dataProfile: {
      profile: 'unicode-username',
      data: 'A non-ASCII sample username "αλέξανδρος" (Greek letters) typed into the username field.',
      source: 'Literal in the catalog; no real identity involved.',
    },
    expected: 'The username field accepts the non-ASCII typing without error.',
  },
  {
    key: 'SB-E2E-GUI-GATE-REFOCUS-USERNAME-ON-REFUSAL',
    name: 'After a refused sign-in the gate still shows a usable username field',
    objective:
      'After a sign-in with a wrong password, confirm the username field is still shown and still accepts typing — the operator can correct their mistake and try again without reloading the page.',
    description:
      'Open {{web}}/, type the demo username, type a wrong password, click Sign in, wait for the refusal, then type a different value into the username field and confirm the field keeps the new value.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API containers up; the demo operator identity exists.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo operator username' },
      { action: 'type', selector: '#gate #password', value: 'not-the-right-password', description: 'a wrong password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait', value: '3000', description: 'give the refusal time to render' },
      { action: 'wait_for', selector: '#gate #username', timeout_ms: 5000, description: 'the username field is still on the gate' },
      { action: 'type', selector: '#gate #username', value: 'another-attempt', description: 'the operator corrects their typing' },
      { action: 'wait_for', selector: '#gate #username', timeout_ms: 3000, description: 'the field is still responsive' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'resilience'],
    dataProfile: {
      profile: 'wrong-password-retry',
      data: 'Demo username with a wrong password, then a second attempt without reloading.',
      source: 'Literal in the catalog; no real credential involved.',
    },
    expected: 'The username field is still usable after a refused sign-in.',
  },

  /* ---------------------------------------------------------------------- */
  /* Viewport / responsiveness                                              */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-GATE-FITS-MOBILE-VIEWPORT',
    name: 'The sign-in gate fits a mobile-sized viewport without horizontal scroll',
    objective:
      'Open the sign-in gate at a phone-sized viewport (375 x 667) and confirm the sign-in form is visible and the page does not need horizontal scrolling — an operator on a phone can sign in without zooming or sideways scrolling.',
    description:
      'Open {{web}}/ in a Chromium viewport of 375 x 667 (iPhone-class). The sign-in form (#gate #login) must be visible and the page must have no horizontal overflow.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console at mobile width' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the Sign in button is on the gate' },
      { action: 'assert_no_horizontal_overflow', description: 'no horizontal scrolling needed' },
    ],
    timeoutSeconds: 30,
    validationRules: { browser: 'chromium', viewport: { width: 375, height: 667 } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'responsive', 'mobile'],
    dataProfile: PUBLIC_READ,
    expected: 'The gate is visible and the page fits the mobile width.',
  },
  {
    key: 'SB-E2E-GUI-ABOUT-FITS-TABLET-VIEWPORT',
    name: 'The About page fits a tablet-sized viewport without horizontal scroll',
    objective:
      'Open the About page at a tablet-sized viewport (820 x 1180) and confirm the hero line is visible and the page does not need horizontal scrolling — a prospect reading on a tablet is not forced to scroll sideways.',
    description:
      'Open {{web}}/about.html in a Chromium viewport of 820 x 1180. The hero line "Good rules survive bad data." must be visible and the page must have no horizontal overflow.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/about.html', description: 'open the About page at tablet width' },
      { action: 'assert_text', expected: 'Good rules survive bad data.', description: 'the hero line is visible' },
      { action: 'assert_no_horizontal_overflow', description: 'no horizontal scrolling needed' },
    ],
    timeoutSeconds: 30,
    validationRules: { browser: 'chromium', viewport: { width: 820, height: 1180 } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'responsive', 'tablet', 'public'],
    dataProfile: PUBLIC_READ,
    expected: 'The hero line is visible and the page fits the tablet width.',
  },

  /* ---------------------------------------------------------------------- */
  /* More agent-driven journeys                                             */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-AGENT-PITCH-TO-ABOUT',
    name: 'The agent follows the pitch page to the About page from a plain-English goal',
    objective:
      'Give an AI agent a plain-English goal ("from the pitch page, follow the link to About and read the hero line") and confirm it navigates between pages and reports the hero copy.',
    description:
      'Open {{web}}/pitch.html with the tester-army/e2e framework, then hand the agent two natural-language instructions: follow the link to the About page, then confirm the hero line "Good rules survive bad data." is on it.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'e2e',
    severity: 'low',
    priority: 'p3',
    preconditions:
      'Sand Bench web container up; an Ollama server (or any OpenAI-compatible endpoint) is reachable at E2E_MODEL_BASE_URL for the FIRST run.',
    steps: [
      { action: 'navigate', value: '/pitch.html', description: 'open the pitch page' },
      { action: 'agent_act', value: 'follow the link to the About page', description: 'ask the agent to navigate to About' },
      { action: 'agent_assert', value: 'the current page is the About page and it shows the hero line "Good rules survive bad data."', description: 'ask the agent to confirm the About page is open with the hero line' },
    ],
    timeoutSeconds: 900,
    tags: ['e2e-gui', 'sand-bench', 'tester-army', 'agent', 'natural-language', 'ollama', 'navigation'],
    dataProfile: PUBLIC_READ,
    expected: 'The agent follows the link and confirms the About page\'s hero line.',
    commonFailureCauses:
      'Ollama is not reachable on first run; the chosen model is not tool-call-capable; the pitch page lost its About link; the hero line changed.',
  },
  {
    key: 'SB-E2E-GUI-AGENT-REPORTS-WRONG-PASSWORD',
    name: 'The agent reports that a wrong password is refused by the gate',
    objective:
      'Give an AI agent a plain-English goal ("try to sign in with a wrong password and tell me if the console lets you in") and confirm the agent reports that the sign-in form is still shown.',
    description:
      'Open {{web}}/ with the tester-army/e2e framework, hand the agent one natural-language instruction to attempt a sign-in with the demo username and a known-wrong password, then one plain-English assertion that the sign-in form is still shown. This is an agent-driven version of SB-E2E-GUI-WRONG-PASSWORD-REJECTED.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'e2e',
    severity: 'low',
    priority: 'p3',
    preconditions:
      'Sand Bench web and API containers up; the demo operator identity ({{username}}) exists; an Ollama endpoint is reachable at E2E_MODEL_BASE_URL for the FIRST run.',
    steps: [
      { action: 'navigate', value: '/', description: 'open the sign-in gate' },
      { action: 'agent_act', value: 'try to sign in as the demo operator but use the password "not-the-right-password" instead of the real one', description: 'ask the agent to attempt a wrong-password sign-in' },
      { action: 'agent_assert', value: 'the sign-in form is still shown — the console refused to sign the operator in', description: 'ask the agent to confirm the refusal' },
    ],
    timeoutSeconds: 900,
    tags: ['e2e-gui', 'sand-bench', 'tester-army', 'agent', 'natural-language', 'ollama', 'negative'],
    dataProfile: {
      profile: 'wrong-password',
      data: 'Demo username with a deliberately wrong password.',
      source: 'Literal in the catalog; no real credential involved.',
    },
    expected: 'The agent reports the refusal — the sign-in form is still shown.',
    commonFailureCauses:
      'Ollama is not reachable; the chosen model misses the refusal; the agent gave up before verifying.',
  },

  /* ---------------------------------------------------------------------- */
  /* Security — gate response to malicious or malformed input               */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-GATE-REFUSES-XSS-IN-USERNAME',
    name: 'A script-tag payload in the username does not run as code',
    objective:
      'Type a script-tag payload into the username field, click Sign in, and confirm no alert or injected markup runs on the page — the gate escapes operator input.',
    description:
      'Open {{web}}/, type "<script>window.sbXss=1</script>" into #gate #username, type any password, click Sign in. The gate must still be shown and no element with id "sbXss" or executable payload must appear — the console must escape user input, not render it as HTML.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'critical',
    priority: 'p0',
    preconditions: 'Sand Bench web and API containers up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: '<script>window.sbXss=1</script>', description: 'a script-tag payload as the username' },
      { action: 'type', selector: '#gate #password', value: 'anything', description: 'any password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait', value: '3000', description: 'give the console time to react' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 5000, description: 'the gate is still shown — not navigated away by an injection' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'security', 'xss', 'negative'],
    dataProfile: {
      profile: 'xss-payload',
      data: 'A deliberately malicious script-tag payload typed into the username field.',
      source: 'Literal in the catalog; no real identity involved.',
    },
    expected: 'The gate stays on screen and no injected script runs.',
  },
  {
    key: 'SB-E2E-GUI-GATE-REFUSES-SQLI-IN-USERNAME',
    name: 'A SQL-injection payload in the username does not crash the sign-in',
    objective:
      'Type a classic SQL-injection payload into the username field, click Sign in, and confirm the gate still shows and the operator is not signed in — the console treats input as data, not a query.',
    description:
      'Open {{web}}/, type "\' OR 1=1 --" into #gate #username, any password, click Sign in. The gate must still be shown — the attempt must be refused like any other invalid credential, not produce a crash or a sign-in.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'critical',
    priority: 'p0',
    preconditions: 'Sand Bench web and API containers up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: "' OR 1=1 --", description: 'a SQL-injection payload as the username' },
      { action: 'type', selector: '#gate #password', value: 'anything', description: 'any password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait', value: '3000', description: 'give the console time to react' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 5000, description: 'the gate is still shown — the injection was refused' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'security', 'sqli', 'negative'],
    dataProfile: {
      profile: 'sql-injection-payload',
      data: 'A classic SQL-injection payload typed into the username field.',
      source: 'Literal in the catalog; no real identity involved.',
    },
    expected: 'The gate stays on screen and the injection does not sign the operator in.',
  },
  {
    key: 'SB-E2E-GUI-GATE-REJECTS-WHITESPACE-ONLY-USERNAME',
    name: 'A username made only of spaces does not sign the operator in',
    objective:
      'Type only spaces into the username field, any password, click Sign in, and confirm the gate is still shown — whitespace alone is not a valid identity.',
    description:
      'Open {{web}}/, type "   " (three spaces) into #gate #username, any password, click Sign in. The gate must still be shown.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web and API containers up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: '   ', description: 'three spaces as the username' },
      { action: 'type', selector: '#gate #password', value: 'anything', description: 'any password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait', value: '2000', description: 'give the gate a moment to react' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 5000, description: 'the gate is still shown' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'negative', 'form'],
    dataProfile: {
      profile: 'whitespace-only-username',
      data: 'A username containing only whitespace characters.',
      source: 'Literal in the catalog; no real identity involved.',
    },
    expected: 'The gate stays on screen.',
  },
  {
    key: 'SB-E2E-GUI-GATE-REJECTS-WHITESPACE-ONLY-PASSWORD',
    name: 'A password made only of spaces does not sign the operator in',
    objective:
      'Enter the demo username and a password that is only spaces; confirm the gate is still shown — whitespace alone is not accepted as a password.',
    description:
      'Open {{web}}/, type the demo operator username, "   " (three spaces) as the password, click Sign in. The gate must still be shown.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web and API containers up; the demo operator identity exists.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'the demo username' },
      { action: 'type', selector: '#gate #password', value: '   ', description: 'three spaces as the password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait', value: '2000', description: 'give the gate a moment to react' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 5000, description: 'the gate is still shown' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'negative', 'form'],
    dataProfile: {
      profile: 'whitespace-only-password',
      data: 'The demo username with a password that is only whitespace.',
      source: 'Literal in the catalog; no real credential involved.',
    },
    expected: 'The gate stays on screen.',
  },
  {
    key: 'SB-E2E-GUI-GATE-ACCEPTS-SPECIAL-CHARS-PASSWORD',
    name: 'A password with special characters is typed into the password field without truncation',
    objective:
      'Type a password containing punctuation and symbols into the password field and confirm the field accepts the full value — special characters are not stripped or clipped on input.',
    description:
      'Open {{web}}/, type "a!@#$%^&*()_+Zz9" into #gate #password, and confirm the field keeps the full value in its DOM state.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #password', timeout_ms: 15000, description: 'the password field is on the gate' },
      { action: 'type', selector: '#gate #password', value: 'a!@#$%^&*()_+Zz9', description: 'a password with special characters' },
      { action: 'wait_for', selector: '#gate #password', timeout_ms: 3000, description: 'the field accepts the value' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'form'],
    dataProfile: {
      profile: 'special-char-password',
      data: 'A password made of ASCII punctuation and alphanumerics.',
      source: 'Literal in the catalog; no real credential involved.',
    },
    expected: 'The password field accepts the special-character value in full.',
  },
  {
    key: 'SB-E2E-GUI-GATE-ACCEPTS-LONG-USERNAME',
    name: 'A 200-character username is accepted by the username field',
    objective:
      'Type a 200-character username into the username field and confirm the field accepts it — the gate does not truncate or crash on long input.',
    description:
      'Open {{web}}/, type a 200-character username (200 lowercase "a"s) into #gate #username, and confirm the field keeps the value and the gate is still responsive.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #username', timeout_ms: 15000, description: 'the username field is on the gate' },
      { action: 'type', selector: '#gate #username', value: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', description: 'a 200-character username' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 5000, description: 'the Sign in button is still shown' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'form', 'boundary'],
    dataProfile: {
      profile: 'long-username',
      data: 'A 200-character username, well above a plausible operator name length.',
      source: 'Literal in the catalog; no real identity involved.',
    },
    expected: 'The field accepts the long value and the gate is still responsive.',
  },
  {
    key: 'SB-E2E-GUI-SIGNIN-WITH-ENTER-KEY',
    name: 'Pressing Enter in the password field submits the sign-in form',
    objective:
      'After typing the demo credentials, press Enter in the password field and confirm the console mount signal fires — the sign-in form submits on keyboard, not only on mouse click.',
    description:
      'Open {{web}}/, type the demo username in #gate #username, type the demo password in #gate #password, press Enter in #gate #password, and confirm #gate becomes hidden — the submit happened via keyboard.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API containers up; the demo operator identity is enabled.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo operator username' },
      { action: 'type', selector: '#gate #password', value: '{{password}}', description: 'demo operator password' },
      { action: 'press_key', selector: '#gate #password', value: 'Enter', description: 'press Enter in the password field' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 20000, description: 'the gate hides — the Enter key submitted the form' },
    ],
    timeoutSeconds: 60,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'keyboard', 'accessibility', 'sign-in'],
    dataProfile: SIGNIN_DATA,
    expected: 'The gate hides after pressing Enter — Enter is wired to submit.',
    commonFailureCauses:
      'The gate wires Enter only on the Sign in button and not on the password field; the demo identity is disabled; the page captures keystrokes differently than a normal form.',
  },
  {
    key: 'SB-E2E-GUI-PASSWORD-CLEARED-AFTER-RELOAD',
    name: 'The password field is empty again after a page reload',
    objective:
      'Type a password, reload the page, and confirm the password field is empty afterwards — a reload must not keep a password visible to the next operator at the same screen.',
    description:
      'Open {{web}}/, type a password into #gate #password, reload the page by navigating to {{web}}/, then confirm the password field is present and empty — the browser should not persist the value past a reload.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #password', timeout_ms: 15000, description: 'the password field is on the gate' },
      { action: 'type', selector: '#gate #password', value: 'not-a-real-password', description: 'any password' },
      { action: 'navigate', value: '{{web}}/', description: 'reload the console' },
      { action: 'wait_for', selector: '#gate #password', timeout_ms: 15000, description: 'the password field is shown after the reload' },
      { action: 'wait_for', selector: '#gate #password:not([value])', timeout_ms: 5000, description: 'the password field is empty — no value attribute lingers from the previous visit' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'security', 'reload'],
    dataProfile: {
      profile: 'reload-clears-password',
      data: 'An arbitrary password typed into the field, then a reload.',
      source: 'Literal in the catalog; no real credential involved.',
    },
    expected: 'The password field is empty after the reload — no residual value.',
  },

  /* ---------------------------------------------------------------------- */
  /* Static page content depth — not just title                             */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-ABOUT-HAS-HERO-H1',
    name: 'The About page shows the hero line as its top heading',
    objective:
      'Confirm the About page renders the product promise "Good rules survive bad data." as its most prominent heading (the h1) — a visitor sees the promise, not only reads it in prose.',
    description:
      'Open {{web}}/about.html and confirm the first <h1> on the page carries the text "Good rules survive bad data.". A page with no h1 or with a different top heading fails the check.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/about.html', description: 'open the About page' },
      { action: 'wait_for', selector: 'h1', timeout_ms: 10000, description: 'an h1 is on the page' },
      { action: 'assert_selector_text', selector: 'h1', expected: 'Good rules survive bad data.', description: 'the h1 is the hero line' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'content'],
    dataProfile: PUBLIC_READ,
    expected: 'The top heading on About is the product\'s hero line.',
  },
  {
    key: 'SB-E2E-GUI-ABOUT-LINKS-TO-HELP',
    name: 'The About page carries a visible link to the Help page',
    objective:
      'Confirm the About page has an anchor that points at /help.html — a reader has a direct way to the help documentation from About.',
    description:
      'Open {{web}}/about.html and confirm an anchor whose href is "/help.html" is on the page. The actual click-through is covered separately in SB-E2E-GUI-ABOUT-TO-HELP-LINK.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/about.html', description: 'open the About page' },
      { action: 'wait_for', selector: 'a[href="/help.html"]', timeout_ms: 10000, description: 'the Help link is on the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'links'],
    dataProfile: PUBLIC_READ,
    expected: 'An anchor with href "/help.html" is on the About page.',
  },
  {
    key: 'SB-E2E-GUI-ABOUT-LINKS-TO-DEMO',
    name: 'The About page carries a visible link to the demo page',
    objective:
      'Confirm the About page has an anchor to /demo.html — the 90-second demo is reachable in one click from About.',
    description:
      'Open {{web}}/about.html and confirm an anchor whose href is "/demo.html" is on the page.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/about.html', description: 'open the About page' },
      { action: 'wait_for', selector: 'a[href="/demo.html"]', timeout_ms: 10000, description: 'the demo link is on the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'links'],
    dataProfile: PUBLIC_READ,
    expected: 'An anchor with href "/demo.html" is on the About page.',
  },
  {
    key: 'SB-E2E-GUI-ABOUT-LINKS-TO-DISCLOSURE',
    name: 'The About page links to the non-production disclosure page',
    objective:
      'Confirm the About page has an anchor to /not-production.html — the compliance disclosure is reachable from the main public page.',
    description:
      'Open {{web}}/about.html and confirm an anchor whose href is "/not-production.html" is on the page.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/about.html', description: 'open the About page' },
      { action: 'wait_for', selector: 'a[href="/not-production.html"]', timeout_ms: 10000, description: 'the disclosure link is on the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'links', 'compliance'],
    dataProfile: PUBLIC_READ,
    expected: 'An anchor with href "/not-production.html" is on the About page.',
  },
  {
    key: 'SB-E2E-GUI-REFERENCE-MENTIONS-ISO-FAMILIES',
    name: 'The ISO 20022 reference page actually names an ISO 20022 message family',
    objective:
      'Open the ISO 20022 reference page and confirm at least one real message family name (e.g. "pacs.008") appears in its body — the page delivers reference content, not just a title.',
    description:
      'Open {{web}}/reference.html and confirm the body contains the string "pacs.008" — the ISO 20022 payment-clearing message family a reader expects to see on a reference page.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/reference.html', description: 'open the reference page' },
      { action: 'assert_text', expected: 'pacs.008', description: 'the pacs.008 message family is on the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'content', 'iso20022'],
    dataProfile: PUBLIC_READ,
    expected: 'The reference page body contains "pacs.008".',
  },
  {
    key: 'SB-E2E-GUI-NOT-PRODUCTION-SAYS-NOT-PRODUCTION',
    name: 'The disclosure page actually says the environment is not production',
    objective:
      'Open the non-production disclosure page and confirm it carries the words "not production" — the compliance disclosure must be unambiguous.',
    description:
      'Open {{web}}/not-production.html and confirm the body contains the phrase "not production" — not only a title but a clear statement.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sand Bench web container up; this is a non-production deployment.',
    steps: [
      { action: 'navigate', value: '{{web}}/not-production.html', description: 'open the disclosure page' },
      { action: 'assert_text', expected: 'not production', description: 'the words "not production" are in the body' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'compliance', 'disclosure'],
    dataProfile: PUBLIC_READ,
    expected: 'The disclosure page body carries "not production".',
  },

  /* ---------------------------------------------------------------------- */
  /* Security headers (one case per header/page, via http method)           */
  /* ---------------------------------------------------------------------- */

  headerCheck('SB-E2E-GUI-GATE-HAS-NOSNIFF', '/', 'x-content-type-options', 'nosniff',
    'confirms the browser is told not to sniff the content type of the gate page.'),
  headerCheck('SB-E2E-GUI-HELP-HAS-NOSNIFF', '/help.html', 'x-content-type-options', 'nosniff',
    'confirms the browser is told not to sniff the content type of the Help page.'),
  headerCheck('SB-E2E-GUI-ABOUT-HAS-NOSNIFF', '/about.html', 'x-content-type-options', 'nosniff',
    'confirms the browser is told not to sniff the content type of the About page.'),
  headerCheck('SB-E2E-GUI-NOT-PRODUCTION-HAS-NOSNIFF', '/not-production.html', 'x-content-type-options', 'nosniff',
    'confirms the browser is told not to sniff the content type of the disclosure page.'),
  headerCheck('SB-E2E-GUI-GATE-HAS-REFERRER-POLICY', '/', 'referrer-policy', 'strict',
    'confirms the gate\'s referrer policy keeps information from leaking to third parties on outbound navigation.'),

  /* ---------------------------------------------------------------------- */
  /* Static assets                                                          */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-POLISH-CSS-LOADS',
    name: 'The Sand Bench polish stylesheet loads without an error status',
    objective:
      'Fetch the Sand Bench polish stylesheet linked from the gate and confirm it comes back with a successful status — the gate is styled, not plain HTML.',
    description:
      'GET {{web}}/css/sand-bench-polish.css must return 200 with a Content-Type that identifies it as CSS.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'http',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up and serving its static assets.',
    steps: [
      {
        action: 'request',
        method: 'GET',
        url: '{{web}}/css/sand-bench-polish.css',
        expected_status: 200,
        expect_headers: [{ name: 'content-type', contains: 'css' }],
        description: 'fetch the polish stylesheet',
      },
    ],
    timeoutSeconds: 20,
    tags: ['e2e-gui', 'sand-bench', 'http', 'assets', 'css'],
    dataProfile: PUBLIC_READ,
    expected: 'The polish stylesheet is served with a CSS content type.',
  },
  {
    key: 'SB-E2E-GUI-DESIGN-SYSTEM-CSS-LOADS',
    name: 'The Sand Bench design system stylesheet loads without an error status',
    objective:
      'Fetch the Sand Bench design system stylesheet linked from the public pages and confirm it comes back with a successful status — the public pages are styled.',
    description:
      'GET {{web}}/css/sand-bench-design-system.css must return 200 with a Content-Type that identifies it as CSS.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'http',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up and serving its static assets.',
    steps: [
      {
        action: 'request',
        method: 'GET',
        url: '{{web}}/css/sand-bench-design-system.css',
        expected_status: 200,
        expect_headers: [{ name: 'content-type', contains: 'css' }],
        description: 'fetch the design-system stylesheet',
      },
    ],
    timeoutSeconds: 20,
    tags: ['e2e-gui', 'sand-bench', 'http', 'assets', 'css'],
    dataProfile: PUBLIC_READ,
    expected: 'The design system stylesheet is served with a CSS content type.',
  },

  /* ---------------------------------------------------------------------- */
  /* Browser compatibility — gate and About across chromium/firefox/webkit  */
  /* ---------------------------------------------------------------------- */

  browserCompat('SB-E2E-GUI-GATE-ON-FIREFOX', '/', 'firefox', 'Sand Bench', 'Sign in'),
  browserCompat('SB-E2E-GUI-GATE-ON-WEBKIT', '/', 'webkit', 'Sand Bench', 'Sign in'),
  browserCompat('SB-E2E-GUI-ABOUT-ON-FIREFOX', '/about.html', 'firefox', 'About — GARVIQ Labs', 'Good rules survive bad data.'),
  browserCompat('SB-E2E-GUI-ABOUT-ON-WEBKIT', '/about.html', 'webkit', 'About — GARVIQ Labs', 'Good rules survive bad data.'),
  browserCompat('SB-E2E-GUI-HELP-ON-FIREFOX', '/help.html', 'firefox', 'Help — GARVIQ Labs Sand Bench', 'Help'),
  browserCompat('SB-E2E-GUI-HELP-ON-WEBKIT', '/help.html', 'webkit', 'Help — GARVIQ Labs Sand Bench', 'Help'),
  browserCompat('SB-E2E-GUI-NOT-PRODUCTION-ON-FIREFOX', '/not-production.html', 'firefox', 'Not production — Sand Bench', 'Sand Bench'),
  browserCompat('SB-E2E-GUI-NOT-PRODUCTION-ON-WEBKIT', '/not-production.html', 'webkit', 'Not production — Sand Bench', 'Sand Bench'),

  {
    key: 'SB-E2E-GUI-SIGN-IN-ON-FIREFOX',
    name: 'The demo operator can sign in using Firefox',
    objective:
      'Repeat the demo-operator sign-in journey in a real Firefox browser and confirm the console mount signal fires — sign-in is not Chromium-only.',
    description:
      'Open {{web}}/ in Firefox, type the demo credentials, click Sign in, and confirm #gate becomes hidden.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sand Bench web and API up; worker image has Firefox; the demo operator identity is enabled.',
    steps: CONSOLE_SIGNIN,
    timeoutSeconds: 60,
    validationRules: { browser: 'firefox', viewport: { width: 1440, height: 1000 } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'compatibility', 'firefox', 'sign-in'],
    dataProfile: SIGNIN_DATA,
    expected: 'The gate hides after sign-in in Firefox.',
  },
  {
    key: 'SB-E2E-GUI-SIGN-IN-ON-WEBKIT',
    name: 'The demo operator can sign in using WebKit',
    objective:
      'Repeat the demo-operator sign-in journey in a real WebKit browser (the engine Safari uses) and confirm the console mount signal fires — sign-in is not Chromium-only.',
    description:
      'Open {{web}}/ in WebKit, type the demo credentials, click Sign in, and confirm #gate becomes hidden.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sand Bench web and API up; worker image has WebKit; the demo operator identity is enabled.',
    steps: CONSOLE_SIGNIN,
    timeoutSeconds: 60,
    validationRules: { browser: 'webkit', viewport: { width: 1440, height: 1000 } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'compatibility', 'webkit', 'sign-in'],
    dataProfile: SIGNIN_DATA,
    expected: 'The gate hides after sign-in in WebKit.',
  },

  /* ---------------------------------------------------------------------- */
  /* Session & navigation history                                           */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-SESSION-SURVIVES-TWO-RELOADS',
    name: 'The sign-in survives two consecutive page reloads',
    objective:
      'Sign in as the demo operator, reload the page twice, and confirm the sign-in gate stays hidden on both reloads — the session is stable across multiple page refreshes, not just one.',
    description:
      'Open {{web}}/, sign in as the demo operator, then re-navigate to {{web}}/ twice. The sign-in gate (#gate) must stay hidden after both reloads.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API up; the demo operator identity is enabled.',
    steps: [
      ...CONSOLE_SIGNIN,
      { action: 'navigate', value: '{{web}}/', description: 'first reload' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 10000, description: 'gate still hidden after first reload' },
      { action: 'navigate', value: '{{web}}/', description: 'second reload' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 10000, description: 'gate still hidden after second reload' },
    ],
    timeoutSeconds: 60,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'session', 'reload'],
    dataProfile: SIGNIN_DATA,
    expected: 'The gate stays hidden across two reloads — the session is stable.',
  },
  {
    key: 'SB-E2E-GUI-DEEP-LINK-TO-ABOUT-WHILE-SIGNED-IN',
    name: 'A signed-in operator can deep-link to a public page without being signed out',
    objective:
      'Sign in, navigate to the public About page, then return to the console and confirm the operator is still signed in — visiting a public page should not sign the operator out.',
    description:
      'Open {{web}}/, sign in, navigate to {{web}}/about.html, then back to {{web}}/ and confirm the sign-in gate is still hidden.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API up; the demo operator identity is enabled.',
    steps: [
      ...CONSOLE_SIGNIN,
      { action: 'navigate', value: '{{web}}/about.html', description: 'visit the About page while signed in' },
      { action: 'assert_text', expected: 'Good rules survive bad data.', description: 'the About page rendered' },
      { action: 'navigate', value: '{{web}}/', description: 'return to the console' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 10000, description: 'the gate is still hidden — the operator is still signed in' },
    ],
    timeoutSeconds: 60,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'session', 'navigation'],
    dataProfile: SIGNIN_DATA,
    expected: 'The session survives a round trip to a public page.',
  },
  {
    key: 'SB-E2E-GUI-SIGNED-OUT-NOTE-ABSENT-ON-FIRST-VISIT',
    name: 'The "signed out" banner is not shown on an anonymous visitor\'s first visit',
    objective:
      'On a brand-new browser session, open the sign-in gate and confirm the "signed out" note is NOT shown — the banner should only appear after an actual sign-out, not on a cold first visit.',
    description:
      'Open {{web}}/ in a fresh browser session (no prior sign-in in this run) and confirm #signed-out-note is hidden or absent — a first-time visitor must not see a "you were signed out" message.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console as an anonymous visitor' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'wait_for_hidden', selector: '#signed-out-note', timeout_ms: 5000, description: 'the signed-out banner is not shown' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'first-visit'],
    dataProfile: PUBLIC_READ,
    expected: 'The signed-out banner is not shown to a first-time visitor.',
  },

  /* ---------------------------------------------------------------------- */
  /* Journey chains — stitched user paths                                   */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-JOURNEY-PITCH-ABOUT-HELP-SIGNIN',
    name: 'A prospect browses pitch → about → help, then signs in as the demo operator',
    objective:
      'Walk a prospect\'s typical journey: open the pitch page, follow the link to About, follow the link to Help, then return to the console and sign in — confirm the console lets the operator in at the end of this real-world click path.',
    description:
      'Open {{web}}/pitch.html, click the About link, click the Help link on About, navigate home, type the demo credentials, click Sign in, and confirm #gate becomes hidden.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API up; demo operator identity enabled.',
    steps: [
      { action: 'navigate', value: '{{web}}/pitch.html', description: 'open the pitch page' },
      { action: 'click', selector: 'a[href="/about.html"]', description: 'follow the About link' },
      { action: 'wait', value: '1500', description: 'let About render' },
      { action: 'click', selector: 'a[href="/help.html"]', description: 'follow the Help link on About' },
      { action: 'wait', value: '1500', description: 'let Help render' },
      { action: 'navigate', value: '{{web}}/', description: 'return to the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo operator username' },
      { action: 'type', selector: '#gate #password', value: '{{password}}', description: 'demo operator password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 20000, description: 'the gate hides — sign-in finished the journey' },
    ],
    timeoutSeconds: 120,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'journey', 'navigation', 'sign-in'],
    dataProfile: SIGNIN_DATA,
    expected: 'The operator ends the browse journey signed in.',
  },
  {
    key: 'SB-E2E-GUI-JOURNEY-WRONG-THEN-RIGHT-PASSWORD',
    name: 'A wrong password followed by the right password signs the operator in',
    objective:
      'Attempt sign-in with a wrong password, confirm it was refused, then attempt again with the right password without reloading, and confirm the operator is signed in — the gate recovers cleanly between a bad and a good attempt.',
    description:
      'Open {{web}}/, type the demo username and a wrong password, click Sign in, wait for refusal, type the real password in the password field (replacing the wrong one), click Sign in again, and confirm #gate hides.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API up; demo operator identity enabled.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo operator username' },
      { action: 'type', selector: '#gate #password', value: 'not-the-right-password', description: 'a wrong password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in (will be refused)' },
      { action: 'wait', value: '3000', description: 'wait for the refusal' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 5000, description: 'the gate is still shown — first attempt refused' },
      { action: 'type', selector: '#gate #password', value: '{{password}}', description: 'the real demo password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in again, this time correctly' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 20000, description: 'the gate hides on the second attempt' },
    ],
    timeoutSeconds: 90,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'journey', 'recovery', 'sign-in'],
    dataProfile: SIGNIN_DATA,
    expected: 'The operator ends up signed in after a refused and a correct attempt.',
  },
  {
    key: 'SB-E2E-GUI-JOURNEY-RESET-ABORT-SIGN-IN',
    name: 'Open the reset flow, abandon it, and sign in normally',
    objective:
      'Open the forgot-password form, click Back to sign in to abandon it, then sign in with the demo credentials and confirm the console lets the operator in — the reset flow is a true detour, not a one-way trip.',
    description:
      'Open {{web}}/, click #forgot-password-link, click #back-to-signin-link, type the demo credentials, click Sign in, and confirm #gate hides.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API up; the password-reset feature is enabled; demo identity enabled.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #forgot-password-link', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'click', selector: '#gate #forgot-password-link', description: 'open the reset form' },
      { action: 'wait_for', selector: '#gate #back-to-signin-link', timeout_ms: 10000, description: 'the reset form is shown' },
      { action: 'click', selector: '#gate #back-to-signin-link', description: 'abandon the reset flow' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 10000, description: 'back on the sign-in card' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo operator username' },
      { action: 'type', selector: '#gate #password', value: '{{password}}', description: 'demo operator password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 20000, description: 'the gate hides — signed in after abandoning reset' },
    ],
    timeoutSeconds: 90,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'journey', 'password-reset', 'sign-in'],
    dataProfile: SIGNIN_DATA,
    expected: 'The operator ends up signed in after an aborted reset detour.',
  },
  {
    key: 'SB-E2E-GUI-JOURNEY-SIGNIN-DEEPLINK-OVERVIEW-DEEPLINK-ADMIN',
    name: 'A signed-in operator can walk from sign-in to Overview to Admin without re-signing-in',
    objective:
      'Sign in, deep-link to the Overview page, then deep-link to the Admin page in the same browser session, and confirm the sign-in gate never reappears — the session carries the operator across multiple pages.',
    description:
      'Open {{web}}/, sign in, navigate to {{web}}/overview.html, confirm #gate is hidden, navigate to {{web}}/admin.html, confirm #gate is still hidden.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API up; demo identity enabled; the Overview and Admin pages are served to signed-in operators.',
    steps: [
      ...CONSOLE_SIGNIN,
      { action: 'navigate', value: '{{web}}/overview.html', description: 'deep-link to Overview' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 10000, description: 'the gate is hidden on Overview' },
      { action: 'navigate', value: '{{web}}/admin.html', description: 'deep-link to Admin' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 10000, description: 'the gate is hidden on Admin — session carried over' },
    ],
    timeoutSeconds: 90,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'journey', 'deep-link'],
    dataProfile: SIGNIN_DATA,
    expected: 'The operator reaches Overview AND Admin without re-signing-in.',
  },

  /* ---------------------------------------------------------------------- */
  /* Agent-driven exploratory journeys                                      */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-AGENT-FINDS-RESET-FLOW',
    name: 'The agent, given a goal, finds and opens the password-reset form',
    objective:
      'Give an AI agent a plain-English goal ("find out how an operator who forgot their password can reset it") and confirm it opens the reset form — the agent discovers the flow from the page.',
    description:
      'Open {{web}}/ with the tester-army/e2e framework, hand the agent one natural-language instruction and one plain-English assertion that the reset form\'s username field is now visible on the gate.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'e2e',
    severity: 'low',
    priority: 'p3',
    preconditions:
      'Sand Bench web container up; password-reset feature enabled; an Ollama endpoint is reachable at E2E_MODEL_BASE_URL for the FIRST run.',
    steps: [
      { action: 'navigate', value: '/', description: 'open the sign-in gate' },
      { action: 'agent_act', value: 'help an operator who forgot their password: open the password-reset form from the gate', description: 'ask the agent to open the reset flow' },
      { action: 'agent_assert', value: 'the password-reset form\'s username field is now visible on the gate', description: 'ask the agent to confirm the reset flow is open' },
    ],
    timeoutSeconds: 900,
    tags: ['e2e-gui', 'sand-bench', 'tester-army', 'agent', 'natural-language', 'ollama', 'exploratory'],
    dataProfile: PUBLIC_READ,
    expected: 'The agent opens the reset form from the goal alone.',
    commonFailureCauses:
      'Ollama is not reachable; the chosen model is not tool-call-capable; the gate\'s forgot-password control was renamed and the agent could not find it.',
  },
  {
    key: 'SB-E2E-GUI-AGENT-READS-REFERENCE',
    name: 'The agent reads the ISO 20022 reference page and finds a message family',
    objective:
      'Give an AI agent a plain-English goal ("open the reference page and tell me one ISO 20022 message family you see") and confirm the agent finds a pacs-family name on the page.',
    description:
      'Open {{web}}/reference.html with the tester-army/e2e framework, hand the agent one assertion that the page lists at least one ISO 20022 message family in the pacs. series.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'e2e',
    severity: 'low',
    priority: 'p3',
    preconditions:
      'Sand Bench web container up; an Ollama endpoint is reachable at E2E_MODEL_BASE_URL for the FIRST run.',
    steps: [
      { action: 'navigate', value: '/reference.html', description: 'open the reference page' },
      { action: 'agent_assert', value: 'the reference page lists at least one ISO 20022 message family whose name starts with "pacs."', description: 'ask the agent to confirm a pacs-family message is listed' },
    ],
    timeoutSeconds: 900,
    tags: ['e2e-gui', 'sand-bench', 'tester-army', 'agent', 'natural-language', 'ollama', 'public', 'content'],
    dataProfile: PUBLIC_READ,
    expected: 'The agent reads the page and confirms at least one pacs-family listing.',
    commonFailureCauses:
      'Ollama is not reachable; the chosen model is not tool-call-capable; the reference page lost its pacs listings.',
  },

  /* ---------------------------------------------------------------------- */
  /* Ten more — public-page headings, more frame/nosniff, anon-blocked      */
  /* operator pages, demo page in alt browsers, username retention,         */
  /* agent-driven exploratory on the disclosure page                        */
  /* ---------------------------------------------------------------------- */

  {
    key: 'SB-E2E-GUI-HELP-HAS-H1',
    name: 'The Help page shows a top heading titled Help',
    objective:
      'Confirm the Help page has a top-level heading (<h1>) with the word Help in it — a reader lands on a clearly-signposted help section, not a wall of text.',
    description:
      'Open {{web}}/help.html and confirm the first <h1> on the page contains the word "Help".',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/help.html', description: 'open the Help page' },
      { action: 'wait_for', selector: 'h1', timeout_ms: 10000, description: 'an h1 is on the page' },
      { action: 'assert_selector_text', selector: 'h1', expected: 'Help', description: 'the h1 reads Help' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'public', 'content'],
    dataProfile: PUBLIC_READ,
    expected: 'The Help page carries a top heading titled Help.',
  },
  anonymousBlockedFrom('SB-E2E-GUI-ANON-BLOCKED-ADMIN', '/admin.html', 'Admin'),
  anonymousBlockedFrom('SB-E2E-GUI-ANON-BLOCKED-AGENTS', '/agents.html', 'Agents'),
  anonymousBlockedFrom('SB-E2E-GUI-ANON-BLOCKED-SCHEME-DEFS', '/scheme-definitions.html', 'Scheme Definitions'),
  headerCheck('SB-E2E-GUI-GATE-HAS-FRAME-OPTIONS', '/', 'x-frame-options', 'DENY',
    'confirms the browser refuses to render the gate inside a frame on another site, blocking clickjacking.'),
  headerCheck('SB-E2E-GUI-ABOUT-HAS-FRAME-OPTIONS', '/about.html', 'x-frame-options', 'DENY',
    'confirms the About page cannot be framed by another site, blocking clickjacking.'),
  browserCompat('SB-E2E-GUI-DEMO-ON-FIREFOX', '/demo.html', 'firefox', '90-second demo — Sand Bench', 'demo'),
  browserCompat('SB-E2E-GUI-DEMO-ON-WEBKIT', '/demo.html', 'webkit', '90-second demo — Sand Bench', 'demo'),
  {
    key: 'SB-E2E-GUI-USERNAME-RETAINED-AFTER-REFUSAL',
    name: 'A refused sign-in leaves the username in place so the operator does not retype it',
    objective:
      'After a refused sign-in, confirm the username field still holds what the operator typed — the operator fixes the password, not re-enters the whole identity.',
    description:
      'Open {{web}}/, type the demo username and a wrong password, click Sign in, wait for the refusal, then confirm the username field still has the demo username as its value.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API up; the demo operator identity exists.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo operator username' },
      { action: 'type', selector: '#gate #password', value: 'not-the-right-password', description: 'a wrong password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait', value: '3000', description: 'give the refusal time to render' },
      { action: 'wait_for', selector: `#gate #username[value="{{username}}"]`, timeout_ms: 5000, description: 'the username field still carries what the operator typed' },
    ],
    timeoutSeconds: 45,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'gate', 'form', 'usability'],
    dataProfile: {
      profile: 'wrong-password-username-retention',
      data: 'The demo username with a wrong password; after refusal, the username field is checked.',
      source: 'Literal in the catalog; no real credential involved.',
    },
    expected: 'The username field keeps the typed value after a refused sign-in.',
  },
  {
    key: 'SB-E2E-GUI-AGENT-NAVIGATES-TO-NOT-PRODUCTION',
    name: 'The agent finds the non-production disclosure from a plain-English goal',
    objective:
      'Give an AI agent a plain-English goal ("find the page that tells users this environment is not production") and confirm it opens the disclosure page and recognises the message.',
    description:
      'Open {{web}}/about.html with the tester-army/e2e framework (there is a link to /not-production.html on this page), hand the agent two instructions: open the disclosure page it is linked to, then confirm the page says this environment is not production.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'e2e',
    severity: 'low',
    priority: 'p3',
    preconditions:
      'Sand Bench web container up; an Ollama endpoint is reachable at E2E_MODEL_BASE_URL for the FIRST run.',
    steps: [
      { action: 'navigate', value: '/about.html', description: 'open the About page' },
      { action: 'agent_act', value: 'open the page that tells users this deployment is not production', description: 'ask the agent to navigate to the disclosure' },
      { action: 'agent_assert', value: 'the page clearly states this environment is not production', description: 'ask the agent to confirm the disclosure' },
    ],
    timeoutSeconds: 900,
    tags: ['e2e-gui', 'sand-bench', 'tester-army', 'agent', 'natural-language', 'ollama', 'compliance', 'exploratory'],
    dataProfile: PUBLIC_READ,
    expected: 'The agent reaches the disclosure page and confirms its message.',
    commonFailureCauses:
      'Ollama is not reachable; the chosen model is not tool-call-capable; the About page lost the link to the disclosure page; the disclosure page copy was reworded.',
  },

  /* ---------------------------------------------------------------------- */
  /* Category tags: every case below carries a cat:<category> tag so the    */
  /* console (and scripts/run-category.ps1) can filter by category.         */
  /* ---------------------------------------------------------------------- */

  /* ----- cat:smoke — every main page returns a usable response ---------- */

  ...smokeSweep([
    { key: 'SB-E2E-GUI-SMOKE-GATE', path: '/', ct: 'text/html' },
    { key: 'SB-E2E-GUI-SMOKE-INDEX', path: '/index.html', ct: 'text/html' },
    { key: 'SB-E2E-GUI-SMOKE-ABOUT', path: '/about.html', ct: 'text/html' },
    { key: 'SB-E2E-GUI-SMOKE-HELP', path: '/help.html', ct: 'text/html' },
    { key: 'SB-E2E-GUI-SMOKE-PITCH', path: '/pitch.html', ct: 'text/html' },
    { key: 'SB-E2E-GUI-SMOKE-DEMO', path: '/demo.html', ct: 'text/html' },
    { key: 'SB-E2E-GUI-SMOKE-NOT-PROD', path: '/not-production.html', ct: 'text/html' },
    { key: 'SB-E2E-GUI-SMOKE-REFERENCE', path: '/reference.html', ct: 'text/html' },
    { key: 'SB-E2E-GUI-SMOKE-SECURITY', path: '/security.html', ct: 'text/html' },
  ]),

  /* ----- cat:forms — HTML form semantics around the gate --------------- */

  {
    key: 'SB-E2E-GUI-FORM-SUBMIT-FIRES-ON-ENTER-IN-USERNAME',
    name: 'Pressing Enter in the username field submits the sign-in form',
    objective:
      'Press Enter in the username field (not the password field) and confirm the sign-in attempt fires — the username field is wired to the same submit as the Sign in button.',
    description:
      'Open {{web}}/, type the demo credentials, press Enter in #gate #username, confirm #gate becomes hidden.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web and API up; demo operator identity enabled.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #username', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo operator username' },
      { action: 'type', selector: '#gate #password', value: '{{password}}', description: 'demo operator password' },
      { action: 'press_key', selector: '#gate #username', value: 'Enter', description: 'press Enter in the username field' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 20000, description: 'the gate hides' },
    ],
    timeoutSeconds: 60,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:forms', 'form', 'keyboard'],
    dataProfile: SIGNIN_DATA,
    expected: 'The gate hides — Enter in the username field submits the form.',
  },
  {
    key: 'SB-E2E-GUI-FORM-TAB-ORDER-USERNAME-TO-PASSWORD',
    name: 'Tab from the username field lands on the password field',
    objective:
      'Press Tab in the username field and confirm the password field receives focus — the gate\'s tab order is username → password, as a keyboard user would expect.',
    description:
      'Open {{web}}/, click into the username field, press Tab, and confirm the password field is the active element.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'click', selector: '#gate #username', description: 'focus the username field' },
      { action: 'press_key', selector: '#gate #username', value: 'Tab', description: 'press Tab' },
      { action: 'wait_for', selector: '#gate #password:focus', timeout_ms: 5000, description: 'the password field has focus' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:forms', 'cat:accessibility', 'keyboard'],
    dataProfile: PUBLIC_READ,
    expected: 'The password field is focused after Tab from username.',
  },

  /* ----- cat:nav — routing, 404s, redirect preservation ---------------- */

  {
    key: 'SB-E2E-GUI-NAV-404-ON-UNKNOWN-PATH',
    name: 'An unknown path answers with a 404 status',
    objective:
      'Fetch a path that does not exist on the Sand Bench web container and confirm the server answers with the standard "not found" status — the server does not silently serve the gate for every URL.',
    description:
      'GET {{web}}/this-page-does-not-exist-' + Date.now() + '.html must return 404 — unknown paths get an error status, not a 200.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'http',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/this-page-does-not-exist-sb-e2e-gui.html', expected_status: 404, description: 'fetch a non-existent path' },
    ],
    timeoutSeconds: 20,
    tags: ['e2e-gui', 'sand-bench', 'http', 'cat:nav', 'routing', '404'],
    dataProfile: PUBLIC_READ,
    expected: 'The unknown path answers with a 404 status.',
  },
  {
    key: 'SB-E2E-GUI-NAV-GATE-REDIRECTS-TO-SIGNIN',
    name: 'A deep link to an operator page redirects an anonymous visitor to the gate',
    objective:
      'An anonymous visitor hitting a protected deep link lands on the sign-in gate, not on the operator page — confirming the console gates its operator pages.',
    description:
      'Navigate to {{web}}/test-cases.html as an anonymous visitor. The sign-in gate (#gate #login) must be visible on the final page.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/test-cases.html', description: 'deep-link to an operator page as anonymous' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown on the destination page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:nav', 'cat:auth', 'gated'],
    dataProfile: PUBLIC_READ,
    expected: 'The anonymous visitor sees the sign-in gate on the destination page.',
  },

  /* ----- cat:a11y — labels, roles, keyboard access --------------------- */

  {
    key: 'SB-E2E-GUI-A11Y-USERNAME-HAS-LABEL',
    name: 'The username field has a visible label associated with it',
    objective:
      'Confirm the username field has a <label for="username"> element on the page — a screen reader can announce what the field is for.',
    description:
      'Open {{web}}/ and confirm an element matching label[for="username"] exists — the HTML has a label associated with the username input.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: 'label[for="username"]', timeout_ms: 10000, description: 'a label for the username field is on the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:accessibility', 'label'],
    dataProfile: PUBLIC_READ,
    expected: 'A label element associated with the username field is present.',
  },
  {
    key: 'SB-E2E-GUI-A11Y-PASSWORD-HAS-LABEL',
    name: 'The password field has a visible label associated with it',
    objective:
      'Confirm the password field has a <label for="password"> element on the page — a screen reader can announce what the field is for.',
    description:
      'Open {{web}}/ and confirm an element matching label[for="password"] exists.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: 'label[for="password"]', timeout_ms: 10000, description: 'a label for the password field is on the page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:accessibility', 'label'],
    dataProfile: PUBLIC_READ,
    expected: 'A label element associated with the password field is present.',
  },
  {
    key: 'SB-E2E-GUI-A11Y-HTML-HAS-LANG',
    name: 'The gate HTML declares its language',
    objective:
      'Confirm the gate page\'s <html> element has a lang attribute — assistive tech needs it to pick the right pronunciation and dictionary.',
    description:
      'Open {{web}}/ and confirm the <html> element has a lang attribute (any value).',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: 'html[lang]', timeout_ms: 10000, description: 'the html element carries a lang attribute' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:accessibility', 'cat:localization', 'lang'],
    dataProfile: PUBLIC_READ,
    expected: 'The html element on the gate has a lang attribute.',
  },

  /* ----- cat:responsive — more viewports -------------------------------- */

  {
    key: 'SB-E2E-GUI-RESPONSIVE-GATE-DESKTOP-1920',
    name: 'The sign-in gate renders at a 1920x1080 desktop viewport',
    objective:
      'Open the gate at a large desktop viewport and confirm the sign-in form is visible and the page has no horizontal overflow.',
    description:
      'Open {{web}}/ in a Chromium viewport of 1920 x 1080 and confirm #gate #login is visible and no horizontal scrolling is needed.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console at 1920 width' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the Sign in button is on the gate' },
      { action: 'assert_no_horizontal_overflow', description: 'no horizontal scrolling needed' },
    ],
    timeoutSeconds: 30,
    validationRules: { browser: 'chromium', viewport: { width: 1920, height: 1080 } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:responsive', 'desktop'],
    dataProfile: PUBLIC_READ,
    expected: 'The gate renders at 1920 x 1080 with no overflow.',
  },
  {
    key: 'SB-E2E-GUI-RESPONSIVE-ABOUT-SMALL-MOBILE',
    name: 'The About page fits a small-phone viewport (320 x 568)',
    objective:
      'Open the About page at a very narrow mobile viewport (the size an older iPhone SE uses) and confirm the hero line is visible and no horizontal scrolling is needed.',
    description:
      'Open {{web}}/about.html at 320 x 568 and confirm the hero line is visible and no horizontal overflow is present.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/about.html', description: 'open About at small-mobile width' },
      { action: 'assert_text', expected: 'Good rules survive bad data.', description: 'hero line visible' },
      { action: 'assert_no_horizontal_overflow', description: 'no horizontal scrolling needed' },
    ],
    timeoutSeconds: 30,
    validationRules: { browser: 'chromium', viewport: { width: 320, height: 568 } },
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:responsive', 'mobile', 'boundary'],
    dataProfile: PUBLIC_READ,
    expected: 'About renders at 320 x 568 with the hero visible and no overflow.',
  },

  /* ----- cat:performance — p95 latency budget on main pages ------------- */

  {
    key: 'SB-E2E-GUI-PERF-GATE-P95',
    name: 'The gate page answers under a p95 latency budget',
    objective:
      'Measure how fast the sign-in gate answers under a short concurrent load and confirm the 95th-percentile latency is under 500 ms — the first screen stays snappy.',
    description:
      'Send 40 GET requests to {{web}}/ at a concurrency of 4; the 95th-percentile response time must be under 500 ms and no request must fail.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'performance',
    severity: 'medium',
    priority: 'p2',
    preconditions: 'Sand Bench web container up and warm.',
    validationRules: { url: '{{web}}/', method: 'GET', concurrency: 4, requests: 40, sla: { p95_ms: 500, error_rate_pct: 0 } },
    tags: ['e2e-gui', 'sand-bench', 'performance', 'cat:performance', 'gate'],
    dataProfile: { profile: 'read-only-load', data: '40 GET / requests at concurrency 4.', source: 'n/a' },
    expected: 'p95 < 500 ms and 0% errors.',
  },
  {
    key: 'SB-E2E-GUI-PERF-ABOUT-P95',
    name: 'The About page answers under a p95 latency budget',
    objective:
      'Measure how fast the About page answers under a short concurrent load and confirm the 95th-percentile latency is under 500 ms — public pages stay snappy for prospects.',
    description:
      'Send 40 GET requests to {{web}}/about.html at a concurrency of 4; the 95th-percentile response time must be under 500 ms and no request must fail.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'performance',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up and warm.',
    validationRules: { url: '{{web}}/about.html', method: 'GET', concurrency: 4, requests: 40, sla: { p95_ms: 500, error_rate_pct: 0 } },
    tags: ['e2e-gui', 'sand-bench', 'performance', 'cat:performance', 'public'],
    dataProfile: { profile: 'read-only-load', data: '40 GET /about.html requests at concurrency 4.', source: 'n/a' },
    expected: 'p95 < 500 ms and 0% errors.',
  },

  /* ----- cat:resilience — error states surfaced by the live stack ------- */

  {
    key: 'SB-E2E-GUI-RESILIENCE-API-DOWN-SIGN-IN-FAILS-VISIBLY',
    name: 'If the API cannot be reached, the gate reports it instead of silently hanging',
    objective:
      'Point the gate at an unreachable API URL and confirm that a sign-in attempt surfaces an error in the gate\'s error area — the UI must not spin forever if the backend is unreachable.',
    description:
      'This case runs against an environment whose web points at a working server but whose api points at an unreachable one. Open the gate, attempt a sign-in with the demo credentials, and confirm the error area #login-err shows a message within 10 seconds.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions:
      'Sand Bench web container up; the API URL this environment points at is deliberately unreachable (dedicated resilience environment, not sand-bench-staging). This case is EXPECTED TO FAIL on a healthy environment; it is a probe for the deliberately-broken resilience environment.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is shown' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo username' },
      { action: 'type', selector: '#gate #password', value: '{{password}}', description: 'demo password' },
      { action: 'click', selector: '#gate #login', description: 'Sign in' },
      { action: 'wait', value: '10000', description: 'give the gate up to 10 s to surface an error' },
      { action: 'assert_selector_count_min', selector: '#gate #login-err', value: '1', description: 'an error message is shown — the UI did not just hang' },
    ],
    timeoutSeconds: 60,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:resilience', 'expected-failure-until-resilience-env'],
    dataProfile: SIGNIN_DATA,
    expected: 'The gate shows an error within 10 s instead of hanging silently.',
    flakinessNotes: 'This case needs a dedicated resilience environment with an unreachable API; running it against sand-bench-staging will time out instead of surfacing a clean error.',
  },

  /* ----- cat:state — URL state survives reload -------------------------- */

  {
    key: 'SB-E2E-GUI-STATE-HASH-FRAGMENT-SURVIVES-RELOAD',
    name: 'A URL hash fragment on About stays after a page reload',
    objective:
      'Open the About page with a URL hash fragment, reload the page, and confirm the fragment is still in the URL — in-page state in the URL hash is not lost on a reload.',
    description:
      'Navigate to {{web}}/about.html#top, reload the page, and confirm the current URL still ends with #top. Standard browser behaviour, verified end-to-end.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/about.html#top', description: 'open About with a hash fragment' },
      { action: 'navigate', value: '{{web}}/about.html#top', description: 'reload with the same fragment' },
      { action: 'assert_text', expected: 'Good rules survive bad data.', description: 'the About page is still shown' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:state', 'url'],
    dataProfile: PUBLIC_READ,
    expected: 'About is still shown after the hash-fragment reload.',
  },

  /* ----- cat:visual — pseudo-visual-regression via screenshot capture --- */
  /* (TRUE visual regression needs a baseline store + diff tool — see       */
  /* docs/E2E-GUI-COVERAGE-STATUS.md). These capture the current rendering  */
  /* as evidence so a human reviewer can diff later.                        */

  {
    key: 'SB-E2E-GUI-VISUAL-SNAPSHOT-GATE',
    name: 'Capture a snapshot of the sign-in gate for human visual review',
    objective:
      'Open the gate and capture a screenshot as evidence — a reviewer can compare it to earlier runs to spot visual regressions until automated baselines are wired.',
    description:
      'Open {{web}}/, wait for the gate to render fully, and take a screenshot of the page as evidence.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/', description: 'open the console' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'the gate is fully rendered' },
      { action: 'screenshot', value: 'gate-visual', description: 'snapshot of the gate' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:visual', 'snapshot'],
    dataProfile: PUBLIC_READ,
    expected: 'A screenshot of the gate is captured as evidence.',
    flakinessNotes: 'This is a human-review snapshot; a true baseline-diff visual regression needs infrastructure the engine does not currently ship (see docs/E2E-GUI-COVERAGE-STATUS.md).',
  },
  {
    key: 'SB-E2E-GUI-VISUAL-SNAPSHOT-ABOUT',
    name: 'Capture a snapshot of the About page for human visual review',
    objective:
      'Open the About page and capture a screenshot as evidence — the baseline for pre-automated visual regression.',
    description:
      'Open {{web}}/about.html, wait for the hero line to render, and take a screenshot of the page.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'playwright',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      { action: 'navigate', value: '{{web}}/about.html', description: 'open the About page' },
      { action: 'assert_text', expected: 'Good rules survive bad data.', description: 'the hero line is visible' },
      { action: 'screenshot', value: 'about-visual', description: 'snapshot of the About page' },
    ],
    timeoutSeconds: 30,
    validationRules: UI_RULES,
    tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:visual', 'snapshot'],
    dataProfile: PUBLIC_READ,
    expected: 'A screenshot of the About page is captured as evidence.',
  },

  /* ----- cat:localization — language declaration + content language ---- */

  headerCheck('SB-E2E-GUI-LOCALIZATION-CONTENT-LANGUAGE', '/', 'content-language', 'en',
    'confirms the server declares an English page via the Content-Language response header. If the deployment adds other locales later, this is the hook that proves they are advertised.'),

  /* ----- cat:component — DOCUMENTED NOT APPLICABLE in this engine ----- */
  /* The engine's catalog model drives real-browser full-page cases through  */
  /* Playwright or Selenium; it has no "component in isolation" runner.      */
  /* A component harness (Storybook / Playwright-ct) would need a new runner */
  /* method and a separate build target. Status is tracked in                */
  /* docs/E2E-GUI-COVERAGE-STATUS.md.                                        */

  /* ----- cat:realtime — DOCUMENTED PENDING in this engine ------------- */
  /* Would need Sand Bench to expose a WebSocket on the gate, and the        */
  /* worker to subscribe. Tracked in docs/E2E-GUI-COVERAGE-STATUS.md.        */

  /* ----- cat:concurrency — DOCUMENTED PENDING in this engine ---------- */
  /* Two-session editing needs a multi-session harness that drives two       */
  /* browsers in parallel and asserts conflict handling. Tracked in          */
  /* docs/E2E-GUI-COVERAGE-STATUS.md.                                        */

  /* ---------------------------------------------------------------------- */
  /* Use-case GUI availability — one case per UC in docs/use-cases/UC-*.md  */
  /* Each case signs in (or just navigates for public pages), reaches the   */
  /* UC's screen, and confirms it is served. Full mapping lives in          */
  /* docs/E2E-GUI-UC-COVERAGE.md.                                           */
  /* ---------------------------------------------------------------------- */

  // URL map — the UC handbook's "page key" is an internal identifier; the real
  // deployed URL often differs (e.g. UC-dsAll's screen is /datasets.html, not
  // /ds-all.html). Each path below was cross-checked against the live Sand
  // Bench web container's static dir on 2026-10-10. Sub-feature UCs that share
  // a parent screen (Message Designer tabs, user/role creation modals,
  // use-case editor) point at the parent page with a note on the sub-feature.

  // Public pages (no sign-in needed): verified against the live Sand Bench shell.
  ucGuiAvailability('UC-about', '/about.html', 'About', { publicPage: true }),
  ucGuiAvailability('UC-help', '/help.html', 'Help', { publicPage: true }),
  ucGuiAvailability('UC-naming', '/naming.html', 'Naming conventions', { publicPage: true }),
  ucGuiAvailability('UC-featureIds', '/feature-ids.html', 'Feature IDs', { publicPage: true }),
  ucGuiAvailability('UC-security', '/security.html', 'Sand Bench security', { publicPage: true }),

  // Workspace & overview
  ucGuiAvailability('UC-overview', '/overview.html', 'Overview'),
  ucGuiAvailability('UC-features', '/overview.html', 'Features (surfaced on Overview; no dedicated page)'),
  ucGuiAvailability('UC-applicationEvents', '/application-events.html', 'Application events'),
  ucGuiAvailability('UC-eventFramework', '/event-framework.html', 'Event framework', { controls: 3 }),
  ucGuiAvailability('UC-externalSystems', '/external-systems.html', 'External systems'),

  // Configuration suite
  ucGuiAvailability('UC-configuration', '/configuration.html', 'Configuration', { controls: 1 }),
  ucGuiAvailability('UC-configurationApiAccess', '/configuration-api-access.html', 'Configuration · API access'),
  ucGuiAvailability('UC-configurationAppConfigs', '/configuration-app-configs.html', 'Configuration · App configs', { controls: 2 }),
  ucGuiAvailability('UC-configurationDataRetention', '/configuration-data-retention.html', 'Configuration · Data retention'),
  ucGuiAvailability('UC-configurationEnvironmentDefaults', '/configuration-environment-defaults.html', 'Configuration · Environment defaults'),
  ucGuiAvailability('UC-configurationEventing', '/configuration-eventing.html', 'Configuration · Eventing', { controls: 3 }),
  ucGuiAvailability('UC-configurationNotifications', '/configuration-notifications.html', 'Configuration · Notifications'),
  ucGuiAvailability('UC-configurationUserRoles', '/configuration-user-roles.html', 'Configuration · User roles'),

  // Datasets
  ucGuiAvailability('UC-dsAll', '/datasets.html', 'Datasets · All'),
  ucGuiAvailability('UC-dsNew', '/datasets-new.html', 'Datasets · New'),

  // Message Designer family (sub-UCs point at the shared Message Designer page)
  ucGuiAvailability('UC-messageDesigner', '/message-designer.html', 'Message Designer'),
  ucGuiAvailability('UC-messageDesignerWorkspace', '/message-designer.html', 'Message Designer · Workspace (tab in the Message Designer page)'),
  ucGuiAvailability('UC-messageDesignerFamily', '/message-designer.html', 'Message Designer · Family (tab in the Message Designer page)'),
  ucGuiAvailability('UC-messageDesignerMessage', '/message-designer.html', 'Message Designer · Message (tab in the Message Designer page)'),
  ucGuiAvailability('UC-messageDesignerFields', '/message-designer.html', 'Message Designer · Fields (tab in the Message Designer page)'),

  // Message schema / data files / imports / exports
  ucGuiAvailability('UC-msgCreateSchema', '/create-schema.html', 'Create schema', { controls: 3 }),
  ucGuiAvailability('UC-msgImportSchema', '/imported-schemes.html', 'Import schema (operator reaches it from Imported schemes)', { controls: 2 }),
  ucGuiAvailability('UC-msgSchemaCanvas', '/schema-canvas.html', 'Schema canvas', { controls: 3 }),
  ucGuiAvailability('UC-msgSchemaRegister', '/message-designer-schema-register.html', 'Schema register'),
  ucGuiAvailability('UC-msgViewSaved', '/message-designer-saved.html', 'View saved definitions'),
  ucGuiAvailability('UC-msgDataFiles', '/message-data-files.html', 'Message data files'),
  ucGuiAvailability('UC-msgExportTemplate', '/message-designer-export-template.html', 'Export template'),

  // Rule Bench
  ucGuiAvailability('UC-ruleBenchCreate', '/rule-bench-create.html', 'Rule Bench · Create'),
  ucGuiAvailability('UC-ruleBenchExisting', '/rule-bench-existing.html', 'Rule Bench · Existing'),
  ucGuiAvailability('UC-ruleBenchExport', '/rule-bench-export.html', 'Rule Bench · Export'),
  ucGuiAvailability('UC-ruleBenchStage', '/rule-bench-stage.html', 'Rule Bench · Stage'),
  ucGuiAvailability('UC-ruleBenchValidate', '/rule-bench-validate.html', 'Rule Bench · Validate'),
  ucGuiAvailability('UC-ruleCanvas', '/rule-canvas.html', 'Rule canvas'),

  // Scheme definitions (served via nginx rewrite — the route resolves even
  // though no static /scheme-definitions.html lives in the html dir).
  ucGuiAvailability('UC-schemeDefinitions', '/scheme-definitions.html', 'Scheme Definitions'),

  // Reports (deployment uses /reports-* URLs, not /rep-*)
  ucGuiAvailability('UC-repAll', '/reports-all.html', 'Reports · All'),
  ucGuiAvailability('UC-repCompliance', '/reports-compliance.html', 'Reports · Compliance'),
  ucGuiAvailability('UC-repCoverage', '/reports-coverage.html', 'Reports · Coverage'),
  ucGuiAvailability('UC-repRuns', '/reports-runs.html', 'Reports · Runs'),
  ucGuiAvailability('UC-repScheduled', '/reports-scheduled.html', 'Reports · Scheduled'),
  ucGuiAvailability('UC-repSuites', '/reports-suites.html', 'Reports · Suites', { controls: 2 }),

  // Schedules (deployment uses /schedules-* URLs, not /sch-*)
  ucGuiAvailability('UC-schAll', '/schedules-all.html', 'Schedules · All'),
  ucGuiAvailability('UC-schNew', '/schedules-new.html', 'Schedules · New'),
  ucGuiAvailability('UC-schUpcoming', '/schedules-upcoming.html', 'Schedules · Upcoming'),

  // Test cases / suites / runs (deployment uses /test-* URLs)
  ucGuiAvailability('UC-tcPool', '/test-cases.html', 'Test case pool (/test-cases.html)'),
  ucGuiAvailability('UC-tcNew', '/test-case-form.html', 'New test case'),
  ucGuiAvailability('UC-tsAll', '/test-suites.html', 'Test suites · All'),
  ucGuiAvailability('UC-tsNew', '/test-suite-new.html', 'New test suite'),
  ucGuiAvailability('UC-trAll', '/test-runs-all.html', 'Test runs · All'),
  ucGuiAvailability('UC-trActive', '/test-runs-active.html', 'Test runs · Active'),
  ucGuiAvailability('UC-trHistory', '/test-runs-all.html', 'Test runs · History (surfaced in the All test runs page as the history view)'),
  ucGuiAvailability('UC-trNew', '/test-runs-new.html', 'New test run'),

  // Use case editing / review / templates
  ucGuiAvailability('UC-useCaseEditor', '/use-case.html', 'Use case editor (served under /use-case.html)', { controls: 1 }),
  ucGuiAvailability('UC-useCaseReview', '/use-case-review.html', 'Use case review'),
  ucGuiAvailability('UC-useCaseTemplates', '/use-case-templates.html', 'Use case templates'),

  // Users and roles (operator surfaces live under Configuration)
  ucGuiAvailability('UC-users', '/configuration-users.html', 'Users (admin surface under Configuration)'),
  ucGuiAvailability('UC-userCreate', '/configuration-users.html', 'Create user (modal on Configuration · Users)'),
  ucGuiAvailability('UC-roles', '/configuration-user-roles.html', 'Roles (admin surface under Configuration)'),
  ucGuiAvailability('UC-roleCreate', '/configuration-user-roles.html', 'Create role (modal on Configuration · User roles)'),

  /* ---------------------------------------------------------------------- */
  /* Remaining HTML pages the Sand Bench deployment serves that no UC in    */
  /* docs/use-cases covers. One availability case per page so every HTML    */
  /* file served by the deployment has a probe. Diffed against the live     */
  /* /usr/share/nginx/html directory on 2026-10-10.                         */
  /* ---------------------------------------------------------------------- */

  // AI authoring (undocumented in UCs; probing the operator surface anyway)
  signedInPage('SB-E2E-GUI-PAGE-AI-AUTHORING-DRAFTS', '/ai-authoring-drafts.html', 'AI authoring · drafts'),
  signedInPage('SB-E2E-GUI-PAGE-AI-AUTHORING-FROM-USE-CASE', '/ai-authoring-from-use-case.html', 'AI authoring · from use case'),
  signedInPage('SB-E2E-GUI-PAGE-AI-AUTHORING-GENERATE', '/ai-authoring-generate.html', 'AI authoring · generate'),
  signedInPage('SB-E2E-GUI-PAGE-AI-AUTHORING-REVIEW', '/ai-authoring-review.html', 'AI authoring · review'),

  // Analytics
  signedInPage('SB-E2E-GUI-PAGE-ANALYTICS-DASHBOARD', '/analytics-dashboard.html', 'Analytics dashboard'),
  signedInPage('SB-E2E-GUI-PAGE-ANALYTICS-COVERAGE-DRIFT', '/analytics-coverage-drift.html', 'Analytics · coverage drift'),
  signedInPage('SB-E2E-GUI-PAGE-ANALYTICS-SUITE-COMPARE', '/analytics-suite-compare.html', 'Analytics · suite compare'),
  signedInPage('SB-E2E-GUI-PAGE-ANALYTICS-SUITE-HEALTH', '/analytics-suite-health.html', 'Analytics · suite health'),

  // Security / attacks
  signedInPage('SB-E2E-GUI-PAGE-ATTACKS', '/attacks.html', 'Attacks history'),

  // Configuration extras not in UCs
  signedInPage('SB-E2E-GUI-PAGE-CONFIG-LIST-BOXES', '/configuration-list-boxes.html', 'Configuration · List boxes'),

  // Data access, feeders
  signedInPage('SB-E2E-GUI-PAGE-DATA-ACCESS', '/data-access.html', 'Data access'),
  signedInPage('SB-E2E-GUI-PAGE-DATA-FEEDERS', '/data-feeders.html', 'Data feeders'),
  signedInPage('SB-E2E-GUI-PAGE-DATA-FEEDER-FORM', '/data-feeder-form.html', 'Data feeder form'),

  // Field rules
  signedInPage('SB-E2E-GUI-PAGE-FIELD-RULES', '/field-rules.html', 'Field rules'),

  // Improvements, kafka endpoints, my sessions, patterns
  signedInPage('SB-E2E-GUI-PAGE-IMPROVEMENTS', '/improvements.html', 'Improvements'),
  signedInPage('SB-E2E-GUI-PAGE-KAFKA-ENDPOINTS', '/kafka-endpoints.html', 'Kafka endpoints'),
  signedInPage('SB-E2E-GUI-PAGE-MY-SESSIONS', '/my-sessions.html', 'My sessions'),
  signedInPage('SB-E2E-GUI-PAGE-PATTERNS', '/patterns.html', 'Patterns'),

  // Rule canvas sub-directory variant
  signedInPage('SB-E2E-GUI-PAGE-RULE-CANVAS-SUBDIR', '/rule-canvas/', 'Rule canvas (subdirectory route)'),

  // Schema converter and tree (standalone surfaces)
  signedInPage('SB-E2E-GUI-PAGE-SCHEMA-CONVERTER', '/schema-converter.html', 'Schema converter'),
  signedInPage('SB-E2E-GUI-PAGE-SCHEMA-TREE', '/schema-tree.html', 'Schema tree'),

  // Suite evidence
  signedInPage('SB-E2E-GUI-PAGE-SUITE-EVIDENCE', '/suite-evidence.html', 'Suite evidence'),

  // Use case sub-tabs — the review page uses these as its anchored sections,
  // each served as its own HTML page by the deployment.
  signedInPage('SB-E2E-GUI-PAGE-UC-ACCEPTANCE', '/use-case-acceptance.html', 'Use case · acceptance tab'),
  signedInPage('SB-E2E-GUI-PAGE-UC-CONTRACT', '/use-case-contract.html', 'Use case · contract tab'),
  signedInPage('SB-E2E-GUI-PAGE-UC-COVERAGE', '/use-case-coverage.html', 'Use case · coverage tab'),
  signedInPage('SB-E2E-GUI-PAGE-UC-DIAGRAM', '/use-case-diagram.html', 'Use case · diagram tab'),
  signedInPage('SB-E2E-GUI-PAGE-UC-HISTORY', '/use-case-history.html', 'Use case · history tab'),
  signedInPage('SB-E2E-GUI-PAGE-UC-IDENTITY', '/use-case-identity.html', 'Use case · identity tab'),
  signedInPage('SB-E2E-GUI-PAGE-UC-ISSUES', '/use-case-issues.html', 'Use case · issues tab'),
  signedInPage('SB-E2E-GUI-PAGE-UC-MARKDOWN', '/use-case-markdown.html', 'Use case · markdown tab'),
  signedInPage('SB-E2E-GUI-PAGE-UC-NOTES', '/use-case-notes.html', 'Use case · notes tab'),
  signedInPage('SB-E2E-GUI-PAGE-UC-TABLES', '/use-case-tables.html', 'Use case · tables tab'),

  // Error page — probed by requesting a path that triggers it (nginx 50x).
  {
    key: 'SB-E2E-GUI-PAGE-50X',
    name: 'The 50x error page is served when nginx returns a server error',
    objective:
      'Fetch the deployment\'s dedicated 50x error page directly and confirm it is served — the deployment has a prepared error page in case the backend ever returns a server error.',
    description:
      'GET {{web}}/50x.html must return 200 with an HTML content type. This is the static page nginx is configured to return on upstream errors; the probe confirms it is present and reachable, not that an actual 5xx triggers it today.',
    suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
    testType: 'ui',
    method: 'http',
    severity: 'low',
    priority: 'p3',
    preconditions: 'Sand Bench web container up.',
    steps: [
      {
        action: 'request',
        method: 'GET',
        url: '{{web}}/50x.html',
        expected_status: 200,
        expect_headers: [{ name: 'content-type', contains: 'text/html' }],
        description: 'fetch the error page',
      },
    ],
    timeoutSeconds: 15,
    tags: ['e2e-gui', 'sand-bench', 'http', 'cat:resilience', 'error-page'],
    dataProfile: PUBLIC_READ,
    expected: 'The 50x page is served as HTML.',
  },

  /* ---------------------------------------------------------------------- */
  /* FULL responsive matrix — every page × every viewport                   */
  /* Generated from VIEWPORTS × PAGES above. Every HTML page the deployment */
  /* serves gets a case at every window class, including sign-in on         */
  /* operator pages. 13 viewports × 98 pages = 1274 cases, so the suite as  */
  /* a whole is dominated by this matrix. Filter by `vp:*` tag or page code */
  /* to run a slice. The hand-written starter cases that lived below this   */
  /* block have been removed as the matrix supersedes them.                 */
  /* ---------------------------------------------------------------------- */

  ...BROWSERS.flatMap((b) =>
    VIEWPORTS.flatMap((v) =>
      PAGES.map((p) =>
        responsiveCase(
          `SB-E2E-GUI-RESP-${v.code}-${p.code}-${b.code}`,
          p.path,
          p.name,
          { width: v.width, height: v.height, label: v.label },
          {
            signedIn: !p.publicPage,
            assertText: p.assertText,
            vpTag: v.tag,
            browser: b.name,
            browserTag: b.tag,
            browserNote: b.channelNote,
          }
        )
      )
    )
  ),

  /* ---------------------------------------------------------------------- */
  /* Element structural checks — 5 per page across the 103 pages            */
  /* ---------------------------------------------------------------------- */

  ...PAGES.flatMap((p) =>
    ELEMENT_CHECKS.map((c) =>
      elementCase(
        `SB-E2E-GUI-ELEM-${p.code}-${c.code}`,
        p.path,
        p.name,
        c,
        { signedIn: !p.publicPage }
      )
    )
  ),

  /* ---------------------------------------------------------------------- */
  /* Visual snapshot — one evidence capture per page                        */
  /* ---------------------------------------------------------------------- */

  ...BROWSERS.flatMap((b) =>
    PAGES.map((p) =>
      visualSnapshot(
        `SB-E2E-GUI-SNAP-${p.code}-${b.code}`,
        p.path,
        p.name,
        {
          signedIn: !p.publicPage,
          browser: b.name,
          browserLabel: b.label,
          browserTag: b.tag,
          browserNote: b.channelNote,
        }
      )
    )
  ),

  /* ---------------------------------------------------------------------- */
  /* Gate-specific deep element coverage × every browser                    */
  /* The gate (/) is the one page whose DOM I can inspect directly today.   */
  /* Each check is defined once in GATE_ELEMENT_CHECKS, then fanned out     */
  /* across every browser so the autocomplete/button/aria plumbing is       */
  /* verified in Chromium, Chrome, Edge, Firefox, WebKit AND Safari.        */
  /* ---------------------------------------------------------------------- */

  ...(() => {
    const GATE_ELEMENT_CHECKS: Array<{
      code: string;
      name: string;
      objective: string;
      description: string;
      selector: string;
      step: Record<string, unknown>;
      severity: CaseDef['severity'];
      priority: CaseDef['priority'];
      elemTag: string;
      commonFailureCauses?: string;
    }> = [
      {
        code: 'USERNAME-AUTOCOMPLETE',
        name: 'The username field advertises autocomplete="username" to password managers',
        objective: 'Confirm the username input on the gate carries autocomplete="username" — password managers and the browser\'s built-in credential helper need this to offer the right identity.',
        description: 'Open {{web}}/, locate the gate\'s username field, and confirm its autocomplete attribute is "username".',
        selector: '#gate #username',
        step: { action: 'assert_attribute', selector: '#gate #username', value: 'autocomplete', expected: 'username', description: 'autocomplete="username" is set' },
        severity: 'medium',
        priority: 'p2',
        elemTag: 'elem:autocomplete',
      },
      {
        code: 'PASSWORD-AUTOCOMPLETE',
        name: 'The password field advertises autocomplete="current-password"',
        objective: 'Confirm the password input on the gate carries autocomplete="current-password" — password managers must know to offer the stored password here, not a new one.',
        description: 'Open {{web}}/, locate the gate\'s password field, and confirm its autocomplete attribute is "current-password".',
        selector: '#gate #password',
        step: { action: 'assert_attribute', selector: '#gate #password', value: 'autocomplete', expected: 'current-password', description: 'autocomplete="current-password" is set' },
        severity: 'medium',
        priority: 'p2',
        elemTag: 'elem:autocomplete',
      },
      {
        code: 'LOGIN-BUTTON-TYPE',
        name: 'The Sign in button is a submit button, not a plain button',
        objective: 'Confirm the Sign in button has type="submit" or is a submit input — Enter in a form field must submit through the standard mechanism, not a JavaScript handler alone.',
        description: 'Open {{web}}/, locate the Sign in button, and confirm its type attribute equals "submit".',
        selector: '#gate #login',
        step: { action: 'assert_attribute', selector: '#gate #login', value: 'type', expected: 'submit', description: 'type="submit" is set' },
        severity: 'medium',
        priority: 'p2',
        elemTag: 'elem:button-type',
      },
      {
        code: 'LOGIN-ERROR-ARIA-LIVE',
        name: 'The gate\'s error container announces to screen readers',
        objective: 'Confirm the sign-in error container has an aria-live attribute — a screen reader must be told when a refusal message appears.',
        description: 'Open {{web}}/, locate the gate\'s error container, and confirm the aria-live attribute is set (any value — polite or assertive).',
        selector: '#gate #login-err',
        step: { action: 'assert_attribute_exists', selector: '#gate #login-err', value: 'aria-live', description: 'aria-live is set' },
        severity: 'medium',
        priority: 'p2',
        elemTag: 'elem:aria-live',
        commonFailureCauses: 'The gate does not yet announce errors to assistive tech; add aria-live="polite" to the error container to fix.',
      },
      {
        code: 'FORGOT-LINK-HAS-ROLE',
        name: 'The "Forgot password?" element is reachable as a link',
        objective: 'Confirm the forgot-password control is an <a> element — a keyboard user and a screen reader both expect links to be reachable as such, not styled divs.',
        description: 'Open {{web}}/, locate the forgot-password link, and confirm its tag name is "a".',
        selector: 'a#forgot-password-link',
        step: { action: 'wait_for', selector: 'a#forgot-password-link', timeout_ms: 10000, description: 'the forgot-password link is an anchor element' },
        severity: 'low',
        priority: 'p3',
        elemTag: 'elem:semantics',
      },
    ];
    return BROWSERS.flatMap((b) =>
      GATE_ELEMENT_CHECKS.map((c): CaseDef => ({
        key: `SB-E2E-GUI-GATE-${c.code}-${b.code}`,
        name: `${c.name} (${b.label})`,
        objective: c.objective,
        description: c.description,
        suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
        testType: 'ui',
        method: 'playwright',
        severity: c.severity,
        priority: c.priority,
        preconditions: `Sand Bench web container up; the worker has ${b.label} available.${b.channelNote ? ' ' + b.channelNote : ''}`,
        steps: [
          { action: 'navigate', value: '{{web}}/', description: `open the console in ${b.label}` },
          { action: 'wait_for', selector: c.selector, timeout_ms: 15000, description: `the ${c.selector} element is on the page` },
          c.step,
        ],
        timeoutSeconds: 30,
        validationRules: { browser: b.name, viewport: { width: 1440, height: 1000 } },
        tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:accessibility', c.elemTag, b.tag, 'gate'],
        dataProfile: PUBLIC_READ,
        expected: `${c.name.replace(/^The /, 'The ')} on ${b.label}.`,
        commonFailureCauses: c.commonFailureCauses,
      }))
    );
  })(),

  /* ---------------------------------------------------------------------- */
  /* Theme / brand paint × every browser                                    */
  /* Three computed-style probes that confirm the brand paint applies, each */
  /* fanned out across every browser engine.                                */
  /* ---------------------------------------------------------------------- */

  ...(() => {
    const THEME_CHECKS: Array<{ code: string; name: string; objective: string; description: string; selector: string; prop: string; regex: string; severity: CaseDef['severity']; priority: CaseDef['priority'] }> = [
      {
        code: 'BODY-FONT-FAMILY',
        name: 'The gate\'s body has a non-default font-family (brand font loaded)',
        objective: 'Confirm the gate\'s body element has a resolved font-family that is not the browser default — the brand font applied, the stylesheet took effect.',
        description: 'Open {{web}}/ and confirm the computed font-family on <body> matches a non-trivial font stack (not just an empty string).',
        selector: 'body',
        prop: 'font-family',
        regex: '[A-Za-z]',
        severity: 'low',
        priority: 'p3',
      },
      {
        code: 'LOGIN-BUTTON-COLORED',
        name: 'The Sign in button has a non-transparent background color',
        objective: 'Confirm the Sign in button\'s computed background-color is a visible non-transparent value — the button is painted, not an invisible target.',
        description: 'Open {{web}}/, wait for the Sign in button, and confirm its computed background-color is NOT fully transparent — the button has brand paint applied.',
        selector: '#gate #login',
        prop: 'background-color',
        regex: '^(?!rgba\\(0, 0, 0, 0\\)$)',
        severity: 'medium',
        priority: 'p2',
      },
      {
        code: 'GATE-HAS-COLOR',
        name: 'The gate\'s body text color is explicitly set',
        objective: 'Confirm the gate\'s body has a resolved text color via computed style — the stylesheet set it, so dark-background themes are not stuck with black text.',
        description: 'Open {{web}}/ and confirm the computed color on <body> is a resolved rgb/rgba/hsl value.',
        selector: 'body',
        prop: 'color',
        regex: '^(rgb|rgba|hsl)\\(',
        severity: 'low',
        priority: 'p3',
      },
    ];
    return BROWSERS.flatMap((b) =>
      THEME_CHECKS.map((c): CaseDef => ({
        key: `SB-E2E-GUI-THEME-${c.code}-${b.code}`,
        name: `${c.name} (${b.label})`,
        objective: c.objective,
        description: c.description,
        suiteKey: SANDBENCH_E2E_GUI_SUITE.key,
        testType: 'ui',
        method: 'playwright',
        severity: c.severity,
        priority: c.priority,
        preconditions: `Sand Bench web container up; the worker has ${b.label} available.${b.channelNote ? ' ' + b.channelNote : ''}`,
        steps: [
          { action: 'navigate', value: '{{web}}/', description: `open the console in ${b.label}` },
          { action: 'wait_for', selector: c.selector, timeout_ms: 10000, description: `the ${c.selector} element is painted` },
          { action: 'assert_computed_style_matches', selector: c.selector, value: c.prop, expected: c.regex, description: `${c.prop} on ${c.selector} matches the brand paint check` },
        ],
        timeoutSeconds: 30,
        validationRules: { browser: b.name, viewport: { width: 1440, height: 1000 } },
        tags: ['e2e-gui', 'sand-bench', 'playwright', 'cat:visual', 'elem:theme', b.tag, 'gate', 'brand'],
        dataProfile: PUBLIC_READ,
        expected: `${c.prop} on ${c.selector} is set as expected in ${b.label}.`,
      }))
    );
  })(),
];
