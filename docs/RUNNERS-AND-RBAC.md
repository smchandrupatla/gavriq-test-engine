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

### Collection assertions and cleanup

HTTP collection checks can require all details to occur in **one record**. For
example, this checks the event code and actor together and rejects events older
than the start of the case:

```json
{
  "path": "data",
  "some": {
    "eventCode": "biz.dataset.created",
    "actor.userId": "{{event_actor_id}}",
    "entity.id": "{{event_dataset_id}}",
    "occurredAt": { "at_or_after": "{{ts}}" }
  }
}
```

Put this object in a request step's `expect_json` array. Field names inside
`some` are dot paths within each array entry. An empty match is rejected.
`at_or_after` compares a timestamp against epoch milliseconds; `ts` is the
runner's case-start time, so this check assumes the target and worker clocks
are synchronized. Other values use exact comparison after variable substitution.

HTTP `cleanupSteps` run after all outcomes, including a prerequisite failing
after earlier setup. Successful creation responses save their identifiers even
when a response assertion fails, allowing cleanup to remove the new records.
Cleanup errors remain visible alongside the original failure.

To restore a configuration object, capture it with `save: { before: 'data' }`
and send it in cleanup with `body_json: '{{before}}'`. Object and array captures
are JSON text; `body_json` parses the substituted text before sending, preserving
numbers, booleans, arrays and nested objects. It cannot be combined with `body`
or `body_raw`. Invalid JSON fails that step without preventing later cleanup.
Use `skip_if_missing: ['before']` when setup may stop before the snapshot exists.
`body_raw` continues to send its literal text without variable substitution.

Numeric `min` and `max` assertions may use a captured value, for example
`{ "path": "total", "min": "{{before}}" }`. Both the observed value and the
resolved bound must be finite numbers; a missing capture fails the assertion.

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
