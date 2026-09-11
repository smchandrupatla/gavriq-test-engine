Feature: Stage rules

  @UC-ruleBenchStage @AC-01 @specification
  Scenario: Stage identity
    Given rule R1 exists
    When the analyst stages R1
    Then the response and refreshed row identify R1 and the returned state

  @UC-ruleBenchStage @AC-02 @specification
  Scenario: Stale transition
    Given the current ETag changed
    When an old If-Match is sent to transitions
    Then the stale request is rejected

  @UC-ruleBenchStage @AC-03 @specification
  Scenario: No promotion
    Given a stage request succeeds
    When the analyst reviews its result
    Then the screen does not claim that production promotion occurred

  @UC-ruleBenchStage @AC-04 @specification
  Scenario: Failure
    Given the stage service rejects the transition
    When the result is shown
    Then the row is not optimistically labelled promoted
