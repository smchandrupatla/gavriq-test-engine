/**
 * Test Engine self-tests — functional categories: smoke, api, integration,
 * use case, regression and data quality.
 *
 * Every request, status and field below was probed against the staging engine
 * (deploy/engine-staging, commit 8a26bbf) on 2026-09-30 before being encoded.
 * A few cases assert behaviour the engine does not have yet — an id or filter
 * that is not valid must be refused with a 4xx, the application detail route
 * must answer. They fail until the defect is fixed; that is their purpose.
 */
import type { CaseDef } from './types.js';
import {
  ARCHIVE, ARTEFACT, DELETE, FIX, FIXTURE_APP, FIXTURE_ENV, FIXTURES, GET, GHOST_WORKER, ISO, ISOLATED, ISOLATED_DATA, PATCH, POST, PRE, PUT,
  QUEUE_AND_CLAIM, RUN_ONE_PASS, SANDBOX_DATA, UNIQ, UPLOAD, UUID, complete, result, suiteFactory, type Step,
} from './engine-case-kit.js';

const smoke = suiteFactory({ suiteKey: 'te-smoke', testType: 'smoke', severity: 'critical', priority: 'p0' }, 'smoke');
const api = suiteFactory({ suiteKey: 'te-self-api', testType: 'api' }, 'api');
const integration = suiteFactory({ suiteKey: 'te-integration', testType: 'integration', preconditions: PRE.sandbox, timeoutSeconds: 30 }, 'integration');
const usecase = suiteFactory({ suiteKey: 'te-usecase', testType: 'acceptance', timeoutSeconds: 30 }, 'usecase');
const regression = suiteFactory({ suiteKey: 'te-regression', testType: 'regression' }, 'regression');
const dq = suiteFactory({ suiteKey: 'te-data-quality', testType: 'database' }, 'dataQuality');

const C: CaseDef[] = [];

/* ------------------------------------------------------------------------ */
/* smoke                                                                     */
/* ------------------------------------------------------------------------ */

C.push(
  smoke({
    key: 'TE-SMOKE-HEALTH', name: 'Engine health endpoint answers',
    description: 'GET {{engine}}/health must identify the service ("gavriq-test-engine") with a version and the console enabled.',
    steps: [GET('/health', { expect_json: [{ path: 'status', equals: 'ok' }, { path: 'service', equals: 'gavriq-test-engine' }, { path: 'version', exists: true }, { path: 'ui', equals: true }], description: 'engine /health' })],
    tags: ['health'], expected: '200 {"status":"ok","service":"gavriq-test-engine",…}.',
  }),
  smoke({
    key: 'TE-SMOKE-READY', name: 'Engine readiness probe answers',
    description: 'GET {{engine}}/ready must return {"status":"ready"} — the probe an orchestrator gates traffic on.',
    steps: [GET('/ready', { expect_json: [{ path: 'status', equals: 'ready' }], description: 'engine /ready' })],
    tags: ['health'], expected: '200 {"status":"ready"}.',
  }),
  smoke({
    key: 'TE-SMOKE-DATABASE', name: 'Control plane reads its database',
    description: '/ready is static, so this is the check that the API can actually query Postgres: the application registry must come back with at least one row.',
    steps: [GET('/api/v1/applications', { expect_json: [{ path: 'data', min_length: 1 }], description: 'application registry' })],
    tags: ['health', 'database'], expected: '200 with at least one application.',
  }),
  smoke({
    key: 'TE-SMOKE-UI-SHELL', name: 'Unified console shell is served',
    description: 'GET {{engine}}/ must serve the unified console HTML (title "GAVRIQ Test Engine") and reference its script bundle.',
    severity: 'high',
    steps: [GET('/', { expected_body_contains: '<title>GAVRIQ Test Engine</title>', expect_headers: [{ name: 'content-type', contains: 'text/html' }], description: 'console shell' })],
    tags: ['console'], expected: '200 text/html with the console title.',
  }),
  smoke({
    key: 'TE-SMOKE-CONSOLE-ASSETS', name: 'Console script bundles are served',
    description: 'The shell is useless without its scripts: /catalog/app.js and /catalog/charts.js must be served as JavaScript.',
    severity: 'high',
    steps: [
      GET('/catalog/app.js', { expect_headers: [{ name: 'content-type', contains: 'javascript' }], expected_body_contains: 'function renderOverview', description: 'app.js' }),
      GET('/catalog/charts.js', { expect_headers: [{ name: 'content-type', contains: 'javascript' }], description: 'charts.js' }),
    ],
    tags: ['console'], expected: 'Both bundles 200 as application/javascript.',
  }),
  smoke({
    key: 'TE-SMOKE-SIT-CONSOLE', name: 'Embedded SIT console answers behind the same port',
    description: 'The consolidated container proxies /sit/* to the SIT console process. GET {{engine}}/sit/health must answer from it.',
    severity: 'high',
    steps: [GET('/sit/health', { expect_json: [{ path: 'status', equals: 'ok' }, { path: 'service', equals: 'sit-console' }], description: 'sit console /health' })],
    tags: ['sit-console'], expected: '200 {"status":"ok","service":"sit-console"}.',
  }),
  smoke({
    key: 'TE-SMOKE-CATALOGUE-LOADED', name: 'Test repository is seeded',
    description: 'A deployed engine with an empty repository can run nothing. GET /api/v1/test-cases must report a non-zero total.',
    steps: [GET('/api/v1/test-cases?limit=1', { expect_json: [{ path: 'total', min: 1 }, { path: 'data', min_length: 1 }], description: 'repository total' })],
    tags: ['repository'], expected: 'total >= 1.',
  }),
  smoke({
    key: 'TE-SMOKE-CONSOLE-BOOT', name: 'Console boot payload loads for the engine application',
    description: 'The console starts from one call, /api/v1/ui/summary. For the engine\'s own application it must return the application, its cases and its environments.',
    severity: 'high',
    steps: [GET('/api/v1/ui/summary?application_key=gavriq-test-engine', { expect_json: [{ path: 'data.application.key', equals: 'gavriq-test-engine' }, { path: 'data.cases', min_length: 1 }, { path: 'data.environments', min_length: 1 }], description: 'ui summary' })],
    tags: ['console'], expected: '200 with application, cases and environments.',
  }),
  smoke({
    key: 'TE-SMOKE-WORKER-REGISTRY', name: 'Worker registry answers',
    description: 'GET /api/v1/workers must answer — workers register and heartbeat against it before they can claim anything.',
    severity: 'high',
    steps: [GET('/api/v1/workers', { expect_json: [{ path: 'data', exists: true }], description: 'workers' })],
    tags: ['workers'], expected: '200 with a data array.',
  })
);

/* ------------------------------------------------------------------------ */
/* api                                                                       */
/* ------------------------------------------------------------------------ */

