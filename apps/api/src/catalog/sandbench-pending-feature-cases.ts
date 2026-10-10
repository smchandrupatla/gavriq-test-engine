/**
 * Forward-looking test cases for Sand Bench features that the operator has
 * asked for but which do not yet exist on the pinned staging deployment:
 *
 *   2A — Download a generated run file to the FTP folder (today only local
 *        download is wired).
 *   2B — Nominate an already-generated file for delivery to MQ / Kafka /
 *        FTP / API portal via a selector.
 *   2C — Load a JSON Schema (alongside XSDs) and generate messages against
 *        it.
 *
 * The implementation spec lives at docs/pending-features/sandbench-portal-features.md.
 *
 * These cases are expected to FAIL on the current staging stack and GREEN
 * once the feature lands. They are tagged "pending-feature" so operators
 * can filter them out of the daily green-count view; priority is p4.
 */
import { CaseDef, SuiteDef, tagSource } from './types.ts';

const FILE = 'apps/api/src/catalog/sandbench-pending-feature-cases.ts';

export const SANDBENCH_PENDING_SUITE: SuiteDef = {
  key: 'sb-pending-features',
  name: 'Sand Bench pending features',
  description:
    'Forward-looking cases for Sand Bench features that are specified but not yet implemented on staging. See docs/pending-features/sandbench-portal-features.md.',
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

const PENDING_TAG = ['pending-feature'];

const C: CaseDef[] = [];

/* 2A — download run file to FTP folder --------------------------------- */

C.push(
  {
    key: 'SBE-GEN-DOWNLOAD-LOCAL',
    name: 'Generated run files can be downloaded locally',
    objective: 'Confirm the generated-messages flow produces a downloadable local artefact for a definition.',
    description: 'POST /api/v1/generated-messages with a definition and count=1 returns a response the operator can save; the ledger carries the generated artefact id.',
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench API reachable; demo operator can sign in.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages',
        headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: 'DL-LOCAL-{{ts}}' },
        expected_status: [200, 202],
        expect_json: [{ path: 'runId', exists: true }],
        description: 'generate messages' },
    ],
    tags: ['integration', 'generated-messages', 'download', ...PENDING_TAG],
    dataProfile: { profile: 'synthetic', data: 'One pacs.008 generated at run time.', source: 'generated' },
    expected: 'Response includes a runId operators can later download from.',
  },
  {
    key: 'SBE-GEN-DOWNLOAD-FTP',
    name: 'Generated run files can be deposited on the FTP folder',
    objective: 'Confirm Sand Bench offers an explicit option to drop a generated file onto the shared FTP folder, and the FTP portal lists the new file afterwards.',
    description: 'POST /api/v1/generated-messages/to-ftp with a definition writes the generated artefact onto the shared ftp-data volume at /sandbench/<ts>-<rand>.<ext>; GET {{ftpPortal}}/app/files then returns the file in its listing.',
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p4',
    preconditions: 'FEATURE NOT YET IMPLEMENTED. Sand Bench must gain the /api/v1/generated-messages/to-ftp endpoint, be configured with FTP_PORTAL_UPLOAD_URL (or a shared ftp-data volume mount), and the FTP portal must mount the same volume read-only.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/to-ftp',
        headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: 'DL-FTP-{{ts}}', filename: 'sbe-ftp-{{rand}}.xml' },
        expected_status: [200, 202],
        description: 'ask Sand Bench to drop a generated file on FTP' },
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/files?prefix=sandbench/',
        expected_status: 200,
        expected_body_contains: 'sbe-ftp-{{rand}}.xml',
        poll: { timeout_ms: 10000, interval_ms: 500 },
        description: 'FTP portal lists the new file' },
    ],
    tags: ['integration', 'generated-messages', 'download', 'ftp', ...PENDING_TAG],
    dataProfile: { profile: 'synthetic', data: 'One pacs.008 written to the shared FTP volume.', source: 'generated' },
    expected: 'POST accepted; FTP portal lists the file within 10 seconds.',
  },
);

/* 2B — nominate a generated file for delivery to MQ/Kafka/FTP/API ------- */

const DISPATCH_TARGETS: { ch: string; portalVar: string; portalLogPath: string; label: string }[] = [
  { ch: 'mq',    portalVar: '{{mqPortal}}',    portalLogPath: '/app/log',  label: 'MQ portal' },
  { ch: 'kafka', portalVar: '{{kafkaPortal}}', portalLogPath: '/app/log',  label: 'Kafka portal' },
  { ch: 'api',   portalVar: '{{apiPortal}}',   portalLogPath: '/app/log',  label: 'API portal' },
  { ch: 'ftp',   portalVar: '{{ftpPortal}}',   portalLogPath: '/app/files', label: 'FTP portal' },
];

