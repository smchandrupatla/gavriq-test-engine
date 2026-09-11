# User roles

- **ID:** UC-roles
- **Screen:** User roles
- **Page key:** `roles`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant admin
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Review role-like functional access profiles and their effective permissions.

## Precondition

The administrator can read functional access profiles.

## Trigger

Administrator opens supported access administration.

## Success guarantee

Review role-like functional access profiles and their effective permissions. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Unregistered role CRUD is not claimed available. Deleting an assigned role requires an agreed dependency policy.

## Acceptance criteria

1. **AC-01 [proposed]** Given functional profiles exist, when the supported listing is opened, their actual permissions are shown.
2. **AC-02 [proposed]** Given a data access profile exists, when roles are reviewed, data scope is not confused with functional verbs.
3. **AC-03 [proposed]** Given role deletion is unimplemented, when the operation is considered, the gap is explicit.
4. **AC-04 [proposed]** Given a profile is assigned, when a change is proposed, affected assignments are identified before a lifecycle policy is claimed.

## Main flow

1. Administrator opens supported access administration.
2. System lists the actual functional profiles.
3. Administrator reviews permitted operations and effective assignments.
4. Administrator identifies a supported change path or records a missing capability.

## Alternate flows

1. Data access profiles are reviewed separately from functional permissions.
2. A historical User roles setting is not a role editor.

## Exception flows

1. Unregistered role CRUD is not claimed available.
2. Deleting an assigned role requires an agreed dependency policy.

## Business validation

1. Role semantics are collections of permissions, not arbitrary screen visibility.
2. Feature slicing does not replace assignment policy.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/admin/functional-access-profiles
4. GET /api/v1/admin/data-access-profiles

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-roles",
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
      "assetId": "SUBMENU-roles",
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
      "assetId": "SUBMENU-roles",
      "kind": "submenu",
      "name": "User roles",
      "label": "User roles",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-roles",
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
      "flowId": "MAIN-roles-1",
      "flowKind": "main",
      "instruction": "Administrator opens supported access administration.",
      "screenId": "SCR-roles",
      "assetIds": [
        "SCR-roles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-roles-2",
      "flowKind": "main",
      "instruction": "System lists the actual functional profiles.",
      "screenId": "SCR-roles",
      "assetIds": [
        "SCR-roles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-roles-3",
      "flowKind": "main",
      "instruction": "Administrator reviews permitted operations and effective assignments.",
      "screenId": "SCR-roles",
      "assetIds": [
        "SCR-roles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-roles-4",
      "flowKind": "main",
      "instruction": "Administrator identifies a supported change path or records a missing capability.",
      "screenId": "SCR-roles",
      "assetIds": [
        "SCR-roles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-roles-1",
      "flowKind": "alternate",
      "instruction": "Data access profiles are reviewed separately from functional permissions.",
      "screenId": "SCR-roles",
      "assetIds": [
        "SCR-roles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Data access profiles are reviewed separately from functional permissions.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-roles-2",
      "flowKind": "alternate",
      "instruction": "A historical User roles setting is not a role editor.",
      "screenId": "SCR-roles",
      "assetIds": [
        "SCR-roles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A historical User roles setting is not a role editor.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-roles-1",
      "flowKind": "exception",
      "instruction": "Unregistered role CRUD is not claimed available.",
      "screenId": "SCR-roles",
      "assetIds": [
        "SCR-roles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unregistered role CRUD is not claimed available.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-roles-2",
      "flowKind": "exception",
      "instruction": "Deleting an assigned role requires an agreed dependency policy.",
      "screenId": "SCR-roles",
      "assetIds": [
        "SCR-roles"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Deleting an assigned role requires an agreed dependency policy.",
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

### Implementation gaps and decisions

- No /api/v1/roles CRUD routes were found. The retained roles case describes the review requirement and supported profile listings.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-roles and name User roles. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/admin/functional-access-profiles` | [apps/api/src/app.ts:281](../../apps/api/src/app.ts) |
| `GET /api/v1/admin/data-access-profiles` | [apps/api/src/app.ts:292](../../apps/api/src/app.ts) |

## Scenarios

1. Profiles: functional profiles exist; the supported listing is opened; expected: their actual permissions are shown.
2. Data scope: a data access profile exists; roles are reviewed; expected: data scope is not confused with functional verbs.
3. No CRUD: role deletion is unimplemented; the operation is considered; expected: the gap is explicit.
4. Assignments: a profile is assigned; a change is proposed; expected: affected assignments are identified before a lifecycle policy is claimed.

## Gherkin

```gherkin
Feature: User roles

  @UC-roles @AC-01 @specification
  Scenario: Profiles
    Given functional profiles exist
    When the supported listing is opened
    Then their actual permissions are shown

  @UC-roles @AC-02 @specification
  Scenario: Data scope
    Given a data access profile exists
    When roles are reviewed
    Then data scope is not confused with functional verbs

  @UC-roles @AC-03 @specification
  Scenario: No CRUD
    Given role deletion is unimplemented
    When the operation is considered
    Then the gap is explicit

  @UC-roles @AC-04 @specification
  Scenario: Assignments
    Given a profile is assigned
    When a change is proposed
    Then affected assignments are identified before a lifecycle policy is claimed
```
