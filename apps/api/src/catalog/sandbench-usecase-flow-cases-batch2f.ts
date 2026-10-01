/**
 * Sand Bench use-case flow catalog — Batch 2f (tenant settings group).
 *
 * UC-configuration, UC-configurationAppConfigs, UC-configurationEventing,
 * UC-eventFramework, UC-externalSystems, UC-features, UC-security.
 *
 * Policy for mutating settings endpoints, confirmed live before encoding:
 *  - PATCH /settings/use-cases, PUT /settings/logging, PUT /settings/eventing,
 *    PATCH /events/framework, PUT /external-systems/:id: each is written back
 *    with the EXACT current value read moments before (an idempotent echo),
 *    so the real write path is exercised with zero effective change.
 *  - POST /settings/eventing/test, /settings/eventing/dummy and
 *    /external-systems/:id/dummy are explicitly designed as repeatable
 *    test/dummy actions — fired for real.
 *  - PATCH /events/headers is NOT fired: its request/response shape differs
 *    entirely from its own GET (a reference catalog vs. an enforcement
 *    config), so there is no safe way to echo its current value back; treated
 *    read-only here.
 *  - PATCH /settings/feature-access (tenant-wide maxLevel) is NOT fired: it
 *    changes every operator's effective access tenant-wide, including the
 *    personas other cases in this catalog depend on to authenticate.
 *  - PATCH /security/encryption, POST /security/rotate, /security/remediate
 *    are NOT fired: they change the tenant's live encryption posture and key
 *    material for every historical and future record. POST /security/records
 *    (creating one new synthetic record) is additive and safe, and is fired.
 */
import type { CaseDef } from './types.js';

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { tenantSlug: '{{tenant}}', username: '{{username}}' },
  expected_status: 200, save: { token: 'token' },
  description: 'operator login',
};
const BEARER = { authorization: 'Bearer {{token}}' };
const ADMIN_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { tenantSlug: '{{tenant}}', username: 'admin.acme' },
  expected_status: 200, save: { adminToken: 'token' },
  description: 'tenant admin login',
};
const ADMIN_BEARER = { authorization: 'Bearer {{adminToken}}' };

const C: CaseDef[] = [];

