# Production hardening checklist

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Postgres connection string |
| `PORT` | no | Default `8787` |
| `RBAC_ENABLED` | recommended | `true` in production |
| `WORKER_API_KEY` | recommended | Shared secret; workers send `X-Worker-Key` |
| `JWT_SECRET` | optional | For gateway-validated Bearer tokens |
| `AGENT_API_KEY` | for the agent API | Secret the Sand Bench agent sends as `X-Agent-Key` (or Bearer). Unset: `/api/v1/agent/*` answers 503. See [AGENT-API.md](AGENT-API.md) |
| `WEBHOOK_ALLOWED_HOSTS` | optional | Comma list; only these hosts may receive completion webhooks |
| `AUTO_SEED` | no | Only for empty/dev environments |
| `TARGET_BASE_URL` | worker | Default target under test |

## Enable RBAC

```bash
export RBAC_ENABLED=true
export WORKER_API_KEY="$(openssl rand -hex 32)"
```

Clients must send:

```
x-actor-id: <user-id>
x-actor-roles: test_engineer,developer
```

Workers must send:

```
x-worker-key: <WORKER_API_KEY>
```

## Roles

`test_admin` · `test_manager` · `test_architect` · `test_engineer` · `developer` · `performance_engineer` · `security_tester` · `release_manager` · `auditor` · `viewer` · `automation_agent` · `worker`

## Safety policy

Never set production environment `safety_policy` categories to `allowed` for:
- `destructive_db`
- `chaos`
- `stress`

Use `approval_required` or `prohibited`.

## Audit

Sensitive actions (executions, case writes) should appear in `audit_events`.

```bash
curl -s localhost:8787/api/v1/audit \
  -H 'x-actor-id: auditor' -H 'x-actor-roles: auditor'
```

## Network

- Bind API to private network; expose only via reverse proxy with TLS
- Do not publish worker ports
- Restrict Postgres to API/worker network only
