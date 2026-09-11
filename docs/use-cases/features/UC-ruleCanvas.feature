Feature: Rule Canvas

  @UC-ruleCanvas @AC-01 @specification
  Scenario: Separate surface
    Given a rule form is open
    When Open schematic Rule Canvas is selected
    Then the companion opens independently

  @UC-ruleCanvas @AC-02 @specification
  Scenario: Close
    Given the companion is open
    When its tab is closed
    Then no rule save is implied

  @UC-ruleCanvas @AC-03 @specification
  Scenario: No compilation claim
    Given complex logic is drawn
    When the sketch is reviewed
    Then it is not labelled executed without a supported compiler

  @UC-ruleCanvas @AC-04 @specification
  Scenario: Return
    Given the original form has unsaved content
    When the analyst returns
    Then the sketch has not silently submitted that form
