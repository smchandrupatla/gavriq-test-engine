Feature: Test Cases

  @UC-tcPool @AC-01 @specification
  Scenario: No dataset
    Given a case has no datasetId
    When the pool loads
    Then the case remains visible with the missing reference disclosed

  @UC-tcPool @AC-02 @specification
  Scenario: No execution
    Given a case has never run
    When its definition is inspected
    Then it is not labelled as passed solely because it exists

  @UC-tcPool @AC-03 @specification
  Scenario: Stable identity
    Given two cases have similar names
    When one is opened
    Then the request uses its ID

  @UC-tcPool @AC-04 @specification
  Scenario: Stale edit
    Given the current ETag changed
    When an old If-Match updates the case
    Then the stale write is rejected
