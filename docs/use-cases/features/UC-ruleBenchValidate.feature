Feature: Validate rules

  @UC-ruleBenchValidate @AC-01 @specification
  Scenario: Perfect evidence
    Given ten cases have explicit expectations
    When all ten outcomes match
    Then the displayed result identifies ten evaluated cases

  @UC-ruleBenchValidate @AC-02 @specification
  Scenario: Negative test
    Given a malformed input is expected to be rejected
    When the rule correctly rejects it
    Then the test outcome is interpreted against that expectation

  @UC-ruleBenchValidate @AC-03 @specification
  Scenario: No evidence
    Given zero cases were evaluated
    When validation results render
    Then zero cases is not labelled 100% passed

  @UC-ruleBenchValidate @AC-04 @specification
  Scenario: Evaluation error
    Given the validation service fails
    When the response is handled
    Then the screen shows an error rather than a failed business assertion
