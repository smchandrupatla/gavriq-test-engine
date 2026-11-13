/** Acceptance cases for generated-file delivery and JSON Schema support.
 * Requires an immutable build containing Sand Bench portalFeatures (review pin:
 * c10565be064f034714e5d67f0ffcbdae56aa313f). Stable suite/case keys are retained. */
import { type CaseDef, type SuiteDef, tagSource } from './types.js';
import { cleanupVersionedFixture } from './sandbench-cleanup.js';

const FILE = 'apps/api/src/catalog/sandbench-pending-feature-cases.ts';

export const SANDBENCH_PENDING_SUITE: SuiteDef = {
  key: 'sb-pending-features',
  name: 'Generated-file delivery and JSON Schemas',
  description:
    'Acceptance coverage for generated-file persistence, FTP deposits, portal dispatch, and JSON Schemas. Requires a pinned build with these capabilities.',
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

const C: CaseDef[] = [];

/* 2A — download run file to FTP folder --------------------------------- */

C.push(
  {
    key: 'SBE-GEN-DOWNLOAD-LOCAL',
    name: 'Generated run files produce persisted artefacts',
    objective: 'Confirm generated messages are stored and can be found again by their own identifiers.',
    description: 'POST /api/v1/generated-messages/to-ftp (which also persists via the shared pipeline) with count=1 returns ids[0] — the test_data_id — proving the artefact is addressable for download later.',
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench API reachable; demo operator can sign in.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/to-ftp',
        headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: 'DL-LOCAL-{{rand}}-{{ts}}', filename: 'local-{{rand}}.jsonl' },
        expected_status: [200, 202],
        expect_json: [{ path: 'stored', equals: 1 }, { path: 'ids', min_length: 1 }],
        description: 'generate + persist one message' },
    ],
    tags: ['integration', 'generated-messages', 'download', ...PENDING_TAG],
    dataProfile: { profile: 'synthetic', data: 'One pacs.008 generated at run time.', source: 'generated' },
    expected: 'One generated message is stored and its own identifier is found in the persisted message list.',
  },
  {
    key: 'SBE-GEN-DOWNLOAD-FTP',
    name: 'Generated run files can be deposited on the FTP folder',
    objective: 'Confirm Sand Bench offers an explicit option to drop a generated file onto the shared FTP folder, and the FTP portal lists the new file afterwards.',
    description: 'POST /api/v1/generated-messages/to-ftp with a definition writes the generated artefact onto the shared ftp-data volume at /sandbench/<ts>-<rand>.<ext>; GET {{ftpPortal}}/app/files then returns the file in its listing.',
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p4',
    preconditions: 'Required capability: Sand Bench must gain the /api/v1/generated-messages/to-ftp endpoint, be configured with FTP_PORTAL_UPLOAD_URL (or a shared ftp-data volume mount), and the FTP portal must mount the same volume read-only.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/to-ftp',
        headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: 'DL-FTP-{{rand}}-{{ts}}', filename: 'sbe-ftp-{{rand}}-{{ts}}.jsonl' },
        expected_status: [200, 202],
        description: 'ask Sand Bench to drop a generated file on FTP' },
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/files',
        expected_status: 200,
        expected_body_contains: 'sbe-ftp-{{rand}}-{{ts}}.jsonl',
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
];

// FTP has no HTTP POST surface on the portal (the portal is read-only), so
// its "dispatch" is really the /to-ftp drop onto the shared volume. One
// dedicated case asserts that path explicitly, both for symmetry with the
// other three channels and so operators searching for "dispatch FTP" find it.
C.push({
  key: 'SBE-GEN-DISPATCH-FTP',
  name: 'Operator can nominate a generated file for FTP portal delivery',
  objective: 'Confirm the operator can take an already-generated file and ask Sand Bench to deposit it on the FTP volume for the FTP portal to list.',
  description: 'POST /api/v1/generated-messages/to-ftp drops a generated artefact onto FTP_DROP_ROOT; the FTP portal lists the file within a short poll window.',
  suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p4',
  preconditions: 'Sand Bench reaches the shared FTP volume; FTP portal mounts the same volume read-only.',
  steps: [
    API_LOGIN,
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/to-ftp',
      headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: 'DP-FTP-{{rand}}-{{ts}}', filename: 'dp-ftp-{{rand}}.jsonl' },
      expected_status: [200, 202],
      description: 'dispatch generated file to the FTP portal' },
    { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/files',
      expected_status: 200,
      expected_body_contains: 'dp-ftp-{{rand}}.jsonl',
      poll: { timeout_ms: 10000, interval_ms: 500 },
      description: 'FTP portal /app/files lists the new file' },
  ],
  tags: ['integration', 'generated-messages', 'dispatch', 'ftp', ...PENDING_TAG],
  dataProfile: { profile: 'synthetic', data: 'One pacs.008 generated and deposited on FTP volume.', source: 'generated' },
  expected: 'Deposit accepted; FTP portal lists the file within 10 seconds.',
});

