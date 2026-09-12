Feature: Use the declared ISO family reference shell

  @UC-isoFamilyReference @AC-01 @specification
  Scenario: Declared screen
    Given SHELL_PAGES is read
    When id reference is selected
    Then title is ISO 20022 family reference and html is /reference.html

  @UC-isoFamilyReference @AC-02 @specification
  Scenario: File gap
    Given this repository SHA
    When apps/web/public/reference.html is sought
    Then the file is absent

  @UC-isoFamilyReference @AC-03 @specification
  Scenario: No silent substitute
    Given a use-case action is opened on a missing reference page
    When documents are resolved
    Then UC-msgImportSchema is not shown as if it were the reference shell
