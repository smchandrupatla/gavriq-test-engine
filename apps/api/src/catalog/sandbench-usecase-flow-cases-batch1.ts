/**
 * Sand Bench use-case flow catalog — Batch 1 (read-only use cases).
 *
 * One case per documented flow (main / alternate / exception) for the use cases
 * under docs/use-cases/*.md whose action contract touches only GET endpoints.
 * Every screen route, data-sbe-page marker and API response shape below was
 * verified live against the deployed Sand Bench stack (web :8080, api :8787)
 * before being encoded — see docs/use-cases/*.md "Screen and action contract"
 * and "API registration evidence" for the source use case per case key.
 *
 * Alternate/exception flows are narrative business-rule statements, not
 * independently fireable events; each is encoded as the closest honest
 * executable proxy against the live stack (documented per-case in `description`),
 * not a literal fault injection against the shared deployment.
 */
import type { CaseDef } from './types.js';

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { tenantSlug: '{{tenant}}', username: '{{username}}' },
  expected_status: 200, save: { token: 'token' },
  description: 'operator login',
};
const BEARER = { authorization: 'Bearer {{token}}' };

// admin.acme carries admin:tenant / users:read / access-profiles:manage — needed
// for the admin-only endpoints behind the Roles/Users screens (operator.acme gets 403).
const ADMIN_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { tenantSlug: '{{tenant}}', username: 'admin.acme' },
  expected_status: 200, save: { adminToken: 'token' },
  description: 'tenant admin login',
};
const ADMIN_BEARER = { authorization: 'Bearer {{adminToken}}' };

