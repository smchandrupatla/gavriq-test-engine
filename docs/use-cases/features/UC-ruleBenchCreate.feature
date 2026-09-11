Feature: Create new rule

  @UC-ruleBenchCreate @AC-01 @specification
  Scenario: Threshold boundary
    Given amount_gte is configured at 100
    When 99, 100 and 101 are evaluated
    Then 99 does not match while 100 and 101 match

  @UC-ruleBenchCreate @AC-02 @specification
  Scenario: Missing kind
    Given condition.kind is missing
    When Save rule is submitted
    Then the request is rejected with no confirmed created rule

  @UC-ruleBenchCreate @AC-03 @specification
  Scenario: Field equality
    Given field_equals compares paymentMethod with TRANSFER
    When the field is absent
    Then the missing value is not silently treated as TRANSFER

  @UC-ruleBenchCreate @AC-04 @specification
  Scenario: Save uncertainty
    Given a valid save was submitted
    When the response is lost
    Then the outcome is unconfirmed until the stored rule is checked
