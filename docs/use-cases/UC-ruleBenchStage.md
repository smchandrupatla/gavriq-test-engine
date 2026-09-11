# Stage rules for the test pipeline

- **ID:** UC-ruleBenchStage
- **Screen:** Stage rules
- **Page key:** `ruleBenchStage`
- **Level:** 2
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Request the supported staging transition for an identified rule and target environment.

## Precondition

A rule exists and its current version and allowed transitions are known.

## Trigger

Analyst opens Stage rules and identifies the intended rule.

## Success guarantee

Request the supported staging transition for an identified rule and target environment. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

A stale version must not silently replace another edit. A rejected or unknown transition leaves no claimed successful stage.

## Acceptance criteria

1. **AC-01 [proposed]** Given rule R1 exists, when the analyst stages R1, the response and refreshed row identify R1 and the returned state.
2. **AC-02 [proposed]** Given the current ETag changed, when an old If-Match is sent to transitions, the stale request is rejected.
3. **AC-03 [proposed]** Given a stage request succeeds, when the analyst reviews its result, the screen does not claim that production promotion occurred.
4. **AC-04 [proposed]** Given the stage service rejects the transition, when the result is shown, the row is not optimistically labelled promoted.

## Main flow

1. Analyst opens Stage rules and identifies the intended rule.
2. System presents the current lifecycle and available target context.
3. Analyst requests Stage; the system invokes the registered transition path.
4. System reports the returned state or validation findings.
5. Analyst reloads the rule before any later promotion.

## Alternate flows

1. Analyst cancels before submission; no stage request is made.
2. A transition through the wider lifecycle endpoint includes its required If-Match value.

## Exception flows

1. A stale version must not silently replace another edit.
2. A rejected or unknown transition leaves no claimed successful stage.

## Business validation

1. Staging and promotion are separate actions.
2. A staged row is not proof that rule tests passed or that production traffic uses the rule.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/rules/:id/stage
4. POST /api/v1/rules/:id/transitions

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-ruleBenchStage",
  "screenName": "Stage rules",
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
      "assetId": "SUBMENU-rule-bench-stage",
      "kind": "submenu",
      "name": "Stage rules",
      "label": "Stage rules",
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
      "assetId": "SUBMENU-rule-bench-stage",
      "kind": "submenu",
      "name": "Stage rules",
      "label": "Stage rules",
      "parentAssetId": "MENU-rule-bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-ruleBenchStage",
      "kind": "screen",
      "name": "Stage rules",
      "label": "Stage rules",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rule-bench-stage-1",
      "flowKind": "main",
      "instruction": "Analyst opens Stage rules and identifies the intended rule.",
      "screenId": "SCR-ruleBenchStage",
      "assetIds": [
        "SCR-ruleBenchStage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rule-bench-stage-2",
      "flowKind": "main",
      "instruction": "System presents the current lifecycle and available target context.",
      "screenId": "SCR-ruleBenchStage",
      "assetIds": [
        "SCR-ruleBenchStage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rule-bench-stage-3",
      "flowKind": "main",
      "instruction": "Analyst requests Stage; the system invokes the registered transition path.",
      "screenId": "SCR-ruleBenchStage",
      "assetIds": [
        "SCR-ruleBenchStage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rule-bench-stage-4",
      "flowKind": "main",
      "instruction": "System reports the returned state or validation findings.",
      "screenId": "SCR-ruleBenchStage",
      "assetIds": [
        "SCR-ruleBenchStage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-rule-bench-stage-5",
      "flowKind": "main",
      "instruction": "Analyst reloads the rule before any later promotion.",
      "screenId": "SCR-ruleBenchStage",
      "assetIds": [
        "SCR-ruleBenchStage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rule-bench-stage-1",
      "flowKind": "alternate",
      "instruction": "Analyst cancels before submission; no stage request is made.",
      "screenId": "SCR-ruleBenchStage",
      "assetIds": [
        "SCR-ruleBenchStage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Analyst cancels before submission; no stage request is made.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rule-bench-stage-2",
      "flowKind": "alternate",
      "instruction": "A transition through the wider lifecycle endpoint includes its required If-Match value.",
      "screenId": "SCR-ruleBenchStage",
      "assetIds": [
        "SCR-ruleBenchStage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A transition through the wider lifecycle endpoint includes its required If-Match value.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rule-bench-stage-1",
      "flowKind": "exception",
      "instruction": "A stale version must not silently replace another edit.",
      "screenId": "SCR-ruleBenchStage",
      "assetIds": [
        "SCR-ruleBenchStage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A stale version must not silently replace another edit.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rule-bench-stage-2",
      "flowKind": "exception",
      "instruction": "A rejected or unknown transition leaves no claimed successful stage.",
      "screenId": "SCR-ruleBenchStage",
      "assetIds": [
        "SCR-ruleBenchStage"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A rejected or unknown transition leaves no claimed successful stage.",
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

### Implementation gaps and decisions

- Verify each list control binding; the existing screen list alone does not establish a stage action. The shortcut and full transition routes have different contracts.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-ruleBenchStage and name Stage rules for the test pipeline. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/rules/:id/stage` | [apps/api/src/modules/registerSpecGaps.ts:96](../../apps/api/src/modules/registerSpecGaps.ts) |
| `POST /api/v1/rules/:id/transitions` | [apps/api/src/modules/liveConsole.ts:147](../../apps/api/src/modules/liveConsole.ts) |

## Scenarios

1. Stage identity: rule R1 exists; the analyst stages R1; expected: the response and refreshed row identify R1 and the returned state.
2. Stale transition: the current ETag changed; an old If-Match is sent to transitions; expected: the stale request is rejected.
3. No promotion: a stage request succeeds; the analyst reviews its result; expected: the screen does not claim that production promotion occurred.
4. Failure: the stage service rejects the transition; the result is shown; expected: the row is not optimistically labelled promoted.

## Gherkin

```gherkin
Feature: Stage rules

  @UC-ruleBenchStage @AC-01 @specification
  Scenario: Stage identity
    Given rule R1 exists
    When the analyst stages R1
    Then the response and refreshed row identify R1 and the returned state

  @UC-ruleBenchStage @AC-02 @specification
  Scenario: Stale transition
    Given the current ETag changed
    When an old If-Match is sent to transitions
    Then the stale request is rejected

  @UC-ruleBenchStage @AC-03 @specification
  Scenario: No promotion
    Given a stage request succeeds
    When the analyst reviews its result
    Then the screen does not claim that production promotion occurred

  @UC-ruleBenchStage @AC-04 @specification
  Scenario: Failure
    Given the stage service rejects the transition
    When the result is shown
    Then the row is not optimistically labelled promoted
```
