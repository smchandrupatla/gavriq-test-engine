# Create a schema

- **ID:** UC-msgCreateSchema
- **Screen:** Create schema
- **Page key:** `msgCreateSchema`
- **Level:** 3
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Create, refine, validate, and publish a versioned XML, JSON, or flat-file schema through a format-specific visual editor, starting from a blank definition, an existing registered schema, or an uploaded schema definition.

## Precondition

1. The analyst can open Create schema; an existing schema file is not required.
2. For Use existing, a source schema and its version are available in Schema register.
3. For Upload definition, the analyst has an XSD, JSON Schema, or supported flat-file layout definition, including needed dependencies.
4. The selected type/dialect has a declared editing, generation, and validation capability profile. Broad version support is the target; an unimplemented dialect must not be presented as fully supported.
5. A raw XML/JSON message or ordinary CSV data file is not assumed to be a complete schema definition. Sample-based inference is a separate, proposed start option with explicit review.

## Trigger

The analyst opens Message Designer > Create schema, or chooses to create a new version/copy from a registered schema.

## Success guarantee

1. The published schema has an explicit name, type, business version, applicable dialect, and a valid root or record definition.
2. The structure, applicable cardinalities, field constraints, allowed values, and enabled enforceable rules reflect the reviewed editor revision.
3. Generated output is an XSD for XML, a JSON Schema for JSON, or a documented layout definition for flat files. Sample messages and CSV field dictionaries are labelled separately from schema artefacts.
4. Publish records the exact generated revision and makes the version available as Ready in Schema register only after confirmed completion.
5. The published package identifies any application-runtime rules and their execution dependencies; schema-only downloads disclose rules they do not enforce.
6. The starting registered schema and original uploaded files remain unchanged. Proposed version lineage links the result to its source.

## Minimal guarantee (on failure)

1. Editing, expanding the tree, and generating a preview do not publish a schema.
2. Malformed definitions, unresolved required references, contradictory constraints, unsupported required enforcement, and invalid/stale output block publication with actionable findings.
3. Existing registered versions are not silently changed, and unsupported source constructs are not silently discarded.
4. The current in-session working model is retained after a validation or generation failure. Recovery after closing the browser requires the proposed Save draft feature; it is not implied by in-memory retention.
5. Failed publication is not reported as Ready. An uncertain result is shown as unconfirmed and is not automatically retried without checking its outcome.
6. Cancel with unsaved edits offers Keep editing or Discard changes. Discard clears the working attempt, not the source files or an existing registered schema.

## Acceptance criteria

1. **AC-01 [gate]** Type first: Selecting XML, JSON, or flat file renders the corresponding tree or ordered table and relevant property controls before detailed field editing.
2. **AC-02 [gate]** Separate identity: Schema name and business version are recorded independently from the root name and standards dialect. JSON output does not acquire a wrapper property from its visual root label.
3. **AC-03 [gate]** Blank start: Each type supports a blank start with a root/record definition and appropriate add actions.
4. **AC-04 [gate]** Registered start: Selecting a registered version populates the correct editor with its structure and constraints and identifies the source. Editing does not change that source version.
5. **AC-05 [gate]** Uploaded start: A supported valid definition populates the editor, including cardinalities, types, allowed values, documentation, references, and recognized rules. Loading does not publish it.
6. **AC-06 [gate]** Source limitations: Missing dependencies and uneditable constructs are identified by location. Publication is blocked if correct preservation and validation cannot be demonstrated; there is no silent simplification.
7. **AC-07 [gate]** Expansion: Plus/minus expands or collapses existing branches without changing schema content, field count, or rules. Recursive references do not expand indefinitely.
8. **AC-08 [gate]** Selection: Selecting a node or row displays its actual properties and editable constraints. Applying a valid edit updates the summary; invalid input is explained and does not silently overwrite the last valid value.
9. **AC-09 [gate]** Structure editing: Add child/sibling/attribute where applicable, duplicate, move, rename, and delete preserve valid parent-child semantics. Removing referenced content reveals affected dependencies.
10. **AC-10 [gate]** Presence: Mandatory/optional, null/nil, empty value, and occurrence/item count are separate settings. A required JSON property allowing null accepts null but rejects omission.
11. **AC-11 [gate]** XML occurrence: A child with occurrence range 0..3 permits zero through three occurrences and rejects four. Attribute controls do not offer repeating-element cardinalities.
12. **AC-12 [gate]** JSON arrays: An optional array with item range 1..3 accepts omission or one to three valid items, and rejects a present empty array or four items.
13. **AC-13 [gate]** XML model: The selected root, namespaces, attributes, content groups, and type references survive generation/reopening without a semantic change.
14. **AC-14 [gate]** JSON model: Object properties, array item definitions, references, null choices, and additional-property policy survive generation/reopening without a semantic change.
15. **AC-15 [gate]** Flat layout: Column order or fixed-width positions and file dialect settings are visible. Overlaps, unexplained gaps, and inconsistent record lengths block fixed-width generation.
16. **AC-16 [gate]** Text: A digits-only field of exact length five accepts 00123 as text and rejects 123, 12A45, and six digits. Leading zeros survive the full editing and export cycle.
17. **AC-17 [gate]** Numeric constraints: Invalid bounds and incompatible precision/increment settings produce findings. Boundary tests exercise inclusive/exclusive limits using the declared numeric semantics.
18. **AC-18 [gate]** Date/time: An enforced date rule rejects an impossible calendar date and follows the declared timezone/representation policy. Annotation-only formats are visibly labelled and not counted as enforced rules.
19. **AC-19 [gate]** Enumeration: The analyst can add, edit, remove, and paste allowed values with descriptions. Type conflicts and duplicate values are reported; an allowed-value/default conflict prevents generation until resolved.
20. **AC-20 [gate]** Rules: A rule records target, scope, condition/assertion, failure message, severity, enabled state, and enforcement location. A descriptive rule is never presented as executable without a supported translation.
21. **AC-21 [gate]** Conditional requirement: With a bank-transfer condition, the account field is required only in the stated condition. Tests include absent and null condition values rather than treating them implicitly as true.
22. **AC-22 [gate]** Cross-field rules: Unsupported arithmetic or cross-field execution blocks a promise of full enforcement. A supported runtime rule is included with its execution dependency in the package.
23. **AC-23 [gate]** Findings navigation: Each blocking finding identifies the relevant field/path or schema setting; selecting it brings the affected editor control into view.
24. **AC-24 [gate]** Sample checks: Sample validation reports the sample location, failing rule, and result. A sample failing a valid schema is distinguished from a malformed schema definition.
25. **AC-25 [gate]** Generation: Generation produces the definition for the selected type and revision. XML/JSON sample payloads and CSV documentation are not represented as equivalent schema definitions.
26. **AC-26 [gate]** Revision freshness: A content edit after generation marks the artefact stale. Publish remains blocked until generation and validation cover the current revision.
27. **AC-27 [gate]** Publish: Only explicit Publish persists a Ready result. The catalogue entry identifies the published version and generated artefact; failure or an unconfirmed response is not displayed as success.
28. **AC-28 [proposed]** Version conflict: Publishing an existing identity/version is blocked with a request for a new version or independent schema identity. No existing published version is overwritten.
29. **AC-29 [gate]** Format change: Changing type after editing preserves the current work until the analyst chooses to start another draft or approves a reviewed conversion. No automatic XML/JSON/flat conversion discards structure or rules.
30. **AC-30 [gate]** Accessibility: Tree expansion, selection, field editing, and reordering are possible without a pointer. Focus and expansion states are perceivable, and minus does not delete a node.
31. **AC-31 [gate]** Cancellation: Discarding an unsaved attempt leaves registered sources and original files unchanged; choosing Keep editing retains the working model.
32. **AC-32 [gate]** Shared definitions: A change to a reusable type or value list shows its affected uses. Published dependencies are pinned to versions under the proposed version policy.
33. **AC-33 [proposed]** Scalar root: A valid scalar JSON root can be generated; the old blanket requirement for children under every root is not used as a language-validity test.
34. **AC-34 [gate]** Flat-file escaping: A quoted delimited value containing the delimiter or a quote is parsed according to the selected dialect. Optional blank values do not shift subsequent columns or fixed-width slots.
35. **AC-35 [gate]** Publication uncertainty: A lost publication response produces an unconfirmed outcome; reopening or retrying resolves the prior result before any second publication attempt.
36. **AC-36 [proposed]** Draft persistence: Save draft persists a non-Ready draft, reports success only after confirmation, and reopens the saved structure, rules, and version metadata without publishing it.

