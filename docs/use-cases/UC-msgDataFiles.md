# Reuse a generated test data file

- **ID:** UC-msgDataFiles
- **Screen:** Saved test data files
- **Page key:** `msgDataFiles`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Select a previously saved synthetic message batch for reuse without regenerating it.

## Precondition

The session can read saved generated messages.

## Trigger

Operator opens saved test data files.

## Success guarantee

Select a previously saved synthetic message batch for reuse without regenerating it. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A missing batch cannot be replaced silently with newly randomised data. An incomplete generation displays the confirmed count and available state.

## Acceptance criteria

1. **AC-01 [proposed]** Given batch B has 20 stored messages, when the list loads, B shows 20 stored messages.
2. **AC-02 [proposed]** Given B is selected, when the operator opens it, the stored batch is used without silent randomisation.
3. **AC-03 [proposed]** Given B was removed, when reuse is requested, the missing source is reported.
4. **AC-04 [proposed]** Given B belongs to another tenant, when the current library loads, B is not exposed.

## Main flow

1. Operator opens saved test data files.
2. System lists actual saved batch metadata.
3. Operator inspects message type and confirmed message count.
4. Operator selects an available batch for a supported test workflow.

## Alternate flows

1. An empty library directs the analyst to generate and save data.
2. A batch may be inspected without sending it.

## Exception flows

1. A missing batch cannot be replaced silently with newly randomised data.
2. An incomplete generation displays the confirmed count and available state.

## Business validation

1. Persisted messages are distinct from dataset definitions.
2. Tenant and source identity must remain attached to reuse.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/data-files
4. GET /api/v1/generated-messages

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-msgDataFiles",
  "screenName": "Saved test data files",
  "navigation": {
    "menu": {
      "assetId": "MENU-message-designer",
      "kind": "menu",
      "name": "Message Designer",
      "label": "Message Designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-msg-data-files",
      "kind": "submenu",
      "name": "Saved test data files",
      "label": "Saved test data files",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-message-designer",
      "kind": "menu",
      "name": "Message Designer",
      "label": "Message Designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-msg-data-files",
      "kind": "submenu",
      "name": "Saved test data files",
      "label": "Saved test data files",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-msgDataFiles",
      "kind": "screen",
      "name": "Saved test data files",
      "label": "Saved test data files",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-msg-data-files-1",
      "flowKind": "main",
      "instruction": "Operator opens saved test data files.",
      "screenId": "SCR-msgDataFiles",
      "assetIds": [
        "SCR-msgDataFiles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-msg-data-files-2",
      "flowKind": "main",
      "instruction": "System lists actual saved batch metadata.",
      "screenId": "SCR-msgDataFiles",
      "assetIds": [
        "SCR-msgDataFiles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-msg-data-files-3",
      "flowKind": "main",
      "instruction": "Operator inspects message type and confirmed message count.",
      "screenId": "SCR-msgDataFiles",
      "assetIds": [
        "SCR-msgDataFiles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-msg-data-files-4",
      "flowKind": "main",
      "instruction": "Operator selects an available batch for a supported test workflow.",
      "screenId": "SCR-msgDataFiles",
      "assetIds": [
        "SCR-msgDataFiles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-msg-data-files-1",
      "flowKind": "alternate",
      "instruction": "An empty library directs the analyst to generate and save data.",
      "screenId": "SCR-msgDataFiles",
      "assetIds": [
        "SCR-msgDataFiles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty library directs the analyst to generate and save data.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-msg-data-files-2",
      "flowKind": "alternate",
      "instruction": "A batch may be inspected without sending it.",
      "screenId": "SCR-msgDataFiles",
      "assetIds": [
        "SCR-msgDataFiles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A batch may be inspected without sending it.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-msg-data-files-1",
      "flowKind": "exception",
      "instruction": "A missing batch cannot be replaced silently with newly randomised data.",
      "screenId": "SCR-msgDataFiles",
      "assetIds": [
        "SCR-msgDataFiles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A missing batch cannot be replaced silently with newly randomised data.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-msg-data-files-2",
      "flowKind": "exception",
      "instruction": "An incomplete generation displays the confirmed count and available state.",
      "screenId": "SCR-msgDataFiles",
      "assetIds": [
        "SCR-msgDataFiles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An incomplete generation displays the confirmed count and available state.",
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

- apps/api/src/modules/registerSpecGaps.ts
- apps/api/src/modules/liveOps.ts

### Implementation gaps and decisions

- This catalogue key has no native CONFIG page; screen reachability and batch-to-run handoff remain unverified.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-msgDataFiles and name Reuse a generated test data file. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/data-files` | [apps/api/src/modules/registerSpecGaps.ts:105](../../apps/api/src/modules/registerSpecGaps.ts) |
| `GET /api/v1/generated-messages` | [apps/api/src/modules/liveOps.ts:78](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Saved batch: batch B has 20 stored messages; the list loads; expected: B shows 20 stored messages.
2. No regeneration: B is selected; the operator opens it; expected: the stored batch is used without silent randomisation.
3. Missing batch: B was removed; reuse is requested; expected: the missing source is reported.
4. Isolation: B belongs to another tenant; the current library loads; expected: B is not exposed.

## Gherkin

```gherkin
Feature: Saved test data files

  @UC-msgDataFiles @AC-01 @specification
  Scenario: Saved batch
    Given batch B has 20 stored messages
    When the list loads
    Then B shows 20 stored messages

  @UC-msgDataFiles @AC-02 @specification
  Scenario: No regeneration
    Given B is selected
    When the operator opens it
    Then the stored batch is used without silent randomisation

  @UC-msgDataFiles @AC-03 @specification
  Scenario: Missing batch
    Given B was removed
    When reuse is requested
    Then the missing source is reported

  @UC-msgDataFiles @AC-04 @specification
  Scenario: Isolation
    Given B belongs to another tenant
    When the current library loads
    Then B is not exposed
```
