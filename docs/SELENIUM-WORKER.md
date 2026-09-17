# On-demand Selenium worker

The `test-engine-worker` service uses **Dockerfile.worker** (Chromium + ChromeDriver) so UI cases can run without installing Chrome on the host.

## Start

```bash
# API + DB + SIT console
docker compose up -d --build

# Add Selenium-capable worker
TARGET_BASE_URL=http://host.docker.internal:8001 \
  docker compose --profile workers up -d --build

# or
WITH_WORKERS=1 ./scripts/up.sh
```

Point `TARGET_BASE_URL` at the deployed Sand Bench (or any app under test).

## Run from dashboard

1. Open http://localhost:8787/
2. Select Selenium cases (or **Run full smoke suite**)
3. Worker claims the job and executes headless Chrome

## Run via API

```bash
# list cases
curl -s localhost:8787/api/v1/test-cases | jq '.data[] | select(.execution_method=="selenium") | {key,id}'

# queue one
curl -s -X POST localhost:8787/api/v1/executions \
  -H 'content-type: application/json' \
  -d '{"test_case_ids":["<uuid>"],"environment_id":"local-dev","trigger_source":"manual"}'
```

## Local (no Docker worker)

Install Chrome/Chromium, then:

```bash
export TARGET_BASE_URL=http://127.0.0.1:8001
npm run start:worker
```

Optional: `CHROME_BIN` and `CHROMEDRIVER_PATH` if not on PATH.