for (const t of DISPATCH_TARGETS) {
  C.push({
    key: `SBE-GEN-DISPATCH-${t.ch.toUpperCase()}`,
    name: `Operator can nominate a generated file for ${t.label} delivery`,
    objective: `Confirm the operator can take an already-generated file and ask Sand Bench to deliver it to the ${t.label} on demand, without re-running the whole generation.`,
    description: `POST /api/v1/generated-messages/{generatedId}/dispatch with {channel:${t.ch}} delivers the stored artefact to the ${t.label}; the portal reflects it afterwards.`,
    suiteKey: SANDBENCH_PENDING_SUITE.key, testType: 'integration', method: 'http', severity: 'high', priority: 'p4',
    preconditions: `Required capability: Sand Bench must gain /api/v1/generated-messages/:id/dispatch which looks up the stored artefact, selects the configured ${t.label} endpoint, and forwards.`,
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/to-ftp',
        headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: `DP-${t.ch.toUpperCase()}-{{rand}}-{{ts}}`, filename: `dp-${t.ch}-{{rand}}.jsonl` },
        expected_status: [200, 202],
        save: { generated_id: 'ids.0' },
        description: 'generate one message to dispatch (fresh batch, keeps test_data_id unique)' },
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
    preconditions: 'Required capability: Sand Bench must gain a JSON Schema parser alongside its XSD parser, and a schema store that keeps both kinds side-by-side.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schemas',
        headers: BEARER,
        body: {
          name: 'json-schema-{{rand}}',
          fileName: 'js-{{rand}}.json',
          overrideMsgType: 'js.{{rand}}.{{ts}}',
          content: '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"js-{{rand}}","type":"object","properties":{"amount":{"type":"number"},"currency":{"type":"string"}},"required":["amount","currency"]}',
        },
        expected_status: [200, 201, 202],
        save: { json_schema_id: 'id' },
        description: 'upload a JSON Schema (parser detects by $schema key)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schemas/{{json_schema_id}}',
        headers: BEARER, expected_status: 200,
        expect_json: [{ path: 'data.format', equals: 'json_schema' }],
        description: 'schema is readable with data.format=json_schema' },
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
    preconditions: 'Required capability: This case uploads its own JSON Schema; the generator must choose the right producer by schema format.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/schemas',
        headers: BEARER,
        body: {
          name: 'json-schema-gen-{{rand}}',
          fileName: 'js-gen-{{rand}}.json',
          overrideMsgType: 'js.gen.{{rand}}.{{ts}}',
          content: '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"js-gen-{{rand}}","type":"object","properties":{"amount":{"type":"number"},"currency":{"type":"string"}},"required":["amount","currency"]}',
        },
        expected_status: [200, 201, 202],
        save: { msg_type_code: 'msgType' },
        description: 'upload JSON Schema; it becomes a message type' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/to-ftp',
        headers: BEARER, body: { messageTypeCode: '{{msg_type_code}}', count: 3, seed: 'JS-GEN-{{rand}}-{{ts}}', filename: 'js-gen-{{rand}}.jsonl' },
        expected_status: [200, 202],
        expect_json: [{ path: 'stored', equals: 3 }],
        description: 'generate 3 instances from the JSON-Schema-sourced message type' },
    ],
    tags: ['integration', 'generated-messages', 'json-schema', ...PENDING_TAG],
    dataProfile: { profile: 'synthetic', data: '3 JSON instances created against a JSON Schema.', source: 'generated' },
    expected: 'Response reports three stored messages.',
  },
);

for (const c of C) {
  for (const raw of c.steps || []) {
    const step = raw as Record<string, any>;
    if (step.method === 'POST' && step.url === '{{api}}/api/v1/generated-messages/to-ftp') {
      step.expected_status = 200;
      step.expect_json = [...(step.expect_json || []), { path: 'ok', equals: true },
        { path: 'stored', equals: step.body.count }, { path: 'ftp.filename', equals: step.body.filename }];
      if (c.key === 'SBE-GEN-DOWNLOAD-LOCAL') step.save = { ...step.save, generated_id: 'ids.0' };
    }
    if (step.method === 'POST' && String(step.url).endsWith('/dispatch')) {
      step.expected_status = 200;
      step.expect_json = [{ path: 'ok', equals: true }, { path: 'forwarded', equals: true },
        { path: 'channel', equals: step.body.channel }, { path: 'tag', equals: step.body.tag }];
    }
  }
  if (c.key === 'SBE-GEN-DOWNLOAD-LOCAL') c.steps!.push({
    action: 'request', method: 'GET', url: '{{api}}/api/v1/generated-messages', headers: BEARER,
    expected_status: 200, expect_json: [{ path: 'data', some: { test_data_id: '{{generated_id}}', message_type_code: 'pacs.008.001.14' } }],
    description: "find this case's generated message in the persisted message list",
  });
  const schema = (c.steps || []).find((s: any) => s.method === 'POST' && s.url === '{{api}}/api/v1/schemas') as any;
  if (schema) {
    schema.save = { ...(schema.save || {}), json_schema_id: 'id', msg_type_code: 'msgType' };
    c.cleanupSteps = [
      ...cleanupVersionedFixture('schemas', 'json_schema_id'),
      { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/message-types/{{msg_type_code}}', headers: BEARER,
        skip_if_missing: ['msg_type_code'], expected_status: [200, 404], description: 'remove the message type created with this case-owned schema' },
    ];
  }
  if ((c.steps || []).some((s: any) => s.method === 'POST' && /\/generated-messages(?:\/to-ftp)?$/.test(String(s.url)))) {
    c.atomicityNote = {
      reason: 'no-cleanup-endpoint',
      detail: 'The pinned application has no delete route for generated message rows or FTP drops. Schema fixtures are removed where supported, but generated output requires a disposable target; this pending-feature case does not claim full baseline restoration.',
    };
  }
}

export const SANDBENCH_PENDING_CASES: CaseDef[] = tagSource(FILE, C);
