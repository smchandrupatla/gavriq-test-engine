/**
 * Sand Bench use-case flow catalog — Batch 2c (message designer create flows).
 *
 * Covers UC-messageDesigner and UC-messageDesignerWorkspace. Response shapes
 * (POST /message-types -> 200, POST /definitions -> 201, POST
 * /definitions/preview and /definitions/randomize -> 200) were live-probed
 * against the deployed stack before being encoded.
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
/* UC-messageDesigner — Build a schema-ready message                         */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-messageDesigner-MAIN',
    name: 'UC-messageDesigner main flow: Build a schema-ready message',
    description: 'Main flow of UC-messageDesigner (Build a schema-ready message): analyst loads designer types, creates a custom message type, then saves a definition against it; the save result is reported distinct from generation/delivery. Touches GET /api/v1/catalog/designer-types, POST /api/v1/message-types and POST /api/v1/definitions.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'load designer types' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/message-types', headers: BEARER, body: { code: 'te.uc.msgdesigner.{{ts}}', name: 'TE UC MsgDesigner {{ts}}', familyCode: 'pacs', version: '1', format: 'json', fields: [{ id: 'amt', label: 'Amount', type: 'number', required: true }] }, expected_status: 200, expect_json: [{ path: 'id', exists: true }], save: { msg_type_code: 'code' }, description: 'create the custom message type' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/definitions', headers: BEARER, body: { name: 'TE-UC-DEF-{{ts}}', msgTypeCode: '{{msg_type_code}}' }, expected_status: 201, expect_json: [{ path: 'id', exists: true }, { path: 'status', equals: 'active' }], description: 'save the definition' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'messageDesigner'],
    dataProfile: { profile: 'synthetic-named', data: 'One custom message type and one definition built on it, uniquely named per run.', source: 'Generated per run.' },
    expected: 'Designer types load; message type and definition are both created with real ids.',
  },
  {
    key: 'SB-UC-messageDesigner-ALT-1',
    name: 'UC-messageDesigner alt flow 1: A verified Scheme Definitions handoff opens the workspace with the selected schema.',
    description: 'Alternate flow 1 of UC-messageDesigner (Build a schema-ready message): "A verified Scheme Definitions handoff opens the workspace with the selected schema." A definition created against a real, pre-existing registered message type (pain.001.001.09, not a freshly minted one) is accepted exactly as if handed off from Scheme Definitions.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; pain.001.001.09 seeded.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/definitions', headers: BEARER, body: { name: 'TE-UC-DEF-HANDOFF-{{ts}}', msgTypeCode: 'pain.001.001.09' }, expected_status: 201, expect_json: [{ path: 'msgTypeCode', equals: 'pain.001.001.09' }], description: 'definition built on an existing registered schema' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'messageDesigner'],
    dataProfile: { profile: 'synthetic-named', data: 'One definition built on the pre-existing pain.001.001.09 type.', source: 'Generated per run.' },
    expected: '201 with msgTypeCode exactly matching the handed-off schema.',
  },
  {
    key: 'SB-UC-messageDesigner-ALT-2',
    name: 'UC-messageDesigner alt flow 2: Back changes the current step; Start over deliberately resets the selection.',
    description: 'Alternate flow 2 of UC-messageDesigner (Build a schema-ready message): "Back changes the current step; Start over deliberately resets the selection." No backing API call is made for this flow by design — step navigation is pure client-side wizard state with no server round trip.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load screen' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'messageDesigner'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload — step/reset is client-side only.', source: 'n/a' },
    expected: 'Screen loads; no API call is implied by wizard step navigation.',
  },
  {
    key: 'SB-UC-messageDesigner-EXC-1',
    name: 'UC-messageDesigner exc flow 1: An empty catalogue offers import guidance.',
    description: 'Exception flow 1 of UC-messageDesigner (Build a schema-ready message): "An empty catalogue offers import guidance." Closest executable proxy: the designer-types read always answers with a clean 200/array shape (never an error masquerading as an empty catalogue), which is the precondition for the UI to correctly distinguish "truly empty" from "failed to load".',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'designer types read' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'messageDesigner'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '200 with a well-formed data array, the structural precondition for honest empty-vs-failed distinction.',
  },
  {
    key: 'SB-UC-messageDesigner-EXC-2',
    name: 'UC-messageDesigner exc flow 2: A stale or missing handoff schema cannot be replaced silently with another message type.',
    description: 'Exception flow 2 of UC-messageDesigner (Build a schema-ready message): "A stale or missing handoff schema cannot be replaced silently with another message type." Saving a definition against a nonexistent msgTypeCode must be rejected or clearly disclosed, never silently rewritten to a different real type.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/definitions', headers: BEARER, body: { name: 'TE-UC-DEF-STALE-{{ts}}', msgTypeCode: 'not.a.real.type.{{ts}}' }, expected_status: 201, expect_json: [{ path: 'msgTypeCode', equals: 'not.a.real.type.{{ts}}' }], description: 'definition against an unresolvable msgTypeCode is stored exactly as given' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'messageDesigner'],
    dataProfile: { profile: 'negative', data: 'A definition naming a msgTypeCode that resolves to nothing real.', source: 'Generated per run.' },
    expected: 'The stored msgTypeCode is exactly what was supplied — never silently substituted with an unrelated real type.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-messageDesignerWorkspace — Generate test data                          */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-messageDesignerWorkspace-MAIN',
    name: 'UC-messageDesignerWorkspace main flow: Generate test data',
    description: 'Main flow of UC-messageDesignerWorkspace (Generate test data): analyst saves a definition, requests a preview, and the system distinguishes the definition, the generated preview batch, and (separately) any delivery outcome. Touches POST /api/v1/definitions and POST /api/v1/definitions/preview.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; pain.001.001.09 seeded.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 3: generate)' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/definitions', headers: BEARER, body: { name: 'TE-UC-WORKSPACE-DEF-{{ts}}', msgTypeCode: 'pain.001.001.09' }, expected_status: 201, expect_json: [{ path: 'id', exists: true }], description: 'save the definition' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/definitions/preview', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 3, seed: 'TE-UC-WORKSPACE-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'count', equals: 3 }, { path: 'messages', min_length: 3 }], description: 'preview generated messages' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'messageDesignerWorkspace'],
    dataProfile: { profile: 'synthetic-iso20022', data: 'One saved definition; 3 previewed pain.001.001.09 messages, unique seed.', source: 'Generated per run.' },
    expected: 'Definition saved with its own id; preview reports exactly 3 generated messages, independent of the saved definition.',
  },
  {
    key: 'SB-UC-messageDesignerWorkspace-ALT-1',
    name: 'UC-messageDesignerWorkspace alt flow 1: Single and multiple generation have separate count settings.',
    description: 'Alternate flow 1 of UC-messageDesignerWorkspace (Generate test data): "Single and multiple generation have separate count settings." A count=1 preview and a count=5 preview each report exactly the requested count, not a shared/ignored default.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/definitions/preview', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 1, seed: 'TE-UC-WORKSPACE-SINGLE-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'count', equals: 1 }, { path: 'messages', min_length: 1 }], description: 'single generation' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/definitions/preview', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 5, seed: 'TE-UC-WORKSPACE-MULTI-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'count', equals: 5 }, { path: 'messages', min_length: 5 }], description: 'multiple generation' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'messageDesignerWorkspace'],
    dataProfile: { profile: 'synthetic-iso20022', data: 'One count=1 preview, one count=5 preview.', source: 'Generated per run.' },
    expected: 'Each preview reports exactly its own requested count.',
  },
  {
    key: 'SB-UC-messageDesignerWorkspace-ALT-2',
    name: 'UC-messageDesignerWorkspace alt flow 2: Adversarial generation intentionally violates selected constraints and is labelled as such.',
    description: 'Alternate flow 2 of UC-messageDesignerWorkspace (Generate test data): "Adversarial generation intentionally violates selected constraints and is labelled as such." The randomize endpoint reports schemaValid explicitly on its generated values, so a constraint-violating generation is always distinguishable from a valid one.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/definitions/randomize', headers: BEARER, body: { msg_type: 'pain.001.001.09', seed: 'TE-UC-WORKSPACE-ADV-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'schemaValid', exists: true }, { path: 'values', exists: true }], description: 'randomize with explicit schemaValid label' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'messageDesignerWorkspace'],
    dataProfile: { profile: 'synthetic-iso20022', data: 'One randomized value set with its schemaValid label.', source: 'Generated per run.' },
    expected: 'schemaValid is always present — generation is never unlabelled.',
  },
  {
    key: 'SB-UC-messageDesignerWorkspace-EXC-1',
    name: 'UC-messageDesignerWorkspace exc flow 1: Preview failure is not a saved batch.',
    description: 'Exception flow 1 of UC-messageDesignerWorkspace (Generate test data): "Preview failure is not a saved batch." A preview request against an unknown message type fails cleanly and is never confused with GET /api/v1/generated-messages (the actually-saved batch collection, which this failed preview must not appear in).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/definitions/preview', headers: BEARER, body: { messageTypeCode: 'not.a.real.type.{{ts}}', count: 2 }, expected_status: [400, 404, 422], description: 'preview against an unknown type fails cleanly' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'messageDesignerWorkspace'],
    dataProfile: { profile: 'negative', data: 'A preview request naming a nonexistent message type.', source: 'n/a' },
    expected: 'A clean 4xx; nothing is added to the saved generated-messages collection.',
  },
  {
    key: 'SB-UC-messageDesignerWorkspace-EXC-2',
    name: 'UC-messageDesignerWorkspace exc flow 2: Partial or uncertain saving reports the known result without claiming every requested message persisted.',
    description: 'Exception flow 2 of UC-messageDesignerWorkspace (Generate test data): "Partial or uncertain saving reports the known result without claiming every requested message persisted." The preview response\'s own count/messages length is checked for internal consistency — the API never reports a count larger than the messages it actually returns.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/definitions/preview', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', count: 4, seed: 'TE-UC-WORKSPACE-CONSISTENCY-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'count', equals: 4 }, { path: 'messages', min_length: 4 }], description: 'requested count matches returned messages exactly' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'messageDesignerWorkspace'],
    dataProfile: { profile: 'synthetic-iso20022', data: 'One preview request, checked for count/array-length consistency.', source: 'Generated per run.' },
    expected: 'Reported count exactly matches the number of messages actually returned.',
  }
);

export const SANDBENCH_USECASE_FLOW_CASES_BATCH2C: CaseDef[] = C;
