/**
 * Delivery resilience cases — what Sand Bench really does when a delivery is
 * asked for twice or cannot be made.
 *
 * History. This suite was written in October against the feat/portal-features
 * branch, which promised a per-channel delivery policy (time limit, retries,
 * back-off, transactional roll-back, duplicate protection) behind
 * GET/PUT /api/v1/integrations[/:channel] and an on-demand
 * POST /api/v1/generated-messages/:id/dispatch. None of that exists in Sand Bench
 * main (commit a8d72039ae8e): the routes are not registered, no policy store
 * exists in apps/api/src, and the application team still lists it as an open
 * improvement (improvements/new/IMP-RES001.md). On 2026-11-14 the suite was
 * rebaselined to the behaviour the application does implement:
 *
 *   SBE-RES-DISPATCH-IDEMPOTENCY-REPLAY          duplicate protection exists for
 *     test runs: POST /api/v1/runs with an Idempotency-Key (liveOps.ts) answers a
 *     repeat with the first run and delivers nothing again; the same key with a
 *     different request is refused (409).
 *   SBE-RES-DISPATCH-FATAL-RETRIES-THEN-ROLLBACK a delivery the destination
 *     refuses is recorded as failed, never as delivered (delivery.ts postToApi →
 *     status "failed"). The application has no automatic retry and no roll-back.
 *
 * Deleted as not applicable — the capability is absent and has no equivalent:
 *   SBE-RES-INTEGRATIONS-LIST, SBE-RES-POLICY-GET-{API,MQ,KAFKA,FTP},
 *   SBE-RES-POLICY-PUT-{API,MQ,KAFKA,FTP}   (no per-channel policy to read or change)
 *   SBE-RES-DISPATCH-MALFORMED-REQUEST      (no dispatch route to refuse a request)
 *   SBE-RES-DISPATCH-TOLERATE-ON-FAILURE    (no transactional / non-transactional mode)
 *   SBE-RES-DISPATCH-RETRIES-SUCCEED        (no attempt counter or policy in the answer;
 *                                            a real acknowledged delivery is covered by
 *                                            SBE-RT-API-END-TO-END)
 */
import { type CaseDef, type SuiteDef, tagSource } from './types.js';
import { cleanupRunFixture } from './sandbench-cleanup.js';

const FILE = 'apps/api/src/catalog/sandbench-resilience-cases.ts';

export const SANDBENCH_RESILIENCE_SUITE: SuiteDef = {
  key: 'sb-portal-resilience',
  name: 'Portal integration resilience',
  description:
    'What Sand Bench does when a delivery is asked for twice or is refused by the destination: a repeated request does not deliver again, and a refused delivery is recorded as failed, never as delivered.',
  typeKey: 'apiPortalIntegration',
  category: 'qa',
};

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { username: '{{username}}', password: '{{password}}' },
  expected_status: 200,
  expect_json: [{ path: 'token', exists: true }, { path: 'user.id', exists: true }],
  save: { token: 'token', res_actor_id: 'user.id' },
  description: 'operator login',
  text: 'Sign in as the operator',
  expected: 'The sign-in is accepted.',
} as const;
const BEARER = { authorization: 'Bearer {{token}}' };
const MESSAGE_TYPE = 'pacs.008.001.08';

const C: CaseDef[] = [];

/* -------------------- the same request twice --------------------------- */

const IDEM_KEY = 'TE-RES-IDEM-{{rand}}-{{ts}}';
const IDEM_BODY = { messageTypeCode: MESSAGE_TYPE, count: 1, channel: 'file', seed: IDEM_KEY };

