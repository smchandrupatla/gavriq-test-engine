/**
 * Test Engine self-tests — the unified console in a real browser: screen
 * (Playwright), Selenium baseline and the browser/viewport matrix.
 *
 * Selectors, titles and texts were read from the rendered console of the
 * staging engine (commit 8a26bbf) and of the development engine on
 * 2026-09-30; only what both builds render is asserted. The console keeps the
 * selected application in localStorage and every case starts from a fresh
 * browser profile, so it opens on Sand Bench and switches application through
 * the selector like a person would.
 */
import type { CaseDef } from './types.js';
import { GET, NO_DATA, PRE, suiteFactory, type Step } from './engine-case-kit.js';

const BROWSE: CaseDef['dataProfile'] = { profile: 'none (read-only)', data: 'No input data; the console is browsed as an anonymous visitor.', source: 'n/a' };

const OPEN: Step[] = [
  { action: 'navigate', value: '{{engine}}/', description: 'open the console' },
  { action: 'wait_for', selector: '#content .kpi', timeout_ms: 30000, description: 'overview rendered from the summary' },
];
const ENGINE_NAV = '#sideNav .nav-item[data-view="type"][data-id="api"]';
/** Playwright waits for the option itself; Selenium needs it located first (see SELENIUM_SWITCH). */
const SWITCH_TO_ENGINE: Step[] = [
  { action: 'select', selector: '#appSelect', value: 'gavriq-test-engine', description: 'switch application to the Test Engine' },
  { action: 'wait_for', selector: ENGINE_NAV, timeout_ms: 20000, description: 'navigation rebuilt for the engine application' },
];
const OPEN_API_TYPE: Step[] = [
  ...OPEN, ...SWITCH_TO_ENGINE,
  { action: 'click', selector: ENGINE_NAV, description: 'open "API tests"' },
  { action: 'wait_for', selector: '#content tbody tr .case-name', timeout_ms: 20000, description: 'case table rendered' },
];
const go = (hash: string, settle: Step): Step[] => [
  { action: 'navigate', value: `{{engine}}/${hash}`, description: `open ${hash}` },
  settle,
];

const screen = suiteFactory({ suiteKey: 'te-screen', testType: 'ui', method: 'playwright', preconditions: PRE.browser, timeoutSeconds: 60, dataProfile: BROWSE }, 'screen');
const selenium = suiteFactory({ suiteKey: 'te-selenium-baseline', testType: 'selenium-baseline', method: 'selenium', preconditions: 'Target engine reachable; worker has Chrome/Chromium with a matching chromedriver.', timeoutSeconds: 60, dataProfile: BROWSE }, 'selenium-baseline');

const C: CaseDef[] = [];

/* ------------------------------------------------------------------------ */
/* screen — Playwright                                                       */
/* ------------------------------------------------------------------------ */