C.push(
  api({
    key: 'TE-API-META', name: 'Capability map is published',
    description: 'GET /api/v1/meta must publish the engine version and the capability map clients feature-detect against.',
    steps: [GET('/api/v1/meta', { expect_json: [{ path: 'service', equals: 'gavriq-test-engine' }, { path: 'control_plane', equals: true }, { path: 'capabilities.repository', equals: true }, { path: 'capabilities.executions', equals: true }, { path: 'version', exists: true }], description: 'meta' })],
  }),
  api({
    key: 'TE-API-APPLICATIONS', name: 'Application registry is multi-application',
    description: 'GET /api/v1/applications must list at least two registered applications — Sand Bench and the engine itself.',
    severity: 'critical', priority: 'p0',
    steps: [GET('/api/v1/applications', { expect_json: [{ path: 'data', min_length: 2 }, { path: 'data', contains: '"key":"sand-bench"' }, { path: 'data', contains: '"key":"gavriq-test-engine"' }], description: 'applications' })],
  }),
  api({
    key: 'TE-API-APPLICATION-DETAIL', name: 'Application detail is retrievable by key',
    description: 'GET /api/v1/applications/gavriq-test-engine must return the application with its test cases and recent executions. Probed 2026-09-30: the route answers 500 ("operator does not exist: text = uuid") — this case stays red until it is fixed.',
    steps: [GET('/api/v1/applications/gavriq-test-engine', { expect_json: [{ path: 'data.key', equals: 'gavriq-test-engine' }, { path: 'data.test_cases', exists: true }], description: 'application detail' })],
    tags: ['known-defect'], expected: '200 with the application, its test_cases and recent_executions.',
  }),
  api({
    key: 'TE-API-TEST-CASES', name: 'Repository lists cases with its pagination contract',
    description: 'GET /api/v1/test-cases?limit=5 must return at most five rows plus the numeric total of the whole result set.',
    steps: [GET('/api/v1/test-cases?limit=5', { expect_json: [{ path: 'data', min_length: 1 }, { path: 'data', max_length: 5 }, { path: 'total', min: 1 }], description: 'test-cases page' })],
  }),
  api({
    key: 'TE-API-CASE-PAGING', name: 'Offset walks the same ordering as the first page',
    description: 'Read two rows, then read one row at offset 1: it must be the second row of the first page. Guards against a page that skips or repeats cases.',
    steps: [
      GET('/api/v1/test-cases?limit=2', { expect_json: [{ path: 'data', min_length: 2 }], save: { second_key: 'data.1.key' }, description: 'first page of two' }),
      GET('/api/v1/test-cases?limit=1&offset=1', { expect_json: [{ path: 'data.0.key', equals: '{{second_key}}' }], description: 'offset 1 is the second row' }),
    ],
  }),
  api({
    key: 'TE-API-CASE-LIMIT-CAP', name: 'Page size is capped at 200',
    description: 'A client asking for 100000 rows must get at most 200 — the repository list cannot be used to pull the whole table in one response.',
    severity: 'medium',
    steps: [GET('/api/v1/test-cases?limit=100000', { expect_json: [{ path: 'data', max_length: 200 }], description: 'oversized limit' })],
    dataProfile: { profile: 'boundary', data: 'limit=100000.', source: 'Hand-crafted.' },
  }),
  api({
    key: 'TE-API-CASE-FILTERS', name: 'Repository filters narrow the list',
    description: 'test_type, lifecycle, tag and free-text q must each filter: every probe returns rows that match what was asked for.',
    steps: [
      GET('/api/v1/test-cases?test_type=smoke&limit=3', { expect_json: [{ path: 'data', min_length: 1 }, { path: 'data.0.test_type', equals: 'smoke' }], description: 'test_type=smoke' }),
      GET('/api/v1/test-cases?lifecycle=active&limit=3', { expect_json: [{ path: 'data.0.lifecycle', equals: 'active' }], description: 'lifecycle=active' }),
      GET('/api/v1/test-cases?q=TE-SMOKE-HEALTH', { expect_json: [{ path: 'data', contains: '"key":"TE-SMOKE-HEALTH"' }], description: 'q finds a case by key' }),
      GET('/api/v1/test-cases?tag=test-engine&limit=3', { expect_json: [{ path: 'data', min_length: 1 }, { path: 'data.0.tags', contains: 'test-engine' }], description: 'tag=test-engine' }),
      GET('/api/v1/test-cases?q=zz-no-such-case-zz', { expect_json: [{ path: 'total', equals: 0 }], expected_body_contains: '"data":[]', description: 'no match is an empty page' }),
    ],
  }),
  api({
    key: 'TE-API-CASE-DETAIL', name: 'Case detail includes version history',
    description: 'Fetch one known case by key (TE-SMOKE-HEALTH): the detail payload must carry its executable steps and its version list.',
    steps: [GET('/api/v1/test-cases/TE-SMOKE-HEALTH', { expect_json: [{ path: 'data.key', equals: 'TE-SMOKE-HEALTH' }, { path: 'data.steps', min_length: 1 }, { path: 'data.versions', exists: true }], description: 'case detail' })],
  }),
  api({
    key: 'TE-API-CASE-NOT-FOUND', name: 'Unknown case is a clean 404',
    description: 'GET /api/v1/test-cases/<unknown key> must answer 404 {"error":"Test case not found"}.',
    severity: 'medium',
    steps: [GET('/api/v1/test-cases/TE-NO-SUCH-CASE', { expected_status: 404, expect_json: [{ path: 'error', equals: 'Test case not found' }], description: 'unknown case' })],
  }),
  api({
    key: 'TE-API-SUITES', name: 'Suites and plans are listable',
    description: 'GET /api/v1/suites, /api/v1/plans and the bulk membership read /api/v1/test-case-suites must each return a data array (an engine whose suites are maintained by hand may have none).',
    steps: [
      GET('/api/v1/suites', { expect_json: [{ path: 'data', exists: true }], description: 'suites' }),
      GET('/api/v1/plans', { expect_json: [{ path: 'data', exists: true }], description: 'plans' }),
      GET('/api/v1/test-case-suites', { expect_json: [{ path: 'data', exists: true }], description: 'membership' }),
    ],
  }),
  api({
    key: 'TE-API-ENVIRONMENTS', name: 'Environment registry with safety policies',
    description: 'GET /api/v1/environments must list environments including the Sand Bench development target.',
    steps: [GET('/api/v1/environments', { expect_json: [{ path: 'data', min_length: 1 }, { path: 'data', contains: '"key":"sand-bench-local"' }], description: 'environments' })],
  }),
  api({
    key: 'TE-API-ENVIRONMENT-DETAIL', name: 'Environment detail carries target and policy',
    description: 'GET /api/v1/environments/sand-bench-local must return its base URL, the variables cases template against and its safety policy; an unknown key is a 404.',
    steps: [
      GET('/api/v1/environments/sand-bench-local', { expect_json: [{ path: 'data.key', equals: 'sand-bench-local' }, { path: 'data.base_url', matches: '^https?://' }, { path: 'data.config.vars.web', exists: true }, { path: 'data.safety_policy.functional_smoke', equals: 'allowed' }], description: 'environment detail' }),
      GET('/api/v1/environments/no-such-environment', { expected_status: 404, expect_json: [{ path: 'error', equals: 'Environment not found' }], description: 'unknown environment' }),
    ],
  }),
  api({
    key: 'TE-API-SAFETY-POLICY-CHECK', name: 'Safety policy check answers per category',
    description: 'POST /api/v1/environments/:id/policy/check must translate the policy into a decision: functional smoke allowed, stress behind approval, destructive database work prohibited.',
    steps: [
      GET('/api/v1/environments/sand-bench-local/policy', { expect_json: [{ path: 'data.safety_policy.destructive_db', equals: 'prohibited' }], description: 'policy' }),
      POST('/api/v1/environments/sand-bench-local/policy/check', { body: { category: 'functional_smoke' }, expect_json: [{ path: 'data.allowed', equals: true }, { path: 'data.prohibited', equals: false }], description: 'functional_smoke' }),
      POST('/api/v1/environments/sand-bench-local/policy/check', { body: { category: 'stress' }, expect_json: [{ path: 'data.requires_approval', equals: true }, { path: 'data.allowed', equals: false }], description: 'stress' }),
      POST('/api/v1/environments/sand-bench-local/policy/check', { body: { category: 'destructive_db' }, expect_json: [{ path: 'data.prohibited', equals: true }], description: 'destructive_db' }),
    ],
    dataProfile: { profile: 'decision-table', data: 'Three safety categories against one environment policy.', source: 'Hand-crafted.' },
  }),
  api({
    key: 'TE-API-EXEC-VALIDATION', name: 'Execution queue validates its input',
    description: 'POST /api/v1/executions with an empty body must be rejected with 400 — no unconstrained execution can enter the queue.',
    steps: [POST('/api/v1/executions', { body: {}, expected_status: 400, expect_json: [{ path: 'error', contains: 'test_case_ids' }], description: 'reject empty execution' })],
    dataProfile: { profile: 'negative', data: 'Empty JSON body.', source: 'Hand-crafted.' },
    expected: '400 with a validation error.',
  }),
  api({
    key: 'TE-API-EXECUTIONS-LIST', name: 'Execution history is queryable',
    description: 'GET /api/v1/executions must return the recent executions, and the status filter must narrow them (queued only).',
    steps: [
      GET('/api/v1/executions', { expect_json: [{ path: 'data', exists: true }, { path: 'data', max_length: 50 }], description: 'executions' }),
      GET('/api/v1/executions?status=queued', { expect_json: [{ path: 'data', exists: true }], expected_body_not_contains: '"status":"passed"', description: 'status=queued' }),
    ],
  }),
  api({
    key: 'TE-API-EXECUTION-NOT-FOUND', name: 'Unknown execution is a clean 404 on every read',
    description: 'The execution detail, its console read model, its evidence list and its summary report must each answer 404 for an unknown id.',
    severity: 'medium',
    steps: [
      GET('/api/v1/executions/exec-no-such', { expected_status: 404, expect_json: [{ path: 'error', equals: 'Execution not found' }], description: 'detail' }),
      GET('/api/v1/ui/executions/exec-no-such', { expected_status: 404, description: 'console read model' }),
      GET('/api/v1/executions/exec-no-such/evidence', { expected_status: 404, description: 'evidence list' }),
      GET('/api/v1/reports/summary/exec-no-such', { expected_status: 404, description: 'summary report' }),
    ],
  }),
  api({
    key: 'TE-API-UI-SUMMARY', name: 'Console read model answers per application',
    description: 'GET /api/v1/ui/summary?application_key=sand-bench must return the console\'s boot payload scoped to that application: cases, suites, environments and the 7-day stats.',
    steps: [GET('/api/v1/ui/summary?application_key=sand-bench', { expect_json: [{ path: 'data.application.key', equals: 'sand-bench' }, { path: 'data.cases', min_length: 1 }, { path: 'data.suites', exists: true }, { path: 'data.environments', min_length: 1 }, { path: 'data.stats.runs_7d', min: 0 }], description: 'ui summary' })],
  }),
  api({
    key: 'TE-API-UI-LIVE', name: 'Console live poll answers',
    description: 'GET /api/v1/ui/live is what an open console polls: it must return the server clock, the catalogue signature, executions and workers.',
    steps: [GET('/api/v1/ui/live?application_key=gavriq-test-engine', { expect_json: [{ path: 'data.now', matches: ISO }, { path: 'data.catalog_sig', exists: true }, { path: 'data.executions', exists: true }, { path: 'data.workers', exists: true }, { path: 'data.changed', exists: true }], description: 'ui live' })],
  }),
  api({
    key: 'TE-API-UI-HISTORY', name: 'Tile history answers for a set of cases',
    description: 'POST /api/v1/ui/history returns per-run pass/fail for the cases of a tile. An empty selection is an empty history, not an error; a real case id returns the runs/top_failing/totals structure.',
    steps: [
      POST('/api/v1/ui/history', { body: { case_ids: [] }, expect_json: [{ path: 'data.totals.cases_run', equals: 0 }], expected_body_contains: '"runs":[]', description: 'empty selection' }),
      GET('/api/v1/test-cases/TE-SMOKE-HEALTH', { save: { case_id: 'data.id' }, description: 'resolve a case id' }),
      POST('/api/v1/ui/history', { body: { case_ids: ['{{case_id}}', 'not-a-uuid'], limit: 5 }, expect_json: [{ path: 'data.runs', exists: true }, { path: 'data.top_failing', exists: true }, { path: 'data.totals', exists: true }], description: 'history of one case (junk ids ignored)' }),
    ],
    dataProfile: { profile: 'lookup', data: 'The id of TE-SMOKE-HEALTH plus one malformed id.', source: 'Resolved from the target at run time.' },
  }),
  api({
    key: 'TE-API-DASHBOARD', name: 'Dashboard aggregates answer',
    description: 'GET /api/v1/dashboard must return the repository aggregates: totals, automation count and the by-lifecycle / by-type breakdowns.',
    steps: [GET('/api/v1/dashboard', { expect_json: [{ path: 'data.total_tests', min: 1 }, { path: 'data.automated', min: 0 }, { path: 'data.by_lifecycle', min_length: 1 }, { path: 'data.by_type', min_length: 1 }, { path: 'data.total_environments', min: 1 }], description: 'dashboard' })],
  }),
  api({
    key: 'TE-API-SEARCH', name: 'Global search spans the repository',
    description: 'GET /api/v1/search?q=… must search cases, applications, suites, environments and defects at once, and refuse a query shorter than two characters.',
    steps: [
      GET('/api/v1/search?q=TE-SMOKE', { expect_json: [{ path: 'data.test_cases', min_length: 1 }, { path: 'data.test_cases.0.resource_type', equals: 'test_case' }, { path: 'data.applications', exists: true }, { path: 'data.environments', exists: true }], description: 'search cases' }),
      GET('/api/v1/search?q=sand-bench', { expect_json: [{ path: 'data.applications', contains: '"key":"sand-bench"' }], description: 'search applications' }),
      GET('/api/v1/search?q=a', { expected_status: 400, expect_json: [{ path: 'error', contains: 'at least 2 characters' }], description: 'too short' }),
    ],
    dataProfile: { profile: 'lookup', data: 'Three search terms.', source: 'Hand-crafted.' },
  }),
  api({
    key: 'TE-API-RELEASE-READINESS', name: 'Release readiness verdict is computable',
    description: 'GET /api/v1/release-readiness must return one of the three verdicts with the pass rate and the reasons behind it.',
    steps: [GET('/api/v1/release-readiness', { expect_json: [{ path: 'data.readiness', matches: '^(READY|READY WITH CONDITIONS|NOT READY)$' }, { path: 'data.pass_rate', min: 0 }, { path: 'data.pass_rate', max: 100 }, { path: 'data.reasons', min_length: 1 }, { path: 'data.evaluated_at', matches: ISO }], description: 'release readiness' })],
  }),
  api({
    key: 'TE-API-SIT-CATALOG', name: 'SIT catalog is importable and listed',
    description: 'GET /api/v1/sit-catalog must return the SIT packs read from sit/cases, with their apps, types and counts.',
    steps: [GET('/api/v1/sit-catalog', { expect_json: [{ path: 'data.files', min_length: 1 }, { path: 'data.apps', min_length: 1 }, { path: 'data.types', min_length: 1 }, { path: 'data.counts.files', min: 1 }], description: 'sit catalog' })],
  }),
  api({
    key: 'TE-API-RUN-ALL-DRYRUN', name: 'Run-everything endpoint validates and previews',
    description: 'POST /api/v1/executions/run-all with dry_run=true must return the per-suite plan without queueing anything, and refuse a request that names no application.',
    steps: [
      POST('/api/v1/executions/run-all', { body: { application_key: 'sand-bench', dry_run: true }, expect_json: [{ path: 'data.application', equals: 'sand-bench' }, { path: 'data.suites', exists: true }, { path: 'data.total_cases', min: 0 }], description: 'run-all dry run' }),
      POST('/api/v1/executions/run-all', { body: {}, expected_status: 400, description: 'no application' }),
      POST('/api/v1/executions/run-all', { body: { application_key: 'no-such-application', dry_run: true }, expected_status: 404, description: 'unknown application' }),
    ],
    dataProfile: { profile: 'none (dry run)', data: '{"application_key":"sand-bench","dry_run":true} — queues nothing.', source: 'Hand-crafted.' },
    expected: '200 with the suite-by-suite plan; 400 and 404 for the bad requests.',
  }),
  api({
    key: 'TE-API-RUN-PLAN', name: 'Run trigger plans a run without queueing it',
    description: 'POST /api/v1/runs with dry_run=true is the pipeline-facing preview: for the engine application on its development environment it must return the plan, the excluded cases, the number of live workers and the evidence gate mode.',
    severity: 'critical', priority: 'p0',
    steps: [POST('/api/v1/runs', { body: { application: 'gavriq-test-engine', environment: 'engine-local', dry_run: true }, expect_json: [{ path: 'data.application', equals: 'gavriq-test-engine' }, { path: 'data.environment', equals: 'engine-local' }, { path: 'data.total_cases', min: 1 }, { path: 'data.suites', min_length: 1 }, { path: 'data.excluded', exists: true }, { path: 'data.workers_online', min: 0 }, { path: 'data.evidence_gate', matches: '^(enforce|report|off)$' }], description: 'dry-run plan' })],
    dataProfile: { profile: 'none (dry run)', data: '{"application":"gavriq-test-engine","environment":"engine-local","dry_run":true}.', source: 'Hand-crafted.' },
  }),
  api({
    key: 'TE-API-RUN-VALIDATION', name: 'Run trigger refuses incomplete and unknown targets',
    description: 'POST /api/v1/runs must answer 400 without application/environment and 404 for an application or environment it does not know — before anything is planned.',
    steps: [
      POST('/api/v1/runs', { body: {}, expected_status: 400, expect_json: [{ path: 'error', contains: 'application and environment are required' }], description: 'empty body' }),
      POST('/api/v1/runs', { body: { application: 'no-such-application', environment: 'engine-local', dry_run: true }, expected_status: 404, expect_json: [{ path: 'error', equals: 'Application not found' }], description: 'unknown application' }),
      POST('/api/v1/runs', { body: { application: 'gavriq-test-engine', environment: 'no-such-environment', dry_run: true }, expected_status: 404, expect_json: [{ path: 'error', equals: 'Environment not found' }], description: 'unknown environment' }),
    ],
    dataProfile: { profile: 'negative', data: 'Three invalid run requests (all dry_run or rejected before planning).', source: 'Hand-crafted.' },
  }),
  api({
    key: 'TE-API-RUNS-LIST', name: 'Runs are listable and an unknown run is a 404',
    description: 'GET /api/v1/runs lists grouped runs filterable by application; GET /api/v1/runs/<unknown> and its evidence manifest answer 404.',
    steps: [
      GET('/api/v1/runs?limit=5', { expect_json: [{ path: 'data', exists: true }, { path: 'data', max_length: 5 }], description: 'recent runs' }),
      GET('/api/v1/runs?application=gavriq-test-engine&limit=5', { expect_json: [{ path: 'data', exists: true }], expected_body_not_contains: '"application":"sand-bench"', description: 'filtered by application' }),
      GET('/api/v1/runs/run-no-such', { expected_status: 404, expect_json: [{ path: 'error', equals: 'Run not found' }], description: 'unknown run' }),
      GET('/api/v1/runs/run-no-such/evidence', { expected_status: 404, description: 'unknown run evidence' }),
    ],
  }),
  api({
    key: 'TE-API-WORKERS', name: 'Workers report a derived status',
    description: 'GET /api/v1/workers must return each worker with a status from the known set; a worker whose heartbeat is stale reads "offline" whatever it last reported.',
    severity: 'medium',
    steps: [GET('/api/v1/workers', { expect_json: [{ path: 'data', exists: true }], expected_body_not_contains: '"status":null', description: 'workers' })],
  }),
  api({
    key: 'TE-API-SCHEDULES', name: 'Schedules are listable and validate their input',
    description: 'GET /api/v1/schedules returns the schedules with the scheduler time zone; creating one without a name, without a trigger, with a malformed cron expression or for an unknown application is refused.',
    steps: [
      GET('/api/v1/schedules', { expect_json: [{ path: 'data', exists: true }], description: 'schedules' }),
      POST('/api/v1/schedules', { body: { cron_expression: '0 2 * * *' }, expected_status: 400, expect_json: [{ path: 'error', equals: 'name required' }], description: 'no name' }),
      POST('/api/v1/schedules', { body: { name: 'self-test invalid' }, expected_status: 400, expect_json: [{ path: 'error', contains: 'cron_expression or event_trigger required' }], description: 'no trigger' }),
      POST('/api/v1/schedules', { body: { name: 'self-test invalid', cron_expression: 'every full moon', application: 'gavriq-test-engine', environment: 'engine-local' }, expected_status: 400, expect_json: [{ path: 'error', contains: 'cron_expression must be' }], description: 'malformed cron' }),
      POST('/api/v1/schedules', { body: { name: 'self-test invalid', cron_expression: '0 2 * * *', application: 'no-such-application', environment: 'engine-local' }, expected_status: 404, expect_json: [{ path: 'error', equals: 'Application not found' }], description: 'unknown application' }),
      POST('/api/v1/schedules', { body: { name: 'self-test invalid', cron_expression: '0 2 * * *', application: 'gavriq-test-engine' }, expected_status: 400, expect_json: [{ path: 'error', contains: 'needs an environment' }], description: 'application without environment' }),
    ],
    dataProfile: { profile: 'negative', data: 'Five invalid schedule bodies; none is stored.', source: 'Hand-crafted.' },
  }),
  api({
    key: 'TE-API-SETTINGS', name: 'Engine settings are readable and validated',
    description: 'GET /api/v1/settings returns the run retention window, per-test-type case timeouts (24h default) and the consecutive-failure circuit breaker (default 20); PUT refuses an out-of-range value on any of the three without changing it.',
    severity: 'medium',
    steps: [
      GET('/api/v1/settings', {
        expect_json: [
          { path: 'data.run_retention_days', min: 1 }, { path: 'data.run_retention_days', max: 365 },
          { path: 'data.test_type_timeout_minutes.smoke', exists: true },
          { path: 'data.consecutive_failure_limit', min: 1 },
        ],
        description: 'settings',
      }),
      PUT('/api/v1/settings', { body: { run_retention_days: 0 }, expected_status: 400, description: 'zero days' }),
      PUT('/api/v1/settings', { body: { run_retention_days: 366 }, expected_status: 400, description: 'over a year' }),
      PUT('/api/v1/settings', { body: { run_retention_days: 'soon' }, expected_status: 400, description: 'not a number' }),
      PUT('/api/v1/settings', { body: { test_type_timeout_minutes: { smoke: 0 } }, expected_status: 400, description: 'zero-minute timeout' }),
      PUT('/api/v1/settings', { body: { test_type_timeout_minutes: { 'not-a-real-type': 60 } }, expected_status: 400, description: 'unknown test_type' }),
      PUT('/api/v1/settings', { body: { consecutive_failure_limit: 0 }, expected_status: 400, description: 'zero-case circuit breaker' }),
      PUT('/api/v1/settings', {
        body: { test_type_timeout_minutes: { smoke: 90 }, consecutive_failure_limit: 15 },
        expect_json: [{ path: 'data.test_type_timeout_minutes.smoke', equals: 90 }, { path: 'data.consecutive_failure_limit', equals: 15 }],
        description: 'valid timeout + circuit breaker saved',
      }),
      PUT('/api/v1/settings', { body: { test_type_timeout_minutes: { smoke: 1440 }, consecutive_failure_limit: 20 }, description: 'restore defaults' }),
    ],
    dataProfile: { profile: 'boundary', data: 'run_retention_days 0/366/"soon", a zero-minute timeout, an unknown test_type, a zero-case circuit breaker, then a valid save of both — defaults restored at the end.', source: 'Hand-crafted.' },
  }),
  api({
    key: 'TE-API-BUILD-STATUS', name: 'In-container build status answers',
    description: 'GET /api/v1/build-results for an application that never reported answers with an empty set and no build id; /api/v1/test-status combines engine-executed cases with in-container results.',
    steps: [
      GET('/api/v1/build-results?application_key=no-such-application', { expect_json: [{ path: 'application_key', equals: 'no-such-application' }], expected_body_contains: '"build_id":null', description: 'no builds yet' }),
      GET('/api/v1/test-status?application_key=gavriq-test-engine', { expect_json: [{ path: 'data.application_key', equals: 'gavriq-test-engine' }, { path: 'data.engine_executed', min_length: 1 }, { path: 'data.engine_executed.0.source', equals: 'test_engine' }, { path: 'data.in_container', exists: true }], description: 'combined status' }),
      GET('/api/v1/ui/build-history?application_key=gavriq-test-engine', { expect_json: [{ path: 'data.runs', exists: true }, { path: 'data.top_failing', exists: true }], description: 'build history' }),
    ],
  }),
  api({
    key: 'TE-API-INTELLIGENCE', name: 'Quality intelligence endpoints answer',
    description: 'Coverage gaps, flaky-case detection and AI proposals must each return their documented structure.',
    severity: 'medium',
    steps: [
      GET('/api/v1/intelligence/gaps', { expect_json: [{ path: 'data.untested_requirements', exists: true }, { path: 'data.stale_tests', exists: true }, { path: 'data.never_executed', exists: true }], description: 'gaps' }),
      GET('/api/v1/intelligence/flakes', { expect_json: [{ path: 'data', exists: true }, { path: 'window_days', equals: 14 }], description: 'flakes' }),
      GET('/api/v1/ai-proposals', { expect_json: [{ path: 'data', exists: true }], description: 'ai proposals' }),
    ],
  }),
  api({
    key: 'TE-API-AGENT-CONTEXT', name: 'Agent context is published',
    description: 'GET /api/v1/agents/context gives an autonomous agent the applications and the capabilities it may use.',
    severity: 'medium',
    steps: [GET('/api/v1/agents/context', { expect_json: [{ path: 'data.applications', min_length: 2 }, { path: 'data.agent_capabilities', min_length: 7 }, { path: 'data.agent_capabilities', contains: 'request_executions' }, { path: 'data.untested_requirements_count', min: 0 }], description: 'agents context' })],
  }),
  api({
    key: 'TE-API-OPS', name: 'Operational endpoints answer',
    description: 'Catalogue counts (post-seed verification), target preflight and the SIT runner status/log must each answer with their structure. The preflight probes a port nothing listens on, so its verdict is "blocked".',
    severity: 'medium',
    steps: [
      GET('/api/v1/ops/catalog-counts', { expect_json: [{ path: 'data.test_cases_total', min: 1 }, { path: 'data.sand_bench_app.key', equals: 'sand-bench' }], description: 'catalog counts' }),
      GET('/api/v1/preflight?base_url=http%3A%2F%2F127.0.0.1%3A9', { expect_json: [{ path: 'data.reachable', equals: false }, { path: 'data.recommendation', equals: 'blocked' }, { path: 'data.classification', equals: 'target_unreachable' }, { path: 'data.probes', min_length: 4 }], description: 'preflight of a dead port' }),
      GET('/api/v1/sit-status', { expect_json: [{ path: 'base', exists: true }], description: 'sit status' }),
      GET('/api/v1/kit-log?limit=5', { expect_json: [{ path: 'data', exists: true }, { path: 'data', max_length: 5 }], description: 'kit log' }),
    ],
    timeoutSeconds: 30,
  }),
  api({
    key: 'TE-API-AUDIT-LIST', name: 'Audit events are listable',
    description: 'GET /api/v1/audit must return the most recent audit events (at most 100).',
    severity: 'medium',
    steps: [GET('/api/v1/audit', { expect_json: [{ path: 'data', exists: true }, { path: 'data', max_length: 100 }], description: 'audit' })],
  }),
  api({
    key: 'TE-API-EVIDENCE-MISSING', name: 'Missing evidence is a 404, not an empty 200',
    description: 'GET /api/v1/evidence/file for a key that is not in the store must answer 404 with the file name only.',
    severity: 'medium',
    steps: [
      GET('/api/v1/evidence/file?key=evidence%2Fno-such-file.png', { expected_status: 404, expect_json: [{ path: 'error', equals: 'File not found' }, { path: 'key', equals: 'no-such-file.png' }], description: 'unknown key' }),
      GET('/api/v1/evidence/file', { expected_status: 404, description: 'no key' }),
    ],
  })
);

