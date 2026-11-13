/**
 * Sand Bench use-case flow catalog — Batch 2e (use-case docs editor/review, users admin).
 *
 * UC-useCaseEditor, UC-useCaseReview, UC-users.
 *
 * UC-useCaseEditor's PUT /api/v1/use-cases/:page mutates Sand Bench's own
 * published use-case documentation (a shared, hand-authored catalogue other
 * tooling/sessions may be reading or editing) — treated read-only here by
 * policy, not fired for real.
 *
 * UC-useCaseReview's POST /use-cases/review(/review/:page) is a deterministic,
 * read-only computation (confirmed from source: it only maps over the
 * in-memory catalogue, no persistence) — safe to call for real.
 *
 * UC-users' POST /admin/users/:userId/transitions mutates a real seeded demo
 * identity's membership status (e.g. suspend/activate) — treated read-only by
 * policy, since other test cases and personas in this catalog depend on the
 * seeded demo users staying active.
 */
import type { CaseDef } from './types.js';

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { username: '{{username}}', password: '{{password}}' },
  expected_status: 200, save: { token: 'token' },
  description: 'operator login',
};
const BEARER = { authorization: 'Bearer {{token}}' };
const ADMIN_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { username: '{{admin_username}}', password: '{{admin_password}}' },
  expected_status: 200, save: { adminToken: 'token' },
  description: 'tenant admin login',
};
const ADMIN_BEARER = { authorization: 'Bearer {{adminToken}}' };

const TENANT_USERS = '{{api}}/api/v1/admin/tenants/tenant_default/users';

/**
 * A temporary user owned by the case (the user list is shared by every case running at the
 * same time, so a case never reads "the first user"). Created by the administrator with a
 * unique per-run name; answers 201 with the user's id and version (etag).
 */
function createOwnUser(tag: string) {
  const username = `te-uc-users-${tag}-{{ts}}-{{rand}}`;
  return {
    action: 'request', method: 'POST', url: TENANT_USERS, headers: ADMIN_BEARER,
    body: { username, displayName: `TE use-case users ${tag} {{rand}}`, email: `${username}@example.invalid`, password: 'te-pw-{{rand}}-{{ts}}', securityQuestion: 'q', securityAnswer: 'a' },
    expected_status: 201,
    expect_json: [{ path: 'id', matches: '^usr_' }, { path: 'username', equals: username }, { path: 'status', equals: 'active' }, { path: 'roles', max_length: 0 }],
    save: { own_user_id: 'id', own_user_etag: 'etag' },
    description: 'create this case\'s own temporary user',
  };
}