C.push(
  screen({
    key: 'TE-SCR-SHELL', name: 'Console shell renders with its navigation',
    description: 'Open {{engine}}/ in a real browser: the page title, the brand, the Overview heading and the workspace navigation must render — not just an HTTP 200 of the HTML.',
    severity: 'critical', priority: 'p0',
    steps: [
      ...OPEN,
      { action: 'assert_title', expected: 'GAVRIQ Test Engine', description: 'browser title' },
      { action: 'assert_selector_text', selector: '.brand-title', expected: 'GAVRIQ Test Engine', description: 'brand' },
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Overview', description: 'landing view' },
      { action: 'assert_selector_count_min', selector: '#sideNav .nav-item', value: '6', description: 'navigation entries' },
      { action: 'assert_text', expected: 'In-container build', description: 'workspace entry' },
    ],
    tags: ['playwright', 'console'], expected: 'Title, brand, Overview and at least six navigation entries.',
  }),
  screen({
    key: 'TE-SCR-STATUS-PILLS', name: 'Top bar reports engine health and workers',
    description: 'The top bar\'s health pill must turn green with the engine version once /health answers, the worker pill must show the live/registered count and the live pill must show the last poll.',
    steps: [
      ...OPEN,
      { action: 'wait_for', selector: '#healthPill.ok', timeout_ms: 15000, description: 'health pill green' },
      { action: 'assert_selector_text', selector: '#healthPill', expected: 'engine ok · v', description: 'health pill text' },
      { action: 'assert_selector_text', selector: '#workerPill', expected: 'live /', description: 'worker pill counts' },
      { action: 'assert_selector_text', selector: '#livePill', expected: 'updated', description: 'live poll pill' },
    ],
    tags: ['playwright', 'console'], expected: '"engine ok · v<version>", "workers N live / M", "updated …".',
  }),
  screen({
    key: 'TE-SCR-APPLICATION-SWITCH', name: 'Switching application rebuilds the console for it',
    description: 'Choose the Test Engine in the application selector: the navigation is rebuilt from that application\'s own test types (API tests appears, Sand Bench\'s Unit tests disappears) and the environment selector is refilled. Switching back restores Sand Bench\'s.',
    severity: 'critical', priority: 'p0',
    steps: [
      ...OPEN,
      { action: 'wait_for', selector: '#sideNav .nav-item[data-view="type"][data-id="unit"]', description: 'Sand Bench types shown first' },
      ...SWITCH_TO_ENGINE,
      { action: 'wait_for_hidden', selector: '#sideNav .nav-item[data-view="type"][data-id="unit"]', description: 'Sand Bench-only type is gone' },
      { action: 'assert_selector_count_min', selector: '#envSelect option', value: '1', description: 'environments offered for the engine' },
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Overview', description: 'back on the overview' },
      { action: 'select', selector: '#appSelect', value: 'sand-bench', description: 'switch back to Sand Bench' },
      { action: 'wait_for', selector: '#sideNav .nav-item[data-view="type"][data-id="unit"]', timeout_ms: 20000, description: 'Sand Bench types are back' },
    ],
    tags: ['playwright', 'console', 'multi-application'], expected: 'Navigation and environments follow the selected application, both ways.',
  }),
  screen({
    key: 'TE-SCR-OVERVIEW-TILES', name: 'Overview shows KPIs and one status tile per test type',
    description: 'For the engine application the overview must render its six KPI cards and a status tile for the API test type with its case count.',
    steps: [
      ...OPEN, ...SWITCH_TO_ENGINE,
      { action: 'wait_for', selector: '.stile[data-tile="type:api"]', timeout_ms: 20000, description: 'API tile rendered' },
      { action: 'assert_selector_count_min', selector: '#content .kpi', value: '6', description: 'KPI cards' },
      { action: 'assert_selector_text', selector: '.stile[data-tile="type:api"] .stile-title', expected: 'API tests', description: 'tile title' },
      { action: 'assert_selector_text', selector: '.stile[data-tile="type:api"] .stile-counts', expected: 'cases', description: 'tile counts' },
      { action: 'assert_text', expected: 'In-container build', description: 'build tile' },
    ],
    tags: ['playwright', 'console'], expected: 'Six KPIs, an "API tests" tile with counts and the build tile.',
  }),
  screen({
    key: 'TE-SCR-TILE-HISTORY', name: 'A status tile opens its run history in place',
    description: 'Clicking a tile expands its history panel under the tiles, with a run button and a link to the type\'s details, without leaving the overview.',
    steps: [
      ...OPEN, ...SWITCH_TO_ENGINE,
      { action: 'wait_for', selector: '.stile[data-tile="type:api"]', timeout_ms: 20000, description: 'API tile rendered' },
      { action: 'click', selector: '.stile[data-tile="type:api"]', description: 'open the tile' },
      { action: 'wait_for', selector: '.hp', timeout_ms: 15000, description: 'history panel' },
      { action: 'assert_selector_text', selector: '.hp .card-head', expected: 'API tests · history', description: 'panel heading' },
      { action: 'assert_selector_text', selector: '.hp .card-head', expected: 'Open details', description: 'details link' },
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Overview', description: 'still on the overview' },
    ],
    tags: ['playwright', 'console'], expected: 'Panel "API tests · history" with run and details actions.',
  }),
  screen({
    key: 'TE-SCR-TYPE-VIEW', name: 'A test type lists its cases with status and method',
    description: 'Open "API tests" from the navigation: the view title changes, the case table renders its columns and lists the engine\'s API cases, including "Capability map is published".',
    severity: 'critical', priority: 'p0',
    steps: [
      ...OPEN_API_TYPE,
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'API tests', description: 'view title' },
      { action: 'assert_selector_count_min', selector: '#content tbody tr', value: '10', description: 'case rows' },
      { action: 'assert_text', expected: 'Capability map is published', description: 'a known case is listed' },
      { action: 'assert_text', expected: 'TE-API-META', description: 'with its key' },
      { action: 'assert_text', expected: 'Last run', description: 'table columns' },
      { action: 'assert_selector_count_min', selector: '[data-action="run-selected"]', value: '1', description: 'run action' },
    ],
    tags: ['playwright', 'console'], expected: 'Title "API tests"; at least ten rows; known case present.',
  }),
  screen({
    key: 'TE-SCR-SEARCH', name: 'The search box filters the case table as you type',
    description: 'Type part of a case name into the top-bar search: the table narrows to the matching case, which becomes its first row.',
    steps: [
      ...OPEN_API_TYPE,
      { action: 'type', selector: '#globalSearch', value: 'Capability map', description: 'search' },
      { action: 'wait', value: '800', description: 'debounced re-render' },
      { action: 'assert_selector_text', selector: '#content tbody tr', expected: 'Capability map is published', description: 'first row is the match' },
      { action: 'type', selector: '#globalSearch', value: 'zz-no-such-case-zz', description: 'search for nothing' },
      { action: 'wait', value: '800', description: 'debounced re-render' },
      { action: 'assert_selector_text', selector: '#content tbody tr', expected: 'No cases.', description: 'empty state' },
    ],
    tags: ['playwright', 'console'],
    dataProfile: { profile: 'lookup', data: 'Search terms "Capability map" and "zz-no-such-case-zz".', source: 'Hand-crafted.' },
    expected: 'One matching row, then the "No cases." empty state.',
  }),
  screen({
    key: 'TE-SCR-CASE-DETAIL', name: 'A case opens its definition and its runs',
    description: 'Click a case in the table: the case screen shows its key, type, method, tags and description, offers "Run this case", and its Runs tab opens.',
    severity: 'critical', priority: 'p0',
    steps: [
      ...OPEN_API_TYPE,
      { action: 'type', selector: '#globalSearch', value: 'Capability map', description: 'find the case' },
      { action: 'wait', value: '800', description: 'debounced re-render' },
      { action: 'click', selector: '#content tbody tr .case-name', description: 'open the case' },
      { action: 'wait_for', selector: '#content dl.kv', timeout_ms: 20000, description: 'case details rendered' },
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Capability map is published', description: 'view title is the case name' },
      { action: 'assert_selector_text', selector: '#content dl.kv', expected: 'TE-API-META', description: 'key' },
      { action: 'assert_selector_text', selector: '#content dl.kv', expected: 'http', description: 'method' },
      { action: 'assert_selector_text', selector: '#content dl.kv', expected: '/api/v1/meta', description: 'description' },
      { action: 'assert_text', expected: 'Run this case', description: 'run action' },
      { action: 'click_text', expected: 'Runs (', description: 'open the Runs tab' },
      { action: 'wait_for', selector: '#content .tab-btn.active', description: 'tab switched' },
      { action: 'assert_selector_text', selector: '#content .tab-btn.active', expected: 'Runs (', description: 'Runs tab active' },
    ],
    tags: ['playwright', 'console'],
    dataProfile: { profile: 'lookup', data: 'Case TE-API-META, found through the search box.', source: 'Seeded catalogue of the target.' },
    expected: 'Case screen with key, method, description, run action and a working Runs tab.',
  }),
  screen({
    key: 'TE-SCR-TEST-RUNS', name: 'Test runs view shows what is running and the history',
    description: 'Open #/history: the view must render its "Running now" section and the run history table with its columns.',
    steps: [
      ...OPEN,
      ...go('#/history', { action: 'wait_for', selector: '#content table', timeout_ms: 20000, description: 'history table rendered' }),
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Test runs', description: 'view title' },
      { action: 'assert_text', expected: 'Running now', description: 'live section' },
      { action: 'assert_text', expected: 'Progress', description: 'history columns' },
      { action: 'assert_text', expected: 'Trigger', description: 'history columns' },
    ],
    tags: ['playwright', 'console'], expected: '"Test runs" with the live section and the history table.',
  }),
  screen({
    key: 'TE-SCR-BUILDS', name: 'In-container build view renders',
    description: 'Open #/builds: the view shows the latest build reported by CI, or says none was reported — it must not be blank.',
    severity: 'medium',
    steps: [
      ...OPEN,
      ...go('#/builds', { action: 'wait_for', selector: '#content .card', timeout_ms: 20000, description: 'build cards rendered' }),
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'In-container build', description: 'view title' },
      { action: 'assert_text', expected: 'Latest build results', description: 'results card' },
    ],
    tags: ['playwright', 'console'], expected: '"In-container build" with its results card.',
  }),
  screen({
    key: 'TE-SCR-CONFIGURATION', name: 'Configuration shows the run retention setting',
    description: 'Open #/config: the run retention field is filled from /api/v1/settings with a number of days and a Save action.',
    steps: [
      ...OPEN,
      ...go('#/config', { action: 'wait_for', selector: '#retentionDays', timeout_ms: 20000, description: 'retention field rendered' }),
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Configuration', description: 'view title' },
      { action: 'assert_text', expected: 'Run retention', description: 'setting heading' },
      { action: 'assert_text', expected: 'Test cases themselves are never deleted', description: 'what retention does not touch' },
      { action: 'assert_selector_count_min', selector: '[data-action="save-retention"]', value: '1', description: 'save action' },
    ],
    tags: ['playwright', 'console'], expected: 'Retention field, explanation and Save.',
  }),
  screen({
    key: 'TE-SCR-MISSING-RECORDS', name: 'Links to a missing run or case fail soft',
    description: 'A stale bookmark must not leave a blank screen: #/run/<unknown> says the run was not found and links back to the runs, #/case/<unknown> says the case could not be loaded, and an unknown view lands on the overview.',
    steps: [
      ...OPEN,
      ...go('#/run/exec-no-such-run', { action: 'wait_for', selector: '#content .card.empty', timeout_ms: 20000, description: 'message rendered' }),
      { action: 'assert_text', expected: 'Run not found', description: 'missing run' },
      { action: 'assert_text', expected: 'Back to test runs', description: 'way back' },
      ...go('#/case/00000000-0000-4000-8000-000000000000', { action: 'wait', value: '1500', description: 'case lookup' }),
      { action: 'assert_text', expected: 'Could not load case', description: 'missing case' },
      ...go('#/no-such-view', { action: 'wait', value: '800', description: 'route' }),
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Overview', description: 'unknown view falls back' },
    ],
    tags: ['playwright', 'console'],
    dataProfile: { profile: 'negative', data: 'Two ids that do not exist and one unknown route.', source: 'Hand-crafted.' },
    expected: 'A message and a way back in each case.',
  }),
  screen({
    key: 'TE-SCR-DEEP-LINK', name: 'A deep link opens the view it names',
    description: 'Open {{engine}}/#/type/smoke directly: the console must boot straight into the Sand Bench smoke cases and list them.',
    steps: [
      { action: 'navigate', value: '{{engine}}/#/type/smoke', description: 'open the link' },
      { action: 'wait_for', selector: '#content tbody tr .case-name', timeout_ms: 30000, description: 'case table rendered' },
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Smoke tests', description: 'view title' },
      { action: 'assert_selector_count_min', selector: '#content tbody tr', value: '5', description: 'case rows' },
      { action: 'assert_text', expected: 'API health endpoint answers with its role', description: 'a known Sand Bench smoke case' },
    ],
    tags: ['playwright', 'console'], expected: '"Smoke tests" with its rows, without going through the overview.',
  }),
  screen({
    key: 'TE-SCR-MOBILE-MENU', name: 'On a phone the navigation opens from the menu button',
    description: 'At 390×844 the sidebar is off-canvas. The menu button must slide it in, and choosing an entry must navigate and close it again.',
    steps: [
      ...OPEN,
      { action: 'click', selector: '#menuToggle', description: 'open the menu' },
      { action: 'wait_for', selector: '#sidebar.open', description: 'sidebar slid in' },
      { action: 'click', selector: '#sideNav .nav-item[data-view="history"]', description: 'choose "Test runs"' },
      { action: 'wait_for_hidden', selector: '#sidebar.open', description: 'sidebar closed again' },
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Test runs', description: 'navigated' },
    ],
    validationRules: { browser: 'chromium', viewport: { width: 390, height: 844 } },
    tags: ['playwright', 'console', 'mobile'],
    dataProfile: { profile: 'viewport-matrix', data: 'Viewport 390×844; engine chromium; no input data.', source: 'Runner-configured browser context.' },
    expected: 'Menu opens, navigates and closes.',
  }),
  screen({
    key: 'TE-SCR-SIT-CONSOLE', name: 'Embedded SIT console page renders',
    description: 'Open {{engine}}/sit/: the SIT console, proxied behind the engine\'s port, must render its own page with the test catalog.',
    severity: 'medium',
    steps: [
      { action: 'navigate', value: '{{engine}}/sit/', description: 'open the SIT console' },
      { action: 'wait_for', selector: 'h1', timeout_ms: 20000, description: 'page rendered' },
      { action: 'assert_title', expected: 'Sand Bench Test Engine', description: 'browser title' },
      { action: 'assert_text', expected: 'Test Catalog', description: 'catalog section' },
    ],
    tags: ['playwright', 'sit-console'], expected: 'Title "Sand Bench Test Engine" and the catalog section.',
  })
);