/* ------------------------------------------------------------------------ */
/* integration                                                               */
/* ------------------------------------------------------------------------ */

const TMP_CASE = `TE-TMP-${UNIQ}`;

C.push(
  integration({
    key: 'TE-INT-CASE-LIFECYCLE', name: 'Case is created, versioned and archived',
    description: 'Create a case in the sandbox application (version 1, draft), update it (version 2 with a snapshot and change summary), then archive it. The repository\'s core write path, end to end.',
    severity: 'critical', priority: 'p0',
    steps: [
      ...FIXTURES,
      POST('/api/v1/test-cases', { body: { key: TMP_CASE, name: `Self-test temp case ${UNIQ}`, application_id: '{{fix_app}}', test_type: 'api', execution_method: 'http', steps: [{ action: 'request', method: 'GET', url: '{{engine}}/ready' }], created_by: 'engine-self-test' }, expected_status: 201, expect_json: [{ path: 'data.key', equals: TMP_CASE }, { path: 'data.version', equals: 1 }, { path: 'data.lifecycle', equals: 'draft' }, { path: 'data.automation_status', equals: 'manual' }], save: { tmp_id: 'data.id' }, description: 'create' }),
      GET('/api/v1/test-cases/{{tmp_id}}', { expect_json: [{ path: 'data.versions', min_length: 1 }, { path: 'data.versions.0.change_summary', equals: 'Initial version' }], description: 'initial version snapshot' }),
      PUT('/api/v1/test-cases/{{tmp_id}}', { body: { description: 'updated by the self-test', severity: 'low', change_summary: 'self-test update', updated_by: 'engine-self-test' }, expect_json: [{ path: 'data.version', equals: 2 }, { path: 'data.description', equals: 'updated by the self-test' }, { path: 'data.severity', equals: 'low' }], description: 'update' }),
      GET(`/api/v1/test-cases/${TMP_CASE}`, { expect_json: [{ path: 'data.versions', min_length: 2 }, { path: 'data.versions.0.version', equals: 2 }, { path: 'data.versions.0.change_summary', equals: 'self-test update' }], description: 'second version snapshot, read by key' }),
      PUT('/api/v1/test-cases/{{tmp_id}}', { body: { lifecycle: 'archived', change_summary: 'self-test cleanup', updated_by: 'engine-self-test' }, expect_json: [{ path: 'data.lifecycle', equals: 'archived' }, { path: 'data.version', equals: 3 }], description: 'archive' }),
    ],
    dataProfile: SANDBOX_DATA('One temporary case (key TE-TMP-<run>), archived at the end.'),
    expected: 'Version 1 → 2 → 3 with a snapshot per change; final lifecycle archived.',
  }),
  integration({
    key: 'TE-INT-CASE-CLONE', name: 'Clone copies a case as a new draft',
    description: 'Clone the manual fixture case: the clone must be a draft named "Clone of …" under the requested key, with the source\'s steps and application, and leave the source untouched.',
    steps: [
      ...FIXTURES,
      POST(`/api/v1/test-cases/${FIX.manual}/clone`, { body: { key: `TE-TMP-CLONE-${UNIQ}`, created_by: 'engine-self-test' }, expected_status: 201, expect_json: [{ path: 'data.key', equals: `TE-TMP-CLONE-${UNIQ}` }, { path: 'data.lifecycle', equals: 'draft' }, { path: 'data.name', contains: 'Clone of Self-test fixture' }, { path: 'data.application_id', equals: '{{fix_app}}' }, { path: 'data.steps', min_length: 1 }], save: { clone_id: 'data.id' }, description: 'clone' }),
      GET(`/api/v1/test-cases/${FIX.manual}`, { expect_json: [{ path: 'data.lifecycle', equals: 'active' }], description: 'source unchanged' }),
      POST('/api/v1/test-cases/TE-NO-SUCH-CASE/clone', { body: {}, expected_status: 404, description: 'cloning an unknown case' }),
      ARCHIVE('{{clone_id}}', 'archive the clone'),
    ],
    dataProfile: SANDBOX_DATA('One clone of TE-FIX-MANUAL (key TE-TMP-CLONE-<run>), archived at the end.'),
    expected: '201 draft clone; source stays active.',
  }),
  integration({
    key: 'TE-INT-CASE-NAME-UNIQUE', name: 'A duplicate case name is made unique with a timestamp',
    description: 'Case names are unique across the repository. Creating a second case with a name already taken must succeed and store the name with a UTC timestamp suffix, so the duplicate says when it was made.',
    severity: 'medium',
    steps: [
      ...FIXTURES,
      POST('/api/v1/test-cases', { body: { key: `TE-TMP-N1-${UNIQ}`, name: `Self-test duplicate name ${UNIQ}`, application_id: '{{fix_app}}' }, expected_status: 201, expect_json: [{ path: 'data.name', equals: `Self-test duplicate name ${UNIQ}` }], save: { n1: 'data.id' }, description: 'first case keeps the name' }),
      POST('/api/v1/test-cases', { body: { key: `TE-TMP-N2-${UNIQ}`, name: `Self-test duplicate name ${UNIQ}`, application_id: '{{fix_app}}' }, expected_status: 201, expect_json: [{ path: 'data.name', matches: ' \\(\\d{8}-\\d{6}\\)$' }], save: { n2: 'data.id' }, description: 'second case gets a suffix' }),
      ARCHIVE('{{n1}}'), ARCHIVE('{{n2}}'),
    ],
    dataProfile: SANDBOX_DATA('Two temporary cases sharing one name, archived at the end.'),
    expected: 'Second name ends with " (YYYYMMDD-HHMMSS)".',
  }),
  integration({
    key: 'TE-INT-CASE-REQUIRED-FIELDS', name: 'Case creation requires key, name and application',
    description: 'POST /api/v1/test-cases without key, name or application_id must be refused with 400 and store nothing.',
    preconditions: PRE.readOnly,
    steps: [
      POST('/api/v1/test-cases', { body: { name: 'no key' }, expected_status: 400, expect_json: [{ path: 'error', equals: 'key, name, application_id are required' }], description: 'no key' }),
      POST('/api/v1/test-cases', { body: { key: `TE-TMP-X-${UNIQ}` }, expected_status: 400, description: 'no name' }),
      PUT('/api/v1/test-cases/TE-NO-SUCH-CASE', { body: { description: 'x' }, expected_status: 404, description: 'updating an unknown case' }),
    ],
    dataProfile: { profile: 'negative', data: 'Two incomplete case bodies and one update of an unknown key; nothing is stored.', source: 'Hand-crafted.' },
    expected: '400 / 400 / 404.',
  }),
  integration({
    key: 'TE-INT-SUITE-MEMBERSHIP', name: 'Suite is created and cases are attached',
    description: 'Create a suite in the sandbox application, attach two fixture cases, confirm the bulk membership read shows them, then queue nothing and remove the suite. (An engine without the suite-delete route keeps the temporary suite; the step is tolerated.)',
    steps: [
      ...FIXTURES,
      GET(`/api/v1/test-cases/${FIX.second}`, { save: { second_case: 'data.id' }, description: 'second fixture case' }),
      POST('/api/v1/suites', { body: { key: `te-tmp-suite-${UNIQ}`, name: `Self-test temp suite ${UNIQ}`, application_id: '{{fix_app}}', suite_type: 'smoke', created_by: 'engine-self-test' }, expected_status: 201, expect_json: [{ path: 'data.key', equals: `te-tmp-suite-${UNIQ}` }, { path: 'data.suite_type', equals: 'smoke' }], save: { suite_id: 'data.id' }, description: 'create suite' }),
      POST('/api/v1/suites/{{suite_id}}/cases', { body: { test_case_ids: ['{{fix_case}}', '{{second_case}}'] }, expect_json: [{ path: 'data.added', equals: 2 }], description: 'attach two cases' }),
      GET('/api/v1/test-case-suites', { expect_json: [{ path: 'data', contains: '"test_suite_id":"{{suite_id}}"' }], description: 'membership is readable in bulk' }),
      GET('/api/v1/suites?application_id={{fix_app}}', { expect_json: [{ path: 'data', contains: '"id":"{{suite_id}}"' }], description: 'suite listed for its application' }),
      POST('/api/v1/suites', { body: { name: 'no key' }, expected_status: 400, description: 'suite without key is refused' }),
      DELETE('/api/v1/suites/{{suite_id}}', { body: {}, expected_status: 200, allow_failure: true, description: 'remove the temporary suite' }),
    ],
    dataProfile: SANDBOX_DATA('One temporary suite (key te-tmp-suite-<run>) holding two fixture cases; deleted at the end.'),
    expected: 'Suite created, two members added and visible, suite removed.',
  }),
  integration({
    key: 'TE-INT-RUN-PLAN-SAFETY', name: 'Run planner applies automation status, lifecycle and safety policy',
    description: 'Plan a run of the sandbox application on the fixture environment. Of its six cases exactly two are runnable; the manual case, the chaos-tagged case (chaos prohibited there) and the load case (load needs approval) are excluded with their reasons; the archived case is not considered at all.',
    severity: 'critical', priority: 'p0',
    steps: [
      ...FIXTURES,
      POST('/api/v1/runs', {
        body: { application: FIXTURE_APP, environment: FIXTURE_ENV, dry_run: true },
        expect_json: [
          { path: 'data.total_cases', equals: 2 },
          { path: 'data.excluded', contains: '"reason":"not automated (manual)"' },
          { path: 'data.excluded', contains: `"reason":"chaos is prohibited on ${FIXTURE_ENV}"` },
          { path: 'data.excluded', contains: `"reason":"load is approval_required on ${FIXTURE_ENV}"` },
        ],
        expected_body_not_contains: FIX.archived,
        description: 'plan with the environment policy applied',
      }),
    ],
    dataProfile: SANDBOX_DATA('Six fixture cases, one per planner outcome. Dry run: nothing is queued.'),
    expected: 'total_cases 2; three exclusions with reasons; archived case absent.',
  }),
  integration({
    key: 'TE-INT-RUN-PLAN-APPROVAL', name: 'An approved category lifts its approval gate only',
    description: 'Plan the same run with approved_categories ["load"]: the load case joins the plan (three runnable), while the chaos case stays excluded — approval cannot override a prohibition.',
    steps: [
      ...FIXTURES,
      POST('/api/v1/runs', {
        body: { application: FIXTURE_APP, environment: FIXTURE_ENV, dry_run: true, approved_categories: ['load', 'chaos'] },
        expect_json: [{ path: 'data.total_cases', equals: 3 }, { path: 'data.excluded', contains: `"reason":"chaos is prohibited on ${FIXTURE_ENV}"` }],
        expected_body_not_contains: 'load is approval_required',
        description: 'plan with load and chaos approved',
      }),
    ],
    dataProfile: SANDBOX_DATA('approved_categories ["load","chaos"]. Dry run: nothing is queued.'),
    expected: 'total_cases 3; chaos still excluded as prohibited.',
  }),
  integration({
    key: 'TE-INT-RUN-PLAN-SCOPE', name: 'Run scope narrows the plan by case, method and type',
    description: 'The same planner honours a scope: one case key plans one case; a method filter plans only cases of that method; a scope that matches nothing plans zero cases and, when actually triggered, is refused with 422 instead of queueing an empty run.',
    steps: [
      ...FIXTURES,
      POST('/api/v1/runs', { body: { application: FIXTURE_APP, environment: FIXTURE_ENV, dry_run: true, scope: { case_keys: [FIX.second] } }, expect_json: [{ path: 'data.total_cases', equals: 1 }], description: 'scope: one case key' }),
      POST('/api/v1/runs', { body: { application: FIXTURE_APP, environment: FIXTURE_ENV, dry_run: true, scope: { methods: ['HTTP'], test_types: ['smoke'] } }, expect_json: [{ path: 'data.total_cases', equals: 2 }], expected_body_not_contains: FIX.load, description: 'scope: http smoke cases (method is case-insensitive)' }),
      POST('/api/v1/runs', { body: { application: FIXTURE_APP, environment: FIXTURE_ENV, dry_run: true, scope: { case_keys: 'TE-FIX-PASS, TE-FIX-SECOND' } }, expect_json: [{ path: 'data.total_cases', equals: 2 }], description: 'scope: comma-separated string' }),
      POST('/api/v1/runs', { body: { application: FIXTURE_APP, environment: FIXTURE_ENV, scope: { case_keys: ['TE-NO-SUCH-CASE'] } }, expected_status: 422, expect_json: [{ path: 'error', contains: 'No runnable cases' }, { path: 'data.total_cases', equals: 0 }], description: 'an empty plan is refused, not queued' }),
    ],
    dataProfile: SANDBOX_DATA('Four scopes over the six fixture cases. Three dry runs and one request the planner refuses; nothing is queued.'),
    expected: '1, 2, 2 and a 422.',
  }),
  integration({
    key: 'TE-INT-WORKER-PROTOCOL', name: 'Execution is carried from queue to verdict over the worker protocol',
    description: 'Acts as the worker: queue an execution, claim it, upload an artefact, report the case passed with that evidence and complete. The execution must end "passed" with its exit criteria met, and the run view must report state completed / verdict pass with one evidence item.',
    severity: 'critical', priority: 'p0', preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      ...RUN_ONE_PASS,
      GET('/api/v1/executions/{{exec_id}}', { expect_json: [{ path: 'data.status', equals: 'passed' }, { path: 'data.worker_id', equals: GHOST_WORKER }, { path: 'data.metadata.exit_criteria.met', equals: true }, { path: 'data.results', min_length: 1 }, { path: 'data.results.0.evidence', min_length: 1 }], description: 'execution with its result and evidence' }),
      GET('/api/v1/runs/{{exec_key}}', { expect_json: [{ path: 'data.state', equals: 'completed' }, { path: 'data.verdict', equals: 'pass' }, { path: 'data.exit_criteria.met', equals: true }, { path: 'data.totals.reported', equals: 1 }, { path: 'data.totals.evidence_items', equals: 1 }], description: 'run verdict' }),
    ],
    dataProfile: ISOLATED_DATA,
    expected: 'Execution passed; run completed with verdict pass and one evidence item.',
  }),
  integration({
    key: 'TE-INT-FAILED-RESULT', name: 'A failing result fails the execution whatever the worker claims',
    description: 'The worker reports the case failed (with evidence) but then completes the execution as "passed". Under the enforced gate the final status is derived from the recorded results: the execution is failed, the run verdict is fail and the failing case is listed under problems.',
    severity: 'critical', priority: 'p0', preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      ...QUEUE_AND_CLAIM, UPLOAD,
      result('failed', 'engine self-test: assertion failed, expected 200 got 503'),
      complete('passed', 'failed'),
      GET('/api/v1/runs/{{exec_key}}', { expect_json: [{ path: 'data.verdict', equals: 'fail' }, { path: 'data.exit_criteria.met', equals: false }, { path: 'data.exit_criteria.all_passed', equals: false }, { path: 'data.totals.failed', equals: 1 }, { path: 'data.problems.0.case_key', equals: FIX.pass }, { path: 'data.problems.0.evidence_count', equals: 1 }], description: 'run verdict and problems' }),
      POST('/api/v1/execution-results/{{result_id}}/classify', { body: {}, expect_json: [{ path: 'data.classification', equals: 'assertion_failure' }], description: 'failure is auto-classified from its message' }),
    ],
    dataProfile: ISOLATED_DATA,
    expected: 'Execution failed; verdict fail; problem listed; classification assertion_failure.',
  }),
  integration({
    key: 'TE-INT-CANCEL', name: 'A queued execution can be cancelled and is never handed out',
    description: 'Queue an execution and cancel it: it reads cancelled with a finish time, a second cancel is refused, and a worker asking for work gets nothing (204).',
    preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      POST('/api/v1/executions', { body: { test_case_ids: ['{{fix_case}}'], environment_id: '{{fix_env}}', trigger_source: 'selftest' }, expected_status: 202, save: { exec_id: 'data.id' }, description: 'queue' }),
      POST('/api/v1/executions/{{exec_id}}/cancel', { body: {}, expect_json: [{ path: 'data.status', equals: 'cancelled' }, { path: 'data.finished_at', matches: ISO }], description: 'cancel' }),
      POST('/api/v1/executions/{{exec_id}}/cancel', { body: {}, expected_status: 404, expect_json: [{ path: 'error', contains: 'not cancellable' }], description: 'second cancel' }),
      POST('/api/v1/executions/claim', { body: { worker_id: GHOST_WORKER }, expected_status: 204, description: 'nothing left to claim' }),
    ],
    dataProfile: ISOLATED_DATA,
    expected: 'cancelled → 404 on repeat → claim returns 204.',
  }),
  integration({
    key: 'TE-INT-CLAIM-ORDER', name: 'Workers are handed executions oldest first, once each',
    description: 'Queue two executions, then claim three times: the first claim returns the older one, the second the newer, the third nothing. No execution is handed out twice.',
    preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      POST('/api/v1/executions', { body: { test_case_ids: ['{{fix_case}}'], environment_id: '{{fix_env}}', trigger_source: 'selftest' }, expected_status: 202, save: { first_id: 'data.id' }, description: 'queue the first' }),
      POST('/api/v1/executions', { body: { test_case_ids: ['{{fix_case}}'], environment_id: '{{fix_env}}', trigger_source: 'selftest' }, expected_status: 202, save: { second_id: 'data.id' }, description: 'queue the second' }),
      POST('/api/v1/executions/claim', { body: { worker_id: GHOST_WORKER }, expect_json: [{ path: 'data.id', equals: '{{first_id}}' }], description: 'claim 1 → the older' }),
      POST('/api/v1/executions/claim', { body: { worker_id: GHOST_WORKER }, expect_json: [{ path: 'data.id', equals: '{{second_id}}' }], description: 'claim 2 → the newer' }),
      POST('/api/v1/executions/claim', { body: { worker_id: GHOST_WORKER }, expected_status: 204, description: 'claim 3 → nothing' }),
      POST('/api/v1/executions/claim', { body: {}, expected_status: 400, expect_json: [{ path: 'error', equals: 'worker_id required' }], description: 'a claim must name its worker' }),
      POST('/api/v1/executions/{{first_id}}/cancel', { body: {}, allow_failure: true, description: 'cleanup first' }),
      POST('/api/v1/executions/{{second_id}}/cancel', { body: {}, allow_failure: true, description: 'cleanup second' }),
    ],
    dataProfile: ISOLATED_DATA,
    expected: 'FIFO hand-out; third claim 204.',
  }),
  integration({
    key: 'TE-INT-SUITE-EXECUTION', name: 'Queueing a suite resolves its cases',
    description: 'Create a suite with two fixture cases and queue it by suite id alone: the execution must carry both cases and take the suite\'s name. Cancelled before any worker sees it.',
    preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      GET(`/api/v1/test-cases/${FIX.second}`, { save: { second_case: 'data.id' }, description: 'second fixture case' }),
      POST('/api/v1/suites', { body: { key: `te-tmp-suite-${UNIQ}`, name: `Self-test suite run ${UNIQ}`, application_id: '{{fix_app}}', suite_type: 'smoke' }, expected_status: 201, save: { suite_id: 'data.id' }, description: 'create suite' }),
      POST('/api/v1/suites/{{suite_id}}/cases', { body: { test_case_ids: ['{{fix_case}}', '{{second_case}}'] }, description: 'attach two cases' }),
      POST('/api/v1/executions', { body: { test_suite_id: '{{suite_id}}', environment_id: FIXTURE_ENV, trigger_source: 'selftest' }, expected_status: 202, expect_json: [{ path: 'data.test_case_ids', min_length: 2 }, { path: 'data.test_case_ids', max_length: 2 }, { path: 'data.name', contains: `Self-test suite run ${UNIQ}` }, { path: 'data.environment_id', equals: '{{fix_env}}' }, { path: 'data.metadata.application_key', equals: FIXTURE_APP }], save: { exec_id: 'data.id' }, description: 'queue by suite; environment given by key' }),
      POST('/api/v1/executions/{{exec_id}}/cancel', { body: {}, expect_json: [{ path: 'data.status', equals: 'cancelled' }], description: 'cancel' }),
      DELETE('/api/v1/suites/{{suite_id}}', { body: {}, allow_failure: true, description: 'remove the temporary suite' }),
    ],
    dataProfile: SANDBOX_DATA('One temporary suite of two fixture cases and one execution of it, cancelled while queued.'),
    expected: 'Execution holds two case ids, named after the suite, scoped to the sandbox application.',
  }),
  integration({
    key: 'TE-INT-SCHEDULE-CRUD', name: 'Schedule is created, edited and deleted',
    description: 'Create a disabled cron schedule for the sandbox application, confirm it lists with its application and environment keys, change its expression, then delete it; deleting it again is a 404.',
    steps: [
      ...FIXTURES,
      POST('/api/v1/schedules', { body: { name: `selftest-schedule-${UNIQ}`, cron_expression: '0 3 * * *', application: FIXTURE_APP, environment: FIXTURE_ENV, scope: { case_keys: [FIX.pass] }, enabled: false, created_by: 'engine-self-test' }, expected_status: 201, expect_json: [{ path: 'data.enabled', equals: false }, { path: 'data.cron_expression', equals: '0 3 * * *' }, { path: 'data.application_id', equals: '{{fix_app}}' }, { path: 'data.environment_id', equals: '{{fix_env}}' }, { path: 'data.time_zone', exists: true }], save: { sched_id: 'data.id' }, description: 'create (disabled)' }),
      GET('/api/v1/schedules', { expect_json: [{ path: 'data', contains: `"name":"selftest-schedule-${UNIQ}"` }, { path: 'data', contains: `"application_key":"${FIXTURE_APP}"` }], description: 'listed with its keys' }),
      PATCH('/api/v1/schedules/{{sched_id}}', { body: { cron_expression: '@daily', name: `selftest-schedule-${UNIQ}-edited` }, expect_json: [{ path: 'data.cron_expression', equals: '@daily' }, { path: 'data.name', equals: `selftest-schedule-${UNIQ}-edited` }, { path: 'data.enabled', equals: false }], description: 'edit' }),
      PATCH('/api/v1/schedules/{{sched_id}}', { body: { cron_expression: 'not a cron' }, expected_status: 400, description: 'edit with a malformed expression is refused' }),
      DELETE('/api/v1/schedules/{{sched_id}}', { body: {}, expected_status: 204, description: 'delete' }),
      DELETE('/api/v1/schedules/{{sched_id}}', { body: {}, expected_status: 404, expect_json: [{ path: 'error', equals: 'Schedule not found' }], description: 'delete again' }),
    ],
    dataProfile: SANDBOX_DATA('One disabled schedule (name selftest-schedule-<run>), deleted at the end. It never fires.'),
    expected: '201 → listed → edited → 204 → 404.',
  }),
  integration({
    key: 'TE-INT-SCHEDULE-EVENT', name: 'An event fires the schedules bound to it',
    description: 'Create a schedule bound to a unique event, post that event: exactly one run is started through the run planner for the sandbox application, carrying the event in its reason. The queued execution is cancelled and the schedule deleted.',
    preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      POST('/api/v1/schedules', { body: { name: `selftest-event-${UNIQ}`, event_trigger: `selftest_${UNIQ}`, application: FIXTURE_APP, environment: FIXTURE_ENV, scope: { case_keys: [FIX.pass] } }, expected_status: 201, save: { sched_id: 'data.id' }, description: 'schedule bound to the event' }),
      POST('/api/v1/schedules/trigger', { body: { event: `selftest_${UNIQ}`, metadata: { build: 'selftest' } }, expected_status: 202, expect_json: [{ path: 'data.executions_started', equals: 1 }, { path: 'data.executions.0.total_cases', equals: 1 }, { path: 'data.executions.0.run_id', matches: '^run-' }], save: { run_id: 'data.executions.0.run_id', exec_id: 'data.executions.0.executions.0.id' }, description: 'post the event' }),
      GET('/api/v1/runs/{{run_id}}', { expect_json: [{ path: 'data.trigger_source', equals: 'ci' }, { path: 'data.reason', contains: `selftest_${UNIQ}` }, { path: 'data.application', equals: FIXTURE_APP }, { path: 'data.environment', equals: FIXTURE_ENV }], description: 'run carries the event' }),
      POST('/api/v1/executions/{{exec_id}}/cancel', { body: {}, expect_json: [{ path: 'data.status', equals: 'cancelled' }], description: 'cancel the queued execution' }),
      GET('/api/v1/runs/{{run_id}}', { expect_json: [{ path: 'data.state', equals: 'cancelled' }, { path: 'data.verdict', exists: false }], description: 'a cancelled run has no verdict' }),
      DELETE('/api/v1/schedules/{{sched_id}}', { body: {}, expected_status: 204, description: 'delete the schedule' }),
    ],
    dataProfile: SANDBOX_DATA('One event-bound schedule and the one execution its event queues; execution cancelled, schedule deleted.'),
    expected: 'One run started by the event, then cancelled with no verdict.',
  }),
  integration({
    key: 'TE-INT-SCHEDULER-DAEMON', name: 'Scheduler daemon fires a due schedule',
    description: 'The scheduler is a separate process that polls the API. Create an interval schedule that has never run (due at once) and wait for an execution carrying its name to appear in the queue — proof the daemon is alive and fires through the same planner.',
    preconditions: `${PRE.isolated} The target\'s scheduler service must be running.`,
    timeoutSeconds: 30,
    steps: [
      ...ISOLATED,
      POST('/api/v1/schedules', { body: { name: `selftest-daemon-${UNIQ}`, cron_expression: 'every:1440', application: FIXTURE_APP, environment: FIXTURE_ENV, scope: { case_keys: [FIX.pass] } }, expected_status: 201, save: { sched_id: 'data.id' }, description: 'interval schedule, never run' }),
      GET('/api/v1/executions?status=queued', { expect_json: [{ path: 'data', contains: `"schedule_name":"selftest-daemon-${UNIQ}"` }, { path: 'data.0.trigger_source', equals: 'schedule' }], poll: { timeout_ms: 100000, interval_ms: 3000 }, save: { exec_id: 'data.0.id' }, description: 'the daemon queues it within its poll interval' }),
      DELETE('/api/v1/schedules/{{sched_id}}', { body: {}, expected_status: 204, description: 'delete the schedule' }),
      POST('/api/v1/executions/{{exec_id}}/cancel', { body: {}, expect_json: [{ path: 'data.status', equals: 'cancelled' }], description: 'cancel the queued execution' }),
    ],
    dataProfile: SANDBOX_DATA('One interval schedule and the one execution the daemon queues from it; both removed.'),
    expected: 'A queued execution named after the schedule appears within 100 seconds.',
  }),
  integration({
    key: 'TE-INT-BUILD-RESULTS', name: 'CI build results are ingested and surfaced',
    description: 'Post a build\'s in-container results for the sandbox application, then read them back three ways: the build itself, the per-test history and the console build history with its pass/fail counts.',
    steps: [
      ...FIXTURES,
      POST('/api/v1/build-results', { body: { application_key: FIXTURE_APP, build_id: 'selftest-build', commit_sha: 'abc1234', branch: 'selftest', results: [{ test_key: 'unit-alpha', test_name: 'alpha adds', suite: 'unit', status: 'passed', duration_ms: 5 }, { test_key: 'unit-beta', test_name: 'beta divides', suite: 'unit', status: 'failed', duration_ms: 7, message: 'division by zero' }] }, expected_status: 201, expect_json: [{ path: 'data.upserted', equals: 2 }], description: 'report the build' }),
      GET(`/api/v1/build-results?application_key=${FIXTURE_APP}&build_id=selftest-build`, { expect_json: [{ path: 'data', min_length: 2 }, { path: 'data', max_length: 2 }, { path: 'data.0.test_key', equals: 'unit-alpha' }, { path: 'data.0.commit_sha', equals: 'abc1234' }, { path: 'data.1.message', equals: 'division by zero' }], description: 'read the build back' }),
      GET(`/api/v1/build-results/test/unit-beta?application_key=${FIXTURE_APP}`, { expect_json: [{ path: 'latest.status', equals: 'failed' }, { path: 'latest.build_id', equals: 'selftest-build' }], description: 'per-test history' }),
      GET(`/api/v1/ui/build-history?application_key=${FIXTURE_APP}`, { expect_json: [{ path: 'data.runs', contains: '"key":"selftest-build"' }, { path: 'data.top_failing', contains: '"key":"unit-beta"' }], description: 'console build history' }),
      POST('/api/v1/build-results', { body: { application_key: FIXTURE_APP, build_id: 'selftest-build' }, expected_status: 400, expect_json: [{ path: 'error', equals: 'results array required' }], description: 'a report without results is refused' }),
    ],
    dataProfile: SANDBOX_DATA('Build "selftest-build" with two unit results. The same build id is reused every run, so rows are updated, not added.'),
    expected: '201 upserted 2; the three read paths agree.',
  }),
  integration({
    key: 'TE-INT-ENVIRONMENT-PATCH', name: 'Environment patch merges instead of replacing',
    description: 'Patch one variable of the fixture environment, then a second one: the first must still be there, along with the application scope and every safety-policy entry. A caller can change one value without resending the whole configuration. Probed 2026-09-30: a patch of config.vars replaces the whole variable set (the second patch drops the first marker) — this case stays red until the merge is fixed. It resends the engine variable on every patch so the fixture environment is not damaged meanwhile.',
    steps: [
      ...FIXTURES,
      GET(`/api/v1/environments/${FIXTURE_ENV}`, { precondition: true, expect_json: [{ path: 'data.config.vars.engine', matches: '^https?://' }], save: { orig_engine: 'data.config.vars.engine' }, description: 'fixture environment still has its engine variable' }),
      PATCH(`/api/v1/environments/${FIXTURE_ENV}`, { body: { config: { vars: { engine: '{{orig_engine}}', selftest_first: UNIQ } }, safety_policy: { stress: 'approval_required' }, updated_by: 'engine-self-test' }, expect_json: [{ path: 'data.config.vars.selftest_first', equals: UNIQ }, { path: 'data.config.applications', contains: FIXTURE_APP }, { path: 'data.safety_policy.chaos', equals: 'prohibited' }, { path: 'data.safety_policy.functional_smoke', equals: 'allowed' }, { path: 'data.updated_by', equals: 'engine-self-test' }], description: 'patch a first variable; scope and policy survive' }),
      PATCH(`/api/v1/environments/${FIXTURE_ENV}`, { body: { config: { vars: { engine: '{{orig_engine}}', selftest_second: UNIQ } } }, expect_json: [{ path: 'data.config.vars.selftest_second', equals: UNIQ }, { path: 'data.config.vars.selftest_first', equals: UNIQ }], description: 'patch a second variable; the first survives' }),
      PATCH('/api/v1/environments/no-such-environment', { body: { name: 'x' }, expected_status: 404, description: 'patching an unknown environment' }),
    ],
    tags: ['known-defect'],
    dataProfile: SANDBOX_DATA('Two marker variables on the fixture environment, overwritten each run.'),
    expected: 'Both markers present after the second patch; application scope and policy intact.',
  }),
  integration({
    key: 'TE-INT-AI-PROPOSALS', name: 'Generated proposals are drafts until reviewed',
    description: 'Request test generation for the sandbox application: three proposals are stored as "proposed". Rejecting them changes their status; a review with an unknown action is refused.',
    severity: 'medium',
    steps: [
      ...FIXTURES,
      POST('/api/v1/test-cases/generate', { body: { source_type: 'selftest', source_ref: UNIQ, application_id: '{{fix_app}}' }, expected_status: 201, expect_json: [{ path: 'data', min_length: 3 }, { path: 'data.0.status', equals: 'proposed' }, { path: 'data.0.proposed_case.lifecycle', equals: 'draft' }], save: { p0: 'data.0.id', p1: 'data.1.id', p2: 'data.2.id' }, description: 'generate' }),
      POST('/api/v1/ai-proposals/{{p0}}/review', { body: { action: 'approve-everything' }, expected_status: 400, description: 'unknown review action' }),
      POST('/api/v1/ai-proposals/{{p0}}/review', { body: { action: 'reject', reviewer: 'engine-self-test' }, expect_json: [{ path: 'data.status', equals: 'rejected' }, { path: 'data.reviewed_by', equals: 'engine-self-test' }], description: 'reject 1' }),
      POST('/api/v1/ai-proposals/{{p1}}/review', { body: { action: 'reject', reviewer: 'engine-self-test' }, expect_json: [{ path: 'data.status', equals: 'rejected' }], description: 'reject 2' }),
      POST('/api/v1/ai-proposals/{{p2}}/review', { body: { action: 'reject', reviewer: 'engine-self-test' }, expect_json: [{ path: 'data.status', equals: 'rejected' }], description: 'reject 3' }),
      GET('/api/v1/ai-proposals?status=rejected', { expect_json: [{ path: 'data', contains: '"id":"{{p0}}"' }], description: 'listed as rejected' }),
    ],
    dataProfile: SANDBOX_DATA('Three generated proposals, all rejected in the same case.'),
    expected: 'Three proposals created and rejected.',
  })
);

