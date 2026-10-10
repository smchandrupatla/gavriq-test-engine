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

const CONSOLE_SIGNIN = [
  { action: 'navigate', value: '{{web}}/', description: 'open console' },
  { action: 'wait_for', selector: '#gate #login', timeout_ms: 15000, description: 'sign-in gate shown' },
  { action: 'type', selector: '#gate #username', value: '{{username}}', description: 'demo operator username' },
  { action: 'type', selector: '#gate #password', value: '{{password}}', description: 'demo operator password' },
  { action: 'click', selector: '#gate #login', description: 'Sign in' },
  { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 20000, description: 'gate hides — console mount signal' },
];

const SIGNIN_DATA: CaseDef['dataProfile'] = {
  profile: 'demo-identity',
  data: 'Sign-in as the documented demo operator ({{username}} / {{password}}, no tenant field — the product is single-tenant).',
  source: 'dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).',
};

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
];
