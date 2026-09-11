# Application Events

- **ID:** UC-applicationEvents
- **Screen:** Application Events
- **Page key:** `applicationEvents`
- **Level:** 1
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Inspect captured application events and filter them by their actual event and screen context.

## Precondition

The operator can read application events in the current tenant context.

## Trigger

Operator opens Application Events.

## Success guarantee

Inspect captured application events and filter them by their actual event and screen context. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A fetch failure is not proof of zero events. The memory fallback must not be assumed equivalent to tenant-filtered database results.

## Acceptance criteria

1. **AC-01 [proposed]** Given 200 rows were loaded, when a text filter is applied, only those loaded rows are searched.
2. **AC-02 [proposed]** Given an event lacks actor context, when the row renders, an unavailable marker appears rather than a fabricated user.
3. **AC-03 [proposed]** Given events exist but none match, when the filter is applied, the empty result is described as no matches.
4. **AC-04 [proposed]** Given the events request fails, when the view renders, the failure is not represented as verified zero captured events.

## Main flow

1. Operator opens Application Events.
2. System requests the latest event collection.
3. Operator filters by event, outcome or available screen/action context.
4. System shows matching rows with time, actor and request identifiers where present.

## Alternate flows

1. No matches is distinct from no captured events.
2. Missing actor or request context is displayed as unavailable.

## Exception flows

1. A fetch failure is not proof of zero events.
2. The memory fallback must not be assumed equivalent to tenant-filtered database results.

## Business validation

1. The UI currently requests 200 rows; client filtering is not a search of all history.
2. Event emission acceptance is not proof of persistent audit evidence.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/events

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-applicationEvents",
  "screenName": "Application Events",
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
      "assetId": "SUBMENU-application-events",
      "kind": "submenu",
      "name": "Application Events",
      "label": "Application Events",
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
      "assetId": "SUBMENU-application-events",
      "kind": "submenu",
      "name": "Application Events",
      "label": "Application Events",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-applicationEvents",
      "kind": "screen",
      "name": "Application Events",
      "label": "Application Events",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-application-events-1",
      "flowKind": "main",
      "instruction": "Operator opens Application Events.",
      "screenId": "SCR-applicationEvents",
      "assetIds": [
        "SCR-applicationEvents"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-application-events-2",
      "flowKind": "main",
      "instruction": "System requests the latest event collection.",
      "screenId": "SCR-applicationEvents",
      "assetIds": [
        "SCR-applicationEvents"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-application-events-3",
      "flowKind": "main",
      "instruction": "Operator filters by event, outcome or available screen/action context.",
      "screenId": "SCR-applicationEvents",
      "assetIds": [
        "SCR-applicationEvents"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-application-events-4",
      "flowKind": "main",
      "instruction": "System shows matching rows with time, actor and request identifiers where present.",
      "screenId": "SCR-applicationEvents",
      "assetIds": [
        "SCR-applicationEvents"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-application-events-1",
      "flowKind": "alternate",
      "instruction": "No matches is distinct from no captured events.",
      "screenId": "SCR-applicationEvents",
      "assetIds": [
        "SCR-applicationEvents"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "No matches is distinct from no captured events.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-application-events-2",
      "flowKind": "alternate",
      "instruction": "Missing actor or request context is displayed as unavailable.",
      "screenId": "SCR-applicationEvents",
      "assetIds": [
        "SCR-applicationEvents"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Missing actor or request context is displayed as unavailable.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-application-events-1",
      "flowKind": "exception",
      "instruction": "A fetch failure is not proof of zero events.",
      "screenId": "SCR-applicationEvents",
      "assetIds": [
        "SCR-applicationEvents"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A fetch failure is not proof of zero events.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-application-events-2",
      "flowKind": "exception",
      "instruction": "The memory fallback must not be assumed equivalent to tenant-filtered database results.",
      "screenId": "SCR-applicationEvents",
      "assetIds": [
        "SCR-applicationEvents"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The memory fallback must not be assumed equivalent to tenant-filtered database results.",
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
- apps/api/src/modules/registerEventRoutes.ts

### Implementation gaps and decisions

- The UI currently collapses fetch errors into an empty list and uses an unfiltered-empty message for no matches. Memory fallback isolation needs testing.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-applicationEvents and name Application Events. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/events` | [apps/api/src/modules/registerEventRoutes.ts:23](../../apps/api/src/modules/registerEventRoutes.ts) |

## Scenarios

1. Filter scope: 200 rows were loaded; a text filter is applied; expected: only those loaded rows are searched.
2. Missing actor: an event lacks actor context; the row renders; expected: an unavailable marker appears rather than a fabricated user.
3. No match: events exist but none match; the filter is applied; expected: the empty result is described as no matches.
4. Failed load: the events request fails; the view renders; expected: the failure is not represented as verified zero captured events.

## Gherkin

```gherkin
Feature: Application Events

  @UC-applicationEvents @AC-01 @specification
  Scenario: Filter scope
    Given 200 rows were loaded
    When a text filter is applied
    Then only those loaded rows are searched

  @UC-applicationEvents @AC-02 @specification
  Scenario: Missing actor
    Given an event lacks actor context
    When the row renders
    Then an unavailable marker appears rather than a fabricated user

  @UC-applicationEvents @AC-03 @specification
  Scenario: No match
    Given events exist but none match
    When the filter is applied
    Then the empty result is described as no matches

  @UC-applicationEvents @AC-04 @specification
  Scenario: Failed load
    Given the events request fails
    When the view renders
    Then the failure is not represented as verified zero captured events
```
