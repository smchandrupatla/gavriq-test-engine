# Create new rule

- **ID:** UC-ruleBenchCreate
- **Screen:** Create new rule
- **Page key:** `ruleBenchCreate`
- **Level:** 1
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** UC-overview, UC-ruleBenchExisting
- **Extends to:** UC-ruleBenchExisting, UC-ruleCanvas, UC-ruleBenchStage

## Goal

Save a named detection condition with an explicit, supported evaluation meaning, built through a schema-bound, typed condition builder rather than a hand-typed payload.

## Precondition

Authenticated session: a console or API session exists (POST /api/v1/session/login succeeded and has not expired). API service: the Sand Bench API process is up and serves POST /api/v1/rules, GET /api/v1/rules, the catalogue routes under /api/v1/catalog, and POST /api/v1/rules/test-sample. A schema (XML/XSD or JSON Schema) is bound before the Build conditions step has any field to pick: an existing catalogue entry, a fresh upload, or a reviewed generate-from-sample draft, each at an explicit schema version. POST /api/v1/rules/describe can preview a draft sentence; it does not persist a rule, and this screen does not call it. Database: Postgres used by the rule catalogue is reachable if a durable save is claimed. Authorisation: the actor may create rules (feature access allows Create new rule). The intended field path, operator and comparison values are known before Save rule; the wizard's own translator (rule-condition-legacy-map.js) decides, case by case, whether what was built is expressible in the saved-rule format.

## Trigger

The use case starts when the analyst clicks Save rule on the Review step after completing the preceding four steps, or when a caller posts POST /api/v1/rules directly. Navigation to Create new rule is setup.

## Success guarantee

Save a named detection condition with an explicit, supported evaluation meaning, built through a schema-bound, typed condition builder rather than a hand-typed payload. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Reaching Review with no condition built at all, or with one using an operator/shape the saved-rule format cannot express (e.g. is_missing, a repeated-field any/all match), blocks Save with the specific reason shown on Review -- it is never silently dropped or approximated further. A lost save response is unconfirmed; a second write is not evidence that the first failed. A condition nested more than 100 levels deep, with more than 2,000 conditions in all, or with a nested object or list inside the value of a condition (other than a plain list of countries or values), is a validation failure (422) that names the problem, and no rule is created. A second rule with an already-used name is refused by the server (409) with that reason shown on the Review step's own status line; the earlier rule is unchanged.

## Acceptance criteria

1. **AC-01 [proposed]** Given a numeric field has a >= condition configured at 100, when 99, 100 and 101 are evaluated, 99 does not match while 100 and 101 match.
2. **AC-02 [proposed]** Given the Conditions step has nothing built, when Save rule is attempted, Save is blocked with a specific reason and no rule is created.
3. **AC-03 [proposed]** Given an equals condition compares a field with a specific value, when the field is absent from the sample, the missing value is not silently treated as a match.
4. **AC-04 [proposed]** Given a valid save was submitted, when the response is lost, the outcome is unconfirmed until the stored rule is checked.
5. **AC-05 [proposed]** Given a sample fails schema validation, when the rule condition is still evaluated against it, the schema-invalid and rule-match results are shown separately, not merged into one "no match".
6. **AC-06 [proposed]** Given a condition uses an operator the saved-rule format has no equivalent for, when the analyst reaches Review, Save is disabled and the specific unmapped reason is shown, not a silent approximation.

## Main flow

1. Analyst selects Rule Bench in the console navigation.
   Assets: Rule Bench (`MENU-rule-bench`)
2. Analyst selects Create new rule under Rule Bench; the 5-step wizard opens on its first step, Details.
   Assets: Create new rule (`SUBMENU-rule-bench-create`)
3. Create new rule screen is shown.
   Assets: Create new rule (`SCR-ruleBenchCreate`)
   Events: [`gui.open.ruleBenchCreate`](../events/catalog/gui.open.ruleBenchCreate.md)
4. Details: analyst enters a meaningful name, category, severity, data source and description; Next is blocked with a per-field reason until name/category/severity are filled.
   Assets: Rule name (`CTL-rule-create-name`), Category (`CTL-rule-create-category`), Severity (`CTL-rule-create-severity`), Data source (`CTL-rule-create-source`), Description (`CTL-rule-create-description`)
