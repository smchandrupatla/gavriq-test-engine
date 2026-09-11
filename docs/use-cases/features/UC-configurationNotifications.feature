Feature: Notifications

  @UC-configurationNotifications @AC-01 @specification
  Scenario: Preference only
    Given a preference is saved
    When the result is displayed
    Then no email delivery is claimed

  @UC-configurationNotifications @AC-02 @specification
  Scenario: Invalid recipient
    Given a recipient is invalid
    When delivery is attempted
    Then failure is disclosed

  @UC-configurationNotifications @AC-03 @specification
  Scenario: Disabled category
    Given failure notifications are disabled
    When a run fails
    Then the documented suppression policy applies only when implemented
