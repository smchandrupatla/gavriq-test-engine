/**
 * One test case per Sand Bench REST endpoint — a surface-coverage sweep built
 * from the route table of the DEPLOYED build.
 *
 * The table is not typed in here. scripts/sandbench-route-baseline.mts reads
 * every route registration out of the deployed commit's source, asks the
 * deployed API who may call each one (nobody signed in, an operator, the
 * administrator) and writes ./sandbench-route-baseline.json. After a deploy
 * that adds, removes or re-protects routes, rerun that script and reseed: new
 * routes become new cases, removed routes are archived by the seeder, and a
 * route that moved behind the administrator is called as the administrator.
 *
 * What a correct answer is does NOT come from that probe. It comes from the
 * kind of route (apiCoverageExpectation below): a list must answer 200, an
 * unknown reference must be refused without a server error, an anonymous write
 * must be refused with exactly 401. A route that answers outside its kind's
 * statuses fails its case — it is never baselined as "expected".
 *
 * Reads use an authenticated session where required. Protected writes check
 * their sign-in boundary without a token: an empty body is not safe setup,
 * since some routes reset configuration, rotate keys, clear data or create
 * default records. Successful writes and validation are exercised by the
 * feature cases with their own fixtures and cleanup. These write probes prove
 * access control; a deny-by-default gateway can also reject an unregistered
 * path, so they do not claim positive route or feature coverage.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type CaseDef, type SuiteDef, tagSource } from './types.js';
import { describeTarget } from './plain-language.js';

const FILE = 'apps/api/src/catalog/sandbench-api-coverage-cases.ts';

export const SANDBENCH_API_COVERAGE_SUITE: SuiteDef = {
  key: 'sb-api-coverage',
  name: 'Sand Bench API surface coverage',
  description:
    'One proof-of-life case per Sand Bench REST endpoint, built from the route table of the deployed build — a shallow sweep that catches route-level regressions.',
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
// The application's one administrator-equivalent account. The seeder marks this
// sign-in as shared (catalog/sandbench-identity.ts), so a run opens one
// administrator session per worker, not one per case.
const ADMIN_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { username: '{{admin_username}}', password: '{{admin_password}}' },
  expected_status: 200, save: { adminToken: 'token' },
  description: 'administrator login',
} as const;
const ADMIN_BEARER = { authorization: 'Bearer {{adminToken}}' };

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Who may call a route, as the deployed API answered the baseline script:
 *   public     answers a caller who is not signed in
 *   operator   needs a session; an ordinary operator's is enough
 *   admin      refuses an operator; needs the administrator
 *   signed-in  a write that refuses an anonymous caller with 401 (who may then
 *              perform it is the feature cases' business, not this sweep's)
 *   nobody     refused even for the administrator (e.g. a machine-key route)
 */
export type RouteAccess = 'public' | 'operator' | 'admin' | 'signed-in' | 'nobody';
export interface RouteRow { method: Method; path: string; access: RouteAccess }

const BASELINE_FILE = fileURLToPath(new URL('./sandbench-route-baseline.json', import.meta.url));
const BASELINE: { source_commit?: string; routes: RouteRow[] } = existsSync(BASELINE_FILE)
  ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
  : { routes: [] };

/** The deployed commit the route table was read from. */
export const SANDBENCH_ROUTE_BASELINE_COMMIT = BASELINE.source_commit || '';

// These routes deliberately accept anonymous callers in the test baseline.
// An empty request is rejected before a password or inbound record can change.
// Keep this method-specific: GET /inbound/events still needs a live session.
const PUBLIC_INVALID_WRITES: Record<string, string> = {
  'POST /api/v1/session/password-reset': 'username, securityAnswer and newPassword are required',
  'POST /api/v1/inbound/events': 'channel is required',
};

// Optional sign-in providers: reachable, but may be switched off on a deployment.
const OPTIONAL_PROVIDER_PATHS = new Set(['/api/v1/auth/oauth', '/api/v1/auth/oauth/start']);

// Lists that cannot answer without a query the sweep does not send. The documented
// refusal is the contract here, and it is asserted exactly — status, code and message.
const REQUIRED_QUERY: Record<string, { status: number; message: string }> = {
  'GET /api/v1/analytics/env-compare': { status: 400, message: 'suiteId is required' },
  'GET /api/v1/analytics/suite-compare': { status: 400, message: 'leftSuiteId and rightSuiteId are required' },
  'GET /api/v1/rules/field-catalog': { status: 422, message: 'Give definitionId or messageTypeCode' },
  'GET /api/v1/test-coverage/waivers/export': { status: 422, message: 'Say which repository to export waivers for.' },
};

