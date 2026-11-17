/**
 * Event and round-trip cases for Sand Bench.
 *
 * sb-portal-roundtrip — one case per outbound channel: the path Sand Bench really
 * has to that channel's standalone portal in this environment is exercised and
 * the very message is found again, by a reference unique to the run, in the
 * portal (and on the test hub, and in the application's event log where a run is
 * involved). See the notes above the cases for what each channel can do.
 *
 * sb-event-emission — one named action per case, then the application's event
 * log is searched for the event the application's own event catalogue documents
 * for that action, tied to this case: the event code AND the person who acted
 * AND the record the case just created.
 *
 * How the application's event log is read (apps/api/src/modules/registerEventRoutes.ts
 * at the commit under test):
 *   - GET /api/v1/events filters on `class` (business | technical), `screenId`,
 *     `assetId` and `limit` (at most 500), newest first. It ignores `code`.
 *   - Every authenticated API call writes an `api.*` event of its own (reads are
 *     class business, writes are class technical), so the window moves quickly.
 *     Each case therefore reads the log straight after its action, asks for one
 *     class only, and — for run events — narrows to the "start a test run" screen.
 *   - The time bound comes from the application's own clock (GET /api/v1/ux/clock),
 *     not from the test machine's, so a clock difference between the two can
 *     neither hide an event nor let an older one through.
 *
 * What the application really does today (checked in the source and live):
 *   - recorded: biz.run.started, biz.run.completed, biz.run.rejected,
 *     biz.rule.created, biz.schema.uploaded.
 *   - catalogued and documented in the use cases, but never emitted anywhere in
 *     apps/api/src: biz.session.login.success, biz.session.login.failure,
 *     biz.console.bootstrap, biz.file.generated, biz.dataset.created,
 *     biz.case.created, biz.suite.created, biz.eventing.configured,
 *     tec.inbound.accepted.
 *   - emitted in memory only, never stored and without a tenant, so no API can
 *     read them back: tec.delivery.succeeded, tec.delivery.simulated
 *     (delivery.ts, deliverEligible).
 * The cases for the last two groups perform the real action and then fail on the
 * missing event. That is deliberate: they are application defects, not test gaps.
 */
import { type CaseDef, type SuiteDef, tagSource } from './types.js';
import { cleanupRunFixture, cleanupVersionedFixture } from './sandbench-cleanup.js';

const FILE = 'apps/api/src/catalog/sandbench-event-roundtrip-cases.ts';

export const SANDBENCH_EVENT_RT_SUITES: SuiteDef[] = [
  {
    key: 'sb-portal-roundtrip',
    name: 'Sand Bench → portal round-trips',
    description:
      'Sand Bench reaches each standalone portal end to end: a run really delivered to the API portal, a message sent to the MQ and Kafka portals over the test hub, and a file-transfer run honestly reported as simulated where no file-transfer server exists.',
    typeKey: 'apiPortalIntegration',
    category: 'qa',
  },
  {
    key: 'sb-event-emission',
    name: 'Sand Bench event emission',
    description:
      'Named actions produce the business or technical event the application documents for them, found in the application\'s own event log by event, actor and record.',
    typeKey: 'integration',
    category: 'qa',
  },
];

const BEARER = { authorization: 'Bearer {{token}}' };

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { username: '{{username}}', password: '{{password}}' },
  expected_status: 200,
  expect_json: [{ path: 'token', exists: true }, { path: 'user.id', exists: true }],
  save: { token: 'token', event_actor_id: 'user.id' },
  description: 'operator login',
  text: 'Sign in as the operator',
  expected: 'The sign-in is accepted and the application says who signed in.',
} as const;

/** The application's own clock: the time bound every event search uses. */
const READ_CLOCK = {
  action: 'request', method: 'GET', url: '{{api}}/api/v1/ux/clock', headers: BEARER,
  expected_status: 200,
  expect_json: [{ path: 'epochMs', min: 1 }],
  save: { event_since: 'epochMs' },
  description: 'read the application clock (lower time bound for the event search)',
  text: 'Note the application\'s current time, so that only events recorded from now on count',
  expected: 'The application reports its current time.',
} as const;

/** The small baseline credit-transfer message type: nine fields, one of them a unique transaction reference. */
const MESSAGE_TYPE = 'pacs.008.001.08';

/** Remove a record that is deleted with its current version tag (rules, test cases, test suites). */
function cleanupTaggedRecord(collection: 'rules' | 'test-cases' | 'test-suites', id: string) {
  const url = `{{api}}/api/v1/${collection}/{{${id}}}`;
  const etag = `${id}_cleanup_etag`;
  return [
    { action: 'request', method: 'GET', url, headers: BEARER, skip_if_missing: [id], expected_status: [200, 404], save: { [etag]: 'data.etag' },
      description: `read the current version of the case-owned ${collection} record`,
      text: 'Read the current version of this test\'s temporary record',
      expected: 'The current version is available, or the record has already been removed.' },
    { action: 'request', method: 'DELETE', url, headers: { ...BEARER, 'if-match': `{{${etag}}}` }, skip_if_missing: [id, etag], expected_status: [200, 404],
      description: `delete the case-owned ${collection} record`,
      text: 'Remove this test\'s temporary record',
      expected: 'The record is removed or was already absent.' },
    { action: 'request', method: 'GET', url, headers: BEARER, skip_if_missing: [id], expected_status: 404,
      description: `verify the case-owned ${collection} record is gone`,
      text: 'Check that the temporary record is no longer available',
      expected: 'The application reports that the record does not exist.' },
  ];
}

/* ------------------------------------------------------------------------- */
/* Portal round-trips: Sand Bench → test hub + portal, one case per channel   */
/* ------------------------------------------------------------------------- */
//
// What Sand Bench can really do towards each portal in this environment, and
// therefore what each case holds it to:
//
//   api    A test run through a saved connection whose address is the API portal
//          is a real HTTP delivery (delivery.ts postToApi, 5 s budget): the run
//          reports it acknowledged and the portal holds exactly that message.
//   mq     No queue manager or broker is configured, so a run on these channels
//   kafka  is simulated. The application's real path to these portals is "send a
//          message to an external system" (POST /external-systems/:id/send →
//          externalSystems.ts sendDummyToSystem): it puts the message on the test
//          hub and hands it to the portal, and reports both results.
//   ftp    No file-transfer server is configured (SBE_FTP_URL unset) and the FTP
//          portal only shows files that really arrived: a run is reported as
//          simulated and nothing may appear on the portal.
//
// A run also copies each message to the test hub and to the portal's /hook, but
// only on a best-effort basis (300 ms budget, then a 30 s pause after one slow
// answer — delivery.ts captureAtTesthub / captureAtChannelPortal). Under load
// those copies are skipped, so no case depends on them.

type Channel = 'api' | 'mq' | 'kafka' | 'ftp';

const HISTORY_STAYS: NonNullable<CaseDef['atomicityNote']> = {
  reason: 'no-cleanup-endpoint',
  detail: 'Everything the case creates in Sand Bench (its connection, its run) is deleted afterwards and checked to be gone. The copy of the message in the portal\'s record and on the test hub stays: both are append-only histories with no delete operation, and the message is found by a tag unique to this run.',
};

function connectionCleanup(idVar: string) {
  return [
    { action: 'request', method: 'DELETE', url: `{{api}}/api/v1/external-systems/{{${idVar}}}`, headers: BEARER,
      skip_if_missing: [idVar], expected_status: 200,
      description: 'delete the case-owned connection',
      text: 'Remove the connection this test saved', expected: 'The connection is removed.' },
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/external-systems', headers: BEARER,
      skip_if_missing: [idVar], expected_status: 200,
      expected_body_not_contains: `{{${idVar}}}`,
      description: 'verify the connection is no longer listed',
      text: 'Check that the connection is no longer listed', expected: 'The list of connections does not contain it.' },
  ];
}

