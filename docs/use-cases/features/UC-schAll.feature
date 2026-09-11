Feature: All schedules

  @UC-schAll @AC-01 @specification
  Scenario: Distant occurrence
    Given a schedule is due next month
    When All schedules loads
    Then it remains visible

  @UC-schAll @AC-02 @specification
  Scenario: Paused state
    Given a persisted schedule is paused
    When it is displayed
    Then its state is not labelled active

  @UC-schAll @AC-03 @specification
  Scenario: No run claim
    Given a next time is calculated
    When the schedule is listed
    Then no completed run is implied

  @UC-schAll @AC-04 @specification
  Scenario: Empty
    Given the store confirms zero schedules
    When All schedules opens
    Then the list contains no prototype entries
