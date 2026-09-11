# Find keyboard shortcuts and self-service help

- **ID:** UC-help
- **Screen:** Help
- **Page key:** `help`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Find relevant help and verify that documented shortcuts correspond to supported actions.

## Precondition

The static help resources can be loaded.

## Trigger

Operator opens Help.

## Success guarantee

Find relevant help and verify that documented shortcuts correspond to supported actions. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A missing topic asset is disclosed. A keyboard shortcut in a text field must not unexpectedly trigger a destructive action.

## Acceptance criteria

1. **AC-01 [proposed]** Given a schema topic exists, when the operator searches its title, that topic is discoverable.
2. **AC-02 [proposed]** Given no topic matches the query, when search runs, an honest no-result state is shown.
3. **AC-03 [proposed]** Given the console supports a save shortcut, when the help shortcut list is read, the documented key and context match the binding.
4. **AC-04 [proposed]** Given Help is open, when the console link is activated, the console is reachable.

## Main flow

1. Operator opens Help.
2. System displays available topics and shortcuts.
3. Operator searches or selects a topic.
4. System shows the matching topic and an available return path.

## Alternate flows

1. An unmatched search reports no matching topic.
2. The standalone help page is usable without assuming console draft state.

## Exception flows

1. A missing topic asset is disclosed.
2. A keyboard shortcut in a text field must not unexpectedly trigger a destructive action.

## Business validation

1. Help text cannot grant a feature the runtime does not support.
2. Keyboard bindings require context-specific verification.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-help",
  "screenName": "Help",
  "navigation": {
    "menu": {
      "assetId": "MENU-configuration",
      "kind": "menu",
      "name": "Configuration",
      "label": "Configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-help",
      "kind": "submenu",
      "name": "Help",
      "label": "Help",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-configuration",
      "kind": "menu",
      "name": "Configuration",
      "label": "Configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-help",
      "kind": "submenu",
      "name": "Help",
      "label": "Help",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-help",
      "kind": "screen",
      "name": "Help",
      "label": "Help",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-help-1",
      "flowKind": "main",
      "instruction": "Operator opens Help.",
      "screenId": "SCR-help",
      "assetIds": [
        "SCR-help"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-help-2",
      "flowKind": "main",
      "instruction": "System displays available topics and shortcuts.",
      "screenId": "SCR-help",
      "assetIds": [
        "SCR-help"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-help-3",
      "flowKind": "main",
      "instruction": "Operator searches or selects a topic.",
      "screenId": "SCR-help",
      "assetIds": [
        "SCR-help"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-help-4",
      "flowKind": "main",
      "instruction": "System shows the matching topic and an available return path.",
      "screenId": "SCR-help",
      "assetIds": [
        "SCR-help"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-help-1",
      "flowKind": "alternate",
      "instruction": "An unmatched search reports no matching topic.",
      "screenId": "SCR-help",
      "assetIds": [
        "SCR-help"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unmatched search reports no matching topic.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-help-2",
      "flowKind": "alternate",
      "instruction": "The standalone help page is usable without assuming console draft state.",
      "screenId": "SCR-help",
      "assetIds": [
        "SCR-help"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The standalone help page is usable without assuming console draft state.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-help-1",
      "flowKind": "exception",
      "instruction": "A missing topic asset is disclosed.",
      "screenId": "SCR-help",
      "assetIds": [
        "SCR-help"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A missing topic asset is disclosed.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-help-2",
      "flowKind": "exception",
      "instruction": "A keyboard shortcut in a text field must not unexpectedly trigger a destructive action.",
      "screenId": "SCR-help",
      "assetIds": [
        "SCR-help"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A keyboard shortcut in a text field must not unexpectedly trigger a destructive action.",
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

- apps/web/public/help.html
- apps/web/public/help/topics.js
- apps/web/public/js/ux-pack.js

### Implementation gaps and decisions

- Help pages differ; topic search and shortcuts must be tested on the actual linked surface.

### Research basis

- [W3C, WCAG 2.2 (Recommendation), keyboard, focus and status messages](https://www.w3.org/TR/WCAG22/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-help and name Find keyboard shortcuts and self-service help. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Matching topic: a schema topic exists; the operator searches its title; expected: that topic is discoverable.
2. No match: no topic matches the query; search runs; expected: an honest no-result state is shown.
3. Shortcut accuracy: the console supports a save shortcut; the help shortcut list is read; expected: the documented key and context match the binding.
4. Return: Help is open; the console link is activated; expected: the console is reachable.

## Gherkin

```gherkin
Feature: Help

  @UC-help @AC-01 @specification
  Scenario: Matching topic
    Given a schema topic exists
    When the operator searches its title
    Then that topic is discoverable

  @UC-help @AC-02 @specification
  Scenario: No match
    Given no topic matches the query
    When search runs
    Then an honest no-result state is shown

  @UC-help @AC-03 @specification
  Scenario: Shortcut accuracy
    Given the console supports a save shortcut
    When the help shortcut list is read
    Then the documented key and context match the binding

  @UC-help @AC-04 @specification
  Scenario: Return
    Given Help is open
    When the console link is activated
    Then the console is reachable
```
