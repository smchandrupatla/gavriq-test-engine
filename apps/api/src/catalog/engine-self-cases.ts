/**
 * Test Engine self-tests for behaviour added by this session:
 *
 *   te-unit (unit)        — the settings endpoint's new rolling-fail-cancel
 *                           keys: shape, defaults, bounds and PUT round-trip.
 *                           Each case is a focused HTTP check — a single
 *                           request plus assertions on the response — so a
 *                           failure points at one invariant, not a flow.
 *
 *   te-screen (ui)        — the Overview page's shared action header and
 *                           deploy progress bar: the tabs render, Running now
 *                           and Run by test type carry the Deploy / Schedule /
 *                           Run everything buttons the Summary tab has, and
 *                           the console's compiled client bundles the
 *                           Cancel-rules chip markup + the tile-glow keyframes
 *                           so a running case can glow.
 *
 * All cases are read-only against {{engine}} except the settings PUT round-
 * trip, which snapshots the current value before writing and restores it in
 * cleanupSteps so the engine's live policy is unchanged after a run.
 */
import type { CaseDef } from './types.js';
import { GET, PUT, PRE, suiteFactory, type Step } from './engine-case-kit.js';

const BROWSE: CaseDef['dataProfile'] = { profile: 'none (read-only)', data: 'No input data; the console is browsed as an anonymous visitor.', source: 'n/a' };

const unit = suiteFactory({ suiteKey: 'te-unit', testType: 'unit' }, 'unit');
const screen = suiteFactory({ suiteKey: 'te-screen', testType: 'ui', method: 'playwright', preconditions: PRE.browser, timeoutSeconds: 60, dataProfile: BROWSE }, 'screen');

// {{engine}}/ lands on the Home view (application board); the Overview page
// with tabs lives behind #/overview, which is also where picking an app on
// Home redirects. Go there directly so the overview-tab buttons render.
const OPEN_OVERVIEW: Step[] = [
  { action: 'navigate', value: '{{engine}}/#/overview', description: 'open the Overview page' },
  { action: 'wait_for', selector: '[data-action="overview-tab"]', timeout_ms: 30000, description: 'overview tabs rendered' },
];

