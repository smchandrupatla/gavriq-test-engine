import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SANDBENCH_ALL_CASES, SANDBENCH_ALL_SUITES } from '../apps/api/src/catalog/sandbench-catalog.js';
import { SANDBENCH_API_COVERAGE_CASES } from '../apps/api/src/catalog/sandbench-api-coverage-cases.js';
import { SANDBENCH_EVENT_RT_CASES } from '../apps/api/src/catalog/sandbench-event-roundtrip-cases.js';

type Step = Record<string, any>;

describe('complete Sand Bench catalog', () => {
  it('keeps case keys unique and every case attached to a registered suite', () => {
    const keys = new Set<string>();
    const suites = new Set(SANDBENCH_ALL_SUITES.map(suite => suite.key));
    for (const c of SANDBENCH_ALL_CASES) {
      assert.ok(!keys.has(c.key), `duplicate case key: ${c.key}`);
      keys.add(c.key);
      assert.ok(suites.has(c.suiteKey), `${c.key}: unknown suite ${c.suiteKey}`);
    }
  });

  it('requires sign-in before a surface sweep can write to a protected route', () => {
    const cases = SANDBENCH_API_COVERAGE_CASES.filter(c => c.tags.includes('auth-boundary'));
    assert.ok(cases.length > 100, 'the complete protected-write inventory must be checked');
    for (const c of cases) {
      const steps = c.steps as Step[];
      assert.equal(steps.length, 1, `${c.key}: must not establish a session for this probe`);
      assert.equal(steps[0]?.expected_status, 401, `${c.key}: only a sign-in refusal is acceptable`);
      assert.equal(steps[0]?.headers?.authorization, undefined, `${c.key}: supplied an authenticated token`);
      assert.notEqual(steps[0]?.method, 'GET');
    }
  });

  it('does not accept internal errors as successful API surface coverage', () => {
    for (const c of SANDBENCH_API_COVERAGE_CASES) {
      for (const step of c.steps as Step[]) {
        const statuses = Array.isArray(step.expected_status) ? step.expected_status : [step.expected_status];
        assert.ok(!statuses.includes(500), `${c.key}: an internal error must fail`);
        if (step.method === 'GET' && !/\/auth\/oauth/.test(step.url)) {
          // A list behind an optional integration may answer with its documented "not configured"
          // refusal instead — but only that refusal: the status must be held to an exact error
          // code and message, so an unrelated outage on the same route still fails the case.
          for (const status of statuses.filter((s: number) => s >= 500)) {
            const contract: Step[] = step.expect_by_status?.[String(status)]?.expect_json || [];
            assert.ok(
              contract.some(e => e.path === 'error.code' && typeof e.equals === 'string') && contract.some(e => e.path === 'error.message' && (e.equals || e.contains)),
              `${c.key}: a server failure must fail unless it is pinned to the documented refusal (code and message)`
            );
          }
        }
      }
    }
  });

  it('is built from the route table of a deployed build, and calls administrator-only lists as the administrator', () => {
    assert.ok(SANDBENCH_API_COVERAGE_CASES.length > 400, 'the deployed route table is checked in (sandbench-route-baseline.json)');
    const users = SANDBENCH_API_COVERAGE_CASES.find(c => c.key === 'SB-API-GET-ADMIN-USERS')!;
    const steps = users.steps as Step[];
    assert.equal(steps[0]?.body?.username, '{{admin_username}}', 'user administration is refused to an operator');
    assert.equal(steps[1]?.headers?.authorization, 'Bearer {{adminToken}}');
    const rules = SANDBENCH_API_COVERAGE_CASES.find(c => c.key === 'SB-API-GET-RULES')!;
    assert.equal((rules.steps as Step[])[0]?.body?.username, '{{username}}', 'an ordinary list is read as an operator');
  });

  it('asserts the exact refusal of a list that cannot answer without a query', () => {
    const c = SANDBENCH_API_COVERAGE_CASES.find(c => c.key === 'SB-API-GET-ANALYTICS-SUITE-COMPARE')!;
    const step = (c.steps as Step[]).at(-1)!;
    assert.equal(step.expected_status, 400);
    assert.deepEqual(step.expect_json, [
      { path: 'error.code', equals: 'validation_failed' },
      { path: 'error.message', equals: 'leftSuiteId and rightSuiteId are required' },
    ]);
  });

  it('validates deliberately public incomplete writes without treating them as sign-in boundaries', () => {
    for (const key of ['SB-API-POST-SESSION-PASSWORD-RESET', 'SB-API-POST-INBOUND-EVENTS']) {
      const c = SANDBENCH_API_COVERAGE_CASES.find(c => c.key === key)!;
      assert.ok(c, key);
      assert.ok(c.tags.includes('validation-boundary'), key);
      assert.ok(!c.tags.includes('auth-boundary'), key);
      const steps = c.steps as Step[];
      assert.equal(steps.length, 1, key);
      const step = steps[0]!;
      assert.equal(step.expected_status, 422, key);
      assert.deepEqual(step.body, {}, key);
      assert.ok(step.expect_json.some((check: Step) => check.path === 'error.code' && check.equals === 'validation_failed'), key);
    }
    const inboundRead = SANDBENCH_API_COVERAGE_CASES.find(c => c.key === 'SB-API-GET-INBOUND-EVENTS')!;
    assert.ok((inboundRead.steps as Step[]).some(step => step.headers?.authorization), 'the inbound history must remain protected');
  });

  it('requires page identity and visible content for signed-in responsive checks', () => {
    const cases = SANDBENCH_ALL_CASES.filter(c => c.tags.includes('cat:responsive') && c.tags.includes('signed-in'));
    assert.ok(cases.length > 3000, 'the complete signed-in browser and viewport matrix must be checked');
    for (const c of cases) {
      const steps = c.steps as Step[];
      assert.ok(steps.some(step => step.action === 'assert_title' && step.expected), `${c.key}: an index fallback could pass`);
      assert.ok(steps.some(step => step.action === 'wait_for' && step.selector?.includes(':visible')), `${c.key}: no visible content readiness check`);
      assert.ok(steps.some(step => step.action === 'assert_selector_text' && step.expected), `${c.key}: an empty shell could pass`);
      assert.ok(!steps.some(step => step.action === 'wait'), `${c.key}: uses a fixed rendering delay`);
    }
  });

  it('checks the actual event code instead of trusting an ignored filter or an old unrelated event', () => {
    for (const c of SANDBENCH_EVENT_RT_CASES.filter(c => c.suiteKey === 'sb-event-emission')) {
      const verification = (c.steps as Step[]).find(step => step.url === '{{api}}/api/v1/events?limit=500');
      assert.ok(verification, `${c.key}: missing event verification`);
      const match = verification.expect_json?.find((entry: Step) => entry.some)?.some;
      assert.ok(match?.eventCode, `${c.key}: no exact event code`);
      assert.equal(match['actor.userId'], '{{event_actor_id}}', `${c.key}: does not verify its own actor`);
      assert.deepEqual(match.occurredAt, { at_or_after: '{{ts}}' }, `${c.key}: an older event could satisfy the check`);
    }
  });
});
