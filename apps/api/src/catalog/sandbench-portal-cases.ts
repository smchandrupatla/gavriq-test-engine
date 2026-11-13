/**
 * Catalog cases for the four standalone portals Sand Bench talks to as
 * external systems:
 *
 *   - gavriq-kafka-desk (Kafka portal — port 8095)
 *   - gavriq-mq-desk    (MQ portal    — port 8092)
 *   - gavriq-ftp-desk   (FTP portal   — port 18102 on staging)
 *   - gavriq-api-desk   (API portal   — port 8093)
 *
 * Each portal is deployed from its own repository with its own compose
 * project (deploy/portals/deploy.mjs). The portals point at Sand Bench via
 * SBE_STUB_BASE / SBE_APP_BASE (host.docker.internal); the staging environment
 * stores each portal URL in its config.vars so the catalog's templating
 * ({{kafkaPortal}}, {{mqPortal}}, {{ftpPortal}}, {{apiPortal}}) picks the right
 * host per environment.
 *
 * Every expectation below is the portal's actual answer, read from the portal
 * sources (apps/<portal>/server.mjs and apps/desks/desk-kernel.mjs in each
 * repository) and confirmed against the deployed containers:
 *   - a send answers 200 with the stored row (direction "send") and one result
 *     per wire; an empty send is not refused — the portal sends a placeholder
 *     message and records it;
 *   - GET /app/ledger?q=<text> searches the portal's whole record, so a case
 *     finds exactly its own row by its per-run tag instead of scanning the
 *     latest 80 rows of /app/log;
 *   - the FTP portal answers 400 for a path that leaves its folder and 404 for
 *     a missing file.
 *
 * Suites + type_keys surface as submenu items under Quality assurance.
 */
import { type CaseDef, type SuiteDef, tagSource } from './types.js';

const FILE = 'apps/api/src/catalog/sandbench-portal-cases.ts';

export const SANDBENCH_PORTAL_SUITES: SuiteDef[] = [
  {
    key: 'sb-kafka-portal',
    name: 'Kafka portal integration',
    description:
      'The standalone Kafka portal (gavriq-kafka-desk) answers its own health, reaches Sand Bench\'s testhub, and sends and receives messages through it.',
    typeKey: 'kafkaPortalIntegration',
    category: 'qa',
  },
  {
    key: 'sb-mq-portal',
    name: 'MQ portal integration',
    description:
      'The standalone MQ portal (gavriq-mq-desk) answers its own health, reaches Sand Bench\'s testhub, and exchanges messages through the testhub wire.',
    typeKey: 'mqPortalIntegration',
    category: 'qa',
  },
  {
    key: 'sb-ftp-portal',
    name: 'FTP portal integration',
    description:
      'The standalone FTP portal (gavriq-ftp-desk) answers its own health and lists the files that landed on the shared FTP volume.',
    typeKey: 'ftpPortalIntegration',
    category: 'qa',
  },
  {
    key: 'sb-api-portal',
    name: 'API portal integration',
    description:
      'The standalone API portal (gavriq-api-desk) answers its own health, reaches Sand Bench\'s API, and records inbound deliveries in its own ledger.',
    typeKey: 'apiPortalIntegration',
    category: 'qa',
  },
];

const C: CaseDef[] = [];

const READ_ONLY = { profile: 'none (read-only)', data: 'A single read; nothing is created.', source: 'n/a' };
const HTML = [{ name: 'content-type', contains: 'text/html' }];
const NOT_FOUND = [{ path: 'error', equals: 'not found' }];

/** One row, and only one, in a portal's record carries this per-run tag. */
function ledgerHasOne(portal: string, tag: string, row: Record<string, unknown>, what: string) {
  return {
    action: 'request', method: 'GET', url: `${portal}/app/ledger?q=${tag}`, expected_status: 200,
    expect_json: [{ path: 'data', min_length: 1, max_length: 1 }, ...Object.entries(row).map(([path, equals]) => ({ path: `data.0.${path}`, equals }))],
    poll: { timeout_ms: 5000, interval_ms: 500 },
    description: `portal /app/ledger?q=<tag> holds exactly one row: ${what}`,
    text: 'Search the portal\'s record for this run\'s tag',
    expected: `Exactly one entry is found: ${what}.`,
  };
}

/* ------------------------------------------------------------------------- */
/* Kafka portal                                                              */
/* ------------------------------------------------------------------------- */

const kafkaSend = (tag: string, description: string) => ({
  action: 'request', method: 'POST', url: '{{kafkaPortal}}/app/send',
  body: { target: 'testhub', topic: 'sandbench.out', payload: { echo: tag } },
  expected_status: 200,
  expect_json: [
    { path: 'direction', equals: 'send' },
    { path: 'topic', equals: 'sandbench.out' },
    { path: 'payload.echo', equals: tag },
    { path: 'results.0.via', equals: 'testhub' },
    { path: 'results.0.ok', equals: true },
    { path: 'results.0.status', equals: 200 },
  ],
  description,
  text: 'Ask the Kafka portal to send one message carrying a tag unique to this run',
  expected: 'The portal sends it over the test hub and reports that the test hub accepted it.',
});

