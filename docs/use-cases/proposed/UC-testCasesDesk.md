# View, clone, and queue test cases on the sidecar desk

- **ID:** UC-testCasesDesk
- **Screen:** Test cases
- **Level:** 1 for list, 2 for new-case writes when grants apply
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** UC-tcPool
- **Extends to:** UC-tcNew, UC-testSuitesDesk

## Goal
List stored test cases, open one, clone it, and queue a run without treating Queued as engine evidence.

## Precondition
1. The operator can open `/test-cases.html`.
2. GET `/api/v1/test-cases` is registered.
List stored test cases, open one, clone it, and queue a run without treating “Queued” as engine evidence.

## Precondition
1. The operator can open `/test-cases.html`.
2. `GET /api/v1/test-cases` is registered.
3. A session token may be sent from `sbe_token` or `sbe_admin_token`.

## Trigger
Operator opens `/test-cases.html`.

## Success guarantee
1. The list is built from GET `/api/v1/test-cases` data.
2. Empty data renders "No test cases yet."
3. Create posts `{ name, objective }` to POST `/api/v1/test-cases`.
1. The list is built from `GET /api/v1/test-cases` `data`.
2. Empty `data` renders “No test cases yet.”
3. Create posts `{ name, objective }` to `POST /api/v1/test-cases`.

## Minimal guarantee (on failure)
1. An empty list stays empty (Decision A).
2. A queued response is not claimed as a passed engine run.

## Acceptance criteria
1. **AC-01 — Empty list:** No rows render "No test cases yet."
2. **AC-02 — Open case:** Suites load from GET `/api/v1/test-cases/:id/suites` and runs from GET `/api/v1/test-cases/:id/runs`.
3. **AC-03 — Create:** Save posts name and objective.
4. **AC-04 — Queue is not evidence:** "Run queued" is not Test Engine pass evidence.

## Main flow
1. **Actor:** Opens `/test-cases.html`.
   **System:** GET `/api/v1/test-cases` with optional Bearer token from sbe_token or sbe_admin_token.
2. **Actor:** Selects a case, optionally clones or creates, then runs.
   **System:** POST create / run / run-batch as implemented in the page.

## Alternate flows
1. **A1 — Select all / Clear all:** Client-side checkboxes.
2. **A2 — Console lists:** UC-tcPool / UC-tcNew remain official CONFIG pages.

## Exception flows
1. **E1 — No token:** Fetch still runs; API enforces auth.
2. **E2 — Accepted IDs are not engine execution:** See COVERAGE.md.

## Business validation
1. Visibility is not authorization.
2. Queued is not passed.
1. **AC-01 — Empty list:** Given the API returns no rows, when the desk renders, the list text is “No test cases yet.”
2. **AC-02 — Open case:** Given at least one case exists, when the operator clicks its name, suites load from `GET /api/v1/test-cases/:id/suites` and runs from `GET /api/v1/test-cases/:id/runs`.
3. **AC-03 — Create:** Given name and objective are entered, when Save test case is activated, the desk POSTs those fields and reloads the list.
4. **AC-04 — Queue is not evidence:** Given Run now or Run selected succeeds, when the status line says “Run queued” or “Queued N run(s).”, that text is not treated as Test Engine pass evidence.

## Main flow
1. **Actor:** Opens `/test-cases.html`.  
   **System:** `GET /api/v1/test-cases` with optional Bearer token.
2. **Actor:** Selects a case.  
   **System:** Shows name, suite links to `/test-suites.html#id`, and a run table with totals.
3. **Actor:** Optionally Create new or New from this case.  
   **System:** Reveals name/objective fields. Clone prefixes name with “ copy”.
4. **Actor:** Save test case.  
   **System:** `POST /api/v1/test-cases`.
5. **Actor:** Run now or Run selected.  
   **System:** `POST /api/v1/test-cases/:id/run` or `POST /api/v1/test-cases/run-batch` with `{ ids }`.

## Alternate flows
1. **A1 — Select all / Clear all:** Client-side checkbox helpers only.
2. **A2 — Console lists:** UC-tcPool / UC-tcNew remain the official CONFIG pages.

## Exception flows
1. **E1 — No token:** Fetch still runs; authorization is enforced by the API, not by hiding the desk.
2. **E2 — Suite-run acceptance:** COVERAGE.md — accepted IDs are not engine execution.

## Business validation
1. Visibility of the desk is not authorization.
2. Queued ≠ passed.
3. Decision A: no dummy rows.

## Technical notes / APIs
1. File: `apps/web/public/test-cases.html`.

### Screen and action contract
Page key proposed `testCasesDesk`. Route `/test-cases.html`. Do not alias silently to tcPool when both documents exist.

### Research and sources
BDD — Queued is an observable UI string. Engine verdicts need Test Engine adapters.

### Proposed decisions and open questions
Unresolved: sidecar vs official console ownership. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Empty list stays empty.
2. Queued is not a pass.
2. APIs used by the page: GET `/api/v1/test-cases`, POST `/api/v1/test-cases`, GET `/api/v1/test-cases/:id/suites`, GET `/api/v1/test-cases/:id/runs`, POST `/api/v1/test-cases/:id/run`, POST `/api/v1/test-cases/run-batch`.
3. Token keys observed: `sbe_token`, `sbe_admin_token`.

### Screen and action contract
Page key proposed `testCasesDesk`. Route `/test-cases.html`. Do not add to FEATURE_PAGES. Binder should not alias this path to `tcPool` if both documents exist — offer a selector.

### Research and sources
BDD — “Queued” is an observable UI string in the page source. Engine verdicts require Test Engine adapters (COVERAGE.md).

### Proposed decisions and open questions
Unresolved: whether official console should retire this sidecar or keep both. Unresolved: whether run-batch is registered on the same SHA as this HTML. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Empty list stays empty.
2. Opening a case loads suites and runs.
3. Create posts name and objective.
4. Queued is not a pass.

## Gherkin
```gherkin
Feature: View, clone, and queue test cases on the sidecar desk

  @UC-testCasesDesk @AC-01 @specification
  Scenario: Empty list
    Given the API returns no rows
    When the desk renders
    Then the list text is No test cases yet.

  @UC-testCasesDesk @AC-04 @specification
  Scenario: Queue is not evidence
    Given Run now or Run selected succeeds
    When the status line says Run queued
    Then that text is not treated as Test Engine pass evidence
```