const runCompletedEvent = (ch: Channel, totals: Record<string, unknown>) => ({
  action: 'request', method: 'GET', url: '{{api}}/api/v1/events?class=business&screenId=trNew&limit=500', headers: BEARER,
  expected_status: 200,
  expect_json: [{ path: 'data', some: {
    eventCode: 'biz.run.completed',
    'entity.id': '{{rt_run_id}}',
    'actor.userId': '{{event_actor_id}}',
    outcome: 'success',
    'telemetry.channel': ch,
    'telemetry.generated': 1,
    'telemetry.failed': 0,
    ...totals,
    occurredAt: { at_or_after: '{{event_since}}' },
  } }],
  poll: { timeout_ms: 5000, interval_ms: 500 },
  description: 'event log holds biz.run.completed for this run id and this operator, with the delivery totals',
  text: 'Search the application\'s event log for the "test run finished" entry of this run',
  expected: 'The entry is there, made by this operator, for this channel, with one message generated and no failed delivery.',
});

/** api: a real delivery to the API portal through a case-owned connection. */
const API_ROUND_TRIP: CaseDef = {
  key: 'SBE-RT-API-END-TO-END',
  name: 'Sand Bench API run is delivered to the API portal and reflected in Sand Bench events',
  objective: 'Confirm a test run sent through a connection to the API portal really arrives there: the run reports the message as delivered and acknowledged, the portal holds that very message, and the application\'s event log records the run as finished with one delivery.',
  description: `The case saves its own connection (PUT /api/v1/external-systems/{id}, channel api) whose endpoint is the API portal as the application reaches it (GET /api/v1/channel-targets, api entry) plus a per-run path. POST /api/v1/runs {messageTypeCode:${MESSAGE_TYPE}, count:1, connectionId} answers 202 with status completed, delivery.sent 1 and results[0] acknowledged with the portal's own answer (received:true, the per-run path). GET /api/v1/runs/{runId}/deliveries gives the message; {{apiPortal}}/app/ledger?q=<per-run path> holds exactly one row — direction receive, that path, the same uetr. GET /api/v1/events?class=business&screenId=trNew holds biz.run.completed for the run with telemetry.sent 1. Cleanup deletes the run and the connection.`,
  suiteKey: 'sb-portal-roundtrip', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
  preconditions: `The application and the API portal are running; the operator can sign in and may save connections. The baseline message type ${MESSAGE_TYPE} is installed.`,
  steps: [
    API_LOGIN,
    READ_CLOCK,
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/channel-targets', headers: BEARER,
      expected_status: 200,
      expect_json: [{ path: 'data.1.channel', equals: 'api' }, { path: 'data.1.portal', matches: '^https?://' }],
      save: { rt_portal_address: 'data.1.portal' },
      description: 'read the address at which the application reaches the API portal',
      text: 'Ask the application where it reaches the API portal',
      expected: 'The application names the API portal\'s address.' },
    { action: 'request', method: 'PUT', url: '{{api}}/api/v1/external-systems/ext_te_rt_api_{{rand}}{{ts}}', headers: BEARER,
      body: { name: 'TE round trip api {{rand}}-{{ts}}', kind: 'desk', channel: 'api', family: 'api', endpoint: '{{rt_portal_address}}/inbound/te-rt-{{rand}}-{{ts}}', headers: {}, enabled: true },
      expected_status: 200,
      expect_json: [{ path: 'id', equals: 'ext_te_rt_api_{{rand}}{{ts}}' }, { path: 'channel', equals: 'api' }, { path: 'enabled', equals: true }],
      save: { rt_connection_id: 'id' },
      description: 'save a case-owned connection pointing at the API portal',
      text: 'Save a connection to the API portal for this test only, with an address ending unique to this run',
      expected: 'The connection is saved.',
      testData: 'A connection whose name and address are unique to this run.' },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER,
      body: { messageTypeCode: MESSAGE_TYPE, count: 1, connectionId: 'ext_te_rt_api_{{rand}}{{ts}}', seed: 'SBE-RT-API-{{rand}}-{{ts}}' },
      expected_status: 202,
      expect_json: [
        { path: 'accepted', equals: true },
        { path: 'status', equals: 'completed' },
        { path: 'generated', equals: 1 },
        { path: 'delivery.sent', equals: 1 },
        { path: 'delivery.failed', equals: 0 },
        { path: 'delivery.blocked', equals: 0 },
        { path: 'delivery.results.0.channel', equals: 'api' },
        { path: 'delivery.results.0.status', equals: 'acknowledged' },
        { path: 'delivery.results.0.responseBody.received', equals: true },
        { path: 'delivery.results.0.responseBody.path', equals: '/inbound/te-rt-{{rand}}-{{ts}}' },
        { path: 'report.result', equals: 'pass' },
      ],
      save: { rt_run_id: 'runId' },
      description: 'run one message through the connection: a real delivery to the API portal',
      text: 'Start a test run that sends one message through that connection',
      expected: 'The run finishes and reports the message as delivered and acknowledged by the API portal.',
      testData: `One ${MESSAGE_TYPE} message, generated by the application.` },
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{rt_run_id}}/deliveries', headers: BEARER,
      expected_status: 200,
      expect_json: [
        { path: 'data', min_length: 1, max_length: 1 },
        { path: 'data.0.channel', equals: 'api' },
        { path: 'data.0.status', equals: 'acknowledged' },
        { path: 'data.0.response_captured', equals: true },
        { path: 'data.0.request_payload.uetr', exists: true },
      ],
      save: { rt_reference: 'data.0.request_payload.uetr' },
      description: 'read the run\'s delivery record and keep the message\'s unique reference (uetr)',
      text: 'Open the run\'s delivery record and note the unique reference of the message it sent',
      expected: 'One acknowledged delivery is listed, with the portal\'s answer kept.' },
    { action: 'request', method: 'GET', url: '{{apiPortal}}/app/ledger?q=te-rt-{{rand}}-{{ts}}', expected_status: 200,
      expect_json: [
        { path: 'data', min_length: 1, max_length: 1 },
        { path: 'data.0.direction', equals: 'receive' },
        { path: 'data.0.path', equals: '/inbound/te-rt-{{rand}}-{{ts}}' },
        { path: 'data.0.payload.uetr', equals: '{{rt_reference}}' },
      ],
      description: 'the API portal received exactly that message on the per-run path',
      text: 'Search the API portal\'s record of received messages for this run\'s address ending',
      expected: 'Exactly one message is listed, and it is the one the run sent.' },
    runCompletedEvent('api', { 'telemetry.sent': 1 }),
  ],
  cleanupSteps: [...cleanupRunFixture('rt_run_id'), ...connectionCleanup('rt_connection_id')],
  atomicityNote: HISTORY_STAYS,
  tags: ['integration', 'round-trip', 'portal', 'api'],
  dataProfile: { profile: 'synthetic', data: `One disposable ${MESSAGE_TYPE} message generated by Sand Bench and delivered to an address unique to this run.`, source: 'generated at run time' },
  expected: 'Run acknowledged by the API portal; the portal holds exactly that message; biz.run.completed recorded with one delivery; run and connection removed.',
  commonFailureCauses: 'The API portal is not running, or the application cannot reach it at the address it reports.',
};

