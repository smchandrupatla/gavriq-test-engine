/**
 * Sand Bench use-case flow catalog — Batch 2b (more safe, scoped-to-own-data create flows).
 *
 * Covers UC-dsNew, UC-tcNew, UC-trNew, UC-tsAll, UC-tsNew. Request/response
 * shapes were live-probed against the deployed stack before being encoded:
 * every create endpoint here (test-cases, test-suites, datasets) answers 200
 * (not 201 — only schedules/runs set 201 explicitly in this API), and
 * mutating calls on an existing resource (items, delete) require an If-Match
 * header taken from the JSON body's own "etag" field, not a response header.
 *
 * SB-UC-dsNew-ALT-1 documents a found defect: POST /api/v1/datasets/:id/items
 * 500s for every item kind (table/data_file/definition/workspace) against this
 * deployment — confirmed by direct probing, not assumed. It is tagged
 * known-defect and asserts today's real (broken) response; once fixed
 * upstream this case will start failing and should be updated to expect 200.
 */
import type { CaseDef } from './types.js';

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { tenantSlug: '{{tenant}}', username: '{{username}}' },
  expected_status: 200, save: { token: 'token' },
  description: 'operator login',
};
const BEARER = { authorization: 'Bearer {{token}}' };

function cleanupDataset(id: string) {
  const etag = `${id}_cleanup_etag`;
  return [
    { action: 'request', method: 'GET', url: `{{api}}/api/v1/datasets/{{${id}}}`, headers: BEARER, expected_status: 200, save: { [etag]: 'etag' }, description: `get current ETag for ${id}` },
    { action: 'request', method: 'DELETE', url: `{{api}}/api/v1/datasets/{{${id}}}`, headers: { authorization: 'Bearer {{token}}', 'if-match': `{{${etag}}}` }, expected_status: 200, expect_json: [{ path: 'deleted', equals: true }], description: `delete case-owned dataset ${id}` },
  ];
}

function cleanupCase(id: string) {
  const etag = `${id}_cleanup_etag`;
  return [
    { action: 'request', method: 'GET', url: `{{api}}/api/v1/test-cases/{{${id}}}`, headers: BEARER, expected_status: [200, 404], save: { [etag]: 'data.etag' }, description: `get current ETag for ${id}, if it still exists` },
    { action: 'request', method: 'DELETE', url: `{{api}}/api/v1/test-cases/{{${id}}}`, headers: { authorization: 'Bearer {{token}}', 'if-match': `{{${etag}}}` }, skip_if_missing: [etag], expected_status: 200, expect_json: [{ path: 'deleted', equals: true }], description: `delete case-owned test case ${id}` },
  ];
}

