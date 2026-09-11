Feature: Create new dataset

  @UC-dsNew @AC-01 @specification
  Scenario: Create shell
    Given a valid name is supplied
    When dataset creation succeeds
    Then a dataset identity exists without claiming assembly

  @UC-dsNew @AC-02 @specification
  Scenario: Blank name
    Given name is blank
    When creation is submitted
    Then validation rejects the name

  @UC-dsNew @AC-03 @specification
  Scenario: Assembly
    Given two valid source items are selected
    When assembly succeeds
    Then the returned messages and sequence can be inspected

  @UC-dsNew @AC-04 @specification
  Scenario: Assembly failure
    Given the shell exists but assembly fails
    When results render
    Then the shell is not falsely described as a completed batch
