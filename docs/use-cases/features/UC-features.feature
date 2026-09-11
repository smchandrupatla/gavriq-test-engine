Feature: Features

  @UC-features @AC-01 @specification
  Scenario: Tenant scope
    Given no user override is selected
    When a level-1 grant is saved
    Then the saved target is the tenant default

  @UC-features @AC-02 @specification
  Scenario: User scope
    Given user U is explicitly selected
    When a grant is saved
    Then the override is associated with U

  @UC-features @AC-03 @specification
  Scenario: Restricted API
    Given the effective level is lower than a protected route requires
    When that route is called
    Then the feature-level gate rejects it

  @UC-features @AC-04 @specification
  Scenario: No RBAC substitute
    Given a feature is visible
    When the operator lacks its write permission
    Then visibility is not treated as write authorisation
