/** Acceptance cases for generated-file delivery and JSON Schema support.
 *
 * Checked against Sand Bench main, commit a8d72039ae8e (2026-11-13). Stable
 * suite/case keys are retained.
 *
 * BUILT in the current application — these cases assert the real behaviour:
 *   - storing generated messages and finding them again by their own identifiers
 *     (POST /api/v1/generated-messages → {stored, batchNumber, ids};
 *     GET /api/v1/generated-messages lists them)            SBE-GEN-DOWNLOAD-LOCAL
 *   - uploading a JSON Schema next to XSDs (POST /api/v1/schemas → format
 *     "json_schema", a message type of its own)             SBE-SCHEMA-UPLOAD-JSON-SCHEMA
 *   - generating messages from that JSON Schema             SBE-GEN-FROM-JSON-SCHEMA
 *
 * NOT BUILT in the current application — these cases stay as the acceptance
 * tests and fail until the capability exists (the router answers 404 "Route …
 * not found"; no code in apps/api/src implements either route):
 *   - depositing a generated file on the shared FTP folder
 *     (POST /api/v1/generated-messages/to-ftp)   SBE-GEN-DOWNLOAD-FTP, SBE-GEN-DISPATCH-FTP
 *   - delivering a stored generated message to a portal on demand
 *     (POST /api/v1/generated-messages/:id/dispatch — the application team's
 *     improvements/new/IMP-RES001.md)            SBE-GEN-DISPATCH-MQ / -KAFKA / -API
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
  name: 'Generated-file delivery and JSON Schemas',
  description:
    'Acceptance coverage for generated-file persistence and JSON Schemas (built), and for FTP deposits and on-demand portal delivery of a generated file (not built yet: those cases fail until the capability ships).',
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
const NOT_BUILT = ['pending-capability'];
const MESSAGE_TYPE = 'pacs.008.001.08';

const NO_GENERATED_DELETE: NonNullable<CaseDef['atomicityNote']> = {
  reason: 'no-cleanup-endpoint',
  detail: 'The application has no delete route for a stored generated message (its own use-case review lists this as a gap). Schema fixtures are removed where the case creates them; the generated messages sit in a batch of the case\'s own that no other case reads.',
};
const NO_DEPOSIT_DELETE: NonNullable<CaseDef['atomicityNote']> = {
  reason: 'no-cleanup-endpoint',
  detail: 'The deposit capability is not built yet, so today the case creates nothing. As specified it would leave one generated message and one file under a per-run name on the shared folder; neither the application nor the read-only FTP portal offers a way to remove them.',
};
const NOT_BUILT_CAUSE ='The application build under test does not include this capability: the address the step calls does not exist yet, so the application answers "not found". The case is the acceptance test for the capability and stays red until it ships.';

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

/* 2A — generated messages are stored; deposit on the FTP folder ---------- */

C.push(
  {
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
  },
  {
    key: 'SBE-GEN-DOWNLOAD-FTP',
    name: 'Generated run files can be deposited on the FTP folder',
    objective: 'Confirm Sand Bench offers an explicit option to drop a generated file onto the shared FTP folder, and the FTP portal lists the new file afterwards (not built yet: the application has no such option today).',
    description: 'POST /api/v1/generated-messages/to-ftp {messageTypeCode, count:1, seed, filename} must answer 200 with ok:true, stored:1 and ftp.filename = the requested name, having written the file onto the shared FTP volume; GET {{ftpPortal}}/app/files then lists it. The route does not exist in the current build (404 "Route POST:/api/v1/generated-messages/to-ftp not found").',
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p4',
    preconditions: 'Required capability: the application can deposit a generated file on the folder it shares with the FTP portal, and the FTP portal reads that same folder.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/to-ftp',
        headers: BEARER, body: { messageTypeCode: MESSAGE_TYPE, count: 1, seed: 'DL-FTP-{{rand}}-{{ts}}', filename: 'sbe-ftp-{{rand}}-{{ts}}.jsonl' },
        expected_status: 200,
        expect_json: [{ path: 'ok', equals: true }, { path: 'stored', equals: 1 }, { path: 'ftp.filename', equals: 'sbe-ftp-{{rand}}-{{ts}}.jsonl' }],
        description: 'ask Sand Bench to drop a generated file on FTP' },
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/files',
        expected_status: 200,
        expected_body_contains: 'sbe-ftp-{{rand}}-{{ts}}.jsonl',
        poll: { timeout_ms: 10000, interval_ms: 500 },
        description: 'FTP portal lists the new file' },
    ],
    atomicityNote: NO_DEPOSIT_DELETE,
    tags:['integration', 'generated-messages', 'download', 'ftp', ...PENDING_TAG, ...NOT_BUILT],
    dataProfile: { profile: 'synthetic', data: `One ${MESSAGE_TYPE} message written to the shared FTP volume under a per-run file name.`, source: 'generated' },
    expected: 'Deposit accepted; FTP portal lists the file within 10 seconds.',
    commonFailureCauses: NOT_BUILT_CAUSE,
  },
);

/* 2B — nominate a generated file for delivery to MQ/Kafka/FTP/API ------- */

