/**
 * Sand Bench use-case flow catalog â€” Batch 1 (read-only use cases).
 *
 * One case per documented flow (main / alternate / exception) for the use cases
 * under docs/use-cases/*.md whose action contract touches only GET endpoints.
 * Every screen route, data-sbe-page marker and API response shape below was
 * verified live against the deployed Sand Bench stack (web :8080, api :8787)
 * before being encoded â€” see docs/use-cases/*.md "Screen and action contract"
 * and "API registration evidence" for the source use case per case key.
 *
 * Alternate/exception flows are narrative business-rule statements, not
 * independently fireable events; each is encoded as the closest honest
 * executable proxy against the live stack (documented per-case in `description`),
 * not a literal fault injection against the shared deployment.
 *
 * Exception (rebaseline of 2026-11-13, Sand Bench main a8d72039ae8e): UC-roles,
 * UC-roleCreate and UC-userCreate are no longer read-only. Their old host page
 * /admin.html was removed and their use-case documents now name create, update
 * and delete routes, so those 15 cases create, exercise and remove their own
 * role or user (see ROLE_CREATE_FLOW_CASES, ROLES_FLOW_CASES and
 * USER_CREATE_FLOW_CASES below).
 */
import type { CaseDef } from './types.js';

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { username: '{{username}}', password: '{{password}}' },
  expected_status: 200, save: { token: 'token' },
  description: 'operator login',
};
const BEARER = { authorization: 'Bearer {{token}}' };

// Only the built-in administrator may call the administration routes behind the
// users and roles screens (an operator gets 403 there). The sign-in is shared per
// worker (sandbench-identity.ts); never sign the administrator out.
const ADMIN_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { username: '{{admin_username}}', password: '{{admin_password}}' },
  expected_status: 200, save: { adminToken: 'token' },
  description: 'tenant admin login',
};
const ADMIN_BEARER = { authorization: 'Bearer {{adminToken}}' };

/* ------------------------------------------------------------------------ */
/* UC-roleCreate, UC-roles, UC-userCreate                                    */
/* ------------------------------------------------------------------------ */
// Rebaselined 2026-11-13 against Sand Bench main a8d72039ae8e.
//
// These three use cases used to be checked by loading /admin.html. That page was
// removed from the application on purpose (it answers 404; see the app's
// docs/use-cases/UC-adminIdentities.md and apps/api/src/modules/consoleScreens.ts).
// Users and roles are now administered on the User management screen
// (/user-management.html: tabs "Users" / "User roles", dialogs "New user" /
// "New role"), and each use case now names registered API routes (app.ts):
//   GET, POST      /api/v1/admin/functional-access-profiles      200, administrator only
//   PATCH, DELETE  /api/v1/admin/functional-access-profiles/:id  DELETE retires (status "deleted")
//   GET            /api/v1/admin/data-access-profiles
//   POST           /api/v1/admin/users                           200, invited member, no credential
// So every flow below is exercised for real with a record the case creates and
// removes itself. Removal goes through the tenant administration routes, the only
// ones that really remove the record:
//   DELETE /api/v1/admin/tenants/tenant_default/roles/:id             (hard delete)
//   DELETE /api/v1/admin/tenants/tenant_default/users/:id + If-Match  (frees username and email)
//
// Three of these cases assert behaviour the use-case documents promise but this
// build does not deliver (tagged known-defect; they stay red until it is fixed):
//   SB-UC-roleCreate-EXC-1, SB-UC-roles-EXC-2: a duplicate role name answers 500, not 409.
//   SB-UC-roles-EXC-1: DELETE of a role still assigned to a user answers 200, not 409.
const USER_MANAGEMENT = '{{web}}/user-management.html';
const ACCESS_PROFILES = '{{api}}/api/v1/admin/functional-access-profiles';
const DATA_PROFILES = '{{api}}/api/v1/admin/data-access-profiles';
const ADMIN_USERS = '{{api}}/api/v1/admin/users';
const TENANT_ADMIN = '{{api}}/api/v1/admin/tenants/tenant_default';
const ROLE_NAME = 'TE-UC-ROLE-{{ts}}-{{rand}}';
const MEMBER_USERNAME = 'te.uc.member.{{ts}}.{{rand}}';
const MEMBER_EMAIL = 'te.uc.member.{{ts}}.{{rand}}@example.invalid';
const MEMBER_DISPLAY = 'TE UC member {{ts}}';
const UC_FLOW = { suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http' } as const;
const ADMIN_PRECONDITIONS = 'Sand Bench web and API reachable; the built-in administrator can sign in.';
const ROLE_DATA = { profile: 'synthetic (case-owned)', data: 'One temporary role with a unique name; removed when the test ends.', source: 'generated per run' };
const MEMBER_DATA = { profile: 'synthetic (case-owned)', data: 'One temporary user (made-up name, unique username and email); removed when the test ends.', source: 'generated per run' };

const ADMIN_SIGN_IN = {
  ...ADMIN_LOGIN,
  text: 'Sign in to the application as the built-in administrator',
  expected: 'The sign-in is accepted.',
};

function openUserManagement(fragment: string, offers: string) {
  return {
    action: 'request', method: 'GET', url: USER_MANAGEMENT, expected_status: 200, expected_body_contains: fragment,
    text: 'Open the User management screen, where users and roles are administered',
    expected: `The screen loads and offers ${offers}.`,
    description: 'load the User management screen (successor of the removed /admin.html)',
  };
}

function createRole(permissions: string[], more: Record<string, unknown> = {}, checks: unknown[] = []) {
  return {
    action: 'request', method: 'POST', url: ACCESS_PROFILES, headers: ADMIN_BEARER,
    body: { name: ROLE_NAME, permissions, ...more },
    expected_status: 200,
    expect_json: [
      { path: 'id', matches: '^fap_' }, { path: 'name', equals: ROLE_NAME }, { path: 'status', equals: 'active' },
      ...permissions.map((p, i) => ({ path: `permissions.${i}`, equals: p })),
      { path: 'permissions', min_length: permissions.length, max_length: permissions.length },
      ...checks,
    ],
    save: { role_id: 'id' },
    text: 'Create a temporary role with a unique name',
    expected: 'The application confirms the new role as active, under the name and with exactly the permissions that were entered.',
    testData: 'A role name carrying a unique stamp, and the permissions listed in the request.',
    description: 'create a case-owned functional access profile',
  };
}

function rolesListShows(match: Record<string, unknown>, text: string, expected: string) {
  return {
    action: 'request', method: 'GET', url: ACCESS_PROFILES, headers: ADMIN_BEARER, expected_status: 200,
    expect_json: [{ path: 'data', some: match }], text, expected, description: 'list functional access profiles',
  };
}

function createMember(more: Record<string, unknown> = {}) {
  return {
    action: 'request', method: 'POST', url: ADMIN_USERS, headers: ADMIN_BEARER,
    body: { email: MEMBER_EMAIL, displayName: MEMBER_DISPLAY, username: MEMBER_USERNAME, ...more },
    expected_status: 200,
    expect_json: [
      { path: 'id', matches: '^usr_' }, { path: 'membershipId', matches: '^mem_' },
      { path: 'username', equals: MEMBER_USERNAME }, { path: 'email', equals: MEMBER_EMAIL }, { path: 'displayName', equals: MEMBER_DISPLAY },
      { path: 'status', equals: 'invited' }, { path: 'etag', exists: true },
    ],
    save: { user_id: 'id', user_etag: 'etag', membership_id: 'membershipId' },
    text: 'Add a temporary user with a unique username and email',
    expected: 'The application confirms the new membership as invited and returns its identifier and its version.',
    testData: 'A made-up person: display name, username and email carrying a unique stamp.',
    description: 'create a case-owned invited member',
  };
}

/** Remove a role this case created (hard delete) and verify it is gone. */
function cleanupRole(idVar: string) {
  return [
    { ...ADMIN_LOGIN, skip_if_missing: [idVar], text: 'Sign in as the built-in administrator to tidy up', expected: 'The sign-in is accepted.', description: 'administrator sign-in for cleanup' },
    { action: 'request', method: 'DELETE', url: `${TENANT_ADMIN}/roles/{{${idVar}}}`, headers: ADMIN_BEARER, skip_if_missing: [idVar], expected_status: [200, 404],
      text: 'Remove the temporary role this test created', expected: 'The role is removed, or was already gone.', description: 'hard-delete the case-owned role through tenant administration' },
    { action: 'request', method: 'GET', url: ACCESS_PROFILES, headers: ADMIN_BEARER, skip_if_missing: [idVar], expected_status: 200, expected_body_not_contains: `{{${idVar}}}`,
      text: 'Check that the temporary role is no longer listed', expected: 'The list of roles no longer contains it.', description: 'verify the case-owned role is gone' },
  ];
}

/** Remove a user this case created (needs the version it was created with) and verify it is gone. */
function cleanupMember(idVar: string, etagVar: string) {
  return [
    { ...ADMIN_LOGIN, skip_if_missing: [idVar], text: 'Sign in as the built-in administrator to tidy up', expected: 'The sign-in is accepted.', description: 'administrator sign-in for cleanup' },
    { action: 'request', method: 'DELETE', url: `${TENANT_ADMIN}/users/{{${idVar}}}`, headers: { ...ADMIN_BEARER, 'if-match': `{{${etagVar}}}` }, skip_if_missing: [idVar, etagVar], expected_status: [200, 404],
      text: 'Remove the temporary user this test created', expected: 'The user is removed, or was already gone.', description: 'delete the case-owned member through tenant administration (If-Match)' },
    { action: 'request', method: 'GET', url: ADMIN_USERS, headers: ADMIN_BEARER, skip_if_missing: [idVar], expected_status: 200, expected_body_not_contains: `{{${idVar}}}`,
      text: 'Check that the temporary user is no longer listed', expected: 'The list of users no longer contains it.', description: 'verify the case-owned member is gone' },
  ];
}

const DUPLICATE_ROLE_DEFECT = 'Observed on a8d72039ae8e (2026-11-13): the second POST answers 500 {"error":{"code":"internal","message":"Internal error"}}. createFunctionalAccessProfile (apps/api/src/modules/identity.ts) inserts without a name check, the UNIQUE (tenant_id, name) constraint of db/migrations/001_foundation.sql raises, and the error handler in apps/api/src/app.ts answers every non-application error with 500. This case asserts the documented refusal and stays red until the application is fixed.';

/** The second create under a name that is already taken: the documented answer is a conflict. */
const DUPLICATE_ROLE_REFUSED = {
  action: 'request', method: 'POST', url: ACCESS_PROFILES, headers: ADMIN_BEARER, body: { name: ROLE_NAME, permissions: ['rules:read'] },
  expected_status: 409, expect_json: [{ path: 'error.code', equals: 'conflict' }], save: { dup_role_id: 'id' },
  text: 'Try to create a second role under the very same name',
  expected: 'The application refuses: a role with that name already exists (conflict, 409).',
  description: 'duplicate role name must be refused with 409 conflict (observed: 500 internal)',
};

const ROLE_CREATE_FLOW_CASES: CaseDef[] = [
  {
    key: 'SB-UC-roleCreate-MAIN',
    name: 'UC-roleCreate main flow: Create user role',
    objective: 'Walk through "Create user role" the way its main use case describes it: the administrator names a job function, enters the exact permissions it carries and an optional feature level, and submits. The application stores the role exactly as entered and shows it in the list of roles.',
    description: 'Main flow of UC-roleCreate (Create user role): administrator names the job function, enters explicit permission keys and an optional feature level, submits; the system creates the profile. The role dialog lives on /user-management.html ("New role"); the old host page /admin.html was removed. POST /api/v1/admin/functional-access-profiles answers 200 with {id: "fap_...", name, permissions, explicit_deny, status: "active", feature_level, feature_mode}; GET on the same route lists it. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'high', priority: 'p1',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      openUserManagement('<h2 id="ta-role-title">New role</h2>', 'the "New role" dialog'),
      ADMIN_SIGN_IN,
      createRole(['rules:read', 'runs:execute'], { featureLevel: 2 }, [{ path: 'feature_level', equals: 2 }, { path: 'feature_mode', equals: 'use' }, { path: 'explicit_deny', max_length: 0 }]),
      rolesListShows({ id: '{{role_id}}', name: ROLE_NAME, status: 'active', 'permissions.0': 'rules:read', 'permissions.1': 'runs:execute' },
        'Ask for the list of roles', 'The new role is listed as active with the two permissions that were entered.'),
    ],
    cleanupSteps: cleanupRole('role_id'),
    tags: ['usecase', 'sand-bench', 'main-flow', 'roleCreate'],
    dataProfile: { ...ROLE_DATA, data: 'One temporary role with a unique name, two permissions and feature level 2; removed when the test ends.' },
    expected: 'The role is created exactly as entered, appears in the list of roles, and is removed again afterwards.',
  },
  {
    key: 'SB-UC-roleCreate-ALT-1',
    name: 'UC-roleCreate alt flow 1: An existing suitable role should be reused; overlap in permissions is not checked.',
    objective: 'Check an alternative path of "Create user role": an existing suitable role should be reused rather than duplicated. The list of roles shows an existing role with the permissions it carries, so it can be found and reused; the application itself does not stop a second role with the same permissions under a different name.',
    description: 'Alternate flow 1 of UC-roleCreate (Create user role): "An existing suitable role should be reused rather than duplicated; the create form does not check for semantic overlap, only exact name collision." GET /api/v1/admin/functional-access-profiles shows the existing role with its permissions; a second POST with identical permissions and a different name answers 200. Both roles are case-owned and removed. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'low', priority: 'p3',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      ADMIN_SIGN_IN,
      createRole(['rules:read', 'datasets:read']),
      rolesListShows({ id: '{{role_id}}', name: ROLE_NAME, 'permissions.0': 'rules:read', 'permissions.1': 'datasets:read' },
        'Ask for the list of roles, as an administrator would before adding another', 'The existing role is listed with the permissions it carries, so it can be reused.'),
      { action: 'request', method: 'POST', url: ACCESS_PROFILES, headers: ADMIN_BEARER, body: { name: `${ROLE_NAME}-COPY`, permissions: ['rules:read', 'datasets:read'] },
        expected_status: 200, expect_json: [{ path: 'id', matches: '^fap_' }, { path: 'name', equals: `${ROLE_NAME}-COPY` }, { path: 'status', equals: 'active' }], save: { role_copy_id: 'id' },
        text: 'Create a second role with the same permissions under a different name',
        expected: 'The application accepts it: only the name is compared, not what the role allows.',
        description: 'same permissions, different name: accepted (no semantic-overlap check)' },
    ],
    cleanupSteps: [...cleanupRole('role_copy_id'), ...cleanupRole('role_id')],
    atomicityNote: { reason: 'tests-interaction', detail: 'Two roles are created on purpose: the second, with the same permissions under another name, shows that only the name is compared when a role is created.' },
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'roleCreate'],
    dataProfile: { ...ROLE_DATA, data: 'Two temporary roles with the same two permissions and different unique names; both removed when the test ends.' },
    expected: 'The existing role can be found with its permissions, and a look-alike role under another name is accepted.',
  },
  {
    key: 'SB-UC-roleCreate-ALT-2',
    name: 'UC-roleCreate alt flow 2: Permission strings are stored as entered; there is no list of known permissions.',
    objective: 'Check an alternative path of "Create user role": permission names are stored exactly as entered, because the application has no list of known permissions to check them against yet. A role created with a made-up permission name is accepted and shows that same name afterwards.',
    description: 'Alternate flow 2 of UC-roleCreate (Create user role): "Permission strings are stored as entered; there is no server-side allow-list of known permission keys yet." POST /api/v1/admin/functional-access-profiles with a made-up permission answers 200 and echoes it; GET lists the role with that same string. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'low', priority: 'p3',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      ADMIN_SIGN_IN,
      createRole(['te-made-up:{{ts}}{{rand}}']),
      rolesListShows({ id: '{{role_id}}', 'permissions.0': 'te-made-up:{{ts}}{{rand}}' },
        'Ask for the list of roles', 'The role is listed with the made-up permission name, letter for letter as it was entered.'),
    ],
    cleanupSteps: cleanupRole('role_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'roleCreate'],
    dataProfile: { ...ROLE_DATA, data: 'One temporary role whose only permission is a made-up name carrying a unique stamp; removed when the test ends.' },
    expected: 'The made-up permission name is accepted and stored unchanged.',
  },
  {
    key: 'SB-UC-roleCreate-EXC-1',
    name: 'UC-roleCreate exc flow 1: A duplicate name is refused instead of creating a second role.',
    objective: 'Check that "Create user role" fails safely: a role name that already exists must be refused as a conflict, never accepted as a second role and never answered with an internal failure (currently a known defect: the application fails internally instead of refusing).',
    description: `Exception flow 1 of UC-roleCreate (Create user role): "A duplicate name within the tenant returns 409 rather than silently creating a second profile." (also acceptance criterion AC-04). A second POST /api/v1/admin/functional-access-profiles with the same name must answer 409 conflict and leave the first role untouched. ${DUPLICATE_ROLE_DEFECT}`,
    ...UC_FLOW, severity: 'medium', priority: 'p2',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      ADMIN_SIGN_IN,
      createRole(['rules:read']),
      DUPLICATE_ROLE_REFUSED,
      rolesListShows({ id: '{{role_id}}', name: ROLE_NAME, status: 'active' }, 'Ask for the list of roles', 'The first role is still listed, active and unchanged.'),
    ],
    cleanupSteps: [...cleanupRole('dup_role_id'), ...cleanupRole('role_id')],
    atomicityNote: { reason: 'tests-interaction', detail: 'The same name is submitted twice on purpose: the second attempt is the duplicate that must be refused.' },
    tags: ['usecase', 'sand-bench', 'exception-flow', 'roleCreate', 'known-defect'],
    dataProfile: { ...ROLE_DATA, data: 'One temporary role with a unique name, then a second attempt under the same name; removed when the test ends.' },
    expected: 'The duplicate is refused as a conflict and the first role is unchanged.',
  },
  {
    key: 'SB-UC-roleCreate-EXC-2',
    name: 'UC-roleCreate exc flow 2: An empty name is rejected.',
    objective: 'Check that "Create user role" fails safely: a role without a name is rejected with a clear explanation, and nothing is created.',
    description: 'Exception flow 2 of UC-roleCreate (Create user role): "An empty name is rejected with 422." POST /api/v1/admin/functional-access-profiles with name "" answers 422 {error: {code: "validation_failed", message: "name is required"}}; the list then holds no role with an empty name. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'medium', priority: 'p2',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      ADMIN_SIGN_IN,
      { action: 'request', method: 'POST', url: ACCESS_PROFILES, headers: ADMIN_BEARER, body: { name: '', permissions: ['rules:read'] },
        expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }, { path: 'error.message', equals: 'name is required' }], save: { stray_role_id: 'id' },
        text: 'Try to create a role with an empty name',
        expected: 'The application rejects it and says that a name is required (422).',
        description: 'empty name is refused with 422 validation_failed' },
      { action: 'request', method: 'GET', url: ACCESS_PROFILES, headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true, min_length: 0 }], expected_body_not_contains: '"name":""',
        text: 'Ask for the list of roles', expected: 'The list answers and holds no role without a name.', description: 'nothing was created by the refused request' },
    ],
    cleanupSteps: cleanupRole('stray_role_id'),
    tags: ['usecase', 'sand-bench', 'exception-flow', 'roleCreate'],
    dataProfile: { profile: 'boundary', data: 'A role request whose name is empty; nothing is stored.', source: 'fixed' },
    expected: 'The nameless role is rejected with a clear message and nothing is created.',
  },
];

