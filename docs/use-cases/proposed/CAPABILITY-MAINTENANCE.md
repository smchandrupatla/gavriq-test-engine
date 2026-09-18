# Capability notes for this generation pack

Runtime setting (already on main):

```json
{ "useCases": { "enabled": true } }
```

Main PATCH still accepts `{ "enabled": true|false }` from use-case-bind.js.
Nested shape wiring is proposed on PR 24, not certified on main.

When enabled → binder may show the UC action.
When disabled → binder hides the action. Already-open `/use-case.html` windows
are not force-closed on main.

Visibility is not authorization.

Canonical edit locations remain those in docs/use-cases/MAINTENANCE.md.
# Use-case capability — maintenance (Prompt B)

Observed implementation in sand-bench-enterprise. See artifacts pack for the full note.

- Enable: GET/PATCH /api/v1/settings/use-cases `{ enabled }`
- Do not nest useCases.enabled until binder and API change together
- Map by page key, never title alone
- Seed is insert-only
- Gap: unmapped screens fall back to Overview
