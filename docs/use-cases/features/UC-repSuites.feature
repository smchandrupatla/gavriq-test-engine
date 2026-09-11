Feature: Test suite reports

  @UC-repSuites @AC-01 @specification
  Scenario: Reconcile totals
    Given a pack contains two pass and one fail result
    When totals are reviewed
    Then the totals represent those three outcomes

  @UC-repSuites @AC-02 @specification
  Scenario: Unknown suite
    Given the suite ID is unknown
    When evidence is requested
    Then an error replaces the download

  @UC-repSuites @AC-03 @specification
  Scenario: No endpoint
    Given the evidence route is unavailable
    When download is requested
    Then no evidence success is claimed

  @UC-repSuites @AC-04 @specification
  Scenario: Offline reading
    Given a supported pack was downloaded
    When it is opened offline
    Then its stored results remain readable without rerunning tests
