Feature: Event framework

  @UC-eventFramework @AC-01 @specification
  Scenario: Mount condition
    Given the current page title is App configs
    When the overlay evaluates its title condition
    Then the source condition permits mounting

  @UC-eventFramework @AC-02 @specification
  Scenario: Header policy
    Given MQ requires a configured header
    When the effective policy is reviewed
    Then the requirement is distinct from API-origin settings

  @UC-eventFramework @AC-03 @specification
  Scenario: Unknown event
    Given an unknown event code is submitted
    When emit is requested
    Then the code is rejected

  @UC-eventFramework @AC-04 @specification
  Scenario: Save failure
    Given a framework update fails
    When the result appears
    Then the prior effective configuration is not claimed changed