C.push(
  {
    key: 'SB-KAFKA-PORTAL-HEALTH',
    name: 'Kafka portal answers that it is healthy',
    objective: 'Confirm the Kafka portal is running and tells us so when asked, with its own service name.',
    description: 'GET {{kafkaPortal}}/health must return 200 with status "ok", service "kafkaportal" and decoupled true — proof the portal container is up and claims to be independent of Sand Bench\'s own API.',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: 'gavriq-kafka-desk compose project up; port 8095 reachable from the worker.',
    steps: [
      { action: 'request', method: 'GET', url: '{{kafkaPortal}}/health', expected_status: 200,
        expect_json: [{ path: 'status', equals: 'ok' }, { path: 'service', equals: 'kafkaportal' }, { path: 'decoupled', equals: true }],
        description: 'portal /health' },
    ],
    tags: ['integration', 'portal', 'kafka'],
    dataProfile: READ_ONLY,
    expected: '200 with service "kafkaportal" and decoupled true.',
  },
  {
    key: 'SB-KAFKA-PORTAL-READY',
    name: 'Kafka portal reports it is ready for traffic',
    objective: 'Confirm the Kafka portal says it is ready, which means its own state file and the wire it uses are in place.',
    description: 'GET {{kafkaPortal}}/ready returns 200 with ready true.',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'gavriq-kafka-desk portal container healthy.',
    steps: [
      { action: 'request', method: 'GET', url: '{{kafkaPortal}}/ready', expected_status: 200,
        expect_json: [{ path: 'ready', equals: true }], description: 'portal /ready' },
    ],
    tags: ['integration', 'portal', 'kafka'],
    dataProfile: READ_ONLY,
    expected: '200 {"ready":true}.',
  },
  {
    key: 'SB-KAFKA-PORTAL-SBE-TESTHUB-REACHABLE',
    name: 'Kafka portal can reach the Sand Bench testhub',
    objective: 'Confirm the Kafka portal and Sand Bench\'s testhub can talk — a prerequisite for every send and receive.',
    description: 'GET {{kafkaPortal}}/app/status returns 200 and reports testhub.ok true with status 200 against the testhub base it was configured with (host.docker.internal:18091 on staging), and names testhub as its default wire.',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: 'Sand Bench testhub up on {{testhub}}; portal env SBE_STUB_BASE points at it.',
    steps: [
      { action: 'request', method: 'GET', url: '{{kafkaPortal}}/app/status', expected_status: 200,
        expect_json: [{ path: 'testhub.ok', equals: true }, { path: 'testhub.status', equals: 200 }, { path: 'defaultWire', equals: 'testhub' }],
        description: 'portal /app/status' },
    ],
    tags: ['integration', 'portal', 'kafka', 'connectivity'],
    dataProfile: READ_ONLY,
    expected: '200 with testhub.ok true, testhub.status 200 and defaultWire "testhub".',
  },
  {
    key: 'SB-KAFKA-PORTAL-TOPIC-DEFAULT',
    name: 'Kafka portal advertises its default topic',
    objective: 'Confirm the portal reports the default Kafka topic it writes to, so cases can trust what topic their sends end up on.',
    description: 'GET {{kafkaPortal}}/health returns topic "sandbench.out" — the topic the portal\'s compose file configures and Sand Bench delivers to.',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Kafka portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{kafkaPortal}}/health', expected_status: 200,
        expect_json: [{ path: 'topic', equals: 'sandbench.out' }], description: 'portal /health names its topic' },
    ],
    tags: ['integration', 'portal', 'kafka', 'contract'],
    dataProfile: READ_ONLY,
    expected: '200 with topic "sandbench.out".',
  },
  {
    key: 'SB-KAFKA-PORTAL-HEADERS-CATALOG',
    name: 'Kafka portal publishes its header catalogue',
    objective: 'Confirm the portal returns the catalogue of headers it knows about, so test authors can see what every send is required to carry.',
    description: 'GET {{kafkaPortal}}/app/headers returns 200 and a non-empty data array that includes the required header "x-sandbench-origin" with the value "kafka".',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Kafka portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{kafkaPortal}}/app/headers', expected_status: 200,
        expect_json: [{ path: 'data', min_length: 1 }, { path: 'data', some: { name: 'x-sandbench-origin', value: 'kafka', required: true } }],
        description: 'portal /app/headers' },
    ],
    tags: ['integration', 'portal', 'kafka', 'catalog'],
    dataProfile: READ_ONLY,
    expected: '200 with a header catalogue naming x-sandbench-origin = kafka as required.',
  },
  {
    key: 'SB-KAFKA-PORTAL-LOG-READABLE',
    name: 'Kafka portal activity log is readable',
    objective: 'Confirm the portal\'s recent-activity log is reachable even when nothing has happened yet — a baseline every send/receive case relies on.',
    description: 'GET {{kafkaPortal}}/app/log returns 200 with a data array (may be empty).',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Kafka portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{kafkaPortal}}/app/log', expected_status: 200,
        expect_json: [{ path: 'data', exists: true }], description: 'portal /app/log' },
    ],
    tags: ['integration', 'portal', 'kafka', 'log'],
    dataProfile: READ_ONLY,
    expected: '200 with a data array (empty or not).',
  },
  {
    key: 'SB-KAFKA-PORTAL-ROUND-TRIP',
    name: 'Kafka portal sends via testhub and the message comes back',
    objective: 'Confirm the end-to-end wire: when the portal sends a message, Sand Bench\'s testhub records it and the portal can read it back.',
    description: 'POST {{kafkaPortal}}/app/send {target:"testhub",topic:"sandbench.out",payload:{echo:<tag>}} answers 200 with the stored row (direction send) and results[0] {via:testhub, ok:true, status:200}. {{testhub}}/hub/inbox?channel=kafka then holds a kafka row with that payload on topic sandbench.out; {{kafkaPortal}}/app/inbox?q=<tag> reads it back from the wire; {{kafkaPortal}}/app/ledger?q=<tag> holds exactly one send row.',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: 'Portal up and testhub.ok true; portal pointed at staging testhub.',
    steps: [
      kafkaSend('KAFKA-RT-{{rand}}-{{ts}}', 'portal /app/send via testhub'),
      { action: 'request', method: 'GET', url: '{{testhub}}/hub/inbox?channel=kafka', expected_status: 200,
        expect_json: [{ path: 'data', some: { channel: 'kafka', topic: 'sandbench.out', status: 200, 'payload.echo': 'KAFKA-RT-{{rand}}-{{ts}}' } }],
        poll: { timeout_ms: 5000, interval_ms: 500 },
        description: 'testhub inbox holds the message on topic sandbench.out',
        text: 'Look for that message in the test hub\'s inbox for the Kafka channel',
        expected: 'The test hub lists the message.' },
      { action: 'request', method: 'GET', url: '{{kafkaPortal}}/app/inbox?q=KAFKA-RT-{{rand}}-{{ts}}', expected_status: 200,
        expect_json: [{ path: 'filtered', min: 1 }, { path: 'data', some: { 'payload.echo': 'KAFKA-RT-{{rand}}-{{ts}}' } }],
        poll: { timeout_ms: 5000, interval_ms: 500 },
        description: 'portal reads the message back from the wire (inbox filtered by the tag)',
        text: 'Ask the Kafka portal to read its inbox from the wire, filtered to this run\'s tag',
        expected: 'The portal\'s inbox lists the message it sent.' },
      ledgerHasOne('{{kafkaPortal}}', 'KAFKA-RT-{{rand}}-{{ts}}', { direction: 'send', topic: 'sandbench.out', 'payload.echo': 'KAFKA-RT-{{rand}}-{{ts}}' }, 'the send'),
    ],
    tags: ['integration', 'portal', 'kafka', 'round-trip'],
    dataProfile: { profile: 'synthetic', data: 'A disposable Kafka message tagged with a per-run value.', source: 'generated at run time' },
    expected: 'Send accepted by testhub; the message is in the testhub inbox, readable back through the portal, and recorded once in the portal.',
  },
  {
    key: 'SB-KAFKA-PORTAL-MULTI-SEND-INDEPENDENT',
    name: 'Kafka portal records two sequential sends as independent entries',
    objective: 'Confirm two sends in a row both land in the portal\'s record, each keeping its own tag — proof that one send does not clobber or shadow the next.',
    description: 'POST {{kafkaPortal}}/app/send twice with two distinct tags ("KAFKA-SEQ-A-…" then "KAFKA-SEQ-B-…"), each answered 200; {{kafkaPortal}}/app/ledger?q=<tag> then holds exactly one send row for each tag.',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Kafka portal up and testhub reachable.',
    steps: [
      kafkaSend('KAFKA-SEQ-A-{{rand}}-{{ts}}', 'first send with tag A'),
      kafkaSend('KAFKA-SEQ-B-{{rand}}-{{ts}}', 'second send with tag B'),
      ledgerHasOne('{{kafkaPortal}}', 'KAFKA-SEQ-A-{{rand}}-{{ts}}', { direction: 'send', 'payload.echo': 'KAFKA-SEQ-A-{{rand}}-{{ts}}' }, 'the first send'),
      ledgerHasOne('{{kafkaPortal}}', 'KAFKA-SEQ-B-{{rand}}-{{ts}}', { direction: 'send', 'payload.echo': 'KAFKA-SEQ-B-{{rand}}-{{ts}}' }, 'the second send'),
    ],
    tags: ['integration', 'portal', 'kafka', 'round-trip', 'multi-message'],
    dataProfile: { profile: 'synthetic', data: 'Two disposable Kafka messages with distinct per-run tags.', source: 'generated at run time' },
    expected: 'Both sends accepted; the record holds exactly one entry for each tag.',
  },
  {
    key: 'SB-KAFKA-PORTAL-INVALID-SEND-REJECTED',
    name: 'Kafka portal handles an empty send without a server error',
    objective: 'Confirm the portal does not crash on an empty send: it sends its placeholder message instead and records that, so an operator sees what really went out.',
    description: 'POST {{kafkaPortal}}/app/send with an empty body answers 200: the portal substitutes the placeholder payload {MsgId:"KAFKA-APP"}, sends it on the default topic and returns the stored send row with results[0].ok true.',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Kafka portal up; testhub reachable.',
    steps: [
      { action: 'request', method: 'POST', url: '{{kafkaPortal}}/app/send', body: {},
        expected_status: 200,
        expect_json: [{ path: 'direction', equals: 'send' }, { path: 'topic', equals: 'sandbench.out' }, { path: 'payload.MsgId', equals: 'KAFKA-APP' }, { path: 'results.0.ok', equals: true }],
        description: 'empty send: the placeholder message goes out on the default topic' },
    ],
    tags: ['integration', 'portal', 'kafka', 'error-handling'],
    dataProfile: { profile: 'adversarial', data: 'An empty object; no topic, no payload.', source: 'inline' },
    expected: '200 with the placeholder payload recorded as a send.',
  },
  {
    key: 'SB-KAFKA-PORTAL-UI-SIGNATURE',
    name: 'Kafka portal landing page carries its own name',
    objective: 'Confirm a person browsing to the portal sees the Kafka desk, not a bare directory or someone else\'s page.',
    description: 'GET {{kafkaPortal}}/ returns 200 HTML whose title is "Kafka Desk — GARVIQ Labs".',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Kafka portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{kafkaPortal}}/', expected_status: 200,
        expect_headers: HTML, expected_body_contains: '<title>Kafka Desk', description: 'portal landing page' },
    ],
    tags: ['integration', 'portal', 'kafka', 'ui-signature'],
    dataProfile: READ_ONLY,
    expected: '200 HTML titled "Kafka Desk".',
  },
  {
    key: 'SB-KAFKA-PORTAL-DECOUPLED-FROM-SBE',
    name: 'Kafka portal keeps answering when Sand Bench\'s API is irrelevant to it',
    objective: 'Confirm the portal is its own service: it reports itself as independent of Sand Bench and needs no sign-in of its own to answer.',
    description: 'GET {{kafkaPortal}}/health advertises decoupled true and basicAuth false — the portal answers without calling the Sand Bench API and without credentials.',
    suiteKey: 'sb-kafka-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{kafkaPortal}}/health', expected_status: 200,
        expect_json: [{ path: 'decoupled', equals: true }, { path: 'basicAuth', equals: false }], description: 'portal reports decoupled true' },
    ],
    tags: ['integration', 'portal', 'kafka', 'architecture'],
    dataProfile: READ_ONLY,
    expected: 'decoupled true in /health.',
  },
);

