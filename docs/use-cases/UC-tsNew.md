# Group test cases into a suite

- **ID:** UC-tsNew
- **Screen:** New test suite
- **Page key:** `tsNew`
- **Level:** 1
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Create a reusable named suite with explicit case membership and ordering.

## Precondition

The analyst can create suites and can read any cases to be included.

## Trigger

Analyst enters a suite name.

## Success guarantee

Create a reusable named suite with explicit case membership and ordering. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Blank name is rejected. Unknown member IDs or duplicate entries need an explicit result rather than silent loss.

## Acceptance criteria

1. **AC-01 [proposed]** Given three existing cases are selected, when the suite is saved, reopening shows those case identities.
2. **AC-02 [proposed]** Given no cases are selected, when a named suite is saved, it is represented as zero members.
3. **AC-03 [proposed]** Given the name is blank, when Save is submitted, creation fails validation.
4. **AC-04 [proposed]** Given a suite contains A and B, when the supported reorder operation stores B then A, the returned membership reflects that order.

## Main flow

1. Analyst enters a suite name.
2. System lists available test cases; analyst selects intended members.
3. Analyst reviews member identities and order.
4. Analyst saves; system returns the suite identity.
5. Analyst reopens the suite to verify stored membership.

## Alternate flows

1. An empty suite can be created as an incomplete grouping.
2. Later membership/order changes use the supported suite APIs.

## Exception flows

1. Blank name is rejected.
2. Unknown member IDs or duplicate entries need an explicit result rather than silent loss.

## Business validation

1. Creating a suite does not execute its members.
2. Ordering does not imply a dependency or shared-state policy unless separately specified.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/test-suites
4. PUT /api/v1/test-suites/:id/cases

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-tsNew",
  "screenName": "New test suite",
  "navigation": {
    "menu": {
      "assetId": "MENU-test-suites",
      "kind": "menu",
      "name": "Test Suites",
      "label": "Test Suites",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-ts-new",
      "kind": "submenu",
      "name": "New test suite",
      "label": "New test suite",
      "parentAssetId": "MENU-test-suites",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-test-suites",
      "kind": "menu",
      "name": "Test Suites",
      "label": "Test Suites",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-ts-new",
      "kind": "submenu",
      "name": "New test suite",
      "label": "New test suite",
      "parentAssetId": "MENU-test-suites",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-tsNew",
      "kind": "screen",
      "name": "New test suite",
      "label": "New test suite",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-ts-new-1",
      "flowKind": "main",
      "instruction": "Analyst enters a suite name.",
      "screenId": "SCR-tsNew",
      "assetIds": [
        "SCR-tsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-ts-new-2",
      "flowKind": "main",
      "instruction": "System lists available test cases; analyst selects intended members.",
      "screenId": "SCR-tsNew",
      "assetIds": [
        "SCR-tsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-ts-new-3",
      "flowKind": "main",
      "instruction": "Analyst reviews member identities and order.",
      "screenId": "SCR-tsNew",
      "assetIds": [
        "SCR-tsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-ts-new-4",
      "flowKind": "main",
      "instruction": "Analyst saves; system returns the suite identity.",
      "screenId": "SCR-tsNew",
      "assetIds": [
        "SCR-tsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-ts-new-5",
      "flowKind": "main",
      "instruction": "Analyst reopens the suite to verify stored membership.",
      "screenId": "SCR-tsNew",
      "assetIds": [
        "SCR-tsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-ts-new-1",
      "flowKind": "alternate",
      "instruction": "An empty suite can be created as an incomplete grouping.",
      "screenId": "SCR-tsNew",
      "assetIds": [
        "SCR-tsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty suite can be created as an incomplete grouping.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-ts-new-2",
      "flowKind": "alternate",
      "instruction": "Later membership/order changes use the supported suite APIs.",
      "screenId": "SCR-tsNew",
      "assetIds": [
        "SCR-tsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Later membership/order changes use the supported suite APIs.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-ts-new-1",
      "flowKind": "exception",
      "instruction": "Blank name is rejected.",
      "screenId": "SCR-tsNew",
      "assetIds": [
        "SCR-tsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Blank name is rejected.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-ts-new-2",
      "flowKind": "exception",
      "instruction": "Unknown member IDs or duplicate entries need an explicit result rather than silent loss.",
      "screenId": "SCR-tsNew",
      "assetIds": [
        "SCR-tsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unknown member IDs or duplicate entries need an explicit result rather than silent loss.",
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

- apps/api/src/modules/registerTestSuites.ts
- apps/api/src/modules/registerSpecPersist.ts
- apps/api/src/modules/collections.ts

### Implementation gaps and decisions

- Unknown member validation, duplicate policy, dependency ordering and atomic membership updates need explicit decisions and evidence.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-tsNew and name Group test cases into a suite. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/test-suites` | [apps/api/src/modules/registerTestSuites.ts:25](../../apps/api/src/modules/registerTestSuites.ts) |
| `PUT /api/v1/test-suites/:id/cases` | [apps/api/src/modules/registerSpecPersist.ts:78](../../apps/api/src/modules/registerSpecPersist.ts) |

## Scenarios

1. Three members: three existing cases are selected; the suite is saved; expected: reopening shows those case identities.
2. Empty grouping: no cases are selected; a named suite is saved; expected: it is represented as zero members.
3. Blank name: the name is blank; Save is submitted; expected: creation fails validation.
4. Reorder: a suite contains A and B; the supported reorder operation stores B then A; expected: the returned membership reflects that order.

## Gherkin

```gherkin
Feature: New test suite

  @UC-tsNew @AC-01 @specification
  Scenario: Three members
    Given three existing cases are selected
    When the suite is saved
    Then reopening shows those case identities

  @UC-tsNew @AC-02 @specification
  Scenario: Empty grouping
    Given no cases are selected
    When a named suite is saved
    Then it is represented as zero members

  @UC-tsNew @AC-03 @specification
  Scenario: Blank name
    Given the name is blank
    When Save is submitted
    Then creation fails validation

  @UC-tsNew @AC-04 @specification
  Scenario: Reorder
    Given a suite contains A and B
    When the supported reorder operation stores B then A
    Then the returned membership reflects that order
```