// Lists backed by an integration a deployment may leave unconfigured. Such a
// deployment answers with its documented "not configured" refusal instead of the
// list. Either answer passes, but the refusal is held to its own contract
// (expect_by_status), so an unrelated 503/404 on the same route still fails.
const OPTIONAL_INTEGRATIONS: Record<string, { status: number; code: string; message: string }> = {
  'GET /api/v1/improvements': { status: 503, code: 'not_ready', message: 'Improvements Log is not configured' },
  'GET /api/v1/lake/events': { status: 404, code: 'not_found', message: 'event lake is not configured' },
  'GET /api/v1/lake/events/summary': { status: 404, code: 'not_found', message: 'event lake is not configured' },
};

// Routes that read a whole library from disk and can take several seconds to answer.
const SLOW_ROUTE_TIMEOUT_SECONDS: Record<string, number> = {
  'GET /api/v1/improvement-library': 60,
};

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

/** The path a route is probed at: every parameter replaced by a reference that does not exist. */
export function apiCoverageProbePath(_method: Method, path: string): string {
  return substituteParams(path);
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
  // Optional sign-in providers → 200, or 404/503 if switched off on this deployment.
  if (method === 'GET' && OPTIONAL_PROVIDER_PATHS.has(path)) return { statuses: [200, 404, 503] };
  // A documented list route must actually be mounted and ready.
  if (method === 'GET' && !paramised) return { statuses: [200] };
  // A nonexistent reference must be handled without a server error.
  if (method === 'GET' && paramised) return { statuses: [200, 400, 404, 422] };
  // Writes against a parameterised probe id (we substitute :id with
  // 00000000-...): the route MUST refuse, since atomicity would be broken by
  // accidentally mutating the probe row. If a route accepts 2xx against the
  // zero-UUID, that is a real defect — not a tolerated outcome.
  if (method === 'DELETE' && paramised) return { statuses: [400, 403, 404, 412] };
  if ((method === 'PUT' || method === 'PATCH') && paramised) {
    return { statuses: [400, 401, 403, 404, 409, 412, 422], body: {} };
  }
  // POST on a parameterised path (`/parent/:id/children`) with the probe id
  // as parent: parent does not exist → the route must refuse.
  if (method === 'POST' && paramised) {
    return { statuses: [400, 401, 403, 404, 409, 412, 422], body: {} };
  }
  // POST/PUT/PATCH on a top-level path with an empty body. A persisting
  // creation endpoint should reject the empty payload for missing required
  // fields — any 2xx against `body: {}` would leave a persisted record and
  // break atomicity. Known non-persisting suffixes (preview, randomize,
  // dryrun, dummy, invalidate, validate, parse, connectivity-check, health,
  // ping, export, clear-data, randomise) legitimately return 2xx on empty
  // bodies; everything else is restricted to 4xx-only.
  // Non-persisting POST suffixes must appear as the LAST path segment —
  // `/analytics/export/ingest` is a persist (the leaf is `ingest`), not an
  // export, so a middle `/export/` doesn't qualify.
  const nonPersistingPost = /\/(preview|randomize|randomise|dryrun|dry-run|simulate|dummy|invalidate|validate|parse|connectivity-check|health|ping|clear-data|clear|export|logout)$/i;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    if (nonPersistingPost.test(path)) {
      return { statuses: [200, 201, 202, 204, 400, 401, 403, 404, 409, 412, 422, 429, 503], body: {} };
    }
    return { statuses: [400, 401, 403, 404, 409, 412, 422, 429, 503], body: {} };
  }
  // Fallback.
  return { statuses: [200, 400, 404] };
}

/**
 * The statuses a route's case accepts, decided by the KIND of route — never by
 * what a deployment happened to answer. The baseline script uses the same
 * function to list routes that answer outside it.
 */
export function apiCoverageExpectation(row: RouteRow): Expected {
  const route = `${row.method} ${row.path}`;
  if (PUBLIC_INVALID_WRITES[route]) return { statuses: [422], body: {} };
  if (REQUIRED_QUERY[route]) return { statuses: [REQUIRED_QUERY[route]!.status] };
  if (OPTIONAL_INTEGRATIONS[route]) return { statuses: [200, OPTIONAL_INTEGRATIONS[route]!.status] };
  // A protected write is probed without a session: exactly 401, before any change is made.
  if (row.method !== 'GET' && row.access === 'signed-in') return { statuses: [401], body: {} };
  return classify(row.method, row.path);
}

