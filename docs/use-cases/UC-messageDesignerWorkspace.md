# Generate test data from the definition

- **ID:** UC-messageDesignerWorkspace
- **Screen:** Generate test data
- **Page key:** `messageDesignerWorkspace`
- **Level:** 2
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Save a reviewed definition and generate inspectable synthetic messages from its selected fields.

## Precondition

The workspace has a selected schema and field set from the wizard or a source handoff.

## Trigger

System displays the selected schema and fields; analyst enters a definition name.

## Success guarantee

Save a reviewed definition and generate inspectable synthetic messages from its selected fields. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Preview failure is not a saved batch. Partial or uncertain saving reports the known result without claiming every requested message persisted.

## Acceptance criteria

1. **AC-01 [proposed]** Given a definition is selected, when a preview is generated, no saved-message result is claimed until an explicit save.
2. **AC-02 [proposed]** Given 500 messages were requested and 498 confirmed saved, when the result is displayed, 498 is the saved count and the shortfall is visible.
3. **AC-03 [proposed]** Given bad-data generation is selected, when the preview is created, intentional invalid values are labelled.
4. **AC-04 [proposed]** Given messages were saved, when no send action was requested, the screen does not claim delivery.

## Main flow

1. System displays the selected schema and fields; analyst enters a definition name.
2. Analyst explicitly saves the definition; system reports its stored identity.
3. Analyst chooses generation settings and requests a preview.
4. System displays generated content and applicable findings.
5. Analyst explicitly saves generated messages or requests a separate delivery.
6. System distinguishes the definition, generated batch and delivery outcomes.

## Alternate flows

1. Single and multiple generation have separate count settings.
2. Adversarial generation intentionally violates selected constraints and is labelled as such.

## Exception flows

1. Preview failure is not a saved batch.
2. Partial or uncertain saving reports the known result without claiming every requested message persisted.

## Business validation

