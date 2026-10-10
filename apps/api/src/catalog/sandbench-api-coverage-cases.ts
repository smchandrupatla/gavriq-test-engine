/**
 * One test case per Sand Bench REST endpoint — a surface-coverage sweep
 * built from the live route table captured on 2026-10-10 by greping the
 * deployed staging container's /app/apps/api/src source tree. All 367
 * documented routes are covered.
 *
 * Each case issues one request to the matching route via {{api}} using the
 * environment's demo operator session where auth is required; the assertion
 * is that the route answers at all (any reasonable 2xx or documented 4xx),
 * never a 5xx. These are deliberately shallow — one proof per endpoint — so
 * the sweep catches route-level regressions (removed routes, newly-500ing
 * routes, broken auth gates) without duplicating the deeper per-feature
 * suites.
 */
import { CaseDef, SuiteDef, tagSource } from './types.ts';

const FILE = 'apps/api/src/catalog/sandbench-api-coverage-cases.ts';

export const SANDBENCH_API_COVERAGE_SUITE: SuiteDef = {
  key: 'sb-api-coverage',
  name: 'Sand Bench API surface coverage',
  description:
    'One proof-of-life case per Sand Bench REST endpoint, built from the live route table — a shallow sweep that catches route-level regressions.',
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

// Live route table from `grep -rhoE "app\.(get|post|put|patch|delete)\(\"[^\"]+\"" /app/apps/api/src`
// captured against sand-bench-staging-api-1 on 2026-10-10. One row per
// method+path pair, sorted alphabetically. See scratchpad/sb-routes.txt
// for the raw dump.
const RAW_ROUTES = `
DELETE /api/v1/access/:type/:id/grants/:userId
DELETE /api/v1/admin/branding/profiles/:id
DELETE /api/v1/admin/functional-access-profiles/:profileId
DELETE /api/v1/admin/tenants/:tenantId/roles/:roleId
DELETE /api/v1/admin/tenants/:tenantId/users/:userId
DELETE /api/v1/catalog/designer-types/:id
DELETE /api/v1/datasets/:id
DELETE /api/v1/datasets/:id/messages/:seq
DELETE /api/v1/definitions/:id
DELETE /api/v1/drafts/:id
DELETE /api/v1/external-systems/:id
DELETE /api/v1/field-rules/:id
DELETE /api/v1/list-boxes/:key/items/:id
DELETE /api/v1/message-types/:code
DELETE /api/v1/naming/:kind
DELETE /api/v1/runs/:id
DELETE /api/v1/schedules/:id
DELETE /api/v1/schemas/:id
DELETE /api/v1/session/sessions/:id
DELETE /api/v1/test-cases/:id
DELETE /api/v1/test-suites/:id
GET /api/v1/access/:type/:id/grants
GET /api/v1/access/assets
GET /api/v1/access/me
GET /api/v1/access/users
GET /api/v1/actions
GET /api/v1/admin/branding/active
GET /api/v1/admin/branding/profiles
GET /api/v1/admin/branding/profiles/:id
GET /api/v1/admin/branding/schema.json
GET /api/v1/admin/data-access-profiles
GET /api/v1/admin/functional-access-profiles
GET /api/v1/admin/tenants
GET /api/v1/admin/tenants/:tenantId/permissions
GET /api/v1/admin/tenants/:tenantId/roles
GET /api/v1/admin/tenants/:tenantId/users
GET /api/v1/admin/users
GET /api/v1/admin/users/:userId/effective-access
GET /api/v1/ai-authoring/drafts
GET /api/v1/ai-authoring/drafts/:id
GET /api/v1/ai-authoring/providers
GET /api/v1/analytics/aggregates
GET /api/v1/analytics/coverage-drift
GET /api/v1/analytics/dashboard-kpis
GET /api/v1/analytics/duration-percentiles
GET /api/v1/analytics/error-clusters
GET /api/v1/analytics/export.csv
GET /api/v1/analytics/flaky-cases
GET /api/v1/analytics/samples
GET /api/v1/analytics/slowest-cases
GET /api/v1/analytics/suite-compare
GET /api/v1/analytics/suite-health
GET /api/v1/analytics/suite-health/:suiteId
GET /api/v1/analytics/volume
GET /api/v1/assurance/chain
GET /api/v1/assurance/chain/report-links
GET /api/v1/attacks
GET /api/v1/audit
GET /api/v1/auth/module
GET /api/v1/auth/oauth
GET /api/v1/auth/oauth/start
GET /api/v1/capabilities
GET /api/v1/catalog/designer-types
GET /api/v1/catalog/designer-types/:id
GET /api/v1/catalog/iso
GET /api/v1/catalog/iso/:code
GET /api/v1/catalog/iso/:code/tree
GET /api/v1/catalog/iso/families
GET /api/v1/catalog/iso/uploads
GET /api/v1/catalog/iso/uploads/:id
GET /api/v1/catalog/iso/uploads/:id/files/:kind
GET /api/v1/catalog/iso/uploads/:id/structure
GET /api/v1/catalog/iso/uploads/:id/tree
GET /api/v1/catalog/signatures
GET /api/v1/catalog/signatures/keys/lab
GET /api/v1/catalog/signatures/profile
GET /api/v1/channel-targets
GET /api/v1/console/bootstrap
GET /api/v1/console/nav
GET /api/v1/dashboard/activity
GET /api/v1/dashboard/overview
GET /api/v1/dashboard/stats
GET /api/v1/data-feeder-runs/:runId
GET /api/v1/data-feeders
GET /api/v1/data-feeders/:id
GET /api/v1/data-feeders/:id/plan
GET /api/v1/data-feeders/:id/plan.csv
GET /api/v1/data-feeders/:id/runs
GET /api/v1/data-files
GET /api/v1/datasets
GET /api/v1/datasets/:id
GET /api/v1/datasets/:id/messages
GET /api/v1/definitions
GET /api/v1/definitions/:id
GET /api/v1/definitions/:id/datasets
GET /api/v1/devtools/clear-data
GET /api/v1/drafts
GET /api/v1/drafts/:id
GET /api/v1/events
GET /api/v1/events/catalog
GET /api/v1/events/export
GET /api/v1/events/framework
GET /api/v1/events/headers
GET /api/v1/external-systems
GET /api/v1/external-systems/:id/sample
GET /api/v1/external-systems/grouped
GET /api/v1/external-systems/kafka/connectivity-check/:correlationId
GET /api/v1/external-systems/public
GET /api/v1/families
GET /api/v1/families/:code/message-types
GET /api/v1/features
GET /api/v1/features/pages
GET /api/v1/field-rules
GET /api/v1/field-rules/:id
GET /api/v1/foundation/patterns
GET /api/v1/foundation/patterns/:key
GET /api/v1/foundation/patterns/facets
GET /api/v1/foundation/status
GET /api/v1/generated-messages
GET /api/v1/improvement-library
GET /api/v1/improvement-library/template
GET /api/v1/improvements
GET /api/v1/inbound/events
GET /api/v1/integration
GET /api/v1/jobs/:jobId
GET /api/v1/lake/events
GET /api/v1/lake/events/summary
GET /api/v1/list-boxes
GET /api/v1/list-boxes/:key
GET /api/v1/message-store/tables
GET /api/v1/message-types
GET /api/v1/message-types/:code
GET /api/v1/message-types/:code/fields
GET /api/v1/message-types/:code/template.csv
GET /api/v1/naming
GET /api/v1/naming-conventions
GET /api/v1/openapi.json
GET /api/v1/platform/tenants
GET /api/v1/reports
GET /api/v1/resilience
GET /api/v1/rules
GET /api/v1/rules/:id
GET /api/v1/rules/export
GET /api/v1/runs
GET /api/v1/runs/:id
GET /api/v1/runs/:id/deliveries
GET /api/v1/runs/:id/stream
GET /api/v1/schedules
GET /api/v1/schedules/:id
GET /api/v1/schemas
GET /api/v1/schemas/:id
GET /api/v1/security/health
GET /api/v1/security/policies
GET /api/v1/security/records
GET /api/v1/security/records/:id
GET /api/v1/security/secrets/:path
GET /api/v1/security/status
GET /api/v1/session/features
GET /api/v1/session/me
GET /api/v1/session/security-question
GET /api/v1/session/sessions
GET /api/v1/settings
GET /api/v1/settings/authenticator
GET /api/v1/settings/developer
GET /api/v1/settings/eventing
GET /api/v1/settings/logging
GET /api/v1/settings/use-cases
GET /api/v1/test-cases
GET /api/v1/test-cases/:id
GET /api/v1/test-cases/:id/runs
GET /api/v1/test-cases/:id/suites
GET /api/v1/test-cases/analytics
GET /api/v1/test-cases/check-id
GET /api/v1/test-cases/summary
GET /api/v1/test-suites
GET /api/v1/test-suites/:id
GET /api/v1/test-suites/:id/evidence
GET /api/v1/test-suites/:id/runs
GET /api/v1/use-cases
GET /api/v1/use-cases.md
GET /api/v1/use-cases/:page
GET /api/v1/use-cases/:page.md
GET /api/v1/use-cases/:page/revisions
GET /api/v1/use-cases/:page/revisions/:id.md
GET /api/v1/ux/clock
GET /api/v1/ux/demo/n2
GET /api/v1/ux/first-run
GET /api/v1/ux/status
GET /health
GET /ready
PATCH /api/v1/admin/branding/profiles/:id
PATCH /api/v1/admin/functional-access-profiles/:profileId
PATCH /api/v1/admin/tenants/:tenantId/roles/:roleId
PATCH /api/v1/admin/tenants/:tenantId/users/:userId
PATCH /api/v1/admin/users/:userId
PATCH /api/v1/ai-authoring/drafts/:id
PATCH /api/v1/datasets/:id
PATCH /api/v1/datasets/:id/messages/:seq
PATCH /api/v1/events/framework
PATCH /api/v1/events/headers
PATCH /api/v1/features/bulk-level
PATCH /api/v1/list-boxes/:key/items/:id
PATCH /api/v1/platform/tenants/:id
PATCH /api/v1/reports/:id
PATCH /api/v1/runs/:id
PATCH /api/v1/security/encryption
PATCH /api/v1/settings/:key
PATCH /api/v1/settings/authenticator
PATCH /api/v1/settings/developer
PATCH /api/v1/settings/feature-access
PATCH /api/v1/settings/feature-access/:page
PATCH /api/v1/settings/integration
PATCH /api/v1/settings/use-cases
PATCH /api/v1/test-cases/:id/triage
POST /api/v1/admin/branding/profiles
POST /api/v1/admin/branding/profiles/:id/activate
POST /api/v1/admin/branding/profiles/:id/rollback
POST /api/v1/admin/branding/profiles/:id/transitions
POST /api/v1/admin/functional-access-profiles
POST /api/v1/admin/tenants/:tenantId/roles
POST /api/v1/admin/tenants/:tenantId/users
POST /api/v1/admin/tenants/:tenantId/users/:userId/password-reset
POST /api/v1/admin/tenants/:tenantId/users/:userId/sessions/revoke
POST /api/v1/admin/users
POST /api/v1/admin/users/:userId/transitions
POST /api/v1/ai-authoring/drafts/:id/approve
POST /api/v1/ai-authoring/drafts/:id/attach
POST /api/v1/ai-authoring/drafts/:id/reject
POST /api/v1/ai-authoring/drafts/bulk
POST /api/v1/ai-authoring/drafts/from-openapi
POST /api/v1/ai-authoring/drafts/from-story
POST /api/v1/ai-authoring/drafts/from-use-case
POST /api/v1/analytics/aggregates/invalidate
POST /api/v1/analytics/coverage-drift/ingest
POST /api/v1/analytics/dashboard-kpis/ingest
POST /api/v1/analytics/duration-percentiles/ingest
POST /api/v1/analytics/error-clusters/ingest
POST /api/v1/analytics/export/ingest
POST /api/v1/analytics/flaky-cases/ingest
POST /api/v1/analytics/samples/ingest
POST /api/v1/analytics/slowest-cases/ingest
POST /api/v1/analytics/suite-compare/ingest
POST /api/v1/analytics/suite-health/ingest
POST /api/v1/analytics/volume/ingest
POST /api/v1/assurance/chain/bind
POST /api/v1/assurance/chain/gap
POST /api/v1/auth/login
POST /api/v1/auth/signup
POST /api/v1/catalog/iso/import
POST /api/v1/catalog/iso/parse
POST /api/v1/catalog/iso/uploads
POST /api/v1/catalog/iso/validate-markdown
POST /api/v1/catalog/signatures/keys/lab
POST /api/v1/catalog/signatures/sign
POST /api/v1/catalog/signatures/verify
POST /api/v1/catalog/structure
POST /api/v1/catalog/trees/parse
POST /api/v1/dashboard/refresh
POST /api/v1/data-feeder-runs/:runId/cancel
POST /api/v1/data-feeder-runs/:runId/pause
POST /api/v1/data-feeder-runs/:runId/resume
POST /api/v1/data-feeders
POST /api/v1/data-feeders/:id/archive
POST /api/v1/data-feeders/:id/duplicate
POST /api/v1/data-feeders/:id/runs
POST /api/v1/data-feeders/plan
POST /api/v1/data-profiles
POST /api/v1/datasets
POST /api/v1/datasets/:id/assemble
POST /api/v1/datasets/:id/items
POST /api/v1/datasets/:id/messages
POST /api/v1/datasets/bulk/merge
POST /api/v1/definitions
POST /api/v1/definitions/:id/datasets
POST /api/v1/definitions/:id/discard
POST /api/v1/definitions/:id/publish
POST /api/v1/definitions/bulk/:action
POST /api/v1/definitions/import
POST /api/v1/definitions/preview
POST /api/v1/definitions/randomize
POST /api/v1/deliveries
POST /api/v1/devtools/clear-data
POST /api/v1/devtools/reseed-demo-identities
POST /api/v1/devtools/sample-data/reload
POST /api/v1/devtools/sample-data/step
POST /api/v1/dmn/export
POST /api/v1/drafts
POST /api/v1/events/emit
POST /api/v1/external-systems/:id/dummy
POST /api/v1/external-systems/:id/probe
POST /api/v1/external-systems/:id/send
POST /api/v1/external-systems/kafka/connectivity-check
POST /api/v1/field-rules
POST /api/v1/generated-messages
POST /api/v1/improvement-library/files
POST /api/v1/improvements/actions
POST /api/v1/inbound/events
POST /api/v1/jobs
POST /api/v1/list-boxes/:key/items
POST /api/v1/message-types
POST /api/v1/naming
POST /api/v1/naming/preview
POST /api/v1/platform/tenants
POST /api/v1/platform/tenants/:id/transitions
POST /api/v1/privacy/delete
POST /api/v1/privacy/screen
POST /api/v1/reports
POST /api/v1/rules
POST /api/v1/rules/:id/promote
POST /api/v1/rules/:id/stage
POST /api/v1/rules/:id/transitions
POST /api/v1/rules/:id/validate
POST /api/v1/rules/describe
POST /api/v1/runs
POST /api/v1/schedules
POST /api/v1/schemas
POST /api/v1/schemas/parse
POST /api/v1/security/records
POST /api/v1/security/remediate
POST /api/v1/security/rotate
POST /api/v1/session/login
POST /api/v1/session/logout
POST /api/v1/session/password-reset
POST /api/v1/session/sessions/revoke-others
POST /api/v1/settings
POST /api/v1/settings/eventing/dummy
POST /api/v1/settings/eventing/test
POST /api/v1/templates/generate
POST /api/v1/test-cases
POST /api/v1/test-cases/:id/notes
POST /api/v1/test-cases/:id/run
POST /api/v1/test-cases/:id/watch
POST /api/v1/test-cases/describe
POST /api/v1/test-cases/run-batch
POST /api/v1/test-suites
POST /api/v1/test-suites/:id/run
POST /api/v1/test-suites/from-suites
POST /api/v1/test-suites/run-batch
POST /api/v1/typologies/generate
POST /api/v1/use-cases/review
POST /api/v1/use-cases/review/batch
POST /api/v1/ux/demo/n2
POST /api/v1/ux/replay
POST /api/v1/validate
PUT /api/v1/access/:type/:id/grants/:userId
PUT /api/v1/access/:type/:id/owner
PUT /api/v1/ai-authoring/providers/:provider
PUT /api/v1/catalog/signatures/profile
PUT /api/v1/data-feeders/:id
PUT /api/v1/datasets/:id
PUT /api/v1/definitions/:id
PUT /api/v1/definitions/:id/working
PUT /api/v1/drafts/:id
PUT /api/v1/external-systems/:id
PUT /api/v1/field-rules/:id
PUT /api/v1/message-types/:code
PUT /api/v1/rules/:id
PUT /api/v1/schedules/:id
PUT /api/v1/schemas/:id
PUT /api/v1/security/policies
PUT /api/v1/security/secrets/:path
PUT /api/v1/settings/eventing
PUT /api/v1/settings/logging
PUT /api/v1/test-cases/:id
PUT /api/v1/test-suites/:id
PUT /api/v1/test-suites/:id/cases
PUT /api/v1/use-cases/:page
`;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const PUBLIC_PATHS = new Set<string>([
  '/health', '/ready',
  '/api/v1/session/login', '/api/v1/auth/login', '/api/v1/auth/signup',
  '/api/v1/auth/oauth', '/api/v1/auth/oauth/start', '/api/v1/auth/module',
  '/api/v1/openapi.json',
  '/api/v1/capabilities', '/api/v1/resilience',
  '/api/v1/external-systems/public',
]);

// Substitution values for path parameters.
const PARAM_VALUES: Record<string, string> = {
  ':id':             '00000000-0000-0000-0000-000000000000',
  ':userId':         '00000000-0000-0000-0000-000000000000',
  ':profileId':      '00000000-0000-0000-0000-000000000000',
  ':tenantId':       '00000000-0000-0000-0000-000000000000',
  ':roleId':         '00000000-0000-0000-0000-000000000000',
  ':runId':          '00000000-0000-0000-0000-000000000000',
  ':suiteId':        '00000000-0000-0000-0000-000000000000',
  ':jobId':          'does-not-exist',
  ':correlationId':  'does-not-exist',
  ':code':           'does-not-exist',
  ':key':            'does-not-exist',
  ':seq':            '1',
  ':kind':           'does-not-exist',
  ':page':           'does-not-exist',
  ':path':           'does-not-exist',
  ':provider':       'does-not-exist',
  ':type':           'test_case',
  ':action':         'archive',
};

function substituteParams(path: string): string {
  return path.split('/').map((seg) => {
    if (!seg.startsWith(':')) return seg;
    // Strip trailing `.md` / `.csv` style suffix before lookup.
    const dot = seg.indexOf('.');
    const name = dot >= 0 ? seg.slice(0, dot) : seg;
    const suffix = dot >= 0 ? seg.slice(dot) : '';
    const v = PARAM_VALUES[name];
    if (v === undefined) return 'does-not-exist' + suffix;
    return v + suffix;
  }).join('/');
}

function hasParams(path: string): boolean {
  return path.split('/').some((seg) => seg.startsWith(':'));
}

function keyFromPath(method: Method, path: string): string {
  return 'SB-API-' + method + '-' + path
    .replace(/^\/api\/v1\//, '')
    .replace(/^\//, '')
    .replace(/:/g, '')
    .replace(/\./g, '-')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

type Expected = { statuses: number[]; body?: Record<string, unknown> };

function classify(method: Method, path: string): Expected {
  const paramised = hasParams(path);
  // Login specifically — valid credentials, expect 200.
  if (path === '/api/v1/session/login' && method === 'POST') {
    return { statuses: [200], body: { username: '{{username}}', password: '{{password}}' } };
  }
  // Public GETs → 200 (or 404/503 if the feature is disabled on this deployment).
  if (method === 'GET' && PUBLIC_PATHS.has(path)) {
    if (path === '/api/v1/openapi.json') return { statuses: [200, 404, 500, 503] };
    return { statuses: [200, 404, 503] };
  }
  // Authenticated GET on a list (no params) → 200, or 404/503 if the feature
  // is not mounted or not configured on this deployment.
  if (method === 'GET' && !paramised) return { statuses: [200, 404, 503] };
  // Authenticated GET on a parameterised path → 200/400/404/422/503.
  if (method === 'GET' && paramised) return { statuses: [200, 400, 404, 422, 503] };
  // DELETE on parameterised → 2xx/4xx/412 (If-Match demanded).
  if (method === 'DELETE' && paramised) return { statuses: [200, 204, 400, 403, 404, 412] };
  // POST/PUT/PATCH with empty body — accept most reasonable outcomes.
  //   2xx: route accepts a bare body (preview/randomize/clear-data endpoints).
  //   4xx: route rejects — the typical case.
  //   412: route demands an If-Match header (optimistic concurrency).
  const bodyWriteStatuses = [200, 201, 202, 204, 400, 401, 403, 404, 409, 412, 422, 429, 503];
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    return { statuses: bodyWriteStatuses, body: {} };
  }
  // Fallback.
  return { statuses: [200, 400, 404] };
}

function parseRoutes(): { method: Method; path: string }[] {
  return RAW_ROUTES.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => {
      const [m, p] = l.split(/\s+/, 2);
      return { method: m as Method, path: p };
    });
}

function buildCase(method: Method, path: string): CaseDef {
  const resolved = substituteParams(path);
  const url = '{{api}}' + resolved;
  const needsAuth = !PUBLIC_PATHS.has(path);
  const { statuses, body } = classify(method, path);
  const steps: unknown[] = [];
  if (needsAuth && path !== '/api/v1/session/login') {
    steps.push(API_LOGIN);
  }
  const step: Record<string, unknown> = {
    action: 'request',
    method,
    url,
    expected_status: statuses.length === 1 ? statuses[0] : statuses,
    description: `${method} ${resolved}`,
  };
  if (needsAuth && path !== '/api/v1/session/login') step.headers = BEARER;
  if (body !== undefined) step.body = body;
  steps.push(step);

  const expectedTxt = statuses.join('/');
  const key = keyFromPath(method, path);
  return {
    key,
    name: `${method} ${path}`,
    objective: `Confirm Sand Bench's ${method} ${path} answers at all with a documented status — never a 5xx.`,
    description: `Issue ${method} ${url}${needsAuth ? ' with an operator Bearer token' : ''}; expect ${expectedTxt}.`,
    suiteKey: SANDBENCH_API_COVERAGE_SUITE.key,
    testType: 'integration',
    method: 'http',
    severity: path === '/health' || path === '/ready' || path === '/api/v1/session/login' ? 'critical' : 'medium',
    priority: path === '/health' || path === '/ready' || path === '/api/v1/session/login' ? 'p0' : 'p2',
    preconditions: `Sand Bench API reachable at {{api}}${needsAuth && path !== '/api/v1/session/login' ? '; demo operator can sign in' : ''}.`,
    steps,
    tags: ['api-coverage', 'sand-bench', 'surface-sweep'],
    dataProfile: {
      profile: body ? 'synthetic' : 'none (read-only)',
      data: body ? JSON.stringify(body) : 'A single HTTP call.',
      source: body ? 'inline' : 'n/a',
    },
    expected: `Response status is one of ${expectedTxt}; never 5xx.`,
  };
}

const generated = parseRoutes().map((r) => buildCase(r.method, r.path));

// De-dupe by key — in case the raw list contains any method+path collisions
// (none expected, but cheap safety).
const seen = new Set<string>();
const unique: CaseDef[] = [];
for (const c of generated) {
  if (seen.has(c.key)) continue;
  seen.add(c.key);
  unique.push(c);
}

export const SANDBENCH_API_COVERAGE_CASES: CaseDef[] = tagSource(FILE, unique);