/** mq / kafka: the application sends a message to the external system; the test hub and the portal both take it. */
function sendRoundTripCase(ch: 'mq' | 'kafka'): CaseDef {
  const upper = ch.toUpperCase();
  const words = ch === 'mq' ? 'message-queue' : 'Kafka';
  const portal = ch === 'mq' ? '{{mqPortal}}' : '{{kafkaPortal}}';
  const stub = ch === 'mq' ? 'mq-delivery' : 'kafka';
  const where = ch === 'mq' ? { queue: 'DEV.QUEUE.1' } : { topic: 'sandbench.out' };
  const id = `ext_te_rt_${ch}_{{rand}}{{ts}}`;
  const tag = `SBE-RT-${upper}-{{rand}}-{{ts}}`;
  return {
    key: `SBE-RT-${upper}-END-TO-END`,
    name: `Sand Bench sends a message to the ${upper} portal over the wire and the portal records it`,
    objective: `Confirm Sand Bench can reach the ${words} portal end to end: a message sent to a ${words} connection is accepted by the test hub and by the portal, the portal puts it on the wire itself, and both show that very message.`,
    description: `The case saves its own ${ch} connection (PUT /api/v1/external-systems/{id}), then POST /api/v1/external-systems/{id}/send {payload:{tag}} answers 200 with ok:true and two results: testhub (stub ${stub}, 200) and ${ch}-desk (200). {{testhub}}/hub/inbox?channel=${ch} then holds the tagged message twice — the copy Sand Bench put there and the one the portal sent on (sentFrom testhub-ui) — and ${portal}/app/ledger?q=<tag> holds exactly one send row whose own result is testhub ok${ch === 'kafka' ? '; {{kafkaPortal}}/app/inbox?q=<tag> reads the message back from the wire' : ''}. Cleanup deletes the connection. (No queue manager or broker is configured in this environment, so a test run on this channel is simulated; this explicit send is the application's real path to the portal.)`,
    suiteKey: 'sb-portal-roundtrip', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
    preconditions: `The application, the test hub and the ${words} portal are running; the operator can sign in and may save connections.`,
    steps: [
      API_LOGIN,
      { action: 'request', method: 'PUT', url: `{{api}}/api/v1/external-systems/${id}`, headers: BEARER,
        body: { name: `TE round trip ${ch} {{rand}}-{{ts}}`, kind: 'desk', channel: ch, family: ch, endpoint: '', ...where, headers: {}, enabled: true },
        expected_status: 200,
        expect_json: [{ path: 'id', equals: id }, { path: 'channel', equals: ch }, { path: 'family', equals: ch }, { path: 'enabled', equals: true }],
        save: { rt_connection_id: 'id' },
        description: `save a case-owned ${ch} connection`,
        text: `Save a ${words} connection for this test only`,
        expected: 'The connection is saved.',
        testData: 'A connection whose name is unique to this run.' },
      { action: 'request', method: 'POST', url: `{{api}}/api/v1/external-systems/${id}/send`, headers: BEARER,
        body: { payload: { tag, note: 'portal round trip' } },
        expected_status: 200,
        expect_json: [
          { path: 'ok', equals: true },
          { path: 'family', equals: ch },
          { path: 'results', min_length: 2, max_length: 2 },
          { path: 'results', some: { target: 'testhub', stub, ok: true, status: 200 } },
          { path: 'results', some: { target: `${ch}-desk`, ok: true, status: 200 } },
        ],
        // The application waits 2 s for the test hub and 2.5 s for the portal (externalSystems.ts
        // sendDummyToSystem) and reports a slower answer as a failed send. A person whose send
        // was reported as failed presses Send again; so does this step, for up to half a minute.
        poll: { timeout_ms: 30000, interval_ms: 3000 },
        description: `send one tagged message to the connection: test hub and ${ch} portal both accept it`,
        text: 'Ask the application to send one message, carrying a tag unique to this run, to that connection — and again if it reports that the portal did not answer in time',
        expected: `The application reports that both the test hub and the ${words} portal accepted the message.`,
        testData: 'One small message with a per-run unique tag.' },
      { action: 'request', method: 'GET', url: `{{testhub}}/hub/inbox?channel=${ch}`, expected_status: 200,
        expect_json: [
          { path: 'data', some: { channel: ch, stub, status: 200, 'payload.tag': tag } },
          { path: 'data', some: { channel: ch, sentFrom: 'testhub-ui', status: 200, 'payload.tag': tag, ...where } },
        ],
        poll: { timeout_ms: 5000, interval_ms: 500 },
        description: 'testhub inbox holds the message from Sand Bench and the copy the portal sent on',
        text: 'Look for the tagged message in the test hub\'s inbox for this channel',
        expected: 'The test hub lists the message as received from Sand Bench and as sent on by the portal.' },
      { action: 'request', method: 'GET', url: `${portal}/app/ledger?q=${tag}`, expected_status: 200,
        expect_json: [
          { path: 'data', min_length: 1 },
          { path: 'data', some: { direction: 'send', ...where, 'payload.tag': tag, 'results.0.via': 'testhub', 'results.0.ok': true, 'results.0.status': 200 } },
        ],
        poll: { timeout_ms: 5000, interval_ms: 500 },
        description: `${ch} portal record holds the tagged message as sent on over the test hub (one row per send the portal received)`,
        text: `Search the ${words} portal's record for this run's tag`,
        expected: 'The message is found, recorded as sent on over the wire successfully.' },
      ...(ch === 'kafka' ? [{
        action: 'request', method: 'GET', url: `{{kafkaPortal}}/app/inbox?q=${tag}`, expected_status: 200,
        expect_json: [{ path: 'filtered', min: 1 }, { path: 'data', some: { 'payload.tag': tag } }],
        poll: { timeout_ms: 5000, interval_ms: 500 },
        description: 'Kafka portal reads the message back from the wire (inbox filtered by the tag)',
        text: 'Ask the Kafka portal to read its inbox from the wire, filtered to this run\'s tag',
        expected: 'The portal\'s inbox lists the message.',
      }] : []),
    ],
    cleanupSteps: connectionCleanup('rt_connection_id'),
    atomicityNote: HISTORY_STAYS,
    tags: ['integration', 'round-trip', 'portal', ch],
    dataProfile: { profile: 'synthetic', data: 'One small message carrying a tag unique to this run.', source: 'generated at run time' },
    expected: `Send accepted by testhub and the ${ch} portal; the tagged message is on testhub (from Sand Bench and from the portal) and recorded once in the portal; the connection is removed.`,
    commonFailureCauses: `The ${words} portal or the test hub is not running, or the application cannot reach the portal at its configured address.`,
    flakinessNotes: 'The application waits at most 2 seconds for the test hub and 2.5 seconds for the portal. On an overloaded machine the portal can answer later than that: the message still arrives, but the application reports the send to the portal as failed. The send step therefore tries again for up to half a minute; if the machine stays that slow the case goes red at the send step.',
    knownWorkarounds: 'Run the case again when the machine is less busy. If it keeps failing, check how long the portal and the test hub take to answer.',
  };
}

/** ftp: no file-transfer server in this environment — the run must say so, and nothing may reach the portal. */
const FTP_ROUND_TRIP: CaseDef = {
  key: 'SBE-RT-FTP-END-TO-END',
  name: 'Sand Bench FTP run is honestly reported as simulated and leaves nothing on the FTP portal',
  objective: 'Confirm a test run on the file-transfer channel, in an environment without a file-transfer server, is accepted but clearly reported as simulated — not delivered — that no file appears on the file-transfer portal for it, and that the application\'s event log records the run with one simulated delivery.',
  description: `POST /api/v1/runs {messageTypeCode:${MESSAGE_TYPE}, count:1, channel:ftp} answers 202 with status completed, delivery.simulated 1, delivery.sent 0 and results[0].status simulated. GET /api/v1/runs/{runId}/deliveries shows status simulated with detail "simulated, not delivered: …". {{ftpPortal}}/app/ledger?q=<uetr> (file names and contents) is empty: the portal only lists files that really landed on the shared volume. GET /api/v1/events?class=business&screenId=trNew holds biz.run.completed for the run with telemetry.simulated 1. A real file round trip needs a file-transfer server (SBE_FTP_URL) in the environment; when one is added this case must be upgraded to expect the file on the portal.`,
  suiteKey: 'sb-portal-roundtrip', testType: 'integration', method: 'http', severity: 'critical', priority: 'p0',
  preconditions: `The application and the FTP portal are running and the operator can sign in. The environment has no file-transfer server configured for the application. The baseline message type ${MESSAGE_TYPE} is installed.`,
  steps: [
    API_LOGIN,
    READ_CLOCK,
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER,
      body: { messageTypeCode: MESSAGE_TYPE, count: 1, channel: 'ftp', seed: 'SBE-RT-FTP-{{rand}}-{{ts}}' },
      expected_status: 202,
      expect_json: [
        { path: 'accepted', equals: true },
        { path: 'status', equals: 'completed' },
        { path: 'generated', equals: 1 },
        { path: 'delivery.simulated', equals: 1 },
        { path: 'delivery.sent', equals: 0 },
        { path: 'delivery.failed', equals: 0 },
        { path: 'delivery.blocked', equals: 0 },
        { path: 'delivery.results.0.channel', equals: 'ftp' },
        { path: 'delivery.results.0.status', equals: 'simulated' },
        { path: 'report.result', equals: 'pass' },
      ],
      save: { rt_run_id: 'runId' },
      description: 'start a one-message run on the ftp channel',
      text: 'Start a test run that sends one message on the file-transfer channel',
      expected: 'The run is accepted and finishes, reporting the one delivery as simulated.',
      testData: `One ${MESSAGE_TYPE} message, generated by the application.` },
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{rt_run_id}}/deliveries', headers: BEARER,
      expected_status: 200,
      expect_json: [
        { path: 'data', min_length: 1, max_length: 1 },
        { path: 'data.0.channel', equals: 'ftp' },
        { path: 'data.0.status', equals: 'simulated' },
        { path: 'data.0.detail', contains: 'simulated, not delivered' },
        { path: 'data.0.request_payload.uetr', exists: true },
      ],
      save: { rt_reference: 'data.0.request_payload.uetr' },
      description: 'the delivery record says "simulated, not delivered"; keep the message\'s unique reference (uetr)',
      text: 'Open the run\'s delivery record and note the unique reference of the message',
      expected: 'One delivery is listed, marked as simulated — not really delivered.' },
    { action: 'request', method: 'GET', url: '{{ftpPortal}}/app/ledger?q={{rt_reference}}', expected_status: 200,
      expect_json: [{ path: 'query', equals: '{{rt_reference}}' }, { path: 'data', exists: true }, { path: 'data', max_length: 0 }],
      description: 'FTP portal answers the search and holds no file for this message',
      text: 'Search the files the file-transfer portal has received for this message\'s reference',
      expected: 'The portal answers and lists no file — matching the application\'s statement that nothing was really delivered.' },
    runCompletedEvent('ftp', { 'telemetry.simulated': 1, 'telemetry.sent': 0 }),
  ],
  cleanupSteps: cleanupRunFixture('rt_run_id'),
  tags: ['integration', 'round-trip', 'portal', 'ftp'],
  dataProfile: { profile: 'synthetic', data: `One disposable ${MESSAGE_TYPE} message generated by Sand Bench.`, source: 'generated at run time' },
  expected: 'Run accepted; delivery marked simulated; nothing on the FTP portal; biz.run.completed recorded with one simulated delivery; run removed.',
  commonFailureCauses: 'A file-transfer server has been added to the environment (the run then really delivers and this case must be upgraded), or the FTP portal is not running.',
};

