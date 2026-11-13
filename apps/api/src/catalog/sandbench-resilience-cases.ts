/**
 * Portal resilience cases — exercise the per-channel integration policy
 * (timeout, max_retries, backoff, transactional, idempotency) added to
 * Sand Bench on feat/portal-features.
 *
 * For each channel (api/mq/kafka/ftp):
 *   - visibility: GET /api/v1/integrations surfaces the policy; PUT updates it.
 *   - timeout:    a ~1 ms timeout plus a slow(-ish) target drains all retries
 *                 and the request ends 502 rolled_back:true.
 *   - fatal 5xx:  pointing dispatch at a URL that returns 500 drains retries
 *                 and ends 502 rolled_back:true, attempts = retries + 1.
 *   - transactional off: same failure, but code=dispatch_failed_tolerated
 *                 (keeps the generated message intact).
 *   - idempotency: two dispatches with the same Idempotency-Key under TTL
 *                 — the second reports idempotent_replay:true and does
 *                 not re-contact the portal.
 *   - malformed request: POST /dispatch with no channel — 400.
 *
 * Policy changes capture their starting values and verify exact restoration
 * in unconditional cleanup. These application-wide policies require an
 * isolated target when another case could change the same channel.
 *
 * STATUS against Sand Bench main (commit a8d72039ae8e, rebaselined 2026-11-13):
 * the capability is NOT in the application. Neither /api/v1/integrations[/:channel]
 * nor /api/v1/generated-messages/:id/dispatch is registered (the router answers
 * 404 "Route … not found"), and nothing in apps/api/src implements a per-channel
 * policy store. The application team tracks it as improvements/new/IMP-RES001.md
 * ("ship /api/v1/integrations/* and /api/v1/generated-messages/:id/dispatch"),
 * whose acceptance criterion is that these very cases pass. They are therefore
 * kept as the acceptance tests and fail until the capability ships; nothing here
 * is loosened to make them pass. The one thing aligned with the current build is
 * the set-up step that stores a generated message: it uses the route that exists
 * today (POST /api/v1/generated-messages with a batch number of its own).
 */
import { type CaseDef, type SuiteDef, tagSource } from './types.js';

const FILE = 'apps/api/src/catalog/sandbench-resilience-cases.ts';

