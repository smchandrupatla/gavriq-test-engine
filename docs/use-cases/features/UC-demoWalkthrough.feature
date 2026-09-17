Feature: Follow the 90-second N-2 demo script

  @UC-demoWalkthrough @AC-01 @specification
  Scenario: Script page
    Given /demo.html loads
    When the operator reads the heading
    Then fixtures are named sben.001.001.01

  @UC-demoWalkthrough @AC-02 @specification
  Scenario: Not pacs
    Given the import step completes on the live console
    When the result code is pacs.*
    Then the demo is failed per the script

  @UC-demoWalkthrough @AC-03 @specification
  Scenario: Optional Testhub
    Given Testhub is down
    When step 5 is skipped
    Then the script still treats the bench run as valid
