# See every imported and published scheme

- **ID:** UC-msgSchemaRegister
- **Screen:** Schema register
- **Page key:** `msgSchemaRegister`
- **Level:** 2
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Locate an imported or published schema and assess whether it can be reused.

## Precondition

The catalogue and upload summaries are available.

## Trigger

Analyst opens Schema register.

## Success guarantee

Locate an imported or published schema and assess whether it can be reused. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A stale ready entry is checked when opened. A failed collection load must not be reported as successful emptiness.

## Acceptance criteria

1. **AC-01 [proposed]** Given a usable entry is present, when it is selected for reuse, the handoff uses its identity.
2. **AC-02 [proposed]** Given an entry has zero parsed fields, when its state renders, the limitation is disclosed.
3. **AC-03 [proposed]** Given two versions share a code, when register rows are combined, version loss is identified rather than silently claimed correct.
4. **AC-04 [proposed]** Given both sources return no entries, when the register opens, import or creation guidance is shown.

## Main flow

1. Analyst opens Schema register.
2. System loads upload and designer-type information.
3. Analyst reviews code, family, state and available field count.
4. Analyst selects a usable entry and requests the designer handoff.

## Alternate flows

1. No entries prompts import or creation.
2. A not-ready entry remains visible with its limitation.

## Exception flows

1. A stale ready entry is checked when opened.
2. A failed collection load must not be reported as successful emptiness.

## Business validation

1. Readiness from nonzero fields is an implementation heuristic, not standards conformance.
2. Version identity must not be lost when entries share a code.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/catalog/iso/uploads
4. GET /api/v1/catalog/designer-types

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-msgSchemaRegister",
  "screenName": "Schema register",
  "navigation": {
    "menu": {
      "assetId": "MENU-message-designer",
      "kind": "menu",
      "name": "Message Designer",
      "label": "Message Designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-msg-schema-register",
      "kind": "submenu",
      "name": "Schema register",
      "label": "Schema register",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-message-designer",
      "kind": "menu",
      "name": "Message Designer",
      "label": "Message Designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-msg-schema-register",
      "kind": "submenu",
      "name": "Schema register",
      "label": "Schema register",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-msgSchemaRegister",
      "kind": "screen",
      "name": "Schema register",
      "label": "Schema register",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-msg-schema-register-1",
      "flowKind": "main",
      "instruction": "Analyst opens Schema register.",
      "screenId": "SCR-msgSchemaRegister",
      "assetIds": [
        "SCR-msgSchemaRegister"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-msg-schema-register-2",
      "flowKind": "main",
      "instruction": "System loads upload and designer-type information.",
      "screenId": "SCR-msgSchemaRegister",
      "assetIds": [
        "SCR-msgSchemaRegister"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-msg-schema-register-3",
      "flowKind": "main",
      "instruction": "Analyst reviews code, family, state and available field count.",
      "screenId": "SCR-msgSchemaRegister",
      "assetIds": [
        "SCR-msgSchemaRegister"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-msg-schema-register-4",
      "flowKind": "main",
      "instruction": "Analyst selects a usable entry and requests the designer handoff.",
      "screenId": "SCR-msgSchemaRegister",
      "assetIds": [
        "SCR-msgSchemaRegister"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-msg-schema-register-1",
      "flowKind": "alternate",
      "instruction": "No entries prompts import or creation.",
      "screenId": "SCR-msgSchemaRegister",
      "assetIds": [
        "SCR-msgSchemaRegister"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No entries prompts import or creation.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-msg-schema-register-2",
      "flowKind": "alternate",
      "instruction": "A not-ready entry remains visible with its limitation.",
      "screenId": "SCR-msgSchemaRegister",
      "assetIds": [
        "SCR-msgSchemaRegister"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A not-ready entry remains visible with its limitation.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-msg-schema-register-1",
      "flowKind": "exception",
      "instruction": "A stale ready entry is checked when opened.",
      "screenId": "SCR-msgSchemaRegister",
      "assetIds": [
        "SCR-msgSchemaRegister"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A stale ready entry is checked when opened.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-msg-schema-register-2",
      "flowKind": "exception",
      "instruction": "A failed collection load must not be reported as successful emptiness.",
      "screenId": "SCR-msgSchemaRegister",
      "assetIds": [
        "SCR-msgSchemaRegister"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed collection load must not be reported as successful emptiness.",
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

- apps/web/public/js/live-bind-parts/part-08.js
- apps/api/src/modules/registerIsoCatalog.ts

### Implementation gaps and decisions

- Existing code-based de-duplication needs a version policy. Scalar-schema readiness is proposed, not established by nonzero field count.

### Research basis

- [JSON Schema, Draft 2020-12 Validation vocabulary, sections 6, 7 and 9](https://json-schema.org/draft/2020-12/json-schema-validation)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-msgSchemaRegister and name See every imported and published scheme. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/catalog/iso/uploads` | [apps/api/src/modules/registerIsoCatalog.ts:233](../../apps/api/src/modules/registerIsoCatalog.ts) |
| `GET /api/v1/catalog/designer-types` | [apps/api/src/modules/registerIsoCatalog.ts:281](../../apps/api/src/modules/registerIsoCatalog.ts) |

## Scenarios

1. Ready entry: a usable entry is present; it is selected for reuse; expected: the handoff uses its identity.
2. No parsed fields: an entry has zero parsed fields; its state renders; expected: the limitation is disclosed.
3. Duplicate code: two versions share a code; register rows are combined; expected: version loss is identified rather than silently claimed correct.
4. Empty register: both sources return no entries; the register opens; expected: import or creation guidance is shown.

## Gherkin

```gherkin
Feature: Schema register

  @UC-msgSchemaRegister @AC-01 @specification
  Scenario: Ready entry
    Given a usable entry is present
    When it is selected for reuse
    Then the handoff uses its identity

  @UC-msgSchemaRegister @AC-02 @specification
  Scenario: No parsed fields
    Given an entry has zero parsed fields
    When its state renders
    Then the limitation is disclosed

  @UC-msgSchemaRegister @AC-03 @specification
  Scenario: Duplicate code
    Given two versions share a code
    When register rows are combined
    Then version loss is identified rather than silently claimed correct

  @UC-msgSchemaRegister @AC-04 @specification
  Scenario: Empty register
    Given both sources return no entries
    When the register opens
    Then import or creation guidance is shown
```
