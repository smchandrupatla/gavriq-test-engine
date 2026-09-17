# Changelog

## [0.3.1] — 2026-09-17

**Fixed**
- Queueing an execution failed in CI: `execution_location` text was not cast to the enum
- Worker now rolls up all-blocked runs as `blocked` instead of `failed`

**Added**
- `GET /api/v1/preflight` and `GET /api/v1/intelligence/flakes`
- Release readiness excludes blocked/environment results and checks posted build status
- `:8098` compatibility banner (`SIT_CONSOLE_REDIRECT=true` 302s to :8787)
- Dashboard `blocked` badge

## [0.3.0] — 2026-09-17

**Fixed**
- `migrate` resolved schema one directory above the repo root, so GitHub Actions failed instantly
- CI no longer pins `meta.version` to `0.2.1`
- Target / connection failures are `blocked` + `target_unreachable`, not product `failed`

**Added**
- Postgres wait in migrate and CI
- JUnit / Jest converter `scripts/parse-junit.mjs`
- Nightly / manual Chrome-worker workflow
- MQ / Kafka / DB adapter stubs that fail closed as blocked
- JWT required for RBAC unless `RBAC_ALLOW_DEV_HEADERS=true`

**Changed**
- Example `post-build-results` workflow moved to `docs/examples/`

## [0.2.3] — 2026-09-16

**Added**
- Evidence file API + dashboard screenshot viewer; shared Docker evidence volume
- `scripts/post-build-results.sh` + `docs/CI-BUILD-RESULTS.md`
- SIT case execution via worker for imported catalog entries
- `scripts/validate-target.sh` for TARGET_BASE_URL / Sand Bench reachability

## [0.2.2] — 2026-09-16

**Added**
- Chrome-enabled worker image and Selenium evidence screenshots

## [0.2.1] — 2026-09-15

**Added**
- JWT Bearer auth, E2E API flow test, `/api/v1/meta`

## [0.2.0] — 2026-09-15

Enterprise Test Engine foundation (Prompts 1–10).

## [0.1.0] — prior

- SIT console extraction, use-case documentation, Docker packaging
