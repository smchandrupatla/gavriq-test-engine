Feature: Upcoming schedules

  @UC-schUpcoming @AC-01 @specification
  Scenario: Inside interval
    Given an enabled schedule is due tomorrow
    When a seven-day upcoming view is evaluated
    Then that schedule appears

  @UC-schUpcoming @AC-02 @specification
  Scenario: Outside interval
    Given a schedule is due in three weeks
    When a seven-day view is evaluated
    Then it is excluded

  @UC-schUpcoming @AC-03 @specification
  Scenario: Paused
    Given a schedule is paused
    When upcoming execution is described
    Then it is not promised to execute

  @UC-schUpcoming @AC-04 @specification
  Scenario: Clock context
    Given a next occurrence crosses a timezone boundary
    When it is displayed
    Then the time basis is clear
