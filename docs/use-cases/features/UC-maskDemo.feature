Feature: Compare the same run unmasked and masked

  @UC-maskDemo @AC-01 @specification
  Scenario: Two views
    Given the page loads
    When both columns render
    Then unmasked and masked example fields are both visible

  @UC-maskDemo @AC-02 @specification
  Scenario: No tenant body
    Given the page source is inspected
    When a tenant identifier is sought in a request body
    Then the page does not post tenant_id

  @UC-maskDemo @AC-03 @specification
  Scenario: Return
    Given the operator activates Ops Console
    When navigation occurs
    Then the demo has not written a run record
