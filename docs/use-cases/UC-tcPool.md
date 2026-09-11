# See every defined test case

- **ID:** UC-tcPool
- **Screen:** Test Cases
- **Page key:** `tcPool`
- **Level:** 1
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Locate test-case definitions and inspect the objective and dataset before suite reuse.

## Precondition

The analyst can read test cases; a case need not belong to a suite.

## Trigger

Analyst opens Test Cases; system loads the tenant case collection.

## Success guarantee

Locate test-case definitions and inspect the objective and dataset before suite reuse. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A missing dataset is disclosed rather than substituted. A stale version cannot silently overwrite a concurrent case edit.

## Acceptance criteria

1. **AC-01 [proposed]** Given a case has no datasetId, when the pool loads, the case remains visible with the missing reference disclosed.
2. **AC-02 [proposed]** Given a case has never run, when its definition is inspected, it is not labelled as passed solely because it exists.
3. **AC-03 [proposed]** Given two cases have similar names, when one is opened, the request uses its ID.
4. **AC-04 [proposed]** Given the current ETag changed, when an old If-Match updates the case, the stale write is rejected.

## Main flow

1. Analyst opens Test Cases; system loads the tenant case collection.
2. Analyst reviews name, objective and dataset reference.
3. Analyst opens a case by ID and reviews its stored details.
4. Analyst chooses a supported edit or uses the case when building a suite.

## Alternate flows

1. A case without a dataset remains a draft definition for later completion.
2. An empty pool offers case creation.

## Exception flows

1. A missing dataset is disclosed rather than substituted.
2. A stale version cannot silently overwrite a concurrent case edit.

## Business validation

1. Case existence is not a passed result.
2. Suite membership and test-case identity are separate.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/test-cases

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-tcPool",
  "screenName": "Test Cases",
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
      "assetId": "SUBMENU-tc-pool",
      "kind": "submenu",
      "name": "Test Cases",
      "label": "Test Cases",
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
      "assetId": "SUBMENU-tc-pool",
      "kind": "submenu",
      "name": "Test Cases",
      "label": "Test Cases",
      "parentAssetId": "MENU-test-cases",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-tcPool",
      "kind": "screen",
      "name": "Test Cases",
      "label": "Test Cases",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-tc-pool-1",
      "flowKind": "main",
      "instruction": "Analyst opens Test Cases; system loads the tenant case collection.",
      "screenId": "SCR-tcPool",
      "assetIds": [
        "SCR-tcPool"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-tc-pool-2",
      "flowKind": "main",
      "instruction": "Analyst reviews name, objective and dataset reference.",
      "screenId": "SCR-tcPool",
      "assetIds": [
        "SCR-tcPool"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-tc-pool-3",
      "flowKind": "main",
      "instruction": "Analyst opens a case by ID and reviews its stored details.",
      "screenId": "SCR-tcPool",
      "assetIds": [
        "SCR-tcPool"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-tc-pool-4",
      "flowKind": "main",
      "instruction": "Analyst chooses a supported edit or uses the case when building a suite.",
      "screenId": "SCR-tcPool",
      "assetIds": [
        "SCR-tcPool"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-tc-pool-1",
      "flowKind": "alternate",
      "instruction": "A case without a dataset remains a draft definition for later completion.",
      "screenId": "SCR-tcPool",
      "assetIds": [
        "SCR-tcPool"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A case without a dataset remains a draft definition for later completion.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-tc-pool-2",
      "flowKind": "alternate",
      "instruction": "An empty pool offers case creation.",
      "screenId": "SCR-tcPool",
      "assetIds": [
        "SCR-tcPool"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty pool offers case creation.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-tc-pool-1",
      "flowKind": "exception",
      "instruction": "A missing dataset is disclosed rather than substituted.",
      "screenId": "SCR-tcPool",
      "assetIds": [
        "SCR-tcPool"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A missing dataset is disclosed rather than substituted.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-tc-pool-2",
      "flowKind": "exception",
      "instruction": "A stale version cannot silently overwrite a concurrent case edit.",
      "screenId": "SCR-tcPool",
      "assetIds": [
        "SCR-tcPool"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A stale version cannot silently overwrite a concurrent case edit.",
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

### Implementation gaps and decisions

- Native navigation is testCases. Search and execution-result status need runtime verification.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)
- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-tcPool and name See every defined test case. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/test-cases` | [apps/api/src/modules/registerTestCases.ts:19](../../apps/api/src/modules/registerTestCases.ts) |

## Scenarios

1. No dataset: a case has no datasetId; the pool loads; expected: the case remains visible with the missing reference disclosed.
2. No execution: a case has never run; its definition is inspected; expected: it is not labelled as passed solely because it exists.
3. Stable identity: two cases have similar names; one is opened; expected: the request uses its ID.
4. Stale edit: the current ETag changed; an old If-Match updates the case; expected: the stale write is rejected.

## Gherkin

```gherkin
Feature: Test Cases

  @UC-tcPool @AC-01 @specification
  Scenario: No dataset
    Given a case has no datasetId
    When the pool loads
    Then the case remains visible with the missing reference disclosed

  @UC-tcPool @AC-02 @specification
  Scenario: No execution
    Given a case has never run
    When its definition is inspected
    Then it is not labelled as passed solely because it exists

  @UC-tcPool @AC-03 @specification
  Scenario: Stable identity
    Given two cases have similar names
    When one is opened
    Then the request uses its ID

  @UC-tcPool @AC-04 @specification
  Scenario: Stale edit
    Given the current ETag changed
    When an old If-Match updates the case
    Then the stale write is rejected
```
