# Sign in to the Ops Console

- **ID:** UC-sessionLogin
- **Screen:** Ops Console shell + login gate
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** none
- **Extends to:** UC-overview

## Goal
Obtain a tenant session so the official Ops Console can load live bootstrap data.

## Precondition
1. The operator can open / (apps/web/public/index.html shell).
2. POST /api/v1/session/login is registered.
3. tenantSlug, username, and password are required fields on the API.

## Trigger
Operator submits tenant slug, username, and password to the login gate or an equivalent live-bind form.

## Success guarantee
1. POST /api/v1/session/login returns a token.
2. The token is stored for subsequent Authorization headers.
3. GET /api/v1/console/bootstrap can run under that session.

## Minimal guarantee (on failure)
1. Missing tenantSlug, username, or password is a validation error and issues no token.
2. Rejected credentials do not bootstrap the portal as an authenticated tenant.

## Acceptance criteria
1. **AC-01 — Required fields:** Given any of tenantSlug, username, or password is omitted, when login is posted, the API rejects the request and no token is stored.
2. **AC-02 — Successful session:** Given valid tenant credentials, when login succeeds, a token is available for later API calls.
3. **AC-03 — Bootstrap after login:** Given a token exists, when the console loads, bootstrap is requested with that session.
4. **AC-04 — Failed credentials:** Given credentials or tenant are rejected, when login completes, the operator remains on the gate and no authenticated bootstrap is claimed.

## Main flow
1. **Actor:** Opens /.
   **System:** Shows the Ops Console shell. A login gate is declared by SHELL_PAGES.id index.
2. **Actor:** Submits tenantSlug, username, and password.
   **System:** POST /api/v1/session/login validates required fields and issues a token on success.
3. **Actor:** Uses the token.
   **System:** Subsequent calls send Authorization: Bearer {token}. Bootstrap may then load catalogue and nav.

## Alternate flows
1. **A1 — Existing token:** live-bind-parts/part-13.js may reuse a portal token already in sessionStorage.
2. **A2 — Admin surface:** admin.html uses the same login API but stores sbe_admin_token. That continuation is UC-adminIdentities.

## Exception flows
1. **E1 — Validation:** Missing fields throw a validation error: tenantSlug, username and password are required.
2. **E2 — Auth failure:** Event catalogue names biz.session.login.failure. The operator sees a failed sign-in, not a tenant session.

## Business validation
1. A session belongs to one tenant. Client pages must not accept tenant_id from an unauthenticated body to switch tenant.
2. Visibility of the use-case action is not authorization. Login remains required for tenant APIs.
3. Demo credentials printed in sidecar HTML are not a production identity source.

## Technical notes / APIs
1. Declared screen: SHELL_PAGES index in apps/api/src/modules/consoleScreens.ts — title “Ops Console shell + login gate”, html /.
2. API: POST /api/v1/session/login in apps/api/src/app.ts. Events: biz.session.login.success / biz.session.login.failure in eventCatalog.ts.
3. Client writers observed: apps/web/public/js/live-bind-parts/part-13.js (sbe_token / TOKEN_KEY) and apps/web/public/js/admin.js (sbe_admin_token).
4. No dedicated standalone login.html was present in apps/web/public. The gate is part of the shell and admin.html.
5. Classification: observed API and client writers. Official visual bundle /ops-console.html is not the live API shell.

### Screen and action contract
Page key proposed `sessionLogin` (shell id `index`). Route `/`. Write API POST `/api/v1/session/login`. Read-after API GET `/api/v1/console/bootstrap`, GET `/api/v1/session/me`.

### Research and sources
OWASP ASVS session management — credentials travel only to the session endpoint; tokens stay in sessionStorage on the observed clients. This is an observation, not a certification.

### Proposed decisions and open questions
Unresolved: exact DOM of the official login gate inside the 1.4 MB ops-console bundle versus the live-bind shell. Unresolved: token key name inconsistency (sbe_token vs sbe.token vs sbe_admin_token). Do not add this key to FEATURE_PAGES.

## Scenarios
1. Required fields: omitted password; API rejects; no token.
2. Successful session: valid credentials; token stored.
3. Bootstrap after login: token present; bootstrap requested.
4. Failed credentials: operator remains unauthenticated.

## Gherkin
```gherkin
Feature: Sign in to the Ops Console

  @UC-sessionLogin @AC-01 @specification
  Scenario: Required fields
    Given any of tenantSlug, username, or password is omitted
    When login is posted
    Then the API rejects the request and no token is stored

  @UC-sessionLogin @AC-02 @specification
  Scenario: Successful session
    Given valid tenant credentials
    When login succeeds
    Then a token is available for later API calls

  @UC-sessionLogin @AC-04 @specification
  Scenario: Failed credentials
    Given credentials or tenant are rejected
    When login completes
    Then the operator remains on the gate
```
Full dressed case with ACs, flows, and Gherkin is in the review pack. Source: SHELL_PAGES.index, POST /api/v1/session/login, biz.session.login.*.
