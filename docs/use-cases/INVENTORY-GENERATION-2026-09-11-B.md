# Use-case inventory — generation pass 2026-09-11 B

Reviewed against `smchandrupatla/sand-bench-enterprise` main SHA `297c4b15185cd3a845cb3fb03e4acedf5ac7e2d0`
(post-merge of PRs #23–#26). Official HTML and `SHELL_PAGES` stay screen authority.
`FEATURE_PAGES` is not modified.

## What this pack adds

The morning pack (INVENTORY-GENERATION-2026-09-11.md) dressed Help Center, shortcuts,
mask demo, N-2 walk, BYO XSD, login, view-use-case, schema-tree, admin identities,
and attack history.

This second pass covers remaining observed public HTML shells and declared
SHELL_PAGES that the first pack explicitly left out.
This second pass covers **remaining observed public HTML shells and declared
SHELL_PAGES** that the first pack explicitly left out.

| ID | Title | Actor | Screen ID | Screen title | Route/context | Related | Source evidence | Status |
|---|---|---|---|---|---|---|---|---|
| UC-helpStandalone | Read the static Help & Shortcuts page | SIT / control operator | helpStandalone | Help & Shortcuts | `/help.html` | UC-help, UC-helpCenter, UC-keyboardShortcuts | help.html | specified |
| UC-demoWalkthrough | Follow the 90-second N-2 demo script | SIT / control operator | demoWalkthrough | 90-second demo | `/demo.html` | UC-n2ControlWalk, UC-msgImportSchema, UC-trNew | demo.html | specified |
| UC-notProduction | Read the bench-is-not-production disclaimer | SIT / control operator | notProduction | Not production | `/not-production.html` | UC-demoWalkthrough | not-production.html | specified |
| UC-publicUrls | Open the public URL card | SIT / control operator | publicUrls | Sand Bench — public URLs | `/pitch.html` | UC-helpStandalone, UC-demoWalkthrough | pitch.html | specified |
| UC-isoFamilyReference | Use the declared ISO family reference shell | Message analyst | reference | ISO 20022 family reference | `/reference.html` (declared) | UC-msgImportSchema | consoleScreens.ts SHELL_PAGES.reference | specified (file missing) |
| UC-dbViewer | Browse application tables in DB Viewer | Analyst / tester | dbviewer | Read-only table viewer | `http://127.0.0.1:8090/` | none | consoleScreens.ts, apps/dbviewer/public/help.js | specified |
| UC-testCasesDesk | View, clone, and queue test cases on the sidecar desk | SIT / control operator | testCasesDesk | Test cases | `/test-cases.html` | UC-tcPool, UC-tcNew | test-cases.html | specified |
| UC-testSuitesDesk | Compose, membership-edit, and queue suites on the sidecar desk | SIT / control operator | testSuitesDesk | Test suites | `/test-suites.html` | UC-tsAll, UC-tsNew | test-suites.html | specified |

These keys are documentation-only. They are **not** added to `FEATURE_PAGES`.

## Surfaces inspected and not given a new case

| Surface | Decision |
|---|---|
| `/security.html` | Same title and APIs as UC-security. Map the sidecar HTML to page key `security`. Do not duplicate. |
| `/external-systems.html` | Already UC-externalSystems |
| `/use-case.html`, `/use-case-review.html` | Already UC-useCaseEditor, UC-useCaseReview, UC-viewUseCase |
| `/about.html` | Already UC-about |
| `/help-center.html` | Already UC-helpCenter |
| Agent Desk UseCases | Already baselined under Applications/AgentDesk/UseCases/ |
| Official CONFIG.pages / FEATURE_PAGES | Already in the 63-case catalogue |
| `ops-console.html` | 1.4 MB design bundle; SHELL_PAGES notes it is not the live API shell |

## Broken or unstable identifiers

- `SHELL_PAGES.reference` declares `/reference.html`. No `apps/web/public/reference.html` file exists on this SHA.
- `help.html` title is Help — GARVIQ Labs; Help Center title is Help Center — Sand Bench. Binder must not treat them as one page.
- Token keys still differ: `sbe_token`, `sbe.token`, `sbe_admin_token`.
- Suite-run handlers can return accepted IDs without engine execution (COVERAGE.md).
- DB Viewer help warns that delete and CLEAR write; SHELL_PAGES notes say read-only.

## Capability (Prompt B) status on this SHA

Already on main via PRs #24–#25. This pack does not change runtime code.

## Recommended follow-up after review

1. Add CaseReview rows for the eight keys in `useCaseReviewStandalone.ts`.
2. Add pathPages entries listed in the pack B use cases.
3. Do not title-match `/reference.html` until the file exists.
4. Run `node scripts/build-use-cases.ts` then `--check`.
5. Keep FEATURE_PAGES unchanged.
| `demo.html` Testhub step | Optional; Testhub is not IBM MQ (stated on the page) |

## Broken or unstable identifiers

- `SHELL_PAGES.reference` declares `/reference.html` and dual XSD+markdown import. No `apps/web/public/reference.html` file exists on this SHA. Import remains on `/` via overlayImportSchema / UC-msgImportSchema.
- `help.html` title is “Help — GARVIQ Labs”; Help Center title is “Help Center — Sand Bench”. Binder must not treat them as one page.
- Token keys still differ: `sbe_token`, `sbe.token`, `sbe_admin_token`. Sidecar desks read the first two.
- Suite-run handlers can return accepted IDs without engine execution (COVERAGE.md). Sidecar “Queued” text is not evidence of execution.
- DB Viewer help warns that delete and CLEAR write to the selected application database — SHELL_PAGES notes say “read-only”, help.js contradicts that for delete/CLEAR. Recorded as a gap on UC-dbViewer.

## Capability (Prompt B) status on this SHA

Already on main: settings GET/PATCH `/api/v1/settings/use-cases`, catalogue GET `/api/v1/use-cases`, binder `use-case-bind.js`, viewer `/use-case.html`, builder `scripts/build-use-cases.ts`, MAINTENANCE.md, insert-only seed, STANDALONE_REVIEW merge, disable/close behaviour (PRs #24–#25).

This pack does not change runtime code.

## Recommended follow-up after review

1. Add CaseReview rows for the eight keys above in `useCaseReviewStandalone.ts` using the flows in this pack.
2. Add pathPages entries: `help.html` → `helpStandalone`, `demo.html` → `demoWalkthrough`, `not-production.html` → `notProduction`, `pitch.html` → `publicUrls`, `test-cases.html` → `testCasesDesk`, `test-suites.html` → `testSuitesDesk`, `security.html` → `security`.
3. Do not title-match `/reference.html` until the file exists. If a binder path is added, map it to `reference` and show the unavailable state.
4. Run `node scripts/build-use-cases.ts` then `--check`. Do not hand-edit generated `docs/use-cases/UC-*.md`.
5. Keep FEATURE_PAGES unchanged.

## Validation the operator should run in the repo

```bash
node --test tests/use-cases.test.ts tests/use-case-comprehensive.test.ts tests/use-case-markdown.test.ts tests/use-case-structure.test.ts tests/use-case-pipeline.test.ts
node scripts/build-use-cases.ts --check
```

Gherkin under this pack is specification-only unless a product step definition exists.
