Feature: App configs

  @UC-configurationAppConfigs @AC-01 @specification
  Scenario: Logging save
    Given a supported forwarding mode is selected
    When Save logging succeeds
    Then the returned operation is reported as saved

  @UC-configurationAppConfigs @AC-02 @specification
  Scenario: Local timeout
    Given server timeout saving fails after local saving
    When status renders
    Then local-only persistence is distinguished

  @UC-configurationAppConfigs @AC-03 @specification
  Scenario: Read-only headers
    Given origin headers render in a preformatted block
    When the panel is inspected
    Then the display is not claimed to provide editing

  @UC-configurationAppConfigs @AC-04 @specification
  Scenario: Timeout uncertainty
    Given a write outlasts the UI timeout
    When the UI stops waiting
    Then the server outcome is not asserted rolled back
