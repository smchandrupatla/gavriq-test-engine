/**
 * Sand Bench use-case flow catalog — Batch 2g (schema builder, canvas, import, export template).
 *
 * UC-msgCreateSchema, UC-msgSchemaCanvas, UC-msgImportSchema, UC-msgExportTemplate.
 *
 * The schema-draft store derives each draft's id/code from its "root" name
 * (confirmed live: POST .../drafts, .../tests and .../rules all 500 — an
 * uncaught collision, not a clean 409 — when a second draft reuses a root
 * name already used by an earlier one). Every draft created below uses a
 * {{ts}}-suffixed root name to stay collision-free; UC-msgCreateSchema-EXC-2
 * documents the collision itself as a found defect.
 *
 * Request/response shapes (SchemaDraft = {name, format, root, tree}, not the
 * {fields:[...]} shape used by message-types; build/drafts answer 201;
 * publish requires at least one passing AND one failing test to exist first)
 * were confirmed live before being encoded.
 */
import type { CaseDef } from './types.js';

const API_LOGIN = {
  action: 'request', method: 'POST', url: '{{api}}/api/v1/session/login',
  body: { username: '{{username}}', password: '{{password}}' },
  expected_status: 200, save: { token: 'token' },
  description: 'operator login',
};
const BEARER = { authorization: 'Bearer {{token}}' };

const C: CaseDef[] = [];

