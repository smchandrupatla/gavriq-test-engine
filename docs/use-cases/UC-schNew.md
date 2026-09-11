# Schedule a run to fire automatically

- **ID:** UC-schNew
- **Screen:** New schedule
- **Page key:** `schNew`
- **Level:** 2
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Create a named schedule with a supported cadence and an inspectable next occurrence.

## Precondition

The operator can create schedules and has selected a supported cadence.

## Trigger

Operator enters a schedule name and cadence.

## Success guarantee

Create a named schedule with a supported cadence and an inspectable next occurrence. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Missing name or cadence is rejected. A sch_local fallback is not evidence that a scheduler will execute a durable record.

## Acceptance criteria

1. **AC-01 [proposed]** Given name is missing, when creation is submitted, validation rejects the request.
2. **AC-02 [proposed]** Given cadence is missing, when creation is submitted, validation rejects the request.
3. **AC-03 [proposed]** Given a supported cadence is accepted, when creation succeeds, the returned next occurrence can be inspected.
4. **AC-04 [proposed]** Given schedule persistence fails, when the handler returns a local ID, durable scheduling is not claimed.

## Main flow

1. Operator enters a schedule name and cadence.
2. System validates required fields and calculates a next occurrence.
3. Operator explicitly creates the schedule.
4. System reports the returned identity and next-run timestamp.
5. Operator reloads the schedule collection before relying on persistence.

## Alternate flows

1. Different supported cadence values produce their defined next occurrence.
2. The proposed run-template linkage requires a separately confirmed payload.

## Exception flows

1. Missing name or cadence is rejected.
2. A sch_local fallback is not evidence that a scheduler will execute a durable record.

## Business validation

1. Creation does not mean a run has executed.
2. Timezone, daylight-saving gaps/folds, month-end and missed-run policy require explicit decisions.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/schedules

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-schNew",
  "screenName": "New schedule",
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
      "assetId": "SUBMENU-sch-new",
      "kind": "submenu",
      "name": "New schedule",
      "label": "New schedule",
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
      "assetId": "SUBMENU-sch-new",
      "kind": "submenu",
      "name": "New schedule",
      "label": "New schedule",
      "parentAssetId": "MENU-schedules",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-schNew",
      "kind": "screen",
      "name": "New schedule",
      "label": "New schedule",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-sch-new-1",
      "flowKind": "main",
      "instruction": "Operator enters a schedule name and cadence.",
      "screenId": "SCR-schNew",
      "assetIds": [
        "SCR-schNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-sch-new-2",
      "flowKind": "main",
      "instruction": "System validates required fields and calculates a next occurrence.",
      "screenId": "SCR-schNew",
      "assetIds": [
        "SCR-schNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-sch-new-3",
      "flowKind": "main",
      "instruction": "Operator explicitly creates the schedule.",
      "screenId": "SCR-schNew",
      "assetIds": [
        "SCR-schNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-sch-new-4",
      "flowKind": "main",
      "instruction": "System reports the returned identity and next-run timestamp.",
      "screenId": "SCR-schNew",
      "assetIds": [
        "SCR-schNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-sch-new-5",
      "flowKind": "main",
      "instruction": "Operator reloads the schedule collection before relying on persistence.",
      "screenId": "SCR-schNew",
      "assetIds": [
        "SCR-schNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-sch-new-1",
      "flowKind": "alternate",
      "instruction": "Different supported cadence values produce their defined next occurrence.",
      "screenId": "SCR-schNew",
      "assetIds": [
        "SCR-schNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Different supported cadence values produce their defined next occurrence.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-sch-new-2",
      "flowKind": "alternate",
      "instruction": "The proposed run-template linkage requires a separately confirmed payload.",
      "screenId": "SCR-schNew",
      "assetIds": [
        "SCR-schNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The proposed run-template linkage requires a separately confirmed payload.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-sch-new-1",
      "flowKind": "exception",
      "instruction": "Missing name or cadence is rejected.",
      "screenId": "SCR-schNew",
      "assetIds": [
        "SCR-schNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Missing name or cadence is rejected.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-sch-new-2",
      "flowKind": "exception",
      "instruction": "A sch_local fallback is not evidence that a scheduler will execute a durable record.",
      "screenId": "SCR-schNew",
      "assetIds": [
        "SCR-schNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A sch_local fallback is not evidence that a scheduler will execute a durable record.",
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
- apps/api/src/modules/schedules.ts

### Implementation gaps and decisions

- Current payload is name/cadence, not run template/start date/time. Implemented cadence is once/hourly/daily/weekly and uses elapsed milliseconds; monthly, calendar timezone and daylight-saving semantics are not established.

### Research basis

- [IETF RFC 5545, iCalendar (2009), recurrence and timezone semantics](https://www.rfc-editor.org/rfc/rfc5545.html)
- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-schNew and name Schedule a run to fire automatically. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/schedules` | [apps/api/src/modules/liveOps.ts:159](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Required name: name is missing; creation is submitted; expected: validation rejects the request.
2. Required cadence: cadence is missing; creation is submitted; expected: validation rejects the request.
3. Next occurrence: a supported cadence is accepted; creation succeeds; expected: the returned next occurrence can be inspected.
4. Storage failure: schedule persistence fails; the handler returns a local ID; expected: durable scheduling is not claimed.

## Gherkin

```gherkin
Feature: New schedule

  @UC-schNew @AC-01 @specification
  Scenario: Required name
    Given name is missing
    When creation is submitted
    Then validation rejects the request

  @UC-schNew @AC-02 @specification
  Scenario: Required cadence
    Given cadence is missing
    When creation is submitted
    Then validation rejects the request

  @UC-schNew @AC-03 @specification
  Scenario: Next occurrence
    Given a supported cadence is accepted
    When creation succeeds
    Then the returned next occurrence can be inspected

  @UC-schNew @AC-04 @specification
  Scenario: Storage failure
    Given schedule persistence fails
    When the handler returns a local ID
    Then durable scheduling is not claimed
```