1. Requested count and persisted count are separate.
2. Generated synthetic data is not proof that the receiving system accepted it.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/message-types
4. POST /api/v1/definitions
5. POST /api/v1/definitions/preview
6. POST /api/v1/definitions/randomize
7. POST /api/v1/generated-messages

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-messageDesignerWorkspace",
  "screenName": "Generate test data",
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
      "assetId": "SUBMENU-message-designer-workspace",
      "kind": "submenu",
      "name": "Generate test data",
      "label": "Generate test data",
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
      "assetId": "SUBMENU-message-designer-workspace",
      "kind": "submenu",
      "name": "Generate test data",
      "label": "Generate test data",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-messageDesignerWorkspace",
      "kind": "screen",
      "name": "Generate test data",
      "label": "Generate test data",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-message-designer-workspace-1",
      "flowKind": "main",
      "instruction": "System displays the selected schema and fields; analyst enters a definition name.",
      "screenId": "SCR-messageDesignerWorkspace",
      "assetIds": [
        "SCR-messageDesignerWorkspace"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-message-designer-workspace-2",
      "flowKind": "main",
      "instruction": "Analyst explicitly saves the definition; system reports its stored identity.",
      "screenId": "SCR-messageDesignerWorkspace",
      "assetIds": [
        "SCR-messageDesignerWorkspace"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-message-designer-workspace-3",
      "flowKind": "main",
      "instruction": "Analyst chooses generation settings and requests a preview.",
      "screenId": "SCR-messageDesignerWorkspace",
      "assetIds": [
        "SCR-messageDesignerWorkspace"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-message-designer-workspace-4",
      "flowKind": "main",
      "instruction": "System displays generated content and applicable findings.",
      "screenId": "SCR-messageDesignerWorkspace",
      "assetIds": [
        "SCR-messageDesignerWorkspace"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-message-designer-workspace-5",
      "flowKind": "main",
      "instruction": "Analyst explicitly saves generated messages or requests a separate delivery.",
      "screenId": "SCR-messageDesignerWorkspace",
      "assetIds": [
        "SCR-messageDesignerWorkspace"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 6,
      "flowId": "MAIN-message-designer-workspace-6",
      "flowKind": "main",
      "instruction": "System distinguishes the definition, generated batch and delivery outcomes.",
      "screenId": "SCR-messageDesignerWorkspace",
      "assetIds": [
        "SCR-messageDesignerWorkspace"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-message-designer-workspace-1",
      "flowKind": "alternate",
      "instruction": "Single and multiple generation have separate count settings.",
      "screenId": "SCR-messageDesignerWorkspace",
      "assetIds": [
        "SCR-messageDesignerWorkspace"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Single and multiple generation have separate count settings.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-message-designer-workspace-2",
      "flowKind": "alternate",
      "instruction": "Adversarial generation intentionally violates selected constraints and is labelled as such.",
      "screenId": "SCR-messageDesignerWorkspace",
      "assetIds": [
        "SCR-messageDesignerWorkspace"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Adversarial generation intentionally violates selected constraints and is labelled as such.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-message-designer-workspace-1",
      "flowKind": "exception",
      "instruction": "Preview failure is not a saved batch.",
      "screenId": "SCR-messageDesignerWorkspace",
      "assetIds": [
        "SCR-messageDesignerWorkspace"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Preview failure is not a saved batch.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-message-designer-workspace-2",
      "flowKind": "exception",
      "instruction": "Partial or uncertain saving reports the known result without claiming every requested message persisted.",
      "screenId": "SCR-messageDesignerWorkspace",
      "assetIds": [
        "SCR-messageDesignerWorkspace"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Partial or uncertain saving reports the known result without claiming every requested message persisted.",
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

- apps/web/public/js/preview-parts/part-05.js
- apps/api/src/app.ts
- apps/api/src/modules/registerSpecPersist.ts

### Implementation gaps and decisions

- Duplicate-name policy, full selected-field persistence and generation reproducibility need explicit acceptance evidence.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)
- [JSON Schema, Draft 2020-12 Validation vocabulary, sections 6, 7 and 9](https://json-schema.org/draft/2020-12/json-schema-validation)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-messageDesignerWorkspace and name Generate test data from the definition. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/message-types` | [apps/api/src/app.ts:390](../../apps/api/src/app.ts) |
| `POST /api/v1/definitions` | [apps/api/src/modules/registerSpecPersist.ts:48](../../apps/api/src/modules/registerSpecPersist.ts) |
| `POST /api/v1/definitions/preview` | [apps/api/src/app.ts:490](../../apps/api/src/app.ts) |
| `POST /api/v1/definitions/randomize` | [apps/api/src/modules/registerSpecMissing.ts:34](../../apps/api/src/modules/registerSpecMissing.ts) |
| `POST /api/v1/generated-messages` | [apps/api/src/app.ts:502](../../apps/api/src/app.ts) |

## Scenarios

1. Preview only: a definition is selected; a preview is generated; expected: no saved-message result is claimed until an explicit save.
2. Persisted count: 500 messages were requested and 498 confirmed saved; the result is displayed; expected: 498 is the saved count and the shortfall is visible.
3. Adversarial values: bad-data generation is selected; the preview is created; expected: intentional invalid values are labelled.
4. Separate delivery: messages were saved; no send action was requested; expected: the screen does not claim delivery.

## Gherkin

```gherkin
Feature: Generate test data

  @UC-messageDesignerWorkspace @AC-01 @specification
  Scenario: Preview only
    Given a definition is selected
    When a preview is generated
    Then no saved-message result is claimed until an explicit save

  @UC-messageDesignerWorkspace @AC-02 @specification
  Scenario: Persisted count
    Given 500 messages were requested and 498 confirmed saved
    When the result is displayed
    Then 498 is the saved count and the shortfall is visible

  @UC-messageDesignerWorkspace @AC-03 @specification
  Scenario: Adversarial values
    Given bad-data generation is selected
    When the preview is created
    Then intentional invalid values are labelled

  @UC-messageDesignerWorkspace @AC-04 @specification
  Scenario: Separate delivery
    Given messages were saved
    When no send action was requested
    Then the screen does not claim delivery
```