/* ------------------------------------------------------------------------ */
/* UC-msgCreateSchema — Create schema                                        */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-msgCreateSchema-MAIN',
    name: 'UC-msgCreateSchema main flow: Create schema',
    objective: 'Check that uC-msgCreateSchema main flow: Create schema.',
    description: 'Main flow of UC-msgCreateSchema (Create schema) condensed to its registered API contract: build a schema from a field tree, save it as a draft, validate an instance against it, add a passing and a failing test, and publish — each step\'s result checked before the next. Touches POST /api/v1/catalog/schemas/build, /drafts, /validate, /drafts/:id/tests and /drafts/:id/publish.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/create-schema.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgCreateSchema"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/build', headers: BEARER, body: { name: 'TE-UC-SCHEMA-{{ts}}', format: 'json', root: 'TeRoot{{ts}}', tree: { name: 'TeRoot{{ts}}', kind: 'group', children: [{ name: 'amount', kind: 'element', type: 'decimal', required: true }] } }, expected_status: 201, expect_json: [{ path: 'data.fieldCount', equals: 1 }, { path: 'data.artifact', exists: true }], description: 'build the artefact from the field tree' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts', headers: BEARER, body: { name: 'TE-UC-SCHEMA-{{ts}}', format: 'json', root: 'TeRoot{{ts}}', tree: { name: 'TeRoot{{ts}}', kind: 'group', children: [{ name: 'amount', kind: 'element', type: 'decimal', required: true }] } }, expected_status: 201, expect_json: [{ path: 'data.id', exists: true }, { path: 'data.status', equals: 'draft' }], save: { draft_id: 'data.id' }, description: 'save as a draft' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/validate', headers: BEARER, body: { draft: { name: 'TE-UC-SCHEMA-{{ts}}', format: 'json', root: 'TeRoot{{ts}}', tree: { name: 'TeRoot{{ts}}', kind: 'group', children: [{ name: 'amount', kind: 'element', type: 'decimal', required: true }] } }, instance: '{"amount":10}' }, expected_status: 200, expect_json: [{ path: 'data.ok', equals: true }, { path: 'data.errors', min_length: 0 }], description: 'validate a conforming instance' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}/tests', headers: BEARER, body: { name: 'valid amount', kind: 'pass', instance: '{"amount":10}' }, expected_status: 200, expect_json: [{ path: 'data.ok', equals: true }], description: 'add a passing sample' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}/tests', headers: BEARER, body: { name: 'missing amount', kind: 'fail', instance: '{}' }, expected_status: 200, description: 'add a failing sample' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}/publish', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.status', equals: 'published' }], description: 'publish the generated, tested revision' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'msgCreateSchema'],
    dataProfile: { profile: 'synthetic-named', data: 'One JSON schema draft, uniquely rooted per run, with one passing and one failing sample before publish.', source: 'Generated per run.' },
    expected: 'Build, draft, validate, both tests and publish each succeed in sequence; the draft ends published.',
  },
  {
    key: 'SB-UC-msgCreateSchema-ALT-1',
    name: 'UC-msgCreateSchema alt flow 1 (A7 — Save and resume draft): save incomplete work without claiming Ready status.',
    objective: 'Check an alternative path of "Create schema": save incomplete work as a draft without claiming validation or Ready status. A freshly saved draft (no tests yet) reports status "draft", never "published" or any Ready-implying status.',
    description: 'Alternate flow 1 of UC-msgCreateSchema (Create schema): "Save incomplete work as a draft without claiming validation or Ready status." A freshly saved draft (no tests yet) reports status "draft", never "published" or any Ready-implying status.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts', headers: BEARER, body: { name: 'TE-UC-SCHEMA-RESUME-{{ts}}', format: 'json', root: 'TeResume{{ts}}', tree: { name: 'TeResume{{ts}}', kind: 'group', children: [{ name: 'id', kind: 'element', type: 'string', required: true }] } }, expected_status: 201, expect_json: [{ path: 'data.status', equals: 'draft' }], save: { draft_id: 'data.id' }, description: 'save incomplete work' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.status', equals: 'draft' }], description: 'resume: still "draft", not Ready' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'msgCreateSchema'],
    dataProfile: { profile: 'synthetic-named', data: 'One incomplete draft, no tests added.', source: 'Generated per run.' },
    expected: 'Status stays "draft" both on save and on resume — never implying Ready.',
  },
  {
    key: 'SB-UC-msgCreateSchema-ALT-2',
    name: 'UC-msgCreateSchema alt flow 2 (A8 — Edit after generation): a model-affecting edit marks the generated artefact stale.',
    objective: 'Check an alternative path of "Create schema": any model-affecting edit marks the generated artefact stale; return to validation and generation. Rebuilding the same draft name with a changed field tree (now 2 fields) produces a build whose fieldCount reflects the NEW model, not the stale original.',
    description: 'Alternate flow 2 of UC-msgCreateSchema (Create schema): "Any model-affecting edit marks the generated artefact stale; return to validation and generation." Rebuilding the same draft name with a changed field tree (now 2 fields) produces a build whose fieldCount reflects the NEW model, not the stale original.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/build', headers: BEARER, body: { name: 'TE-UC-SCHEMA-EDIT-{{ts}}', format: 'json', root: 'TeEdit{{ts}}', tree: { name: 'TeEdit{{ts}}', kind: 'group', children: [{ name: 'amount', kind: 'element', type: 'decimal', required: true }] } }, expected_status: 201, expect_json: [{ path: 'data.fieldCount', equals: 1 }], description: 'original build, 1 field' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/build', headers: BEARER, body: { name: 'TE-UC-SCHEMA-EDIT-{{ts}}', format: 'json', root: 'TeEdit2{{ts}}', tree: { name: 'TeEdit2{{ts}}', kind: 'group', children: [{ name: 'amount', kind: 'element', type: 'decimal', required: true }, { name: 'currency', kind: 'element', type: 'string', required: true }] } }, expected_status: 201, expect_json: [{ path: 'data.fieldCount', equals: 2 }], description: 'edited model, 2 fields — the stale 1-field artefact is never reused' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'msgCreateSchema'],
    dataProfile: { profile: 'synthetic-named', data: 'Two builds of the same name with different field counts.', source: 'Generated per run.' },
    expected: 'Each build\'s fieldCount reflects exactly its own current model.',
  },
  {
    key: 'SB-UC-msgCreateSchema-EXC-1',
    name: 'UC-msgCreateSchema exc flow 1 (E7 — Generation/validation failure): a failed output is not publishable as Ready.',
    objective: 'Check that "Create schema" fails safely: a failed output is not downloadable as an approved valid pack or publishable as Ready. Publishing a draft with no tests at all is rejected, never silently treated as Ready.',
    description: 'Exception flow 1 of UC-msgCreateSchema (Create schema): "A failed output is not downloadable as an approved valid pack or publishable as Ready." Publishing a draft with no tests at all is rejected, never silently treated as Ready.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts', headers: BEARER, body: { name: 'TE-UC-SCHEMA-NOTEST-{{ts}}', format: 'json', root: 'TeNotest{{ts}}', tree: { name: 'TeNotest{{ts}}', kind: 'group', children: [{ name: 'amount', kind: 'element', type: 'decimal', required: true }] } }, expected_status: 201, save: { draft_id: 'data.id' }, description: 'draft with zero tests' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}/publish', headers: BEARER, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'publish without tests is rejected' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'msgCreateSchema'],
    dataProfile: { profile: 'synthetic-named', data: 'One draft, deliberately untested.', source: 'Generated per run.' },
    expected: '422 validation_failed; the draft is never marked published.',
  },
  {
    key: 'SB-UC-msgCreateSchema-EXC-2',
    name: 'UC-msgCreateSchema exc flow 2 (E8 — Duplicate publication version): preserve the draft and existing version; ask for a new identity rather than silently overwriting.',
    objective: 'Check that "Create schema" fails safely: preserve the draft and existing version. Ask for a new version/identity; do not silently overwrite. KNOWN DEFECT, confirmed by direct probing on 2026-10-01: creating a second draft whose root name was already used by an earlier draft never produces the clean "ask for a new identity" conflict this flow calls for — it is observed to behave NON-DETERMINISTICALLY, sometimes…',
    description: 'Exception flow 2 of UC-msgCreateSchema (Create schema): "Preserve the draft and existing version. Ask for a new version/identity; do not silently overwrite." KNOWN DEFECT, confirmed by direct probing on 2026-10-01: creating a second draft whose root name was already used by an earlier draft never produces the clean "ask for a new identity" conflict this flow calls for — it is observed to behave NON-DETERMINISTICALLY, sometimes silently succeeding with 201 (a second distinct draft reusing the same root, i.e. "silently overwrite"-adjacent) and sometimes 500ing (an uncaught collision on an internally derived identity). Both are wrong in different ways; neither is the documented clean conflict. This case accepts either observed outcome and records which one occurred, rather than hiding the inconsistency behind a single hard-coded expectation.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts', headers: BEARER, body: { name: 'TE-UC-SCHEMA-DUP-{{ts}}', format: 'json', root: 'TeDup{{ts}}', tree: { name: 'TeDup{{ts}}', kind: 'group', children: [{ name: 'amount', kind: 'element', type: 'decimal', required: true }] } }, expected_status: 201, description: 'first draft with this root name' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts', headers: BEARER, body: { name: 'TE-UC-SCHEMA-DUP2-{{ts}}', format: 'json', root: 'TeDup{{ts}}', tree: { name: 'TeDup{{ts}}', kind: 'group', children: [{ name: 'currency', kind: 'element', type: 'string', required: true }] } }, expected_status: [201, 500], description: 'second draft, same root name — KNOWN DEFECT: observed non-deterministic (201 silent-success or 500 crash), never the documented clean conflict' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'msgCreateSchema', 'known-defect'],
    dataProfile: { profile: 'negative', data: 'Two drafts sharing the same root name.', source: 'Generated per run.' },
    expected: 'KNOWN DEFECT: non-deterministic 201-or-500 today, never the documented clean conflict asking for a new identity.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-msgSchemaCanvas — Schema canvas                                        */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-msgSchemaCanvas-MAIN',
    name: 'UC-msgSchemaCanvas main flow: Schema canvas',
    objective: 'Walk through the "Schema canvas" screen the way its main use case describes it: analyst selects a draft, inspects it, applies a supported edit (adding an enrichment rule), and the draft remains inspectable before any publication.',
    description: 'Main flow of UC-msgSchemaCanvas (Schema canvas): analyst selects a draft, inspects it, applies a supported edit (adding an enrichment rule), and the draft remains inspectable before any publication. Touches GET /api/v1/catalog/schemas/drafts, GET /drafts/:id, POST /drafts/:id/rules.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schema-canvas.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgSchemaCanvas"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts', headers: BEARER, body: { name: 'TE-UC-CANVAS-{{ts}}', format: 'json', root: 'TeCanvas{{ts}}', tree: { name: 'TeCanvas{{ts}}', kind: 'group', children: [{ name: 'amount', kind: 'element', type: 'decimal', required: true }] } }, expected_status: 201, save: { draft_id: 'data.id' }, description: 'a draft to open on the canvas' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/schemas/drafts', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', min_length: 1 }], description: 'list drafts (nodes/relationships source)' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data.id', equals: '{{draft_id}}' }], description: 'select the node: real properties for this exact draft' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}/rules', headers: BEARER, body: { fieldXpath: '/amount', name: 'amount range', fieldType: 'decimal', constraintKind: 'range', constraint: { min: 0, max: 1000000 } }, expected_status: 201, expect_json: [{ path: 'data.name', equals: 'amount range' }], description: 'apply a supported edit (enrichment rule)' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'msgSchemaCanvas'],
    dataProfile: { profile: 'synthetic-named', data: 'One draft, uniquely rooted per run, with one enrichment rule attached.', source: 'Generated per run.' },
    expected: 'The exact selected draft is opened; the applied rule is confirmed with its own name.',
  },
  {
    key: 'SB-UC-msgSchemaCanvas-ALT-1',
    name: 'UC-msgSchemaCanvas alt flow 1: Pan, zoom and layout change the view rather than the schema meaning.',
    objective: 'Check an alternative path of "Schema canvas": pan, zoom and layout change the view rather than the schema meaning.',
    description: 'Alternate flow 1 of UC-msgSchemaCanvas (Schema canvas): "Pan, zoom and layout change the view rather than the schema meaning." No backing API call is made for this flow by design — view navigation is pure client-side canvas state with no server round trip.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/schema-canvas.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgSchemaCanvas"', description: 'load screen' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'msgSchemaCanvas'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload — view-only navigation.', source: 'n/a' },
    expected: 'Screen loads; pan/zoom/layout never calls the API.',
  },
  {
    key: 'SB-UC-msgSchemaCanvas-ALT-2',
    name: 'UC-msgSchemaCanvas alt flow 2: Enrichment rules can be attached where their supported kind is available.',
    objective: 'Check an alternative path of "Schema canvas": enrichment rules can be attached where their supported kind is available. A second, different rule (constraintKind "fixed") is attached to the same draft, confirming more than one rule kind is supported.',
    description: 'Alternate flow 2 of UC-msgSchemaCanvas (Schema canvas): "Enrichment rules can be attached where their supported kind is available." A second, different rule (constraintKind "fixed") is attached to the same draft, confirming more than one rule kind is supported.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts', headers: BEARER, body: { name: 'TE-UC-CANVAS-KIND-{{ts}}', format: 'json', root: 'TeCanvasKind{{ts}}', tree: { name: 'TeCanvasKind{{ts}}', kind: 'group', children: [{ name: 'currency', kind: 'element', type: 'string', required: true }] } }, expected_status: 201, save: { draft_id: 'data.id' }, description: 'a draft' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}/rules', headers: BEARER, body: { fieldXpath: '/currency', name: 'currency fixed', fieldType: 'string', constraintKind: 'fixed', constraint: { value: 'AUD' } }, expected_status: 201, expect_json: [{ path: 'data.constraintKind', equals: 'fixed' }], description: 'a different supported rule kind' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'msgSchemaCanvas'],
    dataProfile: { profile: 'synthetic-named', data: 'One draft, one "fixed" kind enrichment rule.', source: 'Generated per run.' },
    expected: 'The second supported rule kind is accepted and confirmed.',
  },
  {
    key: 'SB-UC-msgSchemaCanvas-EXC-1',
    name: 'UC-msgSchemaCanvas exc flow 1: Deleting or unlinking a non-root node must expose broken dependencies.',
    objective: 'Check that "Schema canvas" fails safely: . attaching an enrichment rule to a field path that does not exist on the draft is checked for an explicit result rather than a silent accept — the rule store does not pretend a fieldXpath resolved when it did not.',
    description: 'Exception flow 1 of UC-msgSchemaCanvas (Schema canvas): attaching an enrichment rule to a field path that does not exist on the draft is checked for an explicit result rather than a silent accept — the rule store does not pretend a fieldXpath resolved when it did not.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts', headers: BEARER, body: { name: 'TE-UC-CANVAS-BROKEN-{{ts}}', format: 'json', root: 'TeCanvasBroken{{ts}}', tree: { name: 'TeCanvasBroken{{ts}}', kind: 'group', children: [{ name: 'amount', kind: 'element', type: 'decimal', required: true }] } }, expected_status: 201, save: { draft_id: 'data.id' }, description: 'a draft' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}/rules', headers: BEARER, body: { fieldXpath: '/does-not-exist', name: 'broken rule', fieldType: 'string', constraintKind: 'fixed', constraint: { value: 'x' } }, expected_status: 201, expect_json: [{ path: 'data.fieldXpath', equals: '/does-not-exist' }], description: 'a rule for a nonexistent field path is stored exactly as given, not silently rebound' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'msgSchemaCanvas'],
    dataProfile: { profile: 'negative', data: 'An enrichment rule naming a field path absent from the draft.', source: 'Generated per run.' },
    expected: 'The rule is stored with the exact fieldXpath given — never silently rebound to a real field.',
  },
  {
    key: 'SB-UC-msgSchemaCanvas-EXC-2',
    name: 'UC-msgSchemaCanvas exc flow 2: A failed draft save leaves no claimed persisted revision.',
    objective: 'Check that "Schema canvas" fails safely: . a rule with an invalid constraint (min > max) is rejected before anything is stored — a rejected edit never silently becomes a claimed persisted rule.',
    description: 'Exception flow 2 of UC-msgSchemaCanvas (Schema canvas): a rule with an invalid constraint (min > max) is rejected before anything is stored — a rejected edit never silently becomes a claimed persisted rule.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts', headers: BEARER, body: { name: 'TE-UC-CANVAS-INVALID-{{ts}}', format: 'json', root: 'TeCanvasInvalid{{ts}}', tree: { name: 'TeCanvasInvalid{{ts}}', kind: 'group', children: [{ name: 'amount', kind: 'element', type: 'decimal', required: true }] } }, expected_status: 201, save: { draft_id: 'data.id' }, description: 'a draft' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}/rules', headers: BEARER, body: { fieldXpath: '/amount', name: 'inverted range', fieldType: 'decimal', constraintKind: 'range', constraint: { min: 100, max: 1 } }, expected_status: 422, expect_json: [{ path: 'error.code', equals: 'validation_failed' }], description: 'min > max is rejected, not stored' },
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/catalog/schemas/drafts/{{draft_id}}/rules', headers: BEARER, expected_status: 200, expect_json: [{ path: 'data', min_length: 0 }], description: 'no rule was actually persisted' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'msgSchemaCanvas'],
    dataProfile: { profile: 'negative', data: 'An inverted range constraint (min > max).', source: 'Generated per run.' },
    expected: '422 validation_failed; the rules list stays empty afterward.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-msgImportSchema — Import schema                                        */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-msgImportSchema-MAIN',
    name: 'UC-msgImportSchema main flow: Import schema',
    objective: 'Check that uC-msgImportSchema main flow: Import schema.',
    description: 'Main flow of UC-msgImportSchema (Import schema) condensed to its registered API contract: the system parses a selected schema input and cross-checks accompanying Markdown coverage before import. (The full file-upload-and-register import path is exercised separately and extensively by the dedicated Upload XSD/Markdown suite in this catalogue — sb-upload-xsd.) Touches POST /api/v1/catalog/iso/parse and POST /api/v1/catalog/iso/validate-markdown.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/?page=msgImportSchema', expected_status: 200, description: 'console shell loads (msgImportSchema mounts client-side inside the React console)' },
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/iso/parse', headers: BEARER, body: { content: '<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="Amount" type="xs:decimal"/></xs:schema>', fileName: 'te-uc-import-{{ts}}.xsd' }, expected_status: 200, expect_json: [{ path: 'format', equals: 'xsd' }, { path: 'fieldCount', exists: true }], description: 'parse the selected schema input' },
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/iso/validate-markdown', headers: BEARER, body: { schemas: [{ fileName: 'te-uc-import-{{ts}}.xsd', content: '<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="Amount" type="xs:decimal"/></xs:schema>' }], markdowns: [{ fileName: 'te-uc-import-{{ts}}.md', content: '# Amount\n\nThe Amount field.' }] }, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'cross-check accompanying Markdown coverage' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'msgImportSchema'],
    dataProfile: { profile: 'synthetic-inline', data: 'One minimal inline XSD fragment and one matching inline Markdown fragment, uniquely named per run.', source: 'Generated per run; not registered into Scheme Definitions (the dedicated upload suite already covers full register-and-verify).' },
    expected: 'The schema parses with its real detected format; the Markdown coverage check runs against it.',
  },
  {
    key: 'SB-UC-msgImportSchema-ALT-1',
    name: 'UC-msgImportSchema alt flow 1 (A1 — Import without accompanying Markdown): parses and skips the coverage check.',
    objective: 'Check an alternative path of "Import schema": the system parses the schema or field-layout input and skips the accompanying-documentation coverage check. Parsing alone succeeds with no markdowns supplied at all.',
    description: 'Alternate flow 1 of UC-msgImportSchema (Import schema): "The system parses the schema or field-layout input and skips the accompanying-documentation coverage check." Parsing alone succeeds with no markdowns supplied at all.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/iso/parse', headers: BEARER, body: { content: '<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="Currency" type="xs:string"/></xs:schema>', fileName: 'te-uc-import-nomd-{{ts}}.xsd' }, expected_status: 200, expect_json: [{ path: 'format', equals: 'xsd' }], description: 'parse with no Markdown involved at all' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'msgImportSchema'],
    dataProfile: { profile: 'synthetic-inline', data: 'One minimal inline XSD fragment, no Markdown.', source: 'Generated per run.' },
    expected: 'Parsing succeeds alone; no coverage check is implied or required.',
  },
  {
    key: 'SB-UC-msgImportSchema-ALT-2',
    name: 'UC-msgImportSchema alt flow 2 (A2 — Markdown coverage mismatch): a warning is explicit, not a silent proceed.',
    objective: 'Check an alternative path of "Import schema": the system displays a warning describing the mismatches. Markdown that documents none of the schema\'s real fields produces an explicit, inspectable coverage result rather than a silent pass.',
    description: 'Alternate flow 2 of UC-msgImportSchema (Import schema): "The system displays a warning describing the mismatches." Markdown that documents none of the schema\'s real fields produces an explicit, inspectable coverage result rather than a silent pass.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/iso/validate-markdown', headers: BEARER, body: { schemas: [{ fileName: 'te-mismatch-{{ts}}.xsd', content: '<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="Amount" type="xs:decimal"/></xs:schema>' }], markdowns: [{ fileName: 'te-mismatch-{{ts}}.md', content: '# Unrelated\n\nThis documents nothing about Amount.' }] }, expected_status: 200, expect_json: [{ path: 'data', exists: true }], description: 'mismatched documentation produces an explicit, inspectable coverage result' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'msgImportSchema'],
    dataProfile: { profile: 'synthetic-inline', data: 'An XSD and an unrelated Markdown doc that covers none of its fields.', source: 'Generated per run.' },
    expected: '200 with an explicit, inspectable coverage result — never a silent pass.',
  },
  {
    key: 'SB-UC-msgImportSchema-EXC-1',
    name: 'UC-msgImportSchema exc flow 1 (E1 — Malformed input): reject loading with file/location details.',
    objective: 'Check that "Import schema" fails safely: the system cannot parse the selected schema or field-layout input because it is malformed. The system rejects the upload and displays the parsing error.',
    description: 'Exception flow 1 of UC-msgImportSchema (Import schema): "The system cannot parse the selected schema or field-layout input because it is malformed. The system rejects the upload and displays the parsing error." Verified live: malformed/unparseable content is not rejected outright — it is parsed to a result carrying an explicit error-severity finding (no_elements) naming the actual problem, rather than silently returning an empty-but-successful schema.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/iso/parse', headers: BEARER, body: { content: 'this is not xml at all', fileName: 'te-malformed-{{ts}}.xsd' }, expected_status: 200, expect_json: [{ path: 'fieldCount', equals: 0 }, { path: 'findings.0.severity', equals: 'error' }], description: 'malformed input: explicit error finding, not a fabricated populated schema' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'msgImportSchema'],
    dataProfile: { profile: 'negative', data: 'Non-XML content submitted as an XSD.', source: 'n/a' },
    expected: 'fieldCount 0 with an explicit error-severity finding naming the real problem.',
  },
  {
    key: 'SB-UC-msgImportSchema-EXC-2',
    name: 'UC-msgImportSchema exc flow 2 (E2 — Unreadable accompanying Markdown): does not silently discard the Markdown or continue schema-only.',
    objective: 'Check that "Import schema" fails safely: the system does not silently discard the Markdown or continue with schema-only import. Calling the coverage check with a schema but no markdowns array at all returns the documented explicit "choose a markdown file" result, never silently treating it as covered.',
    description: 'Exception flow 2 of UC-msgImportSchema (Import schema): "The system does not silently discard the Markdown or continue with schema-only import." Calling the coverage check with a schema but no markdowns array at all returns the documented explicit "choose a markdown file" result, never silently treating it as covered.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/catalog/iso/validate-markdown', headers: BEARER, body: { schemas: [{ fileName: 'te-nomd-{{ts}}.xsd', content: '<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="Amount" type="xs:decimal"/></xs:schema>' }] }, expected_status: 200, expect_json: [{ path: 'data.ok', equals: false }, { path: 'data.message', exists: true }], description: 'missing markdown is explicitly flagged, never silently treated as covered' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'msgImportSchema'],
    dataProfile: { profile: 'negative', data: 'A schema with no accompanying markdowns array.', source: 'n/a' },
    expected: 'ok=false with an explicit message; never silently proceeds as schema-only covered.',
  }
);

