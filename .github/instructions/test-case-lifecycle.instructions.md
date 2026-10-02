---
description: "Use when authoring or changing automated test cases, fixtures, prerequisites, setup, teardown, rollback, or test isolation. Requires every case to restore its starting application state on all outcomes."
applyTo:
  - "apps/api/src/catalog/**/*.ts"
  - "sit/cases/**/*.ts"
  - "tests/**/*.ts"
---
# Atomic Test Case Lifecycle

- Every case must be independently runnable by key. A case owns all prerequisites and setup it needs; it must not require another case, suite ordering, shared mutable fixtures, or undocumented manual preparation.
- Start each case from the repository's one documented baseline state. Verify or establish that baseline in the case setup; do not infer it from whichever tests happened to run before.
- Treat each case as an isolated transaction over application state and leave the application matching the same baseline when the case ends.
- Put prerequisites, fixtures, setup, assertions, and cleanup in the case definition. If a case needs a record, create its own uniquely identified record before use; never borrow one created by another case.
- Use uniquely identified, case-owned test data. Preserve pre-existing data and restore only state the case created or changed.
- Make setup and cleanup idempotent. Run cleanup from an unconditional `finally` path so it executes after pass, assertion failure, exception, timeout, or cancellation; attempt all cleanup actions even if one fails. Delete case-created database records and external resources where supported.
- Report cleanup failures alongside the original test result; do not let cleanup conceal the test failure or claim a clean baseline when restoration failed.
- For abrupt worker/process termination, where `finally` cannot run, provide a bounded recovery mechanism (for example, an idempotent TTL sweeper) and make the residual-risk behavior explicit.
- Read-only cases must say so and must not mutate application state. A prose prerequisite is not a substitute for executable setup and teardown when state is changed.
- A suite may group cases but must not be a hidden setup/teardown mechanism. Every case must pass when invoked alone.
- Add or update tests that prove the cleanup path runs on success and failure before claiming lifecycle coverage.
- In this repository, HTTP cases may declare `CaseDef.cleanupSteps`; the catalog seeder stores them in `validation_rules.cleanup_steps` and the HTTP worker always attempts them. Other runner types and legacy mutating cases do not gain cleanup automatically.
- Use [the canonical baseline](../../docs/TEST-CASE-BASELINE.md) for fixture requirements. A baseline prerequisite may be checked, but state created or changed by a case still belongs to that case's setup/cleanup.