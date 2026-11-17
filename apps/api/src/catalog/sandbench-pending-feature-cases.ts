/** Acceptance cases for generated-message persistence and JSON Schema support.
 *
 * Checked against Sand Bench main, commit a8d72039ae8e (2026-11-14). Stable
 * suite/case keys are retained. All three capabilities below are built, and the
 * cases assert the application's real behaviour:
 *   - storing generated messages and finding them again by their own identifiers
 *     (POST /api/v1/generated-messages → {stored, batchNumber, ids};
 *     GET /api/v1/generated-messages lists them)            SBE-GEN-DOWNLOAD-LOCAL
 *   - uploading a JSON Schema next to XSDs (POST /api/v1/schemas → format
 *     "json_schema", a message type of its own)             SBE-SCHEMA-UPLOAD-JSON-SCHEMA
 *   - generating messages from that JSON Schema             SBE-GEN-FROM-JSON-SCHEMA
 *
 * Deleted on 2026-11-14 as not applicable — the capability they describe is not
 * in the application and has no equivalent under another name:
 *   - SBE-GEN-DOWNLOAD-FTP, SBE-GEN-DISPATCH-FTP: "deposit a generated file on the
 *     shared FTP folder" (POST /api/v1/generated-messages/to-ftp — no such route,
 *     nothing reads FTP_DROP_ROOT). The application's only way to put a file on an
 *     FTP server is a test run on the ftp channel with a server configured;
 *     without one the run is simulated, which SBE-RT-FTP-END-TO-END covers.
 *   - SBE-GEN-DISPATCH-MQ / -KAFKA / -API: "deliver a stored generated message to
 *     a portal on demand" (POST /api/v1/generated-messages/:id/dispatch — no such
 *     route; the application team's open improvement IMP-RES001). Reaching each
 *     portal with a message is covered by SBE-RT-API/MQ/KAFKA-END-TO-END.
 *
 * A batch number of the case's own is always sent when generating: without one
 * the application reuses its default batch "B001" and fails internally (500) on
 * every call after the first — an application defect reported separately.
 */
import { type CaseDef, type SuiteDef, tagSource } from './types.js';
import { cleanupVersionedFixture } from './sandbench-cleanup.js';

const FILE = 'apps/api/src/catalog/sandbench-pending-feature-cases.ts';

export const SANDBENCH_PENDING_SUITE: SuiteDef = {
  key: 'sb-pending-features',
  name: 'Generated-message storage and JSON Schemas',
  description:
    'Acceptance coverage for storing generated messages and for JSON Schemas as a schema source: upload one, get a message type from it, generate valid messages from it.',
  typeKey: 'apiPortalIntegration',
  category: 'qa',
};

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { username: '{{username}}', password: '{{password}}' },
  expected_status: 200, save: { token: 'token' },
  description: 'operator login',
} as const;
const BEARER = { authorization: 'Bearer {{token}}' };

const PENDING_TAG = ['feature-acceptance'];
const MESSAGE_TYPE = 'pacs.008.001.08';

const NO_GENERATED_DELETE: NonNullable<CaseDef['atomicityNote']> = {
  reason: 'no-cleanup-endpoint',
  detail: 'The application has no delete route for a stored generated message (its own use-case review lists this as a gap). Schema fixtures are removed where the case creates them; the generated messages sit in a batch of the case\'s own that no other case reads.',
};

/** Generate and store messages through the route the application has today. */
function generate(seedTag: string, count: number, messageTypeCode = MESSAGE_TYPE) {
  const batch = `TE-${seedTag}-{{rand}}-{{ts}}`;
  return {
    action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages', headers: BEARER,
    body: { messageTypeCode, count, seed: `${seedTag}-{{rand}}-{{ts}}`, batchNumber: batch },
    expected_status: 200,
    expect_json: [{ path: 'stored', equals: count }, { path: 'batchNumber', equals: batch }, { path: 'ids', min_length: count, max_length: count }, { path: 'ids.0', exists: true }],
    save: { generated_id: 'ids.0' },
    description: `generate and store ${count} message(s) in a batch of the case's own`,
    text: count === 1 ? 'Ask the application to generate and store one test message' : `Ask the application to generate and store ${count} test messages`,
    expected: `${count === 1 ? 'One message is' : `${count} messages are`} stored under a batch number unique to this run.`,
  };
}

