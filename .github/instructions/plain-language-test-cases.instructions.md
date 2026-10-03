---
description: "Standing instruction for every test case, suite and run in this repository: use the Test cases screen representation adopted from Sand Bench and write the objective and steps in plain language a reader with no technical background understands."
applyTo:
  - "apps/api/src/catalog/**/*.ts"
  - "apps/api/src/import-sit-catalog.ts"
  - "apps/api/src/routes/test-cases.ts"
  - "apps/api/src/routes/test-bench.ts"
  - "apps/api/public/catalog/testbench.js"
  - "sit/cases/**/*.ts"
  - "tests/**/*.ts"
---
# Plain-language test cases

- Every `CaseDef` has an `objective`: one or two sentences saying what is checked and why it matters, written for a layman. No `{{placeholders}}`, HTTP verbs with routes, bare status codes, selectors, field paths or runner field names in it.
- Every step shows as *what is done / what should happen / data used* (`text`, `expected`, `testData`). Author them when the wording `catalog/plain-language.ts` derives from the executable fields would not be clear to a non-technical reader; never remove the executable fields.
- Every case carries the Test cases screen fields (owner, component, environment, estimated duration, visibility, automation link, overall test data, attachments, flakiness notes, known workarounds, common failure causes). Leave them to the defaults unless the case knows better.
- Keep `description` as the precise technical statement; keep secrets out of every field ("the demo password").
- Test runs capture remarks: runners return `remarks[]` (one plain line per step, then the outcome) and people can add remarks on the run screen. Do not drop them when changing a runner.
- Before claiming a case is done: `npx tsx --test tests/plain-language-catalog.test.ts tests/engine-catalog.test.ts`, reseed, and read the case on the Test cases screen.
- Full rule set: `.github/skills/plain-language-test-cases/SKILL.md`.
