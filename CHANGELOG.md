# Changelog

## [0.3.0] — 2026-09-17

**Fixed**
- `migrate` resolved schema one directory above the repo root, so GitHub Actions failed instantly
- CI no longer pins `meta.version` to `0.2.1`
- Target / connection failures are `blocked` + `target_unreachable`, not product `failed`

**Added**
- Postgres wait in migrate and CI
- `GET /api/v1/preflight` and readiness that excludes blocked results and checks posted build status
- `GET /api/v1/intelligence/flakes`
- JUnit / Jest converter `scripts/parse-junit.mjs`
- Nightly / manual Chrome-worker workflow
- MQ / Kafka / DB adapter stubs that fail closed as blocked
- `:8098` compatibility banner (optional `SIT_CONSOLE_REDIRECT=true`)
- JWT required for RBAC unless `RBAC_ALLOW_DEV_HEADERS=true`

**Changed**
- Example `post-build-results` workflow moved to `docs/examples/`

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
