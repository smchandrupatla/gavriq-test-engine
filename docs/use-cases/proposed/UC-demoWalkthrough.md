# Follow the 90-second N-2 demo script

- **ID:** UC-demoWalkthrough
- **Screen:** 90-second demo
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** none
- **Extends to:** UC-n2ControlWalk, UC-msgImportSchema, UC-ruleBenchCreate, UC-trNew

## Goal
Read the timed buyer demo script and execute its steps on the live console without treating demo figures as live evidence.

## Precondition
1. The operator can open `/demo.html`.
2. Fixtures `tests/fixtures/sben.001.001.01.xsd` and matching markdown are available for the import step.
3. Later console steps require matching feature grants (Import schema is level 2).

## Trigger
Operator opens `/demo.html`.
3. Later console steps require the matching feature grants (Import schema is level 2).

## Trigger
Operator opens `/demo.html` or follows “90-second demo” / “90s N-2 demo” from pitch or not-production pages.

## Success guarantee
1. The script names family `sben` and code `sben.001.001.01`.
2. The script forbids treating a resulting code of `pacs.*` as a pass.
3. Testhub on :8091 is described as optional.

## Minimal guarantee (on failure)
1. Opening `/demo.html` does not import a schema or start a run.
2. If time runs out, the page says to cut step 5 (Testhub) only.

## Acceptance criteria
1. **AC-01 — Script page:** Given `/demo.html` loads, fixtures are named `sben.001.001.01`.
2. **AC-02 — Not pacs:** If the live import result code is `pacs.*`, the demo is failed per the script.
3. **AC-03 — Optional Testhub:** Testhub down still allows a bench run.
4. **AC-04 — Evidence file:** Linked JSON is the leave-behind, not a mockup figure.

## Main flow
1. **Actor:** Opens `/demo.html`.
   **System:** Serves the static script. No API write.
2. **Actor:** Follows steps 1-4 on Import schema, definition, Rule Bench, New test run.
   **System:** Those screens behave as their own use cases.
3. **Actor:** Optionally opens Testhub :8091 and downloads suite evidence.
   **System:** Simulator or unreachable; product still sent.

## Alternate flows
1. **A1 — Cut Testhub:** If time dies, cut step 5 only.
2. **A2 — Full N-2 topic:** UC-n2ControlWalk is the help-topic form of the same walk.

## Exception flows
1. **E1 — Wrong family:** Result code `pacs.*` fails the demo.
2. **E2 — Missing condition.kind:** HTTP 422 `validation_failed`.
1. **AC-01 — Script page:** Given `/demo.html` loads, when the operator reads the heading, “Good rules survive bad data.” is present and fixtures are named `sben.001.001.01`.
2. **AC-02 — Not pacs:** Given the import step completes on the live console, when the result code is `pacs.*`, the demo is failed per the script.
3. **AC-03 — Optional Testhub:** Given Testhub is down, when step 5 is skipped, the script still treats the bench run as valid.
4. **AC-04 — Evidence file:** Given suite `ts_seed_regression` exists, when evidence is downloaded from the linked JSON, keys include kind, tenant, scheme, schemaHash, cases, totals as stated on the page.

## Main flow
1. **Actor:** Opens `/demo.html`.  
   **System:** Serves the static script. No API write.
2. **Actor:** Room-checks compose health and opens `/`.  
   **System:** Console shell loads separately (UC-sessionLogin / UC-overview).
3. **Actor:** Follows steps 1–4 on Import schema, message definition, Rule Bench, New test run.  
   **System:** Those screens behave as their own use cases.
4. **Actor:** Optionally opens Testhub :8091.  
   **System:** Simulator inbox, or unreachable — product still sent.
5. **Actor:** Downloads suite evidence JSON.  
   **System:** Static or generated file at `/suite-evidence-ts_seed_regression.json`.

## Alternate flows
1. **A1 — Cut Testhub:** Page instruction: if time dies, cut step 5 only.
2. **A2 — Full N-2 topic:** UC-n2ControlWalk is the help-topic form of the same walk.

## Exception flows
1. **E1 — Wrong family:** Result code becoming `pacs.*` fails the demo.
2. **E2 — Missing condition.kind:** Script states HTTP 422 `validation_failed`.
3. **E3 — Testhub down:** Allowed; do not call Testhub IBM MQ.

## Business validation
1. `sben` is a demo notification family, not pacs.
2. Leave-behind is evidence JSON.
2. Leave-behind quote is the evidence JSON, not a mockup figure.
3. Testhub is an HTTP simulator.

## Technical notes / APIs
1. File: `apps/web/public/demo.html`.
2. Live writes belong to UC-msgImportSchema, UC-ruleBenchCreate, UC-trNew.
2. Linked evidence path: `/suite-evidence-ts_seed_regression.json`.
3. Live writes belong to UC-msgImportSchema, UC-ruleBenchCreate, UC-trNew — not this page.

### Screen and action contract
Page key proposed `demoWalkthrough`. Route `/demo.html`. Write API: none on this page.

### Research and sources
ISO 20022 family codes come from the catalogue, not demo copy.

### Proposed decisions and open questions
Unresolved: whether `/suite-evidence-ts_seed_regression.json` is generated or checked in. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Script page names sben fixtures.
2. pacs.* fails the demo.
3. Testhub is optional.
ISO 20022 family codes are assigned by the catalogue, not by demo copy. The script’s “fail if pacs.*” rule is a product demo control, not an ISO rule.

### Proposed decisions and open questions
Unresolved: whether `/suite-evidence-ts_seed_regression.json` is always generated or a checked-in fixture. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Script page loads with sben fixtures named.
2. pacs.* result fails the demo.
3. Testhub down still allows a bench run.
4. Evidence JSON is the leave-behind.

## Gherkin
```gherkin
Feature: Follow the 90-second N-2 demo script

  @UC-demoWalkthrough @AC-01 @specification
  Scenario: Script page
    Given /demo.html loads
    When the operator reads the heading
    Then fixtures are named sben.001.001.01

  @UC-demoWalkthrough @AC-02 @specification
  Scenario: Not pacs
    Given the import step completes on the live console
    When the result code is pacs.*
    Then the demo is failed per the script

  @UC-demoWalkthrough @AC-03 @specification
  Scenario: Optional Testhub
    Given Testhub is down
    When step 5 is skipped
    Then the script still treats the bench run as valid
```
