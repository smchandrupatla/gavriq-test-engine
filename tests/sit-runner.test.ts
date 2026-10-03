/**
 * The SIT runner must not report a pass when nothing ran, and must match
 * parameterised tests imported with their template names.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tapCounts, testNamePattern } from '../apps/worker/src/runners/sit.ts';

describe('testNamePattern', () => {
  it('escapes a plain name and anchors it', () => {
    const re = new RegExp(testNamePattern('health (200) ok?'));
    assert.ok(re.test('health (200) ok?'));
    assert.ok(!re.test('health (200) ok? extra'));
  });

  it('turns template placeholders into wildcards', () => {
    const re = new RegExp(testNamePattern('Selenium screen ${pageId} opens from official nav'));
    assert.ok(re.test('Selenium screen rule-bench opens from official nav'));
    assert.ok(re.test('Selenium screen test-cases opens from official nav'));
    assert.ok(!re.test('Selenium screen opens from official nav'));
    const two = new RegExp(testNamePattern('Selenium static page ${page.path} look-and-feel'));
    assert.ok(two.test('Selenium static page /admin.html look-and-feel'));
  });
});

describe('tapCounts', () => {
  it('reads the node:test footer', () => {
    const tap = 'TAP version 13\nok 1 - a # SKIP test name does not match pattern\n1..1\n# tests 1\n# suites 0\n# pass 0\n# fail 0\n# cancelled 0\n# skipped 1\n';
    assert.deepEqual(tapCounts(tap), { pass: 0, fail: 0, skipped: 1 });
  });
  it('counts passes and failures', () => {
    assert.deepEqual(tapCounts('# pass 3\n# fail 1\n# skipped 0\n'), { pass: 3, fail: 1, skipped: 0 });
  });
});
