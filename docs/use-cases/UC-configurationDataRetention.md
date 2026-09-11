# Data retention

- **ID:** UC-configurationDataRetention
- **Screen:** Data retention
- **Page key:** `configurationDataRetention`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Review proposed run/report retention while distinguishing policy text from executed deletion.

## Precondition

The administrator has identified the data classes and applicable retention policy.

## Trigger

Administrator opens Data retention.

## Success guarantee

Review proposed run/report retention while distinguishing policy text from executed deletion. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A 90-day caption cannot prove records were deleted. Failed deletion must not be reported as completed cleanup.

## Acceptance criteria

1. **AC-01 [proposed]** Given the page says 90 days, when the policy is reviewed, the text is not represented as evidence of automated cleanup.
2. **AC-02 [proposed]** Given a future cleanup policy has a defined cutoff, when a record lies exactly on that cutoff, inclusion follows the explicitly agreed boundary.
3. **AC-03 [proposed]** Given an agreed hold applies, when cleanup is planned, the hold policy is considered rather than silently ignored.

## Main flow

1. Administrator opens Data retention.
2. System identifies the displayed policy and covered data classes.
3. Administrator reviews cutoff, timezone and exceptions before any policy change.
4. A supported save confirms the policy; deletion evidence is reported separately.

## Alternate flows

1. Keep existing retention until a policy is agreed.
2. Legal holds or explicit exceptions require separate policy decisions.

## Exception flows

1. A 90-day caption cannot prove records were deleted.
2. Failed deletion must not be reported as completed cleanup.

## Business validation

1. Run data, reports, audit evidence and logs need separate retention scopes.
2. No deletion is authorised by merely viewing this use case.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-configurationDataRetention",
  "screenName": "Data retention",
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
      "assetId": "SUBMENU-configuration-data-retention",
      "kind": "submenu",
      "name": "Data retention",
      "label": "Data retention",
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
      "assetId": "SUBMENU-configuration-data-retention",
      "kind": "submenu",
      "name": "Data retention",
      "label": "Data retention",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-configurationDataRetention",
      "kind": "screen",
      "name": "Data retention",
      "label": "Data retention",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-configuration-data-retention-1",
      "flowKind": "main",
      "instruction": "Administrator opens Data retention.",
      "screenId": "SCR-configurationDataRetention",
      "assetIds": [
        "SCR-configurationDataRetention"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-configuration-data-retention-2",
      "flowKind": "main",
      "instruction": "System identifies the displayed policy and covered data classes.",
      "screenId": "SCR-configurationDataRetention",
      "assetIds": [
        "SCR-configurationDataRetention"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-configuration-data-retention-3",
      "flowKind": "main",
      "instruction": "Administrator reviews cutoff, timezone and exceptions before any policy change.",
      "screenId": "SCR-configurationDataRetention",
      "assetIds": [
        "SCR-configurationDataRetention"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-configuration-data-retention-4",
      "flowKind": "main",
      "instruction": "A supported save confirms the policy; deletion evidence is reported separately.",
      "screenId": "SCR-configurationDataRetention",
      "assetIds": [
        "SCR-configurationDataRetention"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-configuration-data-retention-1",
      "flowKind": "alternate",
      "instruction": "Keep existing retention until a policy is agreed.",
      "screenId": "SCR-configurationDataRetention",
      "assetIds": [
        "SCR-configurationDataRetention"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Keep existing retention until a policy is agreed.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-configuration-data-retention-2",
      "flowKind": "alternate",
      "instruction": "Legal holds or explicit exceptions require separate policy decisions.",
      "screenId": "SCR-configurationDataRetention",
      "assetIds": [
        "SCR-configurationDataRetention"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Legal holds or explicit exceptions require separate policy decisions.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-configuration-data-retention-1",
      "flowKind": "exception",
      "instruction": "A 90-day caption cannot prove records were deleted.",
      "screenId": "SCR-configurationDataRetention",
      "assetIds": [
        "SCR-configurationDataRetention"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A 90-day caption cannot prove records were deleted.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-configuration-data-retention-2",
      "flowKind": "exception",
      "instruction": "Failed deletion must not be reported as completed cleanup.",
      "screenId": "SCR-configurationDataRetention",
      "assetIds": [
        "SCR-configurationDataRetention"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Failed deletion must not be reported as completed cleanup.",
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

- No retention worker, hold mechanism or dedicated write contract was verified for this setting.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-configurationDataRetention and name Data retention. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Caption only: the page says 90 days; the policy is reviewed; expected: the text is not represented as evidence of automated cleanup.
2. Cutoff boundary: a future cleanup policy has a defined cutoff; a record lies exactly on that cutoff; expected: inclusion follows the explicitly agreed boundary.
3. Held record: an agreed hold applies; cleanup is planned; expected: the hold policy is considered rather than silently ignored.

## Gherkin

```gherkin
Feature: Data retention

  @UC-configurationDataRetention @AC-01 @specification
  Scenario: Caption only
    Given the page says 90 days
    When the policy is reviewed
    Then the text is not represented as evidence of automated cleanup

  @UC-configurationDataRetention @AC-02 @specification
  Scenario: Cutoff boundary
    Given a future cleanup policy has a defined cutoff
    When a record lies exactly on that cutoff
    Then inclusion follows the explicitly agreed boundary

  @UC-configurationDataRetention @AC-03 @specification
  Scenario: Held record
    Given an agreed hold applies
    When cleanup is planned
    Then the hold policy is considered rather than silently ignored
```
