Feature: Find operator help in the Help Center

  @UC-helpCenter @AC-01 @specification
  Scenario: Matching topic
    Given a schema topic exists
    When the operator searches its title
    Then that topic remains in the tree

  @UC-helpCenter @AC-02 @specification
  Scenario: No match
    Given no topic matches the query
    When search filters the tree
    Then no family with zero hits is shown

  @UC-helpCenter @AC-03 @specification
  Scenario: Keyword bot
    Given the operator asks how to import a scheme
    When Ask is activated
    Then the reply cites a stored Import schema topic

  @UC-helpCenter @AC-04 @specification
  Scenario: Unknown hash
    Given the hash names a topic id that is not in topics.js
    When the page renders
    Then absence is disclosed rather than another topic being presented as the requested one
