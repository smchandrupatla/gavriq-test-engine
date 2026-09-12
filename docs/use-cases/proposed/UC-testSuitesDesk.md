# Compose, membership-edit, and queue suites on the sidecar desk

- **ID:** UC-testSuitesDesk
- **Screen:** Test suites
- **Level:** 1 for list, 2 for create/compose when grants apply
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** UC-tsAll
- **Extends to:** UC-tsNew, UC-testCasesDesk

## Goal
List suites, edit case membership, compose a suite from selected suites, and queue a run without treating queue text as engine evidence.

## Precondition
1. The operator can open `/test-suites.html`.
2. GET `/api/v1/test-suites` and GET `/api/v1/test-cases` are registered.
2. `GET /api/v1/test-suites` and `GET /api/v1/test-cases` are registered.

## Trigger
Operator opens `/test-suites.html` or follows a suite hash link from the test-cases desk.

## Success guarantee
1. Suites render from GET `/api/v1/test-suites` data.
2. Empty list text is "No suites yet."
3. Membership save sends PUT `/api/v1/test-suites/:id/cases` with `{ case_ids }`.
4. Delete confirmation copy states "Cases stay."

## Minimal guarantee (on failure)
1. Empty suite list stays empty.
2. Failed membership save shows "Save failed."
3. Queued suite runs are not pass evidence.

## Acceptance criteria
1. **AC-01 — Empty list:** "No suites yet."
2. **AC-02 — Hash open:** `/test-suites.html#id` selects that suite when it exists.
3. **AC-03 — Membership:** PUT sends ticked case_ids.
4. **AC-04 — Compose:** POST `/api/v1/test-suites/from-suites` with `{ name, suiteIds }`.
5. **AC-05 — Delete keeps cases:** Confirm text is "Delete selected suites? Cases stay."

## Main flow
1. **Actor:** Opens `/test-suites.html`.
   **System:** Loads suites and cases in parallel.
2. **Actor:** Selects a suite, edits membership, runs.
   **System:** PUT membership; POST run then run-batch for Run suite.

## Alternate flows
1. **A1 — Create suite:** POST `/api/v1/test-suites` with `{ name, caseIds: [] }`.
2. **A2 — Compose:** prompt() for name; cancel returns without POST.

## Exception flows
1. **E1 — Unknown hash:** openSuite returns immediately. No dummy suite.
2. **E2 — Queue is not execute:** COVERAGE.md suite-run gap applies.

## Business validation
1. Deleting a suite must not imply deleting cases.
2. Decision A: no invented suites.

## Technical notes / APIs
1. File: `apps/web/public/test-suites.html`.
2. DELETE uses If-Match etag or `*`.

### Screen and action contract
Page key proposed `testSuitesDesk`. Route `/test-suites.html`.

### Research and sources
If-Match on DELETE is observed in the page. Server enforcement is not certified here.

### Proposed decisions and open questions
Run suite fires both `/run` and `run-batch`. Confirm whether that double-queues. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Empty list stays empty.
2. Delete confirm keeps cases.
1. Suites render from `GET /api/v1/test-suites` `data`.
2. Empty list text is “No suites yet.”
3. Membership save sends `PUT /api/v1/test-suites/:id/cases` with `{ case_ids }`.
4. Delete confirmation copy states “Cases stay.”

## Minimal guarantee (on failure)
1. Empty suite list stays empty.
2. Failed membership save shows “Save failed.” and does not invent membership.
3. Queued suite runs are not pass evidence.

## Acceptance criteria
1. **AC-01 — Empty list:** Given no suites, when the desk renders, the list text is “No suites yet.”
2. **AC-02 — Hash open:** Given `/test-suites.html#<id>` is opened and that id exists, when load finishes, that suite is selected.
3. **AC-03 — Membership:** Given a suite is open and case checkboxes change, when Save membership is activated, PUT sends the ticked `case_ids`.
4. **AC-04 — Compose:** Given one or more suites are ticked and a name is supplied, when New from selected suites is confirmed, POST `/api/v1/test-suites/from-suites` is called with `{ name, suiteIds }`.
5. **AC-05 — Delete keeps cases:** Given delete is confirmed, when suites are removed, the confirm text is “Delete selected suites? Cases stay.”

## Main flow
1. **Actor:** Opens `/test-suites.html`.  
   **System:** Loads suites and cases in parallel.
2. **Actor:** Selects a suite.  
   **System:** Shows membership checkboxes for every known case.
3. **Actor:** Saves membership.  
   **System:** PUT case_ids.
4. **Actor:** Run suite.  
   **System:** POST `/api/v1/test-suites/:id/run` then also POST `/api/v1/test-suites/run-batch` with that id.

## Alternate flows
1. **A1 — Create suite:** POST `/api/v1/test-suites` with `{ name, caseIds: [] }`.
2. **A2 — Run selected:** POST `/api/v1/test-suites/run-batch` with ticked ids.
3. **A3 — Compose:** prompt() for name; cancel returns without POST.

## Exception flows
1. **E1 — Unknown hash:** `openSuite` returns immediately if the id is not in the loaded array. No dummy suite.
2. **E2 — Save failed:** Status line uses class `err`.
3. **E3 — Queue ≠ execute:** COVERAGE.md suite-run acceptance gap applies.

## Business validation
1. Deleting a suite must not imply deleting cases — confirm copy says cases stay.
2. Decision A: no invented suites.
3. Visibility ≠ authorization.

## Technical notes / APIs
1. File: `apps/web/public/test-suites.html`.
2. APIs: GET `/api/v1/test-suites`, GET `/api/v1/test-cases`, POST `/api/v1/test-suites`, PUT `/api/v1/test-suites/:id/cases`, POST `/api/v1/test-suites/:id/run`, POST `/api/v1/test-suites/run-batch`, POST `/api/v1/test-suites/from-suites`, DELETE `/api/v1/test-suites/:id` with If-Match etag or `*`.
3. Header subtitle in HTML: “View · edit membership · run · compose from other suites”.

### Screen and action contract
Page key proposed `testSuitesDesk`. Route `/test-suites.html`. Related hash deep-link from UC-testCasesDesk. Do not add to FEATURE_PAGES.

### Research and sources
HTTP If-Match on DELETE is observed in the page. This review does not certify the server enforces etag matching.

### Proposed decisions and open questions
Unresolved: run-one fires both `/run` and `run-batch` — confirm whether that double-queues. Unresolved: official console vs sidecar ownership. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Empty list stays empty.
2. Hash selects an existing suite.
3. Membership PUT uses ticked ids.
4. Compose posts suiteIds.
5. Delete confirm keeps cases.

## Gherkin
```gherkin
Feature: Compose, membership-edit, and queue suites on the sidecar desk

  @UC-testSuitesDesk @AC-01 @specification
  Scenario: Empty list
    Given no suites
    When the desk renders
    Then the list text is No suites yet.

  @UC-testSuitesDesk @AC-05 @specification
  Scenario: Delete keeps cases
    Given delete is confirmed
    When suites are removed
    Then the confirm text is Delete selected suites? Cases stay.
```
