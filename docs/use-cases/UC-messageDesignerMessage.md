# Choose a message

- **ID:** UC-messageDesignerMessage
- **Screen:** Choose a message
- **Page key:** `messageDesignerMessage`
- **Level:** 2
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Choose the exact message schema within the selected family.

## Precondition

A family was selected and the designer-type response is available.

## Trigger

System lists message tiles for the chosen family.

## Success guarantee

Choose the exact message schema within the selected family. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An unavailable type is not replaced with the first type in the catalogue. Two versions sharing a label need a disambiguating identity.

## Acceptance criteria

1. **AC-01 [proposed]** Given pacs is selected, when the messages render, pain messages are excluded.
2. **AC-02 [proposed]** Given a tile has zero parsed fields, when it is opened, the lack of fields is disclosed.
3. **AC-03 [proposed]** Given a message is being reviewed, when Back is selected, family selection is reachable.
4. **AC-04 [proposed]** Given two schemas have similar names, when one is selected, the next step uses its stable identity.

## Main flow

1. System lists message tiles for the chosen family.
2. Analyst reviews code, parsed-field information and available version context.
3. Analyst selects one message.
4. System opens its field model; Back returns to the family step.

## Alternate flows

1. Back allows a different family choice.
2. A tile with no fields discloses that limitation before the empty field step.

## Exception flows

1. An unavailable type is not replaced with the first type in the catalogue.
2. Two versions sharing a label need a disambiguating identity.

## Business validation

1. A field count is not proof of complete schema conformance.
2. Selection is local until an explicit persistence action.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/catalog/designer-types

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-messageDesignerMessage",
  "screenName": "Choose a message",
  "navigation": {
    "menu": {
      "assetId": "MENU-message-designer",
      "kind": "menu",
      "name": "Message Designer",
      "label": "Message Designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-message-designer-message",
      "kind": "submenu",
      "name": "Choose a message",
      "label": "Choose a message",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-message-designer",
      "kind": "menu",
      "name": "Message Designer",
      "label": "Message Designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-message-designer-message",
      "kind": "submenu",
      "name": "Choose a message",
      "label": "Choose a message",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-messageDesignerMessage",
      "kind": "screen",
      "name": "Choose a message",
      "label": "Choose a message",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-message-designer-message-1",
      "flowKind": "main",
      "instruction": "System lists message tiles for the chosen family.",
      "screenId": "SCR-messageDesignerMessage",
      "assetIds": [
        "SCR-messageDesignerMessage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-message-designer-message-2",
      "flowKind": "main",
      "instruction": "Analyst reviews code, parsed-field information and available version context.",
      "screenId": "SCR-messageDesignerMessage",
      "assetIds": [
        "SCR-messageDesignerMessage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-message-designer-message-3",
      "flowKind": "main",
      "instruction": "Analyst selects one message.",
      "screenId": "SCR-messageDesignerMessage",
      "assetIds": [
        "SCR-messageDesignerMessage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-message-designer-message-4",
      "flowKind": "main",
      "instruction": "System opens its field model; Back returns to the family step.",
      "screenId": "SCR-messageDesignerMessage",
      "assetIds": [
        "SCR-messageDesignerMessage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-message-designer-message-1",
      "flowKind": "alternate",
      "instruction": "Back allows a different family choice.",
      "screenId": "SCR-messageDesignerMessage",
      "assetIds": [
        "SCR-messageDesignerMessage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Back allows a different family choice.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-message-designer-message-2",
      "flowKind": "alternate",
      "instruction": "A tile with no fields discloses that limitation before the empty field step.",
      "screenId": "SCR-messageDesignerMessage",
      "assetIds": [
        "SCR-messageDesignerMessage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A tile with no fields discloses that limitation before the empty field step.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-message-designer-message-1",
      "flowKind": "exception",
      "instruction": "An unavailable type is not replaced with the first type in the catalogue.",
      "screenId": "SCR-messageDesignerMessage",
      "assetIds": [
        "SCR-messageDesignerMessage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unavailable type is not replaced with the first type in the catalogue.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-message-designer-message-2",
      "flowKind": "exception",
      "instruction": "Two versions sharing a label need a disambiguating identity.",
      "screenId": "SCR-messageDesignerMessage",
      "assetIds": [
        "SCR-messageDesignerMessage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Two versions sharing a label need a disambiguating identity.",
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

- apps/web/public/js/preview-parts/part-04.js

### Implementation gaps and decisions

- Version disambiguation and stale-catalogue handling need implementation evidence.

### Research basis

- [W3C, XSD 1.1 Structures (2012 Recommendation)](https://www.w3.org/TR/xmlschema11-1/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-messageDesignerMessage and name Choose a message. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/catalog/designer-types` | [apps/api/src/modules/registerIsoCatalog.ts:281](../../apps/api/src/modules/registerIsoCatalog.ts) |

## Scenarios

1. Family filter: pacs is selected; the messages render; expected: pain messages are excluded.
2. Empty model: a tile has zero parsed fields; it is opened; expected: the lack of fields is disclosed.
3. Back: a message is being reviewed; Back is selected; expected: family selection is reachable.
4. Identity: two schemas have similar names; one is selected; expected: the next step uses its stable identity.

## Gherkin

```gherkin
Feature: Choose a message

  @UC-messageDesignerMessage @AC-01 @specification
  Scenario: Family filter
    Given pacs is selected
    When the messages render
    Then pain messages are excluded

  @UC-messageDesignerMessage @AC-02 @specification
  Scenario: Empty model
    Given a tile has zero parsed fields
    When it is opened
    Then the lack of fields is disclosed

  @UC-messageDesignerMessage @AC-03 @specification
  Scenario: Back
    Given a message is being reviewed
    When Back is selected
    Then family selection is reachable

  @UC-messageDesignerMessage @AC-04 @specification
  Scenario: Identity
    Given two schemas have similar names
    When one is selected
    Then the next step uses its stable identity
```
