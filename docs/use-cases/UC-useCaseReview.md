# Use-case review

- **ID:** UC-useCaseReview
- **Screen:** Use-case review
- **Page key:** `useCaseReview`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Run the deterministic catalogue review and inspect its actual findings without claiming product execution coverage.

## Precondition

Use cases and the review endpoint are available.

## Trigger

Author opens Use-case review.

## Success guarantee

Run the deterministic catalogue review and inspect its actual findings without claiming product execution coverage. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A failed review request must not be shown as all cases passing. A missing case cannot be silently omitted from the coverage denominator.

## Acceptance criteria

1. **AC-01 [proposed]** Given review returns deterministic-contract-review, when results display, the review is described with that mode.
2. **AC-02 [proposed]** Given the catalogue has N cases, when all-case review completes, its coverage accounts for all N cases.
3. **AC-03 [proposed]** Given the request fails, when the status is displayed, no all-passed result is fabricated.
4. **AC-04 [proposed]** Given no structural finding exists, when the result is interpreted, it does not certify runtime behavior.

## Main flow

1. Author opens Use-case review.
2. Author selects Review all use cases.
3. System calls the deterministic review endpoint and displays its returned findings.
4. Author follows identified catalogue gaps for specification correction.

## Alternate flows

1. A page-specific review can be requested through its registered API.
2. No findings means only the implemented review rules found nothing.

## Exception flows

1. A failed review request must not be shown as all cases passing.
2. A missing case cannot be silently omitted from the coverage denominator.

## Business validation

1. The implementation manager label does not mean an external AI was invoked.
2. Contract validation is not proof of working UI or APIs.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/use-cases/review
4. POST /api/v1/use-cases/review/:page

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-useCaseReview",
  "screenName": "Use-case review",
  "navigation": {
    "menu": {
      "assetId": "MENU-configuration",
      "kind": "menu",
      "name": "Configuration",
      "label": "Configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-use-case-review",
      "kind": "submenu",
      "name": "Use-case review",
      "label": "Use-case review",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-configuration",
      "kind": "menu",
      "name": "Configuration",
      "label": "Configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-use-case-review",
      "kind": "submenu",
      "name": "Use-case review",
      "label": "Use-case review",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-useCaseReview",
      "kind": "screen",
      "name": "Use-case review",
      "label": "Use-case review",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-use-case-review-1",
      "flowKind": "main",
      "instruction": "Author opens Use-case review.",
      "screenId": "SCR-useCaseReview",
      "assetIds": [
        "SCR-useCaseReview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-use-case-review-2",
      "flowKind": "main",
      "instruction": "Author selects Review all use cases.",
      "screenId": "SCR-useCaseReview",
      "assetIds": [
        "SCR-useCaseReview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-use-case-review-3",
      "flowKind": "main",
      "instruction": "System calls the deterministic review endpoint and displays its returned findings.",
      "screenId": "SCR-useCaseReview",
      "assetIds": [
        "SCR-useCaseReview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-use-case-review-4",
      "flowKind": "main",
      "instruction": "Author follows identified catalogue gaps for specification correction.",
      "screenId": "SCR-useCaseReview",
      "assetIds": [
        "SCR-useCaseReview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-use-case-review-1",
      "flowKind": "alternate",
      "instruction": "A page-specific review can be requested through its registered API.",
      "screenId": "SCR-useCaseReview",
      "assetIds": [
        "SCR-useCaseReview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A page-specific review can be requested through its registered API.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-use-case-review-2",
      "flowKind": "alternate",
      "instruction": "No findings means only the implemented review rules found nothing.",
      "screenId": "SCR-useCaseReview",
      "assetIds": [
        "SCR-useCaseReview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No findings means only the implemented review rules found nothing.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-use-case-review-1",
      "flowKind": "exception",
      "instruction": "A failed review request must not be shown as all cases passing.",
      "screenId": "SCR-useCaseReview",
      "assetIds": [
        "SCR-useCaseReview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed review request must not be shown as all cases passing.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-use-case-review-2",
      "flowKind": "exception",
      "instruction": "A missing case cannot be silently omitted from the coverage denominator.",
      "screenId": "SCR-useCaseReview",
      "assetIds": [
        "SCR-useCaseReview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A missing case cannot be silently omitted from the coverage denominator.",
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

- apps/web/public/js/preview-parts/part-06.js
- apps/api/src/modules/registerUseCases.ts

### Implementation gaps and decisions

- Current review is structural. Runtime contracts, sources and Gherkin coverage need the repository checks supplied with this review.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-useCaseReview and name Use-case review. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/use-cases/review` | [apps/api/src/modules/registerUseCases.ts:265](../../apps/api/src/modules/registerUseCases.ts) |
| `POST /api/v1/use-cases/review/:page` | [apps/api/src/modules/registerUseCases.ts:265](../../apps/api/src/modules/registerUseCases.ts) |

## Scenarios

1. Deterministic mode: review returns deterministic-contract-review; results display; expected: the review is described with that mode.
2. Full denominator: the catalogue has N cases; all-case review completes; expected: its coverage accounts for all N cases.
3. Review failure: the request fails; the status is displayed; expected: no all-passed result is fabricated.
4. Limited assurance: no structural finding exists; the result is interpreted; expected: it does not certify runtime behavior.

## Gherkin

```gherkin
Feature: Use-case review

  @UC-useCaseReview @AC-01 @specification
  Scenario: Deterministic mode
    Given review returns deterministic-contract-review
    When results display
    Then the review is described with that mode

  @UC-useCaseReview @AC-02 @specification
  Scenario: Full denominator
    Given the catalogue has N cases
    When all-case review completes
    Then its coverage accounts for all N cases

  @UC-useCaseReview @AC-03 @specification
  Scenario: Review failure
    Given the request fails
    When the status is displayed
    Then no all-passed result is fabricated

  @UC-useCaseReview @AC-04 @specification
  Scenario: Limited assurance
    Given no structural finding exists
    When the result is interpreted
    Then it does not certify runtime behavior
```
