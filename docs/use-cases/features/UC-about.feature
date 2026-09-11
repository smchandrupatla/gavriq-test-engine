Feature: About

  @UC-about @AC-01 @specification
  Scenario: Scope
    Given About loads
    When the operator reads it
    Then the product is described consistently with its sandbox scope

  @UC-about @AC-02 @specification
  Scenario: Return
    Given the console link is present
    When it is activated
    Then the workspace is reachable

  @UC-about @AC-03 @specification
  Scenario: No metrics
    Given no measured production results exist
    When About is reviewed
    Then no invented production metric appears
