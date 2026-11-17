/**
 * Sand Bench use-case flow catalog — Batch 2b (more safe, scoped-to-own-data create flows).
 *
 * Covers UC-dsNew, UC-tcNew, UC-trNew, UC-tsAll, UC-tsNew. Request/response
 * shapes were read from the application source at commit a8d72039ae8e
 * (collections.ts, registerTestSuites.ts, registerSpecPersist.ts,
 * registerDatasetItems.ts, liveOps.ts) and probed on staging on 2026-11-13:
 * creating a test case or a dataset answers 200, creating a test suite answers
 * 201, starting a run or a suite run answers 202, and changing or deleting a
 * versioned record needs an If-Match header carrying the record's own "etag"
 * field (412 without it or with a stale one).
 *
 * Three cases here assert the application's documented behaviour and fail on
 * this build because the application answers "Internal error" (500) instead —
 * they are tagged known-defect and must stay red until the application is fixed:
 *   SB-UC-dsNew-ALT-1  adding items to a dataset (collections.ts appendDatasetItems
 *                      runs ALTER TABLE on every request)
 *   SB-UC-tsNew-ALT-2  an empty reorder list (specLifecycle.ts reorderSuiteCases
 *                      throws a plain Error instead of a validation error)
 *   SB-UC-tsNew-EXC-2  an unknown member id (database trigger
 *                      test_suite_case_tenant_integrity, migration 029, is not
 *                      translated into a validation error)
 */
import type { CaseDef } from './types.js';

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { username: '{{username}}', password: '{{password}}' },
  expected_status: 200, save: { token: 'token' },
  description: 'operator login',
};
const BEARER = { authorization: 'Bearer {{token}}' };

/**
 * Cleanup for a record this case created: read its current version, delete it with
 * that version, then confirm the application no longer has it. Every step is skipped
 * when the record was never created. `tolerateGone` is for a record the case itself
 * may already have deleted in its main steps.
 */
function cleanupRecord(collection: 'datasets' | 'test-cases' | 'test-suites', id: string, etagPath: string, label: string, tolerateGone = false) {
  const etag = `${id}_cleanup_etag`;
  const url = `{{api}}/api/v1/${collection}/{{${id}}}`;
  return [
    { action: 'request', method: 'GET', url, headers: BEARER, skip_if_missing: [id], expected_status: tolerateGone ? [200, 404] : 200, save: { [etag]: etagPath }, description: tolerateGone ? `get current ETag for ${id}, if it still exists` : `get current ETag for ${id}` },
    { action: 'request', method: 'DELETE', url, headers: { authorization: 'Bearer {{token}}', 'if-match': `{{${etag}}}` }, skip_if_missing: [id, etag], expected_status: 200, expect_json: [{ path: 'deleted', equals: true }], description: `delete case-owned ${label} ${id}` },
    { action: 'request', method: 'GET', url, headers: BEARER, skip_if_missing: [id], expected_status: 404, description: `verify ${label} ${id} is gone` },
  ];
}

const cleanupDataset = (id: string) => cleanupRecord('datasets', id, 'etag', 'dataset');
const cleanupCase = (id: string) => cleanupRecord('test-cases', id, 'data.etag', 'test case');
/** Pass tolerateGone for a suite the case deletes itself in its main steps. */
const cleanupSuite = (id: string, tolerateGone = false) => cleanupRecord('test-suites', id, 'data.etag', 'suite', tolerateGone);

const C: CaseDef[] = [];

