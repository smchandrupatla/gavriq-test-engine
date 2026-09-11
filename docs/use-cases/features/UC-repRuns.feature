Feature: Test run reports

  @UC-repRuns @AC-01 @specification
  Scenario: Exact run
    Given runs A and B each have a report
    When reports for A are requested
    Then only A reports are included

  @UC-repRuns @AC-02 @specification
  Scenario: No match
    Given run A has no report
    When its report view opens
    Then the view states no matching report

  @UC-repRuns @AC-03 @specification
  Scenario: Duplicate labels
    Given two runs share a label
    When one run ID is selected
    Then reports are joined by that identity

  @UC-repRuns @AC-04 @specification
  Scenario: Missing context
    Given no run is selected
    When the scoped view opens
    Then the operator must establish context before a scoped claim
