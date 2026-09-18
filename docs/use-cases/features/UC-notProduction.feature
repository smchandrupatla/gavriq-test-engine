Feature: Read the bench-is-not-production disclaimer

  @UC-notProduction @AC-01 @specification
  Scenario: Bench statement
    Given /not-production.html loads
    When the heading is read
    Then it says Sand Bench is the bench

  @UC-notProduction @AC-03 @specification
  Scenario: Testhub naming
    Given Testhub is mentioned
    When the operator reads the sentence
    Then Testhub is an HTTP simulator and is not IBM MQ
