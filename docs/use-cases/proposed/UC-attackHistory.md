# Review recorded attack history

- **ID:** UC-attackHistory
- **Screen:** Attack history
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** UC-sessionLogin
- **Extends to:** UC-trHistory

## Goal
Read adversarial runs recorded by GET /api/v1/attacks for the current tenant.

## Precondition
1. The operator can open /attacks.html.
2. A console session token may or may not already exist in sessionStorage.sbe_token.

## Trigger
Operator opens /attacks.html.

## Success guarantee
1. With a token and HTTP 200, the table lists id, kind, owasp, message_type_code, blocked/delivered, created_at.
2. Zero rows show “No attack history for this tenant yet.”

## Minimal guarantee (on failure)
1. Without sbe_token the page asks the operator to sign in on the console first and does not call the API.
2. A non-OK response surfaces the error message and leaves the table body empty.

## Acceptance criteria
1. **AC-01 — No token:** Given sessionStorage.sbe_token is missing, when the page script runs, status is “Sign in on the console first, then reopen this page.” and no /api/v1/attacks request is required.
2. **AC-02 — Empty history:** Given a token and data.data is [], when render finishes, status is “No attack history for this tenant yet.”
3. **AC-03 — Blocked row:** Given a row with blocked not false, when the row renders, the result cell is Blocked.
4. **AC-04 — Delivered row:** Given a row with blocked === false, when the row renders, the result cell is Delivered.
5. **AC-05 — API error:** Given the attacks request is not ok, when the catch runs, status shows the error message.

## Main flow
1. **Actor:** Opens /attacks.html.
   **System:** Shows ATTACK HISTORY and a table skeleton.
2. **Actor:** Script reads sbe_token and fetches /api/v1/attacks.
   **System:** Renders rows from data.data or an empty/error status.

## Alternate flows
1. **A1 — Return:** Back to console navigates to /.

## Exception flows
1. **E1 — Missing token:** Status copy only; no fetch.
2. **E2 — HTTP error:** status.textContent = error.message.

## Business validation
1. Official run history remains UC-trHistory. This page is an extra route declared on SHELL_PAGES.
2. Blocked versus delivered is taken from row.blocked !== false. A missing blocked field is treated as Blocked.
3. Decision A: the table body stays empty until the API returns rows.

## Technical notes / APIs
1. Observed: apps/web/public/attacks.html inline script. Token key sbe_token (not sbe_admin_token).
2. Declared: SHELL_PAGES attacks — read GET /api/v1/attacks. Official list note: trHistory.
3. Classification: observed sidecar list. Creating attacks is not in this page’s script.

### Screen and action contract
Page key proposed `attackHistory` (shell id `attacks`). Route `/attacks.html`. Status #status. Table body #rows. API GET `/api/v1/attacks` with Authorization Bearer sbe_token.

### Research and sources
OWASP names appear as a column populated by the API field `owasp`. This page does not classify attacks itself.

### Proposed decisions and open questions
Unresolved: whether /attacks.html should be withdrawn in favour of trHistory only. Unresolved: token key mismatch with admin.html. Do not add this key to FEATURE_PAGES.

## Scenarios
1. No token: sign-in instruction; no list claimed.
2. Empty history: honest empty status.
3. Blocked row: result Blocked.
4. Delivered row: result Delivered.
5. API error: status shows the message.

## Gherkin
```gherkin
Feature: Review recorded attack history

  @UC-attackHistory @AC-01 @specification
  Scenario: No token
    Given sessionStorage.sbe_token is missing
    When the page script runs
    Then status tells the operator to sign in on the console first

  @UC-attackHistory @AC-02 @specification
  Scenario: Empty history
    Given a token and data.data is empty
    When render finishes
    Then status is No attack history for this tenant yet

  @UC-attackHistory @AC-03 @specification
  Scenario: Blocked row
    Given a row with blocked not false
    When the row renders
    Then the result cell is Blocked
```
