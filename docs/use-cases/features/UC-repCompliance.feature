Feature: Compliance reports

  @UC-repCompliance @AC-01 @specification
  Scenario: Needs review
    Given a report outcome is Review
    When the list renders
    Then it remains Review rather than Passed

  @UC-repCompliance @AC-02 @specification
  Scenario: No evidence
    Given no report supports a framework
    When the framework is inspected
    Then no compliance assurance is claimed

  @UC-repCompliance @AC-03 @specification
  Scenario: Test pass
    Given a test run passed
    When the report is labelled compliance
    Then the result is scoped to the tested controls

  @UC-repCompliance @AC-04 @specification
  Scenario: Evidence context
    Given a report is tied to a historical run
    When it is opened
    Then that run and evidence date remain visible
