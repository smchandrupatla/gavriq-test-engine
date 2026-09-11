# Change tenant settings

- **ID:** UC-configuration
- **Screen:** Configuration
- **Page key:** `configuration`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Find the relevant tenant setting and change it through its own supported control.

## Precondition

The operator has the access required by the specific settings operation.

## Trigger

Administrator opens Configuration and chooses a settings subpage.

## Success guarantee

Find the relevant tenant setting and change it through its own supported control. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A failed save does not change the displayed confirmed value. A static settings row without a write binding is identified as a placeholder.

## Acceptance criteria

1. **AC-01 [proposed]** Given use-case visibility is enabled, when the administrator saves enabled=false, the documentation controls follow the saved setting.
2. **AC-02 [proposed]** Given a setting save succeeds, when the setting is reopened, the effective value can be checked.
3. **AC-03 [proposed]** Given the settings request fails, when the result is handled, no confirmed settings change is claimed.
4. **AC-04 [proposed]** Given logging changes, when the change is saved, no unrelated eventing change is implied.

## Main flow

1. Administrator opens Configuration and chooses a settings subpage.
2. System loads the relevant current settings.
3. Administrator reviews a proposed change and explicitly applies it.
4. System reports that operation's confirmed result.
5. Administrator reopens the setting to check the effective value.

## Alternate flows

1. Use-case visibility can be enabled or disabled independently.
2. Logging, eventing and feature access are distinct settings operations.

## Exception flows

1. A failed save does not change the displayed confirmed value.
2. A static settings row without a write binding is identified as a placeholder.

## Business validation

1. No combined atomic settings save is implied.
2. A generic toggle cannot establish retention, notifications or authentication capabilities.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. PATCH /api/v1/settings/use-cases

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-configuration",
  "screenName": "Configuration",
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
      "assetId": "SUBMENU-configuration",
      "kind": "submenu",
      "name": "Configuration",
      "label": "Configuration",
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
      "assetId": "SUBMENU-configuration",
      "kind": "submenu",
      "name": "Configuration",
      "label": "Configuration",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-configuration",
      "kind": "screen",
      "name": "Configuration",
      "label": "Configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "sbe-usecase-enabled",
      "kind": "control",
      "name": "Enable use case button",
      "label": "Enable use case button",
      "selector": "#sbe-usecase-enabled",
      "sourceFile": "apps/web/public/js/use-case-bind.js",
      "parentAssetId": "SCR-configuration",
      "source": "screen-source",
      "verification": "verified"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-configuration-1",
      "flowKind": "main",
      "instruction": "Administrator opens Configuration and chooses a settings subpage.",
      "screenId": "SCR-configuration",
      "assetIds": [
        "SCR-configuration"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-configuration-2",
      "flowKind": "main",
      "instruction": "System loads the relevant current settings.",
      "screenId": "SCR-configuration",
      "assetIds": [
        "SCR-configuration"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-configuration-3",
      "flowKind": "main",
      "instruction": "Administrator reviews a proposed change and explicitly applies it.",
      "screenId": "SCR-configuration",
      "assetIds": [
        "SCR-configuration"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-configuration-4",
      "flowKind": "main",
      "instruction": "System reports that operation's confirmed result.",
      "screenId": "SCR-configuration",
      "assetIds": [
        "SCR-configuration"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-configuration-5",
      "flowKind": "main",
      "instruction": "Administrator reopens the setting to check the effective value.",
      "screenId": "SCR-configuration",
      "assetIds": [
        "SCR-configuration"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-configuration-1",
      "flowKind": "alternate",
      "instruction": "Use-case visibility can be enabled or disabled independently.",
      "screenId": "SCR-configuration",
      "assetIds": [
        "SCR-configuration"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Use-case visibility can be enabled or disabled independently.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-configuration-2",
      "flowKind": "alternate",
      "instruction": "Logging, eventing and feature access are distinct settings operations.",
      "screenId": "SCR-configuration",
      "assetIds": [
        "SCR-configuration"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Logging, eventing and feature access are distinct settings operations.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-configuration-1",
      "flowKind": "exception",
      "instruction": "A failed save does not change the displayed confirmed value.",
      "screenId": "SCR-configuration",
      "assetIds": [
        "SCR-configuration"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed save does not change the displayed confirmed value.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-configuration-2",
      "flowKind": "exception",
      "instruction": "A static settings row without a write binding is identified as a placeholder.",
      "screenId": "SCR-configuration",
      "assetIds": [
        "SCR-configuration"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A static settings row without a write binding is identified as a placeholder.",
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

- apps/api/src/modules/registerUseCases.ts
- apps/web/public/js/preview-parts/part-00.js
- apps/web/public/js/preview-parts/part-06.js

### Implementation gaps and decisions

- The source now has separate configuration subpages; the old blanket claim that Configuration cannot open is not established.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-configuration and name Change tenant settings. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `PATCH /api/v1/settings/use-cases` | [apps/api/src/modules/registerUseCases.ts:381](../../apps/api/src/modules/registerUseCases.ts) |

## Scenarios

1. Hide use cases: use-case visibility is enabled; the administrator saves enabled=false; expected: the documentation controls follow the saved setting.
2. Reload: a setting save succeeds; the setting is reopened; expected: the effective value can be checked.
3. Failed save: the settings request fails; the result is handled; expected: no confirmed settings change is claimed.
4. Independent settings: logging changes; the change is saved; expected: no unrelated eventing change is implied.

## Gherkin

```gherkin
Feature: Configuration

  @UC-configuration @AC-01 @specification
  Scenario: Hide use cases
    Given use-case visibility is enabled
    When the administrator saves enabled=false
    Then the documentation controls follow the saved setting

  @UC-configuration @AC-02 @specification
  Scenario: Reload
    Given a setting save succeeds
    When the setting is reopened
    Then the effective value can be checked

  @UC-configuration @AC-03 @specification
  Scenario: Failed save
    Given the settings request fails
    When the result is handled
    Then no confirmed settings change is claimed

  @UC-configuration @AC-04 @specification
  Scenario: Independent settings
    Given logging changes
    When the change is saved
    Then no unrelated eventing change is implied
```
