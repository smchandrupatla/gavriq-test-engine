# Notifications

- **ID:** UC-configurationNotifications
- **Screen:** Notifications
- **Page key:** `configurationNotifications`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Specify notification preferences for run failures and rule reviews with explicit delivery outcomes.

## Precondition

The administrator knows the intended recipients and event categories.

## Trigger

Administrator opens Notifications.

## Success guarantee

Specify notification preferences for run failures and rule reviews with explicit delivery outcomes. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Invalid recipients need an explicit validation result. A saved preference does not mean a notification was delivered.

## Acceptance criteria

1. **AC-01 [proposed]** Given a preference is saved, when the result is displayed, no email delivery is claimed.
2. **AC-02 [proposed]** Given a recipient is invalid, when delivery is attempted, failure is disclosed.
3. **AC-03 [proposed]** Given failure notifications are disabled, when a run fails, the documented suppression policy applies only when implemented.

## Main flow

1. Administrator opens Notifications.
2. System identifies the available notification preferences.
3. Administrator selects event categories and supported delivery channels.
4. A supported save confirms preferences; actual delivery is reviewed separately.

## Alternate flows

1. Disable a supported notification category.
2. In-app and email delivery can have different availability.

## Exception flows

1. Invalid recipients need an explicit validation result.
2. A saved preference does not mean a notification was delivered.

## Business validation

1. Do not infer an email service from the preview text.
2. Notification deduplication, retries and subscription scope remain decisions.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-configurationNotifications",
  "screenName": "Notifications",
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
      "assetId": "SUBMENU-configuration-notifications",
      "kind": "submenu",
      "name": "Notifications",
      "label": "Notifications",
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
      "assetId": "SUBMENU-configuration-notifications",
      "kind": "submenu",
      "name": "Notifications",
      "label": "Notifications",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-configurationNotifications",
      "kind": "screen",
      "name": "Notifications",
      "label": "Notifications",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-configuration-notifications-1",
      "flowKind": "main",
      "instruction": "Administrator opens Notifications.",
      "screenId": "SCR-configurationNotifications",
      "assetIds": [
        "SCR-configurationNotifications"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-configuration-notifications-2",
      "flowKind": "main",
      "instruction": "System identifies the available notification preferences.",
      "screenId": "SCR-configurationNotifications",
      "assetIds": [
        "SCR-configurationNotifications"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-configuration-notifications-3",
      "flowKind": "main",
      "instruction": "Administrator selects event categories and supported delivery channels.",
      "screenId": "SCR-configurationNotifications",
      "assetIds": [
        "SCR-configurationNotifications"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-configuration-notifications-4",
      "flowKind": "main",
      "instruction": "A supported save confirms preferences; actual delivery is reviewed separately.",
      "screenId": "SCR-configurationNotifications",
      "assetIds": [
        "SCR-configurationNotifications"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-configuration-notifications-1",
      "flowKind": "alternate",
      "instruction": "Disable a supported notification category.",
      "screenId": "SCR-configurationNotifications",
      "assetIds": [
        "SCR-configurationNotifications"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Disable a supported notification category.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-configuration-notifications-2",
      "flowKind": "alternate",
      "instruction": "In-app and email delivery can have different availability.",
      "screenId": "SCR-configurationNotifications",
      "assetIds": [
        "SCR-configurationNotifications"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "In-app and email delivery can have different availability.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-configuration-notifications-1",
      "flowKind": "exception",
      "instruction": "Invalid recipients need an explicit validation result.",
      "screenId": "SCR-configurationNotifications",
      "assetIds": [
        "SCR-configurationNotifications"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Invalid recipients need an explicit validation result.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-configuration-notifications-2",
      "flowKind": "exception",
      "instruction": "A saved preference does not mean a notification was delivered.",
      "screenId": "SCR-configurationNotifications",
      "assetIds": [
        "SCR-configurationNotifications"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A saved preference does not mean a notification was delivered.",
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
- apps/web/public/js/preview-parts/part-06.js

### Implementation gaps and decisions

- The page is a settings row, not a verified notification engine or subscription editor.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-configurationNotifications and name Notifications. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Preference only: a preference is saved; the result is displayed; expected: no email delivery is claimed.
2. Invalid recipient: a recipient is invalid; delivery is attempted; expected: failure is disclosed.
3. Disabled category: failure notifications are disabled; a run fails; expected: the documented suppression policy applies only when implemented.

## Gherkin

```gherkin
Feature: Notifications

  @UC-configurationNotifications @AC-01 @specification
  Scenario: Preference only
    Given a preference is saved
    When the result is displayed
    Then no email delivery is claimed

  @UC-configurationNotifications @AC-02 @specification
  Scenario: Invalid recipient
    Given a recipient is invalid
    When delivery is attempted
    Then failure is disclosed

  @UC-configurationNotifications @AC-03 @specification
  Scenario: Disabled category
    Given failure notifications are disabled
    When a run fails
    Then the documented suppression policy applies only when implemented
```
