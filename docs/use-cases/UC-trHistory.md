# Review completed run outcomes

- **ID:** UC-trHistory
- **Screen:** Run history
- **Page key:** `trHistory`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Review terminal run outcomes with reliable timestamps and declared history scope.

## Precondition

Stored runs are readable; no finished run is a valid result.

## Trigger

Operator opens Run history.

## Success guarantee

Review terminal run outcomes with reliable timestamps and declared history scope. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Invalid or missing timestamps do not produce a made-up duration. A running record is not treated as a completed history entry.

## Acceptance criteria

1. **AC-01 [proposed]** Given one running and one completed record exist, when history is filtered, the completed record qualifies and the running record does not.
2. **AC-02 [proposed]** Given a run has failed, when history renders, the failure remains visible.
3. **AC-03 [proposed]** Given valid start and end timestamps are 60 seconds apart, when duration is calculated, the measured duration is 60 seconds.
4. **AC-04 [proposed]** Given the completion timestamp is absent, when history renders the record, completion duration is not invented.

## Main flow

1. Operator opens Run history.
2. System selects terminal records according to the implemented status mapping.
3. Operator reviews start, completion and measured duration.
4. Operator opens the available evidence for a selected run.

## Alternate flows

1. Failed terminal runs are included with their outcome.
2. Older runs are included or excluded only according to a declared actual filter.

## Exception flows

1. Invalid or missing timestamps do not produce a made-up duration.
2. A running record is not treated as a completed history entry.

## Business validation

1. A prototype 30-day caption does not prove a server retention or filtering rule.
2. History inspection does not rerun tests.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/runs

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-trHistory",
  "screenName": "Run history",
  "navigation": {
    "menu": {
      "assetId": "MENU-test-runs",
      "kind": "menu",
      "name": "Test Runs",
      "label": "Test Runs",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-tr-history",
      "kind": "submenu",
      "name": "Run history",
      "label": "Run history",
      "parentAssetId": "MENU-test-runs",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-test-runs",
      "kind": "menu",
      "name": "Test Runs",
      "label": "Test Runs",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-tr-history",
      "kind": "submenu",
      "name": "Run history",
      "label": "Run history",
      "parentAssetId": "MENU-test-runs",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-trHistory",
      "kind": "screen",
      "name": "Run history",
      "label": "Run history",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-tr-history-1",
      "flowKind": "main",
      "instruction": "Operator opens Run history.",
      "screenId": "SCR-trHistory",
      "assetIds": [
        "SCR-trHistory"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-tr-history-2",
      "flowKind": "main",
      "instruction": "System selects terminal records according to the implemented status mapping.",
      "screenId": "SCR-trHistory",
      "assetIds": [
        "SCR-trHistory"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-tr-history-3",
      "flowKind": "main",
      "instruction": "Operator reviews start, completion and measured duration.",
      "screenId": "SCR-trHistory",
      "assetIds": [
        "SCR-trHistory"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-tr-history-4",
      "flowKind": "main",
      "instruction": "Operator opens the available evidence for a selected run.",
      "screenId": "SCR-trHistory",
      "assetIds": [
        "SCR-trHistory"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-tr-history-1",
      "flowKind": "alternate",
      "instruction": "Failed terminal runs are included with their outcome.",
      "screenId": "SCR-trHistory",
      "assetIds": [
        "SCR-trHistory"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Failed terminal runs are included with their outcome.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-tr-history-2",
      "flowKind": "alternate",
      "instruction": "Older runs are included or excluded only according to a declared actual filter.",
      "screenId": "SCR-trHistory",
      "assetIds": [
        "SCR-trHistory"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Older runs are included or excluded only according to a declared actual filter.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-tr-history-1",
      "flowKind": "exception",
      "instruction": "Invalid or missing timestamps do not produce a made-up duration.",
      "screenId": "SCR-trHistory",
      "assetIds": [
        "SCR-trHistory"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Invalid or missing timestamps do not produce a made-up duration.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-tr-history-2",
      "flowKind": "exception",
      "instruction": "A running record is not treated as a completed history entry.",
      "screenId": "SCR-trHistory",
      "assetIds": [
        "SCR-trHistory"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A running record is not treated as a completed history entry.",
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
- apps/web/public/js/preview-parts/part-01.js

### Implementation gaps and decisions

- The original fixed 30-day assertion is not established by the list route. Confirm client filter and retention separately.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-trHistory and name Review completed run outcomes. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/runs` | [apps/api/src/modules/liveOps.ts:150](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Terminal only: one running and one completed record exist; history is filtered; expected: the completed record qualifies and the running record does not.
2. Failed terminal: a run has failed; history renders; expected: the failure remains visible.
3. Duration: valid start and end timestamps are 60 seconds apart; duration is calculated; expected: the measured duration is 60 seconds.
4. No time: the completion timestamp is absent; history renders the record; expected: completion duration is not invented.

## Gherkin

```gherkin
Feature: Run history

  @UC-trHistory @AC-01 @specification
  Scenario: Terminal only
    Given one running and one completed record exist
    When history is filtered
    Then the completed record qualifies and the running record does not

  @UC-trHistory @AC-02 @specification
  Scenario: Failed terminal
    Given a run has failed
    When history renders
    Then the failure remains visible

  @UC-trHistory @AC-03 @specification
  Scenario: Duration
    Given valid start and end timestamps are 60 seconds apart
    When duration is calculated
    Then the measured duration is 60 seconds

  @UC-trHistory @AC-04 @specification
  Scenario: No time
    Given the completion timestamp is absent
    When history renders the record
    Then completion duration is not invented
```
