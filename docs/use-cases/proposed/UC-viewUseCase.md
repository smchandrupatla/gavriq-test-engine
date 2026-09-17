# Open the use case for the current screen

- **ID:** UC-viewUseCase
- **Screen:** View use case
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** none
- **Extends to:** UC-useCaseEditor, UC-useCaseReview

## Goal
Read the canonical use case for the current screen or wizard step without changing the business form.

## Precondition
1. use-case-bind.js is loaded on the host page.
2. GET /api/v1/use-cases is reachable or the binder treats a failed fetch as an empty cache.
3. platform setting useCases.enabled may be true or false.

## Trigger
Operator activates the View use case control, or a wizard-step control when a step mapping exists.

## Success guarantee
1. The opened document is the mapped page key (or the single title match, or the chosen row when several apply).
2. Host form fields are unchanged.
3. When enabled is false, the action is not shown.

## Minimal guarantee (on failure)
1. A missing document does not crash the host screen.
2. A failed catalogue fetch leaves cache empty and does not substitute Overview.
3. Unmapped screens hide the control rather than opening an unrelated case. Title-match still exists as a fallback when exactly one title hits.

## Acceptance criteria
1. **AC-01 — Mapped screen:** Given the path is help-center.html and a helpCenter row exists, when View use case is activated, /use-case.html?page=helpCenter opens.
2. **AC-02 — Disabled:** Given enabled is false, when the binder ticks, the action is absent.
3. **AC-03 — Missing document:** Given the resolved page key has no catalogue row and title match is empty or ambiguous, when the binder ticks, the action is not shown and Overview is not opened.
4. **AC-04 — State preserved:** Given a form field has unsaved text, when the viewer window opens and closes, that text remains.
5. **AC-05 — Chooser:** Given two catalogue rows share the visible title, when the action is activated, a listbox lets the operator pick one document.
6. **AC-06 — Fetch failure:** Given GET /api/v1/use-cases fails, when the binder catches the error, the host screen remains usable.

## Main flow
1. **Actor:** Lands on a console screen or standalone HTML page.
   **System:** Binder fetches /api/v1/use-cases, reads enabled and data, and injects a UC button after the page title when candidates exist.
2. **Actor:** Activates View use case.
   **System:** Opens /use-case.html?page={key} in a named window sbe-usecase.
3. **Actor:** On a Message Designer wizard step with a unique title match.
   **System:** A second button may open sbe-usecase-step for that step key.

## Alternate flows
1. **A1 — Multiple documents:** A role=listbox chooser lists id · name for each candidate.
2. **A2 — Configuration page:** A checkbox #sbe-usecase-enabled PATCHes /api/v1/settings/use-cases with {enabled} and hides or shows the action on the next inject.
3. **A3 — Path map:** Standalone files help-center.html, mask-demo.html, bring-your-own-xsd.html, help.html, about.html, use-case.html, use-case-review.html resolve without relying on the title.
4. **A4 — Hash aliases:** datasets→dsAll, testCases→tcPool, testSuites→tsAll, testCasesBrowse→tcPool, testCasesNew→tcNew.

## Exception flows
1. **E1 — Disabled setting:** enabled false removes #sbe-usecase-btn and #sbe-usecase-chooser. On main, already-open viewer windows are not force-closed.
2. **E2 — Empty candidates:** No button is injected. Title-match is used only when path/hash resolution produced no row.
3. **E3 — Network error:** catch sets cache to [] and calls injectBtn. The host page does not throw.

## Business validation
1. Visibility is not authorization. APIs still enforce tenant auth.
2. Business workflow must not change when the viewer opens or closes.
3. Never substitute an unrelated document for a missing mapping.
4. Tenant-authored revisions stay insert-only on seed. This case does not overwrite them.

## Technical notes / APIs
1. Observed on main: apps/web/public/js/use-case-bind.js. Viewer page: apps/web/public/use-case.html (UC-useCaseEditor).
2. Settings: GET/PATCH /api/v1/settings/use-cases. Catalogue: GET /api/v1/use-cases.
3. Open PRs 24 and 25 propose an in-console overlay, BroadcastChannel close-on-disable, and nested {useCases:{enabled}} settings. Those are not on main at SHA 3d52436.
4. Classification: observed binder behaviour on main. Title-match remains a substitution risk when two screens share a title (schema-tree.html uses “Import schema”).

### Screen and action contract
Control: button#sbe-usecase-btn, aria-label starts with “View use case”, tooltip title same. Step control: button#sbe-usecase-step-btn. Chooser: #sbe-usecase-chooser role=listbox. Enable checkbox: #sbe-usecase-enabled. Viewer URL: /use-case.html?page={page}.

### Research and sources
W3C WCAG 2.2 — accessible name on the icon-like UC button, keyboard activation (Enter/Space handled in addition to native button behaviour).

### Proposed decisions and open questions
Open: force-close of named viewer windows when disabled (PR 25). Open: in-console overlay versus window.open (PR 24). Open: schema-tree.html title “Import schema” colliding with UC-msgImportSchema title-match. Open: /use-case.html without ?page= still defaults to overview inside the editor.

## Scenarios
1. Mapped screen: Help Center path resolves to helpCenter.
2. Disabled: checkbox off; button gone.
3. Missing document: unmapped screen; no Overview substitute.
4. State preserved: unsaved field survives viewer open/close.
5. Chooser: two title hits; listbox shown.
6. Fetch failure: host screen still usable.

## Gherkin
```gherkin
Feature: Open the use case for the current screen

  @UC-viewUseCase @AC-01 @specification
  Scenario: Mapped screen
    Given the path is help-center.html and a helpCenter row exists
    When View use case is activated
    Then /use-case.html?page=helpCenter opens

  @UC-viewUseCase @AC-02 @specification
  Scenario: Disabled
    Given enabled is false
    When the binder ticks
    Then the action is absent

  @UC-viewUseCase @AC-03 @specification
  Scenario: Missing document
    Given the resolved page key has no catalogue row and title match is empty
    When the binder ticks
    Then the action is not shown

  @UC-viewUseCase @AC-04 @specification
  Scenario: State preserved
    Given a form field has unsaved text
    When the viewer window opens and closes
    Then that text remains
```
Observed: apps/web/public/js/use-case-bind.js. Proposed AC-06: do not substitute Overview when unmapped.
