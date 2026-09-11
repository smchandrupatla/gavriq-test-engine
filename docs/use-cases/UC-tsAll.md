# Manage every test suite

- **ID:** UC-tsAll
- **Screen:** Test Suites
- **Page key:** `tsAll`
- **Level:** 1
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Inspect suite membership and request supported execution or maintenance without overstating completion.

## Precondition

The analyst can read suites; zero suites is valid.

## Trigger

Analyst opens Test Suites; system loads suite records.

## Success guarantee

Inspect suite membership and request supported execution or maintenance without overstating completion. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A stale If-Match on update or deletion is rejected. A removed member must not be silently counted as an executed case.

## Acceptance criteria

1. **AC-01 [proposed]** Given a suite contains three distinct case IDs, when it is inspected, the membership count is three.
2. **AC-02 [proposed]** Given the run endpoint returns 202 and a job ID, when the response is displayed, it is described as accepted rather than passed.
3. **AC-03 [proposed]** Given a suite groups existing cases, when the suite is deleted, the case definitions are not deleted by that grouping action.
4. **AC-04 [proposed]** Given a suite has zero members, when it is listed, it shows zero without a fabricated pass result.

## Main flow

1. Analyst opens Test Suites; system loads suite records.
2. Analyst opens a suite and inspects its member case IDs.
3. Analyst requests a supported run, edit or deletion.
4. System reports the specific request result.
5. Analyst checks actual run evidence separately from request acceptance.

## Alternate flows

1. An empty suite remains visible with zero members.
2. Deleting a suite removes the grouping, not the test-case definitions.

## Exception flows

1. A stale If-Match on update or deletion is rejected.
2. A removed member must not be silently counted as an executed case.

## Business validation

1. An accepted run request is not a completed suite run.
2. Membership count is not pass count.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/test-suites
4. POST /api/v1/test-suites/:id/run
5. DELETE /api/v1/test-suites/:id

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-tsAll",
  "screenName": "Test Suites",
  "navigation": {
    "menu": {
      "assetId": "MENU-test-suites",
      "kind": "menu",
      "name": "Test Suites",
      "label": "Test Suites",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-ts-all",
      "kind": "submenu",
      "name": "Test Suites",
      "label": "Test Suites",
      "parentAssetId": "MENU-test-suites",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-test-suites",
      "kind": "menu",
      "name": "Test Suites",
      "label": "Test Suites",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-ts-all",
      "kind": "submenu",
      "name": "Test Suites",
      "label": "Test Suites",
      "parentAssetId": "MENU-test-suites",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-tsAll",
      "kind": "screen",
      "name": "Test Suites",
      "label": "Test Suites",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-ts-all-1",
      "flowKind": "main",
      "instruction": "Analyst opens Test Suites; system loads suite records.",
      "screenId": "SCR-tsAll",
      "assetIds": [
        "SCR-tsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-ts-all-2",
      "flowKind": "main",
      "instruction": "Analyst opens a suite and inspects its member case IDs.",
      "screenId": "SCR-tsAll",
      "assetIds": [
        "SCR-tsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-ts-all-3",
      "flowKind": "main",
      "instruction": "Analyst requests a supported run, edit or deletion.",
      "screenId": "SCR-tsAll",
      "assetIds": [
        "SCR-tsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-ts-all-4",
      "flowKind": "main",
      "instruction": "System reports the specific request result.",
      "screenId": "SCR-tsAll",
      "assetIds": [
        "SCR-tsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-ts-all-5",
      "flowKind": "main",
      "instruction": "Analyst checks actual run evidence separately from request acceptance.",
      "screenId": "SCR-tsAll",
      "assetIds": [
        "SCR-tsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-ts-all-1",
      "flowKind": "alternate",
      "instruction": "An empty suite remains visible with zero members.",
      "screenId": "SCR-tsAll",
      "assetIds": [
        "SCR-tsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty suite remains visible with zero members.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-ts-all-2",
      "flowKind": "alternate",
      "instruction": "Deleting a suite removes the grouping, not the test-case definitions.",
      "screenId": "SCR-tsAll",
      "assetIds": [
        "SCR-tsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Deleting a suite removes the grouping, not the test-case definitions.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-ts-all-1",
      "flowKind": "exception",
      "instruction": "A stale If-Match on update or deletion is rejected.",
      "screenId": "SCR-tsAll",
      "assetIds": [
        "SCR-tsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A stale If-Match on update or deletion is rejected.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-ts-all-2",
      "flowKind": "exception",
      "instruction": "A removed member must not be silently counted as an executed case.",
      "screenId": "SCR-tsAll",
      "assetIds": [
        "SCR-tsAll"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A removed member must not be silently counted as an executed case.",
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

- apps/api/src/modules/registerTestSuites.ts
- apps/api/src/modules/registerSpecPersist.ts
- apps/api/src/modules/collections.ts

### Implementation gaps and decisions

- The registered suite-run handler returns generated IDs but does not invoke an engine or persist a run. Execution is a product gap.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)
- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-tsAll and name Manage every test suite. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/test-suites` | [apps/api/src/modules/registerTestSuites.ts:19](../../apps/api/src/modules/registerTestSuites.ts) |
| `POST /api/v1/test-suites/:id/run` | [apps/api/src/modules/registerSpecPersist.ts:92](../../apps/api/src/modules/registerSpecPersist.ts) |
| `DELETE /api/v1/test-suites/:id` | [apps/api/src/modules/registerTestSuites.ts:56](../../apps/api/src/modules/registerTestSuites.ts) |

## Scenarios

1. Membership: a suite contains three distinct case IDs; it is inspected; expected: the membership count is three.
2. Accepted only: the run endpoint returns 202 and a job ID; the response is displayed; expected: it is described as accepted rather than passed.
3. Delete grouping: a suite groups existing cases; the suite is deleted; expected: the case definitions are not deleted by that grouping action.
4. Empty suite: a suite has zero members; it is listed; expected: it shows zero without a fabricated pass result.

## Gherkin

```gherkin
Feature: Test Suites

  @UC-tsAll @AC-01 @specification
  Scenario: Membership
    Given a suite contains three distinct case IDs
    When it is inspected
    Then the membership count is three

  @UC-tsAll @AC-02 @specification
  Scenario: Accepted only
    Given the run endpoint returns 202 and a job ID
    When the response is displayed
    Then it is described as accepted rather than passed

  @UC-tsAll @AC-03 @specification
  Scenario: Delete grouping
    Given a suite groups existing cases
    When the suite is deleted
    Then the case definitions are not deleted by that grouping action

  @UC-tsAll @AC-04 @specification
  Scenario: Empty suite
    Given a suite has zero members
    When it is listed
    Then it shows zero without a fabricated pass result
```
