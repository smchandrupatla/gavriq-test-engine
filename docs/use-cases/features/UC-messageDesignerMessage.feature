Feature: Choose a message

  @UC-messageDesignerMessage @AC-01 @specification
  Scenario: Family filter
    Given pacs is selected
    When the messages render
    Then pain messages are excluded

  @UC-messageDesignerMessage @AC-02 @specification
  Scenario: Empty model
    Given a tile has zero parsed fields
    When it is opened
    Then the lack of fields is disclosed

  @UC-messageDesignerMessage @AC-03 @specification
  Scenario: Back
    Given a message is being reviewed
    When Back is selected
    Then family selection is reachable

  @UC-messageDesignerMessage @AC-04 @specification
  Scenario: Identity
    Given two schemas have similar names
    When one is selected
    Then the next step uses its stable identity
