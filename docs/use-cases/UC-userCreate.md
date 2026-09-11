# Create new user

- **ID:** UC-userCreate
- **Screen:** Create new user
- **Page key:** `userCreate`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant admin
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Specify creation of a tenant membership with reviewed identity and access assignment.

## Precondition

An administrator is authorised to add a member and the intended identity/assignment policy is defined.

## Trigger

Administrator enters the intended person identity.

## Success guarantee

Specify creation of a tenant membership with reviewed identity and access assignment. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An invalid role must not silently become the intended role. Duplicate identity behavior requires a confirmed scope before assigning a specific response code.

## Acceptance criteria

1. **AC-01 [proposed]** Given the person already has an account, when membership creation is reviewed, account reuse is considered separately from duplicate-account creation.
2. **AC-02 [proposed]** Given a selected role is unavailable, when creation is submitted, the intended role is not falsely reported assigned.
3. **AC-03 [proposed]** Given creation has not been submitted, when the administrator cancels, no membership creation is claimed.
4. **AC-04 [proposed]** Given submission has no definitive result, when status is displayed, the membership outcome remains unconfirmed.

## Main flow

1. Administrator enters the intended person identity.
2. System checks required identity fields and existing membership under the agreed policy.
3. Administrator reviews the intended tenant and assignments.
4. Administrator explicitly submits through a supported provisioning path.
5. System reports confirmed membership or a precise failure.

## Alternate flows

1. An existing identity may need membership assignment rather than another account.
2. An invitation-based flow is proposed until its endpoint and expiry rules are defined.

## Exception flows

1. An invalid role must not silently become the intended role.
2. Duplicate identity behavior requires a confirmed scope before assigning a specific response code.

## Business validation

1. Account signup and administrator-created membership are different workflows.
2. No password or secret is fabricated in a use case.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-userCreate",
  "screenName": "Create new user",
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
      "assetId": "SUBMENU-user-create",
      "kind": "submenu",
      "name": "Create new user",
      "label": "Create new user",
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
      "assetId": "SUBMENU-user-create",
      "kind": "submenu",
      "name": "Create new user",
      "label": "Create new user",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-userCreate",
      "kind": "screen",
      "name": "Create new user",
      "label": "Create new user",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-user-create-1",
      "flowKind": "main",
      "instruction": "Administrator enters the intended person identity.",
      "screenId": "SCR-userCreate",
      "assetIds": [
        "SCR-userCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-user-create-2",
      "flowKind": "main",
      "instruction": "System checks required identity fields and existing membership under the agreed policy.",
      "screenId": "SCR-userCreate",
      "assetIds": [
        "SCR-userCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-user-create-3",
      "flowKind": "main",
      "instruction": "Administrator reviews the intended tenant and assignments.",
      "screenId": "SCR-userCreate",
      "assetIds": [
        "SCR-userCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-user-create-4",
      "flowKind": "main",
      "instruction": "Administrator explicitly submits through a supported provisioning path.",
      "screenId": "SCR-userCreate",
      "assetIds": [
        "SCR-userCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-user-create-5",
      "flowKind": "main",
      "instruction": "System reports confirmed membership or a precise failure.",
      "screenId": "SCR-userCreate",
      "assetIds": [
        "SCR-userCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-user-create-1",
      "flowKind": "alternate",
      "instruction": "An existing identity may need membership assignment rather than another account.",
      "screenId": "SCR-userCreate",
      "assetIds": [
        "SCR-userCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An existing identity may need membership assignment rather than another account.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-user-create-2",
      "flowKind": "alternate",
      "instruction": "An invitation-based flow is proposed until its endpoint and expiry rules are defined.",
      "screenId": "SCR-userCreate",
      "assetIds": [
        "SCR-userCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An invitation-based flow is proposed until its endpoint and expiry rules are defined.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-user-create-1",
      "flowKind": "exception",
      "instruction": "An invalid role must not silently become the intended role.",
      "screenId": "SCR-userCreate",
      "assetIds": [
        "SCR-userCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An invalid role must not silently become the intended role.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-user-create-2",
      "flowKind": "exception",
      "instruction": "Duplicate identity behavior requires a confirmed scope before assigning a specific response code.",
      "screenId": "SCR-userCreate",
      "assetIds": [
        "SCR-userCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Duplicate identity behavior requires a confirmed scope before assigning a specific response code.",
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
- apps/api/src/modules/registerAuthenticator.ts

### Implementation gaps and decisions

- No /api/v1/users create route or native userCreate screen was found. This retained source use case is proposed; signup is not substituted for admin provisioning.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)
- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-userCreate and name Create new user. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Existing identity: the person already has an account; membership creation is reviewed; expected: account reuse is considered separately from duplicate-account creation.
2. Invalid role: a selected role is unavailable; creation is submitted; expected: the intended role is not falsely reported assigned.
3. Cancelled: creation has not been submitted; the administrator cancels; expected: no membership creation is claimed.
4. Uncertain result: submission has no definitive result; status is displayed; expected: the membership outcome remains unconfirmed.

## Gherkin

```gherkin
Feature: Create new user

  @UC-userCreate @AC-01 @specification
  Scenario: Existing identity
    Given the person already has an account
    When membership creation is reviewed
    Then account reuse is considered separately from duplicate-account creation

  @UC-userCreate @AC-02 @specification
  Scenario: Invalid role
    Given a selected role is unavailable
    When creation is submitted
    Then the intended role is not falsely reported assigned

  @UC-userCreate @AC-03 @specification
  Scenario: Cancelled
    Given creation has not been submitted
    When the administrator cancels
    Then no membership creation is claimed

  @UC-userCreate @AC-04 @specification
  Scenario: Uncertain result
    Given submission has no definitive result
    When status is displayed
    Then the membership outcome remains unconfirmed
```
