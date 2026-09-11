# Configure the five dummy external systems

- **ID:** UC-externalSystems
- **Screen:** External systems
- **Page key:** `externalSystems`
- **Level:** 2
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Configure a test destination and distinguish a saved configuration from a verified round trip.

## Precondition

The administrator can manage integrations; a receiving system is required only for the actual connectivity test.

## Trigger

Administrator opens External systems; system loads integration and destination records.

## Success guarantee

Configure a test destination and distinguish a saved configuration from a verified round trip. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Malformed headers JSON prevents a valid configured-header claim. An unreachable receiver is a failed or unconfirmed delivery, not a successful round trip.

## Acceptance criteria

1. **AC-01 [proposed]** Given a valid destination is entered, when Update succeeds, configuration is saved without claiming a dummy was sent.
2. **AC-02 [proposed]** Given header text is malformed JSON, when the row is saved, the problem is surfaced instead of silently dropping headers.
3. **AC-03 [proposed]** Given the test receiver is stopped, when Send dummy is requested, delivery failure is visible.
4. **AC-04 [proposed]** Given two dummy messages were sent, when one inbound response arrives, the response is associated with its actual request.

## Main flow

1. Administrator opens External systems; system loads integration and destination records.
2. Administrator selects API, MQ or Kafka and enters endpoint, destination and JSON headers.
3. System validates readable configuration; administrator saves the row.
4. Administrator explicitly requests Send dummy when ready to transmit synthetic data.
5. System reports the send result and any correlated inbound response separately.

## Alternate flows

1. A new ID creates a destination through the supported PUT route.
2. Integration base URLs are saved separately from a destination row.

## Exception flows

1. Malformed headers JSON prevents a valid configured-header claim.
2. An unreachable receiver is a failed or unconfirmed delivery, not a successful round trip.

## Business validation

1. A successful configuration save does not prove network reachability.
2. A send acknowledgement does not prove the receiving application accepted the business message.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/external-systems
4. PUT /api/v1/external-systems/:id
5. DELETE /api/v1/external-systems/:id
6. POST /api/v1/external-systems/:id/dummy
7. GET /api/v1/integration
8. PATCH /api/v1/settings/integration
9. GET /api/v1/inbound/events

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-externalSystems",
  "screenName": "External systems",
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
      "assetId": "SUBMENU-external-systems",
      "kind": "submenu",
      "name": "External systems",
      "label": "External systems",
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
      "assetId": "SUBMENU-external-systems",
      "kind": "submenu",
      "name": "External systems",
      "label": "External systems",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-externalSystems",
      "kind": "screen",
      "name": "External systems",
      "label": "External systems",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-external-systems-1",
      "flowKind": "main",
      "instruction": "Administrator opens External systems; system loads integration and destination records.",
      "screenId": "SCR-externalSystems",
      "assetIds": [
        "SCR-externalSystems"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-external-systems-2",
      "flowKind": "main",
      "instruction": "Administrator selects API, MQ or Kafka and enters endpoint, destination and JSON headers.",
      "screenId": "SCR-externalSystems",
      "assetIds": [
        "SCR-externalSystems"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-external-systems-3",
      "flowKind": "main",
      "instruction": "System validates readable configuration; administrator saves the row.",
      "screenId": "SCR-externalSystems",
      "assetIds": [
        "SCR-externalSystems"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-external-systems-4",
      "flowKind": "main",
      "instruction": "Administrator explicitly requests Send dummy when ready to transmit synthetic data.",
      "screenId": "SCR-externalSystems",
      "assetIds": [
        "SCR-externalSystems"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-external-systems-5",
      "flowKind": "main",
      "instruction": "System reports the send result and any correlated inbound response separately.",
      "screenId": "SCR-externalSystems",
      "assetIds": [
        "SCR-externalSystems"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-external-systems-1",
      "flowKind": "alternate",
      "instruction": "A new ID creates a destination through the supported PUT route.",
      "screenId": "SCR-externalSystems",
      "assetIds": [
        "SCR-externalSystems"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A new ID creates a destination through the supported PUT route.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-external-systems-2",
      "flowKind": "alternate",
      "instruction": "Integration base URLs are saved separately from a destination row.",
      "screenId": "SCR-externalSystems",
      "assetIds": [
        "SCR-externalSystems"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Integration base URLs are saved separately from a destination row.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-external-systems-1",
      "flowKind": "exception",
      "instruction": "Malformed headers JSON prevents a valid configured-header claim.",
      "screenId": "SCR-externalSystems",
      "assetIds": [
        "SCR-externalSystems"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Malformed headers JSON prevents a valid configured-header claim.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-external-systems-2",
      "flowKind": "exception",
      "instruction": "An unreachable receiver is a failed or unconfirmed delivery, not a successful round trip.",
      "screenId": "SCR-externalSystems",
      "assetIds": [
        "SCR-externalSystems"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unreachable receiver is a failed or unconfirmed delivery, not a successful round trip.",
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

- apps/api/src/modules/liveConsole.ts
- apps/web/public/js/preview-parts/part-06.js

### Implementation gaps and decisions

- Five defaults are demonstration data, not a requirement to create five systems. Delivery guarantees and correlation need channel-specific evidence.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-externalSystems and name Configure the five dummy external systems. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/external-systems` | [apps/api/src/modules/liveConsole.ts:279](../../apps/api/src/modules/liveConsole.ts) |
| `PUT /api/v1/external-systems/:id` | [apps/api/src/modules/liveConsole.ts:286](../../apps/api/src/modules/liveConsole.ts) |
| `DELETE /api/v1/external-systems/:id` | [apps/api/src/modules/liveConsole.ts:295](../../apps/api/src/modules/liveConsole.ts) |
| `POST /api/v1/external-systems/:id/dummy` | [apps/api/src/modules/liveConsole.ts:302](../../apps/api/src/modules/liveConsole.ts) |
| `GET /api/v1/integration` | [apps/api/src/modules/liveConsole.ts:249](../../apps/api/src/modules/liveConsole.ts) |
| `PATCH /api/v1/settings/integration` | [apps/api/src/modules/liveConsole.ts:254](../../apps/api/src/modules/liveConsole.ts) |
| `GET /api/v1/inbound/events` | [apps/api/src/modules/liveConsole.ts:226](../../apps/api/src/modules/liveConsole.ts) |

## Scenarios

1. Save only: a valid destination is entered; Update succeeds; expected: configuration is saved without claiming a dummy was sent.
2. Bad headers: header text is malformed JSON; the row is saved; expected: the problem is surfaced instead of silently dropping headers.
3. Unreachable: the test receiver is stopped; Send dummy is requested; expected: delivery failure is visible.
4. Correlation: two dummy messages were sent; one inbound response arrives; expected: the response is associated with its actual request.

## Gherkin

```gherkin
Feature: External systems

  @UC-externalSystems @AC-01 @specification
  Scenario: Save only
    Given a valid destination is entered
    When Update succeeds
    Then configuration is saved without claiming a dummy was sent

  @UC-externalSystems @AC-02 @specification
  Scenario: Bad headers
    Given header text is malformed JSON
    When the row is saved
    Then the problem is surfaced instead of silently dropping headers

  @UC-externalSystems @AC-03 @specification
  Scenario: Unreachable
    Given the test receiver is stopped
    When Send dummy is requested
    Then delivery failure is visible

  @UC-externalSystems @AC-04 @specification
  Scenario: Correlation
    Given two dummy messages were sent
    When one inbound response arrives
    Then the response is associated with its actual request
```