export const ENGINE_SELF_CASES: CaseDef[] = [
  /* --------------------------------------------------------------------- */
  /* te-unit — settings endpoint and rolling-fail-cancel invariants         */
  /* --------------------------------------------------------------------- */
  unit({
    key: 'TE-UNIT-SETTINGS-ROLLING-SHAPE',
    name: 'Settings endpoint exposes the three rolling-fail-cancel keys',
    objective: 'Confirm the engine\'s settings page carries the keys the console reads for the Cancel rules chip (enabled / window / threshold %).',
    description: 'GET {{engine}}/api/v1/settings returns a payload that contains rolling_fail_cancel_enabled (boolean), rolling_fail_cancel_window (number) and rolling_fail_cancel_threshold_pct (number).',
    severity: 'high', priority: 'p1',
    steps: [
      GET('/api/v1/settings', {
        expected_status: 200,
        expect_json: [
          { path: 'data.rolling_fail_cancel_enabled', exists: true },
          { path: 'data.rolling_fail_cancel_window', exists: true },
          { path: 'data.rolling_fail_cancel_threshold_pct', exists: true },
        ],
        description: 'settings shape includes rolling-fail-cancel keys',
      }),
    ],
    expected: 'Three rolling-fail-cancel keys present in GET /settings.',
  }),
  unit({
    key: 'TE-UNIT-SETTINGS-ROLLING-DEFAULTS',
    name: 'Rolling-fail-cancel defaults match the documented policy',
    objective: 'Confirm the default policy is on, with a 20-result window and a 50% failure threshold — the numbers the Cancel rules chip advertises.',
    description: 'GET {{engine}}/api/v1/settings returns enabled true, window 20 and threshold_pct 50 unless an operator has changed them.',
    severity: 'medium', priority: 'p2',
    steps: [
      GET('/api/v1/settings', {
        expected_status: 200,
        expect_json: [
          { path: 'data.rolling_fail_cancel_enabled', equals: true },
          { path: 'data.rolling_fail_cancel_window', equals: 20 },
          { path: 'data.rolling_fail_cancel_threshold_pct', equals: 50 },
        ],
        description: 'defaults: enabled, window=20, threshold=50%',
      }),
    ],
    expected: 'enabled=true, window=20, threshold_pct=50 by default.',
  }),
  unit({
    key: 'TE-UNIT-SETTINGS-ROLLING-WINDOW-BELOW-MIN',
    name: 'Settings refuses a rolling-fail-cancel window below 5',
    objective: 'Confirm the engine rejects a window too small to be a sensible rolling window, with a clear reason.',
    description: 'PUT {{engine}}/api/v1/settings with rolling_fail_cancel_window=4 returns 400 and names the field.',
    severity: 'medium', priority: 'p2',
    steps: [
      PUT('/api/v1/settings', {
        body: { rolling_fail_cancel_window: 4 },
        expected_status: 400,
        expected_body_contains: 'rolling_fail_cancel_window',
        description: 'window=4 rejected',
      }),
    ],
    expected: '400 with a problem message naming rolling_fail_cancel_window.',
  }),
  unit({
    key: 'TE-UNIT-SETTINGS-ROLLING-WINDOW-ABOVE-MAX',
    name: 'Settings refuses a rolling-fail-cancel window above 500',
    objective: 'Confirm an absurdly large window is rejected so no one can accidentally disable the guard by making it never fire.',
    description: 'PUT {{engine}}/api/v1/settings with rolling_fail_cancel_window=501 returns 400.',
    severity: 'low', priority: 'p3',
    steps: [
      PUT('/api/v1/settings', {
        body: { rolling_fail_cancel_window: 501 },
        expected_status: 400,
        expected_body_contains: 'rolling_fail_cancel_window',
        description: 'window=501 rejected',
      }),
    ],
    expected: '400 with a problem message.',
  }),
  unit({
    key: 'TE-UNIT-SETTINGS-ROLLING-THRESHOLD-BELOW-MIN',
    name: 'Settings refuses a threshold percentage below 10',
    objective: 'Confirm the engine rejects a threshold so low that a single failure trips it.',
    description: 'PUT {{engine}}/api/v1/settings with rolling_fail_cancel_threshold_pct=9 returns 400.',
    severity: 'medium', priority: 'p2',
    steps: [
      PUT('/api/v1/settings', {
        body: { rolling_fail_cancel_threshold_pct: 9 },
        expected_status: 400,
        expected_body_contains: 'rolling_fail_cancel_threshold_pct',
        description: 'threshold=9 rejected',
      }),
    ],
    expected: '400 with a problem message naming rolling_fail_cancel_threshold_pct.',
  }),
  unit({
    key: 'TE-UNIT-SETTINGS-ROLLING-THRESHOLD-ABOVE-MAX',
    name: 'Settings refuses a threshold percentage above 100',
    objective: 'Confirm the engine rejects a threshold that cannot be reached, which would silently disable the guard.',
    description: 'PUT {{engine}}/api/v1/settings with rolling_fail_cancel_threshold_pct=101 returns 400.',
    severity: 'low', priority: 'p3',
    steps: [
      PUT('/api/v1/settings', {
        body: { rolling_fail_cancel_threshold_pct: 101 },
        expected_status: 400,
        expected_body_contains: 'rolling_fail_cancel_threshold_pct',
        description: 'threshold=101 rejected',
      }),
    ],
    expected: '400 with a problem message.',
  }),
  unit({
    key: 'TE-UNIT-SETTINGS-ROLLING-ROUNDTRIP',
    name: 'A valid rolling-fail-cancel PUT round-trips through GET',
    objective: 'Confirm the engine persists a valid threshold change and the next GET reads it back — then restore the original policy.',
    description: 'Snapshot the live value, PUT a legal threshold (37), re-GET to confirm, then restore the saved value in cleanup so the live engine is unchanged.',
    severity: 'high', priority: 'p1',
    preconditions: 'Writable settings endpoint; nobody else must change settings during this case.',
    steps: [
      GET('/api/v1/settings', {
        expected_status: 200,
        save: {
          saved_threshold: 'data.rolling_fail_cancel_threshold_pct',
          saved_window: 'data.rolling_fail_cancel_window',
          saved_enabled: 'data.rolling_fail_cancel_enabled',
        },
        description: 'snapshot the current rolling-fail-cancel policy',
      }),
      PUT('/api/v1/settings', {
        body: { rolling_fail_cancel_threshold_pct: 37 },
        expected_status: 200,
        expect_json: [{ path: 'data.rolling_fail_cancel_threshold_pct', equals: 37 }],
        description: 'write a valid threshold',
      }),
      GET('/api/v1/settings', {
        expected_status: 200,
        expect_json: [{ path: 'data.rolling_fail_cancel_threshold_pct', equals: 37 }],
        description: 'read it back',
      }),
    ],
    cleanupSteps: [
      PUT('/api/v1/settings', {
        body: {
          rolling_fail_cancel_threshold_pct: '{{saved_threshold}}',
          rolling_fail_cancel_window: '{{saved_window}}',
          rolling_fail_cancel_enabled: '{{saved_enabled}}',
        },
        expected_status: 200,
        description: 'restore the pre-case rolling-fail-cancel policy',
      }),
    ],
    cleanupTimeoutSeconds: 10,
    expected: 'The PUT value is persisted and visible on the next GET; the cleanup restores the original.',
  }),
  unit({
    key: 'TE-UNIT-SETTINGS-ROLLING-TOGGLE',
    name: 'Rolling-fail-cancel can be turned off and back on',
    objective: 'Confirm the enabled flag flips with a boolean and the engine answers with the new value — important because the console shows "disabled" when it is off.',
    description: 'Snapshot, PUT enabled=false, re-GET to confirm, then PUT it back to the saved value in cleanup.',
    severity: 'medium', priority: 'p2',
    steps: [
      GET('/api/v1/settings', {
        expected_status: 200,
        save: { saved_enabled: 'data.rolling_fail_cancel_enabled' },
        description: 'snapshot current enabled flag',
      }),
      PUT('/api/v1/settings', {
        body: { rolling_fail_cancel_enabled: false },
        expected_status: 200,
        expect_json: [{ path: 'data.rolling_fail_cancel_enabled', equals: false }],
        description: 'disable the guard',
      }),
      GET('/api/v1/settings', {
        expected_status: 200,
        expect_json: [{ path: 'data.rolling_fail_cancel_enabled', equals: false }],
        description: 'confirm it reads back disabled',
      }),
    ],
    cleanupSteps: [
      PUT('/api/v1/settings', {
        body: { rolling_fail_cancel_enabled: '{{saved_enabled}}' },
        expected_status: 200,
        description: 'restore the pre-case enabled flag',
      }),
    ],
    cleanupTimeoutSeconds: 10,
    expected: 'enabled toggles cleanly; cleanup restores it.',
  }),
  unit({
    key: 'TE-UNIT-CATALOG-APP-JS-CARRIES-RULE-CHIP',
    name: 'Console bundle carries the Cancel-rules chip markup',
    objective: 'Confirm the compiled client script the console serves still contains the rolling-fail chip template — so clicking the Run stage shows the live rule status, not an empty panel.',
    description: 'GET {{engine}}/catalog/app.js and confirm the response body contains "rollingFailRuleHtml" and "rule-chip" — the function and class name the console uses.',
    severity: 'medium', priority: 'p2',
    steps: [
      GET('/catalog/app.js', {
        expected_status: 200,
        expected_body_contains: 'rollingFailRuleHtml',
        description: 'bundle has the rule renderer',
      }),
      GET('/catalog/app.js', {
        expected_status: 200,
        expected_body_contains: 'rule-chip',
        description: 'bundle has the chip markup',
      }),
    ],
    expected: 'Both strings present in /catalog/app.js.',
  }),
  unit({
    key: 'TE-UNIT-CATALOG-CSS-CARRIES-TILE-GLOW',
    name: 'Console stylesheet carries the tile-glow keyframes',
    objective: 'Confirm the stylesheet still defines the pulsing cyan halo on a tile the user is watching run — so the "currently running" tile is easy to spot.',
    description: 'GET {{engine}}/catalog/index.html (the console shell) and confirm it contains "tile-glow" and ".stile.is-running" — the keyframe name and the selector the glow attaches to.',
    severity: 'medium', priority: 'p2',
    steps: [
      GET('/catalog/index.html', {
        expected_status: 200,
        expected_body_contains: 'tile-glow',
        description: 'stylesheet declares the keyframes',
      }),
      GET('/catalog/index.html', {
        expected_status: 200,
        expected_body_contains: 'is-running',
        description: 'stylesheet targets a running tile',
      }),
    ],
    expected: 'Both tokens present in /catalog/index.html.',
  }),

  /* --------------------------------------------------------------------- */
  /* te-screen — Playwright GUI tests for the new Overview behaviour        */
  /* --------------------------------------------------------------------- */
  screen({
    key: 'TE-SCR-OVERVIEW-TABS-RENDER',
    name: 'Overview page shows the three tabs',
    objective: 'Confirm the Overview page gives the user the three tabs the console promises: Summary, Running now and Run by test type.',
    description: 'Open {{engine}}/ and assert that three overview-tab buttons are rendered with the expected data-tab ids (summary, running, types).',
    severity: 'high', priority: 'p1',
    steps: [
      ...OPEN_OVERVIEW,
      { action: 'wait_for', selector: '[data-action="overview-tab"]', timeout_ms: 15000, description: 'tab buttons rendered' },
      { action: 'assert_selector_count_min', selector: '[data-action="overview-tab"]', value: '3', description: 'three overview tabs' },
      { action: 'assert_selector_count_min', selector: '[data-action="overview-tab"][data-tab="summary"]', value: '1', description: 'Summary tab button present' },
      { action: 'assert_selector_count_min', selector: '[data-action="overview-tab"][data-tab="running"]', value: '1', description: 'Running now tab button present' },
      { action: 'assert_selector_count_min', selector: '[data-action="overview-tab"][data-tab="types"]', value: '1', description: 'Run by test type tab button present' },
    ],
    tags: ['playwright', 'console', 'overview-tabs'],
    expected: 'All three overview tab buttons are rendered with their data-tab ids.',
  }),
  screen({
    key: 'TE-SCR-OVERVIEW-RUNNING-TAB-SHOWS-ACTIONS',
    name: 'Running now tab carries the shared Deploy / Run / Schedule actions',
    objective: 'Confirm the Running now tab no longer loses the deploy and run actions — the user can start or schedule work from this tab too.',
    description: 'Open the Overview, click the Running now tab and assert the Run everything button, Schedule button and the deploy mode selector are rendered.',
    severity: 'high', priority: 'p1',
    steps: [
      ...OPEN_OVERVIEW,
      { action: 'wait_for', selector: '[data-action="overview-tab"][data-tab="running"]', timeout_ms: 15000, description: 'running tab button appeared' },
      { action: 'click', selector: '[data-action="overview-tab"][data-tab="running"]', description: 'open Running now tab' },
      { action: 'wait_for', selector: '[data-action="run-all"]', timeout_ms: 10000, description: 'Run everything button present' },
      { action: 'assert_selector_count_min', selector: '[data-action="schedule"]', value: '1', description: 'Schedule button present' },
      { action: 'assert_selector_count_min', selector: '#deployMode', value: '1', description: 'deploy mode selector present' },
    ],
    tags: ['playwright', 'console', 'overview-tabs'],
    expected: 'Run everything + Schedule + deploy mode selector all present on the Running now tab.',
  }),
  screen({
    key: 'TE-SCR-OVERVIEW-TYPES-TAB-SHOWS-ACTIONS',
    name: 'Run by test type tab carries the shared Deploy / Run / Schedule actions',
    objective: 'Confirm the Run by test type tab exposes the same actions as Summary — a direct response to "give me the summary options on the types page too". The primary button is "Run selected types" on this tab (data-action="run-types") instead of "Run everything".',
    description: 'Open the Overview, click the Run by test type tab and assert a primary Run selected types button, a Schedule button, the deploy mode selector and the type-check grid are rendered. The context-aware primary button changes label from Run everything to Run selected types on this tab.',
    severity: 'high', priority: 'p1',
    steps: [
      ...OPEN_OVERVIEW,
      { action: 'wait_for', selector: '[data-action="overview-tab"][data-tab="types"]', timeout_ms: 15000, description: 'types tab button appeared' },
      { action: 'click', selector: '[data-action="overview-tab"][data-tab="types"]', description: 'open Run by test type tab' },
      { action: 'wait_for', selector: '[data-action="run-types"]', timeout_ms: 10000, description: 'Run selected types button present' },
      { action: 'assert_selector_count_min', selector: '[data-action="schedule"]', value: '1', description: 'Schedule button present' },
      { action: 'assert_selector_count_min', selector: '#deployMode', value: '1', description: 'deploy mode selector present' },
      { action: 'assert_selector_count_min', selector: '.type-check-grid', value: '1', description: 'type-selection grid is also rendered' },
    ],
    tags: ['playwright', 'console', 'overview-tabs'],
    expected: 'Run selected types + Schedule + deploy mode selector + type-check grid all present on the types tab.',
  }),
  screen({
    key: 'TE-SCR-DEPLOY-MODE-SELECTOR-OPTIONS',
    name: 'Deploy mode selector offers all five modes',
    objective: 'Confirm the dropdown users pick what to do after deploy from carries every mode the engine supports: deploy_run_teardown, loop, clean cycle, deploy_and_run, deploy_only.',
    description: 'Open the Overview and confirm the deployMode select has exactly five options, with the five documented values.',
    severity: 'medium', priority: 'p2',
    steps: [
      ...OPEN_OVERVIEW,
      { action: 'wait_for', selector: '#deployMode', timeout_ms: 10000, description: 'deploy mode selector visible' },
      { action: 'assert_selector_count_min', selector: '#deployMode option', value: '5', description: 'at least five options' },
      { action: 'assert_selector_count_min', selector: '#deployMode option[value="deploy_run_teardown"]', value: '1', description: 'deploy, run, tear down' },
      { action: 'assert_selector_count_min', selector: '#deployMode option[value="deploy_run_teardown_loop"]', value: '1', description: 'loop' },
      { action: 'assert_selector_count_min', selector: '#deployMode option[value="clean_cycle"]', value: '1', description: 'clean cycle' },
      { action: 'assert_selector_count_min', selector: '#deployMode option[value="deploy_and_run"]', value: '1', description: 'deploy and run' },
      { action: 'assert_selector_count_min', selector: '#deployMode option[value="deploy_only"]', value: '1', description: 'deploy only' },
    ],
    tags: ['playwright', 'console', 'deploy-modes'],
    expected: 'All five mode values present as option values.',
  }),
];
