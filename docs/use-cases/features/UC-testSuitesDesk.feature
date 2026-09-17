Feature: Compose, membership-edit, and queue suites on the sidecar desk

  @UC-testSuitesDesk @AC-01 @specification
  Scenario: Empty list
    Given no suites
    When the desk renders
    Then the list text is No suites yet.

  @UC-testSuitesDesk @AC-05 @specification
  Scenario: Delete keeps cases
    Given delete is confirmed
    When suites are removed
    Then the confirm text is Delete selected suites? Cases stay.
