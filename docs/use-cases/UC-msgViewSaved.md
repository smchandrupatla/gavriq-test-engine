# Reuse a saved message definition

- **ID:** UC-msgViewSaved
- **Screen:** Saved message definitions
- **Page key:** `msgViewSaved`
- **Level:** 1
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Find and reopen a saved definition with its actual source and saved state.

## Precondition

The analyst can read definitions; zero definitions is valid.

## Trigger

Analyst opens Saved message definitions.

## Success guarantee

Find and reopen a saved definition with its actual source and saved state. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A missing source schema is disclosed when reopening. A load error is not represented as a successfully empty library.

## Acceptance criteria

1. **AC-01 [proposed]** Given definition D1 exists, when D1 is reopened, its stored type and version are used.
2. **AC-02 [proposed]** Given no definitions exist, when the list loads, no demonstration definitions appear.
3. **AC-03 [proposed]** Given D1 references an unavailable schema, when D1 is opened, the missing reference is disclosed.
4. **AC-04 [proposed]** Given a record is a draft, when the record is listed, it is not presented as a completed validated definition.

## Main flow

1. Analyst opens Saved message definitions.
2. System loads available definitions and source message types.
3. Analyst identifies a definition by name, type and version.
4. System opens the selected definition or provides its supported reuse path.

## Alternate flows

1. New definition starts the wizard.
2. A draft, if stored, is identified separately from a completed definition.

## Exception flows

1. A missing source schema is disclosed when reopening.
2. A load error is not represented as a successfully empty library.

## Business validation

1. Field counts reflect saved state, not a prototype constant.
2. Reopening does not mutate a source schema.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/message-types
4. GET /api/v1/definitions

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-msgViewSaved",
  "screenName": "Saved message definitions",
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
      "assetId": "SUBMENU-msg-view-saved",
      "kind": "submenu",
      "name": "Saved message definitions",
      "label": "Saved message definitions",
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
      "assetId": "SUBMENU-msg-view-saved",
      "kind": "submenu",
      "name": "Saved message definitions",
      "label": "Saved message definitions",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-msgViewSaved",
      "kind": "screen",
      "name": "Saved message definitions",
      "label": "Saved message definitions",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-msg-view-saved-1",
      "flowKind": "main",
      "instruction": "Analyst opens Saved message definitions.",
      "screenId": "SCR-msgViewSaved",
      "assetIds": [
        "SCR-msgViewSaved"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-msg-view-saved-2",
      "flowKind": "main",
      "instruction": "System loads available definitions and source message types.",
      "screenId": "SCR-msgViewSaved",
      "assetIds": [
        "SCR-msgViewSaved"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-msg-view-saved-3",
      "flowKind": "main",
      "instruction": "Analyst identifies a definition by name, type and version.",
      "screenId": "SCR-msgViewSaved",
      "assetIds": [
        "SCR-msgViewSaved"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-msg-view-saved-4",
      "flowKind": "main",
      "instruction": "System opens the selected definition or provides its supported reuse path.",
      "screenId": "SCR-msgViewSaved",
      "assetIds": [
        "SCR-msgViewSaved"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-msg-view-saved-1",
      "flowKind": "alternate",
      "instruction": "New definition starts the wizard.",
      "screenId": "SCR-msgViewSaved",
      "assetIds": [
        "SCR-msgViewSaved"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "New definition starts the wizard.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-msg-view-saved-2",
      "flowKind": "alternate",
      "instruction": "A draft, if stored, is identified separately from a completed definition.",
      "screenId": "SCR-msgViewSaved",
      "assetIds": [
        "SCR-msgViewSaved"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A draft, if stored, is identified separately from a completed definition.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-msg-view-saved-1",
      "flowKind": "exception",
      "instruction": "A missing source schema is disclosed when reopening.",
      "screenId": "SCR-msgViewSaved",
      "assetIds": [
        "SCR-msgViewSaved"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A missing source schema is disclosed when reopening.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-msg-view-saved-2",
      "flowKind": "exception",
      "instruction": "A load error is not represented as a successfully empty library.",
      "screenId": "SCR-msgViewSaved",
      "assetIds": [
        "SCR-msgViewSaved"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A load error is not represented as a successfully empty library.",
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

- apps/api/src/modules/registerSpecGaps.ts
- apps/web/public/js/preview-parts/part-05.js

### Implementation gaps and decisions

- Draft metadata in the UI is not proof that all wizard state survives backend persistence.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-msgViewSaved and name Reuse a saved message definition. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/message-types` | [apps/api/src/app.ts:352](../../apps/api/src/app.ts) |
| `GET /api/v1/definitions` | [apps/api/src/modules/registerSpecGaps.ts:99](../../apps/api/src/modules/registerSpecGaps.ts) |

## Scenarios

1. Saved identity: definition D1 exists; D1 is reopened; expected: its stored type and version are used.
2. Empty library: no definitions exist; the list loads; expected: no demonstration definitions appear.
3. Missing source: D1 references an unavailable schema; D1 is opened; expected: the missing reference is disclosed.
4. Draft distinction: a record is a draft; the record is listed; expected: it is not presented as a completed validated definition.

## Gherkin

```gherkin
Feature: Saved message definitions

  @UC-msgViewSaved @AC-01 @specification
  Scenario: Saved identity
    Given definition D1 exists
    When D1 is reopened
    Then its stored type and version are used

  @UC-msgViewSaved @AC-02 @specification
  Scenario: Empty library
    Given no definitions exist
    When the list loads
    Then no demonstration definitions appear

  @UC-msgViewSaved @AC-03 @specification
  Scenario: Missing source
    Given D1 references an unavailable schema
    When D1 is opened
    Then the missing reference is disclosed

  @UC-msgViewSaved @AC-04 @specification
  Scenario: Draft distinction
    Given a record is a draft
    When the record is listed
    Then it is not presented as a completed validated definition
```
