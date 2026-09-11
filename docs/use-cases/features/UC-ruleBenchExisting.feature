Feature: Existing rules

  @UC-ruleBenchExisting @AC-01 @specification
  Scenario: Empty library
    Given no rules exist
    When the library loads
    Then no fabricated rule is listed

  @UC-ruleBenchExisting @AC-02 @specification
  Scenario: Rule identity
    Given two rules have the same display label
    When one rule is opened
    Then its stable ID identifies the retrieved condition

  @UC-ruleBenchExisting @AC-03 @specification
  Scenario: No validation
    Given a rule has no validation result
    When its coverage is displayed
    Then the absence is distinguished from a measured zero or perfect score

  @UC-ruleBenchExisting @AC-04 @specification
  Scenario: Read only
    Given the operator lacks write access
    When the rule is inspected
    Then reading does not change its lifecycle
