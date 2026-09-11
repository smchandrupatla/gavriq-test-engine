Feature: Active runs

  @UC-trActive @AC-01 @specification
  Scenario: Filter states
    Given one active and one completed run exist
    When Active runs loads
    Then only the active run is classified as active

  @UC-trActive @AC-02 @specification
  Scenario: Stream loss
    Given updates stop after a connection error
    When the detail remains open
    Then the last known progress is identified as stale

  @UC-trActive @AC-03 @specification
  Scenario: Terminal update
    Given an active run completes
    When the terminal update arrives
    Then the run is no longer represented as running

  @UC-trActive @AC-04 @specification
  Scenario: View parity
    Given the active set contains two IDs
    When tiles switch to table
    Then the same two IDs remain represented
