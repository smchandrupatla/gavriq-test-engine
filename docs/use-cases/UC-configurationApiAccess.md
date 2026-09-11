# API access

- **ID:** UC-configurationApiAccess
- **Screen:** API access
- **Page key:** `configurationApiAccess`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Review programmatic-access policy without confusing a display toggle with credential provisioning.

## Precondition

The administrator can review application access policy.

## Trigger

Administrator opens API access.

## Success guarantee

Review programmatic-access policy without confusing a display toggle with credential provisioning. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An unwired toggle must not claim to create or revoke credentials. A failure cannot expose a fabricated API key.

## Acceptance criteria

1. **AC-01 [proposed]** Given the API-access row is toggled, when no credential service is invoked, no API key is claimed created.
2. **AC-02 [proposed]** Given access is shown disabled, when the page is inspected, the display alone is not proof all API routes reject requests.
3. **AC-03 [proposed]** Given the console session works, when API access is reviewed, session access is not confused with a new programmatic credential.

## Main flow

1. Administrator opens API access.
2. System shows the current supported policy or identifies preview-only text.
3. Administrator reviews the intended enablement and credential scope.
4. Any supported change must report its effective result independently of credential creation.

## Alternate flows

1. Keep programmatic access disabled.
2. Session authentication remains a separate flow.

## Exception flows

1. An unwired toggle must not claim to create or revoke credentials.
2. A failure cannot expose a fabricated API key.

## Business validation

1. Visibility, authentication and authorisation are separate.
2. Expiry, rotation, scope and revocation need an actual credential contract.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-configurationApiAccess",
  "screenName": "API access",
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
      "assetId": "SUBMENU-configuration-api-access",
      "kind": "submenu",
      "name": "API access",
      "label": "API access",
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
      "assetId": "SUBMENU-configuration-api-access",
      "kind": "submenu",
      "name": "API access",
      "label": "API access",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-configurationApiAccess",
      "kind": "screen",
      "name": "API access",
      "label": "API access",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-configuration-api-access-1",
      "flowKind": "main",
      "instruction": "Administrator opens API access.",
      "screenId": "SCR-configurationApiAccess",
      "assetIds": [
        "SCR-configurationApiAccess"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-configuration-api-access-2",
      "flowKind": "main",
      "instruction": "System shows the current supported policy or identifies preview-only text.",
      "screenId": "SCR-configurationApiAccess",
      "assetIds": [
        "SCR-configurationApiAccess"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-configuration-api-access-3",
      "flowKind": "main",
      "instruction": "Administrator reviews the intended enablement and credential scope.",
      "screenId": "SCR-configurationApiAccess",
      "assetIds": [
        "SCR-configurationApiAccess"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-configuration-api-access-4",
      "flowKind": "main",
      "instruction": "Any supported change must report its effective result independently of credential creation.",
      "screenId": "SCR-configurationApiAccess",
      "assetIds": [
        "SCR-configurationApiAccess"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-configuration-api-access-1",
      "flowKind": "alternate",
      "instruction": "Keep programmatic access disabled.",
      "screenId": "SCR-configurationApiAccess",
      "assetIds": [
        "SCR-configurationApiAccess"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Keep programmatic access disabled.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-configuration-api-access-2",
      "flowKind": "alternate",
      "instruction": "Session authentication remains a separate flow.",
      "screenId": "SCR-configurationApiAccess",
      "assetIds": [
        "SCR-configurationApiAccess"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Session authentication remains a separate flow.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-configuration-api-access-1",
      "flowKind": "exception",
      "instruction": "An unwired toggle must not claim to create or revoke credentials.",
      "screenId": "SCR-configurationApiAccess",
      "assetIds": [
        "SCR-configurationApiAccess"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unwired toggle must not claim to create or revoke credentials.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-configuration-api-access-2",
      "flowKind": "exception",
      "instruction": "A failure cannot expose a fabricated API key.",
      "screenId": "SCR-configurationApiAccess",
      "assetIds": [
        "SCR-configurationApiAccess"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failure cannot expose a fabricated API key.",
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

- Dedicated key issuance and revocation controls are not established by this page.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-configurationApiAccess and name API access. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. No credential: the API-access row is toggled; no credential service is invoked; expected: no API key is claimed created.
2. Disabled: access is shown disabled; the page is inspected; expected: the display alone is not proof all API routes reject requests.
3. Separation: the console session works; API access is reviewed; expected: session access is not confused with a new programmatic credential.

## Gherkin

```gherkin
Feature: API access

  @UC-configurationApiAccess @AC-01 @specification
  Scenario: No credential
    Given the API-access row is toggled
    When no credential service is invoked
    Then no API key is claimed created

  @UC-configurationApiAccess @AC-02 @specification
  Scenario: Disabled
    Given access is shown disabled
    When the page is inspected
    Then the display alone is not proof all API routes reject requests

  @UC-configurationApiAccess @AC-03 @specification
  Scenario: Separation
    Given the console session works
    When API access is reviewed
    Then session access is not confused with a new programmatic credential
```
