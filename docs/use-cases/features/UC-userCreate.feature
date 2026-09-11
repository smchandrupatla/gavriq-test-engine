Feature: Create new user

  @UC-userCreate @AC-01 @specification
  Scenario: Existing identity
    Given the person already has an account
    When membership creation is reviewed
    Then account reuse is considered separately from duplicate-account creation

  @UC-userCreate @AC-02 @specification
  Scenario: Invalid role
    Given a selected role is unavailable
    When creation is submitted
    Then the intended role is not falsely reported assigned

  @UC-userCreate @AC-03 @specification
  Scenario: Cancelled
    Given creation has not been submitted
    When the administrator cancels
    Then no membership creation is claimed

  @UC-userCreate @AC-04 @specification
  Scenario: Uncertain result
    Given submission has no definitive result
    When status is displayed
    Then the membership outcome remains unconfirmed
