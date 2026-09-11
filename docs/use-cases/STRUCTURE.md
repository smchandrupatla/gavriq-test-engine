# Use-case structure

Three artefacts share one `page` key.

| Artefact | Holds | Stored as |
|---|---|---|
| Case | Goal, guarantees, flows, Gherkin, contract | `use_cases` row |
| Handbook | Type/UX semantics that are not the case | `use_cases.handbook` jsonb |
| Decisions | Proposed vs gate | `use_cases.decisions` jsonb |
| Acceptance | AC-nn objects with gate or proposed | `use_cases.acceptance` jsonb plus string projection on `acceptance_criteria` |

Migration: `db/migrations/023_use_case_structure.sql`.

Writer: `persistStructure(client, tenantId, row)` in `useCaseStructurePersist.ts`.

Create schema ships all 36 lockdown ACs. Proposed (not release gates): AC-28, AC-33, AC-36.

Pipeline:

```text
fallback → DETAILS → RESEARCH → structure → contract → tenant PUT
```
