Feature: Select fields

  @UC-messageDesignerFields @AC-01 @specification
  Scenario: Required field
    Given OrderId is required
    When the analyst attempts to deselect it
    Then OrderId remains included

  @UC-messageDesignerFields @AC-02 @specification
  Scenario: Optional field
    Given Note is optional
    When Note is deselected
    Then the workspace selection excludes Note

  @UC-messageDesignerFields @AC-03 @specification
  Scenario: Expansion
    Given a branch is collapsed
    When it is expanded
    Then field inclusion does not change

  @UC-messageDesignerFields @AC-04 @specification
  Scenario: Empty model
    Given the selected schema has no parsed fields
    When the picker opens
    Then no invented selection is displayed
