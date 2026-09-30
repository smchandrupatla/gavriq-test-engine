/**
 * Report generation — one filter set, three formats.
 *
 *   POST /api/v1/reports   body: ReportRequest, `format` = json | csv | pdf
 *
 * json is the on-screen preview (dashboard + rows), csv is a flat one-row-per-run
 * export (no images), pdf is the branded document rendered from HTML via the
 * Chromium that ships in the API image (report-pdf.ts). The same query feeds
 * all three, so the numbers never disagree between the preview and the file.
 */
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { query } from '../db/client.js';
import { statEvidence } from '../evidence-store.js';
import { escapeHtml as esc, renderHtmlToPdf } from '../report-pdf.js';

const FAILED = ['failed', 'error', 'timed_out'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EMBEDDED_IMAGES = 60;
const MAX_EMBEDDED_BYTES = 40 * 1024 * 1024;

export interface ReportRequest {
  application_id: string;
  environment_id?: string | null;
  scope?: { kind?: 'all' | 'suite' | 'cases' | 'test_type'; suite_id?: string; case_ids?: string[]; test_type?: string; label?: string };
  run_selection?: 'last_run' | 'date_range';
  from?: string | null;
  to?: string | null;
  status?: 'all' | 'passed' | 'failed';
  include_case_details?: boolean;
  include_evidence?: boolean;
  title?: string;
  format?: 'json' | 'csv' | 'pdf';
}

interface RunRow {
  result_id: string;
  execution_id: string;
  execution_key: string;
  execution_name: string | null;
  environment_name: string | null;
  status: string;
  duration_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
  message: string | null;
  evidence: Array<{ id: string; type: string; content_type: string | null; storage_key: string; size_bytes: number | null }>;
}

interface CaseRow {
  id: string; key: string; name: string; test_type: string; execution_method: string | null;
  severity: string; priority: string; tags: string[];
  description: string | null; preconditions: string | null; steps: unknown; expected_results: string | null;
  application_key: string; application_name: string;
  runs: RunRow[];
}

export interface BreakdownRow { name: string; runs: number; passed: number; failed: number; other: number; pass_rate: number | null }

/** Pass/fail counts per group, largest group first. */
function breakdown(items: Array<{ name: string; status: string }>): BreakdownRow[] {
  const groups = new Map<string, BreakdownRow>();
  for (const it of items) {
    const g = groups.get(it.name) || { name: it.name, runs: 0, passed: 0, failed: 0, other: 0, pass_rate: null };
    g.runs++;
    if (it.status === 'passed') g.passed++;
    else if (FAILED.includes(it.status)) g.failed++;
    else g.other++;
    groups.set(it.name, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, pass_rate: g.passed + g.failed ? Math.round((g.passed / (g.passed + g.failed)) * 100) : null }))
    .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name));
}

