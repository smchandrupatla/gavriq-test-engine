# Scheduler

The **Scheduler** page in the engine UI (sidebar → Automation → Scheduler) runs tests on demand or on a timetable. It also shows the Execution Plan: what will run next and what already ran.

## Run now

Pick **All tests**, one or more **Test types**, or one or more **Suites**, then pick an environment and press Run. The page shows how many cases the selection matches before you run it. The run is queued as a normal engine execution with `trigger_source = manual`.

A test type matches a case when any of these holds:

- The case's `test_type` equals the type.
- The case is tagged with the type.
- The case is in a suite whose `suite_type` is the type.
- The case is in a suite keyed `sb-<type>-…`.

The `sit` type matches Sand Bench SIT cases. Deprecated and archived cases never run.

## Schedules

A schedule has a name, a target (same choices as Run now), a **5-field cron expression** and an **IANA timezone**.

| Cron | Meaning |
|---|---|
| `*/15 * * * *` | every 15 minutes |
| `0 2 * * *` | daily at 02:00 |
| `30 6 * * 1-5` | weekdays at 06:30 |
| `0 3 * * sun` | Sundays at 03:00 |
| `0 9,17 * * *` | 09:00 and 17:00 |

- Lists, ranges, steps and `jan`–`dec` / `sun`–`sat` are supported.
- `@hourly`, `@daily`, `@weekly` and `@monthly` work too.
- The legacy `every:N`, `hourly` and `daily` still work.
- As in Vixie cron, when both day fields are set, a day matches either one.
- The dialog shows the next five fire times as you type.

Rules:

- **No overlap.** If a schedule's previous run is still queued or running, the new slot is logged as `skipped_overlap` and nothing is queued.
- **No catch-up storm.** If the engine was down across several slots, the schedule fires once, then moves to its next future slot.
- **Paused schedules** have no next run. Resuming computes one.
- **Deleting a schedule keeps its run history** in the plan.
- **Event triggers** (`POST /api/v1/schedules/trigger {event}`) still fire every enabled schedule with that `event_trigger`.

## Execution Plan

The plan lists every upcoming firing in the next 24 hours, 7 days or 30 days, grouped by day. It also lists the last 50 firings, including skipped ones, with each execution's status and pass/fail counts. It is computed live and refreshes every 15 seconds on screen.

## How it ticks

The API ticks in-process every 30 s (`SCHEDULER_TICK_MS`). Each due schedule is re-checked under a row lock before it fires, so several API replicas can tick safely. To tick from a dedicated process instead, set `SCHEDULER_IN_PROCESS=false` on the API and run `npm run start:scheduler`. Timezones default to `SCHEDULER_TZ`, or else the server's zone.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/scheduler/options` | Types (with case counts), suites, cron presets, default timezone |
| POST | `/api/v1/scheduler/preview` `{target}` | How many cases a target matches |
| POST | `/api/v1/scheduler/cron-preview` `{cron_expression, timezone}` | Plain-words reading and next fire times |
| POST | `/api/v1/scheduler/run-now` `{target, environment_id?}` | Queue a run now |
| GET | `/api/v1/scheduler/plan?hours=168` | Upcoming firings, recent firings, defect-loop counts |
| GET/POST | `/api/v1/schedules` | List or create |
| PATCH/DELETE | `/api/v1/schedules/:id` | Update (incl. pause/resume) or delete |
| POST | `/api/v1/schedules/:id/run` | Fire a schedule now |

`target` is one of:

- `{"scope":"all"}`
- `{"scope":"types","types":["sit","api"]}`
- `{"scope":"suites","suite_ids":[…]}`
- `{"scope":"cases","case_ids":[…]}`

## Verify

```bash
npm test    # includes tests/scheduler-cron.test.ts
# against a disposable engine started with SCHEDULER_TICK_MS=2000:
ENGINE_IT_BASE=http://127.0.0.1:8897 npx tsx --test tests/scheduler-api.test.ts
```
