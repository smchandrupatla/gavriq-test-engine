---
name: test-case-lifecycle
description: 'Use when creating, editing, or reviewing automated test cases, test fixtures, prerequisites, setup, cleanup, rollback, or isolation. Ensure each case restores its starting application state after pass, failure, timeout, or cancellation.'
---

# Atomic Test Case Lifecycle

## Contract

Every test case must run independently by key, start from the repository's single documented baseline, and end with the application restored to that baseline. Prerequisites and all case-owned setup belong to the case, not to another case, suite ordering, manual operator work, or undocumented environment state. Suites group cases; they must not provide hidden shared setup or teardown.

## Authoring Procedure

1. Identify the repository baseline and state the case reads or changes. Make the case verify/establish that baseline itself. Mark a genuinely read-only case as such; otherwise declare executable prerequisites and fixtures in the case definition.
2. Use unique, case-owned fixture identifiers. Create all data this case needs; never reuse another test's records. Snapshot only values the case intends to change, preserving unrelated/pre-existing user data.
3. Keep setup, assertions, and cleanup together in the case's executable definition. Cleanup must restore captured values or remove only resources created by this case, including database records where deletion is supported.
4. Put cleanup in an unconditional `finally` path, independent of assertion results. Run each cleanup operation even if an earlier cleanup operation fails, and make cleanup safe to retry.
5. Preserve both outcomes: report the assertion/setup failure and any teardown failure. Never report baseline restoration as successful unless it was verified.
6. Handle timeout and cancellation with a cleanup signal/budget that is independent of the cancelled assertion signal. For abrupt process termination, use an idempotent recovery/sweeper mechanism and document its bound and limitations.
7. Invoke the case by itself as well as through its suite. Add focused tests for successful cleanup, assertion failure, and cancellation/timeout. Verify the relevant baseline before and after each case.

## Repository Notes

- Canonical API test cases live in `apps/api/src/catalog/`; SIT case files live in `sit/cases/`.
- `CaseDef.preconditions` is descriptive. HTTP cases can declare `CaseDef.cleanupSteps`, persisted as `validation_rules.cleanup_steps` and run unconditionally by the HTTP runner. Playwright, Selenium, SIT, and legacy cases do not get teardown automatically. Do not imply ordinary `steps` alone guarantee atomicity; add runner support and regression coverage when needed.
- Use [the canonical target baseline](../../../docs/TEST-CASE-BASELINE.md). Verify it in each case and make any additional case-owned fixtures disposable.
- `docs/TEST-CASE-CATALOG.md` is generated from the running test repository; update its source definitions and use the catalog generator rather than hand-editing generated sections.