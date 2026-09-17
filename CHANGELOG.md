# Changelog

## [0.3.3] — 2026-09-18

**Added**
- `POST /api/v1/sit-runs` hands selected SIT cases to `sit/lib/runner` through the SIT console `/api/run`; falls back to queued `SIT-*` engine executions if the console is down
- Live Test kit log: `GET /api/v1/kit-log/stream` (SSE) and `GET /api/v1/kit-log`
- Schedule create / enable / run-now form on the unified dashboard
- Legacy `:8098` portal restyled to GAVRIQ engine tokens, with a link to `:8787#sit`

## [0.3.2] — 2026-09-17

**Fixed**
- Lookups of the form `id = $1 OR key = $1` made Postgres infer `$1` as uuid. Cast `id::text` so E2E can POST results.

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

Enterprise Test Engine follow-up. See git history for 0.2.x.
