# Use-case coverage and implementation audit

Reviewed against the repository source on 2026-09-11. This is static specification and contract review, not certification of a deployed application.

Coverage: **63 use cases**, including **44 feature-catalogue entries**. Every native CONFIG page, sidebar navigation key, source DETAILS entry and pre-existing UC Markdown file is accounted for below. Aliases preserve the existing UC IDs. Documentation-only additions do not change feature grants.

| Use case | Screen binding | Feature key | Criteria | API registration |
|---|---|---|---|---|
| [UC-overview](UC-overview.md) | custom navigation: overview | overview | 4 | 2 source-registered |
| [UC-ruleBenchExisting](UC-ruleBenchExisting.md) | CONFIG.pages.ruleBenchExisting | ruleBenchExisting | 4 | 1 source-registered |
| [UC-ruleBenchCreate](UC-ruleBenchCreate.md) | CONFIG.pages.ruleBenchCreate | ruleBenchCreate | 4 | 1 source-registered |
| [UC-ruleBenchExport](UC-ruleBenchExport.md) | CONFIG.pages.ruleBenchExport | ruleBenchExport | 4 | 1 source-registered |
| [UC-msgViewSaved](UC-msgViewSaved.md) | CONFIG.pages.msgViewSaved | msgViewSaved | 4 | 2 source-registered |
| [UC-msgDataFiles](UC-msgDataFiles.md) | overlay, standalone or unlinked; see case evidence | msgDataFiles | 4 | 2 source-registered |
| [UC-msgExportTemplate](UC-msgExportTemplate.md) | CONFIG.pages.msgExportTemplate | msgExportTemplate | 4 | 2 source-registered |
| [UC-trActive](UC-trActive.md) | CONFIG.pages.trActive | trActive | 4 | 3 source-registered |
| [UC-trAll](UC-trAll.md) | CONFIG.pages.trAll | trAll | 4 | 1 source-registered |
| [UC-trHistory](UC-trHistory.md) | CONFIG.pages.trHistory | trHistory | 4 | 1 source-registered |
| [UC-dsAll](UC-dsAll.md) | CONFIG.pages.datasets | dsAll | 4 | 1 source-registered |
| [UC-dsNew](UC-dsNew.md) | overlay, standalone or unlinked; see case evidence | dsNew | 4 | 4 source-registered |
| [UC-tcPool](UC-tcPool.md) | CONFIG.pages.testCases | tcPool | 4 | 1 source-registered |
| [UC-tsAll](UC-tsAll.md) | CONFIG.pages.testSuites | tsAll | 4 | 3 source-registered |
| [UC-tsNew](UC-tsNew.md) | overlay, standalone or unlinked; see case evidence | tsNew | 4 | 2 source-registered |
| [UC-schUpcoming](UC-schUpcoming.md) | CONFIG.pages.schUpcoming | schUpcoming | 4 | 1 source-registered |
| [UC-schAll](UC-schAll.md) | CONFIG.pages.schAll | schAll | 4 | 1 source-registered |
| [UC-repAll](UC-repAll.md) | CONFIG.pages.repAll | repAll | 4 | 1 source-registered |
| [UC-repRuns](UC-repRuns.md) | overlay, standalone or unlinked; see case evidence | repRuns | 4 | 1 source-registered |
| [UC-repCoverage](UC-repCoverage.md) | CONFIG.pages.repCoverage | repCoverage | 4 | 2 source-registered |
| [UC-repCompliance](UC-repCompliance.md) | CONFIG.pages.repCompliance | repCompliance | 4 | 1 source-registered |
| [UC-configuration](UC-configuration.md) | CONFIG.pages.configuration | configuration | 4 | 1 source-registered |
| [UC-naming](UC-naming.md) | CONFIG.pages.naming | naming | 4 | 3 source-registered |
| [UC-help](UC-help.md) | overlay, standalone or unlinked; see case evidence | help | 4 | 0 source-registered |
| [UC-about](UC-about.md) | overlay, standalone or unlinked; see case evidence | about | 3 | 0 source-registered |
| [UC-ruleBenchStage](UC-ruleBenchStage.md) | CONFIG.pages.ruleBenchStage | ruleBenchStage | 4 | 2 source-registered |
| [UC-ruleBenchValidate](UC-ruleBenchValidate.md) | CONFIG.pages.ruleBenchValidate | ruleBenchValidate | 4 | 2 source-registered |
| [UC-messageDesigner](UC-messageDesigner.md) | custom navigation: messageDesigner | messageDesigner | 4 | 3 source-registered |
| [UC-messageDesignerFamily](UC-messageDesignerFamily.md) | wizard step / custom component | messageDesignerFamily | 4 | 1 source-registered |
| [UC-messageDesignerMessage](UC-messageDesignerMessage.md) | wizard step / custom component | messageDesignerMessage | 4 | 1 source-registered |
| [UC-messageDesignerFields](UC-messageDesignerFields.md) | wizard step / custom component | messageDesignerFields | 4 | 0 source-registered |
| [UC-messageDesignerWorkspace](UC-messageDesignerWorkspace.md) | wizard step / custom component | messageDesignerWorkspace | 4 | 5 source-registered |
| [UC-msgImportSchema](UC-msgImportSchema.md) | CONFIG.pages.msgImportSchema | msgImportSchema | 21 | 5 source-registered |
| [UC-msgSchemaRegister](UC-msgSchemaRegister.md) | overlay, standalone or unlinked; see case evidence | msgSchemaRegister | 4 | 2 source-registered |
| [UC-trNew](UC-trNew.md) | CONFIG.pages.trNew | trNew | 4 | 1 source-registered |
| [UC-tcNew](UC-tcNew.md) | overlay, standalone or unlinked; see case evidence | tcNew | 4 | 2 source-registered |
| [UC-schNew](UC-schNew.md) | CONFIG.pages.schNew | schNew | 4 | 1 source-registered |
| [UC-repScheduled](UC-repScheduled.md) | CONFIG.pages.repScheduled | repScheduled | 4 | 1 source-registered |
| [UC-externalSystems](UC-externalSystems.md) | custom navigation: externalSystems | externalSystems | 4 | 7 source-registered |
| [UC-msgCreateSchema](UC-msgCreateSchema.md) | CONFIG.pages.msgCreateSchema | msgCreateSchema | 36 | 8 source-registered |
| [UC-repSuites](UC-repSuites.md) | overlay, standalone or unlinked; see case evidence | repSuites | 4 | 0 source-registered |
| [UC-ruleCanvas](UC-ruleCanvas.md) | overlay, standalone or unlinked; see case evidence | ruleCanvas | 4 | 0 source-registered |
| [UC-eventFramework](UC-eventFramework.md) | overlay, standalone or unlinked; see case evidence | eventFramework | 4 | 5 source-registered |
| [UC-security](UC-security.md) | overlay, standalone or unlinked; see case evidence | security | 4 | 6 source-registered |
| [UC-schemeDefinitions](UC-schemeDefinitions.md) | custom navigation: schemeDefinitions | not a feature grant | 4 | 2 source-registered |
| [UC-msgSchemaCanvas](UC-msgSchemaCanvas.md) | CONFIG.pages.msgSchemaCanvas | not a feature grant | 4 | 5 source-registered |
| [UC-features](UC-features.md) | overlay, standalone or unlinked; see case evidence | not a feature grant | 4 | 3 source-registered |
| [UC-users](UC-users.md) | overlay, standalone or unlinked; see case evidence | not a feature grant | 4 | 3 source-registered |
| [UC-userCreate](UC-userCreate.md) | overlay, standalone or unlinked; see case evidence | not a feature grant | 4 | 0 source-registered |
| [UC-roles](UC-roles.md) | overlay, standalone or unlinked; see case evidence | not a feature grant | 4 | 2 source-registered |
| [UC-roleCreate](UC-roleCreate.md) | overlay, standalone or unlinked; see case evidence | not a feature grant | 4 | 0 source-registered |
| [UC-configurationEnvironmentDefaults](UC-configurationEnvironmentDefaults.md) | CONFIG.pages.configurationEnvironmentDefaults | not a feature grant | 3 | 0 source-registered |
| [UC-configurationNotifications](UC-configurationNotifications.md) | CONFIG.pages.configurationNotifications | not a feature grant | 3 | 0 source-registered |
| [UC-configurationApiAccess](UC-configurationApiAccess.md) | CONFIG.pages.configurationApiAccess | not a feature grant | 3 | 0 source-registered |
| [UC-configurationDataRetention](UC-configurationDataRetention.md) | CONFIG.pages.configurationDataRetention | not a feature grant | 3 | 0 source-registered |
| [UC-configurationUserRoles](UC-configurationUserRoles.md) | CONFIG.pages.configurationUserRoles | not a feature grant | 3 | 0 source-registered |
| [UC-configurationEventing](UC-configurationEventing.md) | CONFIG.pages.configurationEventing | not a feature grant | 4 | 4 source-registered |
| [UC-configurationAppConfigs](UC-configurationAppConfigs.md) | CONFIG.pages.configurationAppConfigs | not a feature grant | 4 | 5 source-registered |
| [UC-useCaseTemplates](UC-useCaseTemplates.md) | CONFIG.pages.useCaseTemplates | not a feature grant | 4 | 0 source-registered |
| [UC-featureIds](UC-featureIds.md) | CONFIG.pages.featureIds | not a feature grant | 4 | 1 source-registered |
| [UC-useCaseReview](UC-useCaseReview.md) | CONFIG.pages.useCaseReview | not a feature grant | 4 | 2 source-registered |
| [UC-applicationEvents](UC-applicationEvents.md) | CONFIG.pages.applicationEvents | not a feature grant | 4 | 1 source-registered |
| [UC-useCaseEditor](UC-useCaseEditor.md) | /use-case.html | not a feature grant | 4 | 4 source-registered |

