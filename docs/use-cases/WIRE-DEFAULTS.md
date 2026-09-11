# Wiring researched defaults

`useCases.ts` stays the wizard-contract source.

```text
fallback → DETAILS → RESEARCH → structure → contract → tenant PUT
```

- Research fills review notes.
- Structure adds AC id/status, handbook, and decisions.
- `registerUseCases.ts` imports seed names from `useCaseLookup.ts`.
- Existing tenant rows stay (`ON CONFLICT DO NOTHING`).
