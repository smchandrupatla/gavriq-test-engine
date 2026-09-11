# Environment defaults

- **ID:** UC-configurationEnvironmentDefaults
- **Screen:** Environment defaults
- **Page key:** `configurationEnvironmentDefaults`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Review and specify the default environment for future runs without retargeting existing runs.

## Precondition

Configuration is accessible and the current environment setting can be identified.

## Trigger

Administrator opens Environment defaults.

## Success guarantee

Review and specify the default environment for future runs without retargeting existing runs. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

No write binding means no persisted-default claim. A change must not imply existing or running jobs were retargeted.

## Acceptance criteria

1. **AC-01 [proposed]** Given the screen is configured with Sandbox, when it opens, the displayed value is identified as configuration rather than proof of isolation.
2. **AC-02 [proposed]** Given a run already exists, when the future default changes, the old run is not claimed retargeted.
3. **AC-03 [proposed]** Given no setting write is wired, when the toggle is used, a persisted environment change is not claimed.

## Main flow

1. Administrator opens Environment defaults.
2. System shows the available default or clearly labels preview-only content.
3. Administrator reviews the effect on future runs.
4. A supported save must confirm the effective value before it is relied on.

## Alternate flows

1. Keep the current environment unchanged.
2. An individual run can use an explicit target where that run contract supports it.

## Exception flows

1. No write binding means no persisted-default claim.
2. A change must not imply existing or running jobs were retargeted.

## Business validation

1. A Sandbox caption is not an isolation guarantee.
2. Environment identity and external endpoint are separate settings.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-configurationEnvironmentDefaults",
  "screenName": "Environment defaults",
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
      "assetId": "SUBMENU-configuration-environment-defaults",
      "kind": "submenu",
      "name": "Environment defaults",
      "label": "Environment defaults",
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
      "assetId": "SUBMENU-configuration-environment-defaults",
      "kind": "submenu",
      "name": "Environment defaults",
      "label": "Environment defaults",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-configurationEnvironmentDefaults",
      "kind": "screen",
      "name": "Environment defaults",
      "label": "Environment defaults",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-configuration-environment-defaults-1",
      "flowKind": "main",
      "instruction": "Administrator opens Environment defaults.",
      "screenId": "SCR-configurationEnvironmentDefaults",
      "assetIds": [
        "SCR-configurationEnvironmentDefaults"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-configuration-environment-defaults-2",
      "flowKind": "main",
      "instruction": "System shows the available default or clearly labels preview-only content.",
      "screenId": "SCR-configurationEnvironmentDefaults",
      "assetIds": [
        "SCR-configurationEnvironmentDefaults"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-configuration-environment-defaults-3",
      "flowKind": "main",
      "instruction": "Administrator reviews the effect on future runs.",
      "screenId": "SCR-configurationEnvironmentDefaults",
      "assetIds": [
        "SCR-configurationEnvironmentDefaults"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-configuration-environment-defaults-4",
      "flowKind": "main",
      "instruction": "A supported save must confirm the effective value before it is relied on.",
      "screenId": "SCR-configurationEnvironmentDefaults",
      "assetIds": [
        "SCR-configurationEnvironmentDefaults"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-configuration-environment-defaults-1",
      "flowKind": "alternate",
      "instruction": "Keep the current environment unchanged.",
      "screenId": "SCR-configurationEnvironmentDefaults",
      "assetIds": [
        "SCR-configurationEnvironmentDefaults"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Keep the current environment unchanged.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-configuration-environment-defaults-2",
      "flowKind": "alternate",
      "instruction": "An individual run can use an explicit target where that run contract supports it.",
      "screenId": "SCR-configurationEnvironmentDefaults",
      "assetIds": [
        "SCR-configurationEnvironmentDefaults"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An individual run can use an explicit target where that run contract supports it.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-configuration-environment-defaults-1",
      "flowKind": "exception",
      "instruction": "No write binding means no persisted-default claim.",
      "screenId": "SCR-configurationEnvironmentDefaults",
      "assetIds": [
        "SCR-configurationEnvironmentDefaults"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No write binding means no persisted-default claim.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-configuration-environment-defaults-2",
      "flowKind": "exception",
      "instruction": "A change must not imply existing or running jobs were retargeted.",
      "screenId": "SCR-configurationEnvironmentDefaults",
      "assetIds": [
        "SCR-configurationEnvironmentDefaults"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A change must not imply existing or running jobs were retargeted.",
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

- apps/web/public/js/preview-parts/part-00.js
- apps/web/public/js/preview-parts/part-06.js

### Implementation gaps and decisions

- A static settings row exists; no dedicated environment-default persistence contract was found.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-configurationEnvironmentDefaults and name Environment defaults. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Displayed default: the screen is configured with Sandbox; it opens; expected: the displayed value is identified as configuration rather than proof of isolation.
2. No retroactive change: a run already exists; the future default changes; expected: the old run is not claimed retargeted.
3. Unsupported save: no setting write is wired; the toggle is used; expected: a persisted environment change is not claimed.

## Gherkin

```gherkin
Feature: Environment defaults

  @UC-configurationEnvironmentDefaults @AC-01 @specification
  Scenario: Displayed default
    Given the screen is configured with Sandbox
    When it opens
    Then the displayed value is identified as configuration rather than proof of isolation

  @UC-configurationEnvironmentDefaults @AC-02 @specification
  Scenario: No retroactive change
    Given a run already exists
    When the future default changes
    Then the old run is not claimed retargeted

  @UC-configurationEnvironmentDefaults @AC-03 @specification
  Scenario: Unsupported save
    Given no setting write is wired
    When the toggle is used
    Then a persisted environment change is not claimed
```
