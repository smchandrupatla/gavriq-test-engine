# Triggering runs and the evidence gate

Two rules govern every run:

1. A run is started for **one application on one environment**, by anything that can make an HTTP call.
2. A result counts only when its **evidence** is stored on the engine. No evidence, no verdict.

## Trigger a run

```http
POST /api/v1/runs
Content-Type: application/json
X-Api-Key: <key>            # only when RBAC is enabled

{
  "application": "sand-bench",
  "environment": "sand-bench-container",
  "scope": { "suites": ["sb-smoke"], "tags": ["smoke"], "test_types": ["api"], "methods": ["http"], "case_keys": ["SB-SMOKE-API-HEALTH"] },
  "reason": "deploy 1.4.2",
  "exclusive": true,
  "dry_run": false
}
```

| Field | Required | Meaning |
|-------|----------|---------|
| `application` | yes | Application key or id |
| `environment` | yes | Environment key or id; must be `active` |
| `scope` | no | Narrow the run. Filters combine with AND; omit for every automated case of the application |
| `reason`, `metadata` | no | Stored on the run (build number, commit, ticket) |
| `exclusive` | no | `true` answers `409` with the running run's id when one is already in progress for the same application and environment |
| `approved_categories` | no | Safety categories the caller is cleared for when the environment marks them `approval_required` |
| `dry_run` | no | Return the plan, queue nothing |

Cases are left out, and listed under `excluded`, when they are not automated or when the environment's
safety policy prohibits their category (`load`, `soak`, `chaos`, `security_scan`, `functional_smoke`).

`202` returns `run_id`, `status_url`, `evidence_url`, the per-suite plan and `workers_online`.
`workers_online: 0` means the run waits in the queue until a worker registers.

## Follow a run

| Call | Returns |
|------|---------|
| `GET /api/v1/runs/:runId` | `state`, `verdict`, `exit_criteria`, totals, per-execution progress, `problems`, `missing_evidence` |
| `GET /api/v1/runs/:runId/evidence` | Every case with its evidence items: type, size, SHA-256, download URL |
| `GET /api/v1/runs?application=&environment=` | Recent runs |

`runId` also accepts a `run-all` group id or a single execution id/key.

| `state` | Meaning |
|---------|---------|
| `queued` | Waiting for a worker to claim it |
| `running` | At least one execution claimed |
| `stalled` | Work is pending and no worker has sent a heartbeat in 60 s |
| `completed` | Every execution finished |
| `cancelled` | Every execution was cancelled |

| `verdict` | Meaning |
|-----------|---------|
| `pass` | Exit criteria met |
| `fail` | At least one case failed |
| `inconclusive` | Nothing failed, but a case is unreported, blocked, errored, or lacks evidence |

## Exit criteria

A run passes only when all three hold:

| Criterion | Rule |
|-----------|------|
| `all_cases_reported` | Every case the run was asked to execute has a result |
| `evidence_complete` | Every passed or failed result has at least one evidence item in the store |
| `all_passed` | Every result is `passed` or `skipped` |

## From a pipeline

```bash
TEST_ENGINE_API=https://engine.example TEST_ENGINE_KEY=... \
  node scripts/trigger-run.mjs --app sand-bench --env sit --suites sb-smoke --reason "deploy $BUILD" --exclusive
```

| Exit code | Meaning |
|-----------|---------|
| `0` | Exit criteria met |
| `1` | Failed or inconclusive |
| `2` | Could not start, stalled without a worker for 2 minutes, or timed out |

Flags: `--suites --tags --types --methods --cases --reason --exclusive --dry-run --no-wait --timeout <s> --poll <s>`.

## Schedules

A schedule fires the same planner on a cron expression or on a named event.

```http
POST /api/v1/schedules
{ "name": "Nightly staging regression", "cron_expression": "0 2 * * *",
  "application": "sand-bench", "environment": "sand-bench-staging", "scope": { "tags": ["regression"] } }

POST /api/v1/schedules
{ "name": "After deploy", "event_trigger": "after_deploy", "application": "sand-bench", "environment": "sand-bench-staging" }
```

| Expression | Meaning |
|------------|---------|
| `0 2 * * *` | Five cron fields: minute, hour, day of month, month, day of week (`*`, lists, ranges, steps, `jan`–`dec`, `sun`–`sat`) |
| `@hourly` `@daily` `@weekly` | Shorthands (`hourly`, `daily`, `weekly` also accepted) |
| `every:30` | Every 30 minutes since the schedule last ran |

Cron fields are read in `SCHEDULER_TZ` (default `UTC`); set it on the API and the scheduler alike.
A new cron schedule waits for its next matching minute; it does not fire on creation. Each firing is a
run with `trigger_source: schedule` and the schedule's name as its reason.

