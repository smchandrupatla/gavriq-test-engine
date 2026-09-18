# Browse application tables in DB Viewer

- **ID:** UC-dbViewer
- **Screen:** Read-only table viewer
- **Level:** uncertainty — SHELL_PAGES says read-only; help.js documents delete and CLEAR
- **Style:** casual
- **Actor:** Analyst / tester
- **Extends from:** none
- **Extends to:** none

## Goal
Pick an application database, inspect tables, filter columns, and export what is visible without using the Ops Console.

## Precondition
1. DB Viewer container is reachable at `http://127.0.0.1:8090/` as declared in SHELL_PAGES.

## Trigger
Operator opens `http://127.0.0.1:8090/` or help inside that container.

## Success guarantee
1. Choose an application, click a table, filter, download visible rows as Excel, JSON, or SQL inserts (help.js topic `tables`).
2. Power view does not change rows (help.js topic `power`).

## Minimal guarantee (on failure)
1. A down DB Viewer does not take the Ops Console offline.
2. Missing tables render as an empty list.

## Acceptance criteria
1. **AC-01 — Separate shell:** SHELL_PAGES html is `http://127.0.0.1:8090/` and notes say it is not part of the official console.
2. **AC-02 — Browse without SQL:** Column search boxes filter without writing SQL.
3. **AC-03 — Power view is non-mutating:** Help text states no rows are changed on that screen.
4. **AC-04 — Destructive actions are explicit:** Delete and CLEAR warn that writes hit the selected application database.

## Main flow
1. **Actor:** Opens DB Viewer.
   **System:** Separate container.
2. **Actor:** Chooses an application, then a table.
   **System:** Shows rows. Decision A: lists stay empty until the API returns rows.
3. **Actor:** Filters, ticks, downloads, may open Power view.
   **System:** Export buttons; Power view is a FK map.

## Alternate flows
1. **A1 — Help page:** `apps/dbviewer/public/help.html` renders `window.DBV_HELP`.
2. **A2 — Config:** Named postgres URL; export `garviq.dbviewer.connections.v1` can contain passwords.

## Exception flows
1. **E1 — Delete / CLEAR:** Writes. SHELL_PAGES "read-only" note is incomplete.
2. **E2 — Viewer down:** Console continues.

## Business validation
1. DB Viewer is not the Ops Console.
2. CLEAR is for test leftovers, not production wipe.

## Technical notes / APIs
1. SHELL_PAGES id `dbviewer`, read `["/api/tables"]`.
2. Help: `apps/dbviewer/public/help.js`.

### Screen and action contract
Page key `dbviewer`. Route `http://127.0.0.1:8090/`.

### Research and sources
OWASP ASVS — exported connection files with passwords are secrets. Observation only.

### Proposed decisions and open questions
Reconcile SHELL_PAGES read-only label with DELETE/CLEAR. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Separate container.
2. Destructive actions are warned.
2. At least one application connection can be selected (help.js config topic).

## Trigger
Operator opens `http://127.0.0.1:8090/` or `/help.html` inside that container.

## Success guarantee
1. The operator can choose an application, click a table, filter, and download visible rows as Excel, JSON, or SQL inserts — as written in `apps/dbviewer/public/help.js` topic `tables`.
2. Power view does not change rows (help.js topic `power`).

## Minimal guarantee (on failure)
1. A down DB Viewer does not take the Ops Console offline (not-production copy).
2. Missing tables render as an empty list, not invented sample figures.

## Acceptance criteria
1. **AC-01 — Separate shell:** Given SHELL_PAGES id `dbviewer`, when html is read, it is `http://127.0.0.1:8090/` and notes say it is not part of the official console.
2. **AC-02 — Browse without SQL:** Given a connection is selected, when a table name is clicked, rows can be filtered from column search boxes without writing SQL.
3. **AC-03 — Power view is non-mutating:** Given Power view is opened, when the canvas is used, help text states no rows are changed on that screen.
4. **AC-04 — Destructive actions are explicit:** Given help.js topics `tables` and `jobs`, when delete or CLEAR is described, the page warns that those writes hit the selected application database.

## Main flow
1. **Actor:** Opens DB Viewer.  
   **System:** Separate container. Ops Console is unchanged.
2. **Actor:** Chooses an application, then a table.  
   **System:** Shows rows. Decision A still applies: lists stay empty until the API returns rows.
3. **Actor:** Filters, ticks, downloads.  
   **System:** Export buttons above the grid (Excel, JSON, SQL inserts) per help.js.
4. **Actor:** May open Power view.  
   **System:** Foreign-key map; no row changes on that screen.

## Alternate flows
1. **A1 — Help page:** `apps/dbviewer/public/help.html` renders topics from `window.DBV_HELP`.
2. **A2 — Config:** Add a named postgres URL, test connection, export `garviq.dbviewer.connections.v1` (passwords in export — secret).
3. **A3 — Power view one row:** Tick one row, expand parents/children (up to 25 linked rows). Needs real foreign keys.

## Exception flows
1. **E1 — Delete:** Help warns “Remove ticked rows type DELETE.” That writes. SHELL_PAGES “read-only” note is therefore incomplete.
2. **E2 — CLEAR job:** Tick tables, type CLEAR, run job — truncates ticked tables on the selected application.
3. **E3 — Viewer down:** Console continues.

## Business validation
1. DB Viewer is not the Ops Console and must not be marketed as production DBA access.
2. Exported connection files can contain passwords.
3. CLEAR is for test leftovers, not production wipe — help.js wording.

## Technical notes / APIs
1. Declaration: `apps/api/src/modules/consoleScreens.ts` SHELL_PAGES id `dbviewer`, read `["/api/tables"]`.
2. Help sources: `apps/dbviewer/public/help.html`, `apps/dbviewer/public/help.js`.
3. Classification: observed help + declared shell. This review did not execute the viewer container.

### Screen and action contract
Page key `dbviewer` (SHELL_PAGES id). Route `http://127.0.0.1:8090/`. Read API `/api/tables`. Destructive paths exist in help text and must not be hidden by the “read-only” label.

### Research and sources
OWASP ASVS — exported connection documents that embed database passwords are secrets. Observation only.

### Proposed decisions and open questions
Unresolved: reconcile SHELL_PAGES “Read-only table viewer” with help.js DELETE/CLEAR. Either remove write actions or change the SHELL_PAGES title/notes. Do not add this key to FEATURE_PAGES.

## Scenarios
1. Declared as a separate container.
2. Browse and filter without SQL.
3. Power view does not mutate.
4. Delete/CLEAR are warned writes.

## Gherkin
```gherkin
Feature: Browse application tables in DB Viewer

  @UC-dbViewer @AC-01 @specification
  Scenario: Separate shell
    Given SHELL_PAGES id dbviewer
    When html is read
    Then it is http://127.0.0.1:8090/ and is not part of the official console

  @UC-dbViewer @AC-04 @specification
  Scenario: Destructive actions are explicit
    Given help.js topics tables and jobs
    When delete or CLEAR is described
    Then the page warns that those writes hit the selected application database
```
