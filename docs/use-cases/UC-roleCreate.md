# Create user role

- **ID:** UC-roleCreate
- **Screen:** Create user role
- **Page key:** `roleCreate`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant admin
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Specify creation of a named permission grouping without claiming unimplemented role provisioning.

## Precondition

The administrator has agreed the supported permission vocabulary and assignment policy.

## Trigger

Administrator names the job function.

## Success guarantee

Specify creation of a named permission grouping without claiming unimplemented role provisioning. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Unknown permission strings must not become effective silently. Duplicate name scope and role deletion policy remain decisions.

## Acceptance criteria

1. **AC-01 [proposed]** Given an unknown permission is entered, when the role is validated, the unsupported permission is identified.
2. **AC-02 [proposed]** Given an equivalent role already exists, when a new role is proposed, the existing grouping can be reviewed before duplication.
3. **AC-03 [proposed]** Given a role is associated with level 2, when permissions are reviewed, level 2 is not interpreted as every write permission.
4. **AC-04 [proposed]** Given no create-role route is registered, when creation is requested, the gap is disclosed rather than a false success.

## Main flow

1. Administrator names the job function.
2. Administrator selects explicit supported permissions.
3. Administrator reviews any separate feature slice.
4. System validates the grouping through a confirmed provisioning contract.
5. System confirms the created identity before it becomes assignable.

## Alternate flows

1. An existing suitable role should be reused rather than duplicated.
2. An incomplete role remains a proposal until provisioning exists.

## Exception flows

1. Unknown permission strings must not become effective silently.
2. Duplicate name scope and role deletion policy remain decisions.

## Business validation

1. Permissions and feature level are separate dimensions.
2. No automatic default permission is promised without a registered create contract.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-roleCreate",
  "screenName": "Create user role",
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
      "assetId": "SUBMENU-role-create",
      "kind": "submenu",
      "name": "Create user role",
      "label": "Create user role",
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
      "assetId": "SUBMENU-role-create",
      "kind": "submenu",
      "name": "Create user role",
      "label": "Create user role",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-roleCreate",
      "kind": "screen",
      "name": "Create user role",
      "label": "Create user role",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-role-create-1",
      "flowKind": "main",
      "instruction": "Administrator names the job function.",
      "screenId": "SCR-roleCreate",
      "assetIds": [
        "SCR-roleCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-role-create-2",
      "flowKind": "main",
      "instruction": "Administrator selects explicit supported permissions.",
      "screenId": "SCR-roleCreate",
      "assetIds": [
        "SCR-roleCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-role-create-3",
      "flowKind": "main",
      "instruction": "Administrator reviews any separate feature slice.",
      "screenId": "SCR-roleCreate",
      "assetIds": [
        "SCR-roleCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-role-create-4",
      "flowKind": "main",
      "instruction": "System validates the grouping through a confirmed provisioning contract.",
      "screenId": "SCR-roleCreate",
      "assetIds": [
        "SCR-roleCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-role-create-5",
      "flowKind": "main",
      "instruction": "System confirms the created identity before it becomes assignable.",
      "screenId": "SCR-roleCreate",
      "assetIds": [
        "SCR-roleCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-role-create-1",
      "flowKind": "alternate",
      "instruction": "An existing suitable role should be reused rather than duplicated.",
      "screenId": "SCR-roleCreate",
      "assetIds": [
        "SCR-roleCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An existing suitable role should be reused rather than duplicated.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-role-create-2",
      "flowKind": "alternate",
      "instruction": "An incomplete role remains a proposal until provisioning exists.",
      "screenId": "SCR-roleCreate",
      "assetIds": [
        "SCR-roleCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An incomplete role remains a proposal until provisioning exists.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-role-create-1",
      "flowKind": "exception",
      "instruction": "Unknown permission strings must not become effective silently.",
      "screenId": "SCR-roleCreate",
      "assetIds": [
        "SCR-roleCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unknown permission strings must not become effective silently.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-role-create-2",
      "flowKind": "exception",
      "instruction": "Duplicate name scope and role deletion policy remain decisions.",
      "screenId": "SCR-roleCreate",
      "assetIds": [
        "SCR-roleCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Duplicate name scope and role deletion policy remain decisions.",
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

- apps/api/src/app.ts
- apps/api/src/modules/featureAccess.ts

### Implementation gaps and decisions

- No native roleCreate screen or /api/v1/roles POST route was found. All creation outcomes are proposed requirements.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-roleCreate and name Create user role. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Permission vocabulary: an unknown permission is entered; the role is validated; expected: the unsupported permission is identified.
2. Reuse: an equivalent role already exists; a new role is proposed; expected: the existing grouping can be reviewed before duplication.
3. Separate level: a role is associated with level 2; permissions are reviewed; expected: level 2 is not interpreted as every write permission.
4. No implementation: no create-role route is registered; creation is requested; expected: the gap is disclosed rather than a false success.

## Gherkin

```gherkin
Feature: Create user role

  @UC-roleCreate @AC-01 @specification
  Scenario: Permission vocabulary
    Given an unknown permission is entered
    When the role is validated
    Then the unsupported permission is identified

  @UC-roleCreate @AC-02 @specification
  Scenario: Reuse
    Given an equivalent role already exists
    When a new role is proposed
    Then the existing grouping can be reviewed before duplication

  @UC-roleCreate @AC-03 @specification
  Scenario: Separate level
    Given a role is associated with level 2
    When permissions are reviewed
    Then level 2 is not interpreted as every write permission

  @UC-roleCreate @AC-04 @specification
  Scenario: No implementation
    Given no create-role route is registered
    When creation is requested
    Then the gap is disclosed rather than a false success
```
