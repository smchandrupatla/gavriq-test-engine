# Set default naming patterns

- **ID:** UC-naming
- **Screen:** Naming conventions
- **Page key:** `naming`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Preview supported naming tokens and understand what naming state is actually saved.

## Precondition

Naming defaults and sample context are available.

## Trigger

Operator opens Naming conventions.

## Success guarantee

Preview supported naming tokens and understand what naming state is actually saved. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An unsupported token must not execute code. A preview does not reserve a unique name.

## Acceptance criteria

1. **AC-01 [proposed]** Given family is pacs, when a pattern containing {family} is previewed, the supported token expands to pacs.
2. **AC-02 [proposed]** Given the pattern contains {unknown}, when preview runs, the unknown token is visible rather than silently dropped.
3. **AC-03 [proposed]** Given two users preview the same pattern, when both see a candidate name, neither preview claims to reserve that name.
4. **AC-04 [proposed]** Given a pattern contains script-like text, when preview runs, the text is not executed.

## Main flow

1. Operator opens Naming conventions.
2. System displays available definition/profile patterns.
3. Operator edits a pattern and reviews token expansion.
4. System previews the supported values without running arbitrary expressions.
5. Operator uses the resulting name only through a supported save path.

## Alternate flows

1. Unknown tokens remain visible for correction.
2. The operator may keep the existing default.

## Exception flows

1. An unsupported token must not execute code.
2. A preview does not reserve a unique name.

## Business validation

1. Sequence allocation and uniqueness need a server contract; a preview alone cannot guarantee collision freedom.
2. Name formatting is separate from a schema dialect or message identity.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/naming
4. GET /api/v1/naming-conventions
5. POST /api/v1/naming/preview

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-naming",
  "screenName": "Naming conventions",
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
      "assetId": "SUBMENU-naming",
      "kind": "submenu",
      "name": "Naming conventions",
      "label": "Naming conventions",
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
      "assetId": "SUBMENU-naming",
      "kind": "submenu",
      "name": "Naming conventions",
      "label": "Naming conventions",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-naming",
      "kind": "screen",
      "name": "Naming conventions",
      "label": "Naming conventions",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-naming-1",
      "flowKind": "main",
      "instruction": "Operator opens Naming conventions.",
      "screenId": "SCR-naming",
      "assetIds": [
        "SCR-naming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-naming-2",
      "flowKind": "main",
      "instruction": "System displays available definition/profile patterns.",
      "screenId": "SCR-naming",
      "assetIds": [
        "SCR-naming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-naming-3",
      "flowKind": "main",
      "instruction": "Operator edits a pattern and reviews token expansion.",
      "screenId": "SCR-naming",
      "assetIds": [
        "SCR-naming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-naming-4",
      "flowKind": "main",
      "instruction": "System previews the supported values without running arbitrary expressions.",
      "screenId": "SCR-naming",
      "assetIds": [
        "SCR-naming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-naming-5",
      "flowKind": "main",
      "instruction": "Operator uses the resulting name only through a supported save path.",
      "screenId": "SCR-naming",
      "assetIds": [
        "SCR-naming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-naming-1",
      "flowKind": "alternate",
      "instruction": "Unknown tokens remain visible for correction.",
      "screenId": "SCR-naming",
      "assetIds": [
        "SCR-naming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Unknown tokens remain visible for correction.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-naming-2",
      "flowKind": "alternate",
      "instruction": "The operator may keep the existing default.",
      "screenId": "SCR-naming",
      "assetIds": [
        "SCR-naming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The operator may keep the existing default.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-naming-1",
      "flowKind": "exception",
      "instruction": "An unsupported token must not execute code.",
      "screenId": "SCR-naming",
      "assetIds": [
        "SCR-naming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unsupported token must not execute code.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-naming-2",
      "flowKind": "exception",
      "instruction": "A preview does not reserve a unique name.",
      "screenId": "SCR-naming",
      "assetIds": [
        "SCR-naming"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A preview does not reserve a unique name.",
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

- apps/api/src/modules/registerSpecGaps.ts
- apps/api/src/modules/liveConsole.ts
- apps/web/public/js/preview-parts/part-06.js

### Implementation gaps and decisions

- No naming write endpoint was identified in this inventory. Durable pattern saving and concurrent sequence allocation remain unverified.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-naming and name Set default naming patterns. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/naming` | [apps/api/src/modules/registerSpecGaps.ts:52](../../apps/api/src/modules/registerSpecGaps.ts) |
| `GET /api/v1/naming-conventions` | [apps/api/src/modules/liveConsole.ts:327](../../apps/api/src/modules/liveConsole.ts) |
| `POST /api/v1/naming/preview` | [apps/api/src/modules/registerSpecGaps.ts:57](../../apps/api/src/modules/registerSpecGaps.ts) |

## Scenarios

1. Known token: family is pacs; a pattern containing {family} is previewed; expected: the supported token expands to pacs.
2. Unknown token: the pattern contains {unknown}; preview runs; expected: the unknown token is visible rather than silently dropped.
3. No reservation: two users preview the same pattern; both see a candidate name; expected: neither preview claims to reserve that name.
4. No script: a pattern contains script-like text; preview runs; expected: the text is not executed.

## Gherkin

```gherkin
Feature: Naming conventions

  @UC-naming @AC-01 @specification
  Scenario: Known token
    Given family is pacs
    When a pattern containing {family} is previewed
    Then the supported token expands to pacs

  @UC-naming @AC-02 @specification
  Scenario: Unknown token
    Given the pattern contains {unknown}
    When preview runs
    Then the unknown token is visible rather than silently dropped

  @UC-naming @AC-03 @specification
  Scenario: No reservation
    Given two users preview the same pattern
    When both see a candidate name
    Then neither preview claims to reserve that name

  @UC-naming @AC-04 @specification
  Scenario: No script
    Given a pattern contains script-like text
    When preview runs
    Then the text is not executed
```
