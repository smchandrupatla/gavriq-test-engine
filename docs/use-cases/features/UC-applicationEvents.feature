Feature: Application Events

  @UC-applicationEvents @AC-01 @specification
  Scenario: Filter scope
    Given 200 rows were loaded
    When a text filter is applied
    Then only those loaded rows are searched

  @UC-applicationEvents @AC-02 @specification
  Scenario: Missing actor
    Given an event lacks actor context
    When the row renders
    Then an unavailable marker appears rather than a fabricated user

  @UC-applicationEvents @AC-03 @specification
  Scenario: No match
    Given events exist but none match
    When the filter is applied
    Then the empty result is described as no matches

  @UC-applicationEvents @AC-04 @specification
  Scenario: Failed load
    Given the events request fails
    When the view renders
    Then the failure is not represented as verified zero captured events
