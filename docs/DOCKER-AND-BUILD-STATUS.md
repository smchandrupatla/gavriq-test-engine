# Docker deployment & in-container test status

## Compose services

| Service | Port | Profile | Purpose |
|---------|------|---------|--------|
| `sit-console-db` | — | default | Postgres |
| `test-engine` | 8787 | default | Control plane + dashboard at `/`, SIT console at `/sit/` (one container, two supervised processes — see `scripts/consolidated-entrypoint.mjs`) |
| `test-engine-worker` | — | `workers` | Selenium/HTTP/perf runner |
| `sit` | — | `sit` | One-shot SIT runner |

```bash
# API + DB + SIT console (one service)
docker compose up -d --build

# Also start workers (needs Chrome/Playwright deps on host or custom image)
docker compose --profile workers up -d --build

# Point worker at a target app
TARGET_BASE_URL=http://host.docker.internal:8001 docker compose --profile workers up -d
```

After it's healthy:

```bash
docker compose exec test-engine npx tsx apps/api/src/seed.ts
```

## In-container / build test status

In-container tests run **during the application build**. They are **not** re-run by the Test Engine. CI posts results; the engine displays status only.

### CI posts results

```bash
curl -s -X POST http://localhost:8787/api/v1/build-results \
  -H 'content-type: application/json' \
  -d '{
    "application_key": "sand-bench",
    "build_id": "build-42",
    "commit_sha": "abc123",
    "branch": "main",
    "results": [
      { "test_key": "unit-auth", "test_name": "Auth unit suite", "suite": "unit", "status": "passed", "duration_ms": 1200 },
      { "test_key": "container-health", "test_name": "Container readiness", "suite": "in_container", "status": "passed", "duration_ms": 340 }
    ]
  }'
```

### Query latest build status

```bash
curl -s 'http://localhost:8787/api/v1/build-results?application_key=sand-bench' | jq
curl -s 'http://localhost:8787/api/v1/build-results/test/unit-auth?application_key=sand-bench' | jq
```

### Combined view (engine + in-container)

```bash
curl -s 'http://localhost:8787/api/v1/test-status?application_key=sand-bench' | jq
```

Returns:
- `engine_executed` — cases stored in the Test Repository with last engine run result
- `in_container` — latest reported build/in-container results (display only)
