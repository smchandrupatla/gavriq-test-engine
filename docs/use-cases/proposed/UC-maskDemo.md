# Compare the same run unmasked and masked

- **ID:** UC-maskDemo
- **Screen:** Same run, two tenants
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** none
- **Extends to:** none

## Goal
Compare the same example run fields unmasked versus masked without accepting a tenant id from the page body.

## Precondition
1. The operator can open /mask-demo.html.
2. No live run API is required for the static page.

## Trigger
Operator opens /mask-demo.html.

## Success guarantee
1. Two static columns render for the same example fields.
2. The page states that tenant_id is never taken from the client body.
3. The page does not post a tenant identifier.

## Minimal guarantee (on failure)
1. The page does not fetch or mutate run records.
2. A missing live mask API must not be inferred from this slide.

## Acceptance criteria
1. **AC-01 — Two views:** Given the page loads, when both columns render, unmasked and masked example fields are both visible.
2. **AC-02 — No tenant body:** Given the page source is inspected, when a tenant identifier is sought in a request body, the page does not post tenant_id.
3. **AC-03 — Return:** Given the operator activates Ops Console, when navigation occurs, the demo has not written a run record.
4. **AC-04 — Not evidence:** Given a control pack is assembled, when this page is cited, it is described as a static slide, not a stored run.

## Main flow
1. **Actor:** Opens /mask-demo.html.
   **System:** Shows the heading “Same run, two tenants” and two static columns.
2. **Actor:** Reads the tenant-id rule.
   **System:** Copy states tenant_id is never taken from the client body and that white-label is withheld until the official contract is attached.
3. **Actor:** Returns to the Ops Console if needed.
   **System:** Link to / performs navigation only.

## Alternate flows
1. **A1 — No session:** The page is usable without a console session.

## Exception flows
1. **E1 — No live API:** The page does not fetch or mutate run records. Failure to reach a masking API is not a defect of this slide.

## Business validation
1. Tenant identity is a server concern; the demo page must not collect tenant_id from the client body.
2. White-label marketing is withheld until the official contract is attached — stated on the page.
3. Page mockup figures are not live evidence.

## Technical notes / APIs
1. Observed: apps/web/public/mask-demo.html. Static HTML only. No fetch.
2. Example fields on the page: DbtrNm NEAR MATCH PERSON / N*** M**** P*****; InstdAmt 99000 AUD / 9**** AUD.
3. Documentation-only page key maskDemo. Binder path map: mask-demo.html → maskDemo.
4. Classification: observed implementation is the static slide. Live two-tenant masking is outside this case.

### Screen and action contract
Page key `maskDemo`. Route `/mask-demo.html`. Title “Same run, two tenants”. No API.

### Research and sources
Tenant isolation is a platform RBAC concern. This slide only states the client-body rule; it does not implement masking.

### Proposed decisions and open questions
Unresolved: whether a live two-tenant masking workspace will replace this slide. Until then, do not treat the HTML figures as stored-run evidence.

## Scenarios
1. Two views: the page loads; both columns render.
2. No tenant body: inspection finds no tenant_id POST.
3. Return: Ops Console navigation writes no run.
4. Not evidence: control-pack citation names this as a static slide.

## Gherkin
```gherkin
Feature: Compare the same run unmasked and masked

  @UC-maskDemo @AC-01 @specification
  Scenario: Two views
    Given the page loads
    When both columns render
    Then unmasked and masked example fields are both visible

  @UC-maskDemo @AC-02 @specification
  Scenario: No tenant body
    Given the page source is inspected
    When a tenant identifier is sought in a request body
    Then the page does not post tenant_id

  @UC-maskDemo @AC-03 @specification
  Scenario: Return
    Given the operator activates Ops Console
    When navigation occurs
    Then the demo has not written a run record
```
