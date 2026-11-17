/* Security menu for the unified shell: Security scans (latest scan, trend, history)
 * and Vulnerabilities (the findings register with open / accepted / fixed status).
 * Loaded after scheduler.js; wraps whatever TE_EXT is already registered so the
 * Scheduler and Defects views keep working. Uses app.js globals (api, esc, el, toast,
 * state, navItem). Reports arrive from a project's scanner through
 * POST /api/v1/security-scans (Sand Bench: scripts/security/scan.mjs in the commit gate). */
(function () {
  const VIEWS = { security: 'Security scans', 'security-findings': 'Vulnerabilities' };
  const REFRESH_MS = 20000;
  const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
  const s = { overview: null, at: 0, project: null, findings: null, findingsAt: 0, statusFilter: 'active', severityFilter: '' };

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  function ago(iso) {
    if (!iso) return '—';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    if (mins < 1440) return Math.round(mins / 60) + ' h ago';
    return Math.round(mins / 1440) + ' d ago';
  }
  const sev = (v) => '<span class="badge sev-' + esc(v) + '">' + esc(v) + '</span>';
  const st = (v) => '<span class="badge st-' + esc(v) + '">' + esc(String(v).replace(/_/g, ' ')) + '</span>';
  const pill = (label, tone) => '<span class="badge st-' + esc(tone) + '">' + esc(label) + '</span>';
  const TOOL_TONE = { ok: 'verified', unavailable: 'none', error: 'error' };
  const RESULT_TONE = { passed: 'verified', failed: 'open', error: 'error' };
  const qs = () => (s.project ? '?project=' + encodeURIComponent(s.project) : '');

  async function loadOverview(force) {
    if (!force && s.overview && Date.now() - s.at < REFRESH_MS) return s.overview;
    s.overview = (await api('/api/v1/security/overview' + qs())).data;
    s.project = s.overview.project;
    s.at = Date.now();
    return s.overview;
  }

  function projectPicker(o) {
    if (!o.projects || o.projects.length < 2) return '<span class="muted small">Project: <strong>' + esc(o.project || '—') + '</strong></span>';
    return '<label class="muted small">Project <select id="secProject">' + o.projects.map((p) =>
      '<option value="' + esc(p) + '"' + (p === o.project ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select></label>';
  }

  function bindProject(rerender) {
    const pick = el('secProject');
    if (pick) pick.onchange = () => { s.project = pick.value; s.overview = null; s.findings = null; rerender(); };
  }

  function trendSvg(points) {
    if (!points.length) return '';
    const w = 520, h = 90, pad = 6;
    const max = Math.max(1, ...points.map((p) => p.new_count + p.accepted_count));
    const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
    const y = (v) => h - pad - (v / max) * (h - pad * 2);
    const line = (key) => points.map((p, i) => (i ? 'L' : 'M') + (pad + i * step).toFixed(1) + ' ' + y(p[key]).toFixed(1)).join(' ');
    const dots = points.map((p, i) => '<circle cx="' + (pad + i * step).toFixed(1) + '" cy="' + y(p.new_count).toFixed(1) + '" r="3" fill="' +
      (p.result === 'passed' ? 'var(--green)' : 'var(--red)') + '"><title>' + esc(p.key + ' · ' + p.result + ' · ' + p.new_count + ' new, ' + p.accepted_count + ' accepted') + '</title></circle>').join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" role="img" aria-label="Findings per scan, oldest to newest">' +
      '<path d="' + line('accepted_count') + '" fill="none" stroke="var(--muted2)" stroke-width="1.5" stroke-dasharray="4 3"/>' +
      '<path d="' + line('new_count') + '" fill="none" stroke="var(--gold)" stroke-width="2"/>' + dots + '</svg>' +
      '<div class="muted small">Gold: new (unaccepted) findings per scan · dashed: accepted in the baseline · dot colour: scan result.</div>';
  }

  async function renderScans() {
    el('viewTitle').textContent = 'Security scans';
    const content = el('content');
    let o;
    try { o = await loadOverview(); } catch (e) {
      content.innerHTML = '<div class="empty">Security scans unavailable: ' + esc(e.message) + '</div>';
      return;
    }
    if (state.view !== 'security') return;
    if (!o.latest) {
      content.innerHTML = '<div class="card"><div class="card-head"><h2>No security scan yet</h2></div><div class="form-body"><p>A project reports here by posting its scan to <code>POST /api/v1/security-scans</code>. In Sand Bench the commit gate does this on every commit, or run <code>npm run security:scan</code>.</p></div></div>';
      return;
    }
    const l = o.latest;
    const r = o.register;
    const history = await api('/api/v1/security-scans' + (qs() ? qs() + '&' : '?') + 'limit=25').then((b) => b.data).catch(() => []);
    if (state.view !== 'security') return;
    const toolRows = (l.tools || []).map((t) => '<tr><td>' + esc(t.name) + '</td><td>' + pill(t.status, TOOL_TONE[t.status] || 'error') + '</td><td>' + esc(t.findings) + '</td><td class="small muted">' + esc(t.detail || '') + '</td><td class="small">' + (t.ms != null ? esc(Math.round(t.ms / 100) / 10) + ' s' : '—') + '</td></tr>').join('');
    const historyRows = history.map((h) => '<tr><td><button class="case-name" data-scan="' + esc(h.key) + '">' + esc(h.key) + '</button></td><td>' + pill(h.result, RESULT_TONE[h.result] || 'error') + '</td>' +
      '<td class="mono small">' + esc(h.commit_sha || '') + (h.dirty ? ' <span class="muted">(uncommitted changes)</span>' : '') + '</td><td class="small">' + esc(h.branch || '') + '</td><td class="small">' + esc(h.trigger) + '</td>' +
      '<td>' + esc(h.new_count) + '</td><td>' + esc(h.accepted_count) + '</td><td>' + (h.blocking_count ? '<span class="bad-text">' + esc(h.blocking_count) + '</span>' : '0') + '</td><td class="small">' + esc(fmt(h.finished_at)) + '</td></tr>').join('');
    const openBySev = SEV_ORDER.map((k) => '<span class="badge sev-' + k + '">' + k + ' ' + esc(r.open[k] || 0) + '</span>').join(' ');
    content.innerHTML = '<div class="toolbar">' + projectPicker(o) + '<span class="muted small">' + esc(o.scans) + ' scans reported</span></div>' +
      '<div class="kpi-grid">' +
      '<div class="kpi"><div class="kpi-label">Last scan</div><div class="kpi-value ' + (l.result === 'passed' ? 'green' : 'red') + '" id="secLastResult">' + esc(l.result) + '</div><div class="kpi-sub">' + esc(ago(l.finished_at)) + ' · ' + esc(fmt(l.finished_at)) + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Open vulnerabilities</div><div class="kpi-value ' + (r.openTotal ? 'red' : 'green') + '" id="secOpenTotal">' + esc(r.openTotal) + '</div><div class="kpi-sub">' + openBySev + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Accepted (baseline)</div><div class="kpi-value amber">' + esc(r.accepted) + '</div><div class="kpi-sub">reviewed, each with a reason</div></div>' +
      '<div class="kpi"><div class="kpi-label">Fixed</div><div class="kpi-value green">' + esc(r.fixed) + '</div><div class="kpi-sub">' + esc(r.fixedLast30Days) + ' in the last 30 days</div></div></div>' +
      '<div class="card"><div class="card-head"><h2>Latest scan ' + esc(l.key) + '</h2><button class="btn" data-scan="' + esc(l.key) + '">Open findings</button></div>' +
      '<div class="form-body"><dl class="kv"><dt>Commit</dt><dd class="mono">' + esc(l.commit_sha || '—') + ' on ' + esc(l.branch || '—') + (l.dirty ? ' (with uncommitted changes)' : '') + '</dd>' +
      '<dt>Trigger</dt><dd>' + esc(l.trigger) + '</dd><dt>Blocks at</dt><dd>' + esc(l.fail_on) + ' and above, new findings only</dd>' +
      '<dt>Findings</dt><dd>' + esc(l.total) + ' (' + esc(l.new_count) + ' new, ' + esc(l.accepted_count) + ' accepted, ' + esc(l.blocking_count) + ' blocking)</dd><dt>Duration</dt><dd>' + esc(Math.round((l.duration_ms || 0) / 1000)) + ' s</dd></dl>' +
      trendSvg(o.trend || []) + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Check</th><th>Status</th><th>Findings</th><th>Detail</th><th>Time</th></tr></thead><tbody>' + toolRows + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-head"><h2>Scan history</h2></div><div class="table-wrap"><table><thead><tr><th>Scan</th><th>Result</th><th>Commit</th><th>Branch</th><th>Trigger</th><th>New</th><th>Accepted</th><th>Blocking</th><th>Finished</th></tr></thead><tbody>' +
      (historyRows || '<tr><td colspan="9" class="empty">No scans.</td></tr>') + '</tbody></table></div></div>';
    bindProject(renderScans);
    content.querySelectorAll('[data-scan]').forEach((b) => { b.onclick = () => openScan(b.getAttribute('data-scan')); });
  }

  function findingRow(f) {
    return '<tr><td>' + sev(f.severity) + '</td><td>' + st(f.status) + (f.reopen_count ? ' <span class="bad-text small" title="Came back after being fixed">reopened ×' + esc(f.reopen_count) + '</span>' : '') + '</td>' +
      '<td><button class="case-name" data-finding="' + esc(f.fingerprint) + '">' + esc(f.title) + '</button><div class="key">' + esc(f.rule) + '</div></td>' +
      '<td class="small mono">' + esc(f.file || '') + (f.line ? ':' + esc(f.line) : '') + '</td><td class="small">' + esc(f.category) + '</td>' +
      '<td class="small">' + esc(fmt(f.first_seen)) + '</td><td class="small">' + esc(f.status === 'fixed' ? 'fixed ' + fmt(f.fixed_at) : fmt(f.last_seen)) + '</td></tr>';
  }

  const STATUS_FILTERS = { active: 'open,accepted', open: 'open', accepted: 'accepted', fixed: 'fixed', all: '' };

  async function renderFindings() {
    el('viewTitle').textContent = 'Vulnerabilities';
    const content = el('content');
    let o;
    try {
      o = await loadOverview();
      if (!s.findings || Date.now() - s.findingsAt > REFRESH_MS) {
        const params = new URLSearchParams();
        if (s.project) params.set('project', s.project);
        if (STATUS_FILTERS[s.statusFilter]) params.set('status', STATUS_FILTERS[s.statusFilter]);
        if (s.severityFilter) params.set('severity', s.severityFilter);
        s.findings = (await api('/api/v1/security-findings?' + params.toString())).data;
        s.findingsAt = Date.now();
      }
    } catch (e) {
      content.innerHTML = '<div class="empty">Vulnerabilities unavailable: ' + esc(e.message) + '</div>';
      return;
    }
    if (state.view !== 'security-findings') return;
    const rows = s.findings.map(findingRow).join('');
    content.innerHTML = '<div class="toolbar">' + projectPicker(o) + '<span class="muted small">Last scan ' + esc(o.latest ? ago(o.latest.finished_at) + ' (' + o.latest.result + ')' : 'never') + '</span></div>' +
      '<div class="card"><div class="card-head"><h2>Vulnerability register</h2><div class="seg" role="group" aria-label="Filter by status">' +
      Object.keys(STATUS_FILTERS).map((f) => '<button class="btn' + (s.statusFilter === f ? ' primary' : '') + '" data-sfilter="' + f + '">' + f[0].toUpperCase() + f.slice(1) + '</button>').join('') +
      '</div></div><div class="toolbar"><label class="muted small">Severity <select id="secSeverity"><option value="">All</option>' +
      SEV_ORDER.map((k) => '<option value="' + k + '"' + (s.severityFilter === k ? ' selected' : '') + '>' + k + '</option>').join('') +
      '</select></label><span class="muted small">Open: seen in the latest scan and not accepted. Accepted: reviewed with a recorded reason. Fixed: a later scan of that check no longer finds it.</span></div>' +
      '<div class="table-wrap"><table id="secFindings"><thead><tr><th>Severity</th><th>Status</th><th>Finding</th><th>Where</th><th>Category</th><th>First seen</th><th>Last seen / fixed</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="empty">Nothing in this view.</td></tr>') + '</tbody></table></div></div>';
    bindProject(renderFindings);
    content.querySelectorAll('[data-sfilter]').forEach((b) => { b.onclick = () => { s.statusFilter = b.getAttribute('data-sfilter'); s.findings = null; renderFindings(); }; });
    const sevSel = el('secSeverity');
    if (sevSel) sevSel.onchange = () => { s.severityFilter = sevSel.value; s.findings = null; renderFindings(); };
    content.querySelectorAll('[data-finding]').forEach((b) => {
      b.onclick = () => openFinding(s.findings.find((f) => f.fingerprint === b.getAttribute('data-finding')));
    });
  }

  function openFinding(f) {
    if (!f) return;
    el('detailTitle').textContent = f.title;
    el('detailBody').innerHTML = '<dl class="kv"><dt>Status</dt><dd>' + st(f.status) + '</dd><dt>Severity</dt><dd>' + sev(f.severity) + '</dd>' +
      '<dt>Rule</dt><dd class="mono">' + esc(f.rule) + '</dd><dt>Where</dt><dd class="mono">' + esc(f.file || '—') + (f.line ? ':' + esc(f.line) : '') + '</dd>' +
      '<dt>First seen</dt><dd>' + esc(fmt(f.first_seen)) + ' in ' + esc(f.first_seen_scan_key || '—') + '</dd><dt>Last seen</dt><dd>' + esc(fmt(f.last_seen)) + ' in ' + esc(f.last_seen_scan_key || '—') + '</dd>' +
      (f.status === 'fixed' ? '<dt>Fixed</dt><dd>' + esc(fmt(f.fixed_at)) + ' in ' + esc(f.fixed_scan_key || '—') + '</dd>' : '') +
      '<dt>Seen</dt><dd>' + esc(f.occurrences) + ' scan(s)' + (f.reopen_count ? ', reopened ' + esc(f.reopen_count) + '×' : '') + '</dd>' +
      (f.accepted_reason ? '<dt>Accepted because</dt><dd>' + esc(f.accepted_reason) + '</dd>' : '') +
      (f.reference ? '<dt>Reference</dt><dd>' + esc(f.reference) + '</dd>' : '') +
      (f.url ? '<dt>Advisory</dt><dd><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.url) + '</a></dd>' : '') +
      '<dt>Fingerprint</dt><dd class="mono">' + esc(f.fingerprint) + '</dd></dl><pre class="defect-msg">' + esc(f.detail || '') + '</pre>';
    el('detail').showModal();
  }

  async function openScan(key) {
    try {
      const scan = (await api('/api/v1/security-scans/' + encodeURIComponent(key))).data;
      const blocking = new Set(scan.blocking || []);
      const list = (scan.findings || []).slice().sort((a, b) =>
        (a.status === b.status ? 0 : a.status === 'new' ? -1 : 1) || SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
      el('detailTitle').textContent = scan.key + ' · ' + scan.result;
      el('detailBody').innerHTML = '<p class="muted small">' + esc(fmt(scan.finished_at)) + ' · commit ' + esc(scan.commit_sha || '—') + ' · ' + esc(list.length) + ' findings</p>' +
        (list.map((f) => '<div class="defect"><div class="defect-head">' + sev(f.severity) + ' ' + (f.status === 'accepted' ? pill('accepted', 'accepted') : blocking.has(f.fingerprint) ? pill('blocking', 'open') : pill('new', 'fixing')) +
          ' <strong>' + esc(f.title) + '</strong></div><div class="muted small mono">' + esc(f.file || '') + (f.line ? ':' + esc(f.line) : '') + ' · ' + esc(f.rule) + '</div>' +
          '<pre class="defect-msg">' + esc(f.detail || '') + (f.acceptedReason ? '\n\nAccepted: ' + esc(f.acceptedReason) : '') + '</pre></div>').join('') || '<p>No findings.</p>');
      el('detail').showModal();
    } catch (e) {
      toast(e.message);
    }
  }

  const prev = window.TE_EXT;
  window.TE_EXT = {
    owns: (v) => Object.prototype.hasOwnProperty.call(VIEWS, v) || Boolean(prev && prev.owns(v)),
    nav: (navItem) => {
      const o = s.overview;
      const open = o && o.register ? o.register.openTotal : null;
      const failed = o && o.latest && o.latest.result !== 'passed';
      return (prev ? prev.nav(navItem) : '') + '<div class="nav-section">Security</div>' +
        navItem('security', null, 'Security scans', null, o && o.latest ? (failed ? 'red' : 'green') : null) +
        navItem('security-findings', null, 'Vulnerabilities', open || null, open ? 'red' : null);
    },
    render: (v) => (v === 'security' ? renderScans() : v === 'security-findings' ? renderFindings() : prev && prev.render(v)),
  };
  // Fill the nav badges once, without blocking the first paint.
  loadOverview(true).then(() => { if (typeof renderSideNav === 'function') renderSideNav(); }).catch(() => {});
})();
