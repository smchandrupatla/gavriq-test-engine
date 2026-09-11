# Start a test run

- **ID:** UC-trNew
- **Screen:** New test run
- **Page key:** `trNew`
- **Level:** 2
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Execute a supported synthetic test run and distinguish generation, delivery, evaluation and persistence outcomes.

## Precondition

A readable messageTypeCode and supported delivery context are available; the operator can execute runs.

## Trigger

Operator chooses the message type and supported count, channel, seed and performance profile.

## Success guarantee

Execute a supported synthetic test run and distinguish generation, delivery, evaluation and persistence outcomes. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Missing messageTypeCode is rejected. The current persistence fallback can return a local ID; this is not proof of a durable run record.

## Acceptance criteria

1. **AC-01 [proposed]** Given messageTypeCode is missing, when Start run is submitted, the request is rejected.
2. **AC-02 [proposed]** Given a valid type is provided without channel, when the run is submitted, the file-channel default is explicit.
3. **AC-03 [proposed]** Given the endpoint returns completed, when the UI handles the result, it does not force a fabricated Running state.
4. **AC-04 [proposed]** Given execution finishes but storage fails, when a local fallback ID is returned, durable evidence is not claimed.

## Main flow

1. Operator chooses the message type and supported count, channel, seed and performance profile.
2. System validates required input and resolves fields.
3. Operator submits Start run once.
4. Engine generates and sends the data using the configured channel.
5. System reports generated, sent, blocked and failed totals with the evaluation result.
6. Operator checks the stored run and report before treating it as durable evidence.

## Alternate flows

1. The current channel default is file.
2. Boundary, injection, oversized or malformed generation is an explicit security test choice.

## Exception flows

1. Missing messageTypeCode is rejected.
2. The current persistence fallback can return a local ID; this is not proof of a durable run record.

## Business validation

1. 202 alone does not establish asynchronous running state; the current handler executes before returning completed/failed.
2. Delivery acknowledgement and business validation are distinct.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/runs

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-trNew",
  "screenName": "New test run",
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
      "assetId": "SUBMENU-tr-new",
      "kind": "submenu",
      "name": "New test run",
      "label": "New test run",
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
      "assetId": "SUBMENU-tr-new",
      "kind": "submenu",
      "name": "New test run",
      "label": "New test run",
      "parentAssetId": "MENU-test-runs",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-trNew",
      "kind": "screen",
      "name": "New test run",
      "label": "New test run",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-tr-new-1",
      "flowKind": "main",
      "instruction": "Operator chooses the message type and supported count, channel, seed and performance profile.",
      "screenId": "SCR-trNew",
      "assetIds": [
        "SCR-trNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-tr-new-2",
      "flowKind": "main",
      "instruction": "System validates required input and resolves fields.",
      "screenId": "SCR-trNew",
      "assetIds": [
        "SCR-trNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-tr-new-3",
      "flowKind": "main",
      "instruction": "Operator submits Start run once.",
      "screenId": "SCR-trNew",
      "assetIds": [
        "SCR-trNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-tr-new-4",
      "flowKind": "main",
      "instruction": "Engine generates and sends the data using the configured channel.",
      "screenId": "SCR-trNew",
      "assetIds": [
        "SCR-trNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-tr-new-5",
      "flowKind": "main",
      "instruction": "System reports generated, sent, blocked and failed totals with the evaluation result.",
      "screenId": "SCR-trNew",
      "assetIds": [
        "SCR-trNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 6,
      "flowId": "MAIN-tr-new-6",
      "flowKind": "main",
      "instruction": "Operator checks the stored run and report before treating it as durable evidence.",
      "screenId": "SCR-trNew",
      "assetIds": [
        "SCR-trNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-tr-new-1",
      "flowKind": "alternate",
      "instruction": "The current channel default is file.",
      "screenId": "SCR-trNew",
      "assetIds": [
        "SCR-trNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The current channel default is file.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-tr-new-2",
      "flowKind": "alternate",
      "instruction": "Boundary, injection, oversized or malformed generation is an explicit security test choice.",
      "screenId": "SCR-trNew",
      "assetIds": [
        "SCR-trNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Boundary, injection, oversized or malformed generation is an explicit security test choice.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-tr-new-1",
      "flowKind": "exception",
      "instruction": "Missing messageTypeCode is rejected.",
      "screenId": "SCR-trNew",
      "assetIds": [
        "SCR-trNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Missing messageTypeCode is rejected.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-tr-new-2",
      "flowKind": "exception",
      "instruction": "The current persistence fallback can return a local ID; this is not proof of a durable run record.",
      "screenId": "SCR-trNew",
      "assetIds": [
        "SCR-trNew"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The current persistence fallback can return a local ID; this is not proof of a durable run record.",
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
- apps/api/src/modules/orchestration.ts

### Implementation gaps and decisions

- Saved batch/definition selection is not the handler payload. Count boundaries, configured system targeting and duration semantics require confirmed mappings.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)
- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-trNew and name Start a test run. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/runs` | [apps/api/src/modules/liveOps.ts:84](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Required type: messageTypeCode is missing; Start run is submitted; expected: the request is rejected.
2. Default file: a valid type is provided without channel; the run is submitted; expected: the file-channel default is explicit.
3. Finished response: the endpoint returns completed; the UI handles the result; expected: it does not force a fabricated Running state.
4. Persistence uncertainty: execution finishes but storage fails; a local fallback ID is returned; expected: durable evidence is not claimed.

## Gherkin

```gherkin
Feature: New test run

  @UC-trNew @AC-01 @specification
  Scenario: Required type
    Given messageTypeCode is missing
    When Start run is submitted
    Then the request is rejected

  @UC-trNew @AC-02 @specification
  Scenario: Default file
    Given a valid type is provided without channel
    When the run is submitted
    Then the file-channel default is explicit

  @UC-trNew @AC-03 @specification
  Scenario: Finished response
    Given the endpoint returns completed
    When the UI handles the result
    Then it does not force a fabricated Running state

  @UC-trNew @AC-04 @specification
  Scenario: Persistence uncertainty
    Given execution finishes but storage fails
    When a local fallback ID is returned
    Then durable evidence is not claimed
```
