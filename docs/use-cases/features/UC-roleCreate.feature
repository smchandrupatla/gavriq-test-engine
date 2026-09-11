Feature: Create user role

  @UC-roleCreate @AC-01 @specification
  Scenario: Permission vocabulary
    Given an unknown permission is entered
    When the role is validated
    Then the unsupported permission is identified

  @UC-roleCreate @AC-02 @specification
  Scenario: Reuse
    Given an equivalent role already exists
    When a new role is proposed
    Then the existing grouping can be reviewed before duplication

  @UC-roleCreate @AC-03 @specification
  Scenario: Separate level
    Given a role is associated with level 2
    When permissions are reviewed
    Then level 2 is not interpreted as every write permission

  @UC-roleCreate @AC-04 @specification
  Scenario: No implementation
    Given no create-role route is registered
    When creation is requested
    Then the gap is disclosed rather than a false success
