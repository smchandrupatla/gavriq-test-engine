# Prompt Implementation Status

**Branch:** `main` · **Version:** 0.3.3 · **HEAD:** `8e83b1e` (plus this chart refresh)

All P0–P3 work from the test-findings list is on `main`. No open PRs. Leftover `feature/*` branches are already-merged history and must not be re-merged.

## Check-in map (code on main)

| Wave | Item | Status on main | Evidence |
| --- | --- | --- | --- |
| P0 | CI migrate finds `schema.sql` | **IN** | `apps/api/src/db/client.ts` four-level root + `waitForDatabase` (`8e83b1e`) |
| P0 | CI does not pin `meta.version` | **IN** | `.github/workflows/ci.yml` |
| P0 | Target/connection failures = `blocked` + `target_unreachable` | **IN** | `apps/api/src/classify.ts`, `tests/classify.test.ts` |
| P0 | Worker rolls up all-blocked as `blocked` | **IN** | `apps/worker/src/worker.ts` |
| P0 | Example `post-build-results` relocated | **IN** | `docs/examples/` |
| P0 | Nested zip copy removed | **IN** | not present on `main` tree |
| P0 | `id::text` on id-or-key lookups | **IN** | 0.3.2 (`cd83767`, `9482949`, `62e7755`) |
| P0 | Queue `execution_location` enum cast | **IN** | 0.3.1 (`fdc9183`, `bf433be`) |
| P1 | Preflight + flake APIs | **IN** | `GET /api/v1/preflight`, `GET /api/v1/intelligence/flakes` |
| P1 | Nightly Chrome-worker workflow | **IN** | `.github/workflows/nightly-browsers.yml` |
| P1 | MQ / Kafka / DB adapter stubs (fail-closed blocked) | **IN** | `apps/worker/src/runners/adapters.ts` |
| P1 | JUnit / Jest converter | **IN** | `scripts/parse-junit.mjs` |
| P2 | JWT required for RBAC unless `RBAC_ALLOW_DEV_HEADERS` | **IN** | `apps/api/src/middleware/rbac.ts` |
| P2 | `:8098` compatibility banner / redirect | **IN** | SIT console + `SIT_CONSOLE_REDIRECT` |
| P2 | Dashboard `blocked` badge | **IN** | unified dashboard pages |
| P3 | Release readiness excludes blocked + checks build status | **IN** | intelligence / readiness routes |
| Unify | Left-nav dashboard on :8787 | **IN** | `apps/api/public/{index.html,console-ui.js,console-pages.js,console.js}` |
| Unify | SIT catalog + sit-runs proxy + kit-log SSE | **IN** | `sit-catalog.ts`, `sit-runs.ts`, `kit-log.ts`, `ops.ts` |
| Unify | `SIT_CONSOLE_BASE` compose wiring | **IN** | `compose.yaml` |

## Prompts 1–10

### Prompt 1 — Foundation, Test Repository & Data Model
**DONE**
- PostgreSQL schema, hierarchy, versioning, audit
- Applications, cases, suites, plans CRUD

### Prompt 2 — Test Authoring, Scripting & AI Generation
**DONE (API)**
- Create/update/clone + version snapshots
- AI proposals (draft → accept/reject)
- Steps / script / assertions on cases

### Prompt 3 — Environments, Containers & Distributed Workers
**DONE**
- Environment registry + safety_policy
- Worker register / heartbeat / claim / complete
- Chrome-enabled `Dockerfile.worker` for Selenium

### Prompt 4 — Functional, API, Database & Messaging
**PARTIAL → stubs on main**
- Types + HTTP runner solid
- MQ / Kafka / DB adapter stubs fail closed as `blocked` (not live brokers)
- SIT still covers many product paths via `sit/cases`

### Prompt 5 — Performance Engineering
**PARTIAL**
- Concurrent HTTP performance runner + metrics jsonb
- No k6 binary integration yet

### Prompt 6 — Deployment, Upgrade, Resilience
**FOUNDATION**
- Safety categories + policy enforcement
- Pack content still thin

### Prompt 7 — Execution Console, Scheduling & CI/CD
**DONE (API) + unified dashboard**
- Queue / cancel / claim / complete
- Schedules table + scheduler process + dashboard create / enable / run-now
- Build-results ingest + `scripts/post-build-results.sh`
- `POST /api/v1/sit-runs` proxies SIT console `/api/run`, falls back to queued `SIT-*` executions

### Prompt 8 — Search, Dashboards, Reporting
**DONE + unified console (0.3.3)**
- Search, dashboard KPIs, summary reports
- Left-nav shell: overview, catalog, SIT cases, repository cases, schedules, runs, kit log, workers
- Last-result column, execution detail, evidence, `blocked` badge
- Live kit log SSE `GET /api/v1/kit-log/stream`

### Prompt 9 — Failure Intelligence, Evidence, Governance
**DONE (core)**
- Classification, evidence table, screenshots on Selenium fail
- Evidence file serve API + dashboard thumbnails
- Audit events, JWT-required RBAC (`RBAC_ALLOW_DEV_HEADERS=true` for local)
- `blocked` vs `failed` + `target_unreachable`

### Prompt 10 — Test Intelligence, Agents & Release Readiness
**DONE (core)**
- Gaps, agent context, test packs table
- Preflight + flake APIs
- Release readiness excludes blocked/environment results and checks posted build status

## Remaining (not claimed as done)

- Live Sand Bench E2E against a real target URL (126 SIT cases stay blocked when target is unreachable — by design)
- k6 binary + live MQ/Kafka/DB adapters (stubs only)
- Richer authoring UI and defect workflow UI
- OIDC and object-store evidence (S3 client is a dependency; path not productized)
- CI Start-API step on `8e83b1e` (run 47) failed after migrate/seed/unit passed; last full green smoke was run 45 on `3bc071e`

## Validate

```bash
./scripts/up.sh
WITH_WORKERS=1 ./scripts/up.sh
curl -s localhost:8787/api/v1/meta | jq .
curl -s localhost:8787/api/v1/preflight | jq .
npm run test:unit
npm run test:e2e
```
