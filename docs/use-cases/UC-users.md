# Users

- **ID:** UC-users
- **Screen:** Users
- **Page key:** `users`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant admin
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Review tenant users and their effective assignments without inventing unsupported user-management APIs.

## Precondition

The administrator has access to the registered admin user listing.

## Trigger

Administrator opens the supported user administration surface.

## Success guarantee

Review tenant users and their effective assignments without inventing unsupported user-management APIs. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Unavailable historical /users endpoints are not treated as working CRUD. A missing user cannot be replaced by a matching display name.

## Acceptance criteria

1. **AC-01 [proposed]** Given a tenant has two members, when admin users are retrieved, the returned members are shown without invented rows.
2. **AC-02 [proposed]** Given user U is selected, when effective access is requested, the request targets U.
3. **AC-03 [proposed]** Given access details are inspected, when the view closes, no assignment changes.
4. **AC-04 [proposed]** Given the old /api/v1/users path is unregistered, when the specification is read, it does not claim that path is a verified capability.

## Main flow

1. Administrator opens the supported user administration surface.
2. System retrieves tenant users.
3. Administrator selects a user identity.
4. System retrieves effective access for that user.
5. Administrator uses only registered transition actions for any maintenance.

## Alternate flows

1. An empty membership collection is shown without demo users.
2. Effective access may be inspected without changing assignments.

## Exception flows

1. Unavailable historical /users endpoints are not treated as working CRUD.
2. A missing user cannot be replaced by a matching display name.

## Business validation

1. Stable user identity is distinct from mutable email/display name.
2. An inactive membership and account deletion have different consequences.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/admin/users
4. GET /api/v1/admin/users/:userId/effective-access
5. POST /api/v1/admin/users/:userId/transitions

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-users",
  "screenName": "Users",
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
      "assetId": "SUBMENU-users",
      "kind": "submenu",
      "name": "Users",
      "label": "Users",
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
      "assetId": "SUBMENU-users",
      "kind": "submenu",
      "name": "Users",
      "label": "Users",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-users",
      "kind": "screen",
      "name": "Users",
      "label": "Users",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-users-1",
      "flowKind": "main",
      "instruction": "Administrator opens the supported user administration surface.",
      "screenId": "SCR-users",
      "assetIds": [
        "SCR-users"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-users-2",
      "flowKind": "main",
      "instruction": "System retrieves tenant users.",
      "screenId": "SCR-users",
      "assetIds": [
        "SCR-users"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-users-3",
      "flowKind": "main",
      "instruction": "Administrator selects a user identity.",
      "screenId": "SCR-users",
      "assetIds": [
        "SCR-users"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-users-4",
      "flowKind": "main",
      "instruction": "System retrieves effective access for that user.",
      "screenId": "SCR-users",
      "assetIds": [
        "SCR-users"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-users-5",
      "flowKind": "main",
      "instruction": "Administrator uses only registered transition actions for any maintenance.",
      "screenId": "SCR-users",
      "assetIds": [
        "SCR-users"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-users-1",
      "flowKind": "alternate",
      "instruction": "An empty membership collection is shown without demo users.",
      "screenId": "SCR-users",
      "assetIds": [
        "SCR-users"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty membership collection is shown without demo users.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-users-2",
      "flowKind": "alternate",
      "instruction": "Effective access may be inspected without changing assignments.",
      "screenId": "SCR-users",
      "assetIds": [
        "SCR-users"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Effective access may be inspected without changing assignments.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-users-1",
      "flowKind": "exception",
      "instruction": "Unavailable historical /users endpoints are not treated as working CRUD.",
      "screenId": "SCR-users",
      "assetIds": [
        "SCR-users"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unavailable historical /users endpoints are not treated as working CRUD.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-users-2",
      "flowKind": "exception",
      "instruction": "A missing user cannot be replaced by a matching display name.",
      "screenId": "SCR-users",
      "assetIds": [
        "SCR-users"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A missing user cannot be replaced by a matching display name.",
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
- apps/web/public/admin.html
- apps/web/public/js/admin.js

### Implementation gaps and decisions

- The old research overlay named unregistered /users CRUD routes. New membership, deactivation and role editing need mapping to actual admin transitions.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-users and name Users. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/admin/users` | [apps/api/src/app.ts:220](../../apps/api/src/app.ts) |
| `GET /api/v1/admin/users/:userId/effective-access` | [apps/api/src/app.ts:241](../../apps/api/src/app.ts) |
| `POST /api/v1/admin/users/:userId/transitions` | [apps/api/src/app.ts:257](../../apps/api/src/app.ts) |

## Scenarios

1. List: a tenant has two members; admin users are retrieved; expected: the returned members are shown without invented rows.
2. Effective access: user U is selected; effective access is requested; expected: the request targets U.
3. Read only: access details are inspected; the view closes; expected: no assignment changes.
4. Unavailable CRUD: the old /api/v1/users path is unregistered; the specification is read; expected: it does not claim that path is a verified capability.

## Gherkin

```gherkin
Feature: Users

  @UC-users @AC-01 @specification
  Scenario: List
    Given a tenant has two members
    When admin users are retrieved
    Then the returned members are shown without invented rows

  @UC-users @AC-02 @specification
  Scenario: Effective access
    Given user U is selected
    When effective access is requested
    Then the request targets U

  @UC-users @AC-03 @specification
  Scenario: Read only
    Given access details are inspected
    When the view closes
    Then no assignment changes

  @UC-users @AC-04 @specification
  Scenario: Unavailable CRUD
    Given the old /api/v1/users path is unregistered
    When the specification is read
    Then it does not claim that path is a verified capability
```
