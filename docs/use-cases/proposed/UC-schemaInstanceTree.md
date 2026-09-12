# Inspect a schema instance tree

- **ID:** UC-schemaInstanceTree
- **Screen:** Schema and file tree
- **Level:** 1
- **Style:** casual
- **Actor:** Message analyst
- **Extends from:** none
- **Extends to:** UC-msgImportSchema, UC-msgSchemaCanvas

## Goal
Open the standalone schema-and-file tree page that the console labels Import schema.

## Precondition
1. The operator can open /schema-tree.html.
2. apps/web/public/js/schema-tree-view.js is present.

## Trigger
Operator opens /schema-tree.html.

## Success guarantee
1. The page title in the document is “Sand Bench · Schema and file tree”.
2. The visible page-head title text is “Import schema”.
3. schema-tree-view.js is requested.

## Minimal guarantee (on failure)
1. A missing tree script leaves the empty <main> rather than writing a scheme.
2. This page must not be treated as a confirmed upload.

## Acceptance criteria
1. **AC-01 — Page loads:** Given /schema-tree.html is requested, when HTML renders, the head title names Schema and file tree and the page-head title reads Import schema.
2. **AC-02 — Script hook:** Given the page loads, when scripts run, /js/schema-tree-view.js is requested.
3. **AC-03 — No upload implied:** Given only this page is opened, when no further confirm-upload action occurs, no scheme persistence is claimed.
4. **AC-04 — Title collision [proposed]:** Given use-case-bind.js title-matches “Import schema”, when this page is open, the viewer must not silently treat the sidecar as the CONFIG Import schema form if that is the wrong document — mapping should use the path.

## Main flow
1. **Actor:** Opens /schema-tree.html.
   **System:** Shows a Back to console link, a page-head title Import schema, and an empty main filled by schema-tree-view.js.
2. **Actor:** Reads the tree if the script renders one.
   **System:** Further interpretation of nodes is owned by that script; this case does not invent node operations.

## Alternate flows
1. **A1 — Return:** Back to console navigates to /.

## Exception flows
1. **E1 — Missing script:** If schema-tree-view.js fails to load, main stays empty. No scheme write occurs.
2. **E2 — Title-match risk:** Binder title-match on “Import schema” can attach UC-msgImportSchema to this sidecar. That is a mapping defect to fix with a pathPages entry, not accepted product behaviour.

## Business validation
1. Viewing a tree is not importing a scheme.
2. Official Import schema persistence remains UC-msgImportSchema.

## Technical notes / APIs
1. Observed: apps/web/public/schema-tree.html. Script src /js/schema-tree-view.js. This review did not inline the script body into the acceptance criteria.
2. Not in FEATURE_PAGES. Proposed page key schemaInstanceTree. Proposed path map schema-tree.html → schemaInstanceTree.
3. Classification: observed shell. Tree interactions remain unresolved until schema-tree-view.js is reviewed line-by-line.

### Screen and action contract
Page key proposed `schemaInstanceTree`. Route `/schema-tree.html`. Visible title text `Import schema` (collision with CONFIG.pages.msgImportSchema). Script `/js/schema-tree-view.js`.

### Research and sources
Not applicable beyond XSD instance-tree viewing as a documentation surface.

### Proposed decisions and open questions
Unresolved: operations inside schema-tree-view.js (expand, select, download). Unresolved: relationship to /reference.html declared in consoleScreens but not found as apps/web/public/reference.html in this pass.

## Scenarios
1. Page loads with both titles visible.
2. Script hook requests schema-tree-view.js.
3. Opening the page alone does not persist a scheme.
4. Use-case mapping should use the path, not the Import schema title.

## Gherkin
```gherkin
Feature: Inspect a schema instance tree

  @UC-schemaInstanceTree @AC-01 @specification
  Scenario: Page loads
    Given /schema-tree.html is requested
    When HTML renders
    Then the head title names Schema and file tree
    And the page-head title reads Import schema

  @UC-schemaInstanceTree @AC-03 @specification
  Scenario: No upload implied
    Given only this page is opened
    When no further confirm-upload action occurs
    Then no scheme persistence is claimed
```
