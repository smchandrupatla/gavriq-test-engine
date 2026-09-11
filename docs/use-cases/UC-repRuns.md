# See reports scoped to a specific run

- **ID:** UC-repRuns
- **Screen:** Test run reports
- **Page key:** `repRuns`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Inspect only reports associated with the selected run.

## Precondition

A run ID is selected and reports can be read.

## Trigger

Operator selects a run context.

## Success guarantee

Inspect only reports associated with the selected run. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A missing run context must not silently show unrelated reports. An unavailable report remains unavailable rather than replaced with the newest report.

## Acceptance criteria

1. **AC-01 [proposed]** Given runs A and B each have a report, when reports for A are requested, only A reports are included.
2. **AC-02 [proposed]** Given run A has no report, when its report view opens, the view states no matching report.
3. **AC-03 [proposed]** Given two runs share a label, when one run ID is selected, reports are joined by that identity.
4. **AC-04 [proposed]** Given no run is selected, when the scoped view opens, the operator must establish context before a scoped claim.

## Main flow

1. Operator selects a run context.
2. System loads available reports and filters by the run reference.
3. Operator opens a matching report.
4. System retains the run identity while displaying the evidence.

## Alternate flows

1. No matching report is a valid result.
2. All reports returns to the wider collection explicitly.

## Exception flows

1. A missing run context must not silently show unrelated reports.
2. An unavailable report remains unavailable rather than replaced with the newest report.

## Business validation

1. Names alone are not reliable run joins.
2. A reused display name must not merge historical runs.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/reports

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-repRuns",
  "screenName": "Test run reports",
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
      "assetId": "SUBMENU-rep-runs",
      "kind": "submenu",
      "name": "Test run reports",
      "label": "Test run reports",
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
      "assetId": "SUBMENU-rep-runs",
      "kind": "submenu",
      "name": "Test run reports",
      "label": "Test run reports",
      "parentAssetId": "MENU-reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-repRuns",
      "kind": "screen",
      "name": "Test run reports",
      "label": "Test run reports",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rep-runs-1",
      "flowKind": "main",
      "instruction": "Operator selects a run context.",
      "screenId": "SCR-repRuns",
      "assetIds": [
        "SCR-repRuns"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rep-runs-2",
      "flowKind": "main",
      "instruction": "System loads available reports and filters by the run reference.",
      "screenId": "SCR-repRuns",
      "assetIds": [
        "SCR-repRuns"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rep-runs-3",
      "flowKind": "main",
      "instruction": "Operator opens a matching report.",
      "screenId": "SCR-repRuns",
      "assetIds": [
        "SCR-repRuns"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rep-runs-4",
      "flowKind": "main",
      "instruction": "System retains the run identity while displaying the evidence.",
      "screenId": "SCR-repRuns",
      "assetIds": [
        "SCR-repRuns"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rep-runs-1",
      "flowKind": "alternate",
      "instruction": "No matching report is a valid result.",
      "screenId": "SCR-repRuns",
      "assetIds": [
        "SCR-repRuns"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No matching report is a valid result.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rep-runs-2",
      "flowKind": "alternate",
      "instruction": "All reports returns to the wider collection explicitly.",
      "screenId": "SCR-repRuns",
      "assetIds": [
        "SCR-repRuns"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "All reports returns to the wider collection explicitly.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rep-runs-1",
      "flowKind": "exception",
      "instruction": "A missing run context must not silently show unrelated reports.",
      "screenId": "SCR-repRuns",
      "assetIds": [
        "SCR-repRuns"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A missing run context must not silently show unrelated reports.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rep-runs-2",
      "flowKind": "exception",
      "instruction": "An unavailable report remains unavailable rather than replaced with the newest report.",
      "screenId": "SCR-repRuns",
      "assetIds": [
        "SCR-repRuns"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unavailable report remains unavailable rather than replaced with the newest report.",
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
- apps/web/public/js/preview-parts/part-06.js

### Implementation gaps and decisions

- repRuns is a historical catalogue key without a native CONFIG page; exact run filtering must be verified.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-repRuns and name See reports scoped to a specific run. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/reports` | [apps/api/src/modules/liveOps.ts:199](../../apps/api/src/modules/liveOps.ts) |

## Scenarios

1. Exact run: runs A and B each have a report; reports for A are requested; expected: only A reports are included.
2. No match: run A has no report; its report view opens; expected: the view states no matching report.
3. Duplicate labels: two runs share a label; one run ID is selected; expected: reports are joined by that identity.
4. Missing context: no run is selected; the scoped view opens; expected: the operator must establish context before a scoped claim.

## Gherkin

```gherkin
Feature: Test run reports

  @UC-repRuns @AC-01 @specification
  Scenario: Exact run
    Given runs A and B each have a report
    When reports for A are requested
    Then only A reports are included

  @UC-repRuns @AC-02 @specification
  Scenario: No match
    Given run A has no report
    When its report view opens
    Then the view states no matching report

  @UC-repRuns @AC-03 @specification
  Scenario: Duplicate labels
    Given two runs share a label
    When one run ID is selected
    Then reports are joined by that identity

  @UC-repRuns @AC-04 @specification
  Scenario: Missing context
    Given no run is selected
    When the scoped view opens
    Then the operator must establish context before a scoped claim
```
