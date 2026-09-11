Feature: Import schema

  Scenario: Import a valid schema with matching Markdown
    Given a readable and valid schema is selected
    And readable accompanying Markdown covers the schema fields
    And no duplicate is detected
    When the analyst confirms the import
    Then the selected content is saved in the Schema register
    And a successful import result is displayed

  Scenario: File selection does not save a record
    Given the analyst has opened Import schema
    When the analyst selects an input file
    Then no Schema register record is created by file selection alone

  Scenario: Import without accompanying Markdown
    Given a readable and valid schema is selected
    And no accompanying Markdown is selected
    And no duplicate is detected
    When the analyst confirms the import
    Then the schema is saved without accompanying Markdown

  Scenario Outline: Warn about Markdown coverage mismatches
    Given the schema and accompanying Markdown are readable
    And the schema parses successfully
    And <mismatch>
    When coverage validation completes
    Then the system displays a coverage warning
    And offers Proceed or Cancel upload

    Examples:
      | mismatch                                      |
      | a schema leaf field is undocumented            |
      | an optional schema leaf field is undocumented  |
      | Markdown contains a field absent from schema   |

  Scenario: Proceed despite a coverage warning
    Given a coverage warning is displayed
    When the analyst selects Proceed
    Then both the schema and accompanying Markdown remain selected
    And final confirmation is still required before saving

  Scenario: Override a detected duplicate
    Given the system detects a duplicate under its duplicate rule
    When the analyst selects Proceed with override
    And confirms the import
    Then the uploaded content replaces the existing schema record

  Scenario: Cancel after a duplicate warning
    Given a duplicate warning is displayed
    When the analyst selects Cancel upload
    Then the attempt ends
    And the selected files are cleared from memory
    And the existing schema record is unchanged

  Scenario: Reject a malformed schema
    Given the selected schema is malformed
    When the system parses it
    Then the upload is rejected
    And the parsing error is displayed

  Scenario: Reject unreadable accompanying Markdown
    Given accompanying Markdown is selected
    When the system cannot read it
    Then the upload is rejected
    And the error is displayed

  Scenario: Count leaf fields in repeating structures
    Given a schema contains grouping containers and leaf fields
    And some structures repeat
    When the system calculates field count
    Then grouping containers are excluded
    And leaf fields in repeating structures are counted once

  Scenario: Stop before saving
    Given files are selected and saving has not been submitted
    When the analyst selects Stop
    Then processing halts
    And the selected files remain in memory
    And no record is saved

  Scenario: Cancel before saving
    Given files are selected and saving has not been submitted
    When the analyst selects Cancel
    Then the attempt ends
    And the selected files are cleared from memory
    And the original local files remain unchanged
    And no record is saved

  Scenario: Uncertain save outcome
    Given the analyst has confirmed the import
    When the save outcome cannot be confirmed
    Then the system reports an unconfirmed outcome
    And does not report success
    And does not retry automatically

  @AC-01 @specification
  Scenario Outline: Supported format roles
    Given a valid supported <format> input and its required dependencies
    When the analyst selects it for import
    Then the system interprets it as <role> and waits for confirmation
    Examples:
      | format      | role                      |
      | XSD         | XML schema definition     |
      | JSON Schema | JSON schema definition    |
      | OpenAPI     | API schema source         |
      | CSV         | flat field layout         |
      | PDF         | flat field layout         |
      | Markdown    | flat field layout         |

  @AC-14 @specification
  Scenario Outline: Independent warning decisions
    Given valid readable schema and companion files produce <warnings>
    When the analyst chooses <decision>
    Then the attempt has <outcome>
    Examples:
      | warnings                    | decision                   | outcome                                      |
      | coverage only               | Proceed                    | both files retained awaiting confirmation    |
      | coverage only               | Cancel upload              | ended with in-memory files cleared           |
      | duplicate only              | Proceed with override      | override selected awaiting confirmation      |
      | duplicate only              | Cancel upload              | ended without replacing the existing record  |
      | coverage and duplicate      | Proceed for coverage only  | duplicate decision still required            |
      | coverage and duplicate      | Cancel upload              | ended without replacing the existing record  |

  @AC-17 @AC-18 @AC-19 @specification
  Scenario Outline: Stop and Cancel across submission boundary
    Given the attempt is <state>
    When the analyst selects <action>
    Then the system <outcome>
    Examples:
      | state              | action | outcome                                                  |
      | before submission  | Stop   | halts processing and retains selected files in memory   |
      | before submission  | Cancel | ends the attempt and clears only in-memory selected files |
      | after submission   | Stop   | retains files and reports the actual save outcome       |
      | after submission   | Cancel | clears memory without claiming a committed save was undone |