5. Select schema: analyst picks an existing catalogue schema, uploads one, or generates a draft from a sample message, binding an explicit schema version.
6. Build conditions: analyst explores the bound schema's field tree, picks a field, chooses a typed operator and value, and nests leaves under ALL/ANY/NOT groups; a live plain-language interpretation updates as the tree changes.
   Assets: Condition (`CTL-rule-create-condition`)
7. Test rule: analyst supplies a sample message (paste, upload, or pick from a dataset); the system reports schema validity and rule-match as two independent outcomes, never one collapsed into the other.
   Events: [`api.post.rules.test-sample`](../events/catalog/api.post.rules.test-sample.md)
8. Review and save: analyst reviews the Details/Schema/Conditions summary (each with an Edit link back to its step) and selects Save rule; the system translates the built tree and submits the rule once.
   Assets: Save rule (`BTN-rule-create-save`)
   Events: [`api.post.rules`](../events/catalog/api.post.rules.md), [`biz.rule.created`](../events/catalog/biz.rule.created.md)
9. System shows the saved rule's reference and in-review status (never presented as activated); analyst checks the rule in Existing rules.
   Assets: Existing rules (`SUBMENU-rule-bench-existing`)
   Events: [`api.get.rules`](../events/catalog/api.get.rules.md), [`gui.open.ruleBenchExisting`](../events/catalog/gui.open.ruleBenchExisting.md)
10. System loads data: shell is already painted; the list or form shows skeleton rows or progress until the response arrives (loading state — wait feels short).


## Alternate flows
1. Analyst revises a rejected input and deliberately resubmits.
   Assets: Save rule (`BTN-rule-create-save`)
   Events: [`api.post.rules`](../events/catalog/api.post.rules.md)
2. Back preserves every value entered on earlier steps; Save draft persists the whole in-progress wizard to this browser only (no server rule exists yet) and survives a reload.
3. Changing the bound schema after conditions already reference it is diffed against the existing tree; affected conditions are flagged for repair before the wizard treats the schema step as complete again.
4. An advanced JSON editor on the Conditions step lets a power user paste the wizard's own typed-tree shape directly; this is not the server's saved-rule payload and a malformed paste is rejected without discarding the working tree.
5. A caller may POST /api/v1/rules/describe to preview a generated sentence from a draft rule body. That response is not a saved rule and this screen does not call it.
   Events: [`api.post.rules.describe`](../events/catalog/api.post.rules.describe.md)
6. Slow network: show progress or a still-working cue rather than a frozen spinner; chrome stays usable.
7. Successful write: short confirmation (past tense); the next useful action on this screen or navigation is visible.

## Exception flows
1. Reaching Review with no condition built at all, or with one using an operator/shape the saved-rule format cannot express (e.g. is_missing, a repeated-field any/all match), blocks Save with the specific reason shown on Review -- it is never silently dropped or approximated further.
   Events: [`api.post.rules`](../events/catalog/api.post.rules.md)
2. A lost save response is unconfirmed; a second write is not evidence that the first failed.
   Events: [`api.post.rules`](../events/catalog/api.post.rules.md)
3. A condition nested more than 100 levels deep, with more than 2,000 conditions in all, or with a nested object or list inside the value of a condition (other than a plain list of countries or values), is a validation failure (422) that names the problem, and no rule is created.
   Events: [`api.post.rules`](../events/catalog/api.post.rules.md)
4. A second rule with an already-used name is refused by the server (409) with that reason shown on the Review step's own status line; the earlier rule is unchanged.
   Events: [`api.post.rules`](../events/catalog/api.post.rules.md)
5. No internet: offline banner; Retry when recoverable; never leave a blank list or form region.
6. Permission denied: explain the missing grant; hide write controls; give a path back (nav or overview).
7. Session expired: preserve in-progress draft when architecture allows; clear message; sign-in; restore draft when possible.

## Business validation

1. A rule description is not executable logic.
2. For a numeric >= condition, exercise values below, equal to and above the threshold; country membership and field equality require explicit type and case semantics.
3. Schema validity and rule-match outcome are reported as two independent results on the Test rule step and in the Review summary, never collapsed into a single pass/fail.
4. Saving a rule is never presented as activating it; a saved rule is a draft that stays in review until an analyst validates and approves it elsewhere.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. POST /api/v1/rules
4. POST /api/v1/rules/describe
5. POST /api/v1/rules/test-sample
6. GET /api/v1/catalog/designer-types
7. GET /api/v1/catalog/iso/uploads/:id/structure
8. POST /api/v1/catalog/iso/uploads

