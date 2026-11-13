/**
 * Sand Bench — tenancy data isolation (Test Engine)
 *
 * The core per-user data-ownership guarantee, proven end to end against the live Docker
 * stack: five real users are created; each creates one dataset, one message definition,
 * one test case, one test suite and runs it (producing a test run) -- 25 owned rows across
 * five resource types. The test then proves, exhaustively, that no user can list, directly
 * read or run another user's row, and that the built-in administrator can see every one of
 * the 25 rows, correctly attributed to its owner.
 *
 * Isolation model under test: Postgres row-level security (db/migrations/
 * 055_user_data_access.sql for datasets/test_cases/test_suites/definitions,
 * 063_run_data_ownership.sql for test_runs) plus owner-aware filtering in
 * apps/api/src/modules/dataAccess.ts. A cross-user read/run attempt on a single resource
 * is always 404, never 403 -- existence itself is not revealed to a user who cannot see the
 * row -- the same BOLA-safe pattern sit/cases/87-pentest-authz.sit.ts already proves across
 * tenants; this case is the cross-*user*, same-tenant analogue. A list endpoint simply
 * omits rows the caller cannot see, rather than erroring.
 *
 * Best-practice shape (OWASP API1:2023 Broken Object Level Authorization; see also the
 * "role-by-object matrix" pattern used by BOLA scanners): every owned object is checked
 * against every other identity, not just one pair, and the administrator's broader view is
 * checked as its own, separate positive case rather than assumed from the negative ones.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";

const LOGIN = `${ENV.apiBase}/api/v1/session/login`;
const USER_COUNT = 5;

function jsonRequest(method: string, url: string, token: string | undefined, body?: unknown, extra: Record<string, string> = {}) {
  return fetch(url, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
}
async function read(response: Response) {
  return { response, body: (await response.json().catch(() => ({}))) as Record<string, any> };
}
async function login(username: string, password: string) {
  return read(await jsonRequest("POST", LOGIN, undefined, { username, password }));
}

type ResourceType = "datasets" | "definitions" | "testCases" | "testSuites" | "runs";
type Row = Record<string, any>;

const RESOURCE: Record<ResourceType, { list: string; get: (id: string) => string }> = {
  datasets: { list: "/api/v1/datasets", get: (id) => `/api/v1/datasets/${id}` },
  definitions: { list: "/api/v1/definitions?source=saved", get: (id) => `/api/v1/definitions/${id}` },
  testCases: { list: "/api/v1/test-cases", get: (id) => `/api/v1/test-cases/${id}` },
  testSuites: { list: "/api/v1/test-suites", get: (id) => `/api/v1/test-suites/${id}` },
  runs: { list: "/api/v1/runs", get: (id) => `/api/v1/runs/${id}` },
};
const RESOURCE_TYPES = Object.keys(RESOURCE) as ResourceType[];
const idsOf = (body: Row) => ((body.data || []) as Row[]).map((row) => row.id);

type IsolationUser = { id: string; username: string; token: string; assets: Record<ResourceType, string>; etags: { datasets: string; testCases: string; testSuites: string } };

test("tenancy data isolation: five users each own a full dataset->definition->case->suite->run chain; no user sees another's; the administrator sees all five, correctly attributed", async () => {
  const tag = `sit${Date.now().toString(36)}`;
  const PASSWORD = `Isolation-${tag}-Password`;
  const evidence: string[] = [];
  let adminToken = "";
  let tenantId = "";
  const users: IsolationUser[] = [];

  try {
    // ---------------------------------------------------------------- setup: admin + tenant
    const adminLogin = await login(ENV.username, ENV.password);
    assert.equal(adminLogin.response.status, 200, `admin sign-in: ${JSON.stringify(adminLogin.body)}`);
    adminToken = adminLogin.body.token;

    const tenants = await read(await jsonRequest("GET", `${ENV.apiBase}/api/v1/admin/tenants`, adminToken));
    assert.equal(tenants.response.status, 200, `list tenants: ${JSON.stringify(tenants.body)}`);
    tenantId = tenants.body.data[0].id;

    // ---------------------------------------------------------- five users, each signed in
    for (let i = 0; i < USER_COUNT; i++) {
      const username = `${tag}.u${i}`;
      const created = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users`, adminToken, {
        username, displayName: `Isolation ${tag} user ${i}`, email: `${tag}.u${i}@example.invalid`, password: PASSWORD,
        securityQuestion: "What is the isolation test marker?", securityAnswer: tag,
      }));
      assert.equal(created.response.status, 201, `create user ${i}: ${JSON.stringify(created.body)}`);
      const signedIn = await login(username, PASSWORD);
      assert.equal(signedIn.response.status, 200, `sign in user ${i}: ${JSON.stringify(signedIn.body)}`);
      users.push({ id: created.body.id, username, token: signedIn.body.token, assets: {} as Record<ResourceType, string>, etags: {} as IsolationUser["etags"] });
    }
    evidence.push(`created and signed in ${users.length} independent users: ${users.map((u) => u.username).join(", ")}`);

    // ----------------------------------------------- each user creates a full owned chain
    for (const u of users) {
      const dataset = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/datasets`, u.token, { name: `${tag} dataset ${u.username}` }));
      assert.equal(dataset.response.status, 200, `${u.username} create dataset: ${JSON.stringify(dataset.body)}`);
      u.assets.datasets = dataset.body.id;
      u.etags.datasets = dataset.body.etag;

      const definition = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/definitions`, u.token, {
        name: `${tag} definition ${u.username}`, familyCode: "pain", msgTypeCode: "pain.001.001.09", version: "1",
        fields: [{ id: "Doc/F0", xpath: "Doc/F0", label: "F0", type: "string", mandatory: true }],
      }));
      assert.equal(definition.response.status, 201, `${u.username} create definition: ${JSON.stringify(definition.body)}`);
      u.assets.definitions = definition.body.id;

      const testCase = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/test-cases`, u.token, { name: `${tag} case ${u.username}` }));
      assert.equal(testCase.response.status, 200, `${u.username} create test case: ${JSON.stringify(testCase.body)}`);
      u.assets.testCases = testCase.body.id;
      u.etags.testCases = testCase.body.etag;

      const suite = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/test-suites`, u.token, { name: `${tag} suite ${u.username}`, caseIds: [testCase.body.id] }));
      assert.equal(suite.response.status, 200, `${u.username} create test suite: ${JSON.stringify(suite.body)}`);
      u.assets.testSuites = suite.body.id;
      u.etags.testSuites = suite.body.etag;

      const ran = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/test-cases/${testCase.body.id}/run`, u.token, {}));
      assert.equal(ran.response.status, 200, `${u.username} run own test case: ${JSON.stringify(ran.body)}`);
      // A run with no linked dataset still completes (status "blocked", no message type to
      // send) and is still a real, owned test_runs row -- exactly what this case needs; it
      // does not need to actually generate or send a message to prove per-user ownership.
      const runId = ran.body.run?.runId;
      assert.ok(runId, `${u.username} run produced an id: ${JSON.stringify(ran.body)}`);
      u.assets.runs = runId;
    }
    evidence.push(`each of ${users.length} users created their own dataset, definition, test case, test suite and ran it (${users.length * 5} owned rows total, across ${RESOURCE_TYPES.length} resource types)`);

    // ----------------------------------- isolation: lists omit, direct reads 404, runs 404
    let listChecks = 0;
    let directChecks = 0;
    let runChecks = 0;
    for (const viewer of users) {
      for (const type of RESOURCE_TYPES) {
        const res = await read(await jsonRequest("GET", `${ENV.apiBase}${RESOURCE[type].list}`, viewer.token));
        assert.equal(res.response.status, 200, `${viewer.username} list ${type}: ${JSON.stringify(res.body)}`);
        const ids = idsOf(res.body);
        assert.ok(ids.includes(viewer.assets[type]), `${viewer.username} must see their own ${type} in their own list`);
        for (const owner of users) {
          if (owner === viewer) continue;
          assert.ok(!ids.includes(owner.assets[type]), `${viewer.username} must NOT see ${owner.username}'s ${type} (id ${owner.assets[type]}) in a list`);
          listChecks++;
        }
      }
      for (const owner of users) {
        if (owner === viewer) continue;
        for (const type of RESOURCE_TYPES) {
          const res = await read(await jsonRequest("GET", `${ENV.apiBase}${RESOURCE[type].get(owner.assets[type])}`, viewer.token));
          assert.equal(res.response.status, 404, `${viewer.username} reading ${owner.username}'s ${type} directly must be 404 (not 403 -- existence must not be revealed), got ${res.response.status}: ${JSON.stringify(res.body)}`);
          directChecks++;
        }
        const runCase = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/test-cases/${owner.assets.testCases}/run`, viewer.token, {}));
        assert.equal(runCase.response.status, 404, `${viewer.username} must not be able to run ${owner.username}'s test case, got ${runCase.response.status}: ${JSON.stringify(runCase.body)}`);
        const runSuite = await read(await jsonRequest("POST", `${ENV.apiBase}/api/v1/test-suites/${owner.assets.testSuites}/run`, viewer.token, {}));
        assert.equal(runSuite.response.status, 404, `${viewer.username} must not be able to run ${owner.username}'s test suite, got ${runSuite.response.status}: ${JSON.stringify(runSuite.body)}`);
        runChecks += 2;
      }
    }
    evidence.push(`cross-user negative checks -- ALL passed: ${listChecks} list-omission checks (each of ${users.length} users' lists, across ${RESOURCE_TYPES.length} resource types, excludes the other ${users.length - 1} users' rows), ${directChecks} direct-GET checks (all 404, never 403), ${runChecks} run-attempt checks (all 404)`);

    // -------------------------------------------- administrator: sees and can act on all 25
    let adminListSeen = 0;
    let adminDirectSeen = 0;
    for (const type of RESOURCE_TYPES) {
      const res = await read(await jsonRequest("GET", `${ENV.apiBase}${RESOURCE[type].list}`, adminToken));
      assert.equal(res.response.status, 200, `admin list ${type}: ${JSON.stringify(res.body)}`);
      const ids = idsOf(res.body);
      for (const owner of users) {
        assert.ok(ids.includes(owner.assets[type]), `admin's ${type} list must include ${owner.username}'s row (id ${owner.assets[type]})`);
        adminListSeen++;
        const direct = await read(await jsonRequest("GET", `${ENV.apiBase}${RESOURCE[type].get(owner.assets[type])}`, adminToken));
        assert.equal(direct.response.status, 200, `admin direct GET of ${owner.username}'s ${type}: ${JSON.stringify(direct.body)}`);
        adminDirectSeen++;
      }
    }
    evidence.push(`administrator positive checks -- ALL visible: ${adminListSeen} list-inclusion checks + ${adminDirectSeen} direct-GET checks across all ${users.length} users x ${RESOURCE_TYPES.length} resource types`);

    // ---------------------------------------- owner attribution shown only to the admin
    const adminRuns = await read(await jsonRequest("GET", `${ENV.apiBase}/api/v1/runs`, adminToken));
    assert.equal(adminRuns.response.status, 200);
    let attributed = 0;
    for (const owner of users) {
      const row = ((adminRuns.body.data || []) as Row[]).find((r) => r.id === owner.assets.runs);
      assert.ok(row, `admin's run list must contain ${owner.username}'s run (id ${owner.assets.runs})`);
      assert.equal(row.owner_username, owner.username, `the admin-visible owner_username for run ${owner.assets.runs} must name ${owner.username}, not ${row.owner_username}`);
      attributed++;
    }
    const selfRuns = await read(await jsonRequest("GET", `${ENV.apiBase}/api/v1/runs`, users[0]!.token));
    assert.ok(!("owner_username" in (selfRuns.body.data?.[0] || {})), "a non-admin's own run list must never carry owner_username (there is nothing to disambiguate for them)");
    evidence.push(`owner attribution: ${attributed}/${users.length} runs show the correct owner_username to the administrator; a non-admin's own list never carries that field`);

    // eslint-disable-next-line no-console
    console.log(`TENANCY ISOLATION EVIDENCE (${tag}):\n  - ${evidence.join("\n  - ")}`);
  } finally {
    // --------------------------------------------------------------------------- cleanup
    for (const u of users) {
      if (u.assets.runs) await jsonRequest("DELETE", `${ENV.apiBase}/api/v1/runs/${u.assets.runs}`, adminToken).catch(() => {});
      if (u.assets.testSuites) await jsonRequest("DELETE", `${ENV.apiBase}/api/v1/test-suites/${u.assets.testSuites}`, adminToken, undefined, { "if-match": u.etags.testSuites }).catch(() => {});
      if (u.assets.testCases) await jsonRequest("DELETE", `${ENV.apiBase}/api/v1/test-cases/${u.assets.testCases}`, adminToken, undefined, { "if-match": u.etags.testCases }).catch(() => {});
      if (u.assets.datasets) await jsonRequest("DELETE", `${ENV.apiBase}/api/v1/datasets/${u.assets.datasets}`, adminToken, undefined, { "if-match": u.etags.datasets }).catch(() => {});
      if (u.assets.definitions) await jsonRequest("DELETE", `${ENV.apiBase}/api/v1/definitions/${u.assets.definitions}`, adminToken).catch(() => {});
    }
    if (adminToken && tenantId) {
      for (const u of users) {
        const row = await read(await jsonRequest("GET", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users`, adminToken));
        const found = ((row.body.data || []) as Row[]).find((item) => item.id === u.id);
        if (found) await jsonRequest("DELETE", `${ENV.apiBase}/api/v1/admin/tenants/${tenantId}/users/${u.id}`, adminToken, undefined, { "if-match": found.etag }).catch(() => {});
      }
    }
  }
});
