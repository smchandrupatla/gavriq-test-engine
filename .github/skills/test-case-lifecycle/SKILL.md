---
name: test-case-lifecycle
description: 'Use when creating, editing, or reviewing automated test cases, test fixtures, prerequisites, setup, cleanup, rollback, or isolation. Ensure each case restores its starting application state after pass, failure, timeout, or cancellation.'
---

# Atomic Test Case Lifecycle

## Contract

Every test case must run independently by key, start from the repository's single documented baseline, and end with the application restored to that baseline. Prerequisites and all case-owned setup belong to the case, not to another case, suite ordering, manual operator work, or undocumented environment state. Suites group cases; they must not provide hidden shared setup or teardown.

Concretely:
- A case that **views** an entity must first **create** it, then view, then **delete** it.
- A case that **deletes** an entity must first **create** it, then delete it.
- A case that **modifies** an entity must create it, modify, verify, then remove it (or restore the pre-modification state).
- The environment state at the end of a case must be bit-for-bit the same as at the start.

Cases must be runnable **in parallel**. No cross-case or sequential dependencies — nothing may rely on another case having run or on undocumented environment state.

## Parallel-safe logins

Sand Bench enforces **one active session per user** — a second login invalidates the first. A catalog that logs every case in as `operator.acme` therefore cannot run in parallel: the Nth case silently kicks out the (N-1)th. Any case that logs in must pick its user from the shared user pool (`apps/api/src/catalog/user-pool.ts`), which assigns a distinct operator/admin by hash of the case key. Pool size must exceed the maximum intended parallel-case fan-out. Pool users are seeded by the Sand Bench side (see `docs/USER-POOL.md` for the seed roster).

## Authoring Procedure

1. Identify the repository baseline and state the case reads or changes. Make the case verify/establish that baseline itself. Mark a genuinely read-only case as such; otherwise declare executable prerequisites and fixtures in the case definition.
2. Use unique, case-owned fixture identifiers. Create all data this case needs; never reuse another test's records. Snapshot only values the case intends to change, preserving unrelated/pre-existing user data.
3. Keep setup, assertions, and cleanup together in the case's executable definition. Cleanup must restore captured values or remove only resources created by this case, including database records where deletion is supported.
4. Put cleanup in an unconditional `finally` path, independent of assertion results. Run each cleanup operation even if an earlier cleanup operation fails, and make cleanup safe to retry.
5. Preserve both outcomes: report the assertion/setup failure and any teardown failure. Never report baseline restoration as successful unless it was verified.
6. Handle timeout and cancellation with a cleanup signal/budget that is independent of the cancelled assertion signal. For abrupt process termination, use an idempotent recovery/sweeper mechanism and document its bound and limitations.
7. Invoke the case by itself as well as through its suite. Add focused tests for successful cleanup, assertion failure, and cancellation/timeout. Verify the relevant baseline before and after each case.
8. For any case that logs in, pull the username/password from the pool helper (`pickUser(caseKey)` / `pickAdmin(caseKey)`), never hard-code `operator.acme` or `admin`. A case that must use a specific identity (e.g. tests the admin role itself) names it explicitly and declares its uniqueness in `atomicityNote: { reason: 'tests-interaction', detail: '...' }` so parallel runs schedule around it.

## Repository Notes

- Canonical API test cases live in `apps/api/src/catalog/`; SIT case files live in `sit/cases/`.
- `CaseDef.preconditions` is descriptive. Any case may declare `CaseDef.cleanupSteps`, persisted as `validation_rules.cleanup_steps`. The worker's `executeCase` runs them unconditionally after the main run — including Playwright, Selenium, SIT and performance cases — via a shared `runCase` try/catch that invokes the HTTP cleanup runner even when the main runner throws (`apps/worker/src/worker.ts`). The HTTP runner still runs its own cleanup directly, so an HTTP case's cleanupSteps fires exactly once.
- One case, one behaviour. If an HTTP case POSTs to the same creation endpoint more than once, it must declare `CaseDef.atomicityNote: { reason, detail }` naming one of: `tests-interaction`, `tests-idempotency`, `tests-independence`, or `pending-split`. The `tests/engine-catalog.test.ts` lint enforces this; `pending-split` is a one-shot amnesty with a follow-up plan recorded in `detail`.
- Use [the canonical target baseline](../../../docs/TEST-CASE-BASELINE.md). Verify it in each case and make any additional case-owned fixtures disposable.
- `docs/TEST-CASE-CATALOG.md` is generated from the running test repository; update its source definitions and use the catalog generator rather than hand-editing generated sections.