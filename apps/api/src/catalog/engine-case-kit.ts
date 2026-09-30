/**
 * Building blocks for the Test Engine self-test catalogue (engine-*-cases.ts).
 *
 * Every case targets one engine deployment through {{engine}}, the base URL in
 * the selected environment's config.vars — the staging engine on a pinned
 * commit, or the development engine the run itself is executing on.
 *
 * Cases fall into three groups by what they need from the target:
 *   read-only   nothing; they run anywhere.
 *   sandbox     the self-test fixtures (application te-selftest-fixtures and
 *               its cases/environment, created by deploy/engine-staging/
 *               deploy.mjs seed). Everything they write stays inside that
 *               application.
 *   isolated    the fixtures plus a queue nothing else drains, because the
 *               case acts as the worker: /executions/claim hands out the
 *               oldest queued execution of ANY application, so on an engine
 *               with a live worker it would take somebody else's run.
 * A sandbox or isolated case opens with precondition steps; on a target that
 * does not meet them it reports skipped instead of failing.
 */
import type { CaseDef, DataProfile } from './types.js';

export type Step = Record<string, unknown>;

export const FIXTURE_APP = 'te-selftest-fixtures';
export const FIXTURE_ENV = 'te-selftest-target';
/** Fixture cases, one per planner outcome (see FIXTURE_CASES in deploy/engine-staging/deploy.mjs). */
export const FIX = { pass: 'TE-FIX-PASS', second: 'TE-FIX-SECOND', manual: 'TE-FIX-MANUAL', chaos: 'TE-FIX-CHAOS', load: 'TE-FIX-LOAD', archived: 'TE-FIX-ARCHIVED' };
/** The id the isolated cases claim under. Never registered, so it never counts as a live worker. */
export const GHOST_WORKER = 'te-selftest-ghost';
/** Unique per run ({{ts}} and {{rand}} come from the http runner). */
export const UNIQ = '{{ts}}-{{rand}}';

export function req(method: string, path: string, opts: Step = {}): Step {
  return { action: 'request', method, url: `{{engine}}${path}`, ...opts };
}
export const GET = (path: string, opts?: Step) => req('GET', path, opts);
export const POST = (path: string, opts?: Step) => req('POST', path, opts);
export const PUT = (path: string, opts?: Step) => req('PUT', path, opts);
export const PATCH = (path: string, opts?: Step) => req('PATCH', path, opts);
export const DELETE = (path: string, opts?: Step) => req('DELETE', path, opts);

/** Resolves the sandbox ({{fix_app}}, {{fix_case}}, {{fix_env}}); skips the case on a target that was not prepared. */
export const FIXTURES: Step[] = [
  GET(`/api/v1/test-cases/${FIX.pass}`, {
    precondition: true, expected_status: 200,
    save: { fix_case: 'data.id', fix_app: 'data.application_id' },
    description: 'self-test fixtures are seeded on this target',
  }),
  GET(`/api/v1/environments/${FIXTURE_ENV}`, {
    precondition: true, expected_status: 200,
    save: { fix_env: 'data.id' },
    description: 'fixture environment is registered',
  }),
];

/** FIXTURES plus the guarantee that this case is the only thing draining the target's queue. */
export const ISOLATED: Step[] = [
  ...FIXTURES,
  POST('/api/v1/runs', {
    body: { application: FIXTURE_APP, environment: FIXTURE_ENV, dry_run: true },
    precondition: true, expected_status: 200,
    expect_json: [{ path: 'data.workers_online', equals: 0 }],
    description: 'no live worker on this target',
  }),
  GET('/api/v1/executions?status=queued', {
    precondition: true, expected_status: 200,
    expected_body_contains: '"data":[]',
    description: 'execution queue is empty',
  }),
];

/** Queue one execution of the passing fixture case and claim it: {{exec_id}} / {{exec_key}} are then "running" under GHOST_WORKER. */
export const QUEUE_AND_CLAIM: Step[] = [
  POST('/api/v1/executions', {
    body: { test_case_ids: ['{{fix_case}}'], environment_id: '{{fix_env}}', trigger_source: 'selftest', requested_by: 'engine-self-test' },
    expected_status: 202,
    expect_json: [{ path: 'data.status', equals: 'queued' }],
    save: { exec_id: 'data.id', exec_key: 'data.key' },
    description: 'queue a fixture execution',
  }),
  POST('/api/v1/executions/claim', {
    body: { worker_id: GHOST_WORKER },
    expected_status: 200,
    expect_json: [{ path: 'data.id', equals: '{{exec_id}}' }, { path: 'data.status', equals: 'running' }, { path: 'data.worker_id', equals: GHOST_WORKER }],
    description: 'claim it as the only worker',
  }),
];

