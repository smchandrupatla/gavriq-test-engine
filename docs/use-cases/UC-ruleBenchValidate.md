# Validate rules against test cases

- **ID:** UC-ruleBenchValidate
- **Screen:** Validate rules
- **Page key:** `ruleBenchValidate`
- **Level:** 2
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Evaluate a rule against an identified test dataset and interpret the actual outcome.

## Precondition

The rule exists and the selected message type, sample count and seed are available where supported.

## Trigger

Analyst selects a rule for validation.

## Success guarantee

Evaluate a rule against an identified test dataset and interpret the actual outcome. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

No cases or unavailable data is not a passed validation. A processing error is distinguished from a correctly detected negative test.

## Acceptance criteria

1. **AC-01 [proposed]** Given ten cases have explicit expectations, when all ten outcomes match, the displayed result identifies ten evaluated cases.
2. **AC-02 [proposed]** Given a malformed input is expected to be rejected, when the rule correctly rejects it, the test outcome is interpreted against that expectation.
3. **AC-03 [proposed]** Given zero cases were evaluated, when validation results render, zero cases is not labelled 100% passed.
4. **AC-04 [proposed]** Given the validation service fails, when the response is handled, the screen shows an error rather than a failed business assertion.

## Main flow

1. Analyst selects a rule for validation.
2. System identifies the rule and validation inputs.
3. Analyst explicitly requests validation; the service evaluates its supported condition.
4. System displays the resulting measurements and failures.
5. Analyst reviews failing examples before staging or requesting another run.

## Alternate flows

1. A repeat with the same seed supports comparison only when input and rule versions are also unchanged.
2. A broader test run is a separate action from the rule validation endpoint.

## Exception flows

1. No cases or unavailable data is not a passed validation.
2. A processing error is distinguished from a correctly detected negative test.

## Business validation

1. Pass rate needs an explicit denominator and expected outcomes.
2. Do not invent 94% Passed or 40% Failed thresholds without a product policy.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/rules/:id/validate
4. GET /api/v1/rules

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-ruleBenchValidate",
  "screenName": "Validate rules",
  "navigation": {
    "menu": {
      "assetId": "MENU-rule-bench",
      "kind": "menu",
      "name": "Rule Bench",
      "label": "Rule Bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-rule-bench-validate",
      "kind": "submenu",
      "name": "Validate rules",
      "label": "Validate rules",
      "parentAssetId": "MENU-rule-bench",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-rule-bench",
      "kind": "menu",
      "name": "Rule Bench",
      "label": "Rule Bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-rule-bench-validate",
      "kind": "submenu",
      "name": "Validate rules",
      "label": "Validate rules",
      "parentAssetId": "MENU-rule-bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-ruleBenchValidate",
      "kind": "screen",
      "name": "Validate rules",
      "label": "Validate rules",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rule-bench-validate-1",
      "flowKind": "main",
      "instruction": "Analyst selects a rule for validation.",
      "screenId": "SCR-ruleBenchValidate",
      "assetIds": [
        "SCR-ruleBenchValidate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rule-bench-validate-2",
      "flowKind": "main",
      "instruction": "System identifies the rule and validation inputs.",
      "screenId": "SCR-ruleBenchValidate",
      "assetIds": [
        "SCR-ruleBenchValidate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rule-bench-validate-3",
      "flowKind": "main",
      "instruction": "Analyst explicitly requests validation; the service evaluates its supported condition.",
      "screenId": "SCR-ruleBenchValidate",
      "assetIds": [
        "SCR-ruleBenchValidate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rule-bench-validate-4",
      "flowKind": "main",
      "instruction": "System displays the resulting measurements and failures.",
      "screenId": "SCR-ruleBenchValidate",
      "assetIds": [
        "SCR-ruleBenchValidate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-rule-bench-validate-5",
      "flowKind": "main",
      "instruction": "Analyst reviews failing examples before staging or requesting another run.",
      "screenId": "SCR-ruleBenchValidate",
      "assetIds": [
        "SCR-ruleBenchValidate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rule-bench-validate-1",
      "flowKind": "alternate",
      "instruction": "A repeat with the same seed supports comparison only when input and rule versions are also unchanged.",
      "screenId": "SCR-ruleBenchValidate",
      "assetIds": [
        "SCR-ruleBenchValidate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A repeat with the same seed supports comparison only when input and rule versions are also unchanged.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rule-bench-validate-2",
      "flowKind": "alternate",
      "instruction": "A broader test run is a separate action from the rule validation endpoint.",
      "screenId": "SCR-ruleBenchValidate",
      "assetIds": [
        "SCR-ruleBenchValidate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A broader test run is a separate action from the rule validation endpoint.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rule-bench-validate-1",
      "flowKind": "exception",
      "instruction": "No cases or unavailable data is not a passed validation.",
      "screenId": "SCR-ruleBenchValidate",
      "assetIds": [
        "SCR-ruleBenchValidate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No cases or unavailable data is not a passed validation.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rule-bench-validate-2",
      "flowKind": "exception",
      "instruction": "A processing error is distinguished from a correctly detected negative test.",
      "screenId": "SCR-ruleBenchValidate",
      "assetIds": [
        "SCR-ruleBenchValidate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A processing error is distinguished from a correctly detected negative test.",
      "backgroundEvents": []
    }
  ],
  "auditActions": [],
  "events": [],
  "backgroundEvents": [],
  "provenance": "catalogue"
}
```

### Additional notes

### Source evidence

- apps/api/src/modules/liveConsole.ts
- apps/api/src/modules/detectionRules.ts

### Implementation gaps and decisions

- Current generated-data validation is not evidence of executing every assigned test case. Threshold policy and versioned input provenance remain decisions.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-ruleBenchValidate and name Validate rules against test cases. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/rules/:id/validate` | [apps/api/src/modules/liveConsole.ts:165](../../apps/api/src/modules/liveConsole.ts) |
| `GET /api/v1/rules` | [apps/api/src/modules/liveConsole.ts:104](../../apps/api/src/modules/liveConsole.ts) |

## Scenarios

1. Perfect evidence: ten cases have explicit expectations; all ten outcomes match; expected: the displayed result identifies ten evaluated cases.
2. Negative test: a malformed input is expected to be rejected; the rule correctly rejects it; expected: the test outcome is interpreted against that expectation.
3. No evidence: zero cases were evaluated; validation results render; expected: zero cases is not labelled 100% passed.
4. Evaluation error: the validation service fails; the response is handled; expected: the screen shows an error rather than a failed business assertion.

## Gherkin

```gherkin
Feature: Validate rules

  @UC-ruleBenchValidate @AC-01 @specification
  Scenario: Perfect evidence
    Given ten cases have explicit expectations
    When all ten outcomes match
    Then the displayed result identifies ten evaluated cases

  @UC-ruleBenchValidate @AC-02 @specification
  Scenario: Negative test
    Given a malformed input is expected to be rejected
    When the rule correctly rejects it
    Then the test outcome is interpreted against that expectation

  @UC-ruleBenchValidate @AC-03 @specification
  Scenario: No evidence
    Given zero cases were evaluated
    When validation results render
    Then zero cases is not labelled 100% passed

  @UC-ruleBenchValidate @AC-04 @specification
  Scenario: Evaluation error
    Given the validation service fails
    When the response is handled
    Then the screen shows an error rather than a failed business assertion
```
