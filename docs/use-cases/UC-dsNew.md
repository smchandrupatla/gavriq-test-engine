# Create a new dataset

- **ID:** UC-dsNew
- **Screen:** Create new dataset
- **Page key:** `dsNew`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Create a named dataset and explicitly assemble its intended source items.

## Precondition

The operator can write datasets and has identified source items or intends to create an empty shell.

## Trigger

Operator supplies a dataset name; system creates the dataset shell.

## Success guarantee

Create a named dataset and explicitly assemble its intended source items. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Blank names are rejected. Shell creation may have succeeded even when later assembly fails; report each result separately.

## Acceptance criteria

1. **AC-01 [proposed]** Given a valid name is supplied, when dataset creation succeeds, a dataset identity exists without claiming assembly.
2. **AC-02 [proposed]** Given name is blank, when creation is submitted, validation rejects the name.
3. **AC-03 [proposed]** Given two valid source items are selected, when assembly succeeds, the returned messages and sequence can be inspected.
4. **AC-04 [proposed]** Given the shell exists but assembly fails, when results render, the shell is not falsely described as a completed batch.

## Main flow

1. Operator supplies a dataset name; system creates the dataset shell.
2. Operator supplies supported item kinds, references and counts.
3. System validates the available source context.
4. Operator requests assembly; system returns the materialised result.
5. Operator retrieves assembled messages and compares their count and sequence with the request.

## Alternate flows

1. Items can be added after shell creation.
2. Bulk merge is a separate operation with selected source dataset IDs.

## Exception flows

1. Blank names are rejected.
2. Shell creation may have succeeded even when later assembly fails; report each result separately.

## Business validation

1. A shell is not a populated dataset.
2. Determinism requires the same source snapshot, generation settings and ordering rules.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/datasets
4. POST /api/v1/datasets/:id/assemble
5. POST /api/v1/datasets/:id/items
6. POST /api/v1/datasets/bulk/merge

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-dsNew",
  "screenName": "Create new dataset",
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
      "assetId": "SUBMENU-ds-new",
      "kind": "submenu",
      "name": "Create new dataset",
      "label": "Create new dataset",
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
      "assetId": "SUBMENU-ds-new",
      "kind": "submenu",
      "name": "Create new dataset",
      "label": "Create new dataset",
      "parentAssetId": "MENU-datasets",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-dsNew",
      "kind": "screen",
      "name": "Create new dataset",
      "label": "Create new dataset",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-ds-new-1",
      "flowKind": "main",
      "instruction": "Operator supplies a dataset name; system creates the dataset shell.",
      "screenId": "SCR-dsNew",
      "assetIds": [
        "SCR-dsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-ds-new-2",
      "flowKind": "main",
      "instruction": "Operator supplies supported item kinds, references and counts.",
      "screenId": "SCR-dsNew",
      "assetIds": [
        "SCR-dsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-ds-new-3",
      "flowKind": "main",
      "instruction": "System validates the available source context.",
      "screenId": "SCR-dsNew",
      "assetIds": [
        "SCR-dsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-ds-new-4",
      "flowKind": "main",
      "instruction": "Operator requests assembly; system returns the materialised result.",
      "screenId": "SCR-dsNew",
      "assetIds": [
        "SCR-dsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-ds-new-5",
      "flowKind": "main",
      "instruction": "Operator retrieves assembled messages and compares their count and sequence with the request.",
      "screenId": "SCR-dsNew",
      "assetIds": [
        "SCR-dsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-ds-new-1",
      "flowKind": "alternate",
      "instruction": "Items can be added after shell creation.",
      "screenId": "SCR-dsNew",
      "assetIds": [
        "SCR-dsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Items can be added after shell creation.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-ds-new-2",
      "flowKind": "alternate",
      "instruction": "Bulk merge is a separate operation with selected source dataset IDs.",
      "screenId": "SCR-dsNew",
      "assetIds": [
        "SCR-dsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Bulk merge is a separate operation with selected source dataset IDs.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-ds-new-1",
      "flowKind": "exception",
      "instruction": "Blank names are rejected.",
      "screenId": "SCR-dsNew",
      "assetIds": [
        "SCR-dsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Blank names are rejected.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-ds-new-2",
      "flowKind": "exception",
      "instruction": "Shell creation may have succeeded even when later assembly fails; report each result separately.",
      "screenId": "SCR-dsNew",
      "assetIds": [
        "SCR-dsNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Shell creation may have succeeded even when later assembly fails; report each result separately.",
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
- apps/api/src/modules/registerDatasetItems.ts
- apps/api/src/modules/registerSpecPersist.ts
- apps/api/src/modules/registerSpecMissing.ts

### Implementation gaps and decisions

- Empty-source rejection, duplicate merge policy and source snapshot retention are not established by the route signatures.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)
- [W3C, Metadata Vocabulary for Tabular Data (2015 Recommendation)](https://www.w3.org/TR/tabular-metadata/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-dsNew and name Create a new dataset. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/datasets` | [apps/api/src/modules/registerCollections.ts:32](../../apps/api/src/modules/registerCollections.ts) |
| `POST /api/v1/datasets/:id/assemble` | [apps/api/src/modules/registerSpecPersist.ts:61](../../apps/api/src/modules/registerSpecPersist.ts) |
| `POST /api/v1/datasets/:id/items` | [apps/api/src/modules/registerDatasetItems.ts:18](../../apps/api/src/modules/registerDatasetItems.ts) |
| `POST /api/v1/datasets/bulk/merge` | [apps/api/src/modules/registerSpecMissing.ts:64](../../apps/api/src/modules/registerSpecMissing.ts) |

## Scenarios

1. Create shell: a valid name is supplied; dataset creation succeeds; expected: a dataset identity exists without claiming assembly.
2. Blank name: name is blank; creation is submitted; expected: validation rejects the name.
3. Assembly: two valid source items are selected; assembly succeeds; expected: the returned messages and sequence can be inspected.
4. Assembly failure: the shell exists but assembly fails; results render; expected: the shell is not falsely described as a completed batch.

## Gherkin

```gherkin
Feature: Create new dataset

  @UC-dsNew @AC-01 @specification
  Scenario: Create shell
    Given a valid name is supplied
    When dataset creation succeeds
    Then a dataset identity exists without claiming assembly

  @UC-dsNew @AC-02 @specification
  Scenario: Blank name
    Given name is blank
    When creation is submitted
    Then validation rejects the name

  @UC-dsNew @AC-03 @specification
  Scenario: Assembly
    Given two valid source items are selected
    When assembly succeeds
    Then the returned messages and sequence can be inspected

  @UC-dsNew @AC-04 @specification
  Scenario: Assembly failure
    Given the shell exists but assembly fails
    When results render
    Then the shell is not falsely described as a completed batch
```
