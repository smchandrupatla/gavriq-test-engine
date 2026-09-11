Feature: Datasets

  @UC-dsAll @AC-01 @specification
  Scenario: Zero rows
    Given a dataset shell exists
    When the list loads
    Then it is visible with zero assembled rows

  @UC-dsAll @AC-02 @specification
  Scenario: Stored count
    Given 20 messages are assembled
    When the dataset is listed
    Then its reported count reflects the stored collection

  @UC-dsAll @AC-03 @specification
  Scenario: Isolation
    Given another tenant has a dataset
    When the current tenant lists datasets
    Then the other dataset is excluded

  @UC-dsAll @AC-04 @specification
  Scenario: Reuse
    Given dataset D exists
    When D is assigned to a case
    Then the stable dataset reference is used
