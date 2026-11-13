#!/usr/bin/env node
// Rebaseline the four recorded (Record & play) Sand Bench cases against the current console.
//   node scripts/rebaseline-recorded-cases.mjs        (TE_BASE, default http://127.0.0.1:8797)
// They exist only in the engine's repository (no catalogue source), so they are updated through
// the engine API, which versions the change. Recorded against an October build with fixed
// addresses and demo identities; one clicked menu entries that Sand Bench does not have.
const TE = process.env.TE_BASE || 'http://127.0.0.1:8797';
const env = 'sand-bench-staging';
const common = {
  environment: env,
  updated_by: 'claude-rebaseline',
  change_summary: 'Rebaselined against Sand Bench main a8d72039: environment address and identity instead of fixed values; steps follow the current console.',
  preconditions: 'The Sand Bench console and its application service are running; the operator identity of the run can sign in.',
  validation_rules: { browser: 'chromium', viewport: { width: 1280, height: 800 } },
  tags: ['record-and-play', 'sand-bench', 'console'],
};
const signIn = { action: 'sign_in', value: '{{username}}', password: '{{password}}', timeout_ms: 60000,
  text: 'Sign in to the console as the operator', expected: 'The sign-in page closes and the console opens.', testData: 'The operator identity this run was given.' };
const heading = (page, title, words) => ([
  { action: 'navigate', value: `{{web}}/${page}`, text: `Open the ${words} screen`, expected: `The ${words} screen loads.` },
  { action: 'wait_for', selector: 'h1:visible', timeout_ms: 20000, text: 'Wait for the screen heading', expected: 'A heading is shown.' },
  { action: 'assert_selector_text', selector: 'h1:visible', must_contain: title, text: 'Read the screen heading', expected: `The heading reads "${title}".` },
]);