/* ------------------------------------------------------------------------ */
/* selenium-baseline                                                         */
/* ------------------------------------------------------------------------ */

const SELENIUM_OPEN: Step[] = [
  { action: 'navigate', value: '{{engine}}/', description: 'open the console' },
  { action: 'wait_for', selector: '#content .kpi', timeout_ms: 30000, description: 'overview rendered' },
];

function seleniumView(key: string, hash: string, title: string, mustText: string, name: string): CaseDef {
  return selenium({
    key, name,
    description: `Selenium WebDriver (real Chrome) opens {{engine}}/${hash} and asserts the view title "${title}" and the fragment "${mustText}". Baseline coverage proving the Selenium runner and the console work together.`,
    severity: 'medium',
    steps: [
      ...SELENIUM_OPEN,
      { action: 'navigate', value: `{{engine}}/${hash}`, description: `open ${hash}` },
      { action: 'wait', value: '1500', description: 'route and data' },
      { action: 'assert_selector_text', selector: '#viewTitle', expected: title, description: 'view title' },
      { action: 'assert_text', expected: mustText, description: 'verified fragment' },
    ],
    tags: ['selenium', 'console'],
    expected: `View title "${title}"; body contains "${mustText}".`,
  });
}

C.push(
  selenium({
    key: 'TE-SEL-CONSOLE-LOADS', name: 'Baseline: console shell loads in Selenium',
    description: 'Selenium opens {{engine}}/ and waits for the overview to render from the summary; title and brand must be present.',
    severity: 'critical', priority: 'p0',
    steps: [
      ...SELENIUM_OPEN,
      { action: 'assert_title', expected: 'GAVRIQ Test Engine', description: 'browser title' },
      { action: 'assert_text', expected: 'Unified console', description: 'brand subtitle' },
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Overview', description: 'landing view' },
    ],
    tags: ['selenium', 'console'], expected: 'Overview rendered with title and brand.',
  }),
  selenium({
    key: 'TE-SEL-WORKSPACE-NAV', name: 'Baseline: workspace navigation is present',
    description: 'The sidebar must list the workspace entries — Overview, Test runs, In-container build, Configuration — and the two test-type sections.',
    steps: [
      ...SELENIUM_OPEN,
      { action: 'assert_selector_count_min', selector: '#sideNav .nav-item', value: '6', description: 'navigation entries' },
      { action: 'assert_text', expected: 'Test runs', description: 'Test runs' },
      { action: 'assert_text', expected: 'In-container build', description: 'In-container build' },
      { action: 'assert_text', expected: 'Configuration', description: 'Configuration' },
      { action: 'assert_text', expected: 'Quality Assurance', description: 'QA section' },
      { action: 'assert_text', expected: 'Quality Control', description: 'QC section' },
    ],
    tags: ['selenium', 'console'], expected: 'All four workspace entries and both sections.',
  }),
  selenium({
    key: 'TE-SEL-APPLICATION-SWITCH', name: 'Baseline: application selector switches to the Test Engine',
    description: 'Selenium picks the Test Engine in the application selector and waits for the navigation to be rebuilt with its API test type. The Selenium twin of TE-SCR-APPLICATION-SWITCH.',
    severity: 'critical', priority: 'p0',
    steps: [
      ...SELENIUM_OPEN,
      { action: 'wait_for', selector: '#appSelect option[value="gavriq-test-engine"]', timeout_ms: 15000, description: 'application list loaded' },
      { action: 'assert_selector_count_min', selector: '#appSelect option', value: '2', description: 'at least two applications' },
      { action: 'select', selector: '#appSelect', value: 'gavriq-test-engine', description: 'switch application' },
      { action: 'wait_for', selector: ENGINE_NAV, timeout_ms: 20000, description: 'navigation rebuilt' },
      { action: 'assert_text', expected: 'API tests', description: 'engine test type listed' },
    ],
    tags: ['selenium', 'console', 'multi-application'], expected: 'Two or more applications; navigation follows the selection.',
  }),
  selenium({
    key: 'TE-SEL-TYPE-VIEW', name: 'Baseline: smoke cases are listed',
    description: 'Selenium opens the Sand Bench smoke type and reads the case table from the DOM.',
    steps: [
      ...SELENIUM_OPEN,
      { action: 'click', selector: '#sideNav .nav-item[data-view="type"][data-id="smoke"]', description: 'open "Smoke tests"' },
      { action: 'wait_for', selector: '#content tbody tr .case-name', timeout_ms: 20000, description: 'case table rendered' },
      { action: 'assert_selector_text', selector: '#viewTitle', expected: 'Smoke tests', description: 'view title' },
      { action: 'assert_selector_count_min', selector: '#content tbody tr', value: '5', description: 'case rows' },
    ],
    tags: ['selenium', 'console'], expected: '"Smoke tests" with at least five rows.',
  }),
  seleniumView('TE-SEL-TEST-RUNS', '#/history', 'Test runs', 'Running now', 'Baseline: test runs view renders'),
  seleniumView('TE-SEL-BUILDS', '#/builds', 'In-container build', 'Latest build results', 'Baseline: in-container build view renders'),
  seleniumView('TE-SEL-CONFIGURATION', '#/config', 'Configuration', 'Run retention', 'Baseline: configuration view renders'),
  selenium({
    key: 'TE-SEL-CATALOG-ALIAS', name: 'Baseline: console loads from /catalog/',
    description: 'Selenium opens {{engine}}/catalog/ — the older address of the console — and gets the same shell.',
    severity: 'medium',
    steps: [
      { action: 'navigate', value: '{{engine}}/catalog/', description: 'open /catalog/' },
      { action: 'wait_for', selector: '#content .kpi', timeout_ms: 30000, description: 'overview rendered' },
      { action: 'assert_title', expected: 'GAVRIQ Test Engine', description: 'browser title' },
    ],
    tags: ['selenium', 'console'], expected: 'Same console under /catalog/.',
  }),
  selenium({
    key: 'TE-SEL-SIT-CONSOLE', name: 'Baseline: SIT console page renders',
    description: 'Selenium opens {{engine}}/sit/ and reads the SIT console\'s own heading.',
    severity: 'medium',
    steps: [
      { action: 'navigate', value: '{{engine}}/sit/', description: 'open the SIT console' },
      { action: 'wait_for', selector: 'h1', timeout_ms: 20000, description: 'page rendered' },
      { action: 'assert_title', expected: 'Sand Bench Test Engine', description: 'browser title' },
      { action: 'assert_text', expected: 'Test Catalog', description: 'catalog section' },
    ],
    tags: ['selenium', 'sit-console'], expected: 'Title and the catalog section.',
  }),
  selenium({
    key: 'TE-SEL-API-HEALTH', name: 'API: health endpoint (baseline)',
    description: 'GET {{engine}}/health returns 200 — the HTTP baseline case kept alongside the Selenium ones so the suite proves both runner families against the engine.',
    method: 'http', severity: 'critical', priority: 'p0', preconditions: PRE.readOnly, dataProfile: NO_DATA,
    steps: [GET('/health', { expect_json: [{ path: 'status', equals: 'ok' }], description: 'health' })],
    tags: ['http'], expected: '200 {"status":"ok"}.',
  }),
  selenium({
    key: 'TE-SEL-API-SUMMARY', name: 'API: console boot payload (baseline)',
    description: 'GET {{engine}}/api/v1/ui/summary returns the payload every Selenium case above renders from — a second HTTP baseline from this suite\'s own vantage point.',
    method: 'http', preconditions: PRE.readOnly, dataProfile: NO_DATA,
    steps: [GET('/api/v1/ui/summary?application_key=sand-bench', { expect_json: [{ path: 'data.cases', min_length: 1 }, { path: 'data.application.types', min_length: 1 }], description: 'ui summary' })],
    tags: ['http'], expected: '200 with cases and types.',
  })
);

