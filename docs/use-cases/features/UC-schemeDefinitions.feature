Feature: Scheme definitions

  @UC-schemeDefinitions @AC-01 @specification
  Scenario: Handoff
    Given pacs.008 is selected
    When Use this is activated
    Then the wizard receives pacs.008 and its selected model

  @UC-schemeDefinitions @AC-02 @specification
  Scenario: Source download
    Given an original XSD is stored
    When Download XSD is selected
    Then the stored source is returned

  @UC-schemeDefinitions @AC-03 @specification
  Scenario: Missing document
    Given no Markdown was stored
    When documentation is requested
    Then absence is disclosed rather than invented

  @UC-schemeDefinitions @AC-04 @specification
  Scenario: Read only
    Given a schema is inspected
    When the analyst returns to the list
    Then its version and content are unchanged
