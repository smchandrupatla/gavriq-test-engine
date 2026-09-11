# Browse saved datasets

- **ID:** UC-dsAll
- **Screen:** Datasets
- **Page key:** `dsAll`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Find a reusable dataset and distinguish its definition from its assembled messages.

## Precondition

The session can read datasets; zero datasets is valid.

## Trigger

Operator opens Datasets; system retrieves tenant records.

## Success guarantee

Find a reusable dataset and distinguish its definition from its assembled messages. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Failed retrieval is not evidence of an empty tenant. A removed dataset reference is reported when reused.

## Acceptance criteria

1. **AC-01 [proposed]** Given a dataset shell exists, when the list loads, it is visible with zero assembled rows.
2. **AC-02 [proposed]** Given 20 messages are assembled, when the dataset is listed, its reported count reflects the stored collection.
3. **AC-03 [proposed]** Given another tenant has a dataset, when the current tenant lists datasets, the other dataset is excluded.
4. **AC-04 [proposed]** Given dataset D exists, when D is assigned to a case, the stable dataset reference is used.

## Main flow

1. Operator opens Datasets; system retrieves tenant records.
2. Operator reviews each dataset identity and available type, count and state.
3. Operator selects a dataset for inspection or later test-case assignment.
4. System carries its stable identity into the supported next workflow.

## Alternate flows

1. New dataset opens creation.
2. A shell with no assembled rows remains visible as zero rows.

## Exception flows

1. Failed retrieval is not evidence of an empty tenant.
2. A removed dataset reference is reported when reused.

## Business validation

1. Counts describe stored rows, not requested generation volume.
2. A dataset list operation does not execute a test.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/datasets

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-dsAll",
  "screenName": "Datasets",
  "navigation": {
    "menu": {
      "assetId": "MENU-datasets",
      "kind": "menu",
      "name": "Datasets",
      "label": "Datasets",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-ds-all",
      "kind": "submenu",
      "name": "Datasets",
      "label": "Datasets",
      "parentAssetId": "MENU-datasets",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-datasets",
      "kind": "menu",
      "name": "Datasets",
      "label": "Datasets",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-ds-all",
      "kind": "submenu",
      "name": "Datasets",
      "label": "Datasets",
      "parentAssetId": "MENU-datasets",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-dsAll",
      "kind": "screen",
      "name": "Datasets",
      "label": "Datasets",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-ds-all-1",
      "flowKind": "main",
      "instruction": "Operator opens Datasets; system retrieves tenant records.",
      "screenId": "SCR-dsAll",
      "assetIds": [
        "SCR-dsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-ds-all-2",
      "flowKind": "main",
      "instruction": "Operator reviews each dataset identity and available type, count and state.",
      "screenId": "SCR-dsAll",
      "assetIds": [
        "SCR-dsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-ds-all-3",
      "flowKind": "main",
      "instruction": "Operator selects a dataset for inspection or later test-case assignment.",
      "screenId": "SCR-dsAll",
      "assetIds": [
        "SCR-dsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-ds-all-4",
      "flowKind": "main",
      "instruction": "System carries its stable identity into the supported next workflow.",
      "screenId": "SCR-dsAll",
      "assetIds": [
        "SCR-dsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-ds-all-1",
      "flowKind": "alternate",
      "instruction": "New dataset opens creation.",
      "screenId": "SCR-dsAll",
      "assetIds": [
        "SCR-dsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "New dataset opens creation.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-ds-all-2",
      "flowKind": "alternate",
      "instruction": "A shell with no assembled rows remains visible as zero rows.",
      "screenId": "SCR-dsAll",
      "assetIds": [
        "SCR-dsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A shell with no assembled rows remains visible as zero rows.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-ds-all-1",
      "flowKind": "exception",
      "instruction": "Failed retrieval is not evidence of an empty tenant.",
      "screenId": "SCR-dsAll",
      "assetIds": [
        "SCR-dsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Failed retrieval is not evidence of an empty tenant.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-ds-all-2",
      "flowKind": "exception",
      "instruction": "A removed dataset reference is reported when reused.",
      "screenId": "SCR-dsAll",
      "assetIds": [
        "SCR-dsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A removed dataset reference is reported when reused.",
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

- apps/api/src/modules/registerCollections.ts
- apps/api/src/modules/collections.ts
- apps/web/public/js/preview-parts/part-00.js

### Implementation gaps and decisions

- Native navigation uses datasets, while the historical case key is dsAll. The alias is documented rather than changing feature grants.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-dsAll and name Browse saved datasets. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/datasets` | [apps/api/src/modules/registerCollections.ts:26](../../apps/api/src/modules/registerCollections.ts) |

## Scenarios

1. Zero rows: a dataset shell exists; the list loads; expected: it is visible with zero assembled rows.
2. Stored count: 20 messages are assembled; the dataset is listed; expected: its reported count reflects the stored collection.
3. Isolation: another tenant has a dataset; the current tenant lists datasets; expected: the other dataset is excluded.
4. Reuse: dataset D exists; D is assigned to a case; expected: the stable dataset reference is used.

## Gherkin

```gherkin
Feature: Datasets

  @UC-dsAll @AC-01 @specification
  Scenario: Zero rows
    Given a dataset shell exists
    When the list loads
    Then it is visible with zero assembled rows

  @UC-dsAll @AC-02 @specification
  Scenario: Stored count
    Given 20 messages are assembled
    When the dataset is listed
    Then its reported count reflects the stored collection

  @UC-dsAll @AC-03 @specification
  Scenario: Isolation
    Given another tenant has a dataset
    When the current tenant lists datasets
    Then the other dataset is excluded

  @UC-dsAll @AC-04 @specification
  Scenario: Reuse
    Given dataset D exists
    When D is assigned to a case
    Then the stable dataset reference is used
```
