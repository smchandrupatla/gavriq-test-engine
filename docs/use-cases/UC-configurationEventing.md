# Eventing

- **ID:** UC-configurationEventing
- **Screen:** Eventing
- **Page key:** `configurationEventing`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Configure default event delivery and explicitly test connectivity or send a synthetic event.

## Precondition

The operator can manage eventing settings and knows the intended test receiver.

## Trigger

Administrator opens Eventing; system loads current delivery settings.

## Success guarantee

Configure default event delivery and explicitly test connectivity or send a synthetic event. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An unreachable destination produces a visible test failure. A save failure does not confirm the new channel is effective.

## Acceptance criteria

1. **AC-01 [proposed]** Given settings are edited, when Save eventing is selected, the result does not claim a dummy was sent.
2. **AC-02 [proposed]** Given the receiver is unavailable, when Test connection is selected, failure is reported.
3. **AC-03 [proposed]** Given a test receiver is configured, when Send dummy is explicitly selected, its send result is reported independently of configuration saving.
4. **AC-04 [proposed]** Given the page loads, when no command is selected, no dummy message is sent.

## Main flow

1. Administrator opens Eventing; system loads current delivery settings.
2. Administrator reviews channel and destination.
3. Administrator saves configuration; system reports the result.
4. Administrator explicitly selects Test connection or Send dummy.
5. System reports connectivity and message-send results separately.

## Alternate flows

1. Configuration can be saved without sending a message.
2. A test connection is not a business message delivery.

## Exception flows

1. An unreachable destination produces a visible test failure.
2. A save failure does not confirm the new channel is effective.

## Business validation

