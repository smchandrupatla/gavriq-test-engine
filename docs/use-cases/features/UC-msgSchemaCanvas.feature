Feature: Schema canvas

  @UC-msgSchemaCanvas @AC-01 @specification
  Scenario: Property panel
    Given a node has required=true
    When the node is selected
    Then the panel shows that actual property

  @UC-msgSchemaCanvas @AC-02 @specification
  Scenario: View change
    Given a draft is visible
    When the analyst zooms
    Then field constraints do not change

  @UC-msgSchemaCanvas @AC-03 @specification
  Scenario: Root deletion
    Given the root is selected
    When actions are inspected
    Then the non-root delete control is not offered for the root

  @UC-msgSchemaCanvas @AC-04 @specification
  Scenario: Save failure
    Given the draft save fails
    When the result is displayed
    Then the canvas does not claim a saved or published schema