C.push({
  key: 'SBE-RES-DISPATCH-IDEMPOTENCY-REPLAY',
  name: 'A test run repeated with the same request key is answered from the first run and not delivered again',
  objective: 'Confirm that sending the same "start a test run" request twice — as happens when a connection drops and the sender tries again — creates one run only: the second answer points at the first run and delivers nothing a second time, and reusing the key for a different request is refused.',
  description: `POST /api/v1/runs {messageTypeCode:${MESSAGE_TYPE}, count:1, channel:file} with header Idempotency-Key:<per-run key> answers 202 with a runId and one delivery. The identical request with the same key answers 202 with the SAME runId, idempotent:true and delivery counts all 0. The same key with a different body (count:2) answers 409 conflict "Idempotency-Key reused with different request body". GET /api/v1/runs/{runId}/deliveries still holds exactly one delivery. Cleanup deletes the run.`,
  suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
  severity: 'critical', priority: 'p0',
  preconditions: `The application is running and the operator can sign in. The baseline message type ${MESSAGE_TYPE} is installed.`,
  steps: [
    API_LOGIN,
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs',
      headers: { ...BEARER, 'idempotency-key': IDEM_KEY }, body: IDEM_BODY,
      expected_status: 202,
      expect_json: [
        { path: 'accepted', equals: true },
        { path: 'status', equals: 'completed' },
        { path: 'generated', equals: 1 },
        { path: 'delivery.simulated', equals: 1 },
        { path: 'runId', exists: true },
        { path: 'idempotent', exists: false },
      ],
      save: { res_run_id: 'runId' },
      description: 'first request with the key: a run is created and its one message goes out',
      text: 'Start a test run that sends one message, marking the request with a key unique to this run',
      expected: 'The run is accepted and finishes with one message handled.',
      testData: `One ${MESSAGE_TYPE} message on the file channel; a request key unique to this run.` },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs',
      headers: { ...BEARER, 'idempotency-key': IDEM_KEY }, body: IDEM_BODY,
      expected_status: 202,
      expect_json: [
        { path: 'accepted', equals: true },
        { path: 'idempotent', equals: true },
        { path: 'runId', equals: '{{res_run_id}}' },
        { path: 'status', equals: 'completed' },
        { path: 'delivery.sent', equals: 0 },
        { path: 'delivery.simulated', equals: 0 },
        { path: 'delivery.failed', equals: 0 },
      ],
      description: 'the identical request with the same key is answered from the first run; nothing is delivered again',
      text: 'Send exactly the same request again, with the same key',
      expected: 'The application answers with the first run and reports that nothing was sent this time.' },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs',
      headers: { ...BEARER, 'idempotency-key': IDEM_KEY }, body: { ...IDEM_BODY, count: 2 },
      expected_status: 409,
      expect_json: [{ path: 'error.code', equals: 'conflict' }, { path: 'error.message', contains: 'Idempotency-Key reused with different request body' }],
      description: 'the same key with a different request is refused',
      text: 'Send a different request (two messages instead of one) under the same key',
      expected: 'The application refuses: the key already belongs to another request.' },
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{res_run_id}}/deliveries', headers: BEARER,
      expected_status: 200,
      expect_json: [{ path: 'data', min_length: 1, max_length: 1 }, { path: 'total', equals: 1 }],
      description: 'the run still holds exactly one delivery',
      text: 'Open the run\'s delivery record',
      expected: 'Exactly one delivery is listed: the message went out once.' },
  ],
  cleanupSteps: cleanupRunFixture('res_run_id'),
  atomicityNote: {
    reason: 'tests-idempotency',
    detail: 'The same "start a run" request is sent three times on purpose: twice identically to prove the repeat creates nothing, once changed to prove the key cannot be reused. Only the first creates a run, and that run is deleted afterwards.',
  },
  tags: ['integration', 'resilience', 'idempotency', 'runs'],
  dataProfile: { profile: 'synthetic', data: 'One generated message; the same request sent twice under one per-run key, then once changed.', source: 'generated at run time' },
  expected: 'Second answer carries idempotent:true and the first runId with no delivery; the changed request is refused (409); one delivery in total; the run is removed.',
});

/* -------------------- a delivery the destination refuses ---------------- */

