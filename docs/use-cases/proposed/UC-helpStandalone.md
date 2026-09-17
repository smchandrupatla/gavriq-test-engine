# Read the static Help & Shortcuts page

- **ID:** UC-helpStandalone
- **Screen:** Help & Shortcuts
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** none
- **Extends to:** UC-helpCenter, UC-keyboardShortcuts

## Goal
Read the shipped static help page for navigation, shortcuts, desks, and troubleshooting without changing console data.

## Precondition
1. The operator can open `/help.html`.
2. No API session is required for this page.

## Trigger
Operator opens `/help.html` or follows a Help link from About, pitch, or not-production pages.

## Success guarantee
1. The page title is "Help — GARVIQ Labs".
1. The page title is “Help — GARVIQ Labs”.
2. Keyboard shortcuts, sidebar sections, rule/dataset/run guidance, desk ports, and troubleshooting links are visible.
3. Opening the page does not write form or catalogue data.

## Minimal guarantee (on failure)
1. A missing Help Center or missing Test Engine health endpoint does not blank this static page.
2. Dead desk links do not mutate Sand Bench records.

## Acceptance criteria
1. **AC-01 — Static load:** Given `/help.html` is requested, when the page renders, the heading "Help & Shortcuts" is present.
1. **AC-01 — Static load:** Given `/help.html` is requested, when the page renders, the heading “Help & Shortcuts” is present.
2. **AC-02 — Shortcut list:** Given the page is open, when the Keyboard Shortcuts section is read, `?`, `g` then `d`/`r`/`t`/`s`/`h`, `/`, Ctrl/Cmd+S, and Escape are listed.
3. **AC-03 — No write:** Given the operator only reads the page, when they leave for `/`, no test case, rule, or run record is created by this page.
4. **AC-04 — Distinct from Help Center:** Given `/help.html` and `/help-center.html` both exist, when a binder resolves the current document, the static page is not substituted with a Help Center topic.

## Main flow
1. **Actor:** Opens `/help.html`.
   **System:** Serves static HTML. No fetch to `/api/v1/*` is present in the page source.
2. **Actor:** Reads shortcuts and navigation lists.
   **System:** Displays the lists authored in `apps/web/public/help.html`.
3. **Actor:** Follows Ops Console, About, or a desk URL.
   **System:** Navigates. This page performs no POST.

## Alternate flows
1. **A1 — Test Hub link:** The header links to `http://127.0.0.1:8091`. Testhub is optional.
2. **A2 — Desk ports:** API Desk :8093, MQ Desk :8092, Kafka Desk :8095, Test Engine :8098.
3. **A3 — Continue in Help Center:** UC-helpCenter is the searchable topic tree; this page does not load `topics.js`.

## Exception flows
1. **E1 — Test Engine down:** Troubleshooting points at `:8098/health`. This page still renders.
2. **E2 — Binder collision:** Title-matching "Help" must not silently open UC-overview.

## Business validation
1. Help text cannot grant a feature the runtime does not support.
2. Testhub and desks are optional counterpart apps.
3. Shortcuts must stay aligned with `ux-pack.js`.

## Technical notes / APIs
1. File: `apps/web/public/help.html`. No API calls.
2. Not a FEATURE_PAGES key.

### Screen and action contract
Page key proposed `helpStandalone`. Route `/help.html`. Write API: none.

### Research and sources
WCAG 2.2 — static pages still need a visible title. Observation only.

### Proposed decisions and open questions
Unresolved: whether console Help nav opens `/help.html`, `/help-center.html`, or the overlay. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Static load.
2. Shortcut list includes `?` and `g h`.
3. Read-only.
4. Distinct from Help Center.
1. **Actor:** Opens `/help.html`.  
   **System:** Serves static HTML. No fetch to `/api/v1/*` is present in the page source.
2. **Actor:** Reads shortcuts and navigation lists.  
   **System:** Displays the lists authored in `apps/web/public/help.html`.
3. **Actor:** Follows Ops Console, About, or a desk URL.  
   **System:** Navigates. This page performs no POST.

## Alternate flows
1. **A1 — Test Hub link:** The header links to `http://127.0.0.1:8091`. Testhub is optional; a failed tab does not fail this use case.
2. **A2 — Desk ports:** External Systems lists API Desk :8093, MQ Desk :8092, Kafka Desk :8095, Test Engine :8098.
3. **A3 — Continue in Help Center:** Related UC-helpCenter is the searchable topic tree; this page does not load `topics.js`.

## Exception flows
1. **E1 — Test Engine down:** Troubleshooting tells the operator to check `http://127.0.0.1:8098/health`. This page itself still renders.
2. **E2 — Binder collision:** If a use-case action title-matches “Help”, it must not silently open UC-overview.

## Business validation
1. Help text cannot grant a feature the runtime does not support.
2. Testhub and desks are optional counterpart apps, not the queue manager.
3. Shortcuts documented here must stay aligned with `ux-pack.js` (UC-keyboardShortcuts).

## Technical notes / APIs
1. File: `apps/web/public/help.html`. No API calls in the document.
2. Classification: observed static shell. Not a FEATURE_PAGES key.

### Screen and action contract
Page key proposed `helpStandalone`. Route `/help.html`. Write API: none. Related path `/help-center.html` stays `helpCenter`.

### Research and sources
WCAG 2.2 — static documentation pages still need a visible title and working in-page headings. This is an observation, not a certification.

### Proposed decisions and open questions
Unresolved: whether the console Help nav should open `/help.html`, `/help-center.html`, or the in-console help overlay. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Static load: `/help.html` returns the Help & Shortcuts heading.
2. Shortcut list includes `?` and `g h`.
3. Read-only: leaving the page creates no records.
4. Distinct document from Help Center.

## Gherkin
```gherkin
Feature: Read the static Help & Shortcuts page

  @UC-helpStandalone @AC-01 @specification
  Scenario: Static load
    Given /help.html is requested
    When the page renders
    Then the heading Help & Shortcuts is present

  @UC-helpStandalone @AC-03 @specification
  Scenario: No write
    Given the operator only reads the page
    When they leave for /
    Then no test case, rule, or run record is created by this page

  @UC-helpStandalone @AC-04 @specification
  Scenario: Distinct from Help Center
    Given /help.html and /help-center.html both exist
    When a binder resolves the current document
    Then the static page is not substituted with a Help Center topic
```
