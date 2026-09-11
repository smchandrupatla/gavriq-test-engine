Feature: New test run

  @UC-trNew @AC-01 @specification
  Scenario: Required type
    Given messageTypeCode is missing
    When Start run is submitted
    Then the request is rejected

  @UC-trNew @AC-02 @specification
  Scenario: Default file
    Given a valid type is provided without channel
    When the run is submitted
    Then the file-channel default is explicit

  @UC-trNew @AC-03 @specification
  Scenario: Finished response
    Given the endpoint returns completed
    When the UI handles the result
    Then it does not force a fabricated Running state

  @UC-trNew @AC-04 @specification
  Scenario: Persistence uncertainty
    Given execution finishes but storage fails
    When a local fallback ID is returned
    Then durable evidence is not claimed
