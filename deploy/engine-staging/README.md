# Test Engine staging (local Docker)

A second deployment of the Test Engine on this machine: the engine as an
application under test. The engine on :8797 runs the self-test catalogue
(application `gavriq-test-engine`) against it, the same way it runs the
Sand Bench catalogue against Sand Bench staging.

| | Development | Staging |
|---|---|---|
| Compose project | `gavriq-test-engine` | `gavriq-test-engine-staging` |
| Source | working tree, uncommitted edits included | `git archive` of a pinned commit |
| Engine (API + console + SIT console) | http://127.0.0.1:8797 | http://127.0.0.1:18797 |
| Worker | yes — it runs the tests | none — it is the target, not a runner |
| Scheduler | polls every 60 s | polls every 15 s |
| Database | its own, not published | its own, not published |
| Evidence gate | `enforce` | `enforce` |
| Engine environment key | `engine-local` | `engine-staging` |

Development is both the engine that runs the tests and a target of them;
staging is only a target.

## Commands

```bash
node deploy/engine-staging/deploy.mjs deploy              # deploy the checked-out commit (HEAD)
node deploy/engine-staging/deploy.mjs deploy --ref main   # deploy any commit, tag or branch
node deploy/engine-staging/deploy.mjs status              # containers + health
node deploy/engine-staging/deploy.mjs seed                # create the self-test fixtures (repeatable)
node deploy/engine-staging/deploy.mjs seed --engine http://127.0.0.1:8797   # …on another engine
node deploy/engine-staging/deploy.mjs register            # (re)register the environment on :8797
node deploy/engine-staging/deploy.mjs stop
node deploy/engine-staging/deploy.mjs reset               # stop and delete its database and evidence
```

`deploy` exports the commit, builds `gavriq-test-engine-staging:<commit>`,
starts the stack, waits for the engine to answer (the first boot seeds the
whole catalogue, which takes a few minutes), verifies it, creates the fixtures
and registers the environment `engine-staging` with the engine on :8797. A
deployment that fails verification is left running for diagnosis but is not
registered.

## What the catalogue needs from a target

| Cases | Need | Where that holds |
|---|---|---|
| read-only | nothing | any engine |
| sandbox | the self-test fixtures | any engine after `seed` |
| isolated | the fixtures, no live worker, an empty queue | staging |

The **fixtures** are an application `te-selftest-fixtures` with six cases and an
environment `te-selftest-target` whose safety policy allows, gates and
prohibits different categories. Everything the sandbox cases write stays inside
that application: temporary cases are archived (the engine has no delete for
cases), schedules are deleted, executions are cancelled or completed.

The **isolated** cases act as the worker — queue, claim, upload evidence,
report, complete. `POST /api/v1/executions/claim` hands out the oldest queued
execution of any application, so on an engine with a live worker and real runs
they would take somebody else's job. They check for that first and report
`skipped` on such a target; that is why staging runs no worker.

On the development engine the read-only cases run as they are. The sandbox
cases run there only after `seed --engine http://127.0.0.1:8797`; without it
they are skipped. The isolated cases are always skipped there.

## Running the catalogue

From the console: application **GAVRIQ Test Engine**, environment **Test Engine
· local Docker (staging)**.

From a pipeline:

```bash
curl -X POST http://127.0.0.1:8797/api/v1/runs -H 'content-type: application/json' \
  -d '{"application":"gavriq-test-engine","environment":"engine-staging","reason":"after deploy"}'
```

While writing cases, without the engine in between:

```bash
TE_BASE=http://127.0.0.1:18797 npx tsx dev/scripts/run-catalog-local.ts --app gavriq-test-engine --suite te-integration
```

## State

Kept outside the repository in `../gavriq-test-engine-staging`
(`ENGINE_STAGING_HOME`):

- `src/<commit>/` — exported sources (the two most recent are kept)
- `deployed.json` — what is currently deployed

Data lives in the compose volumes `gavriq-test-engine-staging_*`.
