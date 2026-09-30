# Changelog

## [Unreleased]

**Fixed — cases that failed instantly or "never ran" (137 of 414)**
- Worker image had no `sit/` folder, so all 92 imported SIT cases failed in milliseconds with `SIT file not found`. `Dockerfile.worker` now ships `sit/`, `dev/`, `docs/use-cases` and the report helpers the security cases import (`apps/secportal/*`)
- Worker image had no Firefox or WebKit, so 12 cells of the browser matrix failed with `Executable doesn't exist`. The image installs both for the pinned Playwright version; worker `shm_size` raised to 1gb; Firefox/WebKit cases get a 120s step budget
- A containerized worker claiming a job for an environment written as `127.0.0.1`/`localhost` (`local-dev`, `sand-bench-local`, `engine-local`) targeted itself: every HTTP case failed with `fetch failed` and every performance case with a 100% error rate. The worker re-points loopback targets at the host gateway (`WORKER_LOOPBACK_HOST`, `WORKER_IN_CONTAINER`), so any environment picked in the console runs on whichever worker is online
- `execution_method: endurance` fell through to the Selenium runner and "passed" without sending a request. Endurance/soak cases run in the performance runner for `validation_rules.duration_seconds`
- SIT runner: environment variables (`{{api}}`, `{{testhub}}`, `{{dbviewer}}`, tenant, user) are mapped onto the `SIT_*` contract instead of only the web base URL; parameterised test names (`${page.path}`) match every generated instance; a name that matches no test is a failure, not a pass; every test skipped is `skipped`, not `passed`; failures carry the assertion message; a timeout kills the browsers the case started; a ChromeDriver is started for the raw-WebDriver screen cases, which used to skip themselves
- Performance runner: a run in which nothing answered reports why (`network_failure` / `environment_problem` with the first error) instead of `SLA violated: error_rate 100%`
- Executions left `running` by a worker that died are closed as `error` with `metadata.abandoned` after three silent minutes (five had been "running" for up to six days)
- SIT suite brought level with `sand-bench-enterprise/sit` and the console as deployed: sign-in through the gate, navigation groups and `/v/<id>` screens, forms addressed by control name, DB-viewer reads of the newest page, TRACE probe sent with `node:http`

**Added — evidence gate and run trigger API**
- Evidence is the exit criterion of a run. Every runner now leaves evidence on pass and on fail: HTTP request/response transcripts, a final-page screenshot plus step log for Playwright and Selenium, a metric report for performance/endurance, the TAP output for SIT files. Secrets are masked before a file is written
- Workers upload evidence to the engine (`POST /api/v1/evidence/upload`, stored per execution with a SHA-256) instead of relying on a shared folder, so a worker on another machine produces evidence the console can serve
- Evidence gate (`EVIDENCE_GATE=enforce|report|off`, default `report`): the API verifies evidence against the store, records a pass/fail without it as `error` / `inconclusive`, derives the final execution status from the recorded results, and writes `metadata.exit_criteria`
- Run trigger API: `POST /api/v1/runs {application, environment, scope?, exclusive?, dry_run?}`, `GET /api/v1/runs/:runId` (state, verdict, exit criteria), `GET /api/v1/runs/:runId/evidence` (manifest), `GET /api/v1/runs`. Honors the environment safety policy per case
- `scripts/trigger-run.mjs` starts a run and waits for the verdict; its exit code gates a pipeline
- `X-Api-Key` callers (`TRIGGER_API_KEYS`) for machine-to-machine triggers
- Schedules run an application on an environment through the same planner (`application` + `environment` + optional `scope`), on real five-field cron expressions evaluated in `SCHEDULER_TZ` (`@hourly`/`@daily`/`@weekly` and `every:N` still accepted); `GET /api/v1/schedules` reports `next_run_at`; `DELETE /api/v1/schedules/:id`; a new cron schedule waits for its next firing instead of firing on creation. The poller (`npm run start:scheduler`) fires through the API and catches up a missed firing once
- See `docs/RUN-TRIGGER-AND-EVIDENCE.md`

**Fixed**
- `POST /api/v1/environments` failed with `env_type is of type environment_type but expression is of type text` whenever `env_type` was supplied
- `POST /api/v1/test-cases` failed the same way for `test_type`, `severity`, `priority`, `automation_status`, `lifecycle` and `tags`, so no case could be created through the API

