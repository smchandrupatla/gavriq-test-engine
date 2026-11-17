/**
 * Reviewer baseline-decision workflow on defect_log entries.
 *
 * Three canonical resolutions encode the review decision:
 *   fix_test_case  — application is the baseline (rewrite the test)
 *   fix_application — test is the baseline (fix the app)
 *   other          — flake / duplicate / environment / unresolved
 *
 * These tests pin the server-side contract: the enum values, the PATCH
 * payload handling, and the bulk endpoint shape. Live behavior is proven
 * separately by a Playwright case against the engine's own defect log.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RESOLUTIONS, isResolution, isBulkAction, BULK_ACTIONS } from '../apps/api/src/defect-log.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_JS = readFileSync(path.join(here, '..', 'apps', 'api', 'public', 'catalog', 'app.js'), 'utf8');
const SCHEMA = readFileSync(path.join(here, '..', 'apps', 'api', 'src', 'db', 'schema.sql'), 'utf8');
const ROUTES = readFileSync(path.join(here, '..', 'apps', 'api', 'src', 'routes', 'defect-log.ts'), 'utf8');
const CORE = readFileSync(path.join(here, '..', 'apps', 'api', 'src', 'defect-log.ts'), 'utf8');

describe('defect-log reviewer resolution', () => {
  it('declares exactly the three canonical resolutions', () => {
    assert.deepStrictEqual([...RESOLUTIONS].sort(), ['fix_application', 'fix_test_case', 'other']);
  });

  it('isResolution accepts the three values and rejects anything else', () => {
    for (const r of RESOLUTIONS) assert.strictEqual(isResolution(r), true, `${r} should be valid`);
    for (const r of ['', 'invalid', 'FIX_TEST_CASE', 'fixtestcase', null, undefined, 42]) {
      assert.strictEqual(isResolution(r as unknown), false, `${String(r)} should be rejected`);
    }
  });

  it('exposes a set_resolution bulk action next to the lifecycle actions', () => {
    assert.ok(isBulkAction('set_resolution'));
    for (const a of BULK_ACTIONS) assert.ok(['delete', 'send', 'validate', 'reject', 'set_resolution'].includes(a));
  });

  it('schema carries the four review columns (resolution, reviewer, notes, at) + index', () => {
    assert.match(SCHEMA, /ALTER TABLE defect_log ADD COLUMN IF NOT EXISTS resolution\s+TEXT/);
    assert.match(SCHEMA, /ALTER TABLE defect_log ADD COLUMN IF NOT EXISTS resolution_reviewer\s+TEXT/);
    assert.match(SCHEMA, /ALTER TABLE defect_log ADD COLUMN IF NOT EXISTS resolution_notes\s+TEXT/);
    assert.match(SCHEMA, /ALTER TABLE defect_log ADD COLUMN IF NOT EXISTS resolution_at\s+TIMESTAMPTZ/);
    assert.match(SCHEMA, /CREATE INDEX IF NOT EXISTS defect_log_resolution_idx ON defect_log \(resolution\)/);
  });

  it('bulk route accepts resolution + resolution_notes alongside the lifecycle fields', () => {
    assert.match(ROUTES, /resolution\?: unknown; resolution_notes\?: unknown/);
    assert.match(ROUTES, /action must be one of delete, send, validate, reject, set_resolution/);
    assert.match(ROUTES, /bulkAction\(b\.action, ids, actorOf\(req\),\s*\{/);
  });

  it('updateDefectLog stamps reviewer + resolution_at automatically', () => {
    assert.match(CORE, /patch\.resolution !== undefined/);
    assert.match(CORE, /set\('resolution_reviewer', by\)/);
    assert.match(CORE, /sets\.push\('resolution_at = now\(\)'\)/);
    // Clearing is supported too (null wipes the three columns at once).
    assert.match(CORE, /sets\.push\('resolution = NULL, resolution_reviewer = NULL, resolution_at = NULL'\)/);
  });

  it('listDefectLog surfaces the resolution fields in the row', () => {
    assert.match(CORE, /dl\.resolution, dl\.resolution_reviewer, dl\.resolution_notes, dl\.resolution_at/);
  });
});

describe('defect-log UI (console) carries the review-decision controls', () => {
  it('renders a resolutionChip() with the three states + unreviewed', () => {
    assert.match(APP_JS, /function resolutionChip\(r\)/);
    // Unreviewed chip for a null resolution.
    assert.match(APP_JS, /chip-muted[^`]*unreviewed/);
    // Named chips for the two baseline decisions.
    assert.match(APP_JS, /r==='fix_test_case'[\s\S]*?Fix test case/);
    assert.match(APP_JS, /r==='fix_application'[\s\S]*?Fix application/);
  });

  it('every row has the three per-row buttons + a tick for bulk apply', () => {
    assert.match(APP_JS, /data-action="defect-set-resolution"[^>]*data-resolution="fix_test_case"/);
    assert.match(APP_JS, /data-action="defect-set-resolution"[^>]*data-resolution="fix_application"/);
    assert.match(APP_JS, /data-action="defect-set-resolution"[^>]*data-resolution="other"/);
    assert.match(APP_JS, /data-defect-pick="\$\{esc\(x\.id\)\}"/);
  });

  it('bulk toolbar carries the three bulk actions', () => {
    assert.match(APP_JS, /data-action="defect-bulk-fix-test"/);
    assert.match(APP_JS, /data-action="defect-bulk-fix-app"/);
    assert.match(APP_JS, /data-action="defect-bulk-other"/);
  });

  it('handleAction routes the five new actions through to the right handler', () => {
    assert.match(APP_JS, /action==='defect-set-resolution'\)setDefectResolution/);
    assert.match(APP_JS, /action==='defect-bulk-fix-test'\)bulkDefectResolution\('fix_test_case'\)/);
    assert.match(APP_JS, /action==='defect-bulk-fix-app'\)bulkDefectResolution\('fix_application'\)/);
    assert.match(APP_JS, /action==='defect-bulk-other'\)bulkDefectResolution\('other'\)/);
  });

  it('setDefectResolution PATCHes /api/v1/defect-log/<id>', () => {
    const start = APP_JS.indexOf('async function setDefectResolution(node){');
    assert.ok(start > -1);
    const after = APP_JS.indexOf('\nasync function ', start + 1);
    const body = APP_JS.slice(start, after > start ? after : start + 2000);
    assert.match(body, /\/api\/v1\/defect-log\//);
    assert.match(body, /method:'PATCH'/);
    assert.match(body, /JSON\.stringify\(\{resolution\}\)/);
  });

  it('bulkDefectResolution POSTs the bulk endpoint with action=set_resolution', () => {
    const start = APP_JS.indexOf('async function bulkDefectResolution(resolution){');
    assert.ok(start > -1);
    const after = APP_JS.indexOf('\nasync function ', start + 1);
    const body = APP_JS.slice(start, after > start ? after : start + 2000);
    assert.match(body, /\/api\/v1\/defect-log\/bulk/);
    assert.match(body, /action:'set_resolution'/);
    assert.match(body, /ids,resolution/);
  });
});