export const SANDBENCH_RESILIENCE_SUITE: SuiteDef = {
  key: 'sb-portal-resilience',
  name: 'Portal integration resilience',
  description:
    'Per-channel timeout / retry / transactional rollback / idempotency behaviour on Sand Bench\'s dispatch pipeline.',
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

type Channel = 'api' | 'mq' | 'kafka' | 'ftp';
const CHANNELS: Channel[] = ['api', 'mq', 'kafka', 'ftp'];

const C: CaseDef[] = [];

/* -------------------- visibility ------------------------------------- */

C.push({
  key: 'SBE-RES-INTEGRATIONS-LIST',
  name: 'All four channel policies are visible via GET /api/v1/integrations',
  objective: 'Confirm operators can see every channel\'s resilience policy at a glance.',
  description: 'GET /api/v1/integrations returns 200 with data[] containing one entry per api/mq/kafka/ftp channel.',
  suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
  severity: 'high', priority: 'p1',
  preconditions: 'Sand Bench feat/portal-features deployed; operator can sign in.',
  steps: [
    API_LOGIN,
    { action: 'request', method: 'GET', url: '{{api}}/api/v1/integrations',
      headers: BEARER, expected_status: 200,
      expect_json: [
        { path: 'data', min_length: 4, max_length: 4 },
        ...CHANNELS.map(channel => ({ path: 'data', some: { channel } })),
      ],
      description: 'policies list' },
  ],
  tags: ['integration', 'resilience', 'policy', 'visibility'],
  dataProfile: { profile: 'none (read-only)', data: 'A single GET.', source: 'n/a' },
  expected: '200 with four policies.',
});

for (const ch of CHANNELS) {
  C.push({
    key: `SBE-RES-POLICY-GET-${ch.toUpperCase()}`,
    name: `${ch} channel policy is readable with the documented fields`,
    objective: `Confirm operators can read the ${ch} delivery limits, retry settings and duplicate-delivery protection.`,
    description: `GET /api/v1/integrations/${ch} returns 200 with the policy fields set.`,
    suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
    severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench feat/portal-features deployed.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: `{{api}}/api/v1/integrations/${ch}`,
        headers: BEARER, expected_status: 200,
        expect_json: [
          { path: 'data.channel', equals: ch },
          { path: 'data.timeout_ms', exists: true },
          { path: 'data.max_retries', exists: true },
          { path: 'data.backoff_ms', exists: true },
          { path: 'data.transactional', exists: true },
          { path: 'data.idempotency_header', exists: true },
          { path: 'data.idempotency_ttl_ms', exists: true },
        ],
        description: `policy /${ch}` },
    ],
    tags: ['integration', 'resilience', 'policy', ch],
    dataProfile: { profile: 'none (read-only)', data: 'A single GET.', source: 'n/a' },
    expected: `200 with channel=${ch} and the resilience fields present.`,
  });

  C.push({
    key: `SBE-RES-POLICY-PUT-${ch.toUpperCase()}`,
    name: `${ch} channel policy is updatable; readback reflects the change`,
    objective: `Confirm an operator can lower retries + timeout on ${ch} and read the new values back.`,
    description: `PUT /api/v1/integrations/${ch} {timeout_ms, max_retries, backoff_ms} and GET returns all changed values. Cleanup restores and verifies the captured policy.`,
    suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
    severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench feat/portal-features deployed.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'PUT', url: `{{api}}/api/v1/integrations/${ch}`,
        headers: BEARER, body: { timeout_ms: 1234, max_retries: 1, backoff_ms: 50 },
        expected_status: 200,
        expect_json: [{ path: 'data.timeout_ms', equals: 1234 }, { path: 'data.max_retries', equals: 1 }, { path: 'data.backoff_ms', equals: 50 }],
        description: 'patch policy' },
      { action: 'request', method: 'GET', url: `{{api}}/api/v1/integrations/${ch}`,
        headers: BEARER, expected_status: 200,
        expect_json: [{ path: 'data.timeout_ms', equals: 1234 }, { path: 'data.max_retries', equals: 1 }, { path: 'data.backoff_ms', equals: 50 }],
        description: 'readback' },
    ],
    cleanupSteps: [
      API_LOGIN,
    ],
    tags: ['integration', 'resilience', 'policy', ch, 'update'],
    dataProfile: { profile: 'synthetic', data: 'A short policy patch and a readback.', source: 'inline' },
    expected: 'PUT accepted; GET returns the new values.',
  });
}

/* -------------------- malformed request ------------------------------- */

C.push({
  key: 'SBE-RES-DISPATCH-MALFORMED-REQUEST',
  name: 'Dispatch rejects a malformed request (no channel) with a clean 400',
  objective: 'Confirm that asking for a delivery without saying which channel to use is refused as an invalid request, with a clear reason, rather than failing inside the application.',
  description: 'POST /api/v1/generated-messages/does-not-exist/dispatch with an empty body (no channel) returns 400 with a validation error. The router\'s own 404 "Route not found" — what the current build answers, because the dispatch route does not exist — is not that refusal and does not pass.',
  suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
  severity: 'high', priority: 'p1',
  preconditions: 'Sand Bench feat/portal-features deployed.',
  steps: [
    API_LOGIN,
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/does-not-exist/dispatch',
      headers: BEARER, body: {},
      expected_status: 400,
      expected_body_not_contains: 'Route POST:',
      description: 'dispatch with no channel is refused as invalid' },
  ],
  tags: ['integration', 'resilience', 'dispatch', 'malformed-request', 'error-handling'],
  dataProfile: { profile: 'adversarial', data: 'An empty request body.', source: 'inline' },
  expected: '400 (validation: channel is required).',
});

