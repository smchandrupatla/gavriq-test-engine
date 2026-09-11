# Use case

- **ID:** UC-useCaseEditor
- **Screen:** Use case
- **Page key:** `useCaseEditor`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Read, revise and download a use-case specification while preserving its identity and review context.

## Precondition

A catalogue page key is supplied to the standalone use-case editor.

## Trigger

Author opens the use-case link for a page.

## Success guarantee

Read, revise and download a use-case specification while preserving its identity and review context. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An unknown key is not replaced with Overview. Failed saving is not a confirmed new revision.

## Acceptance criteria

1. **AC-01 [proposed]** Given UC-tcNew is opened, when the author edits its goal, the case ID remains UC-tcNew.
2. **AC-02 [proposed]** Given a case has detailed notes and a contract, when Markdown is downloaded, notes and parseable contract JSON are included.
3. **AC-03 [proposed]** Given the requested page is unknown, when the editor loads, a missing-case error replaces unrelated content.
4. **AC-04 [proposed]** Given the PUT fails, when the editor handles it, no successful revision is claimed.

## Main flow

1. Author opens the use-case link for a page.
2. System loads its specification, contract and available revision history.
3. Author reviews identity, flows, criteria and notes.
4. Author saves an intentional revision through the use-case API.
5. System confirms the revision; author downloads the complete Markdown when needed.

## Alternate flows

1. Read or download without editing.
2. An unlinked catalogue case can be opened by its page key.

## Exception flows

1. An unknown key is not replaced with Overview.
2. Failed saving is not a confirmed new revision.

## Business validation

1. Stable case identity is retained across edits.
2. Tenant edits must not be overwritten automatically by a seed documentation refresh.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/use-cases/:page
4. PUT /api/v1/use-cases/:page
5. GET /api/v1/use-cases/:page/revisions
6. GET /api/v1/use-cases/:page.md

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-useCaseEditor",
  "screenName": "Use case",
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
      "assetId": "SUBMENU-use-case-editor",
      "kind": "submenu",
      "name": "Use case",
      "label": "Use case",
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
      "assetId": "SUBMENU-use-case-editor",
      "kind": "submenu",
      "name": "Use case",
      "label": "Use case",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-useCaseEditor",
      "kind": "screen",
      "name": "Use case",
      "label": "Use case",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "additional-notes",
      "kind": "control",
      "name": "Additional notes",
      "label": "Additional notes",
      "selector": "#additional-notes",
      "sourceFile": "apps/web/public/use-case.html",
      "parentAssetId": "SCR-useCaseEditor",
      "source": "screen-source",
      "verification": "verified"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-use-case-editor-1",
      "flowKind": "main",
      "instruction": "Author opens the use-case link for a page.",
      "screenId": "SCR-useCaseEditor",
      "assetIds": [
        "SCR-useCaseEditor"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-use-case-editor-2",
      "flowKind": "main",
      "instruction": "System loads its specification, contract and available revision history.",
      "screenId": "SCR-useCaseEditor",
      "assetIds": [
        "SCR-useCaseEditor"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-use-case-editor-3",
      "flowKind": "main",
      "instruction": "Author reviews identity, flows, criteria and notes.",
      "screenId": "SCR-useCaseEditor",
      "assetIds": [
        "SCR-useCaseEditor"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-use-case-editor-4",
      "flowKind": "main",
      "instruction": "Author saves an intentional revision through the use-case API.",
      "screenId": "SCR-useCaseEditor",
      "assetIds": [
        "SCR-useCaseEditor"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-use-case-editor-5",
      "flowKind": "main",
      "instruction": "System confirms the revision; author downloads the complete Markdown when needed.",
      "screenId": "SCR-useCaseEditor",
      "assetIds": [
        "SCR-useCaseEditor"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-use-case-editor-1",
      "flowKind": "alternate",
      "instruction": "Read or download without editing.",
      "screenId": "SCR-useCaseEditor",
      "assetIds": [
        "SCR-useCaseEditor"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Read or download without editing.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-use-case-editor-2",
      "flowKind": "alternate",
      "instruction": "An unlinked catalogue case can be opened by its page key.",
      "screenId": "SCR-useCaseEditor",
      "assetIds": [
        "SCR-useCaseEditor"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unlinked catalogue case can be opened by its page key.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-use-case-editor-1",
      "flowKind": "exception",
      "instruction": "An unknown key is not replaced with Overview.",
      "screenId": "SCR-useCaseEditor",
      "assetIds": [
        "SCR-useCaseEditor"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unknown key is not replaced with Overview.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-use-case-editor-2",
      "flowKind": "exception",
      "instruction": "Failed saving is not a confirmed new revision.",
      "screenId": "SCR-useCaseEditor",
      "assetIds": [
        "SCR-useCaseEditor"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Failed saving is not a confirmed new revision.",
      "backgroundEvents": []
    }
  ],
  "auditActions": [],
  "events": [],
  "backgroundEvents": [],
  "provenance": "mixed"
}
```

### Additional notes

### Source evidence

- apps/web/public/use-case.html
- apps/api/src/modules/registerUseCases.ts

### Implementation gaps and decisions

- The existing DB seed is insert-only: updated defaults do not overwrite tenant revisions. Concurrency and historical seed migration remain explicit operational decisions.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)
- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-useCaseEditor and name Use case. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/use-cases/:page` | [apps/api/src/modules/registerUseCases.ts:324](../../apps/api/src/modules/registerUseCases.ts) |
| `PUT /api/v1/use-cases/:page` | [apps/api/src/modules/registerUseCases.ts:355](../../apps/api/src/modules/registerUseCases.ts) |
| `GET /api/v1/use-cases/:page/revisions` | [apps/api/src/modules/registerUseCases.ts:341](../../apps/api/src/modules/registerUseCases.ts) |
| `GET /api/v1/use-cases/:page.md` | [apps/api/src/modules/registerUseCases.ts:304](../../apps/api/src/modules/registerUseCases.ts) |

## Scenarios

1. Identity: UC-tcNew is opened; the author edits its goal; expected: the case ID remains UC-tcNew.
2. Complete download: a case has detailed notes and a contract; Markdown is downloaded; expected: notes and parseable contract JSON are included.
3. Missing key: the requested page is unknown; the editor loads; expected: a missing-case error replaces unrelated content.
4. Save failure: the PUT fails; the editor handles it; expected: no successful revision is claimed.

## Gherkin

```gherkin
Feature: Use case

  @UC-useCaseEditor @AC-01 @specification
  Scenario: Identity
    Given UC-tcNew is opened
    When the author edits its goal
    Then the case ID remains UC-tcNew

  @UC-useCaseEditor @AC-02 @specification
  Scenario: Complete download
    Given a case has detailed notes and a contract
    When Markdown is downloaded
    Then notes and parseable contract JSON are included

  @UC-useCaseEditor @AC-03 @specification
  Scenario: Missing key
    Given the requested page is unknown
    When the editor loads
    Then a missing-case error replaces unrelated content

  @UC-useCaseEditor @AC-04 @specification
  Scenario: Save failure
    Given the PUT fails
    When the editor handles it
    Then no successful revision is claimed
```
