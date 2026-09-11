# Browse every generated report

- **ID:** UC-repAll
- **Screen:** All reports
- **Page key:** `repAll`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Locate stored report evidence and inspect its scope and generation context.

## Precondition

The session can read reports; no reports is valid.

## Trigger

Operator opens All reports.

## Success guarantee

Locate stored report evidence and inspect its scope and generation context. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Failed report retrieval is not proof that no reports exist. A preview or placeholder document is not downloadable evidence of a run.

## Acceptance criteria

1. **AC-01 [proposed]** Given report R is tied to run A, when R is opened, its run A context is preserved.
2. **AC-02 [proposed]** Given the store confirms no reports, when the list loads, no demonstration report appears.
3. **AC-03 [proposed]** Given the UI shows a dummy document, when it is inspected, it is not described as actual run evidence.
4. **AC-04 [proposed]** Given the report service fails, when results render, availability is not falsely confirmed.

## Main flow

1. Operator opens All reports.
2. System loads stored report records.
3. Operator identifies the intended report by run and generation context.
4. System opens the available report representation or explains missing content.

## Alternate flows

1. A category-specific view narrows the same source collection.
2. No reports directs the operator to a supported run workflow.

## Exception flows

1. Failed report retrieval is not proof that no reports exist.
2. A preview or placeholder document is not downloadable evidence of a run.

## Business validation

1. A file size is shown only when its actual representation is known.
2. Report existence does not certify compliance or production readiness.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/reports

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-repAll",
  "screenName": "All reports",
  "navigation": {
    "menu": {
      "assetId": "MENU-reports",
      "kind": "menu",
      "name": "Reports",
      "label": "Reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-rep-all",
      "kind": "submenu",
      "name": "All reports",
      "label": "All reports",
      "parentAssetId": "MENU-reports",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-reports",
      "kind": "menu",
      "name": "Reports",
      "label": "Reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-rep-all",
      "kind": "submenu",
      "name": "All reports",
      "label": "All reports",
      "parentAssetId": "MENU-reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-repAll",
      "kind": "screen",
      "name": "All reports",
      "label": "All reports",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rep-all-1",
      "flowKind": "main",
      "instruction": "Operator opens All reports.",
      "screenId": "SCR-repAll",
      "assetIds": [
        "SCR-repAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rep-all-2",
      "flowKind": "main",
      "instruction": "System loads stored report records.",
      "screenId": "SCR-repAll",
      "assetIds": [
        "SCR-repAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rep-all-3",
      "flowKind": "main",
      "instruction": "Operator identifies the intended report by run and generation context.",
      "screenId": "SCR-repAll",
      "assetIds": [
        "SCR-repAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rep-all-4",
      "flowKind": "main",
      "instruction": "System opens the available report representation or explains missing content.",
      "screenId": "SCR-repAll",
      "assetIds": [
        "SCR-repAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rep-all-1",
      "flowKind": "alternate",
      "instruction": "A category-specific view narrows the same source collection.",
      "screenId": "SCR-repAll",
      "assetIds": [
        "SCR-repAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A category-specific view narrows the same source collection.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rep-all-2",
      "flowKind": "alternate",
      "instruction": "No reports directs the operator to a supported run workflow.",
      "screenId": "SCR-repAll",
      "assetIds": [
        "SCR-repAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No reports directs the operator to a supported run workflow.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rep-all-1",
      "flowKind": "exception",
      "instruction": "Failed report retrieval is not proof that no reports exist.",
      "screenId": "SCR-repAll",
      "assetIds": [
        "SCR-repAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Failed report retrieval is not proof that no reports exist.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rep-all-2",
      "flowKind": "exception",
      "instruction": "A preview or placeholder document is not downloadable evidence of a run.",
      "screenId": "SCR-repAll",
      "assetIds": [
        "SCR-repAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A preview or placeholder document is not downloadable evidence of a run.",
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
- apps/web/public/js/preview-parts/part-06.js

### Implementation gaps and decisions

- The run detail includes placeholder document/infographic UI. A working report generation action is not established by its button.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-repAll and name Browse every generated report. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/reports` | [apps/api/src/modules/liveOps.ts:199](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Stored report: report R is tied to run A; R is opened; expected: its run A context is preserved.
2. No reports: the store confirms no reports; the list loads; expected: no demonstration report appears.
3. Placeholder: the UI shows a dummy document; it is inspected; expected: it is not described as actual run evidence.
4. Failed load: the report service fails; results render; expected: availability is not falsely confirmed.

## Gherkin

```gherkin
Feature: All reports

  @UC-repAll @AC-01 @specification
  Scenario: Stored report
    Given report R is tied to run A
    When R is opened
    Then its run A context is preserved

  @UC-repAll @AC-02 @specification
  Scenario: No reports
    Given the store confirms no reports
    When the list loads
    Then no demonstration report appears

  @UC-repAll @AC-03 @specification
  Scenario: Placeholder
    Given the UI shows a dummy document
    When it is inspected
    Then it is not described as actual run evidence

  @UC-repAll @AC-04 @specification
  Scenario: Failed load
    Given the report service fails
    When results render
    Then availability is not falsely confirmed
```
