Feature: Coverage reports

  @UC-repCoverage @AC-01 @specification
  Scenario: Partial scope
    Given six of ten rules were exercised
    When coverage is calculated by rule count
    Then coverage is 60% with four untested rules

  @UC-repCoverage @AC-02 @specification
  Scenario: No rules
    Given the denominator is zero
    When coverage renders
    Then it does not claim 100%

  @UC-repCoverage @AC-03 @specification
  Scenario: Failed tests
    Given all ten rules were exercised and two failed
    When coverage is displayed
    Then coverage and the 80% pass rate remain distinct

  @UC-repCoverage @AC-04 @specification
  Scenario: Stale evidence
    Given a rule changed after testing
    When coverage is reviewed
    Then the evidence revision is disclosed
