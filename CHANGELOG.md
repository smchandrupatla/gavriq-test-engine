# Changelog

## [0.2.1] — 2026-09-15

**Added**
- JWT Bearer auth (jose HS256) when `JWT_SECRET` is set; `npm run mint-token`
- Dashboard: last-result column, execution detail panel, SIT Console link
- E2E API flow test (`npm run test:e2e`) — queue → claim → result → complete + build-results
- CI runs E2E after API health
- `docs/RELEASE.md`, production worker key + audit on execution queue

## [0.2.0] — 2026-09-15

### Enterprise Test Engine foundation (Prompts 1–10)

**Added**
- PostgreSQL Test Repository: Application → Suite → Case → Step → Assertion hierarchy
- Fastify control plane on `:8787` with full CRUD APIs
- Distributed workers with Selenium, Playwright, HTTP, and performance runners
- Environment registry with safety policy enforcement
- Execution lifecycle: queue → claim → results → complete
- Schedules (interval + event triggers: `after_build`, `after_deploy`, …)
- AI proposal drafts with accept/reject review
- Dashboard UI at `/` (dark theme)
- In-container / build result reporting and combined status view
- Release readiness scorecard (READY / READY WITH CONDITIONS / NOT READY)
- Agent context API
- RBAC middleware (optional via `RBAC_ENABLED=true`)
- Docker Compose services: `test-engine-api`, `test-engine-worker`
- `AUTO_SEED` for Sand Bench smoke pack on first boot
- SIT catalog import (`npm run import:sit`)

**Preserved**
- Existing SIT console on `:8098` unchanged

### Run

```bash
docker compose up -d --build
# Dashboard: http://localhost:8787/
# SIT console: http://localhost:8098/
```

## [0.1.0] — prior

- SIT console extraction, use-case documentation, Docker packaging
