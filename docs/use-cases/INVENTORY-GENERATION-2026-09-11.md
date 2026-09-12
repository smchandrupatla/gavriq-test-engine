# Use-case inventory — generation pass 2026-09-11 (workspace pack)

Reviewed against `smchandrupatla/sand-bench-enterprise` main SHA `3d524368c01f385c8558ae3d466a0e038133fbb0`.
Official HTML and SHELL_PAGES are screen authority. FEATURE_PAGES was not modified.

## Existing catalogue (unchanged)

63 reviewed cases in `docs/use-cases/UC-*.md` generated from `SEEDED_USE_CASES`.
44 `FEATURE_PAGES` entries.
Aliases on main binder: datasets→dsAll, testCases→tcPool, testSuites→tsAll, testCasesBrowse→tcPool, testCasesNew→tcNew.
Path map already present: help-center.html, mask-demo.html, bring-your-own-xsd.html, help.html, about.html, use-case.html, use-case-review.html.

`STANDALONE_REVIEW` on main already holds review objects for helpCenter, keyboardShortcuts, maskDemo, n2ControlWalk, bringYourOwnXsd. Those keys are not yet first-class generated `UC-*.md` files on main.

Open PRs at review time: #23 stubs, #24 viewer, #25 standalone merge. This pack does not continue those PRs. It supplies fully dressed Markdown the builder can ingest.

## Newly dressed in this pack

| ID | Title | Actor | Screen ID | Screen title | Route/context | Related | Source evidence | Status |
|---|---|---|---|---|---|---|---|---|
| UC-helpCenter | Find operator help in the Help Center | SIT / control operator | helpCenter | Help Center | `/help-center.html` | UC-help | help-center.html, topics.js | specified |
| UC-keyboardShortcuts | Use documented console keyboard shortcuts | SIT / control operator | keyboardShortcuts | Keyboard shortcuts | topic `keyboard-shortcuts`, ux-pack.js | UC-help | ux-pack.js, topics.js | specified |
| UC-maskDemo | Compare the same run unmasked and masked | SIT / control operator | maskDemo | Same run, two tenants | `/mask-demo.html` | none | mask-demo.html | specified |
| UC-n2ControlWalk | Repeat the N-2 control walk | SIT / control operator | n2ControlWalk | N-2 control walk | topic `n2-walk` | UC-msgImportSchema, UC-ruleBenchCreate, UC-trNew | topics.js, bring-your-own-xsd.html | specified |
| UC-bringYourOwnXsd | Bring a customer XSD to Import schema | Message analyst | bringYourOwnXsd | Bring your own XSD | `/bring-your-own-xsd.html` | UC-msgImportSchema | bring-your-own-xsd.html | specified |
| UC-sessionLogin | Sign in to the Ops Console | SIT / control operator | sessionLogin / index | Ops Console shell + login gate | `/` | UC-overview | consoleScreens.ts, app.ts, part-13.js | specified |
| UC-viewUseCase | Open the use case for the current screen | SIT / control operator | viewUseCase | View use case | binder + `/use-case.html?page=` | UC-useCaseEditor | use-case-bind.js | specified |
| UC-schemaInstanceTree | Inspect a schema instance tree | Message analyst | schemaInstanceTree | Schema and file tree | `/schema-tree.html` | UC-msgImportSchema | schema-tree.html | specified (shell only) |
| UC-adminIdentities | Review admin identities on the sidecar admin surface | Administrator | adminIdentities / admin | Admin identities | `/admin.html` | UC-users | admin.html, admin.js | specified |
| UC-attackHistory | Review recorded attack history | SIT / control operator | attackHistory / attacks | Attack history | `/attacks.html` | UC-trHistory | attacks.html | specified |

These keys are documentation-only. They are **not** added to `FEATURE_PAGES`.

## Surfaces inspected and not given a new case

| Surface | Decision |
|---|---|
| Agent Desk Run Agents / Schedules / Traces / Repo targets | Already baselined under Applications/AgentDesk/UseCases/ |
| SandBenchMessageSchemesImportSchemaWithMarkdown.md | Already covered by UC-msgImportSchema |
| Official CONFIG.pages / FEATURE_PAGES | Already in the 63-case catalogue |
| admin.html write paths beyond login | Not observed in admin.js |
| demo.html, pitch.html, not-production.html, ops-console.html | Pitch, design bundle, or sidecar |
| Help topic troubleshooting | Operational runbook, not a screen workflow |
| dbviewer on :8090 | Separate container |
| /reference.html ISO family reference | Declared in SHELL_PAGES; file `apps/web/public/reference.html` was not found in this pass |

## Broken or unstable identifiers

- Help Center `byId` returns `topics[0]` for an unknown hash — silent substitution. Specified as a gap in UC-helpCenter AC-04.
- `schema-tree.html` visible title is “Import schema” — title-match in use-case-bind.js can attach UC-msgImportSchema. Proposed path map `schema-tree.html` → `schemaInstanceTree`.
- Token keys differ: `sbe_token`, `sbe.token`, `sbe_admin_token`.
- Sidebar says Message Schemes; confirmed import/create copy says Message Designer.
- Event framework overlay title mismatch remains as noted in REVIEW-2026-09-10.md.
- `/use-case.html` without `?page=` still defaults to overview inside the editor (limitation recorded on PR 25).

## Capability (Prompt B) status on main

Already present: settings GET/PATCH `/api/v1/settings/use-cases`, catalogue GET `/api/v1/use-cases`, binder `use-case-bind.js`, viewer `/use-case.html`, builder `scripts/build-use-cases.ts`, MAINTENANCE.md, insert-only seed.

Not on main (open PRs): in-console overlay viewer, BroadcastChannel close-on-disable, nested `{ useCases: { enabled } }` settings helper wired through registerUseCases, merge of STANDALONE_REVIEW into REVIEW.

This pack does not change runtime code. Recommended follow-up after review:

1. Add CaseReview rows for sessionLogin, viewUseCase, schemaInstanceTree, adminIdentities, attackHistory in `useCaseReviewStandalone.ts` using the flows in this pack.
2. Add pathPages entries for schema-tree.html, attacks.html, admin.html. Do not title-match schema-tree.html to Import schema.
3. Run `node scripts/build-use-cases.ts` then `--check`. Do not hand-edit generated `docs/use-cases/UC-*.md`.
4. Keep FEATURE_PAGES unchanged.

## Validation the operator should run in the repo

```bash
node --test tests/use-cases.test.ts tests/use-case-comprehensive.test.ts tests/use-case-markdown.test.ts tests/use-case-structure.test.ts tests/use-case-pipeline.test.ts
node scripts/build-use-cases.ts --check
```

Gherkin under this pack is specification-only unless a product step definition exists.