## Issue log

_No issues recorded._

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-ruleBenchCreate",
  "screenName": "Create new rule",
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
      "assetId": "SUBMENU-rule-bench-create",
      "kind": "submenu",
      "name": "Create new rule",
      "label": "Create new rule",
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
      "assetId": "SUBMENU-rule-bench-create",
      "kind": "submenu",
      "name": "Create new rule",
      "label": "Create new rule",
      "parentAssetId": "MENU-rule-bench",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-ruleBenchCreate",
      "kind": "screen",
      "name": "Create new rule",
      "label": "Create new rule",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "CTL-rule-create-name",
      "kind": "control",
      "name": "Rule name",
      "label": "Rule name",
      "parentAssetId": "SCR-ruleBenchCreate",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "CTL-rule-create-category",
      "kind": "control",
      "name": "Category",
      "label": "Category",
      "parentAssetId": "SCR-ruleBenchCreate",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "CTL-rule-create-severity",
      "kind": "control",
      "name": "Severity",
      "label": "Severity",
      "parentAssetId": "SCR-ruleBenchCreate",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "CTL-rule-create-source",
      "kind": "control",
      "name": "Data source",
      "label": "Data source",
      "parentAssetId": "SCR-ruleBenchCreate",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "CTL-rule-create-description",
      "kind": "control",
      "name": "Description",
      "label": "Description",
      "parentAssetId": "SCR-ruleBenchCreate",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "CTL-rule-create-condition",
      "kind": "control",
      "name": "Condition",
      "label": "Condition",
      "parentAssetId": "SCR-ruleBenchCreate",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "BTN-rule-create-save",
      "kind": "button",
      "name": "Save rule",
      "label": "Save rule",
      "parentAssetId": "SCR-ruleBenchCreate",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-rule-bench-existing",
      "kind": "submenu",
      "name": "Existing rules",
      "label": "Existing rules",
      "parentAssetId": "SCR-ruleBenchCreate",
      "source": "inferred",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-rule-bench-create-1",
      "flowKind": "main",
      "instruction": "Analyst selects Rule Bench in the console navigation.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate",
        "MENU-rule-bench"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-rule-bench-create-2",
      "flowKind": "main",
      "instruction": "Analyst selects Create new rule under Rule Bench; the 5-step wizard opens on its first step, Details.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate",
        "SUBMENU-rule-bench-create"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-rule-bench-create-3",
      "flowKind": "main",
      "instruction": "Create new rule screen is shown.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-rule-bench-create-4",
      "flowKind": "main",
      "instruction": "Details: analyst enters a meaningful name, category, severity, data source and description; Next is blocked with a per-field reason until name/category/severity are filled.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate",
        "CTL-rule-create-name",
        "CTL-rule-create-category",
        "CTL-rule-create-severity",
        "CTL-rule-create-source",
        "CTL-rule-create-description"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-rule-bench-create-5",
      "flowKind": "main",
      "instruction": "Select schema: analyst picks an existing catalogue schema, uploads one, or generates a draft from a sample message, binding an explicit schema version.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 6,
      "flowId": "MAIN-rule-bench-create-6",
      "flowKind": "main",
      "instruction": "Build conditions: analyst explores the bound schema's field tree, picks a field, chooses a typed operator and value, and nests leaves under ALL/ANY/NOT groups; a live plain-language interpretation updates as the tree changes.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate",
        "CTL-rule-create-condition"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 7,
      "flowId": "MAIN-rule-bench-create-7",
      "flowKind": "main",
      "instruction": "Test rule: analyst supplies a sample message (paste, upload, or pick from a dataset); the system reports schema validity and rule-match as two independent outcomes, never one collapsed into the other.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 8,
      "flowId": "MAIN-rule-bench-create-8",
      "flowKind": "main",
      "instruction": "Review and save: analyst reviews the Details/Schema/Conditions summary (each with an Edit link back to its step) and selects Save rule; the system translates the built tree and submits the rule once.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate",
        "BTN-rule-create-save"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 9,
      "flowId": "MAIN-rule-bench-create-9",
      "flowKind": "main",
      "instruction": "System shows the saved rule's reference and in-review status (never presented as activated); analyst checks the rule in Existing rules.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate",
        "SUBMENU-rule-bench-existing"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-rule-bench-create-1",
      "flowKind": "alternate",
      "instruction": "Analyst revises a rejected input and deliberately resubmits.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate",
        "BTN-rule-create-save"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Analyst revises a rejected input and deliberately resubmits.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-rule-bench-create-2",
      "flowKind": "alternate",
      "instruction": "Back preserves every value entered on earlier steps; Save draft persists the whole in-progress wizard to this browser only (no server rule exists yet) and survives a reload.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Back preserves every value entered on earlier steps; Save draft persists the whole in-progress wizard to this browser only (no server rule exists yet) and survives a reload.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "ALT-rule-bench-create-3",
      "flowKind": "alternate",
      "instruction": "Changing the bound schema after conditions already reference it is diffed against the existing tree; affected conditions are flagged for repair before the wizard treats the schema step as complete again.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Changing the bound schema after conditions already reference it is diffed against the existing tree; affected conditions are flagged for repair before the wizard treats the schema step as complete again.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "ALT-rule-bench-create-4",
      "flowKind": "alternate",
      "instruction": "An advanced JSON editor on the Conditions step lets a power user paste the wizard's own typed-tree shape directly; this is not the server's saved-rule payload and a malformed paste is rejected without discarding the working tree.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An advanced JSON editor on the Conditions step lets a power user paste the wizard's own typed-tree shape directly; this is not the server's saved-rule payload and a malformed paste is rejected without discarding the working tree.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "ALT-rule-bench-create-5",
      "flowKind": "alternate",
      "instruction": "A caller may POST /api/v1/rules/describe to preview a generated sentence from a draft rule body. That response is not a saved rule and this screen does not call it.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A caller may POST /api/v1/rules/describe to preview a generated sentence from a draft rule body. That response is not a saved rule and this screen does not call it.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-rule-bench-create-1",
      "flowKind": "exception",
      "instruction": "Reaching Review with no condition built at all, or with one using an operator/shape the saved-rule format cannot express (e.g. is_missing, a repeated-field any/all match), blocks Save with the specific reason shown on Review -- it is never silently dropped or approximated further.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Reaching Review with no condition built at all, or with one using an operator/shape the saved-rule format cannot express (e.g. is_missing, a repeated-field any/all match), blocks Save with the specific reason shown on Review -- it is never silently dropped or approximated further.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-rule-bench-create-2",
      "flowKind": "exception",
      "instruction": "A lost save response is unconfirmed; a second write is not evidence that the first failed.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A lost save response is unconfirmed; a second write is not evidence that the first failed.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "EXC-rule-bench-create-3",
      "flowKind": "exception",
      "instruction": "A condition nested more than 100 levels deep, with more than 2,000 conditions in all, or with a nested object or list inside the value of a condition (other than a plain list of countries or values), is a validation failure (422) that names the problem, and no rule is created.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A condition nested more than 100 levels deep, with more than 2,000 conditions in all, or with a nested object or list inside the value of a condition (other than a plain list of countries or values), is a validation failure (422) that names the problem, and no rule is created.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "EXC-rule-bench-create-4",
      "flowKind": "exception",
      "instruction": "A second rule with an already-used name is refused by the server (409) with that reason shown on the Review step's own status line; the earlier rule is unchanged.",
      "screenId": "SCR-ruleBenchCreate",
      "assetIds": [
        "SCR-ruleBenchCreate"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A second rule with an already-used name is refused by the server (409) with that reason shown on the Review step's own status line; the earlier rule is unchanged.",
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

- apps/api/src/modules/liveConsole.ts
- apps/api/src/modules/detectionRules.ts
- apps/api/src/modules/specContracts.ts
- apps/api/src/modules/ruleConditionEvaluator.ts
- apps/api/src/modules/ruleSampleTest.ts
- apps/web/public/rule-bench-create.html
- apps/web/public/js/rule-bench-create.js
- apps/web/public/js/rule-condition-model.js
- apps/web/public/js/rule-condition-legacy-map.js
- apps/web/public/js/rule-path-grammar.js

### Implementation gaps and decisions

- rule-condition-legacy-map.js's translation to the saved-rule format is a best-effort approximation, stated plainly rather than hidden: the old format's field is a flat key, so a leaf's schema PATH is reduced to its last segment, which is a reasonable guess, not a verified match against the catalogue. The Review step shows the translated condition in full so the analyst can judge it before saving, and an unmappable shape blocks Save rather than approximating further.
- Create new rule does not call POST /api/v1/rules/describe; that route only returns a generated sentence (session only, no stored rule, and it fills missing draft fields with defaults such as instdAmt and test_only, so it can describe a rule the draft did not state).
- Approval separation belongs to lifecycle transitions (stage/validate/promote), not this save.

### Research basis

- [Cucumber, Gherkin reference (living documentation, accessed 2026-09-11)](https://cucumber.io/docs/gherkin/reference/)
- [IETF RFC 9110, HTTP Semantics (2022), sections 9.2.2, 13 and 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-ruleBenchCreate and name Create new rule. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; editor checks live in sit/cases/64-use-case-ui.sit.ts. Acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/rules` | [apps/api/src/modules/liveConsole.ts:176](../../apps/api/src/modules/liveConsole.ts) |
| `POST /api/v1/rules/describe` | [apps/api/src/modules/registerSpecGaps.ts:124](../../apps/api/src/modules/registerSpecGaps.ts) |
| `POST /api/v1/rules/test-sample` | [apps/api/src/modules/liveConsole.ts:187](../../apps/api/src/modules/liveConsole.ts) |
| `GET /api/v1/catalog/designer-types` | [apps/api/src/modules/registerIsoCatalog.ts:471](../../apps/api/src/modules/registerIsoCatalog.ts) |
| `GET /api/v1/catalog/iso/uploads/:id/structure` | [apps/api/src/modules/registerIsoCatalog.ts:406](../../apps/api/src/modules/registerIsoCatalog.ts) |
| `POST /api/v1/catalog/iso/uploads` | [apps/api/src/modules/registerIsoCatalog.ts:172](../../apps/api/src/modules/registerIsoCatalog.ts) |

## Scenarios

1. Threshold boundary: a numeric field has a >= condition configured at 100; 99, 100 and 101 are evaluated; expected: 99 does not match while 100 and 101 match.
2. Unbuilt condition: the Conditions step has nothing built; Save rule is attempted; expected: Save is blocked with a specific reason and no rule is created.
3. Field equality: an equals condition compares a field with a specific value; the field is absent from the sample; expected: the missing value is not silently treated as a match.
4. Save uncertainty: a valid save was submitted; the response is lost; expected: the outcome is unconfirmed until the stored rule is checked.
5. Independent test outcomes: a sample fails schema validation; the rule condition is still evaluated against it; expected: the schema-invalid and rule-match results are shown separately, not merged into one "no match".
6. Unmappable condition: a condition uses an operator the saved-rule format has no equivalent for; the analyst reaches Review; expected: Save is disabled and the specific unmapped reason is shown, not a silent approximation.

## Gherkin

```gherkin
Feature: Create new rule

  @UC-ruleBenchCreate @AC-01 @specification
  Scenario: Threshold boundary
    Given a numeric field has a >= condition configured at 100
    When 99, 100 and 101 are evaluated
    Then 99 does not match while 100 and 101 match

  @UC-ruleBenchCreate @AC-02 @specification
  Scenario: Unbuilt condition
    Given the Conditions step has nothing built
    When Save rule is attempted
    Then Save is blocked with a specific reason and no rule is created

  @UC-ruleBenchCreate @AC-03 @specification
  Scenario: Field equality
    Given an equals condition compares a field with a specific value
    When the field is absent from the sample
    Then the missing value is not silently treated as a match

  @UC-ruleBenchCreate @AC-04 @specification
  Scenario: Save uncertainty
    Given a valid save was submitted
    When the response is lost
    Then the outcome is unconfirmed until the stored rule is checked

  @UC-ruleBenchCreate @AC-05 @specification
  Scenario: Independent test outcomes
    Given a sample fails schema validation
    When the rule condition is still evaluated against it
    Then the schema-invalid and rule-match results are shown separately, not merged into one "no match"

  @UC-ruleBenchCreate @AC-06 @specification
  Scenario: Unmappable condition
    Given a condition uses an operator the saved-rule format has no equivalent for
    When the analyst reaches Review
    Then Save is disabled and the specific unmapped reason is shown, not a silent approximation
```
