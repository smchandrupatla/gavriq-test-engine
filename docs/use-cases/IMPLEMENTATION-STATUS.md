# Implementation and regression status

This is an initial implementation of traceability and catalogue regression, not completion of every proposed application feature.

## Implemented

- All 63 reviewed use cases name their external regression suites and coverage limits.
- The independent Test Engine presents 310 acceptance specifications and 126 executable catalogue checks: one API and one desktop/mobile editor check for each use case.
- Test cases and recorded results include the use-case ID and name. The application editor links directly to the external engine's use-case filter.
- The Test Engine persists traceability definitions in `sit_case_registry` when PostgreSQL is configured. History snapshots retain the use-case name and result status.
- Corrected Windows runner invocation, skipped/todo reporting, failed reporting responses, invalid run requests, duplicated console layouts, and file-history ordering.
- Database-backed use-case reads no longer reintroduce inferred events into saved contracts.
- The Test Engine image retains its browser-capable build stage and includes the reviewed specifications.

## Verification

- All 97 focused catalogue, traceability, request validation, database-row mapping and console checks passed.
- Test Engine desktop/mobile browser navigation and use-case filtering passed; screenshots are in `sit/public/evidence`.
- External application regression executed 126 cases: 0 passed, 126 failed because the local application could not be reached. This is environment failure evidence, not proof of application regressions or success.
- PostgreSQL migration and deployment validation remain pending: no services from this repository are running locally. A GitHub repository URL is not a deployed application endpoint.

## Still required

The feature-specific implementation gaps and decisions in [COVERAGE.md](COVERAGE.md) and every individual use case remain open unless explicitly listed above. In particular, actual suite execution, durable publication/import outcomes, complete schema semantics, configuration capabilities, and their business-workflow frontend/backend/database adapters have not all been implemented. The 310 acceptance specifications are not executable product tests. Catalogue/editor checks must not be substituted for them.

To validate a deployment, configure the existing `SIT_API_BASE`, `SIT_WEB_BASE`, test tenant/account and database settings, apply the engine registry schema through console startup, and run `npm run sit:use-cases`. Use the console at `/sit/` (port 8787, same container as the Test Engine dashboard) for selection, history and use-case links.