/* -------------------- retry/timeout/fatal/rollback -------------------- */

const UNREACHABLE_URL = 'http://127.0.0.1:65535/nope';

C.push({
  key: 'SBE-RES-DISPATCH-FATAL-RETRIES-THEN-ROLLBACK',
  name: 'Transactional dispatch rolls back after retries exhaust against an unreachable portal',
  objective: 'Confirm Sand Bench retries a failed delivery up to the configured limit and then rolls it back, so an unsuccessful dispatch is never recorded as delivered.',
  description: 'With the default policy (max_retries=3, transactional=true), POST /dispatch at a dead URL ends 502 with rolled_back:true and attempts=4.',
  suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
  severity: 'critical', priority: 'p0',
  preconditions: 'Sand Bench feat/portal-features deployed; policy at defaults.',
  steps: [
    API_LOGIN,
    { action: 'request', method: 'PUT', url: '{{api}}/api/v1/integrations/api',
      headers: BEARER, body: { timeout_ms: 500, max_retries: 3, backoff_ms: 10, transactional: true },
      expected_status: 200, description: 'policy: 3 retries, transactional' },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages',
      headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: 'RES-FATAL-{{rand}}-{{ts}}', filename: 'res-fatal-{{rand}}.jsonl' },
      expected_status: [200, 202], save: { gen_id: 'ids.0' },
      description: 'generate one message to dispatch' },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/{{gen_id}}/dispatch',
      headers: BEARER, body: { channel: 'api', url: UNREACHABLE_URL },
      expected_status: 502,
      expect_json: [
        { path: 'error', equals: 'dispatch_failed_rolled_back' },
        { path: 'rolled_back', equals: true },
        { path: 'attempts', equals: 4 },
      ],
      description: 'dispatch to dead URL' },
  ],
  cleanupSteps: [
    API_LOGIN,
  ],
  tags: ['integration', 'resilience', 'dispatch', 'retry', 'rollback', 'transactional'],
  dataProfile: { profile: 'synthetic', data: 'One generated message dispatched at a dead URL.', source: 'generated' },
  expected: '502, rolled_back:true, attempts:4.',
});

C.push({
  key: 'SBE-RES-DISPATCH-TOLERATE-ON-FAILURE',
  name: 'Non-transactional dispatch tolerates a final failure (keeps the generated message)',
  objective: 'Confirm turning transactional off makes dispatch tolerate a final failure without a rollback.',
  description: 'With transactional:false, dispatch at a dead URL ends with code dispatch_failed_tolerated and rolled_back:false.',
  suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
  severity: 'high', priority: 'p1',
  preconditions: 'Sand Bench feat/portal-features deployed.',
  steps: [
    API_LOGIN,
    { action: 'request', method: 'PUT', url: '{{api}}/api/v1/integrations/api',
      headers: BEARER, body: { timeout_ms: 500, max_retries: 1, backoff_ms: 10, transactional: false },
      expected_status: 200, description: 'policy: 1 retry, non-transactional' },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages',
      headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: 'RES-TOL-{{rand}}-{{ts}}', filename: 'res-tol-{{rand}}.jsonl' },
      expected_status: [200, 202], save: { gen_id: 'ids.0' },
      description: 'generate one message' },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/{{gen_id}}/dispatch',
      headers: BEARER, body: { channel: 'api', url: UNREACHABLE_URL },
      expected_status: 200,
      expect_json: [
        { path: 'error', equals: 'dispatch_failed_tolerated' },
        { path: 'rolled_back', equals: false },
      ],
      description: 'dispatch tolerates the failure' },
  ],
  cleanupSteps: [
    API_LOGIN,
  ],
  tags: ['integration', 'resilience', 'dispatch', 'tolerate'],
  dataProfile: { profile: 'synthetic', data: 'One generated message dispatched at a dead URL under non-transactional policy.', source: 'generated' },
  expected: '200 (tolerate) with error:dispatch_failed_tolerated.',
});

