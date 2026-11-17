# GAVRIQ Test Engine

Enterprise Test Engineering & Validation platform — central repository, on-demand execution, build-status display, and release readiness for applications under test (including **Sand Bench**).

**Version:** 0.3.3

## What it does

| Capability | Description |
|------------|-------------|
| **Test Repository** | Application → Suite → Case hierarchy with versioning, tags, lifecycle |
| **Test bench screens** | Test cases, Test case form, Test suites and run Remarks in Sand Bench's representation — objective, plain-language steps (what is done / what should happen / data used), owner, component, environment, duration, triage, notes, watchers (`#/test-cases`, `#/test-suites`; rule: `.github/skills/plain-language-test-cases/SKILL.md`) |
| **Realistic catalog** | Every registered case is executable — verified endpoints/selectors, steps, data + data profile (`apps/api/src/catalog/`, docs in `docs/TEST-CASE-CATALOG.md`) |
| **Multi-application** | Application + environment selectors in the console; the engine itself is registered as application #2 with an API self-test suite |
| **On-demand runs** | Selenium, Playwright (chromium/firefox/webkit × viewports), HTTP/API with capture/poll/JSON-path assertions, and concurrent performance runners |
| **Run everything** | `POST /api/v1/executions/run-all` — one execution per suite for an application, grouped and deduped; ▶ button on the console Overview |
| **In-container status** | CI posts build results; engine displays them (does not re-run them) |
| **Workers** | Distributed claim/result protocol |
| **Schedules** | Interval (`every:N`) and event triggers (`after_build`, …) |
| **Infrastructure lifecycle** | Managed Docker stacks run only while tested: deployed on demand or when a run needs them, torn down after the run / when idle / when up too long; Docker housekeeping on a cadence (`docs/INFRA-LIFECYCLE.md`) |
| **Release readiness** | READY / READY WITH CONDITIONS / NOT READY |
| **Dashboard** | Dark UI at port **8787** |
| **SIT console** | Existing post-deploy runner UI at **8098** (preserved) |

## Quick start

### Docker (recommended)

```bash
cp .env.example .env   # optional endpoint overrides
docker compose up -d --build

# Dashboard + API
open http://localhost:8787/

# SIT console (same container/port)
open http://localhost:8787/sit/
```

`AUTO_SEED=true` on the API service seeds the Sand Bench smoke pack on first boot.

Optional workers (browser runners):

```bash
TARGET_BASE_URL=http://host.docker.internal:8001 docker compose --profile workers up -d
```

### Local Node

```bash
export DATABASE_URL=postgres://sitconsole:sitconsole@127.0.0.1:5432/sitconsole
npm install
npm run migrate
npm run seed              # realistic executable catalog (Sand Bench + engine self-tests); removes dummy cases
npm run import:sit        # register sit/cases/*.sit.ts into the repository
npm run docs:catalog      # regenerate docs/TEST-CASE-CATALOG.md from the live repository
npm run start:api         # :8787
npm run start:worker      # optional
npm run start:scheduler   # optional
npm run test:e2e          # with API running
```

## Key APIs

```
GET  /health
GET  /api/v1/meta          → version + capability map
GET  /                         → dashboard UI
GET  /api/v1/sit-catalog     → SIT packs + registered SIT-* cases
GET  /api/v1/test-cases
POST /api/v1/executions        → queue run
GET  /api/v1/dashboard
GET  /api/v1/release-readiness
GET  /api/v1/test-status       → engine + in-container combined
POST /api/v1/build-results     → CI posts in-container results
GET  /api/v1/agents/context
GET  /api/v1/ui/summary        → console boot: compact cases + last status, suites, build summary
GET  /api/v1/ui/live?since=    → console poll: runs with progress, workers, statuses changed since
POST /api/v1/ui/history        → per-run pass/fail history for a set of case ids (tile charts)
```

Docs: [ENTERPRISE-TEST-ENGINE](docs/ENTERPRISE-TEST-ENGINE.md) · [RUNNERS-AND-RBAC](docs/RUNNERS-AND-RBAC.md) · [DOCKER-AND-BUILD-STATUS](docs/DOCKER-AND-BUILD-STATUS.md) · [PRODUCTION](docs/PRODUCTION.md) · [RELEASE](docs/RELEASE.md)

## Architecture

```
Control plane (apps/api :8787)     Workers (apps/worker)
  Test Repository                   Selenium / Playwright
  Environments + safety policy      HTTP / performance
  Executions / schedules            Claim → run → report
  Build-status store
  Release readiness / agents
         │
         ▼
   PostgreSQL
```

## Production notes

```bash
export RBAC_ENABLED=true
export WORKER_API_KEY="$(openssl rand -hex 32)"
export JWT_SECRET="$(openssl rand -hex 32)"
npm run mint-token -- test_admin ops-user
```

See [docs/PRODUCTION.md](docs/PRODUCTION.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

Copyright (c) 2026 Gavriq Labs Global. All rights reserved. Proprietary; see [LICENSE](LICENSE).