for (const t of DISPATCH_TARGETS) {
  C.push({
    key: `SBE-GEN-DISPATCH-${t.ch.toUpperCase()}`,
    name: `Operator can nominate a generated file for ${t.label} delivery`,
    objective: `Confirm the operator can take an already-generated file and ask Sand Bench to deliver it to the ${t.label} on demand, without re-running the whole generation.`,
    description: `POST /api/v1/generated-messages/{generatedId}/dispatch with {channel:${t.ch}} delivers the stored artefact to the ${t.label}; the portal reflects it afterwards.`,
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p4',
    preconditions: `FEATURE NOT YET IMPLEMENTED. Sand Bench must gain /api/v1/generated-messages/:id/dispatch which looks up the stored artefact, selects the configured ${t.label} endpoint, and forwards.`,
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages',
        headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: `DP-${t.ch.toUpperCase()}-{{ts}}` },
        expected_status: [200, 202],
        save: { generated_id: 'runId' },
        description: 'generate one message to dispatch' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/{{generated_id}}/dispatch',
        headers: BEARER, body: { channel: t.ch, tag: `DISP-${t.ch.toUpperCase()}-{{rand}}-{{ts}}` },
        expected_status: [200, 202],
        description: `dispatch generated file to ${t.label}` },
      { action: 'request', method: 'GET', url: `${t.portalVar}${t.portalLogPath}`,
        expected_status: 200,
        expected_body_contains: `DISP-${t.ch.toUpperCase()}-{{rand}}-{{ts}}`,
        poll: { timeout_ms: 10000, interval_ms: 500 },
        description: `${t.label} ${t.portalLogPath} contains the dispatch tag` },
    ],
    tags: ['integration', 'generated-messages', 'dispatch', t.ch, ...PENDING_TAG],
    dataProfile: { profile: 'synthetic', data: `One pacs.008 generated, then dispatched to ${t.label}.`, source: 'generated' },
    expected: `Dispatch accepted; ${t.label} shows the per-run tag within 10 seconds.`,
  });
}

/* 2C — JSON Schema loader + generator ---------------------------------- */

C.push(
  {
    key: 'SBE-SCHEMA-UPLOAD-JSON-SCHEMA',
    name: 'Operator can upload a JSON Schema alongside XSDs',
    objective: 'Confirm Sand Bench accepts a JSON Schema (RFC 8259 / draft 2020-12) as a schema source, in addition to XSD.',
    description: 'POST /api/v1/schemas with content_type=application/schema+json and a minimal JSON Schema returns 2xx and the schema is listed via GET /api/v1/schemas.',
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p4',
    preconditions: 'FEATURE NOT YET IMPLEMENTED. Sand Bench must gain a JSON Schema parser alongside its XSD parser, and a schema store that keeps both kinds side-by-side.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schemas',
        headers: { ...BEARER, 'content-type': 'application/json' },
        body: {
          name: 'json-schema-{{rand}}',
          format: 'json-schema',
          schema: {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: { amount: { type: 'number' }, currency: { type: 'string' } },
            required: ['amount', 'currency'],
          },
        },
        expected_status: [200, 201, 202],
        save: { json_schema_id: 'id' },
        description: 'upload a JSON Schema' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schemas/{{json_schema_id}}',
        headers: BEARER, expected_status: 200,
        expect_json: [{ path: 'format', equals: 'json-schema' }],
        description: 'schema is readable with format=json-schema' },
    ],
    tags: ['integration', 'schema', 'json-schema', ...PENDING_TAG],
    dataProfile: { profile: 'synthetic', data: 'A tiny valid JSON Schema with amount+currency.', source: 'inline' },
    expected: 'Schema accepted; readable with format=json-schema.',
  },
  {
    key: 'SBE-GEN-FROM-JSON-SCHEMA',
    name: 'Sand Bench can generate messages from a JSON Schema',
    objective: 'Confirm Sand Bench can create synthetic data that satisfies a JSON Schema previously uploaded.',
    description: 'POST /api/v1/generated-messages with schemaId=<json schema id>, format=json, count=3 returns 3 JSON instances that match the schema.',
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p4',
    preconditions: 'FEATURE NOT YET IMPLEMENTED. Depends on SBE-SCHEMA-UPLOAD-JSON-SCHEMA; the generator must choose the right producer by schema format.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schemas',
        headers: { ...BEARER, 'content-type': 'application/json' },
        body: {
          name: 'json-schema-gen-{{rand}}',
          format: 'json-schema',
          schema: {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: { amount: { type: 'number' }, currency: { type: 'string' } },
            required: ['amount', 'currency'],
          },
        },
        expected_status: [200, 201, 202],
        save: { json_schema_id: 'id' },
        description: 'upload JSON Schema' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages',
        headers: BEARER, body: { schemaId: '{{json_schema_id}}', format: 'json', count: 3, seed: 'JS-GEN-{{ts}}' },
        expected_status: [200, 202],
        expect_json: [{ path: 'generated', equals: 3 }],
        description: 'generate 3 instances from the JSON Schema' },
    ],
    tags: ['integration', 'generated-messages', 'json-schema', ...PENDING_TAG],
    dataProfile: { profile: 'synthetic', data: '3 JSON instances created against a JSON Schema.', source: 'generated' },
    expected: 'Response reports generated: 3.',
  },
);

export const SANDBENCH_PENDING_CASES: CaseDef[] = tagSource(FILE, C);