/* ------------------------------------------------------------------------ */
/* compatibility — browser & viewport matrix                                 */
/* ------------------------------------------------------------------------ */

const VIEWPORTS: Record<string, { width: number; height: number; label: string }> = {
  desktop: { width: 1920, height: 1080, label: 'desktop 1920×1080' },
  laptop: { width: 1366, height: 768, label: 'laptop 1366×768' },
  tablet: { width: 768, height: 1024, label: 'tablet portrait 768×1024' },
  mobile: { width: 390, height: 844, label: 'mobile 390×844 (iPhone 14-class)' },
};
const VIEWS: Record<string, { hash: string; label: string; settle: string; title: string }> = {
  overview: { hash: '', label: 'overview', settle: '#content .kpi', title: 'Overview' },
  cases: { hash: '#/type/smoke', label: 'case table', settle: '#content tbody tr .case-name', title: 'Smoke tests' },
  runs: { hash: '#/history', label: 'test runs', settle: '#content table', title: 'Test runs' },
};

/**
 * Cells found failing on a live run (2026-09-30, run-muo3azcm-dc0445) against
 * engine-staging, a `git archive` of commit 8a26bbf: the console at that
 * commit overflows at this width on this view. Confirmed the same day that
 * the fix already exists — uncommitted, in the working tree the development
 * engine was rebuilt from — so this stays red only on a staging deployment
 * still pinned at or before 8a26bbf; expect it to self-resolve the next time
 * staging is redeployed from a commit at or after the fix.
 */