const DISPATCH_TARGETS: { ch: string; portalVar: string; label: string }[] = [
  { ch: 'mq',    portalVar: '{{mqPortal}}',    label: 'MQ portal' },
  { ch: 'kafka', portalVar: '{{kafkaPortal}}', label: 'Kafka portal' },
  { ch: 'api',   portalVar: '{{apiPortal}}',   label: 'API portal' },
];

// FTP has no HTTP POST surface on the portal (the portal is read-only), so
// its "dispatch" is really the /to-ftp drop onto the shared volume. One
// dedicated case asserts that path explicitly, both for symmetry with the
// other three channels and so operators searching for "dispatch FTP" find it.
C.push({
  key: 'SBE-GEN-DISPATCH-FTP',
  name: 'Operator can nominate a generated file for FTP portal delivery',
  objective: 'Confirm the operator can ask Sand Bench to deposit a generated file on the FTP volume for the FTP portal to list (not built yet: the application has no such option today).',
  description: 'POST /api/v1/generated-messages/to-ftp must answer 200 with ok:true, stored:1 and ftp.filename = the requested name, dropping the generated file onto the shared FTP volume; the FTP portal lists the file within a short poll window. The route does not exist in the current build (404).',
  suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p4',
  preconditions: 'Required capability: the application can deposit a generated file on the folder it shares with the FTP portal, and the FTP portal reads that same folder.',
  steps: [
    API_LOGIN,
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/to-ftp',
      headers: BEARER, body: { messageTypeCode: MESSAGE_TYPE, count: 1, seed: 'DP-FTP-{{rand}}-{{ts}}', filename: 'dp-ftp-{{rand}}-{{ts}}.jsonl' },
      expected_status: 200,
      expect_json: [{ path: 'ok', equals: true }, { path: 'stored', equals: 1 }, { path: 'ftp.filename', equals: 'dp-ftp-{{rand}}-{{ts}}.jsonl' }],
      description: 'dispatch generated file to the FTP portal' },
    { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/files',
      expected_status: 200,
      expected_body_contains: 'dp-ftp-{{rand}}-{{ts}}.jsonl',
      poll: { timeout_ms: 10000, interval_ms: 500 },
      description: 'FTP portal /app/files lists the new file' },
  ],
  atomicityNote: NO_DEPOSIT_DELETE,
  tags:['integration', 'generated-messages', 'dispatch', 'ftp', ...PENDING_TAG, ...NOT_BUILT],
  dataProfile: { profile: 'synthetic', data: `One ${MESSAGE_TYPE} message generated and deposited on the FTP volume under a per-run file name.`, source: 'generated' },
  expected: 'Deposit accepted; FTP portal lists the file within 10 seconds.',
  commonFailureCauses: NOT_BUILT_CAUSE,
});

for (const t of DISPATCH_TARGETS) {
  const tag = `DISP-${t.ch.toUpperCase()}-{{rand}}-{{ts}}`;
  C.push({
    key: `SBE-GEN-DISPATCH-${t.ch.toUpperCase()}`,
    name: `Operator can nominate a generated file for ${t.label} delivery`,
    objective: `Confirm the operator can take an already-generated file and ask Sand Bench to deliver it to the ${t.label} on demand, without re-running the whole generation (not built yet: the application stores the file but cannot deliver it on demand today).`,
    description: `POST /api/v1/generated-messages stores one message (this exists today). POST /api/v1/generated-messages/{id}/dispatch {channel:${t.ch}, tag} must then answer 200 with ok:true, forwarded:true, the channel and the tag, and ${t.portalVar}/app/ledger?q=<tag> must show the delivery. The dispatch route does not exist in the current build (404 "Route … not found").`,
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p4',
    preconditions: `Required capability: the application can deliver a stored generated message to the ${t.label} on demand. The ${t.label} is running.`,
    steps: [
      API_LOGIN,
      generate(`DP-${t.ch.toUpperCase()}`, 1),
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/{{generated_id}}/dispatch',
        headers: BEARER, body: { channel: t.ch, tag },
        expected_status: 200,
        expect_json: [{ path: 'ok', equals: true }, { path: 'forwarded', equals: true }, { path: 'channel', equals: t.ch }, { path: 'tag', equals: tag }],
        description: `dispatch generated file to ${t.label}`,
        text: `Ask the application to deliver the stored message to the ${t.label}, with a tag unique to this run`,
        expected: 'The application confirms it forwarded the message.' },
      { action: 'request', method: 'GET', url: `${t.portalVar}/app/ledger?q=${tag}`,
        expected_status: 200,
        expect_json: [{ path: 'data', min_length: 1 }],
        poll: { timeout_ms: 10000, interval_ms: 500 },
        description: `${t.label} record holds the delivery (searched by the dispatch tag)`,
        text: `Search the ${t.label}'s record for this run's tag`,
        expected: 'The delivery is listed.' },
    ],
    atomicityNote: NO_GENERATED_DELETE,
    tags: ['integration', 'generated-messages', 'dispatch', t.ch, ...PENDING_TAG, ...NOT_BUILT],
    dataProfile: { profile: 'synthetic', data: `One ${MESSAGE_TYPE} message generated, then delivered on demand to the ${t.label}.`, source: 'generated' },
    expected: `Dispatch accepted; ${t.label} shows the per-run tag within 10 seconds.`,
    commonFailureCauses: NOT_BUILT_CAUSE,
  });
}

/* 2C — JSON Schema loader + generator ---------------------------------- */

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
