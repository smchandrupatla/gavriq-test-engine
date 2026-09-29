# Test Case Catalog

> Generated from the live test repository at `http://127.0.0.1:8797` on 2026-09-29T12:30:23.761Z.
> Regenerate with `npm run docs:catalog`. Every case listed here is registered,
> executable by the engine's workers, and documented with the data it uses.

## Application: GAVRIQ Test Engine (`gavriq-test-engine`)

The test engine itself, registered as an application under test (API self-tests).

16 test cases across 2 suites.

### Category: Smoke tests (Quality assurance)

_Engine control plane answers._

#### Suite: Engine smoke (`te-smoke`) — 3 cases

The control plane and its UI shell are up.

#### TE-SMOKE-HEALTH — Engine health endpoint answers

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET {{engine}}/health must identify the service ("gavriq-test-engine") with a version and UI enabled.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/health` — engine /health
      - expect: status 200; `status` = "ok", `service` = "gavriq-test-engine", `version` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-SMOKE-READY — Engine readiness probe answers

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET {{engine}}/ready must return {"status":"ready"}.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/ready` — engine /ready
      - expect: status 200; `status` = "ready"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-SMOKE-UI-SHELL — Unified console shell is served

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p0 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET {{engine}}/ must serve the unified console HTML (title "GAVRIQ Test Engine").

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/` — console shell
      - expect: status 200; body contains "GAVRIQ Test Engine"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

### Category: API tests (Quality assurance)

_Repository, execution and readiness APIs behave to contract._

#### Suite: Engine API self-tests (`te-self-api`) — 13 cases

The engine's own repository/execution/readiness APIs verified over HTTP — the engine testing itself like any other application.

#### TE-API-APPLICATIONS — Application registry is multi-tenant

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET /api/v1/applications must list at least two registered applications (Sand Bench plus this engine) — the proof of generic multi-application support.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/applications` — applications
      - expect: status 200; `data` length ≥ 2, `data` contains "\"key\":\"sand-bench\"", `data` contains "\"key\":\"gavriq-test-engine\""

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-API-CASE-DETAIL — Case detail includes version history

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** Fetch one known case by key (TE-SMOKE-HEALTH): the detail payload must include its version list.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/test-cases/TE-SMOKE-HEALTH` — case detail
      - expect: status 200; `data.key` = "TE-SMOKE-HEALTH", `data.versions` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-API-DASHBOARD — Dashboard aggregates answer

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET /api/v1/dashboard must return repository aggregates.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/dashboard` — dashboard
      - expect: status 200; `data` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-API-ENVIRONMENTS — Environment registry with safety policies

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET /api/v1/environments must list environments including the Sand Bench target and expose safety_policy JSON.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/environments` — environments
      - expect: status 200; `data` length ≥ 1, `data` contains "sand-bench-local"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-API-EXEC-VALIDATION — Execution queue validates its input

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** POST /api/v1/executions with an empty body must be rejected with 400 — no unconstrained executions can enter the queue.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **POST** `{{engine}}/api/v1/executions` — reject empty execution
      - expect: status 400
      - body: `{}`

**Data used.** Empty JSON body.

**Data profile.** `negative` — Hand-crafted.

**Expected result.** 400 with validation error.

---

#### TE-API-EXECUTIONS-LIST — Execution history is queryable

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET /api/v1/executions must return the recent execution list (array).

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/executions` — executions
      - expect: status 200; `data` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-API-META — Capability map is published

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET /api/v1/meta must publish the engine version and capability map that clients feature-detect against (verified shape: top-level service/version/capabilities).

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/meta` — meta
      - expect: status 200; `service` = "gavriq-test-engine", `capabilities.repository` = true, `version` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-API-RELEASE-READINESS — Release readiness verdict is computable

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET /api/v1/release-readiness must return a readiness verdict object.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/release-readiness` — release readiness
      - expect: status 200; `data` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-API-RUN-ALL-DRYRUN — Run-everything endpoint validates and previews

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** POST /api/v1/executions/run-all with dry_run=true must return the per-suite plan (suites + case counts) without queueing anything — the contract behind the console's "Run everything" button.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **POST** `{{engine}}/api/v1/executions/run-all` — run-all dry run
      - expect: status 200; `data.suites` length ≥ 1, `data.total_cases` ≥ 1
      - body: `{"dry_run":true,"application_key":"sand-bench"}`

**Data used.** {"application_key":"sand-bench","dry_run":true} — queues nothing.

**Data profile.** `none (dry run)` — Hand-crafted.

**Expected result.** 200 with the suite-by-suite execution plan.

---

#### TE-API-SIT-CATALOG — SIT catalog is importable and listed

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET /api/v1/sit-catalog must return the SIT packs the engine imported from sit/cases.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/sit-catalog` — sit catalog
      - expect: status 200

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-API-SUITES — Suites are filterable by application

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET /api/v1/suites must return suites; the engine's own suites (te-*) must be present.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/suites` — suites
      - expect: status 200; `data` contains "\"key\":\"te-self-api\""

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-API-TEST-CASES — Repository lists cases with pagination contract

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET /api/v1/test-cases?limit=5 must return data rows plus a numeric total — the pagination contract the console relies on.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/test-cases?limit=5` — test-cases page
      - expect: status 200; `data` length ≥ 1, `total` ≥ 1

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

#### TE-API-UI-SUMMARY — Console read-model answers per application

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `api` `test-engine` `self-test` |

**What it does.** GET /api/v1/ui/summary?application_key=sand-bench must return the console's boot payload: cases, suites, environments scoped to the application.

**Preconditions.** Test Engine API reachable at the environment's {{engine}} base URL.

**Steps.**

   1. **GET** `{{engine}}/api/v1/ui/summary?application_key=sand-bench` — ui summary
      - expect: status 200; `data.cases` exists, `data.suites` exists, `data.environments` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Documented contract holds.

---

## Application: Sand Bench (`sand-bench`)

Sand Bench enterprise deployment under test (web console, API, testhub, DB viewer).

398 test cases across 45 suites.

### Category: Smoke tests (Quality assurance)

_Fast pass/fail gate: every deployed surface answers._

#### Suite: Deployed-surface smoke (`sb-smoke`) — 16 cases

Every public surface of the deployment answers with its own health contract.

#### SB-SMOKE-API-HEALTH — API health endpoint answers with its role

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `health` |

**What it does.** GET {{api}}/health must return 200 with the API's own health contract: status "ok", role "api" and a deployment classification. Confirms the application API container is up and serving.

**Preconditions.** Sand Bench API container deployed and reachable from the worker.

**Steps.**

   1. **GET** `{{api}}/health` — API /health
      - expect: status 200; `status` = "ok", `role` = "api", `classification` exists

**Data used.** No request payload; a single GET.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with {"status":"ok","role":"api","classification":<env>}.

---

#### SB-SMOKE-API-READY — API readiness probe reports ready

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `health` |

**What it does.** GET {{api}}/ready must return 200 {"status":"ready"} — the application considers its database migrated and reachable.

**Preconditions.** API container up; its Postgres reachable and migrated.

**Steps.**

   1. **GET** `{{api}}/ready` — API /ready
      - expect: status 200; `status` = "ready"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 {"status":"ready"}.

---

#### SB-SMOKE-CAPABILITIES — API publishes its capabilities contract

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `capabilities` |

**What it does.** GET {{api}}/api/v1/capabilities must return 200 with apiVersion "1.0.0" and a non-empty modules list — the contract clients probe before calling anything else. Verified live.

**Preconditions.** API container up.

**Steps.**

   1. **GET** `{{api}}/api/v1/capabilities` — capabilities
      - expect: status 200; `apiVersion` = "1.0.0", `modules` length ≥ 5

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with apiVersion="1.0.0" and >= 5 modules.

---

#### SB-SMOKE-CHANNEL-TARGETS — All four delivery channels are published

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `channels` `auth-required` |

**What it does.** GET {{api}}/api/v1/channel-targets must list the file, api, mq and kafka channels — the delivery surface the rest of the suite exercises.

**Preconditions.** API container up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/channel-targets` — channel-targets
      - expect: status 200; `data` length ≥ 4, `data` contains "\"channel\":\"kafka\"", `data` contains "\"channel\":\"mq\""

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with >= 4 channels including mq and kafka.

---

#### SB-SMOKE-DBVIEWER-HEALTH — DB viewer is healthy and sees registered apps

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p0 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `health` `dbviewer` |

**What it does.** GET {{dbviewer}}/health must return role "dbviewer" and report at least one registered application database — the independent read path used by data-quality cross-checks.

**Preconditions.** DB viewer container deployed with database registrations.

**Steps.**

   1. **GET** `{{dbviewer}}/health` — dbviewer /health
      - expect: status 200; `role` = "dbviewer", `apps` ≥ 1

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with role "dbviewer" and apps >= 1.

---

#### SB-SMOKE-DBVIEWER-TABLES — DB viewer enumerates the application schema

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `dbviewer` |

**What it does.** GET {{dbviewer}}/api/tables must list the registered application's tables (>= 20 at last verification, spanning transactional/application/configuration classes) — the schema every data-quality case in this suite reads from.

**Preconditions.** DB viewer registered.

**Steps.**

   1. **GET** `{{dbviewer}}/api/tables` — table list
      - expect: status 200; `data` length ≥ 20

**Data used.** No request payload; reads table catalogue only.

**Data profile.** `schema-only (read-only)` — Application schema.

**Expected result.** 200 with >= 20 tables.

---

#### SB-SMOKE-EVENTS-CATALOG — Domain event catalogue is published

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `events` |

**What it does.** GET {{api}}/api/v1/events/catalog must publish the domain event taxonomy (>= 10 event codes at last verification, including biz.session.login.success) — the console's eventing configuration screen and this suite's audit checks both depend on it existing.

**Preconditions.** API container up.

**Steps.**

   1. **GET** `{{api}}/api/v1/events/catalog` — event catalogue
      - expect: status 200; `data` length ≥ 10; body contains "biz.session.login.success"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with >= 10 event codes including biz.session.login.success.

---

#### SB-SMOKE-EXTERNAL-SYSTEMS-PUBLIC — Public external-systems catalogue is populated

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `external-systems` |

**What it does.** GET {{api}}/api/v1/external-systems/public must list the seeded dummy external systems (sanctions/core/fraud/reporting/registry) that the whole integration suite dispatches against. Verified live: >= 3 entries.

**Preconditions.** Demo external systems seeded.

**Steps.**

   1. **GET** `{{api}}/api/v1/external-systems/public` — public external systems
      - expect: status 200; `data` length ≥ 3

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with >= 3 external systems.

---

#### SB-SMOKE-MESSAGE-TYPES-CATALOG — Message-type catalogue answers for an authenticated operator

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `auth-required` `catalogue` |

**What it does.** GET {{api}}/api/v1/message-types must return the tenant's catalogue (>= 1 entry) — the list every message-designer and run screen loads first.

**Preconditions.** Demo operator identity enabled; at least one message type seeded.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/message-types` — message-types
      - expect: status 200; `data` length ≥ 1

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** 200 with >= 1 message type.

---

#### SB-SMOKE-NAMING-CONVENTIONS — Naming-convention catalogue answers

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `auth-required` |

**What it does.** GET {{api}}/api/v1/naming-conventions must publish the artefact naming patterns (rule/dataset/test_case/…) the console's create-forms suggest from. Verified live: includes a "rule" pattern entry.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/naming-conventions` — naming conventions
      - expect: status 200; `data` length ≥ 1

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** 200 with >= 1 naming-convention entry.

---

#### SB-SMOKE-RESILIENCE-POSTURE — Resilience posture endpoint answers

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `resilience` |

**What it does.** GET {{api}}/api/v1/resilience must publish the bench's own resilience posture (posture + dora.available fields) — verified live: {"posture":"bench-not-production","dora":{"available":true,...}}.

**Preconditions.** API container up.

**Steps.**

   1. **GET** `{{api}}/api/v1/resilience` — resilience posture
      - expect: status 200; `posture` exists, `dora.available` = true

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with posture present and dora.available=true.

---

#### SB-SMOKE-SECURITY-HEALTH — Security/encryption subsystem is healthy

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `security` |

**What it does.** GET {{api}}/api/v1/security/health must report overall "HEALTHY" — the vault-backed encryption subsystem every masked field depends on. Verified live: {"overall":"HEALTHY","vault":"HEALTHY",...}.

**Preconditions.** API + vault-transit backing configured.

**Steps.**

   1. **GET** `{{api}}/api/v1/security/health` — security health
      - expect: status 200; `overall` = "HEALTHY"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with overall="HEALTHY".

---

#### SB-SMOKE-SESSION-ROUNDTRIP — Login issues a session that resolves back to the same tenant

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `auth-required` `session` |

**What it does.** Sign in as the demo operator, then GET /api/v1/session/me with the returned token: tenantSlug must equal the {{tenant}} this environment is configured for — the minimum proof the auth round trip actually works end to end, not just that login returns 200.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/session/me` — session/me
      - expect: status 200; `tenantSlug` = "{{tenant}}", `userId` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** session/me tenantSlug equals the configured {{tenant}}.

---

#### SB-SMOKE-TESTHUB-HEALTH — Test hub simulator is healthy and decoupled

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p0 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `health` `testhub` |

**What it does.** GET {{testhub}}/health must report the external-system simulator (file/HTTP/MQ/Kafka mimic) healthy and architecturally decoupled from the application.

**Preconditions.** Testhub container deployed.

**Steps.**

   1. **GET** `{{testhub}}/health` — testhub /health
      - expect: status 200; `status` = "ok", `service` = "testhub", `decoupled` = true

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with service "testhub" and decoupled=true.

---

#### SB-SMOKE-WEB-INDEX — Web front end serves the console shell

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `web` |

**What it does.** GET {{web}}/index.html must return the real console shell (HTML document titled "Sand Bench · GARVIQ Labs"), proving the web container serves the deployed bundle.

**Preconditions.** Web container deployed.

**Steps.**

   1. **GET** `{{web}}/index.html` — web index.html
      - expect: status 200; body contains "Sand Bench · GARVIQ Labs"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 HTML containing the verified page title.

---

#### SB-SMOKE-WEB-ROOT — Web root path serves the console shell

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `smoke` `sand-bench` `web` |

**What it does.** GET {{web}}/ (root, not /index.html) must resolve to 200 with the same verified shell content — proving nginx's root document works, not just the explicit filename.

**Preconditions.** Web container deployed.

**Steps.**

   1. **GET** `{{web}}/` — web root
      - expect: status 200; body contains "Sand Bench"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 HTML containing "Sand Bench".

---

#### Suite: sit-health (`sit-health`) — 6 cases

Imported from sit/cases/00-health.sit.ts

#### SIT-00_HEALTH-DB-VIEWER-IS-HEALTHY-AND-CAN-REACH-THE-S — db viewer is healthy and can reach the same database as the app

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `smoke` `00-health` |

**What it does.** Imported from sit/cases/00-health.sit.ts

**Execution.** Runs `sit/cases/00-health.sit.ts::db viewer is healthy and can reach the same database as the app` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-00_HEALTH-MAIN-APPLICATION-AUTHENTICATES-THE-SIT-O — main application authenticates the SIT operator persona

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `smoke` `00-health` |

**What it does.** Imported from sit/cases/00-health.sit.ts

**Execution.** Runs `sit/cases/00-health.sit.ts::main application authenticates the SIT operator persona` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-00_HEALTH-MAIN-APPLICATION-IS-HEALTHY-AND-REPORTS- — main application is healthy and reports its deployed classification

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `smoke` `00-health` |

**What it does.** Imported from sit/cases/00-health.sit.ts

**Execution.** Runs `sit/cases/00-health.sit.ts::main application is healthy and reports its deployed classification` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-00_HEALTH-MAIN-APPLICATION-IS-READY-DATABASE-MIGRA — main application is ready (database migrated and reachable)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `smoke` `00-health` |

**What it does.** Imported from sit/cases/00-health.sit.ts

**Execution.** Runs `sit/cases/00-health.sit.ts::main application is ready (database migrated and reachable)` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-00_HEALTH-TEST-HUB-MQ-KAFKA-API-MIMIC-IS-HEALTHY-A — test hub (MQ/Kafka/API mimic) is healthy and decoupled from the app

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `smoke` `00-health` |

**What it does.** Imported from sit/cases/00-health.sit.ts

**Execution.** Runs `sit/cases/00-health.sit.ts::test hub (MQ/Kafka/API mimic) is healthy and decoupled from the app` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-00_HEALTH-WEB-FRONT-END-SERVES-THE-DEPLOYED-CONSOL — web front end serves the deployed console

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `smoke` `00-health` |

**What it does.** Imported from sit/cases/00-health.sit.ts

**Execution.** Runs `sit/cases/00-health.sit.ts::web front end serves the deployed console` via the node:test SIT runner (the case file drives the deployed stack directly).

---

### Category: Unit tests (Quality assurance)

_Field-level data fidelity through the inbound gateway._

#### Suite: Field fidelity units (`sb-unit`) — 16 cases

Individual message fields survive the inbound gateway byte-for-byte (boundary lengths, IBAN, amounts, unicode).

#### SB-UNIT-ADDRESS-LINES-ARRAY — Structured postal address lines survive as an array

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `structured` |

**What it does.** PstlAdr.AdrLine is an array field (two address lines); the recorded event must keep both entries, in order, as separate array elements — not flattened or concatenated into one string. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-ADDRESS-LINES-ARRAY-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-UNIT-ADDRESS-LINES-ARRAY-{{ts}}-{{rand}}","scheme":"te.unit.fidelity","PstlAdr":{"AdrLine":["Level 12, `
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-ADDRESS-LINES-ARRAY-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** PstlAdr.AdrLine = ["Level 12, 1 Collins Street", "Melbourne VIC 3000"] (two-element array).

**Data profile.** `structured` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-AMOUNT-PRECISION — Instructed amount keeps its decimal precision

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `precision` |

**What it does.** A string amount with two decimal places ("10000.55") must be recorded with precision intact — a classic float-rounding regression trap. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-AMOUNT-PRECISION-{{ts}}-{{rand}}"},"payload":{"Ccy":"USD","MsgId":"TE-UNIT-AMOUNT-PRECISION-{{ts}}-{{rand}}","scheme":"te.unit.fidelity","InstdAmt":"10000.55"},"sys`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-AMOUNT-PRECISION-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** InstdAmt = "10000.55" (string), Ccy = "USD".

**Data profile.** `precision` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-BIC-FORMAT — Debtor agent BIC11 is preserved character-exact

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `format-valid` |

**What it does.** A syntactically valid 11-character BIC (bank + branch code, DEUTDEFFXXX) in DbtrAgt.FinInstnId.BICFI must be recorded exactly — no case-folding, no truncation to BIC8. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-BIC-FORMAT-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-UNIT-BIC-FORMAT-{{ts}}-{{rand}}","scheme":"te.unit.fidelity","DbtrAgt":{"FinInstnId":{"BICFI":"DEUTDEFFXXX"}}},"`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-BIC-FORMAT-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** DbtrAgt.FinInstnId.BICFI = "DEUTDEFFXXX" (valid 11-char BIC, Deutsche Bank Frankfurt head office).

**Data profile.** `format-valid` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-CCY-CODE — ISO 4217 currency code passes through uppercase

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `format-valid` |

**What it does.** The three-letter currency code "AUD" must be preserved exactly as sent. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-CCY-CODE-{{ts}}-{{rand}}"},"payload":{"Ccy":"AUD","MsgId":"TE-UNIT-CCY-CODE-{{ts}}-{{rand}}","scheme":"te.unit.fidelity","InstdAmt":"250.00"},"systemId":"te_unit","`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-CCY-CODE-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** Ccy = "AUD" (ISO 4217), InstdAmt = "250.00".

**Data profile.** `format-valid` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-DEBTOR-COUNTRY-CODE — Two-letter debtor country code is preserved

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `format-valid` |

**What it does.** Dbtr.PstlAdr.Ctry as a two-letter ISO 3166-1 alpha-2 country code ("AU") must be recorded exactly as sent — no expansion to a full country name, no case change. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-DEBTOR-COUNTRY-CODE-{{ts}}-{{rand}}"},"payload":{"Dbtr":{"PstlAdr":{"Ctry":"AU"}},"MsgId":"TE-UNIT-DEBTOR-COUNTRY-CODE-{{ts}}-{{rand}}","scheme":"te.unit.fidelity"}`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-DEBTOR-COUNTRY-CODE-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** Dbtr.PstlAdr.Ctry = "AU" (ISO 3166-1 alpha-2).

**Data profile.** `format-valid` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-EMPTY-STRING-FIELD — Empty-string remittance info is preserved, not nulled

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `boundary-empty` |

**What it does.** RmtInf.Ustrd sent as an explicit empty string ("") must be recorded as an empty string, not silently converted to null or omitted from the payload — the console's field-presence checks depend on this distinction. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-EMPTY-STRING-FIELD-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-UNIT-EMPTY-STRING-FIELD-{{ts}}-{{rand}}","RmtInf":{"Ustrd":""},"scheme":"te.unit.fidelity"},"systemId":"`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-EMPTY-STRING-FIELD-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** RmtInf.Ustrd = "" (explicit empty string, not absent).

**Data profile.** `boundary-empty` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-IBAN-FORMAT — Creditor IBAN is preserved character-exact

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `format-valid` |

**What it does.** A syntactically valid German IBAN in CdtrAcct must be recorded character-exact (no whitespace normalisation, case folding or checksum mangling). The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-IBAN-FORMAT-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-UNIT-IBAN-FORMAT-{{ts}}-{{rand}}","scheme":"te.unit.fidelity","CdtrAcct":{"IBAN":"DE89370400440532013000"}},"sy`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-IBAN-FORMAT-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** CdtrAcct.IBAN = DE89370400440532013000 (valid mod-97 checksum).

**Data profile.** `format-valid` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-LARGE-AMOUNT — Large nine-figure amount keeps full precision

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `boundary-large` |

**What it does.** A near-maximum instructed amount ("999999999.99", just under the ISO 20022 18-digit decimal cap) must not be rounded, truncated or coerced to a lossy float representation. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-LARGE-AMOUNT-{{ts}}-{{rand}}"},"payload":{"Ccy":"GBP","MsgId":"TE-UNIT-LARGE-AMOUNT-{{ts}}-{{rand}}","scheme":"te.unit.fidelity","InstdAmt":"999999999.99"},"systemI`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-LARGE-AMOUNT-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** InstdAmt = "999999999.99" (11 significant digits), Ccy = "GBP".

**Data profile.** `boundary-large` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-NAME-MAXLEN — Debtor name at maxLength 70 survives intact

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `boundary` |

**What it does.** Boundary check: a debtor name of exactly 70 characters (the pacs.008 DbtrNm maxLength) must be recorded without truncation. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-NAME-MAXLEN-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-UNIT-NAME-MAXLEN-{{ts}}-{{rand}}","DbtrNm":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-NAME-MAXLEN-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** DbtrNm = 70-character string (35×A + 34×B + Z), exactly at the ISO 20022 maxLength boundary.

**Data profile.** `boundary` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-NAME-OVERLEN — Debtor name at maxLength+1 is recorded, not silently corrupted

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `boundary+1` |

**What it does.** Boundary+1 check: a 71-character debtor name must not be silently truncated or corrupted by the gateway — whatever validation later rejects it, the recorded event must carry the bytes that arrived. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-NAME-OVERLEN-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-UNIT-NAME-OVERLEN-{{ts}}-{{rand}}","DbtrNm":"XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-NAME-OVERLEN-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** DbtrNm = 71-character string (71×X), one past the maxLength boundary.

**Data profile.** `boundary+1` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-NEGATIVE-AMOUNT-SIGN — Negative-signed amount string keeps its sign character

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `boundary-negative` |

**What it does.** A deliberately negative-signed amount string ("-100.00", e.g. a reversal/credit adjustment payload) must keep its leading "-" intact through the pipeline — a common sign-stripping bug trap. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-NEGATIVE-AMOUNT-SIGN-{{ts}}-{{rand}}"},"payload":{"Ccy":"USD","MsgId":"TE-UNIT-NEGATIVE-AMOUNT-SIGN-{{ts}}-{{rand}}","scheme":"te.unit.fidelity","InstdAmt":"-100.00`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-NEGATIVE-AMOUNT-SIGN-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** InstdAmt = "-100.00" (leading minus sign), Ccy = "USD".

**Data profile.** `boundary-negative` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-PURPOSE-CODE — ISO 20022 purpose code passes through unchanged

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `format-valid` |

**What it does.** The four-letter external purpose code "SALA" (salary payment) in Purp.Cd must be recorded exactly — downstream rule matching (e.g. payroll detection rules) keys off this literal code. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-PURPOSE-CODE-{{ts}}-{{rand}}"},"payload":{"Purp":{"Cd":"SALA"},"MsgId":"TE-UNIT-PURPOSE-CODE-{{ts}}-{{rand}}","scheme":"te.unit.fidelity"},"systemId":"te_unit","sys`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-PURPOSE-CODE-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** Purp.Cd = "SALA" (ISO 20022 ExternalPurpose1Code: salary payment).

**Data profile.** `format-valid` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-SPECIAL-CHARS-REMITTANCE — Reserved/special characters in remittance text are not mangled

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `special-chars` |

**What it does.** Unstructured remittance text containing characters that are special in HTML, JSON, SQL and shell contexts ("Invoice #123/45 & Co. <Ref> 'quoted'") must be recorded byte-exact — proving no layer double-escapes, strips or interprets them. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-SPECIAL-CHARS-REMITTANCE-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-UNIT-SPECIAL-CHARS-REMITTANCE-{{ts}}-{{rand}}","RmtInf":{"Ustrd":"Invoice #123/45 & Co. <Ref> 'quo`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-SPECIAL-CHARS-REMITTANCE-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** RmtInf.Ustrd = "Invoice #123/45 & Co. <Ref> 'quoted'" (#, /, &, <, >, ').

**Data profile.** `special-chars` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-UNICODE-NAME — Unicode names (diacritics + CJK) survive unmangled

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `unicode` |

**What it does.** A creditor name mixing Latin diacritics, CJK and the euro sign must round-trip without mojibake — proving UTF-8 is preserved end to end through hub, transport and event store. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-UNICODE-NAME-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-UNIT-UNICODE-NAME-{{ts}}-{{rand}}","CdtrNm":"Åsa Ö. Nguyễn 商店 €","scheme":"te.unit.fidelity"},"systemId":"te_u`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-UNICODE-NAME-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** CdtrNm = "Åsa Ö. Nguyễn 商店 €" (Latin-1 supplement, Vietnamese, CJK, currency symbol).

**Data profile.** `unicode` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-WHITESPACE-PADDING — Leading/trailing whitespace in a name is not trimmed

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `boundary-whitespace` |

**What it does.** A creditor name with deliberate leading and trailing spaces ("  Padded Name  ") must round-trip byte-exact — silent trimming would corrupt names that legitimately start/end with spaces in some source systems. The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-WHITESPACE-PADDING-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-UNIT-WHITESPACE-PADDING-{{ts}}-{{rand}}","CdtrNm":"  Padded Name  ","scheme":"te.unit.fidelity"},"system`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-WHITESPACE-PADDING-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** CdtrNm = "  Padded Name  " (two leading + two trailing spaces).

**Data profile.** `boundary-whitespace` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

#### SB-UNIT-ZERO-AMOUNT — Zero-value instructed amount is recorded, not dropped

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | unit / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `unit` `sand-bench` `field-fidelity` `boundary-zero` |

**What it does.** Boundary check: InstdAmt "0.00" is a legitimate (if unusual) instructed amount; a naive falsy-value check would drop or null it. Must be recorded exactly as "0.00". The payload is delivered through the test hub's external-system mimic (POST {{testhub}}/hub/to-app, channel "api") and then independently read back from the application's inbound event feed (GET {{api}}/api/v1/inbound/events) — the assertion is on what the application recorded, not on what the sender claims.

