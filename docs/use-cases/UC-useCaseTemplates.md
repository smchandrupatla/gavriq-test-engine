# Use-case templates

- **ID:** UC-useCaseTemplates
- **Screen:** Use-case templates
- **Page key:** `useCaseTemplates`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Download a reusable Markdown use-case template with the agreed structure.

## Precondition

The configuration template page can load.

## Trigger

Author opens Use-case templates.

## Success guarantee

Download a reusable Markdown use-case template with the agreed structure. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A blocked download must not be described as completed. A template with missing sections is a documentation defect.

## Acceptance criteria

1. **AC-01 [proposed]** Given the template is downloaded, when its headings are inspected, Goal through Gherkin follow the agreed top-level order.
2. **AC-02 [proposed]** Given the template is downloaded, when metadata is inspected, ID, Screen, Level, Style, Actor and Extends fields exist.
3. **AC-03 [proposed]** Given the Extends placeholders are read, when the author fills the template, they describe relationships rather than first and last steps.
4. **AC-04 [proposed]** Given a template is downloaded, when the catalogue is inspected, no use-case record was created by downloading.

## Main flow

1. Author opens Use-case templates.
2. System presents the available canonical template.
3. Author selects Download use-case template.
4. System downloads Markdown with metadata and all required sections.

## Alternate flows

1. The author leaves without downloading.
2. The downloaded template can be used for an unlinked use case.

## Exception flows

1. A blocked download must not be described as completed.
2. A template with missing sections is a documentation defect.

## Business validation

1. Extends relationships are not wizard order or first/last-step markers.
2. A template is a specification aid, not a passed implementation test.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-useCaseTemplates",
  "screenName": "Use-case templates",
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
      "assetId": "SUBMENU-use-case-templates",
      "kind": "submenu",
      "name": "Use-case templates",
      "label": "Use-case templates",
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
      "assetId": "SUBMENU-use-case-templates",
      "kind": "submenu",
      "name": "Use-case templates",
      "label": "Use-case templates",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-useCaseTemplates",
      "kind": "screen",
      "name": "Use-case templates",
      "label": "Use-case templates",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-use-case-templates-1",
      "flowKind": "main",
      "instruction": "Author opens Use-case templates.",
      "screenId": "SCR-useCaseTemplates",
      "assetIds": [
        "SCR-useCaseTemplates"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-use-case-templates-2",
      "flowKind": "main",
      "instruction": "System presents the available canonical template.",
      "screenId": "SCR-useCaseTemplates",
      "assetIds": [
        "SCR-useCaseTemplates"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-use-case-templates-3",
      "flowKind": "main",
      "instruction": "Author selects Download use-case template.",
      "screenId": "SCR-useCaseTemplates",
      "assetIds": [
        "SCR-useCaseTemplates"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-use-case-templates-4",
      "flowKind": "main",
      "instruction": "System downloads Markdown with metadata and all required sections.",
      "screenId": "SCR-useCaseTemplates",
      "assetIds": [
        "SCR-useCaseTemplates"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-use-case-templates-1",
      "flowKind": "alternate",
      "instruction": "The author leaves without downloading.",
      "screenId": "SCR-useCaseTemplates",
      "assetIds": [
        "SCR-useCaseTemplates"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The author leaves without downloading.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-use-case-templates-2",
      "flowKind": "alternate",
      "instruction": "The downloaded template can be used for an unlinked use case.",
      "screenId": "SCR-useCaseTemplates",
      "assetIds": [
        "SCR-useCaseTemplates"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The downloaded template can be used for an unlinked use case.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-use-case-templates-1",
      "flowKind": "exception",
      "instruction": "A blocked download must not be described as completed.",
      "screenId": "SCR-useCaseTemplates",
      "assetIds": [
        "SCR-useCaseTemplates"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A blocked download must not be described as completed.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-use-case-templates-2",
      "flowKind": "exception",
      "instruction": "A template with missing sections is a documentation defect.",
      "screenId": "SCR-useCaseTemplates",
      "assetIds": [
        "SCR-useCaseTemplates"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A template with missing sections is a documentation defect.",
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

- apps/web/public/js/preview-parts/part-06.js

### Implementation gaps and decisions

- The previous template incorrectly described extends as sequence; this documentation change corrects that text.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-useCaseTemplates and name Use-case templates. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Section order: the template is downloaded; its headings are inspected; expected: Goal through Gherkin follow the agreed top-level order.
2. Metadata: the template is downloaded; metadata is inspected; expected: ID, Screen, Level, Style, Actor and Extends fields exist.
3. No sequencing: the Extends placeholders are read; the author fills the template; expected: they describe relationships rather than first and last steps.
4. No write: a template is downloaded; the catalogue is inspected; expected: no use-case record was created by downloading.

## Gherkin

```gherkin
Feature: Use-case templates

  @UC-useCaseTemplates @AC-01 @specification
  Scenario: Section order
    Given the template is downloaded
    When its headings are inspected
    Then Goal through Gherkin follow the agreed top-level order

  @UC-useCaseTemplates @AC-02 @specification
  Scenario: Metadata
    Given the template is downloaded
    When metadata is inspected
    Then ID, Screen, Level, Style, Actor and Extends fields exist

  @UC-useCaseTemplates @AC-03 @specification
  Scenario: No sequencing
    Given the Extends placeholders are read
    When the author fills the template
    Then they describe relationships rather than first and last steps

  @UC-useCaseTemplates @AC-04 @specification
  Scenario: No write
    Given a template is downloaded
    When the catalogue is inspected
    Then no use-case record was created by downloading
```
