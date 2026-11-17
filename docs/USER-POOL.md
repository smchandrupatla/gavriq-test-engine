# Signing in from parallel cases: identity lanes

Cases run in parallel. On Sand Bench that only works if no two cases that run at
the same time are signed in as the same user, because of how the application
treats identities (verified against Sand Bench main `a8d72039`, November 2026):

- **Signing out ends every session of that user**, on every browser and device.
- A user holds at most five sessions; a sixth sign-in ends the oldest.
- Five wrong passwords for one account inside fifteen minutes lock it for fifteen
  minutes. Fifty failed sign-ins from one client address block that address
  (HTTP 429) for fifteen minutes. Self-registration counts every attempt: ten an
  hour per address.
- **Only the built-in administrator is administrator-equivalent.** A role cannot
  make another user one; an ordinary user gets 403 on administration routes.
- A user created by an administrator starts with "must change password": the
  console shows the forced-password card instead of the application.

An earlier design hashed each case key onto a small pool of users. Two cases with
the same slot then ended each other's sessions whenever they overlapped, and one
load case that hammers the sign-in with bad credentials blocked the worker's
address for every other case. That design is gone.

## How it works now

### Operators — one lane per running execution

- An environment lists a pool of operators in `config.vars`: `pool_user_0` …
  `pool_user_N` with `pool_pass_0` … `pool_pass_N`.
- When a worker claims an execution, the engine gives it the lowest lane no other
  running execution on that environment holds and stores it as
  `metadata.identity_lane` (`apps/api/src/routes/executions.ts`,
  `leaseIdentityLane`). With every lane taken the execution stays queued rather
  than share an identity.
- The worker resolves `{{username}}` / `{{password}}` to that lane's pool entry
  for every case of the execution (`apps/worker/src/identity-lane.ts`). An
  execution's cases run one after another, so within a lane nothing overlaps.
- The lane is free again when the execution ends.

Cases keep writing `{{username}}`, `{{password}}` and `{{token}}`. Nothing is
renamed at seed time and no case names a user.

### Administrator — one shared session per worker

Cases that need administrator rights sign in with `{{admin_username}}` /
`{{admin_password}}` and save `{{adminToken}}`. At seed time every such sign-in
step is marked `reuse_session` (`apps/api/src/catalog/sandbench-identity.ts`): the
HTTP runner keeps one administrator session for the life of the worker and hands
it to each case after checking it is still alive. **No case may sign the
administrator out** — that would end the session under every other case; a
catalogue test fails if one does.

The application team's SIT suite also signs in as the administrator, file by
file. SIT executions therefore never overlap on an environment
(`metadata.serial_group = 'sit'`); everything else keeps running beside them.

### Sign-ins that are meant to fail

A sign-in a case expects to be refused is sent from a made-up client address of
its own (`X-Forwarded-For`, in the benchmarking range 198.18.0.0/15) so the
refusal is counted against that address, never the worker's. The same goes for
self-registration, for load cases that hammer the sign-in (`headers` in the
runner options) and for browser cases that type a wrong password
(`extra_http_headers`). A case that gives the lane operator a wrong password signs
in correctly afterwards, which clears the account's failure count. All of this is
applied to the whole catalogue by `applySandbenchIdentityRules`; authors do not
write it.

### A case that changes an identity

A case that must really change an identity's state — change or reset its
password, lock it, deactivate it, use up its sessions — creates its own throwaway
user through the administration API and removes it in cleanup
(`POST /api/v1/admin/tenants/tenant_default/users`, delete with `If-Match`). It
never does that to its lane operator or to the administrator.

## The pool on staging

`deploy/staging/deploy.mjs seed` calls `ensureStagingUserPool`
(`deploy/staging/user-pool.mjs`): twelve operators, `pool.op0` … `pool.op11`. Each
is created with a throwaway password and then sets the pool password itself,
which clears "must change password" — so a browser sign-in opens the console. The
seed can be repeated: an operator that already signs in with the pool password is
left alone; one whose password has drifted is reset and taken through the first
sign-in again.

The pool password is a fictional, staging-only value of at least twelve
characters (the application's minimum for a password a user sets). The
environment registers it under `pool_pass_N`, and maps the same keys to the
worker variable `SB_STAGING_POOL_PASSWORD` (set in `compose.yaml`) for a
deployment that rotates it.

A worker with five slots holds lanes 0–4. The remaining lanes are for a second
worker and for author-time harness runs — `dev/scripts/run-catalog-local.ts`
signs in as the last lane unless `--lane` says otherwise, and two harness runs at
the same time must use different lanes.

To add lanes: raise `STAGING_POOL_OPERATORS`, then `node deploy/staging/deploy.mjs
seed` and `register`.
