# Repeat the N-2 control walk

- **ID:** UC-n2ControlWalk
- **Screen:** N-2 control walk
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** none
- **Extends to:** UC-msgImportSchema, UC-ruleBenchCreate, UC-trNew

## Goal
Repeat the N-2 control walk using shipped sben fixtures without treating demo figures as live evidence.

## Precondition
1. The operator can reach Import schema, Rule Bench create, New test run, and suite evidence when those features are granted.
2. sben fixtures such as tests/fixtures/sben.001.001.01.xsd are available in the repository.

## Trigger
Operator opens the N-2 control walk help topic or follows the numbered list on Bring your own XSD.

## Success guarantee
1. A stored scheme identity exists after a confirmed Import schema upload.
2. A detection rule is submitted with an explicit condition.kind.
3. A new test run on channel mq distinguishes captured count from a mockup figure.
4. Suite evidence JSON, when downloaded, is suite evidence rather than a fabricated pass count.

## Minimal guarantee (on failure)
1. Same-hash import remains 409 and is not forced as a new scheme.
2. A missing condition.kind remains 422.
3. Testhub 0 is valid if the hub is down — fail-open is documented in All test runs help.

## Acceptance criteria
1. **AC-01 — Import first:** Given sben.001 fixtures are available, when Import schema confirms upload, a stored scheme identity exists.
2. **AC-02 — Explicit kind:** Given the rule form is submitted without condition.kind, when save runs, the API rejects the rule.
3. **AC-03 — MQ run:** Given a valid type and mq channel are chosen, when Send is activated, the run result distinguishes captured count from a mockup figure.
4. **AC-04 — Evidence:** Given a suite exists, when evidence download is requested, the file is suite evidence, not a fabricated pass count.

## Main flow
1. **Actor:** Opens the N-2 control walk help topic or the BYO XSD numbered list.
   **System:** Shows the five-step walk: import sben.001 with markdown, generate a near-match debtor name, create a detection rule with explicit condition.kind, start an mq run, download suite evidence JSON.
2. **Actor:** Imports sben.001 with markdown on Import schema.
   **System:** Further storage behaviour is UC-msgImportSchema.
3. **Actor:** Creates a detection rule with an explicit condition.kind.
   **System:** Further persistence is UC-ruleBenchCreate.
4. **Actor:** Starts a new test run on channel mq.
   **System:** Further run behaviour is UC-trNew.

## Alternate flows
1. **A1 — Testhub down:** Testhub 0 is valid if the hub is down.
2. **A2 — Pause after import:** The walk can be paused after import; later steps use the stored scheme identity.
3. **A3 — Skip landing:** The operator may start on Import schema without opening Bring your own XSD.

## Exception flows
1. **E1 — Duplicate hash:** Same-hash import is 409 and must not be forced as a new scheme.
2. **E2 — Missing kind:** A missing condition.kind is 422; the walk must not invent a default condition.
3. **E3 — Suite acceptance is not execution:** Suite-run handlers that return accepted IDs without invoking the engine must not be treated as a passing walk. See COVERAGE.md.

## Business validation
1. sben is a demo notification family, not pacs.
2. Good rules survive bad data — the walk exists to prove a rule before production, not to certify Testhub.
3. Evidence JSON is the leave-behind; page mockup figures are not live data.

## Technical notes / APIs
1. Observed copy: apps/web/public/help/topics.js topic n2-walk and apps/web/public/bring-your-own-xsd.html numbered list.
2. Composed use cases: UC-msgImportSchema, UC-ruleBenchCreate, UC-trNew, plus suite evidence download.
3. Not a native CONFIG page. Documentation key n2ControlWalk. Proposed alias n2-walk.
4. Classification: confirmed requirement in help copy; implementation of each step lives in the composed cases and may still have gaps.

### Screen and action contract
Page key `n2ControlWalk`. Help topic id `n2-walk`. Related landing `/bring-your-own-xsd.html`. No dedicated walk API.

### Research and sources
ISO 20022 family codes used on the landing page (sben / pain / pacs) are labels in product copy. sben is explicitly not pacs.

### Proposed decisions and open questions
Unresolved: scheduling timezone and missed-run policy are out of scope for this walk. Unresolved: suite-run acceptance versus engine execution remains an implementation gap in COVERAGE.md.

## Scenarios
1. Import first: fixtures available; confirmed upload; stored scheme identity exists.
2. Explicit kind: rule submitted without condition.kind; API rejects.
3. MQ run: valid type and mq channel; result distinguishes captured count from mockup figures.
4. Evidence: suite exists; download is suite evidence JSON.

## Gherkin
```gherkin
Feature: Repeat the N-2 control walk

  @UC-n2ControlWalk @AC-01 @specification
  Scenario: Import first
    Given sben.001 fixtures are available
    When Import schema confirms upload
    Then a stored scheme identity exists

  @UC-n2ControlWalk @AC-02 @specification
  Scenario: Explicit kind
    Given the rule form is submitted without condition.kind
    When save runs
    Then the API rejects the rule

  @UC-n2ControlWalk @AC-03 @specification
  Scenario: MQ run
    Given a valid type and mq channel are chosen
    When Send is activated
    Then the run result distinguishes captured count from a mockup figure
```