## Main flow

1. **Open:** The analyst opens Create schema. The system displays type selection and start options.
2. **Choose type:** The analyst selects XML, JSON, or flat file. The system displays a short explanation and the relevant editor configuration.
3. **Choose starting point:** The analyst selects Blank, Use existing, or Upload definition. For a populated source, the system validates readability, detects its dialect, loads dependencies, and presents the source review before editing; alternate flows A1/A2 apply.
4. **Name and version:** The analyst enters schema name, description, business version, and applicable target dialect. For flat files, the analyst selects delimited or fixed width. The system displays detected or proposed settings for confirmation.
5. **Define root or record:** The analyst defines the XML root and namespace, JSON root type, or flat-file record and dialect. The system displays the root/tree or initial row table.
6. **Build structure:** The analyst adds fields and, for XML/JSON, groups, nested objects, arrays, attributes, or references as appropriate. The system offers valid actions for the selected node and marks incomplete definitions.
7. **Refine a field:** The analyst selects a node/row, reviews its path, and edits presence, type, occurrence/item count, and applicable value constraints. The system explains invalid combinations at the relevant control.
8. **Define rules and values:** The analyst adds enumerations, conditional requirements, and field/record rules. The system records their scope and enforcement support and shows effects on defaults or dependencies.
9. **Review structure:** The analyst expands/collapses branches, searches for fields, and reviews the summary. Proposed undo/redo supports correction without rebuilding the schema. Expansion itself never changes the model.
10. **Validate:** The analyst selects Validate schema. The system checks the model, target dialect, references, constraints, rule executability, and layout consistency, then displays errors/warnings linked to their source.
11. **Correct and test:** The analyst resolves blockers and may supply samples to test field and cross-field behavior. The system distinguishes model validity, rule results, and sample-data failures.
12. **Generate:** The analyst selects Generate artefact. The system generates and validates output for the current revision and displays the schema preview plus a manifest of included rules and dependencies.
13. **Review publication:** The analyst reviews the definition, version, differences from a starting schema, warnings, and portability limitations. Downloading a preview does not publish it.
14. **Publish:** The analyst selects Publish. The system verifies that the current revision is generated and valid, checks the publication identity/version, and submits that revision for publication.
15. **Complete:** After confirmed success, the system displays the published version, provides downloads, and makes it available in Schema register as Ready. If completion is uncertain, exception E9 applies.

## Alternate flows

1. **A1 — Use existing:** At step 3, select a registered schema and explicit version. The system loads a working copy with provenance, expands the root, and displays references as links. The analyst chooses a new version or independent copy under the proposed version policy, then continues at step 4. The source is unchanged.
2. **A2 — Upload an existing definition:** At step 3, select the definition and required dependency files. The system detects format/dialect, reports mismatches with the selected type, and obtains a deliberate type correction rather than converting silently. After successful load, root and first-level fields are visible; deeper branches expand on demand. The analyst reviews the loaded constraints and continues at step 4.
3. **A3 — Start from sample, proposed:** If a sample XML/JSON/CSV message is offered, identify it as data. An explicit inference option may suggest structure, but marks cardinality, optionality, datatypes, and allowed values as unconfirmed. One observed value does not establish an enumeration or maximum repetition. The analyst reviews all inferred properties before generation.
4. **A4 — Reuse type or value list:** At steps 6–8, choose a registered reusable definition. Display its source/version and inherited constraints. Offer a reference or an explicit local copy; do not imply changes to one are local when shared uses would change.
5. **A5 — Edit enumeration:** At step 8, add individual entries or paste a list; preview additions, type conflicts, and duplicates before applying. Changes affect the draft, and removal of a used default/reference creates an actionable conflict.
6. **A6 — Change schema type:** Before structure exists, rerender the appropriate editor. After editing, keep the current draft and offer a separate new draft. Conversion is a proposed advanced feature requiring a mapping/loss report and explicit review before replacing the working representation.
7. **A7 — Save and resume draft, proposed:** Save incomplete work as a draft without claiming validation or Ready status. Resume from the saved revision and identify unresolved findings.
8. **A8 — Edit after generation:** At steps 12–14, any model-affecting edit marks the generated artefact stale; return to validation and generation. Expanding a branch or changing visual selection does not make it stale.
9. **A9 — Cancel:** With unsaved edits, offer Keep editing or Discard changes. Discard ends the working attempt without changing the source or any published record. If publication is already submitted, report its actual outcome rather than promising cancellation of a completed operation.
10. **A10 — Multiple roots or advanced source constructs:** Present a root selector and support report. Supported constructs remain editable; preserved but uneditable constructs are visible in an advanced source panel. If preservation cannot be guaranteed, block generation rather than publishing a simplified replacement.

## Exception flows

1. **E1 — Malformed source:** Reject loading with file/location details; retain any previously loaded draft. A sample-data file is explained as the wrong input kind rather than accepted as a complete definition.
2. **E2 — Unsupported dialect/construct:** Explain what cannot be edited, generated, or validated. Offer another supported target only with an explicit impact review; do not relabel the source as compatible.
3. **E3 — Missing dependency:** Identify the unresolved type/reference and allow the analyst to provide it or select a registered version. Do not discard it or claim successful full validation.
4. **E4 — Invalid structure/name:** Highlight illegal XML names, duplicate JSON property definitions, invalid parent-child combinations, or flat-file name/position conflicts. Keep the draft editable.
5. **E5 — Contradictory constraints:** Reject a minimum above a maximum, incompatible enumeration values, or unsatisfiable local settings detected by validation. General rule satisfiability is not promised; report the validation scope and test gaps.
6. **E6 — Broken rule or reference after edit:** Show affected rules when a field is moved, renamed, retyped, or removed. Rebind stable references when safe and require repair where semantics changed. Unresolved enforceable rules block publication.
7. **E7 — Generation/validation failure:** Keep the working revision and explain the failing field, construct, or service. A failed output is not downloadable as an approved valid pack or publishable as Ready.
8. **E8 — Duplicate publication version, proposed:** Preserve the draft and existing version. Ask for a new version/identity; do not silently overwrite.
9. **E9 — Publication failure or uncertainty:** Display a confirmed failure or unconfirmed result accurately. Do not automatically repeat an uncertain write; check its result before retrying. Preserve the generated revision for recovery.
10. **E10 — Size/complexity limit:** State the actual supported limit and affected source. Keep navigation bounded with lazy branch loading and recursion markers; do not truncate a definition silently.
11. **E11 — Concurrent draft change, proposed:** Detect a stale saved revision and offer reload/compare or a separate copy. Do not silently replace another analyst's saved edits.

## Business validation

