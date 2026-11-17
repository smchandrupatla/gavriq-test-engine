Feature: Create new rule

  @UC-ruleBenchCreate @AC-01 @specification
  Scenario: Threshold boundary
    Given a numeric field has a >= condition configured at 100
    When 99, 100 and 101 are evaluated
    Then 99 does not match while 100 and 101 match

  @UC-ruleBenchCreate @AC-02 @specification
  Scenario: Unbuilt condition
    Given the Conditions step has nothing built
    When Save rule is attempted
    Then Save is blocked with a specific reason and no rule is created

  @UC-ruleBenchCreate @AC-03 @specification
  Scenario: Field equality
    Given an equals condition compares a field with a specific value
    When the field is absent from the sample
    Then the missing value is not silently treated as a match

  @UC-ruleBenchCreate @AC-04 @specification
  Scenario: Save uncertainty
    Given a valid save was submitted
    When the response is lost
    Then the outcome is unconfirmed until the stored rule is checked

  @UC-ruleBenchCreate @AC-05 @specification
  Scenario: Independent test outcomes
    Given a sample fails schema validation
    When the rule condition is still evaluated against it
    Then the schema-invalid and rule-match results are shown separately, not merged into one "no match"

  @UC-ruleBenchCreate @AC-06 @specification
  Scenario: Unmappable condition
    Given a condition uses an operator the saved-rule format has no equivalent for
    When the analyst reaches Review
    Then Save is disabled and the specific unmapped reason is shown, not a silent approximation
