Feature: Export template

  @UC-msgExportTemplate @AC-01 @specification
  Scenario: Headers
    Given a type contains five fields
    When its CSV template is downloaded
    Then the five actual field headers appear in order

  @UC-msgExportTemplate @AC-02 @specification
  Scenario: Quoting
    Given a header contains a comma
    When CSV is produced
    Then it is quoted without creating an extra column

  @UC-msgExportTemplate @AC-03 @specification
  Scenario: Unknown type
    Given the selected code no longer exists
    When export is requested
    Then an actionable error replaces the download

  @UC-msgExportTemplate @AC-04 @specification
  Scenario: No mutation
    Given a type is registered
    When its template is downloaded
    Then its definition remains unchanged