/* ------------------------------------------------------------------------- */
/* MQ portal                                                                 */
/* ------------------------------------------------------------------------- */

const mqSend = (tag: string, description: string) => ({
  action: 'request', method: 'POST', url: '{{mqPortal}}/app/send',
  body: { target: 'testhub', queue: 'DEV.QUEUE.1', payload: { echo: tag } },
  expected_status: 200,
  expect_json: [
    { path: 'direction', equals: 'send' },
    { path: 'queue', equals: 'DEV.QUEUE.1' },
    { path: 'payload.echo', equals: tag },
    { path: 'results.0.via', equals: 'testhub' },
    { path: 'results.0.ok', equals: true },
    { path: 'results.0.status', equals: 200 },
    { path: 'results.0.body.captured', equals: true },
  ],
  description,
  text: 'Ask the message-queue portal to send one message carrying a tag unique to this run',
  expected: 'The portal sends it over the test hub and reports that the test hub captured it.',
});

C.push(
  {
    key: 'SB-MQ-PORTAL-HEALTH',
    name: 'MQ portal answers that it is healthy',
    objective: 'Confirm the MQ portal is up and names itself.',
    description: 'GET {{mqPortal}}/health must return 200 with status "ok", service "mqportal" and decoupled true.',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: 'gavriq-mq-desk compose project up; port 8092 reachable from the worker.',
    steps: [
      { action: 'request', method: 'GET', url: '{{mqPortal}}/health', expected_status: 200,
        expect_json: [{ path: 'status', equals: 'ok' }, { path: 'service', equals: 'mqportal' }, { path: 'decoupled', equals: true }],
        description: 'portal /health' },
    ],
    tags: ['integration', 'portal', 'mq'],
    dataProfile: READ_ONLY,
    expected: '200 with service "mqportal".',
  },
  {
    key: 'SB-MQ-PORTAL-READY',
    name: 'MQ portal reports it is ready for traffic',
    objective: 'Confirm the MQ portal answers that it is ready to send and receive.',
    description: 'GET {{mqPortal}}/ready returns 200 {"ready":true}.',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'MQ portal container healthy.',
    steps: [
      { action: 'request', method: 'GET', url: '{{mqPortal}}/ready', expected_status: 200,
        expect_json: [{ path: 'ready', equals: true }], description: 'portal /ready' },
    ],
    tags: ['integration', 'portal', 'mq'],
    dataProfile: READ_ONLY,
    expected: '200 {"ready":true}.',
  },
  {
    key: 'SB-MQ-PORTAL-SBE-TESTHUB-REACHABLE',
    name: 'MQ portal can reach the Sand Bench testhub',
    objective: 'Confirm the MQ portal can talk to the testhub — the wire every send and receive goes through on staging.',
    description: 'GET {{mqPortal}}/app/status returns 200 and reports testhub.ok true with status 200 against the testhub base it was configured with.',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: 'Sand Bench testhub up on {{testhub}}; portal env SBE_STUB_BASE points at it.',
    steps: [
      { action: 'request', method: 'GET', url: '{{mqPortal}}/app/status', expected_status: 200,
        expect_json: [{ path: 'testhub.ok', equals: true }, { path: 'testhub.status', equals: 200 }], description: 'portal /app/status' },
    ],
    tags: ['integration', 'portal', 'mq', 'connectivity'],
    dataProfile: READ_ONLY,
    expected: 'testhub.ok true and testhub.status 200 in /app/status.',
  },
  {
    key: 'SB-MQ-PORTAL-HEADERS-CATALOG',
    name: 'MQ portal publishes its header catalogue',
    objective: 'Confirm the portal describes the headers every MQ message carries.',
    description: 'GET {{mqPortal}}/app/headers returns 200 with a non-empty data array including the required header "x-sandbench-origin" with the value "mq".',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'MQ portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{mqPortal}}/app/headers', expected_status: 200,
        expect_json: [{ path: 'data', min_length: 1 }, { path: 'data', some: { name: 'x-sandbench-origin', value: 'mq', required: true } }],
        description: 'portal /app/headers' },
    ],
    tags: ['integration', 'portal', 'mq', 'catalog'],
    dataProfile: READ_ONLY,
    expected: 'Header catalogue naming x-sandbench-origin = mq as required.',
  },
  {
    key: 'SB-MQ-PORTAL-LOG-READABLE',
    name: 'MQ portal activity log is readable',
    objective: 'Confirm the MQ portal returns its recent-activity list cleanly.',
    description: 'GET {{mqPortal}}/app/log returns 200 with a data array.',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'MQ portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{mqPortal}}/app/log', expected_status: 200,
        expect_json: [{ path: 'data', exists: true }], description: 'portal /app/log' },
    ],
    tags: ['integration', 'portal', 'mq', 'log'],
    dataProfile: READ_ONLY,
    expected: '200 with a data array.',
  },
  {
    key: 'SB-MQ-PORTAL-SEND-ACCEPTED',
    name: 'MQ portal accepts a well-formed send via testhub',
    objective: 'Confirm a well-formed send to the testhub wire is accepted, arrives on the testhub, and is recorded once by the portal.',
    description: 'POST {{mqPortal}}/app/send {target:"testhub",queue:"DEV.QUEUE.1",payload:{echo:<tag>}} answers 200 with the stored row (direction send) and results[0] {via:testhub, ok:true, status:200, body.captured:true}. {{testhub}}/hub/inbox?channel=mq then holds an mq row with that payload on queue DEV.QUEUE.1, and {{mqPortal}}/app/ledger?q=<tag> holds exactly one send row.',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'MQ portal up; testhub reachable.',
    steps: [
      mqSend('MQ-RT-{{rand}}-{{ts}}', 'portal /app/send via testhub'),
      { action: 'request', method: 'GET', url: '{{testhub}}/hub/inbox?channel=mq', expected_status: 200,
        expect_json: [{ path: 'data', some: { channel: 'mq', queue: 'DEV.QUEUE.1', status: 200, 'payload.echo': 'MQ-RT-{{rand}}-{{ts}}' } }],
        poll: { timeout_ms: 5000, interval_ms: 500 },
        description: 'testhub inbox holds the message on queue DEV.QUEUE.1',
        text: 'Look for that message in the test hub\'s inbox for the message-queue channel',
        expected: 'The test hub lists the message.' },
      ledgerHasOne('{{mqPortal}}', 'MQ-RT-{{rand}}-{{ts}}', { direction: 'send', queue: 'DEV.QUEUE.1', 'payload.echo': 'MQ-RT-{{rand}}-{{ts}}' }, 'the send'),
    ],
    tags: ['integration', 'portal', 'mq', 'round-trip'],
    dataProfile: { profile: 'synthetic', data: 'A disposable MQ payload tagged with a per-run value.', source: 'generated at run time' },
    expected: 'Send accepted; the message is in the testhub inbox and recorded once in the portal.',
  },
  {
    key: 'SB-MQ-PORTAL-MULTI-SEND-INDEPENDENT',
    name: 'MQ portal records two sequential sends as independent entries',
    objective: 'Confirm two sends in a row both land in the portal\'s record, each keeping its own tag — proof that one send does not clobber or shadow the next.',
    description: 'POST {{mqPortal}}/app/send twice with two distinct per-run tags, each answered 200; {{mqPortal}}/app/ledger?q=<tag> then holds exactly one send row for each tag.',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'MQ portal up and testhub reachable.',
    steps: [
      mqSend('MQ-SEQ-A-{{rand}}-{{ts}}', 'first send with tag A'),
      mqSend('MQ-SEQ-B-{{rand}}-{{ts}}', 'second send with tag B'),
      ledgerHasOne('{{mqPortal}}', 'MQ-SEQ-A-{{rand}}-{{ts}}', { direction: 'send', 'payload.echo': 'MQ-SEQ-A-{{rand}}-{{ts}}' }, 'the first send'),
      ledgerHasOne('{{mqPortal}}', 'MQ-SEQ-B-{{rand}}-{{ts}}', { direction: 'send', 'payload.echo': 'MQ-SEQ-B-{{rand}}-{{ts}}' }, 'the second send'),
    ],
    tags: ['integration', 'portal', 'mq', 'round-trip', 'multi-message'],
    dataProfile: { profile: 'synthetic', data: 'Two disposable MQ payloads with distinct per-run tags.', source: 'generated at run time' },
    expected: 'Both sends accepted; the record holds exactly one entry for each tag.',
  },
  {
    key: 'SB-MQ-PORTAL-INVALID-SEND-REJECTED',
    name: 'MQ portal handles an empty send without a server error',
    objective: 'Confirm the portal does not crash on an empty send: it sends its placeholder message instead and records that, so an operator sees what really went out.',
    description: 'POST {{mqPortal}}/app/send with an empty body answers 200: the portal substitutes the placeholder payload {text:"MQ-APP"}, sends it on the default queue DEV.QUEUE.1 and returns the stored send row with results[0].ok true.',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'MQ portal up; testhub reachable.',
    steps: [
      { action: 'request', method: 'POST', url: '{{mqPortal}}/app/send', body: {},
        expected_status: 200,
        expect_json: [{ path: 'direction', equals: 'send' }, { path: 'queue', equals: 'DEV.QUEUE.1' }, { path: 'payload.text', equals: 'MQ-APP' }, { path: 'results.0.ok', equals: true }],
        description: 'empty send: the placeholder message goes out on the default queue' },
    ],
    tags: ['integration', 'portal', 'mq', 'error-handling'],
    dataProfile: { profile: 'adversarial', data: 'An empty object.', source: 'inline' },
    expected: '200 with the placeholder payload recorded as a send.',
  },
  {
    key: 'SB-MQ-PORTAL-UI-SIGNATURE',
    name: 'MQ portal landing page carries its own name',
    objective: 'Confirm a person browsing to the portal sees the MQ desk.',
    description: 'GET {{mqPortal}}/ returns 200 HTML whose title is "MQ Application — GARVIQ Labs".',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'MQ portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{mqPortal}}/', expected_status: 200,
        expect_headers: HTML, expected_body_contains: '<title>MQ Application', description: 'portal landing page' },
    ],
    tags: ['integration', 'portal', 'mq', 'ui-signature'],
    dataProfile: READ_ONLY,
    expected: '200 HTML titled "MQ Application".',
  },
  {
    key: 'SB-MQ-PORTAL-DECOUPLED-FROM-SBE',
    name: 'MQ portal keeps answering independently of Sand Bench',
    objective: 'Confirm the MQ portal is architecturally independent.',
    description: 'GET {{mqPortal}}/health reports decoupled true.',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'MQ portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{mqPortal}}/health', expected_status: 200,
        expect_json: [{ path: 'decoupled', equals: true }], description: 'portal reports decoupled true' },
    ],
    tags: ['integration', 'portal', 'mq', 'architecture'],
    dataProfile: READ_ONLY,
    expected: 'decoupled true.',
  },
  {
    key: 'SB-MQ-PORTAL-UNKNOWN-ROUTE-404',
    name: 'MQ portal returns a clean 404 for unknown paths',
    objective: 'Confirm the portal clearly reports that an unknown page cannot be found, so a wrong address does not crash the service.',
    description: 'GET {{mqPortal}}/does/not/exist returns 404 {"error":"not found"}.',
    suiteKey: 'sb-mq-portal', testType: 'integration', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'MQ portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{mqPortal}}/does/not/exist', expected_status: 404,
        expect_json: NOT_FOUND, description: 'unknown path returns 404' },
    ],
    tags: ['integration', 'portal', 'mq', 'error-handling'],
    dataProfile: { profile: 'adversarial', data: 'A random unmapped path.', source: 'inline' },
    expected: '404 "not found" on unknown path.',
  },
);

