# Import a schema

- **ID:** UC-msgImportSchema
- **Screen:** Import schema
- **Page key:** `msgImportSchema`
- **Level:** 2
- **Style:** casual
- **Actor:** Rule / data analyst
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Import a message schema or field-layout definition, optionally with accompanying Markdown documentation, review validation findings, and explicitly confirm the import into the Schema register.

## Precondition

1. The analyst has a schema or field-layout definition ready to upload.
2. The analyst may also have corresponding Markdown documentation.
3. CSV, PDF, and Markdown layout inputs contain the field definitions needed for import.

## Trigger

The analyst opens Message Designer > Import schema.

## Success guarantee

1. The selected input is readable and parses successfully.
2. Accompanying Markdown, when supplied, is readable and checked against the schema fields.
3. Any coverage mismatch is disclosed, and the analyst explicitly chooses to proceed before importing the mismatched content.
4. Any detected duplicate is disclosed, and the analyst explicitly chooses override before replacing the existing record.
5. The analyst confirms the import, and the system confirms that the selected content has been saved in the Schema register.
6. The result displays applicable schema metadata, including family, code, field count, and constraint rules (C-rules), where available.

## Minimal guarantee (on failure)

1. File selection does not automatically create a Schema register record.
2. A malformed input or unreadable accompanying Markdown causes the upload to be rejected, with an explanatory error.
3. Coverage mismatches and duplicates are never silently accepted; each requires an explicit user decision.
4. Stop halts the upload attempt and retains the selected files in memory.
5. Cancel ends the upload attempt and clears the selected files from memory without deleting the original files from the user's computer.
6. If saving fails or its outcome is uncertain, the system does not report success or retry automatically. An uncertain outcome is identified as unconfirmed; the system does not claim that nothing was saved without confirmation.
7. Atomic saving and rollback of partial records are not requirements of this use case. Stop and Cancel do not imply rollback of content already persisted.

## Acceptance criteria

1. **AC-01 [gate]** Input formats: Valid XSD, JSON Schema, OpenAPI, CSV, PDF, and Markdown schema or field-layout inputs can be selected and processed. CSV, PDF, and Markdown inputs must describe the fields or layout to import. JSON is treated as JSON Schema.
2. **AC-02 [gate]** Standard versions: All versions of the stated schema standards are in scope. Acceptance evidence must identify the versions exercised and their results; passing a sample does not establish support for untested or future versions. A version test inventory remains to be defined.
3. **AC-03 [gate]** Explicit confirmation: Selecting files, completing validation, or choosing Proceed on a warning does not save a register record. Saving begins only after final confirmation.
4. **AC-04 [gate]** Optional documentation: A valid input can be imported without accompanying Markdown. The system indicates its absence and skips the accompanying-documentation coverage check. A Markdown layout input is treated separately from optional accompanying documentation.
5. **AC-05 [gate]** Validation order and matching: The system parses the input before checking accompanying Markdown coverage. Coverage matching uses JSONPath for JSON-based schemas, XPath for XML schemas, and field names for flat-file layouts.
6. **AC-06 [gate]** Malformed input: A malformed schema or layout input is rejected with a parsing error. Import cannot proceed with that malformed input.
7. **AC-07 [gate]** Unreadable Markdown: Unreadable accompanying Markdown causes rejection with an explanatory error. The system does not silently remove the documentation or import only the schema.
8. **AC-08 [gate]** Coverage warning: Missing documentation for any schema leaf field, including an optional field, or documentation of fields absent from the schema produces a warning describing the mismatch and offering Proceed or Cancel upload.
9. **AC-09 [gate]** Proceed with mismatched coverage: Choosing Proceed keeps both the schema and accompanying Markdown selected for combined import. Other validation checks and final confirmation still apply; the warning does not force schema-only import.
10. **AC-10 [gate]** Cancel coverage mismatch: Choosing Cancel upload from a coverage warning ends the attempt, clears the selected files from memory, and creates no register record for that attempt. Original local files are unchanged.
11. **AC-11 [gate]** Duplicate warning: A detected duplicate produces a warning offering Proceed with override or Cancel upload. No automatic rejection or replacement occurs solely because a duplicate is detected.
12. **AC-12 [gate]** Confirmed override: Choosing Proceed with override and then confirming replaces the existing schema record with the uploaded content. Without explicit override, the duplicate record is not replaced.
13. **AC-13 [gate]** Cancel duplicate: Choosing Cancel upload from a duplicate warning ends the attempt and clears the selected files from memory. The existing record and original local files remain unchanged.
14. **AC-14 [gate]** Multiple warnings: When both a coverage mismatch and a duplicate occur, the analyst must explicitly accept the coverage mismatch and the override before final confirmation can save the content. Accepting one warning does not accept the other.
15. **AC-15 [gate]** Field count: Only fields with no child elements contribute to field count. Grouping containers are excluded, and repeating structures contribute their leaf fields once, regardless of occurrence count. For example, a root with one scalar leaf and a repeating group containing two leaf fields has a field count of three.
16. **AC-16 [gate]** Result metadata: Following confirmed successful saving, the result displays the applicable available metadata, including family, code, leaf-field count, and constraint rules. C-rules denotes constraint rules.
17. **AC-17 [gate]** Stop before saving: Choosing Stop before saving is submitted halts processing, retains selected files in memory, and creates no register record. Processing does not continue without another user action.
18. **AC-18 [gate]** Cancel before saving: Choosing Cancel before saving is submitted ends the attempt, clears selected files from memory, and creates no register record. Original local files are not deleted.
19. **AC-19 [gate]** Stop or Cancel after submission: If saving has already been submitted, the system accurately reports the known save status. It does not imply that Stop or Cancel reversed a completed save. Stop retains the selected files in memory; Cancel clears them.
20. **AC-20 [gate]** Confirmed save failure: A confirmed save failure is reported as failed, no success result is displayed, and no automatic retry occurs.
21. **AC-21 [gate]** Uncertain save outcome: An uncertain save outcome is reported as unconfirmed, not successful. The system does not retry automatically or claim that no content was saved unless that is confirmed.

