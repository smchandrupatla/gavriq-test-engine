Feature: Overview

  @UC-overview @AC-01 @specification
  Scenario: Empty tenant
    Given the tenant has no runs
    When Overview loads successfully
    Then the run count is zero and the New test run link remains available

  @UC-overview @AC-02 @specification
  Scenario: Live counts
    Given three stored runs belong to this tenant
    When the run summary is displayed
    Then the summary uses those records rather than the preview fixture

  @UC-overview @AC-03 @specification
  Scenario: Failed load
    Given bootstrap returns an error
    When Overview renders
    Then an unavailable state appears instead of a fabricated successful zero count

  @UC-overview @AC-04 @specification
  Scenario: Deep link
    Given a summary has a configured destination
    When the operator activates it by keyboard
    Then the matching workflow opens with focus available
