Feature: New test case

  @UC-tcNew @AC-01 @specification
  Scenario: Valid case
    Given name and objective identify a boundary test
    When the analyst saves
    Then the stored case has its identity and supplied objective

  @UC-tcNew @AC-02 @specification
  Scenario: Blank name
    Given the name is whitespace
    When the analyst saves
    Then the request fails validation

  @UC-tcNew @AC-03 @specification
  Scenario: Optional dataset
    Given no dataset is selected
    When a named case is saved
    Then creation can succeed without inventing a dataset

  @UC-tcNew @AC-04 @specification
  Scenario: No execution claim
    Given a case is created
    When the result is shown
    Then the result describes a definition rather than a passed execution