/* ------------------------------------------------------------------------ */
/* use case                                                                  */
/* ------------------------------------------------------------------------ */

const TRIGGER_RUN: Step = POST('/api/v1/runs', {
  body: { application: FIXTURE_APP, environment: FIXTURE_ENV, scope: { case_keys: [FIX.pass] }, reason: `self-test pipeline ${UNIQ}`, trigger_source: 'ci', requested_by: 'engine-self-test', exclusive: true, metadata: { pipeline: 'selftest' } },
  expected_status: 202,
  expect_json: [{ path: 'data.run_id', matches: '^run-' }, { path: 'data.total_cases', equals: 1 }, { path: 'data.executions', min_length: 1 }, { path: 'warning', contains: 'No worker is online' }],
  save: { run_id: 'data.run_id', exec_id: 'data.executions.0.id', exec_key: 'data.executions.0.key', status_url: 'data.status_url' },
  description: 'pipeline triggers a scoped, exclusive run',
});
const CLAIM_TRIGGERED: Step = POST('/api/v1/executions/claim', { body: { worker_id: GHOST_WORKER }, expect_json: [{ path: 'data.id', equals: '{{exec_id}}' }], description: 'worker claims it' });

C.push(
  usecase({
    key: 'TE-UC-PIPELINE-RUN', name: 'A deploy pipeline triggers a run and reads its verdict',
    description: 'The documented CI flow: POST /api/v1/runs for one application on one environment, follow the returned status URL while the run is in flight (no verdict yet), let the worker execute it, then read the verdict, the exit criteria and the evidence manifest.',
    severity: 'critical', priority: 'p0', preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      TRIGGER_RUN,
      GET('{{status_url}}', { expect_json: [{ path: 'data.state', equals: 'stalled' }, { path: 'data.verdict', exists: false }, { path: 'data.reason', equals: `self-test pipeline ${UNIQ}` }, { path: 'data.trigger_source', equals: 'ci' }, { path: 'data.requested_by', equals: 'engine-self-test' }, { path: 'data.exit_criteria.met', equals: false }], description: 'in flight: no worker yet, so "stalled" and no verdict' }),
      CLAIM_TRIGGERED, UPLOAD, result('passed', 'engine self-test: pipeline run'), complete('passed', 'passed'),
      GET('{{status_url}}', { expect_json: [{ path: 'data.state', equals: 'completed' }, { path: 'data.verdict', equals: 'pass' }, { path: 'data.exit_criteria.met', equals: true }, { path: 'data.exit_criteria.all_cases_reported', equals: true }, { path: 'data.exit_criteria.evidence_complete', equals: true }, { path: 'data.totals.passed', equals: 1 }, { path: 'data.finished_at', matches: ISO }, { path: 'data.links.evidence', equals: '/api/v1/runs/{{run_id}}/evidence' }], description: 'verdict and exit criteria' }),
      GET('/api/v1/runs/{{run_id}}/evidence', { expect_json: [{ path: 'data.evidence_items', equals: 1 }, { path: 'data.cases.0.case_key', equals: FIX.pass }, { path: 'data.cases.0.evidence.0.sha256', equals: ARTEFACT.sha256 }], description: 'evidence manifest' }),
      GET(`/api/v1/runs?application=${FIXTURE_APP}&limit=5`, { expect_json: [{ path: 'data.0.run_id', equals: '{{run_id}}' }, { path: 'data.0.state', equals: 'completed' }, { path: 'data.0.environment', equals: FIXTURE_ENV }], description: 'listed as the latest run of the application' }),
    ],
    dataProfile: ISOLATED_DATA,
    expected: 'stalled → completed; verdict pass; exit criteria met; manifest lists the hashed artefact.',
  }),
  usecase({
    key: 'TE-UC-EXCLUSIVE-RUN', name: 'A second pipeline cannot start a run over one in progress',
    description: 'With exclusive=true a trigger for an application and environment that already has a run in flight is refused with 409 and pointed at the active run — two deploys racing each other do not double-run the tests. Once the first run is cancelled, a new trigger is accepted.',
    preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      TRIGGER_RUN,
      POST('/api/v1/runs', { body: { application: FIXTURE_APP, environment: FIXTURE_ENV, scope: { case_keys: [FIX.pass] }, exclusive: true }, expected_status: 409, expect_json: [{ path: 'run_id', equals: '{{run_id}}' }, { path: 'status_url', equals: '/api/v1/runs/{{run_id}}' }, { path: 'error', contains: 'already in progress' }], description: 'second exclusive trigger is refused' }),
      POST('/api/v1/executions/{{exec_id}}/cancel', { body: {}, expect_json: [{ path: 'data.status', equals: 'cancelled' }], description: 'cancel the first run' }),
      POST('/api/v1/runs', { body: { application: FIXTURE_APP, environment: FIXTURE_ENV, scope: { case_keys: [FIX.pass] }, exclusive: true }, expected_status: 202, save: { exec2_id: 'data.executions.0.id' }, description: 'a new trigger is accepted' }),
      POST('/api/v1/executions/{{exec2_id}}/cancel', { body: {}, expect_json: [{ path: 'data.status', equals: 'cancelled' }], description: 'cleanup' }),
    ],
    dataProfile: SANDBOX_DATA('Two runs of fixture case TE-FIX-PASS, both cancelled while queued.'),
    expected: '202, 409 naming the active run, then 202 after the cancel.',
  }),
  usecase({
    key: 'TE-UC-RETIRED-ENVIRONMENT', name: 'A run cannot be triggered against a retired environment',
    description: 'An environment that was retired stays in the registry for its history but must refuse new runs: POST /api/v1/runs answers 409. Uses local-dev, which the catalogue seed retires.',
    preconditions: 'Target engine reachable; environment local-dev exists and is retired (seeded state).',
    steps: [
      GET('/api/v1/environments/local-dev', { precondition: true, expect_json: [{ path: 'data.status', equals: 'retired' }], description: 'local-dev is retired on this target' }),
      POST('/api/v1/runs', { body: { application: 'sand-bench', environment: 'local-dev', dry_run: true }, expected_status: 409, expect_json: [{ path: 'error', equals: 'Environment is retired' }, { path: 'environment', equals: 'local-dev' }], description: 'trigger is refused' }),
    ],
    dataProfile: { profile: 'negative', data: 'A dry-run trigger against a retired environment.', source: 'Hand-crafted.' },
    expected: '409 "Environment is retired".',
  }),
  usecase({
    key: 'TE-UC-FAILURE-TRIAGE', name: 'An engineer triages a failed run down to its evidence',
    description: 'After a failing run, everything needed to triage is reachable from the run: the problem entry with its message, the evidence list of that result, and the artefact itself served with its content.',
    severity: 'critical', priority: 'p0', preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      ...QUEUE_AND_CLAIM, UPLOAD,
      result('failed', 'engine self-test: connection refused ECONNREFUSED 10.0.0.1:443'),
      complete('failed', 'failed'),
      GET('/api/v1/runs/{{exec_key}}', { expect_json: [{ path: 'data.problems.0.status', equals: 'failed' }, { path: 'data.problems.0.message', contains: 'ECONNREFUSED' }, { path: 'data.problems.0.method', equals: 'http' }, { path: 'data.problems.0.evidence_url', equals: '/api/v1/execution-results/{{result_id}}/evidence' }, { path: 'data.missing_evidence', max_length: 0 }], description: 'problem entry points at its evidence' }),
      GET('/api/v1/execution-results/{{result_id}}/evidence', { expect_json: [{ path: 'data', min_length: 1 }, { path: 'data.0.evidence_type', equals: 'http_transcript' }, { path: 'data.0.metadata.verified', equals: true }, { path: 'data.0.url', equals: '{{ev_url}}' }], description: 'evidence of the failing result' }),
      GET('{{ev_url}}', { expected_body_contains: ARTEFACT.text, expect_headers: [{ name: 'content-type', contains: 'application/json' }], description: 'the artefact itself' }),
      GET('/api/v1/ui/executions/{{exec_id}}', { expect_json: [{ path: 'data.results.0.status', equals: 'failed' }, { path: 'data.results.0.evidence_count', equals: 1 }, { path: 'data.cases.0.key', equals: FIX.pass }, { path: 'data.environment_name', exists: true }], description: 'console run screen shows the same result' }),
      POST('/api/v1/execution-results/{{result_id}}/classify', { body: {}, expect_json: [{ path: 'data.classification', equals: 'network_failure' }], description: 'classified as a network failure' }),
    ],
    dataProfile: ISOLATED_DATA,
    expected: 'Run → problem → evidence list → artefact, all consistent.',
  }),
  usecase({
    key: 'TE-UC-SUMMARY-REPORT', name: 'A test summary report is generated for an execution',
    description: 'GET /api/v1/reports/summary/:id turns a finished execution into a report: executive summary with verdict and pass rate, the results with their case keys, and a recommendation.',
    preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      ...RUN_ONE_PASS,
      GET('/api/v1/reports/summary/{{exec_key}}', { expect_json: [{ path: 'data.executive_summary.verdict', equals: 'PASS' }, { path: 'data.executive_summary.pass_rate', equals: 100 }, { path: 'data.executive_summary.total', equals: 1 }, { path: 'data.results.0.test_key', equals: FIX.pass }, { path: 'data.overall_verdict', equals: 'PASS' }, { path: 'data.recommendations', min_length: 1 }, { path: 'data.critical_failures', max_length: 0 }, { path: 'data.generated_at', matches: ISO }], description: 'summary report' }),
    ],
    dataProfile: ISOLATED_DATA,
    expected: 'Verdict PASS, pass rate 100, one result.',
  }),
  usecase({
    key: 'TE-UC-OPERATOR-FINDS-CASE', name: 'An operator finds a case and opens its definition and history',
    description: 'Search for a case by key, open it by the id the search returned, and load its run history — the path from the console\'s search box to a case screen.',
    steps: [
      GET('/api/v1/search?q=Engine%20health%20endpoint%20answers', { expect_json: [{ path: 'data.test_cases.0.key', equals: 'TE-SMOKE-HEALTH' }], save: { case_id: 'data.test_cases.0.id' }, description: 'search by name' }),
      GET('/api/v1/test-cases/{{case_id}}', { expect_json: [{ path: 'data.key', equals: 'TE-SMOKE-HEALTH' }, { path: 'data.steps', min_length: 1 }, { path: 'data.execution_method', equals: 'http' }, { path: 'data.expected_results', exists: true }], description: 'open the definition' }),
      POST('/api/v1/ui/history', { body: { case_ids: ['{{case_id}}'], limit: 10 }, expect_json: [{ path: 'data.runs', exists: true }, { path: 'data.totals.results', min: 0 }], description: 'its run history' }),
    ],
    dataProfile: { profile: 'lookup', data: 'Search term "Engine health endpoint answers" (the name of TE-SMOKE-HEALTH).', source: 'Hand-crafted.' },
    expected: 'Search → detail → history all resolve the same case.',
  }),
  usecase({
    key: 'TE-UC-ENVIRONMENT-SCOPED-STATUS', name: 'Case status is reported per environment',
    description: 'The same case can pass on staging and fail on development, so the console asks for statuses of one environment. With environment_id (a key is accepted) the summary echoes the resolved environment id; without it, none.',
    steps: [
      GET('/api/v1/environments/engine-local', { save: { env_id: 'data.id' }, description: 'resolve the environment' }),
      GET('/api/v1/ui/summary?application_key=gavriq-test-engine&environment_id=engine-local', { expect_json: [{ path: 'data.environment_id', equals: '{{env_id}}' }, { path: 'data.cases', min_length: 1 }], description: 'scoped by environment key' }),
      GET('/api/v1/ui/summary?application_key=gavriq-test-engine&environment_id={{env_id}}', { expect_json: [{ path: 'data.environment_id', equals: '{{env_id}}' }], description: 'scoped by environment id' }),
      GET('/api/v1/ui/summary?application_key=gavriq-test-engine', { expect_json: [{ path: 'data.environment_id', exists: false }], description: 'unscoped' }),
      GET('/api/v1/ui/summary?application_key=gavriq-test-engine&environment_id=no-such-environment', { expect_json: [{ path: 'data.environment_id', exists: false }, { path: 'data.cases', min_length: 1 }], description: 'an unknown environment falls back to unscoped' }),
    ],
    expected: 'environment_id echoed when it resolves, absent otherwise.',
  }),
  usecase({
    key: 'TE-UC-APPLICATION-SCOPED-ENVIRONMENTS', name: 'Each application is offered only its own environments',
    description: 'Environments list the applications deployed there. The console summary for Sand Bench must offer the Sand Bench target and not the engine\'s; the summary for the engine must offer the engine\'s and not Sand Bench\'s.',
    steps: [
      GET('/api/v1/ui/summary?application_key=sand-bench', { expect_json: [{ path: 'data.environments', contains: '"key":"sand-bench-local"' }], expected_body_not_contains: '"key":"engine-local"', description: 'Sand Bench environments' }),
      GET('/api/v1/ui/summary?application_key=gavriq-test-engine', { expect_json: [{ path: 'data.environments', contains: '"key":"engine-local"' }], expected_body_not_contains: '"key":"sand-bench-local"', description: 'engine environments' }),
    ],
    expected: 'No environment is offered to the other application.',
  }),
  usecase({
    key: 'TE-UC-RELEASE-DECISION', name: 'A release manager reads readiness next to the evidence behind it',
    description: 'Readiness is a verdict over the last 14 days of results. The totals it reports and the dashboard\'s seven-day figures come from the same records: both must answer, and the verdict must be consistent with its own totals (a "READY" verdict never carries failures).',
    steps: [
      GET('/api/v1/release-readiness', { expect_json: [{ path: 'data.readiness', exists: true }, { path: 'data.totals', exists: true }, { path: 'data.reasons.0', exists: true }], save: { readiness: 'data.readiness' }, description: 'readiness' }),
      GET('/api/v1/dashboard', { expect_json: [{ path: 'data.failed_last_7d', min: 0 }, { path: 'data.executions_last_7d', exists: true }], description: 'dashboard figures' }),
      GET('/api/v1/release-readiness?application_id=ignored&test_plan_id=ignored', { expect_json: [{ path: 'data.readiness', equals: '{{readiness}}' }, { path: 'data.application_id', equals: 'ignored' }], description: 'same verdict on a repeat read' }),
    ],
    expected: 'A verdict with its reasons, stable across reads.',
  }),
  usecase({
    key: 'TE-UC-AGENT-PLANS-RUN', name: 'An autonomous agent goes from context to a run plan',
    description: 'An agent reads /api/v1/agents/context, confirms it may request executions, picks the engine application and asks the planner what a run would contain — without queueing anything.',
    severity: 'medium',
    steps: [
      GET('/api/v1/agents/context', { expect_json: [{ path: 'data.agent_capabilities', contains: 'request_executions' }, { path: 'data.applications', contains: '"key":"gavriq-test-engine"' }], description: 'agent context' }),
      POST('/api/v1/runs', { body: { application: 'gavriq-test-engine', environment: 'engine-local', scope: { test_types: ['smoke'] }, dry_run: true, requested_by: 'agent:self-test' }, expect_json: [{ path: 'data.total_cases', min: 1 }, { path: 'data.base_url', matches: '^https?://' }], description: 'plan the smoke cases' }),
    ],
    dataProfile: { profile: 'none (dry run)', data: 'A dry-run plan scoped to test type smoke.', source: 'Hand-crafted.' },
    expected: 'Capability present; plan returned; nothing queued.',
  })
);

