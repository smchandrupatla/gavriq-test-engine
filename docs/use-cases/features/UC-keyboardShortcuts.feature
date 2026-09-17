Feature: Use documented console keyboard shortcuts

  @UC-keyboardShortcuts @AC-01 @specification
  Scenario: Search focus
    Given the operator is not typing in a field
    When / is pressed
    Then a visible search field receives focus

  @UC-keyboardShortcuts @AC-02 @specification
  Scenario: Typing guard
    Given an input has focus
    When s is pressed
    Then no shortcut click is fired

  @UC-keyboardShortcuts @AC-03 @specification
  Scenario: Save when present
    Given a visible enabled Save button exists
    When Ctrl+S is pressed
    Then that save control is activated

  @UC-keyboardShortcuts @AC-04 @specification
  Scenario: Save absent
    Given no save-like control is visible
    When Ctrl+S is pressed
    Then no destructive or invented save occurs
