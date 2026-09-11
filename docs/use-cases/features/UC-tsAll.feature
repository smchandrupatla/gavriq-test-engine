Feature: Test Suites

  @UC-tsAll @AC-01 @specification
  Scenario: Membership
    Given a suite contains three distinct case IDs
    When it is inspected
    Then the membership count is three

  @UC-tsAll @AC-02 @specification
  Scenario: Accepted only
    Given the run endpoint returns 202 and a job ID
    When the response is displayed
    Then it is described as accepted rather than passed

  @UC-tsAll @AC-03 @specification
  Scenario: Delete grouping
    Given a suite groups existing cases
    When the suite is deleted
    Then the case definitions are not deleted by that grouping action

  @UC-tsAll @AC-04 @specification
  Scenario: Empty suite
    Given a suite has zero members
    When it is listed
    Then it shows zero without a fabricated pass result
