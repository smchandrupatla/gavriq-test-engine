Feature: All reports

  @UC-repAll @AC-01 @specification
  Scenario: Stored report
    Given report R is tied to run A
    When R is opened
    Then its run A context is preserved

  @UC-repAll @AC-02 @specification
  Scenario: No reports
    Given the store confirms no reports
    When the list loads
    Then no demonstration report appears

  @UC-repAll @AC-03 @specification
  Scenario: Placeholder
    Given the UI shows a dummy document
    When it is inspected
    Then it is not described as actual run evidence

  @UC-repAll @AC-04 @specification
  Scenario: Failed load
    Given the report service fails
    When results render
    Then availability is not falsely confirmed
