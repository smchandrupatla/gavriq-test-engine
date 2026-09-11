Feature: Use case

  @UC-useCaseEditor @AC-01 @specification
  Scenario: Identity
    Given UC-tcNew is opened
    When the author edits its goal
    Then the case ID remains UC-tcNew

  @UC-useCaseEditor @AC-02 @specification
  Scenario: Complete download
    Given a case has detailed notes and a contract
    When Markdown is downloaded
    Then notes and parseable contract JSON are included

  @UC-useCaseEditor @AC-03 @specification
  Scenario: Missing key
    Given the requested page is unknown
    When the editor loads
    Then a missing-case error replaces unrelated content

  @UC-useCaseEditor @AC-04 @specification
  Scenario: Save failure
    Given the PUT fails
    When the editor handles it
    Then no successful revision is claimed