const COMPAT_KNOWN_DEFECTS: Record<string, string> = {
  'TE-CB-CHROMIUM-MOBILE-CASES': 'the case table (#/type/smoke) overflows 48px horizontally at 390px width',
};

function browserCase(browser: 'chromium' | 'firefox' | 'webkit', vp: keyof typeof VIEWPORTS, view: keyof typeof VIEWS = 'overview'): CaseDef {
  const v = VIEWPORTS[vp]!;
  const w = VIEWS[view]!;
  const key = `TE-CB-${browser.toUpperCase()}-${String(vp).toUpperCase()}${view === 'overview' ? '' : `-${String(view).toUpperCase()}`}`;
  const knownDefect = COMPAT_KNOWN_DEFECTS[key];
  return {
    key,
    name: `${browser} @ ${v.label}: console ${w.label} renders without overflow`,
    description: `Launch real ${browser}, set a ${v.width}×${v.height} viewport, open {{engine}}/${w.hash}, wait for the ${w.label} to render from live data and assert the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.${knownDefect ? ` Probed live 2026-09-30 against a staging deployment pinned at commit 8a26bbf: ${knownDefect}. Confirmed already fixed in the working tree the same day, so this stays red only against a staging deployment still pinned at or before 8a26bbf — expect it to self-resolve on the next redeploy.` : ''}`,
    suiteKey: 'te-compat-browsers', testType: 'ui', method: 'playwright', severity: vp === 'mobile' ? 'high' : 'medium', priority: 'p1',
    preconditions: `Target engine reachable; worker has the Playwright ${browser} engine installed.`,
    steps: [
      { action: 'navigate', value: `{{engine}}/${w.hash}`, description: `open the ${w.label}` },
      { action: 'wait_for', selector: w.settle, timeout_ms: 45000, description: `${w.label} rendered` },
      { action: 'assert_selector_text', selector: '#viewTitle', expected: w.title, description: 'view title' },
      { action: 'assert_text', expected: 'GAVRIQ Test Engine', description: 'brand renders' },
      { action: 'assert_no_horizontal_overflow', description: `no sideways scroll at ${v.width}px` },
    ],
    validationRules: { browser, viewport: { width: v.width, height: v.height } },
    // Firefox and WebKit take 30-45s to launch and paint in the worker container.
    timeoutSeconds: browser === 'chromium' ? 60 : 120,
    tags: ['compatibility', 'test-engine', browser, String(vp), 'responsive', ...(knownDefect ? ['known-defect'] : [])],
    dataProfile: { profile: 'viewport-matrix', data: `Viewport ${v.width}×${v.height}; engine ${browser}; no input data.`, source: 'Runner-configured browser context.' },
    expected: `View "${w.title}" visible; scrollWidth <= viewport width.`,
  };
}

