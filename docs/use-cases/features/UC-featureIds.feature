Feature: Feature IDs

  @UC-featureIds @AC-01 @specification
  Scenario: Identity
    Given feature overview is returned
    When Feature IDs renders
    Then FTR-overview is shown for that key

  @UC-featureIds @AC-02 @specification
  Scenario: Failed update
    Given the row PATCH returns 404
    When a level change is attempted
    Then no saved level change is claimed

  @UC-featureIds @AC-03 @specification
  Scenario: Catalogue scope
    Given a documentation-only case exists
    When features are listed
    Then it is not invented as a feature grant

  @UC-featureIds @AC-04 @specification
  Scenario: Default versus assigned
    Given an override is available
    When levels render
    Then default and effective values are distinguishable
