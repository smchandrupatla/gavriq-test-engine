Feature: Run history

  @UC-trHistory @AC-01 @specification
  Scenario: Terminal only
    Given one running and one completed record exist
    When history is filtered
    Then the completed record qualifies and the running record does not

  @UC-trHistory @AC-02 @specification
  Scenario: Failed terminal
    Given a run has failed
    When history renders
    Then the failure remains visible

  @UC-trHistory @AC-03 @specification
  Scenario: Duration
    Given valid start and end timestamps are 60 seconds apart
    When duration is calculated
    Then the measured duration is 60 seconds

  @UC-trHistory @AC-04 @specification
  Scenario: No time
    Given the completion timestamp is absent
    When history renders the record
    Then completion duration is not invented
