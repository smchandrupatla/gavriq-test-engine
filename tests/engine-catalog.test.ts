import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ENGINE_CASES, ENGINE_SUITES, ENGINE_TYPES } from '../apps/api/src/catalog/engine-cases.ts';
import { SANDBENCH_CASES } from '../apps/api/src/catalog/sandbench-cases.ts';
import { ARTEFACT, FIXTURES, ISOLATED } from '../apps/api/src/catalog/engine-case-kit.ts';
import { TYPE_TO_ENUM } from '../apps/api/src/catalog/types.ts';

type Step = Record<string, any>;
const stepsOf = (c: (typeof ENGINE_CASES)[number]) => (c.steps || []) as Step[];
const suiteOf = new Map(ENGINE_SUITES.map((s) => [s.key, s]));
const typeKeys = ENGINE_TYPES.map((t) => t.key.toLowerCase());

describe('Test Engine self-test catalogue', () => {
  it('keeps catalog cases independent of suite order and other cases', () => {
    for (const testCase of [...ENGINE_CASES, ...SANDBENCH_CASES]) {
      const contract = `${testCase.description}\n${testCase.preconditions}`;
      assert.doesNotMatch(
        contract,
        /suite order|ran first|must run before|depends on (?:another|a preceding|the previous) case|runs after .*cases? in this suite/i,
        `${testCase.key}: declares a cross-case or suite-order dependency`
      );
    }
  });

  it('cancels every execution a case can queue', () => {
    const queueUrl = /\/api\/v1\/(?:executions(?:\?|$)|runs(?:\?|$)|schedules\/[^/]+\/run(?:\?|$)|schedules\/trigger(?:\?|$))/;
    for (const testCase of ENGINE_CASES) {
      const steps = stepsOf(testCase);
      const executionIds = new Set<string>();
      for (const step of steps) {
        if (step.action !== 'request' || String(step.method || 'GET').toUpperCase() !== 'POST' || !queueUrl.test(String(step.url || ''))) continue;
        for (const [name, path] of Object.entries(step.save || {})) {
          if (name !== 'result_id' && typeof path === 'string' && /(?:^|\.)id$/.test(path)) executionIds.add(name);
        }
      }
      for (const id of executionIds) {
        assert.ok(
          (testCase.cleanupSteps || []).some((step: Step) => step.url === `{{engine}}/api/v1/executions/{{${id}}}/cancel`),
          `${testCase.key}: execution ${id} has no cleanup step`,
        );
      }
    }
  });

  it('gives every test type a suite and at least one case', () => {
    for (const type of ENGINE_TYPES) {
      const suites = ENGINE_SUITES.filter((s) => s.typeKey === type.key);
      assert.ok(suites.length, `${type.key}: no suite`);
      const cases = ENGINE_CASES.filter((c) => suites.some((s) => s.key === c.suiteKey));
      assert.ok(cases.length, `${type.key}: no cases`);
    }
  });

  it('keeps case keys and names unique, as the repository requires', () => {
    assert.equal(new Set(ENGINE_CASES.map((c) => c.key)).size, ENGINE_CASES.length, 'duplicate case key');
    assert.equal(new Set(ENGINE_CASES.map((c) => c.name.toLowerCase())).size, ENGINE_CASES.length, 'duplicate case name');
  });

  it('tags every case so the console files it under its own test type', () => {
    // The console takes the first test type (in ENGINE_TYPES order) found among a case's tags.
    for (const c of ENGINE_CASES) {
      const suite = suiteOf.get(c.suiteKey);
      assert.ok(suite, `${c.key}: unknown suite ${c.suiteKey}`);
      const tags = c.tags.map((t) => t.toLowerCase());
      assert.equal(typeKeys.find((k) => tags.includes(k)), suite.typeKey.toLowerCase(), `${c.key}: tags ${c.tags.join(', ')}`);
      assert.equal(c.testType, TYPE_TO_ENUM[suite.typeKey], `${c.key}: test type does not match its suite`);
    }
  });

  it('makes every case executable by its runner', () => {
    for (const c of ENGINE_CASES) {
      if (c.method === 'performance') {
        const rules = c.validationRules as Step;
        assert.match(String(rules?.url), /^\{\{engine\}\}\//, `${c.key}: performance target`);
        assert.ok(rules.sla, `${c.key}: no SLA`);
        continue;
      }
      assert.ok(stepsOf(c).length, `${c.key}: no steps`);
      for (const step of stepsOf(c)) {
        if (c.method === 'http') {
          assert.equal(step.action, 'request', `${c.key}: http step action`);
          assert.match(String(step.url), /^\{\{engine\}\}/, `${c.key}: a step leaves the target engine`);
        } else if (step.action === 'navigate') {
          assert.match(String(step.value), /^\{\{engine\}\}\//, `${c.key}: a page outside the target engine`);
        }
      }
    }
  });

  it('sends a body with every write, since the engine refuses an empty JSON body', () => {
    for (const c of ENGINE_CASES.filter((x) => x.method === 'http')) {
      for (const step of stepsOf(c)) {
        if (step.method === 'GET') continue;
        const intentionallyEmpty = step.expect_json?.some((e: Step) => e.equals === 'FST_ERR_CTP_EMPTY_JSON_BODY');
        assert.ok(step.body !== undefined || step.body_raw !== undefined || intentionallyEmpty, `${c.key}: ${step.method} ${step.url} has no body`);
      }
    }
  });

  it('never templates a {{var}} inside body_raw, which the runner sends verbatim', () => {
    // Caught 2026-09-30 in TE-DR-SETTINGS-DURABLE: body_raw is not substituted, so
    // "{{days}}" went out as the literal four characters, not the captured number.
    for (const c of ENGINE_CASES) {
      for (const step of stepsOf(c)) {
        if (typeof step.body_raw === 'string') assert.ok(!step.body_raw.includes('{{'), `${c.key}: body_raw "${step.body_raw}" contains an untemplated {{var}}`);
      }
    }
  });

  it('opens every case that writes or claims with the precondition steps of its group', () => {
    const opensWith = (c: (typeof ENGINE_CASES)[number], prelude: Step[]) =>
      prelude.every((p, i) => stepsOf(c)[i]?.url === p.url && stepsOf(c)[i]?.precondition === true);
    for (const c of ENGINE_CASES.filter((x) => x.method === 'http')) {
      const urls = stepsOf(c).map((s) => `${s.method} ${s.url}`);
      // Claiming hands out the oldest queued execution of any application.
      if (urls.some((u) => u.endsWith('/api/v1/executions/claim'))) {
        assert.ok(opensWith(c, ISOLATED), `${c.key}: claims without the isolation preconditions`);
      }
      // /schedules/trigger only fires what is bound to the event it names; the cases post events nothing is bound to.
      const writesRepository = stepsOf(c).some(
        (s) => s.method !== 'GET' && /\/api\/v1\/(test-cases|suites|schedules(?!\/trigger)|build-results|environments\/te-selftest-target)(\/|$)/.test(String(s.url)) &&
          ![400, 404].includes(s.expected_status) && !Array.isArray(s.expected_status)
      );
      if (writesRepository) assert.ok(opensWith(c, FIXTURES), `${c.key}: writes without the sandbox preconditions`);
    }
  });

  it('never calls the routes that would disturb a shared engine', () => {
    const forbidden = ['/api/v1/ops/seed-sandbench', '/api/v1/executions/cancel-all', '/api/v1/evidence/prune', '/api/v1/sit-runs'];
    for (const c of ENGINE_CASES) {
      for (const step of stepsOf(c)) {
        for (const route of forbidden) assert.ok(!String(step.url || '').includes(route), `${c.key}: calls ${route}`);
      }
    }
  });

  it('stores as JSONB: no case definition contains a literal null byte', () => {
    // Postgres text/JSONB rejects \u0000 outright ("22P05 \u0000 cannot be converted to text"),
    // which fails the whole seed insert — caught 2026-09-30 in TE-CHAOS-ERROR-FLOOD's body_raw.
    for (const c of ENGINE_CASES) {
      assert.ok(!JSON.stringify(c.steps || []).includes('\\u0000'), `${c.key}: a step's JSON contains a literal null byte`);
    }
  });

  it('describes the artefact the worker-protocol cases upload', () => {
    const bytes = Buffer.from(ARTEFACT.base64, 'base64');
    assert.equal(bytes.length, ARTEFACT.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ARTEFACT.sha256);
    assert.ok(bytes.toString('utf8').includes(ARTEFACT.text));
  });
});
