# Review admin identities on the sidecar admin surface

- **ID:** UC-adminIdentities
- **Screen:** Admin identities
- **Level:** 1
- **Style:** casual
- **Actor:** Administrator
- **Extends from:** UC-sessionLogin
- **Extends to:** UC-users, UC-roles

## Goal
Sign in on the separate administration surface and read users and functional access profiles for the current tenant.

## Precondition
1. The operator can open /admin.html.
2. POST /api/v1/session/login and GET /api/v1/admin/users are registered.
3. JSX Ops Console nav has no admin item — stated on the page.

## Trigger
Operator opens /admin.html and submits the Administrator sign-in card.

## Success guarantee
1. A token is stored as sbe_admin_token.
2. The gate hides and the admin panel shows tenantSlug · userId from /api/v1/session/me.
3. Users and functional access profiles render from their APIs, or an error string is shown in-card.

## Minimal guarantee (on failure)
1. A failed login leaves #gate visible and writes the error into #login-err.
2. A failed users or profiles fetch does not take down the other card.
3. Empty lists show “None returned for this tenant.”

## Acceptance criteria
1. **AC-01 — Separate surface:** Given /admin.html loads, when the gate is shown, copy states this is a separate administration surface and the JSX nav is unchanged.
2. **AC-02 — Failed login:** Given login is rejected, when the promise throws, #gate remains visible and #login-err shows the message.
3. **AC-03 — Users table:** Given login succeeds and /api/v1/admin/users returns rows, when enter() renders, username, status, and email columns are shown.
4. **AC-04 — Empty tenant:** Given login succeeds and users.data is empty, when the card renders, the copy is “None returned for this tenant.”
5. **AC-05 — Independent cards:** Given users fetch fails and profiles fetch succeeds, when enter() finishes, the users card shows the error and the profiles card still renders.

## Main flow
1. **Actor:** Opens /admin.html.
   **System:** Shows #gate with tenant slug, username, and password fields and a Sign in button.
2. **Actor:** Submits Sign in.
   **System:** POST /api/v1/session/login with tenantSlug, username, password.
3. **Actor:** Receives a token.
   **System:** Stores sbe_admin_token, hides #gate, shows #admin, loads /api/v1/session/me, /api/v1/admin/users, and /api/v1/admin/functional-access-profiles.

## Alternate flows
1. **A1 — Return to console:** Back to Ops Console / links are on both gate and admin panels.
2. **A2 — Empty lists:** Zero rows render the empty copy rather than invented identities.

## Exception flows
1. **E1 — Login error:** Error message is written to #login-err. No admin panel.
2. **E2 — Partial list error:** Each card has its own try/catch.

## Business validation
1. This surface is not an official JSX nav destination.
2. Reading identities here does not implement UC-userCreate or UC-roleCreate provisioning.
3. A prefilled demo password in the HTML is an observed risk, not an accepted production practice.
4. Decision A: lists stay empty until the API returns rows.

## Technical notes / APIs
1. Observed: apps/web/public/admin.html and apps/web/public/js/admin.js.
2. Declared: SHELL_PAGES admin — title Admin identities, read /api/v1/admin/users.
3. Additional observed read: GET /api/v1/admin/functional-access-profiles and GET /api/v1/session/me.
4. Write on this page is login only. No user-create POST is issued by admin.js.
5. Classification: observed sidecar. Not a FEATURE_PAGES grant.

### Screen and action contract
Page key proposed `adminIdentities` (shell id `admin`). Route `/admin.html`. Gate controls: #tenant #username #password #login #login-err. Admin controls: #who #users #profiles. Token key sbe_admin_token.

### Research and sources
OWASP ASVS — default or demo credentials in shipped HTML must not be treated as a production identity source.

### Proposed decisions and open questions
Unresolved: whether admin.js should reuse sbe_token instead of a second key. Unresolved: whether this sidecar will be withdrawn once UC-users / UC-roles exist in the official console. FEATURE_PAGES must not gain an admin key from this case.

## Scenarios
1. Separate surface: gate copy states JSX nav is unchanged.
2. Failed login: error shown; gate remains.
3. Users table: rows render username, status, email.
4. Empty tenant: honest empty copy.
5. Independent cards: one card error does not blank the other.

## Gherkin
```gherkin
Feature: Review admin identities on the sidecar admin surface

  @UC-adminIdentities @AC-02 @specification
  Scenario: Failed login
    Given login is rejected
    When the promise throws
    Then the gate remains visible
    And the login error shows the message

  @UC-adminIdentities @AC-04 @specification
  Scenario: Empty tenant
    Given login succeeds and users.data is empty
    When the card renders
    Then the copy is None returned for this tenant
```
