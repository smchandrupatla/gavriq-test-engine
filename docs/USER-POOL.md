# Parallel-safe user pool

Sand Bench enforces one active session per user: a second login from the same
identity invalidates the first. A catalog that logs every case in as
`operator.acme` therefore cannot run in parallel — the Nth case silently kicks
out the (N-1)th. The engine's catalog carries a per-case pool slot so parallel
runs each hold their own token.

## Engine side (this repo) — ready today

- `apps/api/src/catalog/user-pool.ts` provides `pickUser(caseKey)` and
  `pickAdmin(caseKey)`, which pick a pool slot from a stable hash of the case
  key, and `userLoginStep` / `adminLoginStep` / `userBearer` / `adminBearer`
  helpers that build the login step and the Authorization header bound to that
  slot.
- The Sand Bench environment seeded by `apps/api/src/seed-realistic-catalog.ts`
  carries `pool_user_0..pool_user_7`, `pool_admin_0..pool_admin_1`, and the
  matching `pool_pass_*` / `pool_adminpass_*` secret_env mappings. Pool size:
  **8 operator slots, 2 admin slots** (`POOL_SIZE` / `ADMIN_POOL_SIZE`).
- Until the Sand Bench side ships the extra identities, every pool slot falls
  back to the single demo user — the plumbing is live, but real parallelism
  only starts when the pool exists on the application side.
- The `tests/engine-catalog.test.ts` lint forbids hard-coded `admin` /
  `operator.acme` / etc. in step bodies — any new login must go through a
  `{{var}}` or a pool slot.

## Sand Bench side — seeded automatically at staging deploy

The staging deploy script (`deploy/staging/deploy.mjs`) seeds the pool through
the Sand Bench admin API as part of its `seed` phase — the same script that
imports the baseline ISO schema. 10 users are created (idempotent; a repeat
seed is a no-op):

**Operator pool** — 8 users, `pool.op0` … `pool.op7` (slot 0..7, used by
`pickUser(key)`).

**Admin pool** — 2 users, `pool.adm0` … `pool.adm1` (slot 0..1, used by
`pickAdmin(key)`).

All pool users share the demo password that already protects the stock
`operator` / `admin` accounts (`password` on dev and staging). The engine's
seed-time environment registration maps the pool vars to those usernames and
every `pool_pass_*` / `pool_adminpass_*` secret_env entry to a single
process-env variable (`SB_STAGING_PASSWORD` for staging, `SB_DEMO_PASSWORD`
for the dev/local environment), which `compose.yaml` passes to the worker
with a default of `password`. No per-user passwords to manage.

Sand Bench removed functional-access-profile enforcement (any authenticated
session holds every permission on the current build), so no role is assigned
at creation — if role checks are ever reinstated, give every pool user the
Rule Analyst profile (`fap_acme_rule_analyst`), and the two admin users the
Tenant Administrator profile (`fap_acme_tenant_admin`).

To re-seed on an existing staging stack: `node deploy/staging/deploy.mjs seed`.

## Catalog authoring

New cases that need a login call `userLoginStep(key)` or `adminLoginStep(key)`
from `apps/api/src/catalog/user-pool.ts` and reference the returned bearer via
`userBearer(key)` / `adminBearer(key)`. Existing cases that still use the
single `{{username}}` / `{{admin_username}}` template keep working during the
migration — the pool fallback resolves them to the single demo user. The
engine-catalog lint forbids any new hard-coded persona name in step bodies.

Pool size can be grown by changing `POOL_SIZE` in
`apps/api/src/catalog/user-pool.ts` — the seed picks up the new count on next
`npm run seed`. Growing it requires seeding matching extra users Sand Bench
side.