/* ------------------------------------------------------------------------ */
/* regression                                                                */
/* ------------------------------------------------------------------------ */

C.push(
  regression({
    key: 'TE-REG-HEALTH-SHAPE', name: 'Health payload keeps its fields',
    description: 'Monitors and the console read these exact fields from /health: status, service, a semantic version, the rbac and jwt flags, ui and the database schema name.',
    steps: [GET('/health', { expect_json: [{ path: 'status', equals: 'ok' }, { path: 'service', equals: 'gavriq-test-engine' }, { path: 'version', matches: '^\\d+\\.\\d+\\.\\d+' }, { path: 'rbac', matches: '^(true|false)$' }, { path: 'jwt', matches: '^(true|false)$' }, { path: 'ui', equals: true }, { path: 'schema', equals: 'test_engine' }], description: 'health shape' })],
  }),
  regression({
    key: 'TE-REG-META-ENDPOINT-MAP', name: 'Published endpoint map stays accurate',
    description: 'Clients discover routes from /api/v1/meta.endpoints. The map must keep its entries, and the routes it names must actually answer.',
    steps: [
      GET('/api/v1/meta', { expect_json: [{ path: 'endpoints.health', equals: '/health' }, { path: 'endpoints.test_cases', equals: '/api/v1/test-cases' }, { path: 'endpoints.executions', equals: '/api/v1/executions' }, { path: 'endpoints.environments', equals: '/api/v1/environments' }, { path: 'endpoints.release_readiness', equals: '/api/v1/release-readiness' }, { path: 'endpoints.meta', equals: '/api/v1/meta' }, { path: 'runners', contains: 'playwright' }, { path: 'runners', contains: 'selenium' }, { path: 'runners', contains: 'performance' }], description: 'endpoint map' }),
      GET('/api/v1/test-status', { description: 'named route answers: test_status' }),
      GET('/api/v1/agents/context', { description: 'named route answers: agents_context' }),
      GET('/api/v1/kit-log', { description: 'named route answers: kit_log' }),
    ],
  }),
  regression({
    key: 'TE-REG-ERROR-ENVELOPE', name: 'Unknown routes answer with the JSON error envelope',
    description: 'A request for a route that does not exist must answer 404 with {statusCode, error, message} as JSON — clients parse it; an HTML error page would break them.',
    steps: [GET('/api/v1/no-such-route', { expected_status: 404, expect_json: [{ path: 'statusCode', equals: 404 }, { path: 'error', equals: 'Not Found' }, { path: 'message', equals: 'Route GET:/api/v1/no-such-route not found' }], expect_headers: [{ name: 'content-type', contains: 'application/json' }], description: 'unknown route' })],
  }),
  regression({
    key: 'TE-REG-VALIDATION-COPY', name: 'Validation messages keep their wording',
    description: 'The console and CI scripts show these messages verbatim. Each must keep its exact wording.',
    severity: 'medium',
    steps: [
      POST('/api/v1/executions', { body: {}, expected_status: 400, expect_json: [{ path: 'error', equals: 'Provide test_case_ids, test_suite_id, or test_plan_id' }], description: 'executions' }),
      POST('/api/v1/runs', { body: {}, expected_status: 400, expect_json: [{ path: 'error', equals: 'application and environment are required (key or id)' }], description: 'runs' }),
      POST('/api/v1/executions/run-all', { body: {}, expected_status: 400, expect_json: [{ path: 'error', equals: 'Provide application_key or application_id' }], description: 'run-all' }),
      GET('/api/v1/search?q=a', { expected_status: 400, expect_json: [{ path: 'error', equals: 'q must be at least 2 characters' }], description: 'search' }),
      POST('/api/v1/evidence/upload', { body: {}, expected_status: 400, expect_json: [{ path: 'error', equals: 'name and content_base64 required' }], description: 'evidence upload' }),
      POST('/api/v1/workers/register', { body: {}, expected_status: 400, expect_json: [{ path: 'error', equals: 'id and name required' }], description: 'worker registration' }),
      POST('/api/v1/schedules/trigger', { body: {}, expected_status: 400, expect_json: [{ path: 'error', equals: 'event required' }], description: 'schedule event' }),
      POST('/api/v1/build-results', { body: {}, expected_status: 400, expect_json: [{ path: 'error', equals: 'application_key and build_id required' }], description: 'build results' }),
    ],
    dataProfile: { profile: 'negative', data: 'Eight empty or too-short requests; each is rejected before any write.', source: 'Hand-crafted.' },
  }),
  regression({
    key: 'TE-REG-CASE-ROW-SHAPE', name: 'Case detail keeps the fields runners and the console read',
    description: 'The worker executes a case from these fields and the console renders them; none may disappear or change type.',
    steps: [GET('/api/v1/test-cases/TE-SMOKE-HEALTH', { expect_json: [{ path: 'data.id', matches: UUID }, { path: 'data.application_id', matches: UUID }, { path: 'data.execution_method', equals: 'http' }, { path: 'data.steps.0.action', equals: 'request' }, { path: 'data.validation_rules.data_profile.profile', exists: true }, { path: 'data.timeout_seconds', min: 1 }, { path: 'data.tags', min_length: 1 }, { path: 'data.automation_status', equals: 'automated' }, { path: 'data.lifecycle', equals: 'active' }, { path: 'data.version', min: 1 }, { path: 'data.versions', exists: true }, { path: 'data.created_at', matches: ISO }], description: 'case row shape' })],
  }),
  regression({
    key: 'TE-REG-SUMMARY-ROW-SHAPE', name: 'Console summary keeps its compact row',
    description: 'The summary sends a compact row per case — id, key, name, tags, type, method, suite ids — and must not grow back into full rows with steps and scripts.',
    steps: [GET('/api/v1/ui/summary?application_key=gavriq-test-engine', { expect_json: [{ path: 'data.cases.0.id', matches: UUID }, { path: 'data.cases.0.key', exists: true }, { path: 'data.cases.0.name', exists: true }, { path: 'data.cases.0.tags', exists: true }, { path: 'data.cases.0.test_type', exists: true }, { path: 'data.cases.0.execution_method', exists: true }, { path: 'data.cases.0.suite_ids', exists: true }, { path: 'data.cases.0.steps', exists: false }, { path: 'data.cases.0.description', exists: false }, { path: 'data.application.types', min_length: 1 }, { path: 'data.now', matches: ISO }], description: 'summary row shape' })],
  }),
  regression({
    key: 'TE-REG-RUN-PLAN-SHAPE', name: 'Run plan keeps its fields',
    description: 'Pipelines read the dry-run plan: application, environment, base_url, total_cases, per-suite counts, excluded cases with reasons, live workers and the gate mode.',
    steps: [POST('/api/v1/runs', { body: { application: 'gavriq-test-engine', environment: 'engine-local', dry_run: true }, expect_json: [{ path: 'data.application', exists: true }, { path: 'data.environment', exists: true }, { path: 'data.base_url', matches: '^https?://' }, { path: 'data.total_cases', min: 0 }, { path: 'data.suites.0.key', exists: true }, { path: 'data.suites.0.name', exists: true }, { path: 'data.suites.0.cases', min: 1 }, { path: 'data.excluded', exists: true }, { path: 'data.workers_online', min: 0 }, { path: 'data.evidence_gate', exists: true }], description: 'plan shape' })],
    dataProfile: { profile: 'none (dry run)', data: 'One dry-run plan.', source: 'Hand-crafted.' },
  }),
  regression({
    key: 'TE-REG-POLICY-DEFAULT-DENY', name: 'A category the policy does not name is prohibited',
    description: 'The safety policy is an allow-list: a category that is misspelt or not configured must be answered "prohibited", never silently allowed.',
    severity: 'critical', priority: 'p0',
    steps: [POST('/api/v1/environments/sand-bench-local/policy/check', { body: { category: 'not-a-category' }, expect_json: [{ path: 'data.decision', equals: 'prohibited' }, { path: 'data.allowed', equals: false }, { path: 'data.prohibited', equals: true }], description: 'unknown category' })],
    dataProfile: { profile: 'negative', data: 'category "not-a-category".', source: 'Hand-crafted.' },
  }),
  regression({
    key: 'TE-REG-DRY-RUN-QUEUES-NOTHING', name: 'A dry run leaves the queue untouched',
    description: 'Planning must never queue. On a target with an empty queue, three dry runs (run trigger, run-all, scoped) leave it empty.',
    preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      POST('/api/v1/runs', { body: { application: FIXTURE_APP, environment: FIXTURE_ENV, dry_run: true }, description: 'dry run' }),
      POST('/api/v1/executions/run-all', { body: { application_key: FIXTURE_APP, environment_id: FIXTURE_ENV, dry_run: true }, description: 'run-all dry run' }),
      POST('/api/v1/runs', { body: { application: FIXTURE_APP, environment: FIXTURE_ENV, dry_run: true, scope: { case_keys: [FIX.pass] }, exclusive: true }, description: 'scoped exclusive dry run' }),
      GET('/api/v1/executions?status=queued', { expected_body_contains: '"data":[]', description: 'queue still empty' }),
    ],
    dataProfile: SANDBOX_DATA('Three dry runs over the fixture cases.'),
    expected: 'No execution exists after three dry runs.',
  }),
  regression({
    key: 'TE-REG-CONSOLE-SHELL-ANCHORS', name: 'Console shell keeps the elements its scripts bind to',
    description: 'app.js looks these ids up by name at start. If the shell loses one the console dies on load, so the served HTML must contain each.',
    steps: [
      GET('/', { expected_body_contains: 'id="sideNav"', description: 'side navigation' }),
      GET('/', { expected_body_contains: 'id="appSelect"', description: 'application selector' }),
      GET('/', { expected_body_contains: 'id="envSelect"', description: 'environment selector' }),
      GET('/', { expected_body_contains: 'id="content"', description: 'content area' }),
      GET('/', { expected_body_contains: 'id="globalSearch"', description: 'search box' }),
      GET('/', { expected_body_contains: 'src="/catalog/app.js"', description: 'script bundle reference' }),
    ],
  }),
  regression({
    key: 'TE-REG-CATALOG-ALIAS', name: 'The console is also served under /catalog/',
    description: 'Older bookmarks use /catalog and /catalog/. Both must still land on the same console shell.',
    severity: 'medium',
    steps: [
      GET('/catalog/', { expected_body_contains: '<title>GAVRIQ Test Engine</title>', description: '/catalog/' }),
      GET('/catalog', { expected_body_contains: '<title>GAVRIQ Test Engine</title>', description: '/catalog redirects to it' }),
    ],
  }),
  regression({
    key: 'TE-REG-EXECUTION-ROW-SHAPE', name: 'Execution rows keep the fields workers read',
    description: 'A worker runs a claimed execution from its id, key, case ids, environment id and metadata. After a full pass the row must still carry all of them plus its timing.',
    preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      ...RUN_ONE_PASS,
      GET('/api/v1/executions/{{exec_id}}', { expect_json: [{ path: 'data.id', matches: UUID }, { path: 'data.key', matches: '^exec-' }, { path: 'data.name', contains: 'Self-test fixture' }, { path: 'data.test_case_ids', min_length: 1 }, { path: 'data.environment_id', matches: UUID }, { path: 'data.execution_location', equals: 'out_of_container' }, { path: 'data.trigger_source', equals: 'selftest' }, { path: 'data.requested_by', equals: 'engine-self-test' }, { path: 'data.started_at', matches: ISO }, { path: 'data.finished_at', matches: ISO }, { path: 'data.metadata.application_key', equals: FIXTURE_APP }, { path: 'data.results.0.evidence.0.url', contains: '/api/v1/evidence/file?key=' }], description: 'execution row' }),
    ],
    dataProfile: ISOLATED_DATA,
  })
);

