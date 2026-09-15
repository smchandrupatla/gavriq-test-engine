# Runners & RBAC

## Workers

```bash
npm run start:worker
```

Env:

| Variable | Default | Purpose |
|----------|---------|--------|
| `TEST_ENGINE_API` | `http://127.0.0.1:8787` | Control plane |
| `TARGET_BASE_URL` | `http://127.0.0.1:8001` | Fallback when environment has no base_url |
| `WORKER_ID` | random | Stable id for registration |
| `WORKER_POLL_MS` | `4000` | Claim poll interval |

### Supported `execution_method` values

| Method | Runner | Notes |
|--------|--------|-------|
| `selenium` (default) | Selenium WebDriver headless Chrome | Named scripts + step DSL |
| `playwright` | Playwright Chromium | Same named scripts + step DSL |
| `http` / `rest` / `api` | Native fetch | Health + request chains |

### Named scripts (UI)

`smoke_home`, `nav_to_login`, `login_page_elements`, `login_submit`, `header_branding`, `dashboard_widgets`, `full_smoke_suite`

### Named scripts (HTTP)

`health` / `smoke_health` → `GET {baseUrl}/health`

### Step DSL (UI)

```json
[
  { "action": "navigate", "value": "https://example/login" },
  { "action": "type", "selector": "input[name=email]", "value": "a@b.c" },
  { "action": "click", "selector": "button[type=submit]" },
  { "action": "assert_text", "expected": "Welcome" }
]
```

### Step DSL (HTTP)

```json
[
  {
    "action": "request",
    "method": "GET",
    "path": "/health",
    "expected_status": 200,
    "expected_body_contains": "ok"
  }
]
```

## RBAC

Disabled by default. Enable with:

```bash
export RBAC_ENABLED=true
npm run start:api
```

Pass identity on each request:

```bash
curl -H 'x-actor-id: alice' -H 'x-actor-roles: test_engineer' ...
```

Roles: `test_admin`, `test_manager`, `test_architect`, `test_engineer`, `developer`, `performance_engineer`, `security_tester`, `release_manager`, `auditor`, `viewer`, `automation_agent`

Permissions are checked for read/write tests, run executions, audit, and release readiness.

## End-to-end smoke

```bash
export DATABASE_URL=postgres://sitconsole:sitconsole@127.0.0.1:5432/sitconsole
export TARGET_BASE_URL=http://127.0.0.1:8001

npm run migrate && npm run seed
npm run start:api &   # :8787
npm run start:worker &

# List cases
curl -s localhost:8787/api/v1/test-cases | jq '.data[].key'

# Run health case (get id from list)
curl -s -X POST localhost:8787/api/v1/executions \
  -H 'content-type: application/json' \
  -d '{"test_case_ids":["<TC-SB-HEALTH-uuid>"],"environment_id":"local-dev"}'
```
