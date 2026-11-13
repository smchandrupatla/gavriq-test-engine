# Sand Bench test review — progress and blockers

Updated 17 October 2026 (Australia/Sydney). **The all-passed live acceptance target has not been achieved.** Changes are uncommitted for review.

## Baseline and scope

The approved candidate is immutable Sand Bench commit `c10565be064f034714e5d67f0ffcbdae56aa313f` (`feat/portal-features`). It contains generated-file delivery and resilience APIs absent from the original `a2f5d6a4e94c69922f9c1da00ea298ef27b3559a` pin.

The isolated review project is `sand-bench-staging-review`: web 19080, API 19787, testhub 19091, DB viewer 19090. The original staging and development projects were not stopped. The review candidate remains **unqualified**; it was not published as verified staging.

The canonical source inventory contains **6,197 Sand Bench cases across 31 suites**: HTTP 1,005; Playwright 5,112; Selenium 28; performance 45; E2E 7. The seeder also creates an empty record-and-play suite, making 32 suite rows. A successful isolated reseed and database query confirmed 6,197 active Sand Bench rows and exactly 6,197 suite memberships. Subsequent changes still require a successful final reseed.

## Implemented corrections

- One complete Sand Bench inventory now drives seeding, plain-language validation, and atomicity checks. Five previously omitted groups are covered.
- HTTP cleanup runs after skipped preconditions, assertion failures, cancellation, and timeouts. Created IDs are retained even when a creation-response assertion fails; cleanup errors remain failures.
- Run setup captures Sand Bench's actual `runId`; automatic run cleanup deletes the case-owned run and verifies absence. Schema/dataset cleanup reads the current version before deletion and verifies absence.
- Protected write surface probes explicitly test an unauthenticated refusal, with no authenticated writes or blanket acceptance of server errors. These are access-boundary probes, not claims of successful feature coverage.
- Event assertions match the event code, actor, and creation time in the same history entry. Existing business-event requirements remain real failures when the application does not emit them.
- Signed-in responsive and page-availability checks assert the requested browser title and visible heading, replacing fixed rendering delays and empty-shell checks. Browser/viewport coverage and case keys are retained. Page identities were inspected in the immutable source; live browser validation remains pending.
- Generated-file acceptance checks assert storage counts, the requested filename, successful forwarding, channel, and correlation tag. The persistence case also looks up its own saved message ID. Stale future-feature descriptions were updated.
- Staging creates distinct operator/admin pool identities even when a schema already exists. Shared API/worker image builds are deduplicated without dropping required services.
- Catalog writes are batched inside a transaction so case definitions and suite membership publish together. Seeding no longer claims to have verified a live application.

## Verified results

| Check | Result |
| --- | --- |
| Latest full repository test suite | **246 tests: 228 passed, 18 skipped, 0 failed** |
| Focused catalog/runner/staging regression run | **51 passed, 0 skipped, 0 failed** |
| Earlier isolated Test Engine API-flow rerun | **4 passed, 0 skipped, 0 failed** |
| Type checking | **193 errors**, versus 203 initially; no new normalized error messages at the last comparison |
| Full atomicity audit | 6,484 source cases inspected; **0 HTTP findings**; 4 existing Test Engine UI findings; **64 declared cleanup limitations** |
| Live Sand Bench acceptance | **Not completed; no all-passed claim** |

The 18 repository skips are prerequisite-dependent integration checks, including four API-flow checks while the isolated engine was unavailable. They are not passes. The 64 cleanup limitations are explicit exceptions, not proof that the starting baseline is restored. Type checking remains failing.

Evidence: [latest repository tests](../.docker-results/sandbench-review-tests-latest.log), [focused regressions](../.docker-results/sandbench-review-focused-complete.log), [type checking](../.docker-results/sandbench-review-typecheck-current.log), [deployment/asset failure](../.docker-results/sandbench-review-staging-feature-pin.log), and [atomicity report](CASE-ATOMICITY-AUDIT.md).

## Blocking evidence

1. The deployed candidate's index references two scripts missing from the committed source and image: `/js/row-identity-bind.js?v=20260917a` and `/js/sync-button.js?v=20260902a`. Both return 404. The required login-page asset gate fails; the shared-checkout commit gate passed. The missing-script reference was introduced before the generated-file feature commit (verified by Git ancestry), so the feature branch’s later documentation commits do not resolve it. Missing assets were not removed from the check or replaced by empty scripts.
2. The isolated engine/database connection became unreliable: requests returned `Connection terminated due to connection timeout`, and a diagnostic Sand Bench execution could not be queued. Docker also reported an unkillable zombie review worker and a container-removal operation already in progress. Recovery attempts used only isolated review services; the shared Docker daemon was not restarted.
3. No browser was available through the connected browser tool, so visual confirmation of the Test cases screen could not be completed.

## Remaining work before completion

- Obtain a qualified immutable Sand Bench pin with valid referenced assets and required feature APIs; preserve the application as the baseline.
- Restore reliable isolated engine/database/container operation, then reseed the final definitions and verify counts, memberships, and displayed fields.
- Regenerate `docs/TEST-CASE-CATALOG.md` through the repository generator after that final reseed. The existing generated catalog has not been overwritten with stale or partial runtime data.
- Finish runtime review of integration round trips, event trigger validity, stale page destinations, imported SIT inventory, and parallel session isolation. Current pool hashing alone does not establish collision-free parallel execution.
- Execute changed cases individually, their suites, and the complete reconciled Sand Bench inventory, retaining evidence for every requested case and verifying cleanup. Classify and correct test defects; keep genuine application defects visible.

Reproduction after the isolated runtime is healthy: run the seeder against its database, run the repository's plain-language/catalog checks, and use `TE_BASE=<isolated engine URL> node scripts/generate-test-case-docs.mjs` for the generated catalog. Do not interpret repository unit-test success as the live Sand Bench acceptance result.