| Call | Purpose |
|------|---------|
| `GET /api/v1/schedules` | Schedules with `next_run_at` |
| `PATCH /api/v1/schedules/:id` | Change expression, environment, scope, `enabled` |
| `DELETE /api/v1/schedules/:id` | Remove |
| `POST /api/v1/schedules/:id/run` | Fire now (optional `environment` override) |
| `POST /api/v1/schedules/trigger {event, environment?}` | Fire every schedule bound to an event, e.g. from a deploy hook |

The poller (`npm run start:scheduler`, compose service `scheduler`) checks every minute and fires what is due
through `POST /api/v1/schedules/:id/run`; a poller that was down catches up on a missed firing once.

## Evidence each runner produces

| Runner | Evidence | Needed for a pass |
|--------|----------|-------------------|
| `http` / `rest` / `api` | `http_transcript`: every request as sent and response as received, attempts, assertion outcome | `http_transcript` |
| `playwright`, `selenium` | `screenshot` of the final page (pass and fail) and a `log` of every step | `screenshot` |
| `performance` / `load` / `endurance` / `soak` | `metric` report: latency distribution, throughput, error rate, SLA | `metric` |
| SIT file (`sit/cases/*.sit.ts`) | `log` with the TAP output and a `metric` report | `log` or `metric` |

A failed result needs any one stored evidence item. `skipped` and `blocked` results need none: nothing ran.

Secrets are masked before a file is written: values of keys named like `authorization`, `cookie`, `password`,
`token`, `secret` or `api_key`, bearer tokens, and the values of the environment's secret variables wherever
they appear. Typed input in browser steps is logged by length only. Bodies are capped at 4 000 characters.

## How the gate works

| Step | Where | What happens |
|------|-------|--------------|
| Preflight | Worker, before the first case | Writes a probe, uploads it, reads it back. On failure no case runs: each is recorded `blocked` |
| Upload | Worker, after each case | `POST /api/v1/evidence/upload`; files are stored under `evidence/<execution-id>/` with a SHA-256 |
| Verify | API, `POST /executions/:id/results` | Evidence not found in the store is dropped. A pass or fail without the evidence it needs is recorded as `error` / `inconclusive`, with the claimed status kept in `metrics.evidence_gate` |
| Decide | API, `POST /executions/:id/complete` | Final status comes from the recorded results, not the worker's claim; `metadata.exit_criteria` is written |

## Configuration

| Variable | Where | Default | Purpose |
|----------|-------|---------|---------|
| `EVIDENCE_GATE` | API | `report` | `enforce` applies the gate; `report` records what it would do without changing a status; `off` disables it |
| `EVIDENCE_DIR` | API, worker | `./evidence` | Evidence store (API) and local scratch before upload (worker) |
| `EVIDENCE_MAX_BYTES` | API | `5242880` | Largest single evidence file |
| `TRIGGER_API_KEYS` | API | unset | `name:key,name:key`; a caller sending `X-Api-Key` acts as `app:<name>` with the `automation_agent` role. Keys under 16 characters are ignored |
| `EVIDENCE_RETENTION_DAYS` | API | `0` | Evidence older than this is deleted daily (files first, then rows); `0` keeps everything. `POST /api/v1/evidence/prune {older_than_days}` runs it on demand |
| `SCHEDULER_TZ` | API, scheduler | `UTC` | Time zone cron fields are read in |
| `SCHEDULER_POLL_MS` | scheduler | `60000` | How often the poller checks for due schedules |

In `compose.yaml` these come from `.env` (`EVIDENCE_GATE`, `EVIDENCE_RETENTION_DAYS`, `SCHEDULER_TZ`,
`TRIGGER_API_KEYS`); the `scheduler` service runs the poller beside the API. Set `COMPOSE_PROFILES=workers`
in `.env` on a machine that should always have a worker.

## Deploy hook

After a deployment finishes, fire the schedules bound to the event (or trigger a run directly):

```bash
curl -X POST $ENGINE/api/v1/schedules/trigger -H 'content-type: application/json' \
  -d '{"event":"after_deploy","environment":"sand-bench-staging","metadata":{"commit":"'$COMMIT'"}}'
# or, blocking, with the verdict as exit code:
node scripts/trigger-run.mjs --app sand-bench --env sand-bench-staging --suites sb-smoke --reason "deploy $COMMIT"
```

Under RBAC, `POST /api/v1/runs` needs `executions:run`, `GET /api/v1/runs*` needs `tests:read`, and
`POST /api/v1/evidence/upload` needs the worker key.

## Verify locally

```bash
# disposable engine + database, never a shared one: the test claims executions
EVIDENCE_TEST_API=http://127.0.0.1:8799 npx tsx --test tests/evidence-gate.test.ts
```