## Aliases and navigation

- Native page `datasets` is documented by [UC-dsAll](UC-dsAll.md).
- Native page `testCases` is documented by [UC-tcPool](UC-tcPool.md).
- Native page `testSuites` is documented by [UC-tsAll](UC-tsAll.md).

The source sidebar uses Message Schemes for Import Scheme/Create schema/Schema canvas/Scheme Definitions. The confirmed Import/Create specification calls for Message Designer. Both are recorded explicitly; this review does not change product navigation.

## Important implementation gaps

- The suite-run handler returns accepted IDs without invoking the engine. Do not treat acceptance as execution.
- Run and schedule persistence failures can return local IDs; these are not durable evidence.
- The old ISO import endpoint only returns acceptance. The uploads route handles stored imports and still differs from confirmed coverage/override decisions.
- Create schema has build/draft/publish endpoints, but in-memory drafts and a shared tree model do not satisfy every proposed lifecycle and format guarantee.
- Native configuration rows do not establish notification, retention, API-key or role-provisioning capabilities. Old /users and /roles CRUD assertions are not registered.
- The Feature IDs UI calls a row-specific PATCH absent from the inspected registration. The event-header panel is a display, not a verified editor.
- Existing tenant-edited use cases are preserved by insert-only seeding. Updated defaults apply to fresh rows and memory fallback; migrating existing tenant content requires reviewing its revisions first.

## Verification scope

Run the repository documentation checks and targeted use-case tests. Acceptance examples are Gherkin specifications, not implemented product step definitions. The product test engine still requires explicit executable adapters for proposed behavior; no unimplemented case is reported as passing.

## Unresolved decisions

See each case for local gaps. Cross-cutting decisions include import duplicate identity/scope, dialect/version inventory, Create publication identity and durable drafts, rule runtime language, flat-file layout serialization, test-engine execution/expected-result model, scheduling timezone/missed-run policy, report evidence scope, and provisioning/retention/notification contracts.
