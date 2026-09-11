# Choose a message family

- **ID:** UC-messageDesignerFamily
- **Screen:** Choose a message family
- **Page key:** `messageDesignerFamily`
- **Level:** 2
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Choose a family containing a usable imported message schema.

## Precondition

The family step has loaded the designer-type response; zero families is valid.

## Trigger

Analyst opens the family step.

## Success guarantee

Choose a family containing a usable imported message schema. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A failed load is not an empty catalogue. A family with no usable type cannot create a fabricated message choice.

## Acceptance criteria

1. **AC-01 [proposed]** Given only pain and pacs types exist, when the family step loads, only those available families are offered.
2. **AC-02 [proposed]** Given the response is empty, when the step renders, the analyst receives import guidance.
3. **AC-03 [proposed]** Given pacs is available, when pacs is selected, the next step is scoped to pacs.
4. **AC-04 [proposed]** Given a family tile is selected, when the message step opens, no definition is saved by family selection.

## Main flow

1. Analyst opens the family step.
2. System groups available message types by family.
3. Analyst selects a family tile.
4. System opens the message step scoped to that family.

## Alternate flows

1. A schema handoff bypasses this selection with explicit source context.
2. Start over clears a previous family before a fresh selection.

## Exception flows

1. A failed load is not an empty catalogue.
2. A family with no usable type cannot create a fabricated message choice.

## Business validation

1. Family is a classification, not the schema version.
2. Selecting a family alone does not save a definition.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/catalog/designer-types

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-messageDesignerFamily",
  "screenName": "Choose a message family",
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
      "assetId": "SUBMENU-message-designer-family",
      "kind": "submenu",
      "name": "Choose a message family",
      "label": "Choose a message family",
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
      "assetId": "SUBMENU-message-designer-family",
      "kind": "submenu",
      "name": "Choose a message family",
      "label": "Choose a message family",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-messageDesignerFamily",
      "kind": "screen",
      "name": "Choose a message family",
      "label": "Choose a message family",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-message-designer-family-1",
      "flowKind": "main",
      "instruction": "Analyst opens the family step.",
      "screenId": "SCR-messageDesignerFamily",
      "assetIds": [
        "SCR-messageDesignerFamily"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-message-designer-family-2",
      "flowKind": "main",
      "instruction": "System groups available message types by family.",
      "screenId": "SCR-messageDesignerFamily",
      "assetIds": [
        "SCR-messageDesignerFamily"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-message-designer-family-3",
      "flowKind": "main",
      "instruction": "Analyst selects a family tile.",
      "screenId": "SCR-messageDesignerFamily",
      "assetIds": [
        "SCR-messageDesignerFamily"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-message-designer-family-4",
      "flowKind": "main",
      "instruction": "System opens the message step scoped to that family.",
      "screenId": "SCR-messageDesignerFamily",
      "assetIds": [
        "SCR-messageDesignerFamily"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-message-designer-family-1",
      "flowKind": "alternate",
      "instruction": "A schema handoff bypasses this selection with explicit source context.",
      "screenId": "SCR-messageDesignerFamily",
      "assetIds": [
        "SCR-messageDesignerFamily"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A schema handoff bypasses this selection with explicit source context.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-message-designer-family-2",
      "flowKind": "alternate",
      "instruction": "Start over clears a previous family before a fresh selection.",
      "screenId": "SCR-messageDesignerFamily",
      "assetIds": [
        "SCR-messageDesignerFamily"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Start over clears a previous family before a fresh selection.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-message-designer-family-1",
      "flowKind": "exception",
      "instruction": "A failed load is not an empty catalogue.",
      "screenId": "SCR-messageDesignerFamily",
      "assetIds": [
        "SCR-messageDesignerFamily"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed load is not an empty catalogue.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-message-designer-family-2",
      "flowKind": "exception",
      "instruction": "A family with no usable type cannot create a fabricated message choice.",
      "screenId": "SCR-messageDesignerFamily",
      "assetIds": [
        "SCR-messageDesignerFamily"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A family with no usable type cannot create a fabricated message choice.",
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

- Ready versus merely returned catalogue entries requires runtime reconciliation.

### Research basis

- [W3C WAI, ARIA Tree View Pattern (living guidance, accessed 2026-09-11)](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-messageDesignerFamily and name Choose a message family. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/catalog/designer-types` | [apps/api/src/modules/registerIsoCatalog.ts:281](../../apps/api/src/modules/registerIsoCatalog.ts) |

## Scenarios

1. Family scope: only pain and pacs types exist; the family step loads; expected: only those available families are offered.
2. No families: the response is empty; the step renders; expected: the analyst receives import guidance.
3. Select family: pacs is available; pacs is selected; expected: the next step is scoped to pacs.
4. No write: a family tile is selected; the message step opens; expected: no definition is saved by family selection.

## Gherkin

```gherkin
Feature: Choose a message family

  @UC-messageDesignerFamily @AC-01 @specification
  Scenario: Family scope
    Given only pain and pacs types exist
    When the family step loads
    Then only those available families are offered

  @UC-messageDesignerFamily @AC-02 @specification
  Scenario: No families
    Given the response is empty
    When the step renders
    Then the analyst receives import guidance

  @UC-messageDesignerFamily @AC-03 @specification
  Scenario: Select family
    Given pacs is available
    When pacs is selected
    Then the next step is scoped to pacs

  @UC-messageDesignerFamily @AC-04 @specification
  Scenario: No write
    Given a family tile is selected
    When the message step opens
    Then no definition is saved by family selection
```
