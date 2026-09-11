Feature: New test suite

  @UC-tsNew @AC-01 @specification
  Scenario: Three members
    Given three existing cases are selected
    When the suite is saved
    Then reopening shows those case identities

  @UC-tsNew @AC-02 @specification
  Scenario: Empty grouping
    Given no cases are selected
    When a named suite is saved
    Then it is represented as zero members

  @UC-tsNew @AC-03 @specification
  Scenario: Blank name
    Given the name is blank
    When Save is submitted
    Then creation fails validation

  @UC-tsNew @AC-04 @specification
  Scenario: Reorder
    Given a suite contains A and B
    When the supported reorder operation stores B then A
    Then the returned membership reflects that order
