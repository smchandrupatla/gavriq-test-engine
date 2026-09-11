# Configure the domain event catalogue and origin headers

- **ID:** UC-eventFramework
- **Screen:** Event framework
- **Page key:** `eventFramework`
- **Level:** 3
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Review domain-event emission and origin-header configuration as distinct settings.

## Precondition

The administrator can access App configs and the relevant event settings.

## Trigger

Administrator opens App configs.

## Success guarantee

Review domain-event emission and origin-header configuration as distinct settings. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Unknown or disabled event codes do not become emitted events. A failed setting save is not represented as effective enforcement.

## Acceptance criteria

1. **AC-01 [proposed]** Given the current page title is App configs, when the overlay evaluates its title condition, the source condition permits mounting.
2. **AC-02 [proposed]** Given MQ requires a configured header, when the effective policy is reviewed, the requirement is distinct from API-origin settings.
3. **AC-03 [proposed]** Given an unknown event code is submitted, when emit is requested, the code is rejected.
4. **AC-04 [proposed]** Given a framework update fails, when the result appears, the prior effective configuration is not claimed changed.

## Main flow

1. Administrator opens App configs.
2. System mounts the event framework and origin-header panels when their source title condition matches.
3. Administrator reviews event classes and header requirements.
4. Administrator changes and explicitly saves one configuration.
5. System reports its saved value; administrator verifies the effective configuration.

## Alternate flows

1. Event catalogue export is separate from editing configuration.
2. Different origins can have different required-header policies.

## Exception flows

1. Unknown or disabled event codes do not become emitted events.
2. A failed setting save is not represented as effective enforcement.

## Business validation