const ROLES_FLOW_CASES: CaseDef[] = [
  {
    key: 'SB-UC-roles-MAIN',
    name: 'UC-roles main flow: User roles',
    objective: 'Walk through "User roles" the way its main use case describes it: the administrator opens user and role administration, the application lists the real roles with the permissions each carries, and the administrator creates, edits and retires a role through the supported actions.',
    description: 'Main flow of UC-roles (User roles): administrator opens supported access administration, the system lists the actual functional profiles, the administrator reviews them and creates, edits or deletes a profile through the registered CRUD routes. Screen: /user-management.html ("User roles" tab; the old /admin.html was removed). Routes: GET/POST /api/v1/admin/functional-access-profiles, PATCH and DELETE /api/v1/admin/functional-access-profiles/:id (DELETE answers {id, deleted: true}), GET /api/v1/admin/data-access-profiles. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'high', priority: 'p1',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      openUserManagement('aria-controls="panel-roles">User roles</button>', 'the "User roles" tab'),
      ADMIN_SIGN_IN,
      createRole(['rules:read']),
      rolesListShows({ id: '{{role_id}}', name: ROLE_NAME, status: 'active', 'permissions.0': 'rules:read' },
        'Ask for the list of roles', 'The list shows the role as active with the permission it really carries.'),
      { action: 'request', method: 'GET', url: DATA_PROFILES, headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true, min_length: 0 }],
        text: 'Ask for the list of data access profiles', expected: 'The application answers with the list (it may be empty).', description: 'list data access profiles' },
      { action: 'request', method: 'PATCH', url: `${ACCESS_PROFILES}/{{role_id}}`, headers: ADMIN_BEARER, body: { permissions: ['rules:read', 'datasets:read'] },
        expected_status: 200, expect_json: [{ path: 'id', equals: '{{role_id}}' }, { path: 'name', equals: ROLE_NAME }, { path: 'status', equals: 'active' }, { path: 'permissions.1', equals: 'datasets:read' }, { path: 'permissions', min_length: 2, max_length: 2 }],
        text: 'Edit the role: give it a second permission', expected: 'The application confirms the role now carries both permissions.', description: 'update the case-owned profile' },
      { action: 'request', method: 'DELETE', url: `${ACCESS_PROFILES}/{{role_id}}`, headers: ADMIN_BEARER,
        expected_status: 200, expect_json: [{ path: 'id', equals: '{{role_id}}' }, { path: 'deleted', equals: true }],
        text: 'Retire the role', expected: 'The application confirms the role was deleted.', description: 'delete (retire) the case-owned profile' },
    ],
    cleanupSteps: cleanupRole('role_id'),
    tags: ['usecase', 'sand-bench', 'main-flow', 'roles'],
    dataProfile: ROLE_DATA,
    expected: 'The role is listed with its real permissions and can be created, edited and retired; nothing is left behind.',
  },
  {
    key: 'SB-UC-roles-ALT-1',
    name: 'UC-roles alt flow 1: Data access profiles are reviewed separately from functional permissions.',
    objective: 'Check an alternative path of "User roles": data access profiles are reviewed separately from functional permissions. A role (a set of permitted actions) appears in the list of roles and never in the separate list of data access profiles.',
    description: 'Alternate flow 1 of UC-roles (User roles): "Data access profiles are reviewed separately from functional permissions." A case-owned functional profile is listed by GET /api/v1/admin/functional-access-profiles and is absent from GET /api/v1/admin/data-access-profiles (a separate collection that still answers 200 with a data array). Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'low', priority: 'p3',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      openUserManagement('aria-controls="panel-roles">User roles</button>', 'the "User roles" tab'),
      ADMIN_SIGN_IN,
      createRole(['rules:read']),
      { action: 'request', method: 'GET', url: DATA_PROFILES, headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true, min_length: 0 }], expected_body_not_contains: '{{role_id}}',
        text: 'Ask for the list of data access profiles', expected: 'The list answers and does not contain the role that was just created.', description: 'data access profiles are a separate collection' },
      rolesListShows({ id: '{{role_id}}', name: ROLE_NAME }, 'Ask for the list of roles', 'The role is listed here, with the other roles.'),
    ],
    cleanupSteps: cleanupRole('role_id'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'roles'],
    dataProfile: ROLE_DATA,
    expected: 'Roles and data access profiles are two separate lists.',
  },
  {
    key: 'SB-UC-roles-ALT-2',
    name: 'UC-roles alt flow 2: A historical User roles setting is not a role editor.',
    objective: 'Check an alternative path of "User roles": the historical "User roles" settings page is not a role editor. It only points to the User management screen, which is where roles are edited, and the real lists of roles and data access profiles still answer for the administrator.',
    description: 'Alternate flow 2 of UC-roles (User roles): "A historical User roles setting is not a role editor." /configuration-user-roles.html is a "moved" pointer to /user-management.html#roles with no form of its own; the role form (#ta-role-form) lives on /user-management.html. GET /api/v1/admin/functional-access-profiles and GET /api/v1/admin/data-access-profiles answer 200 with a data array for the administrator. Read-only. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'low', priority: 'p3',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-user-roles.html', expected_status: 200, expected_body_contains: 'href="/user-management.html#roles"', expected_body_not_contains: '<form',
        text: 'Open the historical "User roles" settings page', expected: 'The page loads, points to the User management screen and has no form of its own.', description: 'the historical page is only a pointer' },
      { action: 'request', method: 'GET', url: USER_MANAGEMENT, expected_status: 200, expected_body_contains: '<form id="ta-role-form"',
        text: 'Open the User management screen it points to', expected: 'The screen loads and holds the form for adding or editing a role.', description: 'the role editor lives on the User management screen' },
      ADMIN_SIGN_IN,
      { action: 'request', method: 'GET', url: ACCESS_PROFILES, headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true, min_length: 0 }],
        text: 'Ask for the list of roles', expected: 'The application answers with the list (it may be empty).', description: 'list functional access profiles' },
      { action: 'request', method: 'GET', url: DATA_PROFILES, headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true, min_length: 0 }],
        text: 'Ask for the list of data access profiles', expected: 'The application answers with the list (it may be empty).', description: 'list data access profiles' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'roles'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: 'The historical page only points to User management; the real role lists answer.',
  },
  {
    key: 'SB-UC-roles-EXC-1',
    name: 'UC-roles exc flow 1: Deleting a role that is assigned to a user is refused.',
    objective: 'Check that "User roles" fails safely: a role that is still assigned to a user must not be deleted. The request must be refused as a conflict, so the user is not left holding a role that no longer exists (currently a known defect: the application retires the role anyway).',
    description: 'Exception flow 1 of UC-roles (User roles): "Deleting a role that has at least one active assignment is rejected with 409 rather than silently orphaning the assignment." (also acceptance criterion AC-03). A case-owned role is assigned to a case-owned invited member (POST /api/v1/admin/users with functionalProfileId); DELETE /api/v1/admin/functional-access-profiles/:id must then answer 409 conflict and the role must stay active. Observed on a8d72039ae8e (2026-11-13): 200 {"id":"fap_...","deleted":true} and the role is listed with status "deleted" while the assignment is still active. deleteFunctionalAccessProfile (apps/api/src/modules/identity.ts) never looks at access_assignments; only DELETE /api/v1/admin/tenants/:tenantId/roles/:roleId (deleteTenantRole, tenantAdmin.ts) refuses with 409. This case asserts the documented refusal and stays red until the application is fixed.',
    ...UC_FLOW, severity: 'medium', priority: 'p2',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      ADMIN_SIGN_IN,
      createRole(['rules:read']),
      { ...createMember({ functionalProfileId: '{{role_id}}' }), text: 'Add a temporary user and give them that role', description: 'create a case-owned invited member holding the role' },
      { action: 'request', method: 'DELETE', url: `${ACCESS_PROFILES}/{{role_id}}`, headers: ADMIN_BEARER,
        expected_status: 409, expect_json: [{ path: 'error.code', equals: 'conflict' }],
        text: 'Try to delete the role while the user still holds it',
        expected: 'The application refuses: the role is still assigned to a user (conflict, 409).',
        description: 'delete of an assigned role must be refused with 409 conflict (observed: 200 deleted)' },
      rolesListShows({ id: '{{role_id}}', status: 'active' }, 'Ask for the list of roles', 'The role is still listed as active.'),
    ],
    cleanupSteps: [...cleanupMember('user_id', 'user_etag'), ...cleanupRole('role_id')],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'roles', 'known-defect'],
    dataProfile: { profile: 'synthetic (case-owned)', data: 'One temporary role and one temporary user who is given that role; both removed when the test ends.', source: 'generated per run' },
    expected: 'The delete is refused as a conflict and the role stays active.',
  },
  {
    key: 'SB-UC-roles-EXC-2',
    name: 'UC-roles exc flow 2: A duplicate role name is refused.',
    objective: 'Check that "User roles" fails safely: two roles cannot share a name. Creating a role under a name that is already in use must be refused as a conflict and leave the existing role as it was (currently a known defect: the application fails internally instead of refusing).',
    description: `Exception flow 2 of UC-roles (User roles): "A duplicate role name within the tenant is rejected with 409." A second POST /api/v1/admin/functional-access-profiles with the same name must answer 409 conflict and leave the first role untouched. ${DUPLICATE_ROLE_DEFECT}`,
    ...UC_FLOW, severity: 'medium', priority: 'p2',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      ADMIN_SIGN_IN,
      createRole(['rules:read']),
      DUPLICATE_ROLE_REFUSED,
      rolesListShows({ id: '{{role_id}}', name: ROLE_NAME, status: 'active' }, 'Ask for the list of roles', 'The existing role is still listed, active and unchanged.'),
    ],
    cleanupSteps: [...cleanupRole('dup_role_id'), ...cleanupRole('role_id')],
    atomicityNote: { reason: 'tests-interaction', detail: 'The same name is submitted twice on purpose: the second attempt is the duplicate that must be refused.' },
    tags: ['usecase', 'sand-bench', 'exception-flow', 'roles', 'known-defect'],
    dataProfile: { ...ROLE_DATA, data: 'One temporary role with a unique name, then a second attempt under the same name; removed when the test ends.' },
    expected: 'The duplicate name is refused as a conflict and the existing role is unchanged.',
  },
];