## Main flow

1. The analyst opens Import schema.
2. The system displays the schema or field-layout file selection and an optional accompanying Markdown selection.
3. The analyst selects an XSD, JSON Schema, OpenAPI, CSV, PDF, or Markdown input containing the schema or field-layout definition.
4. The analyst optionally selects accompanying Markdown documentation.
5. The system reads and parses the selected input. Malformed files follow exception flow E1.
6. If accompanying Markdown is supplied, the system reads it and cross-checks its field coverage. Unreadable Markdown follows exception flow E2.
7. The system identifies documented fields using JSONPath for JSON-based schemas, XPath for XML schemas, and field names for flat-file layouts.
8. The system displays parsing results, Markdown coverage findings, and available metadata. Coverage mismatches follow alternate flow A2.
9. The system checks for an existing duplicate. A detected duplicate follows alternate flow A3.
10. The analyst reviews the results and explicitly confirms the import.
11. The system saves the selected content, replacing the existing record only when the analyst has explicitly selected override.
12. The system displays a successful import result with applicable metadata, field count, and constraint rules.

## Alternate flows

1. **A1 — Import without accompanying Markdown:** At main-flow step 4, the analyst does not select accompanying Markdown. The system parses the schema or field-layout input and skips the accompanying-documentation coverage check. The system indicates that no accompanying Markdown is included. The flow continues with duplicate checking, review, confirmation, and saving.
2. **A2 — Markdown coverage mismatch:** At main-flow step 8, the system identifies missing documentation for schema leaf fields, including optional fields, or Markdown fields absent from the schema. The system displays a warning describing the mismatches and offers Proceed or Cancel upload. If the analyst selects Proceed, the schema and accompanying Markdown remain selected for combined import despite the coverage warning. The flow continues at step 9, subject to other validation checks and final confirmation. If the analyst selects Cancel upload, the attempt ends and the selected files are cleared from memory. The original files remain unchanged.
3. **A3 — Duplicate detected:** At main-flow step 9, the system detects an existing duplicate and displays a warning. The system offers Proceed with override or Cancel upload. If the analyst selects Proceed with override, the system records the explicit replacement choice and continues to final confirmation at step 10. On confirmed import, the uploaded content replaces the existing schema record. If the analyst selects Cancel upload, the attempt ends and the selected files are cleared from memory. The existing record and original local files remain unchanged.
4. **A4 — Stop upload:** While the upload attempt is active, the analyst selects Stop. The system halts further processing for the attempt and retains the selected files in memory. No further import processing proceeds without another user action. If saving has already been submitted, its status is reported accurately; Stop does not promise to reverse a completed save.
5. **A5 — Cancel upload:** While the upload attempt is active, the analyst selects Cancel. The system ends the attempt and clears the selected files from memory. The original files on the user's computer are not deleted. If saving has already been submitted, its status is reported accurately; Cancel does not promise to reverse a completed save.

## Exception flows

1. **E1 — Malformed input:** The system cannot parse the selected schema or field-layout input because it is malformed. The system rejects the upload and displays the parsing error. The analyst must correct or replace the file before a successful import can proceed.
2. **E2 — Unreadable accompanying Markdown:** The system cannot read the accompanying Markdown. The system rejects the upload and displays the error. The system does not silently discard the Markdown or continue with schema-only import.
3. **E3 — Save failure or uncertain save outcome:** The save operation fails or does not return a definitive outcome. The system reports a confirmed failure as failed, or an uncertain outcome as unconfirmed. The system does not display a successful import result and does not retry automatically. The system does not assert that no record was saved unless that is confirmed.

