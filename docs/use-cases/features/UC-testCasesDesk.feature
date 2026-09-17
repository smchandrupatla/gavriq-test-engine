Feature: View, clone, and queue test cases on the sidecar desk

  @UC-testCasesDesk @AC-01 @specification
  Scenario: Empty list
    Given the API returns no rows
    When the desk renders
    Then the list text is No test cases yet.

  @UC-testCasesDesk @AC-04 @specification
  Scenario: Queue is not evidence
    Given Run now or Run selected succeeds
    When the status line says Run queued
    Then that text is not treated as Test Engine pass evidence
