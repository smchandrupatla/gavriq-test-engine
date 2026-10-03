'use strict';
/*
 * Detail views for the unified console. Loaded before app.js; uses its globals
 * (state, el, esc, api, badge, toast, typeList, typeOfCase, isSitCase, SIT_GROUPS,
 * sitSuitesInGroup, casesInSuite, runSuite, runCases) at call time.
 *
 *   #/run/:id     one test run: summary, per-case results, evidence, graphs
 *   #/case/:id    one test case: details, script behind it, runs with evidence
 *   #/suites      suites list + create
 *   #/suite/new   create a suite by picking cases from any category
 *   #/suite/:id   view / edit a suite, run it, see its linked runs
 *   #/audit       placeholder and stale cases (no real script behind them)
 */

// ---------------------------------------------------------------- formatting
const C1 = '#3987e5', C2 = '#d95926', CERR = '#ff6b6b';
function fmtMs(ms) {
  if (ms == null || ms === '') return '—';
  const n = Number(ms);
  if (n < 1000) return n + ' ms';
  if (n < 60000) return (n / 1000).toFixed(1) + ' s';
  return Math.floor(n / 60000) + 'm ' + Math.round((n % 60000) / 1000) + 's';
}
function fmtWhen(v) { return v ? new Date(v).toLocaleString() : '—'; }
function fmtBytes(n) { if (n == null) return ''; return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
function go(hash) { location.hash = hash; }
function loading(title) { el('viewTitle').textContent = title; el('content').innerHTML = '<div class="empty">Loading…</div>'; }
function failView(e) { el('content').innerHTML = '<div class="card"><div class="empty">Could not load: ' + esc(e.message) + '</div></div>'; }
function runLink(id, key) { return '<a href="#/run/' + encodeURIComponent(id) + '" class="key">' + esc(key || id) + '</a>'; }
function caseLink(id, label) { return '<a href="#/case/' + encodeURIComponent(id) + '">' + esc(label) + '</a>'; }
function suiteLink(id, label) { return id ? '<a href="#/suite/' + encodeURIComponent(id) + '">' + esc(label || 'suite') + '</a>' : '<span class="muted">—</span>'; }
function kpi(label, value, sub, cls) {
  return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value ' + (cls || '') + '">' + value + '</div>' + (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') + '</div>';
}
function isPlaceholder(id) { return !!(state.audit && state.audit.placeholderIds.has(id)); }
function placeholderBadge(id) { return isPlaceholder(id) ? ' <span class="badge placeholder" data-tip="No script, steps or runner config behind this case">No script</span>' : ''; }

// ---------------------------------------------------------------- charts
function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
let chartSeq = 0;
const chartData = new Map();
function dataTable(cols, rows) {
  return '<details class="chart-data"><summary>Show data</summary><div class="table-wrap"><table><thead><tr>' +
    cols.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((r) => '<tr>' + r.map((v) => '<td>' + esc(v) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div></details>';
}
/** Line chart, one y axis. opts: {title, xs:[label], series:[{name,color,values}], unit} */
function lineChart(opts) {
  const id = 'ch' + (++chartSeq);
  const W = 640, H = 200, L = 48, R = 70, T = 14, B = 26;
  const n = opts.xs.length;
  const max = niceMax(Math.max(0, ...opts.series.flatMap((s) => s.values.filter((v) => v != null))));
  const x = (i) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4, yy = y(v);
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" class="grid"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" class="tick" text-anchor="end">' + esc(+v.toFixed(1)) + '</text>';
  }
  const step = Math.max(1, Math.ceil(n / 8));
  for (let i = 0; i < n; i += step) g += '<text x="' + x(i) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">' + esc(opts.xs[i]) + '</text>';
  let marks = '';
  const ends = [];
  opts.series.forEach((s) => {
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    if (!pts.length) return;
    marks += '<polyline fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="' + pts.map((p) => p.join(',')).join(' ') + '"/>';
    if (n <= 30) marks += pts.map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + s.color + '" stroke="var(--panel)" stroke-width="2"/>').join('');
    if (opts.series.length <= 4) { const last = pts[pts.length - 1]; ends.push({ x: last[0] + 8, y: last[1] + 4, name: s.name }); }
  });
  // Direct labels at line ends, nudged apart so converging lines stay readable.
  ends.sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12;
  ends.forEach((e) => { marks += '<text x="' + e.x + '" y="' + e.y + '" class="direct">' + esc(e.name) + '</text>'; });
  chartData.set(id, { kind: 'line', xs: opts.xs, series: opts.series, unit: opts.unit || '', L, R, W, n, x });
  const legend = opts.series.length > 1 ? '<div class="legend">' + opts.series.map((s) => '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';
  return '<figure class="chart"><figcaption>' + esc(opts.title) + '</figcaption>' + legend +
    '<div class="chart-box" data-chart="' + id + '"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.title) + '">' + g + marks +
    '<line class="xhair" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" visibility="hidden"/><rect class="hit" x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + H + '" fill="transparent"/></svg></div>' +
    dataTable([opts.xLabel || 'x', ...opts.series.map((s) => s.name + (opts.unit ? ' (' + opts.unit + ')' : ''))], opts.xs.map((xv, i) => [xv, ...opts.series.map((s) => s.values[i] ?? '')])) + '</figure>';
}
/** Vertical bars, one series. opts: {title, xs, values, color, unit} */
function barChart(opts) {
  const id = 'ch' + (++chartSeq);
  const W = 640, H = 170, L = 48, R = 12, T = 14, B = 26;
  const n = opts.values.length;
  const max = niceMax(Math.max(0, ...opts.values));
  const slot = (W - L - R) / Math.max(n, 1), bw = Math.max(1, slot - 2);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = (max * k) / 4, yy = y(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" class="grid"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" class="tick" text-anchor="end">' + esc(+v.toFixed(1)) + '</text>'; }
  const step = Math.max(1, Math.ceil(n / 8));
  let bars = '';
  opts.values.forEach((v, i) => {
    const bx = L + i * slot + 1, by = y(v), bh = Math.max(0, H - B - by);
    bars += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="' + Math.min(2, bw / 2) + '" fill="' + opts.color + '"/>' +
      '<rect class="bar-hit" data-i="' + i + '" x="' + (L + i * slot) + '" y="' + T + '" width="' + slot + '" height="' + (H - T - B) + '" fill="transparent"/>';
    if (i % step === 0) g += '<text x="' + (bx + bw / 2) + '" y="' + (H - 8) + '" class="tick" text-anchor="middle">' + esc(opts.xs[i]) + '</text>';
  });
  chartData.set(id, { kind: 'bar', xs: opts.xs, values: opts.values, unit: opts.unit || '', name: opts.title });
  return '<figure class="chart"><figcaption>' + esc(opts.title) + '</figcaption><div class="chart-box" data-chart="' + id + '"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.title) + '">' + g + bars + '</svg></div>' +
    dataTable([opts.xLabel || 'x', opts.title], opts.xs.map((xv, i) => [xv, opts.values[i]])) + '</figure>';
}
/** Horizontal bars with labels, one series (e.g. duration per case). */
function hbarChart(opts) {
  const id = 'ch' + (++chartSeq);
  const rowH = 22, W = 640, L = 220, R = 60, T = 6;
  const H = T * 2 + rowH * opts.labels.length;
  const max = niceMax(Math.max(0, ...opts.values));
  let body = '';
  opts.values.forEach((v, i) => {
    const yy = T + i * rowH, w = Math.max(v > 0 ? 2 : 0, ((W - L - R) * v) / max);
    const label = String(opts.labels[i]);
    body += '<text x="' + (L - 8) + '" y="' + (yy + 15) + '" class="tick" text-anchor="end">' + esc(label.length > 34 ? label.slice(0, 33) + '…' : label) + '</text>' +
      '<rect x="' + L + '" y="' + (yy + 4) + '" width="' + w + '" height="' + (rowH - 8) + '" rx="3" fill="' + (opts.colors ? opts.colors[i] : opts.color) + '"/>' +
      '<text x="' + (L + w + 6) + '" y="' + (yy + 15) + '" class="tick">' + esc(opts.format ? opts.format(v) : v) + '</text>' +
      '<rect class="bar-hit" data-i="' + i + '" x="0" y="' + yy + '" width="' + W + '" height="' + rowH + '" fill="transparent"/>';
  });
  chartData.set(id, { kind: 'bar', xs: opts.labels, values: opts.values, unit: opts.unit || '', name: opts.title, format: opts.format });
  return '<figure class="chart"><figcaption>' + esc(opts.title) + '</figcaption><div class="chart-box" data-chart="' + id + '"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.title) + '">' + body + '</svg></div></figure>';
}
function tipEl() {
  let t = document.getElementById('chartTip');
  if (!t) { t = document.createElement('div'); t.id = 'chartTip'; t.className = 'chart-tip'; t.hidden = true; document.body.appendChild(t); }
  return t;
}
function placeTip(t, ev) { t.hidden = false; t.style.left = Math.min(ev.clientX + 14, innerWidth - t.offsetWidth - 8) + 'px'; t.style.top = (ev.clientY + 14) + 'px'; }
function bindCharts(root) {
  root.querySelectorAll('[data-chart]').forEach((box) => {
    const d = chartData.get(box.getAttribute('data-chart'));
    if (!d) return;
    const svg = box.querySelector('svg'), t = tipEl();
    if (d.kind === 'line') {
      const hit = svg.querySelector('.hit'), xh = svg.querySelector('.xhair');
      hit.addEventListener('mousemove', (ev) => {
        const r = svg.getBoundingClientRect(), sx = ((ev.clientX - r.left) / r.width) * d.W;
        const i = d.n <= 1 ? 0 : Math.max(0, Math.min(d.n - 1, Math.round(((sx - d.L) / (d.W - d.L - d.R)) * (d.n - 1))));
        xh.setAttribute('x1', d.x(i)); xh.setAttribute('x2', d.x(i)); xh.setAttribute('visibility', 'visible');
        t.innerHTML = '<b>' + esc(d.xs[i]) + '</b>' + d.series.map((s) => '<div><i style="background:' + s.color + '"></i>' + esc(s.name) + ': ' + esc(s.values[i] ?? '—') + (s.values[i] != null && d.unit ? ' ' + esc(d.unit) : '') + '</div>').join('');
        placeTip(t, ev);
      });
      hit.addEventListener('mouseleave', () => { t.hidden = true; xh.setAttribute('visibility', 'hidden'); });
    } else {
      svg.querySelectorAll('.bar-hit').forEach((b) => {
        const i = Number(b.getAttribute('data-i'));
        b.addEventListener('mousemove', (ev) => { const v = d.values[i]; t.innerHTML = '<b>' + esc(d.xs[i]) + '</b><div>' + esc(d.format ? d.format(v) : v + (d.unit ? ' ' + d.unit : '')) + '</div>'; placeTip(t, ev); });
        b.addEventListener('mouseleave', () => { t.hidden = true; });
      });
    }
  });
}

// ---------------------------------------------------------------- evidence
function perfCharts(metrics) {
  const ts = Array.isArray(metrics && metrics.timeseries) ? metrics.timeseries : [];
  if (!ts.length) return '';
  const xs = ts.map((b) => b.t_s + 's');
  const errs = ts.map((b) => b.errors);
  const windowS = ts.length > 1 ? (ts[1].t_s - ts[0].t_s) || 1 : 1;
  let h = '<div class="chart-grid">' +
    lineChart({ title: 'Latency over time (ms)', xLabel: 'time', xs, unit: 'ms', series: [
      { name: 'p50', color: C1, values: ts.map((b) => (b.requests ? b.latency_p50_ms : null)) },
      { name: 'p95', color: C2, values: ts.map((b) => (b.requests ? b.latency_p95_ms : null)) },
    ] }) +
    barChart({ title: 'Throughput (requests/s)', xLabel: 'time', xs, color: C1, unit: 'req/s', values: ts.map((b) => +(b.requests / windowS).toFixed(1)) });
  if (errs.some((v) => v > 0)) h += barChart({ title: 'Errors per window', xLabel: 'time', xs, color: CERR, values: errs });
  return h + '</div>';
}
function perfTiles(m) {
  if (!m || m.latency_p95_ms == null) return '';
  return '<div class="kpi-grid tight">' + kpi('Requests', esc(m.total_requests)) + kpi('Throughput', esc(m.rps) + ' <small>req/s</small>') +
    kpi('p50', esc(m.latency_p50_ms) + ' <small>ms</small>') + kpi('p95', esc(m.latency_p95_ms) + ' <small>ms</small>') + kpi('p99', esc(m.latency_p99_ms) + ' <small>ms</small>') +
    kpi('Error rate', esc(m.error_rate_pct) + '%', '', m.error_rate_pct > 0 ? 'red' : 'green') + '</div>' +
    (m.profile ? '<div class="muted small pad">Profile: ' + esc(JSON.stringify(m.profile)) + '</div>' : '');
}
function evidenceGallery(list) {
  const ev = Array.isArray(list) ? list : [];
  if (!ev.length) return '<div class="evidence-none">No evidence was recorded for this result. Results from before evidence capture was added have none; re-run the case to collect it.</div>';
  const shots = ev.filter((e) => e.evidence_type === 'screenshot' && e.url);
  const others = ev.filter((e) => !(e.evidence_type === 'screenshot' && e.url));
  let h = '';
  if (shots.length) {
    h += '<div class="shots">' + shots.map((e) => {
      const md = e.metadata || {};
      return '<a class="shot" href="' + esc(e.url) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(e.url) + '" alt="' + esc(md.label || 'screenshot') + '"><span>' + esc(md.label || md.original_name || 'screenshot') + (md.title ? ' · ' + esc(md.title) : '') + '</span></a>';
    }).join('') + '</div>';
  }
  if (others.length) {
    h += '<div class="ev-files">' + others.map((e) => {
      const name = String(e.storage_key || '').replace(/^evidence\//, '');
      const viewable = /^(text\/|application\/json)/.test(String(e.content_type || ''));
      return '<div class="ev-file"><span class="tag">' + esc(e.evidence_type) + '</span> <span class="key">' + esc(name) + '</span> <span class="muted small">' + esc(fmtBytes(e.size_bytes)) + '</span>' +
        (viewable && e.url ? ' <button class="btn small" data-view-ev="' + esc(e.url) + '">View</button>' : '') +
        (e.url ? ' <a class="btn small" href="' + esc(e.url) + '" download="' + esc(name) + '">Download</a>' : '') +
        '<pre class="ev-pre" hidden></pre></div>';
    }).join('') + '</div>';
  }
  return h;
}
function bindEvidence(root) {
  root.querySelectorAll('[data-view-ev]').forEach((b) => {
    b.onclick = async () => {
      const pre = b.parentElement.querySelector('.ev-pre');
      if (!pre.hidden) { pre.hidden = true; b.textContent = 'View'; return; }
      b.textContent = 'Loading…';
      try {
        const res = await fetch(b.getAttribute('data-view-ev'));
        if (!res.ok) throw new Error('HTTP ' + res.status + (res.status === 404 ? ' — file no longer in the evidence store' : ''));
        let text = await res.text();
        if (/json/.test(res.headers.get('content-type') || '')) { try { const j = JSON.parse(text); if (Array.isArray(j.samples) && j.samples.length > 200) j.samples = j.samples.slice(0, 200).concat(['… ' + (j.samples.length - 200) + ' more (download for all)']); text = JSON.stringify(j, null, 2); } catch { /* raw */ } }
        pre.textContent = text.length > 200000 ? text.slice(0, 200000) + '\n… truncated, download for the full file' : text;
        pre.hidden = false; b.textContent = 'Hide';
      } catch (e) { pre.textContent = 'Could not load: ' + e.message; pre.hidden = false; b.textContent = 'View'; }
    };
  });
}
function metricsTable(m) {
  if (!m || typeof m !== 'object') return '';
  const rows = Object.entries(m).filter(([k, v]) => k !== 'timeseries' && k !== 'profile' && (typeof v !== 'object' || v === null));
  if (!rows.length) return '';
  return '<dl class="kv metrics">' + rows.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl>';
}
function resultBody(r) {
  const m = r.metrics || {};
  return '<div class="result-body">' +
    '<div class="msg">' + esc(r.message || '(no message)') + '</div>' +
    (r.classification ? '<div class="muted small">Classification: <span class="tag">' + esc(r.classification) + '</span></div>' : '') +
    perfTiles(m) + perfCharts(m) + (m.latency_p95_ms == null ? metricsTable(m) : '') +
    '<h4>Evidence</h4>' + evidenceGallery(r.evidence) + '</div>';
}

// ---------------------------------------------------------------- run detail
async function renderRunView(id) {
  loading('Test run');
  let e;
  try { e = (await api('/api/v1/executions/' + encodeURIComponent(id))).data; } catch (err) { return failView(err); }
  if (state.view !== 'run') return;
  el('viewTitle').textContent = 'Test run · ' + e.key;
  const results = e.results || [];
  const cnt = (f) => results.filter(f).length;
  const passed = cnt((r) => r.status === 'passed'), failed = cnt((r) => ['failed', 'error', 'timed_out'].includes(r.status)), blocked = cnt((r) => ['blocked', 'skipped', 'cancelled'].includes(r.status));
  const total = (e.test_case_ids || []).length || results.length;
  const dur = e.started_at && e.finished_at ? new Date(e.finished_at) - new Date(e.started_at) : null;
  const shots = results.reduce((n, r) => n + (r.evidence || []).filter((x) => x.evidence_type === 'screenshot').length, 0);
  let h = '<div class="crumbs"><a href="#/history">Test runs</a> / <span class="key">' + esc(e.key) + '</span></div>' +
    '<div class="kpi-grid">' + kpi('Status', badge({ status: e.status })) + kpi('Passed', passed + ' / ' + total, '', passed === total && total ? 'green' : '') +
    kpi('Failed', failed, '', failed ? 'red' : '') + kpi('Blocked / skipped', blocked, blocked ? 'not executable or skipped' : '', blocked ? 'amber' : '') +
    kpi('Duration', esc(fmtMs(dur))) + kpi('Evidence', results.reduce((n, r) => n + (r.evidence || []).length, 0), shots + ' screenshots') + '</div>' +
    '<div class="card"><dl class="kv pad"><dt>Suite</dt><dd>' + suiteLink(e.test_suite_id, e.suite_name) + '</dd><dt>Environment</dt><dd>' + esc(e.environment_name || '—') + (e.environment_base_url ? ' <span class="key">' + esc(e.environment_base_url) + '</span>' : '') + '</dd>' +
    '<dt>Trigger</dt><dd>' + esc(e.trigger_source) + (e.requested_by ? ' by ' + esc(e.requested_by) : '') + '</dd><dt>Worker</dt><dd>' + esc(e.worker_id || '—') + '</dd>' +
    '<dt>Queued</dt><dd>' + esc(fmtWhen(e.created_at)) + '</dd><dt>Started</dt><dd>' + esc(fmtWhen(e.started_at)) + '</dd><dt>Finished</dt><dd>' + esc(fmtWhen(e.finished_at)) + '</dd></dl></div>';
  if (results.length > 1) {
    const colors = results.map((r) => (r.status === 'passed' ? C1 : ['failed', 'error', 'timed_out'].includes(r.status) ? CERR : '#5a6a80'));
    h += '<div class="card pad">' + hbarChart({ title: 'Duration per test case (blue passed · red failed · gray blocked)', labels: results.map((r) => r.test_case_name || r.test_case_key || r.test_case_id), values: results.map((r) => Number(r.duration_ms) || 0), colors, format: fmtMs }) + '</div>';
  }
  const waiting = total - results.length;
  h += '<div class="card"><div class="card-head"><h2>Results</h2><span class="muted small">' + results.length + ' reported' + (waiting > 0 ? ' · ' + waiting + ' not yet' : '') + '</span></div>' +
    (results.length ? results.map((r, i) => '<details class="result"' + (i === 0 || r.status !== 'passed' ? ' open' : '') + '><summary>' + badge({ status: r.status }) + ' <span class="result-name">' + esc(r.test_case_name || r.test_case_key || r.test_case_id) + '</span>' + placeholderBadge(r.test_case_id) +
      ' <span class="muted small">' + esc(fmtMs(r.duration_ms)) + ' · ' + (r.evidence || []).length + ' evidence</span>' +
      '<span class="result-links"><a href="#/case/' + encodeURIComponent(r.test_case_id) + '">Case &amp; script</a></span></summary>' + resultBody(r) + '</details>').join('')
      : '<div class="empty">' + (['queued', 'running', 'preparing'].includes(e.status) ? 'Waiting for the worker to report results…' : 'No results were reported for this run.') + '</div>') + '</div>';
  el('content').innerHTML = h;
  bindCharts(el('content')); bindEvidence(el('content'));
  if (['queued', 'running', 'preparing'].includes(String(e.status))) setTimeout(() => { if (state.view === 'run' && state.runId === id) renderRunView(id); }, 3000);
}

// ---------------------------------------------------------------- case detail
async function renderCaseView(id, tab) {
  loading('Test case');
  let c, def, runs;
  try {
    [c, def, runs] = await Promise.all([
      api('/api/v1/test-cases/' + encodeURIComponent(id)).then((r) => r.data),
      api('/api/v1/test-cases/' + encodeURIComponent(id) + '/definition').then((r) => r.data).catch(() => null),
      api('/api/v1/test-cases/' + encodeURIComponent(id) + '/results').then((r) => r.data).catch(() => []),
    ]);
  } catch (err) { return failView(err); }
  if (state.view !== 'case') return;
  tab = tab || 'details';
  el('viewTitle').textContent = c.name || c.key;
  const suites = state.membership.filter((m) => m.test_case_id === c.id).map((m) => state.suites.find((s) => s.id === m.test_suite_id)).filter(Boolean);
  const last = runs[0];
  const tabs = [['details', 'Details'], ['script', 'Script'], ['runs', 'Runs & evidence (' + runs.length + ')']];
  let h = '<div class="crumbs"><a href="javascript:history.back()">Back</a> / <span class="key">' + esc(c.key) + '</span></div>' +
    '<div class="card"><div class="card-head"><h2>' + esc(c.name) + (def && !def.executable ? ' <span class="badge placeholder">No executable script</span>' : '') + '</h2>' +
    '<div class="row-actions"><button class="btn primary" id="caseRun"' + (def && !def.executable ? ' disabled title="Nothing would run — attach a script first"' : '') + '>Run this case</button></div></div>' +
    '<div class="tabs" role="tablist">' + tabs.map(([k, l]) => '<button role="tab" class="tab' + (k === tab ? ' active' : '') + '" data-tab="' + k + '" aria-selected="' + (k === tab) + '">' + esc(l) + '</button>').join('') + '</div><div class="pad" id="caseTab"></div></div>';
  el('content').innerHTML = h;

  const panes = {
    details: () => '<dl class="kv"><dt>Key</dt><dd class="key">' + esc(c.key) + '</dd><dt>Last result</dt><dd>' + (last ? badge({ status: last.status }) + ' ' + runLink(last.execution_id, last.execution_key) + ' <span class="muted small">' + esc(fmtWhen(last.finished_at)) + '</span>' : badge(null)) + '</dd>' +
      '<dt>Category</dt><dd>' + esc(isSitCase(c) ? 'SIT' : (typeList().find((t) => t.id === typeOfCase(c)) || {}).title || typeOfCase(c)) + '</dd>' +
      '<dt>Test type</dt><dd>' + esc(c.test_type) + '</dd><dt>Runner</dt><dd>' + esc(def ? def.runner : c.execution_method) + ' <span class="muted small">(' + esc(def ? def.kind : '—') + ')</span></dd>' +
      '<dt>Automation</dt><dd>' + esc(c.automation_status) + ' · ' + esc(c.lifecycle) + '</dd><dt>Priority</dt><dd>' + esc(c.priority) + ' · ' + esc(c.severity) + '</dd>' +
      '<dt>Suites</dt><dd>' + (suites.map((s) => suiteLink(s.id, s.name)).join(', ') || '<span class="muted">none</span>') + '</dd>' +
      '<dt>Tags</dt><dd>' + (c.tags || []).map((t) => '<span class="tag">' + esc(t) + '</span>').join(' ') + '</dd>' +
      '<dt>Description</dt><dd>' + esc(c.description || '—') + '</dd><dt>Preconditions</dt><dd>' + esc(c.preconditions || '—') + '</dd><dt>Expected</dt><dd>' + esc(c.expected_results || '—') + '</dd>' +
      '<dt>Timeout</dt><dd>' + esc(c.timeout_seconds) + ' s</dd><dt>Version</dt><dd>' + esc(c.version) + ' · updated ' + esc(fmtWhen(c.updated_at)) + '</dd></dl>',
    script: () => {
      if (!def) return '<div class="empty">Definition unavailable.</div>';
      let s = '<div class="def-head"><span class="badge ' + (def.executable ? 'passed' : 'placeholder') + '">' + (def.executable ? 'Executable' : 'Not executable') + '</span> <span class="muted">' + esc(def.reason) + '</span></div>' +
        '<dl class="kv"><dt>Runner</dt><dd>' + esc(def.runner) + '</dd>' + (def.file ? '<dt>Source file</dt><dd class="key">' + esc(def.file) + '</dd>' : '') + (def.test_name ? '<dt>Test / script</dt><dd>' + esc(def.test_name) + '</dd>' : '') + '</dl>';
      if (def.source) s += '<h4>' + (def.kind === 'performance' ? 'Load profile and SLA (validation_rules)' : def.kind === 'steps' ? 'Steps' : 'Code that runs') + '</h4><pre class="code">' + esc(def.source) + '</pre>';
      else if (def.executable) s += '<div class="evidence-none">Source could not be read from this build.</div>';
      else s += '<div class="evidence-none">There is no code behind this case. It is a catalog entry only; running it proves nothing until a SIT file, named script, steps or a load profile is attached.</div>';
      if (def.file_source && def.file_source !== def.source) s += '<details><summary>' + (def.kind === 'performance' ? 'Performance runner code' : 'Whole file ' + esc(def.file)) + '</summary><pre class="code">' + esc(def.file_source) + '</pre></details>';
      return s;
    },
    runs: () => {
      if (!runs.length) return '<div class="empty">This case has not been run yet.</div>';
      const chrono = runs.slice().reverse();
      let s = '';
      if (chrono.length > 1) {
        const series = [{ name: 'duration', color: C1, values: chrono.map((r) => Number(r.duration_ms) || 0) }];
        if (chrono.some((r) => r.metrics && r.metrics.latency_p95_ms != null)) series.push({ name: 'p95 latency', color: C2, values: chrono.map((r) => (r.metrics && r.metrics.latency_p95_ms != null ? r.metrics.latency_p95_ms : null)) });
        s += lineChart({ title: 'Across runs (ms)', xLabel: 'run', xs: chrono.map((r) => r.execution_key.slice(-8)), unit: 'ms', series });
      }
      s += runs.map((r, i) => '<details class="result"' + (i === 0 ? ' open' : '') + '><summary>' + badge({ status: r.status }) + ' ' + runLink(r.execution_id, r.execution_key) +
        ' <span class="muted small">' + esc(fmtWhen(r.finished_at)) + ' · ' + esc(fmtMs(r.duration_ms)) + (r.suite_name ? ' · suite ' : '') + '</span>' + (r.suite_name ? suiteLink(r.test_suite_id, r.suite_name) : '') +
        ' <span class="muted small">· ' + (r.evidence || []).length + ' evidence</span></summary>' + resultBody(r) + '</details>').join('');
      return s;
    },
  };
  const show = (k) => {
    el('caseTab').innerHTML = panes[k]();
    el('content').querySelectorAll('[data-tab]').forEach((b) => { const on = b.getAttribute('data-tab') === k; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    bindCharts(el('caseTab')); bindEvidence(el('caseTab'));
    history.replaceState(null, '', '#/case/' + encodeURIComponent(id) + (k === 'details' ? '' : '/' + k));
  };
  el('content').querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => show(b.getAttribute('data-tab')); });
  el('caseRun').onclick = () => runCases([c.id], c.key);
  show(tab);
}

// ---------------------------------------------------------------- suites
function categoryOptions() {
  const tl = typeList();
  return [['all', 'All categories']].concat(
    SIT_GROUPS.map((g) => ['sit:' + g.id, 'SIT · ' + g.title]),
    tl.filter((t) => t.category === 'qa').map((t) => ['type:' + t.id, 'QA · ' + t.title]),
    tl.filter((t) => t.category !== 'qa').map((t) => ['type:' + t.id, 'QC · ' + t.title]),
    [['type:other', 'Other']]
  );
}
function sitGroupIndex() {
  const idx = new Map();
  SIT_GROUPS.forEach((g) => sitSuitesInGroup(g).forEach((s) => casesInSuite(s.id).forEach((c) => { if (!idx.has(c.id)) idx.set(c.id, g.id); })));
  return idx;
}
function caseCategory(c, sitIdx) {
  if (isSitCase(c)) return 'sit:' + (sitIdx.get(c.id) || 'other');
  return 'type:' + typeOfCase(c);
}
function categoryLabel(cat) { const o = categoryOptions().find(([k]) => k === cat); return o ? o[1] : cat.replace(/^\w+:/, ''); }

function renderSuitesView() {
  el('viewTitle').textContent = 'Test suites';
  const custom = state.suites.filter((s) => s.suite_type === 'custom');
  const builtin = state.suites.filter((s) => s.suite_type !== 'custom');
  const count = (s) => (s.case_count != null ? s.case_count : casesInSuite(s.id).length);
  const table = (list, empty) => list.length ? '<div class="table-wrap"><table><thead><tr><th>Suite</th><th>Cases</th><th>Type</th><th>Updated</th></tr></thead><tbody>' +
    list.map((s) => '<tr><td>' + suiteLink(s.id, s.name) + '<div class="key small">' + esc(s.key) + '</div></td><td>' + esc(count(s)) + '</td><td>' + esc(s.suite_type || '—') + '</td><td class="muted small">' + esc(fmtWhen(s.updated_at)) + '</td></tr>').join('') +
    '</tbody></table></div>' : '<div class="empty">' + empty + '</div>';
  el('content').innerHTML = '<div class="card"><div class="card-head"><h2>My suites</h2><button class="btn primary" id="newSuite">Create new suite</button></div>' +
    table(custom, 'No suites yet. Create one and pick test cases from any category (SIT, QA, QC).') + '</div>' +
    '<details class="card"><summary class="card-head"><h2>Built-in suites (' + builtin.length + ')</h2><span class="muted small">Seeded and SIT-imported · read-only, can be copied</span></summary>' + table(builtin, 'None') + '</details>';
  el('newSuite').onclick = () => go('#/suite/new');
}

async function renderSuiteView(id) {
  if (id === 'new') return renderSuiteNew();
  loading('Test suite');
  let s;
  try { s = (await api('/api/v1/suites/' + encodeURIComponent(id))).data; } catch (err) { return failView(err); }
  if (state.view !== 'suite') return;
  el('viewTitle').textContent = s.name;
  const runs = s.executions || [];
  const cases = s.cases || [];
  const execCount = cases.filter((c) => !isPlaceholder(c.id)).length;
  let h = '<div class="crumbs"><a href="#/suites">Test suites</a> / <span class="key">' + esc(s.key) + '</span></div>' +
    '<div class="card"><div class="card-head"><div><h2 id="suiteName">' + esc(s.name) + '</h2><div class="muted small" id="suiteDesc">' + esc(s.description && !String(s.description).startsWith('{') ? s.description : '') + '</div></div>' +
    '<div class="row-actions">' + (s.editable ? '<button class="btn" id="editSuite">Edit details</button><button class="btn" id="addCases">Add / remove test cases</button>' : '<span class="muted small">Read-only built-in suite</span>') +
    '<button class="btn" id="copySuite">Copy as new suite</button>' + (s.editable ? '<button class="btn danger" id="delSuite">Delete</button>' : '') +
    '<button class="btn primary" id="runThisSuite"' + (cases.length ? '' : ' disabled') + '>Run suite</button></div></div>' +
    '<form id="suiteForm" class="pad form" hidden><label>Name <input name="name" required maxlength="200" value="' + esc(s.name) + '"></label><label>Description <textarea name="description" rows="2">' + esc(s.description || '') + '</textarea></label><div class="row-actions"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" id="cancelEdit">Cancel</button></div></form>' +
    '<div class="kpi-grid pad">' + kpi('Test cases', cases.length, execCount + ' executable') + kpi('Categories', new Set(cases.map((c) => caseCategory(c, sitGroupIndex()))).size) + kpi('Runs', runs.length) +
    kpi('Last run', runs[0] ? badge({ status: runs[0].status }) : badge(null), runs[0] ? runLink(runs[0].id, runs[0].key) : '') + '</div></div>';
  if (runs.length > 1) {
    const chrono = runs.slice().reverse();
    h += '<div class="card pad">' + lineChart({ title: 'Pass rate per run (%)', xLabel: 'run', unit: '%', xs: chrono.map((r) => r.key.slice(-8)), series: [{ name: 'pass rate', color: C1, values: chrono.map((r) => (r.reported ? Math.round((r.passed / r.reported) * 100) : 0)) }] }) + '</div>';
  }
  const sitIdx = sitGroupIndex();
  h += '<div class="card"><div class="card-head"><h2>Test cases in this suite</h2><span class="muted small">' + cases.length + '</span></div>' +
    (cases.length ? '<div class="table-wrap"><table><thead><tr><th>Test case</th><th>Category</th><th>Last result</th><th>Duration</th><th></th></tr></thead><tbody>' +
      cases.map((c) => '<tr><td>' + caseLink(c.id, c.name) + placeholderBadge(c.id) + '<div class="key small">' + esc(c.key) + '</div></td><td class="small">' + esc(categoryLabel(caseCategory(c, sitIdx))) + '</td><td>' + badge(c.last_status ? { status: c.last_status } : null) + '</td><td class="small">' + esc(fmtMs(c.last_duration_ms)) + '</td><td>' +
        (s.editable ? '<button class="btn small" data-remove="' + esc(c.id) + '" aria-label="Remove ' + esc(c.name) + ' from suite">Remove</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>'
      : '<div class="empty">No test cases yet.' + (s.editable ? ' Use “Add / remove test cases”.' : '') + '</div>') + '</div>';
  h += '<div class="card"><div class="card-head"><h2>Runs of this suite</h2><span class="muted small">Each run keeps its results and evidence</span></div>' +
    (runs.length ? '<div class="table-wrap"><table><thead><tr><th>Run</th><th>Status</th><th>Passed</th><th>Failed</th><th>Blocked</th><th>Duration</th><th>Started</th></tr></thead><tbody>' +
      runs.map((r) => '<tr><td>' + runLink(r.id, r.key) + '</td><td>' + badge({ status: r.status }) + '</td><td>' + esc(r.passed) + ' / ' + esc(r.total_cases) + '</td><td>' + esc(r.failed) + '</td><td>' + esc(r.blocked) + '</td><td>' + esc(fmtMs(r.duration_ms)) + '</td><td class="muted small">' + esc(fmtWhen(r.started_at || r.created_at)) + '</td></tr>').join('') + '</tbody></table></div>'
      : '<div class="empty">This suite has not been run yet.</div>') + '</div>';
  el('content').innerHTML = h;
  bindCharts(el('content'));

  el('runThisSuite').onclick = async () => { await runSuite(s.id, cases.map((c) => c.id), s.name); renderSuiteView(s.id); };
  el('copySuite').onclick = async () => {
    const name = prompt('Name for the new suite', 'Copy of ' + s.name);
    if (!name) return;
    try { const r = await api('/api/v1/suites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, description: 'Copied from ' + s.name, test_case_ids: cases.map((c) => c.id) }) }); await reloadSuites(); toast('Created ' + r.data.name); go('#/suite/' + r.data.id); } catch (e) { toast('Copy failed: ' + e.message); }
  };
  if (!s.editable) return;
  const form = el('suiteForm');
  el('editSuite').onclick = () => { form.hidden = false; form.elements.name.focus(); };
  el('cancelEdit').onclick = () => { form.hidden = true; };
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    try { await api('/api/v1/suites/' + s.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: form.elements.name.value, description: form.elements.description.value }) }); await reloadSuites(); toast('Suite saved'); renderSuiteView(s.id); } catch (e) { toast('Save failed: ' + e.message); }
  };
  el('delSuite').onclick = async () => {
    if (!confirm('Delete suite "' + s.name + '"? Its past runs and evidence are kept.')) return;
    try { await api('/api/v1/suites/' + s.id, { method: 'DELETE' }); await reloadSuites(); toast('Suite deleted'); go('#/suites'); } catch (e) { toast('Delete failed: ' + e.message); }
  };
  el('addCases').onclick = () => openPicker(cases.map((c) => c.id), async (ids) => {
    await api('/api/v1/suites/' + s.id + '/cases', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ test_case_ids: ids }) });
    await reloadSuites(); toast('Suite now has ' + ids.length + ' test cases'); renderSuiteView(s.id);
  });
  el('content').querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = async () => {
      try { await api('/api/v1/suites/' + s.id + '/cases/' + b.getAttribute('data-remove'), { method: 'DELETE' }); await reloadSuites(); renderSuiteView(s.id); } catch (e) { toast('Remove failed: ' + e.message); }
    };
  });
}