## Business validation

1. Do not auto-import on file selection. Require explicit final confirmation before saving.
2. JSON means JSON Schema.
3. All versions of the stated schema standards are in scope; actual parser capability must be verified separately.
4. CSV, PDF, and Markdown are accepted field-layout definition formats. Unspecified additional formats are not yet defined requirements.
5. Match Markdown references using JSONPath, XPath, or flat-file field names, as applicable.
6. Missing field documentation, including optional fields, and extra Markdown fields produce warnings. Allow explicit Proceed or Cancel upload.
7. Coverage warnings do not force schema-only import. Proceed permits the schema and accompanying Markdown to be imported together.
8. Duplicate detection produces a warning with Proceed with override or Cancel upload. Do not automatically reject or overwrite a duplicate.
9. The exact duplicate-detection criterion remains unresolved: identical file content, normalized content, or matching schema identity. The scope of duplicate checking also remains unresolved.
10. Malformed files block import. Unreadable accompanying Markdown causes rejection.
11. Count leaf fields only: fields with no child elements. Exclude grouping containers. Count a repeating structure once, using its first instance rather than multiplying by its occurrences.
12. C-rules means constraint rules.
13. Stop retains selected files in memory. Cancel clears them from memory. Neither deletes original local files.
14. No import-specific permission requirement, automatic revalidation-on-file-change requirement, or atomic schema-and-Markdown saving requirement is added by this use case.
15. Do not retry automatically after a failed or uncertain save.

## Technical notes / APIs

