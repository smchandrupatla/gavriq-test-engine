Feature: Configuration

  @UC-configuration @AC-01 @specification
  Scenario: Hide use cases
    Given use-case visibility is enabled
    When the administrator saves enabled=false
    Then the documentation controls follow the saved setting

  @UC-configuration @AC-02 @specification
  Scenario: Reload
    Given a setting save succeeds
    When the setting is reopened
    Then the effective value can be checked

  @UC-configuration @AC-03 @specification
  Scenario: Failed save
    Given the settings request fails
    When the result is handled
    Then no confirmed settings change is claimed

  @UC-configuration @AC-04 @specification
  Scenario: Independent settings
    Given logging changes
    When the change is saved
    Then no unrelated eventing change is implied
