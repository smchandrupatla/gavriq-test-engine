Feature: Read the static Help & Shortcuts page

  @UC-helpStandalone @AC-01 @specification
  Scenario: Static load
    Given /help.html is requested
    When the page renders
    Then the heading Help & Shortcuts is present

  @UC-helpStandalone @AC-03 @specification
  Scenario: No write
    Given the operator only reads the page
    When they leave for /
    Then no test case, rule, or run record is created by this page

  @UC-helpStandalone @AC-04 @specification
  Scenario: Distinct from Help Center
    Given /help.html and /help-center.html both exist
    When a binder resolves the current document
    Then the static page is not substituted with a Help Center topic
