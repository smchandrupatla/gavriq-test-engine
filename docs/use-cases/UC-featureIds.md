# Feature IDs

- **ID:** UC-featureIds
- **Screen:** Feature IDs
- **Page key:** `featureIds`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Inspect stable feature identifiers and distinguish default levels from editable assigned levels.

## Precondition

The feature catalogue is readable.

## Trigger

Administrator opens Feature IDs.

## Success guarantee

Inspect stable feature identifiers and distinguish default levels from editable assigned levels. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

The row-specific PATCH used by the UI is not registered in the inspected feature module. A failed update keeps the prior confirmed level.

## Acceptance criteria

1. **AC-01 [proposed]** Given feature overview is returned, when Feature IDs renders, FTR-overview is shown for that key.
2. **AC-02 [proposed]** Given the row PATCH returns 404, when a level change is attempted, no saved level change is claimed.
3. **AC-03 [proposed]** Given a documentation-only case exists, when features are listed, it is not invented as a feature grant.
4. **AC-04 [proposed]** Given an override is available, when levels render, default and effective values are distinguishable.

## Main flow

1. Administrator opens Feature IDs.
2. System loads feature pages and displays FTR identifiers, labels, level, kind and overlays.
3. Administrator inspects a row and its source level.
4. Any attempted level update reports the actual API result.

## Alternate flows

1. The catalogue can be inspected without edits.
2. No catalogue availability produces an explicit unavailable state.

## Exception flows

1. The row-specific PATCH used by the UI is not registered in the inspected feature module.
2. A failed update keeps the prior confirmed level.

## Business validation

1. Documentation-only use cases do not become feature grants.
2. FTR-page and UC-page identifiers have different roles.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/features

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-featureIds",
  "screenName": "Feature IDs",
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
      "assetId": "SUBMENU-feature-ids",
      "kind": "submenu",
      "name": "Feature IDs",
      "label": "Feature IDs",
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
      "assetId": "SUBMENU-feature-ids",
      "kind": "submenu",
      "name": "Feature IDs",
      "label": "Feature IDs",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-featureIds",
      "kind": "screen",
      "name": "Feature IDs",
      "label": "Feature IDs",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-feature-ids-1",
      "flowKind": "main",
      "instruction": "Administrator opens Feature IDs.",
      "screenId": "SCR-featureIds",
      "assetIds": [
        "SCR-featureIds"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-feature-ids-2",
      "flowKind": "main",
      "instruction": "System loads feature pages and displays FTR identifiers, labels, level, kind and overlays.",
      "screenId": "SCR-featureIds",
      "assetIds": [
        "SCR-featureIds"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-feature-ids-3",
      "flowKind": "main",
      "instruction": "Administrator inspects a row and its source level.",
      "screenId": "SCR-featureIds",
      "assetIds": [
        "SCR-featureIds"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-feature-ids-4",
      "flowKind": "main",
      "instruction": "Any attempted level update reports the actual API result.",
      "screenId": "SCR-featureIds",
      "assetIds": [
        "SCR-featureIds"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-feature-ids-1",
      "flowKind": "alternate",
      "instruction": "The catalogue can be inspected without edits.",
      "screenId": "SCR-featureIds",
      "assetIds": [
        "SCR-featureIds"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The catalogue can be inspected without edits.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-feature-ids-2",
      "flowKind": "alternate",
      "instruction": "No catalogue availability produces an explicit unavailable state.",
      "screenId": "SCR-featureIds",
      "assetIds": [
        "SCR-featureIds"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No catalogue availability produces an explicit unavailable state.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-feature-ids-1",
      "flowKind": "exception",
      "instruction": "The row-specific PATCH used by the UI is not registered in the inspected feature module.",
      "screenId": "SCR-featureIds",
      "assetIds": [
        "SCR-featureIds"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The row-specific PATCH used by the UI is not registered in the inspected feature module.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-feature-ids-2",
      "flowKind": "exception",
      "instruction": "A failed update keeps the prior confirmed level.",
      "screenId": "SCR-featureIds",
      "assetIds": [
        "SCR-featureIds"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed update keeps the prior confirmed level.",
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

- apps/web/public/js/preview-parts/part-06.js
- apps/api/src/modules/registerFeatureAccess.ts

### Implementation gaps and decisions

- PATCH /api/v1/settings/feature-access/:page is called by the screen but absent from registered routes; the base PATCH changes grants, not per-page levels.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-featureIds and name Feature IDs. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/features` | [apps/api/src/modules/registerFeatureAccess.ts:65](../../apps/api/src/modules/registerFeatureAccess.ts) |

## Scenarios

1. Identity: feature overview is returned; Feature IDs renders; expected: FTR-overview is shown for that key.
2. Failed update: the row PATCH returns 404; a level change is attempted; expected: no saved level change is claimed.
3. Catalogue scope: a documentation-only case exists; features are listed; expected: it is not invented as a feature grant.
4. Default versus assigned: an override is available; levels render; expected: default and effective values are distinguishable.

## Gherkin

```gherkin
Feature: Feature IDs

  @UC-featureIds @AC-01 @specification
  Scenario: Identity
    Given feature overview is returned
    When Feature IDs renders
    Then FTR-overview is shown for that key

  @UC-featureIds @AC-02 @specification
  Scenario: Failed update
    Given the row PATCH returns 404
    When a level change is attempted
    Then no saved level change is claimed

  @UC-featureIds @AC-03 @specification
  Scenario: Catalogue scope
    Given a documentation-only case exists
    When features are listed
    Then it is not invented as a feature grant

  @UC-featureIds @AC-04 @specification
  Scenario: Default versus assigned
    Given an override is available
    When levels render
    Then default and effective values are distinguishable
```
