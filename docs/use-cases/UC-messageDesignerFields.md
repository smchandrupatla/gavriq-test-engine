# Select fields

- **ID:** UC-messageDesignerFields
- **Screen:** Select fields
- **Page key:** `messageDesignerFields`
- **Level:** 2
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Select optional fields without removing required content or confusing field presence with value validity.

## Precondition

A message schema has been selected; an empty parsed model is shown explicitly.

## Trigger

System displays the selected message field hierarchy.

## Success guarantee

Select optional fields without removing required content or confusing field presence with value validity. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An empty model is not populated with example fields. Unresolved required content prevents a claim that the selection is schema-valid.

## Acceptance criteria

1. **AC-01 [proposed]** Given OrderId is required, when the analyst attempts to deselect it, OrderId remains included.
2. **AC-02 [proposed]** Given Note is optional, when Note is deselected, the workspace selection excludes Note.
3. **AC-03 [proposed]** Given a branch is collapsed, when it is expanded, field inclusion does not change.
4. **AC-04 [proposed]** Given the selected schema has no parsed fields, when the picker opens, no invented selection is displayed.

## Main flow

1. System displays the selected message field hierarchy.
2. Analyst expands branches and inspects paths.
3. Analyst includes or excludes optional fields; required fields stay selected.
4. Analyst reviews the selection and continues to the workspace.

## Alternate flows

1. Back returns to message selection.
2. Draft-save controls, where offered, must describe what is actually persisted.

## Exception flows

1. An empty model is not populated with example fields.
2. Unresolved required content prevents a claim that the selection is schema-valid.

## Business validation

1. Expansion and selection are independent actions.
2. Required selection does not prove valid values, valid choice groups or all schema rules.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-messageDesignerFields",
  "screenName": "Select fields",
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
      "assetId": "SUBMENU-message-designer-fields",
      "kind": "submenu",
      "name": "Select fields",
      "label": "Select fields",
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
      "assetId": "SUBMENU-message-designer-fields",
      "kind": "submenu",
      "name": "Select fields",
      "label": "Select fields",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-messageDesignerFields",
      "kind": "screen",
      "name": "Select fields",
      "label": "Select fields",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-message-designer-fields-1",
      "flowKind": "main",
      "instruction": "System displays the selected message field hierarchy.",
      "screenId": "SCR-messageDesignerFields",
      "assetIds": [
        "SCR-messageDesignerFields"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-message-designer-fields-2",
      "flowKind": "main",
      "instruction": "Analyst expands branches and inspects paths.",
      "screenId": "SCR-messageDesignerFields",
      "assetIds": [
        "SCR-messageDesignerFields"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-message-designer-fields-3",
      "flowKind": "main",
      "instruction": "Analyst includes or excludes optional fields; required fields stay selected.",
      "screenId": "SCR-messageDesignerFields",
      "assetIds": [
        "SCR-messageDesignerFields"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-message-designer-fields-4",
      "flowKind": "main",
      "instruction": "Analyst reviews the selection and continues to the workspace.",
      "screenId": "SCR-messageDesignerFields",
      "assetIds": [
        "SCR-messageDesignerFields"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-message-designer-fields-1",
      "flowKind": "alternate",
      "instruction": "Back returns to message selection.",
      "screenId": "SCR-messageDesignerFields",
      "assetIds": [
        "SCR-messageDesignerFields"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Back returns to message selection.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-message-designer-fields-2",
      "flowKind": "alternate",
      "instruction": "Draft-save controls, where offered, must describe what is actually persisted.",
      "screenId": "SCR-messageDesignerFields",
      "assetIds": [
        "SCR-messageDesignerFields"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Draft-save controls, where offered, must describe what is actually persisted.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-message-designer-fields-1",
      "flowKind": "exception",
      "instruction": "An empty model is not populated with example fields.",
      "screenId": "SCR-messageDesignerFields",
      "assetIds": [
        "SCR-messageDesignerFields"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty model is not populated with example fields.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-message-designer-fields-2",
      "flowKind": "exception",
      "instruction": "Unresolved required content prevents a claim that the selection is schema-valid.",
      "screenId": "SCR-messageDesignerFields",
      "assetIds": [
        "SCR-messageDesignerFields"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unresolved required content prevents a claim that the selection is schema-valid.",
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

- Choice-group semantics and draft persistence require tests beyond locked checkboxes.

### Research basis

- [W3C, XSD 1.1 Structures (2012 Recommendation)](https://www.w3.org/TR/xmlschema11-1/)
- [W3C WAI, ARIA Tree View Pattern (living guidance, accessed 2026-09-11)](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-messageDesignerFields and name Select fields. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Required field: OrderId is required; the analyst attempts to deselect it; expected: OrderId remains included.
2. Optional field: Note is optional; Note is deselected; expected: the workspace selection excludes Note.
3. Expansion: a branch is collapsed; it is expanded; expected: field inclusion does not change.
4. Empty model: the selected schema has no parsed fields; the picker opens; expected: no invented selection is displayed.

## Gherkin

```gherkin
Feature: Select fields

  @UC-messageDesignerFields @AC-01 @specification
  Scenario: Required field
    Given OrderId is required
    When the analyst attempts to deselect it
    Then OrderId remains included

  @UC-messageDesignerFields @AC-02 @specification
  Scenario: Optional field
    Given Note is optional
    When Note is deselected
    Then the workspace selection excludes Note

  @UC-messageDesignerFields @AC-03 @specification
  Scenario: Expansion
    Given a branch is collapsed
    When it is expanded
    Then field inclusion does not change

  @UC-messageDesignerFields @AC-04 @specification
  Scenario: Empty model
    Given the selected schema has no parsed fields
    When the picker opens
    Then no invented selection is displayed
```