function renderSuiteNew() {
  el('viewTitle').textContent = 'Create test suite';
  const picked = new Set();
  el('content').innerHTML = '<div class="crumbs"><a href="#/suites">Test suites</a> / new</div><div class="card"><form id="newSuiteForm" class="pad form">' +
    '<label>Name <input name="name" required maxlength="200" placeholder="e.g. Release 4.2 regression"></label>' +
    '<label>Description <textarea name="description" rows="2" placeholder="What this suite proves"></textarea></label>' +
    '<div class="row-actions"><button class="btn" type="button" id="pickCases">Select test cases…</button><span class="muted small" id="pickedCount">0 selected</span></div>' +
    '<div id="pickedList" class="picked"></div>' +
    '<div class="row-actions"><button class="btn primary" type="submit">Create suite</button><a class="btn" href="#/suites">Cancel</a></div></form></div>';
  const sitIdx = sitGroupIndex();
  const refresh = () => {
    el('pickedCount').textContent = picked.size + ' selected';
    const byCat = {};
    state.cases.filter((c) => picked.has(c.id)).forEach((c) => { const k = categoryLabel(caseCategory(c, sitIdx)); (byCat[k] = byCat[k] || []).push(c); });
    el('pickedList').innerHTML = Object.entries(byCat).map(([k, list]) => '<div class="picked-group"><b>' + esc(k) + '</b> <span class="muted small">' + list.length + '</span><div class="small">' + list.map((c) => esc(c.name)).join(' · ') + '</div></div>').join('');
  };
  el('pickCases').onclick = () => openPicker([...picked], async (ids) => { picked.clear(); ids.forEach((i) => picked.add(i)); refresh(); });
  el('newSuiteForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    try {
      const r = await api('/api/v1/suites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: f.elements.name.value, description: f.elements.description.value, test_case_ids: [...picked] }) });
      await reloadSuites(); toast('Created suite ' + r.data.name); go('#/suite/' + r.data.id);
    } catch (e) { toast('Create failed: ' + e.message); }
  };
}

