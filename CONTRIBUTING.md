# Contributing to Sand Bench Enterprise

## Before writing code

1. Read the code and contracts in the area you are changing.
2. Treat `docs/specification/Sand-Bench-Revised-Functional-and-Backend-Specification.md` as the functional source of truth.
3. Treat OpenAPI and white-label JSON Schema as machine-checkable contracts.
4. Preserve the Ops Console navigation and page composition. Do not invent screens that contradict the prototype.
5. If a requirement is ambiguous, record the assumption in an ADR and proceed with the documented default.

## Branching

- Default branch: `main`.
- Implementation work happens on feature branches and is merged by pull request.
- Do not mix unrelated refactors with behaviour changes.

## Tests

Every change needs a test. Run the full suite before marking work complete. Decision-critical paths (access evaluation, masking, run grading, promotion, demo-seed guards) need negative, stale-version, idempotency, restart, and cross-tenant cases.

### Execute locally (same command CI uses)

```bash
npm install
npm test
```

CI (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request:

1. `npm install`
2. `npm run migrate` against the workflow Postgres service
3. `npm test` → `tsx --test tests/*.test.ts`

### Field / action / outcome suite

```bash
npx tsx --test tests/console-fields-actions.test.ts
npx tsx --test tests/live-bind-mount.test.ts
```

Those files assert login fields, catalogue and rule row fields, create-payload defaults, add-row POST paths and bodies, and bootstrap page outcomes.

### Single test by name

```bash
npx tsx --test --test-name "add-row actions" tests/console-fields-actions.test.ts
```

Do not push if `npm test` is red. Skipped tests (no Postgres, stub preview) are acceptable; failures are not.

## Commits

Use focused messages that explain *why*. Suggested prefixes: `docs:`, `sec:`, `feat:`, `fix:`, `test:`, `chore:`.

## What not to commit

Real passwords, tokens, certificates, connection strings, private keys, production data, or unredacted customer payloads.
