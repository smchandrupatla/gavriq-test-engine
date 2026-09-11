# Manage automatic report exports

- **ID:** UC-repScheduled
- **Screen:** Scheduled exports
- **Page key:** `repScheduled`
- **Level:** 2
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Review a proposed recurring report export with explicit destination and delivery status.

## Precondition

An export configuration can be read; implementation of scheduled delivery must be verified separately.

## Trigger

Administrator opens Scheduled exports.

## Success guarantee

Review a proposed recurring report export with explicit destination and delivery status. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An invalid destination cannot be shown as a successful delivery. A failed export must not be silently advanced as completed.

## Acceptance criteria

1. **AC-01 [proposed]** Given no export is configured, when the view opens, no automatic delivery is implied.
2. **AC-02 [proposed]** Given a destination is invalid, when export is attempted, failure is shown rather than success.
3. **AC-03 [proposed]** Given a report was downloaded manually, when scheduled state is reviewed, the download is not recorded as a recurring delivery.
4. **AC-04 [proposed]** Given no scheduled-export write endpoint exists, when New export is inspected, the capability is identified as unimplemented.

## Main flow

1. Administrator opens Scheduled exports.
2. System displays available configuration with report scope, destination and cadence.
3. Administrator reviews the next occurrence and most recent actual delivery.
4. Administrator uses only a supported creation or maintenance action.

## Alternate flows

1. No configured export produces an empty state.
2. A manual report download remains separate from recurring export.

## Exception flows

1. An invalid destination cannot be shown as a successful delivery.
2. A failed export must not be silently advanced as completed.

## Business validation

1. A displayed next date does not establish a running scheduler.
2. Email or SharePoint support cannot be inferred from a prototype destination label.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/reports

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-repScheduled",
  "screenName": "Scheduled exports",
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
      "assetId": "SUBMENU-rep-scheduled",
      "kind": "submenu",
      "name": "Scheduled exports",
      "label": "Scheduled exports",
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
      "assetId": "SUBMENU-rep-scheduled",
      "kind": "submenu",
      "name": "Scheduled exports",
      "label": "Scheduled exports",
      "parentAssetId": "MENU-reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-repScheduled",
      "kind": "screen",
      "name": "Scheduled exports",
      "label": "Scheduled exports",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rep-scheduled-1",
      "flowKind": "main",
      "instruction": "Administrator opens Scheduled exports.",
      "screenId": "SCR-repScheduled",
      "assetIds": [
        "SCR-repScheduled"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rep-scheduled-2",
      "flowKind": "main",
      "instruction": "System displays available configuration with report scope, destination and cadence.",
      "screenId": "SCR-repScheduled",
      "assetIds": [
        "SCR-repScheduled"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rep-scheduled-3",
      "flowKind": "main",
      "instruction": "Administrator reviews the next occurrence and most recent actual delivery.",
      "screenId": "SCR-repScheduled",
      "assetIds": [
        "SCR-repScheduled"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rep-scheduled-4",
      "flowKind": "main",
      "instruction": "Administrator uses only a supported creation or maintenance action.",
      "screenId": "SCR-repScheduled",
      "assetIds": [
        "SCR-repScheduled"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rep-scheduled-1",
      "flowKind": "alternate",
      "instruction": "No configured export produces an empty state.",
      "screenId": "SCR-repScheduled",
      "assetIds": [
        "SCR-repScheduled"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No configured export produces an empty state.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rep-scheduled-2",
      "flowKind": "alternate",
      "instruction": "A manual report download remains separate from recurring export.",
      "screenId": "SCR-repScheduled",
      "assetIds": [
        "SCR-repScheduled"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A manual report download remains separate from recurring export.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rep-scheduled-1",
      "flowKind": "exception",
      "instruction": "An invalid destination cannot be shown as a successful delivery.",
      "screenId": "SCR-repScheduled",
      "assetIds": [
        "SCR-repScheduled"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An invalid destination cannot be shown as a successful delivery.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rep-scheduled-2",
      "flowKind": "exception",
      "instruction": "A failed export must not be silently advanced as completed.",
      "screenId": "SCR-repScheduled",
      "assetIds": [
        "SCR-repScheduled"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed export must not be silently advanced as completed.",
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
- apps/web/public/js/preview-parts/part-00.js

### Implementation gaps and decisions

- Only reports GET is identified here; scheduled export creation, destination validation and execution are proposed requirements.

### Research basis

- [IETF RFC 5545, iCalendar (2009), recurrence and timezone semantics](https://www.rfc-editor.org/rfc/rfc5545.html)
- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-repScheduled and name Manage automatic report exports. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/reports` | [apps/api/src/modules/liveOps.ts:199](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Empty configuration: no export is configured; the view opens; expected: no automatic delivery is implied.
2. Invalid target: a destination is invalid; export is attempted; expected: failure is shown rather than success.
3. Manual download: a report was downloaded manually; scheduled state is reviewed; expected: the download is not recorded as a recurring delivery.
4. Unimplemented action: no scheduled-export write endpoint exists; New export is inspected; expected: the capability is identified as unimplemented.

## Gherkin

```gherkin
Feature: Scheduled exports

  @UC-repScheduled @AC-01 @specification
  Scenario: Empty configuration
    Given no export is configured
    When the view opens
    Then no automatic delivery is implied

  @UC-repScheduled @AC-02 @specification
  Scenario: Invalid target
    Given a destination is invalid
    When export is attempted
    Then failure is shown rather than success

  @UC-repScheduled @AC-03 @specification
  Scenario: Manual download
    Given a report was downloaded manually
    When scheduled state is reviewed
    Then the download is not recorded as a recurring delivery

  @UC-repScheduled @AC-04 @specification
  Scenario: Unimplemented action
    Given no scheduled-export write endpoint exists
    When New export is inspected
    Then the capability is identified as unimplemented
```
