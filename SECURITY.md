# Security policy

## Reporting

Report suspected vulnerabilities privately to the repository owner. Do not open a public issue for credential leaks, unauthenticated access, or cross-tenant exposure.

## Non-negotiable rules

1. Local passwords are stored only as Argon2id hashes with a unique salt and an application pepper held in a secret manager.
2. Secrets never appear in source, logs, reports, OpenAPI examples that are copied into production configs, or downloadable branding JSON.
3. Demo identities from `dev/demo-seed/` are disposable fixtures. Seeding or authenticating them in UAT, pre-production, or production must fail closed.
4. Tenant isolation is enforced at application, database (RLS), object-storage prefix, cache key, queue, job, report, webhook, and audit layers.
5. Functional permission never grants data access by itself. Payload visibility is `none | metadata_only | masked | unmasked`.
6. State-changing and asynchronous commands require an `Idempotency-Key`. Updates and transitions require `If-Match` ETags.
7. Uploads are scanned and validated against malicious XML, archive bombs, MIME spoofing, and size limits.
8. Webhooks and portable bundles are signed. External URLs are SSRF-constrained.
9. Privileged, denied, export, unmasked-payload, tenant, access, promotion, and operator actions are audited.
10. Production-class data is disabled by default.
11. Field encryption follows SCS-001: the AES write switch never disables decryption of existing ciphertext. Vault Transit (or the local transit stand-in) owns keys. Secrets are references, not rows in PostgreSQL.


## Demo seed handling

`dev/demo-seed/sand-bench-demo-tenants-users.json` contains fictional temporary passwords. They exist so a developer can import accounts through the credential service. After import:

- plaintext must not be retained in the database or logs
- `mustChangePassword` remains true until the user changes it
- MFA requirements in the seed file are honoured

## GitHub controls

Required on `main` (enable in the repository settings; some options depend on plan):

- pull requests required
- at least one approval
- required status checks
- conversation resolution required
- no force pushes
- no branch deletion
- secret scanning
- push protection
- Dependabot alerts and version updates

See `docs/operations/github-security-settings.md`.

## CI security job

`.github/workflows/security.yml` runs on every push/PR and weekly:

1. Gitleaks (git history) using `.gitleaks.toml`
2. `npm audit --omit=dev --audit-level=high`
3. Snyk (`snyk/actions/node`, high+) when repo secret `SNYK_TOKEN` is set; otherwise the step is skipped
4. Trivy filesystem scan — HIGH/CRITICAL, unfixed ignored

Demo-seed fictional passwords are allowlisted. Application source is not. Enable GitHub secret scanning + push protection in repository settings as well.
