# Sand Bench staging (local Docker)

A second Sand Bench deployment on this machine, used as a stable target for
the Test Engine. It exists because the development stack is rebuilt and edited
continuously (its web tier bind-mounts a working tree), so results against it
change for reasons unrelated to the code under test.

| | Development | Staging |
|---|---|---|
| Compose project | `sand-bench-enterprise` | `sand-bench-staging` |
| Source | working tree, uncommitted edits included | `git archive` of a pinned commit |
| Web console | http://127.0.0.1:8080 | http://127.0.0.1:18080 |
| API | http://127.0.0.1:8787 | http://127.0.0.1:18787 |
| Test hub | http://127.0.0.1:8091 | http://127.0.0.1:18091 |
| DB viewer | http://127.0.0.1:8090 | http://127.0.0.1:18090 |
| Database / object store | published on the host | not published |
| Classification | `development` | `test` |
| Engine environment key | `sand-bench-local` | `sand-bench-staging` |

## Commands

```bash
node deploy/staging/deploy.mjs deploy              # deploy Sand Bench `main`
node deploy/staging/deploy.mjs deploy --ref v1.4.0 # deploy any commit, tag or branch
node deploy/staging/deploy.mjs status              # containers + health + demo sign-in
node deploy/staging/deploy.mjs seed                # load the baseline data (repeatable)
node deploy/staging/deploy.mjs register            # (re)register the engine environment
node deploy/staging/deploy.mjs stop
```

`deploy` exports the commit, builds images tagged `sand-bench-staging-*:<commit>`,
starts the stack, verifies it, loads the baseline data, and registers the
environment with the engine. A deployment that fails verification is left
running for diagnosis but is not registered.

The database starts empty and the API applies every migration itself. The
baseline data is one imported ISO 20022 schema (`pacs.008.001.14.xsd`), which
the catalogue's read-only cases expect to find.

## State

Kept outside both repositories in `../sand-bench-staging` (`STAGING_HOME`):

- `src/<commit>/` — exported sources (the two most recent are kept)
- `staging.env` — secrets generated on first deploy; the password pepper and
  AES key must survive redeploys, so do not delete this file while the
  staging database volume exists
- `deployed.json` — what is currently deployed

Data lives in the compose volumes `sand-bench-staging_*`. To start from an
empty database: `docker compose -p sand-bench-staging down -v`, then deploy.

## Scope

Staging runs the services the catalogue targets: `db`, `minio`, `api`,
`worker`, `web`, `testhub`, `dbviewer`. The portals, brokers and search stack
of the development compose file are not started.
