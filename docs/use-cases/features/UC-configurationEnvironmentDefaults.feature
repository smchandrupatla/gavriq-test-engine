Feature: Environment defaults

  @UC-configurationEnvironmentDefaults @AC-01 @specification
  Scenario: Displayed default
    Given the screen is configured with Sandbox
    When it opens
    Then the displayed value is identified as configuration rather than proof of isolation

  @UC-configurationEnvironmentDefaults @AC-02 @specification
  Scenario: No retroactive change
    Given a run already exists
    When the future default changes
    Then the old run is not claimed retargeted

  @UC-configurationEnvironmentDefaults @AC-03 @specification
  Scenario: Unsupported save
    Given no setting write is wired
    When the toggle is used
    Then a persisted environment change is not claimed