const portalCases: CaseDef[] = [API_ROUND_TRIP, sendRoundTripCase('mq'), sendRoundTripCase('kafka'), FTP_ROUND_TRIP];

/* ------------------------------------------------------------------------- */
/* Sand Bench event emission                                                 */
/* ------------------------------------------------------------------------- */

type EventClass = 'business' | 'technical';

/** Search the event log (one class, newest 500) for one entry that matches everything given. */
function eventRecorded(code: string, klass: EventClass, match: Record<string, unknown>, words: { text: string; expected: string }, query = '') {
  return {
    action: 'request', method: 'GET',
    url: `{{api}}/api/v1/events?class=${klass}${query}&limit=500`,
    headers: BEARER,
    expected_status: 200,
    expect_json: [{ path: 'data', some: { eventCode: code, ...match, occurredAt: { at_or_after: '{{event_since}}' } } }],
    poll: { timeout_ms: 4000, interval_ms: 500 },
    description: `event ${code} recorded (class ${klass}; matched on ${Object.keys(match).join(', ') || 'code and time'})`,
    text: words.text,
    expected: words.expected,
  };
}

const BY_ME = { 'actor.userId': '{{event_actor_id}}' };
const NOT_RECORDED = 'Usual cause today: the application performs the action but never writes this event (application defect — the event is in the application\'s catalogue and use-case documents, but no code emits it).';
const NOT_STORED = 'Usual cause today: the application raises this event only in its own memory, without storing it and without saying whose it is, so the event log can never show it (application defect).';

interface EventCase {
  code: string;
  name: string;
  objective: string;
  description: string;
  /** Steps after sign-in and reading the clock: the action, then the event search. */
  steps: unknown[];
  /** Replaces the default "sign in, read the clock" opening. */
  opening?: unknown[];
  cleanupSteps?: unknown[];
  atomicityNote?: CaseDef['atomicityNote'];
  defect?: 'not-emitted' | 'not-stored';
  data: string;
  expected: string;
  preconditions?: string;
  severity?: CaseDef['severity'];
  priority?: CaseDef['priority'];
}

const RUN_BODY = (seedTag: string) => ({ messageTypeCode: MESSAGE_TYPE, count: 1, channel: 'file', seed: `SBE-EV-${seedTag}-{{rand}}-{{ts}}` });
const RUN_STARTED_OK = [
  { path: 'accepted', equals: true },
  { path: 'status', equals: 'completed' },
  { path: 'generated', equals: 1 },
  { path: 'runId', exists: true },
];

