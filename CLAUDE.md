# GAVRIQ Test Engine — working rules

## Test cases, suites and runs: plain language, Sand Bench representation (standing instruction)

Every test case in this repository is represented the way Sand Bench's Test cases screen represents one — Title, Test ID, Priority, Status (from the latest run), Owner, Component, Environment, Estimated duration, Tags, Visibility, **Objective**, Preconditions, numbered **Steps** (what is done / what should happen / data used), Dependencies, Automation link, Overall test data, Attachments, triage notes, Notes and Watchers — and is **written so a reader with no technical background understands it**. Suites are name + member cases; runs record a result per case with its environment, duration, who triggered it and **remarks** in plain words.

Rules and enforcement: `.github/skills/plain-language-test-cases/SKILL.md` (full rule set), `.github/instructions/plain-language-test-cases.instructions.md`, `tests/plain-language-catalog.test.ts`. The atomic-lifecycle rule for cases is `.github/skills/test-case-lifecycle/SKILL.md`.

Related code: `apps/api/src/catalog/types.ts` (CaseDef), `apps/api/src/catalog/plain-language.ts` (narrator + screen fields), `apps/api/src/routes/test-bench.ts` and `routes/test-cases.ts` (API), `apps/api/public/catalog/testbench.js` (console screens), `apps/api/src/seed-realistic-catalog.ts` (seed).
