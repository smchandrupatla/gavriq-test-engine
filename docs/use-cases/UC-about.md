# Understand what Sand Bench is for

- **ID:** UC-about
- **Screen:** About
- **Page key:** `about`
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Understand the product scope and return to the testing workspace.

## Precondition

The static About page is reachable.

## Trigger

Operator opens About.

## Success guarantee

Understand the product scope and return to the testing workspace. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A failed static load is not replaced with unrelated marketing content.

## Acceptance criteria

1. **AC-01 [proposed]** Given About loads, when the operator reads it, the product is described consistently with its sandbox scope.
2. **AC-02 [proposed]** Given the console link is present, when it is activated, the workspace is reachable.
3. **AC-03 [proposed]** Given no measured production results exist, when About is reviewed, no invented production metric appears.

## Main flow

1. Operator opens About.
2. System displays the product purpose and scope.
3. Operator follows the console link to begin work.

## Alternate flows

1. The page can be read independently of a tenant session.

## Exception flows

1. A failed static load is not replaced with unrelated marketing content.

## Business validation

1. Sandbox/synthetic positioning must remain consistent with the not-production notice.
2. No fabricated performance or compliance claim is added.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-about",
  "screenName": "About",
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
      "assetId": "SUBMENU-about",
      "kind": "submenu",
      "name": "About",
      "label": "About",
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
      "assetId": "SUBMENU-about",
      "kind": "submenu",
      "name": "About",
      "label": "About",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-about",
      "kind": "screen",
      "name": "About",
      "label": "About",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-about-1",
      "flowKind": "main",
      "instruction": "Operator opens About.",
      "screenId": "SCR-about",
      "assetIds": [
        "SCR-about"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-about-2",
      "flowKind": "main",
      "instruction": "System displays the product purpose and scope.",
      "screenId": "SCR-about",
      "assetIds": [
        "SCR-about"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-about-3",
      "flowKind": "main",
      "instruction": "Operator follows the console link to begin work.",
      "screenId": "SCR-about",
      "assetIds": [
        "SCR-about"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-about-1",
      "flowKind": "alternate",
      "instruction": "The page can be read independently of a tenant session.",
      "screenId": "SCR-about",
      "assetIds": [
        "SCR-about"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The page can be read independently of a tenant session.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-about-1",
      "flowKind": "exception",
      "instruction": "A failed static load is not replaced with unrelated marketing content.",
      "screenId": "SCR-about",
      "assetIds": [
        "SCR-about"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed static load is not replaced with unrelated marketing content.",
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

- apps/web/public/about.html
- apps/web/public/not-production.html

### Implementation gaps and decisions

- Static content is not tenant-specific operational evidence.

### Research basis

- [W3C, WCAG 2.2 (Recommendation), keyboard, focus and status messages](https://www.w3.org/TR/WCAG22/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-about and name Understand what Sand Bench is for. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Scope: About loads; the operator reads it; expected: the product is described consistently with its sandbox scope.
2. Return: the console link is present; it is activated; expected: the workspace is reachable.
3. No metrics: no measured production results exist; About is reviewed; expected: no invented production metric appears.

## Gherkin

```gherkin
Feature: About

  @UC-about @AC-01 @specification
  Scenario: Scope
    Given About loads
    When the operator reads it
    Then the product is described consistently with its sandbox scope

  @UC-about @AC-02 @specification
  Scenario: Return
    Given the console link is present
    When it is activated
    Then the workspace is reachable

  @UC-about @AC-03 @specification
  Scenario: No metrics
    Given no measured production results exist
    When About is reviewed
    Then no invented production metric appears
```
