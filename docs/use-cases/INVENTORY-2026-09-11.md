# Use-case inventory — 2026-09-11

Reviewed against `smchandrupatla/sand-bench-enterprise` before this documentation pass.
Updated the same day when STANDALONE_REVIEW was merged into REVIEW.

## Existing catalogue

Reviewed cases in `docs/use-cases/UC-*.md` are generated from `SEEDED_USE_CASES`.
44 `FEATURE_PAGES` entries. Aliases:

- datasets → dsAll
- testCases → tcPool
- testSuites → tsAll
- testCasesBrowse → tcPool
- testCasesNew → tcNew
- keyboard-shortcuts → keyboardShortcuts
- n2-walk → n2ControlWalk

## Standalone screens now in REVIEW

These keys are documentation-only. They are **not** added to `FEATURE_PAGES`. They are specified catalogue entries, not implemented product features.

| ID | Title | Actor | Screen ID | Screen title | Route/context | Related | Source evidence | Status |
|---|---|---|---|---|---|---|---|---|
| UC-helpCenter | Find operator help in the Help Center | SIT / control operator | helpCenter | Help Center | `/help-center.html` | UC-help | help-center.html, topics.js | specified |
| UC-keyboardShortcuts | Use documented console keyboard shortcuts | SIT / control operator | keyboardShortcuts | Keyboard shortcuts | topic `keyboard-shortcuts`, ux-pack.js | UC-help | ux-pack.js, topics.js | specified |
| UC-maskDemo | Compare the same run unmasked and masked | SIT / control operator | maskDemo | Same run, two tenants | `/mask-demo.html` | none | mask-demo.html | specified |
| UC-n2ControlWalk | Repeat the N-2 control walk | SIT / control operator | n2ControlWalk | N-2 control walk | topic `n2-walk` | UC-msgImportSchema, UC-ruleBenchCreate, UC-trNew | topics.js, bring-your-own-xsd.html | specified |
| UC-bringYourOwnXsd | Bring a customer XSD to Import schema | Message analyst | bringYourOwnXsd | Bring your own XSD | `/bring-your-own-xsd.html` | UC-msgImportSchema | bring-your-own-xsd.html | specified |

Runtime list: `SEEDED_USE_CASES` / `GET /api/v1/use-cases`. Generated Markdown files exist only after `node scripts/build-use-cases.ts`.

## Mapping repairs (not new behaviour)

| Unstable / alias key | Canonical page | Why |
|---|---|---|
| testCasesBrowse | tcPool | CONFIG.pages + nav child Browse test cases had no alias |
| testCasesNew | tcNew | Nav child New test case is the same action as tcNew |
| keyboard-shortcuts | keyboardShortcuts | Help topic hash |
| n2-walk | n2ControlWalk | Help topic hash |

The binder does not fall back to Overview when the resolved page key has no document.

## Surfaces inspected and not given a new case

| Surface | Decision |
|---|---|
| Agent Desk Run Agents / Schedules / Traces / Repo targets | Already baselined under Applications/AgentDesk/UseCases/ |
| SandBenchMessageSchemesImportSchemaWithMarkdown.md | Already covered by UC-msgImportSchema |
| admin.html, attacks.html, demo.html, pitch.html, not-production.html | Pitch or sidecar pages |
| Help topic troubleshooting | Operational runbook, not a screen workflow |
| FEATURE_PAGES overlays | Bound to the parent page case |
| Login / token session | No dedicated login screen in official public HTML inspected this pass |

## Broken or unstable identifiers

- Help Center byId returns topics[0] for an unknown hash — silent substitution. Specified as an implementation gap in UC-helpCenter.
- `/use-case.html` without `?page=` still defaults to overview in the editor page itself. The on-screen action never opens that URL without a page key.
- Sidebar says Message Schemes; confirmed import/create copy says Message Designer.
- Event framework overlay title mismatch remains as noted in REVIEW-2026-09-10.md.

## Builder status

1. STANDALONE_REVIEW is merged into REVIEW in `useCaseComprehensive.ts`.
2. Run `node scripts/build-use-cases.ts` to write `UC-helpCenter.md`, `UC-keyboardShortcuts.md`, `UC-maskDemo.md`, `UC-n2ControlWalk.md`, `UC-bringYourOwnXsd.md` and matching feature files.
3. Run `node scripts/build-use-cases.ts --check`.
4. Do not treat those generated files as product-pass evidence.
