Feature: Help

  @UC-help @AC-01 @specification
  Scenario: Matching topic
    Given a schema topic exists
    When the operator searches its title
    Then that topic is discoverable

  @UC-help @AC-02 @specification
  Scenario: No match
    Given no topic matches the query
    When search runs
    Then an honest no-result state is shown

  @UC-help @AC-03 @specification
  Scenario: Shortcut accuracy
    Given the console supports a save shortcut
    When the help shortcut list is read
    Then the documented key and context match the binding

  @UC-help @AC-04 @specification
  Scenario: Return
    Given Help is open
    When the console link is activated
    Then the console is reachable
