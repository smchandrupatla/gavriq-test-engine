# Export rules for migration or backup

- **ID:** UC-ruleBenchExport
- **Screen:** Export rules
- **Page key:** `ruleBenchExport`
- **Level:** 1
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Download rule definitions with an explicit export scope and representation.

## Precondition

The operator can read rules; the library may be empty.

## Trigger

Analyst opens Export rules and reviews the available scope.

## Success guarantee

Download rule definitions with an explicit export scope and representation. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A service error must not download an error body as a valid rule pack. Unsupported XML conversion is not inferred from a prototype format column.

## Acceptance criteria

1. **AC-01 [proposed]** Given three tenant rules exist, when the current export endpoint is called, the package scope is identified as the tenant catalogue.
2. **AC-02 [proposed]** Given the service returns an error document, when download handling runs, no successful rule-pack download is claimed.
3. **AC-03 [proposed]** Given the library is empty, when export is requested, the output does not contain prototype rules.
4. **AC-04 [proposed]** Given a rule is In review, when its definition is exported, the export does not promote the rule.

## Main flow

1. Analyst opens Export rules and reviews the available scope.
2. System identifies whether the action exports all tenant rules or a supported selection.
3. Analyst requests export; the service returns the rule package.
4. System downloads the returned representation with a suitable filename.
5. Analyst checks identities and counts before reusing the package.

## Alternate flows

1. An empty catalogue produces the documented empty representation or an explicit no-data outcome.
2. A selection UI that is not honoured by the endpoint is identified as a gap.

## Exception flows

1. A service error must not download an error body as a valid rule pack.
2. Unsupported XML conversion is not inferred from a prototype format column.

## Business validation

1. Export is not promotion and does not change rule lifecycle.
2. Counts describe the package actually returned, not the current page of rows.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/rules/export

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-ruleBenchExport",
  "screenName": "Export rules",
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
      "assetId": "SUBMENU-rule-bench-export",
      "kind": "submenu",
      "name": "Export rules",
      "label": "Export rules",
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
      "assetId": "SUBMENU-rule-bench-export",
      "kind": "submenu",
      "name": "Export rules",
      "label": "Export rules",
      "parentAssetId": "MENU-rule-bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-ruleBenchExport",
      "kind": "screen",
      "name": "Export rules",
      "label": "Export rules",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rule-bench-export-1",
      "flowKind": "main",
      "instruction": "Analyst opens Export rules and reviews the available scope.",
      "screenId": "SCR-ruleBenchExport",
      "assetIds": [
        "SCR-ruleBenchExport"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rule-bench-export-2",
      "flowKind": "main",
      "instruction": "System identifies whether the action exports all tenant rules or a supported selection.",
      "screenId": "SCR-ruleBenchExport",
      "assetIds": [
        "SCR-ruleBenchExport"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rule-bench-export-3",
      "flowKind": "main",
      "instruction": "Analyst requests export; the service returns the rule package.",
      "screenId": "SCR-ruleBenchExport",
      "assetIds": [
        "SCR-ruleBenchExport"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rule-bench-export-4",
      "flowKind": "main",
      "instruction": "System downloads the returned representation with a suitable filename.",
      "screenId": "SCR-ruleBenchExport",
      "assetIds": [
        "SCR-ruleBenchExport"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-rule-bench-export-5",
      "flowKind": "main",
      "instruction": "Analyst checks identities and counts before reusing the package.",
      "screenId": "SCR-ruleBenchExport",
      "assetIds": [
        "SCR-ruleBenchExport"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rule-bench-export-1",
      "flowKind": "alternate",
      "instruction": "An empty catalogue produces the documented empty representation or an explicit no-data outcome.",
      "screenId": "SCR-ruleBenchExport",
      "assetIds": [
        "SCR-ruleBenchExport"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty catalogue produces the documented empty representation or an explicit no-data outcome.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rule-bench-export-2",
      "flowKind": "alternate",
      "instruction": "A selection UI that is not honoured by the endpoint is identified as a gap.",
      "screenId": "SCR-ruleBenchExport",
      "assetIds": [
        "SCR-ruleBenchExport"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A selection UI that is not honoured by the endpoint is identified as a gap.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rule-bench-export-1",
      "flowKind": "exception",
      "instruction": "A service error must not download an error body as a valid rule pack.",
      "screenId": "SCR-ruleBenchExport",
      "assetIds": [
        "SCR-ruleBenchExport"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A service error must not download an error body as a valid rule pack.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rule-bench-export-2",
      "flowKind": "exception",
      "instruction": "Unsupported XML conversion is not inferred from a prototype format column.",
      "screenId": "SCR-ruleBenchExport",
      "assetIds": [
        "SCR-ruleBenchExport"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unsupported XML conversion is not inferred from a prototype format column.",
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
- apps/api/src/modules/detectionRules.ts

### Implementation gaps and decisions

- GET rules/export takes no selection argument at registration; selected-set export and XML conversion remain unverified.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-ruleBenchExport and name Export rules for migration or backup. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/rules/export` | [apps/api/src/modules/liveConsole.ts:117](../../apps/api/src/modules/liveConsole.ts) |

## Scenarios

1. Whole catalogue: three tenant rules exist; the current export endpoint is called; expected: the package scope is identified as the tenant catalogue.
2. Wrong type: the service returns an error document; download handling runs; expected: no successful rule-pack download is claimed.
3. Empty export: the library is empty; export is requested; expected: the output does not contain prototype rules.
4. Lifecycle: a rule is In review; its definition is exported; expected: the export does not promote the rule.

## Gherkin

```gherkin
Feature: Export rules

  @UC-ruleBenchExport @AC-01 @specification
  Scenario: Whole catalogue
    Given three tenant rules exist
    When the current export endpoint is called
    Then the package scope is identified as the tenant catalogue

  @UC-ruleBenchExport @AC-02 @specification
  Scenario: Wrong type
    Given the service returns an error document
    When download handling runs
    Then no successful rule-pack download is claimed

  @UC-ruleBenchExport @AC-03 @specification
  Scenario: Empty export
    Given the library is empty
    When export is requested
    Then the output does not contain prototype rules

  @UC-ruleBenchExport @AC-04 @specification
  Scenario: Lifecycle
    Given a rule is In review
    When its definition is exported
    Then the export does not promote the rule
```
