# Quality Insights

A versioned review of one application's test quality: pass rates, coverage, failure causes, test depth, cadence and the build under test, with every environment the application runs on reviewed on its own. Console: **Quality insights** in the left menu (`#/insights`). The review follows the application selected at the top; the environment selector does not filter it.

## What a version is

| Part | Written by | Contents |
|---|---|---|
| `snapshot` | the engine (`apps/api/src/insights/snapshot.ts`) | The facts, computed from the catalogue and the runs inside the window (default 30 days, bounded by run retention). Every number on the screen comes from here. |
| `analysis` | an analyst | The review: headline, verdict, findings, failure themes, one assessment per environment, test-quality and coverage assessments, prioritised suggestions. Shape: `AnalysisSchema` in `apps/api/src/insights/analysis.ts`. |

Versions are stored in `quality_insights` (one row per version, numbered per application) and are never rewritten. Because the snapshot is stored with the review, a version stays readable after run retention has deleted the runs it describes.

## Who writes the review

1. **Claude** — when `ANTHROPIC_API_KEY` is set on the API, **Refresh insights** sends the snapshot and the previous review to the Claude API and stores the structured answer (`INSIGHTS_MODEL`, default `claude-opus-5`; `INSIGHTS_EFFORT`, default `high`). Test-case names, environment names and failure messages leave the engine in that request.
2. **An external agent** — reads `GET /api/v1/insights/snapshot`, writes a review and posts it (see below). Stored as a ready version under the agent's name.
3. **Built-in rules** — when no key is configured, or the AI call fails. Threshold-driven, deterministic, and labelled as such with a notice on the version.

## API

| Call | Purpose |
|---|---|
| `GET /api/v1/insights?application_key=` | Versions of an application, newest first, without bodies. Also reports whether AI is configured. |
| `GET /api/v1/insights/:id` | One version: snapshot, analysis, and the previous version's headline numbers for deltas. |
| `GET /api/v1/insights/snapshot?application_key=&window_days=` | The facts as of now. Nothing is stored. |
| `POST /api/v1/insights` `{application_key, window_days?}` | New version. Answers `202` with the version in `generating`; the review is written in the background. `409` while another refresh for the application is running. |
| `POST /api/v1/insights` `{application_key, analysis, analyst}` | New version with a supplied review. `201`, or `400` listing where the review does not match the shape. |

Under RBAC, reads need `tests:read` and `POST` needs `executions:run`.

## What the snapshot measures

- **Per environment**: runs and results in the window, pass rate (passed ÷ passed + failed), share of the catalogue executed, latest result of every case, flaky / regressed / never-passed counts, failure classifications, the builds tested, what started the runs.
- **Reference environment**: the most production-like live environment with results (staging before docker before localhost). Headline numbers and the score are read from it. Retired environments are shown but left out of the totals.
- **Case histories**, per environment: *flaky* = switched between pass and fail at least twice; *regressed* = passed, now failing; *never passed* = two or more runs, no pass; *differ by environment* = passing on one live environment, failing on another.
- **Failure signatures**: non-passing messages grouped after stripping ids and numbers.
- **Test depth**: checks a case states in its definition (expected status, JSON paths, body text, `assert_*` and `wait_for` steps, SLA thresholds). Cases whose assertions live in code (SIT scripts, compound runner actions) are counted separately, not as zero.
- **Score**: reliability 30, coverage 25, stability 15, cadence 10, traceability 10, test depth 10 — each 0–100 with its basis shown on the screen.
- Days are bucketed in `SCHEDULER_TZ`.

## Build under test

When a worker claims an execution, the engine copies the environment's registered deployment (`environments.config.deployment`: `commit`, `ref`, `version`, `deployed_at`) into `executions.metadata.build`. A caller that knows better — a deploy pipeline — can pass `metadata.build` when it triggers the run, and that value is kept. `deploy/staging/deploy.mjs` registers the deployment for `sand-bench-staging`; an environment that registers nothing produces results with no build hash, and the review says so.
