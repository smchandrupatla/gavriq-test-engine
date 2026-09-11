# Sand Bench use-case catalogue

63 reviewed use cases cover all 44 FEATURE_PAGES entries and the additional native screens, wizard steps and administration cases. See [coverage and implementation audit](COVERAGE.md) for source bindings, aliases, implementation gaps and unresolved decisions.

The Markdown files are generated from the reviewed defaults in `apps/api/src/modules/useCasePipeline.ts`. Edit the review sources, then run `node scripts/build-use-cases.ts`. Verify reproducibility with `node scripts/build-use-cases.ts --check`.

The Gherkin files in `features/` are specification tests. They are parsed and expanded by the official Cucumber parser, but have no product step definitions: they must not be reported as passing engine tests. Proposed acceptance criteria require approval and implementation. Source-verified controls establish literal source presence, not deployed conformance.

Existing tenant edits are preserved by insert-only seeding; this review does not overwrite saved tenant revisions. Historical PACK and WIRE-DEFAULTS notes are supplementary, not the current coverage inventory.

Download live body: `/use-case.html?page={key}` or `GET /api/v1/use-cases/{key}.md`.
Bulk: `GET /api/v1/use-cases.md`.

See `PACK.md` and `WIRE-DEFAULTS.md`.