/* ------------------------------------------------------------------------- */
/* FTP portal                                                                */
/* ------------------------------------------------------------------------- */

C.push(
  {
    key: 'SB-FTP-PORTAL-HEALTH',
    name: 'FTP portal answers that it is healthy',
    objective: 'Confirm the FTP portal is running and names itself.',
    description: 'GET {{ftpPortal}}/health returns 200 with status "ok", service "ftpdesk" and reports the FTP root it reads from.',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: 'gavriq-ftp-desk compose project up; port 18102 reachable from the worker.',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/health', expected_status: 200,
        expect_json: [{ path: 'status', equals: 'ok' }, { path: 'service', equals: 'ftpdesk' }, { path: 'root', exists: true }],
        description: 'portal /health' },
    ],
    tags: ['integration', 'portal', 'ftp'],
    dataProfile: READ_ONLY,
    expected: '200 with service "ftpdesk".',
  },
  {
    key: 'SB-FTP-PORTAL-READY',
    name: 'FTP portal reports it is ready',
    objective: 'Confirm the FTP portal is ready for its reads.',
    description: 'GET {{ftpPortal}}/ready returns 200 {"ready":true}.',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'FTP portal container healthy.',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/ready', expected_status: 200,
        expect_json: [{ path: 'ready', equals: true }], description: 'portal /ready' },
    ],
    tags: ['integration', 'portal', 'ftp'],
    dataProfile: READ_ONLY,
    expected: '200 {"ready":true}.',
  },
  {
    key: 'SB-FTP-PORTAL-FILES-LIST',
    name: 'FTP portal lists the files on the shared volume',
    objective: 'Confirm the FTP portal returns a file listing — empty or not — rather than erroring on the shared FTP volume read.',
    description: 'GET {{ftpPortal}}/app/files returns 200 with a data array (possibly empty) representing files under the configured root.',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: 'FTP portal up; FTP data volume mounted read-only (may be empty on staging).',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/files', expected_status: 200,
        expect_json: [{ path: 'data', exists: true }], description: 'portal /app/files' },
    ],
    tags: ['integration', 'portal', 'ftp', 'files'],
    dataProfile: { profile: 'none (read-only)', data: 'A single GET; volume is mounted read-only.', source: 'n/a' },
    expected: '200 with a data array.',
  },
  {
    key: 'SB-FTP-PORTAL-FILES-PREFIX-FILTER-ACCEPTED',
    name: 'FTP portal accepts a prefix filter without error',
    objective: 'Confirm the file listing can be narrowed to names that start with a given text, and that a text no file starts with gives an empty list rather than everything.',
    description: 'GET {{ftpPortal}}/app/files?prefix=none/nowhere/ returns 200 with an empty data array: no file name starts with that prefix.',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'FTP portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/files?prefix=none/nowhere/', expected_status: 200,
        expect_json: [{ path: 'data', exists: true }, { path: 'data', max_length: 0 }], description: 'portal /app/files?prefix= with a prefix nothing matches' },
    ],
    tags: ['integration', 'portal', 'ftp', 'filter'],
    dataProfile: { profile: 'none (read-only)', data: 'A prefix query string on a GET.', source: 'inline' },
    expected: '200 with an empty data array.',
  },
  {
    key: 'SB-FTP-PORTAL-LOG-READABLE',
    name: 'FTP portal recent-arrivals log is readable',
    objective: 'Confirm the recent-arrivals view returns cleanly even with no deliveries yet.',
    description: 'GET {{ftpPortal}}/app/log returns 200 with a data array.',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'FTP portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/log', expected_status: 200,
        expect_json: [{ path: 'data', exists: true }], description: 'portal /app/log' },
    ],
    tags: ['integration', 'portal', 'ftp', 'log'],
    dataProfile: READ_ONLY,
    expected: '200 with a data array.',
  },
  {
    key: 'SB-FTP-PORTAL-LEDGER-SEARCH',
    name: 'FTP portal ledger search answers cleanly with no match',
    objective: 'Confirm searching the delivered files for a text that occurs nowhere gives an empty result and repeats what was searched for.',
    description: 'GET {{ftpPortal}}/app/ledger?q=NO-SUCH-NEEDLE-<per-run> returns 200 with query equal to the search text and an empty data array.',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'FTP portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/ledger?q=NO-SUCH-NEEDLE-{{rand}}-{{ts}}', expected_status: 200,
        expect_json: [{ path: 'query', equals: 'NO-SUCH-NEEDLE-{{rand}}-{{ts}}' }, { path: 'data', exists: true }, { path: 'data', max_length: 0 }],
        description: 'portal /app/ledger?q= with a text nothing contains' },
    ],
    tags: ['integration', 'portal', 'ftp', 'search'],
    dataProfile: { profile: 'synthetic', data: 'A search text unique to this run, which no file can contain.', source: 'generated at run time' },
    expected: '200 with no matches and the query echoed.',
  },
  {
    key: 'SB-FTP-PORTAL-FILE-OUT-OF-ROOT-REFUSED',
    name: 'FTP portal refuses a path that escapes the FTP root',
    objective: 'Confirm the portal refuses a file name that tries to climb out of its own folder — the first guard against reading files it must not show.',
    description: 'GET {{ftpPortal}}/app/file?name=../etc/passwd returns 400 {"error":"invalid file name"}; the download route answers the same way.',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'FTP portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/file?name=../etc/passwd',
        expected_status: 400, expect_json: [{ path: 'error', equals: 'invalid file name' }],
        expected_body_not_contains: 'root:', description: 'view route refuses the escape' },
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/download?name=../../etc/passwd',
        expected_status: 400, expect_json: [{ path: 'error', equals: 'invalid file name' }],
        expected_body_not_contains: 'root:', description: 'download route refuses the escape' },
    ],
    tags: ['integration', 'portal', 'ftp', 'security'],
    dataProfile: { profile: 'adversarial', data: 'File names with parent-directory components.', source: 'inline' },
    expected: '400 "invalid file name" on both routes; no file content returned.',
  },
  {
    key: 'SB-FTP-PORTAL-FILE-NOT-FOUND-CLEAN-404',
    name: 'FTP portal returns a clean 404 for a missing file name',
    objective: 'Confirm the portal clearly reports when a requested file does not exist, so the operator can distinguish a missing file from a successful download.',
    description: 'GET {{ftpPortal}}/app/file?name=no-such-file-<per-run>.txt returns 404 {"error":"file not found"}.',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'FTP portal up; FTP root mounted.',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/file?name=no-such-file-{{rand}}-{{ts}}.txt',
        expected_status: 404, expect_json: [{ path: 'error', equals: 'file not found' }], description: 'missing file returns a clean 404' },
    ],
    tags: ['integration', 'portal', 'ftp', 'files', 'error-handling'],
    dataProfile: { profile: 'synthetic', data: 'A file name unique to this run, which cannot exist on the FTP volume.', source: 'generated at run time' },
    expected: '404 "file not found".',
  },
  {
    key: 'SB-FTP-PORTAL-UI-SIGNATURE',
    name: 'FTP portal landing page carries its own name',
    objective: 'Confirm the portal\'s page shows it is the FTP desk.',
    description: 'GET {{ftpPortal}}/ returns 200 HTML whose title is "FTP Application — GARVIQ Labs".',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'FTP portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/', expected_status: 200,
        expect_headers: HTML, expected_body_contains: '<title>FTP Application', description: 'portal landing page' },
    ],
    tags: ['integration', 'portal', 'ftp', 'ui-signature'],
    dataProfile: READ_ONLY,
    expected: '200 HTML titled "FTP Application".',
  },
  {
    key: 'SB-FTP-PORTAL-UNKNOWN-ROUTE-404',
    name: 'FTP portal returns a clean 404 for unknown paths',
    objective: 'Confirm the portal clearly reports that an unknown page cannot be found, rather than crashing.',
    description: 'GET {{ftpPortal}}/does/not/exist returns 404 {"error":"not found"}.',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'FTP portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/does/not/exist', expected_status: 404,
        expect_json: NOT_FOUND, description: 'unknown path returns 404' },
    ],
    tags: ['integration', 'portal', 'ftp', 'error-handling'],
    dataProfile: { profile: 'adversarial', data: 'A random unmapped path.', source: 'inline' },
    expected: '404 "not found" on unknown path.',
  },
  {
    key: 'SB-FTP-PORTAL-ROOT-ADVERTISED',
    name: 'FTP portal advertises the FTP root it reads from',
    objective: 'Confirm the portal tells operators which folder it is reading from, so a wrong mount is obvious — here the folder Sand Bench shares with it.',
    description: 'GET {{ftpPortal}}/health returns root "/ftp/sandbench": the "sandbench" folder of the volume the staging Sand Bench stack shares with the portal (sbe-shared-ftp mounted at /ftp).',
    suiteKey: 'sb-ftp-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'FTP portal deployed with deploy/portals/deploy.mjs (shared volume mounted at /ftp).',
    steps: [
      { action: 'request', method: 'GET', url: '{{ftpPortal}}/health', expected_status: 200,
        expect_json: [{ path: 'root', equals: '/ftp/sandbench' }], description: 'portal /health root' },
    ],
    tags: ['integration', 'portal', 'ftp', 'contract'],
    dataProfile: READ_ONLY,
    expected: '200 with root "/ftp/sandbench".',
  },
);

