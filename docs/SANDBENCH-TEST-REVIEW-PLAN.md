# Sand Bench test review and correction plan

Prepared 16 October 2026. The user approved implementation against pinned staging after reviewing this plan. Progress and verification results are recorded in [SANDBENCH-TEST-REVIEW-RESULTS.md](SANDBENCH-TEST-REVIEW-RESULTS.md).

## Objective

Review and correct every Sand Bench case registered by the Test Engine seeder against the deployed Sand Bench application. Improve the strength and readability of the checks, preserve repository rules, and obtain a complete live passing result. A skipped, unreported, timed-out, or unevidenced case is not a passing case.

## Scope established from source

The six catalog groups imported by `apps/api/src/seed-realistic-catalog.ts` contain **6,197 cases** across 31 suites:

| Runner | Cases |
| --- | ---: |
| HTTP | 1,005 |
| Playwright | 5,112 |
| Selenium | 28 |
| Performance | 45 |
| E2E | 7 |

The generated operator GUI suite accounts for 5,094 of these cases. Imported legacy SIT cases are an additional inventory: reconcile them against the running repository so they are not silently omitted or counted twice.

## Rules that govern the changes

- Follow `.github/instructions/test-case-lifecycle.instructions.md`, `.github/skills/test-case-lifecycle/SKILL.md`, and `docs/TEST-CASE-BASELINE.md`.
- Follow `.github/instructions/plain-language-test-cases.instructions.md` and `.github/skills/plain-language-test-cases/SKILL.md`.
- Preserve stable case keys, runner evidence, plain-language remarks, and the existing browser and viewport coverage.
- Each case owns its setup and uniquely named fixtures, works alone and in parallel, and restores its starting baseline after success, failure, timeout, or cancellation. Cleanup failures remain visible alongside the original failure.
- Use the supported application APIs for setup and cleanup. Preserve existing application data. Baseline installation fixtures are the documented exception to creating a case's own data.
- Correct stale test assumptions using the deployed application and its confirmed contracts. Do not broaden status lists, remove assertions, disable cases, change expected results to accept defects, or adjust performance thresholds simply to get green.
- Keep future-feature expectations explicit. An unavailable capability or genuine application defect remains an identified blocker; it must not become a false pass.
- Generate catalog documentation through the repository generator. Do not hand-edit generated case documentation.

## Initial findings

1. The local Sand Bench API is healthy at port 8787 and the Test Engine is healthy at port 8797. The registered staging stack was stopped during the initial inspection. The user selected pinned staging for implementation: original commit `a2f5d6a4e94c69922f9c1da00ea298ef27b3559a`. The user subsequently approved a newer immutable build with the required features; the review now targets `c10565be064f034714e5d67f0ffcbdae56aa313f` (`feat/portal-features`). A separate staging project is used for this review because another deployment is using the original staging project.
2. The local environment maps all operator pool slots to `analyst` and all admin slots to `admin`. This conflicts with the independent-session requirement for concurrent cases. Verify actual seeded identities and configure distinct pool identities before parallel execution.
3. The existing plain-language and atomicity tests inspect the main Sand Bench export but omit five catalog groups that the seeder also registers. Auditing the full seeded source inventory found **27 additional create-without-cleanup findings** and **371 objectives flagged by the existing plain-language checker**. These are review findings, not yet verified runtime defects.
4. The API surface sweep accepts broad response ranges. Some expected-status lists include server errors despite descriptions promising that server errors fail. Several supposed non-persisting operations, including clear-data operations, require a state-safety review before they are executed against a shared target.
5. The latest recorded staging run requested 431 cases, reported 196, and recorded 111 passes, 44 failures, and 41 inconclusive outcomes. Evidence includes unresolved environment variables, authentication throttling, timeouts, and assumptions about populated shared collections. It cannot establish the health of the current local deployment.
6. The initial `npm test` run completed with **229 tests: 215 passed, 14 skipped, 0 failed**. This is the repository test result, not a live Sand Bench acceptance result. `npm run typecheck` fails on existing errors; preserve this initial result for comparison.

## Implementation sequence

### 1. Freeze and verify the target baseline

Record the target environment, API and portal endpoints, deployed source/build identity, installed schemas, supported integrations, and authentication identities. Inspect active executions to avoid interfering with another run. Confirm the application health and each required companion service independently. Keep Test Engine endpoints separate from Sand Bench endpoints.

### 2. Make the review cover the actual registered inventory

Introduce one canonical inventory of all seeded Sand Bench cases and suites. Make seeding, plain-language validation, atomicity validation, and review tooling use that inventory. Reconcile active imported SIT cases and duplicate or obsolete registrations. Preserve all case keys and document any approved scope decisions.

### 3. Correct setup, data ownership, and cleanup

Resolve the 27 newly exposed lifecycle findings by inspecting the owning application's supported lifecycle. Use unique per-run fixture identifiers, save resource IDs and current versions, and declare executable cleanup with deletion verification. Remove dependencies on the first shared record or on another case's output. For append-only resources, use only the repository's documented exception with a precise case-level explanation. Verify successful cleanup, assertion-failure cleanup, cancellation, and timeout behavior.

### 4. Align API and integration cases with Sand Bench

Review the live routes and machine contracts. Give happy paths exact success and payload assertions; give negative paths an exact documented refusal and checks for absence of unintended changes. Replace generic proof-of-life expectations with checks for the behavior named by each case. Review destructive and settings-changing probes before running them. Validate round trips using the same unique correlation value on both sides and clean up disposable resources through supported APIs.

### 5. Align browser and use-case journeys

Review shared helpers, page definitions, current navigation, accessible selectors, authentication, and expected outcomes before regenerating the matrix. Use observable readiness conditions instead of arbitrary waits. Each case must prove the named user outcome. Preserve browser and viewport coverage, verify individual journeys, then run the generated matrix with concurrency appropriate to the identity pool and machine capacity.

### 6. Improve human-readable case quality

Rewrite all flagged objectives in plain language. Ensure each step explains what is done, the expected outcome, and the test data, while retaining executable detail. Keep names, objectives, assertions, and overall expected results consistent. Verify the displayed fields and run remarks in the Test Engine console after reseeding.

### 7. Run and repair in increasing scope

Run the focused repository checks first. Execute each changed case alone, then its suite, then parallel isolation checks, and finally the complete reconciled Sand Bench inventory. Review every failure using evidence and classify its cause as test, engine configuration/runner, prerequisite, or application. Fix causes within scope and rerun affected cases and suites. Preserve real failures and report application changes that require separate work.

### 8. Publish evidence and regenerate documentation

Reseed the intended engine, inspect the corrected cases on its Test cases screen, and run the catalog documentation generator. Record target build identity, run IDs, requested/reported totals, exact result counts, lifecycle verification, and remaining blockers. Run the full repository suite and type checking again and compare with the initial results. Leave changes for review; do not commit, push, or merge unless requested.

## Completion criteria

- Every registered Sand Bench case is accounted for in the source/runtime reconciliation.
- All repository case-quality checks include every seeded catalog group and pass without exemptions added merely to hide findings.
- Corrected cases pass independently and through their suites, with verified cleanup and no shared-session interference.
- The complete live run reports a passing result for every requested case with required evidence. Skips, missing prerequisites, missing reports, and application defects are stated explicitly and prevent an all-passed claim.
- Case screens and generated documentation match the executable definitions.
- The final report distinguishes live Sand Bench results from repository checks and states any remaining type-check failures.
