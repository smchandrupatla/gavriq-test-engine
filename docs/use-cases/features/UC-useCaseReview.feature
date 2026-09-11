Feature: Use-case review

  @UC-useCaseReview @AC-01 @specification
  Scenario: Deterministic mode
    Given review returns deterministic-contract-review
    When results display
    Then the review is described with that mode

  @UC-useCaseReview @AC-02 @specification
  Scenario: Full denominator
    Given the catalogue has N cases
    When all-case review completes
    Then its coverage accounts for all N cases

  @UC-useCaseReview @AC-03 @specification
  Scenario: Review failure
    Given the request fails
    When the status is displayed
    Then no all-passed result is fabricated

  @UC-useCaseReview @AC-04 @specification
  Scenario: Limited assurance
    Given no structural finding exists
    When the result is interpreted
    Then it does not certify runtime behavior
