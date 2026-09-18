# GARVIQ Test Engine (post-deploy)

## Use-case traceability

The Test Cases view includes use-case ID/name links and an execution-readiness filter. The 310 acceptance specifications are explicitly non-executable. There are 126 catalogue regression checks, covering authenticated API delivery and desktop/mobile editor rendering for each of the 63 use cases; these do not replace feature-specific business workflow tests.

Run `npm run sit:use-cases` against a configured deployment, or select cases in the console on port 8098. The application use-case editor links to this console with a use-case filter. The console maintains `sit_case_registry` in its configured PostgreSQL database, and result/history JSON retains names, IDs and explicit passed/failed/skipped/todo statuses. Without PostgreSQL, configure `SIT_CONSOLE_STORE` for local file history. Local evidence files are not committed.

See `docs/use-cases/IMPLEMENTATION-STATUS.md` for verified changes and pending feature implementations. Do not interpret catalogue delivery checks as complete acceptance coverage.

Out-of-container test runner with its own web portal. It is **not** Testhub.

| Surface | Port | Role |
| --- | --- | --- |
| Testhub | 8091 | External system simulator (file / HTTP / MQ / Kafka) |
| Test Engine / SIT console | **8787**, path `/sit/` | After deploy: health, integration, GUI smoke, E2E UX. Same container/port as the Test Engine dashboard, run as its own supervised process — see "The SIT console" below. |

The main API does not `depends_on` this service. Stop it and Sand Bench stays up.

It also checks the worker container leases and completes a job the app enqueues (proving
worker + app share the same database), and cross-checks the app's own "run completed"
report against the db viewer's independent read of the database (catching an app that
reports success while silently failing to persist).

**UI phase** (`sit/cases/60-*.sit.ts` and up): the cases above call the app's API
directly. These instead drive the deployed `web` console with a real browser — the same
actions a person would take — and hold themselves to the same standard: a status message
or a success toast the console prints is never treated as proof by itself, only ever the
first half of the check.

- `60-ui-eventing.sit.ts` (Playwright): open the console, navigate to Configuration, pick
  a channel (mq/kafka/api), click "Send dummy message", then independently confirm through
  test hub that the message actually arrived at the MQ manager / Kafka broker / external
  API endpoint.
- `70-ui-pages.sit.ts` (Selenium): navigates to every page reachable from the console's
  sidebar and asserts each renders its own real page header — one node:test case per page,
  so a single page regressing fails independently of the rest.
- `80-ui-workflows.sit.ts` (Selenium): drives every real, database-writing, safely
  repeatable form in the console (Rule Bench → Create new rule, Test Runs → New test run,
  Schedules → New schedule) — fills the real fields, clicks the real submit button, reads
  the real success toast — then queries the db viewer to independently confirm the row was
  actually committed and carries the values the console actually submitted. This is the
  "workflow" and "data integrity" coverage: the UI action, and separately, the database
  write it was supposed to cause.

Playwright and Selenium are two independent, unrelated browser-automation frameworks
here on purpose — `60-ui-eventing.sit.ts` was written first with Playwright and stays as
it is; `70`/`80` add Selenium WebDriver as a second, standalone framework for the broader
page/workflow/data-integrity suite, per the current requirement to have Selenium-based GUI
coverage in this engine. Neither depends on the other; see `sit/lib/ui.ts` (Playwright) and
`sit/lib/selenium.ts` (Selenium).

Two ways to run the same cases:

- **`sit/run.mjs`** — a one-shot CLI job. Waits for the deployed services to report
  healthy, runs every case once, exits non-zero on any failure. For gating a deploy
  pipeline.
- **`sit/console.mjs`** — the SIT console: a small, always-on web portal with its own
  dashboard, a "Run now" button, live logs, and run history. For a human to open in a
  browser and check "did the last deployment actually work" — see **The SIT console**
  below.

Both call the exact same case files through the same execution engine
(`sit/lib/runner.mjs`), so they can never disagree about a result.

## Running the CLI job

After the stack is up and healthy:
## Portal

```sh
docker compose up -d --build test-engine
# http://127.0.0.1:8787/sit/
```

From the host without Docker:

```sh
SIT_API_BASE=http://127.0.0.1:8787 \
SIT_TESTHUB_BASE=http://127.0.0.1:8091 \
SIT_WEB_BASE=http://127.0.0.1:8080 \
SIT_DBVIEWER_BASE=http://127.0.0.1:8090 \
npm run sit:console
```

## One-shot gate (pipeline)

```sh
docker compose --profile sit run --rm sit
```

Every base URL, and the demo credentials used to authenticate, are overridable — see
`sit/lib/env.ts`. Defaults match `docker-compose.yml`'s service names, so `sit` runs
unmodified as the one-shot container on the compose network.

The one-shot `sit` job builds from `sit/Dockerfile`; the always-on `sit-console` process
now ships inside the consolidated `test-engine` image (root `Dockerfile`), which is based
on the same `mcr.microsoft.com/playwright` base for the same reason. Either way it needs a
real, matching browser for the UI phase, twice over: Playwright's own
bundled Chromium for `60-ui-eventing.sit.ts`, and a separately apt-installed
`chromium`/`chromium-driver` pair for the Selenium-driven `70`/`80` cases (installed from
the same apt transaction so the two stay version-matched — Selenium's ChromeDriver refuses
to drive a Chrome build from a different major version). Running the UI-phase cases outside
that image needs matching binaries of your own:

