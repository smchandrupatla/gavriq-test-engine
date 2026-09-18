Feature: Sign in to the Ops Console

  @UC-sessionLogin @AC-01 @specification
  Scenario: Required fields
    Given any of tenantSlug, username, or password is omitted
    When login is posted
    Then the API rejects the request and no token is stored

  @UC-sessionLogin @AC-02 @specification
  Scenario: Successful session
    Given valid tenant credentials
    When login succeeds
    Then a token is available for later API calls

  @UC-sessionLogin @AC-04 @specification
  Scenario: Failed credentials
    Given credentials or tenant are rejected
    When login completes
    Then the operator remains on the gate
