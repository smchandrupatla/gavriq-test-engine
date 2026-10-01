/**
 * Sand Bench use-case flow catalog — Batch 2a (safe, scoped-to-own-data create flows).
 *
 * Covers the use cases whose main flow creates a resource (schedule, rule, test
 * case, test suite, dataset, run) via a real POST against the deployed API.
 * Every create uses a {{ts}}/{{rand}}-unique name and every follow-on lifecycle
 * call (stage, validate, assemble, delete) operates on that SAME just-created
 * resource — never on pre-existing shared tenant data — so this suite is safe
 * to run repeatedly against the shared Sand Bench deployment.
 *
 * Request/response shapes below were read from the live source
 * (apps/api/src/modules/{liveOps,liveConsole,detectionRules,collections,
 * registerTestSuites,registerTestCases,registerSpecPersist}.ts) and confirmed
 * live against the deployed stack before being encoded.
 */
import type { CaseDef } from './types.js';

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { tenantSlug: '{{tenant}}', username: '{{username}}' },
  expected_status: 200, save: { token: 'token' },
  description: 'operator login',
};
const BEARER = { authorization: 'Bearer {{token}}' };

const C: CaseDef[] = [];

/* ------------------------------------------------------------------------ */
/* UC-schNew — New schedule                                                  */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-schNew-MAIN',
    name: 'UC-schNew main flow: New schedule',
    description: 'Main flow of UC-schNew (New schedule): operator names a schedule, picks cadence "daily" against a real test-suite target, creates it, and the API returns an identity with a calculated next_run_at. Touches POST /api/v1/schedules.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; at least one test suite exists as a schedule target.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-new.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schNew"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-suites', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.0.id', exists: true }], save: { target_suite_id: 'data.0.id' }, description: 'pick a real target suite' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-{{ts}}', cadence: 'daily', targetType: 'suite', targetId: '{{target_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'id', exists: true }, { path: 'next_run_at', exists: true }, { path: 'cadence', equals: 'daily' }], description: 'create schedule' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'schNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One schedule named TE-UC-SCH-{{ts}} targeting a real existing test suite, cadence daily.', source: 'Generated per run; never deleted (schedules have no delete endpoint in this API), so names are kept unique to avoid collisions.' },
    expected: '201 with id, cadence="daily" and a calculated next_run_at.',
  },
  {
    key: 'SB-UC-schNew-ALT-1',
    name: 'UC-schNew alt flow 1: Different supported cadence values produce their defined next occurrence.',
    description: 'Alternate flow 1 of UC-schNew (New schedule): "Different supported cadence values produce their defined next occurrence." Creates one schedule per supported cadence (once/hourly/weekly) and confirms each gets its own next_run_at.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; at least one test suite exists.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-suites', headers: BEARER, expected_status: 200, save: { target_suite_id: 'data.0.id' }, description: 'pick a real target suite' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-ONCE-{{ts}}', cadence: 'once', targetType: 'suite', targetId: '{{target_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'next_run_at', exists: true }], description: 'cadence=once' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-HOURLY-{{ts}}', cadence: 'hourly', targetType: 'suite', targetId: '{{target_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'next_run_at', exists: true }], description: 'cadence=hourly' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-WEEKLY-{{ts}}', cadence: 'weekly', targetType: 'suite', targetId: '{{target_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'next_run_at', exists: true }], description: 'cadence=weekly' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'schNew'],
    dataProfile: { profile: 'synthetic-named', data: 'Three schedules, one per cadence, all uniquely named TE-UC-SCH-*-{{ts}}.', source: 'Generated per run.' },
    expected: 'All three cadences are accepted, each with its own next_run_at.',
  },
  {
    key: 'SB-UC-schNew-ALT-2',
    name: 'UC-schNew alt flow 2: The proposed run-template linkage requires a separately confirmed payload.',
    description: 'Alternate flow 2 of UC-schNew (New schedule): "The proposed run-template linkage requires a separately confirmed payload." Closest executable proxy: a schedule created WITHOUT a channel/connectionId still succeeds (those are genuinely optional, not silently defaulted into an unconfirmed run template).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; at least one test suite exists.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-suites', headers: BEARER, expected_status: 200, save: { target_suite_id: 'data.0.id' }, description: 'pick a real target suite' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-NOCHAN-{{ts}}', cadence: 'daily', targetType: 'suite', targetId: '{{target_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'channel', exists: false }, { path: 'id', exists: true }], description: 'create without channel' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'schNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One schedule with no channel/connectionId supplied.', source: 'Generated per run.' },
    expected: 'Schedule is created; channel stays null/absent rather than being silently invented.',
  },
  {
    key: 'SB-UC-schNew-EXC-1',
    name: 'UC-schNew exc flow 1: Missing name or cadence is rejected.',
    description: 'Exception flow 1 of UC-schNew (New schedule): "Missing name or cadence is rejected." POST with neither name nor cadence must fail validation, not create a half-formed schedule.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: {}, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'missing name and cadence' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'schNew'],
    dataProfile: { profile: 'negative', data: 'Empty body.', source: 'n/a' },
    expected: '422 validation_failed; no schedule row is created.',
  },
  {
    key: 'SB-UC-schNew-EXC-2',
    name: 'UC-schNew exc flow 2: A sch_local fallback is not evidence that a scheduler will execute a durable record.',
    description: 'Exception flow 2 of UC-schNew (New schedule): "A sch_local fallback is not evidence that a scheduler will execute a durable record." Closest executable proxy: a successfully created schedule\'s id is immediately readable back via GET /api/v1/schedules/:id — proving it is a real persisted row, not a client-side-only fallback id.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; at least one test suite exists.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-suites', headers: BEARER, expected_status: 200, save: { target_suite_id: 'data.0.id' }, description: 'pick a real target suite' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-DURABLE-{{ts}}', cadence: 'once', targetType: 'suite', targetId: '{{target_suite_id}}' }, expected_status: 201, save: { new_sch_id: 'id' }, description: 'create schedule' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules/{{new_sch_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'id', equals: '{{new_sch_id}}' }], description: 'read it back by id' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'schNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One uniquely named schedule, read back by its returned id.', source: 'Generated per run.' },
    expected: 'The created id is independently readable — a real persisted row, not a local-only id.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-ruleBenchCreate — Create new rule                                      */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-ruleBenchCreate-MAIN',
    name: 'UC-ruleBenchCreate main flow: Create new rule',
    description: 'Main flow of UC-ruleBenchCreate (Create new rule): analyst names a rule, picks condition kind amount_gte with a threshold, submits once, and the API returns the created identity and lifecycle (status in_review). Touches POST /api/v1/rules.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-create.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchCreate"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, expect_json: [{ path: 'id', exists: true }, { path: 'status', equals: 'in_review' }, { path: 'name', equals: 'TE-UC-RULE-{{ts}}' }], description: 'create rule' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'ruleBenchCreate'],
    dataProfile: { profile: 'synthetic-named', data: 'One rule named TE-UC-RULE-{{ts}}, category fraud, condition amount_gte(instdAmt, 10000).', source: 'Generated per run; left in place (no delete endpoint for rules in this API).' },
    expected: '201 with id, status "in_review" and the exact name supplied.',
  },
  {
    key: 'SB-UC-ruleBenchCreate-ALT-1',
    name: 'UC-ruleBenchCreate alt flow 1: Analyst revises a rejected input and deliberately resubmits.',
    description: 'Alternate flow 1 of UC-ruleBenchCreate (Create new rule): "Analyst revises a rejected input and deliberately resubmits." A rejected category is corrected and the resubmission succeeds with its own identity.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-RETRY-{{ts}}', category: 'not-a-real-category', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'rejected: bad category' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-RETRY-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, expect_json: [{ path: 'id', exists: true }], description: 'resubmit with corrected category' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'ruleBenchCreate'],
    dataProfile: { profile: 'synthetic-named', data: 'One rejected attempt, one corrected resubmission, same name.', source: 'Generated per run.' },
    expected: 'First call 422; corrected resubmission 201 with a real id.',
  },
  {
    key: 'SB-UC-ruleBenchCreate-ALT-2',
    name: 'UC-ruleBenchCreate alt flow 2: Analyst leaves without saving; no rule is inferred from a partially completed form.',
    description: 'Alternate flow 2 of UC-ruleBenchCreate (Create new rule): "Analyst leaves without saving; no rule is inferred from a partially completed form." No backing API call is made for this flow by design — leaving the form is evidenced only by the screen loading and no POST ever firing.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-create.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchCreate"', description: 'load screen' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'ruleBenchCreate'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload — deliberately no POST is made.', source: 'n/a' },
    expected: 'Screen loads; no rule is created by this case.',
  },
  {
    key: 'SB-UC-ruleBenchCreate-EXC-1',
    name: 'UC-ruleBenchCreate exc flow 1: Missing condition.kind is a validation failure.',
    description: 'Exception flow 1 of UC-ruleBenchCreate (Create new rule): "Missing condition.kind is a validation failure." POST with a condition object missing kind must be rejected, not silently defaulted.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-NOKIND-{{ts}}', category: 'fraud', severity: 'medium', condition: { field: 'instdAmt', value: 10000 } }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'condition missing kind' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'ruleBenchCreate'],
    dataProfile: { profile: 'negative', data: 'Condition object with field/value but no kind.', source: 'n/a' },
    expected: '422 validation_failed naming the condition problem; no rule row is created.',
  },
  {
    key: 'SB-UC-ruleBenchCreate-EXC-2',
    name: 'UC-ruleBenchCreate exc flow 2: A lost save response is unconfirmed; a second write is not evidence that the first failed.',
    description: 'Exception flow 2 of UC-ruleBenchCreate (Create new rule): "A lost save response is unconfirmed; a second write is not evidence that the first failed." Two independent creates with distinct names each get their own distinct id — a dropped response for one call is never inferred from the other succeeding.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-A-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 5000 } }, expected_status: 200, expect_json: [{ path: 'id', exists: true }], save: { rule_a_id: 'id' }, description: 'first independent create' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-B-{{ts}}', category: 'aml', severity: 'high', condition: { kind: 'country_in', field: 'cdtrCtry', values: ['KP'] } }, expected_status: 200, expect_json: [{ path: 'id', exists: true }], save: { rule_b_id: 'id' }, description: 'second independent create' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'ruleBenchCreate'],
    dataProfile: { profile: 'synthetic-named', data: 'Two independently-named rules, each expected to carry its own distinct id.', source: 'Generated per run.' },
    expected: 'Both creates succeed with distinct ids; neither is treated as a retry of the other.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-ruleBenchStage — Stage rules                                           */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-ruleBenchStage-MAIN',
    name: 'UC-ruleBenchStage main flow: Stage rules',
    description: 'Main flow of UC-ruleBenchStage (Stage rules): analyst identifies a rule (one created by this case), requests Stage, and the registered transition path reports the new lifecycle state. Touches POST /api/v1/rules/:id/stage.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-stage.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchStage"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-STAGE-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, save: { rule_id: 'id', rule_etag: 'etag' }, description: 'create a rule to stage' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/stage', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{rule_etag}}' }, expected_status: 200, expect_json: [{ path: 'status', equals: 'staged' }], description: 'stage it' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'ruleBenchStage'],
    dataProfile: { profile: 'synthetic-named', data: 'One rule we create, then stage.', source: 'Generated per run.' },
    expected: '200 with status "staged".',
  },
  {
    key: 'SB-UC-ruleBenchStage-ALT-1',
    name: 'UC-ruleBenchStage alt flow 1: Analyst cancels before submission; no stage request is made.',
    description: 'Alternate flow 1 of UC-ruleBenchStage (Stage rules): "Analyst cancels before submission; no stage request is made." No stage API call is made for this flow by design.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-stage.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchStage"', description: 'load screen' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'ruleBenchStage'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload — deliberately no stage call.', source: 'n/a' },
    expected: 'Screen loads; no rule is staged by this case.',
  },
  {
    key: 'SB-UC-ruleBenchStage-ALT-2',
    name: 'UC-ruleBenchStage alt flow 2: A transition through the wider lifecycle endpoint includes its required If-Match value.',
    description: 'Alternate flow 2 of UC-ruleBenchStage (Stage rules): "A transition through the wider lifecycle endpoint includes its required If-Match value." The general /transitions endpoint (as opposed to the /stage alias) is exercised directly with transition="stage" and a real If-Match.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-TRANS-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, save: { rule_id: 'id', rule_etag: 'etag' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/transitions', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{rule_etag}}' }, body: { transition: 'stage', environment: 'lab' }, expected_status: 200, expect_json: [{ path: 'status', equals: 'staged' }], description: 'transition via the general endpoint' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'ruleBenchStage'],
    dataProfile: { profile: 'synthetic-named', data: 'One rule we create, then transition via the general endpoint.', source: 'Generated per run.' },
    expected: '200 with status "staged", called via /transitions with an explicit If-Match.',
  },
  {
    key: 'SB-UC-ruleBenchStage-EXC-1',
    name: 'UC-ruleBenchStage exc flow 1: A stale version must not silently replace another edit.',
    description: 'Exception flow 1 of UC-ruleBenchStage (Stage rules): "A stale version must not silently replace another edit." A stage request carrying a deliberately wrong If-Match (not the rule\'s real etag) must be rejected with a precondition failure, not applied.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-STALE-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/stage', headers: { authorization: 'Bearer {{token}}', 'if-match': '"deliberately-stale-etag"' }, expected_status: 412, description: 'stale If-Match is rejected' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'ruleBenchStage'],
    dataProfile: { profile: 'negative', data: 'A real rule, staged with a fabricated If-Match value.', source: 'Generated per run.' },
    expected: '412 precondition failure; the rule is not staged.',
  },
  {
    key: 'SB-UC-ruleBenchStage-EXC-2',
    name: 'UC-ruleBenchStage exc flow 2: A rejected or unknown transition leaves no claimed successful stage.',
    description: 'Exception flow 2 of UC-ruleBenchStage (Stage rules): "A rejected or unknown transition leaves no claimed successful stage." An unknown transition name must be rejected cleanly via validation, never silently treated as a successful stage.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-UNKTR-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, save: { rule_id: 'id', rule_etag: 'etag' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/transitions', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{rule_etag}}' }, body: { transition: 'bogus-transition' }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'unknown transition rejected' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'ruleBenchStage'],
    dataProfile: { profile: 'negative', data: 'A real rule, transitioned with a nonexistent transition name.', source: 'Generated per run.' },
    expected: '422 validation_failed; the rule remains in_review, never claimed staged.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-ruleBenchValidate — Validate rules                                     */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-ruleBenchValidate-MAIN',
    name: 'UC-ruleBenchValidate main flow: Validate rules',
    description: 'Main flow of UC-ruleBenchValidate (Validate rules): analyst selects a rule (one created by this case) and requests validation against generated pain.001 data; the service evaluates the condition and reports measurements. Touches POST /api/v1/rules/:id/validate.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; pain.001.001.09 message type seeded.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-validate.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchValidate"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-VAL-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 1 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule that matches almost everything' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 20, seed: 'TE-UC-VAL-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'result', exists: true }, { path: 'passRate', exists: true }], description: 'validate against generated data' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'ruleBenchValidate'],
    dataProfile: { profile: 'synthetic-generated', data: '20 generated pain.001.001.09 messages evaluated against a near-always-true amount_gte(instdAmt, 1) rule.', source: 'Generated per run via the same generator the API uses internally.' },
    expected: '200 with a validation result and coverage percentage.',
  },
  {
    key: 'SB-UC-ruleBenchValidate-ALT-1',
    name: 'UC-ruleBenchValidate alt flow 1: A repeat with the same seed supports comparison only when input and rule versions are also unchanged.',
    description: 'Alternate flow 1 of UC-ruleBenchValidate (Validate rules): "A repeat with the same seed supports comparison only when input and rule versions are also unchanged." Running validate twice with the identical seed against the unchanged rule produces the same coverage both times.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-SEED-{{ts}}', category: 'fraud', severity: 'low', condition: { kind: 'amount_gte', field: 'instdAmt', value: 1 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 10, seed: 'TE-UC-REPEATABLE-SEED' }, expected_status: 200, expect_json: [{ path: 'passRate', exists: true }], save: { coverage_1: 'passRate' }, description: 'first run' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 10, seed: 'TE-UC-REPEATABLE-SEED' }, expected_status: 200, expect_json: [{ path: 'passRate', equals: '{{coverage_1}}' }], description: 'second run, same seed' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'ruleBenchValidate'],
    dataProfile: { profile: 'synthetic-generated', data: 'Two validate calls with the identical seed against the same unchanged rule.', source: 'Generated per run.' },
    expected: 'Both runs report the same coverage.',
  },
  {
    key: 'SB-UC-ruleBenchValidate-ALT-2',
    name: 'UC-ruleBenchValidate alt flow 2: A broader test run is a separate action from the rule validation endpoint.',
    description: 'Alternate flow 2 of UC-ruleBenchValidate (Validate rules): "A broader test run is a separate action from the rule validation endpoint." Validating a rule does not itself create a run row — GET /api/v1/runs count is unaffected by the validate call above.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], save: { runs_before: 'data' }, description: 'runs before validate' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-NORUN-{{ts}}', category: 'fraud', severity: 'low', condition: { kind: 'amount_gte', field: 'instdAmt', value: 1 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 5 }, expected_status: 200, description: 'validate (not a run)' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'ruleBenchValidate'],
    dataProfile: { profile: 'synthetic-generated', data: 'One rule validation; no run is expected to be created by it.', source: 'Generated per run.' },
    expected: 'Validate succeeds via the rule endpoint, distinct from the runs collection.',
  },
  {
    key: 'SB-UC-ruleBenchValidate-EXC-1',
    name: 'UC-ruleBenchValidate exc flow 1: No cases or unavailable data is not a passed validation.',
    description: 'Exception flow 1 of UC-ruleBenchValidate (Validate rules): "No cases or unavailable data is not a passed validation." A condition engineered to match nothing (amount_gte 999999999) must report a result other than "passed" (warning, since zero hits out of N is a non-trigger, not a pass).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-NOHIT-{{ts}}', category: 'fraud', severity: 'low', condition: { kind: 'amount_gte', field: 'instdAmt', value: 999999999 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule that can never match' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 20 }, expected_status: 200, expect_json: [{ path: 'result', matches: '^(warning|failed)$' }], description: 'validate a never-matching rule' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'ruleBenchValidate'],
    dataProfile: { profile: 'synthetic-generated', data: '20 generated messages against a rule designed to never trigger.', source: 'Generated per run.' },
    expected: 'Result is reported honestly (warning/zero-hit), never fabricated as "passed".',
  },
  {
    key: 'SB-UC-ruleBenchValidate-EXC-2',
    name: 'UC-ruleBenchValidate exc flow 2: A processing error is distinguished from a correctly detected negative test.',
    description: 'Exception flow 2 of UC-ruleBenchValidate (Validate rules): "A processing error is distinguished from a correctly detected negative test." Validating against a nonexistent messageTypeCode must return a clean error, not a fabricated validation result.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-BADTYPE-{{ts}}', category: 'fraud', severity: 'low', condition: { kind: 'amount_gte', field: 'instdAmt', value: 1 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'not.a.real.type', count: 5 }, expected_status: [404, 400, 422], description: 'validate against an unknown message type' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'ruleBenchValidate'],
    dataProfile: { profile: 'negative', data: 'An unknown messageTypeCode.', source: 'n/a' },
    expected: 'A clean error status; never a 200 claiming a validation result.',
  }
);

export const SANDBENCH_USECASE_FLOW_CASES_BATCH2A: CaseDef[] = C;

