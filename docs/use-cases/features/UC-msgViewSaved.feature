Feature: Saved message definitions

  @UC-msgViewSaved @AC-01 @specification
  Scenario: Saved identity
    Given definition D1 exists
    When D1 is reopened
    Then its stored type and version are used

  @UC-msgViewSaved @AC-02 @specification
  Scenario: Empty library
    Given no definitions exist
    When the list loads
    Then no demonstration definitions appear

  @UC-msgViewSaved @AC-03 @specification
  Scenario: Missing source
    Given D1 references an unavailable schema
    When D1 is opened
    Then the missing reference is disclosed

  @UC-msgViewSaved @AC-04 @specification
  Scenario: Draft distinction
    Given a record is a draft
    When the record is listed
    Then it is not presented as a completed validated definition
