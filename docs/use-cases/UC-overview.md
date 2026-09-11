# See first-run status

- **ID:** UC-overview
- **Screen:** Overview
- **Page key:** `overview`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Identify the next testing action from actual tenant activity and follow the relevant workflow.

## Precondition

The console can obtain the current session and bootstrap response; a tenant may have no saved assets.

## Trigger

Operator opens Overview; the system requests the tenant bootstrap.

## Success guarantee

Identify the next testing action from actual tenant activity and follow the relevant workflow. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A failed bootstrap is an unavailable-data state, not evidence of zero assets. An expired session requires sign-in before tenant statistics are treated as current.

## Acceptance criteria

1. **AC-01 [proposed]** Given the tenant has no runs, when Overview loads successfully, the run count is zero and the New test run link remains available.
2. **AC-02 [proposed]** Given three stored runs belong to this tenant, when the run summary is displayed, the summary uses those records rather than the preview fixture.
3. **AC-03 [proposed]** Given bootstrap returns an error, when Overview renders, an unavailable state appears instead of a fabricated successful zero count.
4. **AC-04 [proposed]** Given a summary has a configured destination, when the operator activates it by keyboard, the matching workflow opens with focus available.

## Main flow

1. Operator opens Overview; the system requests the tenant bootstrap.
2. System renders available run, message and rule counts with their observation context.
3. Operator selects a summary or attention item; the system opens its configured page.
4. Operator returns to Overview; the system refreshes available data without creating assets.

## Alternate flows

1. A genuinely empty tenant sees zero counts and creation links.
2. Operator changes the activity range where available; the displayed range must identify the data actually used.

## Exception flows

1. A failed bootstrap is an unavailable-data state, not evidence of zero assets.
2. An expired session requires sign-in before tenant statistics are treated as current.

## Business validation

1. Missing or stale metrics must not be replaced with prototype figures.
2. Coverage, accuracy and completion are different measures; each percentage needs a defined numerator and denominator.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/console/bootstrap
4. GET /api/v1/ux/first-run

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-overview",
  "screenName": "Overview",
  "navigation": {
    "menu": {
      "assetId": "MENU-workspace",
      "kind": "menu",
      "name": "Workspace",
      "label": "Workspace",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-overview",
      "kind": "submenu",
      "name": "Overview",
      "label": "Overview",
      "parentAssetId": "MENU-workspace",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-workspace",
      "kind": "menu",
      "name": "Workspace",
      "label": "Workspace",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-overview",
      "kind": "submenu",
      "name": "Overview",
      "label": "Overview",
      "parentAssetId": "MENU-workspace",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-overview",
      "kind": "screen",
      "name": "Overview",
      "label": "Overview",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-overview-1",
      "flowKind": "main",
      "instruction": "Operator opens Overview; the system requests the tenant bootstrap.",
      "screenId": "SCR-overview",
      "assetIds": [
        "SCR-overview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-overview-2",
      "flowKind": "main",
      "instruction": "System renders available run, message and rule counts with their observation context.",
      "screenId": "SCR-overview",
      "assetIds": [
        "SCR-overview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-overview-3",
      "flowKind": "main",
      "instruction": "Operator selects a summary or attention item; the system opens its configured page.",
      "screenId": "SCR-overview",
      "assetIds": [
        "SCR-overview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-overview-4",
      "flowKind": "main",
      "instruction": "Operator returns to Overview; the system refreshes available data without creating assets.",
      "screenId": "SCR-overview",
      "assetIds": [
        "SCR-overview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-overview-1",
      "flowKind": "alternate",
      "instruction": "A genuinely empty tenant sees zero counts and creation links.",
      "screenId": "SCR-overview",
      "assetIds": [
        "SCR-overview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A genuinely empty tenant sees zero counts and creation links.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-overview-2",
      "flowKind": "alternate",
      "instruction": "Operator changes the activity range where available; the displayed range must identify the data actually used.",
      "screenId": "SCR-overview",
      "assetIds": [
        "SCR-overview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Operator changes the activity range where available; the displayed range must identify the data actually used.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-overview-1",
      "flowKind": "exception",
      "instruction": "A failed bootstrap is an unavailable-data state, not evidence of zero assets.",
      "screenId": "SCR-overview",
      "assetIds": [
        "SCR-overview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed bootstrap is an unavailable-data state, not evidence of zero assets.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-overview-2",
      "flowKind": "exception",
      "instruction": "An expired session requires sign-in before tenant statistics are treated as current.",
      "screenId": "SCR-overview",
      "assetIds": [
        "SCR-overview"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An expired session requires sign-in before tenant statistics are treated as current.",
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
- apps/web/public/js/preview-parts/part-02.js
- apps/api/src/modules/liveConsole.ts

### Implementation gaps and decisions

- Preview CONFIG includes sample figures; runtime bootstrap replacement must be verified in a deployed session. No production accuracy claim is established.

### Research basis

- [W3C, WCAG 2.2 (Recommendation), keyboard, focus and status messages](https://www.w3.org/TR/WCAG22/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-overview and name See first-run status. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/console/bootstrap` | [apps/api/src/modules/liveConsole.ts:49](../../apps/api/src/modules/liveConsole.ts) |
| `GET /api/v1/ux/first-run` | [apps/api/src/modules/registerUx.ts:6](../../apps/api/src/modules/registerUx.ts) |

## Scenarios

1. Empty tenant: the tenant has no runs; Overview loads successfully; expected: the run count is zero and the New test run link remains available.
2. Live counts: three stored runs belong to this tenant; the run summary is displayed; expected: the summary uses those records rather than the preview fixture.
3. Failed load: bootstrap returns an error; Overview renders; expected: an unavailable state appears instead of a fabricated successful zero count.
4. Deep link: a summary has a configured destination; the operator activates it by keyboard; expected: the matching workflow opens with focus available.

## Gherkin

```gherkin
Feature: Overview

  @UC-overview @AC-01 @specification
  Scenario: Empty tenant
    Given the tenant has no runs
    When Overview loads successfully
    Then the run count is zero and the New test run link remains available

  @UC-overview @AC-02 @specification
  Scenario: Live counts
    Given three stored runs belong to this tenant
    When the run summary is displayed
    Then the summary uses those records rather than the preview fixture

  @UC-overview @AC-03 @specification
  Scenario: Failed load
    Given bootstrap returns an error
    When Overview renders
    Then an unavailable state appears instead of a fabricated successful zero count

  @UC-overview @AC-04 @specification
  Scenario: Deep link
    Given a summary has a configured destination
    When the operator activates it by keyboard
    Then the matching workflow opens with focus available
```
