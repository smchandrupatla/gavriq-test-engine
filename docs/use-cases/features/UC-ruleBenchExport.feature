Feature: Export rules

  @UC-ruleBenchExport @AC-01 @specification
  Scenario: Whole catalogue
    Given three tenant rules exist
    When the current export endpoint is called
    Then the package scope is identified as the tenant catalogue

  @UC-ruleBenchExport @AC-02 @specification
  Scenario: Wrong type
    Given the service returns an error document
    When download handling runs
    Then no successful rule-pack download is claimed

  @UC-ruleBenchExport @AC-03 @specification
  Scenario: Empty export
    Given the library is empty
    When export is requested
    Then the output does not contain prototype rules

  @UC-ruleBenchExport @AC-04 @specification
  Scenario: Lifecycle
    Given a rule is In review
    When its definition is exported
    Then the export does not promote the rule
