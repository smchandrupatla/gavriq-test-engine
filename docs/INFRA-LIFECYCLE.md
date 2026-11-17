# Infrastructure lifecycle: deploy, run, tear down

The local Docker stacks the engine tests against (Sand Bench staging on
:18080, the engine's own staging on :18797) run only while they are being
tested. The engine deploys a stack when a deploy or a run is asked for, runs
the tests, and takes the stack down again afterwards. In between, nothing of
it is running, so the machine's memory and disk go to whatever is actually
being tested. Docker housekeeping runs on a cadence so old images and build
cache do not pile up.

## What happens

| You do | The engine does |
|---|---|
| **Deploy, run, then tear down** (console header, or `POST /api/v1/deployments` with `mode: "deploy_and_run"`) | deploys the ref, runs everything for the application, and once every execution of that run has finished — passed, failed, cancelled or errored — tears the stack down |
| **Deploy and run** with "keep it up" | the same, but the stack stays up until the idle or max-uptime rule takes it down |
| **Deploy only** | deploys and leaves the stack up for you to use; nothing is run |
| **Run everything**, a schedule firing, `POST /api/v1/runs` while the stack is down | deploys first, then queues the run you asked for with the same scope, then tears down after it |
| nothing, for 12 hours | tears down a stack no run has used since its deploy or last run (`idle_teardown_hours`) |
| nothing, for 48 hours | tears down a stack that has been up that long (`max_uptime_hours`), as soon as no run is active on it |
| nothing, every 6 hours | Docker housekeeping (`prune_every_hours`): stopped containers and unused images of the managed compose projects, dangling images, build cache unused for 48 hours (`prune_build_cache_hours`) |
| **Tear down** on Configuration › Infrastructure | takes a stack down now (refused while a run is active unless forced) |
| **Prune now** / **Preview** | housekeeping now, or a dry run that only reports what it would remove |

Teardown means `docker compose down` of that stack's compose project: its
containers and network always, its images too (`remove_images_on_teardown`,
default on), its data volumes only if `remove_volumes_on_teardown` is turned
on (off by default: the staging database and its generated secrets stay
consistent, and the next deploy does not have to reseed). A label-scoped sweep
afterwards removes anything compose could not.

Nothing outside the managed compose projects is ever stopped or removed. The
development stacks on the same machine (`sand-bench-enterprise` on :8080,
the engine itself on :8797) are not managed and are never touched. Dangling
images are untagged layers nothing references; build cache older than the
window only costs a slower next build.

## The pieces

**Control plane** (`apps/api/src/infra.ts`, routes in `routes/infra.ts`).
Once a minute the engine decides: which deploy-and-run deployments have
finished their run, which stacks are idle or too old, whether housekeeping is
due, and whether a running job's agent went away. Decisions become rows in
`infra_jobs`.

**Infra agent** (`apps/infra-agent/src/agent.ts`). The process on the Docker
host that does the work, because that is where `docker`, `git` and the
sibling checkouts are. It claims one job at a time and runs it:

| Job | What runs |
|---|---|
| `deploy` | `node deploy/<name>/deploy.mjs deploy --ref <ref>` (the environment's own script, which builds, starts, verifies, seeds and registers) |
| `teardown` | `node deploy/<name>/deploy.mjs down [--rmi] [--volumes]`, then a sweep of whatever still carries the compose project's label |
| `prune` | stopped containers and unused images of the managed projects (`docker rm`, `docker rmi` by tag, never forced), `docker image prune -f`, `docker builder prune -f --filter until=<h>h` |

Only scripts matching `deploy/<name>/deploy.mjs` under the repository root are
run, whatever a job says. The agent reports progress every few seconds and the
result at the end; a job that stops reporting for ten minutes, or runs longer
than `job_timeout_minutes`, is failed by the engine and its stack released.

Start it on the Docker host and leave it running:

```powershell
# Windows host, in the engine checkout; logs to the console
$env:TEST_ENGINE_API = "http://127.0.0.1:8797"
npm run start:infra-agent

# detached, logging to a file (the repo ignores *.log)
Start-Process -WindowStyle Hidden -FilePath npm -ArgumentList "run","start:infra-agent" `
  -RedirectStandardOutput infra-agent.log -RedirectStandardError infra-agent.err.log
```

| Variable | Default | Purpose |
|---|---|---|
| `TEST_ENGINE_API` | `http://127.0.0.1:8797` | the engine to serve |
| `WORKER_API_KEY` | — | sent as `X-Worker-Key` when the engine runs with RBAC (the agent needs `workers:manage`) |
| `INFRA_AGENT_ID` | `infra-<hostname>` | how it shows on Configuration › Infrastructure |
| `INFRA_POLL_MS` | `5000` | how often it asks for a job |
| `INFRA_REPO_ROOT` | this checkout | where the deploy scripts live |

With no agent online, deploys and teardowns wait in the queue and the console
says so. On the engine, `INFRA_TICK_MS` changes the decision cadence
(default 60000; `0` turns the lifecycle off).

**Managed environments.** An environment is managed when its config carries

```json
"infra": {
  "driver": "compose",
  "script": "deploy/staging/deploy.mjs",
  "compose_project": "sand-bench-staging",
  "default_ref": "main",
  "idle_teardown_hours": null,
  "max_uptime_hours": null
}
```

`deploy/staging/deploy.mjs` and `deploy/engine-staging/deploy.mjs` register
this themselves on every deploy (keeping hours set in the console). The
Environments admin page edits the same fields. `config.deployment.state`
(`up`, `down`, `deploying`, `tearing_down`, `failed`) is what the engine
believes about the stack; the scripts set it on `deploy` and `down` too, so a
stack taken down by hand is known to be down.

## Policy

`GET`/`PUT /api/v1/infra/policy`, also on Configuration › Infrastructure:

| Key | Default | Meaning |
|---|---|---|
| `idle_teardown_hours` | 12 | tear down after this long without a run (0 = never); per-environment override in `config.infra` |
| `max_uptime_hours` | 48 | tear down after this long up (0 = never); per-environment override |
| `prune_every_hours` | 6 | housekeeping cadence (0 = never) |
| `prune_build_cache_hours` | 48 | housekeeping removes build cache unused this long (0 = keep) |
| `remove_images_on_teardown` | true | teardown removes the stack's images |
| `remove_volumes_on_teardown` | false | teardown removes the stack's data volumes |
| `teardown_after_run_default` | true | "Deploy and run" tears down afterwards unless the request says `teardown_after_run: false` |
| `auto_deploy_when_down` | true | a run asked for on a down stack deploys it first (off: the run is refused with 409) |
| `job_timeout_minutes` | 45 | a job running longer is failed |

## API

```
POST /api/v1/deployments            {environment_id, application, mode, ref?, teardown_after_run?}
GET  /api/v1/deployments/:id        status, run_id, job {status, log_tail}, teardown {status}
GET  /api/v1/infra                  policy, agents, managed stacks with state and next automatic action, recent jobs
GET  /api/v1/infra/jobs[?environment_id&kind]
POST /api/v1/infra/jobs             {kind: "teardown", environment_id, force?} | {kind: "prune", dry_run?}
POST /api/v1/infra/jobs/:id/cancel  a job still queued
POST /api/v1/infra/tick             run the decision pass now
GET/PUT /api/v1/infra/policy
```

A run asked for while the stack is down answers `202` with `run_id: null`
and a `deployment_id`; poll `GET /api/v1/deployments/:id` for its `run_id`.
From a pipeline, `scripts/trigger-run.mjs` keeps working: it waits on the run
once the deploy has produced one.

Under RBAC: `GET` needs `tests:read`; the agent's `claim`, `progress`,
`complete` and `heartbeat` need `workers:manage` (the worker key); everything
else needs `environments:deploy`.

## Verify locally

```bash
# decision logic, no database
npx tsx --test tests/infra.test.ts
# the API round trip, against a disposable engine (never the shared one)
INFRA_TEST_API=http://127.0.0.1:8799 npx tsx --test tests/infra.test.ts
```

The round trip stands in for the agent itself; to exercise the real agent
without touching any stack, queue a housekeeping preview:
`POST /api/v1/infra/jobs {"kind":"prune","dry_run":true}` and read the job's
result.
