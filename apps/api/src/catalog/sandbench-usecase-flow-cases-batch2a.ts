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
  body: { username: '{{username}}', password: '{{password}}' },
  expected_status: 200, save: { token: 'token' },
  description: 'operator login',
};
const BEARER = { authorization: 'Bearer {{token}}' };

const createScheduleTargetSuite = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER,
  body: { name: 'TE-UC-SCH-TARGET-{{ts}}' }, expected_status: 201,
  expect_json: [{ path: 'id', matches: '^su_' }, { path: 'name', equals: 'TE-UC-SCH-TARGET-{{ts}}' }], save: { schedule_suite_id: 'id', schedule_suite_etag: 'etag' },
  description: 'create this case\'s temporary schedule target suite',
};

/** Remove a schedule this case created (current version read first), then confirm it is gone. */
function cleanupSchedule(id: string) {
  const url = `{{api}}/api/v1/schedules/{{${id}}}`;
  return [
    { action: 'request', method: 'GET', url, headers: BEARER, skip_if_missing: [id], expected_status: 200, save: { [`${id}_etag`]: 'etag' }, description: `get current ETag for ${id}` },
    { action: 'request', method: 'DELETE', url, headers: { authorization: 'Bearer {{token}}', 'if-match': `{{${id}_etag}}` }, skip_if_missing: [id, `${id}_etag`], expected_status: 200, expect_json: [{ path: 'deleted', equals: true }], description: `delete case-owned schedule ${id}` },
    { action: 'request', method: 'GET', url, headers: BEARER, skip_if_missing: [id], expected_status: 404, description: `verify schedule ${id} is gone` },
  ];
}

const cleanupScheduleTargetSuite = {
  action: 'request', method: 'DELETE', url: '{{api}}/api/v1/test-suites/{{schedule_suite_id}}',
  headers: { authorization: 'Bearer {{token}}', 'if-match': '{{schedule_suite_etag}}' },
  skip_if_missing: ['schedule_suite_id', 'schedule_suite_etag'],
  expected_status: 200, expect_json: [{ path: 'deleted', equals: true }], description: 'delete this case\'s temporary schedule target suite',
};

/**
 * Remove a rule this case created. The application deletes a rule in any lifecycle
 * state (in review, staged, deprecated) when the request carries the rule's current
 * version; the current version is read first because validating or staging changes it.
 */
function cleanupRule(id: string) {
  const etag = `${id}_cleanup_etag`;
  const url = `{{api}}/api/v1/rules/{{${id}}}`;
  return [
    { action: 'request', method: 'GET', url, headers: BEARER, skip_if_missing: [id], expected_status: 200, save: { [etag]: 'data.etag' }, description: `get current ETag for ${id}` },
    { action: 'request', method: 'DELETE', url, headers: { authorization: 'Bearer {{token}}', 'if-match': `{{${etag}}}` }, skip_if_missing: [id, etag], expected_status: 200, expect_json: [{ path: 'deleted', equals: true }], description: `delete case-owned rule ${id}` },
    { action: 'request', method: 'GET', url, headers: BEARER, skip_if_missing: [id], expected_status: 404, description: `verify rule ${id} is gone` },
  ];
}

const C: CaseDef[] = [];

