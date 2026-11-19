# Sand Bench test review — changes made

Run results, pass/fail counts, evidence and defect lists are **not kept in this repository**. They are recorded by the engine in its database and are read from the console (Test runs, Reports, Quality insights) or the API (`/api/v1/runs`, `/api/v1/executions/:id/evidence`). Application defects are tracked in Jira (project KAN, Sand Bench Enterprise). Do not paste results into this file.

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

## Reproduction

Run the seeder against its database, run the repository's plain-language/catalog checks, and use `TE_BASE=<engine URL> node scripts/generate-test-case-docs.mjs` for the generated catalog.
