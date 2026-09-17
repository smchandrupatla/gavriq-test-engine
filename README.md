# GAVRIQ Test Engine

Enterprise Test Engineering & Validation platform — central repository, on-demand execution, build-status display, and release readiness for applications under test (including **Sand Bench**).

**Version:** 0.2.1

## What it does

| Capability | Description |
|------------|-------------|
| **Test Repository** | Application → Suite → Case hierarchy with versioning, tags, lifecycle |
| **On-demand runs** | Selenium, Playwright, HTTP/API, and concurrent performance runners |
| **In-container status** | CI posts build results; engine displays them (does not re-run them) |
| **Workers** | Distributed claim/result protocol |
| **Schedules** | Interval (`every:N`) and event triggers (`after_build`, …) |
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

# Legacy SIT console
open http://localhost:8098/
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
npm run seed              # Sand Bench main-flow Selenium + health cases
npm run import:sit        # register sit/cases/*.sit.ts into the repository
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
GET  /api/v1/test-cases
POST /api/v1/executions        → queue run
GET  /api/v1/dashboard
GET  /api/v1/release-readiness
GET  /api/v1/test-status       → engine + in-container combined
POST /api/v1/build-results     → CI posts in-container results
GET  /api/v1/agents/context
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