C.push({
  key: 'SBE-RES-DISPATCH-IDEMPOTENCY-REPLAY',
  name: 'Dispatch replays the first response when the same Idempotency-Key is sent twice',
  objective: 'Confirm an idempotency key within TTL short-circuits a second identical dispatch so the portal sees only one call.',
  description: 'POST dispatch with Idempotency-Key:X twice; the second response carries idempotent_replay:true and the tag of the first.',
  suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
  severity: 'critical', priority: 'p0',
  preconditions: 'Sand Bench feat/portal-features deployed; API portal reachable.',
  steps: [
    API_LOGIN,
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages',
      headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: 'RES-IDEM-{{rand}}-{{ts}}', filename: 'res-idem-{{rand}}.jsonl' },
      expected_status: [200, 202], save: { gen_id: 'ids.0' },
      description: 'generate one message' },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/{{gen_id}}/dispatch',
      headers: { ...BEARER, 'idempotency-key': 'RES-IDEM-{{rand}}-{{ts}}' },
      body: { channel: 'api', tag: 'IDEM-FIRST-{{rand}}-{{ts}}' },
      expected_status: 200,
      expect_json: [{ path: 'forwarded', equals: true }],
      save: { first_tag: 'tag' },
      description: 'first dispatch' },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/{{gen_id}}/dispatch',
      headers: { ...BEARER, 'idempotency-key': 'RES-IDEM-{{rand}}-{{ts}}' },
      body: { channel: 'api', tag: 'IDEM-SECOND-{{rand}}-{{ts}}' },
      expected_status: 200,
      expect_json: [
        { path: 'idempotent_replay', equals: true },
        { path: 'tag', equals: '{{first_tag}}' },
      ],
      description: 'second dispatch replays the first' },
  ],
  tags: ['integration', 'resilience', 'dispatch', 'idempotency'],
  dataProfile: { profile: 'synthetic', data: 'One generated message dispatched twice with the same idempotency key.', source: 'generated' },
  expected: 'Second response has idempotent_replay:true and the first tag.',
});

C.push({
  key: 'SBE-RES-DISPATCH-RETRIES-SUCCEED',
  name: 'Successful dispatch reports its first attempt and delivery policy',
  objective: 'Confirm a successful delivery reports one attempt and the policy it used, so operators can distinguish immediate success from a retried delivery.',
  description: 'Dispatch succeeds on first attempt; response reports attempts:1 and policy values. (A true "fail then recover" case is hard to orchestrate without a per-attempt URL rewrite — the fatal case covers the retry path.)',
  suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
  severity: 'medium', priority: 'p2',
  preconditions: 'Sand Bench feat/portal-features deployed; API portal reachable at {{apiPortal}}.',
  steps: [
    API_LOGIN,
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages',
      headers: BEARER, body: { messageTypeCode: 'pacs.008.001.14', count: 1, seed: 'RES-SUCC-{{rand}}-{{ts}}', filename: 'res-succ-{{rand}}.jsonl' },
      expected_status: [200, 202], save: { gen_id: 'ids.0' },
      description: 'generate one message' },
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/{{gen_id}}/dispatch',
      headers: BEARER, body: { channel: 'api' },
      expected_status: 200,
      expect_json: [
        { path: 'forwarded', equals: true },
        { path: 'attempts', equals: 1 },
        { path: 'policy.max_retries', exists: true },
        { path: 'policy.transactional', exists: true },
      ],
      description: 'dispatch succeeds on first attempt' },
  ],
  tags: ['integration', 'resilience', 'dispatch', 'attempt-counter'],
  dataProfile: { profile: 'synthetic', data: 'One generated message dispatched to the healthy API portal.', source: 'generated' },
  expected: 'attempts:1 and policy fields reported in the response.',
});

