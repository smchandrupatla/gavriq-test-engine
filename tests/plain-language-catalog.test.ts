/**
 * The Test cases screen representation (adopted from Sand Bench) and the
 * standing rule that every case reads in plain language.
 *
 * Every catalog case must carry an objective a person with no technical
 * background can follow, every step must narrate to "what is done / what
 * should happen", and the screen fields (owner, component, environment,
 * estimated duration, visibility, automation link, test data, attachments,
 * triage notes) must be filled with valid values for every case.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SANDBENCH_CASES, SANDBENCH_SUITES } from '../apps/api/src/catalog/sandbench-cases.ts';
import { ENGINE_CASES, ENGINE_SUITES } from '../apps/api/src/catalog/engine-cases.ts';
import { ESTIMATED_DURATIONS, VISIBILITIES, TRIAGE_STATUSES, PRIORITY_LABEL, type CaseDef, type SuiteDef } from '../apps/api/src/catalog/types.ts';
import { findJargon, narrateStep, screenFields, plainStatus, describePath, type AppContext } from '../apps/api/src/catalog/plain-language.ts';

const SB_CTX: AppContext = { appKey: 'sand-bench', defaultEnvironment: 'sand-bench-local', team: 'Sand Bench team' };
const TE_CTX: AppContext = { appKey: 'gavriq-test-engine', defaultEnvironment: 'engine-local', fixtureEnvironment: 'engine-staging', team: 'Test Engine team' };
const APPS: Array<[string, CaseDef[], SuiteDef[], AppContext]> = [
  ['sand-bench', SANDBENCH_CASES, SANDBENCH_SUITES, SB_CTX],
  ['gavriq-test-engine', ENGINE_CASES, ENGINE_SUITES, TE_CTX],
];
const suiteOf = (suites: SuiteDef[], c: CaseDef) => suites.find((s) => s.key === c.suiteKey);

describe('plain-language test case representation', () => {
  it('gives every case an objective written for a layman', () => {
    const problems: string[] = [];
    for (const [, cases] of APPS) {
      for (const c of cases) {
        const o = (c.objective || '').trim();
        if (!o) { problems.push(`${c.key}: no objective`); continue; }
        if (o.length < 25) problems.push(`${c.key}: objective too short to explain anything ("${o}")`);
        if (o.length > 520) problems.push(`${c.key}: objective is an essay (${o.length} chars)`);
        if (!/^[A-Z"“]/.test(o)) problems.push(`${c.key}: objective should start with a capital letter`);
        if (!/[.!?…)]$/.test(o)) problems.push(`${c.key}: objective should end as a sentence`);
        const jargon = findJargon(o);
        if (jargon) problems.push(`${c.key}: objective contains ${jargon}: "${o.slice(0, 90)}"`);
      }
    }
    assert.deepEqual(problems, []);
  });

  it('narrates every executable step as what is done / what should happen', () => {
    const problems: string[] = [];
    for (const [, cases, suites, ctx] of APPS) {
      for (const c of cases) {
        const sf = screenFields(c, suiteOf(suites, c), ctx);
        if (!sf.steps.length) problems.push(`${c.key}: no steps to show`);
        sf.steps.forEach((s, i) => {
          if (!s.text || s.text.length < 8) problems.push(`${c.key} step ${i + 1}: no wording`);
          if (!s.expected || s.expected.length < 5) problems.push(`${c.key} step ${i + 1}: no expected result`);
          if (/\{\{\s*(api|web|testhub|dbviewer|engine)\s*\}\}/.test(s.text) && !/\(.*\{\{/.test(s.text)) problems.push(`${c.key} step ${i + 1}: raw surface placeholder in wording`);
          if (/expect_json|expected_status|body_raw/.test(`${s.text} ${s.expected}`)) problems.push(`${c.key} step ${i + 1}: runner field name in wording`);
        });
      }
    }
    assert.deepEqual(problems.slice(0, 40), []);
  });

  it('fills every Test cases screen field with a valid value', () => {
    const problems: string[] = [];
    for (const [app, cases, suites, ctx] of APPS) {
      for (const c of cases) {
        const sf = screenFields(c, suiteOf(suites, c), ctx);
        if (!sf.owner) problems.push(`${c.key}: no owner`);
        if (!sf.component) problems.push(`${c.key}: no component`);
        if (!sf.environment) problems.push(`${c.key}: no environment`);
        if (!ESTIMATED_DURATIONS.includes(sf.estimated_duration)) problems.push(`${c.key}: bad duration ${sf.estimated_duration}`);
        if (!VISIBILITIES.includes(sf.visibility)) problems.push(`${c.key}: bad visibility ${sf.visibility}`);
        if (!sf.automation_link.includes(c.key)) problems.push(`${c.key}: automation link does not name the case`);
        if (!sf.test_data) problems.push(`${c.key}: no test data`);
        if (!sf.attachments.some((a) => a.url.includes('TEST-CASE-CATALOG'))) problems.push(`${c.key}: no catalog attachment`);
        if (!sf.flakiness_notes || !sf.known_workarounds || !sf.common_failure_causes) problems.push(`${c.key}: triage notes incomplete`);
        if (!TRIAGE_STATUSES.includes(sf.triage_status as any)) problems.push(`${c.key}: bad triage status ${sf.triage_status}`);
        if (!PRIORITY_LABEL[c.priority]) problems.push(`${c.key}: priority ${c.priority} has no label`);
        if (app === 'gavriq-test-engine' && c.key.startsWith('SB-')) problems.push(`${c.key}: Sand Bench key in the engine catalogue`);
      }
    }
    assert.deepEqual(problems.slice(0, 40), []);
  });

  it('keeps the use-case flow cases attached to their use-case document', () => {
    for (const c of SANDBENCH_CASES.filter((x) => x.key.startsWith('SB-UC-') && /-(MAIN|ALT-\d|EXC-\d)$/.test(x.key))) {
      const sf = screenFields(c, suiteOf(SANDBENCH_SUITES, c), SB_CTX);
      assert.ok(sf.attachments.some((a) => /docs\/use-cases\/UC-[\w]+\.md$/.test(a.url)), `${c.key}: no use-case document attachment`);
      assert.ok(sf.component && !/^(API|Web console)$/.test(sf.component), `${c.key}: component should be the use case's screen, got ${sf.component}`);
    }
  });
});

describe('plain-language narrator', () => {
  it('turns a request step into words a reader can follow', () => {
    const s = narrateStep({ action: 'request', method: 'GET', url: '{{api}}/health', expected_status: 200, expect_json: [{ path: 'status', equals: 'ok' }, { path: 'role', equals: 'api' }], description: 'API /health' });
    assert.match(s.text, /^Ask the application's API for its health check/);
    assert.match(s.expected, /answers OK \(200\)/);
    assert.match(s.expected, /"status" is "ok"/);
    assert.equal(s.testData, undefined);
  });

  it('words a sign-in, a refusal and a page open', () => {
    const login = narrateStep({ action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login', body: { username: '{{username}}', password: '{{password}}' }, expected_status: 200, save: { token: 'token' } });
    assert.match(login.text, /^Sign in to the API as the demo operator/);
    assert.match(login.testData || '', /demo operator username/);
    const refused = narrateStep({ action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types', expected_status: 401 });
    assert.match(refused.expected, /refuses — sign-in required \(401\)/);
    const page = narrateStep({ action: 'navigate', value: '{{web}}/test-cases.html' });
    assert.match(page.text, /^Open the Test cases screen in the browser/);
    const click = narrateStep({ action: 'click', selector: '#screen-action' });
    assert.match(click.text, /^Click the main action button/);
  });

  it('lets an authored wording win over the derived one', () => {
    const s = narrateStep({ action: 'request', method: 'GET', url: '{{api}}/health', expected_status: 200, text: 'Ask whether the service is alive', expected_text: 'It says it is alive.' });
    assert.equal(s.text, 'Ask whether the service is alive.');
    assert.equal(s.expected, 'It says it is alive.');
  });

  it('describes routes, statuses and jargon consistently', () => {
    assert.equal(describePath('/api/v1/channel-targets'), 'the list of delivery channels');
    assert.equal(describePath('/api/v1/catalog/schemas/drafts/{{draft_id}}/rules'), 'the rules of the selected schema draft');
    assert.equal(describePath('/api/v1/widgets/42'), 'the selected widget');
    assert.equal(plainStatus(404), 'reports there is nothing there (404)');
    assert.equal(findJargon('GET {{api}}/health must return 200'), 'a {{placeholder}}');
    assert.equal(findJargon('Confirm the health check answers OK and names the deployment.'), null);
  });
});
