# See every test run, any state

- **ID:** UC-trAll
- **Screen:** All test runs
- **Page key:** `trAll`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Inspect all available tenant runs without hiding unsuccessful outcomes.

## Precondition

The operator can read runs; zero runs is valid.

## Trigger

Operator opens All test runs.

## Success guarantee

Inspect all available tenant runs without hiding unsuccessful outcomes. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A storage error currently may appear as an empty API list; it must not be described as verified absence. Missing timestamps produce unknown duration, not zero.

## Acceptance criteria

1. **AC-01 [proposed]** Given completed and failed runs exist, when the list loads, both outcomes are represented.
2. **AC-02 [proposed]** Given 25 runs exist with page size 10, when page one renders, ten visible rows are not described as the entire total.
3. **AC-03 [proposed]** Given the store confirms zero runs, when the list renders, an empty state appears.
4. **AC-04 [proposed]** Given an end timestamp is missing, when duration is shown, the duration is unknown rather than fabricated.

## Main flow

1. Operator opens All test runs.
2. System retrieves stored runs and displays their returned states.
3. Operator inspects a run by identity.
4. Operator follows an available report or starts a separate new run.

## Alternate flows

1. Pagination limits visible rows without changing total semantics.
2. Failed runs remain visible.

## Exception flows

1. A storage error currently may appear as an empty API list; it must not be described as verified absence.
2. Missing timestamps produce unknown duration, not zero.

## Business validation

1. Total counts distinguish all records from the visible page.
2. Starting a new run does not rewrite historical outcomes.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/runs

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-trAll",
  "screenName": "All test runs",
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
      "assetId": "SUBMENU-tr-all",
      "kind": "submenu",
      "name": "All test runs",
      "label": "All test runs",
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
      "assetId": "SUBMENU-tr-all",
      "kind": "submenu",
      "name": "All test runs",
      "label": "All test runs",
      "parentAssetId": "MENU-test-runs",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-trAll",
      "kind": "screen",
      "name": "All test runs",
      "label": "All test runs",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-tr-all-1",
      "flowKind": "main",
      "instruction": "Operator opens All test runs.",
      "screenId": "SCR-trAll",
      "assetIds": [
        "SCR-trAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-tr-all-2",
      "flowKind": "main",
      "instruction": "System retrieves stored runs and displays their returned states.",
      "screenId": "SCR-trAll",
      "assetIds": [
        "SCR-trAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-tr-all-3",
      "flowKind": "main",
      "instruction": "Operator inspects a run by identity.",
      "screenId": "SCR-trAll",
      "assetIds": [
        "SCR-trAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-tr-all-4",
      "flowKind": "main",
      "instruction": "Operator follows an available report or starts a separate new run.",
      "screenId": "SCR-trAll",
      "assetIds": [
        "SCR-trAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-tr-all-1",
      "flowKind": "alternate",
      "instruction": "Pagination limits visible rows without changing total semantics.",
      "screenId": "SCR-trAll",
      "assetIds": [
        "SCR-trAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Pagination limits visible rows without changing total semantics.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-tr-all-2",
      "flowKind": "alternate",
      "instruction": "Failed runs remain visible.",
      "screenId": "SCR-trAll",
      "assetIds": [
        "SCR-trAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Failed runs remain visible.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-tr-all-1",
      "flowKind": "exception",
      "instruction": "A storage error currently may appear as an empty API list; it must not be described as verified absence.",
      "screenId": "SCR-trAll",
      "assetIds": [
        "SCR-trAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A storage error currently may appear as an empty API list; it must not be described as verified absence.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-tr-all-2",
      "flowKind": "exception",
      "instruction": "Missing timestamps produce unknown duration, not zero.",
      "screenId": "SCR-trAll",
      "assetIds": [
        "SCR-trAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Missing timestamps produce unknown duration, not zero.",
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

- List API catches database errors and returns data: []; error-versus-empty distinction needs product implementation.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-trAll and name See every test run, any state. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/runs` | [apps/api/src/modules/liveOps.ts:150](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. All states: completed and failed runs exist; the list loads; expected: both outcomes are represented.
2. Pagination: 25 runs exist with page size 10; page one renders; expected: ten visible rows are not described as the entire total.
3. Empty: the store confirms zero runs; the list renders; expected: an empty state appears.
4. Unknown duration: an end timestamp is missing; duration is shown; expected: the duration is unknown rather than fabricated.

## Gherkin

```gherkin
Feature: All test runs

  @UC-trAll @AC-01 @specification
  Scenario: All states
    Given completed and failed runs exist
    When the list loads
    Then both outcomes are represented

  @UC-trAll @AC-02 @specification
  Scenario: Pagination
    Given 25 runs exist with page size 10
    When page one renders
    Then ten visible rows are not described as the entire total

  @UC-trAll @AC-03 @specification
  Scenario: Empty
    Given the store confirms zero runs
    When the list renders
    Then an empty state appears

  @UC-trAll @AC-04 @specification
  Scenario: Unknown duration
    Given an end timestamp is missing
    When duration is shown
    Then the duration is unknown rather than fabricated
```
