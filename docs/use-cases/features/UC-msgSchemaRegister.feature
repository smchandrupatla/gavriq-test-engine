Feature: Schema register

  @UC-msgSchemaRegister @AC-01 @specification
  Scenario: Ready entry
    Given a usable entry is present
    When it is selected for reuse
    Then the handoff uses its identity

  @UC-msgSchemaRegister @AC-02 @specification
  Scenario: No parsed fields
    Given an entry has zero parsed fields
    When its state renders
    Then the limitation is disclosed

  @UC-msgSchemaRegister @AC-03 @specification
  Scenario: Duplicate code
    Given two versions share a code
    When register rows are combined
    Then version loss is identified rather than silently claimed correct

  @UC-msgSchemaRegister @AC-04 @specification
  Scenario: Empty register
    Given both sources return no entries
    When the register opens
    Then import or creation guidance is shown
