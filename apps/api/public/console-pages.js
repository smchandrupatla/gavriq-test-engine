function renderOverview() {
  const d = state.dashboard;
  const ready = state.ready;
  const readyCls = ready === 'READY' ? 'text-emerald-400' : String(ready).includes('CONDITIONS') ? 'text-amber-400' : 'text-rose-400';
  const sit = state.sitStatus.reachable ? 'SIT runner up' : 'SIT runner down';
  return `
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${kpi('Total tests', d.total_tests ?? state.cases.length)}
      ${kpi('Automated', d.automated ?? '—')}
      ${kpi('Failed (7d)', d.failed_last_7d ?? 0, 'text-rose-400')}
      ${kpi('Release', ready, readyCls)}
    </section>
    <section class="grid lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-medium">SIT packs</h2>
          <button class="text-xs text-accent" onclick="go('catalog')">Open catalog</button>
        </div>
        <div class="space-y-2">${(state.sit.files || []).slice(0, 6).map(packCard).join('') || empty('Import SIT catalog or keep sit/cases on disk.')}</div>
      </div>
      <div class="space-y-4">
        <div class="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
          <h2 class="font-medium">On-demand run</h2>
          <p class="text-xs text-slate-400">Repository cases queue on the engine worker. SIT cards call sit/lib/runner through :8098.</p>
          <p class="text-[11px] text-slate-500">${esc(sit)}</p>
          <button onclick="runSelected()" class="w-full py-2 rounded-lg bg-accent hover:bg-blue-600 text-white text-sm font-medium">Run selected repository cases</button>
          <button onclick="runSmokeSuite()" class="w-full py-2 rounded-lg border border-surface-border hover:bg-surface-border text-sm">Run full smoke suite</button>
        </div>
        <div class="bg-surface-card border border-surface-border rounded-xl p-4">
          <h2 class="font-medium mb-2">Workers</h2>
          ${workerList()}
        </div>
      </div>
    </section>`;
}

function renderCatalog() {
  const types = ['all', ...new Set((state.sit.files || []).map(f => f.type))];
  const chips = types.map(t => `<button onclick="state.sitType='${t}';render()" class="px-2.5 py-1 rounded-full text-xs border ${state.sitType===t ? 'border-accent bg-accent-soft text-blue-200' : 'border-surface-border text-slate-400'}">${t}</button>`).join('');
  const rows = (state.sit.files || []).filter(f => state.sitType === 'all' || f.type === state.sitType)
    .filter(f => !state.filter || (f.file + f.type + f.group).toLowerCase().includes(state.filter.toLowerCase()));
  const c = state.sit.counts || {};
  return `
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${kpi('Packs', c.files ?? rows.length)}
      ${kpi('Extracted names', c.extracted ?? 0)}
      ${kpi('Registered SIT', c.registered ?? sitRepoCases().length)}
      ${kpi('Source', state.sit.source || 'sit/cases', 'text-sm')}
    </section>
    ${toolbar({ placeholder: 'Filter packs', extra: `<div class="flex flex-wrap gap-1">${chips}</div>`, primary: `<button onclick="runSitAll()" class="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium">Run visible packs</button>` })}
    <div class="space-y-2">${rows.map(packCard).join('') || empty('No packs match.')}</div>`;
}

function sitCards() {
  const q = state.filter.toLowerCase();
  const registered = sitRepoCases().filter(tc => !q || (tc.key + tc.name).toLowerCase().includes(q));
  const extracted = (state.sit.files || []).flatMap(f => (f.cases || []).map(c => ({
    id: 'file:' + f.file + ':' + c.name,
    key: f.file,
    name: c.name,
    test_type: f.type,
    execution_method: f.method,
    script: String(f.file || '').startsWith('sit/') ? f.file : 'sit/cases/' + f.file,
    description: (f.app || '') + ' · ' + (f.group || ''),
  }))).filter(tc => !q || (tc.key + tc.name).toLowerCase().includes(q));
  return registered.length ? registered : extracted;
}

function renderSit() {
  const cards = sitCards();
  const runner = state.sitStatus.reachable
    ? 'SIT console reachable — Run goes to sit/lib/runner'
    : 'SIT console unreachable — Run falls back to queued SIT-* engine cases';
  return `
    <p class="text-xs text-slate-400">${esc(runner)}</p>
    ${toolbar({ placeholder: 'Search SIT cases', primary: `<button onclick="runSitSelected()" class="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium">Run selected SIT</button>` })}
    <div class="space-y-2">${cards.map(tc => caseCard(tc, { sit: true })).join('') || empty('No SIT cases yet.')}</div>`;
}

function renderCases() {
  const q = state.filter.toLowerCase();
  const rows = engineCases().filter(tc => !q || (tc.key + tc.name + (tc.execution_method||'')).toLowerCase().includes(q));
  return `
    ${toolbar({ placeholder: 'Search repository cases', secondary: `<button onclick="runSmokeSuite()" class="px-3 py-2 rounded-lg border border-surface-border text-sm">Run smoke suite</button>` })}
    <div class="space-y-2">${rows.map(tc => caseCard(tc, {})).join('') || empty('No repository cases — seed or import:sit.')}</div>`;
}

