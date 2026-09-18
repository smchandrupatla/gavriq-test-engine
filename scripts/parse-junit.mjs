#!/usr/bin/env node
/**
 * Convert JUnit XML or Jest JSON to Test Engine build-results payload.
 *   node scripts/parse-junit.mjs results.xml > results.json
 *   node scripts/parse-junit.mjs --jest jest-output.json > results.json
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const jestMode = args.includes('--jest');
const file = args.find((a) => a !== '--jest');
if (!file) {
  console.error('usage: node scripts/parse-junit.mjs [--jest] <file>');
  process.exit(2);
}
const raw = readFileSync(file, 'utf8');

function mapStatus(s) {
  const v = String(s || '').toLowerCase();
  if (['passed', 'pass', 'ok', 'success'].includes(v)) return 'passed';
  if (['failed', 'fail', 'error', 'failure'].includes(v)) return 'failed';
  if (['skipped', 'skip', 'pending', 'todo'].includes(v)) return 'skipped';
  return 'error';
}

function fromJest(json) {
  const data = JSON.parse(json);
  const tests = [];
  const suites = data.testResults || [];
  for (const suite of suites) {
    for (const t of suite.assertionResults || []) {
      tests.push({
        test_key: t.fullName || t.title || 'jest',
        test_name: t.title || t.fullName,
        suite: (t.ancestorTitles || []).join(' / ') || suite.name,
        status: mapStatus(t.status),
        duration_ms: t.duration ?? undefined,
        message: (t.failureMessages || []).join('\n').slice(0, 1000) || undefined,
      });
    }
  }
  return tests;
}

function fromJunit(xml) {
  const tests = [];
  const caseRe = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>|<testcase\b([^>]*)\/>/g;
  let m;
  while ((m = caseRe.exec(xml))) {
    const attrs = m[1] || m[3] || '';
    const body = m[2] || '';
    const name = /name="([^"]*)"/.exec(attrs)?.[1] || 'unnamed';
    const classname = /classname="([^"]*)"/.exec(attrs)?.[1] || '';
    const time = Number(/time="([^"]*)"/.exec(attrs)?.[1] || 0);
    let status = 'passed';
    let message;
    if (/<failure\b/.test(body) || /<error\b/.test(body)) {
      status = 'failed';
      message = /<(?:failure|error)\b[^>]*>([\s\S]*?)<\//.exec(body)?.[1]?.trim();
    } else if (/<skipped\b/.test(body)) {
      status = 'skipped';
    }
    tests.push({
      test_key: classname ? `${classname}.${name}` : name,
      test_name: name,
      suite: classname || undefined,
      status,
      duration_ms: Math.round(time * 1000),
      message,
    });
  }
  return tests;
}

const results = jestMode || file.endsWith('.json') ? fromJest(raw) : fromJunit(raw);
process.stdout.write(JSON.stringify(results, null, 2) + '\n');
