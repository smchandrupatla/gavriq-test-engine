# Use the declared ISO family reference shell

- **ID:** UC-isoFamilyReference
- **Screen:** ISO 20022 family reference
- **Level:** 2
- **Style:** casual
- **Actor:** Message analyst
- **Extends from:** none
- **Extends to:** UC-msgImportSchema

## Goal
Open the declared ISO 20022 family reference shell to browse catalogue fields and pair XSD with markdown.

## Precondition
1. SHELL_PAGES id `reference` declares title "ISO 20022 family reference" and html `/reference.html`.
1. `SHELL_PAGES` id `reference` declares title “ISO 20022 family reference” and html `/reference.html`.
2. Read APIs named on that row: `GET /api/v1/catalog/iso`, `GET /api/v1/catalog/iso/uploads`.
3. Write API named on that row: `POST /api/v1/catalog/iso/uploads`.

## Trigger
Operator navigates to `/reference.html`, or a binder maps that path to page key `reference`.

## Success guarantee
1. When the file exists, the operator can browse ISO family reference content.
2. Until the file exists, the viewer shows unavailable for page `reference` rather than substituting Import schema by title.

## Minimal guarantee (on failure)
1. Missing `apps/web/public/reference.html` does not crash `/` or Import schema.
2. Catalogue import continues on overlayImportSchema (UC-msgImportSchema).

## Acceptance criteria
1. **AC-01 — Declared screen:** SHELL_PAGES id `reference` title is "ISO 20022 family reference" and html is `/reference.html`.
2. **AC-02 — File gap:** `apps/web/public/reference.html` is absent on this SHA.
3. **AC-03 — No silent substitute:** UC-msgImportSchema is not shown as if it were the reference shell.
4. **AC-04 — Import still works:** Level 2 Import schema remains the storage path.

## Main flow
1. **Actor:** Requests `/reference.html`.
   **System:** File is not present on this SHA. Official import lives on `/`.
2. **Actor:** Uses Import schema instead.
   **System:** POST `/api/v1/catalog/iso/uploads` as UC-msgImportSchema.

## Alternate flows
1. **A1 — File added later:** Map the new HTML to page key `reference`. Do not invent widgets before the file exists.

## Exception flows
1. **E1 — Title collision:** Do not title-match schema-tree.html "Import schema" to this screen.
2. **E2 — 404:** Unavailable, not an implicit redirect to Overview.

## Business validation
1. ISO 20022 family codes come from the catalogue parser.
1. When the file exists, the operator can browse ISO family reference content and reach Import schema pairing.
2. Until the file exists, the use-case viewer shows unavailable for page `reference` rather than substituting Import schema by title.

## Minimal guarantee (on failure)
1. Missing `apps/web/public/reference.html` does not crash `/` or Import schema.
2. Catalogue import continues on the official Import schema overlay (UC-msgImportSchema).

## Acceptance criteria
1. **AC-01 — Declared screen:** Given `SHELL_PAGES` is read, when id `reference` is selected, title is “ISO 20022 family reference” and html is `/reference.html`.
2. **AC-02 — File gap:** Given this repository SHA, when `apps/web/public/reference.html` is sought, the file is absent.
3. **AC-03 — No silent substitute:** Given a use-case action is opened on a missing reference page, when documents are resolved, UC-msgImportSchema is not shown as if it were the reference shell.
4. **AC-04 — Import still works:** Given Import schema on `/` is granted at level 2, when the operator uploads via overlayImportSchema, UC-msgImportSchema remains the storage path.

## Main flow
1. **Actor:** Requests `/reference.html`.  
   **System:** On this SHA the static file is not present. Official import lives on `/` (notes on OFFICIAL_SCREENS.msgImportSchema: “Dual-file UI is Reference page until JSX grows a second file control.”).
2. **Actor:** Uses Import schema instead.  
   **System:** `POST /api/v1/catalog/iso/uploads` as UC-msgImportSchema.

## Alternate flows
1. **A1 — File added later:** If `reference.html` is introduced, map the path to page key `reference` and regenerate this case from the new HTML. Do not invent widgets before that file exists.

## Exception flows
1. **E1 — Title collision:** `schema-tree.html` visible title has been “Import schema” in a prior pack. Reference must use its SHELL_PAGES title, not that string.
2. **E2 — 404:** A missing file is unavailable, not an implicit redirect to Overview.

## Business validation
1. ISO 20022 family codes come from the catalogue parser, not from a missing HTML page.
2. Documentation-only keys must not change feature grants.

## Technical notes / APIs
1. Declaration: `apps/api/src/modules/consoleScreens.ts` SHELL_PAGES id `reference`.

### Screen and action contract
Page key `reference`. Route `/reference.html`. Viewer state: unavailable until the file exists.

### Research and sources
ISO 20022 MDR structure is domain context only.

### Proposed decisions and open questions
Ship `reference.html`, retarget msgImportSchema.html, or drop the SHELL_PAGES row. Do not add a new FEATURE_PAGES key.

## Scenarios
1. Declared screen.
2. File absent.
3. No silent substitute.
2. Related official row: OFFICIAL_SCREENS `msgImportSchema` html `/reference.html` with the dual-file note.
3. Observed public HTML on this SHA does not include `reference.html` (code search of `apps/web/public/*.html`).

### Screen and action contract
Page key `reference` (already the SHELL_PAGES id). Route `/reference.html`. Write API `POST /api/v1/catalog/iso/uploads` only after a real page calls it. Viewer state: unavailable until the file exists.

### Research and sources
ISO 20022 Message Definition Report structure is the domain source for field catalogues. This case does not claim an MDR browser is implemented in the missing file.

### Proposed decisions and open questions
Unresolved: ship `reference.html`, point msgImportSchema.html back to `/`, or drop the SHELL_PAGES row. Until one of those happens, treat the screen as declared-but-absent. Do not add a new FEATURE_PAGES key.

## Scenarios
1. SHELL_PAGES declares the screen.
2. The HTML file is absent on this SHA.
3. Viewer does not substitute Import schema.
4. Import overlay still stores schemes.

## Gherkin
```gherkin
Feature: Use the declared ISO family reference shell

  @UC-isoFamilyReference @AC-01 @specification
  Scenario: Declared screen
    Given SHELL_PAGES is read
    When id reference is selected
    Then title is ISO 20022 family reference and html is /reference.html

  @UC-isoFamilyReference @AC-02 @specification
  Scenario: File gap
    Given this repository SHA
    When apps/web/public/reference.html is sought
    Then the file is absent

  @UC-isoFamilyReference @AC-03 @specification
  Scenario: No silent substitute
    Given a use-case action is opened on a missing reference page
    When documents are resolved
    Then UC-msgImportSchema is not shown as if it were the reference shell
```