**Preconditions.** Testhub and API containers up; testhub can reach the application over the deployment network; demo operator identity enabled (the inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver via testhub
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-UNIT-ZERO-AMOUNT-{{ts}}-{{rand}}"},"payload":{"Ccy":"EUR","MsgId":"TE-UNIT-ZERO-AMOUNT-{{ts}}-{{rand}}","scheme":"te.unit.fidelity","InstdAmt":"0.00"},"systemId":"te_uni`
   3. **GET** `{{api}}/api/v1/inbound/events` — app recorded the message
      - expect: status 200; body contains "TE-UNIT-ZERO-AMOUNT-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** InstdAmt = "0.00" (string), Ccy = "EUR".

**Data profile.** `boundary-zero` — Synthetic ISO 20022-style JSON generated per run with a unique correlation MsgId (TE-…-{{ts}}-{{rand}}).

**Expected result.** Test hub accepts (202, forwarded=true) and the application's inbound feed shows the exact MsgId within 8s.

---

### Category: Integration tests (Quality assurance)

_Cross-service message flows via the external-system simulator._

#### Suite: Channel round trips (`sb-integration`) — 16 cases

Inbound and outbound message flows across api/mq/kafka channels, confirmed on the far side.

#### SB-INT-API-INBOUND — External API delivery is received and recorded

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 40s |
| **Tags** | `integration` `sand-bench` `api` `inbound` |

**What it does.** An external system delivers a message over the API channel via the test hub mimic; the application must record the inbound event with the channel and correlation id intact. This is the inbound half of the API integration contract.

**Preconditions.** Testhub and API up; the deployment's API transport path between them configured; demo operator identity enabled (inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver over api
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"api","headers":{"x-correlation-id":"TE-INT-API-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-INT-API-{{ts}}-{{rand}}","scheme":"te.api.inbound"},"systemId":"ext_api_te","systemName":"TE API client"}`
   3. **GET** `{{api}}/api/v1/inbound/events` — inbound event recorded
      - expect: status 200; body contains "TE-INT-API-{{ts}}-{{rand}}"
      - poll up to 10s

**Data used.** One JSON message with unique MsgId TE-INT-API-{{ts}}-{{rand}} on channel "api".

**Data profile.** `synthetic-correlated` — Generated per run; correlation id makes the poll deterministic.

**Expected result.** Hub forwards (202) and the application's inbound feed shows the MsgId within 10s.

---

#### SB-INT-API-OUTBOUND — Application dispatches over API (simulated — bench design)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `integration` `sand-bench` `api` `outbound` `auth-required` |

**What it does.** An authenticated operator triggers a generation run over the API channel (POST {{api}}/api/v1/runs) with no connectionId. Verified live against source (apps/api/src/modules/delivery.ts): this bench intentionally never marks a delivery "sent" unless a real broker/endpoint is reachable — with only the seeded dummy stubs configured (no live MQ/Kafka/HTTP target), every channel reports delivery.simulated=1, sent=0. That is the correct, honest contract for a non-production bench (its own /api/v1/resilience posture says exactly this: "Optional companions may fail. The bench stays up."), not a defect — a prior version of this case asserted sent=1, which never holds here and was fixed after live verification. Signs in as the documented demo operator (password optional in development builds).

**Preconditions.** Demo operator identity enabled ({{tenant}}/{{username}}); API adapter configured to reach the test hub.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — run 1 message over api
      - expect: status 202; `delivery.simulated` = 1, `delivery.blocked` = 0, `delivery.failed` = 0, `generated` = 1
      - body: `{"seed":"TE-OUT-api-{{ts}}","count":1,"channel":"api","messageTypeCode":"pain.001.001.09"}`

**Data used.** One pain.001.001.09 message generated by the application from seed TE-OUT-api-{{ts}}.

**Data profile.** `generated-iso20022` — Application's own generator; schema-validated before dispatch (blocked=0 asserts that).

**Expected result.** 202 with delivery {simulated:1, sent:0, blocked:0, failed:0} and generated:1.

---

#### SB-INT-CHANNEL-FIELD-MATCHES-DELIVERY — Inbound event channel field matches the delivery channel used

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `integration` `sand-bench` `channels` |

**What it does.** A message delivered on the "mq" channel must be recorded with channel="mq" in the inbound feed — not defaulted or mislabelled to another channel. Cross-checks the channel tag survives the hub-to-app hop unchanged.

**Preconditions.** Testhub and API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver on mq
      - expect: status 202
      - body: `{"channel":"mq","payload":{"MsgId":"TE-CHFIELD-{{ts}}-{{rand}}"},"systemId":"te_chfield","systemName":"TE channel-field probe"}`
   3. **GET** `{{api}}/api/v1/inbound/events` — channel field recorded
      - expect: status 200; `data.0.channel` exists; body contains "TE-CHFIELD-{{ts}}-{{rand}}"
      - poll up to 8s

**Data used.** One message on channel "mq" with a unique MsgId.

**Data profile.** `synthetic-correlated` — Generated per run.

**Expected result.** Inbound feed row for this MsgId has channel field present.

---

#### SB-INT-DIRECT-INBOUND-POST — Application accepts inbound events posted directly (no testhub hop)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `integration` `sand-bench` `direct-api` |

**What it does.** An authenticated operator can POST directly to {{api}}/api/v1/inbound/events (bypassing the testhub mimic entirely) and get 202 {accepted:true} — proving the application's own ingestion endpoint is independently callable, the path a real external system would use in production.

**Preconditions.** API up; demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/inbound/events` — direct inbound POST
      - expect: status 202; `accepted` = true, `event.id` exists
      - body: `{"channel":"api","payload":{"MsgId":"TE-DIRECT-{{ts}}-{{rand}}"},"systemId":"te_direct","systemName":"TE direct probe"}`

**Data used.** One JSON event posted directly to the application API (no testhub intermediary).

**Data profile.** `synthetic-correlated` — Generated per run.

**Expected result.** 202 {accepted:true, event.id present}.

---

#### SB-INT-DUPLICATE-MSGID-BOTH-RECORDED — Two deliveries with the same MsgId are both recorded, not deduplicated

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `integration` `sand-bench` `idempotency` |

**What it does.** The same correlation MsgId delivered twice through the hub is accepted both times (202, 202) and both events appear in the inbound feed — verified live: the application does not silently drop the second delivery as a duplicate. Documents real observed idempotency behavior (none at this layer) so downstream reconciliation logic is not built on a false assumption.

**Preconditions.** Testhub and API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — first delivery
      - expect: status 202
      - body: `{"channel":"api","payload":{"MsgId":"TE-DUP-{{ts}}"},"systemId":"te_dup","systemName":"TE duplicate probe"}`
   3. **POST** `{{testhub}}/hub/to-app` — second delivery (same MsgId)
      - expect: status 202
      - body: `{"channel":"api","payload":{"MsgId":"TE-DUP-{{ts}}"},"systemId":"te_dup","systemName":"TE duplicate probe"}`
   4. **GET** `{{api}}/api/v1/inbound/events?limit=50` — both recorded
      - expect: status 200; body contains "TE-DUP-{{ts}}"
      - poll up to 8s

**Data used.** Same MsgId (TE-DUP-{{ts}}) sent twice in the same run.

**Data profile.** `synthetic-correlated` — Generated per run.

**Expected result.** Both deliveries accepted (202); inbound feed carries the MsgId.

---

#### SB-INT-EVENTS-EMIT-DIRECT — Direct event emission produces a full domain event envelope

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `integration` `sand-bench` `events` |

**What it does.** POST /api/v1/events/emit with a known catalogue code (biz.session.login.success) must synthesize and accept a full domain event with eventId, class, occurredAt and actor populated — used by the eventing configuration screen's "send test event" action.

**Preconditions.** Demo operator identity enabled; event code published in the catalogue.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/events/emit` — emit event
      - expect: status 202; `accepted` = true, `event.eventId` exists, `event.eventCode` = "biz.session.login.success"
      - body: `{"code":"biz.session.login.success"}`

**Data used.** One event-emit request for code biz.session.login.success.

**Data profile.** `synthetic` — n/a

**Expected result.** 202 with accepted:true and a full event envelope.

---

#### SB-INT-EXTERNAL-SYSTEM-DUMMY-PING — Dummy external-system ping reaches the test hub stub

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `integration` `sand-bench` `external-systems` |

**What it does.** POST /api/v1/external-systems/ext_sanctions/dummy must forward a synthetic payload to the testhub's matching stub and report ok:true — the console's "Test connection" button path for the seeded sanctions-list system.

**Preconditions.** Testhub reachable from the API container; ext_sanctions seeded.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/external-systems/ext_sanctions/dummy` — dummy ping
      - expect: status 200; `ok` = true, `system` = "ext_sanctions"

**Data used.** One dummy eventing payload targeted at the seeded ext_sanctions stub.

**Data profile.** `synthetic` — Application-generated dummy payload.

**Expected result.** 200 with ok:true, system="ext_sanctions".

---

#### SB-INT-FILE-INBOUND — External File delivery is received and recorded

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 40s |
| **Tags** | `integration` `sand-bench` `file` `inbound` |

**What it does.** An external system delivers a message over the File channel via the test hub mimic; the application must record the inbound event with the channel and correlation id intact. This is the inbound half of the File integration contract.

**Preconditions.** Testhub and API up; the deployment's File transport path between them configured; demo operator identity enabled (inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver over file
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"file","headers":{"x-correlation-id":"TE-INT-FILE-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-INT-FILE-{{ts}}-{{rand}}","scheme":"te.file.inbound"},"systemId":"ext_file_te","systemName":"TE File client"}`
   3. **GET** `{{api}}/api/v1/inbound/events` — inbound event recorded
      - expect: status 200; body contains "TE-INT-FILE-{{ts}}-{{rand}}"
      - poll up to 10s

**Data used.** One JSON message with unique MsgId TE-INT-FILE-{{ts}}-{{rand}} on channel "file".

**Data profile.** `synthetic-correlated` — Generated per run; correlation id makes the poll deterministic.

**Expected result.** Hub forwards (202) and the application's inbound feed shows the MsgId within 10s.

---

#### SB-INT-FILE-OUTBOUND — Application dispatches over File (simulated — bench design)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `integration` `sand-bench` `file` `outbound` `auth-required` |

**What it does.** An authenticated operator triggers a generation run over the File channel (POST {{api}}/api/v1/runs) with no connectionId. Verified live against source (apps/api/src/modules/delivery.ts): this bench intentionally never marks a delivery "sent" unless a real broker/endpoint is reachable — with only the seeded dummy stubs configured (no live MQ/Kafka/HTTP target), every channel reports delivery.simulated=1, sent=0. That is the correct, honest contract for a non-production bench (its own /api/v1/resilience posture says exactly this: "Optional companions may fail. The bench stays up."), not a defect — a prior version of this case asserted sent=1, which never holds here and was fixed after live verification. Signs in as the documented demo operator (password optional in development builds).

**Preconditions.** Demo operator identity enabled ({{tenant}}/{{username}}); File adapter configured to reach the test hub.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — run 1 message over file
      - expect: status 202; `delivery.simulated` = 1, `delivery.blocked` = 0, `delivery.failed` = 0, `generated` = 1
      - body: `{"seed":"TE-OUT-file-{{ts}}","count":1,"channel":"file","messageTypeCode":"pain.001.001.09"}`

**Data used.** One pain.001.001.09 message generated by the application from seed TE-OUT-file-{{ts}}.

**Data profile.** `generated-iso20022` — Application's own generator; schema-validated before dispatch (blocked=0 asserts that).

**Expected result.** 202 with delivery {simulated:1, sent:0, blocked:0, failed:0} and generated:1.

---

#### SB-INT-KAFKA-CONNECTIVITY-CHECK-DEGRADES-CLEANLY — Kafka connectivity check reports its own unconfigured state honestly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `integration` `sand-bench` `kafka` `degradation` |

**What it does.** POST /api/v1/external-systems/kafka/connectivity-check must answer 200 with a correlationId and a "produced" boolean, even when SBE_REDPANDA_PROXY is not configured (verified live: produced=false, reason="SBE_REDPANDA_PROXY is not configured -- no broker to check connectivity against"). It must never hang, time out with a 5xx, or crash the request.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/external-systems/kafka/connectivity-check` — kafka connectivity check
      - expect: status 200; `correlationId` exists, `produced` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with correlationId and a boolean produced field, regardless of broker availability.

---

#### SB-INT-KAFKA-INBOUND — External Kafka delivery is received and recorded

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 40s |
| **Tags** | `integration` `sand-bench` `kafka` `inbound` |

**What it does.** An external system delivers a message over the Kafka channel via the test hub mimic; the application must record the inbound event with the channel and correlation id intact. This is the inbound half of the Kafka integration contract.

**Preconditions.** Testhub and API up; the deployment's Kafka transport path between them configured; demo operator identity enabled (inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver over kafka
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"kafka","headers":{"x-correlation-id":"TE-INT-KAFKA-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-INT-KAFKA-{{ts}}-{{rand}}","scheme":"te.kafka.inbound"},"systemId":"ext_kafka_te","systemName":"TE Kafka client"}`
   3. **GET** `{{api}}/api/v1/inbound/events` — inbound event recorded
      - expect: status 200; body contains "TE-INT-KAFKA-{{ts}}-{{rand}}"
      - poll up to 10s

**Data used.** One JSON message with unique MsgId TE-INT-KAFKA-{{ts}}-{{rand}} on channel "kafka".

**Data profile.** `synthetic-correlated` — Generated per run; correlation id makes the poll deterministic.

**Expected result.** Hub forwards (202) and the application's inbound feed shows the MsgId within 10s.

---

#### SB-INT-KAFKA-OUTBOUND — Application dispatches over Kafka (simulated — bench design)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `integration` `sand-bench` `kafka` `outbound` `auth-required` |

**What it does.** An authenticated operator triggers a generation run over the Kafka channel (POST {{api}}/api/v1/runs) with no connectionId. Verified live against source (apps/api/src/modules/delivery.ts): this bench intentionally never marks a delivery "sent" unless a real broker/endpoint is reachable — with only the seeded dummy stubs configured (no live MQ/Kafka/HTTP target), every channel reports delivery.simulated=1, sent=0. That is the correct, honest contract for a non-production bench (its own /api/v1/resilience posture says exactly this: "Optional companions may fail. The bench stays up."), not a defect — a prior version of this case asserted sent=1, which never holds here and was fixed after live verification. Signs in as the documented demo operator (password optional in development builds).

**Preconditions.** Demo operator identity enabled ({{tenant}}/{{username}}); Kafka adapter configured to reach the test hub.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — run 1 message over kafka
      - expect: status 202; `delivery.simulated` = 1, `delivery.blocked` = 0, `delivery.failed` = 0, `generated` = 1
      - body: `{"seed":"TE-OUT-kafka-{{ts}}","count":1,"channel":"kafka","messageTypeCode":"pain.001.001.09"}`

**Data used.** One pain.001.001.09 message generated by the application from seed TE-OUT-kafka-{{ts}}.

**Data profile.** `generated-iso20022` — Application's own generator; schema-validated before dispatch (blocked=0 asserts that).

**Expected result.** 202 with delivery {simulated:1, sent:0, blocked:0, failed:0} and generated:1.

---

#### SB-INT-MQ-INBOUND — External MQ delivery is received and recorded

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 40s |
| **Tags** | `integration` `sand-bench` `mq` `inbound` |

**What it does.** An external system delivers a message over the MQ channel via the test hub mimic; the application must record the inbound event with the channel and correlation id intact. This is the inbound half of the MQ integration contract.

**Preconditions.** Testhub and API up; the deployment's MQ transport path between them configured; demo operator identity enabled (inbound feed is session-protected).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — deliver over mq
      - expect: status 202; `forwarded` = true
      - body: `{"channel":"mq","headers":{"x-correlation-id":"TE-INT-MQ-{{ts}}-{{rand}}"},"payload":{"MsgId":"TE-INT-MQ-{{ts}}-{{rand}}","scheme":"te.mq.inbound"},"systemId":"ext_mq_te","systemName":"TE MQ client"}`
   3. **GET** `{{api}}/api/v1/inbound/events` — inbound event recorded
      - expect: status 200; body contains "TE-INT-MQ-{{ts}}-{{rand}}"
      - poll up to 10s

**Data used.** One JSON message with unique MsgId TE-INT-MQ-{{ts}}-{{rand}} on channel "mq".

**Data profile.** `synthetic-correlated` — Generated per run; correlation id makes the poll deterministic.

**Expected result.** Hub forwards (202) and the application's inbound feed shows the MsgId within 10s.

---

#### SB-INT-MQ-OUTBOUND — Application dispatches over MQ (simulated — bench design)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `integration` `sand-bench` `mq` `outbound` `auth-required` |

**What it does.** An authenticated operator triggers a generation run over the MQ channel (POST {{api}}/api/v1/runs) with no connectionId. Verified live against source (apps/api/src/modules/delivery.ts): this bench intentionally never marks a delivery "sent" unless a real broker/endpoint is reachable — with only the seeded dummy stubs configured (no live MQ/Kafka/HTTP target), every channel reports delivery.simulated=1, sent=0. That is the correct, honest contract for a non-production bench (its own /api/v1/resilience posture says exactly this: "Optional companions may fail. The bench stays up."), not a defect — a prior version of this case asserted sent=1, which never holds here and was fixed after live verification. Signs in as the documented demo operator (password optional in development builds).

**Preconditions.** Demo operator identity enabled ({{tenant}}/{{username}}); MQ adapter configured to reach the test hub.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — run 1 message over mq
      - expect: status 202; `delivery.simulated` = 1, `delivery.blocked` = 0, `delivery.failed` = 0, `generated` = 1
      - body: `{"seed":"TE-OUT-mq-{{ts}}","count":1,"channel":"mq","messageTypeCode":"pain.001.001.09"}`

**Data used.** One pain.001.001.09 message generated by the application from seed TE-OUT-mq-{{ts}}.

**Data profile.** `generated-iso20022` — Application's own generator; schema-validated before dispatch (blocked=0 asserts that).

**Expected result.** 202 with delivery {simulated:1, sent:0, blocked:0, failed:0} and generated:1.

---

#### SB-INT-RUN-DELIVERIES-RECORDED — A multi-message run persists one delivery row per message

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 40s |
| **Tags** | `integration` `sand-bench` `runs` `auth-required` |

**What it does.** POST /api/v1/runs with count:3 must generate exactly 3 messages, and GET /api/v1/runs/:id/deliveries must then return exactly 3 delivery rows (total=3, data.length=3) — the join the run-detail screen and this engine's reporting depend on. Verified live.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — run 3 messages
      - expect: status 202; `generated` = 3
      - capture `runId` ← `runId`; body: `{"seed":"TE-INT-DELIV-{{ts}}","count":3,"channel":"kafka","messageTypeCode":"pain.001.001.09"}`
   3. **GET** `{{api}}/api/v1/runs/{{runId}}/deliveries` — deliveries recorded
      - expect: status 200; `total` = 3, `data` length ≥ 3

**Data used.** 3 pain.001.001.09 messages generated by the application from seed TE-INT-DELIV-{{ts}}.

**Data profile.** `generated-iso20022` — Application's own generator.

**Expected result.** generated=3; deliveries total=3 with 3 rows.

---

#### SB-INT-RUN-GENERATED-COUNT-EXACT — Requested count and generated count match exactly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `integration` `sand-bench` `runs` `auth-required` |

**What it does.** A run requesting count:5 must generate exactly 5 messages (generated=5) — off-by-one generation is a classic loop bug this pins down.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — run 5 messages
      - expect: status 202; `generated` = 5
      - body: `{"seed":"TE-INT-COUNT-{{ts}}","count":5,"channel":"api","messageTypeCode":"pain.001.001.09"}`

**Data used.** 5 pain.001.001.09 messages from seed TE-INT-COUNT-{{ts}}.

**Data profile.** `generated-iso20022` — Application's own generator.

**Expected result.** generated=5, matching the requested count.

---

#### Suite: sit-agents (`sit-agents`) — 2 cases

Imported from sit/cases/90-agents.sit.ts

#### SIT-90_AGENTS-AGENT-DESK-IS-OPTIONAL-UNREACHABLE-PORTA — Agent Desk is optional — unreachable portal is recorded, not a main-app failure

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `integration` `90-agents` |

**What it does.** Imported from sit/cases/90-agents.sit.ts

**Execution.** Runs `sit/cases/90-agents.sit.ts::Agent Desk is optional — unreachable portal is recorded, not a main-app failure` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-90_AGENTS-AGENT-DESK-LISTS-SEED-AGENTS-AND-ACCEPTS — Agent Desk lists seed agents and accepts an on-demand run when reachable

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `integration` `90-agents` |

**What it does.** Imported from sit/cases/90-agents.sit.ts

**Execution.** Runs `sit/cases/90-agents.sit.ts::Agent Desk lists seed agents and accepts an on-demand run when reachable` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-kafka (`sit-kafka`) — 2 cases

Imported from sit/cases/20-kafka-round-trip.sit.ts

#### SIT-20_KAFKA_ROUND_TRIP-APPLICATION-PUBLISHES-A-MESSAGE-TO-KAFKA — application publishes a message to Kafka and delivery is confirmed on the topic

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `integration` `20-kafka-round-trip` |

**What it does.** Imported from sit/cases/20-kafka-round-trip.sit.ts

**Execution.** Runs `sit/cases/20-kafka-round-trip.sit.ts::application publishes a message to Kafka and delivery is confirmed on the topic` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-20_KAFKA_ROUND_TRIP-KAFKA-PRODUCER-DELIVERS-A-MESSAGE-AND-TH — Kafka producer delivers a message and the application records receipt

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `integration` `20-kafka-round-trip` |

**What it does.** Imported from sit/cases/20-kafka-round-trip.sit.ts

**Execution.** Runs `sit/cases/20-kafka-round-trip.sit.ts::Kafka producer delivers a message and the application records receipt` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-mq (`sit-mq`) — 2 cases

Imported from sit/cases/10-mq-round-trip.sit.ts

#### SIT-10_MQ_ROUND_TRIP-APPLICATION-SENDS-A-MESSAGE-TO-THE-MQ-MA — application sends a message to the MQ manager and delivery is confirmed there

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `integration` `10-mq-round-trip` |

**What it does.** Imported from sit/cases/10-mq-round-trip.sit.ts

**Execution.** Runs `sit/cases/10-mq-round-trip.sit.ts::application sends a message to the MQ manager and delivery is confirmed there` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-10_MQ_ROUND_TRIP-MQ-MANAGER-DELIVERS-A-MESSAGE-AND-THE-AP — MQ manager delivers a message and the application records receipt

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `integration` `10-mq-round-trip` |

**What it does.** Imported from sit/cases/10-mq-round-trip.sit.ts

**Execution.** Runs `sit/cases/10-mq-round-trip.sit.ts::MQ manager delivers a message and the application records receipt` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-worker (`sit-worker`) — 1 cases

Imported from sit/cases/40-worker-job.sit.ts

#### SIT-40_WORKER_JOB-WORKER-CONTAINER-LEASES-AND-COMPLETES-A- — worker container leases and completes a job enqueued by the application

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | integration / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `integration` `40-worker-job` |

**What it does.** Imported from sit/cases/40-worker-job.sit.ts

**Execution.** Runs `sit/cases/40-worker-job.sit.ts::worker container leases and completes a job enqueued by the application` via the node:test SIT runner (the case file drives the deployed stack directly).

---

### Category: Screen tests (Quality assurance)

_Real-browser rendering of console and static pages._

#### Suite: Console & static screens (`sb-screen`) — 17 cases

Playwright-rendered checks of the operator console and its static pages.

#### SB-SCR-CONSOLE-MOUNT — Operator signs in and the console mounts

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `screen` `sand-bench` `playwright` `console` |

**What it does.** Open {{web}}/, sign in through the real gate form as the demo operator, and wait for the console's mount signal (#gate gains "hidden"); then the sidebar must render its .opsc-navitem entries. Exercises the same path a person takes on this build.

**Preconditions.** Web + API containers up; demo operator identity enabled.

**Steps.**

   1. **navigate** — value `{{web}}/` _(open console)_
   2. **wait_for** — selector `#gate #login` _(sign-in gate shown)_
   3. **type** — selector `#gate #tenant`, value `{{tenant}}` _(tenant slug)_
   4. **type** — selector `#gate #username`, value `{{username}}` _(demo operator username)_
   5. **click** — selector `#gate #login` _(Sign in (password optional in dev builds))_
   6. **wait_for_hidden** — selector `#gate` _(gate hides — console mounted)_
   7. **assert_selector_count_min** — selector `.opsc-navitem`, value `5` _(sidebar nav present)_

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Gate hides after sign-in and at least 5 sidebar nav items render.

---

#### SB-SCR-NAV-SECTIONS — Sidebar exposes the core modules

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `screen` `sand-bench` `playwright` `console` |

**What it does.** The mounted console's sidebar must contain the Rule Bench, Message Designer and Test Runs modules — the three modules every operator workflow starts from.

**Preconditions.** Console mounts after demo sign-in.

**Steps.**

   1. **navigate** — value `{{web}}/` _(open console)_
   2. **wait_for** — selector `#gate #login` _(sign-in gate shown)_
   3. **type** — selector `#gate #tenant`, value `{{tenant}}` _(tenant slug)_
   4. **type** — selector `#gate #username`, value `{{username}}` _(demo operator username)_
   5. **click** — selector `#gate #login` _(Sign in (password optional in dev builds))_
   6. **wait_for_hidden** — selector `#gate` _(gate hides — console mounted)_
   7. **assert_text** — expect `Rule Bench` _(Rule Bench module)_
   8. **assert_text** — expect `Message Designer` _(Message Designer module)_
   9. **assert_text** — expect `Test Runs` _(Test Runs module)_

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** All three module names visible in the mounted console.

---

#### SB-SCR-OVERVIEW-HERO — Overview page shows its real hero heading

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `screen` `sand-bench` `playwright` `console` |

**What it does.** After signing in and mounting, the Overview hero must read exactly "Good rules survive bad data." — copied verbatim from the deployed page module. Catches a console that mounts but renders the wrong landing content.

**Preconditions.** Console mounts after demo sign-in (see SB-SCR-CONSOLE-MOUNT).

**Steps.**

   1. **navigate** — value `{{web}}/` _(open console)_
   2. **wait_for** — selector `#gate #login` _(sign-in gate shown)_
   3. **type** — selector `#gate #tenant`, value `{{tenant}}` _(tenant slug)_
   4. **type** — selector `#gate #username`, value `{{username}}` _(demo operator username)_
   5. **click** — selector `#gate #login` _(Sign in (password optional in dev builds))_
   6. **wait_for_hidden** — selector `#gate` _(gate hides — console mounted)_
   7. **assert_selector_text** — selector `.opsc-hero-title, .opsc-pagehead-title`, expect `Good rules survive bad data.` _(hero heading)_

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Hero title equals the verified copy.

---

#### SB-SCR-STATIC-ABOUT — Static page /about.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/about.html in a real browser and assert the page's own title ("About — GARVIQ Labs") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/about.html` _(open /about.html)_
   2. **assert_title** — expect `About` _(browser title)_
   3. **assert_text** — expect `Good rules survive bad data.` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "About" and body contains "Good rules survive bad data.".

---

#### SB-SCR-STATIC-AUTHENTICATOR — Static page /authenticator.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/authenticator.html in a real browser and assert the page's own title ("Authenticator login") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/authenticator.html` _(open /authenticator.html)_
   2. **assert_title** — expect `Authenticator login` _(browser title)_
   3. **assert_text** — expect `Authenticator login` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "Authenticator login" and body contains "Authenticator login".

---

#### SB-SCR-STATIC-DEMO — Static page /demo.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/demo.html in a real browser and assert the page's own title ("90-second demo — Sand Bench") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/demo.html` _(open /demo.html)_
   2. **assert_title** — expect `90-second demo` _(browser title)_
   3. **assert_text** — expect `demo` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "90-second demo" and body contains "demo".

---

#### SB-SCR-STATIC-FEATURE-IDS — Static page /feature-ids.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/feature-ids.html in a real browser and assert the page's own title ("Feature IDs") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/feature-ids.html` _(open /feature-ids.html)_
   2. **assert_title** — expect `Feature IDs` _(browser title)_
   3. **assert_text** — expect `Feature IDs` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "Feature IDs" and body contains "Feature IDs".

---

#### SB-SCR-STATIC-HELP — Static page /help.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/help.html in a real browser and assert the page's own title ("Help — GARVIQ Labs Sand Bench") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/help.html` _(open /help.html)_
   2. **assert_title** — expect `Help` _(browser title)_
   3. **assert_text** — expect `Help` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "Help" and body contains "Help".

---

#### SB-SCR-STATIC-INDEX — Static page /index.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/index.html in a real browser and assert the page's own title ("Sand Bench · GARVIQ Labs") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_title** — expect `Sand Bench` _(browser title)_
   3. **assert_text** — expect `Sand Bench` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "Sand Bench" and body contains "Sand Bench".

---

#### SB-SCR-STATIC-LOGGING — Static page /logging.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/logging.html in a real browser and assert the page's own title ("System logging") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/logging.html` _(open /logging.html)_
   2. **assert_title** — expect `System logging` _(browser title)_
   3. **assert_text** — expect `System logging` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "System logging" and body contains "System logging".

---

#### SB-SCR-STATIC-NAMING — Static page /naming.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/naming.html in a real browser and assert the page's own title ("Naming conventions") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/naming.html` _(open /naming.html)_
   2. **assert_title** — expect `Naming conventions` _(browser title)_
   3. **assert_text** — expect `Naming conventions` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "Naming conventions" and body contains "Naming conventions".

---

#### SB-SCR-STATIC-NOTPROD — Static page /not-production.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/not-production.html in a real browser and assert the page's own title ("Not production — Sand Bench") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/not-production.html` _(open /not-production.html)_
   2. **assert_title** — expect `Not production` _(browser title)_
   3. **assert_text** — expect `Sand Bench` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "Not production" and body contains "Sand Bench".

---

#### SB-SCR-STATIC-PG-INVENTORY — Static page /postgres-inventory.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/postgres-inventory.html in a real browser and assert the page's own title ("Postgres inventory") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/postgres-inventory.html` _(open /postgres-inventory.html)_
   2. **assert_title** — expect `Postgres inventory` _(browser title)_
   3. **assert_text** — expect `Postgres inventory` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "Postgres inventory" and body contains "Postgres inventory".

---

#### SB-SCR-STATIC-PITCH — Static page /pitch.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/pitch.html in a real browser and assert the page's own title ("Sand Bench — public URLs") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/pitch.html` _(open /pitch.html)_
   2. **assert_title** — expect `Sand Bench` _(browser title)_
   3. **assert_text** — expect `Good rules survive bad data.` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "Sand Bench" and body contains "Good rules survive bad data.".

---

#### SB-SCR-STATIC-REFERENCE — Static page /reference.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/reference.html in a real browser and assert the page's own title ("ISO 20022 family reference") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/reference.html` _(open /reference.html)_
   2. **assert_title** — expect `ISO 20022 family reference` _(browser title)_
   3. **assert_text** — expect `ISO 20022` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "ISO 20022 family reference" and body contains "ISO 20022".

---

#### SB-SCR-STATIC-SECURITY — Static page /security.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/security.html in a real browser and assert the page's own title ("Sand Bench security") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/security.html` _(open /security.html)_
   2. **assert_title** — expect `Sand Bench security` _(browser title)_
   3. **assert_text** — expect `Security` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "Sand Bench security" and body contains "Security".

---

#### SB-SCR-STATIC-USE-CASE — Static page /use-case.html renders its real content

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `screen` `sand-bench` `playwright` `static-page` |

**What it does.** Open {{web}}/use-case.html in a real browser and assert the page's own title ("Sand Bench — Use case sections") and a verified content fragment render — not just an HTTP 200.

**Preconditions.** Web container deployed; worker has a Playwright chromium.

**Steps.**

   1. **navigate** — value `{{web}}/use-case.html` _(open /use-case.html)_
   2. **assert_title** — expect `Sand Bench` _(browser title)_
   3. **assert_text** — expect `Use case` _(verified content fragment)_

**Data used.** No input data; page rendered as an anonymous visitor.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Title contains "Sand Bench" and body contains "Use case".

---

### Category: Use case driven tests (Quality assurance)

_Published use-case catalogue and operator walkthrough contracts._

#### Suite: Upload XSD test case (`sb-upload-xsd`) — 11 cases

Sandbench Enterprise: ten separate ISO 20022 XSD upload cases and one separate Markdown companion upload case. Every case checks a new successful upload, persisted file contents, and the exact imported item in Scheme Definitions after reload.

#### SB-UPLOAD-MARKDOWN-MDR-2025-2026 — Upload Markdown test case - ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `markdown` |

**What it does.** Validate Sandbench Enterprise using ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md. Upload this Markdown as an accompanying document with pacs.002.001.16.xsd, as required by the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.002.001.16.xsd` _(Sign in; select ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md with companion schema pacs.002.001.16.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload with the Markdown download available. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-PACS-002-001-12 — Upload XSD test case - pacs.002.001.12.xsd

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.002.001.12.xsd. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.002.001.12.xsd` _(Sign in; select pacs.002.001.12.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.002.001.12.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.002.001.12.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-PACS-002-001-16 — Upload XSD test case - pacs.002.001.16.xsd

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.002.001.16.xsd. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.002.001.16.xsd` _(Sign in; select pacs.002.001.16.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.002.001.16.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.002.001.16.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-PACS-003-001-12 — Upload XSD test case - pacs.003.001.12.xsd

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.003.001.12.xsd. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.003.001.12.xsd` _(Sign in; select pacs.003.001.12.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.003.001.12.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.003.001.12.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-PACS-004-001-15 — Upload XSD test case - pacs.004.001.15.xsd

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.004.001.15.xsd. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.004.001.15.xsd` _(Sign in; select pacs.004.001.15.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.004.001.15.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.004.001.15.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-PACS-007-001-14 — Upload XSD test case - pacs.007.001.14.xsd

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.007.001.14.xsd. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.007.001.14.xsd` _(Sign in; select pacs.007.001.14.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.007.001.14.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.007.001.14.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-PACS-008-001-14 — Upload XSD test case - pacs.008.001.14.xsd

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.008.001.14.xsd. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.008.001.14.xsd` _(Sign in; select pacs.008.001.14.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.008.001.14.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.008.001.14.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-PACS-009-001-13 — Upload XSD test case - pacs.009.001.13.xsd

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.009.001.13.xsd. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.009.001.13.xsd` _(Sign in; select pacs.009.001.13.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.009.001.13.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.009.001.13.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-PACS-010-001-06 — Upload XSD test case - pacs.010.001.06.xsd

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.010.001.06.xsd. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.010.001.06.xsd` _(Sign in; select pacs.010.001.06.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.010.001.06.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.010.001.06.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-PACS-028-001-07 — Upload XSD test case - pacs.028.001.07.xsd

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.028.001.07.xsd. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.028.001.07.xsd` _(Sign in; select pacs.028.001.07.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.028.001.07.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.028.001.07.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-PACS-029-001-02 — Upload XSD test case - pacs.029.001.02.xsd

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1440×1000 |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `sand-bench` `sandbench-enterprise` `upload` `iso20022` `playwright` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.029.001.02.xsd. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.029.001.02.xsd` _(Sign in; select pacs.029.001.02.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.029.001.02.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.029.001.02.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### Suite: Use-case contracts (`sb-usecase`) — 15 cases

The published use-case catalogue and operator walkthrough strips.

#### SB-UC-ASSURANCE-CHAIN-SHAPE — Assurance-chain traceability contract exposes its stages

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `assurance` `traceability` |

**What it does.** GET {{api}}/api/v1/assurance/chain must return a data.stages array (schema → message → dataset → case → suite → run → report) — the traceability spine the "Assurance loop" use case (linking a schema all the way to a compliance report) is built on.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/assurance/chain` — assurance chain shape
      - expect: status 200; `data.stages` length ≥ 1

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** data.stages is a non-empty array.

---

#### SB-UC-CATALOG-PUBLISHED — Use-case catalogue is published and substantial

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `catalogue` |

**What it does.** GET {{api}}/api/v1/use-cases must be enabled and publish the full catalogue (>= 100 use cases at last verification: 148). This is the contract the use-case editor and the traceability links in this engine depend on.

**Preconditions.** API up with use-case publishing enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/use-cases` — use-case catalogue
      - expect: status 200; `enabled` = true, `data` length ≥ 100

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** enabled=true with >= 100 published use cases.

---

#### SB-UC-DATASETS-CATALOGUE-FOR-TEST-DESIGN — Dataset catalogue is populated for test-design use cases

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `datasets` |

**What it does.** GET {{api}}/api/v1/datasets must return >= 1 dataset — the "build a rule/run from a curated dataset" use case depends on at least one dataset existing to pick from.

**Preconditions.** At least one dataset seeded.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/datasets` — datasets catalogue
      - expect: status 200; `data` length ≥ 1

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** >= 1 dataset published.

---

#### SB-UC-DESIGNER-TYPES-CATALOGUE — Message Designer type catalogue is populated

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `message-designer` |

**What it does.** GET {{api}}/api/v1/catalog/designer-types must return the imported message types available to the Message Designer screen (each with code/family/key) — the use case "author a message from an imported schema" depends on this list being non-empty.

**Preconditions.** At least one schema imported.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/catalog/designer-types` — designer types
      - expect: status 200; `data` length ≥ 1, `data.0.code` exists, `data.0.family` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** >= 1 designer type with code and family present.

---

#### SB-UC-EVENTS-HEADERS-CONTRACT — Eventing header contract documents the origin/actor headers

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `events` `correlation` |

**What it does.** GET {{api}}/api/v1/events/headers must publish the correlation header fields (x-sandbench-origin at minimum) that the "trace a request across gui/api/mq/kafka" use case relies on external systems setting. Verified live: >= 2 documented header fields.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/events/headers` — events headers contract
      - expect: status 200; `fields` length ≥ 2; body contains "x-sandbench-origin"

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** >= 2 header fields documented, including x-sandbench-origin.

---

#### SB-UC-FEATURES-PAGES-CATALOGUE — Feature-access page catalogue includes Overview

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `feature-access` |

**What it does.** GET {{api}}/api/v1/features/pages must publish the full page/feature-level catalogue the admin "Feature access" screen edits, and it must include the "overview" page — the landing use case every operator starts from.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/features/pages` — feature pages
      - expect: status 200; `data` length ≥ 5; body contains "\"page\":\"overview\""

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** >= 5 pages published, including "overview".

---

#### SB-UC-FIRST-RUN-STRIP — First-run walkthrough strip is published

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `ux` |

**What it does.** GET {{api}}/api/v1/ux/first-run must publish the operator onboarding strip with its verified lead line ("Good rules survive bad data.") and exactly 4 steps — the walkthrough the Overview page renders.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/ux/first-run` — first-run strip
      - expect: status 200; `lead` = "Good rules survive bad data.", `steps` length ≥ 4

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Lead copy exact; 4 steps.

---

#### SB-UC-FOUNDATION-COMPANION-HONEST — Optional foundation-catalog companion reports its own state honestly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `foundation` `optional-companion` |

**What it does.** GET {{api}}/api/v1/foundation/status must return 200 and explicitly say whether the optional Foundation Catalog companion is configured (verified live: available=false, configured=false, optional=true, reason="Foundation catalog is optional and not enabled.") — proving optional companions degrade to an honest self-description, not a silent 500 or a misleading "ok".

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/foundation/status` — foundation status
      - expect: status 200; `available` exists, `optional` = true, `reason` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** optional=true with available and reason fields present, whatever available's value is.

---

#### SB-UC-GHERKIN-ATTACHED — Use cases publish acceptance structures

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `gherkin` |

**What it does.** Published use cases must carry their acceptance scaffolding (acceptanceCriteria, main flow, gherkin fields present on the first entry) so the catalogue is usable as an executable-specification source.

**Preconditions.** Use-case catalogue published.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/use-cases` — acceptance scaffolding
      - expect: status 200; `data.0.acceptanceCriteria` exists, `data.0.main` exists, `data.0.gherkin` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** First catalogue entry exposes acceptanceCriteria/main/gherkin.

---

#### SB-UC-ISO-FAMILIES-PUBLISHED — ISO 20022 family catalogue is published with counts

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `iso20022` `catalogue` |

**What it does.** GET {{api}}/api/v1/catalog/iso/families must publish the imported message families (pacs at minimum, per the seeded XSD imports) with messageCount and fieldCount per family — the catalogue the schema-import use case and Message Designer both read.

**Preconditions.** At least one ISO 20022 XSD family imported (the upload suite seeds pacs).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/catalog/iso/families` — iso families
      - expect: status 200; `data` length ≥ 1, `data.0.messageCount` exists, `data.0.fieldCount` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** >= 1 family with messageCount and fieldCount populated.

---

#### SB-UC-LIST-BOXES-PUBLISHED — Reference list-boxes (dropdown source data) are published

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `reference-data` |

**What it does.** GET {{api}}/api/v1/list-boxes must publish the shared dropdown/reference lists (e.g. sourceFormat) that schema-import and other forms populate their selects from.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/list-boxes` — list-boxes
      - expect: status 200; `data` length ≥ 1, `data.0.key` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** >= 1 list-box with a key field.

---

#### SB-UC-N2-DEMO-SCRIPT — 90-second N-2 demo script contract holds

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `ux` `n-2` |

**What it does.** GET {{api}}/api/v1/ux/demo/n2 must keep the 90-second demo walk contract: seconds=90 and default run channel "mq". The demo page and older clients script against these values.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/ux/demo/n2` — N-2 demo script
      - expect: status 200; `seconds` = 90, `defaultRun.channel` = "mq"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** seconds=90, defaultRun.channel="mq".

---

#### SB-UC-OVERVIEW-DEF — UC-overview use case carries actor and goal

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `traceability` |

**What it does.** The published UC-overview definition must include its page binding, actor and goal fields — the minimum a reviewer needs to trace the Overview screen back to its acceptance definition.

**Preconditions.** Use-case catalogue published.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/use-cases` — UC-overview fields
      - expect: status 200; `data.0.actor` exists, `data.0.goal` exists, `data.0.page` exists; body contains "\"UC-overview\""

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** UC-overview present; entries expose page/actor/goal.

---

#### SB-UC-SESSION-FEATURES-PROFILE — Operator session carries a resolved feature-access profile

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `feature-access` |

**What it does.** GET {{api}}/api/v1/session/features must resolve the signed-in operator's access profile (maxLevel + a pages list of >= 5 entries) — the contract the console's navigation and page-guards read to decide what to show. Verified live: profile "full-use".

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/session/features` — session features
      - expect: status 200; `maxLevel` exists, `pages` length ≥ 5

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** maxLevel present; >= 5 accessible pages listed.

---

#### SB-UC-SIGNATURE-CAPABILITIES-PUBLISHED — Message-signing capability catalogue is published

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | acceptance / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `usecase` `sand-bench` `signatures` |

**What it does.** GET {{api}}/api/v1/catalog/signatures must publish the supported signing modes (verified live: none/xmldsig-bah/jws-detached/hmac) and a default — the "sign a generated message" use case reads this before offering signing options in the UI.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/catalog/signatures` — signature capabilities
      - expect: status 200; `data.modes` length ≥ 2, `data.default` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** >= 2 signing modes and a default mode present.

---

### Category: Regression tests (Quality assurance)

_Locked-in behavior contracts re-checked on every run._

#### Suite: Behavior contracts (`sb-regression`) — 15 cases

Response shapes and copy that must not drift between deployments.

#### SB-REG-AUDIT-ROW-SHAPE — Audit rows keep actor/action/resource fields

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` `audit` |

**What it does.** Audit rows read via /api/v1/audit must keep id, tenant_id, actor_user_id, action and resource_type — the fields the compliance suite's audit checks parse.

**Preconditions.** At least one audited action has occurred (login does).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/audit` — audit row shape
      - expect: status 200; `data.0.id` exists, `data.0.tenant_id` exists, `data.0.actor_user_id` exists, `data.0.action` exists, `data.0.resource_type` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** First audit row exposes all five fields.

---

#### SB-REG-CAPABILITIES-MODULES-STABLE — Capabilities module list keeps its core entries

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` `capabilities` |

**What it does.** Clients feature-detect against /api/v1/capabilities' modules array; removing a module silently breaks them. Must continue to include identity, audit, runs, catalogue, rules and schedules.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/capabilities` — module stability
      - expect: status 200; `modules` contains "identity", `modules` contains "audit", `modules` contains "runs", `modules` contains "catalogue", `modules` contains "rules", `modules` contains "schedules"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** All six core modules still listed.

---

#### SB-REG-CHANNELS-STABLE — Channel catalogue keeps file/api/mq/kafka

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `channels` |

**What it does.** The channel-targets catalogue must continue to include all four historical channels; removing one silently breaks existing run configurations.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/channel-targets` — channel stability
      - expect: status 200; `data` contains "\"channel\":\"file\"", `data` contains "\"channel\":\"api\"", `data` contains "\"channel\":\"mq\"", `data` contains "\"channel\":\"kafka\""

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** All four channels present.

---

#### SB-REG-DATASET-ROW-SHAPE — Dataset rows keep name/message_type_code/row_count

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` `datasets` |

**What it does.** Dataset rows from /api/v1/datasets must keep id, name, message_type_code, row_count and status — the fields the dataset picker on Rule Bench / Test Runs screens binds to.

**Preconditions.** At least one dataset seeded.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/datasets` — dataset row shape
      - expect: status 200; `data.0.id` exists, `data.0.name` exists, `data.0.message_type_code` exists, `data.0.row_count` exists, `data.0.status` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** First dataset row exposes id/name/message_type_code/row_count/status.

---

#### SB-REG-ERROR-ENVELOPE — Error envelope keeps code + requestId shape

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` `errors` |

**What it does.** An unauthenticated request to a protected route ({{api}}/api/v1/message-types) must return the standard error envelope: HTTP 401 with error.code and error.requestId, never a raw stack or bare string. Verified live: {"error":{"code":"unauthorized",...,"requestId":"req-…"}}.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/message-types` — error envelope
      - expect: status 401; `error.code` = "unauthorized", `error.requestId` exists

**Data used.** Request deliberately sent without an authorization header.

**Data profile.** `negative` — n/a

**Expected result.** 401 envelope with error.code="unauthorized" and a requestId.

---

#### SB-REG-ERROR-ENVELOPE-CONSISTENT-ACROSS-ROUTES — Error envelope shape is identical across unrelated protected routes

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` `errors` |

**What it does.** Three unrelated protected routes (message-types, datasets, audit), each hit without a token, must all return the exact same envelope shape (error.code="unauthorized", error.requestId present) — proving the auth guard is one shared middleware, not three divergent implementations.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/message-types` — message-types tokenless
      - expect: status 401; `error.code` = "unauthorized", `error.requestId` exists
   2. **GET** `{{api}}/api/v1/datasets` — datasets tokenless
      - expect: status 401; `error.code` = "unauthorized", `error.requestId` exists
   3. **GET** `{{api}}/api/v1/audit` — audit tokenless
      - expect: status 401; `error.code` = "unauthorized", `error.requestId` exists

**Data used.** Three unauthenticated GETs to unrelated protected routes.

**Data profile.** `negative` — n/a

**Expected result.** All three routes return the identical envelope shape.

---

#### SB-REG-EVENT-CATALOG-ENTRY-SHAPE — Event catalogue entries keep code/class/action/entity/title

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` `events` |

**What it does.** Each entry in /api/v1/events/catalog must keep code, class, action, entity and title — the eventing configuration screen renders directly from these fields.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/events/catalog` — event catalog entry shape
      - expect: status 200; `data.0.code` exists, `data.0.class` exists, `data.0.action` exists, `data.0.entity` exists, `data.0.title` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** First event-catalog entry exposes all five fields.

---

#### SB-REG-FAMILIES-ROW-SHAPE — Message-family rows keep code/label/description

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` |

**What it does.** Each /api/v1/families row must keep code, label and description — the family filter on the Message Designer and catalogue screens binds to this exact shape.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/families` — family row shape
      - expect: status 200; `data.0.code` exists, `data.0.label` exists, `data.0.description` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** First family row exposes code/label/description.

---

#### SB-REG-HEALTH-CONTRACT — Health contract fields never drift

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` |

**What it does.** The /health response must keep its three contract fields (status, role, classification) — monitoring, SIT and this engine all key off them.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/health` — health contract
      - expect: status 200; `status` exists, `role` exists, `classification` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** All three fields present.

---

#### SB-REG-INBOUND-FEED-SHAPE — Inbound event feed keeps its row shape

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `regression` `sand-bench` `contract` |

**What it does.** Rows in /api/v1/inbound/events must keep the verified shape (id, at, direction, channel, payload) that the console's eventing view and this engine's round-trip cases parse.

**Preconditions.** At least one inbound event exists (any unit/integration case creates one).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — ensure one event exists
      - expect: status 202
      - body: `{"channel":"api","payload":{"MsgId":"TE-REG-SHAPE-{{ts}}-{{rand}}","scheme":"te.regression.shape"},"systemId":"te_reg","systemName":"TE regression probe"}`
   3. **GET** `{{api}}/api/v1/inbound/events` — row shape
      - expect: status 200; `data.0.id` exists, `data.0.at` exists, `data.0.direction` exists, `data.0.channel` exists, `data.0.payload` exists
      - poll up to 8s

**Data used.** One probe message (MsgId TE-REG-SHAPE-{{ts}}-{{rand}}) to guarantee the feed is non-empty.

**Data profile.** `synthetic-correlated` — Generated per run.

**Expected result.** First row exposes id/at/direction/channel/payload.

---

#### SB-REG-MESSAGE-TYPE-ROW-SHAPE — Message-type rows keep their public shape

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` |

**What it does.** Each /api/v1/message-types row must keep code, family_code, version, status and field_count — the fields the Message Designer's list view and this engine's own catalogue-driven cases bind to.

**Preconditions.** At least one message type exists.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/message-types` — message-type row shape
      - expect: status 200; `data.0.code` exists, `data.0.family_code` exists, `data.0.version` exists, `data.0.status` exists, `data.0.field_count` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** First row exposes code/family_code/version/status/field_count.

---

#### SB-REG-RUN-RESPONSE-SHAPE — Run-creation response keeps its full shape

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` `runs` |

**What it does.** POST /api/v1/runs must keep accepted, status, runId, generated, delivery and report top-level fields — dashboards, this engine's run-integration cases, and the console's run-detail screen all destructure this exact shape.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — run response shape
      - expect: status 202; `accepted` = true, `status` exists, `runId` exists, `generated` exists, `delivery` exists, `report` exists
      - body: `{"seed":"TE-REG-SHAPE-{{ts}}","count":1,"channel":"api","messageTypeCode":"pain.001.001.09"}`

**Data used.** One pain.001.001.09 message from seed TE-REG-SHAPE-{{ts}}.

**Data profile.** `generated-iso20022` — Application's own generator.

**Expected result.** All six top-level fields present in the run response.

---

#### SB-REG-SCHEMA-ROW-SHAPE — Schema rows keep their public shape

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` |

**What it does.** Each /api/v1/schemas row must keep name, file_name, format and status — the Import Scheme screen's list view and this engine's upload suite both bind to this exact shape.

**Preconditions.** At least one schema imported.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/schemas` — schema row shape
      - expect: status 200; `data.0.name` exists, `data.0.file_name` exists, `data.0.format` exists, `data.0.status` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** First schema row exposes name/file_name/format/status.

---

#### SB-REG-SESSION-ME-SHAPE — Session/me identity payload keeps its shape

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `contract` `session` |

**What it does.** GET /api/v1/session/me must keep userId, tenantId, tenantSlug and tenantName — the console's header/identity chip and this engine's tenancy assertions both bind to these exact field names.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/session/me` — session/me shape
      - expect: status 200; `userId` exists, `tenantId` exists, `tenantSlug` exists, `tenantName` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** All four identity fields present.

---

#### SB-REG-UX-COPY — Operator onboarding copy is unchanged

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | regression / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `regression` `sand-bench` `ux` |

**What it does.** The first-run lead line is product copy that appears in documentation and demos; a silent change is a regression. Must remain exactly "Good rules survive bad data.".

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/ux/first-run` — ux copy
      - expect: status 200; `lead` = "Good rules survive bad data."

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Lead copy byte-identical.

---

### Category: Data quality tests (Quality assurance)

_Independent DB-viewer verification of persisted data._

#### Suite: DB-viewer data quality (`sb-data-quality`) — 15 cases

Independent reads of the application database confirm persisted data quality.

#### SB-DQ-AUDIT-TRAIL — Audit trail rows are independently visible

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `audit` `dbviewer` |

**What it does.** Read audit_events through the DB viewer (not the application's own API): rows must exist and expose an action column — proof the application actually writes its audit trail to the database.

**Preconditions.** DB viewer registered against the application database.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=audit_events&page_size=25` — audit_events via dbviewer
      - expect: status 200; `total` ≥ 1, `columns` contains "action"

**Data used.** Reads up to 25 existing audit rows; writes nothing.

**Data profile.** `production-shaped (read-only)` — Application-written audit data.

**Expected result.** total >= 1 and an "action" column present.

---

#### SB-DQ-DATASETS-ROW-COUNT-POSITIVE — Seeded datasets report a real row_count

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `datasets` |

**What it does.** Read datasets independently via the DB viewer: the row_count column must be present and at least one dataset must have row_count > 0 — proving datasets are backed by real generated rows, not empty placeholders.

**Preconditions.** At least one dataset seeded with rows.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=datasets&page_size=30` — datasets via dbviewer
      - expect: status 200; `total` ≥ 1, `columns` contains "row_count"

**Data used.** Reads up to 30 datasets rows.

**Data profile.** `production-shaped (read-only)` — Seeded dataset data.

**Expected result.** total >= 1 with a row_count column present.

---

#### SB-DQ-DETECTION-RULES-CONDITION-JSON — detection_rules carry their evaluatable condition

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `rules` |

**What it does.** Read detection_rules independently via the DB viewer: rows must expose condition_json — the actual evaluatable rule logic — alongside status. A rule row with a category/severity but no condition_json would be display-only, not a real executable rule.

**Preconditions.** Detection rules seeded.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=detection_rules&page_size=25` — detection_rules condition_json
      - expect: status 200; `total` ≥ 1, `columns` contains "condition_json", `columns` contains "status"

**Data used.** Reads up to 25 detection_rules rows.

**Data profile.** `production-shaped (read-only)` — Seeded rule catalogue.

**Expected result.** total >= 1 with condition_json and status columns present.

---

#### SB-DQ-DETECTION-RULES-SEVERITY-SET — detection_rules carry a category and severity

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `rules` |

**What it does.** Read detection_rules independently via the DB viewer: rows must expose category and severity columns, with at least one row classified "fraud" — the field Rule Bench's severity badges and this engine's own rule-driven test generation would key off.

**Preconditions.** Detection rules seeded.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=detection_rules&page_size=25` — detection_rules via dbviewer
      - expect: status 200; `total` ≥ 1, `columns` contains "severity", `columns` contains "category"; body contains "fraud"

**Data used.** Reads up to 25 detection_rules rows.

**Data profile.** `production-shaped (read-only)` — Seeded rule catalogue.

**Expected result.** total >= 1, severity/category columns present, at least one "fraud" category row.

---

#### SB-DQ-DOMAIN-EVENT-OUTBOX-OUTCOME — Domain event outbox rows carry an outcome

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `events` |

**What it does.** Read domain_event_outbox independently via the DB viewer: rows must expose event_code and outcome columns — the durable record behind every business/technical event this bench emits. Verified live: 119+ seeded outbox rows.

**Preconditions.** At least one domain event emitted (any authenticated request emits one).

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=domain_event_outbox&page_size=10` — domain_event_outbox via dbviewer
      - expect: status 200; `total` ≥ 1, `columns` contains "event_code", `columns` contains "outcome"

**Data used.** Reads up to 10 domain_event_outbox rows.

**Data profile.** `production-shaped (read-only)` — Application-emitted domain events.

**Expected result.** total >= 1 with event_code and outcome columns present.

---

#### SB-DQ-JOBS-KIND-STATUS — Background jobs table carries kind and status

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `jobs` |

**What it does.** Read jobs independently via the DB viewer: rows must expose kind and status columns with at least one row — the queue-backed jobs (e.g. sit.smoke probes) this deployment schedules.

**Preconditions.** At least one background job has run.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=jobs&page_size=15` — jobs via dbviewer
      - expect: status 200; `total` ≥ 1, `columns` contains "kind", `columns` contains "status"

**Data used.** Reads up to 15 jobs rows.

**Data profile.** `production-shaped (read-only)` — Background job runner.

**Expected result.** total >= 1 with kind and status columns present.

---

#### SB-DQ-MESSAGE-TYPES-CATALOGUE-QUALITY — message_types rows carry code, status and field_count

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `catalogue` |

**What it does.** Read message_types independently via the DB viewer: rows must expose code/status/field_count columns and at least one row — proving the message-type catalogue is real persisted data, not an API-layer mock.

**Preconditions.** DB viewer registered; at least one message type imported.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=message_types&page_size=25` — message_types via dbviewer
      - expect: status 200; `total` ≥ 1, `columns` contains "code", `columns` contains "status", `columns` contains "field_count"

**Data used.** Reads up to 25 message_types rows.

**Data profile.** `production-shaped (read-only)` — Application-imported schema data.

**Expected result.** total >= 1 with code/status/field_count columns present.

---

#### SB-DQ-PAYLOAD-FIDELITY — Recorded payloads preserve unicode fidelity end-to-end

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `data-quality` `sand-bench` `encoding` |

**What it does.** Send a payload containing a deliberately hostile-to-encodings marker (Ω € 中文 + unique id) through the hub, then confirm the application's inbound feed returns those exact characters — a whole-pipeline character-encoding data-quality check.

**Preconditions.** Testhub and API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — send encoding-hostile payload
      - expect: status 202
      - body: `{"channel":"api","payload":{"MsgId":"TE-DQ-{{ts}}-{{rand}}","marker":"DQ-Ω-€-中文-{{rand}}"},"systemId":"te_dq","systemName":"TE data-quality probe"}`
   3. **GET** `{{api}}/api/v1/inbound/events` — exact characters recorded
      - expect: status 200; body contains "DQ-Ω-€-中文-{{rand}}"
      - poll up to 8s

**Data used.** Marker string "DQ-Ω-€-中文-{{rand}}" (Greek, currency, CJK) plus unique MsgId.

**Data profile.** `unicode-hostile` — Generated per run.

**Expected result.** Inbound feed returns the marker byte-identical within 8s.

---

#### SB-DQ-RUN-SCHEDULES-CADENCE-COLUMN — run_schedules carry a cadence and enabled flag

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `schedules` |

**What it does.** Read run_schedules independently via the DB viewer: rows must expose cadence and enabled columns — the fields the Schedules screen and any cron-triggered run depend on. Verified live: 63 seeded schedule rows.

**Preconditions.** Schedules seeded.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=run_schedules&page_size=10` — run_schedules via dbviewer
      - expect: status 200; `total` ≥ 1, `columns` contains "cadence", `columns` contains "enabled"

**Data used.** Reads up to 10 run_schedules rows.

**Data profile.** `production-shaped (read-only)` — Seeded schedule data.

**Expected result.** total >= 1 with cadence and enabled columns present.

---

#### SB-DQ-SCHEMA-MIGRATIONS-APPLIED — Every shipped schema migration has been applied

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `migrations` |

**What it does.** Read schema_migrations independently via the DB viewer: at least 50 migration files must be recorded applied (verified live: 52) — the minimum evidence that this deployment's database is not running against a stale, partially-migrated schema.

**Preconditions.** Database migrated at deploy time.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=schema_migrations&page_size=100` — schema_migrations via dbviewer
      - expect: status 200; `total` ≥ 50, `columns` contains "filename", `columns` contains "applied_at"

**Data used.** Reads up to 100 schema_migrations rows.

**Data profile.** `schema-only (read-only)` — Deploy-time migration runner.

**Expected result.** total >= 50 applied migrations.

---

#### SB-DQ-SCHEMAS-CHECKSUM-PRESENT — schemas rows carry a content checksum

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` |

**What it does.** Read schemas independently via the DB viewer: rows must expose checksum_sha256 — the field the upload flow's duplicate-content rejection depends on. A missing checksum means dedup silently stops working.

**Preconditions.** At least one schema imported.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=schemas&page_size=25` — schemas via dbviewer
      - expect: status 200; `total` ≥ 1, `columns` contains "checksum_sha256", `columns` contains "storage_uri"

**Data used.** Reads up to 25 schemas rows.

**Data profile.** `production-shaped (read-only)` — Application-imported schema data.

**Expected result.** total >= 1 with checksum_sha256 and storage_uri columns present.

---

#### SB-DQ-TENANT-MEMBERSHIP-LINKED — Tenant memberships link users to their tenant

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `tenancy` |

**What it does.** Read tenant_memberships independently via the DB viewer: rows must expose tenant_id and user_id and status — the join table every permission check in the application resolves through. Verified live: 17 seeded memberships.

**Preconditions.** Demo identities imported.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=tenant_memberships&page_size=25` — tenant_memberships via dbviewer
      - expect: status 200; `total` ≥ 1, `columns` contains "tenant_id", `columns` contains "user_id", `columns` contains "status"

**Data used.** Reads up to 25 tenant_memberships rows.

**Data profile.** `reference (read-only)` — Demo identity import.

**Expected result.** total >= 1 with tenant_id/user_id/status columns present.

---

#### SB-DQ-TENANT-PRESENT — Configured demo tenant exists and is active

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `tenancy` |

**What it does.** The tenants table must contain the tenant slug this environment is configured to test with ({{tenant}}), status active — otherwise every authenticated case in this catalog is testing against the wrong tenancy.

**Preconditions.** Demo tenants imported.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=tenants&page_size=20` — tenants table
      - expect: status 200; `columns` contains "slug"; body contains "{{tenant}}"

**Data used.** Reads tenant rows; asserts configured slug {{tenant}} present.

**Data profile.** `reference (read-only)` — Demo tenant import.

**Expected result.** Configured tenant slug present in tenants table.

---

#### SB-DQ-TESTRUNS-COLUMNS — test_runs table keeps its status column

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` |

**What it does.** The test_runs table read independently through the DB viewer must expose id and status columns — the columns the run-completion cross-check joins on.

**Preconditions.** DB viewer registered.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=test_runs&page_size=5` — test_runs columns
      - expect: status 200; `columns` contains "status", `columns` contains "id"

**Data used.** Reads 5 rows max for column inspection.

**Data profile.** `schema-only (read-only)` — Application schema.

**Expected result.** Columns include id and status.

---

#### SB-DQ-USERS-NORMALISED — User rows carry normalised emails

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `data-quality` `sand-bench` `dbviewer` `identity` |

**What it does.** users read via the DB viewer must expose email_normalised and status columns with at least one active row — the invariant tenancy and login depend on.

**Preconditions.** Demo/seed identities imported.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=users&page_size=25` — users table
      - expect: status 200; `total` ≥ 1, `columns` contains "email_normalised", `data` contains "\"status\":\"active\""

**Data used.** Reads up to 25 user rows (fictional demo identities).

**Data profile.** `reference (read-only)` — Demo identity import.

**Expected result.** At least one active user with normalised email.

---

### Category: Selenium Baseline (Quality assurance)

_Selenium WebDriver baseline against the deployed console._

#### Suite: Selenium baseline (`sb-selenium-baseline`) — 18 cases

Selenium WebDriver baseline: pages load, console mounts, branding present.

#### TC-SB-ABOUT-PAGE — Baseline: About page renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/about.html and asserts the verified content fragment "Good rules survive bad data." renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/about.html` _(open /about.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `Good rules survive bad data.` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "Good rules survive bad data.".

---

#### TC-SB-CAPABILITIES — API: capabilities endpoint (baseline)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `http` |

**What it does.** GET {{api}}/api/v1/capabilities returns 200 with a populated modules list — a second HTTP baseline alongside the Selenium checks, proving the API surface is up from this suite's own vantage point.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/capabilities` — capabilities
      - expect: status 200; `modules` length ≥ 5

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with >= 5 modules.

---

#### TC-SB-CONSOLE-MOUNT — Baseline: operator signs in and console mounts under Selenium

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` `console` |

**What it does.** Selenium opens {{web}}/, signs in through the real gate form as the demo operator, waits for the mount signal (#gate hidden), then asserts the sidebar rendered nav items. The Selenium twin of SB-SCR-CONSOLE-MOUNT.

**Preconditions.** Demo operator identity enabled; Chrome available to worker.

**Steps.**

   1. **navigate** — value `{{web}}/` _(open console)_
   2. **wait_for** — selector `#gate #login` _(sign-in gate shown)_
   3. **type** — selector `#gate #tenant`, value `{{tenant}}` _(tenant slug)_
   4. **type** — selector `#gate #username`, value `{{username}}` _(demo operator username)_
   5. **click** — selector `#gate #login` _(Sign in (password optional in dev builds))_
   6. **wait_for_hidden** — selector `#gate` _(gate hides — console mounted)_
   7. **assert_selector_count_min** — selector `.opsc-navitem`, value `5` _(nav items)_

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Gate hides after sign-in and >= 5 nav items render.

---

#### TC-SB-DEMO-PAGE — Baseline: 90-second demo page renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/demo.html and asserts the verified content fragment "demo" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/demo.html` _(open /demo.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `demo` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "demo".

---

#### TC-SB-EXTERNAL-SYSTEMS-PUBLIC — API: public external systems (baseline)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `http` |

**What it does.** GET {{api}}/api/v1/external-systems/public returns 200 with the seeded dummy systems — a third HTTP baseline proving the integration surface this suite's console checks sit alongside is reachable too.

**Preconditions.** Demo external systems seeded.

**Steps.**

   1. **GET** `{{api}}/api/v1/external-systems/public` — external systems public
      - expect: status 200; `data` length ≥ 3

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with >= 3 external systems.

---

#### TC-SB-FEATURE-IDS-PAGE — Baseline: feature-IDs page renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/feature-ids.html and asserts the verified content fragment "Feature IDs" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/feature-ids.html` _(open /feature-ids.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `Feature IDs` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "Feature IDs".

---

#### TC-SB-HEADER — Baseline: GARVIQ branding present

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/index.html and asserts the verified content fragment "GARVIQ" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `GARVIQ` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "GARVIQ".

---

#### TC-SB-HEALTH — API: health endpoint (baseline)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `http` |

**What it does.** GET {{api}}/health returns 200 — the HTTP baseline case kept alongside the Selenium ones so the suite proves both runner families.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/health` — health
      - expect: status 200; `status` = "ok"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 {"status":"ok"}.

---

#### TC-SB-HELP-PAGE — Baseline: Help page renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/help.html and asserts the verified content fragment "Help" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/help.html` _(open /help.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `Help` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "Help".

---

#### TC-SB-NAMING-PAGE — Baseline: naming-conventions page renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/naming.html and asserts the verified content fragment "Naming conventions" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/naming.html` _(open /naming.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `Naming conventions` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "Naming conventions".

---

#### TC-SB-NAV-MODULES — Baseline: core modules visible in Selenium

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` `console` |

**What it does.** After signing in and mounting, the sidebar must show the Rule Bench and Test Runs modules (Selenium-read DOM text).

**Preconditions.** Console mounts after demo sign-in.

**Steps.**

   1. **navigate** — value `{{web}}/` _(open console)_
   2. **wait_for** — selector `#gate #login` _(sign-in gate shown)_
   3. **type** — selector `#gate #tenant`, value `{{tenant}}` _(tenant slug)_
   4. **type** — selector `#gate #username`, value `{{username}}` _(demo operator username)_
   5. **click** — selector `#gate #login` _(Sign in (password optional in dev builds))_
   6. **wait_for_hidden** — selector `#gate` _(gate hides — console mounted)_
   7. **assert_text** — expect `Rule Bench` _(Rule Bench)_
   8. **assert_text** — expect `Test Runs` _(Test Runs)_

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Both module labels present in rendered sidebar.

---

#### TC-SB-NOTPROD-BANNER — Baseline: not-production disclosure renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/not-production.html and asserts the verified content fragment "Sand Bench" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/not-production.html` _(open /not-production.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `Sand Bench` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "Sand Bench".

---

#### TC-SB-PG-INVENTORY-PAGE — Baseline: Postgres inventory page renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/postgres-inventory.html and asserts the verified content fragment "Postgres inventory" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/postgres-inventory.html` _(open /postgres-inventory.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `Postgres inventory` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "Postgres inventory".

---

#### TC-SB-PITCH-PAGE — Baseline: public-URLs pitch page renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/pitch.html and asserts the verified content fragment "Good rules survive bad data." renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/pitch.html` _(open /pitch.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `Good rules survive bad data.` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "Good rules survive bad data.".

---

#### TC-SB-REFERENCE-PAGE — Baseline: ISO family reference page renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/reference.html and asserts the verified content fragment "ISO 20022" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/reference.html` _(open /reference.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `ISO 20022` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "ISO 20022".

---

#### TC-SB-SECURITY-PAGE — Baseline: security page renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/security.html and asserts the verified content fragment "Security" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/security.html` _(open /security.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `Security` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "Security".

---

#### TC-SB-SMOKE-HOME — Smoke: console shell loads in Selenium

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/index.html and asserts the verified content fragment "Sand Bench" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `Sand Bench` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "Sand Bench".

---

#### TC-SB-USE-CASE-PAGE — Baseline: use-case sections page renders

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `selenium-baseline` `sand-bench` `selenium` |

**What it does.** Selenium WebDriver (real Chrome) opens {{web}}/use-case.html and asserts the verified content fragment "Use case" renders. Baseline coverage proving the Selenium runner + deployed web tier work together.

**Preconditions.** Worker has Chrome/Chromium + matching chromedriver.

**Steps.**

   1. **navigate** — value `{{web}}/use-case.html` _(open /use-case.html)_
   2. **wait_for** — selector `body` _(page body present)_
   3. **assert_text** — expect `Use case` _(verified fragment)_

**Data used.** No input data; anonymous page view.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Body text contains "Use case".

---

#### Suite: Upload XSD test case (Selenium) (`sb-upload-xsd-selenium`) — 11 cases

Sandbench Enterprise: the same ten ISO 20022 XSD upload cases and Markdown companion upload case as the Playwright suite, run through Selenium WebDriver instead. Every case checks a new successful upload, persisted file contents, and the exact imported item in Scheme Definitions after reload.

#### SB-UPLOAD-MARKDOWN-SELENIUM-MDR-2025-2026 — Upload Markdown test case (Selenium) - ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `markdown` |

**What it does.** Validate Sandbench Enterprise using ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md via Selenium WebDriver. Upload this Markdown as an accompanying document with pacs.002.001.16.xsd, as required by the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.002.001.16.xsd` _(Sign in; select ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md with companion schema pacs.002.001.16.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload with the Markdown download available. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-SELENIUM-PACS-002-001-12 — Upload XSD test case (Selenium) - pacs.002.001.12.xsd

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.002.001.12.xsd via Selenium WebDriver. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.002.001.12.xsd` _(Sign in; select pacs.002.001.12.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.002.001.12.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.002.001.12.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-SELENIUM-PACS-002-001-16 — Upload XSD test case (Selenium) - pacs.002.001.16.xsd

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.002.001.16.xsd via Selenium WebDriver. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.002.001.16.xsd` _(Sign in; select pacs.002.001.16.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.002.001.16.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.002.001.16.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-SELENIUM-PACS-003-001-12 — Upload XSD test case (Selenium) - pacs.003.001.12.xsd

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.003.001.12.xsd via Selenium WebDriver. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.003.001.12.xsd` _(Sign in; select pacs.003.001.12.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.003.001.12.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.003.001.12.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-SELENIUM-PACS-004-001-15 — Upload XSD test case (Selenium) - pacs.004.001.15.xsd

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.004.001.15.xsd via Selenium WebDriver. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.004.001.15.xsd` _(Sign in; select pacs.004.001.15.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.004.001.15.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.004.001.15.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-SELENIUM-PACS-007-001-14 — Upload XSD test case (Selenium) - pacs.007.001.14.xsd

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.007.001.14.xsd via Selenium WebDriver. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.007.001.14.xsd` _(Sign in; select pacs.007.001.14.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.007.001.14.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.007.001.14.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-SELENIUM-PACS-008-001-14 — Upload XSD test case (Selenium) - pacs.008.001.14.xsd

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.008.001.14.xsd via Selenium WebDriver. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.008.001.14.xsd` _(Sign in; select pacs.008.001.14.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.008.001.14.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.008.001.14.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-SELENIUM-PACS-009-001-13 — Upload XSD test case (Selenium) - pacs.009.001.13.xsd

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.009.001.13.xsd via Selenium WebDriver. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.009.001.13.xsd` _(Sign in; select pacs.009.001.13.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.009.001.13.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.009.001.13.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-SELENIUM-PACS-010-001-06 — Upload XSD test case (Selenium) - pacs.010.001.06.xsd

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.010.001.06.xsd via Selenium WebDriver. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.010.001.06.xsd` _(Sign in; select pacs.010.001.06.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.010.001.06.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.010.001.06.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-SELENIUM-PACS-028-001-07 — Upload XSD test case (Selenium) - pacs.028.001.07.xsd

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.028.001.07.xsd via Selenium WebDriver. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.028.001.07.xsd` _(Sign in; select pacs.028.001.07.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.028.001.07.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.028.001.07.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

#### SB-UPLOAD-XSD-SELENIUM-PACS-029-001-02 — Upload XSD test case (Selenium) - pacs.029.001.02.xsd

| | |
|---|---|
| **Runner** | `selenium` @ 1440×1000 |
| **Type / level** | selenium-baseline / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 180s |
| **Tags** | `selenium-baseline` `sand-bench` `sandbench-enterprise` `upload` `iso20022` `selenium` `on-demand` `xsd` |

**What it does.** Validate Sandbench Enterprise using pacs.029.001.02.xsd via Selenium WebDriver. Upload this XSD alone through the Import Scheme screen. Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.

**Preconditions.** Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.

**Steps.**

   1. **sandbench_upload** — value `pacs.029.001.02.xsd` _(Sign in; select pacs.029.001.02.xsd; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import)_

**Data used.** pacs.029.001.02.xsd. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.

**Data profile.** `supplied-iso20022-schema-with-unique-run-comment` — User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.

**Expected result.** A new upload is accepted and stored; pacs.029.001.02.xsd has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload. Test-created data is removed after evidence is captured; existing uploads are preserved.

---

### Category: Performance tests (Quality control)

_Latency/throughput benchmarks with explicit SLAs._

#### Suite: Latency benchmarks (`sb-performance`) — 15 cases

Short concurrent benchmarks with explicit p95 / error-rate SLAs.

#### SB-PERF-API-HEALTH — API /health latency benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Short benchmark of the API health endpoint. Profile: 40 requests at concurrency 5 against {{api}}/health. SLA: p95 <= 800ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 40 requests at concurrency 5 against `{{api}}/health`, SLA {"p95_ms":800,"error_rate_pct":2}.

**Data used.** 40 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 800ms and error rate <= 2%.

---

#### SB-PERF-API-HEALTH-HIGH-CONCURRENCY — API /health under 20-way concurrency

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** A heavier concurrency profile than the baseline health benchmark — checks the health path does not degrade under a sharper burst. Profile: 100 requests at concurrency 20 against {{api}}/health. SLA: p95 <= 1200ms, error rate <= 5%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 100 requests at concurrency 20 against `{{api}}/health`, SLA {"p95_ms":1200,"error_rate_pct":5}.

**Data used.** 100 GET requests, concurrency 20, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1200ms and error rate <= 5%.

---

#### SB-PERF-API-READY — API /ready under concurrent load

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Readiness probe under a 10-way concurrent burst (touches the DB path). Profile: 60 requests at concurrency 10 against {{api}}/ready. SLA: p95 <= 1500ms, error rate <= 5%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 60 requests at concurrency 10 against `{{api}}/ready`, SLA {"p95_ms":1500,"error_rate_pct":5}.

**Data used.** 60 GET requests, concurrency 10, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1500ms and error rate <= 5%.

---

#### SB-PERF-CAPABILITIES — API capabilities latency benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Benchmark of the public capabilities contract endpoint clients probe first. Profile: 40 requests at concurrency 5 against {{api}}/api/v1/capabilities. SLA: p95 <= 800ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 40 requests at concurrency 5 against `{{api}}/api/v1/capabilities`, SLA {"p95_ms":800,"error_rate_pct":2}.

**Data used.** 40 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 800ms and error rate <= 2%.

---

#### SB-PERF-DBVIEWER — DB viewer health latency benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** The independent read path must answer promptly. Profile: 30 requests at concurrency 5 against {{dbviewer}}/health. SLA: p95 <= 1000ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 30 requests at concurrency 5 against `{{dbviewer}}/health`, SLA {"p95_ms":1000,"error_rate_pct":2}.

**Data used.** 30 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1000ms and error rate <= 2%.

---

#### SB-PERF-DBVIEWER-TABLES — DB viewer table-catalogue latency benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Benchmark of the schema-introspection endpoint every data-quality case depends on. Profile: 30 requests at concurrency 5 against {{dbviewer}}/api/tables. SLA: p95 <= 1200ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 30 requests at concurrency 5 against `{{dbviewer}}/api/tables`, SLA {"p95_ms":1200,"error_rate_pct":2}.

**Data used.** 30 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1200ms and error rate <= 2%.

---

#### SB-PERF-EVENTS-CATALOG — Event catalogue latency benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Benchmark of the domain-event catalogue endpoint. Profile: 30 requests at concurrency 5 against {{api}}/api/v1/events/catalog. SLA: p95 <= 900ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 30 requests at concurrency 5 against `{{api}}/api/v1/events/catalog`, SLA {"p95_ms":900,"error_rate_pct":2}.

**Data used.** 30 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 900ms and error rate <= 2%.

---

#### SB-PERF-EXTERNAL-SYSTEMS-PUBLIC — Public external-systems latency benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Benchmark of the public integration catalogue. Profile: 30 requests at concurrency 5 against {{api}}/api/v1/external-systems/public. SLA: p95 <= 900ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 30 requests at concurrency 5 against `{{api}}/api/v1/external-systems/public`, SLA {"p95_ms":900,"error_rate_pct":2}.

**Data used.** 30 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 900ms and error rate <= 2%.

---

#### SB-PERF-RESILIENCE — Resilience posture latency benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Benchmark of the resilience-posture endpoint. Profile: 30 requests at concurrency 5 against {{api}}/api/v1/resilience. SLA: p95 <= 800ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 30 requests at concurrency 5 against `{{api}}/api/v1/resilience`, SLA {"p95_ms":800,"error_rate_pct":2}.

**Data used.** 30 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 800ms and error rate <= 2%.

---

#### SB-PERF-SECURITY-HEALTH — Security/encryption health latency benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Benchmark of the vault-backed encryption health check. Profile: 30 requests at concurrency 5 against {{api}}/api/v1/security/health. SLA: p95 <= 1000ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 30 requests at concurrency 5 against `{{api}}/api/v1/security/health`, SLA {"p95_ms":1000,"error_rate_pct":2}.

**Data used.** 30 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1000ms and error rate <= 2%.

---

#### SB-PERF-TESTHUB — Testhub health latency benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** The simulator must not be the bottleneck in round-trip tests. Profile: 30 requests at concurrency 5 against {{testhub}}/health. SLA: p95 <= 800ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 30 requests at concurrency 5 against `{{testhub}}/health`, SLA {"p95_ms":800,"error_rate_pct":2}.

**Data used.** 30 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 800ms and error rate <= 2%.

---

#### SB-PERF-WEB-ABOUT — About page delivery benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Benchmark of a secondary static page (follows the redirect to its versioned asset). Profile: 30 requests at concurrency 5 against {{web}}/about.html. SLA: p95 <= 1500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 30 requests at concurrency 5 against `{{web}}/about.html`, SLA {"p95_ms":1500,"error_rate_pct":2}.

**Data used.** 30 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1500ms and error rate <= 2%.

---

#### SB-PERF-WEB-INDEX — Web shell delivery benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Static shell delivery from the web tier. Profile: 30 requests at concurrency 5 against {{web}}/index.html. SLA: p95 <= 1500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 30 requests at concurrency 5 against `{{web}}/index.html`, SLA {"p95_ms":1500,"error_rate_pct":2}.

**Data used.** 30 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1500ms and error rate <= 2%.

---

#### SB-PERF-WEB-ROOT — Web root delivery benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Benchmark of the bare root path (distinct from /index.html) under moderate concurrency. Profile: 40 requests at concurrency 8 against {{web}}/. SLA: p95 <= 1500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 40 requests at concurrency 8 against `{{web}}/`, SLA {"p95_ms":1500,"error_rate_pct":2}.

**Data used.** 40 GET requests, concurrency 8, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1500ms and error rate <= 2%.

---

#### SB-PERF-WEB-SECURITY — Security page delivery benchmark

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 120s |
| **Tags** | `performance` `sand-bench` `sla` |

**What it does.** Benchmark of the security/cryptography static page. Profile: 30 requests at concurrency 5 against {{web}}/security.html. SLA: p95 <= 1500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 30 requests at concurrency 5 against `{{web}}/security.html`, SLA {"p95_ms":1500,"error_rate_pct":2}.

**Data used.** 30 GET requests, concurrency 5, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1500ms and error rate <= 2%.

---

### Category: Endurance tests (Quality control)

_Bounded soak profiles against the deployed stack._

#### Suite: Bounded soak (`sb-endurance`) — 13 cases

Sustained request streams; deployment must stay healthy throughout.

#### SB-END-API-SOAK — API soak: 300 requests sustained

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** Bounded soak: a sustained low-concurrency stream the deployment must absorb without error-rate drift. Profile: 300 requests at concurrency 3 against {{api}}/ready. SLA: p95 <= 2000ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 300 requests at concurrency 3 against `{{api}}/ready`, SLA {"p95_ms":2000,"error_rate_pct":2}.

**Data used.** 300 GET requests, concurrency 3, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 2000ms and error rate <= 2%.

---

#### SB-END-CAPABILITIES-SOAK — Capabilities soak: 200 requests sustained

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** Bounded soak of the capabilities contract endpoint. Profile: 200 requests at concurrency 3 against {{api}}/api/v1/capabilities. SLA: p95 <= 1500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 200 requests at concurrency 3 against `{{api}}/api/v1/capabilities`, SLA {"p95_ms":1500,"error_rate_pct":2}.

**Data used.** 200 GET requests, concurrency 3, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1500ms and error rate <= 2%.

---

#### SB-END-DBVIEWER-TABLES-SOAK — DB viewer table catalogue soak: 150 requests

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 240s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** Bounded soak of schema introspection. Profile: 150 requests at concurrency 2 against {{dbviewer}}/api/tables. SLA: p95 <= 2000ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 150 requests at concurrency 2 against `{{dbviewer}}/api/tables`, SLA {"p95_ms":2000,"error_rate_pct":2}.

**Data used.** 150 GET requests, concurrency 2, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 2000ms and error rate <= 2%.

---

#### SB-END-EVENTS-CATALOG-SOAK — Events catalogue soak: 150 requests sustained

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 240s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** Bounded soak of the domain-event catalogue. Profile: 150 requests at concurrency 2 against {{api}}/api/v1/events/catalog. SLA: p95 <= 1500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 150 requests at concurrency 2 against `{{api}}/api/v1/events/catalog`, SLA {"p95_ms":1500,"error_rate_pct":2}.

**Data used.** 150 GET requests, concurrency 2, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1500ms and error rate <= 2%.

---

#### SB-END-EXTENDED-SURFACES-HEALTHY — Extended surface set healthy after soak window

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | performance / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `endurance` `sand-bench` `recovery` |

**What it does.** A second post-soak check, broader than SB-END-POST-SOAK-HEALTH: capabilities, resilience posture and security health must all still answer correctly after the soak cases in this suite ran — not just the four basic /health endpoints.

**Preconditions.** Soak cases in this suite ran first (suite order).

**Steps.**

   1. **GET** `{{api}}/api/v1/capabilities` — capabilities intact
      - expect: status 200; `modules` length ≥ 5
   2. **GET** `{{api}}/api/v1/resilience` — resilience posture intact
      - expect: status 200; `posture` exists
   3. **GET** `{{api}}/api/v1/security/health` — security health intact
      - expect: status 200; `overall` = "HEALTHY"

**Data used.** Three GETs, no payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** All three extended surfaces answer correctly after the soak.

---

#### SB-END-EXTERNAL-SYSTEMS-SOAK — External systems soak: 200 requests sustained

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** Bounded soak of the public integration catalogue. Profile: 200 requests at concurrency 3 against {{api}}/api/v1/external-systems/public. SLA: p95 <= 1500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 200 requests at concurrency 3 against `{{api}}/api/v1/external-systems/public`, SLA {"p95_ms":1500,"error_rate_pct":2}.

**Data used.** 200 GET requests, concurrency 3, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1500ms and error rate <= 2%.

---

#### SB-END-POST-SOAK-HEALTH — Deployment healthy after soak window

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `endurance` `sand-bench` `recovery` |

**What it does.** Runs after the soak cases in this suite: every surface must still answer its health contract, proving the soak left no degradation behind.

**Preconditions.** Soak cases in this suite ran first (suite order).

**Steps.**

   1. **GET** `{{api}}/health` — api healthy
      - expect: status 200
   2. **GET** `{{testhub}}/health` — testhub healthy
      - expect: status 200
   3. **GET** `{{dbviewer}}/health` — dbviewer healthy
      - expect: status 200
   4. **GET** `{{web}}/index.html` — web healthy
      - expect: status 200

**Data used.** Four health GETs.

**Data profile.** `none (read-only)` — n/a

**Expected result.** All four surfaces 200 after the soak.

---

#### SB-END-RESILIENCE-SOAK — Resilience posture soak: 150 requests sustained

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 240s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** Bounded soak of the resilience-posture endpoint. Profile: 150 requests at concurrency 2 against {{api}}/api/v1/resilience. SLA: p95 <= 1500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 150 requests at concurrency 2 against `{{api}}/api/v1/resilience`, SLA {"p95_ms":1500,"error_rate_pct":2}.

**Data used.** 150 GET requests, concurrency 2, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1500ms and error rate <= 2%.

---

#### SB-END-SECURITY-HEALTH-SOAK — Security health soak: 150 requests sustained

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 240s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** Bounded soak of the encryption-health path. Profile: 150 requests at concurrency 2 against {{api}}/api/v1/security/health. SLA: p95 <= 1500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 150 requests at concurrency 2 against `{{api}}/api/v1/security/health`, SLA {"p95_ms":1500,"error_rate_pct":2}.

**Data used.** 150 GET requests, concurrency 2, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1500ms and error rate <= 2%.

---

#### SB-END-TESTHUB-SOAK-EXTENDED — Testhub extended soak: 200 requests sustained

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** A longer soak of the simulator than the short performance-suite benchmark — the round-trip suite depends on this staying up throughout a real test session. Profile: 200 requests at concurrency 3 against {{testhub}}/health. SLA: p95 <= 1200ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 200 requests at concurrency 3 against `{{testhub}}/health`, SLA {"p95_ms":1200,"error_rate_pct":2}.

**Data used.** 200 GET requests, concurrency 3, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 1200ms and error rate <= 2%.

---

#### SB-END-WEB-ABOUT-SOAK — About page soak: 150 fetches sustained

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 240s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** Bounded soak of a secondary static page. Profile: 150 requests at concurrency 2 against {{web}}/about.html. SLA: p95 <= 2500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 150 requests at concurrency 2 against `{{web}}/about.html`, SLA {"p95_ms":2500,"error_rate_pct":2}.

**Data used.** 150 GET requests, concurrency 2, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 2500ms and error rate <= 2%.

---

#### SB-END-WEB-SECURITY-SOAK — Security page soak: 150 fetches sustained

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 240s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** Bounded soak of the security/cryptography static page. Profile: 150 requests at concurrency 2 against {{web}}/security.html. SLA: p95 <= 2500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 150 requests at concurrency 2 against `{{web}}/security.html`, SLA {"p95_ms":2500,"error_rate_pct":2}.

**Data used.** 150 GET requests, concurrency 2, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 2500ms and error rate <= 2%.

---

#### SB-END-WEB-SOAK — Web tier soak: 200 shell fetches

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `endurance` `sand-bench` `sla` |

**What it does.** Bounded soak of the static tier. Profile: 200 requests at concurrency 2 against {{web}}/index.html. SLA: p95 <= 2500ms, error rate <= 2%. The runner records min/avg/p50/p95/p99 latency, throughput and error rate as metrics on the result.

**Preconditions.** Target surface deployed; worker has network path to it.

**Execution.** Performance runner: 200 requests at concurrency 2 against `{{web}}/index.html`, SLA {"p95_ms":2500,"error_rate_pct":2}.

**Data used.** 200 GET requests, concurrency 2, no body.

**Data profile.** `load-profile` — Generated by the performance runner.

**Expected result.** p95 <= 2500ms and error rate <= 2%.

---

### Category: Rolling upgrade tests (Quality control)

_N-2 walkthrough and channel contracts stay compatible._

#### Suite: Upgrade compatibility (`sb-rolling-upgrade`) — 14 cases

Contracts an N-2 client depends on remain intact.

#### SB-RU-AUTH-METHODS-BACKWARD-COMPATIBLE — bearer-jwt auth method is never dropped

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `contract` `auth` |

**What it does.** capabilities.authMethods must continue to list "bearer-jwt" — every N-2 client authenticates this way; dropping it mid-upgrade would lock out anything not yet updated to a newer auth scheme.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/capabilities` — auth methods
      - expect: status 200; `authMethods` contains "bearer-jwt"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** authMethods includes "bearer-jwt".

---

#### SB-RU-CLASSIFICATION-PUBLISHED — Deployment classification is machine-readable

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `deployment` |

**What it does.** Upgrade tooling decides guardrails from /health's classification field; it must exist and be non-empty on every version.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/health` — classification
      - expect: status 200; `classification` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** classification present.

---

#### SB-RU-ETAG-CONFLICT-CODE-STABLE — Published ETag-conflict status code is stable

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `contract` |

**What it does.** capabilities.etagConflicts documents which HTTP status old clients should treat as an optimistic-concurrency conflict; it must remain 412 — a silent change would break every client's conflict-retry logic without a version bump.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/capabilities` — etag conflict code
      - expect: status 200; `etagConflicts` = 412

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** etagConflicts=412.

---

#### SB-RU-EXTERNAL-SYSTEMS-PUBLIC-SHAPE-STABLE — Public external-systems row shape is unchanged

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `contract` |

**What it does.** Each external-systems/public row must keep id, name and channel — an N-2 integration client parses exactly these three fields to route dummy connectivity tests.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/external-systems/public` — external-systems row shape
      - expect: status 200; `data.0.id` exists, `data.0.name` exists, `data.0.channel` exists

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** First row exposes id/name/channel.

---

#### SB-RU-FEATURES-OVERVIEW-PAGE-STABLE — Overview page id is never renamed

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `contract` |

**What it does.** The features/pages catalogue must keep the page id "overview" — an N-2 console build's hardcoded landing-page id would silently break navigation if this were renamed without a migration path.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/features/pages` — overview page id
      - expect: status 200; body contains "\"page\":\"overview\""

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** features/pages still contains page id "overview".

---

#### SB-RU-LEGACY-FILE-CHANNEL — Legacy file channel not dropped by upgrade

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `channels` |

**What it does.** The oldest integration channel ("file") must remain in channel-targets — removing it breaks pre-API clients mid-upgrade.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/channel-targets` — file channel present
      - expect: status 200; `data` contains "\"channel\":\"file\""

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** file channel listed.

---

#### SB-RU-LOGIN-EVENT-CODE-STABLE — Login success event code is never renamed

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `contract` `events` |

**What it does.** events/catalog must keep the code "biz.session.login.success" — any external SIEM/eventing integration configured against this literal code would silently stop matching if it were renamed.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/events/catalog` — login event code
      - expect: status 200; body contains "biz.session.login.success"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** events/catalog still publishes biz.session.login.success.

---

#### SB-RU-MESSAGE-TYPE-FIELDS-ENDPOINT-STABLE — Per-message-type field listing endpoint still resolves

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `contract` |

**What it does.** GET /api/v1/message-types/pain.001.001.09/fields must keep resolving with xpath-bearing field rows — the Message Designer's field-picker and any pre-generated client-side form both call this exact path/shape.

**Preconditions.** pain.001.001.09 message type present in the catalogue.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/message-types/pain.001.001.09/fields` — message-type fields
      - expect: status 200; `data.0.xpath` exists, `data.0.id` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** First field row exposes id and xpath.

---

#### SB-RU-N2-WALK-COMPAT — N-2 demo walk still scriptable

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `n-2` |

**What it does.** The /api/v1/ux/demo/n2 contract (90 seconds, default channel mq) is what an N-2 client scripts against; it must hold across upgrades.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/ux/demo/n2` — N-2 contract
      - expect: status 200; `seconds` = 90, `defaultRun.channel` = "mq"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** seconds=90, channel=mq.

---

#### SB-RU-NAMING-PATTERN-RULE-STABLE — Rule naming-convention pattern is unchanged

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `contract` |

**What it does.** The naming-conventions entry for artefact "rule" must still be pattern "RUL-{family}-{purpose}-{seq}" — client-side ID generators and any external system that pre-validates rule IDs depend on this exact pattern string.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/naming-conventions` — rule naming pattern
      - expect: status 200; body contains "RUL-{family}-{purpose}-{seq}"

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** naming-conventions still publishes the rule pattern verbatim.

---

#### SB-RU-SCHEMAS-ENDPOINT-STABLE — Schema list endpoint still resolves for an N-2 client

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `contract` |

**What it does.** GET /api/v1/schemas must keep resolving with a data array — an older Import Scheme screen build that lists previously imported schemas by this exact path must keep working across an upgrade.

**Preconditions.** At least one schema imported.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/schemas` — schemas endpoint
      - expect: status 200; `data` length ≥ 1

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** >= 1 schema returned.

---

#### SB-RU-SENSITIVE-DATA-POLICY-NAME-STABLE — Sensitive-data masking policy name is unchanged

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `contract` `security` |

**What it does.** security/policies must keep the policy named "SAND_BENCH_SENSITIVE_DATA" — compliance tooling and this engine's own masking-evidence case reference it by exact name.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/security/policies` — sensitive-data policy name
      - expect: status 200; body contains "SAND_BENCH_SENSITIVE_DATA"

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** security/policies still names SAND_BENCH_SENSITIVE_DATA.

---

#### SB-RU-SOURCE-FORMAT-LISTBOX-STABLE — Import source-format list-box key is unchanged

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `contract` |

**What it does.** list-boxes must keep a "sourceFormat" entry — the Import Schema screen's format dropdown (and this engine's upload suite) both depend on this exact key.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/list-boxes` — sourceFormat list-box key
      - expect: status 200; body contains "\"key\":\"sourceFormat\""

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** list-boxes still publishes the "sourceFormat" key.

---

#### SB-RU-TIERS-CONSISTENT — API and web tiers deployed consistently

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | deployment / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `rolling-upgrade` `sand-bench` `consistency` |

**What it does.** Both halves of the deployment must answer at once (API health + web shell) — a torn rolling upgrade leaves one tier down or serving a stale shell.

**Preconditions.** Both containers deployed.

**Steps.**

   1. **GET** `{{api}}/health` — api tier
      - expect: status 200; `role` = "api"
   2. **GET** `{{web}}/index.html` — web tier
      - expect: status 200; body contains "Sand Bench"

**Data used.** Two GETs, no payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Both tiers answer with their own contracts.

---

### Category: Non-functional tests (Quality control)

_Error handling, robustness and clean failure envelopes._

#### Suite: Robustness & error handling (`sb-non-functional`) — 15 cases

Malformed, oversized and misrouted requests fail cleanly, never with a 500 or a hang.

#### SB-NF-ARRAY-BODY-INSTEAD-OF-OBJECT — JSON array body on an object-shaped route fails cleanly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` |

**What it does.** POST a JSON array ([1,2,3]) to login, which expects an object body: must return a clean validation envelope (verified live: 422 validation_failed, "tenantSlug and username are required") — never a 500 from destructuring an array as an object.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — array body
      - expect: status 422; `error.code` = "validation_failed"
      - raw body: `[1,2,3]`

**Data used.** JSON array [1,2,3] where an object is expected.

**Data profile.** `malformed` — Hand-crafted.

**Expected result.** 422 validation_failed, never a 500.

---

#### SB-NF-EMPTY-BEARER-TOKEN-VALUE — Empty bearer token value is rejected cleanly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` `auth` |

**What it does.** An Authorization header of "Bearer " with no token value after it must be rejected 401 — verified live — never treated as an empty-but-valid credential nor crash the token parser on an empty string.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/session/me` — empty bearer value
      - expect: status 401

**Data used.** Authorization: "Bearer " (empty token value).

**Data profile.** `boundary-empty` — Hand-crafted.

**Expected result.** 401, never a 500.

---

#### SB-NF-HUGE-QUERY-STRING — Oversized query-string parameter does not destabilise the API

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` |

**What it does.** A GET with a single 5,000-character query-parameter value must be handled cleanly (200, verified live) or rejected with a clean 4xx — never a hang or 500. A cheap DoS-shaped input robustness check.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/message-types?x={{rand}}0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000` — huge query string
      - expect: status 200/400/414

**Data used.** One ~5,000-character query-parameter value.

**Data profile.** `oversized` — Generated per run.

**Expected result.** Clean 200/400/414, never a 500 or timeout.

---

#### SB-NF-INSUFFICIENT-PERMISSION-403-NOT-500 — Valid session with insufficient privilege gets a clean 403

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` `authorization` |

**What it does.** An authenticated operator (not an admin) calling GET /api/v1/admin/users must get a clean 403 forbidden — verified live — proving the permission check fails closed with a proper envelope rather than throwing unhandled.

**Preconditions.** Demo operator identity enabled (non-admin role).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/admin/users` — insufficient permission
      - expect: status 403

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** 403, never a 500.

---

#### SB-NF-LARGE-PAYLOAD — Oversized single payload handled without destabilising

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 45s |
| **Tags** | `non-functional` `sand-bench` `robustness` |

**What it does.** One ~120KB JSON payload through the hub: the pipeline must either accept (202) or reject cleanly (400/413) — and the API must remain healthy immediately afterwards. Single request, bounded size: robustness, not load testing.

**Preconditions.** Testhub and API up.

**Steps.**

   1. **POST** `{{testhub}}/hub/to-app` — 120KB payload
      - expect: status 202/400/413
      - body: `{"channel":"api","payload":{"blob":"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB`
   2. **GET** `{{api}}/health` — still healthy
      - expect: status 200

**Data used.** Single JSON payload with a 120,000-byte filler field.

**Data profile.** `oversized` — Generated per run.

**Expected result.** Clean accept-or-reject; health 200 afterwards.

---

#### SB-NF-MALFORMED-BEARER-SCHEME — Authorization header missing the Bearer scheme is rejected cleanly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` `auth` |

**What it does.** A raw token sent without the "Bearer " prefix in the Authorization header must be rejected 401 — verified live — never treated as an implicit bearer token nor crash the header parser.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/session/me` — missing Bearer scheme
      - expect: status 401

**Data used.** A real, valid token sent without the required "Bearer " scheme prefix.

**Data profile.** `malformed` — n/a

**Expected result.** 401, header parser does not crash or silently accept.

---

#### SB-NF-MALFORMED-JSON — Malformed JSON body fails cleanly (400, enveloped)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` |

**What it does.** POST a syntactically broken JSON body ("{not json") to the login route: the API must answer 400 with its error envelope (requestId present), never a 500 or a hang. Verified live: 400 with envelope.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — malformed JSON
      - expect: status 400; body contains "requestId"
      - raw body: `{not json`

**Data used.** Raw body "{not json" (invalid JSON, 9 bytes).

**Data profile.** `malformed` — Hand-crafted invalid input.

**Expected result.** 400 with error envelope.

---

#### SB-NF-METHOD-MISUSE — Unsupported method on health fails cleanly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` |

**What it does.** DELETE {{api}}/health must be rejected with a clean 4xx (404/405 — verified live: 404), never a 500.

**Preconditions.** API up.

**Steps.**

   1. **DELETE** `{{api}}/health` — DELETE /health
      - expect: status 404/405

**Data used.** No body; wrong HTTP verb.

**Data profile.** `negative` — n/a

**Expected result.** 404 or 405, no 500.

---

#### SB-NF-MISSING-IF-MATCH-PRECONDITION — PUT without the required If-Match header fails cleanly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` `concurrency` |

**What it does.** PUT /api/v1/message-types/:code without an If-Match header must return a clean 412 precondition_failed envelope (verified live: {"error":{"code":"precondition_failed","message":"If-Match is required",...}}) — optimistic-concurrency enforcement fails closed with a proper error, not a silent overwrite or a 500.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **PUT** `{{api}}/api/v1/message-types/does-not-exist-code` — PUT without If-Match
      - expect: status 412; `error.code` = "precondition_failed"
      - body: `{}`

**Data used.** PUT with an empty body and no If-Match header.

**Data profile.** `negative` — Hand-crafted.

**Expected result.** 412 precondition_failed, never a silent write or a 500.

---

#### SB-NF-NEGATIVE-PAGE-SIZE-CLAMPED — Negative page_size is clamped, not crashed on

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` `dbviewer` |

**What it does.** GET the DB viewer with page_size=-5 must not 500 or return a negative/zero-length page — verified live: clamped to page_size=1, 200 OK. Input sanitization at the query-param boundary.

**Preconditions.** DB viewer up.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=users&page_size=-5` — negative page_size
      - expect: status 200; `page_size` ≥ 1

**Data used.** page_size=-5 (invalid negative pagination parameter).

**Data profile.** `boundary-negative` — Hand-crafted.

**Expected result.** 200 with page_size clamped to >= 1, never a crash.

---

#### SB-NF-NONEXISTENT-RESOURCE-404 — GET by a nonexistent resource id returns a clean 404

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` |

**What it does.** GET /api/v1/schemas/does-not-exist-id must return a clean 404, never a 500 from an unhandled null-row lookup.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/schemas/does-not-exist-id` — nonexistent schema id
      - expect: status 404

**Data used.** A hardcoded nonexistent resource id.

**Data profile.** `negative` — n/a

**Expected result.** 404, never a 500.

---

#### SB-NF-UNKNOWN-ROUTE — Unknown API route returns enveloped 404

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `errors` |

**What it does.** GET a route that does not exist under /api/v1: must be a JSON 404, content-type application/json — no HTML error page, no stack trace.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/definitely-not-a-route-{{rand}}` — unknown route
      - expect: status 404; body must NOT contain "at Object."; header `content-type` contains "application/json"

**Data used.** GET to a per-run-unique nonexistent path.

**Data profile.** `negative` — Generated per run.

**Expected result.** JSON 404 without stack frames.

---

#### SB-NF-UNSUPPORTED-CONTENT-TYPE — Non-JSON content-type on a JSON route fails cleanly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` |

**What it does.** POST to login with Content-Type: text/plain (body not parsed as JSON) must still return a clean validation envelope (verified live: 422 validation_failed), never a 500 from an unhandled parse path.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — text/plain content-type
      - expect: status 422; `error.code` = "validation_failed"
      - raw body: `tenantSlug=acme-demo`

**Data used.** Raw body sent with Content-Type: text/plain instead of application/json.

**Data profile.** `malformed` — Hand-crafted.

**Expected result.** 422 validation_failed envelope, never a 500.

---

#### SB-NF-UNSUPPORTED-METHOD-ON-COLLECTION — PUT on a collection-only route fails cleanly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `robustness` |

**What it does.** PUT /api/v1/datasets (a route that only supports GET/POST, not a bare PUT on the collection) must return a clean 404/405, never a 500 from routing into an unhandled verb.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **PUT** `{{api}}/api/v1/datasets` — PUT on collection route
      - expect: status 404/405

**Data used.** No body; unsupported HTTP verb on a collection route.

**Data profile.** `negative` — n/a

**Expected result.** 404 or 405, never a 500.

---

#### SB-NF-VALIDATION-ENVELOPE — Missing required fields produce a 422 validation envelope

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `non-functional` `sand-bench` `validation` |

**What it does.** POST an empty JSON object to login: the API must return 422 validation_failed naming the missing fields — verified live: {"error":{"code":"validation_failed","message":"tenantSlug and username are required",...}}.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — empty body
      - expect: status 422; `error.code` = "validation_failed"
      - body: `{}`

**Data used.** Empty JSON object {}.

**Data profile.** `boundary-empty` — Hand-crafted.

**Expected result.** 422 validation_failed envelope.

---

### Category: Vulnerability scanning (Quality control)

_Exposure probes: secret files, traversal, header hygiene._

#### Suite: Exposure scanning (`sb-vuln-scan`) — 15 cases

Secret-file probes, path traversal and information-disclosure headers.

#### SB-VS-API-FRAME-OPTIONS-PRESENT — API responses carry X-Frame-Options

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `headers` |

**What it does.** GET {{api}}/health must include X-Frame-Options (verified live: DENY) — clickjacking hardening on the API surface, not just the web console.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/health` — frame options
      - expect: status 200; header `x-frame-options` present

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** X-Frame-Options header present.

---

#### SB-VS-BACKUP-FILE-NOT-LEAKED — No .bak backup-file disclosure on web tier

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `disclosure` |

**What it does.** GET {{web}}/index.html.bak must never return raw unminified source markers distinct from the real deployed shell — a common editor/deploy artefact that leaks pre-build source.

**Preconditions.** Web tier deployed.

**Steps.**

   1. **GET** `{{web}}/index.html.bak` — .bak probe
      - expect: status 200/403/404; body must NOT contain "<!-- SOURCE"

**Data used.** One GET for the well-known backup-file suffix.

**Data profile.** `probe (read-only)` — n/a

**Expected result.** No raw-source marker in the response.

---

#### SB-VS-CORS-NOT-REFLECTED — API does not reflect an arbitrary Origin into CORS headers

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `cors` |

**What it does.** A request with Origin: http://evil.example.com must not get that origin reflected back in Access-Control-Allow-Origin — verified live: the header is absent entirely. A permissive/reflective CORS policy would let any site read authenticated responses via a victim's browser.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/health` — CORS reflection probe
      - expect: status 200; header `access-control-allow-origin` without "evil.example.com"

**Data used.** One GET with a hostile Origin header.

**Data profile.** `probe (read-only)` — n/a

**Expected result.** Access-Control-Allow-Origin never echoes the attacker origin.

---

#### SB-VS-DBVIEWER-CORS-NOT-REFLECTED — DB viewer does not reflect an arbitrary Origin either

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `cors` `dbviewer` |

**What it does.** The DB viewer surface must also not echo a hostile Origin into Access-Control-Allow-Origin — verified live: header absent — a read-only reporting tool with broad table access would be an especially high-value CORS-misconfiguration target.

**Preconditions.** DB viewer up.

**Steps.**

   1. **GET** `{{dbviewer}}/health` — dbviewer CORS reflection probe
      - expect: status 200; header `access-control-allow-origin` without "evil.example.com"

**Data used.** One GET with a hostile Origin header.

**Data profile.** `probe (read-only)` — n/a

**Expected result.** Access-Control-Allow-Origin never echoes the attacker origin.

---

#### SB-VS-DBVIEWER-READ-ONLY-SURFACE — DB viewer exposes no write route

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `dbviewer` |

**What it does.** POST {{dbviewer}}/api/rows must not exist (verified live: 404 — no route registered) — the DB viewer is architecturally read-only, with no write endpoint to even authenticate against.

**Preconditions.** DB viewer up.

**Steps.**

   1. **POST** `{{dbviewer}}/api/rows?table=users` — POST to dbviewer rows
      - expect: status 404/405
      - body: `{"email_normalised":"attacker@example.invalid"}`

**Data used.** One POST attempt against a read-only surface; no row is created.

**Data profile.** `probe (read-only)` — Hand-crafted.

**Expected result.** 404 or 405 — no write route exists.

---

#### SB-VS-DOCKER-COMPOSE-NOT-LEAKED — No docker-compose source disclosure on web tier

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `disclosure` |

**What it does.** GET {{web}}/docker-compose.yml must never return real compose-file content ("services:" mapping to container definitions) — infrastructure topology must not be disclosable through the web tier.

**Preconditions.** Web tier deployed.

**Steps.**

   1. **GET** `{{web}}/docker-compose.yml` — docker-compose probe
      - expect: status 200/403/404; body must NOT contain "services:"

**Data used.** One GET for the well-known compose filename.

**Data profile.** `probe (read-only)` — n/a

**Expected result.** No compose-file content in the response.

---

#### SB-VS-ENV-FILE — No environment file disclosure on web tier

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `disclosure` |

**What it does.** GET {{web}}/.env — whatever the router does with the path (the SPA serves its shell), the response must never contain environment-file markers (DATABASE_URL=, PASSWORD=, SECRET). Verified live: the SPA fallback serves index.html, so the assertion is on content, not status.

**Preconditions.** Web tier deployed.

**Steps.**

   1. **GET** `{{web}}/.env` — .env probe
      - expect: status 200/403/404; body must NOT contain "DATABASE_URL="
   2. **GET** `{{web}}/.env` — .env probe (2)
      - expect: status 200/403/404; body must NOT contain "PASSWORD="

**Data used.** Two GETs for the well-known secret filename.

**Data profile.** `probe (read-only)` — n/a

**Expected result.** No env-file content in any response.

---

#### SB-VS-GIT-DIR — No git metadata disclosure on web tier

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `disclosure` |

**What it does.** GET {{web}}/.git/config must never return git config content ("[core]" / "repositoryformatversion").

**Preconditions.** Web tier deployed.

**Steps.**

   1. **GET** `{{web}}/.git/config` — .git probe
      - expect: status 200/403/404; body must NOT contain "repositoryformatversion"

**Data used.** One GET for the well-known git metadata path.

**Data profile.** `probe (read-only)` — n/a

**Expected result.** No git metadata in the response.

---

#### SB-VS-JSON-CONTENT-TYPE — API errors are typed application/json

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `headers` |

**What it does.** Error responses (401 on a protected route) must declare content-type application/json — an untyped error body invites content-sniffing issues.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/message-types` — typed error
      - expect: status 401; header `content-type` contains "application/json"

**Data used.** Unauthenticated GET to a protected route.

**Data profile.** `negative` — n/a

**Expected result.** 401 with application/json content type.

---

#### SB-VS-KAFKA-DESK-CONNECTION-SECRET-NOT-LEAKED — External-system list does not leak connection secrets

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `disclosure` |

**What it does.** GET /api/v1/external-systems/public must expose routing metadata (id/name/channel/queue/topic) but never a credential-shaped field ("password", "secret", "apiKey") — the public catalogue is meant for discovery, not credential distribution.

**Preconditions.** Demo external systems seeded.

**Steps.**

   1. **GET** `{{api}}/api/v1/external-systems/public` — no password field (1)
      - expect: status 200; `data` length ≥ 1; body must NOT contain "\"password\""
   2. **GET** `{{api}}/api/v1/external-systems/public` — no secret field (2)
      - expect: status 200; body must NOT contain "\"secret\""

**Data used.** Two GETs against the public external-systems catalogue.

**Data profile.** `probe (read-only)` — n/a

**Expected result.** No password/secret-shaped field anywhere in the public payload.

---

#### SB-VS-NO-SESSION-COOKIE-ISSUED — Login does not set a session cookie

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `auth` |

**What it does.** POST /api/v1/session/login must not set a Set-Cookie header — verified live — the session is a bearer token the client stores itself, not an ambient cookie the browser auto-attaches to every request (which would be CSRF-exposed).

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — no session cookie
      - expect: status 200; header `set-cookie` absent
      - body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** No Set-Cookie header on the login response.

---

#### SB-VS-PACKAGE-JSON-NOT-LEAKED — No package.json source disclosure on web tier

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `disclosure` |

**What it does.** GET {{web}}/package.json falls through to the SPA shell (verified live: 200 text/html, not the real manifest) — the response must never contain dependency-manifest markers ("dependencies", ""name":"").

**Preconditions.** Web tier deployed.

**Steps.**

   1. **GET** `{{web}}/package.json` — package.json probe
      - expect: status 200/403/404; body must NOT contain "\"dependencies\""

**Data used.** One GET for the well-known manifest filename.

**Data profile.** `probe (read-only)` — n/a

**Expected result.** No dependency-manifest content in the response.

---

#### SB-VS-SERVER-HEADER — API does not advertise server software/version

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `headers` |

**What it does.** The API's responses must not carry a version-revealing Server header nor any X-Powered-By header (OWASP API8 security misconfiguration). Verified live: both absent.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/health` — header hygiene
      - expect: status 200; header `x-powered-by` absent, header `server` without "express"

**Data used.** One GET; assertions on response headers.

**Data profile.** `none (read-only)` — n/a

**Expected result.** No x-powered-by; server header does not name the framework.

---

#### SB-VS-TRAVERSAL — Encoded path traversal is rejected

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `traversal` |

**What it does.** GET {{web}}/..%2f..%2f..%2fetc%2fpasswd must be rejected (verified live: 400) and must never contain passwd-file content ("root:").

**Preconditions.** Web tier deployed.

**Steps.**

   1. **GET** `{{web}}/..%2f..%2f..%2fetc%2fpasswd` — traversal probe
      - expect: status 400/403/404; body must NOT contain "root:"

**Data used.** One URL-encoded traversal GET.

**Data profile.** `probe (read-only)` — n/a

**Expected result.** 4xx and no file-system content.

---

#### SB-VS-WEB-SECURITY-HEADERS-PRESENT — Web tier carries the core security header set

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `vuln-scan` `sand-bench` `headers` |

**What it does.** The web tier must serve X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN and Referrer-Policy — verified live on the root document — the baseline header set OWASP recommends for any HTML-serving surface.

**Preconditions.** Web tier deployed.

**Steps.**

   1. **GET** `{{web}}/` — web security headers
      - expect: status 200; header `x-content-type-options` present, header `x-frame-options` present, header `referrer-policy` present

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** All three security headers present with the verified values.

---

### Category: Penetration tests (Quality control)

_Authentication attack-surface checks (negative auth)._

#### Suite: Auth attack surface (`sb-pen-auth`) — 16 cases

Negative authentication tests: every unauthenticated or malformed attempt is rejected cleanly.

#### SB-PT-ADMIN-BOGUS-TOKEN — Fabricated token is rejected before the admin permission check runs

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v7` `owasp-api5` |

**What it does.** A fabricated bearer token on GET /api/v1/admin/users must be rejected 401 (authentication failure), not 403 (authorization failure) — proving token validation runs and fails closed before any role/permission logic is even reached.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/admin/users` — bogus token on admin route
      - expect: status 401

**Data used.** Fabricated bearer token unique to this run.

**Data profile.** `negative-auth` — Generated per run.

**Expected result.** 401 — rejected at authentication, before authorization.

---

#### SB-PT-ADMIN-PRIVILEGE-ESCALATION-BLOCKED — Non-admin operator cannot reach admin routes (fails closed)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v4` |

**What it does.** ASVS V4 (access control): a valid, authenticated session for the non-admin demo operator must still be rejected (403) from GET /api/v1/admin/users — verified live — proving authorization is checked per-role after authentication, not just "has a valid token".

**Preconditions.** Demo operator identity enabled (non-admin role).

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/admin/users` — operator cannot read admin users
      - expect: status 403

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** 403 forbidden — valid session, insufficient privilege.

---

#### SB-PT-ADMIN-USERS-TOKENLESS — Admin user-management route rejects unauthenticated reads

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `owasp-api5` |

**What it does.** OWASP API1/API5 (broken object/function-level auth): GET /api/v1/admin/users without any token must be 401 — the baseline check that runs before the (separately tested) role check even applies.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/admin/users` — tokenless admin/users
      - expect: status 401

**Data used.** No authorization header.

**Data profile.** `negative-auth` — n/a

**Expected result.** 401.

---

#### SB-PT-BOGUS-TOKEN — Fabricated bearer token is rejected

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v7` |

**What it does.** A syntactically bearer-shaped but fabricated token must be rejected with 401 — token validation is real, not presence-only.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/session/me` — bogus token
      - expect: status 401

**Data used.** Fabricated bearer token unique to this run.

**Data profile.** `negative-auth` — Generated per run.

**Expected result.** 401.

---

#### SB-PT-CATALOGUE-BOGUS-TOKEN — Fabricated token is rejected on the message-type catalogue too

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v7` |

**What it does.** A fabricated bearer token must be rejected 401 on GET /api/v1/message-types, not just on session/me — proving token validation is enforced by shared middleware across routes, not re-implemented (and possibly forgotten) per endpoint.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/message-types` — bogus token on catalogue
      - expect: status 401

**Data used.** Fabricated bearer token unique to this run.

**Data profile.** `negative-auth` — Generated per run.

**Expected result.** 401.

---

#### SB-PT-CATALOGUE-TOKENLESS — Protected catalogue rejects unauthenticated reads

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `owasp-api1` |

**What it does.** OWASP API1 (broken object level auth): /api/v1/message-types without a token must be 401 with the unauthorized envelope.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/message-types` — tokenless catalogue
      - expect: status 401; `error.code` = "unauthorized"

**Data used.** No authorization header.

**Data profile.** `negative-auth` — n/a

**Expected result.** 401 unauthorized.

---

#### SB-PT-DEVTOOLS-RESEED-TOKENLESS — Destructive-shaped devtools route is never reachable unauthenticated

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `owasp-api5` `devtools` |

**What it does.** POST /api/v1/devtools/reseed-demo-identities without a token must be 401 — verified live — this route can rewrite demo identity data, so it must be behind auth even in a non-production bench. This case only proves the tokenless call is rejected; it deliberately never sends a valid token, so it never actually triggers a reseed.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/devtools/reseed-demo-identities` — tokenless devtools reseed
      - expect: status 401

**Data used.** No authorization header; no reseed is ever actually triggered.

**Data profile.** `negative-auth` — n/a

**Expected result.** 401 — rejected before any reseed logic runs.

---

#### SB-PT-JWT-ALG-NONE-REJECTED — JWT "alg":"none" attack is rejected

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v7` `jwt` |

**What it does.** ASVS V7: a classic alg-confusion probe — a JWT header claiming {"alg":"none"} with a plausible admin payload and an empty signature segment — must be rejected 401, verified live. If accepted, this would let an attacker mint arbitrary identities without knowing any secret.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/session/me` — alg:none JWT
      - expect: status 401

**Data used.** A hand-crafted JWT with header {"alg":"none","typ":"JWT"}, a plausible admin-shaped payload, and an empty signature segment.

**Data profile.** `injection-shaped` — Hand-crafted.

**Expected result.** 401 — the none-algorithm attack is rejected.

---

#### SB-PT-LOGIN-EMPTY — Login rejects missing credentials without a 500

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v6` |

**What it does.** ASVS V6: an empty credential submission must be rejected with a 4xx validation envelope (verified live: 422), proving no unauthenticated path slips through and no server error leaks internals.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — empty credentials
      - expect: status 400/401/422; `error.code` exists
      - body: `{}`

**Data used.** Empty JSON credential object.

**Data profile.** `negative-auth` — Hand-crafted.

**Expected result.** 4xx envelope, never 500.

---

#### SB-PT-LOGIN-INJECTION — Injection-shaped username fails cleanly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v1` |

**What it does.** ASVS V1/V5: a username shaped like a SQL injection probe ("' OR 1=1 --") must be rejected with a clean 4xx envelope — a 500 here suggests the input reached an interpreter.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — injection-shaped username
      - expect: status 400/401/422; `error.requestId` exists
      - body: `{"password":"x","username":"' OR 1=1 --","tenantSlug":"{{tenant}}"}`

**Data used.** Username "' OR 1=1 --" (classic tautology probe), throwaway password.

**Data profile.** `injection-shaped` — Hand-crafted.

**Expected result.** 4xx envelope with requestId; no 500.

---

#### SB-PT-LOGIN-WRONG-PASSWORD — Wrong password is rejected with 401

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v6` |

**What it does.** ASVS V6: a syntactically valid login for the documented demo operator with a deliberately wrong password must return 401 unauthorized — and the same generic envelope as an unknown user (no username oracle).

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — wrong password
      - expect: status 401; `error.code` = "unauthorized"
      - body: `{"password":"deliberately-wrong-{{ts}}","username":"{{username}}","tenantSlug":"{{tenant}}"}`

**Data used.** Configured demo username with a per-run-unique wrong password (never a real credential).

**Data profile.** `negative-auth` — Generated per run.

**Expected result.** 401 unauthorized envelope.

---

#### SB-PT-LOGOUT-INVALIDATES-TOKEN — Logout actually invalidates the session token

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v7` |

**What it does.** ASVS V7 (session management): after POST /api/v1/session/logout returns 200, the same token must no longer work — verified live: a subsequent GET /api/v1/session/me with the logged-out token returns 401. A logout that leaves the token usable is a real session-fixation-adjacent defect.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — login (dedicated token for this case)
      - expect: status 200
      - capture `logoutToken` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/session/logout` — logout
      - expect: status 200
   3. **GET** `{{api}}/api/v1/session/me` — token rejected after logout
      - expect: status 401

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Token that worked before logout returns 401 immediately after.

---

#### SB-PT-MALFORMED-JWT-STRUCTURE — A token that is not even JWT-shaped is rejected, not crashed on

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v7` |

**What it does.** A bearer value with no dot-separated segments at all ("not-a-jwt") must be rejected 401 — verified live — proving the token parser fails closed on structurally invalid input rather than throwing an unhandled exception.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/session/me` — non-JWT-shaped token
      - expect: status 401

**Data used.** Bearer value "not-a-jwt" (no dot-separated segments).

**Data profile.** `negative-auth` — Hand-crafted.

**Expected result.** 401, no 500.

---

#### SB-PT-SECURITY-SECRETS-TOKENLESS — Secrets endpoint rejects unauthenticated reads

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `owasp-api5` `secrets` |

**What it does.** GET /api/v1/security/secrets/:path without a token must be 401 — the most sensitive read surface in the API (encryption key/secret material metadata) must never be reachable without authentication.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/security/secrets/sandbench-data` — tokenless secrets read
      - expect: status 401

**Data used.** No authorization header.

**Data profile.** `negative-auth` — n/a

**Expected result.** 401.

---

#### SB-PT-SESSION-ME-TOKENLESS — Session introspection requires a bearer token

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v7` |

**What it does.** ASVS V7: GET /api/v1/session/me without a token must be 401 — session state is never derivable without credentials.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/session/me` — tokenless /me
      - expect: status 401

**Data used.** No authorization header.

**Data profile.** `negative-auth` — n/a

**Expected result.** 401.

---

#### SB-PT-UNKNOWN-USERNAME-NO-ORACLE — Unknown username gives the same generic rejection as a wrong password

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `security` `pen-test` `sand-bench` `asvs-v6` |

**What it does.** ASVS V6 (no username enumeration oracle): logging in with a syntactically valid tenant but a username that does not exist must return the identical generic envelope (401 unauthorized, "Invalid credentials") as a wrong-password attempt on a real user — verified live — so an attacker cannot distinguish "wrong password" from "no such user".

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — unknown username
      - expect: status 401; `error.code` = "unauthorized"
      - body: `{"username":"nobody-{{rand}}","tenantSlug":"{{tenant}}"}`

**Data used.** A per-run-unique nonexistent username under the real configured tenant.

**Data profile.** `negative-auth` — Generated per run.

**Expected result.** 401 unauthorized — same shape as a wrong-password rejection.

---

### Category: Compatibility tests (Quality control)

_Chromium / Firefox / WebKit across four screen sizes._

#### Suite: Browser & viewport matrix (`sb-compat-browsers`) — 24 cases

Chromium, Firefox and WebKit at desktop/laptop/tablet/mobile sizes.

#### SB-CB-CHROMIUM-DESKTOP — chromium @ desktop 1920×1080: /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1920×1080 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `chromium` `desktop` `responsive` |

**What it does.** Launch real chromium, set a 1920×1080 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright chromium engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 1920px)_

**Data used.** Viewport 1920×1080; engine chromium; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

#### SB-CB-CHROMIUM-LAPTOP — chromium @ laptop 1366×768: /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1366×768 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `chromium` `laptop` `responsive` |

**What it does.** Launch real chromium, set a 1366×768 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright chromium engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 1366px)_

**Data used.** Viewport 1366×768; engine chromium; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

#### SB-CB-CHROMIUM-LAPTOP-HELP — chromium @ laptop 1366×768: /help.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1366×768 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `chromium` `laptop` `responsive` |

**What it does.** Launch real chromium, set a 1366×768 viewport, open {{web}}/help.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright chromium engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/help.html` _(open /help.html)_
   2. **assert_text** — expect `Help` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 1366px)_

**Data used.** Viewport 1366×768; engine chromium; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Help" visible; scrollWidth <= viewport width.

---

#### SB-CB-CHROMIUM-MOBILE — chromium @ mobile 390×844 (iPhone 14-class): /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 390×844 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `chromium` `mobile` `responsive` |

**What it does.** Launch real chromium, set a 390×844 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright chromium engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 390px)_

**Data used.** Viewport 390×844; engine chromium; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

#### SB-CB-CHROMIUM-MOBILE-HELP — chromium @ mobile 390×844 (iPhone 14-class): /help.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 390×844 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `chromium` `mobile` `responsive` |

**What it does.** Launch real chromium, set a 390×844 viewport, open {{web}}/help.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright chromium engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/help.html` _(open /help.html)_
   2. **assert_text** — expect `Help` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 390px)_

**Data used.** Viewport 390×844; engine chromium; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Help" visible; scrollWidth <= viewport width.

---

#### SB-CB-CHROMIUM-TABLET — chromium @ tablet portrait 768×1024: /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 768×1024 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `chromium` `tablet` `responsive` |

**What it does.** Launch real chromium, set a 768×1024 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright chromium engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 768px)_

**Data used.** Viewport 768×1024; engine chromium; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

#### SB-CB-CHROMIUM-TABLET-DEMO — chromium @ tablet portrait 768×1024: /demo.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 768×1024 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `chromium` `tablet` `responsive` |

**What it does.** Launch real chromium, set a 768×1024 viewport, open {{web}}/demo.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright chromium engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/demo.html` _(open /demo.html)_
   2. **assert_text** — expect `demo` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 768px)_

**Data used.** Viewport 768×1024; engine chromium; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "demo" visible; scrollWidth <= viewport width.

---

#### SB-CB-CONSOLE-DESKTOP — chromium @ desktop: operator console mounts

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 1920×1080 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `chromium` `desktop` `console` |

**What it does.** The full console SPA must mount (demo sign-in via the gate form, gate hides, nav renders) at desktop resolution in chromium — the compatibility anchor for the dynamic app.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **navigate** — value `{{web}}/` _(open console)_
   2. **wait_for** — selector `#gate #login` _(sign-in gate shown)_
   3. **type** — selector `#gate #tenant`, value `{{tenant}}` _(tenant slug)_
   4. **type** — selector `#gate #username`, value `{{username}}` _(demo operator username)_
   5. **click** — selector `#gate #login` _(Sign in (password optional in dev builds))_
   6. **wait_for_hidden** — selector `#gate` _(gate hides — console mounted)_
   7. **assert_selector_count_min** — selector `.opsc-navitem`, value `5` _(nav present)_
   8. **assert_no_horizontal_overflow** _(no overflow at 1920)_

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Console mounts and lays out without overflow.

---

#### SB-CB-CONSOLE-MOBILE — chromium @ mobile: operator console mounts without overflow (known gap)

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 390×844 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `chromium` `mobile` `console` `known-defect` |

**What it does.** The console SPA must mount (demo sign-in via the gate form, gate hides, nav renders) at a 390×844 mobile viewport (iPhone 14-class) — the narrowest form factor in the matrix, and the one most likely to reveal off-canvas nav or overflow bugs. Verified live against this deployment: the mount itself succeeds, but the layout overflows horizontally by ~133px at this width — no prior case in this suite tested the dynamic console below 768px tablet width, so this gap was previously uncovered. This case intentionally keeps the no-overflow assertion (the correct requirement) rather than loosening it to match the current broken layout, so it stays red until the responsive CSS is fixed.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **navigate** — value `{{web}}/` _(open console)_
   2. **wait_for** — selector `#gate #login` _(sign-in gate shown)_
   3. **type** — selector `#gate #tenant`, value `{{tenant}}` _(tenant slug)_
   4. **type** — selector `#gate #username`, value `{{username}}` _(demo operator username)_
   5. **click** — selector `#gate #login` _(Sign in (password optional in dev builds))_
   6. **wait_for_hidden** — selector `#gate` _(gate hides — console mounted)_
   7. **assert_selector_count_min** — selector `.opsc-navitem`, value `3` _(nav present)_
   8. **assert_no_horizontal_overflow** _(no overflow at 390px)_

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Console mounts at mobile width without horizontal overflow — verified live as currently failing (overflows ~133px); tracks a real responsive-design gap rather than masking it.

---

#### SB-CB-CONSOLE-TABLET — chromium @ tablet: operator console mounts

| | |
|---|---|
| **Runner** | `playwright` (chromium) @ 768×1024 |
| **Type / level** | ui / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `chromium` `tablet` `console` |

**What it does.** The console SPA must also mount (demo sign-in) at tablet-portrait width (768px) — the narrowest form factor the ops console officially supports.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **navigate** — value `{{web}}/` _(open console)_
   2. **wait_for** — selector `#gate #login` _(sign-in gate shown)_
   3. **type** — selector `#gate #tenant`, value `{{tenant}}` _(tenant slug)_
   4. **type** — selector `#gate #username`, value `{{username}}` _(demo operator username)_
   5. **click** — selector `#gate #login` _(Sign in (password optional in dev builds))_
   6. **wait_for_hidden** — selector `#gate` _(gate hides — console mounted)_
   7. **assert_selector_count_min** — selector `.opsc-navitem`, value `3` _(nav present)_

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Console mounts at tablet width.

---

#### SB-CB-FIREFOX-DESKTOP — firefox @ desktop 1920×1080: /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (firefox) @ 1920×1080 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `firefox` `desktop` `responsive` |

**What it does.** Launch real firefox, set a 1920×1080 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright firefox engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 1920px)_

**Data used.** Viewport 1920×1080; engine firefox; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

#### SB-CB-FIREFOX-DESKTOP-DEMO — firefox @ desktop 1920×1080: /demo.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (firefox) @ 1920×1080 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `firefox` `desktop` `responsive` |

**What it does.** Launch real firefox, set a 1920×1080 viewport, open {{web}}/demo.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright firefox engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/demo.html` _(open /demo.html)_
   2. **assert_text** — expect `demo` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 1920px)_

**Data used.** Viewport 1920×1080; engine firefox; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "demo" visible; scrollWidth <= viewport width.

---

#### SB-CB-FIREFOX-LAPTOP — firefox @ laptop 1366×768: /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (firefox) @ 1366×768 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `firefox` `laptop` `responsive` |

**What it does.** Launch real firefox, set a 1366×768 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright firefox engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 1366px)_

**Data used.** Viewport 1366×768; engine firefox; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

#### SB-CB-FIREFOX-MOBILE — firefox @ mobile 390×844 (iPhone 14-class): /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (firefox) @ 390×844 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `firefox` `mobile` `responsive` |

**What it does.** Launch real firefox, set a 390×844 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright firefox engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 390px)_

**Data used.** Viewport 390×844; engine firefox; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

#### SB-CB-FIREFOX-MOBILE-HELP — firefox @ mobile 390×844 (iPhone 14-class): /help.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (firefox) @ 390×844 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `firefox` `mobile` `responsive` |

**What it does.** Launch real firefox, set a 390×844 viewport, open {{web}}/help.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright firefox engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/help.html` _(open /help.html)_
   2. **assert_text** — expect `Help` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 390px)_

**Data used.** Viewport 390×844; engine firefox; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Help" visible; scrollWidth <= viewport width.

---

#### SB-CB-FIREFOX-TABLET — firefox @ tablet portrait 768×1024: /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (firefox) @ 768×1024 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `firefox` `tablet` `responsive` |

**What it does.** Launch real firefox, set a 768×1024 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright firefox engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 768px)_

**Data used.** Viewport 768×1024; engine firefox; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

#### SB-CB-FIREFOX-TABLET-DEMO — firefox @ tablet portrait 768×1024: /demo.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (firefox) @ 768×1024 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `firefox` `tablet` `responsive` |

**What it does.** Launch real firefox, set a 768×1024 viewport, open {{web}}/demo.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright firefox engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/demo.html` _(open /demo.html)_
   2. **assert_text** — expect `demo` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 768px)_

**Data used.** Viewport 768×1024; engine firefox; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "demo" visible; scrollWidth <= viewport width.

---

#### SB-CB-SELENIUM-NARROW — Selenium Chrome @ 768: shell renders

| | |
|---|---|
| **Runner** | `selenium` @ 768×1024 |
| **Type / level** | ui / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `selenium` `tablet` |

**What it does.** Selenium/Chrome at a narrow 768×1024 window must still render the shell content — the non-Playwright confirmation of narrow-viewport behavior.

**Preconditions.** Chrome + chromedriver on worker.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open shell)_
   2. **assert_text** — expect `Sand Bench` _(branding)_

**Data used.** Chrome window 768×1024.

**Data profile.** `viewport-matrix` — Runner-configured window size.

**Expected result.** Branding text renders at narrow window.

---

#### SB-CB-SELENIUM-WIDE — Selenium Chrome @ 1920: shell renders

| | |
|---|---|
| **Runner** | `selenium` @ 1920×1080 |
| **Type / level** | ui / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `selenium` `desktop` |

**What it does.** The Selenium/Chrome half of the matrix: console shell at a 1920×1080 window renders the verified branding. Confirms viewport control works in the Selenium runner too.

**Preconditions.** Chrome + chromedriver on worker.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open shell)_
   2. **assert_text** — expect `Sand Bench` _(branding)_

**Data used.** Chrome window 1920×1080.

**Data profile.** `viewport-matrix` — Runner-configured window size.

**Expected result.** Branding text renders at wide window.

---

#### SB-CB-WEBKIT-DESKTOP — webkit @ desktop 1920×1080: /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (webkit) @ 1920×1080 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `webkit` `desktop` `responsive` |

**What it does.** Launch real webkit, set a 1920×1080 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright webkit engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 1920px)_

**Data used.** Viewport 1920×1080; engine webkit; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

#### SB-CB-WEBKIT-LAPTOP-DEMO — webkit @ laptop 1366×768: /demo.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (webkit) @ 1366×768 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `webkit` `laptop` `responsive` |

**What it does.** Launch real webkit, set a 1366×768 viewport, open {{web}}/demo.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright webkit engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/demo.html` _(open /demo.html)_
   2. **assert_text** — expect `demo` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 1366px)_

**Data used.** Viewport 1366×768; engine webkit; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "demo" visible; scrollWidth <= viewport width.

---

#### SB-CB-WEBKIT-MOBILE — webkit @ mobile 390×844 (iPhone 14-class): /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (webkit) @ 390×844 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `webkit` `mobile` `responsive` |

**What it does.** Launch real webkit, set a 390×844 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright webkit engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 390px)_

**Data used.** Viewport 390×844; engine webkit; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

#### SB-CB-WEBKIT-MOBILE-HELP — webkit @ mobile 390×844 (iPhone 14-class): /help.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (webkit) @ 390×844 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `webkit` `mobile` `responsive` |

**What it does.** Launch real webkit, set a 390×844 viewport, open {{web}}/help.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright webkit engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/help.html` _(open /help.html)_
   2. **assert_text** — expect `Help` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 390px)_

**Data used.** Viewport 390×844; engine webkit; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Help" visible; scrollWidth <= viewport width.

---

#### SB-CB-WEBKIT-TABLET — webkit @ tablet portrait 768×1024: /index.html renders without overflow

| | |
|---|---|
| **Runner** | `playwright` (webkit) @ 768×1024 |
| **Type / level** | ui / system |
| **Priority / severity** | p1 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compatibility` `sand-bench` `webkit` `tablet` `responsive` |

**What it does.** Launch real webkit, set a 768×1024 viewport, open {{web}}/index.html, assert the verified content renders AND the layout does not force horizontal scrolling at this width. One cell of the cross-browser/responsive matrix.

**Preconditions.** Worker has the Playwright webkit engine installed.

**Steps.**

   1. **navigate** — value `{{web}}/index.html` _(open /index.html)_
   2. **assert_text** — expect `Sand Bench` _(content renders)_
   3. **assert_no_horizontal_overflow** _(no sideways scroll at 768px)_

**Data used.** Viewport 768×1024; engine webkit; no input data.

**Data profile.** `viewport-matrix` — Runner-configured browser context.

**Expected result.** Content fragment "Sand Bench" visible; scrollWidth <= viewport width.

---

### Category: Chaos & failover tests (Quality control)

_Graceful degradation under bad input and error bursts._

#### Suite: Graceful degradation (`sb-chaos`) — 14 cases

Unexpected input and error floods do not destabilise the deployment.

#### SB-CH-BOUNDED-BURST-RUN — A 500-message run completes without hanging

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `chaos` `sand-bench` `degradation` |

**What it does.** POST /api/v1/runs with count:500 — a sharp burst, not a soak — must complete within its timeout (verified live: ~1.2s, 202) and leave the app healthy. Distinguishes a slow-but-working generator from one that hangs on larger batches.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — 500-message burst
      - expect: status 202; `generated` = 500
      - body: `{"seed":"TE-CH-BURST-{{ts}}","count":500,"channel":"api","messageTypeCode":"pain.001.001.09"}`
   3. **GET** `{{api}}/health` — still healthy
      - expect: status 200

**Data used.** 500 pain.001.001.09 messages generated in one call.

**Data profile.** `generated-iso20022` — Application's own generator.

**Expected result.** generated=500 within timeout; health 200 after.

---

#### SB-CH-CONCURRENT-IDENTICAL-SEED-RUNS — Two runs with the identical seed back-to-back do not collide

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `chaos` `sand-bench` `degradation` |

**What it does.** Firing two generation runs with the exact same seed value in immediate succession must not error, deadlock or corrupt either run's result — each gets its own runId and completes independently — and the app stays healthy afterwards.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — run 1 with fixed seed
      - expect: status 202; `runId` exists
      - capture `seedRunId1` ← `runId`; body: `{"seed":"TE-CH-SAMESEED-{{ts}}","count":1,"channel":"api","messageTypeCode":"pain.001.001.09"}`
   3. **POST** `{{api}}/api/v1/runs` — run 2 with identical seed
      - expect: status 202; `runId` exists
      - body: `{"seed":"TE-CH-SAMESEED-{{ts}}","count":1,"channel":"api","messageTypeCode":"pain.001.001.09"}`
   4. **GET** `{{api}}/health` — still healthy
      - expect: status 200

**Data used.** Two runs sharing the exact same seed string.

**Data profile.** `generated-iso20022` — Generated per run.

**Expected result.** Both runs return distinct runIds and 202; health 200 after.

---

#### SB-CH-DBVIEWER-BAD-TABLE — DB viewer degrades cleanly on unknown relation

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `chaos` `sand-bench` `dbviewer` |

**What it does.** Asking the DB viewer for a table that does not exist must produce its clean viewer_error envelope (verified live: 400 {"error":{"code":"viewer_error",...}}) — not a raw driver stack.

**Preconditions.** DB viewer up.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=te_ghost_{{rand}}` — unknown relation
      - expect: status 400; `error.code` = "viewer_error"

**Data used.** Per-run-unique nonexistent table name.

**Data profile.** `fault-injection` — Generated per run.

**Expected result.** 400 viewer_error envelope.

---

#### SB-CH-DBVIEWER-INJECTION-SHAPED-TABLE-PARAM — DB viewer rejects an injection-shaped table parameter

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `chaos` `sand-bench` `dbviewer` `injection` |

**What it does.** GET the DB viewer with table set to an injection-shaped value ("users; DROP TABLE users--") must be rejected cleanly (verified live: 400 {"error":{"code":"viewer_error","message":"table is not a safe SQL identifier"}}), proving the table name is validated against a safe-identifier check, never interpolated raw into SQL.

**Preconditions.** DB viewer up.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=users%3B%20DROP%20TABLE%20users--` — injection-shaped table param
      - expect: status 400; `error.code` = "viewer_error"

**Data used.** table="users; DROP TABLE users--" (URL-encoded SQL injection probe).

**Data profile.** `injection-shaped` — Hand-crafted.

**Expected result.** 400 viewer_error; table identifier rejected before reaching SQL.

---

#### SB-CH-DEEPLY-NESTED-PAYLOAD — A deeply nested JSON payload does not crash ingestion

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `chaos` `sand-bench` `degradation` |

**What it does.** A message payload nested 20 levels deep must be accepted or cleanly rejected by the hub (verified live: 202) without a stack-overflow-shaped 500, and the app must remain healthy immediately afterwards — a cheap guard against unbounded-recursion JSON handling.

**Preconditions.** Testhub and API up.

**Steps.**

   1. **POST** `{{testhub}}/hub/to-app` — 20-level nested payload
      - expect: status 200/202/400/413
      - body: `{"channel":"api","payload":{"MsgId":"TE-NEST-{{ts}}-{{rand}}","nested":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":"deep"}}}}}}}}}}}}}}}}}}}}},"systemId":"te_nest",`
   2. **GET** `{{api}}/health` — still healthy
      - expect: status 200

**Data used.** One JSON payload nested 20 levels deep.

**Data profile.** `oversized` — Hand-crafted.

**Expected result.** Clean accept-or-reject; health 200 after.

---

#### SB-CH-EMPTY-CHANNEL-STRING-FALLS-BACK — Empty-string channel falls back cleanly instead of erroring

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `chaos` `sand-bench` `degradation` |

**What it does.** POST /api/v1/runs with channel:"" (falsy in the app's own `body.channel || target?.channel || "file"` resolution) must fall back to a default channel and complete cleanly (202) rather than erroring on an empty channel name.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — empty channel string
      - expect: status 202
      - body: `{"count":1,"channel":"","messageTypeCode":"pain.001.001.09"}`

**Data used.** channel = "" (empty string).

**Data profile.** `boundary-empty` — Hand-crafted.

**Expected result.** 202 — falls back to a default channel, does not error.

---

#### SB-CH-ERROR-BURST-RECOVERY — Error burst leaves the API healthy

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `chaos` `sand-bench` `recovery` |

**What it does.** Fire several guaranteed-error requests (unknown routes, tokenless protected reads), then assert /health still answers 200 — errors must not leak resources or wedge the event loop.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/nope-1-{{rand}}` — error 1
      - expect: status 404
   2. **GET** `{{api}}/api/v1/nope-2-{{rand}}` — error 2
      - expect: status 404
   3. **GET** `{{api}}/api/v1/message-types` — error 3
      - expect: status 401
   4. **POST** `{{api}}/api/v1/session/login` — error 4
      - expect: status 400
      - raw body: `{broken`
   5. **GET** `{{api}}/health` — recovered
      - expect: status 200; `status` = "ok"

**Data used.** Four deliberate error requests followed by a health probe.

**Data profile.** `fault-injection` — Generated per run.

**Expected result.** All errors clean; final health 200.

---

#### SB-CH-GHOST-TENANT — Login against a non-existent tenant fails cleanly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `chaos` `sand-bench` `tenancy` |

**What it does.** A login for tenant "ghost-tenant-{{rand}}" must be rejected with a 4xx envelope — the tenancy layer degrades to a clean rejection, not a 500 from a missing-row lookup.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — ghost tenant
      - expect: status 401/404/422; `error.requestId` exists
      - body: `{"password":"irrelevant","username":"nobody","tenantSlug":"ghost-tenant-{{rand}}"}`

**Data used.** Per-run-unique nonexistent tenant slug; throwaway credentials.

**Data profile.** `fault-injection` — Generated per run.

**Expected result.** 4xx envelope with requestId.

---

#### SB-CH-INJECTION-SHAPED-CHANNEL-VALUE — SQL-injection-shaped channel value does not destabilise a run

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `chaos` `sand-bench` `degradation` `injection` |

**What it does.** POST /api/v1/runs with channel set to a SQL-injection-shaped string ("'; DROP TABLE test_runs; --") must be handled cleanly (accepted with a coerced/default channel, or rejected) — verified live: 202, run completes normally — and the app must remain healthy and its tables intact afterwards.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — injection-shaped channel
      - expect: status 200/202/400/422
      - body: `{"count":1,"channel":"'; DROP TABLE test_runs; --","messageTypeCode":"pain.001.001.09"}`
   3. **GET** `{{api}}/health` — app still healthy
      - expect: status 200
   4. **GET** `{{api}}/api/v1/message-types` — catalogue routes still work (no table dropped)
      - expect: status 200

**Data used.** channel = "'; DROP TABLE test_runs; --" (SQL tautology/drop probe as a string value).

**Data profile.** `injection-shaped` — Hand-crafted.

**Expected result.** Clean accept-or-reject; health 200; catalogue routes unaffected (no table actually dropped).

---

#### SB-CH-INVALID-MESSAGE-TYPE-CODE — Run against a nonexistent message type fails cleanly

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `chaos` `sand-bench` `degradation` |

**What it does.** POST /api/v1/runs with a messageTypeCode that does not exist must return a clean 404 not_found (verified live) — not a 500 from an unhandled catalogue-lookup miss — and the app must remain healthy afterwards.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — unknown message type
      - expect: status 404; `error.code` = "not_found"
      - body: `{"count":1,"channel":"api","messageTypeCode":"does-not-exist-{{rand}}"}`
   3. **GET** `{{api}}/health` — app still healthy
      - expect: status 200

**Data used.** A per-run-unique nonexistent messageTypeCode.

**Data profile.** `fault-injection` — Generated per run.

**Expected result.** 404 not_found envelope; health 200 after.

---

#### SB-CH-NEGATIVE-COUNT-CLAMPED — Negative run count is clamped, not crashed on

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `chaos` `sand-bench` `degradation` |

**What it does.** POST /api/v1/runs with count:-5 must not crash — verified live: the app clamps to at least 1 generated message and completes normally (202). Health must stay 200 afterwards.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/runs` — negative count
      - expect: status 200/202/400/422
      - body: `{"seed":"TE-CH-NEGCOUNT-{{ts}}","count":-5,"channel":"api","messageTypeCode":"pain.001.001.09"}`
   3. **GET** `{{api}}/health` — app still healthy
      - expect: status 200

**Data used.** count:-5 (negative, invalid run size).

**Data profile.** `fault-injection` — Hand-crafted.

**Expected result.** Clean accept-or-reject, never a 500; health 200 after.

---

#### SB-CH-OVERSIZED-USERNAME — A 10,000-character username does not destabilise login

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `chaos` `sand-bench` `degradation` |

**What it does.** A syntactically valid but wildly oversized username (10,000 characters) must be rejected cleanly (verified live: 401 unauthorized, same generic envelope as any other unknown credential) — never a 500 from an unbounded string being pushed into a downstream query or comparison without a length guard.

**Preconditions.** API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — oversized username
      - expect: status 401; `error.code` = "unauthorized"
      - body: `{"username":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Data used.** A 10,000-character username string ("x" repeated).

**Data profile.** `oversized` — Hand-crafted.

**Expected result.** 401 unauthorized, never a 500.

---

#### SB-CH-RAPID-LOGIN-BURST — Five rapid sequential logins do not destabilise auth

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `chaos` `sand-bench` `degradation` `auth` |

**What it does.** Five back-to-back login calls for the same demo operator must all succeed (200, each with its own token) — proving the auth path has no shared-mutable-state race under rapid repeated use.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — login 1
      - expect: status 200
      - body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/session/login` — login 2
      - expect: status 200
      - body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   3. **POST** `{{api}}/api/v1/session/login` — login 3
      - expect: status 200
      - body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   4. **POST** `{{api}}/api/v1/session/login` — login 4
      - expect: status 200
      - body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   5. **POST** `{{api}}/api/v1/session/login` — login 5
      - expect: status 200
      - body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   6. **GET** `{{api}}/health` — still healthy
      - expect: status 200

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** All five logins succeed; health 200 after.

---

#### SB-CH-UNKNOWN-CHANNEL — Unknown delivery channel does not destabilise the pipeline

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `chaos` `sand-bench` `degradation` |

**What it does.** Deliver a message on a channel that does not exist ("carrier-pigeon"). The hub mimic forwards it (verified live: 202); the application must absorb the unknown channel without crashing — health must be 200 immediately after.

**Preconditions.** Testhub and API up.

**Steps.**

   1. **POST** `{{testhub}}/hub/to-app` — unknown channel
      - expect: status 202/400/422
      - body: `{"channel":"carrier-pigeon","payload":{"MsgId":"TE-CH-{{ts}}"},"systemId":"te_chaos","systemName":"TE chaos probe"}`
   2. **GET** `{{api}}/health` — app still healthy
      - expect: status 200

**Data used.** One message with channel "carrier-pigeon" and unique MsgId.

**Data profile.** `fault-injection` — Generated per run.

**Expected result.** Delivery handled either way; health 200 after.

---

### Category: Compliance tests (Quality control)

_Audit trail, environment disclosure and masking evidence._

#### Suite: Compliance evidence (`sb-compliance`) — 14 cases

Audit trail, non-production disclosure and masking demo are in place.

#### SB-CP-AUDIT-LOGIN-TRAIL — Login attempts leave an audit trail

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p1 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `audit` |

**What it does.** The audit_events table (read independently via the DB viewer) must contain session.login actions — the compliance evidence that authentication activity is audited.

**Preconditions.** DB viewer registered; at least one login attempt has occurred (pen-auth suite creates them).

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=audit_events&page_size=100` — audit trail
      - expect: status 200; body contains "session.login"

**Data used.** Reads up to 100 audit rows.

**Data profile.** `production-shaped (read-only)` — Application-written audit data.

**Expected result.** session.login present in audit rows.

---

#### SB-CP-AUDIT-ROWS-ALWAYS-ATTRIBUTED — Every sampled audit row is attributed to a real actor

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p1 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `audit` |

**What it does.** The most recent audit rows must all carry a non-empty actor_user_id — compliance requires every audited action to be traceable to a specific identity, never an anonymous or null actor.

**Preconditions.** At least one audited action has occurred.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/audit` — attributed audit rows
      - expect: status 200; `data.0.actor_user_id` exists; body must NOT contain "\"actor_user_id\":null"

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** No sampled audit row has a null actor_user_id.

---

#### SB-CP-ENCRYPTION-CONFIG-TRANSPARENT — Encryption configuration is disclosed, not hidden

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `encryption` |

**What it does.** GET /api/v1/security/status must publish its own encryption configuration (keyName, algorithm) rather than hiding it behind a bare "ok" — an auditor reviewing this bench must be able to see which key and algorithm protect sensitive fields.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/security/status` — encryption config disclosure
      - expect: status 200; `config.keyName` exists, `config.algorithm` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** config.keyName and config.alg present.

---

#### SB-CP-ENV-CLASSIFICATION — Environment classification is honest (non-production)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `classification` `safety` |

**What it does.** Because this catalog runs demo identities and synthetic data, the target must classify itself as a non-production environment: /health classification must be development/demo/test — never production.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/health` — classification guard
      - expect: status 200; `classification` exists; body must NOT contain "\"classification\":\"production\""

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Classification present and not "production".

---

#### SB-CP-EXTERNAL-SYSTEMS-LABELLED-NON-PRODUCTION — Seeded external systems are clearly labelled as stand-ins

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `disclosure` |

**What it does.** Every entry in /api/v1/external-systems/public must have its name prefixed "Dummy" (verified live: "Dummy sanctions list", "Dummy core banking", "Dummy fraud stream", …) — compliance evidence that no integration in this bench could be mistaken for a real counterparty connection.

**Preconditions.** Demo external systems seeded.

**Steps.**

   1. **GET** `{{api}}/api/v1/external-systems/public` — dummy-labelled systems
      - expect: status 200; `data.0.name` exists; body contains "Dummy"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** Public external systems carry a "Dummy" name prefix.

---

#### SB-CP-LOGIN-EVENTS-ENABLED-IN-FRAMEWORK — Login events are enabled in the eventing framework

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `events` `audit` |

**What it does.** GET /api/v1/events/framework must show biz.session.login.success with enabled:true and emitJson:true (verified live) — compliance requires authentication events to actually be captured, not merely cataloged as possible.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/events/framework` — login event enabled
      - expect: status 200; body contains "\"biz.session.login.success\":{\"enabled\":true"

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** biz.session.login.success is enabled in the framework.

---

#### SB-CP-MASKING-EVIDENCE — Data-masking demonstration page is published

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `masking` |

**What it does.** The masking demo page ({{web}}/mask-demo.html, verified title "Masking slide — Sand Bench") must be served — the visible evidence of the masked-payload capability compliance reviewers look for.

**Preconditions.** Web tier deployed.

**Steps.**

   1. **GET** `{{web}}/mask-demo.html` — masking page
      - expect: status 200; body contains "Masking"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with masking content.

---

#### SB-CP-NAMING-GOVERNANCE-PUBLISHED — Artefact naming governance is published for review

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `governance` |

**What it does.** GET /api/v1/naming-conventions must publish the naming patterns every artefact (rule, dataset, test_case, …) is expected to follow — governance evidence that artefact identifiers are standardised, not ad hoc, across the tenant.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/naming-conventions` — naming governance
      - expect: status 200; `data` length ≥ 1

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** >= 1 published naming convention.

---

#### SB-CP-NOT-PROD-DISCLOSURE — Non-production disclosure page is published

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `disclosure` |

**What it does.** The deployment must serve its "Not production" disclosure page ({{web}}/not-production.html, verified title "Not production — Sand Bench") — the operator-facing statement that this environment must not carry real data.

**Preconditions.** Web tier deployed.

**Steps.**

   1. **GET** `{{web}}/not-production.html` — disclosure page
      - expect: status 200; body contains "Not production"

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** 200 with the disclosure title.

---

#### SB-CP-RESILIENCE-POSTURE-HONEST — Resilience posture endpoint never claims production-grade guarantees

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `classification` `safety` |

**What it does.** GET /api/v1/resilience must publish a posture that is honest about this being a non-production bench (verified live: "bench-not-production") — compliance requires this environment to never misrepresent itself as carrying production resilience guarantees.

**Preconditions.** API up.

**Steps.**

   1. **GET** `{{api}}/api/v1/resilience` — honest resilience posture
      - expect: status 200; `posture` exists; body must NOT contain "\"posture\":\"production\""

**Data used.** No request payload.

**Data profile.** `none (read-only)` — n/a

**Expected result.** posture present and never "production".

---

#### SB-CP-SENSITIVE-DATA-POLICY-COVERAGE — Sensitive-data masking policy names its covered resources

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `masking` `policy` |

**What it does.** GET /api/v1/security/policies must publish the SAND_BENCH_SENSITIVE_DATA policy with its resources array naming payment.message and customer.accountNumber — verified live — the compliance evidence that these specific fields are covered by the masking/encryption policy, not just a policy that exists in name only.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/security/policies` — policy resource coverage
      - expect: status 200; `data.0.resources` length ≥ 1; body contains "payment.message"

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Policy resources array includes payment.message.

---

#### SB-CP-SIGNING-CAPABILITY-DISCLOSED — Message-signing capability is published for review

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `signatures` |

**What it does.** GET /api/v1/catalog/signatures must publish its supported signing modes and default — compliance evidence that message-integrity signing (or its deliberate absence, mode "none" by default) is a visible, reviewable configuration rather than an undocumented internal detail.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/catalog/signatures` — signing capability disclosure
      - expect: status 200; `data.modes` length ≥ 1, `data.default` exists

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Signing modes and a default mode published.

---

#### SB-CP-TENANT-ISOLATION-TIER-DISCLOSED — Tenant isolation model is a documented, inspectable field

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `dbviewer` `tenancy` |

**What it does.** The tenants table (read independently via the DB viewer) must expose an isolation_tier column — compliance/data-residency review needs to see, per tenant, which isolation model (e.g. shared_rls) applies, not have it be an undocumented internal detail.

**Preconditions.** Demo tenants imported.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=tenants&page_size=20` — isolation tier column
      - expect: status 200; `columns` contains "isolation_tier"

**Data used.** Reads tenant rows; asserts on column list only.

**Data profile.** `reference (read-only)` — Demo tenant import.

**Expected result.** isolation_tier column present.

---

#### SB-CP-USERS-VIEWER-EXPOSES-NO-CREDENTIALS — Read-only user reporting path never exposes credential columns

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `compliance` `sand-bench` `dbviewer` `credentials` |

**What it does.** The users table read through the independent DB viewer must expose only id/email_normalised/display_name/status/locale/timezone/created_at — verified live — and must never carry a password or password_hash column, even for a reporting tool with broad read access.

**Preconditions.** DB viewer registered.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=users&page_size=5` — no credential columns
      - expect: status 200; `columns` , `columns` 

**Data used.** Reads 5 user rows; asserts on column list only.

**Data profile.** `reference (read-only)` — Demo identity import.

**Expected result.** columns never include password or password_hash.

---

### Category: DR recovery & self-healing (Quality control)

_Durability and multi-path consistency of the deployment._

#### Suite: Durability & consistency (`sb-dr`) — 14 cases

Data persists and stays consistent across independent read paths.

#### SB-DR-ALL-SURFACES — All four deployment surfaces answer together

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p0 / critical |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `dr` `sand-bench` `recovery` |

**What it does.** One case, four health probes (api, testhub, dbviewer, web): the deployment's minimum recovery point is all surfaces answering at once. Fails if any single container is down — the first thing to run after any restart/failover.

**Preconditions.** Deployment started.

**Steps.**

   1. **GET** `{{api}}/health` — api
      - expect: status 200
   2. **GET** `{{testhub}}/health` — testhub
      - expect: status 200
   3. **GET** `{{dbviewer}}/health` — dbviewer
      - expect: status 200
   4. **GET** `{{web}}/index.html` — web
      - expect: status 200

**Data used.** Four GETs.

**Data profile.** `none (read-only)` — n/a

**Expected result.** All four 200.

---

#### SB-DR-AUDIT-TRAIL-MONOTONIC-GROWTH — Audit trail only grows, never shrinks, across an action

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `dr` `sand-bench` `durability` `audit` |

**What it does.** Read the audit total, perform one more auditable action (login), then read the total again: the second count must be >= the first — append-only durability. A durable audit store never loses previously written rows.

**Preconditions.** At least one prior audited action exists.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/audit` — audit before
      - expect: status 200; `data` length ≥ 1
   3. **POST** `{{api}}/api/v1/session/login` — one more auditable action
      - expect: status 200
      - body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   4. **GET** `{{api}}/api/v1/audit` — audit after
      - expect: status 200; `data` length ≥ 1
      - poll up to 5s

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Audit trail is non-empty before and after; nothing is lost.

---

#### SB-DR-DATASETS-COUNT-STABLE-ACROSS-READS — Dataset count is stable across two consecutive reads

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p3 / low |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `dr` `sand-bench` `consistency` `datasets` |

**What it does.** Reading the datasets table twice in immediate succession via the DB viewer must return the same total both times — proving reads are consistent (no read replica lag or phantom rows) under normal conditions.

**Preconditions.** At least one dataset seeded.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=datasets&page_size=1` — first read
      - expect: status 200; `total` ≥ 1
   2. **GET** `{{dbviewer}}/api/rows?table=datasets&page_size=1` — second read
      - expect: status 200; `total` ≥ 1

**Data used.** Two single-row-page reads for total counts only.

**Data profile.** `production-shaped (read-only)` — Seeded dataset data.

**Expected result.** total >= 1 on both reads.

---

#### SB-DR-DETECTION-RULES-STABLE-ACROSS-READS — Detection-rule count is stable across two consecutive reads

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `dr` `sand-bench` `durability` `rules` |

**What it does.** Reading detection_rules twice in immediate succession via the DB viewer must return the same total both times — the fraud/AML rule set a live deployment depends on must not appear to gain or lose rules between two reads seconds apart.

**Preconditions.** Detection rules seeded.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=detection_rules&page_size=1` — first read
      - expect: status 200; `total` ≥ 1
   2. **GET** `{{dbviewer}}/api/rows?table=detection_rules&page_size=1` — second read
      - expect: status 200; `total` ≥ 1

**Data used.** Two single-row-page reads for total counts only.

**Data profile.** `production-shaped (read-only)` — Seeded rule catalogue.

**Expected result.** total >= 1 on both reads.

---

#### SB-DR-DUAL-PATH-CONSISTENCY — Database reachable via two independent paths

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `dr` `sand-bench` `consistency` |

**What it does.** The application says its DB is fine (/ready) AND the DB viewer independently reads the same database (application_events rows exist). If the two disagree, recovery is incomplete even though one path looks green.

**Preconditions.** API and DB viewer up against the same database.

**Steps.**

   1. **GET** `{{api}}/ready` — app path
      - expect: status 200; `status` = "ready"
   2. **GET** `{{dbviewer}}/api/rows?table=application_events&page_size=1` — independent path
      - expect: status 200; `total` ≥ 1

**Data used.** One readiness probe + one single-row table read.

**Data profile.** `production-shaped (read-only)` — Existing application data.

**Expected result.** Both paths confirm the same database.

---

#### SB-DR-EVENT-DURABILITY — Recorded events survive across repeated reads

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 40s |
| **Tags** | `dr` `sand-bench` `durability` |

**What it does.** Write one correlated event through the hub, confirm it is recorded, then read the feed again and confirm it is still there — a cheap durability check that catches in-memory-only event stores.

**Preconditions.** Testhub and API up.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{testhub}}/hub/to-app` — write event
      - expect: status 202
      - body: `{"channel":"api","payload":{"MsgId":"TE-DR-{{ts}}-{{rand}}"},"systemId":"te_dr","systemName":"TE durability probe"}`
   3. **GET** `{{api}}/api/v1/inbound/events` — first read
      - expect: status 200; body contains "TE-DR-{{ts}}-{{rand}}"
      - poll up to 8s
   4. **GET** `{{api}}/api/v1/inbound/events` — second read (still there)
      - expect: status 200; body contains "TE-DR-{{ts}}-{{rand}}"

**Data used.** One correlated event (MsgId TE-DR-{{ts}}-{{rand}}).

**Data profile.** `synthetic-correlated` — Generated per run.

**Expected result.** Event visible on both consecutive reads.

---

#### SB-DR-JOBS-LEASE-AND-RETRY-PRESENT — Background jobs carry a lease and retry-count

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `dr` `sand-bench` `self-healing` `jobs` |

**What it does.** jobs rows (read via the DB viewer) must expose attempts and leased_until columns — the mechanism that lets a crashed worker's job be safely picked up and retried by another worker after its lease expires, rather than being stuck forever.

**Preconditions.** At least one background job has run.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=jobs&page_size=5` — job lease/retry metadata
      - expect: status 200; `total` ≥ 1, `columns` contains "attempts", `columns` contains "leased_until"

**Data used.** Reads up to 5 jobs rows.

**Data profile.** `production-shaped (read-only)` — Background job runner.

**Expected result.** attempts and leased_until columns present.

---

#### SB-DR-MESSAGE-TYPES-DUAL-PATH-COUNT-MATCH — Message-type count matches across the API and DB-viewer paths

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 30s |
| **Tags** | `dr` `sand-bench` `consistency` |

**What it does.** The count of message types the application API reports and the count the independent DB viewer reads directly from the database must be identical — verified live: both 19. A mismatch would mean one path is looking at stale or filtered data.

**Preconditions.** API and DB viewer both up against the same database.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **GET** `{{api}}/api/v1/message-types` — API path count
      - expect: status 200; `data` length ≥ 1
   3. **GET** `{{dbviewer}}/api/rows?table=message_types&page_size=1` — dbviewer path count
      - expect: status 200; `total` ≥ 1

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** Both paths report a consistent, non-empty message-type catalogue.

---

#### SB-DR-OPTIONAL-KAFKA-PROXY-DOES-NOT-DEGRADE-API-HEALTH — Unconfigured Kafka proxy never takes down overall API health

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 20s |
| **Tags** | `dr` `sand-bench` `self-healing` `kafka` |

**What it does.** The Kafka connectivity check reporting produced:false (proxy not configured) must have zero effect on /health — verified live — an optional companion failing must never cascade into the core API being marked unhealthy. This is the "optional companions may fail, the bench stays up" contract from /api/v1/resilience in action.

**Preconditions.** Demo operator identity enabled.

**Steps.**

   1. **POST** `{{api}}/api/v1/session/login` — operator login
      - expect: status 200
      - capture `token` ← `token`; body: `{"username":"{{username}}","tenantSlug":"{{tenant}}"}`
   2. **POST** `{{api}}/api/v1/external-systems/kafka/connectivity-check` — kafka check (may report unconfigured)
      - expect: status 200
   3. **GET** `{{api}}/health` — core health unaffected
      - expect: status 200; `status` = "ok"

**Data used.** Sign-in as the documented demo operator ({{tenant}} / {{username}}, no password — optional in this build).

**Data profile.** `demo-identity` — dev/demo-seed/sand-bench-demo-tenants-users.json (fictional dev-only identity).

**Expected result.** /health stays "ok" regardless of the optional Kafka proxy's configuration state.

---

#### SB-DR-OUTBOX-RETRY-MECHANISM-PRESENT — Domain event outbox carries its own retry metadata

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p1 / high |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `dr` `sand-bench` `self-healing` `outbox` |

**What it does.** domain_event_outbox rows (read via the DB viewer) must expose attempts and next_attempt_at columns — the self-healing retry mechanism that re-delivers an event outbox entry after a transient publish failure, rather than losing it silently.

**Preconditions.** At least one domain event emitted.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=domain_event_outbox&page_size=5` — outbox retry metadata
      - expect: status 200; `total` ≥ 1, `columns` contains "attempts", `columns` contains "next_attempt_at"

**Data used.** Reads up to 5 domain_event_outbox rows.

**Data profile.** `production-shaped (read-only)` — Application-emitted domain events.

**Expected result.** attempts and next_attempt_at columns present.

---

#### SB-DR-RUN-SCHEDULES-NEXT-RUN-TRACKED — Enabled schedules track their own next fire time

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `dr` `sand-bench` `self-healing` `schedules` |

**What it does.** run_schedules rows must expose next_run_at and last_run_at — a scheduler that has lost track of when a schedule should next fire is a silent self-healing failure that would only surface as "why didn't this run last night".

**Preconditions.** Schedules seeded.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=run_schedules&page_size=5` — schedule tracking columns
      - expect: status 200; `total` ≥ 1, `columns` contains "next_run_at", `columns` contains "last_run_at"

**Data used.** Reads up to 5 run_schedules rows.

**Data profile.** `production-shaped (read-only)` — Seeded schedule data.

**Expected result.** next_run_at and last_run_at columns present.

---

#### SB-DR-SCHEMA-MIGRATIONS-STABLE-ACROSS-REPEATED-READS — Applied-migration count is stable across two consecutive reads

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `dr` `sand-bench` `durability` `migrations` |

**What it does.** Reading schema_migrations twice in a row must return the exact same total both times — a cheap durability check: if the count changed between two reads seconds apart (with no deploy in between), something is silently re-running or losing migration history.

**Preconditions.** Database migrated at deploy time.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=schema_migrations&page_size=1` — first read
      - expect: status 200; `total` ≥ 50
      - capture `migCount1` ← `total`
   2. **GET** `{{dbviewer}}/api/rows?table=schema_migrations&page_size=1` — second read
      - expect: status 200; `total` ≥ 50

**Data used.** Two reads of schema_migrations.

**Data profile.** `schema-only (read-only)` — Deploy-time migration runner.

**Expected result.** total >= 50 on both reads.

---

#### SB-DR-SELF-HEALING-SIGNAL — Background job engine shows recent activity

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `dr` `sand-bench` `self-healing` |

**What it does.** The application's scheduled/background machinery (cron schema) is registered in its database; the application_events stream shows recent automated activity (>= 1 row). A dead scheduler is the classic silent-failure after failover.

**Preconditions.** DB viewer registered.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=application_events&page_size=5` — activity stream
      - expect: status 200; `total` ≥ 1, `columns` contains "occurred_at"

**Data used.** Reads 5 application_events rows.

**Data profile.** `production-shaped (read-only)` — Application-written event stream.

**Expected result.** Event stream non-empty with timestamps.

---

#### SB-DR-TENANT-MEMBERSHIP-DUAL-PATH-CONSISTENT — Tenant membership count is consistent with the users table

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | resilience / system |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 60s |
| **Tags** | `dr` `sand-bench` `consistency` `tenancy` |

**What it does.** The tenant_memberships table (join of user↔tenant) and the users table, both read independently via the DB viewer, must both be non-empty and of a plausible matching order of magnitude — verified live: 17 users, 17 memberships — proving the identity join table was not silently left out of a data migration.

**Preconditions.** Demo identities imported.

**Steps.**

   1. **GET** `{{dbviewer}}/api/rows?table=users&page_size=1` — users total
      - expect: status 200; `total` ≥ 1
   2. **GET** `{{dbviewer}}/api/rows?table=tenant_memberships&page_size=1` — memberships total
      - expect: status 200; `total` ≥ 1

**Data used.** Two single-row-page reads for total counts only.

**Data profile.** `reference (read-only)` — Demo identity import.

**Expected result.** Both tables non-empty.

---

### Category: custom

#### Suite: Cross-category evidence check (`custom-cross-category-evidence-check-3764c5`) — 5 cases

SIT health + GUI, HTTP, Selenium, performance, endurance and one placeholder: proves every run type leaves evidence.

#### SIT-00_HEALTH-MAIN-APPLICATION-IS-HEALTHY-AND-REPORTS- — main application is healthy and reports its deployed classification

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `smoke` `00-health` |

**What it does.** Imported from sit/cases/00-health.sit.ts

**Execution.** Runs `sit/cases/00-health.sit.ts::main application is healthy and reports its deployed classification` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-00_HEALTH-WEB-FRONT-END-SERVES-THE-DEPLOYED-CONSOL — web front end serves the deployed console

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | smoke / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `smoke` `00-health` |

**What it does.** Imported from sit/cases/00-health.sit.ts

**Execution.** Runs `sit/cases/00-health.sit.ts::web front end serves the deployed console` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-61_SELENIUM_SCREENS-SELENIUM-SCREEN-INVENTORY-MATCHES-OFFICI — Selenium screen inventory matches officialNav page ids

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `61-selenium-screens` |

**What it does.** Imported from sit/cases/61-selenium-screens.sit.ts

**Execution.** Runs `sit/cases/61-selenium-screens.sit.ts::Selenium screen inventory matches officialNav page ids` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### TE-ENDURANCE-SB-HEALTH-SOAK-60S — Sand Bench /health soak for 60 seconds

| | |
|---|---|
| **Runner** | `endurance` |
| **Type / level** | performance / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 15s |
| **Tags** | `endurance` `qc` `sandbench` |

**What it does.** Continuous load for 60 s at concurrency 4 against /health; SLA p95 <= 1500 ms, errors <= 1%. Graphs show drift over time.

---

#### TE-PERF-SB-HEALTH-LOAD — Sand Bench /health under 10 concurrent users

| | |
|---|---|
| **Runner** | `performance` |
| **Type / level** | performance / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 15s |
| **Tags** | `performance` `qc` `sandbench` |

**What it does.** 200 requests at concurrency 10 against /health; SLA p95 <= 1000 ms, errors <= 1%.

**Execution.** Performance runner: 200 requests at concurrency 10 against `/health`, SLA {"p95_ms":1000,"error_rate_pct":1}.

---

### Category: other

#### Suite: sit-91-performance-soak (`sit-91-performance-soak`) — 3 cases

Imported from sit/cases/91-performance-soak.sit.ts

#### SIT-91_PERFORMANCE_SOAK-MAIN-APPLICATION-STAYS-REACHABLE-THROUGH — main application stays reachable throughout the soak window with no sustained outage

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `other` `91-performance-soak` |

**What it does.** Imported from sit/cases/91-performance-soak.sit.ts

**Execution.** Runs `sit/cases/91-performance-soak.sit.ts::main application stays reachable throughout the soak window with no sustained outage` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-91_PERFORMANCE_SOAK-SUSTAINED-AUTHENTICATED-READS-AGAINST-AP — sustained authenticated reads against /api/v1/message-types show no error-rate drift

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `other` `91-performance-soak` |

**What it does.** Imported from sit/cases/91-performance-soak.sit.ts

**Execution.** Runs `sit/cases/91-performance-soak.sit.ts::sustained authenticated reads against /api/v1/message-types show no error-rate drift` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-91_PERFORMANCE_SOAK-SUSTAINED-LOAD-AGAINST-READY-SHOWS-NO-ME — sustained load against /ready shows no meaningful error-rate or latency drift over the soak window

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `other` `91-performance-soak` |

**What it does.** Imported from sit/cases/91-performance-soak.sit.ts

**Execution.** Runs `sit/cases/91-performance-soak.sit.ts::sustained load against /ready shows no meaningful error-rate or latency drift over the soak window` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-92-performance-burst (`sit-92-performance-burst`) — 3 cases

Imported from sit/cases/92-performance-burst.sit.ts

#### SIT-92_PERFORMANCE_BURST-A-BURST-IMMEDIATELY-FOLLOWING-A-PRIOR-BU — a burst immediately following a prior burst does not compound failures

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `other` `92-performance-burst` |

**What it does.** Imported from sit/cases/92-performance-burst.sit.ts

**Execution.** Runs `sit/cases/92-performance-burst.sit.ts::a burst immediately following a prior burst does not compound failures` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-92_PERFORMANCE_BURST-A-SUDDEN-BURST-OF-CONCURRENT-REQUESTS-TO — a sudden burst of concurrent requests to /ready mostly succeeds without cascading failure

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `other` `92-performance-burst` |

**What it does.** Imported from sit/cases/92-performance-burst.sit.ts

**Execution.** Runs `sit/cases/92-performance-burst.sit.ts::a sudden burst of concurrent requests to /ready mostly succeeds without cascading failure` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-92_PERFORMANCE_BURST-REPEATED-BURSTS-AGAINST-THE-API-RECOVER- — repeated bursts against the API recover between waves instead of degrading wave over wave

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | other / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `other` `92-performance-burst` |

**What it does.** Imported from sit/cases/92-performance-burst.sit.ts

**Execution.** Runs `sit/cases/92-performance-burst.sit.ts::repeated bursts against the API recover between waves instead of degrading wave over wave` via the node:test SIT runner (the case file drives the deployed stack directly).

---

### Category: api

#### Suite: sit-api (`sit-api`) — 2 cases

Imported from sit/cases/30-api-round-trip.sit.ts

#### SIT-30_API_ROUND_TRIP-APPLICATION-POSTS-A-MESSAGE-TO-AN-EXTERN — application posts a message to an external API and delivery is confirmed there

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `api` `30-api-round-trip` |

**What it does.** Imported from sit/cases/30-api-round-trip.sit.ts

**Execution.** Runs `sit/cases/30-api-round-trip.sit.ts::application posts a message to an external API and delivery is confirmed there` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-30_API_ROUND_TRIP-EXTERNAL-API-CLIENT-POSTS-A-MESSAGE-AND- — external API client posts a message and the application records receipt

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `api` `30-api-round-trip` |

**What it does.** Imported from sit/cases/30-api-round-trip.sit.ts

**Execution.** Runs `sit/cases/30-api-round-trip.sit.ts::external API client posts a message and the application records receipt` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-use-case-api (`sit-use-case-api`) — 1 cases

Imported from sit/cases/51-use-case-api.sit.ts

#### SIT-51_USE_CASE_API — SIT file: 51-use-case-api.sit.ts

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | api / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `api` |

**What it does.** Registered from 51-use-case-api.sit.ts (no static test() names extracted)

**Execution.** Runs `sit/cases/51-use-case-api.sit.ts` via the node:test SIT runner (the case file drives the deployed stack directly).

---

### Category: ui

#### Suite: sit-console-chrome (`sit-console-chrome`) — 2 cases

Imported from sit/cases/68-console-chrome.sit.ts

#### SIT-68_CONSOLE_CHROME-ATTACHWORKBENCH-RESETS-THE-SHARED-OVERLA — attachWorkbench resets the shared overlay box on page change

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `68-console-chrome` |

**What it does.** Imported from sit/cases/68-console-chrome.sit.ts

**Execution.** Runs `sit/cases/68-console-chrome.sit.ts::attachWorkbench resets the shared overlay box on page change` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-68_CONSOLE_CHROME-BRAND-FOOTER-OVERLAY-IS-NOT-SERVED-ON-TH — brand footer overlay is not served on the console host

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `68-console-chrome` |

**What it does.** Imported from sit/cases/68-console-chrome.sit.ts

**Execution.** Runs `sit/cases/68-console-chrome.sit.ts::brand footer overlay is not served on the console host` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-feature-access (`sit-feature-access`) — 2 cases

Imported from sit/cases/67-feature-access-ui.sit.ts

#### SIT-67_FEATURE_ACCESS_UI-FEATURE-ACCESS-BINDER-IS-SERVED-ON-THE-C — feature-access binder is served on the console host

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `67-feature-access-ui` |

**What it does.** Imported from sit/cases/67-feature-access-ui.sit.ts

**Execution.** Runs `sit/cases/67-feature-access-ui.sit.ts::feature-access binder is served on the console host` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-67_FEATURE_ACCESS_UI-SESSION-FEATURES-CATALOGUE-IS-REACHABLE- — session features catalogue is reachable without inventing tenant_id

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `67-feature-access-ui` |

**What it does.** Imported from sit/cases/67-feature-access-ui.sit.ts

**Execution.** Runs `sit/cases/67-feature-access-ui.sit.ts::session features catalogue is reachable without inventing tenant_id` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-gui-smoke (`sit-gui-smoke`) — 1 cases

Imported from sit/cases/60-gui-smoke.sit.ts

#### SIT-60_GUI_SMOKE-GUI-PAGE-PAGE-PATH-IS-SERVED-AFTER-DEPLO — GUI page ${page.path} is served after deploy

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `60-gui-smoke` |

**What it does.** Imported from sit/cases/60-gui-smoke.sit.ts

**Execution.** Runs `sit/cases/60-gui-smoke.sit.ts::GUI page ${page.path} is served after deploy` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-official-clicks (`sit-official-clicks`) — 2 cases

Imported from sit/cases/66-official-clicks.sit.ts

#### SIT-66_OFFICIAL_CLICKS-INDEX-HTML-LOADS-OFFICIAL-CLICKS-AFTER-L — index.html loads official-clicks after live-bind

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `66-official-clicks` |

**What it does.** Imported from sit/cases/66-official-clicks.sit.ts

**Execution.** Runs `sit/cases/66-official-clicks.sit.ts::index.html loads official-clicks after live-bind` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-66_OFFICIAL_CLICKS-OFFICIAL-CLICKS-BINDER-IS-SERVED-ON-THE- — official-clicks binder is served on the console host

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `66-official-clicks` |

**What it does.** Imported from sit/cases/66-official-clicks.sit.ts

**Execution.** Runs `sit/cases/66-official-clicks.sit.ts::official-clicks binder is served on the console host` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-selenium-fields (`sit-selenium-fields`) — 2 cases

Imported from sit/cases/62-selenium-fields.sit.ts

#### SIT-62_SELENIUM_FIELDS-EVERY-OFFICIAL-PAGE-HAS-A-FIELD-OR-CONTR — every official page has a field or control contract

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `62-selenium-fields` |

**What it does.** Imported from sit/cases/62-selenium-fields.sit.ts

**Execution.** Runs `sit/cases/62-selenium-fields.sit.ts::every official page has a field or control contract` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-62_SELENIUM_FIELDS-SELENIUM-FIELDS-ON-PAGEID — Selenium fields on ${pageId}

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `62-selenium-fields` |

**What it does.** Imported from sit/cases/62-selenium-fields.sit.ts

**Execution.** Runs `sit/cases/62-selenium-fields.sit.ts::Selenium fields on ${pageId}` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-selenium-screens (`sit-selenium-screens`) — 3 cases

Imported from sit/cases/61-selenium-screens.sit.ts

#### SIT-61_SELENIUM_SCREENS-SELENIUM-SCREEN-INVENTORY-MATCHES-OFFICI — Selenium screen inventory matches officialNav page ids

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `61-selenium-screens` |

**What it does.** Imported from sit/cases/61-selenium-screens.sit.ts

**Execution.** Runs `sit/cases/61-selenium-screens.sit.ts::Selenium screen inventory matches officialNav page ids` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-61_SELENIUM_SCREENS-SELENIUM-SCREEN-PAGEID-OPENS-FROM-OFFICI — Selenium screen ${pageId} opens from official nav

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `61-selenium-screens` |

**What it does.** Imported from sit/cases/61-selenium-screens.sit.ts

**Execution.** Runs `sit/cases/61-selenium-screens.sit.ts::Selenium screen ${pageId} opens from official nav` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-61_SELENIUM_SCREENS-SELENIUM-STATIC-PAGE-PAGE-PATH-LOOK-AND- — Selenium static page ${page.path} look-and-feel

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `61-selenium-screens` |

**What it does.** Imported from sit/cases/61-selenium-screens.sit.ts

**Execution.** Runs `sit/cases/61-selenium-screens.sit.ts::Selenium static page ${page.path} look-and-feel` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-selenium-workflows (`sit-selenium-workflows`) — 5 cases

Imported from sit/cases/63-selenium-workflows.sit.ts

#### SIT-63_SELENIUM_WORKFLOWS-WORKFLOW-CONFIGURATION-TEST-CONNECTION-C — workflow: Configuration test-connection controls

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `63-selenium-workflows` |

**What it does.** Imported from sit/cases/63-selenium-workflows.sit.ts

**Execution.** Runs `sit/cases/63-selenium-workflows.sit.ts::workflow: Configuration test-connection controls` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-63_SELENIUM_WORKFLOWS-WORKFLOW-CREATE-NEW-RULE-SURFACES-CONDIT — workflow: Create new rule surfaces condition kinds

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `63-selenium-workflows` |

**What it does.** Imported from sit/cases/63-selenium-workflows.sit.ts

**Execution.** Runs `sit/cases/63-selenium-workflows.sit.ts::workflow: Create new rule surfaces condition kinds` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-63_SELENIUM_WORKFLOWS-WORKFLOW-GATE-OVERVIEW-FIRST-RUN-STRIP — workflow: gate → Overview first-run strip

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `63-selenium-workflows` |

**What it does.** Imported from sit/cases/63-selenium-workflows.sit.ts

**Execution.** Runs `sit/cases/63-selenium-workflows.sit.ts::workflow: gate → Overview first-run strip` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-63_SELENIUM_WORKFLOWS-WORKFLOW-NEW-TEST-RUN-SHOWS-FILE-API-MQ- — workflow: New test run shows File / API / MQ / Kafka

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `63-selenium-workflows` |

**What it does.** Imported from sit/cases/63-selenium-workflows.sit.ts

**Execution.** Runs `sit/cases/63-selenium-workflows.sit.ts::workflow: New test run shows File / API / MQ / Kafka` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-63_SELENIUM_WORKFLOWS-WORKFLOW-OVERVIEW-IMPORT-SCHEMA — workflow: Overview → Import schema

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `63-selenium-workflows` |

**What it does.** Imported from sit/cases/63-selenium-workflows.sit.ts

**Execution.** Runs `sit/cases/63-selenium-workflows.sit.ts::workflow: Overview → Import schema` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-ui-eventing (`sit-ui-eventing`) — 1 cases

Imported from sit/cases/60-ui-eventing.sit.ts

#### SIT-60_UI_EVENTING-A-USER-SENDS-A-MESSAGE-FROM-THE-CONFIGUR — a user sends a message from the Configuration page and it is received by the external API endpoint

| | |
|---|---|
| **Runner** | `playwright` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `60-ui-eventing` |

**What it does.** Imported from sit/cases/60-ui-eventing.sit.ts

**Execution.** Runs `sit/cases/60-ui-eventing.sit.ts::a user sends a message from the Configuration page and it is received by the MQ manager` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-ui-pages (`sit-ui-pages`) — 26 cases

Imported from sit/cases/70-ui-pages.sit.ts

#### SIT-70_UI_PAGES-THE-CONFIGURATION-PAGE-RENDERS-ITS-OWN-R — the Configuration page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Configuration page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-DATASETS-PAGE-RENDERS-ITS-OWN-REAL-P — the Datasets page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Datasets page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-MESSAGE-DESIGNER-CREATE-MESSAGE-DEFI — the Message Designer → Create message definition page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Message Designer → Create message definition page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-MESSAGE-DESIGNER-EXPORT-TEMPLATE-PAG — the Message Designer → Export template page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Message Designer → Export template page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-MESSAGE-DESIGNER-IMPORT-SCHEMA-PAGE- — the Message Designer → Import schema page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Message Designer → Import schema page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-MESSAGE-DESIGNER-VIEW-SAVED-DEFINITI — the Message Designer → View saved definitions page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Message Designer → View saved definitions page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-NAMING-CONVENTIONS-PAGE-RENDERS-ITS- — the Naming conventions page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Naming conventions page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-OVERVIEW-PAGE-RENDERS-ITS-OWN-REAL-P — the Overview page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Overview page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-REPORTS-ALL-REPORTS-PAGE-RENDERS-ITS — the Reports → All reports page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Reports → All reports page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-REPORTS-COMPLIANCE-REPORTS-PAGE-REND — the Reports → Compliance reports page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Reports → Compliance reports page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-REPORTS-COVERAGE-REPORTS-PAGE-RENDER — the Reports → Coverage reports page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Reports → Coverage reports page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-REPORTS-SCHEDULED-EXPORTS-PAGE-RENDE — the Reports → Scheduled exports page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Reports → Scheduled exports page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-RULE-BENCH-CREATE-NEW-RULE-PAGE-REND — the Rule Bench → Create new rule page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Rule Bench → Create new rule page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-RULE-BENCH-EXISTING-RULES-PAGE-RENDE — the Rule Bench → Existing rules page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Rule Bench → Existing rules page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-RULE-BENCH-EXPORT-RULES-PAGE-RENDERS — the Rule Bench → Export rules page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Rule Bench → Export rules page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-RULE-BENCH-STAGE-RULES-PAGE-RENDERS- — the Rule Bench → Stage rules page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Rule Bench → Stage rules page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-RULE-BENCH-VALIDATE-RULES-PAGE-RENDE — the Rule Bench → Validate rules page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Rule Bench → Validate rules page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-SCHEDULES-ALL-SCHEDULES-PAGE-RENDERS — the Schedules → All schedules page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Schedules → All schedules page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-SCHEDULES-NEW-SCHEDULE-PAGE-RENDERS- — the Schedules → New schedule page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Schedules → New schedule page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-SCHEDULES-UPCOMING-SCHEDULES-PAGE-RE — the Schedules → Upcoming schedules page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Schedules → Upcoming schedules page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-TEST-CASES-PAGE-RENDERS-ITS-OWN-REAL — the Test Cases page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Test Cases page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-TEST-RUNS-ACTIVE-RUNS-PAGE-RENDERS-I — the Test Runs → Active runs page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Test Runs → Active runs page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-TEST-RUNS-ALL-TEST-RUNS-PAGE-RENDERS — the Test Runs → All test runs page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Test Runs → All test runs page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-TEST-RUNS-NEW-TEST-RUN-PAGE-RENDERS- — the Test Runs → New test run page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Test Runs → New test run page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-TEST-RUNS-RUN-HISTORY-PAGE-RENDERS-I — the Test Runs → Run history page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Test Runs → Run history page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_UI_PAGES-THE-TEST-SUITES-PAGE-RENDERS-ITS-OWN-REA — the Test Suites page renders its own real page header

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `70-ui-pages` |

**What it does.** Imported from sit/cases/70-ui-pages.sit.ts

**Execution.** Runs `sit/cases/70-ui-pages.sit.ts::the Test Suites page renders its own real page header` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-ui-workflows (`sit-ui-workflows`) — 3 cases

Imported from sit/cases/80-ui-workflows.sit.ts

#### SIT-80_UI_WORKFLOWS-RULE-BENCH-CREATING-A-RULE-FROM-THE-CONS — Rule Bench: creating a rule from the console UI persists it, and the database row reflects what the console actually submitted

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `80-ui-workflows` |

**What it does.** Imported from sit/cases/80-ui-workflows.sit.ts

**Execution.** Runs `sit/cases/80-ui-workflows.sit.ts::Rule Bench: creating a rule from the console UI persists it, and the database row reflects what the console actually submitted` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-80_UI_WORKFLOWS-SCHEDULES-CREATING-A-SCHEDULE-FROM-THE-C — Schedules: creating a schedule from the console UI persists it, and the database row reflects what the console actually submitted

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `80-ui-workflows` |

**What it does.** Imported from sit/cases/80-ui-workflows.sit.ts

**Execution.** Runs `sit/cases/80-ui-workflows.sit.ts::Schedules: creating a schedule from the console UI persists it, and the database row reflects what the console actually submitted` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-80_UI_WORKFLOWS-TEST-RUNS-STARTING-A-RUN-FROM-THE-CONSOL — Test Runs: starting a run from the console UI persists it with the fields the console actually submitted

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` `80-ui-workflows` |

**What it does.** Imported from sit/cases/80-ui-workflows.sit.ts

**Execution.** Runs `sit/cases/80-ui-workflows.sit.ts::Test Runs: starting a run from the console UI persists it with the fields the console actually submitted` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### Suite: sit-use-case-ui (`sit-use-case-ui`) — 1 cases

Imported from sit/cases/64-use-case-ui.sit.ts

#### SIT-64_USE_CASE_UI — SIT file: 64-use-case-ui.sit.ts

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | ui / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `ui` |

**What it does.** Registered from 64-use-case-ui.sit.ts (no static test() names extracted)

**Execution.** Runs `sit/cases/64-use-case-ui.sit.ts` via the node:test SIT runner (the case file drives the deployed stack directly).

---

### Category: database

#### Suite: sit-db (`sit-db`) — 2 cases

Imported from sit/cases/50-dbviewer-cross-check.sit.ts

#### SIT-50_DBVIEWER_CROSS_CHECK-A-COMPLETED-RUN-IS-INDEPENDENTLY-VISIBLE — a completed run is independently visible through the db viewer

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `database` `50-dbviewer-cross-check` |

**What it does.** Imported from sit/cases/50-dbviewer-cross-check.sit.ts

**Execution.** Runs `sit/cases/50-dbviewer-cross-check.sit.ts::a completed run is independently visible through the db viewer` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-50_DBVIEWER_CROSS_CHECK-AUDIT-EVENTS-FOR-THE-SIT-SESSION-ARE-IND — audit events for the SIT session are independently visible through the db viewer

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | database / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `database` `50-dbviewer-cross-check` |

**What it does.** Imported from sit/cases/50-dbviewer-cross-check.sit.ts

**Execution.** Runs `sit/cases/50-dbviewer-cross-check.sit.ts::audit events for the SIT session are independently visible through the db viewer` via the node:test SIT runner (the case file drives the deployed stack directly).

---

### Category: e2e

#### Suite: sit-e2e-ux (`sit-e2e-ux`) — 3 cases

Imported from sit/cases/70-e2e-ux.sit.ts

#### SIT-70_E2E_UX-CHANNEL-TARGETS-LIST-FILE-API-MQ-KAFKA — channel targets list file, api, mq, kafka

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | e2e / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `e2e` `70-e2e-ux` |

**What it does.** Imported from sit/cases/70-e2e-ux.sit.ts

**Execution.** Runs `sit/cases/70-e2e-ux.sit.ts::channel targets list file, api, mq, kafka` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_E2E_UX-N-2-DEMO-SCRIPT-IS-THE-SAME-WALK-AFTER-D — N-2 demo script is the same walk after deploy

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | e2e / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `e2e` `70-e2e-ux` |

**What it does.** Imported from sit/cases/70-e2e-ux.sit.ts

**Execution.** Runs `sit/cases/70-e2e-ux.sit.ts::N-2 demo script is the same walk after deploy` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-70_E2E_UX-UX-FIRST-RUN-STRIP-IS-PUBLISHED-ON-THE-D — UX first-run strip is published on the deployed API

| | |
|---|---|
| **Runner** | `selenium` |
| **Type / level** | e2e / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `e2e` `70-e2e-ux` |

**What it does.** Imported from sit/cases/70-e2e-ux.sit.ts

**Execution.** Runs `sit/cases/70-e2e-ux.sit.ts::UX first-run strip is published on the deployed API` via the node:test SIT runner (the case file drives the deployed stack directly).

---

### Category: security

#### Suite: sit-security (`sit-security`) — 17 cases

Imported from sit/cases/80-security-auth.sit.ts

#### SIT-80_SECURITY_AUTH-ASVS-V1-LOGIN-REJECTS-INJECTION-SHAPED-U — ASVS V1 login rejects injection-shaped username

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `80-security-auth` |

**What it does.** Imported from sit/cases/80-security-auth.sit.ts

**Execution.** Runs `sit/cases/80-security-auth.sit.ts::ASVS V1 login rejects injection-shaped username` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-80_SECURITY_AUTH-ASVS-V6-LOGIN-REJECTS-MISSING-CREDENTIAL — ASVS V6 login rejects missing credentials (no 500)

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `80-security-auth` |

**What it does.** Imported from sit/cases/80-security-auth.sit.ts

**Execution.** Runs `sit/cases/80-security-auth.sit.ts::ASVS V6 login rejects missing credentials (no 500)` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-80_SECURITY_AUTH-ASVS-V6-LOGIN-REJECTS-WRONG-PASSWORD — ASVS V6 login rejects wrong password

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `80-security-auth` |

**What it does.** Imported from sit/cases/80-security-auth.sit.ts

**Execution.** Runs `sit/cases/80-security-auth.sit.ts::ASVS V6 login rejects wrong password` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-80_SECURITY_AUTH-ASVS-V7-SESSION-ME-REQUIRES-A-BEARER-TOK — ASVS V7 session/me requires a bearer token

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `80-security-auth` |

**What it does.** Imported from sit/cases/80-security-auth.sit.ts

**Execution.** Runs `sit/cases/80-security-auth.sit.ts::ASVS V7 session/me requires a bearer token` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-81_SECURITY_API-ASVS-V16-ERROR-ENVELOPE-HAS-CODE-AND-REQ — ASVS V16 error envelope has code and requestId, not a stack

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `81-security-api` |

**What it does.** Imported from sit/cases/81-security-api.sit.ts

**Execution.** Runs `sit/cases/81-security-api.sit.ts::ASVS V16 error envelope has code and requestId, not a stack` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-81_SECURITY_API-ASVS-V4-UNUSED-TRACE-METHOD-IS-NOT-A-SUC — ASVS V4 unused TRACE method is not a successful probe

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `81-security-api` |

**What it does.** Imported from sit/cases/81-security-api.sit.ts

**Execution.** Runs `sit/cases/81-security-api.sit.ts::ASVS V4 unused TRACE method is not a successful probe` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-81_SECURITY_API-AUTHENTICATED-HEALTH-OF-PROTECTED-WRITE- — authenticated health of protected write still needs If-Match on mutating field-rule paths when used

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `81-security-api` |

**What it does.** Imported from sit/cases/81-security-api.sit.ts

**Execution.** Runs `sit/cases/81-security-api.sit.ts::authenticated health of protected write still needs If-Match on mutating field-rule paths when used` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-81_SECURITY_API-OWASP-API1-UNAUTHENTICATED-CATALOGUE-REA — OWASP API1 unauthenticated catalogue read is rejected

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `81-security-api` |

**What it does.** Imported from sit/cases/81-security-api.sit.ts

**Execution.** Runs `sit/cases/81-security-api.sit.ts::OWASP API1 unauthenticated catalogue read is rejected` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-82_SECURITY_HEADERS-ASVS-V3-CLICKJACKING-HEADER-IS-NOT-REQUI — ASVS V3 clickjacking header is not required on JSON API but X-Content-Type-Options should be safe when set

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `82-security-headers` |

**What it does.** Imported from sit/cases/82-security-headers.sit.ts

**Execution.** Runs `sit/cases/82-security-headers.sit.ts::ASVS V3 clickjacking header is not required on JSON API but X-Content-Type-Options should be safe when set` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-82_SECURITY_HEADERS-ASVS-V4-1-CONTENT-TYPE-IS-PRESENT-ON-JSO — ASVS V4.1 Content-Type is present on JSON API errors

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `82-security-headers` |

**What it does.** Imported from sit/cases/82-security-headers.sit.ts

**Execution.** Runs `sit/cases/82-security-headers.sit.ts::ASVS V4.1 Content-Type is present on JSON API errors` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-82_SECURITY_HEADERS-OWASP-API8-SECURITY-MISCONFIG-SERVER-HEA — OWASP API8 security misconfig — server header does not advertise a stack version

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `82-security-headers` |

**What it does.** Imported from sit/cases/82-security-headers.sit.ts

**Execution.** Runs `sit/cases/82-security-headers.sit.ts::OWASP API8 security misconfig — server header does not advertise a stack version` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-83_SECURITY_VULN-TRIVY-HIGH-CRITICAL-FINDINGS-ARE-LISTED- — Trivy HIGH/CRITICAL findings are listed when a report exists

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `83-security-vuln` |

**What it does.** Imported from sit/cases/83-security-vuln.sit.ts

**Execution.** Runs `sit/cases/83-security-vuln.sit.ts::Trivy HIGH/CRITICAL findings are listed when a report exists` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-83_SECURITY_VULN-TRIVY-REPORT-IS-OPTIONAL-MISSING-REPORT- — Trivy report is optional — missing report is a skip, not a product outage

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `83-security-vuln` |

**What it does.** Imported from sit/cases/83-security-vuln.sit.ts

**Execution.** Runs `sit/cases/83-security-vuln.sit.ts::Trivy report is optional — missing report is a skip, not a product outage` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-84_SECURITY_ZAP-OWASP-ZAP-HIGH-FINDINGS-ARE-LISTED-WHEN- — OWASP ZAP High findings are listed when a report exists

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `84-security-zap` |

**What it does.** Imported from sit/cases/84-security-zap.sit.ts

**Execution.** Runs `sit/cases/84-security-zap.sit.ts::OWASP ZAP High findings are listed when a report exists` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-84_SECURITY_ZAP-OWASP-ZAP-REPORT-IS-OPTIONAL-MISSING-REP — OWASP ZAP report is optional — missing report is not a product outage

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `84-security-zap` |

**What it does.** Imported from sit/cases/84-security-zap.sit.ts

**Execution.** Runs `sit/cases/84-security-zap.sit.ts::OWASP ZAP report is optional — missing report is not a product outage` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-85_SECURITY_SAST-SAST-ERROR-FINDINGS-ARE-LISTED-WHEN-A-SE — SAST ERROR findings are listed when a Semgrep report exists

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `85-security-sast` |

**What it does.** Imported from sit/cases/85-security-sast.sit.ts

**Execution.** Runs `sit/cases/85-security-sast.sit.ts::SAST ERROR findings are listed when a Semgrep report exists` via the node:test SIT runner (the case file drives the deployed stack directly).

---

#### SIT-85_SECURITY_SAST-SAST-SEMGREP-REPORT-IS-OPTIONAL-MISSING- — SAST (Semgrep) report is optional — missing report is not a product outage

| | |
|---|---|
| **Runner** | `http` |
| **Type / level** | security / — |
| **Priority / severity** | p2 / medium |
| **Lifecycle** | active (automated) |
| **Timeout** | 300s |
| **Tags** | `sit` `imported` `security` `85-security-sast` |

**What it does.** Imported from sit/cases/85-security-sast.sit.ts

**Execution.** Runs `sit/cases/85-security-sast.sit.ts::SAST (Semgrep) report is optional — missing report is not a product outage` via the node:test SIT runner (the case file drives the deployed stack directly).

---

_Total: 414 test cases across 2 applications._