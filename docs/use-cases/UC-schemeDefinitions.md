# Scheme definitions

- **ID:** UC-schemeDefinitions
- **Screen:** Scheme definitions
- **Page key:** `schemeDefinitions`
- **Level:** 2
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Inspect a registered schema and hand its identity to the message-definition wizard.

## Precondition

Designer types are readable; an empty collection is valid.

## Trigger

Analyst opens Scheme Definitions and selects a family.

## Success guarantee

Inspect a registered schema and hand its identity to the message-definition wizard. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An unavailable original file is reported as missing. No imported schemas produces import guidance.

## Acceptance criteria

1. **AC-01 [proposed]** Given pacs.008 is selected, when Use this is activated, the wizard receives pacs.008 and its selected model.
2. **AC-02 [proposed]** Given an original XSD is stored, when Download XSD is selected, the stored source is returned.
3. **AC-03 [proposed]** Given no Markdown was stored, when documentation is requested, absence is disclosed rather than invented.
4. **AC-04 [proposed]** Given a schema is inspected, when the analyst returns to the list, its version and content are unchanged.

## Main flow

1. Analyst opens Scheme Definitions and selects a family.
2. System lists that family's schemas; analyst chooses one.
3. System displays the available field paths, types, occurrence and rules.
4. Analyst downloads an available source file or selects Use this to create message definition.
5. System passes the selected schema to the workspace without changing it.

## Alternate flows

1. Back changes family or schema selection.
2. Print/PDF conversion is a documentation representation, not a new schema.

## Exception flows

1. An unavailable original file is reported as missing.
2. No imported schemas produces import guidance.

## Business validation

1. Displayed paths and rules retain source meaning.
2. A read/reuse action does not publish or override a schema.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/catalog/designer-types
4. GET /api/v1/catalog/iso/uploads/:id/files/:kind

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-schemeDefinitions",
  "screenName": "Scheme definitions",
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
      "assetId": "SUBMENU-scheme-definitions",
      "kind": "submenu",
      "name": "Scheme definitions",
      "label": "Scheme definitions",
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
      "assetId": "SUBMENU-scheme-definitions",
      "kind": "submenu",
      "name": "Scheme definitions",
      "label": "Scheme definitions",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-schemeDefinitions",
      "kind": "screen",
      "name": "Scheme definitions",
      "label": "Scheme definitions",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-scheme-definitions-1",
      "flowKind": "main",
      "instruction": "Analyst opens Scheme Definitions and selects a family.",
      "screenId": "SCR-schemeDefinitions",
      "assetIds": [
        "SCR-schemeDefinitions"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-scheme-definitions-2",
      "flowKind": "main",
      "instruction": "System lists that family's schemas; analyst chooses one.",
      "screenId": "SCR-schemeDefinitions",
      "assetIds": [
        "SCR-schemeDefinitions"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-scheme-definitions-3",
      "flowKind": "main",
      "instruction": "System displays the available field paths, types, occurrence and rules.",
      "screenId": "SCR-schemeDefinitions",
      "assetIds": [
        "SCR-schemeDefinitions"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-scheme-definitions-4",
      "flowKind": "main",
      "instruction": "Analyst downloads an available source file or selects Use this to create message definition.",
      "screenId": "SCR-schemeDefinitions",
      "assetIds": [
        "SCR-schemeDefinitions"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-scheme-definitions-5",
      "flowKind": "main",
      "instruction": "System passes the selected schema to the workspace without changing it.",
      "screenId": "SCR-schemeDefinitions",
      "assetIds": [
        "SCR-schemeDefinitions"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-scheme-definitions-1",
      "flowKind": "alternate",
      "instruction": "Back changes family or schema selection.",
      "screenId": "SCR-schemeDefinitions",
      "assetIds": [
        "SCR-schemeDefinitions"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Back changes family or schema selection.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-scheme-definitions-2",
      "flowKind": "alternate",
      "instruction": "Print/PDF conversion is a documentation representation, not a new schema.",
      "screenId": "SCR-schemeDefinitions",
      "assetIds": [
        "SCR-schemeDefinitions"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Print/PDF conversion is a documentation representation, not a new schema.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-scheme-definitions-1",
      "flowKind": "exception",
      "instruction": "An unavailable original file is reported as missing.",
      "screenId": "SCR-schemeDefinitions",
      "assetIds": [
        "SCR-schemeDefinitions"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unavailable original file is reported as missing.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-scheme-definitions-2",
      "flowKind": "exception",
      "instruction": "No imported schemas produces import guidance.",
      "screenId": "SCR-schemeDefinitions",
      "assetIds": [
        "SCR-schemeDefinitions"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No imported schemas produces import guidance.",
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
- apps/api/src/modules/registerIsoCatalog.ts

### Implementation gaps and decisions

- This source-defined use case was excluded from FEATURE_PAGES-based seeding. Its inclusion here changes documentation coverage only.

### Research basis

- [W3C, XSD 1.1 Structures (2012 Recommendation)](https://www.w3.org/TR/xmlschema11-1/)
- [IETF RFC 9535, JSONPath (2024)](https://www.rfc-editor.org/rfc/rfc9535.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-schemeDefinitions and name Scheme definitions. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/catalog/designer-types` | [apps/api/src/modules/registerIsoCatalog.ts:281](../../apps/api/src/modules/registerIsoCatalog.ts) |
| `GET /api/v1/catalog/iso/uploads/:id/files/:kind` | [apps/api/src/modules/registerIsoCatalog.ts:266](../../apps/api/src/modules/registerIsoCatalog.ts) |

## Scenarios

1. Handoff: pacs.008 is selected; Use this is activated; expected: the wizard receives pacs.008 and its selected model.
2. Source download: an original XSD is stored; Download XSD is selected; expected: the stored source is returned.
3. Missing document: no Markdown was stored; documentation is requested; expected: absence is disclosed rather than invented.
4. Read only: a schema is inspected; the analyst returns to the list; expected: its version and content are unchanged.

## Gherkin

```gherkin
Feature: Scheme definitions

  @UC-schemeDefinitions @AC-01 @specification
  Scenario: Handoff
    Given pacs.008 is selected
    When Use this is activated
    Then the wizard receives pacs.008 and its selected model

  @UC-schemeDefinitions @AC-02 @specification
  Scenario: Source download
    Given an original XSD is stored
    When Download XSD is selected
    Then the stored source is returned

  @UC-schemeDefinitions @AC-03 @specification
  Scenario: Missing document
    Given no Markdown was stored
    When documentation is requested
    Then absence is disclosed rather than invented

  @UC-schemeDefinitions @AC-04 @specification
  Scenario: Read only
    Given a schema is inspected
    When the analyst returns to the list
    Then its version and content are unchanged
```