1. Confirmed product specification. The observed implementation and gaps below are separate from these required outcomes.
2. POST /api/v1/catalog/iso/parse
3. POST /api/v1/catalog/iso/import
4. POST /api/v1/catalog/iso/uploads
5. GET /api/v1/catalog/iso/uploads/:id
6. POST /api/v1/catalog/iso/validate-markdown

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-msgImportSchema",
  "screenName": "Import schema",
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
      "assetId": "SUBMENU-msg-import-schema",
      "kind": "submenu",
      "name": "Import schema",
      "label": "Import schema",
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
      "assetId": "SUBMENU-msg-import-schema",
      "kind": "submenu",
      "name": "Import schema",
      "label": "Import schema",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-msgImportSchema",
      "kind": "screen",
      "name": "Import schema",
      "label": "Import schema",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-msg-import-schema-1",
      "flowKind": "main",
      "instruction": "The analyst opens Import schema.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-msg-import-schema-2",
      "flowKind": "main",
      "instruction": "The system displays the schema or field-layout file selection and an optional accompanying Markdown selection.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-msg-import-schema-3",
      "flowKind": "main",
      "instruction": "The analyst selects an XSD, JSON Schema, OpenAPI, CSV, PDF, or Markdown input containing the schema or field-layout definition.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-msg-import-schema-4",
      "flowKind": "main",
      "instruction": "The analyst optionally selects accompanying Markdown documentation.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-msg-import-schema-5",
      "flowKind": "main",
      "instruction": "The system reads and parses the selected input. Malformed files follow exception flow E1.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 6,
      "flowId": "MAIN-msg-import-schema-6",
      "flowKind": "main",
      "instruction": "If accompanying Markdown is supplied, the system reads it and cross-checks its field coverage. Unreadable Markdown follows exception flow E2.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 7,
      "flowId": "MAIN-msg-import-schema-7",
      "flowKind": "main",
      "instruction": "The system identifies documented fields using JSONPath for JSON-based schemas, XPath for XML schemas, and field names for flat-file layouts.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 8,
      "flowId": "MAIN-msg-import-schema-8",
      "flowKind": "main",
      "instruction": "The system displays parsing results, Markdown coverage findings, and available metadata. Coverage mismatches follow alternate flow A2.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 9,
      "flowId": "MAIN-msg-import-schema-9",
      "flowKind": "main",
      "instruction": "The system checks for an existing duplicate. A detected duplicate follows alternate flow A3.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 10,
      "flowId": "MAIN-msg-import-schema-10",
      "flowKind": "main",
      "instruction": "The analyst reviews the results and explicitly confirms the import.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 11,
      "flowId": "MAIN-msg-import-schema-11",
      "flowKind": "main",
      "instruction": "The system saves the selected content, replacing the existing record only when the analyst has explicitly selected override.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 12,
      "flowId": "MAIN-msg-import-schema-12",
      "flowKind": "main",
      "instruction": "The system displays a successful import result with applicable metadata, field count, and constraint rules.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-msg-import-schema-1",
      "flowKind": "alternate",
      "instruction": "**A1 — Import without accompanying Markdown:** At main-flow step 4, the analyst does not select accompanying Markdown. The system parses the schema or field-layout input and skips the accompanying-documentation coverage check. The system indicates that no accompanying Markdown is included. The flow continues with duplicate checking, review, confirmation, and saving.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A1 — Import without accompanying Markdown:** At main-flow step 4, the analyst does not select accompanying Markdown. The system parses the schema or field-layout input and skips the accompanying-documentation coverage check. The system indicates that no accompanying Markdown is included. The flow continues with duplicate checking, review, confirmation, and saving.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-msg-import-schema-2",
      "flowKind": "alternate",
      "instruction": "**A2 — Markdown coverage mismatch:** At main-flow step 8, the system identifies missing documentation for schema leaf fields, including optional fields, or Markdown fields absent from the schema. The system displays a warning describing the mismatches and offers Proceed or Cancel upload. If the analyst selects Proceed, the schema and accompanying Markdown remain selected for combined import despite the coverage warning. The flow continues at step 9, subject to other validation checks and final confirmation. If the analyst selects Cancel upload, the attempt ends and the selected files are cleared from memory. The original files remain unchanged.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A2 — Markdown coverage mismatch:** At main-flow step 8, the system identifies missing documentation for schema leaf fields, including optional fields, or Markdown fields absent from the schema. The system displays a warning describing the mismatches and offers Proceed or Cancel upload. If the analyst selects Proceed, the schema and accompanying Markdown remain selected for combined import despite the coverage warning. The flow continues at step 9, subject to other validation checks and final confirmation. If the analyst selects Cancel upload, the attempt ends and the selected files are cleared from memory. The original files remain unchanged.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "ALT-msg-import-schema-3",
      "flowKind": "alternate",
      "instruction": "**A3 — Duplicate detected:** At main-flow step 9, the system detects an existing duplicate and displays a warning. The system offers Proceed with override or Cancel upload. If the analyst selects Proceed with override, the system records the explicit replacement choice and continues to final confirmation at step 10. On confirmed import, the uploaded content replaces the existing schema record. If the analyst selects Cancel upload, the attempt ends and the selected files are cleared from memory. The existing record and original local files remain unchanged.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A3 — Duplicate detected:** At main-flow step 9, the system detects an existing duplicate and displays a warning. The system offers Proceed with override or Cancel upload. If the analyst selects Proceed with override, the system records the explicit replacement choice and continues to final confirmation at step 10. On confirmed import, the uploaded content replaces the existing schema record. If the analyst selects Cancel upload, the attempt ends and the selected files are cleared from memory. The existing record and original local files remain unchanged.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "ALT-msg-import-schema-4",
      "flowKind": "alternate",
      "instruction": "**A4 — Stop upload:** While the upload attempt is active, the analyst selects Stop. The system halts further processing for the attempt and retains the selected files in memory. No further import processing proceeds without another user action. If saving has already been submitted, its status is reported accurately; Stop does not promise to reverse a completed save.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A4 — Stop upload:** While the upload attempt is active, the analyst selects Stop. The system halts further processing for the attempt and retains the selected files in memory. No further import processing proceeds without another user action. If saving has already been submitted, its status is reported accurately; Stop does not promise to reverse a completed save.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "ALT-msg-import-schema-5",
      "flowKind": "alternate",
      "instruction": "**A5 — Cancel upload:** While the upload attempt is active, the analyst selects Cancel. The system ends the attempt and clears the selected files from memory. The original files on the user's computer are not deleted. If saving has already been submitted, its status is reported accurately; Cancel does not promise to reverse a completed save.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**A5 — Cancel upload:** While the upload attempt is active, the analyst selects Cancel. The system ends the attempt and clears the selected files from memory. The original files on the user's computer are not deleted. If saving has already been submitted, its status is reported accurately; Cancel does not promise to reverse a completed save.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-msg-import-schema-1",
      "flowKind": "exception",
      "instruction": "**E1 — Malformed input:** The system cannot parse the selected schema or field-layout input because it is malformed. The system rejects the upload and displays the parsing error. The analyst must correct or replace the file before a successful import can proceed.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E1 — Malformed input:** The system cannot parse the selected schema or field-layout input because it is malformed. The system rejects the upload and displays the parsing error. The analyst must correct or replace the file before a successful import can proceed.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-msg-import-schema-2",
      "flowKind": "exception",
      "instruction": "**E2 — Unreadable accompanying Markdown:** The system cannot read the accompanying Markdown. The system rejects the upload and displays the error. The system does not silently discard the Markdown or continue with schema-only import.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E2 — Unreadable accompanying Markdown:** The system cannot read the accompanying Markdown. The system rejects the upload and displays the error. The system does not silently discard the Markdown or continue with schema-only import.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "EXC-msg-import-schema-3",
      "flowKind": "exception",
      "instruction": "**E3 — Save failure or uncertain save outcome:** The save operation fails or does not return a definitive outcome. The system reports a confirmed failure as failed, or an uncertain outcome as unconfirmed. The system does not display a successful import result and does not retry automatically. The system does not assert that no record was saved unless that is confirmed.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "**E3 — Save failure or uncertain save outcome:** The save operation fails or does not return a definitive outcome. The system reports a confirmed failure as failed, or an uncertain outcome as unconfirmed. The system does not display a successful import result and does not retry automatically. The system does not assert that no record was saved unless that is confirmed.",
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