**Added**
- Console status tiles: one tile per SIT area, QA/QC type, baseline and in-container build on Overview, and one per suite on every sub-menu page. Red = a case failed, green = everything that ran passed, amber = only skipped/blocked, dashed grey = never run; a pulsing chip marks tiles with cases in an active run
- Per-tile history panel (loaded on click): results-per-run stacked chart, pass-rate trend, last/average pass rate, most frequent failures, and a run table; "Open details" goes to that tile's page
- Live run board on Overview and Test runs, and a run screen (`#/run/:id`) with per-case passed / failed / running / pending state, elapsed time, lazy-loaded evidence, cancel and run-again. Runs with no new result for 15 minutes are flagged as stalled instead of spinning forever
- Lean console endpoints: `GET /api/v1/ui/summary`, `GET /api/v1/ui/live?since=`, `GET /api/v1/ui/executions/:id`, `POST /api/v1/ui/history`, `GET /api/v1/ui/build-history` (all `tests:read` under RBAC)

**Changed**
- Console boots from one summary call plus one live poll instead of ~12 full-row calls (all case pages, suites, membership, test-status twice); case bodies, run results, evidence and history load on demand. Polls every 3s while a run is active, 15s when idle, 60s in a background tab
- JSON, JS and HTML responses over 1 KB are gzipped; console assets are served with an ETag so reloads get a 304
- Indexes on `execution_results(test_case_id, created_at)`, `execution_results(created_at)` and `executions(created_at)`
- Worker pill and "no live worker" banner count only workers with a recent heartbeat

**Fixed**
- Console `esc()` mapped `&<>"'` to themselves, so case names were inserted into the page unescaped
- Restored two fixes lost in merge `427a122`: queueing an execution failed with `execution_location ... is of type text` (0.3.1), and `POST /api/v1/executions/:id/complete` failed with `text = uuid`, so workers could never finish a run (0.3.2)

**Added — realistic catalog, generic console, run-everything**
- Realistic executable catalog (`apps/api/src/catalog/`): 102 Sand Bench cases across 18 QA/QC suites (smoke, field-fidelity units, channel round trips, screens, use-case contracts, regression, data quality via db-viewer, Selenium baseline, performance/endurance SLAs, upgrade compatibility, robustness, exposure scanning, negative-auth pen tests, cross-browser/viewport matrix, chaos, compliance, DR) — every case has verified endpoints/selectors, executable steps, preconditions, data used and a data profile. `npm run seed` (seed-realistic-catalog) upserts them and **deletes** the old display-only dummy cases, the legacy TC-SB login flows and the my-app/test-app placeholders; the dummy seeders and `data/sandbench-catalog*.json` are removed
- The engine registers itself as application #2 (`gavriq-test-engine`) with a runnable API self-test suite — the multi-application proof
- Application selector in the console top bar (persisted, next to the environment selector); every view, tile, KPI, build panel and poll is scoped to the selected application; SIT sections appear only for applications that have SIT cases
- **Run everything**: `POST /api/v1/executions/run-all {application_key, environment_id, dry_run?}` queues one execution per non-empty suite (cases deduped across suites) under a shared `metadata.run_group`; ▶ button on the Overview header
- HTTP runner: absolute/`{{var}}`-templated URLs from `environments.config.vars` (`{{web}} {{api}} {{testhub}} {{dbviewer}} {{engine}}` …), per-run `{{ts}}/{{rand}}` correlation ids, variable capture between steps (`save`), JSON-path assertions (`expect_json` equals/contains/exists/min/min_length), header assertions, raw bodies for malformed-payload tests, and poll-until steps for async round trips; secrets resolve from worker env via `config.secret_env`, never from the DB
- Playwright runner: browser engine choice (chromium/firefox/webkit), explicit viewports, `wait_for`/`wait_for_hidden`/`assert_selector_text`/`assert_no_horizontal_overflow` steps, screenshot-on-failure evidence; Selenium runner: window size + the same step vocabulary; performance runner: templated absolute targets
- `GET /api/v1/ui/summary` now actually filters cases and suites by `application_key`; `/api/v1/workers` derives `offline` for stale heartbeats (dead registrations no longer show online forever)
- `npm run docs:catalog` generates `docs/TEST-CASE-CATALOG.md` from the live repository (per category: description, steps, data used, data profile, expected result for every case); `dev/scripts/run-catalog-local.ts` executes catalog definitions directly through the runners for authoring

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