/* ------------------------------------------------------------------------ */
/* data quality                                                              */
/* ------------------------------------------------------------------------ */

C.push(
  dq({
    key: 'TE-DQ-CASE-TOTALS-AGREE', name: 'Case totals agree across three read paths',
    description: 'The repository list, the dashboard and the ops catalogue counts each count test cases with their own query. All three must report the same number.',
    steps: [
      GET('/api/v1/test-cases?limit=1', { save: { total: 'total' }, expect_json: [{ path: 'total', min: 1 }], description: 'repository total' }),
      GET('/api/v1/dashboard', { expect_json: [{ path: 'data.total_tests', equals: '{{total}}' }], description: 'dashboard total' }),
      GET('/api/v1/ops/catalog-counts', { expect_json: [{ path: 'data.test_cases_total', equals: '{{total}}' }], description: 'ops count' }),
    ],
    expected: 'One number from three queries.',
  }),
  dq({
    key: 'TE-DQ-APPLICATION-TOTALS-AGREE', name: 'Per-application totals agree',
    description: 'For the engine application, the filtered repository list and the filtered dashboard must count the same cases.',
    steps: [
      GET('/api/v1/test-cases/TE-SMOKE-HEALTH', { save: { app_id: 'data.application_id' }, description: 'resolve the application id' }),
      GET('/api/v1/test-cases?application_id={{app_id}}&limit=1', { save: { app_total: 'total' }, expect_json: [{ path: 'total', min: 1 }, { path: 'data.0.application_id', equals: '{{app_id}}' }], description: 'filtered list' }),
      GET('/api/v1/dashboard?application_id={{app_id}}', { expect_json: [{ path: 'data.total_tests', equals: '{{app_total}}' }], description: 'filtered dashboard' }),
    ],
    expected: 'Same count from both.',
  }),
  dq({
    key: 'TE-DQ-CASE-REFERENCES-RESOLVE', name: 'A case\'s application reference resolves',
    description: 'Every case belongs to an application. The application id on a case must be one the registry lists.',
    steps: [
      GET('/api/v1/test-cases/TE-SMOKE-HEALTH', { save: { app_id: 'data.application_id' }, description: 'case' }),
      GET('/api/v1/applications', { expect_json: [{ path: 'data', contains: '"id":"{{app_id}}"' }], description: 'application exists' }),
    ],
  }),
  dq({
    key: 'TE-DQ-CASE-ENUMS', name: 'Case classification fields hold valid values',
    description: 'Severity, priority, lifecycle and automation status drive filtering, planning and reporting. On a seeded case each must be one of its defined values.',
    steps: [GET('/api/v1/test-cases/TE-SMOKE-HEALTH', { expect_json: [{ path: 'data.severity', matches: '^(critical|high|medium|low|trivial)$' }, { path: 'data.priority', matches: '^p[0-4]$' }, { path: 'data.lifecycle', matches: '^(draft|ready_for_review|approved|active|maintenance|deprecated|archived)$' }, { path: 'data.automation_status', matches: '^(manual|automated|partially_automated|to_be_automated|not_automatable)$' }, { path: 'data.test_level', matches: '^(unit|integration|system|acceptance)$' }], description: 'enum fields' })],
  }),
  dq({
    key: 'TE-DQ-AUTOMATED-CASES-EXECUTABLE', name: 'An automated case carries what its runner needs',
    description: 'A case marked automated with no steps runs nothing and passes nothing. The seeded HTTP cases must carry at least one request step with a URL, and their documented data profile.',
    severity: 'critical',
    steps: [
      // The braces are escaped so the runner asserts on the stored template, not on its substituted value.
      GET('/api/v1/test-cases/TE-SMOKE-HEALTH', { expect_json: [{ path: 'data.steps', min_length: 1 }, { path: 'data.steps.0.url', matches: '^\\{\\{engine\\}\\}/health$' }, { path: 'data.validation_rules.data_profile.source', exists: true }, { path: 'data.test_data_ref', exists: true }], description: 'http case' }),
      GET('/api/v1/test-cases/TE-API-APPLICATIONS', { expect_json: [{ path: 'data.steps', min_length: 1 }, { path: 'data.expected_results', exists: true }, { path: 'data.preconditions', exists: true }], description: 'second http case' }),
    ],
  }),
  dq({
    key: 'TE-DQ-ENVIRONMENT-TARGETS', name: 'Environments hold usable targets',
    description: 'A run is pointed at environment.base_url and templates config.vars. The development targets must carry an http(s) base URL, their variables and a known status.',
    steps: [
      GET('/api/v1/environments/sand-bench-local', { expect_json: [{ path: 'data.base_url', matches: '^https?://[^/]+' }, { path: 'data.config.vars.api', matches: '^https?://' }, { path: 'data.status', matches: '^(active|retired)$' }, { path: 'data.env_type', exists: true }], description: 'Sand Bench target' }),
      GET('/api/v1/environments/engine-local', { expect_json: [{ path: 'data.base_url', matches: '^https?://[^/]+' }, { path: 'data.config.vars.engine', matches: '^https?://' }, { path: 'data.config.applications', contains: 'gavriq-test-engine' }], description: 'engine target' }),
    ],
  }),
  dq({
    key: 'TE-DQ-TYPE-METADATA', name: 'Application type metadata is complete',
    description: 'The console builds its navigation from the application\'s type list. Each entry must carry key, label and category.',
    severity: 'medium',
    steps: [GET('/api/v1/ui/summary?application_key=sand-bench', { expect_json: [{ path: 'data.application.types', min_length: 10 }, { path: 'data.application.types.0.key', exists: true }, { path: 'data.application.types.0.label', exists: true }, { path: 'data.application.types.0.category', matches: '^(qa|qc)$' }], description: 'type list' })],
  }),
  dq({
    key: 'TE-DQ-VERSION-HISTORY', name: 'Version number and version history stay in step',
    description: 'After two updates a case must be at version 3 with exactly three snapshots, newest first, each numbered one below the one before.',
    preconditions: PRE.sandbox,
    steps: [
      ...FIXTURES,
      POST('/api/v1/test-cases', { body: { key: `TE-TMP-V-${UNIQ}`, name: `Self-test version case ${UNIQ}`, application_id: '{{fix_app}}' }, expected_status: 201, save: { tmp_id: 'data.id' }, description: 'create' }),
      PUT('/api/v1/test-cases/{{tmp_id}}', { body: { priority: 'p3', updated_by: 'engine-self-test' }, expect_json: [{ path: 'data.version', equals: 2 }], description: 'first update' }),
      PUT('/api/v1/test-cases/{{tmp_id}}', { body: { lifecycle: 'archived', updated_by: 'engine-self-test' }, expect_json: [{ path: 'data.version', equals: 3 }], description: 'second update (archives it)' }),
      GET('/api/v1/test-cases/{{tmp_id}}', { expect_json: [{ path: 'data.version', equals: 3 }, { path: 'data.versions', min_length: 3 }, { path: 'data.versions', max_length: 3 }, { path: 'data.versions.0.version', equals: 3 }, { path: 'data.versions.1.version', equals: 2 }, { path: 'data.versions.2.version', equals: 1 }, { path: 'data.versions.1.change_summary', equals: 'Version 2' }], description: 'history matches' }),
    ],
    dataProfile: SANDBOX_DATA('One temporary case, archived by its last update.'),
    expected: 'version 3 with snapshots 3, 2, 1.',
  }),
  dq({
    key: 'TE-DQ-EVIDENCE-INTEGRITY', name: 'Evidence keeps its bytes and its hash from upload to download',
    description: 'The hash the store computes on upload, the hash recorded on the evidence row, the hash in the run manifest and the downloaded content must all describe the same 52 bytes.',
    severity: 'critical', priority: 'p0', preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      ...RUN_ONE_PASS,
      GET('/api/v1/execution-results/{{result_id}}/evidence', { expect_json: [{ path: 'data.0.metadata.sha256', equals: ARTEFACT.sha256 }, { path: 'data.0.size_bytes', matches: `^"?${ARTEFACT.bytes}"?$` }, { path: 'data.0.storage_key', equals: '{{ev_key}}' }], description: 'evidence row' }),
      GET('/api/v1/runs/{{exec_key}}/evidence', { expect_json: [{ path: 'data.cases.0.evidence.0.sha256', equals: ARTEFACT.sha256 }, { path: 'data.cases.0.evidence.0.type', equals: 'http_transcript' }], description: 'run manifest' }),
      GET('/api/v1/executions/{{exec_id}}/evidence', { expect_json: [{ path: 'data', min_length: 1 }, { path: 'data', max_length: 1 }, { path: 'data.0.result_status', equals: 'passed' }], description: 'execution evidence list' }),
      GET('{{ev_url}}', { expect_json: [{ path: 'selftest', equals: true }, { path: 'note', equals: ARTEFACT.text }], description: 'downloaded content' }),
    ],
    dataProfile: ISOLATED_DATA,
    expected: `sha256 ${ARTEFACT.sha256.slice(0, 12)}… on every path; content unchanged.`,
  }),
  dq({
    key: 'TE-DQ-RUN-TOTALS-ADD-UP', name: 'Run totals add up',
    description: 'Queue an execution of two cases, report one passed and one failed. The run must report cases 2, reported 2, passed 1, failed 1, nothing inconclusive, nothing without evidence, and two evidence items.',
    preconditions: PRE.isolated,
    steps: [
      ...ISOLATED,
      GET(`/api/v1/test-cases/${FIX.second}`, { save: { second_case: 'data.id' }, description: 'second fixture case' }),
      POST('/api/v1/executions', { body: { test_case_ids: ['{{fix_case}}', '{{second_case}}'], environment_id: '{{fix_env}}', trigger_source: 'selftest' }, expected_status: 202, save: { exec_id: 'data.id', exec_key: 'data.key' }, description: 'queue two cases' }),
      POST('/api/v1/executions/claim', { body: { worker_id: GHOST_WORKER }, expect_json: [{ path: 'data.id', equals: '{{exec_id}}' }], description: 'claim' }),
      UPLOAD,
      result('passed', 'engine self-test: first case'),
      POST('/api/v1/executions/{{exec_id}}/results', { body: { test_case_id: '{{second_case}}', status: 'failed', verdict: 'fail', duration_ms: 30, message: 'engine self-test: second case failed', evidence: [{ type: 'http_transcript', storage_key: '{{ev_key}}' }] }, expected_status: 201, expect_json: [{ path: 'data.status', equals: 'failed' }], description: 'second case failed' }),
      complete('failed', 'failed'),
      GET('/api/v1/runs/{{exec_key}}', { expect_json: [{ path: 'data.totals.cases', equals: 2 }, { path: 'data.totals.reported', equals: 2 }, { path: 'data.totals.passed', equals: 1 }, { path: 'data.totals.failed', equals: 1 }, { path: 'data.totals.skipped', equals: 0 }, { path: 'data.totals.inconclusive', equals: 0 }, { path: 'data.totals.without_evidence', equals: 0 }, { path: 'data.totals.evidence_items', equals: 2 }, { path: 'data.executions.0.passed', equals: 1 }, { path: 'data.executions.0.failed', equals: 1 }], description: 'run totals' }),
      GET('/api/v1/ui/executions/{{exec_id}}', { expect_json: [{ path: 'data.results', min_length: 2 }, { path: 'data.results', max_length: 2 }, { path: 'data.cases', min_length: 2 }], description: 'console read model agrees' }),
    ],
    dataProfile: SANDBOX_DATA('One execution of two fixture cases with one artefact referenced by both results.'),
    expected: '2 = 1 passed + 1 failed on every path.',
  }),
  dq({
    key: 'TE-DQ-TIMESTAMPS', name: 'Timestamps are ISO-8601 in UTC',
    description: 'Clients compute durations and "ago" labels from these values. Server clock, case and environment timestamps must all be ISO-8601 with a Z suffix.',
    severity: 'medium',
    steps: [
      GET('/api/v1/ui/live?application_key=gavriq-test-engine', { expect_json: [{ path: 'data.now', matches: `${ISO}.*Z$` }], description: 'server clock' }),
      GET('/api/v1/test-cases/TE-SMOKE-HEALTH', { expect_json: [{ path: 'data.created_at', matches: `${ISO}.*Z$` }, { path: 'data.updated_at', matches: `${ISO}.*Z$` }], description: 'case timestamps' }),
      GET('/api/v1/environments/engine-local', { expect_json: [{ path: 'data.created_at', matches: `${ISO}.*Z$` }], description: 'environment timestamp' }),
    ],
  }),
  dq({
    key: 'TE-DQ-SIT-CATALOG-COUNTS', name: 'SIT catalogue counts match its listing',
    description: 'The SIT catalogue reads case files from disk. It must report the on-disk source, a non-zero number of extracted cases and SIT rows registered in the repository.',
    severity: 'medium',
    steps: [GET('/api/v1/sit-catalog', { expect_json: [{ path: 'data.source', equals: 'sit/cases' }, { path: 'data.counts.files', min: 1 }, { path: 'data.counts.extracted', min: 1 }, { path: 'data.counts.registered', min: 1 }, { path: 'data.files.0.onDisk', equals: true }, { path: 'data.files.0.cases', min_length: 1 }], description: 'sit catalogue' })],
  })
);

export const ENGINE_FUNCTIONAL_CASES: CaseDef[] = C;