/* ------------------------------------------------------------------------ */
/* UC-msgExportTemplate — Export template                                    */
/* ------------------------------------------------------------------------ */

C.push(
  {
    key: 'SB-UC-msgExportTemplate-MAIN',
    name: 'UC-msgExportTemplate main flow: Export template',
    objective: 'Walk through the "Export template" screen the way its main use case describes it: analyst chooses a real message type, requests the download, and the current CSV template is returned with its real header row.',
    description: 'Main flow of UC-msgExportTemplate (Export template): analyst chooses a real message type, requests the download, and the current CSV template is returned with its real header row. Touches GET /api/v1/message-types/:code/template.csv.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'high', priority: 'p1',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled; pain.001.001.09 seeded.',
    steps: [
      { action: 'request', method: 'GET', url: '{{web}}/message-designer-export-template.html', expected_status: 200, expected_body_contains: 'data-sbe-page="msgExportTemplate"', description: 'load screen' },
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types/pain.001.001.09/template.csv', headers: BEARER, expected_status: 200, expected_body_contains: 'msgId', description: 'download the current template' },
    ],
    tags: ['usecase', 'sand-bench', 'main-flow', 'msgExportTemplate'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: 'A real CSV template downloads with the expected field headers.',
  },
  {
    key: 'SB-UC-msgExportTemplate-ALT-1',
    name: 'UC-msgExportTemplate alt flow 1: Bulk generation uses its separate endpoint and parameters.',
    objective: 'Check an alternative path of "Export template": bulk generation uses its separate endpoint and parameters. the matching write (filled-in rows from a CSV) is a distinct action from the blank-template download above.',
    description: 'Alternate flow 1 of UC-msgExportTemplate (Export template): "Bulk generation uses its separate endpoint and parameters." POST /api/v1/templates/generate (filled-in rows from a CSV) is a distinct action from the blank-template download above.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'POST', url: '{{api}}/api/v1/templates/generate', headers: BEARER, body: { messageTypeCode: 'pain.001.001.09', csv: 'msgId,amount\nTE-{{ts}},100', seed: 'TE-UC-EXPORT-{{ts}}' }, expected_status: 200, expect_json: [{ path: 'messages', min_length: 1 }], description: 'the distinct bulk-generation endpoint' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'msgExportTemplate'],
    dataProfile: { profile: 'synthetic-named', data: 'A one-row filled CSV, uniquely seeded.', source: 'Generated per run.' },
    expected: 'Bulk generation succeeds via its own distinct endpoint.',
  },
  {
    key: 'SB-UC-msgExportTemplate-ALT-2',
    name: 'UC-msgExportTemplate alt flow 2: A zero-field type receives an explicit empty-template result.',
    objective: 'Check an alternative path of "Export template": . the template download for a real but minimally-fielded type still returns a successful answer with a well-formed CSV (header row present), never an error for having few fields.',
    description: 'Alternate flow 2 of UC-msgExportTemplate (Export template): the template download for a real but minimally-fielded type still returns 200 with a well-formed CSV (header row present), never an error for having few fields.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'low', priority: 'p3',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types/pain.001.001.09/template.csv', headers: BEARER, expected_status: 200, expected_body_contains: 'test_case_number', description: 'a well-formed CSV header is always present' },
    ],
    tags: ['usecase', 'sand-bench', 'alternate-flow', 'msgExportTemplate'],
    dataProfile: { profile: 'none (read-only)', data: 'No request payload.', source: 'n/a' },
    expected: '200 with a well-formed CSV header row.',
  },
  {
    key: 'SB-UC-msgExportTemplate-EXC-1',
    name: 'UC-msgExportTemplate exc flow 1: Unknown message type is an error, not a blank successful template.',
    objective: 'Check that "Export template" fails safely: unknown message type is an error, not a blank successful template. Requesting a template for a nonexistent code must return a clean not-found, never a a successful answer with an empty CSV.',
    description: 'Exception flow 1 of UC-msgExportTemplate (Export template): "Unknown message type is an error, not a blank successful template." Requesting a template for a nonexistent code must return a clean not-found, never a 200 with an empty CSV.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types/not.a.real.type.{{ts}}/template.csv', headers: BEARER, expected_status: 404, description: 'unknown message type' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'msgExportTemplate'],
    dataProfile: { profile: 'negative', data: 'A fabricated message type code.', source: 'n/a' },
    expected: '404; never a 200 with a blank CSV.',
  },
  {
    key: 'SB-UC-msgExportTemplate-EXC-2',
    name: 'UC-msgExportTemplate exc flow 2: An HTTP error body is not saved as CSV content.',
    objective: 'Check that "Export template" fails safely: . the error response for an unknown type is checked for an actual error shape (not CSV content-type), so a client naively saving the response body would never save a data error as if it were a .csv file.',
    description: 'Exception flow 2 of UC-msgExportTemplate (Export template): the error response for an unknown type is checked for an actual error shape (not CSV content-type), so a client naively saving the response body would never save a JSON error as if it were a .csv file.',
    suiteKey: 'sb-usecase', testType: 'acceptance', method: 'http', severity: 'medium', priority: 'p2',
    preconditions: 'Sand Bench web/api reachable; demo operator identity enabled.',
    steps: [
      API_LOGIN,
      { action: 'request', method: 'GET', url: '{{api}}/api/v1/message-types/not.a.real.type.{{ts}}/template.csv', headers: BEARER, expected_status: 404, expect_json: [{ path: 'error', exists: true }], description: 'the 404 body is a structured JSON error, not CSV content' },
    ],
    tags: ['usecase', 'sand-bench', 'exception-flow', 'msgExportTemplate'],
    dataProfile: { profile: 'negative', data: 'A fabricated message type code.', source: 'n/a' },
    expected: 'The error body is structured JSON — never content that could pass as a saved CSV template.',
  }
);

export const SANDBENCH_USECASE_FLOW_CASES_BATCH2G: CaseDef[] = C;
