Feature: External systems

  @UC-externalSystems @AC-01 @specification
  Scenario: Save only
    Given a valid destination is entered
    When Update succeeds
    Then configuration is saved without claiming a dummy was sent

  @UC-externalSystems @AC-02 @specification
  Scenario: Bad headers
    Given header text is malformed JSON
    When the row is saved
    Then the problem is surfaced instead of silently dropping headers

  @UC-externalSystems @AC-03 @specification
  Scenario: Unreachable
    Given the test receiver is stopped
    When Send dummy is requested
    Then delivery failure is visible

  @UC-externalSystems @AC-04 @specification
  Scenario: Correlation
    Given two dummy messages were sent
    When one inbound response arrives
    Then the response is associated with its actual request