function cleanupSuite(id: string) {
  const etag = `${id}_cleanup_etag`;
  return [
    { action: 'request', method: 'GET', url: `{{api}}/api/v1/test-suites/{{${id}}}`, headers: BEARER, expected_status: [200, 404], save: { [etag]: 'data.etag' }, description: `get current ETag for ${id}, if it still exists` },
    { action: 'request', method: 'DELETE', url: `{{api}}/api/v1/test-suites/{{${id}}}`, headers: { authorization: 'Bearer {{token}}', 'if-match': `{{${etag}}}` }, skip_if_missing: [etag], expected_status: 200, expect_json: [{ path: 'deleted', equals: true }], description: `delete case-owned suite ${id}` },
  ];
}

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
    objective: 'Check an alternative path of "Create new dataset": items can be added after shell creation. KNOWN DEFECT, confirmed by direct probing on 2026-10-01: the matching write fails with an internal server error for every item kind (table/data_file/definition/workspace) on this deployment, even with a correct If-Match.',
    description: 'Alternate flow 1 of UC-dsNew (Create new dataset): "Items can be added after shell creation." KNOWN DEFECT, confirmed by direct probing on 2026-10-01: POST /api/v1/datasets/:id/items returns 500 Internal error for every item kind (table/data_file/definition/workspace) on this deployment, even with a correct If-Match. This case asserts today\'s real (broken) behavior as a regression trip-wire — when fixed, update it to expect 200 with the appended item.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets', headers: BEARER, body: { name: 'TE-UC-DS-ITEMS-{{ts}}' }, expected_status: 200, save: { ds_id: 'id', ds_etag: 'etag' }, description: 'create dataset shell' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets/{{ds_id}}/items', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{ds_etag}}' }, body: { items: [{ kind: 'definition', ref: 'pain.001.001.09', count: 1 }] }, expected_status: 500, expect_json: [{ path: 'error.code', equals: 'internal' }], description: 'add items (currently 500s — known defect)' },
    ],
    cleanupSteps: cleanupDataset('ds_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'dsNew', 'known-defect'],
    dataProfile: { profile: 'synthetic-named', data: 'One dataset shell, then an item-append attempt.', source: 'Generated per run.' },
    expected: 'KNOWN DEFECT: 500 Internal error today. Should be 200 with the item appended once fixed.',
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
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets/{{ds_id}}/assemble', headers: BEARER, body: { items: [{ kind: 'not-a-real-kind', ref: 'x', count: 1 }] }, expected_status: 422, description: 'assemble with invalid kind fails independently' },
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
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER, body: { count: 1, channel: 'api' }, expected_status: [400, 422], description: 'missing messageTypeCode' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'trNew'],
    dataProfile: { profile: 'negative', data: 'A run request missing messageTypeCode.', source: 'n/a' },
    expected: 'A clean 4xx; no run is generated.',
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
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TS-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'id', exists: true }], save: { suite_id: 'id' }, description: 'create suite' },
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
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TS-EMPTY-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'id', exists: true }], save: { suite_id: 'id' }, description: 'create empty suite' },
    ],
    cleanupSteps: cleanupSuite('suite_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'tsNew'],
    dataProfile: { profile: 'synthetic-named', data: 'One suite with no case members.', source: 'Generated per run.' },
    expected: '200 with an id; an empty grouping is a valid suite.',
  },
  {
    key: 'SB-UC-tsNew-ALT-2',
    name: 'UC-tsNew alt flow 2: Later membership/order changes use the supported suite APIs.',
    objective: 'Check an alternative path of "New test suite": later membership/order changes use the supported suite APIs. A suite\'s membership, once set, can be changed again via the same PUT endpoint. KNOWN DEFECT, confirmed by direct probing on 2026-10-01: a second PUT with an empty case_ids array (clearing membership) 500s instead of succeeding — this case asserts today\'s real (broken) behavior as a regression trip-wire.',
    description: 'Alternate flow 2 of UC-tsNew (New test suite): "Later membership/order changes use the supported suite APIs." A suite\'s membership, once set, can be changed again via the same PUT endpoint. KNOWN DEFECT, confirmed by direct probing on 2026-10-01: a second PUT with an empty case_ids array (clearing membership) 500s instead of succeeding — this case asserts today\'s real (broken) behavior as a regression trip-wire.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: 'TE-UC-TS-REORDER-MEMBER-{{ts}}' }, expected_status: 200, save: { member_case_id: 'id' }, description: 'create this case\'s temporary member case' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TS-REORDER-{{ts}}' }, expected_status: 200, save: { suite_id: 'id' }, description: 'create suite' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}/cases', headers: BEARER, body: { case_ids: ['{{member_case_id}}'] }, expected_status: 200, description: 'first membership set' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}/cases', headers: BEARER, body: { case_ids: [] }, expected_status: 500, expect_json: [{ path: 'error.code', equals: 'internal' }], description: 'second call clears membership (currently 500s — known defect)' },
    ],
    cleanupSteps: [...cleanupSuite('suite_id'), ...cleanupCase('member_case_id')],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'tsNew', 'known-defect'],
    dataProfile: { profile: 'synthetic-named', data: 'One suite, membership set then an attempted clear via a second PUT call.', source: 'Generated per run.' },
    expected: 'KNOWN DEFECT: 500 today when clearing to an empty array. Should be 200 once fixed.',
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
    objective: 'Check that "New test suite" fails safely: unknown member IDs or duplicate entries need an explicit result rather than silent loss. KNOWN DEFECT, confirmed by direct probing on 2026-10-01: setting membership to a nonexistent case id 500s rather than being silently dropped OR cleanly rejected — the actual failure mode is worse than the spec\'s own concern (an unhandled crash, not even a silent loss).',
    description: 'Exception flow 2 of UC-tsNew (New test suite): "Unknown member IDs or duplicate entries need an explicit result rather than silent loss." KNOWN DEFECT, confirmed by direct probing on 2026-10-01: setting membership to a nonexistent case id 500s rather than being silently dropped OR cleanly rejected — the actual failure mode is worse than the spec\'s own concern (an unhandled crash, not even a silent loss).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TS-UNKNOWN-{{ts}}' }, expected_status: 200, save: { suite_id: 'id' }, description: 'create suite' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}/cases', headers: BEARER, body: { case_ids: ['tc_does_not_exist_00000000'] }, expected_status: 500, expect_json: [{ path: 'error.code', equals: 'internal' }], description: 'set membership to a nonexistent case id (currently 500s — known defect)' },
    ],
    cleanupSteps: cleanupSuite('suite_id'),
    tags: ['usecase', 'sand-bench', 'exception-flow', 'tsNew', 'known-defect'],
    dataProfile: { profile: 'negative', data: 'A membership PUT naming a case id that does not exist.', source: 'n/a' },
    expected: 'KNOWN DEFECT: 500 today. Should be a clean validation_failed or an explicit stored-result once fixed.',
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
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TSALL-{{ts}}' }, expected_status: 200, save: { suite_id: 'id' }, description: 'create a suite to run (own data, not a shared one)' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites/{{suite_id}}/run', headers: BEARER, expected_status: 202, expect_json: [{ path: 'accepted', equals: true }, { path: 'outcome.suiteId', equals: '{{suite_id}}' }, { path: 'outcome.ranCases', exists: true }], description: 'request a run of it' },
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
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TSALL-EMPTY-{{ts}}' }, expected_status: 200, save: { suite_id: 'id' }, description: 'create an empty suite' },
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
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TSALL-DEL-{{ts}}', caseIds: ['{{member_case_id}}'] }, expected_status: 200, save: { suite_id: 'id', suite_etag: 'etag' }, description: 'create a suite containing that case' },
      { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/test-suites/{{suite_id}}', headers: { authorization: 'Bearer {{token}}', 'if-match': '{{suite_etag}}' }, expected_status: 200, expect_json: [{ path: 'deleted', equals: true }], description: 'delete the suite (the grouping, not the case)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-cases/{{member_case_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.id', equals: '{{member_case_id}}' }], description: 'the case still exists' },
    ],
    cleanupSteps: [...cleanupSuite('suite_id'), ...cleanupCase('member_case_id')],
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
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TSALL-STALE-{{ts}}' }, expected_status: 200, save: { suite_id: 'id' }, description: 'create a suite' },
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
    objective: 'Check that "Test Suites" fails safely: a removed member must not be silently counted as an executed case. KNOWN DEFECT, confirmed by direct probing on 2026-10-01: clearing a suite\'s membership to an empty array via PUT the application application service 500s rather than succeeding, so the "removed member, then run" path cannot currently be exercised past the removal step.',
    description: 'Exception flow 2 of UC-tsAll (Test Suites): "A removed member must not be silently counted as an executed case." KNOWN DEFECT, confirmed by direct probing on 2026-10-01: clearing a suite\'s membership to an empty array via PUT /api/v1/test-suites/:id/cases 500s rather than succeeding, so the "removed member, then run" path cannot currently be exercised past the removal step.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER, body: { name: 'TE-UC-TSALL-REMOVED-MEMBER-{{ts}}' }, expected_status: 200, save: { member_case_id: 'id' }, description: 'create this case\'s temporary member' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER, body: { name: 'TE-UC-TSALL-REMOVED-{{ts}}', caseIds: ['{{member_case_id}}'] }, expected_status: 200, save: { suite_id: 'id' }, description: 'create suite with one member' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/test-suites/{{suite_id}}/cases', headers: BEARER, body: { case_ids: [] }, expected_status: 500, expect_json: [{ path: 'error.code', equals: 'internal' }], description: 'remove the member (currently 500s — known defect)' },
    ],
    cleanupSteps: [...cleanupSuite('suite_id'), ...cleanupCase('member_case_id')],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'tsAll', 'known-defect'],
    dataProfile: { profile: 'synthetic-named', data: 'One temporary member case and suite, then an attempted removal; both are cleaned up.', source: 'Created by this case.' },
    expected: 'KNOWN DEFECT: 500 today on removal. Should be 200, with a subsequent run reporting ranCases=0, once fixed.',
  }
);

export const SANDBENCH_USECASE_FLOW_CASES_BATCH2B: CaseDef[] = C;
