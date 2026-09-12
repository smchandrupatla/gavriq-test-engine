# Use-case markdown history

| Date | What |
|---|---|
| 2026-09-08 | `use_cases` table, PUT upsert, seed from FEATURE_PAGES. |
| 2026-09-08 | Cockburn fields + Gherkin on `/use-case.html`. |
| 2026-09-10 | Research overlay, pipeline, markdown export APIs. |
| 2026-09-10 | All 45 official `UC-*.md` files on `main`. |
| 2026-09-10 | Pack index `PACK.md`. Concatenated catalogue is the download API, not a 155KB blob. |
| 2026-09-10 | Case / handbook / decisions structure. AC id+status. Migration `023`. Create schema 36 ACs. |
| 2026-09-11 | Use case review desk: list, select all/clear, upload markdown as a version, download/view latest, history markdown per revision, batch implementation review. |
| 2026-09-11 | Test cases desk `/test-cases.html`, test suites desk `/test-suites.html`, feature ID links + bulk level, evidence pack leak removed from Features. Migration `024`. |
| 2026-09-12 | Pack B standalone reviews seeded: helpStandalone, demoWalkthrough, notProduction, publicUrls, isoFamilyReference, dbViewer, testCasesDesk, testSuitesDesk. FEATURE_PAGES unchanged. `/reference.html` still unmapped until the file exists. |
| 2026-09-12 | Standing check-in rule added to AGENTS.md and use-case automations. Pack B pathPages map checked in at `apps/web/public/js/use-case-path-pages.js`. Binder `use-case-bind.js` must copy that map (help.html → helpStandalone). |
| 2026-09-12 | Binder `pathPages` aligned with pack B map: help.html → helpStandalone, demo/not-production/pitch/test-cases/test-suites/security landed. |
| 2026-09-12 | Standing rule strengthened: check in everything immediately. Do not wait. Do not keep any code. AGENTS.md plus Use case Maintain and Use case create automation prompts updated. |
| 2026-09-12 | Refreshed `docs/prompts/USE-CASE-MAINTAIN.md` and `docs/prompts/USE-CASE-CREATE.md` with the full application loop: surface-tagged validation (screen / backend-only / both), the rule that changing a use case is changing the spec (implement + full review in the same run), and bug handling (fix immediately, record in HISTORY + PR, no cross-run memory). |
| 2026-09-12 | **Issue log** added to the use-case template: cumulative `ISS-nn` entries with `open`/`fixed` status. On screen rendered as a table (Issue log tab on `/use-case.html`); in downloaded markdown as a simple list. Fixed issues older than one week are pruned; open issues are reviewed and fixed on every automation run. New module `useCaseIssueLog.ts`, `UseCase.issueLog` field, markdown emitter, editor tab, and `tests/use-case-issue-log.test.ts`. Current logs start empty. |
| 2026-09-12 | Pack A remaining standalone reviews seeded: sessionLogin, viewUseCase, schemaInstanceTree, adminIdentities, attackHistory. FEATURE_PAGES unchanged. pathPages maps schema-tree.html → schemaInstanceTree (not Import schema title-match), admin.html → adminIdentities, attacks.html → attackHistory. `/` is not mapped to sessionLogin. Surfaces tagged in inventory. |
| 2026-09-12 | Binder `pathPages` aligned with pack A map: schema-tree.html → schemaInstanceTree, admin.html → adminIdentities, attacks.html → attackHistory. Binder was not reconstructed. `/` and index.html stay unmapped. Inventory scan refreshed against public HTML + SHELL_PAGES. |
| 2026-09-12 | Help Center per-topic PDFs shipped: every `topics.js` id has `apps/web/public/help/pdf/{id}.pdf`, plus consolidated and `Sand-Bench-Help-Manual.pdf`. ISS-02 fixed. FEATURE_PAGES unchanged. Unknown-hash `topics[0]` substitution remains on main (PR #38). Help screenshot files under `help/img/` are still referenced and not certified. |
| 2026-09-12 | UC-helpCenter ISS-01 fixed: `/help-center.html` no longer substitutes `topics[0]` for an unknown hash. `byId` returns null; `renderUnknown` discloses Topic not found. Review exception, proposed markdown, and `tests/help-center.test.ts` updated together. FEATURE_PAGES unchanged. |