### Observed implementation and gaps

Source review: registerIsoCatalog.ts parses fileName/content. The old /iso/import returns 202 accepted with a generated job ID; it does not save an import record in that handler. /iso/uploads handles stored imports and has content-fingerprint duplicate handling. Its actual duplicate scope does not settle the unresolved product identity policy. Existing import binders contain XSD-only fallback and rejection behavior superseded by this specification. The full format/version matrix, CSV/PDF/Markdown field-layout extraction, JSONPath/XPath coverage matching, Proceed with both files, override and Stop/Cancel behavior remain implementation gaps until exercised. All standard versions remain product scope, not a parser-conformance assertion. Source navigation is Message Schemes > Import Scheme; the confirmed intended navigation is Message Designer > Import schema. Existing application access checks are observed, not a new import-specific requirement. No atomic save, automatic revalidation or automatic retry is added.

### Supplied detailed specification

1. Validation occurs in two passes: parse the schema or layout definition, then cross-check accompanying Markdown coverage when supplied.
2. Final confirmation initiates persistence; coverage and duplicate warnings require their own explicit decisions before this step.
3. Source-listed validation endpoint: `POST /api/v1/catalog/iso/parse`.
4. Source-listed import endpoint: `POST /api/v1/catalog/iso/import`.
5. Endpoint support for all stated formats and versions, extraction from PDF/CSV/Markdown layouts, and duplicate override has not been verified. These are requirements to map to the API contract, not confirmed existing capabilities.
6. A Markdown field-layout input and optional accompanying Markdown documentation have distinct roles in this flow.
7. No UML include or extend relationship has been established. The retained Extends fields do not indicate sequence or first/last steps.
8. Supported inputs include XSD, JSON Schema, OpenAPI, and field-layout definitions supplied as CSV, PDF, or Markdown. All standard versions are in scope as a product requirement; this is not a statement of verified parser support. Additional formats must be identified before they can be treated as supported.