const USER_CREATE_FLOW_CASES: CaseDef[] = [
  {
    key: 'SB-UC-userCreate-MAIN',
    name: 'UC-userCreate main flow: Create new user',
    objective: 'Walk through "Create new user" the way its main use case describes it: the administrator enters a person\'s name, username and email and submits. The application confirms the new membership as invited, with its own identifier and version, and shows the person in the list of users.',
    description: 'Main flow of UC-userCreate (Create new user): administrator enters the intended identity, the system checks the required fields and existing username/email membership, the administrator submits, the system reports the confirmed membership (status invited). The user dialog lives on /user-management.html ("New user"); the old host page /admin.html was removed. POST /api/v1/admin/users answers 200 with {id: "usr_...", membershipId: "mem_...", email, displayName, username, status: "invited", etag}; GET /api/v1/admin/users lists the member. The case-owned member is removed through DELETE /api/v1/admin/tenants/tenant_default/users/:id with If-Match. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'high', priority: 'p1',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      openUserManagement('<h2 id="ta-user-title">New user</h2>', 'the "New user" dialog'),
      ADMIN_SIGN_IN,
      createMember(),
      { action: 'request', method: 'GET', url: ADMIN_USERS, headers: ADMIN_BEARER, expected_status: 200,
        expect_json: [{ path: 'data', some: { id: '{{user_id}}', membership_id: '{{membership_id}}', username: MEMBER_USERNAME, email: MEMBER_EMAIL, display_name: MEMBER_DISPLAY, status: 'invited' } }],
        text: 'Ask for the list of users', expected: 'The new person is listed as invited, with the name, username and email that were entered.', description: 'list users' },
    ],
    cleanupSteps: cleanupMember('user_id', 'user_etag'),
    tags: ['usecase', 'sand-bench', 'main-flow', 'userCreate'],
    dataProfile: MEMBER_DATA,
    expected: 'The membership is confirmed as invited, the person appears in the list of users, and is removed again afterwards.',
  },
  {
    key: 'SB-UC-userCreate-ALT-1',
    name: 'UC-userCreate alt flow 1: A person is one identity attached to a membership, not a duplicate identity.',
    objective: 'Check an alternative path of "Create new user": a person who already has an identity is attached to a new membership rather than given a second identity. On this single-organisation deployment the checkable part is that the application keeps the person and the membership as two separate records and reports both when a user is created.',
    description: 'Alternate flow 1 of UC-userCreate (Create new user): "A person whose email already exists as a global user record is attached to a new tenant membership rather than a duplicate identity." Closest executable proxy: POST /api/v1/admin/users returns the identity (id "usr_...") and the membership (membershipId "mem_...") as two records, and GET /api/v1/admin/users lists the member with both. The cross-tenant half needs an email that exists with no membership in this tenant, i.e. a second tenant, and the application has no tenant delete route, so it cannot be exercised without leaving a tenant behind. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'low', priority: 'p3',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      ADMIN_SIGN_IN,
      createMember(),
      { action: 'request', method: 'GET', url: ADMIN_USERS, headers: ADMIN_BEARER, expected_status: 200,
        expect_json: [{ path: 'data', some: { id: '{{user_id}}', membership_id: '{{membership_id}}', username: MEMBER_USERNAME } }],
        text: 'Ask for the list of users', expected: 'The person is listed once, with the identity and the membership that were reported at creation.', description: 'identity and membership are separate records' },
    ],
    cleanupSteps: cleanupMember('user_id', 'user_etag'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'userCreate'],
    dataProfile: MEMBER_DATA,
    expected: 'The person and the membership are reported as two separate records.',
  },
  {
    key: 'SB-UC-userCreate-ALT-2',
    name: 'UC-userCreate alt flow 2: No invitation email yet; the member is created invited with no credential.',
    objective: 'Check an alternative path of "Create new user": there is no invitation email yet, so the new member is created as invited with no password. The list of users shows that no password is set, and nobody can sign in under that username.',
    description: 'Alternate flow 2 of UC-userCreate (Create new user): "An invitation email flow is still not implemented; membership is created in invited status with no credential." GET /api/v1/admin/tenants/tenant_default/users lists the member with status "invited" and hasPassword false; POST /api/v1/session/login with that username answers 401 {error: {code: "unauthorized"}}. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'low', priority: 'p3',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      ADMIN_SIGN_IN,
      createMember(),
      { action: 'request', method: 'GET', url: `${TENANT_ADMIN}/users`, headers: ADMIN_BEARER, expected_status: 200,
        expect_json: [{ path: 'data', some: { id: '{{user_id}}', username: MEMBER_USERNAME, status: 'invited', hasPassword: false } }],
        text: 'Ask for the detailed list of users', expected: 'The new person is listed as invited, with no password set.', description: 'tenant user list: invited, hasPassword false' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login', body: { username: MEMBER_USERNAME, password: 'Not-A-Real-Password-1!' },
        expected_status: 401, expect_json: [{ path: 'error.code', equals: 'unauthorized' }],
        text: 'Try to sign in under the new username with a made-up password', expected: 'The sign-in is refused (401): the invited member has no password yet.', description: 'an invited member cannot sign in' },
    ],
    cleanupSteps: cleanupMember('user_id', 'user_etag'),
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'userCreate'],
    dataProfile: MEMBER_DATA,
    expected: 'The member exists as invited with no password, and cannot sign in.',
  },
  {
    key: 'SB-UC-userCreate-EXC-1',
    name: 'UC-userCreate exc flow 1: A role that does not exist is rejected, not silently ignored.',
    objective: 'Check that "Create new user" fails safely: when the chosen role does not exist, the whole request is rejected with a clear explanation. The user is not created without the role.',
    description: 'Exception flow 1 of UC-userCreate (Create new user): "A functionalProfileId that does not belong to the tenant is rejected with 422, not silently ignored." POST /api/v1/admin/users with an unknown functionalProfileId answers 422 {error: {code: "validation_failed", message: "functionalProfileId does not exist for this tenant"}} and GET /api/v1/admin/users does not list the username. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'medium', priority: 'p2',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      ADMIN_SIGN_IN,
      { action: 'request', method: 'POST', url: ADMIN_USERS, headers: ADMIN_BEARER,
        body: { email: MEMBER_EMAIL, displayName: MEMBER_DISPLAY, username: MEMBER_USERNAME, functionalProfileId: 'fap_te_no_such_role' },
        expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }, { path: 'error.message', equals: 'functionalProfileId does not exist for this tenant' }],
        save: { stray_user_id: 'id', stray_user_etag: 'etag' },
        text: 'Try to add a user with a role that does not exist', expected: 'The application rejects the request and says the role does not exist (422).', description: 'unknown functionalProfileId is refused with 422' },
      { action: 'request', method: 'GET', url: ADMIN_USERS, headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true, min_length: 1 }], expected_body_not_contains: MEMBER_USERNAME,
        text: 'Ask for the list of users', expected: 'The list answers and does not contain the rejected username.', description: 'nothing was created by the refused request' },
    ],
    cleanupSteps: cleanupMember('stray_user_id', 'stray_user_etag'),
    tags: ['usecase', 'sand-bench', 'exception-flow', 'userCreate'],
    dataProfile: { profile: 'negative', data: 'A made-up person with a unique username and email, and a role identifier that does not exist; nothing is stored.', source: 'generated per run' },
    expected: 'The request is rejected with a clear message and no user is created.',
  },
  {
    key: 'SB-UC-userCreate-EXC-2',
    name: 'UC-userCreate exc flow 2: A duplicate username or email is refused, not silently overwritten.',
    objective: 'Check that "Create new user" fails safely: a username or an email that is already taken is refused as a conflict, and the existing user is left exactly as it was.',
    description: 'Exception flow 2 of UC-userCreate (Create new user): "A duplicate username or email within the tenant returns 409, not a silent overwrite." After a case-owned member exists, POST /api/v1/admin/users with the same username (other email) and with the same email (other username) each answer 409 {error: {code: "conflict", message: "A user with this username or email already exists in this tenant"}}; GET /api/v1/admin/users still lists the first member unchanged. Verified 2026-11-13 on a8d72039ae8e.',
    ...UC_FLOW, severity: 'medium', priority: 'p2',
    preconditions: ADMIN_PRECONDITIONS,
    steps: [
      ADMIN_SIGN_IN,
      createMember(),
      { action: 'request', method: 'POST', url: ADMIN_USERS, headers: ADMIN_BEARER,
        body: { email: `other.${MEMBER_EMAIL}`, displayName: 'TE UC duplicate username', username: MEMBER_USERNAME },
        expected_status: 409, expect_json: [{ path: 'error.code', equals: 'conflict' }, { path: 'error.message', equals: 'A user with this username or email already exists in this tenant' }],
        save: { dup_user_id: 'id', dup_user_etag: 'etag' },
        text: 'Try to add another user under the same username', expected: 'The application refuses: the username is already taken (conflict, 409).', description: 'duplicate username is refused with 409' },
      { action: 'request', method: 'POST', url: ADMIN_USERS, headers: ADMIN_BEARER,
        body: { email: MEMBER_EMAIL, displayName: 'TE UC duplicate email', username: `other.${MEMBER_USERNAME}` },
        expected_status: 409, expect_json: [{ path: 'error.code', equals: 'conflict' }, { path: 'error.message', equals: 'A user with this username or email already exists in this tenant' }],
        save: { dup_email_user_id: 'id', dup_email_user_etag: 'etag' },
        text: 'Try to add another user with the same email', expected: 'The application refuses: the email is already taken (conflict, 409).', description: 'duplicate email is refused with 409' },
      { action: 'request', method: 'GET', url: ADMIN_USERS, headers: ADMIN_BEARER, expected_status: 200,
        expect_json: [{ path: 'data', some: { id: '{{user_id}}', username: MEMBER_USERNAME, email: MEMBER_EMAIL, display_name: MEMBER_DISPLAY, status: 'invited' } }],
        text: 'Ask for the list of users', expected: 'The first user is still listed with the original name, username and email.', description: 'the existing member was not overwritten' },
    ],
    cleanupSteps: [...cleanupMember('dup_user_id', 'dup_user_etag'), ...cleanupMember('dup_email_user_id', 'dup_email_user_etag'), ...cleanupMember('user_id', 'user_etag')],
    atomicityNote: { reason: 'tests-interaction', detail: 'The same username and the same email are submitted again on purpose: those attempts are the duplicates that must be refused.' },
    tags: ['usecase', 'sand-bench', 'exception-flow', 'userCreate'],
    dataProfile: { ...MEMBER_DATA, data: 'One temporary user, then two more attempts reusing its username and its email; removed when the test ends.' },
    expected: 'Both duplicates are refused as conflicts and the first user is unchanged.',
  },
];