1. Emission configuration, captured history and delivery are separate concepts.
2. An inventory of API event names is not a command to execute all of them on each screen step.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/events/framework
4. PATCH /api/v1/events/framework
5. GET /api/v1/events/headers
6. PATCH /api/v1/events/headers
7. GET /api/v1/events/catalog

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-eventFramework",
  "screenName": "Event framework",
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
      "assetId": "SUBMENU-event-framework",
      "kind": "submenu",
      "name": "Event framework",
      "label": "Event framework",
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
      "assetId": "SUBMENU-event-framework",
      "kind": "submenu",
      "name": "Event framework",
      "label": "Event framework",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-eventFramework",
      "kind": "screen",
      "name": "Event framework",
      "label": "Event framework",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "sbe-events-box",
      "kind": "control",
      "name": "Domain events display",
      "label": "Domain events display",
      "selector": "#sbe-events-box",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-12.js",
      "parentAssetId": "SCR-eventFramework",
      "source": "screen-source",
      "verification": "verified"
    },
    {
      "assetId": "sbe-origin-pre",
      "kind": "control",
      "name": "Origin header display",
      "label": "Origin header display",
      "selector": "#sbe-origin-pre",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-12.js",
      "parentAssetId": "SCR-eventFramework",
      "source": "screen-source",
      "verification": "verified"
    },
    {
      "assetId": "sbe-ev-csv",
      "kind": "control",
      "name": "Export events CSV",
      "label": "Export events CSV",
      "selector": "#sbe-ev-csv",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-12.js",
      "parentAssetId": "SCR-eventFramework",
      "source": "screen-source",
      "verification": "verified"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-event-framework-1",
      "flowKind": "main",
      "instruction": "Administrator opens App configs.",
      "screenId": "SCR-eventFramework",
      "assetIds": [
        "SCR-eventFramework"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-event-framework-2",
      "flowKind": "main",
      "instruction": "System mounts the event framework and origin-header panels when their source title condition matches.",
      "screenId": "SCR-eventFramework",
      "assetIds": [
        "SCR-eventFramework"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-event-framework-3",
      "flowKind": "main",
      "instruction": "Administrator reviews event classes and header requirements.",
      "screenId": "SCR-eventFramework",
      "assetIds": [
        "SCR-eventFramework"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-event-framework-4",
      "flowKind": "main",
      "instruction": "Administrator changes and explicitly saves one configuration.",
      "screenId": "SCR-eventFramework",
      "assetIds": [
        "SCR-eventFramework"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-event-framework-5",
      "flowKind": "main",
      "instruction": "System reports its saved value; administrator verifies the effective configuration.",
      "screenId": "SCR-eventFramework",
      "assetIds": [
        "SCR-eventFramework"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-event-framework-1",
      "flowKind": "alternate",
      "instruction": "Event catalogue export is separate from editing configuration.",
      "screenId": "SCR-eventFramework",
      "assetIds": [
        "SCR-eventFramework"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Event catalogue export is separate from editing configuration.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-event-framework-2",
      "flowKind": "alternate",
      "instruction": "Different origins can have different required-header policies.",
      "screenId": "SCR-eventFramework",
      "assetIds": [
        "SCR-eventFramework"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Different origins can have different required-header policies.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-event-framework-1",
      "flowKind": "exception",
      "instruction": "Unknown or disabled event codes do not become emitted events.",
      "screenId": "SCR-eventFramework",
      "assetIds": [
        "SCR-eventFramework"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unknown or disabled event codes do not become emitted events.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-event-framework-2",
      "flowKind": "exception",
      "instruction": "A failed setting save is not represented as effective enforcement.",
      "screenId": "SCR-eventFramework",
      "assetIds": [
        "SCR-eventFramework"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed setting save is not represented as effective enforcement.",
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
- apps/api/src/modules/registerEventRoutes.ts
- apps/web/public/js/preview-parts/part-00.js

### Implementation gaps and decisions

- The repository now defines App configs, so the old categorical unreachable claim is stale. Live mounting and persistence still require runtime verification.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-eventFramework and name Configure the domain event catalogue and origin headers. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/events/framework` | [apps/api/src/modules/registerEventRoutes.ts:46](../../apps/api/src/modules/registerEventRoutes.ts) |
| `PATCH /api/v1/events/framework` | [apps/api/src/modules/registerEventRoutes.ts:52](../../apps/api/src/modules/registerEventRoutes.ts) |
| `GET /api/v1/events/headers` | [apps/api/src/modules/registerEventRoutes.ts:108](../../apps/api/src/modules/registerEventRoutes.ts) |
| `PATCH /api/v1/events/headers` | [apps/api/src/modules/registerEventRoutes.ts:120](../../apps/api/src/modules/registerEventRoutes.ts) |
| `GET /api/v1/events/catalog` | [apps/api/src/modules/registerEventRoutes.ts:18](../../apps/api/src/modules/registerEventRoutes.ts) |

## Scenarios

1. Mount condition: the current page title is App configs; the overlay evaluates its title condition; expected: the source condition permits mounting.
2. Header policy: MQ requires a configured header; the effective policy is reviewed; expected: the requirement is distinct from API-origin settings.
3. Unknown event: an unknown event code is submitted; emit is requested; expected: the code is rejected.
4. Save failure: a framework update fails; the result appears; expected: the prior effective configuration is not claimed changed.

## Gherkin

```gherkin
Feature: Event framework

  @UC-eventFramework @AC-01 @specification
  Scenario: Mount condition
    Given the current page title is App configs
    When the overlay evaluates its title condition
    Then the source condition permits mounting

  @UC-eventFramework @AC-02 @specification
  Scenario: Header policy
    Given MQ requires a configured header
    When the effective policy is reviewed
    Then the requirement is distinct from API-origin settings

  @UC-eventFramework @AC-03 @specification
  Scenario: Unknown event
    Given an unknown event code is submitted
    When emit is requested
    Then the code is rejected

  @UC-eventFramework @AC-04 @specification
  Scenario: Save failure
    Given a framework update fails
    When the result appears
    Then the prior effective configuration is not claimed changed
```
