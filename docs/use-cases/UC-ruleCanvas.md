# Visually sketch a rule's decision logic

- **ID:** UC-ruleCanvas
- **Screen:** Rule Canvas
- **Page key:** `ruleCanvas`
- **Level:** 3
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Sketch rule logic in the companion canvas without claiming it has become an executable saved rule.

## Precondition

The analyst can open the standalone Rule Canvas from a supported creation screen.

## Trigger

Analyst opens the companion canvas from a creation screen.

## Success guarantee

Sketch rule logic in the companion canvas without claiming it has become an executable saved rule. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A canvas load failure leaves the original form available. Unsupported logic cannot be advertised as executable merely because it is drawn.

## Acceptance criteria

1. **AC-01 [proposed]** Given a rule form is open, when Open schematic Rule Canvas is selected, the companion opens independently.
2. **AC-02 [proposed]** Given the companion is open, when its tab is closed, no rule save is implied.
3. **AC-03 [proposed]** Given complex logic is drawn, when the sketch is reviewed, it is not labelled executed without a supported compiler.
4. **AC-04 [proposed]** Given the original form has unsaved content, when the analyst returns, the sketch has not silently submitted that form.

## Main flow

1. Analyst opens the companion canvas from a creation screen.
2. System opens the standalone canvas.
3. Analyst sketches the intended logic and inspects the representation.
4. Analyst returns to the rule form for its supported save and validation workflow.

## Alternate flows

1. The canvas can be closed without submitting the underlying form.
2. A local canvas export, if offered, is distinct from rule catalogue persistence.

## Exception flows

1. A canvas load failure leaves the original form available.
2. Unsupported logic cannot be advertised as executable merely because it is drawn.

## Business validation

1. Graph appearance is not a proof of executable rule semantics.
2. Rule saving remains a separate confirmed action.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-ruleCanvas",
  "screenName": "Rule Canvas",
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
      "assetId": "SUBMENU-rule-canvas",
      "kind": "submenu",
      "name": "Rule Canvas",
      "label": "Rule Canvas",
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
      "assetId": "SUBMENU-rule-canvas",
      "kind": "submenu",
      "name": "Rule Canvas",
      "label": "Rule Canvas",
      "parentAssetId": "MENU-rule-bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-ruleCanvas",
      "kind": "screen",
      "name": "Rule Canvas",
      "label": "Rule Canvas",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rule-canvas-1",
      "flowKind": "main",
      "instruction": "Analyst opens the companion canvas from a creation screen.",
      "screenId": "SCR-ruleCanvas",
      "assetIds": [
        "SCR-ruleCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rule-canvas-2",
      "flowKind": "main",
      "instruction": "System opens the standalone canvas.",
      "screenId": "SCR-ruleCanvas",
      "assetIds": [
        "SCR-ruleCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rule-canvas-3",
      "flowKind": "main",
      "instruction": "Analyst sketches the intended logic and inspects the representation.",
      "screenId": "SCR-ruleCanvas",
      "assetIds": [
        "SCR-ruleCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rule-canvas-4",
      "flowKind": "main",
      "instruction": "Analyst returns to the rule form for its supported save and validation workflow.",
      "screenId": "SCR-ruleCanvas",
      "assetIds": [
        "SCR-ruleCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rule-canvas-1",
      "flowKind": "alternate",
      "instruction": "The canvas can be closed without submitting the underlying form.",
      "screenId": "SCR-ruleCanvas",
      "assetIds": [
        "SCR-ruleCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The canvas can be closed without submitting the underlying form.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rule-canvas-2",
      "flowKind": "alternate",
      "instruction": "A local canvas export, if offered, is distinct from rule catalogue persistence.",
      "screenId": "SCR-ruleCanvas",
      "assetIds": [
        "SCR-ruleCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A local canvas export, if offered, is distinct from rule catalogue persistence.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rule-canvas-1",
      "flowKind": "exception",
      "instruction": "A canvas load failure leaves the original form available.",
      "screenId": "SCR-ruleCanvas",
      "assetIds": [
        "SCR-ruleCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A canvas load failure leaves the original form available.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rule-canvas-2",
      "flowKind": "exception",
      "instruction": "Unsupported logic cannot be advertised as executable merely because it is drawn.",
      "screenId": "SCR-ruleCanvas",
      "assetIds": [
        "SCR-ruleCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unsupported logic cannot be advertised as executable merely because it is drawn.",
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

- apps/web/public/js/rule-canvas-bind.js
- apps/web/public/rule-canvas/canvas.js

### Implementation gaps and decisions

- Direct model synchronisation and executable graph compilation remain unverified.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-ruleCanvas and name Visually sketch a rule's decision logic. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Separate surface: a rule form is open; Open schematic Rule Canvas is selected; expected: the companion opens independently.
2. Close: the companion is open; its tab is closed; expected: no rule save is implied.
3. No compilation claim: complex logic is drawn; the sketch is reviewed; expected: it is not labelled executed without a supported compiler.
4. Return: the original form has unsaved content; the analyst returns; expected: the sketch has not silently submitted that form.

## Gherkin

```gherkin
Feature: Rule Canvas

  @UC-ruleCanvas @AC-01 @specification
  Scenario: Separate surface
    Given a rule form is open
    When Open schematic Rule Canvas is selected
    Then the companion opens independently

  @UC-ruleCanvas @AC-02 @specification
  Scenario: Close
    Given the companion is open
    When its tab is closed
    Then no rule save is implied

  @UC-ruleCanvas @AC-03 @specification
  Scenario: No compilation claim
    Given complex logic is drawn
    When the sketch is reviewed
    Then it is not labelled executed without a supported compiler

  @UC-ruleCanvas @AC-04 @specification
  Scenario: Return
    Given the original form has unsaved content
    When the analyst returns
    Then the sketch has not silently submitted that form
```
