# Manage every schedule

- **ID:** UC-schAll
- **Screen:** All schedules
- **Page key:** `schAll`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Inspect every configured schedule and its actual scheduling state.

## Precondition

The operator can read schedules.

## Trigger

Operator opens All schedules.

## Success guarantee

Inspect every configured schedule and its actual scheduling state. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A load failure is not a successful zero-record result. Unavailable pause/resume controls are not represented as working actions.

## Acceptance criteria

1. **AC-01 [proposed]** Given a schedule is due next month, when All schedules loads, it remains visible.
2. **AC-02 [proposed]** Given a persisted schedule is paused, when it is displayed, its state is not labelled active.
3. **AC-03 [proposed]** Given a next time is calculated, when the schedule is listed, no completed run is implied.
4. **AC-04 [proposed]** Given the store confirms zero schedules, when All schedules opens, the list contains no prototype entries.

## Main flow

1. Operator opens All schedules.
2. System lists stored schedules with cadence and next occurrence.
3. Operator inspects enabled or paused state where persisted.
4. Operator opens creation or a separately supported maintenance action.

## Alternate flows

1. A schedule outside the upcoming window remains visible.
2. A zero-record response is shown as an empty list when confirmed.

## Exception flows

1. A load failure is not a successful zero-record result.
2. Unavailable pause/resume controls are not represented as working actions.

## Business validation

1. A next-run preview is not evidence of a job having fired.
2. A schedule record is distinct from generated runs.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/schedules

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-schAll",
  "screenName": "All schedules",
  "navigation": {
    "menu": {
      "assetId": "MENU-schedules",
      "kind": "menu",
      "name": "Schedules",
      "label": "Schedules",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-sch-all",
      "kind": "submenu",
      "name": "All schedules",
      "label": "All schedules",
      "parentAssetId": "MENU-schedules",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-schedules",
      "kind": "menu",
      "name": "Schedules",
      "label": "Schedules",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-sch-all",
      "kind": "submenu",
      "name": "All schedules",
      "label": "All schedules",
      "parentAssetId": "MENU-schedules",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-schAll",
      "kind": "screen",
      "name": "All schedules",
      "label": "All schedules",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-sch-all-1",
      "flowKind": "main",
      "instruction": "Operator opens All schedules.",
      "screenId": "SCR-schAll",
      "assetIds": [
        "SCR-schAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-sch-all-2",
      "flowKind": "main",
      "instruction": "System lists stored schedules with cadence and next occurrence.",
      "screenId": "SCR-schAll",
      "assetIds": [
        "SCR-schAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-sch-all-3",
      "flowKind": "main",
      "instruction": "Operator inspects enabled or paused state where persisted.",
      "screenId": "SCR-schAll",
      "assetIds": [
        "SCR-schAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-sch-all-4",
      "flowKind": "main",
      "instruction": "Operator opens creation or a separately supported maintenance action.",
      "screenId": "SCR-schAll",
      "assetIds": [
        "SCR-schAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-sch-all-1",
      "flowKind": "alternate",
      "instruction": "A schedule outside the upcoming window remains visible.",
      "screenId": "SCR-schAll",
      "assetIds": [
        "SCR-schAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A schedule outside the upcoming window remains visible.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-sch-all-2",
      "flowKind": "alternate",
      "instruction": "A zero-record response is shown as an empty list when confirmed.",
      "screenId": "SCR-schAll",
      "assetIds": [
        "SCR-schAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A zero-record response is shown as an empty list when confirmed.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-sch-all-1",
      "flowKind": "exception",
      "instruction": "A load failure is not a successful zero-record result.",
      "screenId": "SCR-schAll",
      "assetIds": [
        "SCR-schAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A load failure is not a successful zero-record result.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-sch-all-2",
      "flowKind": "exception",
      "instruction": "Unavailable pause/resume controls are not represented as working actions.",
      "screenId": "SCR-schAll",
      "assetIds": [
        "SCR-schAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unavailable pause/resume controls are not represented as working actions.",
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

- Pause/resume mutations are not registered in the inspected schedule routes.

### Research basis

- [IETF RFC 5545, iCalendar (2009), recurrence and timezone semantics](https://www.rfc-editor.org/rfc/rfc5545.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-schAll and name Manage every schedule. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/schedules` | [apps/api/src/modules/liveOps.ts:180](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Distant occurrence: a schedule is due next month; All schedules loads; expected: it remains visible.
2. Paused state: a persisted schedule is paused; it is displayed; expected: its state is not labelled active.
3. No run claim: a next time is calculated; the schedule is listed; expected: no completed run is implied.
4. Empty: the store confirms zero schedules; All schedules opens; expected: the list contains no prototype entries.

## Gherkin

```gherkin
Feature: All schedules

  @UC-schAll @AC-01 @specification
  Scenario: Distant occurrence
    Given a schedule is due next month
    When All schedules loads
    Then it remains visible

  @UC-schAll @AC-02 @specification
  Scenario: Paused state
    Given a persisted schedule is paused
    When it is displayed
    Then its state is not labelled active

  @UC-schAll @AC-03 @specification
  Scenario: No run claim
    Given a next time is calculated
    When the schedule is listed
    Then no completed run is implied

  @UC-schAll @AC-04 @specification
  Scenario: Empty
    Given the store confirms zero schedules
    When All schedules opens
    Then the list contains no prototype entries
```
