Feature: Data retention

  @UC-configurationDataRetention @AC-01 @specification
  Scenario: Caption only
    Given the page says 90 days
    When the policy is reviewed
    Then the text is not represented as evidence of automated cleanup

  @UC-configurationDataRetention @AC-02 @specification
  Scenario: Cutoff boundary
    Given a future cleanup policy has a defined cutoff
    When a record lies exactly on that cutoff
    Then inclusion follows the explicitly agreed boundary

  @UC-configurationDataRetention @AC-03 @specification
  Scenario: Held record
    Given an agreed hold applies
    When cleanup is planned
    Then the hold policy is considered rather than silently ignored
