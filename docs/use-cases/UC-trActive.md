# Watch runs currently in progress

- **ID:** UC-trActive
- **Screen:** Active runs
- **Page key:** `trActive`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Monitor genuinely active runs and identify stale or disconnected progress.

## Precondition

Run records are readable; no active runs is valid.

## Trigger

Operator opens Active runs.

## Success guarantee

Monitor genuinely active runs and identify stale or disconnected progress. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A disconnected stream marks data stale rather than inventing progress. A missing run detail is reported without opening another run.

## Acceptance criteria

1. **AC-01 [proposed]** Given one active and one completed run exist, when Active runs loads, only the active run is classified as active.
2. **AC-02 [proposed]** Given updates stop after a connection error, when the detail remains open, the last known progress is identified as stale.
3. **AC-03 [proposed]** Given an active run completes, when the terminal update arrives, the run is no longer represented as running.
4. **AC-04 [proposed]** Given the active set contains two IDs, when tiles switch to table, the same two IDs remain represented.

## Main flow

1. Operator opens Active runs.
2. System selects active states from the available run collection.
3. Operator opens one run by ID.
4. System displays available progress and receives stream updates where connected.
5. System moves a terminal run out of the active classification on refresh.

## Alternate flows

1. Tile and table views represent the same records.
2. An empty active collection links to a new run or history.

## Exception flows

1. A disconnected stream marks data stale rather than inventing progress.
2. A missing run detail is reported without opening another run.

## Business validation

1. Progress may not exceed its defined denominator.
2. Completed, failed and cancelled outcomes must not remain labelled Running.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/runs
4. GET /api/v1/runs/:id
5. GET /api/v1/runs/:id/stream

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-trActive",
  "screenName": "Active runs",
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
      "assetId": "SUBMENU-tr-active",
      "kind": "submenu",
      "name": "Active runs",
      "label": "Active runs",
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
      "assetId": "SUBMENU-tr-active",
      "kind": "submenu",
      "name": "Active runs",
      "label": "Active runs",
      "parentAssetId": "MENU-test-runs",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-trActive",
      "kind": "screen",
      "name": "Active runs",
      "label": "Active runs",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-tr-active-1",
      "flowKind": "main",
      "instruction": "Operator opens Active runs.",
      "screenId": "SCR-trActive",
      "assetIds": [
        "SCR-trActive"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-tr-active-2",
      "flowKind": "main",
      "instruction": "System selects active states from the available run collection.",
      "screenId": "SCR-trActive",
      "assetIds": [
        "SCR-trActive"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-tr-active-3",
      "flowKind": "main",
      "instruction": "Operator opens one run by ID.",
      "screenId": "SCR-trActive",
      "assetIds": [
        "SCR-trActive"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-tr-active-4",
      "flowKind": "main",
      "instruction": "System displays available progress and receives stream updates where connected.",
      "screenId": "SCR-trActive",
      "assetIds": [
        "SCR-trActive"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-tr-active-5",
      "flowKind": "main",
      "instruction": "System moves a terminal run out of the active classification on refresh.",
      "screenId": "SCR-trActive",
      "assetIds": [
        "SCR-trActive"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-tr-active-1",
      "flowKind": "alternate",
      "instruction": "Tile and table views represent the same records.",
      "screenId": "SCR-trActive",
      "assetIds": [
        "SCR-trActive"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Tile and table views represent the same records.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-tr-active-2",
      "flowKind": "alternate",
      "instruction": "An empty active collection links to a new run or history.",
      "screenId": "SCR-trActive",
      "assetIds": [
        "SCR-trActive"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty active collection links to a new run or history.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-tr-active-1",
      "flowKind": "exception",
      "instruction": "A disconnected stream marks data stale rather than inventing progress.",
      "screenId": "SCR-trActive",
      "assetIds": [
        "SCR-trActive"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A disconnected stream marks data stale rather than inventing progress.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-tr-active-2",
      "flowKind": "exception",
      "instruction": "A missing run detail is reported without opening another run.",
      "screenId": "SCR-trActive",
      "assetIds": [
        "SCR-trActive"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A missing run detail is reported without opening another run.",
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

- apps/api/src/modules/registerRunStream.ts
- apps/web/public/js/preview-parts/part-06.js
- apps/api/src/modules/liveOps.ts

### Implementation gaps and decisions

- A registered stream endpoint does not establish per-row subscription in the current list binder.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-trActive and name Watch runs currently in progress. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/runs` | [apps/api/src/modules/liveOps.ts:150](../../apps/api/src/modules/liveOps.ts) |
| `GET /api/v1/runs/:id` | [apps/api/src/modules/registerSpecGaps.ts:115](../../apps/api/src/modules/registerSpecGaps.ts) |
| `GET /api/v1/runs/:id/stream` | [apps/api/src/modules/registerRunStream.ts:16](../../apps/api/src/modules/registerRunStream.ts) |

## Scenarios

1. Filter states: one active and one completed run exist; Active runs loads; expected: only the active run is classified as active.
2. Stream loss: updates stop after a connection error; the detail remains open; expected: the last known progress is identified as stale.
3. Terminal update: an active run completes; the terminal update arrives; expected: the run is no longer represented as running.
4. View parity: the active set contains two IDs; tiles switch to table; expected: the same two IDs remain represented.

## Gherkin

```gherkin
Feature: Active runs

  @UC-trActive @AC-01 @specification
  Scenario: Filter states
    Given one active and one completed run exist
    When Active runs loads
    Then only the active run is classified as active

  @UC-trActive @AC-02 @specification
  Scenario: Stream loss
    Given updates stop after a connection error
    When the detail remains open
    Then the last known progress is identified as stale

  @UC-trActive @AC-03 @specification
  Scenario: Terminal update
    Given an active run completes
    When the terminal update arrives
    Then the run is no longer represented as running

  @UC-trActive @AC-04 @specification
  Scenario: View parity
    Given the active set contains two IDs
    When tiles switch to table
    Then the same two IDs remain represented
```
