# Download a control-pack evidence file for a suite

- **ID:** UC-repSuites
- **Screen:** Test suite reports
- **Page key:** `repSuites`
- **Level:** 3
- **Style:** casual
- **Actor:** Tenant administrator
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Obtain a suite evidence package that identifies its input, cases and actual results.

## Precondition

A suite identity and stored result evidence are available; the evidence route must exist in the deployment.

## Trigger

Reviewer opens suite evidence and enters the intended suite ID.

## Success guarantee

Obtain a suite evidence package that identifies its input, cases and actual results. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

An unavailable endpoint or unknown suite cannot produce a successful empty pack. A live rerun must not replace historical evidence silently.

## Acceptance criteria

1. **AC-01 [proposed]** Given a pack contains two pass and one fail result, when totals are reviewed, the totals represent those three outcomes.
2. **AC-02 [proposed]** Given the suite ID is unknown, when evidence is requested, an error replaces the download.
3. **AC-03 [proposed]** Given the evidence route is unavailable, when download is requested, no evidence success is claimed.
4. **AC-04 [proposed]** Given a supported pack was downloaded, when it is opened offline, its stored results remain readable without rerunning tests.

## Main flow

1. Reviewer opens suite evidence and enters the intended suite ID.
2. System resolves the suite and its evidence source.
3. Reviewer requests the package.
4. System returns a supported representation with suite and result context.
5. Reviewer opens the package and checks totals against included cases.

## Alternate flows

1. An empty suite needs an explicit no-evidence outcome.
2. Offline readability does not by itself establish cryptographic integrity.

## Exception flows

1. An unavailable endpoint or unknown suite cannot produce a successful empty pack.
2. A live rerun must not replace historical evidence silently.

## Business validation

1. Package totals reconcile with included outcomes and exclusions.
2. Hash, signature and offline verification are distinct claims.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-repSuites",
  "screenName": "Test suite reports",
  "navigation": {
    "menu": {
      "assetId": "MENU-reports",
      "kind": "menu",
      "name": "Reports",
      "label": "Reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-rep-suites",
      "kind": "submenu",
      "name": "Test suite reports",
      "label": "Test suite reports",
      "parentAssetId": "MENU-reports",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-reports",
      "kind": "menu",
      "name": "Reports",
      "label": "Reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-rep-suites",
      "kind": "submenu",
      "name": "Test suite reports",
      "label": "Test suite reports",
      "parentAssetId": "MENU-reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-repSuites",
      "kind": "screen",
      "name": "Test suite reports",
      "label": "Test suite reports",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "sbe-suite-id",
      "kind": "control",
      "name": "Suite identity",
      "label": "Suite identity",
      "selector": "#sbe-suite-id",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-03.js",
      "parentAssetId": "SCR-repSuites",
      "source": "screen-source",
      "verification": "verified"
    },
    {
      "assetId": "sbe-evidence",
      "kind": "control",
      "name": "Download evidence",
      "label": "Download evidence",
      "selector": "#sbe-evidence",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-03.js",
      "parentAssetId": "SCR-repSuites",
      "source": "screen-source",
      "verification": "verified"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rep-suites-1",
      "flowKind": "main",
      "instruction": "Reviewer opens suite evidence and enters the intended suite ID.",
      "screenId": "SCR-repSuites",
      "assetIds": [
        "SCR-repSuites"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rep-suites-2",
      "flowKind": "main",
      "instruction": "System resolves the suite and its evidence source.",
      "screenId": "SCR-repSuites",
      "assetIds": [
        "SCR-repSuites"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rep-suites-3",
      "flowKind": "main",
      "instruction": "Reviewer requests the package.",
      "screenId": "SCR-repSuites",
      "assetIds": [
        "SCR-repSuites"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rep-suites-4",
      "flowKind": "main",
      "instruction": "System returns a supported representation with suite and result context.",
      "screenId": "SCR-repSuites",
      "assetIds": [
        "SCR-repSuites"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-rep-suites-5",
      "flowKind": "main",
      "instruction": "Reviewer opens the package and checks totals against included cases.",
      "screenId": "SCR-repSuites",
      "assetIds": [
        "SCR-repSuites"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rep-suites-1",
      "flowKind": "alternate",
      "instruction": "An empty suite needs an explicit no-evidence outcome.",
      "screenId": "SCR-repSuites",
      "assetIds": [
        "SCR-repSuites"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An empty suite needs an explicit no-evidence outcome.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rep-suites-2",
      "flowKind": "alternate",
      "instruction": "Offline readability does not by itself establish cryptographic integrity.",
      "screenId": "SCR-repSuites",
      "assetIds": [
        "SCR-repSuites"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Offline readability does not by itself establish cryptographic integrity.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rep-suites-1",
      "flowKind": "exception",
      "instruction": "An unavailable endpoint or unknown suite cannot produce a successful empty pack.",
      "screenId": "SCR-repSuites",
      "assetIds": [
        "SCR-repSuites"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An unavailable endpoint or unknown suite cannot produce a successful empty pack.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rep-suites-2",
      "flowKind": "exception",
      "instruction": "A live rerun must not replace historical evidence silently.",
      "screenId": "SCR-repSuites",
      "assetIds": [
        "SCR-repSuites"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A live rerun must not replace historical evidence silently.",
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

- apps/web/public/js/live-bind-parts/part-03.js
- apps/api/src/modules/registerSpecPersist.ts

### Implementation gaps and decisions

- The old /api/v1/test-suites/:id/evidence claim must be checked against the route inventory; package schema and signatures remain unverified.

### Research basis

- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-repSuites and name Download a control-pack evidence file for a suite. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|

## Scenarios

1. Reconcile totals: a pack contains two pass and one fail result; totals are reviewed; expected: the totals represent those three outcomes.
2. Unknown suite: the suite ID is unknown; evidence is requested; expected: an error replaces the download.
3. No endpoint: the evidence route is unavailable; download is requested; expected: no evidence success is claimed.
4. Offline reading: a supported pack was downloaded; it is opened offline; expected: its stored results remain readable without rerunning tests.

## Gherkin

```gherkin
Feature: Test suite reports

  @UC-repSuites @AC-01 @specification
  Scenario: Reconcile totals
    Given a pack contains two pass and one fail result
    When totals are reviewed
    Then the totals represent those three outcomes

  @UC-repSuites @AC-02 @specification
  Scenario: Unknown suite
    Given the suite ID is unknown
    When evidence is requested
    Then an error replaces the download

  @UC-repSuites @AC-03 @specification
  Scenario: No endpoint
    Given the evidence route is unavailable
    When download is requested
    Then no evidence success is claimed

  @UC-repSuites @AC-04 @specification
  Scenario: Offline reading
    Given a supported pack was downloaded
    When it is opened offline
    Then its stored results remain readable without rerunning tests
```
