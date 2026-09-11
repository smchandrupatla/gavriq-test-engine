# Demo seed

Source file: `sand-bench-demo-tenants-users.json`

## Purpose

Fictional tenants and users for **development and demonstration only**.

Tenants in this seed:

- `tenant_demo_acme` / `acme-demo` — Acme Assurance Demo
- `tenant_demo_northstar` / `northstar-demo` — Northstar Payments Demo

## Activation guard

Import is allowed only when:

- `ALLOW_DEMO_IDENTITIES=true`
- environment classification is `development` or `demo`

Application startup must fail if demo identities are enabled in `uat`, `preproduction`, or `production`.

## Credential handling

Temporary passwords in the JSON are fixtures. Import must:

1. pass each password through the Argon2id credential service
2. store only the hash
3. keep `mustChangePassword=true`
4. never log or return the seeded password after import

Automated tests must prove the two demo tenants cannot read one another’s data.
