Feature: User roles

  @UC-configurationUserRoles @AC-01 @specification
  Scenario: Informational row
    Given the row mentions Analyst, Reviewer and Admin
    When it is displayed
    Then those labels are not claimed to be the full tenant assignment list

  @UC-configurationUserRoles @AC-02 @specification
  Scenario: No creation
    Given the row is toggled
    When no provisioning route is called
    Then no new role is claimed

  @UC-configurationUserRoles @AC-03 @specification
  Scenario: Separate identity
    Given the roles case also exists
    When this page opens its use case
    Then the configuration subpage identity is preserved