/* ------------------------------------------------------------------------ */
/* UC-schNew — New schedule                                                  */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-schNew-MAIN',
    name: 'UC-schNew main flow: New schedule',
    objective: 'Walk through the "New schedule" screen the way its main use case describes it: operator names a schedule, picks cadence "daily" against a real test-suite target, creates it, and the application service returns an identity with a calculated next run time.',
    description: 'Main flow of UC-schNew (New schedule): operator names a schedule, picks cadence "daily" against a real test-suite target, creates it, and the API returns an identity with a calculated next_run_at. Touches POST /api/v1/schedules.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-new.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schNew"', description: 'load screen' },
      API_LOGIN,
      createScheduleTargetSuite,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-{{ts}}', cadence: 'daily', targetType: 'suite', targetId: '{{schedule_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'id', exists: true }, { path: 'next_run_at', exists: true }, { path: 'cadence', equals: 'daily' }], save: { schedule_id: 'id' }, description: 'create schedule' },
    ],
    cleanupSteps: [...cleanupSchedule('schedule_id'), cleanupScheduleTargetSuite],
    tags: ['usecase', 'sand-bench', 'main-flow', 'schNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One case-owned temporary suite and one schedule targeting it; both are deleted after the case.' , source: 'Created by this case with unique per-run names and removed in cleanup.' },
    expected: '201 with id, cadence="daily" and a calculated next_run_at.',
  },
  {
    key: 'SB-UC-schNew-ALT-1',
    name: 'UC-schNew alt flow 1: Different supported cadence values produce their defined next occurrence.',
    objective: 'Check an alternative path of "New schedule": different supported cadence values produce their defined next occurrence.',
    description: 'Alternate flow 1 of UC-schNew (New schedule): "Different supported cadence values produce their defined next occurrence." Creates one schedule per supported cadence (once/hourly/weekly) and confirms each gets its own next_run_at.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      createScheduleTargetSuite,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-ONCE-{{ts}}', cadence: 'once', targetType: 'suite', targetId: '{{schedule_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'next_run_at', exists: true }], save: { schedule_once_id: 'id' }, description: 'cadence=once' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-HOURLY-{{ts}}', cadence: 'hourly', targetType: 'suite', targetId: '{{schedule_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'next_run_at', exists: true }], save: { schedule_hourly_id: 'id' }, description: 'cadence=hourly' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-WEEKLY-{{ts}}', cadence: 'weekly', targetType: 'suite', targetId: '{{schedule_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'next_run_at', exists: true }], save: { schedule_weekly_id: 'id' }, description: 'cadence=weekly' },
    ],
    cleanupSteps: [...cleanupSchedule('schedule_once_id'), ...cleanupSchedule('schedule_hourly_id'), ...cleanupSchedule('schedule_weekly_id'), cleanupScheduleTargetSuite],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'schNew'],
    dataProfile: { profile: 'synthetic-named', data: 'Three schedules, one per cadence, all uniquely named TE-UC-SCH-*-{{ts}}.', source: 'Generated per run.' },
    expected: 'All three cadences are accepted, each with its own next_run_at.',
    atomicityNote: { reason: 'pending-split', detail: 'Checks three cadences (once/hourly/weekly) in one case; follow-up: split into SB-UC-schNew-ALT-1a/1b/1c, one cadence each.' },
  },
  {
    key: 'SB-UC-schNew-ALT-2',
    name: 'UC-schNew alt flow 2: The proposed run-template linkage requires a separately confirmed payload.',
    objective: 'Check an alternative path of "New schedule": what a schedule runs is the target chosen for it, and the delivery channel and delivery endpoint are optional. A schedule saved without them is accepted, keeps its chosen target, and shows both as not set rather than inventing a value.',
    description: 'Alternate flow 2 of UC-schNew (New schedule), current wording: "The run linkage is the payload targetType (suite or test_case) and targetId … channel and connectionId are optional." (Earlier wording: "The proposed run-template linkage requires a separately confirmed payload.") A schedule created without channel/connectionId answers 201 with target_type "suite", target_id the case\'s own suite, and channel / connection_id null.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      createScheduleTargetSuite,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-NOCHAN-{{ts}}', cadence: 'daily', targetType: 'suite', targetId: '{{schedule_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'id', matches: '^sch_' }, { path: 'target_type', equals: 'suite' }, { path: 'target_id', equals: '{{schedule_suite_id}}' }, { path: 'channel', equals: null }, { path: 'connection_id', equals: null }, { path: 'status', equals: 'scheduled' }], save: { schedule_no_channel_id: 'id' }, description: 'create without channel' },
    ],
    cleanupSteps: [...cleanupSchedule('schedule_no_channel_id'), cleanupScheduleTargetSuite],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'schNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One schedule with no channel/connectionId supplied.', source: 'Generated per run.' },
    expected: 'Schedule is created; channel stays null/absent rather than being silently invented.',
  },
  {
    key: 'SB-UC-schNew-EXC-1',
    name: 'UC-schNew exc flow 1: Missing name or cadence is rejected.',
    objective: 'Check that "New schedule" fails safely: missing name or cadence is rejected. POST with neither name nor cadence must fail validation, not create a half-formed schedule.',
    description: 'Exception flow 1 of UC-schNew (New schedule): "Missing name or cadence is rejected." POST with neither name nor cadence must fail validation, not create a half-formed schedule.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: {}, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }, { path: 'error.message', equals: 'Schedule is not valid' }, { path: 'error.details.name', equals: 'required' }, { path: 'error.details.cadence', equals: 'one_of:once,hourly,daily,weekly' }, { path: 'error.details.targetType', equals: 'one_of:suite,test_case' }, { path: 'error.details.targetId', equals: 'required' }, { path: 'error.details.requestId', exists: true }, { path: 'id', exists: false }], description: 'missing name and cadence: every missing field is named' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'schNew'],
    dataProfile: { profile: 'negative', data: 'Empty body.', source: 'n/a' },
    expected: '422 validation_failed; no schedule row is created.',
  },
  {
    key: 'SB-UC-schNew-EXC-2',
    name: 'UC-schNew exc flow 2: A sch_local fallback is not evidence that a scheduler will execute a durable record.',
    objective: 'Check that "New schedule" fails safely: a sch_local fallback is not evidence that a scheduler will execute a durable record.',
    description: 'Exception flow 2 of UC-schNew (New schedule): "A sch_local fallback is not evidence that a scheduler will execute a durable record." Closest executable proxy: a successfully created schedule\'s id is immediately readable back via GET /api/v1/schedules/:id — proving it is a real persisted row, not a client-side-only fallback id.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      createScheduleTargetSuite,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schedules', headers: BEARER, body: { name: 'TE-UC-SCH-DURABLE-{{ts}}', cadence: 'once', targetType: 'suite', targetId: '{{schedule_suite_id}}' }, expected_status: 201, expect_json: [{ path: 'id', matches: '^sch_(?!local)' }, { path: 'etag', exists: true }], save: { new_sch_id: 'id' }, description: 'create schedule: the identity returned is a stored one, not a local stand-in' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules/{{new_sch_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'id', equals: '{{new_sch_id}}' }, { path: 'name', equals: 'TE-UC-SCH-DURABLE-{{ts}}' }, { path: 'cadence', equals: 'once' }, { path: 'target_id', equals: '{{schedule_suite_id}}' }], description: 'read it back by id' },
    ],
    cleanupSteps: [...cleanupSchedule('new_sch_id'), cleanupScheduleTargetSuite],
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
    objective: 'Walk through the "Create new rule" screen the way its main use case describes it: analyst names a rule, picks condition kind amount_gte with a threshold, submits once, and the application service returns the created identity and lifecycle (status in_review).',
    description: 'Main flow of UC-ruleBenchCreate (Create new rule): analyst names a rule, picks condition kind amount_gte with a threshold, submits once, and the API returns the created identity and lifecycle (status in_review). Touches POST /api/v1/rules.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-create.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchCreate"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, expect_json: [{ path: 'id', exists: true }, { path: 'status', equals: 'in_review' }, { path: 'name', equals: 'TE-UC-RULE-{{ts}}' }], save: { rule_id: 'id' }, description: 'create rule' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
    tags: ['usecase', 'sand-bench', 'main-flow', 'ruleBenchCreate'],
    dataProfile: { profile: 'synthetic-named', data: 'One rule named TE-UC-RULE-{{ts}}, category fraud, condition amount_gte(instdAmt, 10000).', source: 'Generated per run; deleted in cleanup.' },
    expected: '200 with id, status "in_review" and the exact name supplied.',
  },
  {
    key: 'SB-UC-ruleBenchCreate-ALT-1',
    name: 'UC-ruleBenchCreate alt flow 1: Analyst revises a rejected input and deliberately resubmits.',
    objective: 'Check an alternative path of "Create new rule": analyst revises a rejected input and deliberately resubmits. A rejected category is corrected and the resubmission succeeds with its own identity.',
    description: 'Alternate flow 1 of UC-ruleBenchCreate (Create new rule): "Analyst revises a rejected input and deliberately resubmits." A rejected category is corrected and the resubmission succeeds with its own identity.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-RETRY-{{ts}}', category: 'not-a-real-category', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'rejected: bad category' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-RETRY-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, expect_json: [{ path: 'id', exists: true }], save: { rule_id: 'id' }, description: 'resubmit with corrected category' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'ruleBenchCreate'],
    dataProfile: { profile: 'synthetic-named', data: 'One rejected attempt, one corrected resubmission, same name.', source: 'Generated per run.' },
    expected: 'First call 422; corrected resubmission 200 with a real id.',
  },
  {
    key: 'SB-UC-ruleBenchCreate-ALT-2',
    name: 'UC-ruleBenchCreate alt flow 2: Analyst leaves without saving; no rule is inferred from a partially completed form.',
    objective: 'Check an alternative path of "Create new rule": analyst leaves without saving; no rule is inferred from a partially completed form.',
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
    objective: 'Check that "Create new rule" fails safely: missing condition.kind is a validation failure. POST with a condition object missing kind must be rejected, not silently defaulted.',
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
    objective: 'Check that "Create new rule" fails safely: a lost save response is unconfirmed; a second write is not evidence that the first failed. Two independent creates with distinct names each get their own distinct id — a dropped response for one call is never inferred from the other succeeding.',
    description: 'Exception flow 2 of UC-ruleBenchCreate (Create new rule): "A lost save response is unconfirmed; a second write is not evidence that the first failed." Two independent creates with distinct names each get their own distinct id — a dropped response for one call is never inferred from the other succeeding.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-A-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 5000 } }, expected_status: 200, expect_json: [{ path: 'id', exists: true }], save: { rule_a_id: 'id' }, description: 'first independent create' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-B-{{ts}}', category: 'aml', severity: 'high', condition: { kind: 'country_in', field: 'cdtrCtry', values: ['KP'] } }, expected_status: 200, expect_json: [{ path: 'id', exists: true }], save: { rule_b_id: 'id' }, description: 'second independent create' },
    ],
    cleanupSteps: [...cleanupRule('rule_a_id'), ...cleanupRule('rule_b_id')],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'ruleBenchCreate'],
    dataProfile: { profile: 'synthetic-named', data: 'Two independently-named rules, each expected to carry its own distinct id.', source: 'Generated per run.' },
    expected: 'Both creates succeed with distinct ids; neither is treated as a retry of the other.',
    atomicityNote: { reason: 'tests-independence', detail: 'Verifies two creates are treated as separate resources, not retries of each other — the invariant requires both calls.' },
  }
);