const EVENT_CASES: EventCase[] = [
  {
    code: 'biz.session.login.success',
    name: 'operator sign-in produces event biz.session.login.success',
    objective: 'Confirm the application\'s event log records a successful sign-in, with the person who signed in — the first entry of every audit trail (currently a known defect: the application signs the person in but writes no such event).',
    description: 'POST /api/v1/session/login with the lane operator\'s credentials answers 200 with a token. GET /api/v1/events?class=business must then hold biz.session.login.success for that user id, not older than the application clock read just before. Catalogued in eventCatalog.ts ("POST /api/v1/session/login returns a token") and named by use case UC login (useCaseReviewStandalonePackA.ts); no emitDomainEvent call for it exists in apps/api/src.',
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
        body: { username: '{{username}}', password: '{{password}}' },
        expected_status: 200,
        expect_json: [{ path: 'token', exists: true }, { path: 'user.id', equals: '{{event_actor_id}}' }],
        save: { token: 'token' },
        description: 'the sign-in under test',
        text: 'Sign in again as the same operator — this is the sign-in the event must record',
        expected: 'The sign-in is accepted.' },
      eventRecorded('biz.session.login.success', 'business', { ...BY_ME, outcome: 'success' },
        { text: 'Search the application\'s event log for the "user signed in" entry of this operator', expected: 'The entry is there, made after the sign-in above.' }),
    ],
    defect: 'not-emitted',
    data: 'The lane operator\'s user name and the demo password.',
    expected: 'biz.session.login.success for this operator is in /api/v1/events.',
    severity: 'critical', priority: 'p0',
  },
  {
    code: 'biz.session.login.failure',
    name: 'failed sign-in produces event biz.session.login.failure',
    objective: 'Confirm the application\'s event log records a refused sign-in, so that attempts to guess a password leave a trace (currently a known defect: the application refuses the sign-in but writes no such event).',
    description: 'POST /api/v1/session/login with a wrong password for the lane operator answers 401. GET /api/v1/events?class=business must then hold biz.session.login.failure with outcome failure, not older than the application clock read just before. Catalogued in eventCatalog.ts ("Login validation fails") and named by the login use case; no emitDomainEvent call for it exists in apps/api/src. The engine sends the refused sign-in from a made-up client address and signs the operator in correctly afterwards.',
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
        body: { username: '{{username}}', password: 'this-is-a-wrong-password-{{rand}}' },
        expected_status: 401,
        description: 'sign-in with a wrong password is refused',
        text: 'Try to sign in as the operator with a wrong password',
        expected: 'The application refuses the sign-in.',
        testData: 'The operator\'s user name with a deliberately wrong password.' },
      eventRecorded('biz.session.login.failure', 'business', { outcome: 'failure' },
        { text: 'Search the application\'s event log for the "sign-in failed" entry', expected: 'The entry is there, made after the refused sign-in above.' }),
    ],
    defect: 'not-emitted',
    data: 'The lane operator\'s user name with a wrong password.',
    expected: 'biz.session.login.failure is in /api/v1/events.',
  },
  {
    code: 'biz.console.bootstrap',
    name: 'console bootstrap produces event biz.console.bootstrap',
    objective: 'Confirm the application\'s event log records that a person\'s console was loaded with its lists and menus (currently a known defect: the console loads but no such event is written).',
    description: 'GET /api/v1/console/bootstrap answers 200 with user and catalogue. GET /api/v1/events?class=business must then hold biz.console.bootstrap for this user. Catalogued in eventCatalog.ts ("GET /api/v1/console/bootstrap") and named by the Message Designer use case; only the generic api.get.console.bootstrap event is written.',
    steps: [
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/console/bootstrap', headers: BEARER,
        expected_status: 200,
        expect_json: [{ path: 'user', exists: true }, { path: 'catalogue', exists: true }],
        description: 'load the console bootstrap',
        text: 'Load the console\'s starting data, as the web console does right after sign-in',
        expected: 'The application returns the signed-in person and the lists the console starts with.' },
      eventRecorded('biz.console.bootstrap', 'business', BY_ME,
        { text: 'Search the application\'s event log for the "console loaded" entry of this operator', expected: 'The entry is there, made after the load above.' }),
    ],
    defect: 'not-emitted',
    data: 'A single read; nothing is created.',
    expected: 'biz.console.bootstrap for this operator is in /api/v1/events.',
  },
  {
    code: 'biz.schema.uploaded',
    name: 'schema upload produces event biz.schema.uploaded',
    objective: 'Confirm that importing a new message scheme is recorded in the application\'s event log, with the person who imported it and the scheme that was stored.',
    description: 'POST /api/v1/catalog/iso/uploads with one small, uniquely titled JSON Schema answers 202 with status stored, two fields and a job_id. GET /api/v1/events?class=business then holds biz.schema.uploaded with entity.type scheme, entity.id = that job_id, entity.name = the scheme code, for this user. Cleanup deletes the scheme (DELETE /api/v1/catalog/designer-types/{job_id}) and verifies it is gone.',
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/iso/uploads', headers: BEARER,
        body: {
          schemas: [{
            fileName: 'TeEvScheme{{rand}}{{ts}}.json',
            content: '{"$schema":"http://json-schema.org/draft-07/schema#","title":"TeEvScheme{{rand}}{{ts}}","type":"object","properties":{"amount":{"type":"number"},"currency":{"type":"string"}}}',
          }],
          confirm: true,
        },
        expected_status: 202,
        expect_json: [
          { path: 'status', equals: 'stored' },
          { path: 'code', equals: 'TeEvScheme{{rand}}{{ts}}' },
          { path: 'fieldCount', equals: 2 },
          { path: 'accepted', equals: 1 },
          { path: 'job_id', exists: true },
        ],
        save: { event_scheme_id: 'job_id' },
        description: 'import one small, uniquely named scheme',
        text: 'Import a small new message scheme with two fields (an amount and a currency)',
        expected: 'The application stores the scheme and reports its two fields.',
        testData: 'A two-field scheme whose name is unique to this run.' },
      eventRecorded('biz.schema.uploaded', 'business',
        { ...BY_ME, 'entity.type': 'scheme', 'entity.id': '{{event_scheme_id}}', 'entity.name': 'TeEvScheme{{rand}}{{ts}}', outcome: 'success' },
        { text: 'Search the application\'s event log for the "scheme uploaded" entry of this scheme', expected: 'The entry is there, for this scheme and this operator.' }),
    ],
    cleanupSteps: [
      { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/catalog/designer-types/{{event_scheme_id}}', headers: BEARER,
        skip_if_missing: ['event_scheme_id'], expected_status: [200, 404],
        description: 'delete the case-owned scheme',
        text: 'Remove the scheme this test imported', expected: 'The scheme is removed or was already absent.' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types/{{event_scheme_id}}', headers: BEARER,
        skip_if_missing: ['event_scheme_id'], expected_status: 404,
        description: 'verify the scheme is gone',
        text: 'Check that the scheme is no longer available', expected: 'The application reports that the scheme does not exist.' },
    ],
    data: 'One two-field JSON Schema with a per-run unique title.',
    expected: 'biz.schema.uploaded for this scheme and operator is in /api/v1/events; the scheme is removed afterwards.',
  },
  {
    code: 'biz.file.generated',
    name: 'message generation produces event biz.file.generated',
    objective: 'Confirm that generating and storing test messages is recorded in the application\'s event log (currently a known defect: the messages are generated and stored but no such event is written).',
    description: `POST /api/v1/generated-messages {messageTypeCode:${MESSAGE_TYPE}, count:1, seed, batchNumber} answers 200 with stored:1 and one id. GET /api/v1/events?class=business must then hold biz.file.generated for this user. Catalogued in eventCatalog.ts ("POST /api/v1/generated-messages"); the route (app.ts) has no emitDomainEvent call. A batch number unique to the run is sent: without one the application reuses its default batch and fails internally on the second call (separate defect).`,
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages', headers: BEARER,
        body: { messageTypeCode: MESSAGE_TYPE, count: 1, seed: 'SBE-EV-FILE-{{rand}}-{{ts}}', batchNumber: 'TE-EV-{{rand}}-{{ts}}' },
        expected_status: 200,
        expect_json: [
          { path: 'stored', equals: 1 },
          { path: 'batchNumber', equals: 'TE-EV-{{rand}}-{{ts}}' },
          { path: 'ids', min_length: 1, max_length: 1 },
        ],
        description: 'generate and store one message',
        text: 'Ask the application to generate and store one test message',
        expected: 'One message is generated and stored under this run\'s own batch number.',
        testData: `One ${MESSAGE_TYPE} message in a batch whose number is unique to this run.` },
      eventRecorded('biz.file.generated', 'business', BY_ME,
        { text: 'Search the application\'s event log for the "test file generated" entry of this operator', expected: 'The entry is there, made after the generation above.' }),
    ],
    defect: 'not-emitted',
    atomicityNote: {
      reason: 'no-cleanup-endpoint',
      detail: 'The application has no delete route for a stored generated message (its own use-case review lists this as a gap). The one message this case stores sits in a batch of its own and is never read by another case.',
    },
    data: 'One generated message in a per-run batch.',
    expected: 'biz.file.generated for this operator is in /api/v1/events.',
  },
  {
    code: 'biz.run.started',
    name: 'run start produces event biz.run.started',
    objective: 'Confirm that starting a test run is recorded in the application\'s event log, with the person who started it, the kind of message and the channel.',
    description: `POST /api/v1/runs {messageTypeCode:${MESSAGE_TYPE}, count:1, channel:file} answers 202 accepted. GET /api/v1/events?class=business&screenId=trNew then holds biz.run.started for this user with entity.name ${MESSAGE_TYPE}, telemetry.channel file and telemetry.count 1, not older than the application clock read just before. Cleanup deletes the run.`,
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER, body: RUN_BODY('RUN'),
        expected_status: 202, expect_json: RUN_STARTED_OK, save: { event_run_id: 'runId' },
        description: 'start a one-message run on the file channel',
        text: 'Start a test run that sends one message',
        expected: 'The run is accepted and finishes with one message generated.',
        testData: `One ${MESSAGE_TYPE} message on the file channel.` },
      eventRecorded('biz.run.started', 'business',
        { ...BY_ME, 'entity.type': 'run', 'entity.name': MESSAGE_TYPE, 'telemetry.channel': 'file', 'telemetry.count': 1, outcome: 'info' },
        { text: 'Search the application\'s event log for the "test run started" entry of this operator', expected: 'The entry is there, for this kind of message and this channel, made after the run was started.' },
        '&screenId=trNew'),
    ],
    cleanupSteps: cleanupRunFixture('event_run_id'),
    data: 'One generated message, sent on the file channel.',
    expected: 'biz.run.started for this operator, message type and channel is in /api/v1/events; the run is removed afterwards.',
    severity: 'critical', priority: 'p0',
  },
  {
    code: 'biz.run.completed',
    name: 'run completion produces event biz.run.completed',
    objective: 'Confirm that a finished test run is recorded in the application\'s event log under the run\'s own identifier, with how many messages were generated and that none failed.',
    description: `POST /api/v1/runs {messageTypeCode:${MESSAGE_TYPE}, count:1, channel:file} answers 202 with a runId. GET /api/v1/events?class=business&screenId=trNew then holds biz.run.completed with entity.id = that runId, outcome success, telemetry.generated 1 and telemetry.failed 0, for this user. Cleanup deletes the run.`,
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER, body: RUN_BODY('RC'),
        expected_status: 202, expect_json: RUN_STARTED_OK, save: { event_run_id: 'runId' },
        description: 'start a one-message run on the file channel',
        text: 'Start a test run that sends one message',
        expected: 'The run is accepted and finishes with one message generated.',
        testData: `One ${MESSAGE_TYPE} message on the file channel.` },
      eventRecorded('biz.run.completed', 'business',
        { ...BY_ME, 'entity.type': 'run', 'entity.id': '{{event_run_id}}', outcome: 'success', 'telemetry.channel': 'file', 'telemetry.generated': 1, 'telemetry.failed': 0 },
        { text: 'Search the application\'s event log for the "test run finished" entry of this run', expected: 'The entry is there, for this run and this operator, with one message generated and none failed.' },
        '&screenId=trNew'),
    ],
    cleanupSteps: cleanupRunFixture('event_run_id'),
    data: 'One generated message, sent on the file channel.',
    expected: 'biz.run.completed for this run id and operator is in /api/v1/events; the run is removed afterwards.',
  },
  {
    code: 'biz.run.rejected',
    name: 'run rejected produces event biz.run.rejected',
    objective: 'Confirm that a test run the application refuses — here because the kind of message does not exist — is recorded in the event log as rejected, with the reason.',
    description: 'POST /api/v1/runs with a message type code that does not exist (unique to the run) answers 404 not_found. GET /api/v1/events?class=business&screenId=trNew then holds biz.run.rejected with entity.name = that code, outcome failure and error.code not_found, for this user. Nothing is created.',
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER,
        body: { messageTypeCode: 'te.missing.{{rand}}.{{ts}}', count: 1, channel: 'file' },
        expected_status: 404,
        expect_json: [{ path: 'error.code', equals: 'not_found' }],
        description: 'start a run for a message type that does not exist',
        text: 'Try to start a test run for a kind of message the application does not know',
        expected: 'The application refuses: that kind of message was not found.',
        testData: 'A made-up message type name, unique to this run.' },
      eventRecorded('biz.run.rejected', 'business',
        { ...BY_ME, 'entity.type': 'run', 'entity.name': 'te.missing.{{rand}}.{{ts}}', outcome: 'failure', 'error.code': 'not_found' },
        { text: 'Search the application\'s event log for the "test run rejected" entry naming that message type', expected: 'The entry is there, for this operator, with the reason "not found".' },
        '&screenId=trNew'),
    ],
    data: 'A message type name that does not exist; nothing is created.',
    expected: 'biz.run.rejected naming the made-up message type is in /api/v1/events.',
  },
  {
    code: 'biz.dataset.created',
    name: 'dataset create produces event biz.dataset.created',
    objective: 'Confirm that creating a dataset is recorded in the application\'s event log, with the person who created it (currently a known defect: the dataset is created but no such event is written).',
    description: 'POST /api/v1/datasets {name} answers 200 with an id and row_count 0. GET /api/v1/events?class=business must then hold biz.dataset.created with entity.id = that id for this user. Catalogued in eventCatalog.ts ("POST /api/v1/datasets") and named by the dataset use cases (useCaseReviewTesting.ts); no emitDomainEvent call for it exists. Cleanup deletes the dataset and verifies it is gone.',
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/datasets', headers: BEARER,
        body: { name: 'TE-EV-DS-{{rand}}-{{ts}}' },
        expected_status: 200,
        expect_json: [{ path: 'id', exists: true }, { path: 'row_count', equals: 0 }],
        save: { event_dataset_id: 'id' },
        description: 'create an empty dataset',
        text: 'Create an empty dataset with a name unique to this run',
        expected: 'The dataset is created, with no rows.' },
      eventRecorded('biz.dataset.created', 'business', { ...BY_ME, 'entity.id': '{{event_dataset_id}}' },
        { text: 'Search the application\'s event log for the "dataset created" entry of this dataset', expected: 'The entry is there, for this dataset and this operator.' }),
    ],
    cleanupSteps: cleanupVersionedFixture('datasets', 'event_dataset_id'),
    defect: 'not-emitted',
    data: 'One empty dataset with a per-run unique name.',
    expected: 'biz.dataset.created for this dataset is in /api/v1/events; the dataset is removed afterwards.',
  },
  {
    code: 'biz.case.created',
    name: 'test case create produces event biz.case.created',
    objective: 'Confirm that creating a test case is recorded in the application\'s event log, with the person who created it (currently a known defect: the test case is created but no such event is written).',
    description: 'POST /api/v1/test-cases {name, objective} answers 200 with an id. GET /api/v1/events?class=business must then hold biz.case.created with entity.id = that id for this user. Catalogued in eventCatalog.ts ("POST /api/v1/test-cases") and named by the test-case use cases; no emitDomainEvent call for it exists. Cleanup deletes the test case (If-Match) and verifies it is gone.',
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-cases', headers: BEARER,
        body: { name: 'TE-EV-TC-{{rand}}-{{ts}}', objective: 'Confirm a payment over the limit is flagged.' },
        expected_status: 200,
        expect_json: [{ path: 'id', exists: true }, { path: 'name', equals: 'TE-EV-TC-{{rand}}-{{ts}}' }],
        save: { event_case_id: 'id' },
        description: 'create a test case',
        text: 'Create a test case with a name unique to this run',
        expected: 'The test case is created.' },
      eventRecorded('biz.case.created', 'business', { ...BY_ME, 'entity.id': '{{event_case_id}}' },
        { text: 'Search the application\'s event log for the "test case created" entry of this test case', expected: 'The entry is there, for this test case and this operator.' }),
    ],
    cleanupSteps: cleanupTaggedRecord('test-cases', 'event_case_id'),
    defect: 'not-emitted',
    data: 'One test case with a per-run unique name.',
    expected: 'biz.case.created for this test case is in /api/v1/events; the test case is removed afterwards.',
  },
  {
    code: 'biz.suite.created',
    name: 'test suite create produces event biz.suite.created',
    objective: 'Confirm that creating a test suite is recorded in the application\'s event log, with the person who created it (currently a known defect: the suite is created but no such event is written).',
    description: 'POST /api/v1/test-suites {name} answers 201 with an id. GET /api/v1/events?class=business must then hold biz.suite.created with entity.id = that id for this user. Catalogued in eventCatalog.ts ("POST /api/v1/test-suites") and named by the test-suite use cases; no emitDomainEvent call for it exists. Cleanup deletes the suite (If-Match) and verifies it is gone.',
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/test-suites', headers: BEARER,
        body: { name: 'TE-EV-TS-{{rand}}-{{ts}}' },
        expected_status: 201,
        expect_json: [{ path: 'id', exists: true }],
        save: { event_suite_id: 'id' },
        description: 'create a test suite',
        text: 'Create an empty test suite with a name unique to this run',
        expected: 'The suite is created.' },
      eventRecorded('biz.suite.created', 'business', { ...BY_ME, 'entity.id': '{{event_suite_id}}' },
        { text: 'Search the application\'s event log for the "test suite created" entry of this suite', expected: 'The entry is there, for this suite and this operator.' }),
    ],
    cleanupSteps: cleanupTaggedRecord('test-suites', 'event_suite_id'),
    defect: 'not-emitted',
    data: 'One empty test suite with a per-run unique name.',
    expected: 'biz.suite.created for this suite is in /api/v1/events; the suite is removed afterwards.',
  },
  {
    code: 'biz.rule.created',
    name: 'detection rule create produces event biz.rule.created',
    objective: 'Confirm that creating a detection rule is recorded in the application\'s event log, with the person who created it and the rule itself.',
    description: 'POST /api/v1/rules {name, category:fraud, severity:medium, condition:{kind:amount_gte, field:instdAmt, value:10000}} answers 200 with an id and status in_review. GET /api/v1/events?class=business then holds biz.rule.created with entity.type detection_rule, entity.id = that id and entity.name = the rule name, for this user. Cleanup deletes the rule (If-Match) and verifies it is gone.',
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/rules', headers: BEARER,
        body: { name: 'TE-EV-RULE-{{rand}}-{{ts}}', category: 'fraud', severity: 'medium', condition: { kind: 'amount_gte', field: 'instdAmt', value: 10000 } },
        expected_status: 200,
        expect_json: [{ path: 'id', exists: true }, { path: 'status', equals: 'in_review' }, { path: 'name', equals: 'TE-EV-RULE-{{rand}}-{{ts}}' }],
        save: { event_rule_id: 'id' },
        description: 'create a detection rule',
        text: 'Create a detection rule that flags payments of 10,000 or more',
        expected: 'The rule is created and waits for review.',
        testData: 'A rule with a per-run unique name: amount of 10,000 or more.' },
      eventRecorded('biz.rule.created', 'business',
        { ...BY_ME, 'entity.type': 'detection_rule', 'entity.id': '{{event_rule_id}}', 'entity.name': 'TE-EV-RULE-{{rand}}-{{ts}}', outcome: 'success' },
        { text: 'Search the application\'s event log for the "detection rule created" entry of this rule', expected: 'The entry is there, for this rule and this operator.' }),
    ],
    cleanupSteps: cleanupTaggedRecord('rules', 'event_rule_id'),
    data: 'One detection rule with a per-run unique name.',
    expected: 'biz.rule.created for this rule and operator is in /api/v1/events; the rule is removed afterwards.',
  },
  {
    code: 'biz.eventing.configured',
    name: 'eventing settings save produces event biz.eventing.configured',
    objective: 'Confirm that saving the settings for outgoing events is recorded in the application\'s event log, with the person who saved them (currently a known defect: the save is accepted but no such event is written).',
    description: 'GET /api/v1/settings/eventing reads the settings in effect; PATCH /api/v1/settings/eventing {value:<the same settings>} answers 200 with saved:true and key eventing — a real save that changes nothing. GET /api/v1/events?class=business must then hold biz.eventing.configured for this user. Catalogued in eventCatalog.ts ("PATCH /api/v1/settings/eventing") and named by the eventing use case (useCaseReviewConfiguration.ts); no emitDomainEvent call for it exists.',
    steps: [
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/eventing', headers: BEARER,
        expected_status: 200,
        expect_json: [{ path: 'enabled', exists: true }, { path: 'channel', exists: true }, { path: 'queue', exists: true }, { path: 'topic', exists: true }, { path: 'headers', exists: true }],
        save: { ev_enabled: 'enabled', ev_channel: 'channel', ev_queue: 'queue', ev_topic: 'topic', ev_headers: 'headers' },
        description: 'read the eventing settings in effect',
        text: 'Read the current settings for outgoing events',
        expected: 'The application returns the settings in effect.' },
      { action: 'request', method: 'PATCH', url: '{{api}}/api/v1/settings/eventing', headers: BEARER,
        body_json: '{"value":{"enabled":{{ev_enabled}},"channel":"{{ev_channel}}","queue":"{{ev_queue}}","topic":"{{ev_topic}}","headers":{{ev_headers}}}}',
        expected_status: 200,
        expect_json: [{ path: 'saved', equals: true }, { path: 'key', equals: 'eventing' }, { path: 'value.channel', equals: '{{ev_channel}}' }, { path: 'value.queue', equals: '{{ev_queue}}' }],
        description: 'save the same eventing settings back',
        text: 'Save those same settings again, unchanged',
        expected: 'The application confirms the save.',
        testData: 'The settings already in effect, sent back unchanged.' },
      eventRecorded('biz.eventing.configured', 'business', BY_ME,
        { text: 'Search the application\'s event log for the "eventing settings saved" entry of this operator', expected: 'The entry is there, made after the save above.' }),
    ],
    defect: 'not-emitted',
    atomicityNote: {
      reason: 'no-cleanup-endpoint',
      detail: 'A saved setting can only be overwritten, not removed. The case saves exactly the values already in effect, so the settings every other case reads are unchanged.',
    },
    data: 'The eventing settings already in effect, saved back unchanged.',
    expected: 'biz.eventing.configured for this operator is in /api/v1/events.',
  },
  {
    code: 'tec.inbound.accepted',
    name: 'inbound event accepted produces event tec.inbound.accepted',
    objective: 'Confirm that a message arriving from an outside system is recorded in the application\'s event log as accepted (currently a known defect: the message is accepted and listed, but no such event is written).',
    description: 'POST /api/v1/inbound/events {channel:api, systemId, systemName, headers, payload:{tag}} with the operator\'s session answers 202 accepted:true; GET /api/v1/inbound/events lists it by its tag. GET /api/v1/events?class=technical must then hold tec.inbound.accepted, not older than the application clock read just before. Catalogued in eventCatalog.ts ("POST /api/v1/inbound/events returns 202") and named by the external-systems use case; no emitDomainEvent call for it exists.',
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/inbound/events', headers: BEARER,
        body: { channel: 'api', systemId: 'ext_te_event', systemName: 'Test Engine event case', headers: { 'x-correlation-id': 'SBE-EV-IN-{{rand}}-{{ts}}' }, payload: { tag: 'SBE-EV-IN-{{rand}}-{{ts}}' } },
        expected_status: 202,
        expect_json: [{ path: 'accepted', equals: true }, { path: 'event.id', exists: true }, { path: 'event.channel', equals: 'api' }, { path: 'event.payload.tag', equals: 'SBE-EV-IN-{{rand}}-{{ts}}' }],
        description: 'post one inbound message',
        text: 'Send the application one message as an outside system would, carrying a tag unique to this run',
        expected: 'The application accepts the message.',
        testData: 'One small message with a per-run unique tag.' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/inbound/events', headers: BEARER,
        expected_status: 200,
        expect_json: [{ path: 'data', some: { channel: 'api', systemId: 'ext_te_event', 'payload.tag': 'SBE-EV-IN-{{rand}}-{{ts}}' } }],
        description: 'the inbound message is listed',
        text: 'Open the list of messages received from outside systems',
        expected: 'The message with this run\'s tag is listed.' },
      eventRecorded('tec.inbound.accepted', 'technical', {},
        { text: 'Search the application\'s event log for the "inbound event accepted" entry', expected: 'The entry is there, made after the message was accepted.' }),
    ],
    defect: 'not-emitted',
    atomicityNote: {
      reason: 'no-cleanup-endpoint',
      detail: 'The list of received messages is append-only; the application offers no way to remove an entry. The one entry this case adds carries a per-run tag and is never read by another case.',
    },
    data: 'One inbound message with a per-run unique tag.',
    expected: 'tec.inbound.accepted is in /api/v1/events.',
  },
  {
    code: 'tec.delivery.succeeded',
    name: 'delivery success produces event tec.delivery.succeeded',
    objective: 'Confirm that a message really delivered to an outside system is recorded in the application\'s event log as a successful delivery (currently a known defect: the message is delivered and the run says so, but the event never reaches the log).',
    description: `The case saves its own connection (PUT /api/v1/external-systems/{id}, channel api) whose endpoint is the API portal as the application reaches it (GET /api/v1/channel-targets, api entry) plus a per-run path, then POST /api/v1/runs {messageTypeCode:${MESSAGE_TYPE}, count:1, connectionId} answers 202 with delivery.sent 1 and result status acknowledged — a real HTTP delivery. {{apiPortal}}/app/ledger?q=<per-run path> holds exactly that message. GET /api/v1/events?class=technical must then hold tec.delivery.succeeded with entity.type delivery, entity.name api and payload.uetr = the delivered message's reference. delivery.ts (deliverEligible) emits the event in memory only: it is never stored and carries no tenant, so neither /api/v1/events nor /api/v1/events/export can return it. Cleanup deletes the run and the connection.`,
    preconditions: 'The application and the API portal are running; the operator can sign in and may save connections.',
    steps: [
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/channel-targets', headers: BEARER,
        expected_status: 200,
        expect_json: [{ path: 'data.1.channel', equals: 'api' }, { path: 'data.1.portal', matches: '^https?://' }],
        save: { event_api_portal: 'data.1.portal' },
        description: 'read the address at which the application reaches the API portal',
        text: 'Ask the application where it reaches the API portal',
        expected: 'The application names the API portal\'s address.' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/external-systems/ext_te_ev_{{rand}}{{ts}}', headers: BEARER,
        body: { name: 'TE event case {{rand}}-{{ts}}', kind: 'desk', channel: 'api', family: 'api', endpoint: '{{event_api_portal}}/inbound/te-ev-{{rand}}-{{ts}}', headers: {}, enabled: true },
        expected_status: 200,
        expect_json: [{ path: 'id', equals: 'ext_te_ev_{{rand}}{{ts}}' }, { path: 'channel', equals: 'api' }, { path: 'enabled', equals: true }],
        save: { event_connection_id: 'id' },
        description: 'save a case-owned connection pointing at the API portal',
        text: 'Save a connection to the API portal for this test only, with an address ending unique to this run',
        expected: 'The connection is saved.',
        testData: 'A connection whose name and address are unique to this run.' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER,
        body: { messageTypeCode: MESSAGE_TYPE, count: 1, connectionId: 'ext_te_ev_{{rand}}{{ts}}', seed: 'SBE-EV-DL-{{rand}}-{{ts}}' },
        expected_status: 202,
        expect_json: [
          { path: 'accepted', equals: true },
          { path: 'status', equals: 'completed' },
          { path: 'delivery.sent', equals: 1 },
          { path: 'delivery.failed', equals: 0 },
          { path: 'delivery.results.0.status', equals: 'acknowledged' },
          { path: 'delivery.results.0.responseBody.received', equals: true },
        ],
        save: { event_run_id: 'runId' },
        description: 'run one message through the connection: a real delivery to the API portal',
        text: 'Start a test run that sends one message through that connection',
        expected: 'The run finishes and reports the message as delivered and acknowledged by the API portal.' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{event_run_id}}/deliveries', headers: BEARER,
        expected_status: 200,
        expect_json: [{ path: 'data', min_length: 1, max_length: 1 }, { path: 'data.0.status', equals: 'acknowledged' }, { path: 'data.0.request_payload.uetr', exists: true }],
        save: { event_reference: 'data.0.request_payload.uetr' },
        description: 'keep the delivered message\'s unique reference (uetr)',
        text: 'Open the run\'s delivery record and note the unique reference of the delivered message',
        expected: 'One acknowledged delivery is listed.' },
      { action: 'request', method: 'GET', url: '{{apiPortal}}/app/ledger?q=te-ev-{{rand}}-{{ts}}', expected_status: 200,
        expect_json: [
          { path: 'data', min_length: 1, max_length: 1 },
          { path: 'data.0.direction', equals: 'receive' },
          { path: 'data.0.path', equals: '/inbound/te-ev-{{rand}}-{{ts}}' },
          { path: 'data.0.payload.uetr', equals: '{{event_reference}}' },
        ],
        description: 'the API portal received exactly that message on the per-run path',
        text: 'Search the API portal\'s record of received messages for this run\'s address ending',
        expected: 'Exactly one message is listed, and it is the one the run sent.' },
      eventRecorded('tec.delivery.succeeded', 'technical',
        { 'entity.type': 'delivery', 'entity.name': 'api', 'payload.uetr': '{{event_reference}}', outcome: 'success' },
        { text: 'Search the application\'s event log for the "submission succeeded" entry carrying this message', expected: 'The entry is there, for the API channel and this exact message.' }),
    ],
    cleanupSteps: [
      ...cleanupRunFixture('event_run_id'),
      { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/external-systems/{{event_connection_id}}', headers: BEARER,
        skip_if_missing: ['event_connection_id'], expected_status: 200,
        description: 'delete the case-owned connection',
        text: 'Remove the connection this test saved', expected: 'The connection is removed.' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/external-systems', headers: BEARER,
        skip_if_missing: ['event_connection_id'], expected_status: 200,
        expected_body_not_contains: '{{event_connection_id}}',
        description: 'verify the connection is no longer listed',
        text: 'Check that the connection is no longer listed', expected: 'The list of connections does not contain it.' },
    ],
    defect: 'not-stored',
    atomicityNote: {
      reason: 'no-cleanup-endpoint',
      detail: 'The run and the connection are deleted afterwards. The message the API portal received stays in the portal\'s append-only record, under an address ending unique to this run.',
    },
    data: 'One generated message delivered through a case-owned connection to the API portal.',
    expected: 'tec.delivery.succeeded carrying this message is in /api/v1/events; run and connection are removed afterwards.',
  },
  {
    code: 'tec.delivery.simulated',
    name: 'delivery simulated produces event tec.delivery.simulated',
    objective: 'Confirm that a delivery the application only simulates — because the channel has no real destination — is recorded in the event log as simulated, so nobody mistakes it for a real delivery (currently a known defect: the run says "simulated", but the event never reaches the log).',
    description: `POST /api/v1/runs {messageTypeCode:${MESSAGE_TYPE}, count:1, channel:file} answers 202 with delivery.simulated 1 and result status simulated (the file channel has no real transport). GET /api/v1/events?class=technical must then hold tec.delivery.simulated with entity.type delivery, entity.name file and payload.uetr = the message's reference. delivery.ts (deliverEligible) emits the event in memory only: it is never stored and carries no tenant, so no API can return it. Cleanup deletes the run.`,
    steps: [
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER, body: RUN_BODY('SIM'),
        expected_status: 202,
        expect_json: [...RUN_STARTED_OK, { path: 'delivery.simulated', equals: 1 }, { path: 'delivery.sent', equals: 0 }, { path: 'delivery.results.0.status', equals: 'simulated' }],
        save: { event_run_id: 'runId' },
        description: 'start a one-message run on the file channel (always simulated)',
        text: 'Start a test run that sends one message on the file channel, which has no real destination',
        expected: 'The run finishes and reports the delivery as simulated.',
        testData: `One ${MESSAGE_TYPE} message on the file channel.` },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{event_run_id}}/deliveries', headers: BEARER,
        expected_status: 200,
        expect_json: [{ path: 'data', min_length: 1, max_length: 1 }, { path: 'data.0.status', equals: 'simulated' }, { path: 'data.0.request_payload.uetr', exists: true }],
        save: { event_reference: 'data.0.request_payload.uetr' },
        description: 'keep the message\'s unique reference (uetr)',
        text: 'Open the run\'s delivery record and note the unique reference of the message',
        expected: 'One simulated delivery is listed.' },
      eventRecorded('tec.delivery.simulated', 'technical',
        { 'entity.type': 'delivery', 'entity.name': 'file', 'payload.uetr': '{{event_reference}}', outcome: 'info' },
        { text: 'Search the application\'s event log for the "delivery simulated" entry carrying this message', expected: 'The entry is there, for the file channel and this exact message.' }),
    ],
    cleanupSteps: cleanupRunFixture('event_run_id'),
    defect: 'not-stored',
    data: 'One generated message on the file channel.',
    expected: 'tec.delivery.simulated carrying this message is in /api/v1/events; the run is removed afterwards.',
  },
];