```json
{
  "screenId": "SCR-msgImportSchema",
  "screenName": "Import schema",
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
      "assetId": "SUBMENU-msg-import-schema",
      "kind": "submenu",
      "name": "Import schema",
      "label": "Import schema",
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
      "assetId": "SUBMENU-msg-import-schema",
      "kind": "submenu",
      "name": "Import schema",
      "label": "Import schema",
      "parentAssetId": "MENU-message-designer",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-msgImportSchema",
      "kind": "screen",
      "name": "Import schema",
      "label": "Import schema",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "CTL-msg-import-schema-choose-schema-file",
      "kind": "control",
      "name": "Choose schema file",
      "label": "Choose schema file",
      "parentAssetId": "SCR-msgImportSchema",
      "icon": "FormInput",
      "color": "slate",
      "variant": "secondary",
      "eventCode": "gui.action.msg-import-schema.choose-schema-file",
      "auditAction": "msg-import-schema.update",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "CTL-msg-import-schema-optional-markdown",
      "kind": "control",
      "name": "Optional markdown",
      "label": "Optional markdown",
      "parentAssetId": "SCR-msgImportSchema",
      "icon": "FormInput",
      "color": "slate",
      "variant": "secondary",
      "eventCode": "gui.action.msg-import-schema.optional-markdown",
      "auditAction": "msg-import-schema.update",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "BTN-msg-import-schema-validate-tags-vs-markdown",
      "kind": "button",
      "name": "Validate tags vs markdown",
      "label": "Validate tags vs markdown",
      "parentAssetId": "SCR-msgImportSchema",
      "icon": "ArrowRight",
      "color": "slate",
      "variant": "secondary",
      "eventCode": "gui.action.msg-import-schema.validate-tags-vs-markdown",
      "auditAction": "msg-import-schema.update",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "BTN-msg-import-schema-upload",
      "kind": "button",
      "name": "Confirm import",
      "label": "Confirm import",
      "parentAssetId": "SCR-msgImportSchema",
      "icon": "Upload",
      "color": "gold",
      "variant": "primary",
      "eventCode": "gui.action.msg-import-schema.upload",
      "auditAction": "msg-import-schema.update",
      "source": "inferred",
      "verification": "needs-review"
    },
    {
      "assetId": "BTN-msg-import-schema-proceed",
      "kind": "button",
      "name": "Proceed",
      "label": "Proceed",
      "parentAssetId": "SCR-msgImportSchema",
      "source": "proposed",
      "verification": "needs-review"
    },
    {
      "assetId": "BTN-msg-import-schema-override",
      "kind": "button",
      "name": "Proceed with override",
      "label": "Proceed with override",
      "parentAssetId": "SCR-msgImportSchema",
      "source": "proposed",
      "verification": "needs-review"
    },
    {
      "assetId": "BTN-msg-import-schema-stop",
      "kind": "button",
      "name": "Stop",
      "label": "Stop",
      "parentAssetId": "SCR-msgImportSchema",
      "source": "proposed",
      "verification": "needs-review"
    },
    {
      "assetId": "BTN-msg-import-schema-cancel",
      "kind": "button",
      "name": "Cancel upload",
      "label": "Cancel upload",
      "parentAssetId": "SCR-msgImportSchema",
      "source": "proposed",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-msg-import-schema-1",
      "flowKind": "main",
      "instruction": "Select a schema or field-layout input.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema",
        "CTL-msg-import-schema-choose-schema-file"
      ],
      "alternativeFlowIds": [
        "ALT-msg-import-schema-4",
        "ALT-msg-import-schema-5"
      ],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The selected file is held for validation; no import occurs.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-msg-import-schema-2",
      "flowKind": "main",
      "instruction": "Optionally select accompanying Markdown.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema",
        "CTL-msg-import-schema-optional-markdown"
      ],
      "alternativeFlowIds": [
        "ALT-msg-import-schema-1",
        "ALT-msg-import-schema-4",
        "ALT-msg-import-schema-5"
      ],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The documentation selection is recorded; no import occurs.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-msg-import-schema-3",
      "flowKind": "main",
      "instruction": "Parse the input, check documentation coverage when supplied, and check for duplicates.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema",
        "BTN-msg-import-schema-validate-tags-vs-markdown"
      ],
      "alternativeFlowIds": [
        "ALT-msg-import-schema-2",
        "ALT-msg-import-schema-3",
        "ALT-msg-import-schema-4",
        "ALT-msg-import-schema-5"
      ],
      "exceptionFlowIds": [
        "EXC-msg-import-schema-1",
        "EXC-msg-import-schema-2"
      ],
      "invokesUseCases": [],
      "outcome": "Findings are displayed; blocking failures reject the attempt and warnings require explicit choices.",
      "backgroundEvents": [
        "api.post.catalog.iso.parse"
      ]
    },
    {
      "number": 4,
      "flowId": "MAIN-msg-import-schema-4",
      "flowKind": "main",
      "instruction": "Review the results and explicitly confirm import after resolving warnings.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema",
        "BTN-msg-import-schema-upload"
      ],
      "alternativeFlowIds": [
        "ALT-msg-import-schema-4",
        "ALT-msg-import-schema-5"
      ],
      "exceptionFlowIds": [
        "EXC-msg-import-schema-3"
      ],
      "invokesUseCases": [],
      "outcome": "Saving is submitted; success is shown only when confirmed.",
      "backgroundEvents": [
        "api.post.catalog.iso.import"
      ]
    },
    {
      "number": 1,
      "flowId": "ALT-msg-import-schema-1",
      "flowKind": "alternate",
      "instruction": "Proceed without accompanying Markdown.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Coverage checking is skipped; parsing, duplicate checking, and confirmation still apply.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-msg-import-schema-2",
      "flowKind": "alternate",
      "instruction": "On a coverage mismatch, choose Proceed or Cancel upload.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema",
        "BTN-msg-import-schema-proceed",
        "BTN-msg-import-schema-cancel"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Proceed retains both files for final confirmation; Cancel ends the attempt and clears memory.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "ALT-msg-import-schema-3",
      "flowKind": "alternate",
      "instruction": "On a duplicate warning, choose Proceed with override or Cancel upload.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema",
        "BTN-msg-import-schema-override",
        "BTN-msg-import-schema-cancel"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Override authorizes replacement at final confirmation; Cancel leaves the existing record unchanged.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "ALT-msg-import-schema-4",
      "flowKind": "alternate",
      "instruction": "Select Stop.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema",
        "BTN-msg-import-schema-stop"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Processing halts and files remain in memory; an already-submitted save is not promised to roll back.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "ALT-msg-import-schema-5",
      "flowKind": "alternate",
      "instruction": "Select Cancel upload.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema",
        "BTN-msg-import-schema-cancel"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "The attempt ends and files are cleared from memory; original files are not deleted.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-msg-import-schema-1",
      "flowKind": "exception",
      "instruction": "Reject malformed input.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A parsing error is displayed and import is blocked.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-msg-import-schema-2",
      "flowKind": "exception",
      "instruction": "Reject unreadable accompanying Markdown.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "An error is displayed; there is no silent schema-only fallback.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "EXC-msg-import-schema-3",
      "flowKind": "exception",
      "instruction": "Handle failed or uncertain saving.",
      "screenId": "SCR-msgImportSchema",
      "assetIds": [
        "SCR-msgImportSchema"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Report failure or an unconfirmed outcome accurately; do not retry automatically.",
      "backgroundEvents": []
    }
  ],
  "auditActions": [
    "msg-import-schema.update",
    "msg-import-schema.alternate",
    "msg-import-schema.exception"
  ],
  "events": [
    "api.post.catalog.iso.parse",
    "api.post.catalog.iso.import"
  ],
  "backgroundEvents": [],
  "provenance": "Revised specification based on supplied contract and confirmed user decisions; implementation verification pending."
}
```

