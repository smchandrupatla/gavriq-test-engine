# Use-case documentation capability — maintenance

This is the operator-facing documentation surface: a per-screen action, an in-console viewer, Markdown export, and the review/editor desk. It does not grant features and must not change business operations.

## Enable or disable display

Runtime setting (tenant-scoped when a database is configured):
# Use-case capability maintenance

## Enable or disable the on-screen action

Runtime setting (not a feature grant, not authorization):

```json
{ "useCases": { "enabled": true } }
```

Wire format on `GET`/`PATCH /api/v1/settings/use-cases` remains `{ "enabled": true|false }`. `PATCH` also accepts the nested `{ "useCases": { "enabled": false } }` shape. Responses include both.

- **Enabled** — mapped screens show the Use-case action.
- **Disabled** — the action is removed and any open viewer is closed immediately.
- Visibility is **not** authorization. Hiding the button does not change API access or feature grants.
- Tenant `platform_settings` key `use_cases` overrides the process default (`enabled: true`). Memory fallback is used only when the database is unavailable.
- The Configuration checkbox writes immediately (`PATCH`) and updates the current console without a reload. A new browser tab loads the saved tenant value on first `/api/v1/use-cases` request.

Official Configuration still hosts `#sbe-usecase-enabled` (“Enable use case button on screens”).

## Add a screen mapping

1. Give the screen a **stable page ID** (the `FEATURE_PAGES` / `CONFIG.pages` / navigation key). Do not key mappings on the visible title.
2. Add a seed in `apps/api/src/modules/useCases.ts` (`DETAILS`) and a comprehensive review row so `useCasePipeline.ts` emits `UC-{page}`.
3. If the console hash or native key differs from the use-case page ID, add the pair to `SCREEN_ALIASES` in `apps/api/src/modules/useCaseScreenMap.ts` **and** `NAV_ALIASES` in `apps/web/public/js/use-case-bind.js`.
4. For wizard steps, add a `WIZARD_STEPS` row (parent page, step index, exact on-screen title, child page ID) in both files.
5. Prefer `data-sbe-page="{id}"` on new screens so the binder does not use the title.
6. Run `node scripts/build-use-cases.ts` then `node scripts/build-use-cases.ts --check`.
7. Run `node --test tests/use-cases.test.ts tests/use-case-viewer.test.ts tests/use-case-comprehensive.test.ts`.

Aliases exist so a route change does not silently attach the wrong document. Never fall back to Overview.

## Canonical documents

| What | Where |
| --- | --- |
| Default body (source of truth for new tenants) | `DETAILS` + review overlays → `SEEDED_USE_CASES` in `useCasePipeline.ts` |
| Generated Markdown / Gherkin | `docs/use-cases/UC-{page}.md` and `docs/use-cases/features/` via `scripts/build-use-cases.ts` |
| Live tenant body | `use_cases` table (insert-only seed). Viewer and `GET /api/v1/use-cases/{page}.md` read this row |
| Tenant revisions | `use_case_revisions` (last 20). Editor History restores a snapshot as a new current revision |
| Screen map | `useCaseScreenMap.ts` (API/tests) and `use-case-bind.js` (console) |

Stable IDs (`UC-{page}`, `page`, `contract.screenId`) survive title edits. Do not rename `page` to match a new heading.

### Version-aware updates

- Seeding is `ON CONFLICT (tenant_id, page) DO NOTHING`. Regenerating defaults does **not** overwrite tenant-authored rows.
- Fresh tenants and memory fallback receive the current seed.
- To refresh a tenant row, review its revision history first, then `PUT /api/v1/use-cases/{page}` or upload Markdown on `/use-case.html`.
- Stale mappings: `validateScreenMap` and `scripts/build-use-cases.ts` fail when a mapped page has no seed, or a `UC-*.md` file has no seed page.

## Exports

- Single document: viewer **Download markdown**, or `GET /api/v1/use-cases/{page}.md`.
- The downloaded file is the Markdown body the viewer loaded for that revision.
- Catalogue pack: `node scripts/build-use-cases.ts` rewrites `docs/use-cases/`. `--check` proves reproducibility.

## Validation

```bash
node scripts/build-use-cases.ts --check
node --test tests/use-cases.test.ts tests/use-case-lookup.test.ts tests/use-case-markdown.test.ts tests/use-case-viewer.test.ts tests/use-case-comprehensive.test.ts
npm run sit:use-cases   # when SIT_API_BASE / SIT_WEB_BASE are reachable
```

## Viewer rules

- Opening or closing the overlay must not write form fields or change the active wizard step.
- Missing documentation shows the established unavailable control; it must not crash the screen or substitute another case.
- Markdown is rendered without script execution.
- Disable (`enabled: false`) closes the overlay.

## Unresolved limitations

