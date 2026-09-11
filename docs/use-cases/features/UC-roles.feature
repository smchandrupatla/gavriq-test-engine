Feature: User roles

  @UC-roles @AC-01 @specification
  Scenario: Profiles
    Given functional profiles exist
    When the supported listing is opened
    Then their actual permissions are shown

  @UC-roles @AC-02 @specification
  Scenario: Data scope
    Given a data access profile exists
    When roles are reviewed
    Then data scope is not confused with functional verbs

  @UC-roles @AC-03 @specification
  Scenario: No CRUD
    Given role deletion is unimplemented
    When the operation is considered
    Then the gap is explicit

  @UC-roles @AC-04 @specification
  Scenario: Assignments
    Given a profile is assigned
    When a change is proposed
    Then affected assignments are identified before a lifecycle policy is claimed
