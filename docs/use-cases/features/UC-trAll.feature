Feature: All test runs

  @UC-trAll @AC-01 @specification
  Scenario: All states
    Given completed and failed runs exist
    When the list loads
    Then both outcomes are represented

  @UC-trAll @AC-02 @specification
  Scenario: Pagination
    Given 25 runs exist with page size 10
    When page one renders
    Then ten visible rows are not described as the entire total

  @UC-trAll @AC-03 @specification
  Scenario: Empty
    Given the store confirms zero runs
    When the list renders
    Then an empty state appears

  @UC-trAll @AC-04 @specification
  Scenario: Unknown duration
    Given an end timestamp is missing
    When duration is shown
    Then the duration is unknown rather than fabricated