1. Default event delivery is separate from the domain-event catalogue.
2. A synthetic send needs an explicit action, not page opening.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/settings/eventing
4. PUT /api/v1/settings/eventing
5. POST /api/v1/settings/eventing/test
6. POST /api/v1/settings/eventing/dummy

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-configurationEventing",
  "screenName": "Eventing",
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
      "assetId": "SUBMENU-configuration-eventing",
      "kind": "submenu",
      "name": "Eventing",
      "label": "Eventing",
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
      "assetId": "SUBMENU-configuration-eventing",
      "kind": "submenu",
      "name": "Eventing",
      "label": "Eventing",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-configurationEventing",
      "kind": "screen",
      "name": "Eventing",
      "label": "Eventing",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "sbe-eventing-save",
      "kind": "control",
      "name": "Save eventing",
      "label": "Save eventing",
      "selector": "#sbe-eventing-save",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-04.js",
      "parentAssetId": "SCR-configurationEventing",
      "source": "screen-source",
      "verification": "verified"
    },
    {
      "assetId": "sbe-eventing-test",
      "kind": "control",
      "name": "Test connection",
      "label": "Test connection",
      "selector": "#sbe-eventing-test",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-04.js",
      "parentAssetId": "SCR-configurationEventing",
      "source": "screen-source",
      "verification": "verified"
    },
    {
      "assetId": "sbe-eventing-dummy",
      "kind": "control",
      "name": "Send dummy message",
      "label": "Send dummy message",
      "selector": "#sbe-eventing-dummy",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-04.js",
      "parentAssetId": "SCR-configurationEventing",
      "source": "screen-source",
      "verification": "verified"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-configuration-eventing-1",
      "flowKind": "main",
      "instruction": "Administrator opens Eventing; system loads current delivery settings.",
      "screenId": "SCR-configurationEventing",
      "assetIds": [
        "SCR-configurationEventing"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-configuration-eventing-2",
      "flowKind": "main",
      "instruction": "Administrator reviews channel and destination.",
      "screenId": "SCR-configurationEventing",
      "assetIds": [
        "SCR-configurationEventing"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-configuration-eventing-3",
      "flowKind": "main",
      "instruction": "Administrator saves configuration; system reports the result.",
      "screenId": "SCR-configurationEventing",
      "assetIds": [
        "SCR-configurationEventing"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-configuration-eventing-4",
      "flowKind": "main",
      "instruction": "Administrator explicitly selects Test connection or Send dummy.",
      "screenId": "SCR-configurationEventing",
      "assetIds": [
        "SCR-configurationEventing"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-configuration-eventing-5",
      "flowKind": "main",
      "instruction": "System reports connectivity and message-send results separately.",
      "screenId": "SCR-configurationEventing",
      "assetIds": [
        "SCR-configurationEventing"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-configuration-eventing-1",
      "flowKind": "alternate",
      "instruction": "Configuration can be saved without sending a message.",
      "screenId": "SCR-configurationEventing",
      "assetIds": [
        "SCR-configurationEventing"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Configuration can be saved without sending a message.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-configuration-eventing-2",
      "flowKind": "alternate",
      "instruction": "A test connection is not a business message delivery.",
      "screenId": "SCR-configurationEventing",
      "assetIds": [
        "SCR-configurationEventing"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A test connection is not a business message delivery.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-configuration-eventing-1",
      "flowKind": "exception",
      "instruction": "An unreachable destination produces a visible test failure.",
      "screenId": "SCR-configurationEventing",
      "assetIds": [
        "SCR-configurationEventing"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unreachable destination produces a visible test failure.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-configuration-eventing-2",
      "flowKind": "exception",
      "instruction": "A save failure does not confirm the new channel is effective.",
      "screenId": "SCR-configurationEventing",
      "assetIds": [
        "SCR-configurationEventing"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A save failure does not confirm the new channel is effective.",
      "backgroundEvents": []
    }
  ],
  "auditActions": [],
  "events": [],
  "backgroundEvents": [],
  "provenance": "mixed"
}
```

### Additional notes

### Source evidence

- apps/web/public/js/live-bind-parts/part-04.js
- apps/api/src/modules/liveConsole.ts

### Implementation gaps and decisions

- Verify effective setting application for each channel; a testhub stub does not prove Kafka or MQ broker delivery.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-configurationEventing and name Eventing. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/settings/eventing` | [apps/api/src/modules/liveConsole.ts:182](../../apps/api/src/modules/liveConsole.ts) |
| `PUT /api/v1/settings/eventing` | [apps/api/src/modules/liveConsole.ts:189](../../apps/api/src/modules/liveConsole.ts) |
| `POST /api/v1/settings/eventing/test` | [apps/api/src/modules/liveConsole.ts:208](../../apps/api/src/modules/liveConsole.ts) |
| `POST /api/v1/settings/eventing/dummy` | [apps/api/src/modules/liveConsole.ts:217](../../apps/api/src/modules/liveConsole.ts) |

## Scenarios

1. Save only: settings are edited; Save eventing is selected; expected: the result does not claim a dummy was sent.
2. Connectivity: the receiver is unavailable; Test connection is selected; expected: failure is reported.
3. Dummy send: a test receiver is configured; Send dummy is explicitly selected; expected: its send result is reported independently of configuration saving.
4. Read only: the page loads; no command is selected; expected: no dummy message is sent.

## Gherkin

```gherkin
Feature: Eventing

  @UC-configurationEventing @AC-01 @specification
  Scenario: Save only
    Given settings are edited
    When Save eventing is selected
    Then the result does not claim a dummy was sent

  @UC-configurationEventing @AC-02 @specification
  Scenario: Connectivity
    Given the receiver is unavailable
    When Test connection is selected
    Then failure is reported

  @UC-configurationEventing @AC-03 @specification
  Scenario: Dummy send
    Given a test receiver is configured
    When Send dummy is explicitly selected
    Then its send result is reported independently of configuration saving

  @UC-configurationEventing @AC-04 @specification
  Scenario: Read only
    Given the page loads
    When no command is selected
    Then no dummy message is sent
```
