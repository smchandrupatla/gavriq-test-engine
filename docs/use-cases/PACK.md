# Use-case pack on main

All 45 official pages have `UC-{page}.md` in this folder.

Runtime body (Cockburn + Gherkin + contract) is:

```text
fallback → DETAILS → RESEARCH → contract → tenant PUT
```

- Overlay: `apps/api/src/modules/useCaseResearch.ts`
- Pipeline: `apps/api/src/modules/useCasePipeline.ts` (`SEEDED_USE_CASES`)
- Download one: `GET /api/v1/use-cases/{page}.md`
- Download all: `GET /api/v1/use-cases.md`

Postgres seed should use `SEEDED_USE_CASES`. Existing tenant rows stay until edited (`ON CONFLICT DO NOTHING`).