/* ------------------------------------------------------------------------ */
/* UC-dsNew — Create new dataset                                             */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-dsNew-MAIN',
    name: 'UC-dsNew main flow: Create new dataset',
    objective: 'Walk through the "Create new dataset" screen the way its main use case describes it: operator names a dataset, the shell is created, then assemble is requested with a real message type and the materialised result is returned.',
    description: 'Main flow of UC-dsNew (Create new dataset): operator names a dataset, the shell is created, then assemble is requested with a real message type and the materialised result is returned. Touches POST /api/v1/datasets and POST /api/v1/datasets/:id/assemble.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; pain.001.001.09 message type seeded.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/datasets-new.html', expected_status: 200, expected_body_contains: 'data-sbe-page="dsNew"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets', headers: BEARER, body: { name: 'TE-UC-DS-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'id', exists: true }, { path: 'row_count', equals: 0 }], save: { ds_id: 'id' }, description: 'create dataset shell' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets/{{ds_id}}/assemble', headers: BEARER, body: { items: [{ kind: 'definition', ref: 'pain.001.001.09', count: 3 }] }, expected_status: 200, expect_json: [{ path: 'status', equals: 'ready' }, { path: 'count', equals: 3 }], description: 'assemble requested items' },
    ],
    cleanupSteps: cleanupDataset('ds_id'),
    tags: ['usecase', 'sand-bench', 'main-flow', 'dsNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One dataset shell named TE-UC-DS-{{ts}}, assembled with 3 pain.001.001.09 items.', source: 'Generated per run.' },
    expected: 'Shell created with row_count 0; assemble reports status "ready" and the requested count.',
  },
  {
    key: 'SB-UC-dsNew-ALT-1',
    name: 'UC-dsNew alt flow 1: Items can be added after shell creation.',
    objective: 'Check an alternative path of "Create new dataset": items can be added after the empty dataset has been created, and the dataset then lists the added item and its row count. (Currently a known defect: the application fails internally when an item is added, so this test stays red until that is fixed.)',
    description: 'Alternate flow of UC-dsNew (Create new dataset): "Items can be added after shell creation." POST /api/v1/datasets/:id/items with the dataset\'s current etag in If-Match must answer 200 with {id, etag, items, row_count}: the appended item gets id dsi_1 and row_count is the sum of the item counts (collections.ts appendDatasetItems, collectionHelpers.ts mergeDatasetItems). KNOWN APPLICATION DEFECT, re-confirmed on staging 2026-11-13 (commit a8d72039ae8e): the route answers 500 {"error":{"code":"internal"}} for every request that carries an If-Match, because appendDatasetItems runs "ALTER TABLE datasets ADD COLUMN IF NOT EXISTS items" inside the request transaction (collections.ts line 656) and the application\'s database role may not alter the table. The case asserts the documented result and fails until the application is fixed.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets', headers: BEARER, body: { name: 'TE-UC-DS-ITEMS-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'row_count', equals: 0 }], save: { ds_id: 'id', ds_etag: 'etag' }, description: 'create dataset shell' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets/{{ds_id}}/items', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{ds_etag}}' }, body: { items: [{ kind: 'definition', ref: 'pain.001.001.09', count: 1 }] }, expected_status: 200, expect_json: [{ path: 'id', equals: '{{ds_id}}' }, { path: 'items', min_length: 1 }, { path: 'items', max_length: 1 }, { path: 'items.0.id', equals: 'dsi_1' }, { path: 'items.0.kind', equals: 'definition' }, { path: 'items.0.ref', equals: 'pain.001.001.09' }, { path: 'items.0.count', equals: 1 }, { path: 'row_count', equals: 1 }, { path: 'etag', exists: true }], description: 'add one item to the dataset (known defect: the application answers an internal error)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/datasets/{{ds_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'items.0.ref', equals: 'pain.001.001.09' }, { path: 'row_count', equals: 1 }], description: 'reopen the dataset: the added item is stored' },
    ],
    cleanupSteps: cleanupDataset('ds_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'dsNew', 'known-defect'],
    dataProfile: { profile: 'synthetic-named', data: 'One dataset shell, then one item (a pain.001.001.09 definition, count 1) added to it.', source: 'Generated per run; the dataset is deleted in cleanup.' },
    expected: '200 with the item appended as dsi_1 and row_count 1, and the same on reopening. KNOWN DEFECT: the application answers 500 Internal error today, so this case fails.',
  },
  {
    key: 'SB-UC-dsNew-ALT-2',
    name: 'UC-dsNew alt flow 2: Bulk merge is a separate operation with selected source dataset IDs.',
    objective: 'Check an alternative path of "Create new dataset": bulk merge is a separate operation with selected source dataset IDs. Two independently created datasets are merged by id into a new named job.',
    description: 'Alternate flow 2 of UC-dsNew (Create new dataset): "Bulk merge is a separate operation with selected source dataset IDs." Two independently created datasets are merged by id into a new named job.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets', headers: BEARER, body: { name: 'TE-UC-DS-MERGE-A-{{ts}}' }, expected_status: 200, save: { ds_a: 'id' }, description: 'create source dataset A' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets', headers: BEARER, body: { name: 'TE-UC-DS-MERGE-B-{{ts}}' }, expected_status: 200, save: { ds_b: 'id' }, description: 'create source dataset B' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets/bulk/merge', headers: BEARER, body: { ids: ['{{ds_a}}', '{{ds_b}}'], name: 'TE-UC-DS-MERGED-{{ts}}' }, expected_status: 202, expect_json: [{ path: 'job_id', exists: true }, { path: 'sourceIds', min_length: 2 }], description: 'bulk merge the two sources' },
    ],
    cleanupSteps: [...cleanupDataset('ds_a'), ...cleanupDataset('ds_b')],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'dsNew'],
    dataProfile: { profile: 'synthetic-named', data: 'Two uniquely named source datasets merged by id into a third named job.', source: 'Generated per run.' },
    expected: '202 with a job_id and both source ids reflected.',
    atomicityNote: { reason: 'tests-interaction', detail: 'Bulk-merge is defined as combining ≥2 source dataset ids; the two creates are the minimum material the merge contract needs.' },
  },
  {
    key: 'SB-UC-dsNew-EXC-1',
    name: 'UC-dsNew exc flow 1: Blank names are rejected.',
    objective: 'Check that "Create new dataset" fails safely: blank names are rejected. POST with an empty/blank name must fail validation, not create an unnamed shell.',
    description: 'Exception flow 1 of UC-dsNew (Create new dataset): "Blank names are rejected." POST with an empty/blank name must fail validation, not create an unnamed shell.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets', headers: BEARER, body: { name: '   ' }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'blank name rejected' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'dsNew'],
    dataProfile: { profile: 'negative', data: 'A whitespace-only name.', source: 'n/a' },
    expected: '422 validation_failed; no dataset row is created.',
  },
  {
    key: 'SB-UC-dsNew-EXC-2',
    name: 'UC-dsNew exc flow 2: Shell creation may have succeeded even when later assembly fails; report each result separately.',
    objective: 'Check that "Create new dataset" fails safely: shell creation may have succeeded even when later assembly fails; report each result separately. The shell create succeeds (a successful answer) while a subsequent assemble call with an invalid item kind fails cleanly (a validation refusal) — the two outcomes are independent, never conflated.',
    description: 'Exception flow 2 of UC-dsNew (Create new dataset): "Shell creation may have succeeded even when later assembly fails; report each result separately." The shell create succeeds (200) while a subsequent assemble call with an invalid item kind fails cleanly (422) — the two outcomes are independent, never conflated.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets', headers: BEARER, body: { name: 'TE-UC-DS-PARTIAL-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'id', exists: true }], save: { ds_id: 'id' }, description: 'shell create succeeds' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets/{{ds_id}}/assemble', headers: BEARER, body: { items: [{ kind: 'not-a-real-kind', ref: 'x', count: 1 }] }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }, { path: 'error.details.items', equals: 'invalid_item' }, { path: 'error.details.requestId', exists: true }], description: 'assemble with invalid kind fails independently' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/datasets/{{ds_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'id', equals: '{{ds_id}}' }, { path: 'row_count', equals: 0 }], description: 'the shell still exists, empty: the failed assembly did not remove or fill it' },
    ],
    cleanupSteps: cleanupDataset('ds_id'),
    tags: ['usecase', 'sand-bench', 'exception-flow', 'dsNew'],
    dataProfile: { profile: 'negative', data: 'A real shell, then an assemble call with a bad item kind.', source: 'Generated per run.' },
    expected: 'Shell creation 200; assembly 422 — each reported on its own, neither implying the other.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-tcNew — New test case                                                  */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-tcNew-MAIN',
    name: 'UC-tcNew main flow: New test case',
    objective: 'Walk through the "New test case" screen the way its main use case describes it: analyst enters a distinct name and objective, saves, and the application service returns the case identity.',
    description: 'Main flow of UC-tcNew (New test case): analyst enters a distinct name and objective, saves, and the API returns the case identity. Touches POST /api/v1/test-cases.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-case-form.html', expected_status: 200, expected_body_contains: 'data-sbe-page="tcNew"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: 'TE-UC-TC-{{ts}}', objective: 'Confirm amount-over-threshold is flagged.' }, expected_status: 200, expect_json: [{ path: 'id', exists: true }, { path: 'name', equals: 'TE-UC-TC-{{ts}}' }], save: { case_id: 'id' }, description: 'create test case' },
    ],
    cleanupSteps: cleanupCase('case_id'),
    tags: ['usecase', 'sand-bench', 'main-flow', 'tcNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One test case named TE-UC-TC-{{ts}} with an objective, no dataset.', source: 'Generated per run.' },
    expected: '200 with id and the exact name supplied.',
  },
  {
    key: 'SB-UC-tcNew-ALT-1',
    name: 'UC-tcNew alt flow 1: A case may be saved without a dataset under the current API.',
    objective: 'Check an alternative path of "New test case": a case may be saved without a dataset under the current application service. Confirmed by the main flow case above already omitting datasetId — this case re-states it with an explicit assertion that datasetId stays unset.',
    description: 'Alternate flow 1 of UC-tcNew (New test case): "A case may be saved without a dataset under the current API." Confirmed by the main flow case above already omitting datasetId — this case re-states it with an explicit assertion that datasetId stays unset.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: 'TE-UC-TC-NODATASET-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'id', exists: true }, { path: 'dataset_id', exists: false }], save: { case_id: 'id' }, description: 'create without a dataset' },
    ],
    cleanupSteps: cleanupCase('case_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'tcNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One test case with no datasetId.', source: 'Generated per run.' },
    expected: '200; dataset_id stays absent, not substituted.',
  },
  {
    key: 'SB-UC-tcNew-ALT-2',
    name: 'UC-tcNew alt flow 2: The describe endpoint supplies a suggestion for analyst review, not a proven assertion.',
    objective: 'Check an alternative path of "New test case": the describe endpoint supplies a suggestion for analyst review, not a proven assertion. the matching write returns a suggested objective string the analyst can accept or edit — it never itself creates a test case.',
    description: 'Alternate flow 2 of UC-tcNew (New test case): "The describe endpoint supplies a suggestion for analyst review, not a proven assertion." POST /api/v1/test-cases/describe returns a suggested objective string the analyst can accept or edit — it never itself creates a test case.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases/describe', headers: BEARER, body: { objective: 'amount over threshold is flagged' }, expected_status: 200, expect_json: [{ path: 'objective', exists: true }], description: 'request a describe suggestion' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'tcNew'],
    dataProfile: { profile: 'none (read-only)', data: 'One describe request; no test case is created by it.', source: 'n/a' },
    expected: '200 with a suggested objective string, distinct from case creation.',
  },
  {
    key: 'SB-UC-tcNew-EXC-1',
    name: 'UC-tcNew exc flow 1: Blank name is rejected by createCase.',
    objective: 'Check that "New test case" fails safely: blank name is rejected by createCase. POST with a blank name must fail validation.',
    description: 'Exception flow 1 of UC-tcNew (New test case): "Blank name is rejected by createCase." POST with a blank name must fail validation.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: '' }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'blank name rejected' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'tcNew'],
    dataProfile: { profile: 'negative', data: 'An empty name.', source: 'n/a' },
    expected: '422 validation_failed; no case row is created.',
  },
  {
    key: 'SB-UC-tcNew-EXC-2',
    name: 'UC-tcNew exc flow 2: A failed or uncertain save must not be displayed as a confirmed test-case creation.',
    objective: 'Check that "New test case" fails safely: a failed or uncertain save must not be displayed as a confirmed test-case creation. A rejected create (blank name) returns no id at all — there is no identity to mistake for a confirmed creation.',
    description: 'Exception flow 2 of UC-tcNew (New test case): "A failed or uncertain save must not be displayed as a confirmed test-case creation." A rejected create (blank name) returns no id at all — there is no identity to mistake for a confirmed creation.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: '' }, expected_status: 422, expect_json: [{ path: 'id', exists: false }], description: 'rejected create carries no id' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'tcNew'],
    dataProfile: { profile: 'negative', data: 'An empty name.', source: 'n/a' },
    expected: '422 with no id field present anywhere in the error body.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-trNew — New test run                                                   */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-trNew-MAIN',
    name: 'UC-trNew main flow: New test run',
    objective: 'Walk through the "New test run" screen the way its main use case describes it: operator chooses message type, count and channel, submits once, and the engine generates/sends data and reports totals plus an evaluation result.',
    description: 'Main flow of UC-trNew (New test run): operator chooses message type, count and channel, submits once, and the engine generates/sends data and reports totals plus an evaluation result. Touches POST /api/v1/runs.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; pain.001.001.09 message type seeded.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-new.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trNew"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 3, channel: 'api', seed: 'TE-UC-TRNEW-{{ts}}' }, expected_status: 202, expect_json: [{ path: 'accepted', equals: true }, { path: 'runId', exists: true }, { path: 'generated', equals: 3 }, { path: 'delivery', exists: true }, { path: 'report', exists: true }], description: 'start run' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'trNew'],
    dataProfile: { profile: 'synthetic-iso20022', data: '3 generated pain.001.001.09 messages on the api channel, unique seed TE-UC-TRNEW-{{ts}}.', source: 'Generated per run by the engine itself.' },
    expected: '202 accepted=true with runId, generated=3, delivery and report populated.',
  },
  {
    key: 'SB-UC-trNew-ALT-1',
    name: 'UC-trNew alt flow 1: The current channel default is file.',
    objective: 'Check an alternative path of "New test run": the current channel default is file. Submitting a run without an explicit channel falls back to "file", not an unconfigured default.',
    description: 'Alternate flow 1 of UC-trNew (New test run): "The current channel default is file." Submitting a run without an explicit channel falls back to "file", not an unconfigured default.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 1, seed: 'TE-UC-TRNEW-NOCHAN-{{ts}}' }, expected_status: 202, expect_json: [{ path: 'accepted', equals: true }, { path: 'delivery.results.0.channel', equals: 'file' }], description: 'start run with no explicit channel' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'trNew'],
    dataProfile: { profile: 'synthetic-iso20022', data: '1 generated message with no channel specified.', source: 'Generated per run.' },
    expected: 'The resulting delivery defaults to channel "file".',
  },
  {
    key: 'SB-UC-trNew-ALT-2',
    name: 'UC-trNew alt flow 2: Boundary, injection, oversized or malformed generation is an explicit security test choice.',
    objective: 'Check an alternative path of "New test run": boundary, injection, oversized or malformed generation is an explicit security test choice. A run explicitly requesting securityKind="boundary" is accepted as a distinct, named generation mode.',
    description: 'Alternate flow 2 of UC-trNew (New test run): "Boundary, injection, oversized or malformed generation is an explicit security test choice." A run explicitly requesting securityKind="boundary" is accepted as a distinct, named generation mode.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 1, channel: 'api', securityKind: 'boundary', seed: 'TE-UC-TRNEW-SEC-{{ts}}' }, expected_status: 202, expect_json: [{ path: 'accepted', equals: true }], description: 'explicit boundary security generation' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'trNew'],
    dataProfile: { profile: 'boundary', data: '1 boundary-profile generated message, an explicit security test choice.', source: 'Generated per run.' },
    expected: '202 accepted=true for an explicitly requested boundary generation.',
  },
  {
    key: 'SB-UC-trNew-EXC-1',
    name: 'UC-trNew exc flow 1: Missing messageTypeCode is rejected.',
    objective: 'Check that "New test run" fails safely: missing messageTypeCode is rejected. POST with no messageTypeCode must fail cleanly, not run against an invented default type.',
    description: 'Exception flow 1 of UC-trNew (New test run): "Missing messageTypeCode is rejected." POST with no messageTypeCode must fail cleanly, not run against an invented default type.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER, body: { count: 1, channel: 'api' }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }, { path: 'error.message', equals: 'messageTypeCode is required' }, { path: 'error.details.requestId', exists: true }, { path: 'runId', exists: false }], description: 'missing messageTypeCode' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'trNew'],
    dataProfile: { profile: 'negative', data: 'A run request missing messageTypeCode.', source: 'n/a' },
    expected: '422 validation_failed "messageTypeCode is required"; no run is generated and no run id is returned.',
  },
  {
    key: 'SB-UC-trNew-EXC-2',
    name: 'UC-trNew exc flow 2: The current persistence fallback can return a local ID; this is not proof of a durable run record.',
    objective: 'Check that "New test run" fails safely: the current persistence fallback can return a local ID; this is not proof of a durable run record. The returned runId is independently checked against the matching read — a real persisted row, not merely an echoed client-side id.',
    description: 'Exception flow 2 of UC-trNew (New test run): "The current persistence fallback can return a local ID; this is not proof of a durable run record." The returned runId is independently checked against GET /api/v1/runs/:id — a real persisted row, not merely an echoed client-side id.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 1, channel: 'api', seed: 'TE-UC-TRNEW-DURABLE-{{ts}}' }, expected_status: 202, save: { new_run_id: 'runId' }, description: 'start run' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{new_run_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'id', equals: '{{new_run_id}}' }], description: 'read it back by id' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'trNew'],
    dataProfile: { profile: 'synthetic-iso20022', data: 'One run, read back by its returned id.', source: 'Generated per run.' },
    expected: 'The returned runId is independently readable — a real persisted row.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-tsNew — New test suite                                                 */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-tsNew-MAIN',
    name: 'UC-tsNew main flow: New test suite',
    objective: 'Walk through the "New test suite" screen the way its main use case describes it: this case creates a temporary member case, creates a suite, sets membership, and reopens it to confirm the stored link.',
    description: 'Main flow of UC-tsNew (New test suite): this case creates a temporary member case, creates a suite, sets membership, and reopens it to confirm the stored link.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-suite-form.html', expected_status: 200, expected_body_contains: 'data-sbe-page="tsNew"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: 'TE-UC-TS-MEMBER-{{ts}}', objective: 'Temporary member created by this suite test.' }, expected_status: 200, save: { member_case_id: 'id' }, description: 'create this case\'s temporary member case' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TS-{{ts}}' }, expected_status: 201, expect_json: [{ path: 'id', exists: true }], save: { suite_id: 'id' }, description: 'create suite' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}/cases', headers: BEARER, body: { case_ids: ['{{member_case_id}}'] }, expected_status: 200, expect_json: [{ path: 'case_ids.0', equals: '{{member_case_id}}' }], description: 'set membership' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-suites/{{suite_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.case_ids.0', equals: '{{member_case_id}}' }], description: 'reopen and verify stored membership' },
    ],
    cleanupSteps: [...cleanupSuite('suite_id'), ...cleanupCase('member_case_id')],
    tags: ['usecase', 'sand-bench', 'main-flow', 'tsNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One temporary member case and a suite containing it; both are deleted after the case.', source: 'Created by this case; cleanup deletes the suite, then its member case.' },
    expected: 'Suite created; membership set and confirmed on reopen.',
  },
  {
    key: 'SB-UC-tsNew-ALT-1',
    name: 'UC-tsNew alt flow 1: An empty suite can be created as an incomplete grouping.',
    objective: 'Check an alternative path of "New test suite": an empty suite can be created as an incomplete grouping. A suite created with no caseIds is accepted with zero members, not rejected.',
    description: 'Alternate flow 1 of UC-tsNew (New test suite): "An empty suite can be created as an incomplete grouping." A suite created with no caseIds is accepted with zero members, not rejected.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TS-EMPTY-{{ts}}' }, expected_status: 201, expect_json: [{ path: 'id', exists: true }], save: { suite_id: 'id' }, description: 'create empty suite' },
    ],
    cleanupSteps: cleanupSuite('suite_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'tsNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One suite with no case members.', source: 'Generated per run.' },
    expected: '200 with an id; an empty grouping is a valid suite.',
  },
  {
    key: 'SB-UC-tsNew-ALT-2',
    name: 'UC-tsNew alt flow 2: Later membership/order changes use the supported suite APIs.',
    objective: 'Check an alternative path of "New test suite": later membership and order changes use the supported suite operations. Reordering puts the named member first and keeps the others after it, replacing the membership needs the suite\'s current version, and an empty reorder list is refused with a clear validation message. (Currently a known defect: the empty list makes the application fail internally instead of refusing it, so this test stays red until that is fixed.)',
    description: 'Alternate flow 2 of UC-tsNew (New test suite): "Later membership or order changes use the supported suite APIs: PUT /api/v1/test-suites/:id/cases (body case_ids) puts the named cases first in that order and keeps any current member it does not name after them (duplicates collapse, an empty list is refused …), and PUT /api/v1/test-suites/:id (name and caseIds, If-Match) renames the suite and replaces its membership." Verified against registerSpecPersist.ts / specLifecycle.ts reorderSuiteCases and collections.ts updateSuite. KNOWN APPLICATION DEFECT, re-confirmed on staging 2026-11-13 (commit a8d72039ae8e): PUT …/cases with case_ids [] answers 500 {"error":{"code":"internal"}} — reorderSuiteCases throws a plain Error("case_ids is required") that the route does not turn into the validation error it uses for a missing case_ids. The last step asserts the documented refusal (422 validation_failed "case_ids is required") and fails until the application is fixed.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: 'TE-UC-TS-REORDER-MEMBER-A-{{ts}}' }, expected_status: 200, save: { member_a_id: 'id' }, description: 'create this case\'s first temporary member case (A)' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: 'TE-UC-TS-REORDER-MEMBER-B-{{ts}}' }, expected_status: 200, save: { member_b_id: 'id' }, description: 'create this case\'s second temporary member case (B)' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TS-REORDER-{{ts}}', caseIds: ['{{member_a_id}}', '{{member_b_id}}'] }, expected_status: 201, save: { suite_id: 'id' }, description: 'create suite with members A then B' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}/cases', headers: BEARER, body: { case_ids: ['{{member_b_id}}'] }, expected_status: 200, expect_json: [{ path: 'id', equals: '{{suite_id}}' }, { path: 'case_ids.0', equals: '{{member_b_id}}' }, { path: 'case_ids.1', equals: '{{member_a_id}}' }, { path: 'case_ids', max_length: 2 }], description: 'reorder: B is named, so B comes first and A is kept after it' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-suites/{{suite_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.case_ids.0', equals: '{{member_b_id}}' }, { path: 'data.case_ids.1', equals: '{{member_a_id}}' }], save: { suite_etag: 'data.etag' }, description: 'reopen: the new order is stored; note the suite\'s current version' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{suite_etag}}' }, body: { caseIds: ['{{member_a_id}}'] }, expected_status: 200, expect_json: [{ path: 'data.case_ids.0', equals: '{{member_a_id}}' }, { path: 'data.case_ids', max_length: 1 }, { path: 'data.name', equals: 'TE-UC-TS-REORDER-{{ts}}' }], description: 'replace the membership with A only, quoting the current version' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}/cases', headers: BEARER, body: { case_ids: [] }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }, { path: 'error.message', equals: 'case_ids is required' }], description: 'an empty reorder list is refused (known defect: the application answers an internal error)' },
    ],
    cleanupSteps: [...cleanupSuite('suite_id'), ...cleanupCase('member_a_id'), ...cleanupCase('member_b_id')],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'tsNew', 'known-defect'],
    dataProfile: { profile: 'synthetic-named', data: 'Two temporary member cases and one suite holding them; the suite is reordered, its membership replaced, then an empty reorder list is sent.', source: 'Created by this case with unique per-run names; cleanup deletes the suite, then both member cases.' },
    expected: 'Reorder answers 200 with B then A; replacing the membership with the current version answers 200 with A only; an empty reorder list answers 422 validation_failed. KNOWN DEFECT: the empty list answers 500 Internal error today, so this case fails at its last step.',
    atomicityNote: { reason: 'tests-interaction', detail: 'Reordering is only observable with two members, so the case creates two temporary test cases; both are deleted in cleanup.' },
  },
  {
    key: 'SB-UC-tsNew-EXC-1',
    name: 'UC-tsNew exc flow 1: Blank name is rejected.',
    objective: 'Check that "New test suite" fails safely: blank name is rejected. POST with an empty name must fail, not create an unnamed suite.',
    description: 'Exception flow 1 of UC-tsNew (New test suite): "Blank name is rejected." POST with an empty name must fail, not create an unnamed suite.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: '' }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'blank name rejected' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'tsNew'],
    dataProfile: { profile: 'negative', data: 'An empty name.', source: 'n/a' },
    expected: '422 validation_failed; no suite row is created.',
  },
  {
    key: 'SB-UC-tsNew-EXC-2',
    name: 'UC-tsNew exc flow 2: Unknown member IDs or duplicate entries need an explicit result rather than silent loss.',
    objective: 'Check that "New test suite" fails safely: duplicate or unknown members get an explicit result rather than being lost silently. A member named twice is kept once, and a member that does not exist is refused with a clear validation message while the suite keeps its real member. (Currently a known defect: the unknown member makes the application fail internally instead of refusing it, so this test stays red until that is fixed.)',
    description: 'Exception flow 2 of UC-tsNew (New test suite): "Unknown member IDs or duplicate entries need an explicit result rather than silent loss." Duplicates: PUT /api/v1/test-suites/:id/cases collapses a repeated id (specLifecycle.ts reorderSuiteCases) and answers 200 with it once. Unknown id: the database refuses a suite member that is not a live test case of the tenant (trigger test_suite_case_tenant_integrity, db/migrations/029_tenant_reference_integrity.sql, SQLSTATE 23514); the explicit result the flow calls for is the API\'s validation refusal (422 validation_failed, kernel/errors.ts). KNOWN APPLICATION DEFECT, re-confirmed on staging 2026-11-13 (commit a8d72039ae8e): the route (registerSpecPersist.ts) does not translate the trigger\'s refusal and answers 500 {"error":{"code":"internal"}}. Note that UC-tsNew alternate flow 2 says such an id "is added without checking that the case exists" — that does not happen either. The case asserts the refusal and fails until the application is fixed.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: 'TE-UC-TS-UNKNOWN-MEMBER-{{ts}}' }, expected_status: 200, save: { member_case_id: 'id' }, description: 'create this case\'s temporary member case' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TS-UNKNOWN-{{ts}}' }, expected_status: 201, save: { suite_id: 'id' }, description: 'create suite' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}/cases', headers: BEARER, body: { case_ids: ['{{member_case_id}}', '{{member_case_id}}'] }, expected_status: 200, expect_json: [{ path: 'case_ids.0', equals: '{{member_case_id}}' }, { path: 'case_ids', max_length: 1 }], description: 'name the same member twice: it is kept once' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}/cases', headers: BEARER, body: { case_ids: ['tc_does_not_exist_00000000'] }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'name a member that does not exist: refused (known defect: the application answers an internal error)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-suites/{{suite_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.case_ids.0', equals: '{{member_case_id}}' }, { path: 'data.case_ids', max_length: 1 }], description: 'reopen: the suite still holds only its real member' },
    ],
    cleanupSteps: [...cleanupSuite('suite_id'), ...cleanupCase('member_case_id')],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'tsNew', 'known-defect'],
    dataProfile: { profile: 'negative', data: 'One temporary member case and one suite; a reorder naming the member twice, then one naming a case id that does not exist.', source: 'Created by this case with unique per-run names; cleanup deletes the suite, then the member case.' },
    expected: 'The duplicate answers 200 with the member once; the unknown id answers 422 validation_failed and the suite is unchanged. KNOWN DEFECT: the unknown id answers 500 Internal error today, so this case fails at that step.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-tsAll — Test Suites (inspect / run / delete)                           */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-tsAll-MAIN',
    name: 'UC-tsAll main flow: Test Suites',
    objective: 'Walk through the "Test Suites" screen the way its main use case describes it: analyst opens Test Suites, inspects a suite\'s member case IDs, requests a supported run, and the application service reports the specific request result (not just acceptance).',
    description: 'Main flow of UC-tsAll (Test Suites): analyst opens Test Suites, inspects a suite\'s member case IDs, requests a supported run, and the API reports the specific request result (not just acceptance). Touches GET /api/v1/test-suites and POST /api/v1/test-suites/:id/run.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-suites.html', expected_status: 200, expected_body_contains: 'data-sbe-page="testSuitesDesk"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TSALL-{{ts}}' }, expected_status: 201, save: { suite_id: 'id' }, description: 'create a suite to run (own data, not a shared one)' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites/{{suite_id}}/run', headers: BEARER, expected_status: 202, expect_json: [{ path: 'accepted', equals: true }, { path: 'suiteId', equals: '{{suite_id}}' }, { path: 'outcome.suiteId', equals: '{{suite_id}}' }, { path: 'outcome.ranCases', equals: 0 }, { path: 'outcome.passed', equals: 0 }, { path: 'outcome.failed', equals: 0 }, { path: 'outcome.runs', max_length: 0 }], description: 'request a run of it' },
    ],
    cleanupSteps: cleanupSuite('suite_id'),
    tags: ['usecase', 'sand-bench', 'main-flow', 'tsAll'],
    dataProfile: { profile: 'synthetic-named', data: 'One empty suite we create ourselves, then run (zero cases, so a trivially-complete run).', source: 'Generated per run.' },
    expected: '202 accepted=true with a specific per-case outcome, not a bare acknowledgement.',
  },
  {
    key: 'SB-UC-tsAll-ALT-1',
    name: 'UC-tsAll alt flow 1: An empty suite remains visible with zero members.',
    objective: 'Check an alternative path of "Test Suites": an empty suite remains visible with zero members. A newly created empty suite is independently readable with case_ids length 0, not hidden from the listing.',
    description: 'Alternate flow 1 of UC-tsAll (Test Suites): "An empty suite remains visible with zero members." A newly created empty suite is independently readable with case_ids length 0, not hidden from the listing.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TSALL-EMPTY-{{ts}}' }, expected_status: 201, save: { suite_id: 'id' }, description: 'create an empty suite' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-suites/{{suite_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.id', equals: '{{suite_id}}' }], description: 'it is independently readable' },
    ],
    cleanupSteps: cleanupSuite('suite_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'tsAll'],
    dataProfile: { profile: 'synthetic-named', data: 'One empty suite, read back by id.', source: 'Generated per run.' },
    expected: 'The empty suite remains visible and readable.',
  },
  {
    key: 'SB-UC-tsAll-ALT-2',
    name: 'UC-tsAll alt flow 2: Deleting a suite removes the grouping, not the test-case definitions.',
    objective: 'Check an alternative path of "Test Suites": deleting a suite removes the grouping, not the test-case definitions.',
    description: 'Alternate flow 2 of UC-tsAll (Test Suites): "Deleting a suite removes the grouping, not the test-case definitions." This case creates a member case, deletes its containing suite, then verifies the case remains independently readable.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: 'TE-UC-TSALL-DEL-MEMBER-{{ts}}' }, expected_status: 200, save: { member_case_id: 'id' }, description: 'create this case\'s temporary member case' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TSALL-DEL-{{ts}}', caseIds: ['{{member_case_id}}'] }, expected_status: 201, save: { suite_id: 'id', suite_etag: 'etag' }, description: 'create a suite containing that case' },
      { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/test-suites/{{suite_id}}', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{suite_etag}}' }, expected_status: 200, expect_json: [{ path: 'deleted', equals: true }], description: 'delete the suite (the grouping, not the case)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-cases/{{member_case_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.id', equals: '{{member_case_id}}' }], description: 'the case still exists' },
    ],
    cleanupSteps: [...cleanupSuite('suite_id', true), ...cleanupCase('member_case_id')],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'tsAll'],
    dataProfile: { profile: 'synthetic-named', data: 'One temporary member case and one suite. The suite is explicitly deleted; cleanup deletes the member case.', source: 'Both resources are created by this case.' },
    expected: 'Suite deletion reports deleted=true; the member case remains fully intact.',
  },
  {
    key: 'SB-UC-tsAll-EXC-1',
    name: 'UC-tsAll exc flow 1: A stale If-Match on update or deletion is rejected.',
    objective: 'Check that "Test Suites" fails safely: a stale If-Match on update or deletion is rejected. Deleting a suite we created, but with a deliberately wrong If-Match, must be rejected with a precondition failure.',
    description: 'Exception flow 1 of UC-tsAll (Test Suites): "A stale If-Match on update or deletion is rejected." Deleting a suite we created, but with a deliberately wrong If-Match, must be rejected with a precondition failure.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TSALL-STALE-{{ts}}' }, expected_status: 201, save: { suite_id: 'id' }, description: 'create a suite' },
      { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/test-suites/{{suite_id}}', headers: { authorization: 'Bearer {{token}}', 'if-match': '"deliberately-stale-etag"' }, expected_status: 412, description: 'stale If-Match on delete is rejected' },
    ],
    cleanupSteps: cleanupSuite('suite_id'),
    tags: ['usecase', 'sand-bench', 'exception-flow', 'tsAll'],
    dataProfile: { profile: 'negative', data: 'A real suite, deleted with a fabricated If-Match.', source: 'Generated per run.' },
    expected: '412 precondition failure; the suite is not deleted.',
  },
  {
    key: 'SB-UC-tsAll-EXC-2',
    name: 'UC-tsAll exc flow 2: A removed member must not be silently counted as an executed case.',
    objective: 'Check that "Test Suites" fails safely: a removed member must not be silently counted as an executed case. A suite is created with one member, the member is removed from the suite, and a run of the suite then reports that no case was run.',
    description: 'Exception flow of UC-tsAll (Test Suites): "A removed member must not be silently counted as an executed case." The member is removed through the supported membership replacement, PUT /api/v1/test-suites/:id with caseIds [] and the suite\'s current etag in If-Match (collections.ts updateSuite); POST /api/v1/test-suites/:id/run must then report outcome.ranCases 0 with no per-case runs. (The reorder route PUT …/cases never removes a member and refuses an empty list — see SB-UC-tsNew-ALT-2 for that route and its known defect.)',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: 'TE-UC-TSALL-REMOVED-MEMBER-{{ts}}' }, expected_status: 200, save: { member_case_id: 'id' }, description: 'create this case\'s temporary member' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TSALL-REMOVED-{{ts}}', caseIds: ['{{member_case_id}}'] }, expected_status: 201, save: { suite_id: 'id', suite_etag: 'etag' }, description: 'create suite with one member' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{suite_etag}}' }, body: { caseIds: [] }, expected_status: 200, expect_json: [{ path: 'data.id', equals: '{{suite_id}}' }, { path: 'data.case_ids', max_length: 0 }], description: 'remove the member: replace the membership with an empty list, quoting the current version' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites/{{suite_id}}/run', headers: BEARER, expected_status: 202, expect_json: [{ path: 'accepted', equals: true }, { path: 'outcome.suiteId', equals: '{{suite_id}}' }, { path: 'outcome.ranCases', equals: 0 }, { path: 'outcome.runs', max_length: 0 }], description: 'run the suite: the removed member is not counted' },
    ],
    cleanupSteps: [...cleanupSuite('suite_id'), ...cleanupCase('member_case_id')],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'tsAll'],
    dataProfile: { profile: 'synthetic-named', data: 'One temporary member case and one suite holding it; the member is removed, then the suite is run.', source: 'Created by this case with unique per-run names; cleanup deletes the suite, then the member case.' },
    expected: 'Removing the member answers 200 with an empty member list; the run answers 202 with ranCases 0 and no per-case runs.',
  }
);

export const SANDBENCH_USECASE_FLOW_CASES_BATCH2B: CaseDef[] = C;