function buildCase(row: RouteRow): CaseDef {
  const { method, path, access } = row;
  const resolved = substituteParams(path);
  const url = '{{api}}' + resolved;
  const invalidPublicMessage = PUBLIC_INVALID_WRITES[`${method} ${path}`];
  const authBoundary = method !== 'GET' && access === 'signed-in';
  const asAdmin = method === 'GET' && (access === 'admin' || access === 'nobody');
  const asOperator = method === 'GET' && access === 'operator';
  const isLogin = path === '/api/v1/session/login' && method === 'POST';
  const { statuses, body } = apiCoverageExpectation(row);
  const steps: unknown[] = [];
  if (asOperator) steps.push(API_LOGIN);
  if (asAdmin) steps.push(ADMIN_LOGIN);
  const step: Record<string, unknown> = {
    action: 'request',
    method,
    url,
    expected_status: statuses.length === 1 ? statuses[0] : statuses,
    description: `${method} ${resolved}`,
  };
  if (asOperator) step.headers = BEARER;
  if (asAdmin) step.headers = ADMIN_BEARER;
  if (body !== undefined) step.body = body;
  if (invalidPublicMessage) step.expect_json = [
    { path: 'error.code', equals: 'validation_failed' },
    { path: 'error.message', equals: invalidPublicMessage },
  ];
  const requiredQuery = REQUIRED_QUERY[`${method} ${path}`];
  if (requiredQuery) step.expect_json = [
    { path: 'error.code', equals: 'validation_failed' },
    { path: 'error.message', equals: requiredQuery.message },
  ];
  const optional = OPTIONAL_INTEGRATIONS[`${method} ${path}`];
  if (optional) step.expect_by_status = {
    [String(optional.status)]: { expect_json: [
      { path: 'error.code', equals: optional.code },
      { path: 'error.message', contains: optional.message },
    ] },
  };
  steps.push(step);

  const expectedTxt = statuses.join('/');
  const key = keyFromPath(method, path);
  const slowTimeout = SLOW_ROUTE_TIMEOUT_SECONDS[`${method} ${path}`];
  const operation = { GET: 'read', POST: 'send a request to', PUT: 'replace', PATCH: 'update', DELETE: 'remove a record from' }[method];
  const who = asAdmin ? 'the administrator' : 'a caller';
  const signedInAs = asAdmin ? ' with the administrator\'s Bearer token' : asOperator ? ' with an operator Bearer token' : '';
  return {
    key,
    name: invalidPublicMessage ? `Incomplete ${path.endsWith('password-reset') ? 'password reset' : 'inbound event'} requests are rejected` : authBoundary ? `Sign-in is required to ${operation} ${describeTarget(url)}` : `${method} ${path}`,
    objective: invalidPublicMessage
      ? `Confirm the public ${path.endsWith('password-reset') ? 'password reset' : 'inbound event'} entry point rejects missing information before it changes application data.`
      : authBoundary
      ? `Confirm a visitor must sign in before being allowed to ${operation} ${describeTarget(url)}, so an anonymous request cannot change application data.`
      : requiredQuery
      ? `Confirm that asking to ${operation} ${describeTarget(url)} without saying what to look up is turned away with a clear explanation instead of an error or an empty answer.`
      : optional
      ? `Check that ${who} can ${operation} ${describeTarget(url)}, or — where this installation has not set that feature up — is told so plainly instead of getting an error.`
      : `Check the documented response when ${who} asks to ${operation} ${describeTarget(url)}${hasParams(path) ? ' using a reference that does not exist' : ''}, so broken requests are detected.`,
    description: `Issue ${method} ${url}${authBoundary ? ' without a token; require exactly 401 before any change is made' : signedInAs}; expect ${expectedTxt}${requiredQuery ? ` with error.code validation_failed and the message "${requiredQuery.message}"` : ''}${optional ? ` (${optional.status} only as the documented refusal: error.code ${optional.code}, "${optional.message}")` : ''}. Feature cases cover successful writes with case-owned setup and cleanup.`,
    suiteKey: SANDBENCH_API_COVERAGE_SUITE.key,
    testType: 'integration',
    method: 'http',
    severity: path === '/health' || path === '/ready' || isLogin ? 'critical' : 'medium',
    priority: path === '/health' || path === '/ready' || isLogin ? 'p0' : 'p2',
    preconditions: `Sand Bench API reachable at {{api}}${asAdmin ? '; the administrator can sign in' : asOperator || isLogin ? '; an operator can sign in' : ''}. This surface probe is read-only with respect to business data.`,
    steps,
    ...(slowTimeout ? { timeoutSeconds: slowTimeout } : {}),
    tags: ['api-coverage', 'sand-bench', 'surface-sweep', ...(authBoundary ? ['auth-boundary'] : []), ...(asAdmin ? ['administrator'] : []), ...(invalidPublicMessage || requiredQuery ? ['validation-boundary'] : [])],
    dataProfile: {
      profile: body ? 'synthetic' : 'none (read-only)',
      data: body ? JSON.stringify(body) : 'A single HTTP call.',
      source: body ? 'inline' : 'n/a',
    },
    expected: `Response status is one of ${expectedTxt}${statuses.includes(503) ? '; an explicitly disabled optional sign-in provider may report unavailable' : '; server errors fail'}.`,
  };
}

const generated = BASELINE.routes.map((r) => buildCase(r));

// De-dupe by key — in case the table contains any method+path collisions
// (none expected, but cheap safety).
const seen = new Set<string>();
const unique: CaseDef[] = [];
for (const c of generated) {
  if (seen.has(c.key)) continue;
  seen.add(c.key);
  unique.push(c);
}

export const SANDBENCH_API_COVERAGE_CASES: CaseDef[] = tagSource(FILE, unique);