- The binder and `useCaseScreenMap.ts` both list aliases and wizard steps; they must be edited together until a generated artefact is introduced.
- Console page identity still uses the location hash plus title fallback when no `data-sbe-page` is present.
- Tenant rows are not auto-migrated when defaults change.
- Mechanical catalogue coverage is not product-feature completion. Gaps in COVERAGE.md remain.
- Read: `GET /api/v1/settings/use-cases` and `GET /api/v1/use-cases` (`enabled` field).
- Write: `PATCH /api/v1/settings/use-cases` with `{ "enabled": true|false }`.
- Persistence: `platform_settings` key `use_cases` per tenant when Postgres is available; otherwise process memory.
- Tenant overrides follow existing settings precedence. Visibility is not authorization. APIs still enforce tenant auth independently.
- Effect: immediate after the Configuration checkbox or a successful PATCH handled by the binder; otherwise on the next binder tick (~1.6s) or page reload. Reload is not required to hide the action.
- Disable hides the action, drops the chooser, and closes viewer windows the binder opened (`sbe-usecase`, `sbe-usecase-step`). A same-origin `BroadcastChannel('sbe-usecase')` message `{ type: 'enabled', enabled: false }` is also posted. Viewers opened by a raw URL in an unnamed tab are not force-closed.
- Enable shows the action again on mapped screens that have a document. Business operations do not change.

The Configuration page also exposes a checkbox injected by `apps/web/public/js/use-case-bind.js`.

## Add a screen mapping

1. Prefer a stable page key already used in CONFIG.pages, sidebar page, or FEATURE_PAGES.
2. If the nav key differs from the case key, add it to SCREEN_ALIASES in `apps/api/src/modules/useCaseComprehensive.ts` and the alias map in `apps/web/public/js/use-case-bind.js`.
3. Do not add a documentation-only screen to FEATURE_PAGES. That would change grants.
4. For a genuinely new case, add a CaseReview to `useCaseReviewStandalone.ts` (or the matching review module). SEEDED_USE_CASES picks up any REVIEW key that is not already a feature page.
5. Run `node scripts/build-use-cases.ts` then `node scripts/build-use-cases.ts --check`.

Current aliases:

- datasets → dsAll
- testCases → tcPool
- testSuites → tsAll
- testCasesBrowse → tcPool
- testCasesNew → tcNew
- keyboard-shortcuts → keyboardShortcuts
- n2-walk → n2ControlWalk

Standalone HTML routes resolved by pathname in the binder:

- /help-center.html → helpCenter
- /mask-demo.html → maskDemo
- /bring-your-own-xsd.html → bringYourOwnXsd

A resolved page key with no catalogue row hides the action. The binder does not open Overview or any other substitute document.

## Where canonical documents are edited

| Kind | Edit here | Do not edit |
|---|---|---|
| Default reviewed text | apps/api/src/modules/useCaseReview*.ts, benchmarks, research overlay | Hand-editing generated docs/use-cases/UC-*.md (overwritten by the builder) |
| Generated catalogue | produced by scripts/build-use-cases.ts | — |
| Tenant-authored revision | PUT /api/v1/use-cases/:page | Seeding (ON CONFLICT DO NOTHING) will not overwrite it |
| Agent Desk baselines | Applications/AgentDesk/UseCases/ | Ops Console catalogue |

Pipeline: fallback → DETAILS → RESEARCH → structure → contract → tenant PUT.

## How exports are regenerated

```bash
node scripts/build-use-cases.ts
node scripts/build-use-cases.ts --check
```

Live download: `/use-case.html?page={key}` or `GET /api/v1/use-cases/{key}.md`.

Downloaded Markdown must come from the same row the viewer displays.

After merging new REVIEW keys, run the builder so `docs/use-cases/UC-*.md` and `docs/use-cases/features/` stay reproducible. `npm test` does not run `--check`; run it before calling the catalogue complete.

## How default revisions propagate

- New page keys insert on ensureSeeded.
- Existing tenant rows are preserved.
- Memory fallback uses SEEDED_USE_CASES plus in-process overrides.
- Migrating an old tenant row to a new default requires an explicit review of that tenant's revisions first.

## How custom documentation is preserved

- Database seed is insert-only.
- PUT writes a use_case_revisions snapshot.
- Do not regenerate into the tenant table.

## How validation checks are run

```bash
node --test tests/use-cases.test.ts tests/use-case-comprehensive.test.ts tests/use-case-markdown.test.ts tests/use-case-structure.test.ts tests/use-case-pipeline.test.ts
node scripts/build-use-cases.ts --check
```

Gherkin under docs/use-cases/features/ is specification-only unless a product step definition exists.

## Viewer rules that must not regress

- Accessible name: View use case.
- Tooltip when the visible label is the short UC mark.
- Keyboard: native button.
- No overview (or other) substitute when the current screen/step has no document.
- Missing fetch must not crash the host screen.
- Opening /use-case.html in a separate window must not alter form fields on the host screen.
- Closing the viewer must leave the host screen state unchanged.
