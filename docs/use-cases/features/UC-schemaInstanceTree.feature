Feature: Inspect a schema instance tree

  @UC-schemaInstanceTree @AC-01 @specification
  Scenario: Page loads
    Given /schema-tree.html is requested
    When HTML renders
    Then the head title names Schema and file tree
    And the page-head title reads Import schema

  @UC-schemaInstanceTree @AC-03 @specification
  Scenario: No upload implied
    Given only this page is opened
    When no further confirm-upload action occurs
    Then no scheme persistence is claimed
