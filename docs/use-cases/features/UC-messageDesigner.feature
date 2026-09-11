Feature: Build a schema-ready message

  @UC-messageDesigner @AC-01 @specification
  Scenario: Four steps
    Given designer types load
    When the wizard opens
    Then family, message, fields and workspace are distinct steps

  @UC-messageDesigner @AC-02 @specification
  Scenario: Handoff
    Given the analyst selects a registered pacs schema
    When Use this is activated
    Then the workspace receives that schema identity

  @UC-messageDesigner @AC-03 @specification
  Scenario: No schemas
    Given no types are available
    When the wizard opens
    Then import guidance appears without invented fields

  @UC-messageDesigner @AC-04 @specification
  Scenario: Explicit save
    Given fields have been selected
    When the analyst only navigates between steps
    Then no completed definition save is claimed
