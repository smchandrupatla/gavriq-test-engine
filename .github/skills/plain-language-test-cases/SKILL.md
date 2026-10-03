---
name: plain-language-test-cases
description: 'Use whenever a test case, test suite or test run is written, changed, reviewed, seeded or displayed in this repository. Every case follows the Test cases screen representation adopted from Sand Bench and is worded so a reader with no technical background understands what is checked and why.'
---

# Plain-language test cases (standing instruction)

## The rule

A test case is a document for people first and a script for machines second. Anyone — a product owner, an auditor, a new tester — must be able to read a case on the Test cases screen and understand **what is checked, why it matters, what is done step by step, and what should happen**, without knowing HTTP, selectors, JSON or the code.

Technical detail is never deleted: it lives in the executable step fields (`action`, `url`, `selector`, `expect_json` …) and in `description`, and is shown as "executable detail" under the plain text.

## The representation (same as Sand Bench's Test cases screen)

Every case in `apps/api/src/catalog/*.ts` (`CaseDef`, see `catalog/types.ts`) carries:

| Screen field | Where it comes from | Plain-language rule |
|---|---|---|
| Title | `name` | A short statement of the outcome, e.g. "Wrong password is rejected". |
| Test ID | `key` | Stable, upper-case, dash-separated (`SB-SMOKE-API-HEALTH`). Never changed after creation. |
| Objective | `objective` (**required**) | One or two sentences: what is checked and why it matters. No `{{placeholders}}`, no `GET /api/...`, no status codes, no selectors, no field paths. |
| Priority / Severity | `priority` (p0–p4 → Critical/High/Medium/Low), `severity` | |
| Status | derived from the latest run | Passed / Failed / Blocked / Not run — never edited by hand. |
| Owner, Component, Environment, Estimated duration, Visibility | `owner`, `component`, `environment`, `estimatedDuration`, `visibility` | Filled by `catalog/plain-language.ts` when unset (team by category, component from the surfaces touched, the application's development environment, duration from the runner, Team). |
| Preconditions | `preconditions` | What must be true before the test can run, in words. |
| Steps | `steps[]` — each step: `text` (what is done), `expected` (what should happen), `testData` (data used), `attachments` | Derived from the executable fields by the narrator when not authored. Author them when the derived wording would be unclear. |
| Dependencies | `dependencyIds` | Catalog cases are independent (see `test-case-lifecycle`), so normally empty. |
| Automation link | `automationLink` | Defaults to the catalog file + key + runner. |
| Overall test data | `testData` | Plain words; defaults to `dataProfile.data`. |
| Attachments | `attachments` | Links (name + URL): the use-case document, the catalog documentation. |
| Flakiness notes / Known workarounds / Common failure causes | `flakinessNotes`, `knownWorkarounds`, `commonFailureCauses` | What to expect when it goes red and what to do. Defaults by runner type. |
| Triage, Notes, Watchers | repository state (console) | Operator state; the seed never overwrites a triage someone set. |

Test suites: name, member cases, status. Test runs: one result per case with `result` (pass / fail / blocked), environment, duration, who triggered it, and **remarks** — one plain line per step and the outcome, written by the worker (`runners/*` → `remarks[]`), plus remarks people add on the run screen.

## Writing rules

1. Start the objective with a verb a person would use: *Confirm, Check, Make sure, Walk through, Guard that, Try to … and confirm …*.
2. Name the surface, not its address: "the application's API", "the web console", "the test hub", "the database viewer", "the test engine".
3. Say what a status means, with the code in brackets only in step results: "refuses — sign-in required (401)".
4. Numbers that matter stay (counts, limits, sizes); jargon goes ("p95" → "95 out of 100 answers arrive within …").
5. A known defect is said in words and tagged `known-defect`: "(currently a known defect: it fails internally)".
6. Keep `description` as the precise technical statement (endpoints, verified values, dates probed). Do not water it down.
7. Never put a secret, a token or a real password in any field; "the demo password" is the wording.

## Enforcement

- `tests/plain-language-catalog.test.ts` fails the build when a case has no objective, when an objective contains jargon (`findJargon` in `catalog/plain-language.ts`), when a step cannot be narrated, or when a screen field is invalid.
- `npm run seed` writes the representation into the repository (`seed-realistic-catalog.ts` → `screenFields`); `npm run docs:catalog` regenerates `docs/TEST-CASE-CATALOG.md` with the objective and the Step / Expected result / Test data table per case.
- The console shows it under **Test cases**, **Test suites** and on each run's **Remarks** (`apps/api/public/catalog/testbench.js`).

## When adding or changing a case

1. Write the `objective` first, then the executable steps; add `text`/`expected`/`testData` on a step whenever the derived wording (run `npx tsx -e` with `narrateStep`) is not something a layman would say.
2. Run `npx tsx --test tests/plain-language-catalog.test.ts tests/engine-catalog.test.ts`.
3. Reseed the engine you are looking at, then check the case on its Test cases screen.
