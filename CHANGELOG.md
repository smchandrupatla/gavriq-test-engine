# Changelog

## [0.2.4] — 2026-09-17

**Added**
- Unified dashboard shell on `:8787` with a left-hand menu: Overview, Test catalog, SIT test cases, Test cases, Schedules, Test runs, Test kit log, Workers & builds
- SIT cases stay labelled as SIT; repository (seeded) cases stay on Test cases
- `GET /api/v1/sit-catalog` — pack inventory from `sit/cases` plus registered `SIT-*` rows
- Test cards use the existing GAVRIQ surface / accent tokens (no separate SIT palette)

**Fixed**
- Dashboard static root now resolves from `apps/api/src` to `apps/api/public`
- RBAC GET allow-list includes `/api/v1/sit-catalog` and `/api/v1/schedules`

## [0.2.3] — 2026-09-16

**Added**
- Evidence file API + dashboard screenshot viewer; shared Docker evidence volume
- `scripts/post-build-results.sh` + `docs/CI-BUILD-RESULTS.md` + example GH workflow
- SIT case execution via worker (`apps/worker/src/runners/sit.ts`) for imported catalog entries
- `scripts/validate-target.sh` for TARGET_BASE_URL / Sand Bench reachability

## [0.2.2] — 2026-09-16

**Added**
- `Dockerfile.worker` — Chromium + ChromeDriver for on-demand Selenium in Docker
- Compose worker profile uses Chrome image, `shm_size`, `host.docker.internal`
- Selenium failure screenshots stored under `EVIDENCE_DIR` and linked as evidence
- `CAPTURE_SCREENSHOTS=always` for pass-path screenshots
- `docs/SELENIUM-WORKER.md`

## [0.2.1] — 2026-09-15

**Added**
- JWT Bearer auth (jose HS256) when `JWT_SECRET` is set; `npm run mint-token`
- Dashboard: last-result column, execution detail panel, SIT Console link
- E2E API flow test (`npm run test:e2e`)
- CI runs E2E after API health
- `docs/RELEASE.md`, production worker key + audit on execution queue
- `/api/v1/meta`, `scripts/up.sh`

## [0.2.0] — 2026-09-15

Enterprise Test Engine foundation (Prompts 1–10). See prior notes in git history.

## [0.1.0] — prior

- SIT console extraction, use-case documentation, Docker packaging
