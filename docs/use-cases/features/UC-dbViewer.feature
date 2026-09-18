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