1. Type selection determines modelling semantics and UI controls, not merely the export extension.
2. Schema identity, business version, language dialect, and working revision are distinct values.
3. The publication profile must declare supported types, dialects, editable features, preserved-only features, and enforcement capabilities. A broad-support aspiration does not establish implementation conformance.
4. Only explicit Publish creates a Ready catalogue version. Proposed Save draft is a separate non-Ready operation.
5. Field presence, empty value, null/nil, and repetition must not share a single ambiguous Mandatory switch.
6. XML ordering/groups, JSON object/array structure, and flat-file positions are retained in the canonical working representation. Cross-format equivalence is not assumed.
7. Enumeration entries represent allowed data values; their labels and descriptions do not replace their values. New entries become effective only in the version that is published.
8. Every executable rule identifies scope, target, validation language/profile, severity, and enforcement location. A warning-level runtime rule does not change the inherent pass/fail semantics of a native schema constraint.
9. Disabled/documentation-only rules remain visible in publication review and are not counted as enforced.
10. The editor must not claim portable enforcement for rules requiring an application runtime unless that dependency is included and supported by the consumer.
11. A published revision must match the reviewed, generated revision. Later edits require validation/generation before publication.
12. Proposed immutable-version behavior applies to Create schema. It does not alter the separate import workflow's agreed override behavior.
13. Require at least one field for a flat record. For XML/JSON, determine validity from the root/content model and selected product profile rather than a universal children-under-root rule.
14. Proposed summary count: count leaf fields per structural use, count repeating definitions once per use, exclude grouping nodes, and mark recursive summaries explicitly rather than showing an invented finite expansion count. XML attributes carrying data count as fields under this proposed convention.
15. Add/Remove and Expand/Collapse are separate operations with distinct labels and behavior.
16. No implementation-specific authorization flow is introduced here. Access follows the application's existing policy.

## Technical notes / APIs