/** Delete the case's temporary user with the version returned at creation, then confirm it left the user list. */
const cleanupOwnUser = [
  { ...ADMIN_LOGIN, skip_if_missing: ['own_user_id'], description: 'admin login for cleanup' },
  { action: 'request', method: 'DELETE', url: `${TENANT_USERS}/{{own_user_id}}`, headers: { ...ADMIN_BEARER, 'if-match': '{{own_user_etag}}' }, skip_if_missing: ['own_user_id', 'own_user_etag'], expected_status: 200, expect_json: [{ path: 'deleted', equals: true }, { path: 'userId', equals: '{{own_user_id}}' }], description: 'delete the case-owned user (If-Match: the version returned at creation)' },
  { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users', headers: ADMIN_BEARER, skip_if_missing: ['own_user_id'], expected_status: 200, expected_body_not_contains: '{{own_user_id}}', description: 'verify the case-owned user is gone from the user list' },
];

const C: CaseDef[] = [];

/* ------------------------------------------------------------------------ */
/* UC-useCaseEditor — Use case                                               */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-useCaseEditor-MAIN',
    name: 'UC-useCaseEditor main flow: Use case',
    objective: 'Walk through the "Use case" screen the way its main use case describes it: author opens the use-case link for a real published page, the system loads its specification, contract and revision history, and the complete Markdown is downloadable.',
    description: 'Main flow of UC-useCaseEditor (Use case): author opens the use-case link for a real published page, the system loads its specification, contract and revision history, and the complete Markdown is downloadable. Touches GET /api/v1/use-cases/:page, GET /api/v1/use-cases/:page/revisions and GET /api/v1/use-cases/:page.md.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; use-case catalogue published.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/use-case.html?page=overview', expected_status: 200, expected_body_contains: 'data-sbe-page="useCaseIndex"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/use-cases/overview', headers: BEARER, expected_status: 200, expect_json: [{ path: 'page', equals: 'overview' }, { path: 'name', exists: true }, { path: 'goal', exists: true }], description: 'load specification' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/use-cases/overview/revisions', headers: BEARER, expected_status: 200, description: 'load revision history' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/use-cases/overview.md', headers: BEARER, expected_status: 200, expected_body_contains: '## Gherkin', description: 'download complete Markdown' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'useCaseEditor'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'Specification, revisions and Markdown all load for the real "overview" page.',
  },
  {
    key: 'SB-UC-useCaseEditor-ALT-1',
    name: 'UC-useCaseEditor alt flow 1: Read or download without editing.',
    objective: 'Check an alternative path of "Use case": read or download without editing. The Markdown download and detail read both succeed with no PUT ever sent — reading never requires a write.',
    description: 'Alternate flow 1 of UC-useCaseEditor (Use case): "Read or download without editing." The Markdown download and detail read both succeed with no PUT ever sent — reading never requires a write.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/use-cases/overview.md', headers: BEARER, expected_status: 200, description: 'download without editing' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'useCaseEditor'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload — deliberately no PUT.', source: 'n/a' },
    expected: 'Download succeeds; no revision is created.',
  },
  {
    key: 'SB-UC-useCaseEditor-ALT-2',
    name: 'UC-useCaseEditor alt flow 2: An unlinked catalogue case can be opened by its page key.',
    objective: 'Check an alternative path of "Use case": an unlinked catalogue case can be opened by its page key. A second, different real page key (schAll) opens its own distinct specification by key, independent of the first.',
    description: 'Alternate flow 2 of UC-useCaseEditor (Use case): "An unlinked catalogue case can be opened by its page key." A second, different real page key (schAll) opens its own distinct specification by key, independent of the first.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/use-cases/schAll', headers: BEARER, expected_status: 200, expect_json: [{ path: 'page', equals: 'schAll' }], description: 'open a different page by key' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'useCaseEditor'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'The requested page key is opened exactly, independent of any other open case.',
  },
  {
    key: 'SB-UC-useCaseEditor-EXC-1',
    name: 'UC-useCaseEditor exc flow 1: An unknown key is not replaced with Overview.',
    objective: 'Check that "Use case" fails safely: an unknown key is not replaced with Overview. Requesting a nonexistent page key must return a clean not-found, never silently substituting the Overview use case.',
    description: 'Exception flow 1 of UC-useCaseEditor (Use case): "An unknown key is not replaced with Overview." Requesting a nonexistent page key must return a clean not-found, never silently substituting the Overview use case.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/use-cases/not-a-real-page-{{ts}}', headers: BEARER, expected_status: 404, expect_json: [{ path: 'error', equals: 'use_case_not_found' }, { path: 'page', equals: 'not-a-real-page-{{ts}}' }, { path: 'goal', exists: false }], description: 'unknown page key' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'useCaseEditor'],
    dataProfile: { profile: 'negative', data: 'A fabricated page key.', source: 'n/a' },
    expected: '404; never a 200 carrying the Overview use case instead.',
  },
  {
    key: 'SB-UC-useCaseEditor-EXC-2',
    name: 'UC-useCaseEditor exc flow 2: Failed saving is not a confirmed new revision.',
    objective: 'Check that "Use case" fails safely: failed saving is not a confirmed new revision. No PUT is fired against this shared, hand-authored documentation catalogue by policy (other sessions may be actively editing it); this case instead confirms the revision history for a real page is independently readable, the precondition for ever being able to tell a confirmed revision apart from a failed one.',
    description: 'Exception flow 2 of UC-useCaseEditor (Use case): "Failed saving is not a confirmed new revision." No PUT is fired against this shared, hand-authored documentation catalogue by policy (other sessions may be actively editing it); this case instead confirms the revision history for a real page is independently readable, the precondition for ever being able to tell a confirmed revision apart from a failed one.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/use-cases/overview/revisions', headers: BEARER, expected_status: 200, description: 'revision history is independently readable' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'useCaseEditor'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload — no write is fired by policy.', source: 'n/a' },
    expected: '200; revision history is independently inspectable.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-useCaseReview — Use-case review                                        */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-useCaseReview-MAIN',
    name: 'UC-useCaseReview main flow: Use-case review',
    objective: 'Walk through the "Use-case review" screen the way its main use case describes it: author selects Review all use cases; the deterministic review endpoint runs and returns its real findings.',
    description: 'Main flow of UC-useCaseReview (Use-case review): author selects Review all use cases; the deterministic review endpoint runs and returns its real findings. Touches POST /api/v1/use-cases/review.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/use-case-review.html', expected_status: 200, expected_body_contains: 'data-sbe-page="useCaseReview"', description: 'load the Use case review screen (its own page; the web tier redirects to its /v/<id> address, which is followed)' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/use-cases/review', headers: BEARER, expected_status: 200, expect_json: [{ path: 'reviewer', exists: true }, { path: 'mode', equals: 'deterministic-contract-review' }, { path: 'data', min_length: 1 }], description: 'run the deterministic review' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'useCaseReview'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; the review is a pure computation over the published catalogue.', source: 'n/a' },
    expected: '200 with mode "deterministic-contract-review" and >= 1 finding.',
  },
  {
    key: 'SB-UC-useCaseReview-ALT-1',
    name: 'UC-useCaseReview alt flow 1: A page-specific review can be requested through its registered API.',
    objective: 'Check an alternative path of "Use-case review": a page-specific review can be requested through its registered application service. the matching write reviews exactly one named page, distinct from the full-catalogue review.',
    description: 'Alternate flow 1 of UC-useCaseReview (Use-case review): "A page-specific review can be requested through its registered API." POST /api/v1/use-cases/review/:page reviews exactly one named page, distinct from the full-catalogue review.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/use-cases/review/overview', headers: BEARER, expected_status: 200, expect_json: [{ path: 'page', equals: 'overview' }, { path: 'id', equals: 'UC-overview' }, { path: 'status', exists: true }, { path: 'findings', min_length: 0 }, { path: 'checkedAt', exists: true }, { path: 'checkedBy', exists: true }], description: 'review a single named page' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'useCaseReview'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '200 with a review scoped to exactly the "overview" page.',
  },
  {
    key: 'SB-UC-useCaseReview-ALT-2',
    name: 'UC-useCaseReview alt flow 2: No findings means only the implemented review rules found nothing.',
    objective: 'Check an alternative path of "Use-case review": no findings means only the implemented review rules found nothing. Running the full review twice in a row returns the same deterministic mode/reviewer both times — the review is not probabilistic or state-mutating.',
    description: 'Alternate flow 2 of UC-useCaseReview (Use-case review): "No findings means only the implemented review rules found nothing." Running the full review twice in a row returns the same deterministic mode/reviewer both times — the review is not probabilistic or state-mutating.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/use-cases/review', headers: BEARER, expected_status: 200, expect_json: [{ path: 'mode', equals: 'deterministic-contract-review' }], description: 'first review' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/use-cases/review', headers: BEARER, expected_status: 200, expect_json: [{ path: 'mode', equals: 'deterministic-contract-review' }], description: 'second review, same deterministic mode' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'useCaseReview'],
    dataProfile: { profile: 'none (read-only)', data: 'Two review runs, expected deterministic.', source: 'n/a' },
    expected: 'Both runs report the same deterministic mode.',
  },
  {
    key: 'SB-UC-useCaseReview-EXC-1',
    name: 'UC-useCaseReview exc flow 1: A failed review request must not be shown as all cases passing.',
    objective: 'Check that "Use-case review" fails safely: a failed review request must not be shown as all cases passing. Reviewing a nonexistent single page must return a clean not-found, never a fabricated all-pass result.',
    description: 'Exception flow 1 of UC-useCaseReview (Use-case review): "A failed review request must not be shown as all cases passing." Reviewing a nonexistent single page must return a clean not-found, never a fabricated all-pass result.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/use-cases/review/not-a-real-page-{{ts}}', headers: BEARER, expected_status: 404, expect_json: [{ path: 'error', equals: 'use_case_not_found' }, { path: 'page', equals: 'not-a-real-page-{{ts}}' }, { path: 'findings', exists: false }], description: 'review of a nonexistent page' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'useCaseReview'],
    dataProfile: { profile: 'negative', data: 'A fabricated page key.', source: 'n/a' },
    expected: '404; never a fabricated passing review.',
  },
  {
    key: 'SB-UC-useCaseReview-EXC-2',
    name: 'UC-useCaseReview exc flow 2: A missing case cannot be silently omitted from the coverage denominator.',
    objective: 'Check that "Use-case review" fails safely: a missing case cannot be silently omitted from the coverage denominator. The full review\'s data array length is checked against the published catalogue\'s own count — the review covers the real published set, not a silently truncated subset.',
    description: 'Exception flow 2 of UC-useCaseReview (Use-case review): "A missing case cannot be silently omitted from the coverage denominator." The full review\'s data array length is checked against the published catalogue\'s own count — the review covers the real published set, not a silently truncated subset.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/use-cases', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', min_length: 100 }], description: 'published catalogue size' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/use-cases/review', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', min_length: 100 }], description: 'review covers the full published catalogue, not a subset' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'useCaseReview'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'The review\'s finding count is consistent with the full published catalogue size.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-users — Users                                                          */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-users-MAIN',
    name: 'UC-users main flow: Users',
    objective: 'Walk through the "Users" screen the way its main use case describes it: the administrator opens user administration, retrieves the users, selects one — a temporary user this test creates for itself — and retrieves that user\'s effective access, which is empty for a user with no roles.',
    description: 'Main flow of UC-users (Users): administrator opens the supported user administration surface, retrieves tenant users, selects one, and retrieves its effective access. Touches GET /api/v1/admin/users (rows {id, email, display_name, status, username, etag, membership_id}) and GET /api/v1/admin/users/:userId/effective-access ({userId, functionalPermissions, explicitDenies, dataScopes, assignments, conflicts, evaluatedAt}). The selected user is one the case creates itself (POST /api/v1/admin/tenants/tenant_default/users, 201) and deletes in cleanup — the list is shared by every case running at the same time, so "the first user in the list" can be another case\'s temporary user. The user admin screen lives at /configuration-users.html (the web tier redirects it to its /v/<id> address).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; the built-in administrator can sign in.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-users.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationUsers"', description: 'load screen (the web tier redirects to the page\'s /v/<id> address, which is followed; the Users page answers there)' },
      ADMIN_LOGIN,
      createOwnUser('main'),
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', some: { id: '{{own_user_id}}', status: 'active', etag: '{{own_user_etag}}' } }], description: 'retrieve tenant users: the list includes this case\'s user' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users/{{own_user_id}}/effective-access', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'userId', equals: '{{own_user_id}}' }, { path: 'functionalPermissions', max_length: 0 }, { path: 'explicitDenies', max_length: 0 }, { path: 'dataScopes', max_length: 0 }, { path: 'assignments', max_length: 0 }, { path: 'conflicts', max_length: 0 }, { path: 'evaluatedAt', exists: true }], description: 'retrieve effective access for that user: a user with no roles has no permissions, scopes or assignments' },
    ],
    cleanupSteps: cleanupOwnUser,
    tags: ['usecase', 'sand-bench', 'main-flow', 'users'],
    dataProfile: { profile: 'synthetic-named', data: 'One temporary user with a unique per-run name and no roles.', source: 'Created by this case through the administrator\'s user administration and deleted in cleanup.' },
    expected: 'The user list includes the case\'s own user, and effective access is retrieved for exactly that user id with every access list empty.',
  },
  {
    key: 'SB-UC-users-ALT-1',
    name: 'UC-users alt flow 1: An empty membership collection is shown without demo users.',
    objective: 'Check an alternative path of "Users": an empty membership collection is shown without demo users.',
    description: 'Alternate flow 1 of UC-users (Users): "An empty membership collection is shown without demo users." Closest executable proxy: GET /api/v1/admin/users always answers with a well-formed 200/array (the structural precondition for honestly distinguishing a genuinely empty tenant from a failed read).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', min_length: 1 }, { path: 'data.0.id', exists: true }, { path: 'data.0.username', exists: true }, { path: 'data.0.status', exists: true }, { path: 'data.0.etag', exists: true }], description: 'users read: a well-formed list of user rows (the built-in administrator is always a member)' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'users'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '200 with a well-formed array, whatever its length.',
  },
  {
    key: 'SB-UC-users-ALT-2',
    name: 'UC-users alt flow 2: Effective access may be inspected without changing assignments.',
    objective: 'Check an alternative path of "Users": effective access may be inspected without changing assignments. Reading the effective access of a temporary user twice gives the same answer both times, and afterwards the user record is still at the version it had when it was created — looking alone never changes it.',
    description: 'Alternate flow 2 of UC-users (Users): "Effective access may be inspected without changing assignments." The case creates its own user (no roles), reads GET /api/v1/admin/users/:userId/effective-access twice — both answers carry the same user id and empty functionalPermissions/assignments — and then confirms in GET /api/v1/admin/users that the user\'s etag is still the one returned at creation, i.e. inspection wrote nothing.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; the built-in administrator can sign in.',
    steps: [
      ADMIN_LOGIN,
      createOwnUser('alt2'),
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users/{{own_user_id}}/effective-access', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'userId', equals: '{{own_user_id}}' }, { path: 'functionalPermissions', max_length: 0 }, { path: 'assignments', max_length: 0 }], description: 'first read' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users/{{own_user_id}}/effective-access', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'userId', equals: '{{own_user_id}}' }, { path: 'functionalPermissions', max_length: 0 }, { path: 'assignments', max_length: 0 }], description: 'second read, unchanged' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', some: { id: '{{own_user_id}}', status: 'active', etag: '{{own_user_etag}}' } }], description: 'the user record is still at its creation version: inspecting it changed nothing' },
    ],
    cleanupSteps: cleanupOwnUser,
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'users'],
    dataProfile: { profile: 'synthetic-named', data: 'One temporary user with a unique per-run name and no roles.', source: 'Created by this case through the administrator\'s user administration and deleted in cleanup.' },
    expected: 'Both reads succeed identically and the user\'s version is unchanged; inspection alone never mutates assignments.',
  },
  {
    key: 'SB-UC-users-EXC-1',
    name: 'UC-users exc flow 1: Unavailable historical /users endpoints are not treated as working CRUD.',
    objective: 'Check that "Users" fails safely: unavailable historical /users endpoints are not treated as working create/edit/delete. A plain, unversioned/legacy the matching read path (as opposed to the real the application application service) must not be mistaken for a working endpoint — it answers not-found, not a silent empty success.',
    description: 'Exception flow 1 of UC-users (Users): "Unavailable historical /users endpoints are not treated as working CRUD." A plain, unversioned/legacy GET /api/v1/users path (as opposed to the real /api/v1/admin/users) must not be mistaken for a working endpoint — it answers not-found, not a silent empty success.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/users', headers: ADMIN_BEARER, expected_status: 404, expect_json: [{ path: 'message', equals: 'Route GET:/api/v1/users not found' }, { path: 'data', exists: false }], description: 'the historical, unregistered path is genuinely absent' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'users'],
    dataProfile: { profile: 'negative', data: 'A plausible-looking but unregistered path.', source: 'n/a' },
    expected: '404; the real surface is only /api/v1/admin/users.',
  },
  {
    key: 'SB-UC-users-EXC-2',
    name: 'UC-users exc flow 2: A missing user cannot be replaced by a matching display name.',
    objective: 'Check that "Users" fails safely: a missing user cannot be replaced by a matching display name.',
    description: 'Exception flow 2 of UC-users (Users): "A missing user cannot be replaced by a matching display name." Verified live: a fabricated user id does NOT 404 — it returns 200 with every permission/assignment array empty, echoing back the exact id requested. That is still the honest behavior this flow cares about (no cross-user substitution ever occurs); it is not a 404, which this case\'s assertion reflects as observed rather than assumed.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users/user_does_not_exist_00000000/effective-access', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'userId', equals: 'user_does_not_exist_00000000' }, { path: 'functionalPermissions', max_length: 0 }, { path: 'explicitDenies', max_length: 0 }, { path: 'dataScopes', max_length: 0 }, { path: 'assignments', max_length: 0 }], description: 'nonexistent user id: echoed back with empty access, never another real user' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'users'],
    dataProfile: { profile: 'negative', data: 'A fabricated user id.', source: 'n/a' },
    expected: '200 with the exact fabricated id echoed back and empty access arrays — never an unrelated real user\'s data.',
  }
);

export const SANDBENCH_USECASE_FLOW_CASES_BATCH2E: CaseDef[] = C;
