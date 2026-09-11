# Schema canvas

- **ID:** UC-msgSchemaCanvas
- **Screen:** Schema canvas
- **Page key:** `msgSchemaCanvas`
- **Level:** 3
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Inspect and edit a schema graph through its field property panel and supported draft actions.

## Precondition

A schema draft or supported starting model is available to the canvas.

## Trigger

Analyst opens Schema canvas and selects a draft.

## Success guarantee

Inspect and edit a schema graph through its field property panel and supported draft actions. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Deleting or unlinking a non-root node must expose broken dependencies. A failed draft save leaves no claimed persisted revision.

## Acceptance criteria

1. **AC-01 [proposed]** Given a node has required=true, when the node is selected, the panel shows that actual property.
2. **AC-02 [proposed]** Given a draft is visible, when the analyst zooms, field constraints do not change.
3. **AC-03 [proposed]** Given the root is selected, when actions are inspected, the non-root delete control is not offered for the root.
4. **AC-04 [proposed]** Given the draft save fails, when the result is displayed, the canvas does not claim a saved or published schema.

## Main flow

1. Analyst opens Schema canvas and selects a draft.
2. System displays nodes and relationships.
3. Analyst selects a node; the system shows its actual properties.
4. Analyst applies a supported edit and reviews affected relationships.
5. Analyst explicitly saves the draft and inspects validation before any publication.

## Alternate flows

1. Pan, zoom and layout change the view rather than the schema meaning.
2. Enrichment rules can be attached where their supported kind is available.

## Exception flows

1. Deleting or unlinking a non-root node must expose broken dependencies.
2. A failed draft save leaves no claimed persisted revision.

## Business validation

