# Defect Manager

The Defect Manager turns failed test results into defect reports that the Sand Bench Product Manager can act on. It then proves each fix by rerunning the failing cases.

## The loop

```
engine run fails ──► Defect Manager files report DR-…  (status: open)
                                   │
Sand Bench PM polls /defect-reports?status=open,reopened
PM claims it                        (with_pm)
PM → Implementation Manager → parallel developer agents
developers mark each defect fixed + fix_ref   (report: fixing)
PM requests a rerun                 (rerunning)  → engine queues rerun-dr-…-N
worker runs it, /complete ──► Defect Manager decides
        all fixed cases passed  → report verified, defects verified
        anything failed/not run → report reopened, back to the PM
```

The engine does all of this on `POST /api/v1/executions/:id/complete`. No extra daemon is needed.

## Rules

- **One defect per failure signature.** The fingerprint is the test case plus the first line of the error, with ids, numbers and timestamps normalized away.
- **Repeats are not new defects.** A repeat of a defect that is still open only increments `occurrences`. If a *verified* defect fails again, it is a regression: a new report gets a new defect with `regression_of` pointing at the verified one. The verified report keeps its record.
- **Only the engine verifies.** Agents may move a defect to `acknowledged`, `in_fix`, `fixed` or `wont_fix`. Asking for `verified` or `reopened` returns 403.
- **A rerun needs every defect fixed or `wont_fix`.** `wont_fix` needs a note. Only one rerun can be in flight per report.
- **Not run is not passed.** If the rerun did not execute a fixed case, that defect is reopened.
- **Severity comes from the classification.** Assertion, application and auth failures are `high`. Environment and unreachable failures are `low`.
- **Ingest is idempotent.** `defect_ingests` records every execution already read.

## API

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/v1/defect-manager/overview` | anyone | Counts: awaiting PM, in fix, rerunning, verified, unresolved |
| GET | `/api/v1/defect-reports?status=open,reopened` | PM poller | Reports waiting for the PM |
| GET | `/api/v1/defect-reports/:id-or-key` | PM | Report with its defects, summary and history |
| POST | `/api/v1/defect-reports/:id/claim` `{by}` | PM | open/reopened → with_pm; defects → acknowledged |
| PATCH | `/api/v1/defects/:id-or-key` `{status, fix_ref, assignee, note, by}` | Impl. Manager / developers | Move a defect along its lifecycle |
| POST | `/api/v1/defect-reports/:id/rerun` `{by, note?, environment_id?}` | PM | Queue a rerun of the fixed cases |
| GET | `/api/v1/defects?status=&report=` | anyone | Flat defect list |
| POST | `/api/v1/executions/:id/ingest-defects` | ops | Re-read one execution (idempotent) |

When `RBAC_ENABLED=true`, reads need `tests:read` and writes need `executions:run`.

## Statuses

Defect: `open → acknowledged → in_fix → fixed → verified`. From `fixed` a defect can also go to `reopened` (the rerun failed). Any unresolved defect can move to `wont_fix`.

Report: `open → with_pm → fixing → rerunning → verified | reopened`, and `reopened → with_pm`.

## Verify

```bash
npm test                                   # includes tests/defect-core.test.ts
# full loop against a disposable engine + Postgres:
ENGINE_IT_BASE=http://127.0.0.1:8897 npx tsx --test tests/defect-loop-api.test.ts
```