- Playwright: point `SIT_CHROMIUM_PATH` at a Chromium build compatible with the
  `playwright` version pinned in `package.json`, if Playwright's own resolution doesn't
  find one.
- Selenium: point `SIT_CHROME_BINARY` at a Chrome/Chromium binary and
  `SIT_CHROMEDRIVER_PATH` at a ChromeDriver built for that exact major version. Left unset,
  Selenium falls back to its own driver auto-download (`selenium-manager`), which needs
  outbound access to `googlechromelabs.github.io` — not guaranteed from every environment,
  which is exactly why the Docker image pins a matched pair via apt instead.

`sit/run.mjs` exits non-zero if any case fails, so it can gate a deploy pipeline. Results
are also posted to test hub's `/hub/coverage/runs` and show up on the Test Hub coverage
page (`/coverage.html`) under **Post-deploy SIT**, alongside the unit/integration suite —
so "did the last deployment actually work end to end" has one place to look.

## The SIT console

`sit-console` (`sit/console.mjs`) is always-on, with its own dashboard at `/sit/`, styled
with the same Sand Bench branding (dark ground, gold accent) as the main application's Ops
Console and the Test Hub coverage page — this is a different application, not a different
product.

It ships inside the same container/image and behind the same published port as the Test
Engine control-plane API (`compose.yaml`'s `test-engine` service — see
`scripts/consolidated-entrypoint.mjs` for how the two are supervised and proxied), but runs
as its own independent Node process, and stays deliberately **not** wired into the main
application in either direction:

- the application never calls it — it only ever calls out to the application the same way
  any other real client would, through the public API, or through test hub standing in
  for an external MQ/Kafka/API system. There is no test-only backdoor the application
  needs to know about or trust.
- it has no `depends_on` health-gate on the application, test hub, db viewer, or web —
  it starts on its own and keeps serving its dashboard whether or not the rest of the
  stack is up, showing each target as reachable or unreachable rather than refusing to
  run.
- it keeps its own run history in its own volume (`sit-console-data`), independent of the
  application's database.

A crash in the Test Engine API's process does not take the SIT console process down (or
vice versa) — the supervisor restarts whichever child exited, and the other keeps serving
its dashboard the whole time, targets just show unreachable until the crashed side comes
back, and triggering a run reports clean failures instead of hanging (every request the
engine makes has a bounded timeout). Stopping the *container* stops both — they are no
longer independently stoppable services, since "one deployable" was the explicit tradeoff
made when the two were consolidated.

## Cases

The dashboard's **Cases** panel lists every case in `sit/cases/*.sit.ts`, grouped under a
human-readable category per file (health, MQ/Kafka/API round trips, worker/queue, database
cross-check, UI page coverage, UI workflow/data-integrity — see `CATEGORY_BY_FILE` in
`sit/console.mjs`), each case tagged with the outcome of the most recent run (pass / fail /
not yet run). It reads straight from the case files and the in-memory result of the last
run — no dependency on the Test Hub coverage page or any other service, consistent with
this console working on its own.

## Adding a case

Add a `sit/cases/NN-name.sit.ts` file using `node:test`, importing helpers from
`sit/lib/client.ts` (`apiFetch`/`apiJson` for the app, `testhubJson` for test hub,
`dbviewerJson` for the db viewer, `correlationId` for unique message ids, `pollUntil` for
waiting on an async round trip) and, for a case that drives the console's UI,
`sit/lib/selenium.ts` (`newDriver`/`withDriver`, `openConsole`, `openNav`, `pageTitle`,
`setFieldText`/`selectFieldOption`, `clickButtonByLabel`, `waitForToast`).

Every case name must be a **static, double-quoted string literal** passed directly to
`test(...)` — both the Test Hub coverage catalog and this console's own `/api/cases`
discover cases by scanning source text for that exact shape (`dev/scripts/extract-tests.mjs`),
not by executing the file. A name built at runtime (a template literal, string
concatenation, a loop variable) will run correctly but stay invisible to both catalogs —
write one `test(...)` call per case, even if that means a repetitive block of near-identical
calls (see `sit/cases/70-ui-pages.sit.ts`) rather than looping over a data table.

Then run `npm run testhub:catalog` to add the new case's description to the Test Hub
coverage catalog — CI checks that file is kept in sync. A new `sit/cases/*.sit.ts` file
also needs a `CATEGORY_BY_FILE` entry in `sit/console.mjs` (for the SIT console's own case
list) — dev/scripts/generate-testhub-catalog.mjs assigns SIT case files to a single
"Post-deploy SIT" category automatically and does not need a per-file entry.
- `00-health.sit.ts` — API / Testhub / dbviewer / web
- `30-api-round-trip.sit.ts` — integration through Testhub
- `60-gui-smoke.sit.ts` — official pages after deploy
- `70-e2e-ux.sit.ts` — first-run, N-2 script, channel targets

Playwright (`npm run test:gui`) stays a host/CI job. The engine records GUI HTTP smoke here so a deploy can be checked without a browser in the container.
