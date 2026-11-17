# Use-case → E2E GUI coverage map

Every use case under `docs/use-cases/UC-*.md` has one GUI-availability test case in the Sand Bench E2E GUI suite (`sb-e2e-gui`). The test opens the UC's screen through the console and confirms it is served to its actor — the entry point every richer check builds on.

Flow-level coverage (walking the main / alternate / exception flows end to end) lives in `apps/api/src/catalog/sandbench-usecase-flow-cases-batch*.ts` and is linked by its own `UC-*` tag; this document captures the GUI-element layer that was previously missing.

## Coverage snapshot (verified 2026-10-10)

- Sand Bench deployment serves **100** HTML pages (verified from the running `sand-bench-staging-web-1` container's static dir plus nginx rewrites).
- Catalog targets **100 of 100** real pages — no untested pages, no dead URLs.
- **63 UC-availability cases** (`uc:UC-<id>` tag) cover every use case under `docs/use-cases/`.
- **32 extra page-availability cases** (`SB-E2E-GUI-PAGE-*`) cover the pages that have no UC yet: AI authoring, Analytics, Attacks history, Data access/feeders, Field rules, Improvements, Kafka endpoints, My sessions, Patterns, Schema converter/tree, Suite evidence, 10 Use-case sub-tabs, Rule canvas sub-directory, and the 50x error page.

## URL map correction

The UC handbooks use internal "page keys" like `dsAll` and `msgCreateSchema`; Sand Bench's actual URLs use product-level names like `/datasets.html` and `/create-schema.html`. Every UC availability case was repointed at the real URL after cross-checking the live deployment's static dir on 2026-10-10. The table below shows the mapping that was corrected (all other UCs use a URL that matches the kebab-case of the page key).

## How to read a row

- **UC** — the use-case id, matching the file in `docs/use-cases/UC-<id>.md`.
- **Page key** — the key the UC's handbook sets on the screen; the URL is `/<kebab-case page key>.html`.
- **Case** — the catalog case key, filterable in the console by the `uc:UC-<id>` tag.
- **Scope** — public (no sign-in) or signed-in; whether the case reaches the screen directly or via the operator session.
- **Controls** — count of `kind: control` assets the UC's handbook lists; non-zero means the UC has specific GUI controls whose checks are deferred until the Sand Bench sidebar bundle is restored and real selectors are discovered (per [docs/E2E-GUI-COVERAGE-STATUS.md](./E2E-GUI-COVERAGE-STATUS.md)).

## Running the UC → test lookup

```sh
# every UC availability case
curl -s "http://127.0.0.1:8797/api/v1/ui/summary?application=sand-bench" |
  jq '.data.cases[] | select(.tags | contains(["e2e-gui"]) and .[] | startswith("uc:"))'

# one specific UC
curl -s "http://127.0.0.1:8797/api/v1/ui/summary?application=sand-bench" |
  jq '.data.cases[] | select(.tags | contains(["uc:UC-overview"]))'
```

## The map (63 use cases → 63 cases)

### Public (no sign-in)

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-about | `about` | `SB-E2E-GUI-UC-ABOUT` | 0 |
| UC-help | `help` | `SB-E2E-GUI-UC-HELP` | 0 |
| UC-naming | `naming` | `SB-E2E-GUI-UC-NAMING` | 0 |
| UC-featureIds | `featureIds` | `SB-E2E-GUI-UC-FEATURE-IDS` | 0 |
| UC-security | `security` | `SB-E2E-GUI-UC-SECURITY` | 0 |

### Workspace and overview

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-overview | `overview` | `SB-E2E-GUI-UC-OVERVIEW` | 0 |
| UC-features | `features` | `SB-E2E-GUI-UC-FEATURES` | 0 |
| UC-applicationEvents | `applicationEvents` | `SB-E2E-GUI-UC-APPLICATION-EVENTS` | 0 |
| UC-eventFramework | `eventFramework` | `SB-E2E-GUI-UC-EVENT-FRAMEWORK` | 3 |
| UC-externalSystems | `externalSystems` | `SB-E2E-GUI-UC-EXTERNAL-SYSTEMS` | 0 |

### Configuration

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-configuration | `configuration` | `SB-E2E-GUI-UC-CONFIGURATION` | 1 |
| UC-configurationApiAccess | `configurationApiAccess` | `SB-E2E-GUI-UC-CONFIGURATION-API-ACCESS` | 0 |
| UC-configurationAppConfigs | `configurationAppConfigs` | `SB-E2E-GUI-UC-CONFIGURATION-APP-CONFIGS` | 2 |
| UC-configurationDataRetention | `configurationDataRetention` | `SB-E2E-GUI-UC-CONFIGURATION-DATA-RETENTION` | 0 |
| UC-configurationEnvironmentDefaults | `configurationEnvironmentDefaults` | `SB-E2E-GUI-UC-CONFIGURATION-ENVIRONMENT-DEFAULTS` | 0 |
| UC-configurationEventing | `configurationEventing` | `SB-E2E-GUI-UC-CONFIGURATION-EVENTING` | 3 |
| UC-configurationNotifications | `configurationNotifications` | `SB-E2E-GUI-UC-CONFIGURATION-NOTIFICATIONS` | 0 |
| UC-configurationUserRoles | `configurationUserRoles` | `SB-E2E-GUI-UC-CONFIGURATION-USER-ROLES` | 0 |

### URL corrections applied

| UC | Page key (internal) | Real URL (deployment) |
|---|---|---|
| UC-dsAll | `dsAll` | `/datasets.html` |
| UC-dsNew | `dsNew` | `/datasets-new.html` |
| UC-msgCreateSchema | `msgCreateSchema` | `/create-schema.html` |
| UC-msgImportSchema | `msgImportSchema` | `/imported-schemes.html` |
| UC-msgSchemaCanvas | `msgSchemaCanvas` | `/schema-canvas.html` |
| UC-msgSchemaRegister | `msgSchemaRegister` | `/message-designer-schema-register.html` |
| UC-msgViewSaved | `msgViewSaved` | `/message-designer-saved.html` |
| UC-msgDataFiles | `msgDataFiles` | `/message-data-files.html` |
| UC-msgExportTemplate | `msgExportTemplate` | `/message-designer-export-template.html` |
| UC-repAll / Compliance / Coverage / Runs / Scheduled / Suites | `rep*` | `/reports-*.html` |
| UC-schAll / New / Upcoming | `sch*` | `/schedules-*.html` |
| UC-tcPool | `tcPool` | `/test-cases.html` |
| UC-tcNew | `tcNew` | `/test-case-form.html` |
| UC-tsAll | `tsAll` | `/test-suites.html` |
| UC-tsNew | `tsNew` | `/test-suite-new.html` |
| UC-trAll / Active / New | `tr*` | `/test-runs-*.html` |
| UC-trHistory | `trHistory` | `/test-runs-all.html` (history is a view on the All page) |
| UC-useCaseEditor | `useCaseEditor` | `/use-case.html` (editor is the main page in edit mode) |
| UC-users | `users` | `/configuration-users.html` (admin surface under Configuration) |
| UC-userCreate | `userCreate` | `/configuration-users.html` (modal on the users page) |
| UC-roles | `roles` | `/configuration-user-roles.html` |
| UC-roleCreate | `roleCreate` | `/configuration-user-roles.html` (modal) |
| UC-messageDesigner{Workspace, Family, Message, Fields} | `*` | `/message-designer.html` (tabs on the designer page) |
| UC-features | `features` | `/overview.html` (features are surfaced on Overview) |

### Datasets

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-dsAll | `/datasets.html` | `SB-E2E-GUI-UC-DS-ALL` | 0 |
| UC-dsNew | `/datasets-new.html` | `SB-E2E-GUI-UC-DS-NEW` | 0 |

### Message Designer

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-messageDesigner | `messageDesigner` | `SB-E2E-GUI-UC-MESSAGE-DESIGNER` | 0 |
| UC-messageDesignerWorkspace | `messageDesignerWorkspace` | `SB-E2E-GUI-UC-MESSAGE-DESIGNER-WORKSPACE` | 0 |
| UC-messageDesignerFamily | `messageDesignerFamily` | `SB-E2E-GUI-UC-MESSAGE-DESIGNER-FAMILY` | 0 |
| UC-messageDesignerMessage | `messageDesignerMessage` | `SB-E2E-GUI-UC-MESSAGE-DESIGNER-MESSAGE` | 0 |
| UC-messageDesignerFields | `messageDesignerFields` | `SB-E2E-GUI-UC-MESSAGE-DESIGNER-FIELDS` | 0 |

### Message schema / data files

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-msgCreateSchema | `msgCreateSchema` | `SB-E2E-GUI-UC-MSG-CREATE-SCHEMA` | 3 |
| UC-msgImportSchema | `msgImportSchema` | `SB-E2E-GUI-UC-MSG-IMPORT-SCHEMA` | 2 |
| UC-msgSchemaCanvas | `msgSchemaCanvas` | `SB-E2E-GUI-UC-MSG-SCHEMA-CANVAS` | 3 |
| UC-msgSchemaRegister | `msgSchemaRegister` | `SB-E2E-GUI-UC-MSG-SCHEMA-REGISTER` | 0 |
| UC-msgViewSaved | `msgViewSaved` | `SB-E2E-GUI-UC-MSG-VIEW-SAVED` | 0 |
| UC-msgDataFiles | `msgDataFiles` | `SB-E2E-GUI-UC-MSG-DATA-FILES` | 0 |
| UC-msgExportTemplate | `msgExportTemplate` | `SB-E2E-GUI-UC-MSG-EXPORT-TEMPLATE` | 0 |

### Rule Bench

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-ruleBenchCreate | `ruleBenchCreate` | `SB-E2E-GUI-UC-RULE-BENCH-CREATE` | 0 |
| UC-ruleBenchExisting | `ruleBenchExisting` | `SB-E2E-GUI-UC-RULE-BENCH-EXISTING` | 0 |
| UC-ruleBenchExport | `ruleBenchExport` | `SB-E2E-GUI-UC-RULE-BENCH-EXPORT` | 0 |
| UC-ruleBenchStage | `ruleBenchStage` | `SB-E2E-GUI-UC-RULE-BENCH-STAGE` | 0 |
| UC-ruleBenchValidate | `ruleBenchValidate` | `SB-E2E-GUI-UC-RULE-BENCH-VALIDATE` | 0 |
| UC-ruleCanvas | `ruleCanvas` | `SB-E2E-GUI-UC-RULE-CANVAS` | 0 |

### Scheme definitions

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-schemeDefinitions | `schemeDefinitions` | `SB-E2E-GUI-UC-SCHEME-DEFINITIONS` | 0 |

### Reports

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-repAll | `repAll` | `SB-E2E-GUI-UC-REP-ALL` | 0 |
| UC-repCompliance | `repCompliance` | `SB-E2E-GUI-UC-REP-COMPLIANCE` | 0 |
| UC-repCoverage | `repCoverage` | `SB-E2E-GUI-UC-REP-COVERAGE` | 0 |
| UC-repRuns | `repRuns` | `SB-E2E-GUI-UC-REP-RUNS` | 0 |
| UC-repScheduled | `repScheduled` | `SB-E2E-GUI-UC-REP-SCHEDULED` | 0 |
| UC-repSuites | `repSuites` | `SB-E2E-GUI-UC-REP-SUITES` | 2 |

### Schedules

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-schAll | `schAll` | `SB-E2E-GUI-UC-SCH-ALL` | 0 |
| UC-schNew | `schNew` | `SB-E2E-GUI-UC-SCH-NEW` | 0 |
| UC-schUpcoming | `schUpcoming` | `SB-E2E-GUI-UC-SCH-UPCOMING` | 0 |

### Test cases / suites / runs

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-tcPool | `tcPool` | `SB-E2E-GUI-UC-TC-POOL` | 0 |
| UC-tcNew | `tcNew` | `SB-E2E-GUI-UC-TC-NEW` | 0 |
| UC-tsAll | `tsAll` | `SB-E2E-GUI-UC-TS-ALL` | 0 |
| UC-tsNew | `tsNew` | `SB-E2E-GUI-UC-TS-NEW` | 0 |
| UC-trAll | `trAll` | `SB-E2E-GUI-UC-TR-ALL` | 0 |
| UC-trActive | `trActive` | `SB-E2E-GUI-UC-TR-ACTIVE` | 0 |
| UC-trHistory | `trHistory` | `SB-E2E-GUI-UC-TR-HISTORY` | 0 |
| UC-trNew | `trNew` | `SB-E2E-GUI-UC-TR-NEW` | 0 |

### Use case editing

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-useCaseEditor | `useCaseEditor` | `SB-E2E-GUI-UC-USE-CASE-EDITOR` | 1 |
| UC-useCaseReview | `useCaseReview` | `SB-E2E-GUI-UC-USE-CASE-REVIEW` | 0 |
| UC-useCaseTemplates | `useCaseTemplates` | `SB-E2E-GUI-UC-USE-CASE-TEMPLATES` | 0 |

### Users and roles

| UC | Page key | Case key | Controls |
|---|---|---|---:|
| UC-users | `users` | `SB-E2E-GUI-UC-USERS` | 0 |
| UC-userCreate | `userCreate` | `SB-E2E-GUI-UC-USER-CREATE` | 0 |
| UC-roles | `roles` | `SB-E2E-GUI-UC-ROLES` | 0 |
| UC-roleCreate | `roleCreate` | `SB-E2E-GUI-UC-ROLE-CREATE` | 0 |

## Controls on the UC side (18 across 8 UCs) — deferred

Eight UCs list specific GUI controls in their `screen and action contract`; the GUI-availability case for each of them probes the screen only. Testing each control's exact selector and its action is deferred because:

- The pinned Sand Bench build is missing `/vendor/opsConsolePortal.js` (the React sidebar bundle), so screens for most of these UCs render as an empty shell. No React-rendered selector is observable until that bundle lands.
- Verified DOM selectors for the controls are not published in the UC handbooks (the `source: catalogue` + `verification: needs-review` fields in each UC make that explicit).

**What to add once the sidebar lands:** one new case per control, selector-driven, probing availability (`wait_for selector`) and action (`click selector` + a verified outcome).

Specifically:
- UC-configuration (1 control)
- UC-configurationAppConfigs (2 controls)
- UC-configurationEventing (3 controls)
- UC-eventFramework (3 controls)
- UC-msgCreateSchema (3 controls)
- UC-msgImportSchema (2 controls)
- UC-msgSchemaCanvas (3 controls)
- UC-repSuites (2 controls)
- UC-useCaseEditor (1 control)

Total controls to cover: **18**, in **9 UCs**.
