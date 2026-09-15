# GAVRIQ Enterprise Test Engine

Implementation of the 10-prompt Enterprise Test Engineering & Validation Engine on top of the existing SIT console extraction.

## Architecture

```
Control Plane (apps/api)          Workers (apps/worker)
─────────────────────────         ─────────────────────
Fastify API :8787                 Register → Heartbeat
  ├─ Applications                 Claim job → Execute
  ├─ Test Repository              Report results + evidence
  ├─ Environments + Safety
  ├─ Executions / Orchestrator
  ├─ Analytics / Reports
  ├─ AI Proposals
  ├─ Failure Intelligence
  ├─ Release Readiness
  └─ Agent APIs
         │
         ▼
   PostgreSQL (schema.sql)
```

## Prompt coverage

| Prompt | Capability | Status |
|--------|------------|--------|
| 1 | Foundation, hierarchy, repository, versioning, audit fields | **Implemented** — `schema.sql` + CRUD APIs |
| 2 | Authoring, clone, versioning, AI proposals (draft) | **Implemented** — generate + review endpoints |
| 3 | Environments, safety policy, workers, claim/result protocol | **Implemented** |
| 4 | Functional/API/DB/messaging types in schema + execution_method | **Foundation** — pluggable via `execution_method` |
| 5 | Performance metrics fields on results | **Foundation** — `metrics` jsonb + SLA-ready |
| 6 | Deployment/resilience categories in safety policy | **Foundation** |
| 7 | Execution console APIs, cancel, claim, complete, triggers | **Implemented** |
| 8 | Search, dashboard, Test Summary Report | **Implemented** |
| 9 | Failure classification, evidence, audit log | **Implemented** |
| 10 | Gaps analysis, release readiness, agent context, AI packs | **Implemented** |

## Quick start

```bash
# Ensure Postgres is available (compose brings up sit-console-db)
export DATABASE_URL=postgres://sitconsole:sitconsole@127.0.0.1:5432/sitconsole

# Migrate
npm run migrate

# API control plane
npm run start:api

# Worker (separate terminal)
npm run start:worker
```

## Key APIs

- `GET/POST /api/v1/applications`
- `GET/POST/PUT /api/v1/test-cases` (+ clone, generate, versions)
- `GET/POST /api/v1/environments` (+ policy check)
- `POST /api/v1/executions` → claim → results → complete
- `GET /api/v1/dashboard`
- `GET /api/v1/reports/summary/:executionId`
- `GET /api/v1/release-readiness`
- `GET /api/v1/intelligence/gaps`
- `GET /api/v1/agents/context`
- `POST /api/v1/ai-proposals/:id/review`

## Safety

Environment `safety_policy` maps categories to `allowed` | `approval_required` | `prohibited`.
Execution requests that specify a prohibited category are rejected with 403.

## Next increments

- Wire real Selenium/Playwright runners inside the worker (reuse existing sit/cases)
- Full low-code editor UI
- k6/JMeter performance adapter
- Kafka/MQ assertion adapters
- Production RBAC middleware on every route