function parseDate(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fmtWhen(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

function fmtDur(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 59_950) return (ms / 1000).toFixed(1) + 's';
  const s = Math.round(ms / 1000); // round once, then split — never "19m 60s"
  return s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export async function buildReport(r: ReportRequest) {
  // "all" reports across every application; otherwise one application by id or key.
  const appRef = String(r.application_id || '');
  const allApps = appRef.toLowerCase() === 'all';
  let application: { id: string | null; key: string; name: string };
  if (allApps) {
    application = { id: null, key: 'all', name: 'All applications' };
  } else {
    const appRow = await query(`SELECT id, key, name FROM applications WHERE id::text = $1 OR key = $1`, [appRef]);
    if (!appRow.rows[0]) return { error: 'Application not found', status: 404 as const };
    application = appRow.rows[0] as { id: string; key: string; name: string };
  }

  let environment: { id: string; key: string; name: string } | null = null;
  if (r.environment_id) {
    const envRow = await query(`SELECT id, key, name FROM environments WHERE id::text = $1 OR key = $1`, [String(r.environment_id)]);
    environment = (envRow.rows[0] as { id: string; key: string; name: string } | undefined) ?? null;
    if (!environment) return { error: 'Environment not found', status: 404 as const };
  }

  // 1. Case set from scope
  const scope = r.scope || { kind: 'all' };
  const kind = scope.kind || 'all';
  const caseClauses: string[] = [];
  const caseParams: unknown[] = [];
  if (!allApps) { caseParams.push(application.id); caseClauses.push(`tc.application_id = $1`); }
  else caseClauses.push(`tc.lifecycle NOT IN ('deprecated','archived')`);
  let scopeLabel = 'all test cases';
  let suiteName: string | null = null;
  // A narrowed scope that names nothing must produce an empty report, never silently widen to "all".
  if ((kind === 'suite' && !scope.suite_id) || (kind === 'cases' && !(Array.isArray(scope.case_ids) && scope.case_ids.length)) || (kind === 'test_type' && !scope.test_type)) {
    caseClauses.push('false');
    scopeLabel = scope.label || 'no test cases selected';
  }
  if (kind === 'suite' && scope.suite_id) {
    caseParams.push(scope.suite_id);
    caseClauses.push(`tc.id IN (SELECT test_case_id FROM test_case_suites WHERE test_suite_id::text = $${caseParams.length})`);
    const s = await query(`SELECT name FROM test_suites WHERE id::text = $1`, [scope.suite_id]);
    suiteName = s.rows[0]?.name ?? null;
    scopeLabel = `suite “${suiteName || scope.suite_id}”`;
  } else if (kind === 'cases' && Array.isArray(scope.case_ids) && scope.case_ids.length) {
    const ids = scope.case_ids.map(String).filter((id) => UUID.test(id));
    caseParams.push(ids);
    caseClauses.push(`tc.id = ANY($${caseParams.length}::uuid[])`);
    scopeLabel = scope.label ? scope.label : ids.length === 1 ? 'one test case' : `${ids.length} selected test cases`;
  } else if (kind === 'test_type' && scope.test_type) {
    caseParams.push(scope.test_type);
    caseClauses.push(`tc.test_type::text = $${caseParams.length}`);
    scopeLabel = `test type “${scope.test_type}”`;
  }

  const { rows: caseRows } = await query(
    `SELECT tc.id, tc.key, tc.name, tc.test_type::text AS test_type, tc.execution_method,
            tc.severity::text AS severity, tc.priority::text AS priority, tc.tags,
            tc.description, tc.preconditions, tc.steps, tc.expected_results,
            a.key AS application_key, a.name AS application_name
     FROM test_cases tc JOIN applications a ON a.id = tc.application_id
     WHERE ${caseClauses.join(' AND ')} ORDER BY a.name, tc.key`,
    caseParams
  );
  const cases: CaseRow[] = caseRows.map((c: any) => ({ ...c, tags: c.tags || [], runs: [] }));
  const caseIds = cases.map((c) => c.id);

  // 2. Runs: latest per case, or every run in a date range
  const runSelection = r.run_selection === 'date_range' ? 'date_range' : 'last_run';
  const status = r.status === 'passed' || r.status === 'failed' ? r.status : 'all';
  const from = parseDate(r.from);
  const to = parseDate(r.to);
  let runRows: any[] = [];
  if (caseIds.length) {
    const params: unknown[] = [caseIds];
    const clauses = [`er.test_case_id = ANY($1::uuid[])`];
    if (environment) { params.push(environment.id); clauses.push(`e.environment_id = $${params.length}`); }
    if (runSelection === 'date_range') {
      if (from) { params.push(from); clauses.push(`er.created_at >= $${params.length}::timestamptz`); }
      if (to) { params.push(to); clauses.push(`er.created_at <= $${params.length}::timestamptz`); }
      if (status === 'passed') clauses.push(`er.status = 'passed'`);
      if (status === 'failed') clauses.push(`er.status IN ('failed','error','timed_out')`);
    }
    const select = `SELECT ${runSelection === 'last_run' ? 'DISTINCT ON (er.test_case_id)' : ''}
              er.id AS result_id, er.test_case_id, er.execution_id, e.key AS execution_key, e.name AS execution_name,
              env.name AS environment_name, er.status::text AS status, er.duration_ms, er.started_at,
              COALESCE(er.finished_at, er.created_at) AS finished_at, er.message
       FROM execution_results er
       JOIN executions e ON e.id = er.execution_id
       LEFT JOIN environments env ON env.id = e.environment_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY ${runSelection === 'last_run' ? 'er.test_case_id, er.created_at DESC' : 'er.created_at DESC'}`;
    runRows = (await query(select, params)).rows;
    if (runSelection === 'last_run' && status !== 'all') {
      runRows = runRows.filter((x) => (status === 'passed' ? x.status === 'passed' : FAILED.includes(x.status)));
    }
  }

  // 3. Evidence
  const evidenceByResult = new Map<string, RunRow['evidence']>();
  if (r.include_evidence && runRows.length) {
    const { rows } = await query(
      `SELECT id, execution_result_id, evidence_type, content_type, storage_key, size_bytes
       FROM evidence WHERE execution_result_id = ANY($1::uuid[]) ORDER BY created_at`,
      [runRows.map((x) => x.result_id)]
    );
    for (const ev of rows) {
      const list = evidenceByResult.get(ev.execution_result_id) || [];
      list.push({ id: ev.id, type: ev.evidence_type, content_type: ev.content_type, storage_key: ev.storage_key, size_bytes: ev.size_bytes == null ? null : Number(ev.size_bytes) });
      evidenceByResult.set(ev.execution_result_id, list);
    }
  }

  const byCase = new Map(cases.map((c) => [c.id, c]));
  for (const x of runRows) {
    const c = byCase.get(x.test_case_id);
    if (!c) continue;
    c.runs.push({
      result_id: x.result_id, execution_id: x.execution_id, execution_key: x.execution_key, execution_name: x.execution_name,
      environment_name: x.environment_name, status: x.status, duration_ms: x.duration_ms, started_at: x.started_at,
      finished_at: x.finished_at, message: x.message, evidence: evidenceByResult.get(x.result_id) || [],
    });
  }
  // In last_run mode with a status filter, only cases whose latest run matches stay in the report.
  const reportCases = runSelection === 'last_run' && status !== 'all' ? cases.filter((c) => c.runs.length) : cases;

  // 4. Dashboard numbers
  const allRuns = reportCases.flatMap((c) => c.runs);
  const passed = allRuns.filter((x) => x.status === 'passed').length;
  const failed = allRuns.filter((x) => FAILED.includes(x.status)).length;
  const other = allRuns.length - passed - failed;
  const dashboard = {
    cases: reportCases.length,
    cases_with_runs: reportCases.filter((c) => c.runs.length).length,
    cases_never_run: reportCases.filter((c) => !c.runs.length).length,
    runs: allRuns.length,
    passed, failed, other,
    pass_rate: passed + failed ? Math.round((passed / (passed + failed)) * 100) : null,
    evidence_items: allRuns.reduce((n, x) => n + x.evidence.length, 0),
    // Same numbers cut three ways — the quick-view part of the report.
    by_application: breakdown(reportCases.flatMap((c) => c.runs.map((x) => ({ name: c.application_name, status: x.status })))),
    by_environment: breakdown(allRuns.map((x) => ({ name: x.environment_name || 'No environment', status: x.status }))),
    by_type: breakdown(reportCases.flatMap((c) => c.runs.map((x) => ({ name: c.test_type, status: x.status })))),
  };

  // 5. Plain-language filter summary — the "what is this report about" line.
  const parts = [
    allApps ? 'Application: all applications' : `Application: ${application.name} (${application.key})`,
    environment ? `Environment: ${environment.name}` : allApps ? 'Environment: all environments' : 'Environment: all environments of the application',
    `Scope: ${scopeLabel}`,
    runSelection === 'last_run'
      ? 'Runs: latest run per test case'
      : `Runs: every run${from ? ` from ${fmtWhen(from)}` : ''}${to ? ` to ${fmtWhen(to)}` : ''}${!from && !to ? ' (no date limit)' : ''}`,
    status === 'all' ? 'Result: passed and failed' : status === 'passed' ? 'Result: passed only' : 'Result: failed only',
    r.include_case_details ? 'Includes test case details' : null,
    r.include_evidence ? 'Includes evidence' : null,
  ].filter(Boolean);
  const generatedAt = new Date();
  const ref = 'RPT-' + generatedAt.getTime().toString(36).toUpperCase();
  const title = (typeof r.title === 'string' && r.title.trim()) || `${application.name} — Test Report${environment ? ' · ' + environment.name : ''}`;

  return {
    status: 200 as const,
    report: {
      meta: {
        ref, title, generated_at: generatedAt.toISOString(),
        application: { id: application.id, key: application.key, name: application.name },
        all_applications: allApps,
        environment: environment ? { id: environment.id, key: environment.key, name: environment.name } : null,
        filters: { scope: { kind, label: scopeLabel, suite_name: suiteName }, run_selection: runSelection, from, to, status, include_case_details: !!r.include_case_details, include_evidence: !!r.include_evidence },
        filters_summary: parts.join(' · '),
        filters_lines: parts as string[],
      },
      dashboard,
      cases: reportCases,
    },
  };
}

export type Report = Extract<Awaited<ReturnType<typeof buildReport>>, { report: unknown }>['report'];

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
function csvCell(v: unknown): string {
  const s = v == null ? '' : v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(' ') : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(report: Report): string {
  const head = ['report_ref', 'application', 'case_key', 'case_name', 'test_type', 'method', 'severity', 'priority', 'tags',
    'environment', 'run_name', 'run_key', 'status', 'duration_ms', 'started_at', 'finished_at', 'message', 'evidence_count'];
  const lines = [head.join(',')];
  for (const c of report.cases) {
    const lead = [report.meta.ref, c.application_name, c.key, c.name, c.test_type, c.execution_method, c.severity, c.priority, c.tags];
    if (!c.runs.length) {
      lines.push([...lead, '', '', '', 'never run', '', '', '', '', 0].map(csvCell).join(','));
      continue;
    }
    for (const x of c.runs) {
      lines.push([...lead, x.environment_name, x.execution_name, x.execution_key, x.status, x.duration_ms, x.started_at, x.finished_at, x.message, x.evidence.length].map(csvCell).join(','));
    }
  }
  // Byte-order mark so Excel opens the file as UTF-8 (written as a char code: an invisible literal is easy to lose).
  return String.fromCharCode(0xfeff) + lines.join('\r\n');
}

// ---------------------------------------------------------------------------
// HTML (→ PDF)
// ---------------------------------------------------------------------------
function badge(status: string): string {
  const s = String(status || '').toLowerCase();
  const cls = s === 'passed' ? 'pass' : FAILED.includes(s) ? 'fail' : 'other';
  return `<span class="badge ${cls}">${esc(s.replace(/_/g, ' '))}</span>`;
}

function stepsHtml(steps: unknown): string {
  if (!Array.isArray(steps) || !steps.length) return '—';
  return `<ol class="steps">${steps.map((st: any) => {
    const text = typeof st === 'string' ? st : st?.action || st?.description || st?.name || JSON.stringify(st);
    const expect = typeof st === 'object' && st && (st.expected || st.expected_result) ? `<div class="muted">Expect: ${esc(st.expected || st.expected_result)}</div>` : '';
    return `<li>${esc(text)}${expect}</li>`;
  }).join('')}</ol>`;
}

function embedImage(storageKey: string, budget: { images: number; bytes: number }): string | null {
  const found = statEvidence(storageKey);
  if (!found) return null;
  if (budget.images >= MAX_EMBEDDED_IMAGES || budget.bytes + found.size > MAX_EMBEDDED_BYTES) return null;
  const ext = storageKey.toLowerCase().split('.').pop() || 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  budget.images++; budget.bytes += found.size;
  return `data:${mime};base64,${readFileSync(found.path).toString('base64')}`;
}

export function reportToHtml(report: Report): string {
  const m = report.meta, d = report.dashboard;
  const budget = { images: 0, bytes: 0 };
  const kpi = (label: string, value: unknown, sub?: string, cls = '') =>
    `<div class="kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value ${cls}">${esc(value)}</div>${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}</div>`;

  // Headings are numbered in document order, so they are created in document order.
  let section = 0;
  const h = (t: string) => `<h2>${++section}. ${esc(t)}</h2>`;
  const hSummary = h('Summary');
  const hScope = h('Report scope');
  const hCases = h('Test cases');

  // Dashboard breakdowns: the same pass/fail numbers by application, environment and type.
  const seg = (n: number, cls: string) => (n > 0 ? `<span class="${cls}" style="flex:${n} 1 0"></span>` : '');
  const bd = (title: string, rows: BreakdownRow[]) => `
    <table class="grid bd"><thead><tr><th>${esc(title)}</th><th class="num">Runs</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Pass rate</th><th style="width:32%">Result mix</th></tr></thead><tbody>${
      rows.slice(0, 15).map((g) => `<tr><td>${esc(g.name)}</td><td class="num">${g.runs}</td><td class="num">${g.passed}</td><td class="num">${g.failed}</td><td class="num">${g.pass_rate == null ? '—' : g.pass_rate + '%'}</td><td><div class="bar">${seg(g.passed, 'pass')}${seg(g.failed, 'fail')}${seg(g.other, 'other')}</div></td></tr>`).join('')
    }${rows.length > 15 ? `<tr><td colspan="6" class="muted">…and ${rows.length - 15} more</td></tr>` : ''}</tbody></table>`;
  const multi = m.all_applications;
  const breakdowns = d.runs
    ? (multi || d.by_application.length > 1 ? bd('By application', d.by_application) : '') +
      bd('By environment', d.by_environment) +
      (d.by_type.length > 1 ? bd('By test type', d.by_type) : '')
    : '';

  const caseTable = `<table class="grid"><thead><tr><th>#</th>${multi ? '<th>Application</th>' : ''}<th>Test case</th><th>Type</th><th>Method</th><th>Severity</th><th>Runs</th><th>Latest result</th></tr></thead><tbody>${
    report.cases.map((c, i) => `<tr><td class="num">${i + 1}</td>${multi ? `<td class="nowrap">${esc(c.application_name)}</td>` : ''}<td>${esc(c.name)}<div class="key">${esc(c.key)}</div></td><td class="nowrap">${esc(c.test_type)}</td><td class="nowrap">${esc(c.execution_method || '—')}</td><td>${esc(c.severity)}</td><td class="num">${c.runs.length}</td><td class="nowrap">${c.runs[0] ? badge(c.runs[0].status) : '<span class="badge other">never run</span>'}</td></tr>`).join('') || `<tr><td colspan="${multi ? 8 : 7}" class="empty">No test cases match this scope.</td></tr>`
  }</tbody></table>`;

  const details = m.filters.include_case_details ? h('Test case details') + report.cases.map((c, i) => `
    <div class="case">
      <div class="case-head"><span class="num">${i + 1}</span> <b>${esc(c.name)}</b> <span class="key">${esc(c.key)}</span>${multi ? ` <span class="tag">${esc(c.application_name)}</span>` : ''}</div>
      <dl class="kv">
        <dt>Type / method</dt><dd>${esc(c.test_type)} · ${esc(c.execution_method || '—')}</dd>
        <dt>Severity / priority</dt><dd>${esc(c.severity)} · ${esc(c.priority)}</dd>
        <dt>Tags</dt><dd>${c.tags.length ? c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ') : '—'}</dd>
        <dt>Description</dt><dd>${esc(c.description || '—')}</dd>
        <dt>Preconditions</dt><dd>${esc(c.preconditions || '—')}</dd>
        <dt>Steps</dt><dd>${stepsHtml(c.steps)}</dd>
        <dt>Expected results</dt><dd>${esc(c.expected_results || '—')}</dd>
      </dl>
    </div>`).join('') : '';

  const runsSection = h(m.filters.run_selection === 'last_run' ? 'Latest run per test case' : 'Test runs') + (report.cases.some((c) => c.runs.length)
    ? report.cases.filter((c) => c.runs.length).map((c, i) => `
      <div class="case flow">
        <div class="case-head"><span class="num">${i + 1}</span> <b>${esc(c.name)}</b> <span class="key">${esc(c.key)}</span>${multi ? ` <span class="tag">${esc(c.application_name)}</span>` : ''}</div>
        <table class="grid"><thead><tr><th>Run</th><th>Environment</th><th>Status</th><th>Duration</th><th>Started</th><th>Finished</th></tr></thead><tbody>${
          c.runs.map((x) => `<tr><td>${esc(x.execution_name || x.execution_key)}<div class="key">${esc(x.execution_key)}</div></td><td>${esc(x.environment_name || '—')}</td><td>${badge(x.status)}</td><td>${esc(fmtDur(x.duration_ms))}</td><td>${esc(fmtWhen(x.started_at))}</td><td>${esc(fmtWhen(x.finished_at))}</td></tr>${
            x.message && x.status !== 'passed' ? `<tr><td colspan="6" class="msg">${esc(x.message)}</td></tr>` : ''
          }${
            m.filters.include_evidence && x.evidence.length ? `<tr><td colspan="6"><div class="evidence">${x.evidence.map((ev) => {
              const isImg = String(ev.content_type || '').startsWith('image') || /\.(png|jpe?g|webp)$/i.test(ev.storage_key);
              const src = isImg ? embedImage(ev.storage_key, budget) : null;
              return src
                ? `<figure><img src="${src}" alt="${esc(ev.type)}"><figcaption>${esc(ev.type)}</figcaption></figure>`
                : `<span class="tag">${esc(ev.type)}${ev.size_bytes ? ' · ' + esc(Math.round(ev.size_bytes / 1024)) + ' KB' : ''}${isImg ? ' (image not available)' : ''}</span>`;
            }).join('')}</div></td></tr>` : ''
          }`).join('')
        }</tbody></table>
      </div>`).join('')
    : '<div class="empty">No runs match these filters.</div>');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.title)}</title>
<style>
  :root{--ink:#111827;--muted:#6b7280;--line:#e5e7eb;--panel:#f8fafc;--pass:#0f8f80;--fail:#d83a3f;--other:#6b7a90;--gold:#b7791f;--blue:#1e3a5f}
  *{box-sizing:border-box}
  body{margin:0;color:var(--ink);font:11px/1.45 -apple-system,Segoe UI,system-ui,sans-serif}
  .brand{display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:2px solid var(--blue);margin-bottom:14px}
  .mark{width:38px;height:38px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#1e3a5f);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
  .brand-title{font-weight:700;font-size:15px}.brand-sub{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  .brand-right{margin-left:auto;text-align:right;font-size:10px;color:var(--muted)}
  h1{font-size:20px;margin:0 0 4px}h2{font-size:13px;margin:22px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--line);page-break-after:avoid}
  .scope{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:6px;padding:10px 12px;margin:10px 0 14px}
  .scope ul{margin:4px 0 0;padding-left:18px}.scope li{margin:1px 0}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px}
  .kpi{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:#fff}
  .kpi-label{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
  .kpi-value{font-size:20px;font-weight:700;margin-top:2px}.kpi-value.pass{color:var(--pass)}.kpi-value.fail{color:var(--fail)}
  .kpi-sub{font-size:9px;color:var(--muted);margin-top:2px}
  table.grid{width:100%;border-collapse:collapse;margin:6px 0 10px;page-break-inside:auto}
  .grid th,.grid td{text-align:left;padding:5px 7px;border-bottom:1px solid var(--line);vertical-align:top;font-size:10px}
  .grid th{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);background:var(--panel)}
  .grid tr{page-break-inside:avoid}
  .num{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
  .key{font-family:ui-monospace,Consolas,monospace;font-size:9px;color:var(--muted)}
  .badge{display:inline-block;padding:1px 7px;border-radius:9px;font-size:9px;font-weight:600;color:#fff}
  .badge.pass{background:var(--pass)}.badge.fail{background:var(--fail)}.badge.other{background:var(--other)}
  .tag{display:inline-block;font-size:9px;border:1px solid var(--line);border-radius:8px;padding:0 6px;color:var(--muted);margin:1px 2px 1px 0}
  .case{border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:8px 0;page-break-inside:avoid;background:#fff}
  .case.flow{page-break-inside:auto}.case-head{page-break-after:avoid}
  .nowrap{white-space:nowrap}
  .case-head{font-size:11px;margin-bottom:4px}.case-head .num{margin-right:4px}
  .kv{display:grid;grid-template-columns:120px 1fr;gap:3px 10px;margin:4px 0 0;font-size:10px}.kv dt{color:var(--muted)}.kv dd{margin:0}
  .steps{margin:0;padding-left:16px}.steps li{margin:1px 0}
  .msg{color:var(--fail);font-size:9.5px;white-space:pre-wrap}
  .evidence{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0}
  .evidence figure{margin:0;max-width:32%;page-break-inside:avoid}.evidence img{max-width:100%;max-height:200px;border:1px solid var(--line);border-radius:4px}
  .evidence figcaption{font-size:9px;color:var(--muted);margin-top:2px}
  .muted{color:var(--muted)}.empty{color:var(--muted);padding:12px;text-align:center}
  table.bd{margin-top:10px}
  .bar{display:flex;gap:1px;height:9px;border-radius:4px;overflow:hidden;background:var(--line);margin-top:3px}
  .bar span{display:block;min-width:2px}.bar .pass{background:var(--pass)}.bar .fail{background:var(--fail)}.bar .other{background:var(--other)}
</style></head><body>
  <div class="brand">
    <div class="mark">TE</div>
    <div><div class="brand-title">GAVRIQ Test Engine</div><div class="brand-sub">Gavriq Labs Global · Test report</div></div>
    <div class="brand-right">Report ${esc(m.ref)}<br>Generated ${esc(fmtWhen(m.generated_at))}</div>
  </div>
  <h1>${esc(m.title)}</h1>
  <div class="muted">${esc(m.application.name)}${m.environment ? ' · ' + esc(m.environment.name) : ''}</div>

  ${hSummary}
  <div class="kpi-grid">
    ${kpi('Test cases', d.cases, `${d.cases_with_runs} with runs · ${d.cases_never_run} never run`)}
    ${kpi('Runs', d.runs, m.filters.run_selection === 'last_run' ? 'latest per case' : 'in range')}
    ${kpi('Passed', d.passed, d.pass_rate == null ? 'no verdicts' : `${d.pass_rate}% pass rate`, 'pass')}
    ${kpi('Failed', d.failed, d.other ? `${d.other} other (skipped/blocked/cancelled)` : 'errors and timeouts included', d.failed ? 'fail' : '')}
  </div>
  ${breakdowns}

  ${hScope}
  <div class="scope"><b>This report covers:</b><ul>${m.filters_lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>

  ${hCases}
  ${caseTable}
  ${details}
  ${runsSection}
</body></html>`;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export async function reportRoutes(app: FastifyInstance) {
  app.post<{ Body: ReportRequest }>('/api/v1/reports', async (req, reply) => {
    const b = req.body || ({} as ReportRequest);
    if (!b.application_id) return reply.status(400).send({ error: 'application_id is required' });
    const built = await buildReport(b);
    if ('error' in built) return reply.status(built.status).send({ error: built.error });
    const report = built.report;
    const format = b.format === 'csv' || b.format === 'pdf' ? b.format : 'json';
    const base = `${report.meta.ref}-${report.meta.application.key}`.replace(/[^A-Za-z0-9_-]+/g, '-');

    if (format === 'csv') {
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="${base}.csv"`)
        .send(reportToCsv(report));
    }
    if (format === 'pdf') {
      const pdf = await renderHtmlToPdf(reportToHtml(report), { footerLabel: `${report.meta.title} · ${report.meta.ref} · GAVRIQ Test Engine` });
      return reply
        .header('content-type', 'application/pdf')
        .header('content-disposition', `attachment; filename="${base}.pdf"`)
        .send(pdf);
    }
    return reply.send({ data: report });
  });
}