const C: CaseDef[] = [];

/* Generated messages are stored and can be found again ------------------- */

C.push({
  key: 'SBE-GEN-DOWNLOAD-LOCAL',
  name: 'Generated run files produce persisted artefacts',
  objective: 'Confirm generated messages are stored and can be found again by their own identifiers.',
  description: `POST /api/v1/generated-messages {messageTypeCode:${MESSAGE_TYPE}, count:1, seed, batchNumber} answers 200 with stored:1, the batch number and one id (the test_data_id). GET /api/v1/generated-messages then lists that id with its message type, its batch number and schema_valid true.`,
  suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
  preconditions: 'The application is running and the operator can sign in.',
  steps: [
    API_LOGIN,
    generate('DL-LOCAL', 1),
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/generated-messages', headers: BEARER,
      expected_status: 200,
      expect_json: [{ path: 'data', some: { test_data_id: '{{generated_id}}', message_type_code: MESSAGE_TYPE, batch_number: 'TE-DL-LOCAL-{{rand}}-{{ts}}', schema_valid: true } }],
      description: 'find this case\'s generated message in the stored message list',
      text: 'Open the list of stored generated messages',
      expected: 'The message generated above is listed under its own identifier and batch, marked as valid.' },
  ],
  atomicityNote: NO_GENERATED_DELETE,
  tags: ['integration', 'generated-messages', 'download', ...PENDING_TAG],
  dataProfile: { profile: 'synthetic', data: `One ${MESSAGE_TYPE} message generated at run time, in a batch of its own.`, source: 'generated' },
  expected: 'One generated message is stored and its own identifier is found in the stored message list.',
});

/* JSON Schema loader + generator ---------------------------------------- */

const jsonSchemaUpload = (label: string) => ({
  action: 'request', method: 'POST', url: '{{api}}/api/v1/schemas', headers: BEARER,
  body: {
    name: `json-schema-${label}-{{rand}}`,
    fileName: `js-${label}-{{rand}}.json`,
    overrideMsgType: `js.${label}.{{rand}}.{{ts}}`,
    content: `{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"js-${label}-{{rand}}","type":"object","properties":{"amount":{"type":"number"},"currency":{"type":"string"}},"required":["amount","currency"]}`,
  },
  expected_status: 200,
  expect_json: [
    { path: 'id', exists: true },
    { path: 'format', equals: 'json_schema' },
    { path: 'msgType', equals: `js.${label}.{{rand}}.{{ts}}` },
    { path: 'fieldCount', equals: 2 },
    { path: 'findings', max_length: 0 },
  ],
  save: { json_schema_id: 'id', msg_type_code: 'msgType' },
  description: 'upload a JSON Schema with two required fields (amount, currency)',
  text: 'Upload a small JSON Schema describing a message with an amount and a currency',
  expected: 'The application accepts it as a JSON Schema, finds its two fields and reports no problems.',
  testData: 'A two-field JSON Schema under a message-type name unique to this run.',
});

const jsonSchemaCleanup = [
  ...cleanupVersionedFixture('schemas', 'json_schema_id'),
  { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/message-types/{{msg_type_code}}', headers: BEARER,
    skip_if_missing: ['msg_type_code'], expected_status: [200, 404],
    description: 'remove the message type created with this case-owned schema',
    text: 'Remove the message type the uploaded schema created', expected: 'The message type is removed or was already absent.' },
  { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types/{{msg_type_code}}', headers: BEARER,
    skip_if_missing: ['msg_type_code'], expected_status: 404,
    description: 'verify the case-owned message type is gone',
    text: 'Check that the message type is no longer available', expected: 'The application reports that the message type does not exist.' },
];