/** A small JSON artefact, as the http runner would upload it: {"selftest":true,"note":"engine self-test artefact"}. */
export const ARTEFACT = {
  base64: 'eyJzZWxmdGVzdCI6dHJ1ZSwibm90ZSI6ImVuZ2luZSBzZWxmLXRlc3QgYXJ0ZWZhY3QifQ==',
  sha256: 'e12be848664c691fea4f514da8d32e5bc8f3fe48302337f6520f06a1e6c472b2',
  bytes: 52,
  text: 'engine self-test artefact',
};

/** Upload ARTEFACT for the claimed execution: {{ev_key}} is its storage key, {{ev_url}} where it is served. */
export const UPLOAD: Step = POST('/api/v1/evidence/upload', {
  body: { execution_id: '{{exec_id}}', case_key: FIX.pass, name: 'http-selftest.json', evidence_type: 'http_transcript', content_type: 'application/json', content_base64: ARTEFACT.base64, sha256: ARTEFACT.sha256 },
  expected_status: 201,
  expect_json: [{ path: 'data.sha256', equals: ARTEFACT.sha256 }, { path: 'data.size_bytes', equals: ARTEFACT.bytes }],
  save: { ev_key: 'data.storage_key', ev_url: 'data.url' },
  description: 'upload the artefact for this execution',
});

/** Report the fixture case with the uploaded artefact as its evidence; {{result_id}} is the stored result. */
export function result(status: 'passed' | 'failed', message: string, extra: Step = {}): Step {
  return POST('/api/v1/executions/{{exec_id}}/results', {
    body: {
      test_case_id: '{{fix_case}}', status, verdict: status === 'passed' ? 'pass' : 'fail', duration_ms: 12, message,
      evidence: [{ type: 'http_transcript', storage_key: '{{ev_key}}', content_type: 'application/json' }],
    },
    expected_status: 201,
    expect_json: [{ path: 'data.status', equals: status }, { path: 'data.metrics.evidence_gate.satisfied', equals: true }],
    save: { result_id: 'data.id' },
    description: `report the case ${status} with its evidence`,
    ...extra,
  });
}

/** Complete the execution claiming one status; under the enforced gate the engine derives the one it `becomes`. */
export const complete = (claimed: string, becomes: string): Step =>
  POST('/api/v1/executions/{{exec_id}}/complete', {
    body: { status: claimed }, expected_status: 200,
    expect_json: [{ path: 'data.status', equals: becomes }],
    description: `complete the execution (worker claims "${claimed}")`,
  });

/** Queue, claim, evidence, passing result, completion: one execution carried to a verdict. */
export const RUN_ONE_PASS: Step[] = [...QUEUE_AND_CLAIM, UPLOAD, result('passed', 'engine self-test: passing result'), complete('passed', 'passed')];

/** Cases cannot be deleted; a temporary one is archived so the planner and the console leave it alone. */
export const ARCHIVE = (ref: string, description = 'archive the temporary case'): Step =>
  PUT(`/api/v1/test-cases/${ref}`, { body: { lifecycle: 'archived', change_summary: 'self-test cleanup', updated_by: 'engine-self-test' }, expected_status: 200, allow_failure: true, description });

export const ISO = '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}';
export const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

export const NO_DATA: DataProfile = { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' };
export const SANDBOX_DATA = (data: string): DataProfile => ({
  profile: 'sandbox (self-test fixtures)',
  data,
  source: `Application ${FIXTURE_APP} on the target engine (deploy/engine-staging/deploy.mjs seed); keys are unique per run.`,
});
export const ISOLATED_DATA = SANDBOX_DATA('One queued execution of fixture case TE-FIX-PASS on the fixture environment; a 52-byte JSON artefact as its evidence.');

export const PRE = {
  readOnly: 'Target engine reachable at the environment\'s {{engine}} base URL.',
  sandbox: `Target engine reachable and prepared with the self-test fixtures (application ${FIXTURE_APP}); otherwise the case is skipped.`,
  isolated: `Target engine prepared with the self-test fixtures, with no live worker and an empty queue — the case acts as the worker. On any other target it is skipped.`,
  browser: 'Target engine reachable; worker has the browser engine the case names.',
};

type Overrides = Partial<CaseDef> & Pick<CaseDef, 'key' | 'name' | 'description'>;

/** One factory per suite: the suite fixes test type, method and the type tag the console groups by. */
export function suiteFactory(defaults: Pick<CaseDef, 'suiteKey' | 'testType'> & Partial<CaseDef>, typeTag: string) {
  return (c: Overrides): CaseDef => ({
    method: 'http',
    severity: 'high',
    priority: 'p1',
    preconditions: PRE.readOnly,
    dataProfile: NO_DATA,
    expected: 'Documented contract holds.',
    ...defaults,
    ...c,
    tags: [typeTag, 'test-engine', ...(c.tags || [])],
  });
}
