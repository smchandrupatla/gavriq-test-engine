# Changelog

## [Unreleased] — 2026-09-26

**Added**
- Test run detail (`#/run/:id`): status, pass/fail/blocked counts, suite and environment, duration per case chart, and every result with its evidence.
- Test case detail (`#/case/:id`): details, the script behind the case (`GET /api/v1/test-cases/:id/definition`), and run history with evidence (`GET /api/v1/test-cases/:id/results`).
- Evidence on every run: SIT runs keep the full TAP output plus the screenshots the case writes; Selenium and Playwright save a screenshot of every step or final screen and a step log; HTTP saves the request/response transcript; performance saves raw samples.
- Performance and endurance graphs: the runner records a per-second (or per-5s for long runs) series of latency p50/p95, throughput and errors. `validation_rules.duration_seconds` runs a time-bound endurance test.
- Test suites (`#/suites`): create a suite from cases of any category, edit its name, add and remove cases, copy a built-in suite, delete, run it, and see every run linked to the suite with a pass-rate chart. API: `GET/PATCH/DELETE /api/v1/suites/:id`, `PUT /api/v1/suites/:id/cases`, `DELETE /api/v1/suites/:id/cases/:caseId`, `GET /api/v1/suites/:id/executions`.
- Catalog audit (`#/audit`, `GET /api/v1/catalog-audit`): lists cases with no script behind them and SIT imports whose file or test is gone.

**Fixed**
- Cases with no script, steps or load profile ran as "load the base URL" and reported a pass. They now report `blocked` with the reason. The 102 seeded Sand Bench catalog cases are such placeholders.
- The seed stored design mock-up values (`status:Passed`, `tone:teal`, "Duration ref … last tested Today") and marked those cases automated. The seed and a startup cleanup now store them as drafts to be automated.
- The worker resolved `sit/cases` under `apps/` and its image did not contain `sit/`, so every SIT case run from the engine failed with "SIT file not found".
- Playwright results pointed at a log file that was never written.
- The console's HTML escape helper did not escape anything; names, messages and logs are now escaped.

## [0.3.3] — 2026-09-18

**Added**
- Unified left-nav dashboard on :8787 (overview, catalog, SIT cases, repository cases, schedules, runs, kit log, workers)
- `POST /api/v1/sit-runs` hands selected SIT cases to `sit/lib/runner` through the SIT console `/api/run`; falls back to queued `SIT-*` engine executions if the console is down
- Live Test kit log: `GET /api/v1/kit-log/stream` (SSE) and `GET /api/v1/kit-log`
- Schedule create / enable / run-now form on the unified dashboard
- Legacy `:8098` portal restyled to GAVRIQ engine tokens, with a link to `:8787#sit`

## [0.3.2] — 2026-09-17

**Fixed**
- Lookups of the form `id = $1 OR key = $1` made Postgres infer `$1` as uuid, so `key` (text) comparison raised `operator does not exist: text = uuid`. Cast `id::text` so E2E can POST results and complete an execution.

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
