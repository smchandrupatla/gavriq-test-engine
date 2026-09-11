Feature: API access

  @UC-configurationApiAccess @AC-01 @specification
  Scenario: No credential
    Given the API-access row is toggled
    When no credential service is invoked
    Then no API key is claimed created

  @UC-configurationApiAccess @AC-02 @specification
  Scenario: Disabled
    Given access is shown disabled
    When the page is inspected
    Then the display alone is not proof all API routes reject requests

  @UC-configurationApiAccess @AC-03 @specification
  Scenario: Separation
    Given the console session works
    When API access is reviewed
    Then session access is not confused with a new programmatic credential