/** Case picker across every category. onApply receives the full ordered selection. */
function openPicker(initialIds, onApply) {
  const dlg = el('picker');
  const sel = new Set(initialIds);
  const order = [...initialIds];
  const sitIdx = sitGroupIndex();
  const cats = categoryOptions();
  let cat = 'all', q = '', hidePlaceholders = false;
  el('pickerCat').innerHTML = cats.map(([k, l]) => {
    const n = k === 'all' ? state.cases.length : state.cases.filter((c) => caseCategory(c, sitIdx) === k).length;
    return n || k === 'all' ? '<option value="' + esc(k) + '">' + esc(l) + ' (' + n + ')</option>' : '';
  }).join('');
  el('pickerCat').value = 'all'; el('pickerSearch').value = ''; el('pickerHide').checked = false;
  const visible = () => state.cases.filter((c) => (cat === 'all' || caseCategory(c, sitIdx) === cat) && (!hidePlaceholders || !isPlaceholder(c.id)) &&
    (!q || String(c.name).toLowerCase().includes(q) || String(c.key).toLowerCase().includes(q)));
  const draw = () => {
    const list = visible();
    el('pickerList').innerHTML = list.length ? list.slice(0, 500).map((c) => '<label class="pick-row"><input type="checkbox" data-pick="' + esc(c.id) + '"' + (sel.has(c.id) ? ' checked' : '') + '><span><span class="pick-name">' + esc(c.name) + '</span>' + placeholderBadge(c.id) +
      '<span class="key small"> ' + esc(c.key) + '</span><span class="muted small"> · ' + esc(categoryLabel(caseCategory(c, sitIdx))) + '</span></span></label>').join('') + (list.length > 500 ? '<div class="muted small pad">Showing 500 of ' + list.length + ' — narrow the search.</div>' : '') : '<div class="empty">No cases match.</div>';
    el('pickerCount').textContent = sel.size + ' selected · ' + list.length + ' shown';
    el('pickerList').querySelectorAll('[data-pick]').forEach((cb) => { cb.onchange = () => { const id = cb.getAttribute('data-pick'); if (cb.checked) { sel.add(id); if (!order.includes(id)) order.push(id); } else sel.delete(id); el('pickerCount').textContent = sel.size + ' selected · ' + list.length + ' shown'; }; });
  };
  el('pickerCat').onchange = () => { cat = el('pickerCat').value; draw(); };
  el('pickerSearch').oninput = () => { q = el('pickerSearch').value.trim().toLowerCase(); draw(); };
  el('pickerHide').onchange = () => { hidePlaceholders = el('pickerHide').checked; draw(); };
  el('pickerAll').onclick = () => { visible().forEach((c) => { sel.add(c.id); if (!order.includes(c.id)) order.push(c.id); }); draw(); };
  el('pickerNone').onclick = () => { visible().forEach((c) => sel.delete(c.id)); draw(); };
  el('pickerCancel').onclick = () => dlg.close();
  el('pickerApply').onclick = async () => {
    el('pickerApply').disabled = true;
    try { await onApply(order.filter((id) => sel.has(id))); dlg.close(); } catch (e) { toast('Save failed: ' + e.message); } finally { el('pickerApply').disabled = false; }
  };
  draw();
  dlg.showModal();
  el('pickerSearch').focus();
}

