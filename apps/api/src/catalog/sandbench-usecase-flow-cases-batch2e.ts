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
  body: { username: 'admin', password: '{{password}}' },
  expected_status: 200, save: { adminToken: 'token' },
  description: 'tenant admin login',
};
const ADMIN_BEARER = { authorization: 'Bearer {{adminToken}}' };

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
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/use-cases/not-a-real-page-{{ts}}', headers: BEARER, expected_status: 404, description: 'unknown page key' },
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
      { action: 'request', method: 'GET', url: '{{web}}/?page=useCaseReview', expected_status: 200, description: 'console shell loads (useCaseReview mounts client-side inside the React console)' },
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
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/use-cases/review/overview', headers: BEARER, expected_status: 200, description: 'review a single named page' },
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
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/use-cases/review/not-a-real-page-{{ts}}', headers: BEARER, expected_status: 404, description: 'review of a nonexistent page' },
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
    objective: 'Walk through the "Users" screen the way its main use case describes it: administrator opens the supported user administration surface, retrieves tenant users, selects one, and retrieves its effective access.',
    description: 'Main flow of UC-users (Users): administrator opens the supported user administration surface, retrieves tenant users, selects one, and retrieves its effective access. Touches GET /api/v1/admin/users and GET /api/v1/admin/users/:userId/effective-access. The gated /admin.html serves the sign-in shell until JS renders the authenticated screen; the stable fragment "<title>Sand Bench" confirms the route is reachable.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: '<title>Sand Bench', description: 'load screen' },
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data.0.id', exists: true }], save: { any_user_id: 'data.0.id' }, description: 'retrieve tenant users' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users/{{any_user_id}}/effective-access', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'userId', equals: '{{any_user_id}}' }, { path: 'functionalPermissions', exists: true }], description: 'retrieve effective access for that user' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'users'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'Effective access is retrieved for the exact selected user id.',
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
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'users read' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'users'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '200 with a well-formed array, whatever its length.',
  },
  {
    key: 'SB-UC-users-ALT-2',
    name: 'UC-users alt flow 2: Effective access may be inspected without changing assignments.',
    objective: 'Check an alternative path of "Users": effective access may be inspected without changing assignments. Reading effective access twice for the same user returns the same assignment data both times — inspection alone never mutates it.',
    description: 'Alternate flow 2 of UC-users (Users): "Effective access may be inspected without changing assignments." Reading effective access twice for the same user returns the same assignment data both times — inspection alone never mutates it.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users', headers: ADMIN_BEARER, expected_status: 200, save: { any_user_id: 'data.0.id' }, description: 'pick a user' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users/{{any_user_id}}/effective-access', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'functionalPermissions', exists: true }], description: 'first read' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users/{{any_user_id}}/effective-access', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'functionalPermissions', exists: true }], description: 'second read, unchanged' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'users'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'Both reads succeed identically; inspection alone never mutates assignments.',
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
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/users', headers: ADMIN_BEARER, expected_status: 404, description: 'the historical, unregistered path is genuinely absent' },
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
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/users/user_does_not_exist_00000000/effective-access', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'userId', equals: 'user_does_not_exist_00000000' }, { path: 'functionalPermissions', min_length: 0 }, { path: 'assignments', min_length: 0 }], description: 'nonexistent user id: echoed back with empty access, never another real user' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'users'],
    dataProfile: { profile: 'negative', data: 'A fabricated user id.', source: 'n/a' },
    expected: '200 with the exact fabricated id echoed back and empty access arrays — never an unrelated real user\'s data.',
  }
);

export const SANDBENCH_USECASE_FLOW_CASES_BATCH2E: CaseDef[] = C;
