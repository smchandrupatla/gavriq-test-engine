# User roles

- **ID:** UC-configurationUserRoles
- **Screen:** User roles
- **Page key:** `configurationUserRoles`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Inspect the role-related configuration entry and find the actual access-management surface.

## Precondition

Configuration is accessible to the operator.

## Trigger

Operator opens User roles under Configuration.

## Success guarantee

Inspect the role-related configuration entry and find the actual access-management surface. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A generic on/off row cannot create roles. Role labels must not imply assignments that were never loaded.

## Acceptance criteria

1. **AC-01 [proposed]** Given the row mentions Analyst, Reviewer and Admin, when it is displayed, those labels are not claimed to be the full tenant assignment list.
2. **AC-02 [proposed]** Given the row is toggled, when no provisioning route is called, no new role is claimed.
3. **AC-03 [proposed]** Given the roles case also exists, when this page opens its use case, the configuration subpage identity is preserved.

## Main flow

1. Operator opens User roles under Configuration.
2. System displays the available role setting or clearly labelled informational row.
3. Operator follows a supported access-management path where available.
4. Actual assignments are reviewed using their registered contract.

## Alternate flows

1. The operator reads the role summary without changing anything.
2. Functional and data access profiles are inspected separately.

## Exception flows

1. A generic on/off row cannot create roles.
2. Role labels must not imply assignments that were never loaded.

## Business validation

1. This screen is distinct from the historical roles use case.
2. RBAC cannot be represented completely by a single switch.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-configurationUserRoles",
  "screenName": "User roles",
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
      "assetId": "SUBMENU-configuration-user-roles",
      "kind": "submenu",
      "name": "User roles",
      "label": "User roles",
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
      "assetId": "SUBMENU-configuration-user-roles",
      "kind": "submenu",
      "name": "User roles",
      "label": "User roles",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-configurationUserRoles",
      "kind": "screen",
      "name": "User roles",
      "label": "User roles",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-configuration-user-roles-1",
      "flowKind": "main",
      "instruction": "Operator opens User roles under Configuration.",
      "screenId": "SCR-configurationUserRoles",
      "assetIds": [
        "SCR-configurationUserRoles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-configuration-user-roles-2",
      "flowKind": "main",
      "instruction": "System displays the available role setting or clearly labelled informational row.",
      "screenId": "SCR-configurationUserRoles",
      "assetIds": [
        "SCR-configurationUserRoles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-configuration-user-roles-3",
      "flowKind": "main",
      "instruction": "Operator follows a supported access-management path where available.",
      "screenId": "SCR-configurationUserRoles",
      "assetIds": [
        "SCR-configurationUserRoles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-configuration-user-roles-4",
      "flowKind": "main",
      "instruction": "Actual assignments are reviewed using their registered contract.",
      "screenId": "SCR-configurationUserRoles",
      "assetIds": [
        "SCR-configurationUserRoles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-configuration-user-roles-1",
      "flowKind": "alternate",
      "instruction": "The operator reads the role summary without changing anything.",
      "screenId": "SCR-configurationUserRoles",
      "assetIds": [
        "SCR-configurationUserRoles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The operator reads the role summary without changing anything.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-configuration-user-roles-2",
      "flowKind": "alternate",
      "instruction": "Functional and data access profiles are inspected separately.",
      "screenId": "SCR-configurationUserRoles",
      "assetIds": [
        "SCR-configurationUserRoles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Functional and data access profiles are inspected separately.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-configuration-user-roles-1",
      "flowKind": "exception",
      "instruction": "A generic on/off row cannot create roles.",
      "screenId": "SCR-configurationUserRoles",
      "assetIds": [
        "SCR-configurationUserRoles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A generic on/off row cannot create roles.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-configuration-user-roles-2",
      "flowKind": "exception",
      "instruction": "Role labels must not imply assignments that were never loaded.",
      "screenId": "SCR-configurationUserRoles",
      "assetIds": [
        "SCR-configurationUserRoles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Role labels must not imply assignments that were never loaded.",
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
- apps/api/src/app.ts

### Implementation gaps and decisions

- The native settings row is not a complete role-management editor.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-configurationUserRoles and name User roles. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Informational row: the row mentions Analyst, Reviewer and Admin; it is displayed; expected: those labels are not claimed to be the full tenant assignment list.
2. No creation: the row is toggled; no provisioning route is called; expected: no new role is claimed.
3. Separate identity: the roles case also exists; this page opens its use case; expected: the configuration subpage identity is preserved.

## Gherkin

```gherkin
Feature: User roles

  @UC-configurationUserRoles @AC-01 @specification
  Scenario: Informational row
    Given the row mentions Analyst, Reviewer and Admin
    When it is displayed
    Then those labels are not claimed to be the full tenant assignment list

  @UC-configurationUserRoles @AC-02 @specification
  Scenario: No creation
    Given the row is toggled
    When no provisioning route is called
    Then no new role is claimed

  @UC-configurationUserRoles @AC-03 @specification
  Scenario: Separate identity
    Given the roles case also exists
    When this page opens its use case
    Then the configuration subpage identity is preserved
```