C.push(
  {
    key: 'SBE-SCHEMA-UPLOAD-JSON-SCHEMA',
    name: 'Operator can upload a JSON Schema alongside XSDs',
    objective: 'Confirm Sand Bench accepts a JSON Schema as a schema source, in addition to XSD, and keeps it as a schema of that kind with a message type of its own.',
    description: 'POST /api/v1/schemas {name, fileName, overrideMsgType, content:<JSON Schema draft 2020-12>} answers 200 with format "json_schema", msgType = the requested code, fieldCount 2 and no findings. GET /api/v1/schemas/{id} returns data.format "json_schema", data.msg_type_code and data.status "imported"; GET /api/v1/schemas lists it; GET /api/v1/message-types/{code} shows the new custom message type with two fields. Cleanup deletes the schema (If-Match) and the message type and verifies both are gone.',
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'The application is running and the operator can sign in.',
    steps: [
      API_LOGIN,
      jsonSchemaUpload('up'),
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schemas/{{json_schema_id}}',
        headers: BEARER, expected_status: 200,
        expect_json: [
          { path: 'data.format', equals: 'json_schema' },
          { path: 'data.msg_type_code', equals: '{{msg_type_code}}' },
          { path: 'data.field_count', equals: 2 },
          { path: 'data.status', equals: 'imported' },
        ],
        description: 'schema is readable with data.format=json_schema',
        text: 'Open the uploaded schema',
        expected: 'It is stored as a JSON Schema with two fields, linked to its message type.' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schemas', headers: BEARER, expected_status: 200,
        expect_json: [{ path: 'data', some: { id: '{{json_schema_id}}', format: 'json_schema' } }],
        description: 'schema is listed with the other schemas',
        text: 'Open the list of schemas',
        expected: 'The uploaded JSON Schema is listed.' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types/{{msg_type_code}}', headers: BEARER, expected_status: 200,
        expect_json: [{ path: 'code', equals: '{{msg_type_code}}' }, { path: 'family_code', equals: 'custom' }, { path: 'format', equals: 'json' }, { path: 'field_count', equals: 2 }, { path: 'is_ready', equals: true }],
        description: 'the schema became a ready custom message type with two fields',
        text: 'Open the message type the schema created',
        expected: 'A ready message type with two fields exists under the requested name.' },
    ],
    cleanupSteps: jsonSchemaCleanup,
    tags: ['integration', 'schema', 'json-schema', ...PENDING_TAG],
    dataProfile: { profile: 'synthetic', data: 'A tiny valid JSON Schema with amount+currency, under a per-run message-type name.', source: 'inline' },
    expected: 'Schema accepted; readable and listed with format json_schema; its message type exists; both removed afterwards.',
  },
  {
    key: 'SBE-GEN-FROM-JSON-SCHEMA',
    name: 'Sand Bench can generate messages from a JSON Schema',
    objective: 'Confirm Sand Bench can create test messages that satisfy a JSON Schema uploaded moments earlier.',
    description: 'The case uploads its own JSON Schema (POST /api/v1/schemas → a custom message type), then POST /api/v1/generated-messages {messageTypeCode:<that type>, count:3, seed, batchNumber} answers 200 with stored:3 and three ids; GET /api/v1/generated-messages lists the first of them under that message type with schema_valid true. Cleanup deletes the schema and the message type.',
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'The application is running and the operator can sign in.',
    steps: [
      API_LOGIN,
      jsonSchemaUpload('gen'),
      generate('JS-GEN', 3, '{{msg_type_code}}'),
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/generated-messages', headers: BEARER,
        expected_status: 200,
        expect_json: [{ path: 'data', some: { test_data_id: '{{generated_id}}', message_type_code: '{{msg_type_code}}', batch_number: 'TE-JS-GEN-{{rand}}-{{ts}}', schema_valid: true } }],
        description: 'a generated instance is stored under the JSON-Schema message type and is schema-valid',
        text: 'Open the list of stored generated messages',
        expected: 'A message generated from the uploaded schema is listed and marked as valid against it.' },
    ],
    cleanupSteps: jsonSchemaCleanup,
    atomicityNote: NO_GENERATED_DELETE,
    tags: ['integration', 'generated-messages', 'json-schema', ...PENDING_TAG],
    dataProfile: { profile: 'synthetic', data: 'Three messages generated from a case-owned JSON Schema, in a batch of their own.', source: 'generated' },
    expected: 'Three messages stored; the stored list shows one of them as valid against the schema; schema and message type removed afterwards.',
  },
);

export const SANDBENCH_PENDING_CASES: CaseDef[] = tagSource(FILE, C);
