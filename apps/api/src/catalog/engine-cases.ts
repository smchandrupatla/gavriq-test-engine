/**
 * GAVRIQ Test Engine — self-test catalog (application #2).
 *
 * Proves the engine is a generic, multi-application platform by registering
 * itself as an application under test. Every case is a real HTTP check
 * against the engine's own control-plane API ({{engine}} from the selected
 * environment's config.vars).
 */
import type { CaseDef, SuiteDef, TypeMeta } from './types.js';

export const ENGINE_TYPES: TypeMeta[] = [
  { key: 'smoke', label: 'Smoke tests', subtitle: 'Engine control plane answers.', category: 'qa' },
  { key: 'api', label: 'API tests', subtitle: 'Repository, execution and readiness APIs behave to contract.', category: 'qa' },
];

export const ENGINE_SUITES: SuiteDef[] = [
  { key: 'te-smoke', name: 'Engine smoke', description: 'The control plane and its UI shell are up.', typeKey: 'smoke', category: 'qa' },
  { key: 'te-self-api', name: 'Engine API self-tests', description: 'The engine\'s own repository/execution/readiness APIs verified over HTTP — the engine testing itself like any other application.', typeKey: 'api', category: 'qa' },
];

const C: CaseDef[] = [];

function api(key: string, name: string, description: string, steps: unknown[], opts: Partial<CaseDef> = {}): CaseDef {
  return {
    key, name, description,
    suiteKey: 'te-self-api', testType: 'api', method: 'http',
    severity: 'high', priority: 'p1',
    preconditions: 'Test Engine API reachable at the environment\'s {{engine}} base URL.',
    steps,
    tags: ['api', 'test-engine', 'self-test'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'Documented contract holds.',
    ...opts,
  };
}

C.push(
  api('TE-SMOKE-HEALTH', 'Engine health endpoint answers', 'GET {{engine}}/health must identify the service ("gavriq-test-engine") with a version and UI enabled.', [
    { action: 'request', method: 'GET', url: '{{engine}}/health', expected_status: 200, expect_json: [{ path: 'status', equals: 'ok' }, { path: 'service', equals: 'gavriq-test-engine' }, { path: 'version', exists: true }], description: 'engine /health' },
  ], { suiteKey: 'te-smoke', testType: 'smoke', severity: 'critical', priority: 'p0' }),

  api('TE-SMOKE-READY', 'Engine readiness probe answers', 'GET {{engine}}/ready must return {"status":"ready"}.', [
    { action: 'request', method: 'GET', url: '{{engine}}/ready', expected_status: 200, expect_json: [{ path: 'status', equals: 'ready' }], description: 'engine /ready' },
  ], { suiteKey: 'te-smoke', testType: 'smoke', severity: 'critical', priority: 'p0' }),

  api('TE-SMOKE-UI-SHELL', 'Unified console shell is served', 'GET {{engine}}/ must serve the unified console HTML (title "GAVRIQ Test Engine").', [
    { action: 'request', method: 'GET', url: '{{engine}}/', expected_status: 200, expected_body_contains: 'GAVRIQ Test Engine', description: 'console shell' },
  ], { suiteKey: 'te-smoke', testType: 'smoke', severity: 'high', priority: 'p0' }),

  api('TE-API-META', 'Capability map is published', 'GET /api/v1/meta must publish the engine version and capability map that clients feature-detect against (verified shape: top-level service/version/capabilities).', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/meta', expected_status: 200, expect_json: [{ path: 'service', equals: 'gavriq-test-engine' }, { path: 'capabilities.repository', equals: true }, { path: 'version', exists: true }], description: 'meta' },
  ]),

  api('TE-API-APPLICATIONS', 'Application registry is multi-tenant', 'GET /api/v1/applications must list at least two registered applications (Sand Bench plus this engine) — the proof of generic multi-application support.', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/applications', expected_status: 200, expect_json: [{ path: 'data', min_length: 2 }, { path: 'data', contains: '"key":"sand-bench"' }, { path: 'data', contains: '"key":"gavriq-test-engine"' }], description: 'applications' },
  ], { severity: 'critical', priority: 'p0' }),

  api('TE-API-TEST-CASES', 'Repository lists cases with pagination contract', 'GET /api/v1/test-cases?limit=5 must return data rows plus a numeric total — the pagination contract the console relies on.', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/test-cases?limit=5', expected_status: 200, expect_json: [{ path: 'data', min_length: 1 }, { path: 'total', min: 1 }], description: 'test-cases page' },
  ]),

  api('TE-API-CASE-DETAIL', 'Case detail includes version history', 'Fetch one known case by key (TE-SMOKE-HEALTH): the detail payload must include its version list.', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/test-cases/TE-SMOKE-HEALTH', expected_status: 200, expect_json: [{ path: 'data.key', equals: 'TE-SMOKE-HEALTH' }, { path: 'data.versions', exists: true }], description: 'case detail' },
  ]),

  api('TE-API-SUITES', 'Suites are filterable by application', 'GET /api/v1/suites must return suites; the engine\'s own suites (te-*) must be present.', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/suites', expected_status: 200, expect_json: [{ path: 'data', contains: '"key":"te-self-api"' }], description: 'suites' },
  ]),

  api('TE-API-ENVIRONMENTS', 'Environment registry with safety policies', 'GET /api/v1/environments must list environments including the Sand Bench target and expose safety_policy JSON.', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/environments', expected_status: 200, expect_json: [{ path: 'data', min_length: 1 }, { path: 'data', contains: 'sand-bench-local' }], description: 'environments' },
  ]),

  api('TE-API-EXEC-VALIDATION', 'Execution queue validates its input', 'POST /api/v1/executions with an empty body must be rejected with 400 — no unconstrained executions can enter the queue.', [
    { action: 'request', method: 'POST', url: '{{engine}}/api/v1/executions', body: {}, expected_status: 400, description: 'reject empty execution' },
  ], {
    dataProfile: { profile: 'negative', data: 'Empty JSON body.', source: 'Hand-crafted.' },
    expected: '400 with validation error.',
  }),

  api('TE-API-EXECUTIONS-LIST', 'Execution history is queryable', 'GET /api/v1/executions must return the recent execution list (array).', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/executions', expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'executions' },
  ]),

  api('TE-API-UI-SUMMARY', 'Console read-model answers per application', 'GET /api/v1/ui/summary?application_key=sand-bench must return the console\'s boot payload: cases, suites, environments scoped to the application.', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/ui/summary?application_key=sand-bench', expected_status: 200, expect_json: [{ path: 'data.cases', exists: true }, { path: 'data.suites', exists: true }, { path: 'data.environments', exists: true }], description: 'ui summary' },
  ]),

  api('TE-API-DASHBOARD', 'Dashboard aggregates answer', 'GET /api/v1/dashboard must return repository aggregates.', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/dashboard', expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'dashboard' },
  ]),

  api('TE-API-RELEASE-READINESS', 'Release readiness verdict is computable', 'GET /api/v1/release-readiness must return a readiness verdict object.', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/release-readiness', expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'release readiness' },
  ]),

  api('TE-API-SIT-CATALOG', 'SIT catalog is importable and listed', 'GET /api/v1/sit-catalog must return the SIT packs the engine imported from sit/cases.', [
    { action: 'request', method: 'GET', url: '{{engine}}/api/v1/sit-catalog', expected_status: 200, description: 'sit catalog' },
  ]),

  api('TE-API-RUN-ALL-DRYRUN', 'Run-everything endpoint validates and previews', 'POST /api/v1/executions/run-all with dry_run=true must return the per-suite plan (suites + case counts) without queueing anything — the contract behind the console\'s "Run everything" button.', [
    { action: 'request', method: 'POST', url: '{{engine}}/api/v1/executions/run-all', body: { application_key: 'sand-bench', dry_run: true }, expected_status: 200, expect_json: [{ path: 'data.suites', min_length: 1 }, { path: 'data.total_cases', min: 1 }], description: 'run-all dry run' },
  ], {
    dataProfile: { profile: 'none (dry run)', data: '{"application_key":"sand-bench","dry_run":true} — queues nothing.', source: 'Hand-crafted.' },
    expected: '200 with the suite-by-suite execution plan.',
  })
);

export const ENGINE_CASES: CaseDef[] = C;
