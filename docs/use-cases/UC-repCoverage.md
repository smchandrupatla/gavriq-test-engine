# Check rule and message coverage

- **ID:** UC-repCoverage
- **Screen:** Coverage reports
- **Page key:** `repCoverage`
- **Level:** 1
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Identify tested and untested rule scope from explicit evidence and a declared denominator.

## Precondition

A rule inventory and any associated test evidence are available.

## Trigger

Analyst opens Coverage reports.

## Success guarantee

Identify tested and untested rule scope from explicit evidence and a declared denominator. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Division by zero is not 100% coverage. Missing or stale results are not silently counted as passed.

## Acceptance criteria

1. **AC-01 [proposed]** Given six of ten rules were exercised, when coverage is calculated by rule count, coverage is 60% with four untested rules.
2. **AC-02 [proposed]** Given the denominator is zero, when coverage renders, it does not claim 100%.
3. **AC-03 [proposed]** Given all ten rules were exercised and two failed, when coverage is displayed, coverage and the 80% pass rate remain distinct.
4. **AC-04 [proposed]** Given a rule changed after testing, when coverage is reviewed, the evidence revision is disclosed.

## Main flow

1. Analyst opens Coverage reports.
2. System identifies the rule set and evidence period/version.
3. System distinguishes tested, untested and unavailable results.
4. Analyst inspects uncovered rules before planning additional tests.

## Alternate flows

1. No evidence is reported as unknown or untested.
2. A partial run retains unevaluated cases in the denominator policy.

## Exception flows

1. Division by zero is not 100% coverage.
2. Missing or stale results are not silently counted as passed.

## Business validation

1. Coverage measures exercised scope; pass rate measures matching expectations.
2. The formula and rounding must reconcile with visible counts.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/reports
4. GET /api/v1/rules

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-repCoverage",
  "screenName": "Coverage reports",
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
      "assetId": "SUBMENU-rep-coverage",
      "kind": "submenu",
      "name": "Coverage reports",
      "label": "Coverage reports",
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
      "assetId": "SUBMENU-rep-coverage",
      "kind": "submenu",
      "name": "Coverage reports",
      "label": "Coverage reports",
      "parentAssetId": "MENU-reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-repCoverage",
      "kind": "screen",
      "name": "Coverage reports",
      "label": "Coverage reports",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rep-coverage-1",
      "flowKind": "main",
      "instruction": "Analyst opens Coverage reports.",
      "screenId": "SCR-repCoverage",
      "assetIds": [
        "SCR-repCoverage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rep-coverage-2",
      "flowKind": "main",
      "instruction": "System identifies the rule set and evidence period/version.",
      "screenId": "SCR-repCoverage",
      "assetIds": [
        "SCR-repCoverage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rep-coverage-3",
      "flowKind": "main",
      "instruction": "System distinguishes tested, untested and unavailable results.",
      "screenId": "SCR-repCoverage",
      "assetIds": [
        "SCR-repCoverage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rep-coverage-4",
      "flowKind": "main",
      "instruction": "Analyst inspects uncovered rules before planning additional tests.",
      "screenId": "SCR-repCoverage",
      "assetIds": [
        "SCR-repCoverage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rep-coverage-1",
      "flowKind": "alternate",
      "instruction": "No evidence is reported as unknown or untested.",
      "screenId": "SCR-repCoverage",
      "assetIds": [
        "SCR-repCoverage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No evidence is reported as unknown or untested.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rep-coverage-2",
      "flowKind": "alternate",
      "instruction": "A partial run retains unevaluated cases in the denominator policy.",
      "screenId": "SCR-repCoverage",
      "assetIds": [
        "SCR-repCoverage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A partial run retains unevaluated cases in the denominator policy.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rep-coverage-1",
      "flowKind": "exception",
      "instruction": "Division by zero is not 100% coverage.",
      "screenId": "SCR-repCoverage",
      "assetIds": [
        "SCR-repCoverage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Division by zero is not 100% coverage.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rep-coverage-2",
      "flowKind": "exception",
      "instruction": "Missing or stale results are not silently counted as passed.",
      "screenId": "SCR-repCoverage",
      "assetIds": [
        "SCR-repCoverage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Missing or stale results are not silently counted as passed.",
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

- The six-of-ten formula is a proposed testable policy, not a verified existing aggregate. No universal coverage threshold is imposed.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-repCoverage and name Check rule and message coverage. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/reports` | [apps/api/src/modules/liveOps.ts:199](../../apps/api/src/modules/liveOps.ts) |
| `GET /api/v1/rules` | [apps/api/src/modules/liveConsole.ts:104](../../apps/api/src/modules/liveConsole.ts) |

## Scenarios

1. Partial scope: six of ten rules were exercised; coverage is calculated by rule count; expected: coverage is 60% with four untested rules.
2. No rules: the denominator is zero; coverage renders; expected: it does not claim 100%.
3. Failed tests: all ten rules were exercised and two failed; coverage is displayed; expected: coverage and the 80% pass rate remain distinct.
4. Stale evidence: a rule changed after testing; coverage is reviewed; expected: the evidence revision is disclosed.

## Gherkin

```gherkin
Feature: Coverage reports

  @UC-repCoverage @AC-01 @specification
  Scenario: Partial scope
    Given six of ten rules were exercised
    When coverage is calculated by rule count
    Then coverage is 60% with four untested rules

  @UC-repCoverage @AC-02 @specification
  Scenario: No rules
    Given the denominator is zero
    When coverage renders
    Then it does not claim 100%

  @UC-repCoverage @AC-03 @specification
  Scenario: Failed tests
    Given all ten rules were exercised and two failed
    When coverage is displayed
    Then coverage and the 80% pass rate remain distinct

  @UC-repCoverage @AC-04 @specification
  Scenario: Stale evidence
    Given a rule changed after testing
    When coverage is reviewed
    Then the evidence revision is disclosed
```
