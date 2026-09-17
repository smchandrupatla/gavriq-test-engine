# Read the bench-is-not-production disclaimer

- **ID:** UC-notProduction
- **Screen:** Not production
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** none
- **Extends to:** UC-demoWalkthrough

## Goal
Confirm that Sand Bench generates and challenges test data and does not score live customer payments.

## Precondition
1. The operator can open `/not-production.html`.

## Trigger
Operator opens `/not-production.html`.
Operator opens `/not-production.html` or follows “Not production” from the demo or pitch pages.

## Success guarantee
1. The page states Sand Bench is the bench and does not score live customer payments.
2. Testhub :8091 is named an HTTP simulator, not IBM MQ.
3. Desks and Testhub are optional.
3. Desks and Testhub are optional; the console and API still run if they are down.

## Minimal guarantee (on failure)
1. The disclaimer page does not start a payment or a live scoring job.
2. A down desk does not take the console offline.

## Acceptance criteria
1. **AC-01 — Bench statement:** Heading says "Sand Bench is the bench".
2. **AC-02 — Not live payments:** Page states it does not score live customer payments.
3. **AC-03 — Testhub naming:** Testhub is an HTTP simulator and is not IBM MQ.
4. **AC-04 — Optional packages:** Desks on :8092, :8093, :8095, :8101 may be stopped; Sand Bench still runs.

## Main flow
1. **Actor:** Opens `/not-production.html`.
   **System:** Serves static HTML with no API calls.
2. **Actor:** Reads package split and follows Console, Help, demo, or evidence links.
   **System:** Navigates only.

## Alternate flows
1. **A1 — Test Engine:** Port 8098 is a post-deploy SIT dashboard with no dependency on other services being up.

## Exception flows
1. **E1 — Mislabel Testhub as IBM MQ:** Forbidden by this page.

## Business validation
1. Sand Bench is the bench; Testhub is optional.

## Technical notes / APIs
1. File: `apps/web/public/not-production.html`. No write API.

### Screen and action contract
Page key proposed `notProduction`. Route `/not-production.html`.

### Research and sources
Page copy is the naming authority for Testhub vs IBM MQ.

### Proposed decisions and open questions
Do not add this key to FEATURE_PAGES.

## Scenarios
1. Heading states the bench.
2. Testhub is not IBM MQ.
1. **AC-01 — Bench statement:** Given `/not-production.html` loads, when the heading is read, it says “Sand Bench is the bench”.
2. **AC-02 — Not live payments:** Given the page body is read, when live scoring language is sought, the page states it does not score live customer payments.
3. **AC-03 — Testhub naming:** Given Testhub is mentioned, when the operator reads the sentence, Testhub is an HTTP simulator and is not IBM MQ.
4. **AC-04 — Optional packages:** Given desks on :8092, :8093, :8095, :8101 are listed, when any of them is stopped, the page claims Sand Bench still runs.

## Main flow
1. **Actor:** Opens `/not-production.html`.  
   **System:** Serves static HTML with no API calls.
2. **Actor:** Reads package split: Rule assurance bench vs External system desks.  
   **System:** Displays the authored copy.
3. **Actor:** Follows Console, Help, 90s demo, or evidence JSON.  
   **System:** Navigates to those static or console routes.

## Alternate flows
1. **A1 — Test Engine:** Port 8098 is described as a post-deploy SIT dashboard with no dependency on other services being up.

## Exception flows
1. **E1 — Mislabel Testhub as IBM MQ:** Forbidden by this page and by UC-demoWalkthrough.

## Business validation
1. Decision from the help skill: Sand Bench is the bench; Testhub is optional.
2. White-label and admin marketing stay off this card.

## Technical notes / APIs
1. File: `apps/web/public/not-production.html`.
2. No registered write API.

### Screen and action contract
Page key proposed `notProduction`. Route `/not-production.html`. Write API: none.

### Research and sources
Product copy on the page is the authority for naming Testhub vs IBM MQ. Do not invent a queue-manager integration from this screen.

### Proposed decisions and open questions
Unresolved: whether production deployments should redirect `/` banners to this page. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Heading states the bench.
2. Live payment scoring is denied.
3. Testhub is not IBM MQ.
4. Desks are optional.

## Gherkin
```gherkin
Feature: Read the bench-is-not-production disclaimer

  @UC-notProduction @AC-01 @specification
  Scenario: Bench statement
    Given /not-production.html loads
    When the heading is read
    Then it says Sand Bench is the bench

  @UC-notProduction @AC-03 @specification
  Scenario: Testhub naming
    Given Testhub is mentioned
    When the operator reads the sentence
    Then Testhub is an HTTP simulator and is not IBM MQ
```
