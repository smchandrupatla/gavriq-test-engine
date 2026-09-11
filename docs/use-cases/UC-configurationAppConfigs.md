# App configs

- **ID:** UC-configurationAppConfigs
- **Screen:** App configs
- **Page key:** `configurationAppConfigs`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Review application configuration panels and save only the settings whose controls are actually wired.

## Precondition

The App configs page and applicable panel access are available.

## Trigger

Administrator opens App configs.

## Success guarantee

Review application configuration panels and save only the settings whose controls are actually wired. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Timeout save failure may leave a local-only value; it is not a tenant-persisted success. A displayed origin JSON block is not an edit control.

## Acceptance criteria

1. **AC-01 [proposed]** Given a supported forwarding mode is selected, when Save logging succeeds, the returned operation is reported as saved.
2. **AC-02 [proposed]** Given server timeout saving fails after local saving, when status renders, local-only persistence is distinguished.
3. **AC-03 [proposed]** Given origin headers render in a preformatted block, when the panel is inspected, the display is not claimed to provide editing.
4. **AC-04 [proposed]** Given a write outlasts the UI timeout, when the UI stops waiting, the server outcome is not asserted rolled back.

## Main flow

1. Administrator opens App configs.
2. System mounts the available logging, event, origin and timeout panels.
3. Administrator reviews the selected panel's current values.
4. Administrator uses its explicit save or export control.
5. System reports server-confirmed versus local-only outcomes accurately.

## Alternate flows

1. Event catalogue and origin headers can be inspected without edits.
2. Logging forward destination can be changed independently from other panels.

## Exception flows

1. Timeout save failure may leave a local-only value; it is not a tenant-persisted success.
2. A displayed origin JSON block is not an edit control.

## Business validation

