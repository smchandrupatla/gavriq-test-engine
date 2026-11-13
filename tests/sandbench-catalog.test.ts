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
    // What ties the event to THIS case, per event: the person who acted, and the record or
    // message the case itself just created. A value written as {{name}} must be one an earlier
    // step of the same case captured. Events nobody is signed in for carry no actor.
    const tiedTo: Record<string, string[]> = {
      'biz.session.login.success': ['actor.userId'],
      'biz.session.login.failure': ['outcome'],
      'biz.console.bootstrap': ['actor.userId'],
      'biz.schema.uploaded': ['actor.userId', 'entity.id', 'entity.name'],
      'biz.file.generated': ['actor.userId'],
      'biz.run.started': ['actor.userId', 'entity.name', 'telemetry.channel'],
      'biz.run.completed': ['actor.userId', 'entity.id'],
      'biz.run.rejected': ['actor.userId', 'entity.name', 'error.code'],
      'biz.dataset.created': ['actor.userId', 'entity.id'],
      'biz.case.created': ['actor.userId', 'entity.id'],
      'biz.suite.created': ['actor.userId', 'entity.id'],
      'biz.rule.created': ['actor.userId', 'entity.id', 'entity.name'],
      'biz.eventing.configured': ['actor.userId'],
      'tec.inbound.accepted': [],
      'tec.delivery.succeeded': ['entity.name', 'payload.uetr'],
      'tec.delivery.simulated': ['entity.name', 'payload.uetr'],
    };
    const cases = SANDBENCH_EVENT_RT_CASES.filter(c => c.suiteKey === 'sb-event-emission');
    const codeOf = (key: string) => key.replace(/^SBE-EV-/, '').toLowerCase().replace(/-/g, '.');
    assert.deepEqual(cases.map(c => codeOf(c.key)).sort(), Object.keys(tiedTo).sort(), 'every event case is pinned here, and nothing else');

    for (const c of cases) {
      const code = codeOf(c.key);
      const steps = c.steps as Step[];
      const verifyIndex = steps.findIndex(step => /\/api\/v1\/events\?/.test(String(step.url)) && step.expect_json?.some((entry: Step) => entry.some));
      assert.ok(verifyIndex > 0, `${c.key}: missing event verification`);
      const verification = steps[verifyIndex]!;

      // The event list ignores `code`: it filters on class, screenId, assetId and limit only.
      const query = new URL(String(verification.url).replace('{{api}}', 'http://application')).searchParams;
      assert.equal(query.has('code'), false, `${c.key}: relies on a filter the application ignores`);
      assert.equal(query.get('class'), code.startsWith('tec.') ? 'technical' : 'business', `${c.key}: does not ask for the event's own class`);
      assert.equal(query.get('limit'), '500', `${c.key}: does not read the widest window`);
      for (const name of query.keys()) assert.ok(['class', 'screenId', 'assetId', 'limit'].includes(name), `${c.key}: unknown filter ${name}`);

      // One entry must carry the exact code, the time bound and everything that ties it to this case.
      assert.equal(verification.expect_json.filter((entry: Step) => entry.some).length, 1, `${c.key}: the event must be matched in one entry`);
      const match = verification.expect_json.find((entry: Step) => entry.some).some;
      assert.equal(match.eventCode, code, `${c.key}: no exact event code`);
      const captured = new Set(steps.slice(0, verifyIndex).flatMap(step => Object.keys(step.save || {})));
      for (const path of tiedTo[code]!) {
        assert.ok(match[path] !== undefined && match[path] !== '', `${c.key}: does not match ${path}`);
        for (const [, name] of String(match[path]).matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
          if (name === 'rand' || name === 'ts') continue;
          assert.ok(captured.has(name!), `${c.key}: ${path} uses {{${name}}}, which no earlier step captured`);
        }
      }
      if (tiedTo[code]!.includes('actor.userId')) {
        assert.equal(match['actor.userId'], '{{event_actor_id}}', `${c.key}: does not verify its own actor`);
      }
      for (const path of ['entity.id', 'payload.uetr']) {
        if (tiedTo[code]!.includes(path)) assert.match(String(match[path]), /^\{\{\w+\}\}$/, `${c.key}: ${path} is not the record this case just created`);
      }

      // Only events recorded after the action count, by the application's own clock.
      assert.deepEqual(match.occurredAt, { at_or_after: '{{event_since}}' }, `${c.key}: an older event could satisfy the check`);
      const clockIndex = steps.findIndex(step => step.url === '{{api}}/api/v1/ux/clock' && step.save?.event_since === 'epochMs');
      assert.ok(clockIndex >= 0 && clockIndex < verifyIndex - 1, `${c.key}: the application clock is not read before the action`);

      // The action is real: every step has exactly one acceptable answer and none is tolerated.
      for (const step of steps) {
        assert.equal(typeof (step.expected_status ?? 200), 'number', `${c.key}: a step accepts more than one answer`);
        assert.ok(!step.allow_failure, `${c.key}: a step may fail without failing the case`);
      }

      // What the action created is removed again, where the application can remove it.
      const createsRecord = tiedTo[code]!.includes('entity.id') || code.startsWith('tec.delivery.');
      if (createsRecord) assert.ok((c.cleanupSteps || []).length > 0, `${c.key}: creates a record but never removes it`);
    }
  });
});
