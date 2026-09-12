Feature: Repeat the N-2 control walk

  @UC-n2ControlWalk @AC-01 @specification
  Scenario: Import first
    Given sben.001 fixtures are available
    When Import schema confirms upload
    Then a stored scheme identity exists

  @UC-n2ControlWalk @AC-02 @specification
  Scenario: Explicit kind
    Given the rule form is submitted without condition.kind
    When save runs
    Then the API rejects the rule

  @UC-n2ControlWalk @AC-03 @specification
  Scenario: MQ run
    Given a valid type and mq channel are chosen
    When Send is activated
    Then the run result distinguishes captured count from a mockup figure
