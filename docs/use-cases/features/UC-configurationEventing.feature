Feature: Eventing

  @UC-configurationEventing @AC-01 @specification
  Scenario: Save only
    Given settings are edited
    When Save eventing is selected
    Then the result does not claim a dummy was sent

  @UC-configurationEventing @AC-02 @specification
  Scenario: Connectivity
    Given the receiver is unavailable
    When Test connection is selected
    Then failure is reported

  @UC-configurationEventing @AC-03 @specification
  Scenario: Dummy send
    Given a test receiver is configured
    When Send dummy is explicitly selected
    Then its send result is reported independently of configuration saving

  @UC-configurationEventing @AC-04 @specification
  Scenario: Read only
    Given the page loads
    When no command is selected
    Then no dummy message is sent
