# Changelog

## [Unreleased]

**Changed**
- Consolidated Test Engine (`test-engine-api`) and SIT console (`sit-console`) into a
  single `test-engine` deployable — one image, one container, one port (8787). Both keep
  running as independent Node processes, supervised and reverse-proxied by
  `scripts/consolidated-entrypoint.mjs` (`/sit/*` → SIT console, everything else → API),
  so a crash in one doesn't take the other down. SIT console is now reached at `/sit/`
  instead of its own port; `TEST_ENGINE_API_HOST_PORT` renamed to `TEST_ENGINE_HOST_PORT`.

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