function eventEmissionCase(ev: EventCase): CaseDef {
  return {
    key: 'SBE-EV-' + ev.code.replace(/\./g, '-').toUpperCase(),
    name: ev.name,
    objective: ev.objective,
    description: ev.description,
    suiteKey: 'sb-event-emission',
    testType: 'integration',
    method: 'http',
    severity: ev.severity ?? 'high',
    priority: ev.priority ?? 'p1',
    preconditions: ev.preconditions ?? 'The application is running and the operator can sign in.',
    steps: [...(ev.opening ?? [API_LOGIN, READ_CLOCK]), ...ev.steps],
    ...(ev.cleanupSteps?.length ? { cleanupSteps: ev.cleanupSteps } : {}),
    ...(ev.atomicityNote ? { atomicityNote: ev.atomicityNote } : {}),
    tags: ['integration', 'event-emission', ev.code.split('.')[0]!, ...(ev.defect ? ['known-defect'] : [])],
    dataProfile: { profile: 'synthetic', data: ev.data, source: 'generated at run time' },
    expected: ev.expected,
    ...(ev.defect ? { commonFailureCauses: ev.defect === 'not-emitted' ? NOT_RECORDED : NOT_STORED } : {}),
  };
}

const eventCases = EVENT_CASES.map(eventEmissionCase);

export const SANDBENCH_EVENT_RT_CASES: CaseDef[] = tagSource(FILE, [...portalCases, ...eventCases]);