export const SANDBENCH_USECASE_FLOW_CASES_BATCH1: CaseDef[] = [
  {
    key: "SB-UC-about-MAIN",
    name: "UC-about main flow: About",
    objective: 'Walk through the "About" screen the way its main use case describes it: operator opens About. System displays the product purpose and scope. Operator follows the console link to begin work.',
    description: "Main flow of UC-about (About): Operator opens About. System displays the product purpose and scope. Operator follows the console link to begin work. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/about.html', expected_status: 200, expected_body_contains: "About", description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","main-flow","about"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-about-ALT-1",
    name: "UC-about alt flow 1: The page can be read independently of a tenant session.",
    objective: 'Check an alternative path of "About": the page can be read independently of a tenant session.',
    description: "Alternate flow 1 of UC-about (About): \"The page can be read independently of a tenant session.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/about.html', expected_status: 200, expected_body_contains: "About", description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","about"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-about-EXC-1",
    name: "UC-about exc flow 1: A failed static load is not replaced with unrelated marketing content.",
    objective: 'Check that "About" fails safely: a failed static load is not replaced with unrelated marketing content.',
    description: "Exception flow 1 of UC-about (About): \"A failed static load is not replaced with unrelated marketing content.\" No backing API is registered for this use case, so this claim is evidenced only by the plain navigation above succeeding without needing any session/Authorization header.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/about.html', expected_status: 200, expected_body_contains: "About", description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","about"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-applicationEvents-MAIN",
    name: "UC-applicationEvents main flow: Application Events",
    objective: 'Walk through the "Application Events" screen the way its main use case describes it: operator opens Application Events. System requests the latest event collection. Operator filters by event, outcome or available screen/action context. System shows matching rows with time, actor and request identifiers where present.',
    description: "Main flow of UC-applicationEvents (Application Events): Operator opens Application Events. System requests the latest event collection. Operator filters by event, outcome or available screen/action context. System shows matching rows with time, actor and request identifiers where present. Touches the screen's real route and its registered API(s): GET /api/v1/events.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/application-events.html', expected_status: 200, expected_body_contains: 'data-sbe-page="applicationEvents"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/events" }
    ],
    tags: ["usecase","sand-bench","main-flow","applicationEvents"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-applicationEvents-ALT-1",
    name: "UC-applicationEvents alt flow 1: No matches is distinct from no captured events.",
    objective: 'Check an alternative path of "Application Events": no matches is distinct from no captured events.',
    description: "Alternate flow 1 of UC-applicationEvents (Application Events): \"No matches is distinct from no captured events.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/application-events.html', expected_status: 200, expected_body_contains: 'data-sbe-page="applicationEvents"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/events" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","applicationEvents"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-applicationEvents-ALT-2",
    name: "UC-applicationEvents alt flow 2: Missing actor or request context is displayed as unavailable.",
    objective: 'Check an alternative path of "Application Events": missing actor or request context is displayed as unavailable.',
    description: "Alternate flow 2 of UC-applicationEvents (Application Events): \"Missing actor or request context is displayed as unavailable.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/application-events.html', expected_status: 200, expected_body_contains: 'data-sbe-page="applicationEvents"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","applicationEvents"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-applicationEvents-EXC-1",
    name: "UC-applicationEvents exc flow 1: A fetch failure is not proof of zero events.",
    objective: 'Check that "Application Events" fails safely: a fetch failure is not proof of zero events.',
    description: "Exception flow 1 of UC-applicationEvents (Application Events): \"A fetch failure is not proof of zero events.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/application-events.html', expected_status: 200, expected_body_contains: 'data-sbe-page="applicationEvents"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","applicationEvents"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-applicationEvents-EXC-2",
    name: "UC-applicationEvents exc flow 2: The memory fallback must not be assumed equivalent to tenant-filtered ",
    objective: 'Check that "Application Events" fails safely: the memory fallback must not be assumed equivalent to tenant-filtered database results.',
    description: "Exception flow 2 of UC-applicationEvents (Application Events): \"The memory fallback must not be assumed equivalent to tenant-filtered database results.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/application-events.html', expected_status: 200, expected_body_contains: 'data-sbe-page="applicationEvents"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/events" }
    ],
    tags: ["usecase","sand-bench","exception-flow","applicationEvents"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationApiAccess-MAIN",
    name: "UC-configurationApiAccess main flow: API access",
    objective: 'Walk through the "API access" screen the way its main use case describes it: administrator opens application service access. System shows the current supported policy or identifies preview-only text. Administrator reviews the intended enablement and credential scope. Any supported change must report its effective result independently of credential creation.',
    description: "Main flow of UC-configurationApiAccess (API access): Administrator opens API access. System shows the current supported policy or identifies preview-only text. Administrator reviews the intended enablement and credential scope. Any supported change must report its effective result independently of credential creation. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-api-access.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationApiAccess"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","main-flow","configurationApiAccess"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-configurationApiAccess-ALT-1",
    name: "UC-configurationApiAccess alt flow 1: Keep programmatic access disabled.",
    objective: 'Check an alternative path of "API access": keep programmatic access disabled.',
    description: "Alternate flow 1 of UC-configurationApiAccess (API access): \"Keep programmatic access disabled.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-api-access.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationApiAccess"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","configurationApiAccess"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationApiAccess-ALT-2",
    name: "UC-configurationApiAccess alt flow 2: Session authentication remains a separate flow.",
    objective: 'Check an alternative path of "API access": session authentication remains a separate flow.',
    description: "Alternate flow 2 of UC-configurationApiAccess (API access): \"Session authentication remains a separate flow.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-api-access.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationApiAccess"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","configurationApiAccess"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationApiAccess-EXC-1",
    name: "UC-configurationApiAccess exc flow 1: An unwired toggle must not claim to create or revoke credentials.",
    objective: 'Check that "API access" fails safely: an unwired toggle must not claim to create or revoke credentials.',
    description: "Exception flow 1 of UC-configurationApiAccess (API access): \"An unwired toggle must not claim to create or revoke credentials.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-api-access.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationApiAccess"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","configurationApiAccess"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationApiAccess-EXC-2",
    name: "UC-configurationApiAccess exc flow 2: A failure cannot expose a fabricated API key.",
    objective: 'Check that "API access" fails safely: a failure cannot expose a fabricated application service key.',
    description: "Exception flow 2 of UC-configurationApiAccess (API access): \"A failure cannot expose a fabricated API key.\" No backing API is registered for this use case, so this claim is evidenced only by the plain navigation above succeeding without needing any session/Authorization header.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-api-access.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationApiAccess"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","configurationApiAccess"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationDataRetention-MAIN",
    name: "UC-configurationDataRetention main flow: Data retention",
    objective: 'Walk through the "Data retention" screen the way its main use case describes it: administrator opens Data retention. System identifies the displayed policy and covered data classes. Administrator reviews cutoff, timezone and exceptions before any policy change. A supported save confirms the policy; deletion evidence is reported separately.',
    description: "Main flow of UC-configurationDataRetention (Data retention): Administrator opens Data retention. System identifies the displayed policy and covered data classes. Administrator reviews cutoff, timezone and exceptions before any policy change. A supported save confirms the policy; deletion evidence is reported separately. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-data-retention.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationDataRetention"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","main-flow","configurationDataRetention"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-configurationDataRetention-ALT-1",
    name: "UC-configurationDataRetention alt flow 1: Keep existing retention until a policy is agreed.",
    objective: 'Check an alternative path of "Data retention": keep existing retention until a policy is agreed.',
    description: "Alternate flow 1 of UC-configurationDataRetention (Data retention): \"Keep existing retention until a policy is agreed.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-data-retention.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationDataRetention"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","configurationDataRetention"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationDataRetention-ALT-2",
    name: "UC-configurationDataRetention alt flow 2: Legal holds or explicit exceptions require separate policy decisions.",
    objective: 'Check an alternative path of "Data retention": legal holds or explicit exceptions require separate policy decisions.',
    description: "Alternate flow 2 of UC-configurationDataRetention (Data retention): \"Legal holds or explicit exceptions require separate policy decisions.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-data-retention.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationDataRetention"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","configurationDataRetention"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationDataRetention-EXC-1",
    name: "UC-configurationDataRetention exc flow 1: A 90-day caption cannot prove records were deleted.",
    objective: 'Check that "Data retention" fails safely: a 90-day caption cannot prove records were deleted.',
    description: "Exception flow 1 of UC-configurationDataRetention (Data retention): \"A 90-day caption cannot prove records were deleted.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-data-retention.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationDataRetention"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","configurationDataRetention"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationDataRetention-EXC-2",
    name: "UC-configurationDataRetention exc flow 2: Failed deletion must not be reported as completed cleanup.",
    objective: 'Check that "Data retention" fails safely: failed deletion must not be reported as completed cleanup.',
    description: "Exception flow 2 of UC-configurationDataRetention (Data retention): \"Failed deletion must not be reported as completed cleanup.\" No backing API is registered for this use case, so this claim is evidenced only by the plain navigation above succeeding without needing any session/Authorization header.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-data-retention.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationDataRetention"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","configurationDataRetention"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationEnvironmentDefaults-MAIN",
    name: "UC-configurationEnvironmentDefaults main flow: Environment defaults",
    objective: 'Walk through the "Environment defaults" screen the way its main use case describes it: administrator opens Environment defaults. System shows the available default or clearly labels preview-only content. Administrator reviews the effect on future runs. A supported save must confirm the effective value before it is relied on.',
    description: "Main flow of UC-configurationEnvironmentDefaults (Environment defaults): Administrator opens Environment defaults. System shows the available default or clearly labels preview-only content. Administrator reviews the effect on future runs. A supported save must confirm the effective value before it is relied on. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-environment-defaults.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationEnvironmentDefaults"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","main-flow","configurationEnvironmentDefaults"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-configurationEnvironmentDefaults-ALT-1",
    name: "UC-configurationEnvironmentDefaults alt flow 1: Keep the current environment unchanged.",
    objective: 'Check an alternative path of "Environment defaults": keep the current environment unchanged.',
    description: "Alternate flow 1 of UC-configurationEnvironmentDefaults (Environment defaults): \"Keep the current environment unchanged.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-environment-defaults.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationEnvironmentDefaults"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","configurationEnvironmentDefaults"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationEnvironmentDefaults-ALT-2",
    name: "UC-configurationEnvironmentDefaults alt flow 2: An individual run can use an explicit target where that run contract s",
    objective: 'Check an alternative path of "Environment defaults": an individual run can use an explicit target where that run contract supports it.',
    description: "Alternate flow 2 of UC-configurationEnvironmentDefaults (Environment defaults): \"An individual run can use an explicit target where that run contract supports it.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-environment-defaults.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationEnvironmentDefaults"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","configurationEnvironmentDefaults"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationEnvironmentDefaults-EXC-1",
    name: "UC-configurationEnvironmentDefaults exc flow 1: No write binding means no persisted-default claim.",
    objective: 'Check that "Environment defaults" fails safely: no write binding means no persisted-default claim.',
    description: "Exception flow 1 of UC-configurationEnvironmentDefaults (Environment defaults): \"No write binding means no persisted-default claim.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-environment-defaults.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationEnvironmentDefaults"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","configurationEnvironmentDefaults"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationEnvironmentDefaults-EXC-2",
    name: "UC-configurationEnvironmentDefaults exc flow 2: A change must not imply existing or running jobs were retargeted.",
    objective: 'Check that "Environment defaults" fails safely: a change must not imply existing or running jobs were retargeted.',
    description: "Exception flow 2 of UC-configurationEnvironmentDefaults (Environment defaults): \"A change must not imply existing or running jobs were retargeted.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-environment-defaults.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationEnvironmentDefaults"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","configurationEnvironmentDefaults"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationNotifications-MAIN",
    name: "UC-configurationNotifications main flow: Notifications",
    objective: 'Walk through the "Notifications" screen the way its main use case describes it: administrator opens Notifications. System identifies the available notification preferences. Administrator selects event categories and supported delivery channels. A supported save confirms preferences; actual delivery is reviewed separately.',
    description: "Main flow of UC-configurationNotifications (Notifications): Administrator opens Notifications. System identifies the available notification preferences. Administrator selects event categories and supported delivery channels. A supported save confirms preferences; actual delivery is reviewed separately. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-notifications.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationNotifications"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","main-flow","configurationNotifications"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-configurationNotifications-ALT-1",
    name: "UC-configurationNotifications alt flow 1: Disable a supported notification category.",
    objective: 'Check an alternative path of "Notifications": disable a supported notification category.',
    description: "Alternate flow 1 of UC-configurationNotifications (Notifications): \"Disable a supported notification category.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-notifications.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationNotifications"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","configurationNotifications"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationNotifications-ALT-2",
    name: "UC-configurationNotifications alt flow 2: In-app and email delivery can have different availability.",
    objective: 'Check an alternative path of "Notifications": in-app and email delivery can have different availability.',
    description: "Alternate flow 2 of UC-configurationNotifications (Notifications): \"In-app and email delivery can have different availability.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-notifications.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationNotifications"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","configurationNotifications"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationNotifications-EXC-1",
    name: "UC-configurationNotifications exc flow 1: Invalid recipients need an explicit validation result.",
    objective: 'Check that "Notifications" fails safely: invalid recipients need an explicit validation result.',
    description: "Exception flow 1 of UC-configurationNotifications (Notifications): \"Invalid recipients need an explicit validation result.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-notifications.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationNotifications"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","configurationNotifications"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationNotifications-EXC-2",
    name: "UC-configurationNotifications exc flow 2: A saved preference does not mean a notification was delivered.",
    objective: 'Check that "Notifications" fails safely: a saved preference does not mean a notification was delivered.',
    description: "Exception flow 2 of UC-configurationNotifications (Notifications): \"A saved preference does not mean a notification was delivered.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-notifications.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationNotifications"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","configurationNotifications"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationUserRoles-MAIN",
    name: "UC-configurationUserRoles main flow: User roles",
    objective: 'Walk through the "User roles" screen the way its main use case describes it: operator opens User roles under Configuration. System displays the available role setting or clearly labelled informational row. Operator follows a supported access-management path where available. Actual assignments are reviewed using their registered contract.',
    description: "Main flow of UC-configurationUserRoles (User roles): Operator opens User roles under Configuration. System displays the available role setting or clearly labelled informational row. Operator follows a supported access-management path where available. Actual assignments are reviewed using their registered contract. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-user-roles.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationUserRoles"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","main-flow","configurationUserRoles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-configurationUserRoles-ALT-1",
    name: "UC-configurationUserRoles alt flow 1: The operator reads the role summary without changing anything.",
    objective: 'Check an alternative path of "User roles": the operator reads the role summary without changing anything.',
    description: "Alternate flow 1 of UC-configurationUserRoles (User roles): \"The operator reads the role summary without changing anything.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-user-roles.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationUserRoles"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","configurationUserRoles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationUserRoles-ALT-2",
    name: "UC-configurationUserRoles alt flow 2: Functional and data access profiles are inspected separately.",
    objective: 'Check an alternative path of "User roles": functional and data access profiles are inspected separately.',
    description: "Alternate flow 2 of UC-configurationUserRoles (User roles): \"Functional and data access profiles are inspected separately.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-user-roles.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationUserRoles"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","configurationUserRoles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationUserRoles-EXC-1",
    name: "UC-configurationUserRoles exc flow 1: A generic on/off row cannot create roles.",
    objective: 'Check that "User roles" fails safely: a generic on/off row cannot create roles.',
    description: "Exception flow 1 of UC-configurationUserRoles (User roles): \"A generic on/off row cannot create roles.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-user-roles.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationUserRoles"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","configurationUserRoles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-configurationUserRoles-EXC-2",
    name: "UC-configurationUserRoles exc flow 2: Role labels must not imply assignments that were never loaded.",
    objective: 'Check that "User roles" fails safely: role labels must not imply assignments that were never loaded.',
    description: "Exception flow 2 of UC-configurationUserRoles (User roles): \"Role labels must not imply assignments that were never loaded.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-user-roles.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationUserRoles"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","configurationUserRoles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-dsAll-MAIN",
    name: "UC-dsAll main flow: Datasets",
    objective: 'Walk through the "Datasets" screen the way its main use case describes it: operator opens Datasets; system retrieves tenant records. Operator reviews each dataset identity and available type, count and state. Operator selects a dataset for inspection or later test-case assignment. System carries its stable identity into the supported next workflow.',
    description: "Main flow of UC-dsAll (Datasets): Operator opens Datasets; system retrieves tenant records. Operator reviews each dataset identity and available type, count and state. Operator selects a dataset for inspection or later test-case assignment. System carries its stable identity into the supported next workflow. Touches the screen's real route and its registered API(s): GET /api/v1/datasets.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/datasets.html', expected_status: 200, expected_body_contains: 'data-sbe-page="dsAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/datasets', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/datasets" }
    ],
    tags: ["usecase","sand-bench","main-flow","dsAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-dsAll-ALT-1",
    name: "UC-dsAll alt flow 1: New dataset opens creation.",
    objective: 'Check an alternative path of "Datasets": new dataset opens creation.',
    description: "Alternate flow 1 of UC-dsAll (Datasets): \"New dataset opens creation.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/datasets.html', expected_status: 200, expected_body_contains: 'data-sbe-page="dsAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/datasets', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/datasets" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","dsAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-dsAll-ALT-2",
    name: "UC-dsAll alt flow 2: A shell with no assembled rows remains visible as zero rows.",
    objective: 'Check an alternative path of "Datasets": a shell with no assembled rows remains visible as zero rows.',
    description: "Alternate flow 2 of UC-dsAll (Datasets): \"A shell with no assembled rows remains visible as zero rows.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/datasets.html', expected_status: 200, expected_body_contains: 'data-sbe-page="dsAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/datasets', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/datasets" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","dsAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-dsAll-EXC-1",
    name: "UC-dsAll exc flow 1: Failed retrieval is not evidence of an empty tenant.",
    objective: 'Check that "Datasets" fails safely: failed retrieval is not evidence of an empty tenant.',
    description: "Exception flow 1 of UC-dsAll (Datasets): \"Failed retrieval is not evidence of an empty tenant.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/datasets.html', expected_status: 200, expected_body_contains: 'data-sbe-page="dsAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/datasets', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","dsAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-dsAll-EXC-2",
    name: "UC-dsAll exc flow 2: A removed dataset reference is reported when reused.",
    objective: 'Check that "Datasets" fails safely: a removed dataset reference is reported when reused.',
    description: "Exception flow 2 of UC-dsAll (Datasets): \"A removed dataset reference is reported when reused.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/datasets.html', expected_status: 200, expected_body_contains: 'data-sbe-page="dsAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/datasets', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/datasets" }
    ],
    tags: ["usecase","sand-bench","exception-flow","dsAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-featureIds-MAIN",
    name: "UC-featureIds main flow: Feature IDs",
    objective: 'Walk through the "Feature IDs" screen the way its main use case describes it: administrator opens Feature IDs. System loads feature pages and displays FTR identifiers, labels, level, kind and overlays. Administrator inspects a row and its source level. Any attempted level update reports the actual application service result.',
    description: "Main flow of UC-featureIds (Feature IDs): Administrator opens Feature IDs. System loads feature pages and displays FTR identifiers, labels, level, kind and overlays. Administrator inspects a row and its source level. Any attempted level update reports the actual API result. Touches the screen's real route and its registered API(s): GET /api/v1/features.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/feature-ids.html', expected_status: 200, expected_body_contains: 'data-sbe-page="featureIds"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/features', headers: BEARER, expected_status: 200, expect_json: [{ path: "pages", exists: true }, { path: "profiles", exists: true }], description: "/api/v1/features" }
    ],
    tags: ["usecase","sand-bench","main-flow","featureIds"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-featureIds-ALT-1",
    name: "UC-featureIds alt flow 1: The catalogue can be inspected without edits.",
    objective: 'Check an alternative path of "Feature IDs": the catalogue can be inspected without edits.',
    description: "Alternate flow 1 of UC-featureIds (Feature IDs): \"The catalogue can be inspected without edits.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/feature-ids.html', expected_status: 200, expected_body_contains: 'data-sbe-page="featureIds"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/features', headers: BEARER, expected_status: 200, expect_json: [{ path: "pages", exists: true }, { path: "profiles", exists: true }], description: "/api/v1/features" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","featureIds"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-featureIds-ALT-2",
    name: "UC-featureIds alt flow 2: No catalogue availability produces an explicit unavailable state.",
    objective: 'Check an alternative path of "Feature IDs": no catalogue availability produces an explicit unavailable state.',
    description: "Alternate flow 2 of UC-featureIds (Feature IDs): \"No catalogue availability produces an explicit unavailable state.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/feature-ids.html', expected_status: 200, expected_body_contains: 'data-sbe-page="featureIds"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/features', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","featureIds"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-featureIds-EXC-1",
    name: "UC-featureIds exc flow 1: The row-specific PATCH used by the UI is not registered in the inspect",
    objective: 'Check that "Feature IDs" fails safely: the row-specific update used by the screen is not registered in the inspected feature module.',
    description: "Exception flow 1 of UC-featureIds (Feature IDs): \"The row-specific PATCH used by the UI is not registered in the inspected feature module.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/feature-ids.html', expected_status: 200, expected_body_contains: 'data-sbe-page="featureIds"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/features', headers: BEARER, expected_status: 200, expect_json: [{ path: "pages", exists: true }, { path: "profiles", exists: true }], description: "/api/v1/features" }
    ],
    tags: ["usecase","sand-bench","exception-flow","featureIds"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-featureIds-EXC-2",
    name: "UC-featureIds exc flow 2: A failed update keeps the prior confirmed level.",
    objective: 'Check that "Feature IDs" fails safely: a failed update keeps the prior confirmed level.',
    description: "Exception flow 2 of UC-featureIds (Feature IDs): \"A failed update keeps the prior confirmed level.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/feature-ids.html', expected_status: 200, expected_body_contains: 'data-sbe-page="featureIds"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/features', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","featureIds"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-help-MAIN",
    name: "UC-help main flow: Help",
    objective: 'Walk through the "Help" screen the way its main use case describes it: operator opens Help. System displays available topics and shortcuts. Operator searches or selects a topic. System shows the matching topic and an available return path.',
    description: "Main flow of UC-help (Help): Operator opens Help. System displays available topics and shortcuts. Operator searches or selects a topic. System shows the matching topic and an available return path. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/help.html', expected_status: 200, expected_body_contains: "Help", description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","main-flow","help"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-help-ALT-1",
    name: "UC-help alt flow 1: An unmatched search reports no matching topic.",
    objective: 'Check an alternative path of "Help": an unmatched search reports no matching topic.',
    description: "Alternate flow 1 of UC-help (Help): \"An unmatched search reports no matching topic.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/help.html', expected_status: 200, expected_body_contains: "Help", description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","help"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-help-ALT-2",
    name: "UC-help alt flow 2: The standalone help page is usable without assuming console draft stat",
    objective: 'Check an alternative path of "Help": the standalone help page is usable without assuming console draft state.',
    description: "Alternate flow 2 of UC-help (Help): \"The standalone help page is usable without assuming console draft state.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/help.html', expected_status: 200, expected_body_contains: "Help", description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","help"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-help-EXC-1",
    name: "UC-help exc flow 1: A missing topic asset is disclosed.",
    objective: 'Check that "Help" fails safely: a missing topic asset is disclosed.',
    description: "Exception flow 1 of UC-help (Help): \"A missing topic asset is disclosed.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/help.html', expected_status: 200, expected_body_contains: "Help", description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","help"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-help-EXC-2",
    name: "UC-help exc flow 2: A keyboard shortcut in a text field must not unexpectedly trigger a de",
    objective: 'Check that "Help" fails safely: a keyboard shortcut in a text field must not unexpectedly trigger a destructive action.',
    description: "Exception flow 2 of UC-help (Help): \"A keyboard shortcut in a text field must not unexpectedly trigger a destructive action.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/help.html', expected_status: 200, expected_body_contains: "Help", description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","help"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerFamily-MAIN",
    name: "UC-messageDesignerFamily main flow: Choose a message family",
    objective: 'Walk through the "Choose a message family" screen the way its main use case describes it: analyst opens the family step. System groups available message types by family. Analyst selects a family tile. System opens the message step scoped to that family.',
    description: "Main flow of UC-messageDesignerFamily (Choose a message family): Analyst opens the family step. System groups available message types by family. Analyst selects a family tile. System opens the message step scoped to that family. Touches the screen's real route and its registered API(s): GET /api/v1/catalog/designer-types.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 1: choose)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","main-flow","messageDesignerFamily"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-messageDesignerFamily-ALT-1",
    name: "UC-messageDesignerFamily alt flow 1: A schema handoff bypasses this selection with explicit source context.",
    objective: 'Check an alternative path of "Choose a message family": a schema handoff bypasses this selection with explicit source context.',
    description: "Alternate flow 1 of UC-messageDesignerFamily (Choose a message family): \"A schema handoff bypasses this selection with explicit source context.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 1: choose)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","messageDesignerFamily"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerFamily-ALT-2",
    name: "UC-messageDesignerFamily alt flow 2: Start over clears a previous family before a fresh selection.",
    objective: 'Check an alternative path of "Choose a message family": start over clears a previous family before a fresh selection.',
    description: "Alternate flow 2 of UC-messageDesignerFamily (Choose a message family): \"Start over clears a previous family before a fresh selection.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 1: choose)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","messageDesignerFamily"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerFamily-EXC-1",
    name: "UC-messageDesignerFamily exc flow 1: A failed load is not an empty catalogue.",
    objective: 'Check that "Choose a message family" fails safely: a failed load is not an empty catalogue.',
    description: "Exception flow 1 of UC-messageDesignerFamily (Choose a message family): \"A failed load is not an empty catalogue.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 1: choose)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","messageDesignerFamily"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerFamily-EXC-2",
    name: "UC-messageDesignerFamily exc flow 2: A family with no usable type cannot create a fabricated message choice",
    objective: 'Check that "Choose a message family" fails safely: a family with no usable type cannot create a fabricated message choice.',
    description: "Exception flow 2 of UC-messageDesignerFamily (Choose a message family): \"A family with no usable type cannot create a fabricated message choice.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 1: choose)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","exception-flow","messageDesignerFamily"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerFields-MAIN",
    name: "UC-messageDesignerFields main flow: Select fields",
    objective: 'Walk through the "Select fields" screen the way its main use case describes it: system displays the selected message field hierarchy. Analyst expands branches and inspects paths. Analyst includes or excludes optional fields; required fields stay selected. Analyst reviews the selection and continues to the workspace.',
    description: "Main flow of UC-messageDesignerFields (Select fields): System displays the selected message field hierarchy. Analyst expands branches and inspects paths. Analyst includes or excludes optional fields; required fields stay selected. Analyst reviews the selection and continues to the workspace. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 2: build)' }
    ],
    tags: ["usecase","sand-bench","main-flow","messageDesignerFields"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-messageDesignerFields-ALT-1",
    name: "UC-messageDesignerFields alt flow 1: Back returns to message selection.",
    objective: 'Check an alternative path of "Select fields": back returns to message selection.',
    description: "Alternate flow 1 of UC-messageDesignerFields (Select fields): \"Back returns to message selection.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 2: build)' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","messageDesignerFields"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerFields-ALT-2",
    name: "UC-messageDesignerFields alt flow 2: Draft-save controls, where offered, must describe what is actually per",
    objective: 'Check an alternative path of "Select fields": draft-save controls, where offered, must describe what is actually persisted.',
    description: "Alternate flow 2 of UC-messageDesignerFields (Select fields): \"Draft-save controls, where offered, must describe what is actually persisted.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 2: build)' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","messageDesignerFields"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerFields-EXC-1",
    name: "UC-messageDesignerFields exc flow 1: An empty model is not populated with example fields.",
    objective: 'Check that "Select fields" fails safely: an empty model is not populated with example fields.',
    description: "Exception flow 1 of UC-messageDesignerFields (Select fields): \"An empty model is not populated with example fields.\" No backing API is registered for this use case; this claim is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 2: build)' }
    ],
    tags: ["usecase","sand-bench","exception-flow","messageDesignerFields"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerFields-EXC-2",
    name: "UC-messageDesignerFields exc flow 2: Unresolved required content prevents a claim that the selection is sch",
    objective: 'Check that "Select fields" fails safely: unresolved required content prevents a claim that the selection is schema-valid.',
    description: "Exception flow 2 of UC-messageDesignerFields (Select fields): \"Unresolved required content prevents a claim that the selection is schema-valid.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 2: build)' }
    ],
    tags: ["usecase","sand-bench","exception-flow","messageDesignerFields"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerMessage-MAIN",
    name: "UC-messageDesignerMessage main flow: Choose a message",
    objective: 'Walk through the "Choose a message" screen the way its main use case describes it: system lists message tiles for the chosen family. Analyst reviews code, parsed-field information and available version context. Analyst selects one message. System opens its field model; Back returns to the family step.',
    description: "Main flow of UC-messageDesignerMessage (Choose a message): System lists message tiles for the chosen family. Analyst reviews code, parsed-field information and available version context. Analyst selects one message. System opens its field model; Back returns to the family step. Touches the screen's real route and its registered API(s): GET /api/v1/catalog/designer-types.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 1b: choose a message, within choose)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","main-flow","messageDesignerMessage"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-messageDesignerMessage-ALT-1",
    name: "UC-messageDesignerMessage alt flow 1: Back allows a different family choice.",
    objective: 'Check an alternative path of "Choose a message": back allows a different family choice.',
    description: "Alternate flow 1 of UC-messageDesignerMessage (Choose a message): \"Back allows a different family choice.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 1b: choose a message, within choose)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","messageDesignerMessage"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerMessage-ALT-2",
    name: "UC-messageDesignerMessage alt flow 2: A tile with no fields discloses that limitation before the empty field",
    objective: 'Check an alternative path of "Choose a message": a tile with no fields discloses that limitation before the empty field step.',
    description: "Alternate flow 2 of UC-messageDesignerMessage (Choose a message): \"A tile with no fields discloses that limitation before the empty field step.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 1b: choose a message, within choose)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","messageDesignerMessage"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerMessage-EXC-1",
    name: "UC-messageDesignerMessage exc flow 1: An unavailable type is not replaced with the first type in the catalog",
    objective: 'Check that "Choose a message" fails safely: an unavailable type is not replaced with the first type in the catalogue.',
    description: "Exception flow 1 of UC-messageDesignerMessage (Choose a message): \"An unavailable type is not replaced with the first type in the catalogue.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 1b: choose a message, within choose)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","messageDesignerMessage"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-messageDesignerMessage-EXC-2",
    name: "UC-messageDesignerMessage exc flow 2: Two versions sharing a label need a disambiguating identity.",
    objective: 'Check that "Choose a message" fails safely: two versions sharing a label need a disambiguating identity.',
    description: "Exception flow 2 of UC-messageDesignerMessage (Choose a message): \"Two versions sharing a label need a disambiguating identity.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer.html', expected_status: 200, expected_body_contains: 'data-sbe-page="messageDesigner"', description: 'load host screen (wizard step 1b: choose a message, within choose)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","exception-flow","messageDesignerMessage"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgDataFiles-MAIN",
    name: "UC-msgDataFiles main flow: Saved test data files",
    objective: 'Walk through the "Saved test data files" screen the way its main use case describes it: operator opens saved test data files. System lists actual saved batch metadata. Operator inspects message type and confirmed message count. Operator selects an available batch for a supported test workflow.',
    description: "Main flow of UC-msgDataFiles (Saved test data files): Operator opens saved test data files. System lists actual saved batch metadata. Operator inspects message type and confirmed message count. Operator selects an available batch for a supported test workflow. Touches the screen's real route and its registered API(s): GET /api/v1/data-files, GET /api/v1/generated-messages.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-data-files.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgDataFiles"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/data-files', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/data-files" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/generated-messages', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/generated-messages" }
    ],
    tags: ["usecase","sand-bench","main-flow","msgDataFiles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-msgDataFiles-ALT-1",
    name: "UC-msgDataFiles alt flow 1: An empty library directs the analyst to generate and save data.",
    objective: 'Check an alternative path of "Saved test data files": an empty library directs the analyst to generate and save data.',
    description: "Alternate flow 1 of UC-msgDataFiles (Saved test data files): \"An empty library directs the analyst to generate and save data.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-data-files.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgDataFiles"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/data-files', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/data-files" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/generated-messages', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/generated-messages" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","msgDataFiles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgDataFiles-ALT-2",
    name: "UC-msgDataFiles alt flow 2: A batch may be inspected without sending it.",
    objective: 'Check an alternative path of "Saved test data files": a batch may be inspected without sending it.',
    description: "Alternate flow 2 of UC-msgDataFiles (Saved test data files): \"A batch may be inspected without sending it.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-data-files.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgDataFiles"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/data-files', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/data-files" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/generated-messages', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/generated-messages" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","msgDataFiles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgDataFiles-EXC-1",
    name: "UC-msgDataFiles exc flow 1: A missing batch cannot be replaced silently with newly randomised data",
    objective: 'Check that "Saved test data files" fails safely: a missing batch cannot be replaced silently with newly randomised data.',
    description: "Exception flow 1 of UC-msgDataFiles (Saved test data files): \"A missing batch cannot be replaced silently with newly randomised data.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-data-files.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgDataFiles"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/data-files', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/data-files" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/generated-messages', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/generated-messages" }
    ],
    tags: ["usecase","sand-bench","exception-flow","msgDataFiles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgDataFiles-EXC-2",
    name: "UC-msgDataFiles exc flow 2: An incomplete generation displays the confirmed count and available st",
    objective: 'Check that "Saved test data files" fails safely: an incomplete generation displays the confirmed count and available state.',
    description: "Exception flow 2 of UC-msgDataFiles (Saved test data files): \"An incomplete generation displays the confirmed count and available state.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-data-files.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgDataFiles"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/data-files', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/data-files" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/generated-messages', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/generated-messages" }
    ],
    tags: ["usecase","sand-bench","exception-flow","msgDataFiles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgSchemaRegister-MAIN",
    name: "UC-msgSchemaRegister main flow: Schema register",
    objective: 'Walk through the "Schema register" screen the way its main use case describes it: analyst opens Schema register. System loads upload and designer-type information. Analyst reviews code, family, state and available field count. Analyst selects a usable entry and requests the designer handoff.',
    description: "Main flow of UC-msgSchemaRegister (Schema register): Analyst opens Schema register. System loads upload and designer-type information. Analyst reviews code, family, state and available field count. Analyst selects a usable entry and requests the designer handoff. Touches the screen's real route and its registered API(s): GET /api/v1/catalog/iso/uploads, GET /api/v1/catalog/designer-types.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-schema-register.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgSchemaRegister"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/iso/uploads', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/iso/uploads" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","main-flow","msgSchemaRegister"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-msgSchemaRegister-ALT-1",
    name: "UC-msgSchemaRegister alt flow 1: No entries prompts import or creation.",
    objective: 'Check an alternative path of "Schema register": no entries prompts import or creation.',
    description: "Alternate flow 1 of UC-msgSchemaRegister (Schema register): \"No entries prompts import or creation.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-schema-register.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgSchemaRegister"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/iso/uploads', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/iso/uploads" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","msgSchemaRegister"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgSchemaRegister-ALT-2",
    name: "UC-msgSchemaRegister alt flow 2: A not-ready entry remains visible with its limitation.",
    objective: 'Check an alternative path of "Schema register": a not-ready entry remains visible with its limitation.',
    description: "Alternate flow 2 of UC-msgSchemaRegister (Schema register): \"A not-ready entry remains visible with its limitation.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-schema-register.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgSchemaRegister"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/iso/uploads', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/iso/uploads" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","msgSchemaRegister"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgSchemaRegister-EXC-1",
    name: "UC-msgSchemaRegister exc flow 1: A stale ready entry is checked when opened.",
    objective: 'Check that "Schema register" fails safely: a stale ready entry is checked when opened.',
    description: "Exception flow 1 of UC-msgSchemaRegister (Schema register): \"A stale ready entry is checked when opened.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-schema-register.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgSchemaRegister"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/iso/uploads', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/iso/uploads" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/designer-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/catalog/designer-types" }
    ],
    tags: ["usecase","sand-bench","exception-flow","msgSchemaRegister"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgSchemaRegister-EXC-2",
    name: "UC-msgSchemaRegister exc flow 2: A failed collection load must not be reported as successful emptiness.",
    objective: 'Check that "Schema register" fails safely: a failed collection load must not be reported as successful emptiness.',
    description: "Exception flow 2 of UC-msgSchemaRegister (Schema register): \"A failed collection load must not be reported as successful emptiness.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-schema-register.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgSchemaRegister"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/iso/uploads', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","msgSchemaRegister"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgViewSaved-MAIN",
    name: "UC-msgViewSaved main flow: Saved message definitions",
    objective: 'Walk through the "Saved message definitions" screen the way its main use case describes it: analyst opens Saved message definitions. System loads available definitions and source message types. Analyst identifies a definition by name, type and version. System opens the selected definition or provides its supported reuse path.',
    description: "Main flow of UC-msgViewSaved (Saved message definitions): Analyst opens Saved message definitions. System loads available definitions and source message types. Analyst identifies a definition by name, type and version. System opens the selected definition or provides its supported reuse path. Touches the screen's real route and its registered API(s): GET /api/v1/message-types, GET /api/v1/definitions.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-saved.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgViewSaved"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/message-types" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/definitions', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/definitions" }
    ],
    tags: ["usecase","sand-bench","main-flow","msgViewSaved"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-msgViewSaved-ALT-1",
    name: "UC-msgViewSaved alt flow 1: New definition starts the wizard.",
    objective: 'Check an alternative path of "Saved message definitions": new definition starts the wizard.',
    description: "Alternate flow 1 of UC-msgViewSaved (Saved message definitions): \"New definition starts the wizard.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-saved.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgViewSaved"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/message-types" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/definitions', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/definitions" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","msgViewSaved"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgViewSaved-ALT-2",
    name: "UC-msgViewSaved alt flow 2: A draft, if stored, is identified separately from a completed definiti",
    objective: 'Check an alternative path of "Saved message definitions": a draft, if stored, is identified separately from a completed definition.',
    description: "Alternate flow 2 of UC-msgViewSaved (Saved message definitions): \"A draft, if stored, is identified separately from a completed definition.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-saved.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgViewSaved"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/message-types" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/definitions', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/definitions" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","msgViewSaved"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgViewSaved-EXC-1",
    name: "UC-msgViewSaved exc flow 1: A missing source schema is disclosed when reopening.",
    objective: 'Check that "Saved message definitions" fails safely: a missing source schema is disclosed when reopening.',
    description: "Exception flow 1 of UC-msgViewSaved (Saved message definitions): \"A missing source schema is disclosed when reopening.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-saved.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgViewSaved"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/message-types" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/definitions', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/definitions" }
    ],
    tags: ["usecase","sand-bench","exception-flow","msgViewSaved"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-msgViewSaved-EXC-2",
    name: "UC-msgViewSaved exc flow 2: A load error is not represented as a successfully empty library.",
    objective: 'Check that "Saved message definitions" fails safely: a load error is not represented as a successfully empty library.',
    description: "Exception flow 2 of UC-msgViewSaved (Saved message definitions): \"A load error is not represented as a successfully empty library.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-saved.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgViewSaved"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/message-types" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/definitions', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/definitions" }
    ],
    tags: ["usecase","sand-bench","exception-flow","msgViewSaved"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-overview-MAIN",
    name: "UC-overview main flow: Overview",
    objective: 'Walk through the "Overview" screen the way its main use case describes it: operator opens Overview; the system requests the tenant bootstrap. System renders available run, message and rule counts with their observation context. Operator selects a summary or attention item; the system opens its configured page. Operator returns to Overview; the system refreshes available data without creating assets.',
    description: "Main flow of UC-overview (Overview): Operator opens Overview; the system requests the tenant bootstrap. System renders available run, message and rule counts with their observation context. Operator selects a summary or attention item; the system opens its configured page. Operator returns to Overview; the system refreshes available data without creating assets. Touches the screen's real route and its registered API(s): GET /api/v1/console/bootstrap, GET /api/v1/ux/first-run.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/overview.html', expected_status: 200, expected_body_contains: 'data-sbe-page="overview"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/console/bootstrap', headers: BEARER, expected_status: 200, expect_json: [{ path: "user", exists: true }, { path: "status", exists: true }], description: "/api/v1/console/bootstrap" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/ux/first-run', headers: BEARER, expected_status: 200, expect_json: [{ path: "lead", exists: true }, { path: "buyer", exists: true }], description: "/api/v1/ux/first-run" }
    ],
    tags: ["usecase","sand-bench","main-flow","overview"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-overview-ALT-1",
    name: "UC-overview alt flow 1: A genuinely empty tenant sees zero counts and creation links.",
    objective: 'Check an alternative path of "Overview": a genuinely empty tenant sees zero counts and creation links.',
    description: "Alternate flow 1 of UC-overview (Overview): \"A genuinely empty tenant sees zero counts and creation links.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/overview.html', expected_status: 200, expected_body_contains: 'data-sbe-page="overview"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/console/bootstrap', headers: BEARER, expected_status: 200, expect_json: [{ path: "user", exists: true }, { path: "status", exists: true }], description: "/api/v1/console/bootstrap" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/ux/first-run', headers: BEARER, expected_status: 200, expect_json: [{ path: "lead", exists: true }, { path: "buyer", exists: true }], description: "/api/v1/ux/first-run" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","overview"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-overview-ALT-2",
    name: "UC-overview alt flow 2: Operator changes the activity range where available; the displayed ran",
    objective: 'Check an alternative path of "Overview": operator changes the activity range where available; the displayed range must identify the data actually used.',
    description: "Alternate flow 2 of UC-overview (Overview): \"Operator changes the activity range where available; the displayed range must identify the data actually used.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/overview.html', expected_status: 200, expected_body_contains: 'data-sbe-page="overview"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/console/bootstrap', headers: BEARER, expected_status: 200, expect_json: [{ path: "user", exists: true }, { path: "status", exists: true }], description: "/api/v1/console/bootstrap" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/ux/first-run', headers: BEARER, expected_status: 200, expect_json: [{ path: "lead", exists: true }, { path: "buyer", exists: true }], description: "/api/v1/ux/first-run" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","overview"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-overview-EXC-1",
    name: "UC-overview exc flow 1: A failed bootstrap is an unavailable-data state, not evidence of zero ",
    objective: 'Check that "Overview" fails safely: a failed bootstrap is an unavailable-data state, not evidence of zero assets.',
    description: "Exception flow 1 of UC-overview (Overview): \"A failed bootstrap is an unavailable-data state, not evidence of zero assets.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/overview.html', expected_status: 200, expected_body_contains: 'data-sbe-page="overview"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/console/bootstrap', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","overview"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-overview-EXC-2",
    name: "UC-overview exc flow 2: An expired session requires sign-in before tenant statistics are treat",
    objective: 'Check that "Overview" fails safely: an expired session requires sign-in before tenant statistics are treated as current.',
    description: "Exception flow 2 of UC-overview (Overview): \"An expired session requires sign-in before tenant statistics are treated as current.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/overview.html', expected_status: 200, expected_body_contains: 'data-sbe-page="overview"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/console/bootstrap', headers: BEARER, expected_status: 200, expect_json: [{ path: "user", exists: true }, { path: "status", exists: true }], description: "/api/v1/console/bootstrap" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/ux/first-run', headers: BEARER, expected_status: 200, expect_json: [{ path: "lead", exists: true }, { path: "buyer", exists: true }], description: "/api/v1/ux/first-run" }
    ],
    tags: ["usecase","sand-bench","exception-flow","overview"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repAll-MAIN",
    name: "UC-repAll main flow: All reports",
    objective: 'Walk through the "All reports" screen the way its main use case describes it: operator opens All reports. System loads stored report records. Operator identifies the intended report by run and generation context. System opens the available report representation or explains missing content.',
    description: "Main flow of UC-repAll (All reports): Operator opens All reports. System loads stored report records. Operator identifies the intended report by run and generation context. System opens the available report representation or explains missing content. Touches the screen's real route and its registered API(s): GET /api/v1/reports.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","main-flow","repAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-repAll-ALT-1",
    name: "UC-repAll alt flow 1: A category-specific view narrows the same source collection.",
    objective: 'Check an alternative path of "All reports": a category-specific view narrows the same source collection.',
    description: "Alternate flow 1 of UC-repAll (All reports): \"A category-specific view narrows the same source collection.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repAll-ALT-2",
    name: "UC-repAll alt flow 2: No reports directs the operator to a supported run workflow.",
    objective: 'Check an alternative path of "All reports": no reports directs the operator to a supported run workflow.',
    description: "Alternate flow 2 of UC-repAll (All reports): \"No reports directs the operator to a supported run workflow.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repAll-EXC-1",
    name: "UC-repAll exc flow 1: Failed report retrieval is not proof that no reports exist.",
    objective: 'Check that "All reports" fails safely: failed report retrieval is not proof that no reports exist.',
    description: "Exception flow 1 of UC-repAll (All reports): \"Failed report retrieval is not proof that no reports exist.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","repAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repAll-EXC-2",
    name: "UC-repAll exc flow 2: A preview or placeholder document is not downloadable evidence of a ru",
    objective: 'Check that "All reports" fails safely: a preview or placeholder document is not downloadable evidence of a run.',
    description: "Exception flow 2 of UC-repAll (All reports): \"A preview or placeholder document is not downloadable evidence of a run.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","exception-flow","repAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repCompliance-MAIN",
    name: "UC-repCompliance main flow: Compliance reports",
    objective: 'Walk through the "Compliance reports" screen the way its main use case describes it: reviewer opens Compliance reports. System displays the report framework label, run context and actual outcome. Reviewer inspects supporting controls and failed or untested items. Reviewer records or performs the follow-up in the supported process.',
    description: "Main flow of UC-repCompliance (Compliance reports): Reviewer opens Compliance reports. System displays the report framework label, run context and actual outcome. Reviewer inspects supporting controls and failed or untested items. Reviewer records or performs the follow-up in the supported process. Touches the screen's real route and its registered API(s): GET /api/v1/reports.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-compliance.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repCompliance"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","main-flow","repCompliance"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-repCompliance-ALT-1",
    name: "UC-repCompliance alt flow 1: No framework evidence is shown as unavailable.",
    objective: 'Check an alternative path of "Compliance reports": no framework evidence is shown as unavailable.',
    description: "Alternate flow 1 of UC-repCompliance (Compliance reports): \"No framework evidence is shown as unavailable.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-compliance.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repCompliance"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repCompliance"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repCompliance-ALT-2",
    name: "UC-repCompliance alt flow 2: Review status remains visible until supported evidence changes it.",
    objective: 'Check an alternative path of "Compliance reports": review status remains visible until supported evidence changes it.',
    description: "Alternate flow 2 of UC-repCompliance (Compliance reports): \"Review status remains visible until supported evidence changes it.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-compliance.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repCompliance"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repCompliance"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repCompliance-EXC-1",
    name: "UC-repCompliance exc flow 1: An unsupported framework mapping is disclosed.",
    objective: 'Check that "Compliance reports" fails safely: an unsupported framework mapping is disclosed.',
    description: "Exception flow 1 of UC-repCompliance (Compliance reports): \"An unsupported framework mapping is disclosed.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-compliance.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repCompliance"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","exception-flow","repCompliance"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repCompliance-EXC-2",
    name: "UC-repCompliance exc flow 2: A Passed test badge cannot establish regulatory compliance by itself.",
    objective: 'Check that "Compliance reports" fails safely: a Passed test badge cannot establish regulatory compliance by itself.',
    description: "Exception flow 2 of UC-repCompliance (Compliance reports): \"A Passed test badge cannot establish regulatory compliance by itself.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-compliance.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repCompliance"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","exception-flow","repCompliance"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repCoverage-MAIN",
    name: "UC-repCoverage main flow: Coverage reports",
    objective: 'Walk through the "Coverage reports" screen the way its main use case describes it: analyst opens Coverage reports. System identifies the rule set and evidence period/version. System distinguishes tested, untested and unavailable results. Analyst inspects uncovered rules before planning additional tests.',
    description: "Main flow of UC-repCoverage (Coverage reports): Analyst opens Coverage reports. System identifies the rule set and evidence period/version. System distinguishes tested, untested and unavailable results. Analyst inspects uncovered rules before planning additional tests. Touches the screen's real route and its registered API(s): GET /api/v1/reports, GET /api/v1/rules.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-coverage.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repCoverage"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/rules" }
    ],
    tags: ["usecase","sand-bench","main-flow","repCoverage"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-repCoverage-ALT-1",
    name: "UC-repCoverage alt flow 1: No evidence is reported as unknown or untested.",
    objective: 'Check an alternative path of "Coverage reports": no evidence is reported as unknown or untested.',
    description: "Alternate flow 1 of UC-repCoverage (Coverage reports): \"No evidence is reported as unknown or untested.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-coverage.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repCoverage"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/rules" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repCoverage"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repCoverage-ALT-2",
    name: "UC-repCoverage alt flow 2: A partial run retains unevaluated cases in the denominator policy.",
    objective: 'Check an alternative path of "Coverage reports": a partial run retains unevaluated cases in the denominator policy.',
    description: "Alternate flow 2 of UC-repCoverage (Coverage reports): \"A partial run retains unevaluated cases in the denominator policy.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-coverage.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repCoverage"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/rules" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repCoverage"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repCoverage-EXC-1",
    name: "UC-repCoverage exc flow 1: Division by zero is not 100% coverage.",
    objective: 'Check that "Coverage reports" fails safely: division by zero is not 100% coverage.',
    description: "Exception flow 1 of UC-repCoverage (Coverage reports): \"Division by zero is not 100% coverage.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-coverage.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repCoverage"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/rules" }
    ],
    tags: ["usecase","sand-bench","exception-flow","repCoverage"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repCoverage-EXC-2",
    name: "UC-repCoverage exc flow 2: Missing or stale results are not silently counted as passed.",
    objective: 'Check that "Coverage reports" fails safely: missing or stale results are not silently counted as passed.',
    description: "Exception flow 2 of UC-repCoverage (Coverage reports): \"Missing or stale results are not silently counted as passed.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-coverage.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repCoverage"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/rules" }
    ],
    tags: ["usecase","sand-bench","exception-flow","repCoverage"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repRuns-MAIN",
    name: "UC-repRuns main flow: Test run reports",
    objective: 'Walk through the "Test run reports" screen the way its main use case describes it: operator selects a run context. System loads available reports and filters by the run reference. Operator opens a matching report. System retains the run identity while displaying the evidence.',
    description: "Main flow of UC-repRuns (Test run reports): Operator selects a run context. System loads available reports and filters by the run reference. Operator opens a matching report. System retains the run identity while displaying the evidence. Touches the screen's real route and its registered API(s): GET /api/v1/reports.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-runs.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repRuns"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","main-flow","repRuns"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-repRuns-ALT-1",
    name: "UC-repRuns alt flow 1: No matching report is a valid result.",
    objective: 'Check an alternative path of "Test run reports": no matching report is a valid result.',
    description: "Alternate flow 1 of UC-repRuns (Test run reports): \"No matching report is a valid result.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-runs.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repRuns"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repRuns"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repRuns-ALT-2",
    name: "UC-repRuns alt flow 2: All reports returns to the wider collection explicitly.",
    objective: 'Check an alternative path of "Test run reports": all reports returns to the wider collection explicitly.',
    description: "Alternate flow 2 of UC-repRuns (Test run reports): \"All reports returns to the wider collection explicitly.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-runs.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repRuns"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repRuns"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repRuns-EXC-1",
    name: "UC-repRuns exc flow 1: A missing run context must not silently show unrelated reports.",
    objective: 'Check that "Test run reports" fails safely: a missing run context must not silently show unrelated reports.',
    description: "Exception flow 1 of UC-repRuns (Test run reports): \"A missing run context must not silently show unrelated reports.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-runs.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repRuns"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","exception-flow","repRuns"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repRuns-EXC-2",
    name: "UC-repRuns exc flow 2: An unavailable report remains unavailable rather than replaced with th",
    objective: 'Check that "Test run reports" fails safely: an unavailable report remains unavailable rather than replaced with the newest report.',
    description: "Exception flow 2 of UC-repRuns (Test run reports): \"An unavailable report remains unavailable rather than replaced with the newest report.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-runs.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repRuns"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","repRuns"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repScheduled-MAIN",
    name: "UC-repScheduled main flow: Scheduled exports",
    objective: 'Walk through the "Scheduled exports" screen the way its main use case describes it: administrator opens Scheduled exports. System displays available configuration with report scope, destination and cadence. Administrator reviews the next occurrence and most recent actual delivery. Administrator uses only a supported creation or maintenance action.',
    description: "Main flow of UC-repScheduled (Scheduled exports): Administrator opens Scheduled exports. System displays available configuration with report scope, destination and cadence. Administrator reviews the next occurrence and most recent actual delivery. Administrator uses only a supported creation or maintenance action. Touches the screen's real route and its registered API(s): GET /api/v1/reports.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-scheduled.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repScheduled"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","main-flow","repScheduled"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-repScheduled-ALT-1",
    name: "UC-repScheduled alt flow 1: No configured export produces an empty state.",
    objective: 'Check an alternative path of "Scheduled exports": no configured export produces an empty state.',
    description: "Alternate flow 1 of UC-repScheduled (Scheduled exports): \"No configured export produces an empty state.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-scheduled.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repScheduled"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repScheduled"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repScheduled-ALT-2",
    name: "UC-repScheduled alt flow 2: A manual report download remains separate from recurring export.",
    objective: 'Check an alternative path of "Scheduled exports": a manual report download remains separate from recurring export.',
    description: "Alternate flow 2 of UC-repScheduled (Scheduled exports): \"A manual report download remains separate from recurring export.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-scheduled.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repScheduled"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repScheduled"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repScheduled-EXC-1",
    name: "UC-repScheduled exc flow 1: An invalid destination cannot be shown as a successful delivery.",
    objective: 'Check that "Scheduled exports" fails safely: an invalid destination cannot be shown as a successful delivery.',
    description: "Exception flow 1 of UC-repScheduled (Scheduled exports): \"An invalid destination cannot be shown as a successful delivery.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-scheduled.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repScheduled"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/reports" }
    ],
    tags: ["usecase","sand-bench","exception-flow","repScheduled"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repScheduled-EXC-2",
    name: "UC-repScheduled exc flow 2: A failed export must not be silently advanced as completed.",
    objective: 'Check that "Scheduled exports" fails safely: a failed export must not be silently advanced as completed.',
    description: "Exception flow 2 of UC-repScheduled (Scheduled exports): \"A failed export must not be silently advanced as completed.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-scheduled.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repScheduled"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/reports', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","repScheduled"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repSuites-MAIN",
    name: "UC-repSuites main flow: Test suite reports",
    objective: 'Walk through the "Test suite reports" screen the way its main use case describes it: reviewer opens suite evidence and enters the intended suite ID. System resolves the suite and its evidence source. Reviewer requests the package. System returns a supported representation with suite and result context. Reviewer opens the package and checks totals against included cases.',
    description: "Main flow of UC-repSuites (Test suite reports): Reviewer opens suite evidence and enters the intended suite ID. System resolves the suite and its evidence source. Reviewer requests the package. System returns a supported representation with suite and result context. Reviewer opens the package and checks totals against included cases. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-suites.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repSuites"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","main-flow","repSuites"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-repSuites-ALT-1",
    name: "UC-repSuites alt flow 1: An empty suite needs an explicit no-evidence outcome.",
    objective: 'Check an alternative path of "Test suite reports": an empty suite needs an explicit no-evidence outcome.',
    description: "Alternate flow 1 of UC-repSuites (Test suite reports): \"An empty suite needs an explicit no-evidence outcome.\" No backing API is registered for this use case; this claim is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-suites.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repSuites"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repSuites"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repSuites-ALT-2",
    name: "UC-repSuites alt flow 2: Offline readability does not by itself establish cryptographic integri",
    objective: 'Check an alternative path of "Test suite reports": offline readability does not by itself establish cryptographic integrity.',
    description: "Alternate flow 2 of UC-repSuites (Test suite reports): \"Offline readability does not by itself establish cryptographic integrity.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-suites.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repSuites"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","repSuites"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repSuites-EXC-1",
    name: "UC-repSuites exc flow 1: An unavailable endpoint or unknown suite cannot produce a successful e",
    objective: 'Check that "Test suite reports" fails safely: an unavailable endpoint or unknown suite cannot produce a successful empty pack.',
    description: "Exception flow 1 of UC-repSuites (Test suite reports): \"An unavailable endpoint or unknown suite cannot produce a successful empty pack.\" No backing API is registered for this use case, so this claim is evidenced only by the plain navigation above succeeding without needing any session/Authorization header.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-suites.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repSuites"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","repSuites"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-repSuites-EXC-2",
    name: "UC-repSuites exc flow 2: A live rerun must not replace historical evidence silently.",
    objective: 'Check that "Test suite reports" fails safely: a live rerun must not replace historical evidence silently.',
    description: "Exception flow 2 of UC-repSuites (Test suite reports): \"A live rerun must not replace historical evidence silently.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/reports-suites.html', expected_status: 200, expected_body_contains: 'data-sbe-page="repSuites"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","repSuites"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  ...ROLE_CREATE_FLOW_CASES,
  ...ROLES_FLOW_CASES,
  {
    key: "SB-UC-ruleBenchExisting-MAIN",
    name: "UC-ruleBenchExisting main flow: Existing rules",
    objective: 'Walk through the "Existing rules" screen the way its main use case describes it: analyst opens Existing rules; the system loads tenant rules. System shows each rule identity, condition, status and available validation evidence. Analyst opens a rule; the system retrieves that rule rather than a row-position substitute. Analyst chooses an allowed edit or lifecycle action, or returns without changing it.',
    description: "Main flow of UC-ruleBenchExisting (Existing rules): Analyst opens Existing rules; the system loads tenant rules. System shows each rule identity, condition, status and available validation evidence. Analyst opens a rule; the system retrieves that rule rather than a row-position substitute. Analyst chooses an allowed edit or lifecycle action, or returns without changing it. Touches the screen's real route and its registered API(s): GET /api/v1/rules.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-existing.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchExisting"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/rules" }
    ],
    tags: ["usecase","sand-bench","main-flow","ruleBenchExisting"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-ruleBenchExisting-ALT-1",
    name: "UC-ruleBenchExisting alt flow 1: An empty library offers Create new rule.",
    objective: 'Check an alternative path of "Existing rules": an empty library offers Create new rule.',
    description: "Alternate flow 1 of UC-ruleBenchExisting (Existing rules): \"An empty library offers Create new rule.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-existing.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchExisting"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/rules" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","ruleBenchExisting"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleBenchExisting-ALT-2",
    name: "UC-ruleBenchExisting alt flow 2: A view-only operator may inspect allowed data without being offered a ",
    objective: 'Check an alternative path of "Existing rules": a view-only operator may inspect allowed data without being offered a write.',
    description: "Alternate flow 2 of UC-ruleBenchExisting (Existing rules): \"A view-only operator may inspect allowed data without being offered a write.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-existing.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchExisting"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/rules" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","ruleBenchExisting"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleBenchExisting-EXC-1",
    name: "UC-ruleBenchExisting exc flow 1: A deleted rule selected from a stale list produces a not-found result.",
    objective: 'Check that "Existing rules" fails safely: a deleted rule selected from a stale list produces a not-found result.',
    description: "Exception flow 1 of UC-ruleBenchExisting (Existing rules): \"A deleted rule selected from a stale list produces a not-found result.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-existing.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchExisting"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/rules" }
    ],
    tags: ["usecase","sand-bench","exception-flow","ruleBenchExisting"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleBenchExisting-EXC-2",
    name: "UC-ruleBenchExisting exc flow 2: Missing validation evidence is shown as not validated, not 100% covera",
    objective: 'Check that "Existing rules" fails safely: missing validation evidence is shown as not validated, not 100% coverage.',
    description: "Exception flow 2 of UC-ruleBenchExisting (Existing rules): \"Missing validation evidence is shown as not validated, not 100% coverage.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-existing.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchExisting"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/rules" }
    ],
    tags: ["usecase","sand-bench","exception-flow","ruleBenchExisting"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleBenchExport-MAIN",
    name: "UC-ruleBenchExport main flow: Export rules",
    objective: 'Walk through the "Export rules" screen: an analyst reviews the available scope, requests a rule package, downloads it with a suitable filename, and checks identities and counts before reuse.',
    description: "Main flow of UC-ruleBenchExport (Export rules): Analyst opens Export rules and reviews the available scope. System identifies whether the action exports all tenant rules or a supported selection. Analyst requests export; the service returns the rule package. System downloads the returned representation with a suitable filename. Analyst checks identities and counts before reusing the package. Touches the screen's real route and its registered API(s): GET /api/v1/rules/export.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-export.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchExport"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules/export', headers: BEARER, expected_status: 200, expect_json: [{ path: "format", exists: true }, { path: "exportedAt", exists: true }], description: "/api/v1/rules/export" }
    ],
    tags: ["usecase","sand-bench","main-flow","ruleBenchExport"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-ruleBenchExport-ALT-1",
    name: "UC-ruleBenchExport alt flow 1: An empty catalogue produces the documented empty representation or an ",
    objective: 'Check an alternative path of "Export rules": an empty catalogue produces the documented empty representation or an explicit no-data outcome.',
    description: "Alternate flow 1 of UC-ruleBenchExport (Export rules): \"An empty catalogue produces the documented empty representation or an explicit no-data outcome.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-export.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchExport"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules/export', headers: BEARER, expected_status: 200, expect_json: [{ path: "format", exists: true }, { path: "exportedAt", exists: true }], description: "/api/v1/rules/export" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","ruleBenchExport"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleBenchExport-ALT-2",
    name: "UC-ruleBenchExport alt flow 2: A selection UI that is not honoured by the endpoint is identified as a",
    objective: 'Check an alternative path of "Export rules": a selection screen that is not honoured by the endpoint is identified as a gap.',
    description: "Alternate flow 2 of UC-ruleBenchExport (Export rules): \"A selection UI that is not honoured by the endpoint is identified as a gap.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-export.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchExport"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules/export', headers: BEARER, expected_status: 200, expect_json: [{ path: "format", exists: true }, { path: "exportedAt", exists: true }], description: "/api/v1/rules/export" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","ruleBenchExport"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleBenchExport-EXC-1",
    name: "UC-ruleBenchExport exc flow 1: A service error must not download an error body as a valid rule pack.",
    objective: 'Check that "Export rules" fails safely: a service error must not download an error body as a valid rule pack.',
    description: "Exception flow 1 of UC-ruleBenchExport (Export rules): \"A service error must not download an error body as a valid rule pack.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-export.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchExport"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules/export', headers: BEARER, expected_status: 200, expect_json: [{ path: "format", exists: true }, { path: "exportedAt", exists: true }], description: "/api/v1/rules/export" }
    ],
    tags: ["usecase","sand-bench","exception-flow","ruleBenchExport"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleBenchExport-EXC-2",
    name: "UC-ruleBenchExport exc flow 2: Unsupported XML conversion is not inferred from a prototype format col",
    objective: 'Check that "Export rules" fails safely: unsupported file-format conversion is not inferred from a prototype format column.',
    description: "Exception flow 2 of UC-ruleBenchExport (Export rules): \"Unsupported XML conversion is not inferred from a prototype format column.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-bench-export.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleBenchExport"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/rules/export', headers: BEARER, expected_status: 200, expect_json: [{ path: "format", exists: true }, { path: "exportedAt", exists: true }], description: "/api/v1/rules/export" }
    ],
    tags: ["usecase","sand-bench","exception-flow","ruleBenchExport"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleCanvas-MAIN",
    name: "UC-ruleCanvas main flow: Rule Canvas",
    objective: 'Walk through the "Rule Canvas" screen the way its main use case describes it: analyst opens the companion canvas from a creation screen. System opens the standalone canvas. Analyst sketches the intended logic and inspects the representation. Analyst returns to the rule form for its supported save and validation workflow.',
    description: "Main flow of UC-ruleCanvas (Rule Canvas): Analyst opens the companion canvas from a creation screen. System opens the standalone canvas. Analyst sketches the intended logic and inspects the representation. Analyst returns to the rule form for its supported save and validation workflow. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-canvas.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleCanvas"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","main-flow","ruleCanvas"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-ruleCanvas-ALT-1",
    name: "UC-ruleCanvas alt flow 1: The canvas can be closed without submitting the underlying form.",
    objective: 'Check an alternative path of "Rule Canvas": the canvas can be closed without submitting the underlying form.',
    description: "Alternate flow 1 of UC-ruleCanvas (Rule Canvas): \"The canvas can be closed without submitting the underlying form.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-canvas.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleCanvas"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","ruleCanvas"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleCanvas-ALT-2",
    name: "UC-ruleCanvas alt flow 2: A local canvas export, if offered, is distinct from rule catalogue per",
    objective: 'Check an alternative path of "Rule Canvas": a local canvas export, if offered, is distinct from rule catalogue persistence.',
    description: "Alternate flow 2 of UC-ruleCanvas (Rule Canvas): \"A local canvas export, if offered, is distinct from rule catalogue persistence.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-canvas.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleCanvas"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","ruleCanvas"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleCanvas-EXC-1",
    name: "UC-ruleCanvas exc flow 1: A canvas load failure leaves the original form available.",
    objective: 'Check that "Rule Canvas" fails safely: a canvas load failure leaves the original form available.',
    description: "Exception flow 1 of UC-ruleCanvas (Rule Canvas): \"A canvas load failure leaves the original form available.\" No backing API is registered for this use case, so this claim is evidenced only by the plain navigation above succeeding without needing any session/Authorization header.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-canvas.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleCanvas"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","ruleCanvas"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleCanvas-EXC-2",
    name: "UC-ruleCanvas exc flow 2: Unsupported logic cannot be advertised as executable merely because it",
    objective: 'Check that "Rule Canvas" fails safely: unsupported logic cannot be advertised as executable merely because it is drawn.',
    description: "Exception flow 2 of UC-ruleCanvas (Rule Canvas): \"Unsupported logic cannot be advertised as executable merely because it is drawn.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/rule-canvas.html', expected_status: 200, expected_body_contains: 'data-sbe-page="ruleCanvas"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","ruleCanvas"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-schAll-MAIN",
    name: "UC-schAll main flow: All schedules",
    objective: 'Walk through the "All schedules" screen the way its main use case describes it: operator opens All schedules. System lists stored schedules with cadence and next occurrence. Operator inspects enabled or paused state where persisted. Operator opens creation or a separately supported maintenance action.',
    description: "Main flow of UC-schAll (All schedules): Operator opens All schedules. System lists stored schedules with cadence and next occurrence. Operator inspects enabled or paused state where persisted. Operator opens creation or a separately supported maintenance action. Touches the screen's real route and its registered API(s): GET /api/v1/schedules.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/schedules" }
    ],
    tags: ["usecase","sand-bench","main-flow","schAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-schAll-ALT-1",
    name: "UC-schAll alt flow 1: A schedule outside the upcoming window remains visible.",
    objective: 'Check an alternative path of "All schedules": a schedule outside the upcoming window remains visible.',
    description: "Alternate flow 1 of UC-schAll (All schedules): \"A schedule outside the upcoming window remains visible.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/schedules" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","schAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-schAll-ALT-2",
    name: "UC-schAll alt flow 2: A zero-record response is shown as an empty list when confirmed.",
    objective: 'Check an alternative path of "All schedules": a zero-record response is shown as an empty list when confirmed.',
    description: "Alternate flow 2 of UC-schAll (All schedules): \"A zero-record response is shown as an empty list when confirmed.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/schedules" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","schAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-schAll-EXC-1",
    name: "UC-schAll exc flow 1: A load failure is not a successful zero-record result.",
    objective: 'Check that "All schedules" fails safely: a load failure is not a successful zero-record result.',
    description: "Exception flow 1 of UC-schAll (All schedules): \"A load failure is not a successful zero-record result.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","schAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-schAll-EXC-2",
    name: "UC-schAll exc flow 2: Unavailable pause/resume controls are not represented as working actio",
    objective: 'Check that "All schedules" fails safely: unavailable pause/resume controls are not represented as working actions.',
    description: "Exception flow 2 of UC-schAll (All schedules): \"Unavailable pause/resume controls are not represented as working actions.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","exception-flow","schAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-schUpcoming-MAIN",
    name: "UC-schUpcoming main flow: Upcoming schedules",
    objective: 'Walk through the "Upcoming schedules" screen the way its main use case describes it: operator opens Upcoming schedules. System loads schedule records and identifies the displayed time basis. System applies the declared upcoming interval and enabled-state policy. Operator reviews next occurrence and intended target before creating another schedule.',
    description: "Main flow of UC-schUpcoming (Upcoming schedules): Operator opens Upcoming schedules. System loads schedule records and identifies the displayed time basis. System applies the declared upcoming interval and enabled-state policy. Operator reviews next occurrence and intended target before creating another schedule. Touches the screen's real route and its registered API(s): GET /api/v1/schedules.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-upcoming.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schUpcoming"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/schedules" }
    ],
    tags: ["usecase","sand-bench","main-flow","schUpcoming"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-schUpcoming-ALT-1",
    name: "UC-schUpcoming alt flow 1: No due schedules produces an explicit empty interval.",
    objective: 'Check an alternative path of "Upcoming schedules": no due schedules produces an explicit empty interval.',
    description: "Alternate flow 1 of UC-schUpcoming (Upcoming schedules): \"No due schedules produces an explicit empty interval.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-upcoming.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schUpcoming"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/schedules" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","schUpcoming"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-schUpcoming-ALT-2",
    name: "UC-schUpcoming alt flow 2: All schedules permits inspection outside the upcoming interval.",
    objective: 'Check an alternative path of "Upcoming schedules": all schedules permits inspection outside the upcoming interval.',
    description: "Alternate flow 2 of UC-schUpcoming (Upcoming schedules): \"All schedules permits inspection outside the upcoming interval.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-upcoming.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schUpcoming"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/schedules" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","schUpcoming"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-schUpcoming-EXC-1",
    name: "UC-schUpcoming exc flow 1: An invalid next-run timestamp is disclosed.",
    objective: 'Check that "Upcoming schedules" fails safely: an invalid next-run timestamp is disclosed.',
    description: "Exception flow 1 of UC-schUpcoming (Upcoming schedules): \"An invalid next-run timestamp is disclosed.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-upcoming.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schUpcoming"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/schedules" }
    ],
    tags: ["usecase","sand-bench","exception-flow","schUpcoming"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-schUpcoming-EXC-2",
    name: "UC-schUpcoming exc flow 2: A paused schedule is not promised to fire.",
    objective: 'Check that "Upcoming schedules" fails safely: a paused schedule is not promised to fire.',
    description: "Exception flow 2 of UC-schUpcoming (Upcoming schedules): \"A paused schedule is not promised to fire.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schedules-upcoming.html', expected_status: 200, expected_body_contains: 'data-sbe-page="schUpcoming"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/schedules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/schedules" }
    ],
    tags: ["usecase","sand-bench","exception-flow","schUpcoming"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-tcPool-MAIN",
    name: "UC-tcPool main flow: Test Cases",
    objective: 'Walk through the "Test Cases" screen the way its main use case describes it: analyst opens Test Cases; system loads the tenant case collection. Analyst reviews name, objective and dataset reference. Analyst opens a case by ID and reviews its stored details. Analyst chooses a supported edit or uses the case when building a suite.',
    description: "Main flow of UC-tcPool (Test Cases): Analyst opens Test Cases; system loads the tenant case collection. Analyst reviews name, objective and dataset reference. Analyst opens a case by ID and reviews its stored details. Analyst chooses a supported edit or uses the case when building a suite. Touches the screen's real route and its registered API(s): GET /api/v1/test-cases.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-cases.html', expected_status: 200, expected_body_contains: 'data-sbe-page="testCasesDesk"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-cases', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/test-cases" }
    ],
    tags: ["usecase","sand-bench","main-flow","tcPool"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-tcPool-ALT-1",
    name: "UC-tcPool alt flow 1: A case without a dataset remains a draft definition for later completi",
    objective: 'Check an alternative path of "Test Cases": a case without a dataset remains a draft definition for later completion.',
    description: "Alternate flow 1 of UC-tcPool (Test Cases): \"A case without a dataset remains a draft definition for later completion.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-cases.html', expected_status: 200, expected_body_contains: 'data-sbe-page="testCasesDesk"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-cases', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/test-cases" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","tcPool"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-tcPool-ALT-2",
    name: "UC-tcPool alt flow 2: An empty pool offers case creation.",
    objective: 'Check an alternative path of "Test Cases": an empty pool offers case creation.',
    description: "Alternate flow 2 of UC-tcPool (Test Cases): \"An empty pool offers case creation.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-cases.html', expected_status: 200, expected_body_contains: 'data-sbe-page="testCasesDesk"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-cases', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/test-cases" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","tcPool"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-tcPool-EXC-1",
    name: "UC-tcPool exc flow 1: A missing dataset is disclosed rather than substituted.",
    objective: 'Check that "Test Cases" fails safely: a missing dataset is disclosed rather than substituted.',
    description: "Exception flow 1 of UC-tcPool (Test Cases): \"A missing dataset is disclosed rather than substituted.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-cases.html', expected_status: 200, expected_body_contains: 'data-sbe-page="testCasesDesk"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-cases', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/test-cases" }
    ],
    tags: ["usecase","sand-bench","exception-flow","tcPool"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-tcPool-EXC-2",
    name: "UC-tcPool exc flow 2: A stale version cannot silently overwrite a concurrent case edit.",
    objective: 'Check that "Test Cases" fails safely: a stale version cannot silently overwrite a concurrent case edit.',
    description: "Exception flow 2 of UC-tcPool (Test Cases): \"A stale version cannot silently overwrite a concurrent case edit.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-cases.html', expected_status: 200, expected_body_contains: 'data-sbe-page="testCasesDesk"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/test-cases', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/test-cases" }
    ],
    tags: ["usecase","sand-bench","exception-flow","tcPool"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-trAll-MAIN",
    name: "UC-trAll main flow: All test runs",
    objective: 'Walk through the "All test runs" screen the way its main use case describes it: operator opens All test runs. System retrieves stored runs and displays their returned states. Operator inspects a run by identity. Operator follows an available report or starts a separate new run.',
    description: "Main flow of UC-trAll (All test runs): Operator opens All test runs. System retrieves stored runs and displays their returned states. Operator inspects a run by identity. Operator follows an available report or starts a separate new run. Touches the screen's real route and its registered API(s): GET /api/v1/runs.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/runs" }
    ],
    tags: ["usecase","sand-bench","main-flow","trAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-trAll-ALT-1",
    name: "UC-trAll alt flow 1: Pagination limits visible rows without changing total semantics.",
    objective: 'Check an alternative path of "All test runs": pagination limits visible rows without changing total semantics.',
    description: "Alternate flow 1 of UC-trAll (All test runs): \"Pagination limits visible rows without changing total semantics.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/runs" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","trAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-trAll-ALT-2",
    name: "UC-trAll alt flow 2: Failed runs remain visible.",
    objective: 'Check an alternative path of "All test runs": failed runs remain visible.',
    description: "Alternate flow 2 of UC-trAll (All test runs): \"Failed runs remain visible.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","trAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-trAll-EXC-1",
    name: "UC-trAll exc flow 1: A storage error currently may appear as an empty API list; it must not",
    objective: 'Check that "All test runs" fails safely: a storage error currently may appear as an empty application service list; it must not be described as verified absence.',
    description: "Exception flow 1 of UC-trAll (All test runs): \"A storage error currently may appear as an empty API list; it must not be described as verified absence.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/runs" }
    ],
    tags: ["usecase","sand-bench","exception-flow","trAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-trAll-EXC-2",
    name: "UC-trAll exc flow 2: Missing timestamps produce unknown duration, not zero.",
    objective: 'Check that "All test runs" fails safely: missing timestamps produce unknown duration, not zero.',
    description: "Exception flow 2 of UC-trAll (All test runs): \"Missing timestamps produce unknown duration, not zero.\" Closest executable proxy: the same read must keep returning a well-formed 200 response shape, the structural half of \"empty is distinct from failure\".",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/runs" }
    ],
    tags: ["usecase","sand-bench","exception-flow","trAll"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-trHistory-MAIN",
    name: "UC-trHistory main flow: Run history",
    objective: 'Walk through the "Run history" screen the way its main use case describes it: operator opens Run history. System selects terminal records according to the implemented status mapping. Operator reviews start, completion and measured duration. Operator opens the available evidence for a selected run.',
    description: "Main flow of UC-trHistory (Run history): Operator opens Run history. System selects terminal records according to the implemented status mapping. Operator reviews start, completion and measured duration. Operator opens the available evidence for a selected run. Touches the screen's real route and its registered API(s): GET /api/v1/runs.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/runs" }
    ],
    tags: ["usecase","sand-bench","main-flow","trHistory"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-trHistory-ALT-1",
    name: "UC-trHistory alt flow 1: Failed terminal runs are included with their outcome.",
    objective: 'Check an alternative path of "Run history": failed terminal runs are included with their outcome.',
    description: "Alternate flow 1 of UC-trHistory (Run history): \"Failed terminal runs are included with their outcome.\" Closest executable proxy: the same read must fail cleanly (401) on an invalid session, not silently substitute a fabricated empty/successful result.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'same read with an invalid session must fail cleanly, not silently return an empty success' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","trHistory"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-trHistory-ALT-2",
    name: "UC-trHistory alt flow 2: Older runs are included or excluded only according to a declared actua",
    objective: 'Check an alternative path of "Run history": older runs are included or excluded only according to a declared actual filter.',
    description: "Alternate flow 2 of UC-trHistory (Run history): \"Older runs are included or excluded only according to a declared actual filter.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/runs" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","trHistory"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-trHistory-EXC-1",
    name: "UC-trHistory exc flow 1: Invalid or missing timestamps do not produce a made-up duration.",
    objective: 'Check that "Run history" fails safely: invalid or missing timestamps do not produce a made-up duration.',
    description: "Exception flow 1 of UC-trHistory (Run history): \"Invalid or missing timestamps do not produce a made-up duration.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/runs" }
    ],
    tags: ["usecase","sand-bench","exception-flow","trHistory"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-trHistory-EXC-2",
    name: "UC-trHistory exc flow 2: A running record is not treated as a completed history entry.",
    objective: 'Check that "Run history" fails safely: a running record is not treated as a completed history entry.',
    description: "Exception flow 2 of UC-trHistory (Run history): \"A running record is not treated as a completed history entry.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/test-runs-all.html', expected_status: 200, expected_body_contains: 'data-sbe-page="trAll"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/runs', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/runs" }
    ],
    tags: ["usecase","sand-bench","exception-flow","trHistory"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-useCaseTemplates-MAIN",
    name: "UC-useCaseTemplates main flow: Use-case templates",
    objective: 'Walk through the "Use-case templates" screen the way its main use case describes it: author opens Use-case templates. System presents the available canonical template. Author selects Download use-case template. System downloads Markdown with metadata and all required sections.',
    description: "Main flow of UC-useCaseTemplates (Use-case templates): Author opens Use-case templates. System presents the available canonical template. Author selects Download use-case template. System downloads Markdown with metadata and all required sections. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/use-case-templates.html', expected_status: 200, expected_body_contains: 'data-sbe-page="useCaseTemplates"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","main-flow","useCaseTemplates"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-useCaseTemplates-ALT-1",
    name: "UC-useCaseTemplates alt flow 1: The author leaves without downloading.",
    objective: 'Check an alternative path of "Use-case templates": the author leaves without downloading.',
    description: "Alternate flow 1 of UC-useCaseTemplates (Use-case templates): \"The author leaves without downloading.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/use-case-templates.html', expected_status: 200, expected_body_contains: 'data-sbe-page="useCaseTemplates"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","useCaseTemplates"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-useCaseTemplates-ALT-2",
    name: "UC-useCaseTemplates alt flow 2: The downloaded template can be used for an unlinked use case.",
    objective: 'Check an alternative path of "Use-case templates": the downloaded template can be used for an unlinked use case.',
    description: "Alternate flow 2 of UC-useCaseTemplates (Use-case templates): \"The downloaded template can be used for an unlinked use case.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/use-case-templates.html', expected_status: 200, expected_body_contains: 'data-sbe-page="useCaseTemplates"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","useCaseTemplates"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-useCaseTemplates-EXC-1",
    name: "UC-useCaseTemplates exc flow 1: A blocked download must not be described as completed.",
    objective: 'Check that "Use-case templates" fails safely: a blocked download must not be described as completed.',
    description: "Exception flow 1 of UC-useCaseTemplates (Use-case templates): \"A blocked download must not be described as completed.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/use-case-templates.html', expected_status: 200, expected_body_contains: 'data-sbe-page="useCaseTemplates"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","useCaseTemplates"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-useCaseTemplates-EXC-2",
    name: "UC-useCaseTemplates exc flow 2: A template with missing sections is a documentation defect.",
    objective: 'Check that "Use-case templates" fails safely: a template with missing sections is a documentation defect.',
    description: "Exception flow 2 of UC-useCaseTemplates (Use-case templates): \"A template with missing sections is a documentation defect.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/use-case-templates.html', expected_status: 200, expected_body_contains: 'data-sbe-page="useCaseTemplates"', description: 'load screen' }
    ],
    tags: ["usecase","sand-bench","exception-flow","useCaseTemplates"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  ...USER_CREATE_FLOW_CASES,
];
