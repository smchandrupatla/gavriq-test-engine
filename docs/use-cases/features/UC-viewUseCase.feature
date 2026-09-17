Feature: Open the use case for the current screen

  @UC-viewUseCase @AC-01 @specification
  Scenario: Mapped screen
    Given the path is help-center.html and a helpCenter row exists
    When View use case is activated
    Then /use-case.html?page=helpCenter opens

  @UC-viewUseCase @AC-02 @specification
  Scenario: Disabled
    Given enabled is false
    When the binder ticks
    Then the action is absent

  @UC-viewUseCase @AC-03 @specification
  Scenario: Missing document
    Given the resolved page key has no catalogue row and title match is empty
    When the binder ticks
    Then the action is not shown

  @UC-viewUseCase @AC-04 @specification
  Scenario: State preserved
    Given a form field has unsaved text
    When the viewer window opens and closes
    Then that text remains
