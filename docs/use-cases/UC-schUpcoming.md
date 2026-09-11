# See what's about to run

- **ID:** UC-schUpcoming
- **Screen:** Upcoming schedules
- **Page key:** `schUpcoming`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Identify enabled schedules due within a clearly defined upcoming interval.

## Precondition

Schedule records and an evaluation clock are available.

## Trigger

Operator opens Upcoming schedules.

## Success guarantee

Identify enabled schedules due within a clearly defined upcoming interval. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An invalid next-run timestamp is disclosed. A paused schedule is not promised to fire.

## Acceptance criteria

1. **AC-01 [proposed]** Given an enabled schedule is due tomorrow, when a seven-day upcoming view is evaluated, that schedule appears.
2. **AC-02 [proposed]** Given a schedule is due in three weeks, when a seven-day view is evaluated, it is excluded.
3. **AC-03 [proposed]** Given a schedule is paused, when upcoming execution is described, it is not promised to execute.
4. **AC-04 [proposed]** Given a next occurrence crosses a timezone boundary, when it is displayed, the time basis is clear.

## Main flow

1. Operator opens Upcoming schedules.
2. System loads schedule records and identifies the displayed time basis.
3. System applies the declared upcoming interval and enabled-state policy.
4. Operator reviews next occurrence and intended target before creating another schedule.

## Alternate flows

1. No due schedules produces an explicit empty interval.
2. All schedules permits inspection outside the upcoming interval.

## Exception flows

1. An invalid next-run timestamp is disclosed.
2. A paused schedule is not promised to fire.

## Business validation

1. Define inclusive/exclusive interval boundaries before testing the seven-day view.
2. RFC 5545 explains recurrence edge cases; it does not establish this product uses iCalendar.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/schedules

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-schUpcoming",
  "screenName": "Upcoming schedules",
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
      "assetId": "SUBMENU-sch-upcoming",
      "kind": "submenu",
      "name": "Upcoming schedules",
      "label": "Upcoming schedules",
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
      "assetId": "SUBMENU-sch-upcoming",
      "kind": "submenu",
      "name": "Upcoming schedules",
      "label": "Upcoming schedules",
      "parentAssetId": "MENU-schedules",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-schUpcoming",
      "kind": "screen",
      "name": "Upcoming schedules",
      "label": "Upcoming schedules",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-sch-upcoming-1",
      "flowKind": "main",
      "instruction": "Operator opens Upcoming schedules.",
      "screenId": "SCR-schUpcoming",
      "assetIds": [
        "SCR-schUpcoming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-sch-upcoming-2",
      "flowKind": "main",
      "instruction": "System loads schedule records and identifies the displayed time basis.",
      "screenId": "SCR-schUpcoming",
      "assetIds": [
        "SCR-schUpcoming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-sch-upcoming-3",
      "flowKind": "main",
      "instruction": "System applies the declared upcoming interval and enabled-state policy.",
      "screenId": "SCR-schUpcoming",
      "assetIds": [
        "SCR-schUpcoming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-sch-upcoming-4",
      "flowKind": "main",
      "instruction": "Operator reviews next occurrence and intended target before creating another schedule.",
      "screenId": "SCR-schUpcoming",
      "assetIds": [
        "SCR-schUpcoming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-sch-upcoming-1",
      "flowKind": "alternate",
      "instruction": "No due schedules produces an explicit empty interval.",
      "screenId": "SCR-schUpcoming",
      "assetIds": [
        "SCR-schUpcoming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No due schedules produces an explicit empty interval.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-sch-upcoming-2",
      "flowKind": "alternate",
      "instruction": "All schedules permits inspection outside the upcoming interval.",
      "screenId": "SCR-schUpcoming",
      "assetIds": [
        "SCR-schUpcoming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "All schedules permits inspection outside the upcoming interval.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-sch-upcoming-1",
      "flowKind": "exception",
      "instruction": "An invalid next-run timestamp is disclosed.",
      "screenId": "SCR-schUpcoming",
      "assetIds": [
        "SCR-schUpcoming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An invalid next-run timestamp is disclosed.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-sch-upcoming-2",
      "flowKind": "exception",
      "instruction": "A paused schedule is not promised to fire.",
      "screenId": "SCR-schUpcoming",
      "assetIds": [
        "SCR-schUpcoming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A paused schedule is not promised to fire.",
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

- Seven-day filtering, pause support and timezone controls require binder and scheduler verification.

### Research basis

- [IETF RFC 5545, iCalendar (2009), recurrence and timezone semantics](https://www.rfc-editor.org/rfc/rfc5545.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-schUpcoming and name See what's about to run. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/schedules` | [apps/api/src/modules/liveOps.ts:180](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Inside interval: an enabled schedule is due tomorrow; a seven-day upcoming view is evaluated; expected: that schedule appears.
2. Outside interval: a schedule is due in three weeks; a seven-day view is evaluated; expected: it is excluded.
3. Paused: a schedule is paused; upcoming execution is described; expected: it is not promised to execute.
4. Clock context: a next occurrence crosses a timezone boundary; it is displayed; expected: the time basis is clear.

## Gherkin

```gherkin
Feature: Upcoming schedules

  @UC-schUpcoming @AC-01 @specification
  Scenario: Inside interval
    Given an enabled schedule is due tomorrow
    When a seven-day upcoming view is evaluated
    Then that schedule appears

  @UC-schUpcoming @AC-02 @specification
  Scenario: Outside interval
    Given a schedule is due in three weeks
    When a seven-day view is evaluated
    Then it is excluded

  @UC-schUpcoming @AC-03 @specification
  Scenario: Paused
    Given a schedule is paused
    When upcoming execution is described
    Then it is not promised to execute

  @UC-schUpcoming @AC-04 @specification
  Scenario: Clock context
    Given a next occurrence crosses a timezone boundary
    When it is displayed
    Then the time basis is clear
```
