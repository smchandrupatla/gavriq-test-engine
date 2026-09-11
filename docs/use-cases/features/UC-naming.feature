Feature: Naming conventions

  @UC-naming @AC-01 @specification
  Scenario: Known token
    Given family is pacs
    When a pattern containing {family} is previewed
    Then the supported token expands to pacs

  @UC-naming @AC-02 @specification
  Scenario: Unknown token
    Given the pattern contains {unknown}
    When preview runs
    Then the unknown token is visible rather than silently dropped

  @UC-naming @AC-03 @specification
  Scenario: No reservation
    Given two users preview the same pattern
    When both see a candidate name
    Then neither preview claims to reserve that name

  @UC-naming @AC-04 @specification
  Scenario: No script
    Given a pattern contains script-like text
    When preview runs
    Then the text is not executed