C.push({
  key: 'SBE-RES-DISPATCH-FATAL-RETRIES-THEN-ROLLBACK',
  name: 'A delivery the destination refuses is recorded as failed, never as delivered',
  objective: 'Confirm that when the outside system refuses a message, the test run says so everywhere: the run and its delivery are marked failed with the reason, the result is a fail, the event log records the failure, and nothing is reported as delivered.',
  description: `The case saves its own connection (PUT /api/v1/external-systems/{id}, channel api) whose endpoint is the API portal as the application reaches it (GET /api/v1/channel-targets, api entry) plus a path the portal does not serve, so the portal answers "not found". POST /api/v1/runs {messageTypeCode:${MESSAGE_TYPE}, count:1, connectionId} answers 202 with status failed, delivery.failed 1, delivery.sent 0, results[0] {status failed, detail "api 404"} and report.result fail. GET /api/v1/runs/{runId} shows status failed; GET …/deliveries shows the failed delivery with the portal's refusal kept; GET /api/v1/events?class=business&screenId=trNew holds biz.run.completed with outcome failure and telemetry.failed 1; {{apiPortal}}/app/ledger?q=<per-run path> is empty. The application makes one attempt: it has no automatic retry and no roll-back (the delivery policy of improvement IMP-RES001 is not built). Cleanup deletes the run and the connection.`,
  suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
  severity: 'critical', priority: 'p0',
  preconditions: `The application and the API portal are running; the operator can sign in and may save connections. The baseline message type ${MESSAGE_TYPE} is installed.`,
  steps: [
    API_LOGIN,
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/ux/clock', headers: BEARER,
      expected_status: 200, expect_json: [{ path: 'epochMs', min: 1 }], save: { res_since: 'epochMs' },
      description: 'read the application clock (lower time bound for the event search)',
      text: 'Note the application\'s current time, so that only events recorded from now on count',
      expected: 'The application reports its current time.' },
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/channel-targets', headers: BEARER,
      expected_status: 200,
      expect_json: [{ path: 'data.1.channel', equals: 'api' }, { path: 'data.1.portal', matches: '^https?://' }],
      save: { res_portal_address: 'data.1.portal' },
      description: 'read the address at which the application reaches the API portal',
      text: 'Ask the application where it reaches the API portal',
      expected: 'The application names the API portal\'s address.' },
    { action: 'request', method: 'PUT', url: '{{api}}/api/v1/external-systems/ext_te_res_{{rand}}{{ts}}', headers: BEARER,
      body: { name: 'TE refused delivery {{rand}}-{{ts}}', kind: 'desk', channel: 'api', family: 'api', endpoint: '{{res_portal_address}}/no-such-door/te-res-{{rand}}-{{ts}}', headers: {}, enabled: true },
      expected_status: 200,
      expect_json: [{ path: 'id', equals: 'ext_te_res_{{rand}}{{ts}}' }, { path: 'channel', equals: 'api' }, { path: 'enabled', equals: true }],
      save: { res_connection_id: 'id' },
      description: 'save a case-owned connection whose address the API portal does not serve',
      text: 'Save a connection for this test only, pointing at an address the API portal will refuse',
      expected: 'The connection is saved.',
      testData: 'A connection whose name and address are unique to this run.' },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/runs', headers: BEARER,
      body: { messageTypeCode: MESSAGE_TYPE, count: 1, connectionId: 'ext_te_res_{{rand}}{{ts}}', seed: 'TE-RES-FAIL-{{rand}}-{{ts}}' },
      expected_status: 202,
      expect_json: [
        { path: 'accepted', equals: true },
        { path: 'status', equals: 'failed' },
        { path: 'generated', equals: 1 },
        { path: 'delivery.failed', equals: 1 },
        { path: 'delivery.sent', equals: 0 },
        { path: 'delivery.simulated', equals: 0 },
        { path: 'delivery.results.0.channel', equals: 'api' },
        { path: 'delivery.results.0.status', equals: 'failed' },
        { path: 'delivery.results.0.detail', equals: 'api 404' },
        { path: 'report.result', equals: 'fail' },
      ],
      save: { res_run_id: 'runId' },
      description: 'run one message through the connection: the portal refuses it and the run reports the failure',
      text: 'Start a test run that sends one message through that connection',
      expected: 'The run is recorded, but as failed: one delivery failed, none delivered, with the destination\'s refusal as the reason.',
      testData: `One ${MESSAGE_TYPE} message, generated by the application.` },
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{res_run_id}}', headers: BEARER,
      expected_status: 200,
      expect_json: [{ path: 'id', equals: '{{res_run_id}}' }, { path: 'status', equals: 'failed' }, { path: 'totals.failed', equals: 1 }, { path: 'totals.sent', equals: 0 }],
      description: 'the stored run is marked failed',
      text: 'Open the stored run',
      expected: 'It is marked failed, with one failed delivery and none delivered.' },
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs/{{res_run_id}}/deliveries', headers: BEARER,
      expected_status: 200,
      expect_json: [
        { path: 'data', min_length: 1, max_length: 1 },
        { path: 'data.0.channel', equals: 'api' },
        { path: 'data.0.status', equals: 'failed' },
        { path: 'data.0.detail', equals: 'api 404' },
        { path: 'data.0.response_payload.error', equals: 'not found' },
      ],
      description: 'the delivery record is failed and keeps the portal\'s refusal',
      text: 'Open the run\'s delivery record',
      expected: 'One delivery is listed, marked failed, with the destination\'s answer kept.' },
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/events?class=business&screenId=trNew&limit=500', headers: BEARER,
      expected_status: 200,
      expect_json: [{ path: 'data', some: {
        eventCode: 'biz.run.completed',
        'entity.id': '{{res_run_id}}',
        'actor.userId': '{{res_actor_id}}',
        outcome: 'failure',
        'telemetry.channel': 'api',
        'telemetry.failed': 1,
        'telemetry.sent': 0,
        occurredAt: { at_or_after: '{{res_since}}' },
      } }],
      poll: { timeout_ms: 5000, interval_ms: 500 },
      description: 'event log holds biz.run.completed for this run with outcome failure',
      text: 'Search the application\'s event log for the "test run finished" entry of this run',
      expected: 'The entry is there, made by this operator, marked as a failure with one failed delivery.' },
    { action: 'request', method: 'GET', url: '{{apiPortal}}/app/ledger?q=te-res-{{rand}}-{{ts}}', expected_status: 200,
      expect_json: [{ path: 'data', exists: true }, { path: 'data', max_length: 0 }],
      description: 'the API portal recorded nothing for the refused message',
      text: 'Search the API portal\'s record of received messages for this run\'s address ending',
      expected: 'Nothing is listed: the message was not taken in.' },
  ],
  cleanupSteps: [
    ...cleanupRunFixture('res_run_id'),
    { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/external-systems/{{res_connection_id}}', headers: BEARER,
      skip_if_missing: ['res_connection_id'], expected_status: 200,
      description: 'delete the case-owned connection',
      text: 'Remove the connection this test saved', expected: 'The connection is removed.' },
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/external-systems', headers: BEARER,
      skip_if_missing: ['res_connection_id'], expected_status: 200,
      expected_body_not_contains: '{{res_connection_id}}',
      description: 'verify the connection is no longer listed',
      text: 'Check that the connection is no longer listed', expected: 'The list of connections does not contain it.' },
  ],
  tags: ['integration', 'resilience', 'delivery-failure', 'runs'],
  dataProfile: { profile: 'synthetic', data: `One ${MESSAGE_TYPE} message sent to an address the API portal refuses, through a case-owned connection.`, source: 'generated at run time' },
  expected: 'Run, delivery, report and event all say failed; nothing delivered; nothing in the portal; run and connection removed.',
  commonFailureCauses: 'The API portal is not running (the failure reason then reads "unreachable" instead of the portal\'s refusal), or the application cannot reach it at the address it reports.',
});

export const SANDBENCH_RESILIENCE_CASES: CaseDef[] = tagSource(FILE, C);
