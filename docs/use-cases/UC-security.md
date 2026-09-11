# Control write encryption without breaking historical decrypt

- **ID:** UC-security
- **Screen:** Security & cryptography
- **Page key:** `security`
- **Level:** 3
- **Style:** casual
- **Actor:** Crypto / security admin
- **Extends from:** (none identified)
- **Extends to:** (none identified)

## Goal

Control new encryption writes while retaining authorised access to historical encrypted records.

## Precondition

The security operator has the applicable access and can inspect the selected encryption provider health.

## Trigger

Operator opens Security & cryptography and reviews health, policy and coverage.

## Success guarantee

Control new encryption writes while retaining authorised access to historical encrypted records. The specific result is observable through the acceptance criteria below. These are specification outcomes; source review does not certify deployed behavior.

## Minimal guarantee (on failure)

Provider failure does not silently store plaintext under an encrypted-success claim. A failed reveal is not reported as empty plaintext.

## Acceptance criteria

1. **AC-01 [proposed]** Given an ENCRYPTED record exists, when write encryption is disabled and the record is revealed, authorised historical decryption still returns its original content.
2. **AC-02 [proposed]** Given the required provider is unavailable, when an encrypted write is attempted, it does not silently succeed as plaintext.
3. **AC-03 [proposed]** Given write-disabled policy permits pending plaintext, when a sensitive record is created, its state is explicitly pending encryption.
4. **AC-04 [proposed]** Given a record uses an older key version, when a new key version is created, historical decryption remains supported under the configured retention policy.

## Main flow

1. Operator opens Security & cryptography and reviews health, policy and coverage.
2. Operator creates a supported synthetic protected record.
3. System reports the record state and provider outcome.
4. Operator changes writeEnabled deliberately and checks the returned policy.
5. Operator reveals the historical encrypted record through the supported access path.
6. Operator may re-enable encryption and explicitly remediate pending records.

## Alternate flows

1. Rotate the key while retaining supported historical-key decryption.
2. Write-disabled behavior follows the configured reject or pending-plaintext policy.

## Exception flows

1. Provider failure does not silently store plaintext under an encrypted-success claim.
2. A failed reveal is not reported as empty plaintext.

## Business validation

1. Write enablement does not control historical decryption.
2. Key rotation, rewrapping and deletion are different operations; a key version is not disposable merely because a new one exists.

## Technical notes / APIs

1. Specification targets are marked proposed pending product acceptance; they are not claims of implemented or passing behavior. Source observations and gaps below bound the proposed flow.
2. Catalogue SCR/MENU/SUBMENU and inferred action/event IDs are documentation identities, not verified DOM selectors or audit emissions. API inventory does not imply every API runs on every step.
3. GET /api/v1/security/health
4. PATCH /api/v1/security/encryption
5. POST /api/v1/security/records
6. GET /api/v1/security/records/:id
7. POST /api/v1/security/remediate
8. POST /api/v1/security/rotate

### Screen and action contract

Catalogue and inferred identities are not verified DOM selectors or audit emissions. Branch outcomes are not clickable buttons. Empty background events mean no per-step invocation has been verified.

```json
{
  "screenId": "SCR-security",
  "screenName": "Security & cryptography",
  "navigation": {
    "menu": {
      "assetId": "MENU-configuration",
      "kind": "menu",
      "name": "Configuration",
      "label": "Configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    "submenu": {
      "assetId": "SUBMENU-security",
      "kind": "submenu",
      "name": "Security & cryptography",
      "label": "Security & cryptography",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    }
  },
  "assets": [
    {
      "assetId": "MENU-configuration",
      "kind": "menu",
      "name": "Configuration",
      "label": "Configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SUBMENU-security",
      "kind": "submenu",
      "name": "Security & cryptography",
      "label": "Security & cryptography",
      "parentAssetId": "MENU-configuration",
      "source": "catalogue",
      "verification": "needs-review"
    },
    {
      "assetId": "SCR-security",
      "kind": "screen",
      "name": "Security & cryptography",
      "label": "Security & cryptography",
      "source": "catalogue",
      "verification": "needs-review"
    }
  ],
  "steps": [
    {
      "number": 1,
      "flowId": "MAIN-security-1",
      "flowKind": "main",
      "instruction": "Operator opens Security & cryptography and reviews health, policy and coverage.",
      "screenId": "SCR-security",
      "assetIds": [
        "SCR-security"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "MAIN-security-2",
      "flowKind": "main",
      "instruction": "Operator creates a supported synthetic protected record.",
      "screenId": "SCR-security",
      "assetIds": [
        "SCR-security"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 3,
      "flowId": "MAIN-security-3",
      "flowKind": "main",
      "instruction": "System reports the record state and provider outcome.",
      "screenId": "SCR-security",
      "assetIds": [
        "SCR-security"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 4,
      "flowId": "MAIN-security-4",
      "flowKind": "main",
      "instruction": "Operator changes writeEnabled deliberately and checks the returned policy.",
      "screenId": "SCR-security",
      "assetIds": [
        "SCR-security"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 5,
      "flowId": "MAIN-security-5",
      "flowKind": "main",
      "instruction": "Operator reveals the historical encrypted record through the supported access path.",
      "screenId": "SCR-security",
      "assetIds": [
        "SCR-security"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 6,
      "flowId": "MAIN-security-6",
      "flowKind": "main",
      "instruction": "Operator may re-enable encryption and explicitly remediate pending records.",
      "screenId": "SCR-security",
      "assetIds": [
        "SCR-security"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Apply the actor/system step as specified; implementation gaps are recorded in Technical notes.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "ALT-security-1",
      "flowKind": "alternate",
      "instruction": "Rotate the key while retaining supported historical-key decryption.",
      "screenId": "SCR-security",
      "assetIds": [
        "SCR-security"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Rotate the key while retaining supported historical-key decryption.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "ALT-security-2",
      "flowKind": "alternate",
      "instruction": "Write-disabled behavior follows the configured reject or pending-plaintext policy.",
      "screenId": "SCR-security",
      "assetIds": [
        "SCR-security"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Write-disabled behavior follows the configured reject or pending-plaintext policy.",
      "backgroundEvents": []
    },
    {
      "number": 1,
      "flowId": "EXC-security-1",
      "flowKind": "exception",
      "instruction": "Provider failure does not silently store plaintext under an encrypted-success claim.",
      "screenId": "SCR-security",
      "assetIds": [
        "SCR-security"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "Provider failure does not silently store plaintext under an encrypted-success claim.",
      "backgroundEvents": []
    },
    {
      "number": 2,
      "flowId": "EXC-security-2",
      "flowKind": "exception",
      "instruction": "A failed reveal is not reported as empty plaintext.",
      "screenId": "SCR-security",
      "assetIds": [
        "SCR-security"
      ],
      "alternativeFlowIds": [],
      "exceptionFlowIds": [],
      "invokesUseCases": [],
      "outcome": "A failed reveal is not reported as empty plaintext.",
      "backgroundEvents": []
    }
  ],
  "auditActions": [],
  "events": [],
  "backgroundEvents": [],
  "provenance": "catalogue"
}
```