The contract groups the detailed main flow into four screen actions. Identifiers retained from the attachment are not independently verified against implementation. New decision controls are proposed mappings; existing event and audit identifiers also require implementation review. The top-level events list is an inventory, not an instruction to invoke both APIs on every action. No new API endpoint is specified for duplicate checking. Alternate and exception numbering matches the detailed flows below.

1. The supplied contract names Message Designer as the parent menu; this navigation is used consistently here, pending implementation verification.
2. The attachment lists XML alongside XSD. Whether this means XML instance inference or XML-based schema definitions remains unresolved; generic XML import has not been added to the confirmed format list.
3. Duplicate identity and checking scope remain unresolved. The supplied duplicate-rejection behavior is superseded by the confirmed warning and override choice.
4. The supplied schema-only fallback for incomplete Markdown is superseded by the confirmed combined-import Proceed or Cancel choice.
5. Reused submenu identifiers on inferred action buttons have been removed. Error conditions are modeled as exception outcomes rather than clickable buttons.
6. Parsing events are associated with validation; the import event is associated only with explicit confirmation. The listed endpoints and event mappings remain unverified.

### External regression coverage

The independent Test Engine links this use case by ID UC-msgImportSchema and name Import a schema. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `POST /api/v1/catalog/iso/parse` | [apps/api/src/modules/registerIsoCatalog.ts:65](../../apps/api/src/modules/registerIsoCatalog.ts) |
| `POST /api/v1/catalog/iso/import` | [apps/api/src/modules/registerIsoCatalog.ts:74](../../apps/api/src/modules/registerIsoCatalog.ts) |
| `POST /api/v1/catalog/iso/uploads` | [apps/api/src/modules/registerIsoCatalog.ts:89](../../apps/api/src/modules/registerIsoCatalog.ts) |
| `GET /api/v1/catalog/iso/uploads/:id` | [apps/api/src/modules/registerIsoCatalog.ts:238](../../apps/api/src/modules/registerIsoCatalog.ts) |
| `POST /api/v1/catalog/iso/validate-markdown` | [apps/api/src/modules/registerSignatures.ts:37](../../apps/api/src/modules/registerSignatures.ts) |

## Scenarios

1. The analyst selects `sben.001.001.01.xsd` with matching Markdown, reviews the findings, and confirms. The result shows available family, code, leaf-field count, and constraint rules.
2. The Markdown omits required or optional schema leaf fields. The system warns; Proceed retains both files for import, while Cancel upload ends the attempt and clears them from memory.
3. The Markdown describes fields absent from the schema. The same Proceed or Cancel upload choice is shown.
4. A duplicate is detected. The analyst chooses Proceed with override and confirms replacement, or cancels without replacing the existing record.
5. The selected schema is malformed. The upload is rejected with a parsing error.
6. Accompanying Markdown cannot be read. The upload is rejected.
7. A nested schema has repeating structures. The result counts leaf fields, excludes containers, and counts each repeating structure only once.
8. The analyst selects Stop. Processing halts and the selected files remain in memory.
9. The analyst selects Cancel. The attempt ends and the selected files are cleared from memory; original local files remain intact.
10. A save outcome is uncertain. The system reports it as unconfirmed and does not retry automatically.

## Gherkin