C.push(
  browserCase('chromium', 'desktop'),
  browserCase('chromium', 'laptop'),
  browserCase('chromium', 'tablet'),
  browserCase('chromium', 'mobile'),
  browserCase('firefox', 'desktop'),
  browserCase('firefox', 'mobile'),
  browserCase('webkit', 'desktop'),
  browserCase('webkit', 'mobile'),
  browserCase('chromium', 'mobile', 'cases'),
  browserCase('chromium', 'tablet', 'runs'),
  browserCase('firefox', 'tablet', 'cases'),
  browserCase('webkit', 'laptop', 'runs'),
  {
    key: 'TE-CB-FIREFOX-APPLICATION-SWITCH',
    name: 'firefox @ laptop: application selector works',
    description: 'The application selector is a native <select>; its change event drives the whole console. It must work in Firefox as it does in Chromium: choosing the Test Engine rebuilds the navigation.',
    suiteKey: 'te-compat-browsers', testType: 'ui', method: 'playwright', severity: 'high', priority: 'p1',
    preconditions: 'Target engine reachable; worker has the Playwright firefox engine installed.',
    steps: [...OPEN, ...SWITCH_TO_ENGINE, { action: 'assert_text', expected: 'API tests', description: 'engine test type listed' }, { action: 'assert_no_horizontal_overflow', description: 'no sideways scroll at 1366px' }],
    validationRules: { browser: 'firefox', viewport: { width: 1366, height: 768 } },
    timeoutSeconds: 120,
    tags: ['compatibility', 'test-engine', 'firefox', 'laptop', 'multi-application'],
    dataProfile: { profile: 'viewport-matrix', data: 'Viewport 1366×768; engine firefox; no input data.', source: 'Runner-configured browser context.' },
    expected: 'Navigation follows the selection in Firefox.',
  },
  {
    key: 'TE-CB-WEBKIT-CASE-DETAIL',
    name: 'webkit @ tablet: a case opens its detail screen',
    description: 'The click-through from a case table to a case screen — event delegation and a lazy detail fetch — must work in WebKit at tablet width.',
    suiteKey: 'te-compat-browsers', testType: 'ui', method: 'playwright', severity: 'high', priority: 'p1',
    preconditions: 'Target engine reachable; worker has the Playwright webkit engine installed.',
    steps: [
      { action: 'navigate', value: '{{engine}}/#/type/smoke', description: 'open the smoke cases' },
      { action: 'wait_for', selector: '#content tbody tr .case-name', timeout_ms: 45000, description: 'case table rendered' },
      { action: 'click', selector: '#content tbody tr .case-name', description: 'open the first case' },
      { action: 'wait_for', selector: '#content dl.kv', timeout_ms: 30000, description: 'case details rendered' },
      { action: 'assert_text', expected: 'Run this case', description: 'run action' },
      { action: 'assert_no_horizontal_overflow', description: 'no sideways scroll at 768px' },
    ],
    validationRules: { browser: 'webkit', viewport: { width: 768, height: 1024 } },
    timeoutSeconds: 120,
    tags: ['compatibility', 'test-engine', 'webkit', 'tablet'],
    dataProfile: { profile: 'viewport-matrix', data: 'Viewport 768×1024; engine webkit; no input data.', source: 'Runner-configured browser context.' },
    expected: 'Case screen renders in WebKit without overflow.',
  }
);

export const ENGINE_UI_CASES: CaseDef[] = C;
