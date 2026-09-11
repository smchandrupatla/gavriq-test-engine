# Browse the rule library

- **ID:** UC-ruleBenchExisting
- **Screen:** Existing rules
- **Page key:** `ruleBenchExisting`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Identify an existing detection rule and inspect its definition and lifecycle before reuse.

## Precondition

The session can read the rule catalogue; an empty library is valid.

## Trigger

Analyst opens Existing rules; the system loads tenant rules.

## Success guarantee

Identify an existing detection rule and inspect its definition and lifecycle before reuse. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A deleted rule selected from a stale list produces a not-found result. Missing validation evidence is shown as not validated, not 100% coverage.

## Acceptance criteria

1. **AC-01 [proposed]** Given no rules exist, when the library loads, no fabricated rule is listed.
2. **AC-02 [proposed]** Given two rules have the same display label, when one rule is opened, its stable ID identifies the retrieved condition.
3. **AC-03 [proposed]** Given a rule has no validation result, when its coverage is displayed, the absence is distinguished from a measured zero or perfect score.
4. **AC-04 [proposed]** Given the operator lacks write access, when the rule is inspected, reading does not change its lifecycle.

## Main flow

1. Analyst opens Existing rules; the system loads tenant rules.
2. System shows each rule identity, condition, status and available validation evidence.
3. Analyst opens a rule; the system retrieves that rule rather than a row-position substitute.
4. Analyst chooses an allowed edit or lifecycle action, or returns without changing it.

## Alternate flows

1. An empty library offers Create new rule.
2. A view-only operator may inspect allowed data without being offered a write.

## Exception flows

1. A deleted rule selected from a stale list produces a not-found result.
2. Missing validation evidence is shown as not validated, not 100% coverage.

## Business validation

1. Displayed totals reconcile with the collection and pagination scope.
2. Search must state its scope; the original list template does not prove a wired search service.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/rules

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-ruleBenchExisting",
  "screenName": "Existing rules",
  "navigation": {
    "menu": {
      "assetId": "MENU-rule-bench",
      "kind": "menu",
      "name": "Rule Bench",
      "label": "Rule Bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-rule-bench-existing",
      "kind": "submenu",
      "name": "Existing rules",
      "label": "Existing rules",
      "parentAssetId": "MENU-rule-bench",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-rule-bench",
      "kind": "menu",
      "name": "Rule Bench",
      "label": "Rule Bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-rule-bench-existing",
      "kind": "submenu",
      "name": "Existing rules",
      "label": "Existing rules",
      "parentAssetId": "MENU-rule-bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-ruleBenchExisting",
      "kind": "screen",
      "name": "Existing rules",
      "label": "Existing rules",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rule-bench-existing-1",
      "flowKind": "main",
      "instruction": "Analyst opens Existing rules; the system loads tenant rules.",
      "screenId": "SCR-ruleBenchExisting",
      "assetIds": [
        "SCR-ruleBenchExisting"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rule-bench-existing-2",
      "flowKind": "main",
      "instruction": "System shows each rule identity, condition, status and available validation evidence.",
      "screenId": "SCR-ruleBenchExisting",
      "assetIds": [
        "SCR-ruleBenchExisting"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rule-bench-existing-3",
      "flowKind": "main",
      "instruction": "Analyst opens a rule; the system retrieves that rule rather than a row-position substitute.",
      "screenId": "SCR-ruleBenchExisting",
      "assetIds": [
        "SCR-ruleBenchExisting"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rule-bench-existing-4",
      "flowKind": "main",
      "instruction": "Analyst chooses an allowed edit or lifecycle action, or returns without changing it.",
      "screenId": "SCR-ruleBenchExisting",
      "assetIds": [
        "SCR-ruleBenchExisting"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rule-bench-existing-1",
      "flowKind": "alternate",
      "instruction": "An empty library offers Create new rule.",
      "screenId": "SCR-ruleBenchExisting",
      "assetIds": [
        "SCR-ruleBenchExisting"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty library offers Create new rule.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rule-bench-existing-2",
      "flowKind": "alternate",
      "instruction": "A view-only operator may inspect allowed data without being offered a write.",
      "screenId": "SCR-ruleBenchExisting",
      "assetIds": [
        "SCR-ruleBenchExisting"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A view-only operator may inspect allowed data without being offered a write.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rule-bench-existing-1",
      "flowKind": "exception",
      "instruction": "A deleted rule selected from a stale list produces a not-found result.",
      "screenId": "SCR-ruleBenchExisting",
      "assetIds": [
        "SCR-ruleBenchExisting"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A deleted rule selected from a stale list produces a not-found result.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rule-bench-existing-2",
      "flowKind": "exception",
      "instruction": "Missing validation evidence is shown as not validated, not 100% coverage.",
      "screenId": "SCR-ruleBenchExisting",
      "assetIds": [
        "SCR-ruleBenchExisting"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Missing validation evidence is shown as not validated, not 100% coverage.",
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

- apps/api/src/modules/liveConsole.ts
- apps/web/public/js/preview-parts/part-06.js

### Implementation gaps and decisions

- Filtering and coverage calculations require runtime evidence; colour alone is not a lifecycle contract.

### Research basis

- [NIST, Role Based Access Control project and model overview](https://csrc.nist.gov/projects/role-based-access-control)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-ruleBenchExisting and name Browse the rule library. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/rules` | [apps/api/src/modules/liveConsole.ts:104](../../apps/api/src/modules/liveConsole.ts) |

## Scenarios

1. Empty library: no rules exist; the library loads; expected: no fabricated rule is listed.
2. Rule identity: two rules have the same display label; one rule is opened; expected: its stable ID identifies the retrieved condition.
3. No validation: a rule has no validation result; its coverage is displayed; expected: the absence is distinguished from a measured zero or perfect score.
4. Read only: the operator lacks write access; the rule is inspected; expected: reading does not change its lifecycle.

## Gherkin

```gherkin
Feature: Existing rules

  @UC-ruleBenchExisting @AC-01 @specification
  Scenario: Empty library
    Given no rules exist
    When the library loads
    Then no fabricated rule is listed

  @UC-ruleBenchExisting @AC-02 @specification
  Scenario: Rule identity
    Given two rules have the same display label
    When one rule is opened
    Then its stable ID identifies the retrieved condition

  @UC-ruleBenchExisting @AC-03 @specification
  Scenario: No validation
    Given a rule has no validation result
    When its coverage is displayed
    Then the absence is distinguished from a measured zero or perfect score

  @UC-ruleBenchExisting @AC-04 @specification
  Scenario: Read only
    Given the operator lacks write access
    When the rule is inspected
    Then reading does not change its lifecycle
```
