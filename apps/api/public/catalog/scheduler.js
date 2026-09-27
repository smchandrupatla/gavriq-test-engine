/* Scheduler + Defects views for the unified shell.
 * Loaded after app.js; uses its globals (api, esc, el, toast, badge, state, navItem).
 * app.js asks TE_EXT for nav items, routes and rendering of the views it owns. */
(function () {
  const VIEWS = { scheduler: 'Scheduler', defects: 'Defects' };
  const REFRESH_MS = 15000;
  const browserTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();
  const COMMON_TZ = ['UTC', 'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'America/New_York', 'America/Chicago', 'America/Los_Angeles'];

  const s = {
    options: null, plan: null, fetchedAt: 0, horizon: 168,
    runNow: { scope: 'all', types: new Set(), suites: new Set(), suiteFilter: '' },
    previewSeq: 0, reports: null, reportFilter: 'active', reportsAt: 0,
  };

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayLabel = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  function relative(iso) {
    if (!iso) return '—';
    const diff = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(diff);
    const unit = abs < 3600e3 ? [Math.round(abs / 60e3), 'min'] : abs < 86400e3 ? [Math.round(abs / 3600e3), 'h'] : [Math.round(abs / 86400e3), 'd'];
    return diff >= 0 ? `in ${unit[0]} ${unit[1]}` : `${unit[0]} ${unit[1]} ago`;
  }
  const pill = (status) => '<span class="badge st-' + esc(String(status || 'none').toLowerCase()) + '">' + esc(String(status || '—').replace(/_/g, ' ')) + '</span>';

  // ---------------------------------------------------------------------------
  // Target picker (shared by Run now and the schedule dialog)
  // ---------------------------------------------------------------------------
  function pickerHtml(prefix, target) {
    const t = target || { scope: 'all' };
    const types = new Set(t.types || []);
    const suites = new Set(t.suite_ids || []);
    const o = s.options || { types: [], suites: [] };
    const scopes = [['all', 'All tests'], ['types', 'Test types'], ['suites', 'Suites']];
    if (t.scope === 'cases') scopes.push(['cases', 'Selected cases']);
    let h = '<div class="seg" role="radiogroup" aria-label="What to run">' + scopes.map(([v, l]) =>
      '<label class="seg-item"><input type="radio" name="' + prefix + '-scope" value="' + v + '"' + (t.scope === v ? ' checked' : '') + '> ' + esc(l) + '</label>').join('') + '</div>';
    h += '<div class="pick-panel" data-panel="types"' + (t.scope === 'types' ? '' : ' hidden') + '><div class="chips">' +
      (o.types.map((ty) => '<label class="chip"><input type="checkbox" data-' + prefix + '-type="' + esc(ty.id) + '"' + (types.has(ty.id) ? ' checked' : '') + '> ' + esc(ty.title) + ' <span class="muted small">' + ty.cases + '</span></label>').join('') || '<span class="muted small">No test types found.</span>') + '</div></div>';
    h += '<div class="pick-panel" data-panel="suites"' + (t.scope === 'suites' ? '' : ' hidden') + '><input type="search" class="suite-filter" data-' + prefix + '-filter placeholder="Filter suites…" aria-label="Filter suites"><div class="suite-checks">' +
      (o.suites.map((su) => '<label class="suite-check" data-name="' + esc(String(su.name || su.key).toLowerCase()) + '"><input type="checkbox" data-' + prefix + '-suite="' + esc(su.id) + '"' + (suites.has(su.id) ? ' checked' : '') + '> ' + esc(su.name || su.key) + ' <span class="muted small">' + su.cases + ' cases</span></label>').join('') || '<span class="muted small">No suites.</span>') + '</div></div>';
    if (t.scope === 'cases') h += '<div class="pick-panel" data-panel="cases"><span class="muted small">' + (t.case_ids || []).length + ' cases chosen when this schedule was created.</span></div>';
    return h;
  }

  function readPicker(root, prefix, fallback) {
    const scope = (root.querySelector('input[name="' + prefix + '-scope"]:checked') || {}).value || 'all';
    if (scope === 'types') return { scope, types: [...root.querySelectorAll('[data-' + prefix + '-type]:checked')].map((c) => c.getAttribute('data-' + prefix + '-type')) };
    if (scope === 'suites') return { scope, suite_ids: [...root.querySelectorAll('[data-' + prefix + '-suite]:checked')].map((c) => c.getAttribute('data-' + prefix + '-suite')) };
    if (scope === 'cases') return fallback && fallback.scope === 'cases' ? fallback : { scope: 'all' };
    return { scope: 'all' };
  }

  function bindPicker(root, prefix, onChange) {
    root.querySelectorAll('input[name="' + prefix + '-scope"]').forEach((r) => {
      r.onchange = () => {
        root.querySelectorAll('.pick-panel').forEach((p) => { p.hidden = p.getAttribute('data-panel') !== r.value; });
        onChange();
      };
    });
    root.querySelectorAll('[data-' + prefix + '-type],[data-' + prefix + '-suite]').forEach((c) => { c.onchange = onChange; });
    const f = root.querySelector('[data-' + prefix + '-filter]');
    if (f) f.oninput = () => {
      const q = f.value.trim().toLowerCase();
      root.querySelectorAll('.suite-check').forEach((l) => { l.hidden = q && !l.getAttribute('data-name').includes(q); });
    };
  }

  function envOptions(selected) {
    return (state.environments || []).map((e) => '<option value="' + esc(e.id) + '"' + (e.id === (selected || state.envId) ? ' selected' : '') + '>' + esc(e.name || e.key) + '</option>').join('') || '<option value="">Default</option>';
  }

  // ---------------------------------------------------------------------------
  // Scheduler view
  // ---------------------------------------------------------------------------
  async function loadScheduler(force) {
    if (!force && s.plan && Date.now() - s.fetchedAt < REFRESH_MS) return;
    const [plan, options] = await Promise.all([
      api('/api/v1/scheduler/plan?hours=' + s.horizon),
      s.options && !force ? Promise.resolve({ data: s.options }) : api('/api/v1/scheduler/options'),
    ]);
    s.plan = plan.data;
    s.options = options.data;
    s.fetchedAt = Date.now();
  }

  function kpisHtml() {
    const p = s.plan;
    const active = p.schedules.filter((x) => x.enabled).length;
    const next = p.upcoming[0];
    const day = Date.now() - 86400e3;
    const recent = p.recent.filter((r) => new Date(r.fired_at).getTime() >= day);
    const d = p.defects || {};
    return '<div class="kpi-grid">' +
      '<div class="kpi"><div class="kpi-label">Active schedules</div><div class="kpi-value">' + active + '</div><div class="kpi-sub">' + (p.schedules.length - active) + ' paused</div></div>' +
      '<div class="kpi"><div class="kpi-label">Next run</div><div class="kpi-value amber">' + esc(next ? relative(next.at) : '—') + '</div><div class="kpi-sub">' + esc(next ? next.name + ' · ' + fmt(next.at) : 'Nothing scheduled') + '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Runs, last 24 h</div><div class="kpi-value">' + recent.length + '</div><div class="kpi-sub">' + recent.filter((r) => r.outcome !== 'queued').length + ' skipped</div></div>' +
      '<div class="kpi"><a href="#/defects" class="kpi-link"><div class="kpi-label">Defects awaiting PM</div><div class="kpi-value ' + ((d.awaiting_pm || 0) ? 'red' : 'green') + '">' + (d.awaiting_pm ?? '—') + '</div><div class="kpi-sub">' + (d.in_fix ?? 0) + ' in fix · ' + (d.rerunning ?? 0) + ' rerunning</div></a></div>' +
      '</div>';
  }

  function runNowHtml() {
    const r = s.runNow;
    const target = r.scope === 'types' ? { scope: 'types', types: [...r.types] } : r.scope === 'suites' ? { scope: 'suites', suite_ids: [...r.suites] } : { scope: 'all' };
    return '<div class="card" id="schRunNow"><div class="card-head"><h2>Run now</h2><span class="muted small">On demand, queued for the next free worker</span></div>' +
      '<div class="form-body">' + pickerHtml('rn', target) +
      '<div class="form-row"><label>Environment <select id="rnEnv">' + envOptions() + '</select></label>' +
      '<span class="muted small" id="rnPreview" aria-live="polite"></span>' +
      '<button class="btn primary" id="rnGo">Run</button></div></div></div>';
  }

  function schedulesHtml() {
    const rows = s.plan.schedules.map((x) => {
      const last = x.last_run_at ? fmt(x.last_run_at) + ' ' + pill(x.last_outcome) + (x.last_execution_key ? ' <span class="key">' + esc(x.last_execution_key) + '</span> ' + badge({ status: x.last_execution_status }) : '') : '<span class="muted">Never</span>';
      const when = x.cron_expression ? esc(x.cron_description || x.cron_expression) + '<div class="key">' + esc(x.cron_expression) + ' · ' + esc(x.timezone) + '</div>' : 'On event <span class="key">' + esc(x.event_trigger) + '</span>';
      return '<tr><td><strong>' + esc(x.name) + '</strong>' + (x.description ? '<div class="muted small">' + esc(x.description) + '</div>' : '') + '</td>' +
        '<td>' + esc(x.target_description) + '</td><td>' + when + '</td>' +
        '<td>' + (x.enabled ? (x.next_run_at ? esc(fmt(x.next_run_at)) + '<div class="muted small">' + esc(relative(x.next_run_at)) + '</div>' : '—') : '<span class="badge st-paused">paused</span>') + '</td>' +
        '<td class="small">' + last + '</td>' +
        '<td class="row-actions"><button class="btn" data-sch-run="' + esc(x.id) + '">Run now</button>' +
        '<button class="btn" data-sch-toggle="' + esc(x.id) + '" data-enabled="' + (x.enabled ? '1' : '') + '">' + (x.enabled ? 'Pause' : 'Resume') + '</button>' +
        '<button class="btn" data-sch-edit="' + esc(x.id) + '">Edit</button>' +
        '<button class="btn danger" data-sch-del="' + esc(x.id) + '" aria-label="Delete ' + esc(x.name) + '">Delete</button></td></tr>';
    }).join('');
    return '<div class="card" id="schList"><div class="card-head"><h2>Schedules</h2><button class="btn primary" id="schNew">New schedule</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Runs</th><th>When</th><th>Next</th><th>Last run</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6" class="empty">No schedules yet. Create one to run tests on a timetable.</td></tr>') + '</tbody></table></div></div>';
  }

  function planHtml() {
    const p = s.plan;
    const groups = new Map();
    for (const u of p.upcoming) {
      const k = new Date(u.at).toDateString();
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(u);
    }
    let up = '';
    for (const [, list] of groups) {
      up += '<div class="plan-day"><div class="plan-day-head">' + esc(dayLabel(list[0].at)) + ' <span class="muted small">' + list.length + ' run' + (list.length === 1 ? '' : 's') + '</span></div>' +
        list.slice(0, 40).map((u) => '<div class="plan-item"><span class="plan-time">' + esc(time(u.at)) + '</span><span class="plan-name">' + esc(u.name) + '</span><span class="muted small">' + esc(u.target_description) + '</span></div>').join('') +
        (list.length > 40 ? '<div class="muted small plan-more">+' + (list.length - 40) + ' more</div>' : '') + '</div>';
    }
    const recent = p.recent.map((r) => '<tr><td class="small">' + esc(fmt(r.fired_at)) + '</td><td>' + esc(r.schedule_name || (r.trigger === 'manual' ? 'Run now' : 'Deleted schedule')) + '<div class="muted small">' + esc(r.trigger) + (r.requested_by ? ' · ' + esc(r.requested_by) : '') + '</div></td>' +
      '<td class="small">' + esc(r.case_count) + '</td><td>' + pill(r.outcome) + (r.message ? '<div class="muted small">' + esc(r.message) + '</div>' : '') + '</td>' +
      '<td>' + (r.execution_key ? '<span class="key">' + esc(r.execution_key) + '</span> ' + badge({ status: r.execution_status }) : '—') + '</td>' +
      '<td class="small">' + (r.execution_key ? '<span class="ok-text">' + esc(r.passed) + ' passed</span> · <span class="bad-text">' + esc(r.failed) + ' failed</span>' : '') + '</td></tr>').join('');
    const horizons = [[24, '24 h'], [168, '7 days'], [720, '30 days']];
    return '<div class="card" id="schPlan"><div class="card-head"><h2>Execution plan</h2><div class="seg" role="group" aria-label="Plan horizon">' +
      horizons.map(([h, l]) => '<button class="btn' + (s.horizon === h ? ' primary' : '') + '" data-horizon="' + h + '">' + l + '</button>').join('') +
      '</div><span class="muted small">Updated ' + esc(time(p.now)) + ' · ' + (p.ticker.running ? 'scheduler running' : 'scheduler ticker off') + '</span></div>' +
      '<div class="plan-grid"><div class="plan-upcoming"><h3 class="plan-h">Upcoming</h3>' + (up || '<div class="empty small">Nothing scheduled in this window.</div>') + '</div>' +
      '<div class="plan-recent"><h3 class="plan-h">Recent runs</h3><div class="table-wrap"><table><thead><tr><th>Fired</th><th>By</th><th>Cases</th><th>Outcome</th><th>Execution</th><th>Result</th></tr></thead><tbody>' +
      (recent || '<tr><td colspan="6" class="empty">No runs yet.</td></tr>') + '</tbody></table></div></div></div></div>';
  }

  function paintData() {
    const content = el('content');
    const k = content.querySelector('#schKpis');
    if (k) k.innerHTML = kpisHtml();
    const l = content.querySelector('#schListWrap');
    if (l) { l.innerHTML = schedulesHtml(); bindList(); }
    const p = content.querySelector('#schPlanWrap');
    if (p) { p.innerHTML = planHtml(); bindPlan(); }
  }

  async function renderScheduler() {
    el('viewTitle').textContent = 'Scheduler';
    const content = el('content');
    const mounted = content.querySelector('#schRoot');
    try {
      await loadScheduler(false);
    } catch (e) {
      if (!mounted) content.innerHTML = '<div class="empty">Scheduler unavailable: ' + esc(e.message) + '</div>';
      return;
    }
    if (state.view !== 'scheduler') return;
    if (mounted) { paintData(); return; } // periodic refresh: keep the Run now form as the user left it
    content.innerHTML = '<div id="schRoot"><div id="schKpis"></div>' + runNowHtml() + '<div id="schListWrap"></div><div id="schPlanWrap"></div></div>';
    paintData();
    bindRunNow();
  }

  function currentRunNowTarget() {
    return readPicker(el('schRunNow'), 'rn');
  }

  async function updatePreview() {
    const target = currentRunNowTarget();
    const r = s.runNow;
    r.scope = target.scope;
    r.types = new Set(target.types || []);
    r.suites = new Set(target.suite_ids || []);
    const out = el('rnPreview');
    const go = el('rnGo');
    if ((target.scope === 'types' && !target.types.length) || (target.scope === 'suites' && !target.suite_ids.length)) {
      out.textContent = 'Pick at least one.';
      go.disabled = true;
      return;
    }
    const seq = ++s.previewSeq;
    out.textContent = 'Counting…';
    try {
      const res = await api('/api/v1/scheduler/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target }) });
      if (seq !== s.previewSeq) return;
      const n = res.data.case_count;
      out.textContent = n + ' test case' + (n === 1 ? '' : 's') + ' will run';
      go.disabled = !n;
    } catch (e) {
      if (seq === s.previewSeq) { out.textContent = e.message; go.disabled = true; }
    }
  }

  function bindRunNow() {
    const root = el('schRunNow');
    bindPicker(root, 'rn', updatePreview);
    updatePreview();
    el('rnGo').onclick = async () => {
      const btn = el('rnGo');
      btn.disabled = true;
      try {
        const res = await api('/api/v1/scheduler/run-now', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ target: currentRunNowTarget(), environment_id: el('rnEnv').value || null }),
        });
        const d = res.data;
        toast('Queued ' + d.case_count + ' cases — ' + d.execution.key);
        if (typeof trackExecution === 'function') trackExecution(d.execution.id, d.execution.key, d.case_count);
        await loadScheduler(true);
        paintData();
      } catch (e) {
        toast('Run failed: ' + e.message);
      } finally {
        btn.disabled = false;
      }
    };
  }

  function bindList() {
    const c = el('content');
    const nb = c.querySelector('#schNew');
    if (nb) nb.onclick = () => openScheduleDialog(null);
    c.querySelectorAll('[data-sch-run]').forEach((b) => { b.onclick = () => act(b, async () => {
      const res = await api('/api/v1/schedules/' + encodeURIComponent(b.getAttribute('data-sch-run')) + '/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const d = res.data || {};
      toast(d.outcome === 'queued' ? 'Queued ' + d.case_count + ' cases — ' + d.key : 'Not run: ' + String(d.outcome || '').replace(/_/g, ' '));
      if (d.outcome === 'queued' && typeof trackExecution === 'function') trackExecution(d.id, d.key, d.case_count);
    }); });
    c.querySelectorAll('[data-sch-toggle]').forEach((b) => { b.onclick = () => act(b, () =>
      api('/api/v1/schedules/' + encodeURIComponent(b.getAttribute('data-sch-toggle')), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: !b.getAttribute('data-enabled') }) })); });
    c.querySelectorAll('[data-sch-edit]').forEach((b) => { b.onclick = () => openScheduleDialog(s.plan.schedules.find((x) => x.id === b.getAttribute('data-sch-edit'))); });
    c.querySelectorAll('[data-sch-del]').forEach((b) => { b.onclick = () => {
      const x = s.plan.schedules.find((y) => y.id === b.getAttribute('data-sch-del'));
      if (!x || !confirm('Delete schedule "' + x.name + '"? Its run history stays in the plan.')) return;
      act(b, () => api('/api/v1/schedules/' + encodeURIComponent(x.id), { method: 'DELETE' }).catch((e) => { if (!/HTTP 204/.test(e.message)) throw e; }));
    }; });
  }

  async function act(btn, fn) {
    btn.disabled = true;
    try {
      await fn();
      await loadScheduler(true);
      paintData();
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
    }
  }

  function bindPlan() {
    el('content').querySelectorAll('[data-horizon]').forEach((b) => { b.onclick = async () => {
      s.horizon = Number(b.getAttribute('data-horizon'));
      await loadScheduler(true);
      paintData();
    }; });
  }

  // ---------------------------------------------------------------------------
  // Schedule dialog
  // ---------------------------------------------------------------------------
  function openScheduleDialog(x) {
    const presets = (s.options && s.options.presets) || [];
    const tz = x ? x.timezone : browserTz;
    el('detailTitle').textContent = x ? 'Edit schedule' : 'New schedule';
    el('detailBody').innerHTML = '<form id="schForm" class="sch-form" novalidate>' +
      '<label>Name<input name="name" required maxlength="200" value="' + esc(x ? x.name : '') + '" placeholder="Nightly regression"></label>' +
      '<label>Description <span class="muted small">(optional)</span><input name="description" maxlength="1000" value="' + esc(x && x.description || '') + '"></label>' +
      '<fieldset><legend>What to run</legend>' + pickerHtml('sd', x ? x.target : { scope: 'all' }) + '</fieldset>' +
      '<fieldset><legend>When</legend><div class="form-row"><label>Preset <select id="sdPreset"><option value="">Custom…</option>' +
      presets.map((p) => '<option value="' + esc(p.cron) + '"' + (x && x.cron_expression === p.cron ? ' selected' : '') + '>' + esc(p.label) + '</option>').join('') + '</select></label>' +
      '<label>Cron <input name="cron" class="mono" required value="' + esc(x ? x.cron_expression || '' : '0 2 * * *') + '" placeholder="m h dom mon dow" aria-describedby="sdCronHelp"></label>' +
      '<label>Timezone <input name="timezone" list="sdTzList" value="' + esc(tz) + '"></label><datalist id="sdTzList">' +
      [...new Set([browserTz, ...COMMON_TZ])].map((z) => '<option value="' + esc(z) + '">').join('') + '</datalist></div>' +
      '<div id="sdCronHelp" class="cron-help muted small" aria-live="polite"></div></fieldset>' +
      '<div class="form-row"><label>Environment <select name="environment_id">' + envOptions(x && x.environment_id) + '</select></label>' +
      '<label class="inline"><input type="checkbox" name="enabled"' + (!x || x.enabled ? ' checked' : '') + '> Enabled</label></div>' +
      '<div class="form-error" id="sdError" role="alert"></div>' +
      '<div class="form-row end"><button type="button" class="btn" id="sdCancel">Cancel</button><button type="submit" class="btn primary">' + (x ? 'Save' : 'Create schedule') + '</button></div></form>';
    const form = el('schForm');
    bindPicker(form, 'sd', () => {});
    let seq = 0;
    const cronInput = form.elements.namedItem('cron');
    const tzInput = form.elements.namedItem('timezone');
    const help = el('sdCronHelp');
    async function previewCron() {
      const mine = ++seq;
      try {
        const res = await api('/api/v1/scheduler/cron-preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cron_expression: cronInput.value, timezone: tzInput.value, count: 5 }) });
        if (mine !== seq) return;
        help.innerHTML = '<strong>' + esc(res.data.description) + '</strong> · next: ' + res.data.next.map((n) => esc(fmt(n))).join(', ');
        help.classList.remove('bad-text');
      } catch (e) {
        if (mine !== seq) return;
        help.textContent = e.message;
        help.classList.add('bad-text');
      }
    }
    el('sdPreset').onchange = () => { if (el('sdPreset').value) { cronInput.value = el('sdPreset').value; previewCron(); } };
    let debounce;
    cronInput.oninput = tzInput.oninput = () => { clearTimeout(debounce); debounce = setTimeout(previewCron, 250); };
    previewCron();
    el('sdCancel').onclick = () => el('detail').close();
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const f = form.elements;
      const body = {
        name: f.namedItem('name').value.trim(),
        description: f.namedItem('description').value.trim() || null,
        target: readPicker(form, 'sd', x && x.target),
        cron_expression: cronInput.value.trim(),
        timezone: tzInput.value.trim() || browserTz,
        environment_id: f.namedItem('environment_id').value || null,
        enabled: f.namedItem('enabled').checked,
      };
      if (!body.name) { el('sdError').textContent = 'Give the schedule a name.'; return; }
      try {
        await api(x ? '/api/v1/schedules/' + encodeURIComponent(x.id) : '/api/v1/schedules', {
          method: x ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        });
        el('detail').close();
        toast(x ? 'Schedule saved' : 'Schedule created');
        await loadScheduler(true);
        paintData();
      } catch (e) {
        el('sdError').textContent = e.message;
      }
    };
    el('detail').showModal();
  }

  // ---------------------------------------------------------------------------
  // Defects view (read-only: the Sand Bench PM acts on reports through the API)
  // ---------------------------------------------------------------------------
  const FILTERS = { active: 'open,reopened,with_pm,fixing,rerunning', awaiting: 'open,reopened', verified: 'verified', all: '' };

  async function renderDefects() {
    el('viewTitle').textContent = 'Defects';
    const content = el('content');
    try {
      if (!s.reports || Date.now() - s.reportsAt > REFRESH_MS) {
        const [list, ov] = await Promise.all([
          api('/api/v1/defect-reports?limit=100' + (FILTERS[s.reportFilter] ? '&status=' + FILTERS[s.reportFilter] : '')),
          api('/api/v1/defect-manager/overview'),
        ]);
        s.reports = { list: list.data, overview: ov.data };
        s.reportsAt = Date.now();
      }
    } catch (e) {
      content.innerHTML = '<div class="empty">Defect Manager unavailable: ' + esc(e.message) + '</div>';
      return;
    }
    if (state.view !== 'defects') return;
    const o = s.reports.overview;
    const rows = s.reports.list.map((r) => '<tr><td><button class="case-name" data-report="' + esc(r.key) + '">' + esc(r.key) + '</button><div class="key">' + esc(r.execution_key || '') + '</div></td>' +
      '<td>' + pill(r.status) + '</td><td>' + esc(r.defects) + '</td><td>' + (r.high ? '<span class="bad-text">' + esc(r.high) + '</span>' : '0') + '</td><td>' + esc(r.unresolved) + '</td>' +
      '<td class="small">' + esc(r.claimed_by || '—') + '</td><td class="small">' + esc(r.rerun_count) + '</td><td class="small">' + esc(fmt(r.created_at)) + '</td></tr>').join('');
    content.innerHTML = '<div class="kpi-grid">' +
      '<div class="kpi"><div class="kpi-label">Awaiting PM</div><div class="kpi-value ' + (o.awaiting_pm ? 'red' : 'green') + '">' + o.awaiting_pm + '</div><div class="kpi-sub">open or reopened reports</div></div>' +
      '<div class="kpi"><div class="kpi-label">In fix</div><div class="kpi-value amber">' + o.in_fix + '</div><div class="kpi-sub">claimed by the PM</div></div>' +
      '<div class="kpi"><div class="kpi-label">Rerunning</div><div class="kpi-value blue">' + o.rerunning + '</div><div class="kpi-sub">engine proving fixes</div></div>' +
      '<div class="kpi"><div class="kpi-label">Verified</div><div class="kpi-value green">' + o.verified + '</div><div class="kpi-sub">' + o.unresolved_defects + ' defects unresolved</div></div></div>' +
      '<div class="card"><div class="card-head"><h2>Defect reports</h2><div class="seg" role="group" aria-label="Filter reports">' +
      Object.keys(FILTERS).map((f) => '<button class="btn' + (s.reportFilter === f ? ' primary' : '') + '" data-dfilter="' + f + '">' + f[0].toUpperCase() + f.slice(1) + '</button>').join('') +
      '</div></div><div class="toolbar"><span class="muted small">Failed runs file reports here. The Sand Bench Product Manager claims them, fixes, and asks the engine to rerun; only a passing rerun verifies.</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Report</th><th>Status</th><th>Defects</th><th>High</th><th>Unresolved</th><th>Claimed by</th><th>Reruns</th><th>Filed</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="8" class="empty">No reports in this view.</td></tr>') + '</tbody></table></div></div>';
    content.querySelectorAll('[data-dfilter]').forEach((b) => { b.onclick = () => { s.reportFilter = b.getAttribute('data-dfilter'); s.reports = null; renderDefects(); }; });
    content.querySelectorAll('[data-report]').forEach((b) => { b.onclick = () => openReport(b.getAttribute('data-report')); });
  }

  async function openReport(key) {
    try {
      const r = (await api('/api/v1/defect-reports/' + encodeURIComponent(key))).data;
      el('detailTitle').textContent = r.key;
      const defects = r.defects.map((d) => '<div class="defect"><div class="defect-head"><span class="key">' + esc(d.key) + '</span> ' + pill(d.status) +
        ' <span class="badge sev-' + esc(d.severity) + '">' + esc(d.severity) + '</span> <strong>' + esc(d.case_name) + '</strong></div>' +
        '<div class="muted small">' + esc(d.case_key) + ' · ' + esc(d.category) + ' · seen ' + esc(d.occurrences) + '× · reruns ' + esc(d.rerun_attempts) + (d.regression_of_key ? ' · regression of ' + esc(d.regression_of_key) : '') +
        (d.fix_ref ? ' · fix: ' + (/^https?:\/\//.test(d.fix_ref) ? '<a href="' + esc(d.fix_ref) + '" target="_blank" rel="noopener">' + esc(d.fix_ref) + '</a>' : esc(d.fix_ref)) : '') + '</div>' +
        '<pre class="defect-msg">' + esc(d.message) + '</pre></div>').join('');
      const history = (r.history || []).slice().reverse().map((h) => '<li><span class="muted small">' + esc(fmt(h.at)) + '</span> <strong>' + esc(h.by) + '</strong> ' + esc(String(h.action).replace(/_/g, ' ')) + (h.note ? ' — ' + esc(h.note) : '') + '</li>').join('');
      el('detailBody').innerHTML = '<dl class="kv"><dt>Status</dt><dd>' + pill(r.status) + '</dd><dt>From run</dt><dd class="key">' + esc(r.execution_key || '—') + '</dd>' +
        '<dt>Claimed by</dt><dd>' + esc(r.claimed_by || '—') + '</dd><dt>Last rerun</dt><dd class="key">' + esc(r.rerun_execution_key || '—') + '</dd></dl>' +
        '<h3 class="plan-h">Defects (' + r.defects.length + ')</h3>' + defects + '<h3 class="plan-h">History</h3><ul class="history">' + history + '</ul>';
      el('detail').showModal();
    } catch (e) {
      toast(e.message);
    }
  }

  window.TE_EXT = {
    owns: (v) => Object.prototype.hasOwnProperty.call(VIEWS, v),
    nav: (navItem) => {
      const d = (s.reports && s.reports.overview) || (s.plan && s.plan.defects);
      return '<div class="nav-section">Automation</div>' + navItem('scheduler', null, 'Scheduler') +
        navItem('defects', null, 'Defects', d ? d.awaiting_pm || null : null, d && d.awaiting_pm ? 'red' : null);
    },
    render: (v) => (v === 'scheduler' ? renderScheduler() : renderDefects()),
  };
})();