/* ------------------------------------------------------------------------- */
/* API portal                                                                */
/* ------------------------------------------------------------------------- */

const apiInbound = (path: string, body: Record<string, unknown>, description: string) => ({
  action: 'request', method: 'POST', url: `{{apiPortal}}${path}`, body,
  expected_status: 200,
  expect_json: [{ path: 'received', equals: true }, { path: 'path', equals: path }, { path: 'contentType', equals: 'application/json' }, { path: 'bytes', min: 1 }],
  description,
  text: 'Deliver one message to the API portal, carrying a tag unique to this run',
  expected: 'The portal answers that it received the message.',
});

C.push(
  {
    key: 'SB-API-PORTAL-HEALTH',
    name: 'API portal answers that it is healthy',
    objective: 'Confirm the standalone API portal is up, names itself and keeps its record in its own database.',
    description: 'GET {{apiPortal}}/health returns 200 with status "ok", service "apiportal", decoupled true and mode "postgres" (the ledger is kept in the portal\'s own database, not in memory).',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: 'gavriq-api-desk compose project up; port 8093 reachable; its Postgres healthy.',
    steps: [
      { action: 'request', method: 'GET', url: '{{apiPortal}}/health', expected_status: 200,
        expect_json: [{ path: 'status', equals: 'ok' }, { path: 'service', equals: 'apiportal' }, { path: 'mode', equals: 'postgres' }],
        description: 'portal /health' },
    ],
    tags: ['integration', 'portal', 'api'],
    dataProfile: READ_ONLY,
    expected: '200 with service "apiportal" and mode "postgres".',
  },
  {
    key: 'SB-API-PORTAL-READY',
    name: 'API portal reports it is ready',
    objective: 'Confirm the API portal considers its ledger reachable and is ready for traffic.',
    description: 'GET {{apiPortal}}/ready returns 200 with ready true and mode "postgres" — the portal ran a query against its database before answering.',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'API portal container healthy; its database healthy.',
    steps: [
      { action: 'request', method: 'GET', url: '{{apiPortal}}/ready', expected_status: 200,
        expect_json: [{ path: 'ready', equals: true }, { path: 'mode', equals: 'postgres' }],
        description: 'portal /ready' },
    ],
    tags: ['integration', 'portal', 'api'],
    dataProfile: READ_ONLY,
    expected: '200 with ready true and mode "postgres".',
  },
  {
    key: 'SB-API-PORTAL-SBE-APP-REACHABLE',
    name: 'API portal can reach the Sand Bench application',
    objective: 'Confirm the API portal can call back into Sand Bench — a prerequisite for every downstream round-trip test.',
    description: 'GET {{apiPortal}}/app/status returns 200 and reports app.ok true with status 200 against the Sand Bench API base it was configured with.',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: 'Sand Bench API up on {{api}}; portal env SBE_APP_BASE points at it.',
    steps: [
      { action: 'request', method: 'GET', url: '{{apiPortal}}/app/status', expected_status: 200,
        expect_json: [{ path: 'app.ok', equals: true }, { path: 'app.status', equals: 200 }], description: 'portal /app/status' },
    ],
    tags: ['integration', 'portal', 'api', 'connectivity'],
    dataProfile: READ_ONLY,
    expected: 'app.ok true and app.status 200 in /app/status.',
  },
  {
    key: 'SB-API-PORTAL-HEADERS-CATALOG',
    name: 'API portal publishes its header catalogue',
    objective: 'Confirm the portal returns the headers every inbound call is expected to carry.',
    description: 'GET {{apiPortal}}/app/headers returns 200 with a non-empty data array including the required header "x-sandbench-origin" with the value "api".',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'API portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{apiPortal}}/app/headers', expected_status: 200,
        expect_json: [{ path: 'data', min_length: 1 }, { path: 'data', some: { name: 'x-sandbench-origin', value: 'api', required: true } }],
        description: 'portal /app/headers' },
    ],
    tags: ['integration', 'portal', 'api', 'catalog'],
    dataProfile: READ_ONLY,
    expected: 'Header catalogue naming x-sandbench-origin = api as required.',
  },
  {
    key: 'SB-API-PORTAL-INBOUND-RECORD',
    name: 'API portal records an inbound call in its ledger',
    objective: 'Confirm the portal\'s inbound endpoint records what it receives — the core of the "downstream API" simulation.',
    description: 'POST {{apiPortal}}/inbound/pacs.008 with a tagged JSON body answers 200 {received:true, path:"/inbound/pacs.008", contentType:"application/json"}. {{apiPortal}}/app/ledger?q=<tag> then holds exactly one row: direction receive, that path, payload.tag = the tag.',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: 'API portal up; its ledger reachable.',
    steps: [
      apiInbound('/inbound/pacs.008', { tag: 'API-RT-{{rand}}-{{ts}}', payload: { msg: 'api-portal-inbound' } }, 'portal /inbound/pacs.008'),
      ledgerHasOne('{{apiPortal}}', 'API-RT-{{rand}}-{{ts}}', { direction: 'receive', path: '/inbound/pacs.008', 'payload.tag': 'API-RT-{{rand}}-{{ts}}' }, 'the received message'),
    ],
    tags: ['integration', 'portal', 'api', 'inbound', 'round-trip'],
    dataProfile: { profile: 'synthetic', data: 'A disposable inbound body tagged with a per-run value.', source: 'generated at run time' },
    expected: 'Inbound accepted; the record holds exactly one entry with the tag.',
  },
  {
    key: 'SB-API-PORTAL-HOOK-RECORDS',
    name: 'API portal /hook records a posted payload',
    objective: 'Confirm the portal\'s general-purpose receiving address accepts a message and records it, the way Sand Bench\'s own copies arrive.',
    description: 'POST {{apiPortal}}/hook with a tagged body answers 202 {accepted:true} with the saved row (direction receive, path "/hook"). {{apiPortal}}/app/ledger?q=<tag> then holds exactly one row with that payload.',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'API portal up.',
    steps: [
      { action: 'request', method: 'POST', url: '{{apiPortal}}/hook',
        body: { kind: 'api-portal-hook', hooktag: 'HOOK-{{rand}}-{{ts}}' },
        expected_status: 202,
        expect_json: [{ path: 'accepted', equals: true }, { path: 'saved.direction', equals: 'receive' }, { path: 'saved.path', equals: '/hook' }, { path: 'saved.payload.hooktag', equals: 'HOOK-{{rand}}-{{ts}}' }],
        description: 'portal /hook' },
      ledgerHasOne('{{apiPortal}}', 'HOOK-{{rand}}-{{ts}}', { direction: 'receive', path: '/hook', 'payload.hooktag': 'HOOK-{{rand}}-{{ts}}' }, 'the hooked message'),
    ],
    tags: ['integration', 'portal', 'api', 'hook'],
    dataProfile: { profile: 'synthetic', data: 'A tagged payload for the hook sink.', source: 'generated at run time' },
    expected: 'Hook accepted (202); the record holds exactly one entry with the tag.',
  },
  {
    key: 'SB-API-PORTAL-EXPORT-JSON',
    name: 'API portal exports its ledger as JSON',
    objective: 'Confirm the portal can hand over its ledger as a JSON download, which operators use to audit a run.',
    description: 'GET {{apiPortal}}/app/export returns 200 with content type application/json and a download file name "apidesk-ledger.json".',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'API portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{apiPortal}}/app/export', expected_status: 200,
        expect_headers: [{ name: 'content-type', contains: 'application/json' }, { name: 'content-disposition', contains: 'attachment; filename=apidesk-ledger.json' }],
        description: 'portal /app/export' },
    ],
    tags: ['integration', 'portal', 'api', 'export'],
    dataProfile: READ_ONLY,
    expected: '200 JSON offered as the download "apidesk-ledger.json".',
  },
  {
    key: 'SB-API-PORTAL-EXPORT-REFLECTS-INBOUND',
    name: 'API portal export contains an inbound record posted moments earlier',
    objective: 'Confirm the ledger export is a true record of what the portal received — an inbound call with a unique tag is visible in the export seconds later.',
    description: 'POST {{apiPortal}}/inbound/pacs.008 with a per-run tag answers 200 received:true. GET {{apiPortal}}/app/export then returns 200 JSON (download "apidesk-ledger.json") whose text contains that tag.',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'API portal up; its ledger reachable; export endpoint enabled.',
    steps: [
      apiInbound('/inbound/pacs.008', { tag: 'API-EXP-{{rand}}-{{ts}}', payload: { msg: 'api-portal-export-reflects' } }, 'inbound call tagged for later lookup'),
      { action: 'request', method: 'GET', url: '{{apiPortal}}/app/export', expected_status: 200,
        expect_headers: [{ name: 'content-type', contains: 'application/json' }, { name: 'content-disposition', contains: 'apidesk-ledger.json' }],
        expected_body_contains: 'API-EXP-{{rand}}-{{ts}}',
        poll: { timeout_ms: 5000, interval_ms: 500 },
        description: 'export JSON contains the tag' },
    ],
    tags: ['integration', 'portal', 'api', 'export', 'round-trip'],
    dataProfile: { profile: 'synthetic', data: 'A disposable inbound body tagged with a per-run value.', source: 'generated at run time' },
    expected: 'Inbound accepted; the ledger export carries the tag.',
  },
  {
    key: 'SB-API-PORTAL-UI-SIGNATURE',
    name: 'API portal landing page carries its own name',
    objective: 'Confirm the portal\'s page shows it is the API desk.',
    description: 'GET {{apiPortal}}/ returns 200 HTML whose title is "API Desk — GARVIQ Labs".',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'API portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{apiPortal}}/', expected_status: 200,
        expect_headers: HTML, expected_body_contains: '<title>API Desk', description: 'portal landing page' },
    ],
    tags: ['integration', 'portal', 'api', 'ui-signature'],
    dataProfile: READ_ONLY,
    expected: '200 HTML titled "API Desk".',
  },
  {
    key: 'SB-API-PORTAL-DECOUPLED-FROM-SBE',
    name: 'API portal keeps answering independently of Sand Bench',
    objective: 'Confirm the API portal is its own service and says so when asked how it is.',
    description: 'GET {{apiPortal}}/health reports decoupled true; the health answer is produced without calling the Sand Bench API.',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'API portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{apiPortal}}/health', expected_status: 200,
        expect_json: [{ path: 'decoupled', equals: true }], description: 'portal reports decoupled true' },
    ],
    tags: ['integration', 'portal', 'api', 'architecture'],
    dataProfile: READ_ONLY,
    expected: 'decoupled true.',
  },
  {
    key: 'SB-API-PORTAL-UNKNOWN-ROUTE-404',
    name: 'API portal returns a clean 404 for unknown paths',
    objective: 'Confirm the portal clearly reports that an unknown page cannot be found, so a wrong address does not crash the service.',
    description: 'GET {{apiPortal}}/does/not/exist returns 404 {"error":"not found"}.',
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'API portal up.',
    steps: [
      { action: 'request', method: 'GET', url: '{{apiPortal}}/does/not/exist', expected_status: 404,
        expect_json: NOT_FOUND, description: 'unknown path returns 404' },
    ],
    tags: ['integration', 'portal', 'api', 'error-handling'],
    dataProfile: { profile: 'adversarial', data: 'A random unmapped path.', source: 'inline' },
    expected: '404 "not found" on unknown path.',
  },
);

