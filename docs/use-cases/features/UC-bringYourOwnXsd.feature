Feature: Bring a customer XSD to Import schema

  @UC-bringYourOwnXsd @AC-01 @specification
  Scenario: Landing
    Given the page loads
    When the operator reads the instruction
    Then Import schema is named as the storage path

  @UC-bringYourOwnXsd @AC-02 @specification
  Scenario: No count claim
    Given marketing copy is reviewed
    When an 800-message claim is sought
    Then the page withholds that claim

  @UC-bringYourOwnXsd @AC-03 @specification
  Scenario: Family codes
    Given sben is listed
    When the operator treats it as pacs
    Then the page states it is not pacs