1. Confirmed product specification. The observed implementation and gaps below are separate from these required outcomes.
2. POST /api/v1/catalog/schemas/build
3. POST /api/v1/catalog/schemas/drafts
4. GET /api/v1/catalog/schemas/drafts/:id
5. POST /api/v1/catalog/schemas/drafts/:id/tests
6. POST /api/v1/catalog/schemas/drafts/:id/publish
7. GET /api/v1/catalog/schemas/drafts/:id/pack
8. POST /api/v1/catalog/schemas/validate
9. GET /api/v1/catalog/schemas/baselines

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-msgCreateSchema",
  "screenName": "Create schema",
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
      "assetId": "SUBMENU-msg-create-schema",
      "kind": "submenu",
      "name": "Create schema",
      "label": "Create schema",
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
      "assetId": "SUBMENU-msg-create-schema",
      "kind": "submenu",
      "name": "Create schema",
      "label": "Create schema",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-msgCreateSchema",
      "kind": "screen",
      "name": "Create schema",
      "label": "Create schema",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "sbe-schema-builder",
      "kind": "control",
      "name": "Schema builder",
      "label": "Schema builder",
      "selector": "#sbe-schema-builder",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-08.js",
      "parentAssetId": "SCR-msgCreateSchema",
      "source": "screen-source",
      "verification": "verified"
    },
    {
      "assetId": "sbe-sb-format",
      "kind": "control",
      "name": "Schema format",
      "label": "Schema format",
      "selector": "#sbe-sb-format",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-08.js",
      "parentAssetId": "SCR-msgCreateSchema",
      "source": "screen-source",
      "verification": "verified"
    },
    {
      "assetId": "sbe-sb-name",
      "kind": "control",
      "name": "Schema name",
      "label": "Schema name",
      "selector": "#sbe-sb-name",
      "sourceFile": "apps/web/public/js/live-bind-parts/part-08.js",
      "parentAssetId": "SCR-msgCreateSchema",
      "source": "screen-source",
      "verification": "verified"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-msg-create-schema-1",
      "flowKind": "main",
      "instruction": "**Open:** The analyst opens Create schema. The system displays type selection and start options.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-msg-create-schema-2",
      "flowKind": "main",
      "instruction": "**Choose type:** The analyst selects XML, JSON, or flat file. The system displays a short explanation and the relevant editor configuration.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-msg-create-schema-3",
      "flowKind": "main",
      "instruction": "**Choose starting point:** The analyst selects Blank, Use existing, or Upload definition. For a populated source, the system validates readability, detects its dialect, loads dependencies, and presents the source review before editing; alternate flows A1/A2 apply.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-msg-create-schema-4",
      "flowKind": "main",
      "instruction": "**Name and version:** The analyst enters schema name, description, business version, and applicable target dialect. For flat files, the analyst selects delimited or fixed width. The system displays detected or proposed settings for confirmation.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-msg-create-schema-5",
      "flowKind": "main",
      "instruction": "**Define root or record:** The analyst defines the XML root and namespace, JSON root type, or flat-file record and dialect. The system displays the root/tree or initial row table.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 6,
      "flowId": "MAIN-msg-create-schema-6",
      "flowKind": "main",
      "instruction": "**Build structure:** The analyst adds fields and, for XML/JSON, groups, nested objects, arrays, attributes, or references as appropriate. The system offers valid actions for the selected node and marks incomplete definitions.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 7,
      "flowId": "MAIN-msg-create-schema-7",
      "flowKind": "main",
      "instruction": "**Refine a field:** The analyst selects a node/row, reviews its path, and edits presence, type, occurrence/item count, and applicable value constraints. The system explains invalid combinations at the relevant control.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 8,
      "flowId": "MAIN-msg-create-schema-8",
      "flowKind": "main",
      "instruction": "**Define rules and values:** The analyst adds enumerations, conditional requirements, and field/record rules. The system records their scope and enforcement support and shows effects on defaults or dependencies.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 9,
      "flowId": "MAIN-msg-create-schema-9",
      "flowKind": "main",
      "instruction": "**Review structure:** The analyst expands/collapses branches, searches for fields, and reviews the summary. Proposed undo/redo supports correction without rebuilding the schema. Expansion itself never changes the model.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 10,
      "flowId": "MAIN-msg-create-schema-10",
      "flowKind": "main",
      "instruction": "**Validate:** The analyst selects Validate schema. The system checks the model, target dialect, references, constraints, rule executability, and layout consistency, then displays errors/warnings linked to their source.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 11,
      "flowId": "MAIN-msg-create-schema-11",
      "flowKind": "main",
      "instruction": "**Correct and test:** The analyst resolves blockers and may supply samples to test field and cross-field behavior. The system distinguishes model validity, rule results, and sample-data failures.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 12,
      "flowId": "MAIN-msg-create-schema-12",
      "flowKind": "main",
      "instruction": "**Generate:** The analyst selects Generate artefact. The system generates and validates output for the current revision and displays the schema preview plus a manifest of included rules and dependencies.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 13,
      "flowId": "MAIN-msg-create-schema-13",
      "flowKind": "main",
      "instruction": "**Review publication:** The analyst reviews the definition, version, differences from a starting schema, warnings, and portability limitations. Downloading a preview does not publish it.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 14,
      "flowId": "MAIN-msg-create-schema-14",
      "flowKind": "main",
      "instruction": "**Publish:** The analyst selects Publish. The system verifies that the current revision is generated and valid, checks the publication identity/version, and submits that revision for publication.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 15,
      "flowId": "MAIN-msg-create-schema-15",
      "flowKind": "main",
      "instruction": "**Complete:** After confirmed success, the system displays the published version, provides downloads, and makes it available in Schema register as Ready. If completion is uncertain, exception E9 applies.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-msg-create-schema-1",
      "flowKind": "alternate",
      "instruction": "**A1 — Use existing:** At step 3, select a registered schema and explicit version. The system loads a working copy with provenance, expands the root, and displays references as links. The analyst chooses a new version or independent copy under the proposed version policy, then continues at step 4. The source is unchanged.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A1 — Use existing:** At step 3, select a registered schema and explicit version. The system loads a working copy with provenance, expands the root, and displays references as links. The analyst chooses a new version or independent copy under the proposed version policy, then continues at step 4. The source is unchanged.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-msg-create-schema-2",
      "flowKind": "alternate",
      "instruction": "**A2 — Upload an existing definition:** At step 3, select the definition and required dependency files. The system detects format/dialect, reports mismatches with the selected type, and obtains a deliberate type correction rather than converting silently. After successful load, root and first-level fields are visible; deeper branches expand on demand. The analyst reviews the loaded constraints and continues at step 4.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A2 — Upload an existing definition:** At step 3, select the definition and required dependency files. The system detects format/dialect, reports mismatches with the selected type, and obtains a deliberate type correction rather than converting silently. After successful load, root and first-level fields are visible; deeper branches expand on demand. The analyst reviews the loaded constraints and continues at step 4.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "ALT-msg-create-schema-3",
      "flowKind": "alternate",
      "instruction": "**A3 — Start from sample, proposed:** If a sample XML/JSON/CSV message is offered, identify it as data. An explicit inference option may suggest structure, but marks cardinality, optionality, datatypes, and allowed values as unconfirmed. One observed value does not establish an enumeration or maximum repetition. The analyst reviews all inferred properties before generation.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A3 — Start from sample, proposed:** If a sample XML/JSON/CSV message is offered, identify it as data. An explicit inference option may suggest structure, but marks cardinality, optionality, datatypes, and allowed values as unconfirmed. One observed value does not establish an enumeration or maximum repetition. The analyst reviews all inferred properties before generation.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "ALT-msg-create-schema-4",
      "flowKind": "alternate",
      "instruction": "**A4 — Reuse type or value list:** At steps 6–8, choose a registered reusable definition. Display its source/version and inherited constraints. Offer a reference or an explicit local copy; do not imply changes to one are local when shared uses would change.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A4 — Reuse type or value list:** At steps 6–8, choose a registered reusable definition. Display its source/version and inherited constraints. Offer a reference or an explicit local copy; do not imply changes to one are local when shared uses would change.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "ALT-msg-create-schema-5",
      "flowKind": "alternate",
      "instruction": "**A5 — Edit enumeration:** At step 8, add individual entries or paste a list; preview additions, type conflicts, and duplicates before applying. Changes affect the draft, and removal of a used default/reference creates an actionable conflict.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A5 — Edit enumeration:** At step 8, add individual entries or paste a list; preview additions, type conflicts, and duplicates before applying. Changes affect the draft, and removal of a used default/reference creates an actionable conflict.",
      "backgroundEvents": []
    },
    {
      "number": 6,
      "flowId": "ALT-msg-create-schema-6",
      "flowKind": "alternate",
      "instruction": "**A6 — Change schema type:** Before structure exists, rerender the appropriate editor. After editing, keep the current draft and offer a separate new draft. Conversion is a proposed advanced feature requiring a mapping/loss report and explicit review before replacing the working representation.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A6 — Change schema type:** Before structure exists, rerender the appropriate editor. After editing, keep the current draft and offer a separate new draft. Conversion is a proposed advanced feature requiring a mapping/loss report and explicit review before replacing the working representation.",
      "backgroundEvents": []
    },
    {
      "number": 7,
      "flowId": "ALT-msg-create-schema-7",
      "flowKind": "alternate",
      "instruction": "**A7 — Save and resume draft, proposed:** Save incomplete work as a draft without claiming validation or Ready status. Resume from the saved revision and identify unresolved findings.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A7 — Save and resume draft, proposed:** Save incomplete work as a draft without claiming validation or Ready status. Resume from the saved revision and identify unresolved findings.",
      "backgroundEvents": []
    },
    {
      "number": 8,
      "flowId": "ALT-msg-create-schema-8",
      "flowKind": "alternate",
      "instruction": "**A8 — Edit after generation:** At steps 12–14, any model-affecting edit marks the generated artefact stale; return to validation and generation. Expanding a branch or changing visual selection does not make it stale.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A8 — Edit after generation:** At steps 12–14, any model-affecting edit marks the generated artefact stale; return to validation and generation. Expanding a branch or changing visual selection does not make it stale.",
      "backgroundEvents": []
    },
    {
      "number": 9,
      "flowId": "ALT-msg-create-schema-9",
      "flowKind": "alternate",
      "instruction": "**A9 — Cancel:** With unsaved edits, offer Keep editing or Discard changes. Discard ends the working attempt without changing the source or any published record. If publication is already submitted, report its actual outcome rather than promising cancellation of a completed operation.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A9 — Cancel:** With unsaved edits, offer Keep editing or Discard changes. Discard ends the working attempt without changing the source or any published record. If publication is already submitted, report its actual outcome rather than promising cancellation of a completed operation.",
      "backgroundEvents": []
    },
    {
      "number": 10,
      "flowId": "ALT-msg-create-schema-10",
      "flowKind": "alternate",
      "instruction": "**A10 — Multiple roots or advanced source constructs:** Present a root selector and support report. Supported constructs remain editable; preserved but uneditable constructs are visible in an advanced source panel. If preservation cannot be guaranteed, block generation rather than publishing a simplified replacement.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A10 — Multiple roots or advanced source constructs:** Present a root selector and support report. Supported constructs remain editable; preserved but uneditable constructs are visible in an advanced source panel. If preservation cannot be guaranteed, block generation rather than publishing a simplified replacement.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-msg-create-schema-1",
      "flowKind": "exception",
      "instruction": "**E1 — Malformed source:** Reject loading with file/location details; retain any previously loaded draft. A sample-data file is explained as the wrong input kind rather than accepted as a complete definition.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E1 — Malformed source:** Reject loading with file/location details; retain any previously loaded draft. A sample-data file is explained as the wrong input kind rather than accepted as a complete definition.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-msg-create-schema-2",
      "flowKind": "exception",
      "instruction": "**E2 — Unsupported dialect/construct:** Explain what cannot be edited, generated, or validated. Offer another supported target only with an explicit impact review; do not relabel the source as compatible.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E2 — Unsupported dialect/construct:** Explain what cannot be edited, generated, or validated. Offer another supported target only with an explicit impact review; do not relabel the source as compatible.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "EXC-msg-create-schema-3",
      "flowKind": "exception",
      "instruction": "**E3 — Missing dependency:** Identify the unresolved type/reference and allow the analyst to provide it or select a registered version. Do not discard it or claim successful full validation.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E3 — Missing dependency:** Identify the unresolved type/reference and allow the analyst to provide it or select a registered version. Do not discard it or claim successful full validation.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "EXC-msg-create-schema-4",
      "flowKind": "exception",
      "instruction": "**E4 — Invalid structure/name:** Highlight illegal XML names, duplicate JSON property definitions, invalid parent-child combinations, or flat-file name/position conflicts. Keep the draft editable.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E4 — Invalid structure/name:** Highlight illegal XML names, duplicate JSON property definitions, invalid parent-child combinations, or flat-file name/position conflicts. Keep the draft editable.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "EXC-msg-create-schema-5",
      "flowKind": "exception",
      "instruction": "**E5 — Contradictory constraints:** Reject a minimum above a maximum, incompatible enumeration values, or unsatisfiable local settings detected by validation. General rule satisfiability is not promised; report the validation scope and test gaps.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E5 — Contradictory constraints:** Reject a minimum above a maximum, incompatible enumeration values, or unsatisfiable local settings detected by validation. General rule satisfiability is not promised; report the validation scope and test gaps.",
      "backgroundEvents": []
    },
    {
      "number": 6,
      "flowId": "EXC-msg-create-schema-6",
      "flowKind": "exception",
      "instruction": "**E6 — Broken rule or reference after edit:** Show affected rules when a field is moved, renamed, retyped, or removed. Rebind stable references when safe and require repair where semantics changed. Unresolved enforceable rules block publication.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E6 — Broken rule or reference after edit:** Show affected rules when a field is moved, renamed, retyped, or removed. Rebind stable references when safe and require repair where semantics changed. Unresolved enforceable rules block publication.",
      "backgroundEvents": []
    },
    {
      "number": 7,
      "flowId": "EXC-msg-create-schema-7",
      "flowKind": "exception",
      "instruction": "**E7 — Generation/validation failure:** Keep the working revision and explain the failing field, construct, or service. A failed output is not downloadable as an approved valid pack or publishable as Ready.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E7 — Generation/validation failure:** Keep the working revision and explain the failing field, construct, or service. A failed output is not downloadable as an approved valid pack or publishable as Ready.",
      "backgroundEvents": []
    },
    {
      "number": 8,
      "flowId": "EXC-msg-create-schema-8",
      "flowKind": "exception",
      "instruction": "**E8 — Duplicate publication version, proposed:** Preserve the draft and existing version. Ask for a new version/identity; do not silently overwrite.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E8 — Duplicate publication version, proposed:** Preserve the draft and existing version. Ask for a new version/identity; do not silently overwrite.",
      "backgroundEvents": []
    },
    {
      "number": 9,
      "flowId": "EXC-msg-create-schema-9",
      "flowKind": "exception",
      "instruction": "**E9 — Publication failure or uncertainty:** Display a confirmed failure or unconfirmed result accurately. Do not automatically repeat an uncertain write; check its result before retrying. Preserve the generated revision for recovery.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E9 — Publication failure or uncertainty:** Display a confirmed failure or unconfirmed result accurately. Do not automatically repeat an uncertain write; check its result before retrying. Preserve the generated revision for recovery.",
      "backgroundEvents": []
    },
    {
      "number": 10,
      "flowId": "EXC-msg-create-schema-10",
      "flowKind": "exception",
      "instruction": "**E10 — Size/complexity limit:** State the actual supported limit and affected source. Keep navigation bounded with lazy branch loading and recursion markers; do not truncate a definition silently.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E10 — Size/complexity limit:** State the actual supported limit and affected source. Keep navigation bounded with lazy branch loading and recursion markers; do not truncate a definition silently.",
      "backgroundEvents": []
    },
    {
      "number": 11,
      "flowId": "EXC-msg-create-schema-11",
      "flowKind": "exception",
      "instruction": "**E11 — Concurrent draft change, proposed:** Detect a stale saved revision and offer reload/compare or a separate copy. Do not silently replace another analyst's saved edits.",
      "screenId": "SCR-msgCreateSchema",
      "assetIds": [
        "SCR-msgCreateSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E11 — Concurrent draft change, proposed:** Detect a stale saved revision and offer reload/compare or a separate copy. Do not silently replace another analyst's saved edits.",
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

### Observed implementation and gaps

Source review: registerSchemaRoutes.ts registers build, draft, tests, publish and pack routes; the attachment's POST /api/v1/catalog/schemas is not registered. schemaBuilder.ts has one tree model and draft-07 JSON guidance; this does not establish full dialect support, JSON null/scalar/reference semantics or a complete flat layout editor. The route capability note says unpublished drafts stay in process memory and published packs are on disk: this is not the proposed durable-draft or immutable-business-version guarantee. live-bind-parts/part-09.js through part-11.js contain #sbe-schema-builder, format selection, generation and publication controls; publication performs draft/sample/test operations before publish. The benchmark's proposed action IDs below are not verified DOM IDs. Source navigation is Message Schemes, while Message Designer is the confirmed intended parent. Retained metadata is not evidence of a runtime match.

### Supplied detailed specification

1. The supplied document identifies `POST /api/v1/catalog/schemas`. Its request/response, draft/version support, transaction behavior, and publication semantics have not been independently verified. No new endpoint is asserted by this specification.
2. The attachment describes a live-bind overlay `overlayCreateSchema`, selector `#sbe-schema-builder`, rather than a native `CONFIG.pages` entry. Treat these as source-reported implementation details requiring repository verification.
3. The attachment's repeated create API events on Name root, Add children, and Generate have been removed from the proposed contract. The event inventory is not a directive to persist on every interaction.
4. Replace duplicated submenu identifiers on inferred action buttons with distinct action identities during implementation. Error conditions are findings, not buttons.
5. Proposed working model uses stable field/rule IDs plus format-specific metadata and source mappings. Display JSONPath/XPath to analysts where useful; maintain precise schema locations for findings independently of those display paths.
6. Preserve unknown supported extension data and dependency identity. A semantic round-trip check concerns constraints and meaning, not whitespace, source formatting, or attribute order.
7. Proposed validation layers: editor consistency, target schema compilation/meta-schema validation, rule compilation, sample-instance validation, and publication revision checks. Passing one layer is not passing all layers.
8. Proposed generated package includes primary definition, dependency files or pinned references, runtime-rule manifest when needed, business version, and generation revision. Documentation and samples are separate labelled artefacts.
9. Runtime-rule language, flat-file layout serialization, and package manifest contract are unresolved implementation choices; no proprietary standard is invented here.
10. External schema dependencies must use the application's controlled resolution mechanism rather than unrestricted fetching of arbitrary local/network resources. Parsing must not execute uploaded content.
11. Proposed publication requests bind to the validated revision and support outcome lookup to avoid duplicate writes after an uncertain result. Backend contract confirmation is required.

### Screen and action contract

The editor first asks for schema type, then renders the appropriate structure and property controls. A schema name identifies the catalogue entry; it is separate from an XML root element name, a JSON document root, and a flat-file record name. The following contract is a proposed interaction specification, not a verified implementation inventory. Retained catalogue identifiers come from the supplied use case. New identifiers require implementation mapping.

```json
{
  "screenId": "SCR-msgCreateSchema",
  "screenName": "Create schema",
  "navigation": {
    "menuAssetId": "MENU-message-designer",
    "menuLabel": "Message Designer",
    "submenuAssetId": "SUBMENU-msg-create-schema",
    "submenuLabel": "Create schema"
  },
  "verification": "needs-review",
  "editorModes": [
    {"type": "XML", "surface": "element-and-attribute-tree"},
    {"type": "JSON", "surface": "object-property-and-array-tree"},
    {"type": "flat", "surface": "ordered-field-table"}
  ],
  "startModes": ["blank", "use-existing", "upload-definition"],
  "actions": [
    {"assetId": "CTL-msg-create-schema-type", "label": "Schema type", "mainStep": 2, "persists": false},
    {"assetId": "CTL-msg-create-schema-start", "label": "Start from", "mainStep": 3, "persists": false},
    {"assetId": "CTL-msg-create-schema-details", "label": "Schema details", "mainStep": 4, "persists": false},
    {"assetId": "CTL-msg-create-schema-structure", "label": "Structure", "mainStep": 5, "persists": false},
    {"assetId": "BTN-msg-create-schema-add-children", "label": "Add field or child", "mainStep": 6, "persists": false},
    {"assetId": "CTL-msg-create-schema-properties", "label": "Field properties", "mainStep": 7, "persists": false},
    {"assetId": "CTL-msg-create-schema-rules", "label": "Rules and allowed values", "mainStep": 8, "persists": false},
    {"assetId": "BTN-msg-create-schema-validate", "label": "Validate schema", "mainStep": 10, "persists": false},
    {"assetId": "BTN-msg-create-schema-generate-artefact", "label": "Generate artefact", "mainStep": 12, "persists": false},
    {"assetId": "BTN-msg-create-schema-publish", "label": "Publish", "mainStep": 14, "persists": true}
  ],
  "eventInventoryFromAttachment": ["api.post.catalog.schemas"],
  "backgroundEvents": [],
  "provenance": "Revised design specification; runtime and API mappings are not verified"
}
```

#### Screen layout and interaction

| Area | Required behavior |
|---|---|
| Setup | Select XML, JSON, or flat file before detailed editing. Choose blank, registered schema, or uploaded definition. Enter schema name, description, business version, and applicable standard/dialect. |
| Structure | XML and JSON use a collapsible tree. Flat files use an ordered field table. Show names, types, presence/cardinality summaries, and rule/error indicators without requiring source-code editing. |
| Properties | Selecting a tree node or table row displays its current settings. Offer Basic, Constraints, Allowed values, Rules, and Advanced groups. Only show controls relevant to the selection and format. |
| Preview and findings | Show the generated definition, optional sample data, and validation findings. Selecting a finding reveals the affected field and property. Distinguish schema-definition errors from sample-message failures. |
| Actions | Add, edit, duplicate, move, delete, validate, generate, download, and publish. Proposed additions: undo/redo, Save draft, and a comparison against the starting version. |

Expansion controls marked plus/minus open or collapse a branch; they never add or delete fields. Separate, labelled Add child and Delete actions change the structure. Selecting a node immediately loads its cardinality, type, constraints, and rules. Applying a valid property edit updates its tree summary; invalid input stays visible with an error and does not silently replace the last valid setting.

The tree must support keyboard navigation and visible focus, with accessible expanded/collapsed state and selected-node indication. Arrow keys navigate and expand branches; keyboard users have equivalents for adding and moving fields. This interaction recommendation follows the W3C tree-view pattern.[^1]

#### XML editor

Start with a named document element. Provide Add child element, Add attribute, Add group, and Use existing type. The tree distinguishes declarations, attributes, sequence/choice groups, and referenced types. Namespaces are explicit; a prefix is a display alias, not the namespace identity. An uploaded definition with multiple candidate global elements prompts selection of the message root and retains other definitions as dependencies.

Expose minimum and maximum occurrences for applicable element/group particles, with an Unbounded option. Attribute presence uses required/optional/prohibited settings rather than repeating-element controls. Nil permission is separate from omission. Advanced settings cover sequence, choice, supported all-groups, type reuse, namespace qualification, identity constraints, and XSD 1.1 assertions when the selected engine supports them. These are XML-specific semantics, not interchangeable JSON controls.[^2]

Provide simple and complex content, documentation, default/fixed values where legal, and a visible distinction between a field's local settings and constraints inherited from a reusable type. Changes to a shared type show affected uses before application. The editor must not flatten shared definitions into unrelated copies without an explicit choice. Basic XML Schema concepts and reusable types are described in the W3C primer.[^3]

#### JSON editor

Start with a visual document-root node, using an object by default. Its display name is not automatically emitted as a wrapper property. Offer object, array, and scalar root types in the proposed full editor; a scalar root is a valid JSON document and is not rejected merely for having no children.[^4]

Objects expose named properties, presence, null permission, and a policy for unspecified properties. Property presence belongs to its containing object; declaring a property does not make it required. Omission, null, empty text, and an empty object remain different states. Advanced closure settings must respect composition rather than indiscriminately applying a closed-object flag.[^5]

Arrays expose an item definition, minimum/maximum item count, uniqueness, and advanced tuple/contains controls when supported. Array presence is independent of item count: an optional array may be absent even when its allowed present value requires at least one item. Repeated JSON data uses an array, not duplicate object property names.[^6]

Show reusable definitions and references as linked nodes. Expanding a recursive reference displays its target and a recursion marker rather than constructing an infinite tree. The selected dialect and reference context must be preserved during import and generation.[^7]

#### Flat-file editor

Render a single record as ordered rows, not a nested XML-like tree. Choose Delimited or Fixed width. CSV is a delimited profile, not a complete schema language. Start with one record type; multiple record types, headers/trailers, and hierarchical record groups are an extension requiring a separately defined grammar.

| Setting | Delimited record | Fixed-width record |
|---|---|---|
| Field location | Explicit column ordinal and optional header label | Start position and width, with computed end position |
| File settings | Delimiter, quote/escape behavior, header presence, encoding, line ending | Encoding, line ending, record length, width measured in bytes or characters |
| Empty values | Define empty token, null token, trimming, and missing trailing column behavior | Define blank/filler representation; an optional value does not remove its physical slot |
| Formatting | Decimal separator, date/time representation, boolean tokens | Alignment, padding character, decimal representation, date/time representation |
| Structural checks | Expected column count and valid quoting | No overlapping fields; gaps explicitly represented as filler; record width reconciles |

CSV quoting must handle delimiters, quotes, and line breaks within values. RFC 4180 documents common CSV conventions; it is informational, not a universal flat-file schema standard.[^8] CSVW provides a useful foundation for delimited-file metadata such as dialect, encoding, column datatypes, and required values.[^9]

Fixed-width settings above are proposed product requirements. They must be captured in a documented, versioned layout definition; this specification does not claim CSVW standardizes the proposed fixed-width representation. A downloadable CSV field dictionary is documentation unless a defined importer consumes it as a schema.

#### Field properties, constraints, and allowed values

| Property group | Analyst-facing controls and behavior |
|---|---|
| Identity | Name, display label, description, stable internal field identifier, read-only current path or column position, and examples. Renaming changes the path but preserves the internal identity. |
| Structure | Field kind, parent, ordering where meaningful, scalar/container/reference distinction, and compatible child actions. |
| Presence | Mandatory, optional, or conditional; separate null/nil permission and empty-value policy. A rule's enabled state is separate from whether its target field is mandatory. |
| Text | Free text, digits-only text, alphanumeric preset, or custom pattern; minimum, maximum, or exact length; whitespace and case policy. Presets state their actual allowed characters. |
| Numbers | Integer or decimal/number, inclusive/exclusive bounds, allowed increment, and applicable precision/scale settings. Display formatting is separate from numeric validation. |
| Date/time | Date, time, or date-time; accepted representation and timezone policy. A display mask is not proof of calendar validity. Invalid dates must fail an enforcing validator. |
| Boolean | Boolean values for XML/JSON as appropriate; explicit token mapping for text records. |
| Allowed values | Add, edit, remove, paste multiple values, or select a proposed reusable value list. Store typed values separately from display labels and descriptions. |
| Defaults/constants | Default suggestion and fixed/constant value are separate choices. Show whether a default is only documentation or is actually applied by a consuming runtime. |
| Rules | Field or record scope, condition, assertion, failure message, severity, enabled state, and execution support. |

Digits-only identifiers such as `00123` should use text when leading zeros are significant. Numeric bounds do not replace text-length requirements. In XSD, supported datatype facets include lengths, patterns, enumeration, bounds, and decimal digit constraints; fraction digits constrain numeric value precision, not an exact printed number of decimal places.[^10]

For JSON numeric values, use numeric bounds and increments; do not invent an XSD-style numeric precision keyword. Exact lexical formatting belongs to text or a documented application rule.[^11] JSON string length, pattern, and format are distinct settings, and regular-expression behavior must be tested for the target dialect rather than copied from XSD.[^12]

Allowed-value editing validates type consistency and duplicates without silently converting `"1"` to `1`. Removing a value used as a default highlights the conflict. Adding enum values changes the current draft only; it does not silently change a published schema or a shared list used by other versions. Blank, null, and absent are not interchangeable enum entries.

#### Rule authoring and enforcement

Provide a guided rule builder: select the target or scope, choose an operator, select a literal or another field, and define the failure message. Offer an advanced expression view only with its supported language identified. Plain-language descriptions remain documentation until translated into an executable rule; they are never labelled enforced merely because text was entered.

| Rule class | Example | Required editor behavior |
|---|---|---|
| Presence | If payment method is bank transfer, account number is mandatory | Show the condition and affected field; define behavior when the condition field is absent or null. |
| Value | Amount must be positive | Validate the literal/operator against the target datatype. |
| Cross-field | End date must not precede start date | Require compatible types, an evaluation scope, and missing-value behavior. |
| Group choice | Exactly one of account number or token is supplied | Distinguish exactly one from at least one or any combination. |
| Aggregate | Total equals the sum of line amounts | Define repeated-item scope, decimal precision, rounding, and empty-list behavior. |
| Uniqueness/reference | Each line identifier is unique within a message | Specify scope and referenced key; do not imply global database checks from a local schema rule. |
| Lifecycle state | Draft rule, enabled rule, disabled rule | Proposed rule lifecycle; disabled rules are visible and excluded from enforcement, with review before publishing. |

JSON conditionals can express several presence and value-dependent requirements using conditional subschemas and dependencies.[^13] Arbitrary arithmetic across fields is a separate application-rule requirement unless the selected schema language and engine can represent it. The editor labels each rule as Native schema, Application runtime, Documentation only, or Unsupported. An unsupported rule cannot be advertised as enforced.

JSON date/time formats may be annotations rather than validation assertions. The selected validation profile must explicitly identify which format checks are enforced; a successful schema parse alone is insufficient evidence. JSON defaults are annotations and do not themselves populate missing values.[^14]

#### Version and draft behavior

Keep **business schema version**, **schema-language dialect**, and **working revision** separate. A version such as `2.0` is not the same as XSD 1.1 or a JSON Schema draft. Display the starting schema and version when reusing one.

Proposed lifecycle: Editing draft → Validated revision → Generated revision → Published/Ready. A structure, constraint, rule, or target-format edit makes the generated revision stale; publishing must use a newly validated/generated revision. This is a Create schema publication requirement, not a change to the separate Import schema use case's file-change policy.

Proposed publication policy: published versions are immutable; modifying a registered schema creates a new business version or an independent copy. A duplicate name/identity/version produces a conflict rather than overwriting an existing published version. The override choice agreed for direct import is not automatically inherited by Create schema. Version naming, identity scope, and retention require product confirmation.

### Review findings and proposed decisions

The supplied four-step use case omits the information needed to implement a dependable editor: type-specific structure, existing-schema loading, property selection, constraints, rule execution, and revision control. Its precondition excludes existing schemas even though reuse is now part of the goal. The revised flow removes that restriction and preserves generation followed by explicit publication.

The statement that formats change only artefact shape is replaced by separate XML, JSON, and flat-file models. The blanket ban on childless roots is narrowed to a meaningful product-profile check. Catalogue metadata copied from the attachment is not independent evidence of runtime behavior.

The following are proposed defaults, not established implementation capabilities:

| Decision | Proposed default | Outstanding detail |
|---|---|---|
| Language support | Record actual dialect and capability profile; retain broad version support as a target | Tested dialect/version inventory, selected default, advanced construct coverage |
| Publication versions | Immutable published versions; create new version or copy | Identity scope, version syntax, retention, conflict policy |
| Flat-file grammar | Delimited and fixed width, one record type | Layout serialization, byte/character-width defaults, multi-record scope |
| Rules | Guided builder with explicit native/runtime distinction | Runtime language, operators, rounding/timezone behavior, package consumer support |
| Drafts | Explicit Save draft, undo/redo, compare before publish | Persistence/recovery guarantees and concurrency behavior |
| Upload sources | Registered schema or schema definition | Whether OpenAPI components, PDF/Markdown field dictionaries, or sample inference are included in this editor |
| Scalar roots | Permit valid JSON scalar/array roots and XML simple content | Whether a business message profile intentionally restricts them |
| State | Schema lifecycle and rule enabled state are separate | Any additional meaning of state-dependent business rules |
| Scale | Lazy expansion and reference markers | Measured file-size, node-count, depth, and response-time targets |

Import schema remains a separate use case. Its previously accepted upload formats and duplicate/coverage decisions do not automatically define Create schema's editing or publication behavior. PDF/Markdown descriptions may inform a layout, but do not guarantee machine-readable constraint recovery without a defined mapping and review.

### Sources

Standards were consulted on 10 September 2026. Technical semantics are sourced below; editor layout, workflow, lifecycle, and packaging choices are design recommendations. The supplied `uc-msgcreateschema.md` is the baseline for existing screen names, catalogue identifiers, and the single listed endpoint; its implementation claims remain unverified.

[^1]: W3C WAI, [Tree View Pattern, ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/), living guidance. Supports hierarchy navigation, expansion, focus, and selection behavior.
[^2]: W3C, [XML Schema Definition Language 1.1 Part 1: Structures](https://www.w3.org/TR/xmlschema11-1/), Recommendation, 5 April 2012. Supports XML structural distinctions, occurrence constraints, attributes, and assertions.
[^3]: W3C, [XML Schema Part 0: Primer, Second Edition](https://www.w3.org/TR/xmlschema-0/), 28 October 2004. Supports basic XML modelling and reusable type concepts.
[^4]: IETF, [RFC 8259: The JavaScript Object Notation Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259.html), December 2017. Supports JSON document values and object/array distinctions.
[^5]: JSON Schema, [Understanding JSON Schema: Objects](https://json-schema.org/understanding-json-schema/reference/object), living documentation. Supports required properties and additional-property semantics.
[^6]: JSON Schema, [Understanding JSON Schema: Arrays](https://json-schema.org/understanding-json-schema/reference/array), living documentation. Supports item definitions, array limits, tuples, and uniqueness.
[^7]: JSON Schema, [Draft 2020-12 Core](https://json-schema.org/draft/2020-12/json-schema-core), 2020-12 dialect specification. Supports dialects, references, and recursive-evaluation considerations.
[^8]: IETF, [RFC 4180: Common Format and MIME Type for CSV Files](https://www.rfc-editor.org/rfc/rfc4180.html), October 2005, Informational. Supports common delimited-file quoting conventions.
[^9]: W3C, [Metadata Vocabulary for Tabular Data](https://www.w3.org/TR/tabular-metadata/), Recommendation, 17 December 2015. Supports explicit delimited-table metadata.
[^10]: W3C, [XML Schema Definition Language 1.1 Part 2: Datatypes](https://www.w3.org/TR/xmlschema11-2/), Recommendation, 5 April 2012. Supports datatype facets and value-space precision distinctions.
[^11]: JSON Schema, [Understanding JSON Schema: Numeric Types](https://json-schema.org/understanding-json-schema/reference/numeric), living documentation. Supports numeric bounds and multiples.
[^12]: JSON Schema, [Understanding JSON Schema: Strings](https://json-schema.org/understanding-json-schema/reference/string), living documentation. Supports text length, pattern, and format distinctions.
[^13]: JSON Schema, [Understanding JSON Schema: Conditional Schema Validation](https://json-schema.org/understanding-json-schema/reference/conditionals), living documentation. Supports conditions and dependencies.
[^14]: JSON Schema, [Draft 2020-12 Validation](https://json-schema.org/draft/2020-12/json-schema-validation), 2020-12 dialect specification. Supports format annotation/assertion and default annotation distinctions.

### External regression coverage

The independent Test Engine links this use case by ID UC-msgCreateSchema and name Create a schema. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/catalog/schemas/build` | [apps/api/src/modules/registerSchemaRoutes.ts:100](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `POST /api/v1/catalog/schemas/drafts` | [apps/api/src/modules/registerSchemaRoutes.ts:85](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `GET /api/v1/catalog/schemas/drafts/:id` | [apps/api/src/modules/registerSchemaRoutes.ts:69](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `POST /api/v1/catalog/schemas/drafts/:id/tests` | [apps/api/src/modules/registerSchemaRoutes.ts:89](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `POST /api/v1/catalog/schemas/drafts/:id/publish` | [apps/api/src/modules/registerSchemaRoutes.ts:92](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `GET /api/v1/catalog/schemas/drafts/:id/pack` | [apps/api/src/modules/registerSchemaRoutes.ts:96](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `POST /api/v1/catalog/schemas/validate` | [apps/api/src/modules/registerSchemaRoutes.ts:77](../../apps/api/src/modules/registerSchemaRoutes.ts) |
| `GET /api/v1/catalog/schemas/baselines` | [apps/api/src/modules/registerSchemaRoutes.ts:52](../../apps/api/src/modules/registerSchemaRoutes.ts) |

### Handbook

#### Three artefacts

Case = guarantees and flows. Handbook = XML/JSON/flat semantics. Decisions = proposed gates not yet accepted. Import schema remains a separate case; its confirmed override choice does not settle duplicate identity or apply to Create publication.

#### Persist rule

Validate, expand, generate, and download do not persist. Only Publish writes Ready. Save draft is proposed and non-Ready. Lost publication response is unconfirmed and is not auto-retried.

#### XML editor

Named document element. Add child, attribute, group, or existing type. Occurs for particles; attributes use required/optional/prohibited. Nil is separate from omission. Namespaces are identity; prefixes are display aliases.

#### JSON editor

Visual root is not a wrapper property. Required and nullable are independent. Optional arrays may be omitted even when a present array must be non-empty. Recursive refs expand to a marker, not an infinite tree.

#### Flat-file editor

Ordered rows, not an XML tree. Delimited vs fixed width. CSV quoting follows the selected dialect. Fixed-width overlaps and unexplained gaps block generation. A CSV dictionary is documentation unless an importer consumes it as schema.

#### Findings

Each blocking finding names a path or setting and focuses that control. Sample failures are not schema-definition failures. Stale generation blocks Publish.

### Proposed decisions

- **D-dialect: Language support.** Proposed: Record actual dialect and capability profile; retain broad version support as a target. Outstanding: Tested dialect/version inventory, selected default, advanced construct coverage.
- **D-versions: Publication versions.** Proposed: Immutable published versions; create new version or copy. Outstanding: Identity scope, version syntax, retention, conflict policy.
- **D-flat: Flat-file grammar.** Proposed: Delimited and fixed width, one record type. Outstanding: Layout serialization, byte/character-width defaults, multi-record scope.
- **D-rules: Rules.** Proposed: Guided builder with Native schema / Application runtime / Documentation only / Unsupported. Outstanding: Runtime language, operators, rounding/timezone behavior, package consumer support.
- **D-drafts: Drafts.** Proposed: Explicit Save draft, undo/redo, compare before publish. Outstanding: Persistence/recovery guarantees and concurrency behavior.
- **D-upload: Upload sources.** Proposed: Registered schema or schema definition. Outstanding: Whether OpenAPI components, PDF/Markdown dictionaries, or sample inference are in this editor.
- **D-scalar: Scalar roots.** Proposed: Permit valid JSON scalar/array roots and XML simple content. Outstanding: Whether a business message profile intentionally restricts them.
- **D-scale: Scale.** Proposed: Lazy expansion and reference markers. Outstanding: Measured file-size, node-count, depth, and response-time targets.
## Scenarios

1. **XML order:** Create `Order` with `OrderId` and repeated `Line` children. Set `Line` to 1..unbounded, add an optional currency attribute, set quantity bounds, expand/collapse the line branch, and generate an XSD.
2. **JSON order:** Use an object root, mandatory digits-only `orderId`, and optional `lines` array with 1..3 items when present. The property inspector distinguishes required status from array size.
3. **CSV payments:** Define five ordered columns: payment ID, method, account, amount, and date. Select quoting and empty-token rules; retain an empty optional account column without shifting amount/date.
4. **Fixed-width payment:** Define ID at positions 1–5 and amount at 6–15, with explicit width units and padding. An overlap blocks generation; expanding a numeric field requires a reviewed layout adjustment.
5. **Reuse XML:** Load an XSD with a shared address type, choose its message root, expand a reference, and edit a local usage without silently changing all shared uses.
6. **Reuse JSON:** Load a schema with recursive definitions. Expand a branch to a reference marker, edit a nonrecursive field, and regenerate without dropping reference metadata.
7. **Enum additions:** Extend payment method values with a new code and description. The current draft changes; the published source remains unchanged until a new version is published.
8. **Conditional rule:** Require account when method is bank transfer. Sample tests cover transfer with account, transfer without account, another method, and missing method.
9. **Cross-field rule:** Require end date to be on/after start date. The editor displays whether the target supports native enforcement or requires an application rule.
10. **Stale generation:** Generate a schema, change a field's cardinality, and attempt Publish. The editor requires validation/regeneration for the new revision.
11. **Scalar JSON:** Define a string document root with a length restriction. The visual root label does not become a JSON property and no artificial child is required.
12. **Publication:** Publish a valid current revision; find the exact business version marked Ready in Schema register. An uncertain response produces an unconfirmed result instead.

## Gherkin

```gherkin
Feature: Create and refine a schema visually

  Scenario Outline: Render the selected editor
    Given the analyst opens Create schema
    When the analyst selects <type>
    Then the system displays <editor>
    And offers only applicable field properties
    Examples:
      | type      | editor              |
      | XML       | an XML tree         |
      | JSON      | a JSON tree         |
      | flat file | an ordered table    |

  Scenario: Load a definition as editable starting content
    Given a supported valid schema definition and its dependencies
    When the analyst chooses Upload definition
    Then its structure and constraints populate the editor
    And no schema is published

  Scenario: Edit a copy of a registered version
    Given a registered schema version is selected
    When the analyst changes a field in the working copy
    Then the source version remains unchanged

  Scenario: Expand without modifying the model
    Given a collapsed parent has child fields
    When the analyst selects its expansion control
    Then the children become visible
    And the model revision is unchanged

  Scenario: Show selected field properties
    Given a field has a configured type and cardinality
    When the analyst selects that field
    Then the property panel shows those settings and its rules

  Scenario: Keep presence separate from null
    Given a JSON property is required and allows null
    When sample instances are validated
    Then a present null value satisfies those two settings
    And an omitted property fails the presence requirement

  Scenario: Optional array with a nonempty present value
    Given an optional JSON array permits one to three items
    When sample instances are validated
    Then omission is allowed
    And a present empty array fails
    And four items fail

  Scenario: Preserve digits-only identifiers
    Given a text field requires exactly five digits
    When the analyst tests the value "00123"
    Then it passes and retains its leading zeros
    And "12A45" fails

  Scenario: Add an enumeration entry
    Given the allowed values are "CARD" and "CASH"
    When the analyst adds "TRANSFER" with a description
    Then the current draft contains the new allowed value
    And the published source version is unchanged

  Scenario: Conditional presence rule
    Given account is mandatory when method is "TRANSFER"
    When a sample contains that method without account
    Then the rule fails with its configured message

  Scenario: Disclose unsupported rule enforcement
    Given a cross-field rule cannot run in the selected target profile
    When the analyst validates the schema
    Then the system identifies the unsupported rule
    And does not claim it is enforced

  Scenario: Reject overlapping fixed-width fields
    Given two field position ranges overlap
    When the analyst generates the layout
    Then generation is blocked with a location-specific finding

  Scenario: Preserve unknown source semantics
    Given an uploaded definition contains an uneditable construct
    And correct preservation cannot be guaranteed
    When the analyst generates an artefact
    Then generation is blocked rather than silently dropping it

  Scenario: Prevent publication of stale output
    Given an artefact has been generated
    When the analyst changes a schema constraint
    Then the artefact is marked stale
    And Publish requires validation and generation of the new revision

  Scenario: Publish the current valid version
    Given the current revision has valid generated output
    When the analyst selects Publish and saving succeeds
    Then that version appears in Schema register as Ready

  Scenario: Handle an uncertain publication result
    Given publication was submitted
    When its result cannot be confirmed
    Then the system shows an unconfirmed outcome
    And does not automatically submit another publication

  @AC-10 @specification
  Scenario Outline: Required nullable JSON property
    Given a required JSON string property allows null
    When the instance contains <value>
    Then presence and type validation <result>
    Examples:
      | value           | result |
      | no property     | fails  |
      | null            | passes |
      | an empty string | passes |
      | text            | passes |
      | a number        | fails  |

  @AC-12 @specification
  Scenario Outline: Optional bounded array
    Given an optional JSON array allows one to three items
    When the instance contains <value>
    Then array cardinality validation <result>
    Examples:
      | value        | result |
      | no property  | passes |
      | zero items   | fails  |
      | one item     | passes |
      | two items    | passes |
      | three items  | passes |
      | four items   | fails  |
      | null         | fails  |

  @AC-16 @specification
  Scenario Outline: Five digit identifier boundaries
    Given a string identifier requires exactly five ASCII digits
    When the value is <value>
    Then validation <result> without numeric coercion
    Examples:
      | value  | result |
      | 00123  | passes |
      | 12345  | passes |
      | 1234   | fails  |
      | 123456 | fails  |
      | 12A45  | fails  |
      | -1234  | fails  |

  @AC-17 @specification
  Scenario Outline: Numeric range boundaries
    Given a decimal field is greater than zero and at most one hundred
    When the value is <value>
    Then range validation <result>
    Examples:
      | value  | result |
      | -0.01  | fails  |
      | 0      | fails  |
      | 0.01   | passes |
      | 100    | passes |
      | 100.01 | fails  |

```
