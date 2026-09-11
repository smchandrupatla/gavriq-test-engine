# Define a new test case

- **ID:** UC-tcNew
- **Screen:** New test case
- **Page key:** `tcNew`
- **Level:** 2
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Define a named test objective with an optional dataset and a reviewable expected outcome.

## Precondition

The analyst can create test cases; a dataset may be assigned now or later.

## Trigger

Analyst opens case creation and enters a distinct name.

## Success guarantee

Define a named test objective with an optional dataset and a reviewable expected outcome. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Blank name is rejected by createCase. A failed or uncertain save must not be displayed as a confirmed test-case creation.

## Acceptance criteria

1. **AC-01 [proposed]** Given name and objective identify a boundary test, when the analyst saves, the stored case has its identity and supplied objective.
2. **AC-02 [proposed]** Given the name is whitespace, when the analyst saves, the request fails validation.
3. **AC-03 [proposed]** Given no dataset is selected, when a named case is saved, creation can succeed without inventing a dataset.
4. **AC-04 [proposed]** Given a case is created, when the result is shown, the result describes a definition rather than a passed execution.

## Main flow

1. Analyst opens case creation and enters a distinct name.
2. Analyst describes the condition to exercise and the expected outcome.
3. Analyst chooses a dataset where available.
4. System validates supported fields; analyst explicitly saves.
5. System returns the case identity and makes the definition available for suite membership.

## Alternate flows

1. A case may be saved without a dataset under the current API.
2. The describe endpoint supplies a suggestion for analyst review, not a proven assertion.

## Exception flows

1. Blank name is rejected by createCase.
2. A failed or uncertain save must not be displayed as a confirmed test-case creation.

## Business validation

1. One objective should identify what would constitute pass and fail.
2. Source currently allows null objective; requiring objective and executable expected assertions is a proposed improvement.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/test-cases
4. POST /api/v1/test-cases/describe

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-tcNew",
  "screenName": "New test case",
  "navigation": {
    "menu": {
      "assetId": "MENU-test-cases",
      "kind": "menu",
      "name": "Test Cases",
      "label": "Test Cases",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-tc-new",
      "kind": "submenu",
      "name": "New test case",
      "label": "New test case",
      "parentAssetId": "MENU-test-cases",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-test-cases",
      "kind": "menu",
      "name": "Test Cases",
      "label": "Test Cases",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-tc-new",
      "kind": "submenu",
      "name": "New test case",
      "label": "New test case",
      "parentAssetId": "MENU-test-cases",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-tcNew",
      "kind": "screen",
      "name": "New test case",
      "label": "New test case",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-tc-new-1",
      "flowKind": "main",
      "instruction": "Analyst opens case creation and enters a distinct name.",
      "screenId": "SCR-tcNew",
      "assetIds": [
        "SCR-tcNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-tc-new-2",
      "flowKind": "main",
      "instruction": "Analyst describes the condition to exercise and the expected outcome.",
      "screenId": "SCR-tcNew",
      "assetIds": [
        "SCR-tcNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-tc-new-3",
      "flowKind": "main",
      "instruction": "Analyst chooses a dataset where available.",
      "screenId": "SCR-tcNew",
      "assetIds": [
        "SCR-tcNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-tc-new-4",
      "flowKind": "main",
      "instruction": "System validates supported fields; analyst explicitly saves.",
      "screenId": "SCR-tcNew",
      "assetIds": [
        "SCR-tcNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-tc-new-5",
      "flowKind": "main",
      "instruction": "System returns the case identity and makes the definition available for suite membership.",
      "screenId": "SCR-tcNew",
      "assetIds": [
        "SCR-tcNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-tc-new-1",
      "flowKind": "alternate",
      "instruction": "A case may be saved without a dataset under the current API.",
      "screenId": "SCR-tcNew",
      "assetIds": [
        "SCR-tcNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A case may be saved without a dataset under the current API.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-tc-new-2",
      "flowKind": "alternate",
      "instruction": "The describe endpoint supplies a suggestion for analyst review, not a proven assertion.",
      "screenId": "SCR-tcNew",
      "assetIds": [
        "SCR-tcNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The describe endpoint supplies a suggestion for analyst review, not a proven assertion.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-tc-new-1",
      "flowKind": "exception",
      "instruction": "Blank name is rejected by createCase.",
      "screenId": "SCR-tcNew",
      "assetIds": [
        "SCR-tcNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Blank name is rejected by createCase.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-tc-new-2",
      "flowKind": "exception",
      "instruction": "A failed or uncertain save must not be displayed as a confirmed test-case creation.",
      "screenId": "SCR-tcNew",
      "assetIds": [
        "SCR-tcNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed or uncertain save must not be displayed as a confirmed test-case creation.",
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

- apps/api/src/modules/registerTestCases.ts
- apps/api/src/modules/collections.ts
- apps/api/src/modules/registerSpecGaps.ts

### Implementation gaps and decisions

- The model has name/datasetId/objective, not executable Gherkin or a chosen-language test runner. The specification tests in this review do not add that product capability.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-tcNew and name Define a new test case. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/test-cases` | [apps/api/src/modules/registerTestCases.ts:25](../../apps/api/src/modules/registerTestCases.ts) |
| `POST /api/v1/test-cases/describe` | [apps/api/src/modules/registerSpecGaps.ts:73](../../apps/api/src/modules/registerSpecGaps.ts) |

## Scenarios

1. Valid case: name and objective identify a boundary test; the analyst saves; expected: the stored case has its identity and supplied objective.
2. Blank name: the name is whitespace; the analyst saves; expected: the request fails validation.
3. Optional dataset: no dataset is selected; a named case is saved; expected: creation can succeed without inventing a dataset.
4. No execution claim: a case is created; the result is shown; expected: the result describes a definition rather than a passed execution.

## Gherkin

```gherkin
Feature: New test case

  @UC-tcNew @AC-01 @specification
  Scenario: Valid case
    Given name and objective identify a boundary test
    When the analyst saves
    Then the stored case has its identity and supplied objective

  @UC-tcNew @AC-02 @specification
  Scenario: Blank name
    Given the name is whitespace
    When the analyst saves
    Then the request fails validation

  @UC-tcNew @AC-03 @specification
  Scenario: Optional dataset
    Given no dataset is selected
    When a named case is saved
    Then creation can succeed without inventing a dataset

  @UC-tcNew @AC-04 @specification
  Scenario: No execution claim
    Given a case is created
    When the result is shown
    Then the result describes a definition rather than a passed execution
```