for (const c of C) {
  const steps = c.steps as Record<string, any>[];
  // Storing a generated message: the route the current application has is
  // POST /api/v1/generated-messages {messageTypeCode, count, seed, batchNumber}
  // → 200 {stored, batchNumber, ids}. A batch number of the case's own is
  // required in practice: without one the application reuses its default batch
  // "B001" and fails internally (500) on every call after the first (defect).
  for (const step of steps) {
    if (step.method === 'POST' && step.url === '{{api}}/api/v1/generated-messages') {
      const body = { ...(step.body as Record<string, unknown>) };
      delete body.filename; // not a field of the generation route
      step.body = { ...body, batchNumber: `TE-${String(body.seed)}` };
      step.expected_status = 200;
      step.expect_json = [{ path: 'stored', equals: 1 }, { path: 'batchNumber', equals: `TE-${String(body.seed)}` }, { path: 'ids', min_length: 1, max_length: 1 }, { path: 'ids.0', exists: true }];
      step.text = 'Generate and store one test message to deliver';
      step.expected = 'One message is stored under a batch number unique to this run.';
    }
  }
  const policyUrls = [...new Set(steps.filter(s => s.method === 'PUT' && /\/integrations\/(api|mq|kafka|ftp)$/.test(s.url || '')).map(s => s.url as string))];
  if (policyUrls.length) {
    const fields = ['channel', 'timeout_ms', 'max_retries', 'backoff_ms', 'transactional', 'idempotency_header', 'idempotency_ttl_ms'];
    c.cleanupSteps ||= [];
    for (const [index, url] of policyUrls.entries()) {
      const prefix = `policy_before_${index}`;
      const firstWrite = steps.findIndex(s => s.method === 'PUT' && s.url === url);
      steps.splice(firstWrite, 0, {
        action: 'request', method: 'GET', url, headers: BEARER, expected_status: 200,
        expect_json: fields.map(field => ({ path: `data.${field}`, exists: true })),
        save: { [prefix]: 'data', ...Object.fromEntries(fields.map(field => [`${prefix}_${field}`, `data.${field}`])) },
        description: 'Capture the original delivery settings before changing them',
      });
      c.cleanupSteps.push(
        { action: 'request', method: 'PUT', url, headers: BEARER, body_json: `{{${prefix}}}`,
          skip_if_missing: [prefix], expected_status: 200, description: 'Restore the captured delivery settings with their original types' },
        { action: 'request', method: 'GET', url, headers: BEARER, skip_if_missing: [prefix], expected_status: 200,
          expect_json: fields.map(field => ({ path: `data.${field}`, equals: `{{${prefix}_${field}}}` })),
          description: 'Verify every original delivery setting was restored' },
      );
    }
    c.preconditions += ' Use an isolated target: channel policies are application-wide and must not be changed concurrently.';
  }
  if (steps.some(s => s.method === 'POST' && s.url === '{{api}}/api/v1/generated-messages')) {
    c.atomicityNote = {
      reason: 'no-cleanup-endpoint',
      detail: 'The application exposes no delete operation for a stored generated message. Settings cleanup restores and verifies captured settings; the one generated message sits in a batch of its own that no other case reads. This case does not claim complete baseline restoration.',
    };
  }
  // Every case here needs the delivery-policy capability, which the current build lacks.
  c.preconditions = c.preconditions.replace('Sand Bench feat/portal-features deployed', 'The application build includes the delivery-policy capability (per-channel time limit, retries, roll-back and duplicate protection, with the on-demand delivery of a stored message)');
  c.tags = [...c.tags, 'pending-capability'];
  c.commonFailureCauses = 'The application build under test does not include the delivery-policy capability: the addresses these steps call do not exist yet, so the application answers "not found". The application team tracks the capability as improvement IMP-RES001; these cases are its acceptance tests.';
}

export const SANDBENCH_RESILIENCE_CASES: CaseDef[] = tagSource(FILE, C);