1. The logging panel says 24-hour recycling but submits retainDays:7; retention semantics need reconciliation.
2. A UI timeout does not cancel a server transaction or prove rollback.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/settings/logging
4. PUT /api/v1/settings/logging
5. GET /api/v1/events/catalog
6. GET /api/v1/events/headers
7. GET /api/v1/events/export

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-configurationAppConfigs",
  "screenName": "App configs",
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
      "assetId": "SUBMENU-configuration-app-configs",
      "kind": "submenu",
      "name": "App configs",
      "label": "App configs",
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
      "assetId": "SUBMENU-configuration-app-configs",
      "kind": "submenu",
      "name": "App configs",
      "label": "App configs",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-configurationAppConfigs",
      "kind": "screen",
      "name": "App configs",
      "label": "App configs",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "sbe-log-save",
      "kind": "control",
      "name": "Save logging",
      "label": "Save logging",
      "selector": "#sbe-log-save",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-12.js",
      "parentAssetId": "SCR-configurationAppConfigs",
      "source": "screen-source",
      "verification": "verified"
    },
    {
      "assetId": "sbe-ui-timeout-save",
      "kind": "control",
      "name": "Save timeout",
      "label": "Save timeout",
      "selector": "#sbe-ui-timeout-save",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-12.js",
      "parentAssetId": "SCR-configurationAppConfigs",
      "source": "screen-source",
      "verification": "verified"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-configuration-app-configs-1",
      "flowKind": "main",
      "instruction": "Administrator opens App configs.",
      "screenId": "SCR-configurationAppConfigs",
      "assetIds": [
        "SCR-configurationAppConfigs"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-configuration-app-configs-2",
      "flowKind": "main",
      "instruction": "System mounts the available logging, event, origin and timeout panels.",
      "screenId": "SCR-configurationAppConfigs",
      "assetIds": [
        "SCR-configurationAppConfigs"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-configuration-app-configs-3",
      "flowKind": "main",
      "instruction": "Administrator reviews the selected panel's current values.",
      "screenId": "SCR-configurationAppConfigs",
      "assetIds": [
        "SCR-configurationAppConfigs"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-configuration-app-configs-4",
      "flowKind": "main",
      "instruction": "Administrator uses its explicit save or export control.",
      "screenId": "SCR-configurationAppConfigs",
      "assetIds": [
        "SCR-configurationAppConfigs"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-configuration-app-configs-5",
      "flowKind": "main",
      "instruction": "System reports server-confirmed versus local-only outcomes accurately.",
      "screenId": "SCR-configurationAppConfigs",
      "assetIds": [
        "SCR-configurationAppConfigs"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-configuration-app-configs-1",
      "flowKind": "alternate",
      "instruction": "Event catalogue and origin headers can be inspected without edits.",
      "screenId": "SCR-configurationAppConfigs",
      "assetIds": [
        "SCR-configurationAppConfigs"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Event catalogue and origin headers can be inspected without edits.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-configuration-app-configs-2",
      "flowKind": "alternate",
      "instruction": "Logging forward destination can be changed independently from other panels.",
      "screenId": "SCR-configurationAppConfigs",
      "assetIds": [
        "SCR-configurationAppConfigs"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Logging forward destination can be changed independently from other panels.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-configuration-app-configs-1",
      "flowKind": "exception",
      "instruction": "Timeout save failure may leave a local-only value; it is not a tenant-persisted success.",
      "screenId": "SCR-configurationAppConfigs",
      "assetIds": [
        "SCR-configurationAppConfigs"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Timeout save failure may leave a local-only value; it is not a tenant-persisted success.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-configuration-app-configs-2",
      "flowKind": "exception",
      "instruction": "A displayed origin JSON block is not an edit control.",
      "screenId": "SCR-configurationAppConfigs",
      "assetIds": [
        "SCR-configurationAppConfigs"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A displayed origin JSON block is not an edit control.",
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

- apps/web/public/js/live-bind-parts/part-12.js
- apps/api/src/modules/loggingConfig.ts
- apps/api/src/modules/registerEventRoutes.ts

### Implementation gaps and decisions

- Generic settings paths used by timeout controls need route verification. The event panel exposes exports but not the advertised per-event toggle.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-configurationAppConfigs and name App configs. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/settings/logging` | [apps/api/src/modules/loggingConfig.ts:41](../../apps/api/src/modules/loggingConfig.ts) |
| `PUT /api/v1/settings/logging` | [apps/api/src/modules/loggingConfig.ts:54](../../apps/api/src/modules/loggingConfig.ts) |
| `GET /api/v1/events/catalog` | [apps/api/src/modules/registerEventRoutes.ts:18](../../apps/api/src/modules/registerEventRoutes.ts) |
| `GET /api/v1/events/headers` | [apps/api/src/modules/registerEventRoutes.ts:108](../../apps/api/src/modules/registerEventRoutes.ts) |
| `GET /api/v1/events/export` | [apps/api/src/modules/registerEventRoutes.ts:69](../../apps/api/src/modules/registerEventRoutes.ts) |

## Scenarios

1. Logging save: a supported forwarding mode is selected; Save logging succeeds; expected: the returned operation is reported as saved.
2. Local timeout: server timeout saving fails after local saving; status renders; expected: local-only persistence is distinguished.
3. Read-only headers: origin headers render in a preformatted block; the panel is inspected; expected: the display is not claimed to provide editing.
4. Timeout uncertainty: a write outlasts the UI timeout; the UI stops waiting; expected: the server outcome is not asserted rolled back.

## Gherkin

```gherkin
Feature: App configs

  @UC-configurationAppConfigs @AC-01 @specification
  Scenario: Logging save
    Given a supported forwarding mode is selected
    When Save logging succeeds
    Then the returned operation is reported as saved

  @UC-configurationAppConfigs @AC-02 @specification
  Scenario: Local timeout
    Given server timeout saving fails after local saving
    When status renders
    Then local-only persistence is distinguished

  @UC-configurationAppConfigs @AC-03 @specification
  Scenario: Read-only headers
    Given origin headers render in a preformatted block
    When the panel is inspected
    Then the display is not claimed to provide editing

  @UC-configurationAppConfigs @AC-04 @specification
  Scenario: Timeout uncertainty
    Given a write outlasts the UI timeout
    When the UI stops waiting
    Then the server outcome is not asserted rolled back
```