### Additional notes

### Source evidence

- apps/api/src/security/registerSecurity.ts
- apps/web/public/js/security-bind.js

### Implementation gaps and decisions

- Provider health, policy boundaries, per-record access and remediation counts need deployment-specific verification. Vault semantics do not prove the local fallback is equivalent.

### Research basis

- [HashiCorp, Vault Transit secrets engine (living documentation, accessed 2026-09-11)](https://developer.hashicorp.com/vault/docs/secrets/transit)

The references support the domain distinctions in Business validation; the product workflow is a specification choice. Source review is static, not a deployed-system conformance test.

### External regression coverage

The independent Test Engine links this use case by ID UC-security and name Control write encryption without breaking historical decrypt. Backend catalogue checks live in sit/cases/51-use-case-api.sit.ts; desktop/mobile editor checks live in sit/cases/64-use-case-ui.sit.ts. Both retain the use-case identity in results and database history. These checks cover use-case delivery and editor integrity, not all business-feature acceptance. The acceptance scenarios remain specification-only until a feature-specific executable adapter and evidence are available. Open Test Engine cases from the use-case editor to filter this case.

### API registration evidence

Registration proves a source handler exists, not that its entire required behavior is implemented or deployed.

| Method and path | Source |
|---|---|
| `GET /api/v1/security/health` | [apps/api/src/security/registerSecurity.ts:41](../../apps/api/src/security/registerSecurity.ts) |
| `PATCH /api/v1/security/encryption` | [apps/api/src/security/registerSecurity.ts:49](../../apps/api/src/security/registerSecurity.ts) |
| `POST /api/v1/security/records` | [apps/api/src/security/registerSecurity.ts:83](../../apps/api/src/security/registerSecurity.ts) |
| `GET /api/v1/security/records/:id` | [apps/api/src/security/registerSecurity.ts:103](../../apps/api/src/security/registerSecurity.ts) |
| `POST /api/v1/security/remediate` | [apps/api/src/security/registerSecurity.ts:119](../../apps/api/src/security/registerSecurity.ts) |
| `POST /api/v1/security/rotate` | [apps/api/src/security/registerSecurity.ts:128](../../apps/api/src/security/registerSecurity.ts) |

## Scenarios

1. Historical reveal: an ENCRYPTED record exists; write encryption is disabled and the record is revealed; expected: authorised historical decryption still returns its original content.
2. Fail closed: the required provider is unavailable; an encrypted write is attempted; expected: it does not silently succeed as plaintext.
3. Pending state: write-disabled policy permits pending plaintext; a sensitive record is created; expected: its state is explicitly pending encryption.
4. Rotation: a record uses an older key version; a new key version is created; expected: historical decryption remains supported under the configured retention policy.

## Gherkin

```gherkin
Feature: Security & cryptography

  @UC-security @AC-01 @specification
  Scenario: Historical reveal
    Given an ENCRYPTED record exists
    When write encryption is disabled and the record is revealed
    Then authorised historical decryption still returns its original content

  @UC-security @AC-02 @specification
  Scenario: Fail closed
    Given the required provider is unavailable
    When an encrypted write is attempted
    Then it does not silently succeed as plaintext

  @UC-security @AC-03 @specification
  Scenario: Pending state
    Given write-disabled policy permits pending plaintext
    When a sensitive record is created
    Then its state is explicitly pending encryption

  @UC-security @AC-04 @specification
  Scenario: Rotation
    Given a record uses an older key version
    When a new key version is created
    Then historical decryption remains supported under the configured retention policy
```
