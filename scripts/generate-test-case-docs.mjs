#!/usr/bin/env node
/**
 * Generate docs/TEST-CASE-CATALOG.md from the live test repository.
 *
 * Reads every application, suite and test case through the engine's own API
 * (so the document always reflects what is actually registered and runnable)
 * and writes one section per application → category → suite, and for each
 * case: what it does, preconditions, the executable steps, the data it uses
 * and that data's profile, and the expected result.
 *
 *   TE_BASE=http://127.0.0.1:8797 node scripts/generate-test-case-docs.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.TE_BASE || 'http://127.0.0.1:8797').replace(/\/$/, '');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'docs', 'TEST-CASE-CATALOG.md');

async function j(p) {
  const res = await fetch(`${BASE}${p}`, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${p} -> ${res.status}`);
  return res.json();
}

async function allCases(appId) {
  const out = [];
  for (let off = 0; ; off += 200) {
    const r = await j(`/api/v1/test-cases?application_id=${appId}&full=1&limit=200&offset=${off}`);
    out.push(...(r.data || []));
    if (!(r.data || []).length || out.length >= (r.total ?? out.length)) break;
  }
  return out;
}

function mdEscape(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function stepLine(s, i) {
  if (s.action === 'request') {
    const target = s.url || s.path || '/';
    const checks = [];
    if (s.expected_status !== undefined) checks.push(`status ${Array.isArray(s.expected_status) ? s.expected_status.join('/') : s.expected_status}`);
    if (s.expect_json?.length) checks.push(s.expect_json.map((e) => `\`${e.path}\` ${e.equals !== undefined ? `= ${JSON.stringify(e.equals)}` : e.contains !== undefined ? `contains ${JSON.stringify(e.contains)}` : e.min_length !== undefined ? `length ≥ ${e.min_length}` : e.min !== undefined ? `≥ ${e.min}` : e.exists !== undefined ? (e.exists ? 'exists' : 'absent') : ''}`).join(', '));
    if (s.expected_body_contains) checks.push(`body contains ${JSON.stringify(s.expected_body_contains)}`);
    if (s.expected_body_not_contains) checks.push(`body must NOT contain ${JSON.stringify(s.expected_body_not_contains)}`);
    if (s.expect_headers?.length) checks.push(s.expect_headers.map((h) => `header \`${h.name}\` ${h.exists === false ? 'absent' : h.contains ? `contains "${h.contains}"` : h.not_contains ? `without "${h.not_contains}"` : 'present'}`).join(', '));
    const extras = [];
    if (s.save) extras.push(`capture ${Object.entries(s.save).map(([k, v]) => `\`${k}\` ← \`${v}\``).join(', ')}`);
    if (s.poll) extras.push(`poll up to ${(s.poll.timeout_ms ?? 8000) / 1000}s`);
    if (s.body !== undefined) extras.push(`body: \`${mdEscape(JSON.stringify(s.body)).slice(0, 220)}\``);
    if (s.body_raw !== undefined) extras.push(`raw body: \`${mdEscape(s.body_raw).slice(0, 80)}\``);
    return `${i}. **${s.method || 'GET'}** \`${mdEscape(target)}\`${s.description ? ` — ${mdEscape(s.description)}` : ''}${checks.length ? `\n      - expect: ${checks.join('; ')}` : ''}${extras.length ? `\n      - ${extras.join('; ')}` : ''}`;
  }
  const bits = [s.selector && `selector \`${mdEscape(s.selector)}\``, s.value && `value \`${mdEscape(s.value)}\``, s.expected && `expect \`${mdEscape(s.expected)}\``].filter(Boolean).join(', ');
  return `${i}. **${s.action}**${bits ? ` — ${bits}` : ''}${s.description ? ` _(${mdEscape(s.description)})_` : ''}`;
}

function caseSection(c) {
  const rules = c.validation_rules || {};
  const dp = rules.data_profile || null;
  const lines = [];
  lines.push(`#### ${c.key} — ${c.name}`);
  lines.push('');
  // The Test cases screen fields (adopted from Sand Bench): objective first, then the card.
  if (c.objective) {
    lines.push(`**Objective.** ${mdEscape(c.objective)}`);
    lines.push('');
  }
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| **Test ID** | \`${c.key}\` |`);
  lines.push(`| **Priority / severity** | ${c.priority_label || c.priority || '—'} (${c.priority || '—'}) / ${c.severity || '—'} |`);
  lines.push(`| **Status** | ${c.run_status || 'Not run'}${c.last_run_at ? ` (last run ${c.last_run_at})` : ''} · definition ${c.status || c.lifecycle} |`);
  lines.push(`| **Owner / component** | ${mdEscape(c.owner || c.owner_id || '—')} / ${mdEscape(c.component || '—')} |`);
  lines.push(`| **Environment / duration** | ${mdEscape(c.environment || '—')} / ${c.estimated_duration || '—'} |`);
  lines.push(`| **Visibility** | ${c.visibility || 'Team'} |`);
  lines.push(`| **Runner** | \`${c.execution_method || '—'}\`${rules.browser ? ` (${rules.browser})` : ''}${rules.viewport ? ` @ ${rules.viewport.width}×${rules.viewport.height}` : ''} |`);
  lines.push(`| **Type / level** | ${c.test_type || '—'} / ${c.test_level || '—'} |`);
  lines.push(`| **Lifecycle** | ${c.lifecycle} (${c.automation_status}) |`);
  lines.push(`| **Timeout** | ${c.timeout_seconds ?? '—'}s |`);
  lines.push(`| **Tags** | ${(c.tags || []).map((t) => `\`${t}\``).join(' ') || '—'} |`);
  lines.push(`| **Automation link** | ${mdEscape(c.automation_link || c.script || '—')} |`);
  if (Array.isArray(c.attachments) && c.attachments.length) lines.push(`| **Attachments** | ${c.attachments.map((a) => `[${mdEscape(a.name)}](${a.url})`).join(' · ')} |`);
  if (Array.isArray(c.dependency_ids) && c.dependency_ids.length) lines.push(`| **Dependencies** | ${c.dependency_ids.map((d) => `\`${d}\``).join(' ')} |`);
  if (c.triage_status && c.triage_status !== 'None') lines.push(`| **Triage** | ${c.triage_status}${c.assignee ? ` · ${mdEscape(c.assignee)}` : ''}${c.linked_issue_url ? ` · ${c.linked_issue_url}` : ''} |`);
  lines.push('');
  lines.push(`**What it does (technical).** ${c.description || '—'}`);
  lines.push('');
  if (c.preconditions) {
    lines.push(`**Preconditions.** ${c.preconditions}`);
    lines.push('');
  }
  const steps = Array.isArray(c.steps) ? c.steps : [];
  const plain = steps.filter((s) => s && typeof s === 'object' && s.text);
  if (plain.length) {
    lines.push(`**Steps.**`);
    lines.push('');
    lines.push('| # | Step | Expected result | Test data |');
    lines.push('|---|---|---|---|');
    plain.forEach((s, i) => lines.push(`| ${i + 1} | ${mdEscape(s.text)} | ${mdEscape(s.expected || '')} | ${mdEscape(s.testData || '—')} |`));
    lines.push('');
    lines.push('<details><summary>Executable detail</summary>');
    lines.push('');
    steps.forEach((s, i) => lines.push(`   ${stepLine(s, i + 1)}`));
    lines.push('');
    lines.push('</details>');
    lines.push('');
  } else if (steps.length) {
    lines.push(`**Steps.**`);
    lines.push('');
    steps.forEach((s, i) => lines.push(`   ${stepLine(s, i + 1)}`));
    lines.push('');
  } else if (c.script) {
    lines.push(`**Execution.** Runs \`${c.script}\`${c.script.includes('.sit.ts') ? ' via the node:test SIT runner (the case file drives the deployed stack directly)' : ''}.`);
    lines.push('');
  } else if (c.execution_method === 'performance') {
    lines.push(`**Execution.** Performance runner: ${rules.requests ?? 20} requests at concurrency ${rules.concurrency ?? 5} against \`${rules.url || rules.path || '/'}\`, SLA ${JSON.stringify(rules.sla || {})}.`);
    lines.push('');
  }
  const cleanupSteps = Array.isArray(rules.cleanup_steps) ? rules.cleanup_steps : [];
  if (cleanupSteps.length) {
    lines.push('**Cleanup (always attempted).**');
    lines.push('');
    cleanupSteps.forEach((s, i) => lines.push(`   ${stepLine(s, i + 1)}`));
    lines.push('');
  }
  if (c.test_data) {
    lines.push(`**Overall test data.** ${mdEscape(c.test_data)}`);
    lines.push('');
  }
  if (dp) {
    if (!c.test_data) { lines.push(`**Data used.** ${dp.data}`); lines.push(''); }
    lines.push(`**Data profile.** \`${dp.profile}\` — ${dp.source}`);
    lines.push('');
  } else if (c.test_data_ref && !c.test_data) {
    lines.push(`**Data used.** ${c.test_data_ref}`);
    lines.push('');
  }
  if (c.expected_results) {
    lines.push(`**Expected result.** ${c.expected_results}`);
    lines.push('');
  }
  if (c.flakiness_notes || c.known_workarounds || c.common_failure_causes) {
    lines.push('<details><summary>Triage notes</summary>');
    lines.push('');
    if (c.flakiness_notes) lines.push(`- **Flakiness.** ${mdEscape(c.flakiness_notes)}`);
    if (c.known_workarounds) lines.push(`- **Known workarounds.** ${mdEscape(c.known_workarounds)}`);
    if (c.common_failure_causes) lines.push(`- **Common failure causes.** ${mdEscape(c.common_failure_causes)}`);
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const apps = (await j('/api/v1/applications')).data || [];
  const now = new Date().toISOString();
  const out = [];
  out.push('# Test Case Catalog');
  out.push('');
  out.push(`> Generated from the live test repository at \`${BASE}\` on ${now}.`);
  out.push('> Regenerate with `npm run docs:catalog`. Every case listed here is registered,');
  out.push('> executable by the engine\'s workers, and documented with the data it uses.');
  out.push('');

  let totalCases = 0;
  for (const app of apps) {
    const [suites, cases] = await Promise.all([
      j(`/api/v1/suites?application_id=${app.id}`).then((r) => r.data || []),
      allCases(app.id),
    ]);
    totalCases += cases.length;
    const suiteById = new Map(suites.map((s) => [s.id, s]));
    const membership = (await j('/api/v1/test-case-suites')).data || [];
    const suitesOfCase = new Map();
    for (const m of membership) {
      if (!suiteById.has(m.test_suite_id)) continue;
      if (!suitesOfCase.has(m.test_case_id)) suitesOfCase.set(m.test_case_id, []);
      suitesOfCase.get(m.test_case_id).push(m.test_suite_id);
    }

    out.push(`## Application: ${app.name} (\`${app.key}\`)`);
    out.push('');
    if (app.description) out.push(app.description, '');
    out.push(`${cases.length} test cases across ${suites.length} suites.`);
    out.push('');

    const types = (app.metadata && app.metadata.sandbench_types) || [];
    const typeOrder = types.map((t) => t.key);
    const suitesByType = new Map();
    for (const s of suites) {
      const t = s.suite_type || 'other';
      if (!suitesByType.has(t)) suitesByType.set(t, []);
      suitesByType.get(t).push(s);
    }
    const orderedTypes = [...new Set([...typeOrder, ...suitesByType.keys()])].filter((t) => suitesByType.has(t));

    for (const typeKey of orderedTypes) {
      const meta = types.find((t) => t.key === typeKey);
      out.push(`### Category: ${meta ? meta.label : typeKey}${meta ? ` (${meta.category === 'qc' ? 'Quality control' : 'Quality assurance'})` : ''}`);
      out.push('');
      if (meta && meta.subtitle) out.push(`_${meta.subtitle}_`, '');
      for (const suite of suitesByType.get(typeKey)) {
        const suiteCases = cases
          .filter((c) => (suitesOfCase.get(c.id) || []).includes(suite.id))
          .sort((a, b) => a.key.localeCompare(b.key));
        if (!suiteCases.length) continue;
        let desc = suite.description || '';
        try { const d = JSON.parse(desc); desc = d.desc || desc; } catch { /* plain text */ }
        out.push(`#### Suite: ${suite.name} (\`${suite.key}\`) — ${suiteCases.length} cases`);
        out.push('');
        if (desc) out.push(mdEscape(desc), '');
        for (const c of suiteCases) out.push(caseSection(c), '---', '');
      }
    }
  }

  out.push(`_Total: ${totalCases} test cases across ${apps.length} applications._`);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, out.join('\n'), 'utf8');
  console.log(`Wrote ${outFile} (${totalCases} cases, ${apps.length} applications).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
