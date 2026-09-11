# Check compliance framework status

- **ID:** UC-repCompliance
- **Screen:** Compliance reports
- **Page key:** `repCompliance`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Review evidence labelled against a framework without treating a test result as legal certification.

## Precondition

A compliance-labelled report and its scope are available, or the collection is empty.

## Trigger

Reviewer opens Compliance reports.

## Success guarantee

Review evidence labelled against a framework without treating a test result as legal certification. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An unsupported framework mapping is disclosed. A Passed test badge cannot establish regulatory compliance by itself.

## Acceptance criteria

1. **AC-01 [proposed]** Given a report outcome is Review, when the list renders, it remains Review rather than Passed.
2. **AC-02 [proposed]** Given no report supports a framework, when the framework is inspected, no compliance assurance is claimed.
3. **AC-03 [proposed]** Given a test run passed, when the report is labelled compliance, the result is scoped to the tested controls.
4. **AC-04 [proposed]** Given a report is tied to a historical run, when it is opened, that run and evidence date remain visible.

## Main flow

1. Reviewer opens Compliance reports.
2. System displays the report framework label, run context and actual outcome.
3. Reviewer inspects supporting controls and failed or untested items.
4. Reviewer records or performs the follow-up in the supported process.

## Alternate flows

1. No framework evidence is shown as unavailable.
2. Review status remains visible until supported evidence changes it.

## Exception flows

1. An unsupported framework mapping is disclosed.
2. A Passed test badge cannot establish regulatory compliance by itself.

## Business validation

1. AML, OFAC and GDPR labels describe intended report scope, not legal advice or certification.
2. Applicable jurisdiction, obligations, evidence period and human sign-off remain outside a bare status badge.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/reports

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-repCompliance",
  "screenName": "Compliance reports",
  "navigation": {
    "menu": {
      "assetId": "MENU-reports",
      "kind": "menu",
      "name": "Reports",
      "label": "Reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-rep-compliance",
      "kind": "submenu",
      "name": "Compliance reports",
      "label": "Compliance reports",
      "parentAssetId": "MENU-reports",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-reports",
      "kind": "menu",
      "name": "Reports",
      "label": "Reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-rep-compliance",
      "kind": "submenu",
      "name": "Compliance reports",
      "label": "Compliance reports",
      "parentAssetId": "MENU-reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-repCompliance",
      "kind": "screen",
      "name": "Compliance reports",
      "label": "Compliance reports",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rep-compliance-1",
      "flowKind": "main",
      "instruction": "Reviewer opens Compliance reports.",
      "screenId": "SCR-repCompliance",
      "assetIds": [
        "SCR-repCompliance"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rep-compliance-2",
      "flowKind": "main",
      "instruction": "System displays the report framework label, run context and actual outcome.",
      "screenId": "SCR-repCompliance",
      "assetIds": [
        "SCR-repCompliance"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rep-compliance-3",
      "flowKind": "main",
      "instruction": "Reviewer inspects supporting controls and failed or untested items.",
      "screenId": "SCR-repCompliance",
      "assetIds": [
        "SCR-repCompliance"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rep-compliance-4",
      "flowKind": "main",
      "instruction": "Reviewer records or performs the follow-up in the supported process.",
      "screenId": "SCR-repCompliance",
      "assetIds": [
        "SCR-repCompliance"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rep-compliance-1",
      "flowKind": "alternate",
      "instruction": "No framework evidence is shown as unavailable.",
      "screenId": "SCR-repCompliance",
      "assetIds": [
        "SCR-repCompliance"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No framework evidence is shown as unavailable.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rep-compliance-2",
      "flowKind": "alternate",
      "instruction": "Review status remains visible until supported evidence changes it.",
      "screenId": "SCR-repCompliance",
      "assetIds": [
        "SCR-repCompliance"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Review status remains visible until supported evidence changes it.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rep-compliance-1",
      "flowKind": "exception",
      "instruction": "An unsupported framework mapping is disclosed.",
      "screenId": "SCR-repCompliance",
      "assetIds": [
        "SCR-repCompliance"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unsupported framework mapping is disclosed.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rep-compliance-2",
      "flowKind": "exception",
      "instruction": "A Passed test badge cannot establish regulatory compliance by itself.",
      "screenId": "SCR-repCompliance",
      "assetIds": [
        "SCR-repCompliance"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A Passed test badge cannot establish regulatory compliance by itself.",
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

- apps/api/src/modules/liveOps.ts
- apps/web/public/js/preview-parts/part-00.js

### Implementation gaps and decisions

- Framework-control mappings, independent approval and authoritative legal criteria are not implemented evidence in the inspected report view. This specification makes no legal determination.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-repCompliance and name Check compliance framework status. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/reports` | [apps/api/src/modules/liveOps.ts:199](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Needs review: a report outcome is Review; the list renders; expected: it remains Review rather than Passed.
2. No evidence: no report supports a framework; the framework is inspected; expected: no compliance assurance is claimed.
3. Test pass: a test run passed; the report is labelled compliance; expected: the result is scoped to the tested controls.
4. Evidence context: a report is tied to a historical run; it is opened; expected: that run and evidence date remain visible.

## Gherkin

```gherkin
Feature: Compliance reports

  @UC-repCompliance @AC-01 @specification
  Scenario: Needs review
    Given a report outcome is Review
    When the list renders
    Then it remains Review rather than Passed

  @UC-repCompliance @AC-02 @specification
  Scenario: No evidence
    Given no report supports a framework
    When the framework is inspected
    Then no compliance assurance is claimed

  @UC-repCompliance @AC-03 @specification
  Scenario: Test pass
    Given a test run passed
    When the report is labelled compliance
    Then the result is scoped to the tested controls

  @UC-repCompliance @AC-04 @specification
  Scenario: Evidence context
    Given a report is tied to a historical run
    When it is opened
    Then that run and evidence date remain visible
```