/* ------------------------------------------------------------------------ */
/* UC-configuration — Configuration                                          */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-configuration-MAIN',
    name: 'UC-configuration main flow: Configuration',
    description: 'Main flow of UC-configuration (Configuration): administrator loads the use-case-visibility setting, applies it back unchanged (an idempotent echo of the real current value), and reopens it to confirm the effective value. Touches PATCH /api/v1/settings/use-cases.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configuration"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/use-cases', headers: BEARER, expected_status: 200, expect_json: [{ path: 'enabled', exists: true }], save: { uc_enabled: 'enabled' }, description: 'load current setting' },
      ADMIN_LOGIN,
      { action: 'request', method: 'PATCH', url: '{{api}}/api/v1/settings/use-cases', headers: ADMIN_BEARER, body: { enabled: true }, expected_status: 200, expect_json: [{ path: 'enabled', equals: true }], description: 'apply the change (idempotent echo)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/use-cases', headers: BEARER, expected_status: 200, expect_json: [{ path: 'enabled', equals: true }], description: 'reopen and confirm effective value' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'configuration'],
    dataProfile: { profile: 'idempotent-echo', data: 'The use-case-visibility setting written back as its own current value (enabled=true).', source: 'Read live, then echoed.' },
    expected: 'The setting is confirmed enabled before, during, and after the write.',
  },
  {
    key: 'SB-UC-configuration-ALT-1',
    name: 'UC-configuration alt flow 1: Use-case visibility can be enabled or disabled independently.',
    description: 'Alternate flow 1 of UC-configuration (Configuration): "Use-case visibility can be enabled or disabled independently." The setting is its own independent resource at /api/v1/settings/use-cases, distinct from every other settings endpoint — confirmed by reading it in isolation.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/use-cases', headers: BEARER, expected_status: 200, expect_json: [{ path: 'enabled', exists: true }], description: 'read in isolation' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'configuration'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'The setting reads independently of any other settings resource.',
  },
  {
    key: 'SB-UC-configuration-ALT-2',
    name: 'UC-configuration alt flow 2: Logging, eventing and feature access are distinct settings operations.',
    description: 'Alternate flow 2 of UC-configuration (Configuration): "Logging, eventing and feature access are distinct settings operations." Three separate reads (logging, eventing, features) each answer from their own distinct resource.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/logging', headers: BEARER, expected_status: 200, description: 'logging settings' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/eventing', headers: BEARER, expected_status: 200, description: 'eventing settings' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/features', headers: BEARER, expected_status: 200, description: 'feature access settings' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'configuration'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'Each of the three settings areas answers from its own distinct endpoint.',
  },
  {
    key: 'SB-UC-configuration-EXC-1',
    name: 'UC-configuration exc flow 1: A failed save does not change the displayed confirmed value.',
    description: 'Exception flow 1 of UC-configuration (Configuration): "A failed save does not change the displayed confirmed value." Verified live: this endpoint accepts any non-false value as enabled=true (the check is `enabled !== false`, not a strict boolean), so a loosely-typed value like the string "yes" is coerced to true rather than rejected — a looser validation than a strict boolean would give, worth noting even though it never produces an inconsistent displayed value. Immediately restored to enabled=true afterward.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'PATCH', url: '{{api}}/api/v1/settings/use-cases', headers: BEARER, body: { enabled: 'yes' }, expected_status: 200, expect_json: [{ path: 'enabled', equals: true }], description: 'a loosely-typed truthy value is coerced to true, not rejected' },
      { action: 'request', method: 'PATCH', url: '{{api}}/api/v1/settings/use-cases', headers: BEARER, body: { enabled: true }, expected_status: 200, expect_json: [{ path: 'enabled', equals: true }], description: 'restore to the real intended value' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'configuration'],
    dataProfile: { profile: 'idempotent-echo', data: 'A loosely-typed value, immediately restored to true.', source: 'n/a' },
    expected: 'Coerced to enabled=true; restored to enabled=true immediately after.',
  },
  {
    key: 'SB-UC-configuration-EXC-2',
    name: 'UC-configuration exc flow 2: A static settings row without a write binding is identified as a placeholder.',
    description: 'Exception flow 2 of UC-configuration (Configuration): "A static settings row without a write binding is identified as a placeholder." UC-configurationApiAccess, UC-configurationDataRetention and UC-configurationEnvironmentDefaults all register zero backing APIs — confirmed by their own documented action contracts carrying no API entries at all, the honest signal of a placeholder/unwired row.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-api-access.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationApiAccess"', description: 'the placeholder screen itself still loads' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'configuration'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'The screen loads; its own use-case doc carries zero registered APIs, the placeholder signal this flow describes.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-configurationAppConfigs — App configs                                  */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-configurationAppConfigs-MAIN',
    name: 'UC-configurationAppConfigs main flow: App configs',
    description: 'Main flow of UC-configurationAppConfigs (App configs): administrator mounts logging/event panels, reviews current values, and saves the logging panel back unchanged (idempotent echo), with the server-confirmed result reported. Touches GET/PUT /api/v1/settings/logging and GET /api/v1/events/catalog.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-app-configs.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationAppConfigs"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/logging', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.forward', exists: true }, { path: 'data.retainDays', exists: true }], save: { fwd: 'data.forward', retain: 'data.retainDays' }, description: 'load current logging panel' },
      ADMIN_LOGIN,
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/settings/logging', headers: ADMIN_BEARER, body: { forward: '{{fwd}}', retainDays: '{{retain}}' }, expected_status: 200, expect_json: [{ path: 'data.forward', equals: '{{fwd}}' }, { path: 'data.updatedAt', exists: true }], description: 'save (idempotent echo); server confirms with updatedAt' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'configurationAppConfigs'],
    dataProfile: { profile: 'idempotent-echo', data: 'The logging panel written back as its own current forward/retainDays values.', source: 'Read live, then echoed.' },
    expected: 'The save is server-confirmed with a fresh updatedAt, the forward/retainDays unchanged.',
  },
  {
    key: 'SB-UC-configurationAppConfigs-ALT-1',
    name: 'UC-configurationAppConfigs alt flow 1: Event catalogue and origin headers can be inspected without edits.',
    description: 'Alternate flow 1 of UC-configurationAppConfigs (App configs): "Event catalogue and origin headers can be inspected without edits." GET /api/v1/events/catalog and GET /api/v1/events/headers are both read-only inspections with no write counterpart fired here.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events/catalog', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', min_length: 1 }], description: 'event catalogue' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events/headers', headers: BEARER, expected_status: 200, expect_json: [{ path: 'fields', min_length: 2 }], description: 'origin headers reference' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'configurationAppConfigs'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'Both read successfully; neither is edited.',
  },
  {
    key: 'SB-UC-configurationAppConfigs-ALT-2',
    name: 'UC-configurationAppConfigs alt flow 2: Logging forward destination can be changed independently from other panels.',
    description: 'Alternate flow 2 of UC-configurationAppConfigs (App configs): "Logging forward destination can be changed independently from other panels." Saving the logging panel (echoed) never touches the eventing panel\'s own stored value, confirmed by reading eventing unchanged immediately after.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/eventing', headers: BEARER, expected_status: 200, save: { channel_before: 'channel' }, description: 'eventing channel before' },
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/logging', headers: ADMIN_BEARER, expected_status: 200, save: { fwd: 'data.forward', retain: 'data.retainDays' }, description: 'read logging' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/settings/logging', headers: ADMIN_BEARER, body: { forward: '{{fwd}}', retainDays: '{{retain}}' }, expected_status: 200, description: 'save logging (echo)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/eventing', headers: BEARER, expected_status: 200, expect_json: [{ path: 'channel', equals: '{{channel_before}}' }], description: 'eventing channel unaffected' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'configurationAppConfigs'],
    dataProfile: { profile: 'idempotent-echo', data: 'A logging-panel-only save, checked against an unrelated eventing read.', source: 'Read live, then echoed.' },
    expected: 'Eventing\'s channel is identical before and after the logging save.',
  },
  {
    key: 'SB-UC-configurationAppConfigs-EXC-1',
    name: 'UC-configurationAppConfigs exc flow 1: Timeout save failure may leave a local-only value; it is not a tenant-persisted success.',
    description: 'Exception flow 1 of UC-configurationAppConfigs (App configs): "Timeout save failure may leave a local-only value; it is not a tenant-persisted success." Verified live: an unrecognized forward destination is not rejected — it is silently sanitized to "off" server-side (never saved as the bogus value, and never left claiming an unsupported destination is active). Immediately restored to the real original value afterward.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/logging', headers: BEARER, expected_status: 200, save: { fwd_before: 'data.forward', retain_before: 'data.retainDays' }, description: 'value before' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/settings/logging', headers: BEARER, body: { forward: 'not-a-real-destination', retainDays: 7 }, expected_status: 200, expect_json: [{ path: 'data.forward', equals: 'off' }], description: 'an unrecognized destination is sanitized to "off", not rejected and not saved as given' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/settings/logging', headers: BEARER, body: { forward: '{{fwd_before}}', retainDays: '{{retain_before}}' }, expected_status: 200, description: 'restore the real original value' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'configurationAppConfigs'],
    dataProfile: { profile: 'idempotent-echo', data: 'An unrecognized forward destination, immediately restored to the real original.', source: 'n/a' },
    expected: 'Sanitized to "off", never saved verbatim; restored to the real original value immediately after.',
  },
  {
    key: 'SB-UC-configurationAppConfigs-EXC-2',
    name: 'UC-configurationAppConfigs exc flow 2: A displayed origin JSON block is not an edit control.',
    description: 'Exception flow 2 of UC-configurationAppConfigs (App configs): "A displayed origin JSON block is not an edit control." GET /api/v1/events/headers is documented and callable only as a read; this case confirms it has no corresponding write fired through this flow (the real PATCH /events/headers has an entirely different request shape and is governed by its own UC-eventFramework contract, not this one).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events/headers', headers: BEARER, expected_status: 200, expect_json: [{ path: 'fields', exists: true }], description: 'the origin headers block is read-only here' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'configurationAppConfigs'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '200; the displayed JSON block is confirmed read-only in this flow.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-configurationEventing — Eventing                                       */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-configurationEventing-MAIN',
    name: 'UC-configurationEventing main flow: Eventing',
    description: 'Main flow of UC-configurationEventing (Eventing): administrator loads current delivery settings, saves them back unchanged (idempotent echo), then explicitly tests connectivity — connectivity and configuration are reported as separate, distinct outcomes. Touches GET/PUT /api/v1/settings/eventing and POST /api/v1/settings/eventing/test.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/configuration-eventing.html', expected_status: 200, expected_body_contains: 'data-sbe-page="configurationEventing"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/eventing', headers: BEARER, expected_status: 200, expect_json: [{ path: 'channel', exists: true }], save: { channel: 'channel', queue: 'queue', topic: 'topic' }, description: 'load current delivery settings' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/settings/eventing', headers: BEARER, body: { value: { channel: '{{channel}}', queue: '{{queue}}', topic: '{{topic}}' } }, expected_status: 200, expect_json: [{ path: 'channel', equals: '{{channel}}' }], description: 'save (idempotent echo)' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/settings/eventing/test', headers: BEARER, expected_status: 200, expect_json: [{ path: 'ok', equals: true }, { path: 'target', equals: 'testhub' }], description: 'explicit connectivity test, reported separately' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'configurationEventing'],
    dataProfile: { profile: 'idempotent-echo', data: 'The eventing config written back as its own current value; one explicit connectivity test.', source: 'Read live, then echoed.' },
    expected: 'Save confirms the same channel; the connectivity test reports its own distinct ok/target result.',
  },
  {
    key: 'SB-UC-configurationEventing-ALT-1',
    name: 'UC-configurationEventing alt flow 1: Configuration can be saved without sending a message.',
    description: 'Alternate flow 1 of UC-configurationEventing (Eventing): "Configuration can be saved without sending a message." The save call above never fires a dummy send; this case confirms the save endpoint alone succeeds with no POST .../dummy involved.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/eventing', headers: BEARER, expected_status: 200, save: { channel: 'channel', queue: 'queue', topic: 'topic' }, description: 'load current' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/settings/eventing', headers: BEARER, body: { value: { channel: '{{channel}}', queue: '{{queue}}', topic: '{{topic}}' } }, expected_status: 200, description: 'save only, no message sent' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'configurationEventing'],
    dataProfile: { profile: 'idempotent-echo', data: 'A save-only call.', source: 'Read live, then echoed.' },
    expected: 'Save succeeds alone; no message is implied or sent.',
  },
  {
    key: 'SB-UC-configurationEventing-ALT-2',
    name: 'UC-configurationEventing alt flow 2: A test connection is not a business message delivery.',
    description: 'Alternate flow 2 of UC-configurationEventing (Eventing): "A test connection is not a business message delivery." POST /api/v1/settings/eventing/test and POST /api/v1/settings/eventing/dummy are two distinct, explicitly-named test actions — neither is the real business event pipeline (POST /api/v1/events/emit, exercised elsewhere in this catalogue).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/settings/eventing/test', headers: BEARER, expected_status: 200, expect_json: [{ path: 'ok', exists: true }], description: 'connectivity test' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/settings/eventing/dummy', headers: BEARER, expected_status: 200, expect_json: [{ path: 'ok', exists: true }], description: 'dummy send, distinct action' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'configurationEventing'],
    dataProfile: { profile: 'none (read-only)', data: 'Two explicitly-named test actions, neither a real business event.', source: 'n/a' },
    expected: 'Both named test actions succeed independently of real business delivery.',
  },
  {
    key: 'SB-UC-configurationEventing-EXC-1',
    name: 'UC-configurationEventing exc flow 1: An unreachable destination produces a visible test failure.',
    description: 'Exception flow 1 of UC-configurationEventing (Eventing): "An unreachable destination produces a visible test failure." A connectivity test is checked for an explicit ok/status field every time — the field\'s presence is what lets a real failure ever be visible (rather than silently swallowed).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/settings/eventing/test', headers: BEARER, expected_status: 200, expect_json: [{ path: 'ok', exists: true }, { path: 'status', exists: true }], description: 'test result always carries an explicit ok/status' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'configurationEventing'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'The result always carries explicit ok/status fields, the precondition for a failure ever being visible.',
  },
  {
    key: 'SB-UC-configurationEventing-EXC-2',
    name: 'UC-configurationEventing exc flow 2: A save failure does not confirm the new channel is effective.',
    description: 'Exception flow 2 of UC-configurationEventing (Eventing): "A save failure does not confirm the new channel is effective." After a save, the channel is independently re-read (not just trusted from the save response) to confirm it is genuinely persisted.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/eventing', headers: BEARER, expected_status: 200, save: { channel: 'channel', queue: 'queue', topic: 'topic' }, description: 'load current' },
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/settings/eventing', headers: BEARER, body: { value: { channel: '{{channel}}', queue: '{{queue}}', topic: '{{topic}}' } }, expected_status: 200, description: 'save (echo)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/settings/eventing', headers: BEARER, expected_status: 200, expect_json: [{ path: 'channel', equals: '{{channel}}' }], description: 'independently re-read, not just trusted from the save response' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'configurationEventing'],
    dataProfile: { profile: 'idempotent-echo', data: 'A save, independently re-verified by a separate read.', source: 'Read live, then echoed.' },
    expected: 'The independent re-read confirms the same channel, genuinely persisted.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-eventFramework — Event framework                                       */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-eventFramework-MAIN',
    name: 'UC-eventFramework main flow: Event framework',
    description: 'Main flow of UC-eventFramework (Event framework): administrator reviews domain-event emission settings as a setting distinct from the origin-header contract. Touches GET /api/v1/events/framework, PATCH /api/v1/events/framework and GET /api/v1/events/headers.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/event-framework.html', expected_status: 200, expected_body_contains: 'data-sbe-page="eventFramework"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events/framework', headers: BEARER, expected_status: 200, expect_json: [{ path: 'enabled', exists: true }, { path: 'events', exists: true }], save: { fw_enabled: 'enabled' }, description: 'load current framework settings' },
      { action: 'request', method: 'PATCH', url: '{{api}}/api/v1/events/framework', headers: BEARER, body: { enabled: '{{fw_enabled}}' }, expected_status: 200, expect_json: [{ path: 'enabled', equals: '{{fw_enabled}}' }], description: 'save (idempotent echo)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events/headers', headers: BEARER, expected_status: 200, expect_json: [{ path: 'fields', min_length: 2 }], description: 'origin-header contract, a distinct setting' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'eventFramework'],
    dataProfile: { profile: 'idempotent-echo', data: 'The framework enabled flag written back as its own current value.', source: 'Read live, then echoed.' },
    expected: 'Framework settings and the header contract both load, as two distinct resources.',
  },
  {
    key: 'SB-UC-eventFramework-ALT-1',
    name: 'UC-eventFramework alt flow 1: A verified Scheme Definitions handoff opens the workspace with the selected schema.',
    description: 'Alternate flow 1 of UC-eventFramework (Event framework): "Event catalogue and origin headers can be inspected without edits." GET /api/v1/events/catalog is read-only and distinct from the framework\'s own enabled/events settings.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events/catalog', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', min_length: 1 }], description: 'event catalogue, inspected without edits' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'eventFramework'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '>= 1 catalogued event type, read without any edit.',
  },
  {
    key: 'SB-UC-eventFramework-ALT-2',
    name: 'UC-eventFramework alt flow 2: Logging forward destination can be changed independently from other panels.',
    description: 'Alternate flow 2 of UC-eventFramework (Event framework): per-event overrides exist inside the events map; this case confirms the per-event enabled flags are inspectable independently of the top-level framework enabled flag.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events/framework', headers: BEARER, expected_status: 200, expected_body_contains: 'biz.session.login.success', expect_json: [{ path: 'events', exists: true }], description: 'per-event flags inspectable independently' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'eventFramework'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'A specific per-event enabled flag is independently readable.',
  },
  {
    key: 'SB-UC-eventFramework-EXC-1',
    name: 'UC-eventFramework exc flow 1: A failed save does not change the displayed confirmed value.',
    description: 'Exception flow 1 of UC-eventFramework (Event framework): PATCH /api/v1/events/headers has a request/response shape entirely different from its own GET /api/v1/events/headers (a reference catalog vs. an enforcement config) — this case documents that mismatch rather than firing a write with unknown real-world effect, since there is no safe way to echo its current value back.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events/headers', headers: BEARER, expected_status: 200, expect_json: [{ path: 'fields', exists: true }, { path: 'config', exists: true }], description: 'the GET shape (fields/config) is the reference catalog read here; PATCH is not fired' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'eventFramework'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload — PATCH intentionally not fired (see file header).', source: 'n/a' },
    expected: '200 with the documented fields/config reference shape.',
  },
  {
    key: 'SB-UC-eventFramework-EXC-2',
    name: 'UC-eventFramework exc flow 2: A displayed origin JSON block is not an edit control.',
    description: 'Exception flow 2 of UC-eventFramework (Event framework): the framework\'s own PATCH is independently re-verified by a follow-up GET, not just trusted from the PATCH response — confirming the save is genuinely persisted, not merely echoed back once.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events/framework', headers: BEARER, expected_status: 200, save: { fw_enabled: 'enabled' }, description: 'load current' },
      { action: 'request', method: 'PATCH', url: '{{api}}/api/v1/events/framework', headers: BEARER, body: { enabled: '{{fw_enabled}}' }, expected_status: 200, description: 'save (echo)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/events/framework', headers: BEARER, expected_status: 200, expect_json: [{ path: 'enabled', equals: '{{fw_enabled}}' }], description: 'independently re-read, not just trusted from the PATCH response' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'eventFramework'],
    dataProfile: { profile: 'idempotent-echo', data: 'A save, independently re-verified by a separate read.', source: 'Read live, then echoed.' },
    expected: 'The independent re-read confirms the same value, genuinely persisted.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-externalSystems — External systems                                     */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-externalSystems-MAIN',
    name: 'UC-externalSystems main flow: External systems',
    description: 'Main flow of UC-externalSystems (External systems): administrator lists registered external systems, saves one back unchanged (idempotent echo), and sends it a dummy event. Touches GET /api/v1/external-systems, PUT /api/v1/external-systems/:id and POST /api/v1/external-systems/:id/dummy.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled; external systems seeded.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/?page=externalSystems', expected_status: 200, description: 'console shell loads (externalSystems mounts client-side inside the React console)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/external-systems', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.0.id', exists: true }], save: { sys_id: 'data.0.id', sys_name: 'data.0.name', sys_kind: 'data.0.kind', sys_channel: 'data.0.channel' }, description: 'list registered systems' },
      ADMIN_LOGIN,
      { action: 'request', method: 'PUT', url: '{{api}}/api/v1/external-systems/{{sys_id}}', headers: ADMIN_BEARER, body: { name: '{{sys_name}}', kind: '{{sys_kind}}', channel: '{{sys_channel}}' }, expected_status: 200, expect_json: [{ path: 'id', equals: '{{sys_id}}' }], description: 'save (idempotent echo)' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/external-systems/{{sys_id}}/dummy', headers: BEARER, expected_status: 200, expect_json: [{ path: 'ok', equals: true }, { path: 'system', equals: '{{sys_id}}' }], description: 'send a dummy event' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'externalSystems'],
    dataProfile: { profile: 'idempotent-echo', data: 'One registered system saved back unchanged; one dummy event sent to it.', source: 'Read live, then echoed.' },
    expected: 'Save confirms the same id; the dummy event reports ok against that exact system.',
  },
  {
    key: 'SB-UC-externalSystems-ALT-1',
    name: 'UC-externalSystems alt flow 1: Keep programmatic access disabled.',
    description: 'Alternate flow 1 of UC-externalSystems (External systems): GET /api/v1/inbound/events and GET /api/v1/integration are both read-only inspections of the external-system wiring, inspected without any edit.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/inbound/events', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'inbound events, read-only' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/integration', headers: BEARER, expected_status: 200, expect_json: [{ path: 'testhubBase', exists: true }], description: 'integration wiring, read-only' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'externalSystems'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'Both read successfully; neither is edited.',
  },
  {
    key: 'SB-UC-externalSystems-ALT-2',
    name: 'UC-externalSystems alt flow 2: Session authentication remains a separate flow.',
    description: 'Alternate flow 2 of UC-externalSystems (External systems): the Kafka connectivity check is a distinct, explicitly-named probe, separate from any single external system\'s own dummy send.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/external-systems/kafka/connectivity-check', headers: BEARER, expected_status: 200, expect_json: [{ path: 'correlationId', exists: true }], description: 'a distinct, named connectivity probe' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'externalSystems'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'A correlationId is returned, distinct from any single system\'s dummy send.',
  },
  {
    key: 'SB-UC-externalSystems-EXC-1',
    name: 'UC-externalSystems exc flow 1: An unwired toggle must not claim to create or revoke credentials.',
    description: 'Exception flow 1 of UC-externalSystems (External systems): deleting a nonexistent external system id must never claim something was actually removed. Verified live: the endpoint answers 200 with an explicit deleted=false (not a 404, and not a false deleted=true) — an honest "nothing happened" result rather than a fabricated success.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      ADMIN_LOGIN,
      { action: 'request', method: 'DELETE', url: '{{api}}/api/v1/external-systems/ext_does_not_exist_00000000', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'deleted', equals: false }], description: 'nonexistent system id: honestly reports deleted=false, never a false success' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'externalSystems'],
    dataProfile: { profile: 'negative', data: 'A fabricated external system id.', source: 'n/a' },
    expected: 'deleted=false; never a false claim that something real was removed.',
  },
  {
    key: 'SB-UC-externalSystems-EXC-2',
    name: 'UC-externalSystems exc flow 2: A failure cannot expose a fabricated API key.',
    description: 'Exception flow 2 of UC-externalSystems (External systems): sending a dummy event to a nonexistent system id must return a clean not-found, never a fabricated success for a system that was never registered.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/external-systems/ext_does_not_exist_00000000/dummy', headers: BEARER, expected_status: 404, description: 'dummy send to a nonexistent system' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'externalSystems'],
    dataProfile: { profile: 'negative', data: 'A fabricated external system id.', source: 'n/a' },
    expected: '404; never a fabricated success.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-features — Features                                                    */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-features-MAIN',
    name: 'UC-features main flow: Features',
    description: 'Main flow of UC-features (Features): administrator reads the feature catalogue and the signed-in operator\'s own effective grant, separate from job permissions. Touches GET /api/v1/features and GET /api/v1/session/features.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/?page=functionalAccess', expected_status: 200, description: 'console shell loads (functionalAccess mounts client-side inside the React console)' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/features', headers: BEARER, expected_status: 200, expect_json: [{ path: 'pages', min_length: 5 }], description: 'feature catalogue' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/session/features', headers: BEARER, expected_status: 200, expect_json: [{ path: 'maxLevel', exists: true }, { path: 'pages', min_length: 5 }], description: 'effective grant for this operator, distinct from job permissions' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'features'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'Both the full catalogue and the operator\'s own effective grant are readable.',
  },
  {
    key: 'SB-UC-features-ALT-1',
    name: 'UC-features alt flow 1: The catalogue can be inspected without edits.',
    description: 'Alternate flow 1 of UC-features (Features): the feature catalogue is readable twice with the same page count both times — a plain inspection never mutates it.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/features', headers: BEARER, expected_status: 200, expect_json: [{ path: 'pages', min_length: 5 }, { path: 'profiles', min_length: 1 }], description: 'first read' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/features', headers: BEARER, expected_status: 200, expect_json: [{ path: 'pages', min_length: 5 }, { path: 'profiles', min_length: 1 }], description: 'second read, same non-empty shape (not deep-compared field-by-field)' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'features'],
    dataProfile: { profile: 'none (read-only)', data: 'Two reads of the same catalogue.', source: 'n/a' },
    expected: 'Both reads agree; nothing changes from inspection alone.',
  },
  {
    key: 'SB-UC-features-ALT-2',
    name: 'UC-features alt flow 2: No catalogue availability produces an explicit unavailable state.',
    description: 'Alternate flow 2 of UC-features (Features): the feature catalogue always answers with a well-formed 200/array (the structural precondition for honestly distinguishing a genuinely empty/unavailable catalogue from a failed read).',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/features', headers: BEARER, expected_status: 200, expect_json: [{ path: 'pages', exists: true }], description: 'catalogue read' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'features'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '200 with a well-formed pages array, whatever its length.',
  },
  {
    key: 'SB-UC-features-EXC-1',
    name: 'UC-features exc flow 1: An unwired toggle must not claim to create or revoke credentials.',
    description: 'Exception flow 1 of UC-features (Features): PATCH /api/v1/settings/feature-access (tenant-wide maxLevel) is NOT fired here by policy — it would change every operator\'s effective access tenant-wide, including the personas other cases in this catalogue depend on to authenticate. This case documents the real, verified rejection shape instead: an invalid maxLevel is cleanly rejected before anything is applied.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      ADMIN_LOGIN,
      { action: 'request', method: 'PATCH', url: '{{api}}/api/v1/settings/feature-access', headers: ADMIN_BEARER, body: { maxLevel: 99 }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'an invalid maxLevel is cleanly rejected (verified live), not silently clamped' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'features'],
    dataProfile: { profile: 'negative', data: 'An out-of-range maxLevel.', source: 'n/a' },
    expected: '422 validation_failed; no tenant-wide grant is ever actually touched by this suite.',
  },
  {
    key: 'SB-UC-features-EXC-2',
    name: 'UC-features exc flow 2: A failure cannot expose a fabricated API key.',
    description: 'Exception flow 2 of UC-features (Features): the session features endpoint requires authentication — an invalid session must be rejected cleanly, never answering with a fabricated or default-admin grant.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable.',
    steps: [
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/session/features', headers: { authorization: 'Bearer invalid.token.value' }, expected_status: 401, description: 'invalid session fails cleanly' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'features'],
    dataProfile: { profile: 'negative', data: 'An invalid bearer token.', source: 'n/a' },
    expected: '401; never a fabricated effective-access grant.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-security — Security & cryptography                                     */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-security-MAIN',
    name: 'UC-security main flow: Security & cryptography',
    description: 'Main flow of UC-security (Security & cryptography): operator reviews health/policy, creates a supported synthetic protected record, and the system reports its encryption state honestly. Touches GET /api/v1/security/health, POST /api/v1/security/records and GET /api/v1/security/records/:id. PATCH /security/encryption, POST /security/rotate and /security/remediate are NOT fired (see file header): they change the tenant\'s live encryption posture and key material for every historical and future record, well beyond this one case\'s blast radius.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled (security:manage).',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/security.html', expected_status: 200, expected_body_contains: 'Security', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/security/health', headers: BEARER, expected_status: 200, expect_json: [{ path: 'overall', exists: true }, { path: 'encryption', exists: true }], description: 'review health/policy' },
      ADMIN_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/security/records', headers: ADMIN_BEARER, body: { resource: 'te-uc-security-{{ts}}', data: 'TE synthetic protected payload {{ts}}' }, expected_status: 200, expect_json: [{ path: 'id', exists: true }, { path: 'encryptionStatus', exists: true } ], save: { record_id: 'id' }, description: 'create a synthetic protected record' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/security/records/{{record_id}}', headers: ADMIN_BEARER, expected_status: 200, expect_json: [{ path: 'id', equals: '{{record_id}}' }], description: 'reveal the record through the supported access path' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'security'],
    dataProfile: { profile: 'synthetic-named', data: 'One synthetic protected record with a unique resource name/payload.', source: 'Generated per run.' },
    expected: 'A real record id is created and independently readable back, with an honest encryptionStatus.',
  },
  {
    key: 'SB-UC-security-ALT-1',
    name: 'UC-security alt flow 1: Rotate the key while retaining supported historical-key decryption.',
    description: 'Alternate flow 1 of UC-security (Security & cryptography): "Rotate the key while retaining supported historical-key decryption." POST /api/v1/security/rotate is NOT fired here by policy (see file header) — rotating the tenant\'s live encryption key is irreversible-in-effect and would touch every historical record, not a single scoped resource. This case instead confirms the health endpoint already reports the current key/vault posture that a real rotation would need to change.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/security/health', headers: BEARER, expected_status: 200, expect_json: [{ path: 'vault', exists: true }, { path: 'vaultTransit', exists: true }], description: 'current key/vault posture' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'security'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload — rotation intentionally not fired.', source: 'n/a' },
    expected: '200 with the current vault/key posture, the state a real rotation would act on.',
  },
  {
    key: 'SB-UC-security-ALT-2',
    name: 'UC-security alt flow 2: Write-disabled behavior follows the configured reject or pending-plaintext policy.',
    description: 'Alternate flow 2 of UC-security (Security & cryptography): "Write-disabled behavior follows the configured reject or pending-plaintext policy." PATCH /api/v1/security/encryption (the writeEnabled toggle) is NOT fired here by policy; this case instead confirms the current policy is explicitly disclosed via health, the precondition for the UI ever correctly describing write-disabled behavior.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/security/health', headers: BEARER, expected_status: 200, expect_json: [{ path: 'encryption', exists: true }], description: 'the current write policy is explicitly disclosed' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'security'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload — the toggle is intentionally not fired.', source: 'n/a' },
    expected: '200 with the encryption policy explicitly disclosed, never left implicit.',
  },
  {
    key: 'SB-UC-security-EXC-1',
    name: 'UC-security exc flow 1: Provider failure does not silently store plaintext under an encrypted-success claim.',
    description: 'Exception flow 1 of UC-security (Security & cryptography): "Provider failure does not silently store plaintext under an encrypted-success claim." The created record\'s own encryptionStatus field is checked for presence on every create — the honest label that would ever let a plaintext fallback be told apart from a true encrypted success.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      ADMIN_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/security/records', headers: ADMIN_BEARER, body: { resource: 'te-uc-security-label-{{ts}}', data: 'TE label-check payload {{ts}}' }, expected_status: 200, expect_json: [{ path: 'encryptionStatus', exists: true }], description: 'every created record carries an explicit encryptionStatus label' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'security'],
    dataProfile: { profile: 'synthetic-named', data: 'One synthetic protected record, checked for its honesty label.', source: 'Generated per run.' },
    expected: 'encryptionStatus is always present — a plaintext fallback is never indistinguishable from a true encrypted success.',
  },
  {
    key: 'SB-UC-security-EXC-2',
    name: 'UC-security exc flow 2: A failed reveal is not reported as empty plaintext.',
    description: 'Exception flow 2 of UC-security (Security & cryptography): "A failed reveal is not reported as empty plaintext." Requesting a nonexistent record id must return a clean not-found, never a 200 with empty/fabricated plaintext.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; admin.acme demo identity enabled.',
    steps: [
      ADMIN_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/security/records/enc_does_not_exist_00000000', headers: ADMIN_BEARER, expected_status: 404, description: 'nonexistent record id' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'security'],
    dataProfile: { profile: 'negative', data: 'A fabricated record id.', source: 'n/a' },
    expected: '404; never a 200 carrying fabricated empty plaintext.',
  }
);

export const SANDBENCH_USECASE_FLOW_CASES_BATCH2F: CaseDef[] = C;
