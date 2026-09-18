# Bring a customer XSD to Import schema

- **ID:** UC-bringYourOwnXsd
- **Screen:** Bring your own XSD
- **Level:** 2
- **Style:** casual
- **Actor:** Message analyst
- **Extends from:** none
- **Extends to:** UC-msgImportSchema

## Goal
Understand that a customer XSD plus optional markdown is imported on Import schema rather than waiting for an engineering ticket.

## Precondition
1. The landing page /bring-your-own-xsd.html can be loaded.
2. Import schema may require feature level 2.

## Trigger
Operator opens /bring-your-own-xsd.html.

## Success guarantee
1. The page names Import schema as the storage path.
2. Shipped family codes sben, pain, and pacs are listed as documentation, with sben marked as not pacs.
3. The landing page itself creates no scheme record.

## Minimal guarantee (on failure)
1. Catalogue size is not quoted as “800 messages live”.
2. Choosing a file later on Import schema does not store it until confirm upload (owned by UC-msgImportSchema).

## Acceptance criteria
1. **AC-01 — Landing:** Given the page loads, when the operator reads the instruction, Import schema is named as the storage path.
2. **AC-02 — No count claim:** Given marketing copy is reviewed, when an 800-message claim is sought, the page withholds that claim.
3. **AC-03 — Family codes:** Given sben is listed, when the operator treats it as pacs, the page states it is not pacs.
4. **AC-04 — Handoff:** Given the operator opens Import schema, when this landing page is left, no scheme record was created by the landing page itself.

## Main flow
1. **Actor:** Opens Bring your own XSD.
   **System:** Shows family codes and the Import schema instruction.
2. **Actor:** Follows the Import schema instruction.
   **System:** Further storage behaviour is UC-msgImportSchema.

## Alternate flows
1. **A1 — Help and About:** Help and About links are available from the landing page.
2. **A2 — Skip landing:** The operator may skip the landing page and open Import schema directly.

## Exception flows
1. **E1 — Count claim:** Catalogue size must not be quoted as “800 messages live” unless that count is an API field — stated on the page.
2. **E2 — No API on landing:** This page does not call the import API. Persistence, duplicate hash 409 and markdown validation belong to UC-msgImportSchema.

## Business validation
1. sben is the N-2 example and is not pacs.
2. Target coverage is ISO 20022 families via customer XSD, not a fixed shipped count.
3. Sand Bench does not wait for an engineering ticket to add a message type — stated on the page.

## Technical notes / APIs
1. Observed: apps/web/public/bring-your-own-xsd.html.
2. Links observed: /, /help.html, /about.html, http://127.0.0.1:8091 Test Hub.
3. Documentation-only page key bringYourOwnXsd. Binder path map already lists this file.
4. Classification: observed landing-page copy. Import API behaviour is not claimed here.

### Screen and action contract
Page key `bringYourOwnXsd`. Route `/bring-your-own-xsd.html`. Title “Bring your own XSD”. No API on this page.

### Research and sources
ISO 20022 pain.001 and pacs.008 names appear as documentation labels on the page. They are not evidence that those XSDs are loaded in a given tenant.

### Proposed decisions and open questions
Unresolved: whether Test Hub on 8091 is required reading for this landing page. Unresolved: catalogue count as an API field.

## Scenarios
1. Landing: page loads; Import schema is named as the storage path.
2. No count claim: 800-message claim is withheld.
3. Family codes: sben is listed as not pacs.
4. Handoff: leaving the landing page creates no scheme record.

## Gherkin
```gherkin
Feature: Bring a customer XSD to Import schema

  @UC-bringYourOwnXsd @AC-01 @specification
  Scenario: Landing
    Given the page loads
    When the operator reads the instruction
    Then Import schema is named as the storage path

  @UC-bringYourOwnXsd @AC-02 @specification
  Scenario: No count claim
    Given marketing copy is reviewed
    When an 800-message claim is sought
    Then the page withholds that claim

  @UC-bringYourOwnXsd @AC-03 @specification
  Scenario: Family codes
    Given sben is listed
    When the operator treats it as pacs
    Then the page states it is not pacs
```
