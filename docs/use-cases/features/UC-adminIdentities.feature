Feature: Review admin identities on the sidecar admin surface

  @UC-adminIdentities @AC-02 @specification
  Scenario: Failed login
    Given login is rejected
    When the promise throws
    Then the gate remains visible
    And the login error shows the message

  @UC-adminIdentities @AC-04 @specification
  Scenario: Empty tenant
    Given login succeeds and users.data is empty
    When the card renders
    Then the copy is None returned for this tenant
