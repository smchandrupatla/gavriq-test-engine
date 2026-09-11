Feature: Use-case templates

  @UC-useCaseTemplates @AC-01 @specification
  Scenario: Section order
    Given the template is downloaded
    When its headings are inspected
    Then Goal through Gherkin follow the agreed top-level order

  @UC-useCaseTemplates @AC-02 @specification
  Scenario: Metadata
    Given the template is downloaded
    When metadata is inspected
    Then ID, Screen, Level, Style, Actor and Extends fields exist

  @UC-useCaseTemplates @AC-03 @specification
  Scenario: No sequencing
    Given the Extends placeholders are read
    When the author fills the template
    Then they describe relationships rather than first and last steps

  @UC-useCaseTemplates @AC-04 @specification
  Scenario: No write
    Given a template is downloaded
    When the catalogue is inspected
    Then no use-case record was created by downloading
