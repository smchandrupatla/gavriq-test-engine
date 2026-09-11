Feature: Choose a message family

  @UC-messageDesignerFamily @AC-01 @specification
  Scenario: Family scope
    Given only pain and pacs types exist
    When the family step loads
    Then only those available families are offered

  @UC-messageDesignerFamily @AC-02 @specification
  Scenario: No families
    Given the response is empty
    When the step renders
    Then the analyst receives import guidance

  @UC-messageDesignerFamily @AC-03 @specification
  Scenario: Select family
    Given pacs is available
    When pacs is selected
    Then the next step is scoped to pacs

  @UC-messageDesignerFamily @AC-04 @specification
  Scenario: No write
    Given a family tile is selected
    When the message step opens
    Then no definition is saved by family selection
