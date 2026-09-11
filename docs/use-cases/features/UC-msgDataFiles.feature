Feature: Saved test data files

  @UC-msgDataFiles @AC-01 @specification
  Scenario: Saved batch
    Given batch B has 20 stored messages
    When the list loads
    Then B shows 20 stored messages

  @UC-msgDataFiles @AC-02 @specification
  Scenario: No regeneration
    Given B is selected
    When the operator opens it
    Then the stored batch is used without silent randomisation

  @UC-msgDataFiles @AC-03 @specification
  Scenario: Missing batch
    Given B was removed
    When reuse is requested
    Then the missing source is reported

  @UC-msgDataFiles @AC-04 @specification
  Scenario: Isolation
    Given B belongs to another tenant
    When the current library loads
    Then B is not exposed