async function reloadSuites() {
  const [su, mem] = await Promise.all([api('/api/v1/suites'), api('/api/v1/test-case-suites')]);
  state.suites = su.data || []; state.membership = mem.data || [];
  renderSideNav();
}

// ---------------------------------------------------------------- audit
async function loadAudit() {
  try {
    const d = (await api('/api/v1/catalog-audit')).data;
    state.audit = { ...d, placeholderIds: new Set([...d.placeholders, ...d.stale].map((p) => p.id)) };
  } catch { state.audit = null; }
}
function renderAuditView() {
  el('viewTitle').textContent = 'Catalog audit';
  const a = state.audit;
  if (!a) { el('content').innerHTML = '<div class="empty">Audit unavailable.</div>'; return; }
  const kinds = { 'sit-file': 'SIT case files', 'named-script': 'Named scripts', steps: 'Step scripts', performance: 'Load profiles', placeholder: 'Placeholders (no script)', 'stale-sit': 'Stale SIT imports' };
  const table = (rows) => '<div class="table-wrap"><table><thead><tr><th>Test case</th><th>Type</th><th>Seeded by</th><th>Why it is not real</th></tr></thead><tbody>' +
    rows.map((r) => '<tr><td>' + caseLink(r.id, r.name) + '<div class="key small">' + esc(r.key) + '</div></td><td>' + esc(r.test_type) + '</td><td class="small">' + esc(r.created_by || '—') + '</td><td class="small">' + esc(r.reason) + '</td></tr>').join('') + '</tbody></table></div>';
  el('content').innerHTML = '<div class="kpi-grid">' + kpi('All cases', a.total) + kpi('Executable', a.executable, 'real code or config behind them', 'green') +
    kpi('Placeholders', a.placeholders.length, 'no script — blocked when run', a.placeholders.length ? 'red' : 'green') + kpi('Stale SIT', a.stale.length, 'file or test gone', a.stale.length ? 'amber' : 'green') + '</div>' +
    '<div class="card"><div class="card-head"><h2>By definition kind</h2></div><dl class="kv pad">' + Object.entries(a.by_kind).map(([k, n]) => '<dt>' + esc(kinds[k] || k) + '</dt><dd>' + esc(n) + '</dd>').join('') + '</dl></div>' +
    '<div class="card"><div class="card-head"><h2>Placeholder cases</h2><span class="muted small">Catalog entries with nothing behind them. Runs now report them as blocked instead of a fake pass.</span></div>' + (a.placeholders.length ? table(a.placeholders) : '<div class="empty">None.</div>') + '</div>' +
    (a.stale.length ? '<div class="card"><div class="card-head"><h2>Stale SIT imports</h2></div>' + table(a.stale) + '</div>' : '');
}
