Feature: Users

  @UC-users @AC-01 @specification
  Scenario: List
    Given a tenant has two members
    When admin users are retrieved
    Then the returned members are shown without invented rows

  @UC-users @AC-02 @specification
  Scenario: Effective access
    Given user U is selected
    When effective access is requested
    Then the request targets U

  @UC-users @AC-03 @specification
  Scenario: Read only
    Given access details are inspected
    When the view closes
    Then no assignment changes

  @UC-users @AC-04 @specification
  Scenario: Unavailable CRUD
    Given the old /api/v1/users path is unregistered
    When the specification is read
    Then it does not claim that path is a verified capability
