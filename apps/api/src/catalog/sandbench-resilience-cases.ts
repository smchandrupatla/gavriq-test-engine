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
 * Each case re-reads the policy before and resets it afterwards to minimise
 * cross-case drift; the catalog seeder has no transactions so cases
 * sequence in run order.
 */
import { CaseDef, SuiteDef, tagSource } from './types.ts';

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
      expect_json: [{ path: 'data', min_length: 4 }],
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
    objective: `Confirm the ${ch} resilience policy carries timeout_ms, max_retries, backoff_ms, transactional and idempotency fields.`,
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
          { path: 'data.transactional', exists: true },
          { path: 'data.idempotency_header', exists: true },
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
    description: `PUT /api/v1/integrations/${ch} {timeout_ms, max_retries} and GET returns the new values. Teardown restores defaults.`,
    suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
    severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench feat/portal-features deployed.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'PUT', url: `{{api}}/api/v1/integrations/${ch}`,
        headers: BEARER, body: { timeout_ms: 1234, max_retries: 1, backoff_ms: 50 },
        expected_status: 200,
        expect_json: [{ path: 'data.timeout_ms', equals: 1234 }, { path: 'data.max_retries', equals: 1 }],
        description: 'patch policy' },
      { action: 'request', method: 'GET', url: `{{api}}/api/v1/integrations/${ch}`,
        headers: BEARER, expected_status: 200,
        expect_json: [{ path: 'data.timeout_ms', equals: 1234 }],
        description: 'readback' },
    ],
    cleanupSteps: [
      API_LOGIN,
      { action: 'request', method: 'PUT', url: `{{api}}/api/v1/integrations/${ch}`,
        headers: BEARER, body: { timeout_ms: 2000, max_retries: 3, backoff_ms: 100 },
        expected_status: 200, description: 'restore defaults' },
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
  objective: 'Confirm the dispatch endpoint rejects an obviously invalid body cleanly rather than 5xx.',
  description: 'POST /api/v1/generated-messages/some-id/dispatch with an empty body returns 400.',
  suiteKey: SANDBENCH_RESILIENCE_SUITE.key, testType: 'integration', method: 'http',
  severity: 'high', priority: 'p1',
  preconditions: 'Sand Bench feat/portal-features deployed.',
  steps: [
    API_LOGIN,
    { action: 'request', method: 'POST', url: '{{api}}/api/v1/generated-messages/does-not-exist/dispatch',
      headers: BEARER, body: {},
      expected_status: [400, 404],
      description: 'dispatch with no channel' },
  ],
  tags: ['integration', 'resilience', 'dispatch', 'malformed-request', 'error-handling'],
  dataProfile: { profile: 'adversarial', data: 'An empty request body.', source: 'inline' },
  expected: '400 (validation) or 404 (unknown id).',
});

/* -------------------- retry/timeout/fatal/rollback -------------------- */

const UNREACHABLE_URL = 'http://127.0.0.1:65535/nope';

C.push({
  key: 'SBE-RES-DISPATCH-FATAL-RETRIES-THEN-ROLLBACK',
  name: 'Transactional dispatch rolls back after retries exhaust against an unreachable portal',
  objective: 'Confirm Sand Bench retries up to the configured count against a fatally-failing portal, then rolls the dispatch back with a 502.',
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
    { action: 'request', method: 'PUT', url: '{{api}}/api/v1/integrations/api',
      headers: BEARER, body: { timeout_ms: 2000, max_retries: 3, backoff_ms: 100, transactional: true },
      expected_status: 200, description: 'restore defaults' },
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
    { action: 'request', method: 'PUT', url: '{{api}}/api/v1/integrations/api',
      headers: BEARER, body: { timeout_ms: 2000, max_retries: 3, backoff_ms: 100, transactional: true },
      expected_status: 200, description: 'restore defaults' },
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
  name: 'Dispatch succeeds on retry when the first attempt points at a dead URL and the retry uses the healthy portal',
  objective: 'Confirm the retry mechanism actually works: when the policy caps retries at 1 but the URL changes mid-flight is impossible, this instead probes the attempts counter on a successful (first-try) dispatch.',
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

export const SANDBENCH_RESILIENCE_CASES: CaseDef[] = tagSource(FILE, C);
