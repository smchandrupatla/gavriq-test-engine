# Create a message definition

- **ID:** UC-messageDesigner
- **Screen:** Build a schema-ready message
- **Page key:** `messageDesigner`
- **Level:** 2
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Build a reusable message definition from an identified registered schema through the four-step wizard.

## Precondition

A readable schema is available, or the analyst can navigate to import one.

## Trigger

Analyst opens Create message definition; the system loads designer types.

## Success guarantee

Build a reusable message definition from an identified registered schema through the four-step wizard. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An empty catalogue offers import guidance. A stale or missing handoff schema cannot be replaced silently with another message type.

## Acceptance criteria

1. **AC-01 [proposed]** Given designer types load, when the wizard opens, family, message, fields and workspace are distinct steps.
2. **AC-02 [proposed]** Given the analyst selects a registered pacs schema, when Use this is activated, the workspace receives that schema identity.
3. **AC-03 [proposed]** Given no types are available, when the wizard opens, import guidance appears without invented fields.
4. **AC-04 [proposed]** Given fields have been selected, when the analyst only navigates between steps, no completed definition save is claimed.

## Main flow

1. Analyst opens Create message definition; the system loads designer types.
2. Analyst chooses a family and message; the system scopes the next choice to that selection.
3. Analyst selects optional fields while required fields remain included.
4. System opens the workspace with the selected schema and fields.
5. Analyst reviews the definition name and explicitly saves.
6. System reports the save result; generated data and delivery remain separate actions.

## Alternate flows

1. A verified Scheme Definitions handoff opens the workspace with the selected schema.
2. Back changes the current step; Start over deliberately resets the selection.

## Exception flows

1. An empty catalogue offers import guidance.
2. A stale or missing handoff schema cannot be replaced silently with another message type.

## Business validation

1. Wizard order is workflow sequencing, not UML extends.
2. Definition persistence, preview generation, saved messages and delivery are separate outcomes.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/catalog/designer-types
4. POST /api/v1/message-types
5. POST /api/v1/definitions

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-messageDesigner",
  "screenName": "Build a schema-ready message",
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
      "assetId": "SUBMENU-message-designer",
      "kind": "submenu",
      "name": "Build a schema-ready message",
      "label": "Build a schema-ready message",
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
      "assetId": "SUBMENU-message-designer",
      "kind": "submenu",
      "name": "Build a schema-ready message",
      "label": "Build a schema-ready message",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-messageDesigner",
      "kind": "screen",
      "name": "Build a schema-ready message",
      "label": "Build a schema-ready message",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-message-designer-1",
      "flowKind": "main",
      "instruction": "Analyst opens Create message definition; the system loads designer types.",
      "screenId": "SCR-messageDesigner",
      "assetIds": [
        "SCR-messageDesigner"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-message-designer-2",
      "flowKind": "main",
      "instruction": "Analyst chooses a family and message; the system scopes the next choice to that selection.",
      "screenId": "SCR-messageDesigner",
      "assetIds": [
        "SCR-messageDesigner"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-message-designer-3",
      "flowKind": "main",
      "instruction": "Analyst selects optional fields while required fields remain included.",
      "screenId": "SCR-messageDesigner",
      "assetIds": [
        "SCR-messageDesigner"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-message-designer-4",
      "flowKind": "main",
      "instruction": "System opens the workspace with the selected schema and fields.",
      "screenId": "SCR-messageDesigner",
      "assetIds": [
        "SCR-messageDesigner"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-message-designer-5",
      "flowKind": "main",
      "instruction": "Analyst reviews the definition name and explicitly saves.",
      "screenId": "SCR-messageDesigner",
      "assetIds": [
        "SCR-messageDesigner"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 6,
      "flowId": "MAIN-message-designer-6",
      "flowKind": "main",
      "instruction": "System reports the save result; generated data and delivery remain separate actions.",
      "screenId": "SCR-messageDesigner",
      "assetIds": [
        "SCR-messageDesigner"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-message-designer-1",
      "flowKind": "alternate",
      "instruction": "A verified Scheme Definitions handoff opens the workspace with the selected schema.",
      "screenId": "SCR-messageDesigner",
      "assetIds": [
        "SCR-messageDesigner"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A verified Scheme Definitions handoff opens the workspace with the selected schema.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-message-designer-2",
      "flowKind": "alternate",
      "instruction": "Back changes the current step; Start over deliberately resets the selection.",
      "screenId": "SCR-messageDesigner",
      "assetIds": [
        "SCR-messageDesigner"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Back changes the current step; Start over deliberately resets the selection.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-message-designer-1",
      "flowKind": "exception",
      "instruction": "An empty catalogue offers import guidance.",
      "screenId": "SCR-messageDesigner",
      "assetIds": [
        "SCR-messageDesigner"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty catalogue offers import guidance.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-message-designer-2",
      "flowKind": "exception",
      "instruction": "A stale or missing handoff schema cannot be replaced silently with another message type.",
      "screenId": "SCR-messageDesigner",
      "assetIds": [
        "SCR-messageDesigner"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A stale or missing handoff schema cannot be replaced silently with another message type.",
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
- apps/web/public/js/preview-parts/part-05.js
- apps/api/src/modules/registerSpecPersist.ts

### Implementation gaps and decisions

- The definition endpoint stores name/family/type/version; full field-selection and draft recovery persistence need round-trip evidence.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)
- [W3C, XSD 1.1 Structures (2012 Recommendation)](https://www.w3.org/TR/xmlschema11-1/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-messageDesigner and name Create a message definition. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/catalog/designer-types` | [apps/api/src/modules/registerIsoCatalog.ts:281](../../apps/api/src/modules/registerIsoCatalog.ts) |
| `POST /api/v1/message-types` | [apps/api/src/app.ts:390](../../apps/api/src/app.ts) |
| `POST /api/v1/definitions` | [apps/api/src/modules/registerSpecPersist.ts:48](../../apps/api/src/modules/registerSpecPersist.ts) |

## Scenarios

1. Four steps: designer types load; the wizard opens; expected: family, message, fields and workspace are distinct steps.
2. Handoff: the analyst selects a registered pacs schema; Use this is activated; expected: the workspace receives that schema identity.
3. No schemas: no types are available; the wizard opens; expected: import guidance appears without invented fields.
4. Explicit save: fields have been selected; the analyst only navigates between steps; expected: no completed definition save is claimed.

## Gherkin

```gherkin
Feature: Build a schema-ready message

  @UC-messageDesigner @AC-01 @specification
  Scenario: Four steps
    Given designer types load
    When the wizard opens
    Then family, message, fields and workspace are distinct steps

  @UC-messageDesigner @AC-02 @specification
  Scenario: Handoff
    Given the analyst selects a registered pacs schema
    When Use this is activated
    Then the workspace receives that schema identity

  @UC-messageDesigner @AC-03 @specification
  Scenario: No schemas
    Given no types are available
    When the wizard opens
    Then import guidance appears without invented fields

  @UC-messageDesigner @AC-04 @specification
  Scenario: Explicit save
    Given fields have been selected
    When the analyst only navigates between steps
    Then no completed definition save is claimed
```