```gherkin
Feature: Import schema

  Scenario: Import a valid schema with matching Markdown
    Given a readable and valid schema is selected
    And readable accompanying Markdown covers the schema fields
    And no duplicate is detected
    When the analyst confirms the import
    Then the selected content is saved in the Schema register
    And a successful import result is displayed

  Scenario: File selection does not save a record
    Given the analyst has opened Import schema
    When the analyst selects an input file
    Then no Schema register record is created by file selection alone

  Scenario: Import without accompanying Markdown
    Given a readable and valid schema is selected
    And no accompanying Markdown is selected
    And no duplicate is detected
    When the analyst confirms the import
    Then the schema is saved without accompanying Markdown

  Scenario Outline: Warn about Markdown coverage mismatches
    Given the schema and accompanying Markdown are readable
    And the schema parses successfully
    And <mismatch>
    When coverage validation completes
    Then the system displays a coverage warning
    And offers Proceed or Cancel upload

    Examples:
      | mismatch                                      |
      | a schema leaf field is undocumented            |
      | an optional schema leaf field is undocumented  |
      | Markdown contains a field absent from schema   |

  Scenario: Proceed despite a coverage warning
    Given a coverage warning is displayed
    When the analyst selects Proceed
    Then both the schema and accompanying Markdown remain selected
    And final confirmation is still required before saving

  Scenario: Override a detected duplicate
    Given the system detects a duplicate under its duplicate rule
    When the analyst selects Proceed with override
    And confirms the import
    Then the uploaded content replaces the existing schema record

  Scenario: Cancel after a duplicate warning
    Given a duplicate warning is displayed
    When the analyst selects Cancel upload
    Then the attempt ends
    And the selected files are cleared from memory
    And the existing schema record is unchanged

  Scenario: Reject a malformed schema
    Given the selected schema is malformed
    When the system parses it
    Then the upload is rejected
    And the parsing error is displayed

  Scenario: Reject unreadable accompanying Markdown
    Given accompanying Markdown is selected
    When the system cannot read it
    Then the upload is rejected
    And the error is displayed

  Scenario: Count leaf fields in repeating structures
    Given a schema contains grouping containers and leaf fields
    And some structures repeat
    When the system calculates field count
    Then grouping containers are excluded
    And leaf fields in repeating structures are counted once

  Scenario: Stop before saving
    Given files are selected and saving has not been submitted
    When the analyst selects Stop
    Then processing halts
    And the selected files remain in memory
    And no record is saved

  Scenario: Cancel before saving
    Given files are selected and saving has not been submitted
    When the analyst selects Cancel
    Then the attempt ends
    And the selected files are cleared from memory
    And the original local files remain unchanged
    And no record is saved

  Scenario: Uncertain save outcome
    Given the analyst has confirmed the import
    When the save outcome cannot be confirmed
    Then the system reports an unconfirmed outcome
    And does not report success
    And does not retry automatically

  @AC-01 @specification
  Scenario Outline: Supported format roles
    Given a valid supported <format> input and its required dependencies
    When the analyst selects it for import
    Then the system interprets it as <role> and waits for confirmation
    Examples:
      | format      | role                      |
      | XSD         | XML schema definition     |
      | JSON Schema | JSON schema definition    |
      | OpenAPI     | API schema source         |
      | CSV         | flat field layout         |
      | PDF         | flat field layout         |
      | Markdown    | flat field layout         |

  @AC-14 @specification
  Scenario Outline: Independent warning decisions
    Given valid readable schema and companion files produce <warnings>
    When the analyst chooses <decision>
    Then the attempt has <outcome>
    Examples:
      | warnings                    | decision                   | outcome                                      |
      | coverage only               | Proceed                    | both files retained awaiting confirmation    |
      | coverage only               | Cancel upload              | ended with in-memory files cleared           |
      | duplicate only              | Proceed with override      | override selected awaiting confirmation      |
      | duplicate only              | Cancel upload              | ended without replacing the existing record  |
      | coverage and duplicate      | Proceed for coverage only  | duplicate decision still required            |
      | coverage and duplicate      | Cancel upload              | ended without replacing the existing record  |

  @AC-17 @AC-18 @AC-19 @specification
  Scenario Outline: Stop and Cancel across submission boundary
    Given the attempt is <state>
    When the analyst selects <action>
    Then the system <outcome>
    Examples:
      | state              | action | outcome                                                  |
      | before submission  | Stop   | halts processing and retains selected files in memory   |
      | before submission  | Cancel | ends the attempt and clears only in-memory selected files |
      | after submission   | Stop   | retains files and reports the actual save outcome       |
      | after submission   | Cancel | clears memory without claiming a committed save was undone |

```