/* ------------------------------------------------------------------------- */
/* API portal — ISO consumer coverage                                        */
/* ------------------------------------------------------------------------- */

const ISO_TYPES: { code: string; title: string }[] = [
  { code: 'pacs.008.001.14', title: 'Customer Credit Transfer (v14)' },
  { code: 'pacs.008.001.08', title: 'FI to FI Customer Credit Transfer (v8)' },
  { code: 'pain.001.001.09', title: 'Customer Credit Transfer Initiation' },
  { code: 'pain.002.001.10', title: 'Customer Payment Status Report' },
  { code: 'camt.053.001.08', title: 'Bank to Customer Statement' },
];

for (const t of ISO_TYPES) {
  const safeKey = 'SB-API-PORTAL-INBOUND-' + t.code.replace(/\./g, '-').toUpperCase();
  const tag = `API-ISO-${t.code.toUpperCase().replace(/\./g, '-')}-{{rand}}-{{ts}}`;
  C.push({
    key: safeKey,
    name: `API portal consumes a ${t.code} inbound call`,
    objective: `Confirm the standalone API portal records a ${t.title} (${t.code}) message when it arrives at the address for that kind of message.`,
    description: `POST {{apiPortal}}/inbound/${t.code} with a per-run tag answers 200 {received:true, path:"/inbound/${t.code}"}; {{apiPortal}}/app/ledger?q=<tag> then holds exactly one row: direction receive, that path, payload.messageTypeCode ${t.code}.`,
    suiteKey: 'sb-api-portal', testType: 'integration', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'API portal up; ledger reachable.',
    steps: [
      apiInbound(`/inbound/${t.code}`, { tag, messageTypeCode: t.code, payload: { msg: `api-portal-${t.code}` } }, `portal /inbound/${t.code}`),
      ledgerHasOne('{{apiPortal}}', tag, { direction: 'receive', path: `/inbound/${t.code}`, 'payload.tag': tag, 'payload.messageTypeCode': t.code }, `the received ${t.code} message`),
    ],
    tags: ['integration', 'portal', 'api', 'iso', t.code],
    dataProfile: { profile: 'synthetic', data: `A disposable inbound body tagged with the ${t.code} code.`, source: 'generated at run time' },
    expected: `Inbound accepted; the record holds exactly one entry with the tag for ${t.code}.`,
  });
}

// The portal send histories and API receive ledger expose no per-entry delete
// operation. /app/clear only clears received inbox entries; it cannot undo a
// send and must never be used to wipe unrelated records. Record the supported
// lifecycle limitation explicitly instead of pretending these cases clean up.
for (const c of C) {
  const writesLedger = (c.steps || []).some((step: any) => step.method === 'POST' &&
    /^\{\{(?:kafkaPortal|mqPortal|apiPortal)\}\}\/(?:app\/send|hook|inbound(?:\/|$))/.test(String(step.url)));
  if (writesLedger) c.atomicityNote = {
    reason: 'no-cleanup-endpoint',
    detail: 'The standalone portal exposes no delete operation for its send history or API receive ledger, and the test hub none for its inbox. Per-run correlation values isolate verification, but these append-only history rows remain; this case does not claim complete baseline restoration.',
  };
}

export const SANDBENCH_PORTAL_CASES: CaseDef[] = tagSource(FILE, C);
