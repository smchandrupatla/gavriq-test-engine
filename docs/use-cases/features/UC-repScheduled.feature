Feature: Scheduled exports

  @UC-repScheduled @AC-01 @specification
  Scenario: Empty configuration
    Given no export is configured
    When the view opens
    Then no automatic delivery is implied

  @UC-repScheduled @AC-02 @specification
  Scenario: Invalid target
    Given a destination is invalid
    When export is attempted
    Then failure is shown rather than success

  @UC-repScheduled @AC-03 @specification
  Scenario: Manual download
    Given a report was downloaded manually
    When scheduled state is reviewed
    Then the download is not recorded as a recurring delivery

  @UC-repScheduled @AC-04 @specification
  Scenario: Unimplemented action
    Given no scheduled-export write endpoint exists
    When New export is inspected
    Then the capability is identified as unimplemented
