Feature: Security & cryptography

  @UC-security @AC-01 @specification
  Scenario: Historical reveal
    Given an ENCRYPTED record exists
    When write encryption is disabled and the record is revealed
    Then authorised historical decryption still returns its original content

  @UC-security @AC-02 @specification
  Scenario: Fail closed
    Given the required provider is unavailable
    When an encrypted write is attempted
    Then it does not silently succeed as plaintext

  @UC-security @AC-03 @specification
  Scenario: Pending state
    Given write-disabled policy permits pending plaintext
    When a sensitive record is created
    Then its state is explicitly pending encryption

  @UC-security @AC-04 @specification
  Scenario: Rotation
    Given a record uses an older key version
    When a new key version is created
    Then historical decryption remains supported under the configured retention policy
