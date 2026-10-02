# Test Case Baseline

Every case must be independently runnable against the canonical seeded target state described here. A suite is a grouping, not a setup mechanism. Cases may create temporary, uniquely named fixtures, but must restore the target to this baseline before completion.

## Test Engine Target

- API schema is migrated and the realistic catalog is seeded.
- The self-test fixture application `te-selftest-fixtures`, its fixture cases, and `te-selftest-target` environment are provisioned by `deploy/engine-staging/deploy.mjs`.
- Claim/worker-protocol cases require the target's execution queue to be empty and no live worker to claim work. They must verify those conditions in their own precondition steps and skip when the isolated target is not available.
- Never mutate shared application/environment fixtures unless the case snapshots and restores the exact prior values.

## Sand Bench Target

- The deployed API and web portal are healthy; the portal root is the login page.
- The demo operator/admin identities, ISO 20022 message types used by cases, and explicitly required baseline catalogs (for example external-system stubs) are provisioned by the target's seed/deployment process.
- Cases must not consume records created by another test. Create a case-owned record when one is needed, use a unique run-specific identifier, and clean it up or restore its exact prior state.
- If a required baseline fixture is absent, the case must report a missing prerequisite/skip; it must not silently borrow the first record returned by a shared collection.

## Restoration

- HTTP catalog cases declare teardown in `CaseDef.cleanupSteps`; the worker passes it to the HTTP runner, which attempts every cleanup step after pass, failure, skip, exception, timeout, or cancellation.
- Cleanup should use the target's supported delete/archive operation and current ETag. Cleanup failure fails the case and is reported with the original test result.
- A hard worker/process stop can bypass `finally`. Mutating targets therefore need bounded, idempotent recovery for orphaned run-prefixed fixtures before the baseline can be considered restored.
- Browser session state is isolated by the per-case browser context, but backend state changed by a browser workflow still requires explicit case cleanup.

This baseline document describes the contract; it does not claim that every legacy mutating case has already been migrated. Cases without supported rollback remain known gaps and must not be presented as baseline-restoring until cleanup or a recovery mechanism is added and verified.