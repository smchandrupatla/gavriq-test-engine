Feature: New schedule

  @UC-schNew @AC-01 @specification
  Scenario: Required name
    Given name is missing
    When creation is submitted
    Then validation rejects the request

  @UC-schNew @AC-02 @specification
  Scenario: Required cadence
    Given cadence is missing
    When creation is submitted
    Then validation rejects the request

  @UC-schNew @AC-03 @specification
  Scenario: Next occurrence
    Given a supported cadence is accepted
    When creation succeeds
    Then the returned next occurrence can be inspected

  @UC-schNew @AC-04 @specification
  Scenario: Storage failure
    Given schedule persistence fails
    When the handler returns a local ID
    Then durable scheduling is not claimed