const cases = {
  'TC-OPERATOR-SIGNS-IN-TO-SAND-BENCH-STAGING-MV1YP4Y9': {
    name: 'Operator signs in to Sand Bench staging',
    objective: 'Confirm an operator can open the console, type their user name and password, choose Sign in, and land on the first page of the application.',
    description: 'Open {{web}}/, fill #gate #username and #gate #password with the run\'s operator identity, click #gate #login, wait for #gate to hide, and read the Overview hero heading.',
    expected_results: 'The sign-in page closes and the Overview heading "Good rules survive bad data." is shown.',
    test_data: 'The operator identity the run was given (one identity per running execution).',
    steps: [
      { action: 'navigate', value: '{{web}}/', text: 'Open the Sand Bench console', expected: 'The sign-in page is shown.' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 20000, text: 'Wait for the sign-in form', expected: 'The Sign in button is visible.' },
      { action: 'type', selector: '#gate #username', value: '{{username}}', text: 'Type the operator\'s user name', expected: 'The user name is in the field.', testData: 'The operator identity this run was given.' },
      { action: 'type', selector: '#gate #password', value: '{{password}}', text: 'Type the operator\'s password', expected: 'The password is in the field, hidden.' },
      { action: 'click', selector: '#gate #login', text: 'Choose Sign in', expected: 'The application accepts the sign-in.' },
      { action: 'wait_for_hidden', selector: '#gate', timeout_ms: 60000, text: 'Wait for the sign-in page to close', expected: 'The sign-in page is gone and the console is shown.' },
      { action: 'assert_selector_text', selector: 'h1.opsc-hero-title:visible', must_contain: 'Good rules survive bad data.', text: 'Read the heading of the first page', expected: 'The Overview page is shown with its heading.' },
    ],
  },
  'TC-OPERATOR-OPENS-TEST-CASES-TEST-SUITES-AN-MV1YP4ZF': {
    name: 'Operator opens Test cases, Test suites and Test runs',
    objective: 'Confirm a signed-in operator can open the Test cases, Test suites and All test runs screens and that each one shows its own heading.',
    description: 'Sign in through the gate, then open {{web}}/test-cases.html, /test-suites.html and /test-runs-all.html and read each page\'s visible h1. (The recording originally clicked "Executions", which is not a Sand Bench screen; the application\'s equivalent is All test runs.)',
    expected_results: 'Each of the three screens opens with its heading: Test cases, Test suites, All test runs.',
    test_data: 'The operator identity the run was given; no records are created.',
    steps: [signIn, ...heading('test-cases.html', 'Test cases', 'Test cases'), ...heading('test-suites.html', 'Test suites', 'Test suites'), ...heading('test-runs-all.html', 'All test runs', 'All test runs')],
  },
  'TC-OPERATOR-SIGNS-OUT-FROM-THE-USER-MENU-MV1YP50L': {
    name: 'Operator signs out from the top bar',
    objective: 'Confirm a signed-in operator can choose Sign out and is taken back to the sign-in page, so nobody else can use their session on that browser.',
    description: 'Sign in through the gate, click the top bar\'s Sign out button (.opsc-signout), and wait for the gate\'s sign-in form to return. Signing out ends every session of that operator, which is the run\'s own identity.',
    expected_results: 'The sign-in page is shown again with its Sign in button.',
    test_data: 'The operator identity the run was given.',
    steps: [
      signIn,
      { action: 'wait_for', selector: '.opsc-signout', timeout_ms: 20000, text: 'Find Sign out in the top bar', expected: 'The Sign out button is visible.' },
      { action: 'click', selector: '.opsc-signout', text: 'Choose Sign out', expected: 'The application ends the session.' },
      { action: 'wait_for', selector: '#gate #login', timeout_ms: 30000, text: 'Wait for the sign-in page', expected: 'The sign-in page is shown again.' },
      { action: 'assert_title', must_contain: 'Sand Bench', text: 'Read the browser tab title', expected: 'The tab still names Sand Bench.' },
    ],
  },
  'REC-SAND-BENCH-SIGN-IN-ATTEMPT-RECORDED-VIA--MV2A8FTA': {
    name: 'Sand Bench sign-in attempt (recorded via the Record and play agent)',
    objective: 'Confirm the sign-in page still offers everything a visitor needs — a place for the user name and password, a Sign in button and a way to recover a forgotten password — and fits the screen without sideways scrolling.',
    description: 'Replays the recorded visit: open {{web}}/, type a user name and password into the Username and Password boxes without submitting, reload, and check the sign-in landmark (main "Sand Bench sign in"), the Sign in button, the Forgot password? link and that the page does not overflow at 1280px. The recording\'s check for an h1 "SAND BENCH" is gone with the heading itself: the current sign-in page has no h1.',
    expected_results: 'The sign-in page shows its landmark, both boxes, the Sign in button and the Forgot password? link, and does not scroll sideways.',
    test_data: 'The operator identity the run was given, typed but never submitted.',
    steps: [
      { action: 'navigate', value: '{{web}}/', text: 'Open the Sand Bench console', expected: 'The sign-in page loads.' },
      { action: 'wait_for', selector: 'role=textbox[name="Username"]', timeout_ms: 20000, text: 'Wait for the user name box', expected: 'The Username box is visible.' },
      { action: 'type', selector: 'role=textbox[name="Username"]', value: '{{username}}', text: 'Type a user name', expected: 'The user name is in the box.', testData: 'The operator identity this run was given.' },
      { action: 'type', selector: 'role=textbox[name="Password"]', value: '{{password}}', text: 'Type a password', expected: 'The password is in the box, hidden.' },
      { action: 'navigate', value: '{{web}}/', text: 'Reload the page without signing in', expected: 'The sign-in page loads again.' },
      { action: 'assert_title', must_contain: 'Sand Bench', text: 'Read the browser tab title', expected: 'The tab names Sand Bench.' },
      { action: 'wait_for', selector: 'role=main[name="Sand Bench sign in"]', timeout_ms: 20000, text: 'Look for the sign-in area', expected: 'The sign-in area is on the page.' },
      { action: 'wait_for', selector: 'role=button[name="Sign in"]', timeout_ms: 10000, text: 'Look for the Sign in button', expected: 'The Sign in button is visible.' },
      { action: 'assert_selector_text', selector: 'role=link[name="Forgot password?"]', must_contain: 'Forgot password?', text: 'Look for the forgotten-password link', expected: 'The Forgot password? link is visible.' },
      { action: 'assert_no_horizontal_overflow', text: 'Check the page fits the screen', expected: 'The page does not scroll sideways at 1280px.' },
    ],
  },
};

for (const [key, patch] of Object.entries(cases)) {
  const res = await fetch(`${TE}/api/v1/test-cases/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-actor-id': 'claude-rebaseline' },
    body: JSON.stringify({ ...common, ...patch }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`${key} -> ${res.status} v${body.data?.version ?? '?'} steps=${body.data?.steps?.length ?? '?'} ${res.ok ? '' : JSON.stringify(body).slice(0, 200)}`);
}
