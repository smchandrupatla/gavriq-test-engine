# Features

- **ID:** UC-features
- **Screen:** Features
- **Page key:** `features`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant admin
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Assign a tenant or user feature slice and inspect its effective access separately from job permissions.

## Precondition

The operator has the applicable configuration access.

## Trigger

Administrator reads the feature catalogue and effective grant.

## Success guarantee

Assign a tenant or user feature slice and inspect its effective access separately from job permissions. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Invalid levels follow the declared parser behavior rather than an invented error code. A stored grant is not proof that every frontend overlay and backend route applies it.

## Acceptance criteria

1. **AC-01 [proposed]** Given no user override is selected, when a level-1 grant is saved, the saved target is the tenant default.
2. **AC-02 [proposed]** Given user U is explicitly selected, when a grant is saved, the override is associated with U.
3. **AC-03 [proposed]** Given the effective level is lower than a protected route requires, when that route is called, the feature-level gate rejects it.
4. **AC-04 [proposed]** Given a feature is visible, when the operator lacks its write permission, visibility is not treated as write authorisation.

## Main flow

1. Administrator reads the feature catalogue and effective grant.
2. Administrator chooses maxLevel and view/use mode.
3. Administrator chooses tenant scope or an explicit user override.
4. Administrator saves the grant.
5. System returns the grant; administrator checks the next effective session.

## Alternate flows

1. A user-specific override is stored separately from the tenant default.
2. View mode permits inspection only where the underlying permissions allow it.

## Exception flows

1. Invalid levels follow the declared parser behavior rather than an invented error code.
2. A stored grant is not proof that every frontend overlay and backend route applies it.

## Business validation

1. Feature level is product scope; RBAC governs permitted operations.
2. Backend routes can exist even if their frontend feature is hidden.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/features
4. GET /api/v1/session/features
5. PATCH /api/v1/settings/feature-access

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-features",
  "screenName": "Features",
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
      "assetId": "SUBMENU-features",
      "kind": "submenu",
      "name": "Features",
      "label": "Features",
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
      "assetId": "SUBMENU-features",
      "kind": "submenu",
      "name": "Features",
      "label": "Features",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-features",
      "kind": "screen",
      "name": "Features",
      "label": "Features",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-features-1",
      "flowKind": "main",
      "instruction": "Administrator reads the feature catalogue and effective grant.",
      "screenId": "SCR-features",
      "assetIds": [
        "SCR-features"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-features-2",
      "flowKind": "main",
      "instruction": "Administrator chooses maxLevel and view/use mode.",
      "screenId": "SCR-features",
      "assetIds": [
        "SCR-features"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-features-3",
      "flowKind": "main",
      "instruction": "Administrator chooses tenant scope or an explicit user override.",
      "screenId": "SCR-features",
      "assetIds": [
        "SCR-features"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-features-4",
      "flowKind": "main",
      "instruction": "Administrator saves the grant.",
      "screenId": "SCR-features",
      "assetIds": [
        "SCR-features"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-features-5",
      "flowKind": "main",
      "instruction": "System returns the grant; administrator checks the next effective session.",
      "screenId": "SCR-features",
      "assetIds": [
        "SCR-features"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-features-1",
      "flowKind": "alternate",
      "instruction": "A user-specific override is stored separately from the tenant default.",
      "screenId": "SCR-features",
      "assetIds": [
        "SCR-features"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A user-specific override is stored separately from the tenant default.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-features-2",
      "flowKind": "alternate",
      "instruction": "View mode permits inspection only where the underlying permissions allow it.",
      "screenId": "SCR-features",
      "assetIds": [
        "SCR-features"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "View mode permits inspection only where the underlying permissions allow it.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-features-1",
      "flowKind": "exception",
      "instruction": "Invalid levels follow the declared parser behavior rather than an invented error code.",
      "screenId": "SCR-features",
      "assetIds": [
        "SCR-features"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Invalid levels follow the declared parser behavior rather than an invented error code.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-features-2",
      "flowKind": "exception",
      "instruction": "A stored grant is not proof that every frontend overlay and backend route applies it.",
      "screenId": "SCR-features",
      "assetIds": [
        "SCR-features"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A stored grant is not proof that every frontend overlay and backend route applies it.",
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

- apps/api/src/modules/registerFeatureAccess.ts
- apps/api/src/modules/featureAccess.ts

### Implementation gaps and decisions

- The historical features page key has no native CONFIG page. Session query overrides and stored user overrides need reconciliation before claiming complete enforcement.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-features and name Features. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/features` | [apps/api/src/modules/registerFeatureAccess.ts:65](../../apps/api/src/modules/registerFeatureAccess.ts) |
| `GET /api/v1/session/features` | [apps/api/src/modules/registerFeatureAccess.ts:71](../../apps/api/src/modules/registerFeatureAccess.ts) |
| `PATCH /api/v1/settings/feature-access` | [apps/api/src/modules/registerFeatureAccess.ts:97](../../apps/api/src/modules/registerFeatureAccess.ts) |

## Scenarios

1. Tenant scope: no user override is selected; a level-1 grant is saved; expected: the saved target is the tenant default.
2. User scope: user U is explicitly selected; a grant is saved; expected: the override is associated with U.
3. Restricted API: the effective level is lower than a protected route requires; that route is called; expected: the feature-level gate rejects it.
4. No RBAC substitute: a feature is visible; the operator lacks its write permission; expected: visibility is not treated as write authorisation.

## Gherkin

```gherkin
Feature: Features

  @UC-features @AC-01 @specification
  Scenario: Tenant scope
    Given no user override is selected
    When a level-1 grant is saved
    Then the saved target is the tenant default

  @UC-features @AC-02 @specification
  Scenario: User scope
    Given user U is explicitly selected
    When a grant is saved
    Then the override is associated with U

  @UC-features @AC-03 @specification
  Scenario: Restricted API
    Given the effective level is lower than a protected route requires
    When that route is called
    Then the feature-level gate rejects it

  @UC-features @AC-04 @specification
  Scenario: No RBAC substitute
    Given a feature is visible
    When the operator lacks its write permission
    Then visibility is not treated as write authorisation
```