/* ------------------------------------------------------------------------ */
/* UC-ruleBenchStage — Stage rules                                           */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-ruleBenchStage-MAIN',
    name: 'UC-ruleBenchStage main flow: Stage rules',
    objective: 'Walk through the "Stage rules" screen the way its main use case describes it: analyst identifies a rule (one created by this case), requests Stage, and the registered transition path reports the new lifecycle state.',
    description: 'Main flow of UC-ruleBenchStage (Stage rules): analyst identifies a rule (one created by this case), requests Stage, and the registered transition path reports the new lifecycle state. Touches POST /api/v1/rules/:id/stage.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-stage.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchStage"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-STAGE-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, save: { rule_id: 'id', rule_etag: 'etag' }, description: 'create a rule to stage' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/stage', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{rule_etag}}' }, expected_status: 200, expect_json: [{ path: 'status', equals: 'staged' }], description: 'stage it' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
    tags: ['usecase', 'sand-bench', 'main-flow', 'ruleBenchStage'],
    dataProfile: { profile: 'synthetic-named', data: 'One rule we create, then stage.', source: 'Generated per run.' },
    expected: '200 with status "staged".',
  },
  {
    key: 'SB-UC-ruleBenchStage-ALT-1',
    name: 'UC-ruleBenchStage alt flow 1: Analyst cancels before submission; no stage request is made.',
    objective: 'Check an alternative path of "Stage rules": analyst cancels before submission; no stage request is made. No stage application service call is made for this flow by design.',
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
    objective: 'Check an alternative path of "Stage rules": a transition through the wider lifecycle endpoint includes its required If-Match value. The general /transitions endpoint (as opposed to the /stage alias) is exercised directly with transition="stage" and a real If-Match.',
    description: 'Alternate flow 2 of UC-ruleBenchStage (Stage rules): "A transition through the wider lifecycle endpoint includes its required If-Match value." The general /transitions endpoint (as opposed to the /stage alias) is exercised directly with transition="stage" and a real If-Match.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-TRANS-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, save: { rule_id: 'id', rule_etag: 'etag' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/transitions', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{rule_etag}}' }, body: { transition: 'stage', environment: 'lab' }, expected_status: 200, expect_json: [{ path: 'status', equals: 'staged' }], description: 'transition via the general endpoint' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'ruleBenchStage'],
    dataProfile: { profile: 'synthetic-named', data: 'One rule we create, then transition via the general endpoint.', source: 'Generated per run.' },
    expected: '200 with status "staged", called via /transitions with an explicit If-Match.',
  },
  {
    key: 'SB-UC-ruleBenchStage-EXC-1',
    name: 'UC-ruleBenchStage exc flow 1: A stale version must not silently replace another edit.',
    objective: 'Check that "Stage rules" fails safely: a stale version must not silently replace another edit. A stage request carrying a deliberately wrong If-Match (not the rule\'s real version tag) must be rejected with a precondition failure, not applied.',
    description: 'Exception flow 1 of UC-ruleBenchStage (Stage rules): "A stale version must not silently replace another edit." A stage request carrying a deliberately wrong If-Match (not the rule\'s real etag) must be rejected with a precondition failure, not applied.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-STALE-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/stage', headers: { authorization: 'Bearer {{token}}', 'if-match': '"deliberately-stale-etag"' }, expected_status: 412, expect_json: [{ path: 'error.code', equals: 'precondition_failed' }, { path: 'error.details.requestId', exists: true }], description: 'stale If-Match is rejected' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules/{{rule_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.status', equals: 'in_review' }, { path: 'data.staged_environment', equals: null }], description: 'the rule was not staged' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
    tags: ['usecase', 'sand-bench', 'exception-flow', 'ruleBenchStage'],
    dataProfile: { profile: 'negative', data: 'A real rule, staged with a fabricated If-Match value.', source: 'Generated per run.' },
    expected: '412 precondition failure; the rule is not staged.',
  },
  {
    key: 'SB-UC-ruleBenchStage-EXC-2',
    name: 'UC-ruleBenchStage exc flow 2: A rejected or unknown transition leaves no claimed successful stage.',
    objective: 'Check that "Stage rules" fails safely: a rejected or unknown transition leaves no claimed successful stage. An unknown transition name must be rejected cleanly via validation, never silently treated as a successful stage.',
    description: 'Exception flow 2 of UC-ruleBenchStage (Stage rules): "A rejected or unknown transition leaves no claimed successful stage." An unknown transition name must be rejected cleanly via validation, never silently treated as a successful stage.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-UNKTR-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } }, expected_status: 200, save: { rule_id: 'id', rule_etag: 'etag' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/transitions', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{rule_etag}}' }, body: { transition: 'bogus-transition' }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'unknown transition rejected' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
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
    objective: 'Walk through the "Validate rules" screen the way its main use case describes it: analyst selects a rule (one created by this case) and requests validation against generated pain.001 data; the service evaluates the condition and reports measurements.',
    description: 'Main flow of UC-ruleBenchValidate (Validate rules): analyst selects a rule (one created by this case) and requests validation against generated pain.001 data; the service evaluates the condition and reports measurements. Touches POST /api/v1/rules/:id/validate.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; pain.001.001.09 message type seeded.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-validate.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchValidate"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-VAL-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 1 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule that matches almost everything' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 20, seed: 'TE-UC-VAL-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'cases', equals: 20 }, { path: 'triggered', min: 1 }, { path: 'passRate', min: 1 }, { path: 'result', matches: '^(passed|warning)$' }, { path: 'rule.id', equals: '{{rule_id}}' }, { path: 'rule.last_validation_json.cases', equals: 20 }, { path: 'rule.last_validated_at', exists: true }], description: 'validate against generated data: 20 messages are judged and the rule fires (passed, or warning when it fires on every message)' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
    tags: ['usecase', 'sand-bench', 'main-flow', 'ruleBenchValidate'],
    dataProfile: { profile: 'synthetic-generated', data: '20 generated pain.001.001.09 messages evaluated against a near-always-true amount_gte(instdAmt, 1) rule.', source: 'Generated per run via the same generator the API uses internally.' },
    expected: '200 with a validation result and coverage percentage.',
  },
  {
    key: 'SB-UC-ruleBenchValidate-ALT-1',
    name: 'UC-ruleBenchValidate alt flow 1: A repeat with the same seed supports comparison only when input and rule versions are also unchanged.',
    objective: 'Check an alternative path of "Validate rules": a repeat with the same seed supports comparison only when input and rule versions are also unchanged. Running validate twice with the identical seed against the unchanged rule produces the same coverage both times.',
    description: 'Alternate flow 1 of UC-ruleBenchValidate (Validate rules): "A repeat with the same seed supports comparison only when input and rule versions are also unchanged." Running validate twice with the identical seed against the unchanged rule produces the same coverage both times.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-SEED-{{ts}}', category: 'fraud', severity: 'low', condition: { kind: 'amount_gte', field: 'instdAmt', value: 1 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 10, seed: 'TE-UC-REPEATABLE-SEED' }, expected_status: 200, expect_json: [{ path: 'passRate', exists: true }], save: { coverage_1: 'passRate' }, description: 'first run' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 10, seed: 'TE-UC-REPEATABLE-SEED' }, expected_status: 200, expect_json: [{ path: 'passRate', equals: '{{coverage_1}}' }], description: 'second run, same seed' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'ruleBenchValidate'],
    dataProfile: { profile: 'synthetic-generated', data: 'Two validate calls with the identical seed against the same unchanged rule.', source: 'Generated per run.' },
    expected: 'Both runs report the same coverage.',
  },
  {
    key: 'SB-UC-ruleBenchValidate-ALT-2',
    name: 'UC-ruleBenchValidate alt flow 2: A broader test run is a separate action from the rule validation endpoint.',
    objective: 'Check an alternative path of "Validate rules": a broader test run is a separate action from validating a rule. Validating a rule answers with a validation result for that rule only — it starts no test run and reports no run identity or delivery.',
    description: 'Alternate flow 2 of UC-ruleBenchValidate (Validate rules): "A broader test run is a separate action from the rule validation endpoint." POST /api/v1/rules/:id/validate answers {rule, cases, triggered, passRate, result} (detectionRules.ts validateDetectionRuleAgainstData) with no runId / accepted / delivery fields (those belong to POST /api/v1/runs), and nothing is readable under the rule\'s id in the runs collection (404).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-NORUN-{{ts}}', category: 'fraud', severity: 'low', condition: { kind: 'amount_gte', field: 'instdAmt', value: 1 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 5 }, expected_status: 200, expect_json: [{ path: 'cases', equals: 5 }, { path: 'result', exists: true }, { path: 'rule.id', equals: '{{rule_id}}' }, { path: 'runId', exists: false }, { path: 'accepted', exists: false }, { path: 'delivery', exists: false }], description: 'validate (not a run): the answer is a validation result for the rule and carries no run identity or delivery' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{rule_id}}', headers: BEARER, expected_status: 404, expect_json: [{ path: 'error.code', equals: 'not_found' }], description: 'the runs collection has no record under the rule\'s identity' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'ruleBenchValidate'],
    dataProfile: { profile: 'synthetic-generated', data: 'One rule validation; no run is expected to be created by it.', source: 'Generated per run.' },
    expected: 'Validate succeeds via the rule endpoint, distinct from the runs collection.',
  },
  {
    key: 'SB-UC-ruleBenchValidate-EXC-1',
    name: 'UC-ruleBenchValidate exc flow 1: No cases or unavailable data is not a passed validation.',
    objective: 'Check that "Validate rules" fails safely: a rule that never fires on its sample data is not a passed validation. A rule built to match nothing must be reported as failed, with zero of the twenty sample messages triggering it.',
    description: 'Exception flow 1 of UC-ruleBenchValidate (Validate rules): "No cases or unavailable data is not a passed validation." A condition engineered to match nothing (amount_gte 999999999) must report result "failed" with triggered 0 of cases 20 and passRate 0 — detectionRules.ts classifyValidation: a rule that never fires is a real failure, one that fires on everything is a warning.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-NOHIT-{{ts}}', category: 'fraud', severity: 'low', condition: { kind: 'amount_gte', field: 'instdAmt', value: 999999999 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule that can never match' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 20 }, expected_status: 200, expect_json: [{ path: 'result', equals: 'failed' }, { path: 'cases', equals: 20 }, { path: 'triggered', equals: 0 }, { path: 'passRate', equals: 0 }, { path: 'rule.id', equals: '{{rule_id}}' }, { path: 'rule.last_validation_result', equals: 'failed' }], description: 'validate a never-matching rule' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
    tags: ['usecase', 'sand-bench', 'exception-flow', 'ruleBenchValidate'],
    dataProfile: { profile: 'synthetic-generated', data: '20 generated messages against a rule designed to never trigger.', source: 'Generated per run; the rule is deleted in cleanup.' },
    expected: 'Result "failed" with 0 of 20 messages triggering the rule — never fabricated as "passed".',
  },
  {
    key: 'SB-UC-ruleBenchValidate-EXC-2',
    name: 'UC-ruleBenchValidate exc flow 2: A processing error is distinguished from a correctly detected negative test.',
    objective: 'Check that "Validate rules" fails safely: a processing error is distinguished from a correctly detected negative test. Validating against a nonexistent messageTypeCode must return a clean error, not a fabricated validation result.',
    description: 'Exception flow 2 of UC-ruleBenchValidate (Validate rules): "A processing error is distinguished from a correctly detected negative test." Validating against a nonexistent messageTypeCode must return a clean error, not a fabricated validation result.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER, body: { name: 'TE-UC-RULE-BADTYPE-{{ts}}', category: 'fraud', severity: 'low', condition: { kind: 'amount_gte', field: 'instdAmt', value: 1 } }, expected_status: 200, save: { rule_id: 'id' }, description: 'create a rule' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules/{{rule_id}}/validate', headers: BEARER, body: { messageTypeCode: 'not.a.real.type', count: 5 }, expected_status: 404, expect_json: [{ path: 'error.code', equals: 'not_found' }, { path: 'error.message', equals: 'Message type not found' }, { path: 'error.details.requestId', exists: true }, { path: 'result', exists: false }], description: 'validate against an unknown message type' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules/{{rule_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.last_validation_result', equals: null }, { path: 'data.last_validated_at', equals: null }], description: 'the rule carries no validation result from the failed attempt' },
    ],
    cleanupSteps: cleanupRule('rule_id'),
    tags: ['usecase', 'sand-bench', 'exception-flow', 'ruleBenchValidate'],
    dataProfile: { profile: 'negative', data: 'An unknown messageTypeCode.', source: 'The rule is created by this case and deleted in cleanup.' },
    expected: '404 not_found "Message type not found"; no validation result is returned or stored on the rule.',
  }
);

export const SANDBENCH_USECASE_FLOW_CASES_BATCH2A: CaseDef[] = C;

