Feature: Review recorded attack history

  @UC-attackHistory @AC-01 @specification
  Scenario: No token
    Given sessionStorage.sbe_token is missing
    When the page script runs
    Then status tells the operator to sign in on the console first

  @UC-attackHistory @AC-02 @specification
  Scenario: Empty history
    Given a token and data.data is empty
    When render finishes
    Then status is No attack history for this tenant yet

  @UC-attackHistory @AC-03 @specification
  Scenario: Blocked row
    Given a row with blocked not false
    When the row renders
    Then the result cell is Blocked
