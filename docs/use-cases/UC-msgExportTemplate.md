# Export a message template for reuse

- **ID:** UC-msgExportTemplate
- **Screen:** Export template
- **Page key:** `msgExportTemplate`
- **Level:** 1
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Download the actual field template for an identified message type.

## Precondition

A readable message type is selected.

## Trigger

Analyst opens Export template and chooses a message type.

## Success guarantee

Download the actual field template for an identified message type. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Unknown message type is an error, not a blank successful template. An HTTP error body is not saved as CSV content.

## Acceptance criteria

1. **AC-01 [proposed]** Given a type contains five fields, when its CSV template is downloaded, the five actual field headers appear in order.
2. **AC-02 [proposed]** Given a header contains a comma, when CSV is produced, it is quoted without creating an extra column.
3. **AC-03 [proposed]** Given the selected code no longer exists, when export is requested, an actionable error replaces the download.
4. **AC-04 [proposed]** Given a type is registered, when its template is downloaded, its definition remains unchanged.

## Main flow

1. Analyst opens Export template and chooses a message type.
2. System identifies the available representation.
3. Analyst requests download; system obtains the current template.
4. Analyst checks headers and ordering before filling the template.

## Alternate flows

1. Bulk generation uses its separate endpoint and parameters.
2. A zero-field type receives an explicit empty-template result.

## Exception flows

1. Unknown message type is an error, not a blank successful template.
2. An HTTP error body is not saved as CSV content.

## Business validation

1. CSV documentation is not itself an XSD or JSON Schema.
2. CSV quoting must preserve embedded delimiters, quotes and line breaks.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/message-types/:code/template.csv
4. POST /api/v1/templates/generate

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-msgExportTemplate",
  "screenName": "Export template",
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
      "assetId": "SUBMENU-msg-export-template",
      "kind": "submenu",
      "name": "Export template",
      "label": "Export template",
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
      "assetId": "SUBMENU-msg-export-template",
      "kind": "submenu",
      "name": "Export template",
      "label": "Export template",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-msgExportTemplate",
      "kind": "screen",
      "name": "Export template",
      "label": "Export template",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-msg-export-template-1",
      "flowKind": "main",
      "instruction": "Analyst opens Export template and chooses a message type.",
      "screenId": "SCR-msgExportTemplate",
      "assetIds": [
        "SCR-msgExportTemplate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-msg-export-template-2",
      "flowKind": "main",
      "instruction": "System identifies the available representation.",
      "screenId": "SCR-msgExportTemplate",
      "assetIds": [
        "SCR-msgExportTemplate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-msg-export-template-3",
      "flowKind": "main",
      "instruction": "Analyst requests download; system obtains the current template.",
      "screenId": "SCR-msgExportTemplate",
      "assetIds": [
        "SCR-msgExportTemplate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-msg-export-template-4",
      "flowKind": "main",
      "instruction": "Analyst checks headers and ordering before filling the template.",
      "screenId": "SCR-msgExportTemplate",
      "assetIds": [
        "SCR-msgExportTemplate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-msg-export-template-1",
      "flowKind": "alternate",
      "instruction": "Bulk generation uses its separate endpoint and parameters.",
      "screenId": "SCR-msgExportTemplate",
      "assetIds": [
        "SCR-msgExportTemplate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Bulk generation uses its separate endpoint and parameters.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-msg-export-template-2",
      "flowKind": "alternate",
      "instruction": "A zero-field type receives an explicit empty-template result.",
      "screenId": "SCR-msgExportTemplate",
      "assetIds": [
        "SCR-msgExportTemplate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A zero-field type receives an explicit empty-template result.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-msg-export-template-1",
      "flowKind": "exception",
      "instruction": "Unknown message type is an error, not a blank successful template.",
      "screenId": "SCR-msgExportTemplate",
      "assetIds": [
        "SCR-msgExportTemplate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unknown message type is an error, not a blank successful template.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-msg-export-template-2",
      "flowKind": "exception",
      "instruction": "An HTTP error body is not saved as CSV content.",
      "screenId": "SCR-msgExportTemplate",
      "assetIds": [
        "SCR-msgExportTemplate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An HTTP error body is not saved as CSV content.",
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

- apps/api/src/modules/liveOps.ts

### Implementation gaps and decisions

- CSV endpoint is observed; XML template support and selection wiring require separate confirmation.

### Research basis

- [IETF RFC 4180, Common Format and MIME Type for CSV Files (2005, Informational)](https://www.rfc-editor.org/rfc/rfc4180.html)
- [W3C, Metadata Vocabulary for Tabular Data (2015 Recommendation)](https://www.w3.org/TR/tabular-metadata/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-msgExportTemplate and name Export a message template for reuse. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/message-types/:code/template.csv` | [apps/api/src/modules/liveOps.ts:50](../../apps/api/src/modules/liveOps.ts) |
| `POST /api/v1/templates/generate` | [apps/api/src/modules/liveOps.ts:60](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Headers: a type contains five fields; its CSV template is downloaded; expected: the five actual field headers appear in order.
2. Quoting: a header contains a comma; CSV is produced; expected: it is quoted without creating an extra column.
3. Unknown type: the selected code no longer exists; export is requested; expected: an actionable error replaces the download.
4. No mutation: a type is registered; its template is downloaded; expected: its definition remains unchanged.

## Gherkin

```gherkin
Feature: Export template

  @UC-msgExportTemplate @AC-01 @specification
  Scenario: Headers
    Given a type contains five fields
    When its CSV template is downloaded
    Then the five actual field headers appear in order

  @UC-msgExportTemplate @AC-02 @specification
  Scenario: Quoting
    Given a header contains a comma
    When CSV is produced
    Then it is quoted without creating an extra column

  @UC-msgExportTemplate @AC-03 @specification
  Scenario: Unknown type
    Given the selected code no longer exists
    When export is requested
    Then an actionable error replaces the download

  @UC-msgExportTemplate @AC-04 @specification
  Scenario: No mutation
    Given a type is registered
    When its template is downloaded
    Then its definition remains unchanged
```
