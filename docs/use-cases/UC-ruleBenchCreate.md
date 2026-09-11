# Create a detection rule

- **ID:** UC-ruleBenchCreate
- **Screen:** Create new rule
- **Page key:** `ruleBenchCreate`
- **Level:** 1
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Save a named detection condition with an explicit, supported evaluation meaning.

## Precondition

The analyst can create rules and knows the intended field, operator and comparison values.

## Trigger

Analyst opens Create new rule and enters a meaningful name.

## Success guarantee

Save a named detection condition with an explicit, supported evaluation meaning. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Missing condition.kind is a validation failure. A lost save response is unconfirmed; a second write is not evidence that the first failed.

## Acceptance criteria

1. **AC-01 [proposed]** Given amount_gte is configured at 100, when 99, 100 and 101 are evaluated, 99 does not match while 100 and 101 match.
2. **AC-02 [proposed]** Given condition.kind is missing, when Save rule is submitted, the request is rejected with no confirmed created rule.
3. **AC-03 [proposed]** Given field_equals compares paymentMethod with TRANSFER, when the field is absent, the missing value is not silently treated as TRANSFER.
4. **AC-04 [proposed]** Given a valid save was submitted, when the response is lost, the outcome is unconfirmed until the stored rule is checked.

## Main flow

1. Analyst opens Create new rule and enters a meaningful name.
2. Analyst selects amount_gte, country_in or field_equals and supplies the relevant threshold, countries or field/value.
3. System validates the condition payload and identifies incompatible or missing values.
4. Analyst selects Save rule; the system submits the rule once.
5. System shows the returned identity and lifecycle; analyst checks the rule in Existing rules.

## Alternate flows

1. Analyst revises a rejected input and deliberately resubmits.
2. Analyst leaves without saving; no rule is inferred from a partially completed form.

## Exception flows

1. Missing condition.kind is a validation failure.
2. A lost save response is unconfirmed; a second write is not evidence that the first failed.

## Business validation

1. A rule description is not executable logic.
2. For amount_gte, exercise values below, equal to and above the threshold; country membership and field equality require explicit type and case semantics.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/rules

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-ruleBenchCreate",
  "screenName": "Create new rule",
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
      "assetId": "SUBMENU-rule-bench-create",
      "kind": "submenu",
      "name": "Create new rule",
      "label": "Create new rule",
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
      "assetId": "SUBMENU-rule-bench-create",
      "kind": "submenu",
      "name": "Create new rule",
      "label": "Create new rule",
      "parentAssetId": "MENU-rule-bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-ruleBenchCreate",
      "kind": "screen",
      "name": "Create new rule",
      "label": "Create new rule",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rule-bench-create-1",
      "flowKind": "main",
      "instruction": "Analyst opens Create new rule and enters a meaningful name.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rule-bench-create-2",
      "flowKind": "main",
      "instruction": "Analyst selects amount_gte, country_in or field_equals and supplies the relevant threshold, countries or field/value.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rule-bench-create-3",
      "flowKind": "main",
      "instruction": "System validates the condition payload and identifies incompatible or missing values.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rule-bench-create-4",
      "flowKind": "main",
      "instruction": "Analyst selects Save rule; the system submits the rule once.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-rule-bench-create-5",
      "flowKind": "main",
      "instruction": "System shows the returned identity and lifecycle; analyst checks the rule in Existing rules.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rule-bench-create-1",
      "flowKind": "alternate",
      "instruction": "Analyst revises a rejected input and deliberately resubmits.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Analyst revises a rejected input and deliberately resubmits.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rule-bench-create-2",
      "flowKind": "alternate",
      "instruction": "Analyst leaves without saving; no rule is inferred from a partially completed form.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Analyst leaves without saving; no rule is inferred from a partially completed form.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rule-bench-create-1",
      "flowKind": "exception",
      "instruction": "Missing condition.kind is a validation failure.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Missing condition.kind is a validation failure.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rule-bench-create-2",
      "flowKind": "exception",
      "instruction": "A lost save response is unconfirmed; a second write is not evidence that the first failed.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A lost save response is unconfirmed; a second write is not evidence that the first failed.",
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

- UI form-to-condition translation and numeric/case coercion need explicit fixtures. Approval separation belongs to lifecycle transitions, not this save.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)
- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-ruleBenchCreate and name Create a detection rule. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/rules` | [apps/api/src/modules/liveConsole.ts:111](../../apps/api/src/modules/liveConsole.ts) |

## Scenarios

1. Threshold boundary: amount_gte is configured at 100; 99, 100 and 101 are evaluated; expected: 99 does not match while 100 and 101 match.
2. Missing kind: condition.kind is missing; Save rule is submitted; expected: the request is rejected with no confirmed created rule.
3. Field equality: field_equals compares paymentMethod with TRANSFER; the field is absent; expected: the missing value is not silently treated as TRANSFER.
4. Save uncertainty: a valid save was submitted; the response is lost; expected: the outcome is unconfirmed until the stored rule is checked.

## Gherkin

```gherkin
Feature: Create new rule

  @UC-ruleBenchCreate @AC-01 @specification
  Scenario: Threshold boundary
    Given amount_gte is configured at 100
    When 99, 100 and 101 are evaluated
    Then 99 does not match while 100 and 101 match

  @UC-ruleBenchCreate @AC-02 @specification
  Scenario: Missing kind
    Given condition.kind is missing
    When Save rule is submitted
    Then the request is rejected with no confirmed created rule

  @UC-ruleBenchCreate @AC-03 @specification
  Scenario: Field equality
    Given field_equals compares paymentMethod with TRANSFER
    When the field is absent
    Then the missing value is not silently treated as TRANSFER

  @UC-ruleBenchCreate @AC-04 @specification
  Scenario: Save uncertainty
    Given a valid save was submitted
    When the response is lost
    Then the outcome is unconfirmed until the stored rule is checked
```