function renderSchedules() {
  const f = state.schedForm;
  const rows = state.schedules || [];
  return `
    <form class="bg-surface-card border border-surface-border rounded-xl p-4 grid md:grid-cols-4 gap-3 items-end" onsubmit="return createSchedule(event)">
      <label class="text-xs text-slate-400">Name
        <input name="name" required value="${esc(f.name)}" class="mt-1 w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-slate-200" />
      </label>
      <label class="text-xs text-slate-400">When
        <select name="when" class="mt-1 w-full px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm text-slate-200">
          ${['every:15','every:60','hourly','daily','after_build','after_deploy'].map(w =>
            `<option value="${w}" ${f.when===w?'selected':''}>${w}</option>`).join('')}
        </select>
      </label>
      <label class="text-xs text-slate-400 flex items-center gap-2 md:mb-2">
        <input type="checkbox" name="enabled" ${f.enabled ? 'checked' : ''} /> Enabled
      </label>
      <button class="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium">Save schedule</button>
    </form>
    <div class="space-y-2">${rows.map(s => `
      <article class="card-row bg-surface-card border border-surface-border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p class="font-medium text-sm">${esc(s.name)}</p>
          <p class="mono text-[11px] text-slate-500 mt-1">${esc(s.cron_expression || s.event_trigger || 'unscheduled')} · cases ${(s.test_case_ids || []).length}${s.last_run_at ? ' · last ' + new Date(s.last_run_at).toLocaleString() : ''}</p>
        </div>
        <div class="flex items-center gap-2">
          ${statusBadge(s.enabled === false ? 'offline' : 'online')}
          <button onclick="toggleSchedule('${esc(s.id)}', ${s.enabled === false})" class="text-xs text-slate-300 hover:underline">${s.enabled === false ? 'Enable' : 'Disable'}</button>
          <button onclick="runSchedule('${esc(s.id)}')" class="text-xs text-accent hover:underline">Run now</button>
        </div>
      </article>`).join('') || empty('No schedules yet.')}</div>`;
}

function renderRuns() {
  const rows = state.execs || [];
  return `
    <div class="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-left text-xs text-slate-400">
          <tr><th class="px-4 py-2">Key</th><th class="px-4 py-2">Status</th><th class="px-4 py-2">Trigger</th><th class="px-4 py-2">Cases</th><th class="px-4 py-2">Created</th></tr>
        </thead>
        <tbody class="divide-y divide-surface-border">${rows.slice(0, 20).map(e => `
          <tr class="hover:bg-surface/50 cursor-pointer" onclick="showExec('${esc(e.id || e.key)}')">
            <td class="px-4 py-2 font-mono text-xs">${esc(e.key)}</td>
            <td class="px-4 py-2">${statusBadge(e.status)}</td>
            <td class="px-4 py-2 text-xs">${esc(e.trigger_source)}</td>
            <td class="px-4 py-2 text-xs">${(e.test_case_ids || []).length}</td>
            <td class="px-4 py-2 text-xs text-slate-400">${e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
          </tr>`).join('') || `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">No executions yet</td></tr>`}
        </tbody>
      </table>
    </div>
    <div id="execDetail" class="hidden border border-surface-border rounded-xl px-4 py-3 text-xs text-slate-300 bg-surface-card"></div>`;
}

function renderLog() {
  const lines = state.logLines.length ? state.logLines : ['Waiting for kit stream…'];
  return `<section class="bg-surface-card border border-surface-border rounded-xl p-4">
    <div class="flex items-center justify-between mb-2">
      <h2 class="font-medium">Live kit messages</h2>
      <span class="text-[11px] text-slate-500">${state.sitStatus.reachable ? 'SIT runner attached' : 'engine only'}</span>
    </div>
    <pre id="kitStream" class="mono text-xs text-slate-300 bg-surface rounded-lg p-3 max-h-[480px] overflow-auto whitespace-pre-wrap">${esc(lines.join('\n'))}</pre>
  </section>`;
}

function workerList() {
  const workers = state.workers || [];
  if (!workers.length) return '<p class="text-sm text-slate-500">No workers — WITH_WORKERS=1 ./scripts/up.sh</p>';
  return `<ul class="text-sm space-y-1">${workers.map(w =>
    `<li class="flex justify-between gap-2"><span class="truncate">${esc(w.name || w.id)}</span>${statusBadge(w.status)}</li>`
  ).join('')}</ul>`;
}

function renderWorkers() {
  const res = state.build;
  let buildHtml = 'No build results yet. Use <code class="text-slate-300">scripts/post-build-results.sh</code>.';
  if (res && res.build_id) {
    const s = res.summary || {};
    buildHtml = `<p class="mb-1">Build <code>${esc(res.build_id)}</code></p>
      <p class="text-xs mb-2">passed ${s.passed || 0} · failed ${s.failed || 0} · skipped ${s.skipped || 0}</p>`;
  }
  return `<div class="grid md:grid-cols-2 gap-4">
    <section class="bg-surface-card border border-surface-border rounded-xl p-4"><h2 class="font-medium mb-2">Workers</h2>${workerList()}</section>
    <section class="bg-surface-card border border-surface-border rounded-xl p-4"><h2 class="font-medium mb-2">In-container / build status</h2><div class="text-sm text-slate-400">${buildHtml}</div></section>
  </div>`;
}

function render() {
  const view = document.getElementById('view');
  const pages = { overview: renderOverview, catalog: renderCatalog, sit: renderSit, cases: renderCases, schedules: renderSchedules, runs: renderRuns, log: renderLog, workers: renderWorkers };
  view.innerHTML = (pages[state.page] || renderOverview)();
  const q = document.getElementById('q');
  if (q) q.oninput = (e) => { state.filter = e.target.value; render(); };
}
