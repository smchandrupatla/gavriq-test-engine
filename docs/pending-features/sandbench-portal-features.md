# Sand Bench ↔ portal features — implementation spec (pending)

Written for: engineers who will implement features in `sand-bench-enterprise`,
`gavriq-ftp-desk`, and (optionally) the other portal repos.

The forward-looking test cases that validate each feature live at
`apps/api/src/catalog/sandbench-pending-feature-cases.ts`. They are expected
to fail on today’s pinned staging deployment and go green once each feature
lands.

## Context

The staging stack is pinned to Sand Bench commit `e69acaf27f17` for defect-
hunting (`deploy/staging/deploy.mjs --ref=main`, where main is pinned). Three
features operators have asked for do not exist on that commit. Each lives in
a separate repository and requires its own build + deploy.

A test-engine run against staging today will:
* 367 Sand Bench API-coverage cases — all pass.
* 20 event-round-trip cases — all pass.
* 5 ISO consumer cases on the API portal — all pass.
* 8 pending-feature cases (this doc) — all fail with specific, documented
  diagnostics that match the spec in each case.

## Feature 2A — Download a generated run file to the FTP folder

### Problem

`POST /api/v1/generated-messages` produces a message set that the operator
can only download locally (via the UI). The user wants a parallel path that
writes the generated file onto the shared FTP volume so the FTP portal lists
it.

### Current wiring observation (worth noting)

* `gavriq-ftp-desk` mounts the external volume
  `sand-bench-enterprise_ftp-data` at `/ftp:ro` (see `compose.yaml`).
* That volume is owned by the `sand-bench-enterprise` compose project (the
  dev stack on ports 8080/8787), not by `sand-bench-staging` (18080/18787).
* As a result, nothing a staging run writes shows up on the FTP portal
  today, even if Sand Bench did write files. This mis-wiring must be fixed
  (or a shared volume introduced) alongside the feature.

### Proposed changes

**Sand Bench (`sand-bench-enterprise`)**
* New route `POST /api/v1/generated-messages/to-ftp` in a new module
  `apps/api/src/modules/ftpDeposit.ts`.
* Request body: `{ messageTypeCode, count?, seed?, filename? }`.
* Behaviour: generate `count` messages (reuse the existing generator), write
  them as one `.xml` or `.jsonl` artefact to `/sandbench/<filename or
  <ts>-<rand>.xml>` on the mount at `FTP_DROP_ROOT` (default `/ftp`).
* Response: `{ runId, filename, bytes, path, ftpPortalListingUrl }`.
* Emit `biz.file.generated` and a new `tec.ftp.deposited` event.
* Config: `FTP_DROP_ROOT` env var.

**Staging deployment (`deploy/staging/compose.override.yml`)**
* Add a volume `ftp-drop` and mount it RW on `sand-bench-staging-api`,
  `sand-bench-staging-worker` at `/ftp`.
* Rewire `gavriq-ftp-desk`’s external volume to point at
  `sand-bench-staging_ftp-drop` instead of
  `sand-bench-enterprise_ftp-data` when the staging stack is live.

### Test cases (already written)

* `SBE-GEN-DOWNLOAD-LOCAL` — the existing local-download path still works.
* `SBE-GEN-DOWNLOAD-FTP` — the new FTP deposit path writes and the portal
  lists it within 10 seconds.

## Feature 2B — Nominate a generated file for delivery

### Problem

Once a run has produced files, the operator wants to “send this one to the
Kafka portal” (or MQ, FTP, API) without re-generating. Today the channel is
decided at run start (`POST /api/v1/runs { channel }`) and the generated
file is not addressable post-hoc.

### Proposed changes

**Sand Bench (`sand-bench-enterprise`)**
* New route `POST /api/v1/generated-messages/:id/dispatch` in a new module
  `apps/api/src/modules/generatedMessageDispatch.ts`.
* Request body: `{ channel, tag?, externalSystemId? }` where channel is one of
  `api|mq|kafka|ftp|file`.
* Behaviour: look up the stored artefact by id (requires persisted
  generated-messages — see note below), look up the configured delivery
  target for that channel (via existing `channel_targets` table or the
  external-system record identified by `externalSystemId`), and forward the
  bytes with an operator-chosen `tag` embedded in the payload (or set as a
  message header the portals already recognise, `x-sandbench-tag`).
* Response: `{ accepted, deliveryId, channel, portalBase, status }`.

**Persistence note**
* Today “generated-messages” may not persist beyond the response. The
  dispatch feature requires either an explicit persist step on generation
  (add `?persist=true`) or a cache keyed by the returned `runId`.

**Portals** — no change. The existing `/app/log` / `/app/files` endpoints
suffice.

### Test cases (already written)

* `SBE-GEN-DISPATCH-MQ`
* `SBE-GEN-DISPATCH-KAFKA`
* `SBE-GEN-DISPATCH-API`
* `SBE-GEN-DISPATCH-FTP`

## Feature 2C — JSON Schema loader + generator

### Problem

Sand Bench ingests XSDs today. The operator wants to upload a JSON Schema
and generate messages that satisfy it, posting them to API endpoints that
accept JSON.

### Proposed changes

**Sand Bench (`sand-bench-enterprise`)**
* Extend `POST /api/v1/schemas` to accept `format: "json-schema"` and a
  `schema` payload (the JSON Schema itself). Store it in the existing
  `schemas` table with `format` added. Add migration.
* New module `apps/api/src/modules/jsonSchemaParser.ts` that extracts
  message types / fields from a JSON Schema in the same shape the XSD parser
  does today (so the catalogue, designer, and generator all pick it up
  without surgery).
* Extend the generator to produce JSON instances when the source is a JSON
  Schema (use a well-maintained package like `json-schema-faker` or write a
  minimal walker for the subset we actually need: primitive types, enums,
  required, pattern, minimum/maximum, items).
* Message-type codes derived from the schema’s `$id` or `title`.

**API portal (`gavriq-api-desk`)**
* No change required. The generic `/inbound/<anything>` handler already
  records JSON bodies.

### Test cases (already written)

* `SBE-SCHEMA-UPLOAD-JSON-SCHEMA`
* `SBE-GEN-FROM-JSON-SCHEMA`

## Feature 3A — ISO consumer endpoints on the API portal

### Status: already supported (no code change needed)

The API portal’s `/inbound/<anything>` is a generic handler that records any
POST path and body. New ISO types work out of the box.

Added 5 explicit test cases that prove this for pacs.008 (v8 + v14),
pain.001.001.09, pain.002.001.10 and camt.053.001.08. They passed on
2026-10-10. See `sandbench-portal-cases.ts`.

If a stricter per-type contract is wanted later (schema validation of the
inbound XML, per-type ledger view in the portal UI), that is a separate
story and would open per-type endpoints with explicit validators.

## Execution notes

* Each Sand Bench change should be made on a dedicated branch of
  `sand-bench-enterprise` so staging can continue to deploy from
  `--ref=main` while feature previews deploy from `--ref=<branch>`. Only
  merge the branch to main when the pinned-defect workflow is ready to roll
  forward.
* Rebuild staging: `node deploy/staging/deploy.mjs up --ref=<branch>`.
* After each feature lands and staging is redeployed on it, re-run the
  pending-feature suite (`sb-pending-features`) and move cases from pending
  to the ordinary portal suite once they go green.
