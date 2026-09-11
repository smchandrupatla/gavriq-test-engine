Feature: Create and refine a schema visually

  Scenario Outline: Render the selected editor
    Given the analyst opens Create schema
    When the analyst selects <type>
    Then the system displays <editor>
    And offers only applicable field properties
    Examples:
      | type      | editor              |
      | XML       | an XML tree         |
      | JSON      | a JSON tree         |
      | flat file | an ordered table    |

  Scenario: Load a definition as editable starting content
    Given a supported valid schema definition and its dependencies
    When the analyst chooses Upload definition
    Then its structure and constraints populate the editor
    And no schema is published

  Scenario: Edit a copy of a registered version
    Given a registered schema version is selected
    When the analyst changes a field in the working copy
    Then the source version remains unchanged

  Scenario: Expand without modifying the model
    Given a collapsed parent has child fields
    When the analyst selects its expansion control
    Then the children become visible
    And the model revision is unchanged

  Scenario: Show selected field properties
    Given a field has a configured type and cardinality
    When the analyst selects that field
    Then the property panel shows those settings and its rules

  Scenario: Keep presence separate from null
    Given a JSON property is required and allows null
    When sample instances are validated
    Then a present null value satisfies those two settings
    And an omitted property fails the presence requirement

  Scenario: Optional array with a nonempty present value
    Given an optional JSON array permits one to three items
    When sample instances are validated
    Then omission is allowed
    And a present empty array fails
    And four items fail

  Scenario: Preserve digits-only identifiers
    Given a text field requires exactly five digits
    When the analyst tests the value "00123"
    Then it passes and retains its leading zeros
    And "12A45" fails

  Scenario: Add an enumeration entry
    Given the allowed values are "CARD" and "CASH"
    When the analyst adds "TRANSFER" with a description
    Then the current draft contains the new allowed value
    And the published source version is unchanged

  Scenario: Conditional presence rule
    Given account is mandatory when method is "TRANSFER"
    When a sample contains that method without account
    Then the rule fails with its configured message

  Scenario: Disclose unsupported rule enforcement
    Given a cross-field rule cannot run in the selected target profile
    When the analyst validates the schema
    Then the system identifies the unsupported rule
    And does not claim it is enforced

  Scenario: Reject overlapping fixed-width fields
    Given two field position ranges overlap
    When the analyst generates the layout
    Then generation is blocked with a location-specific finding

  Scenario: Preserve unknown source semantics
    Given an uploaded definition contains an uneditable construct
    And correct preservation cannot be guaranteed
    When the analyst generates an artefact
    Then generation is blocked rather than silently dropping it

  Scenario: Prevent publication of stale output
    Given an artefact has been generated
    When the analyst changes a schema constraint
    Then the artefact is marked stale
    And Publish requires validation and generation of the new revision

  Scenario: Publish the current valid version
    Given the current revision has valid generated output
    When the analyst selects Publish and saving succeeds
    Then that version appears in Schema register as Ready

  Scenario: Handle an uncertain publication result
    Given publication was submitted
    When its result cannot be confirmed
    Then the system shows an unconfirmed outcome
    And does not automatically submit another publication

  @AC-10 @specification
  Scenario Outline: Required nullable JSON property
    Given a required JSON string property allows null
    When the instance contains <value>
    Then presence and type validation <result>
    Examples:
      | value           | result |
      | no property     | fails  |
      | null            | passes |
      | an empty string | passes |
      | text            | passes |
      | a number        | fails  |

  @AC-12 @specification
  Scenario Outline: Optional bounded array
    Given an optional JSON array allows one to three items
    When the instance contains <value>
    Then array cardinality validation <result>
    Examples:
      | value        | result |
      | no property  | passes |
      | zero items   | fails  |
      | one item     | passes |
      | two items    | passes |
      | three items  | passes |
      | four items   | fails  |
      | null         | fails  |

  @AC-16 @specification
  Scenario Outline: Five digit identifier boundaries
    Given a string identifier requires exactly five ASCII digits
    When the value is <value>
    Then validation <result> without numeric coercion
    Examples:
      | value  | result |
      | 00123  | passes |
      | 12345  | passes |
      | 1234   | fails  |
      | 123456 | fails  |
      | 12A45  | fails  |
      | -1234  | fails  |

  @AC-17 @specification
  Scenario Outline: Numeric range boundaries
    Given a decimal field is greater than zero and at most one hundred
    When the value is <value>
    Then range validation <result>
    Examples:
      | value  | result |
      | -0.01  | fails  |
      | 0      | fails  |
      | 0.01   | passes |
      | 100    | passes |
      | 100.01 | fails  |