export const SANDBENCH_USECASE_FLOW_CASES_BATCH1: CaseDef[] = [
  {
    key: "SB-UC-about-MAIN",
    name: "UC-about main flow: About",
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
  {
    key: "SB-UC-roleCreate-MAIN",
    name: "UC-roleCreate main flow: Create user role",
    description: "Main flow of UC-roleCreate (Create user role): Administrator names the job function. Administrator selects explicit supported permissions. Administrator reviews any separate feature slice. System validates the grouping through a confirmed provisioning contract. System confirms the created identity before it becomes assignable. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load host screen (modal: new role, within Identities)' }
    ],
    tags: ["usecase","sand-bench","main-flow","roleCreate"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-roleCreate-ALT-1",
    name: "UC-roleCreate alt flow 1: An existing suitable role should be reused rather than duplicated.",
    description: "Alternate flow 1 of UC-roleCreate (Create user role): \"An existing suitable role should be reused rather than duplicated.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load host screen (modal: new role, within Identities)' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","roleCreate"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-roleCreate-ALT-2",
    name: "UC-roleCreate alt flow 2: An incomplete role remains a proposal until provisioning exists.",
    description: "Alternate flow 2 of UC-roleCreate (Create user role): \"An incomplete role remains a proposal until provisioning exists.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load host screen (modal: new role, within Identities)' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","roleCreate"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-roleCreate-EXC-1",
    name: "UC-roleCreate exc flow 1: Unknown permission strings must not become effective silently.",
    description: "Exception flow 1 of UC-roleCreate (Create user role): \"Unknown permission strings must not become effective silently.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load host screen (modal: new role, within Identities)' }
    ],
    tags: ["usecase","sand-bench","exception-flow","roleCreate"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-roleCreate-EXC-2",
    name: "UC-roleCreate exc flow 2: Duplicate name scope and role deletion policy remain decisions.",
    description: "Exception flow 2 of UC-roleCreate (Create user role): \"Duplicate name scope and role deletion policy remain decisions.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load host screen (modal: new role, within Identities)' }
    ],
    tags: ["usecase","sand-bench","exception-flow","roleCreate"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-roles-MAIN",
    name: "UC-roles main flow: User roles",
    description: "Main flow of UC-roles (User roles): Administrator opens supported access administration. System lists the actual functional profiles. Administrator reviews permitted operations and effective assignments. Administrator identifies a supported change path or records a missing capability. Touches the screen's real route and its registered API(s): GET /api/v1/admin/functional-access-profiles, GET /api/v1/admin/data-access-profiles.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load screen' },
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/functional-access-profiles', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/admin/functional-access-profiles" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/data-access-profiles', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/admin/data-access-profiles" }
    ],
    tags: ["usecase","sand-bench","main-flow","roles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-roles-ALT-1",
    name: "UC-roles alt flow 1: Data access profiles are reviewed separately from functional permissio",
    description: "Alternate flow 1 of UC-roles (User roles): \"Data access profiles are reviewed separately from functional permissions.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load screen' },
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/functional-access-profiles', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/admin/functional-access-profiles" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/data-access-profiles', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/admin/data-access-profiles" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","roles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-roles-ALT-2",
    name: "UC-roles alt flow 2: A historical User roles setting is not a role editor.",
    description: "Alternate flow 2 of UC-roles (User roles): \"A historical User roles setting is not a role editor.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load screen' },
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/functional-access-profiles', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/admin/functional-access-profiles" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/data-access-profiles', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/admin/data-access-profiles" }
    ],
    tags: ["usecase","sand-bench","alternate-flow","roles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-roles-EXC-1",
    name: "UC-roles exc flow 1: Unregistered role CRUD is not claimed available.",
    description: "Exception flow 1 of UC-roles (User roles): \"Unregistered role CRUD is not claimed available.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load screen' },
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/functional-access-profiles', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/admin/functional-access-profiles" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/data-access-profiles', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/admin/data-access-profiles" }
    ],
    tags: ["usecase","sand-bench","exception-flow","roles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-roles-EXC-2",
    name: "UC-roles exc flow 2: Deleting an assigned role requires an agreed dependency policy.",
    description: "Exception flow 2 of UC-roles (User roles): \"Deleting an assigned role requires an agreed dependency policy.\" Re-verifies the screen route and its backing read on this flow.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load screen' },
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/functional-access-profiles', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/admin/functional-access-profiles" },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/admin/data-access-profiles', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: "/api/v1/admin/data-access-profiles" }
    ],
    tags: ["usecase","sand-bench","exception-flow","roles"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-ruleBenchExisting-MAIN",
    name: "UC-ruleBenchExisting main flow: Existing rules",
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
  {
    key: "SB-UC-userCreate-MAIN",
    name: "UC-userCreate main flow: Create new user",
    description: "Main flow of UC-userCreate (Create new user): Administrator enters the intended person identity. System checks required identity fields and existing membership under the agreed policy. Administrator reviews the intended tenant and assignments. Administrator explicitly submits through a supported provisioning path. System reports confirmed membership or a precise failure. Touches the screen's real route (no backing API is registered for this use case).",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "high", priority: "p1",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load host screen (modal: new user, within Identities)' }
    ],
    tags: ["usecase","sand-bench","main-flow","userCreate"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; registered read APIs respond 200 with their documented shape.",
  },
  {
    key: "SB-UC-userCreate-ALT-1",
    name: "UC-userCreate alt flow 1: An existing identity may need membership assignment rather than anothe",
    description: "Alternate flow 1 of UC-userCreate (Create new user): \"An existing identity may need membership assignment rather than another account.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load host screen (modal: new user, within Identities)' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","userCreate"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-userCreate-ALT-2",
    name: "UC-userCreate alt flow 2: An invitation-based flow is proposed until its endpoint and expiry rul",
    description: "Alternate flow 2 of UC-userCreate (Create new user): \"An invitation-based flow is proposed until its endpoint and expiry rules are defined.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "low", priority: "p3",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load host screen (modal: new user, within Identities)' }
    ],
    tags: ["usecase","sand-bench","alternate-flow","userCreate"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-userCreate-EXC-1",
    name: "UC-userCreate exc flow 1: An invalid role must not silently become the intended role.",
    description: "Exception flow 1 of UC-userCreate (Create new user): \"An invalid role must not silently become the intended role.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load host screen (modal: new user, within Identities)' }
    ],
    tags: ["usecase","sand-bench","exception-flow","userCreate"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  },
  {
    key: "SB-UC-userCreate-EXC-2",
    name: "UC-userCreate exc flow 2: Duplicate identity behavior requires a confirmed scope before assignin",
    description: "Exception flow 2 of UC-userCreate (Create new user): \"Duplicate identity behavior requires a confirmed scope before assigning a specific response code.\" No backing API is registered for this use case; this flow is evidenced only by the plain navigation above.",
    suiteKey: 'sb-usecase', testType: 'acceptance', method: "http", severity: "medium", priority: "p2",
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/admin.html', expected_status: 200, expected_body_contains: 'data-sbe-page="adminIdentities"', description: 'load host screen (modal: new user, within Identities)' }
    ],
    tags: ["usecase","sand-bench","exception-flow","userCreate"],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload; verifies navigation and read contracts only.', source: 'n/a' },
    expected: "Screen route resolves; the flow's specific contract holds under the executable proxy described above.",
  }
];
