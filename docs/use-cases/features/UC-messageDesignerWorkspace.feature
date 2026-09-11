Feature: Generate test data

  @UC-messageDesignerWorkspace @AC-01 @specification
  Scenario: Preview only
    Given a definition is selected
    When a preview is generated
    Then no saved-message result is claimed until an explicit save

  @UC-messageDesignerWorkspace @AC-02 @specification
  Scenario: Persisted count
    Given 500 messages were requested and 498 confirmed saved
    When the result is displayed
    Then 498 is the saved count and the shortfall is visible

  @UC-messageDesignerWorkspace @AC-03 @specification
  Scenario: Adversarial values
    Given bad-data generation is selected
    When the preview is created
    Then intentional invalid values are labelled

  @UC-messageDesignerWorkspace @AC-04 @specification
  Scenario: Separate delivery
    Given messages were saved
    When no send action was requested
    Then the screen does not claim delivery