1. Canvas coordinates are not schema order unless a defined operation changes order.
2. Enrichment generation rules are not automatically validation constraints.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/catalog/schemas/drafts
4. GET /api/v1/catalog/schemas/drafts/:id
5. POST /api/v1/catalog/schemas/drafts
6. GET /api/v1/catalog/schemas/drafts/:id/rules
7. POST /api/v1/catalog/schemas/drafts/:id/rules

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-msgSchemaCanvas",
  "screenName": "Schema canvas",
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
      "assetId": "SUBMENU-msg-schema-canvas",
      "kind": "submenu",
      "name": "Schema canvas",
      "label": "Schema canvas",
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
      "assetId": "SUBMENU-msg-schema-canvas",
      "kind": "submenu",
      "name": "Schema canvas",
      "label": "Schema canvas",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-msgSchemaCanvas",
      "kind": "screen",
      "name": "Schema canvas",
      "label": "Schema canvas",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "sbe-cv-f-name",
      "kind": "control",
      "name": "Selected field name",
      "label": "Selected field name",
      "selector": "#sbe-cv-f-name",
      "sourceFile": "apps/web/public/js/schema-canvas-bind.js",
      "parentAssetId": "SCR-msgSchemaCanvas",
      "source": "screen-source",
      "verification": "verified"
    },
    {
      "assetId": "sbe-cv-f-apply",
      "kind": "control",
      "name": "Apply field properties",
      "label": "Apply field properties",
      "selector": "#sbe-cv-f-apply",
      "sourceFile": "apps/web/public/js/schema-canvas-bind.js",
      "parentAssetId": "SCR-msgSchemaCanvas",
      "source": "screen-source",
      "verification": "verified"
    },
    {
      "assetId": "sbe-cv-f-delete",
      "kind": "control",
      "name": "Delete non-root field",
      "label": "Delete non-root field",
      "selector": "#sbe-cv-f-delete",
      "sourceFile": "apps/web/public/js/schema-canvas-bind.js",
      "parentAssetId": "SCR-msgSchemaCanvas",
      "source": "screen-source",
      "verification": "verified"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-msg-schema-canvas-1",
      "flowKind": "main",
      "instruction": "Analyst opens Schema canvas and selects a draft.",
      "screenId": "SCR-msgSchemaCanvas",
      "assetIds": [
        "SCR-msgSchemaCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-msg-schema-canvas-2",
      "flowKind": "main",
      "instruction": "System displays nodes and relationships.",
      "screenId": "SCR-msgSchemaCanvas",
      "assetIds": [
        "SCR-msgSchemaCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-msg-schema-canvas-3",
      "flowKind": "main",
      "instruction": "Analyst selects a node; the system shows its actual properties.",
      "screenId": "SCR-msgSchemaCanvas",
      "assetIds": [
        "SCR-msgSchemaCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-msg-schema-canvas-4",
      "flowKind": "main",
      "instruction": "Analyst applies a supported edit and reviews affected relationships.",
      "screenId": "SCR-msgSchemaCanvas",
      "assetIds": [
        "SCR-msgSchemaCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-msg-schema-canvas-5",
      "flowKind": "main",
      "instruction": "Analyst explicitly saves the draft and inspects validation before any publication.",
      "screenId": "SCR-msgSchemaCanvas",
      "assetIds": [
        "SCR-msgSchemaCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-msg-schema-canvas-1",
      "flowKind": "alternate",
      "instruction": "Pan, zoom and layout change the view rather than the schema meaning.",
      "screenId": "SCR-msgSchemaCanvas",
      "assetIds": [
        "SCR-msgSchemaCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Pan, zoom and layout change the view rather than the schema meaning.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-msg-schema-canvas-2",
      "flowKind": "alternate",
      "instruction": "Enrichment rules can be attached where their supported kind is available.",
      "screenId": "SCR-msgSchemaCanvas",
      "assetIds": [
        "SCR-msgSchemaCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Enrichment rules can be attached where their supported kind is available.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-msg-schema-canvas-1",
      "flowKind": "exception",
      "instruction": "Deleting or unlinking a non-root node must expose broken dependencies.",
      "screenId": "SCR-msgSchemaCanvas",
      "assetIds": [
        "SCR-msgSchemaCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Deleting or unlinking a non-root node must expose broken dependencies.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-msg-schema-canvas-2",
      "flowKind": "exception",
      "instruction": "A failed draft save leaves no claimed persisted revision.",
      "screenId": "SCR-msgSchemaCanvas",
      "assetIds": [
        "SCR-msgSchemaCanvas"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed draft save leaves no claimed persisted revision.",
      "backgroundEvents": []
    }
  ],
  "auditActions": [],
  "events": [],
  "backgroundEvents": [],
  "provenance": "mixed"
}
```

### Additional notes

### Source evidence

- apps/web/public/js/schema-canvas-bind.js
- apps/api/src/modules/registerSchemaRoutes.ts
- apps/api/src/modules/schemaEnrichmentRules.ts

### Implementation gaps and decisions

- The canvas does not prove the full XML/JSON/flat editor benchmark. Layout accessibility, reference preservation and runtime rule enforcement require targeted testing.

### Research basis

- [W3C WAI, ARIA Tree View Pattern (living guidance, accessed 2026-09-11)](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
- [JSON Schema, Draft 2020-12 Validation vocabulary, sections 6, 7 and 9](https://json-schema.org/draft/2020-12/json-schema-validation)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-msgSchemaCanvas and name Schema canvas. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/catalog/schemas/drafts` | [apps/api/src/modules/registerSchemaRoutes.ts:63](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `GET /api/v1/catalog/schemas/drafts/:id` | [apps/api/src/modules/registerSchemaRoutes.ts:69](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `POST /api/v1/catalog/schemas/drafts` | [apps/api/src/modules/registerSchemaRoutes.ts:85](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `GET /api/v1/catalog/schemas/drafts/:id/rules` | [apps/api/src/modules/registerSchemaRoutes.ts:113](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `POST /api/v1/catalog/schemas/drafts/:id/rules` | [apps/api/src/modules/registerSchemaRoutes.ts:117](../../apps/api/src/modules/registerSchemaRoutes.ts) |

## Scenarios

1. Property panel: a node has required=true; the node is selected; expected: the panel shows that actual property.
2. View change: a draft is visible; the analyst zooms; expected: field constraints do not change.
3. Root deletion: the root is selected; actions are inspected; expected: the non-root delete control is not offered for the root.
4. Save failure: the draft save fails; the result is displayed; expected: the canvas does not claim a saved or published schema.

## Gherkin

```gherkin
Feature: Schema canvas

  @UC-msgSchemaCanvas @AC-01 @specification
  Scenario: Property panel
    Given a node has required=true
    When the node is selected
    Then the panel shows that actual property

  @UC-msgSchemaCanvas @AC-02 @specification
  Scenario: View change
    Given a draft is visible
    When the analyst zooms
    Then field constraints do not change

  @UC-msgSchemaCanvas @AC-03 @specification
  Scenario: Root deletion
    Given the root is selected
    When actions are inspected
    Then the non-root delete control is not offered for the root

  @UC-msgSchemaCanvas @AC-04 @specification
  Scenario: Save failure
    Given the draft save fails
    When the result is displayed
    Then the canvas does not claim a saved or published schema
```
