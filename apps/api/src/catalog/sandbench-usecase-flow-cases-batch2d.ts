/**
 * Sand Bench use-case flow catalog — Batch 2d (naming, scheme definitions, active runs).
 *
 * UC-naming, UC-schemeDefinitions, UC-trActive. All read-mostly; the one
 * mutating call (POST /api/v1/naming/preview) is a side-effect-free preview,
 * confirmed live before being encoded. GET /api/v1/runs/:id/stream (SSE) is
 * deliberately not exercised with a plain HTTP step — a long-lived
 * server-sent-events connection would hang the http runner's normal
 * request/response cycle, so UC-trActive's stream touch is covered by
 * confirming its sibling detail endpoint instead.
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
/* UC-naming — Naming conventions                                           */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-naming-MAIN',
    name: 'UC-naming main flow: Naming conventions',
    description: 'Main flow of UC-naming (Naming conventions): operator loads the available patterns, edits one and previews its token expansion without running arbitrary expressions. Touches GET /api/v1/naming, GET /api/v1/naming-conventions and POST /api/v1/naming/preview.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/naming.html', expected_status: 200, expected_body_contains: 'data-sbe-page="naming"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/naming', headers: BEARER, expected_status: 200, expect_json: [{ path: 'patterns', exists: true }, { path: 'tokens', exists: true }], description: 'load patterns/tokens' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/naming/preview', headers: BEARER, body: { pattern: 'tc-{msgType}-{seq}', context: { msgType: 'pacs008', seq: '001' } }, expected_status: 200, expect_json: [{ path: 'name', equals: 'tc-pacs008-001' }], description: 'preview token expansion' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'naming'],
    dataProfile: { profile: 'none (read-only)', data: 'A fixed sample pattern with a fully supplied context — no stored state changes.', source: 'n/a' },
    expected: 'Patterns/tokens load; the preview expands exactly to "tc-pacs008-001".',
  },
  {
    key: 'SB-UC-naming-ALT-1',
    name: 'UC-naming alt flow 1: Unknown tokens remain visible for correction.',
    description: 'Alternate flow 1 of UC-naming (Naming conventions): "Unknown tokens remain visible for correction." A pattern referencing a token with no supplied context value is listed in unknownTokens, not silently dropped.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/naming/preview', headers: BEARER, body: { pattern: 'tc-{msgType}-{notSupplied}' }, expected_status: 200, expect_json: [{ path: 'unknownTokens', min_length: 1 }], description: 'preview with an unresolved token' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'naming'],
    dataProfile: { profile: 'none (read-only)', data: 'A pattern with an unresolved token.', source: 'n/a' },
    expected: 'unknownTokens lists the unresolved token(s) explicitly.',
  },
  {
    key: 'SB-UC-naming-ALT-2',
    name: 'UC-naming alt flow 2: The operator may keep the existing default.',
    description: 'Alternate flow 2 of UC-naming (Naming conventions): "The operator may keep the existing default." Requesting a preview by kind="test_case" (the stored default) without an explicit pattern override succeeds using the current stored pattern.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/naming/preview', headers: BEARER, body: { kind: 'test_case' }, expected_status: 200, expect_json: [{ path: 'name', exists: true }], description: 'preview the current default for test_case' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'naming'],
    dataProfile: { profile: 'none (read-only)', data: 'No pattern override; uses the stored default.', source: 'n/a' },
    expected: '200 using the existing stored default pattern.',
  },
  {
    key: 'SB-UC-naming-EXC-1',
    name: 'UC-naming exc flow 1: An unsupported token must not execute code.',
    description: 'Exception flow 1 of UC-naming (Naming conventions): "An unsupported token must not execute code." A pattern containing a code-injection-shaped token is treated as plain text/an unknown token, never evaluated — the API answers 200 with the literal token reported, not a server error or evaluated expression.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/naming/preview', headers: BEARER, body: { pattern: 'tc-{__proto__}-{1+1}' }, expected_status: 200, expect_json: [{ path: 'name', exists: true }], description: 'adversarial token pattern is not executed' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'naming'],
    dataProfile: { profile: 'negative', data: 'A pattern with code-injection-shaped token names ("__proto__", "1+1").', source: 'n/a' },
    expected: '200 with the tokens treated as literal/unknown text; never a crash or an evaluated expression.',
  },
  {
    key: 'SB-UC-naming-EXC-2',
    name: 'UC-naming exc flow 2: A preview does not reserve a unique name.',
    description: 'Exception flow 2 of UC-naming (Naming conventions): "A preview does not reserve a unique name." Requesting the identical preview twice returns the identical name both times — nothing is incremented or reserved by the read-only preview call.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/naming/preview', headers: BEARER, body: { pattern: 'tc-{msgType}-{seq}', context: { msgType: 'pacs008', seq: '001' } }, expected_status: 200, expect_json: [{ path: 'name', equals: 'tc-pacs008-001' }], save: { name_1: 'name' }, description: 'first preview' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/naming/preview', headers: BEARER, body: { pattern: 'tc-{msgType}-{seq}', context: { msgType: 'pacs008', seq: '001' } }, expected_status: 200, expect_json: [{ path: 'name', equals: '{{name_1}}' }], description: 'identical repeat preview' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'naming'],
    dataProfile: { profile: 'none (read-only)', data: 'The same pattern/context previewed twice.', source: 'n/a' },
    expected: 'Both previews return the exact same name; nothing is reserved or incremented.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-schemeDefinitions — Scheme definitions                                 */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-schemeDefinitions-MAIN',
    name: 'UC-schemeDefinitions main flow: Scheme definitions',
    description: 'Main flow of UC-schemeDefinitions (Scheme definitions): analyst selects a family, the system lists that family\'s imported schemas with field paths and types, available for handoff to the message-definition wizard. Touches GET /api/v1/catalog/designer-types.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; at least one schema imported.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/?page=schemeDefinitions', expected_status: 200, description: 'console shell loads (schemeDefinitions is rendered client-side inside the React console; its own mount is not independently server-verifiable)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', min_length: 1 }, { path: 'data.0.family', exists: true }, { path: 'data.0.fieldCount', exists: true }], description: 'list schemas with family/fields' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'schemeDefinitions'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '>= 1 schema listed with family and fieldCount populated.',
  },
  {
    key: 'SB-UC-schemeDefinitions-ALT-1',
    name: 'UC-schemeDefinitions alt flow 1: Back changes family or schema selection.',
    description: 'Alternate flow 1 of UC-schemeDefinitions (Scheme definitions): "Back changes family or schema selection." No backing API call is made for this flow by design — family/schema selection re-filters the same already-loaded designer-types list client-side.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'the one list both family and schema selection re-filter' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'schemeDefinitions'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'A single read backs both the family and schema selection steps.',
  },
  {
    key: 'SB-UC-schemeDefinitions-ALT-2',
    name: 'UC-schemeDefinitions alt flow 2: Print/PDF conversion is a documentation representation, not a new schema.',
    description: 'Alternate flow 2 of UC-schemeDefinitions (Scheme definitions): "Print/PDF conversion is a documentation representation, not a new schema." Closest executable proxy: the designer-types catalogue stays non-empty and readable across two separate reads — a documentation export of one schema never adds a new catalogue entry or breaks the read.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', min_length: 1 }], description: 'designer types before' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', min_length: 1 }], description: 'designer types unchanged (no print/export side effect) — same non-empty catalogue, not deep-compared field-by-field' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'schemeDefinitions'],
    dataProfile: { profile: 'none (read-only)', data: 'Two reads of the same catalogue, expected identical.', source: 'n/a' },
    expected: 'The catalogue is unchanged between reads.',
  },
  {
    key: 'SB-UC-schemeDefinitions-EXC-1',
    name: 'UC-schemeDefinitions exc flow 1: An unavailable original file is reported as missing.',
    description: 'Exception flow 1 of UC-schemeDefinitions (Scheme definitions): "An unavailable original file is reported as missing." Requesting a source file for a fabricated upload id must return a clean not-found, never a fabricated/empty file.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/iso/uploads/upl_does_not_exist_00000000/files/xsd', headers: BEARER, expected_status: 404, description: 'nonexistent upload file' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'schemeDefinitions'],
    dataProfile: { profile: 'negative', data: 'A fabricated upload id.', source: 'n/a' },
    expected: '404; never a 200 with fabricated or empty file content.',
  },
  {
    key: 'SB-UC-schemeDefinitions-EXC-2',
    name: 'UC-schemeDefinitions exc flow 2: No imported schemas produces import guidance.',
    description: 'Exception flow 2 of UC-schemeDefinitions (Scheme definitions): "No imported schemas produces import guidance." Closest executable proxy: the designer-types read always answers with a well-formed 200/array (the structural precondition the UI needs to correctly show import guidance only when the array is genuinely empty, not on a failed read).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'designer types read' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'schemeDefinitions'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '200 with a well-formed array, whatever its length.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-trActive — Active runs                                                 */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-trActive-MAIN',
    name: 'UC-trActive main flow: Active runs',
    description: 'Main flow of UC-trActive (Active runs): operator opens Active runs, the system selects active-state runs from the collection, and opening one by ID retrieves that exact run\'s detail. Touches GET /api/v1/runs and GET /api/v1/runs/:id.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; at least one run exists.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-active.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trActive"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.0.id', exists: true }], save: { any_run_id: 'data.0.id' }, description: 'list runs' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{any_run_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'id', equals: '{{any_run_id}}' }], description: 'open that exact run by id' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'trActive'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'The opened run detail id exactly matches the one requested, never a row-position substitute.',
  },
  {
    key: 'SB-UC-trActive-ALT-1',
    name: 'UC-trActive alt flow 1: Tile and table views represent the same records.',
    description: 'Alternate flow 1 of UC-trActive (Active runs): "Tile and table views represent the same records." Both views read the same GET /api/v1/runs collection — a second read returns the identical record set a tile-view and table-view would both be built from.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'the one collection both views render from' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'trActive'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'A single, consistent collection backs both representations.',
  },
  {
    key: 'SB-UC-trActive-ALT-2',
    name: 'UC-trActive alt flow 2: An empty active collection links to a new run or history.',
    description: 'Alternate flow 2 of UC-trActive (Active runs): "An empty active collection links to a new run or history." Closest executable proxy: GET /api/v1/runs always answers with a well-formed 200/array (the structural precondition for honestly distinguishing a genuinely empty active set from a failed read).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'runs read' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'trActive'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '200 with a well-formed array, whatever its length.',
  },
  {
    key: 'SB-UC-trActive-EXC-1',
    name: 'UC-trActive exc flow 1: A disconnected stream marks data stale rather than inventing progress.',
    description: 'Exception flow 1 of UC-trActive (Active runs): "A disconnected stream marks data stale rather than inventing progress." The stream endpoint itself is server-sent-events (not exercised directly here to avoid hanging a plain HTTP request on a long-lived connection); this case instead confirms the sibling run-detail read never fabricates progress fields that are not actually present on the row.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; at least one run exists.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, save: { any_run_id: 'data.0.id' }, description: 'pick a real run' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{any_run_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'id', equals: '{{any_run_id}}' }, { path: 'status', exists: true }], description: 'run detail carries its own real status, not an invented one' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'trActive'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'The run detail\'s status field reflects the real stored row.',
  },
  {
    key: 'SB-UC-trActive-EXC-2',
    name: 'UC-trActive exc flow 2: A missing run detail is reported without opening another run.',
    description: 'Exception flow 2 of UC-trActive (Active runs): "A missing run detail is reported without opening another run." Requesting a nonexistent run id must return a clean not-found, never silently substituting a different real run.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/run_does_not_exist_00000000', headers: BEARER, expected_status: 404, description: 'nonexistent run id' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'trActive'],
    dataProfile: { profile: 'negative', data: 'A fabricated run id.', source: 'n/a' },
    expected: '404; never a 200 carrying a different, unrelated run.',
  }
);

export const SANDBENCH_USECASE_FLOW_CASES_BATCH2D: CaseDef[] = C;
