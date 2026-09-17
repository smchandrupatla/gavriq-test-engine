# Open the public URL card

- **ID:** UC-publicUrls
- **Screen:** Sand Bench — public URLs
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** none
- **Extends to:** UC-helpStandalone, UC-demoWalkthrough, UC-notProduction, UC-bringYourOwnXsd, UC-maskDemo

## Goal
Reach the public static surfaces from one URL card without marketing admin or white-label.

## Precondition
1. The operator can open `/pitch.html`.

## Trigger
Operator opens `/pitch.html`.

## Success guarantee
1. The card lists Console, Help, Help PDF, About, 90-second demo, Not production, Bring your own XSD, Same run two masks, Evidence JSON, and optional Test Hub.
2. Admin and white-label are not marketed until official contracts are attached.
3. Testhub is not renamed.

## Minimal guarantee (on failure)
1. A missing Testhub tab does not remove the card.
2. The card does not create tenant records.

## Acceptance criteria
1. **AC-01 — Card load:** Heading is "Good rules survive bad data."
2. **AC-02 — Listed surfaces:** hrefs include `/`, `/help.html`, `/about.html`, `/demo.html`, `/not-production.html`, `/bring-your-own-xsd.html`, `/mask-demo.html`.
3. **AC-03 — No admin marketing:** Admin and white-label are withheld as sold URLs.
4. **AC-04 — Testhub name:** Testhub is not renamed.

## Main flow
1. **Actor:** Opens `/pitch.html`.
   **System:** Serves the static list.
2. **Actor:** Follows one listed href.
   **System:** Navigates. No POST.

## Alternate flows
1. **A1 — Help PDF:** `/Sand-Bench-Help-Manual.pdf` is linked; file bytes are not certified here.

## Exception flows
1. **E1 — Missing PDF:** Asset gap, not a console write failure.

## Business validation
1. Admin and white-label stay unpublished until contracts exist.

## Technical notes / APIs
1. File: `apps/web/public/pitch.html`. No API.

### Screen and action contract
Page key proposed `publicUrls`. Route `/pitch.html`.

### Research and sources
Page copy is the source.

### Proposed decisions and open questions
Do not add this key to FEATURE_PAGES.

## Scenarios
1. Card loads.
2. Admin is not marketed.
Operator opens `/pitch.html` or follows “URL set” from the demo page.

## Success guarantee
1. The card lists Console, Help, Help PDF, About, 90-second demo, Not production, Bring your own XSD, Same run two masks, Evidence JSON, and optional Test Hub.
2. The card states admin and white-label are not marketed until official contracts are attached.
3. Testhub is not renamed.

## Minimal guarantee (on failure)
1. A missing optional Testhub tab does not remove the card.
2. The card does not create tenant records.

## Acceptance criteria
1. **AC-01 — Card load:** Given `/pitch.html` loads, when the heading is read, “Good rules survive bad data.” is present.
2. **AC-02 — Listed surfaces:** Given the list is visible, when each href is inspected, `/`, `/help.html`, `/about.html`, `/demo.html`, `/not-production.html`, `/bring-your-own-xsd.html`, and `/mask-demo.html` are present.
3. **AC-03 — No admin marketing:** Given the footer sentence is read, when admin or white-label is sought as a sold URL, the page withholds those surfaces.
4. **AC-04 — Testhub name:** Given the Testhub link is present, when the operator reads the note, Testhub is not renamed.

## Main flow
1. **Actor:** Opens `/pitch.html`.  
   **System:** Serves the static list.
2. **Actor:** Follows one listed href.  
   **System:** Navigates to that shell. This page performs no POST.

## Alternate flows
1. **A1 — Help PDF:** `/Sand-Bench-Help-Manual.pdf` is linked; this review does not certify the file bytes.
2. **A2 — Evidence JSON:** `/suite-evidence-ts_seed_regression.json` is the same leave-behind named on the demo page.

## Exception flows
1. **E1 — Missing PDF:** A broken PDF link is an asset gap, not a console write failure.

## Business validation
1. Admin and white-label stay unpublished until contracts exist — stated on the page.
2. Testhub keeps its product name.

## Technical notes / APIs
1. File: `apps/web/public/pitch.html`.
2. No API.

### Screen and action contract
Page key proposed `publicUrls`. Route `/pitch.html`. Write API: none.

### Research and sources
Page copy is the source. Do not infer a public marketing site from this card.

### Proposed decisions and open questions
Unresolved: whether `/pitch.html` should be linked from the official console chrome. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Card loads.
2. Listed hrefs match the shipped files.
3. Admin is not marketed.
4. Testhub is not renamed.

## Gherkin
```gherkin
Feature: Open the public URL card

  @UC-publicUrls @AC-01 @specification
  Scenario: Card load
    Given /pitch.html loads
    When the heading is read
    Then Good rules survive bad data. is present

  @UC-publicUrls @AC-03 @specification
  Scenario: No admin marketing
    Given the footer sentence is read
    When admin or white-label is sought as a sold URL
    Then the page withholds those surfaces
```
