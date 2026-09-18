Feature: Open the public URL card

  @UC-publicUrls @AC-01 @specification
  Scenario: Card load
    Given /pitch.html loads
    When the heading is read
    Then Good rules survive bad data. is present

  @UC-publicUrls @AC-03 @specification
  Scenario: No admin marketing
    Given the footer sentence is read
    When admin or white-label is sought as a sold URL
    Then the page withholds those surfaces
