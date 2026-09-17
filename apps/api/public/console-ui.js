const selected = new Set();
const sitSelected = new Set();
const state = {
  page: (location.hash || '#overview').slice(1) || 'overview',
  cases: [],
  sit: { files: [], registered: [], types: [], apps: [], counts: {} },
  execs: [],
  schedules: [],
  workers: [],
  dashboard: {},
  ready: '—',
  lastByCaseId: {},
  envId: null,
  suiteId: null,
  build: null,
  logLines: [],
  filter: '',
  sitType: 'all',
  sitStatus: { reachable: false },
  schedForm: { name: '', when: 'every:60', enabled: true },
};

const TITLES = {
  overview: ['Overview', 'KPIs, readiness, and the last things that ran'],
  catalog: ['Test catalog', 'SIT packs grouped by application, type, and method'],
  sit: ['SIT test cases', 'Post-deploy cases — Run uses sit/lib/runner via the SIT console'],
  cases: ['Test cases', 'Enterprise repository cases (seeded + imported)'],
  schedules: ['Schedules', 'Create interval or event triggers, then run now'],
  runs: ['Test runs', 'Queued executions, results, and evidence'],
  log: ['Test kit log', 'Live stream from the engine and the SIT runner'],
  workers: ['Workers & builds', 'Claim workers and in-container build status'],
};

function statusBadge(s) {
  const map = {
    passed: 'bg-emerald-900/50 text-emerald-300',
    failed: 'bg-rose-900/50 text-rose-300',
    error: 'bg-rose-900/50 text-rose-300',
    blocked: 'bg-amber-900/50 text-amber-300',
    running: 'bg-amber-900/50 text-amber-300',
    queued: 'bg-slate-700 text-slate-300',
    cancelled: 'bg-slate-700 text-slate-400',
    online: 'bg-emerald-900/50 text-emerald-300',
    offline: 'bg-slate-700 text-slate-400',
    busy: 'bg-amber-900/50 text-amber-300',
    READY: 'bg-emerald-900/50 text-emerald-300',
  };
  const cls = map[s] || 'bg-slate-700 text-slate-300';
  return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}">${esc(s || '—')}</span>`;
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.message || res.statusText);
  return body;
}

function isSitCase(tc) {
  const tags = tc.tags || [];
  return String(tc.key || '').startsWith('SIT-') || tags.includes('sit') || String(tc.script || '').includes('sit/cases');
}

function engineCases() { return state.cases.filter(tc => !isSitCase(tc)); }
function sitRepoCases() { return state.cases.filter(isSitCase); }

function go(page) {
  state.page = page;
  location.hash = page;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === page));
  const t = TITLES[page] || TITLES.overview;
  document.getElementById('pageTitle').textContent = t[0];
  document.getElementById('pageSub').textContent = t[1];
  render();
}

function kpi(label, value, extra) {
  return `<div class="bg-surface-card border border-surface-border rounded-xl p-4">
    <p class="text-xs text-slate-400 uppercase tracking-wide">${label}</p>
    <p class="text-2xl font-semibold mt-1 ${extra || ''}">${value}</p>
  </div>`;
}

function toolbar(opts) {
  return `<div class="flex flex-wrap items-center gap-2">
    <input id="q" type="search" value="${esc(state.filter)}" placeholder="${opts.placeholder || 'Search'}"
      class="px-3 py-2 rounded-lg bg-surface border border-surface-border text-sm min-w-[220px] flex-1" />
    ${opts.extra || ''}
    ${opts.primary || `<button onclick="runSelected()" class="px-3 py-2 rounded-lg bg-accent hover:bg-blue-600 text-white text-sm font-medium">Run selected</button>`}
    ${opts.secondary || ''}
  </div>`;
}

function caseCard(tc, opts) {
  const last = state.lastByCaseId[tc.id];
  const pickSet = opts.sit ? sitSelected : selected;
  const picked = pickSet.has(tc.id) ? 'picked' : '';
  const method = tc.execution_method || tc.method || '—';
  const type = tc.test_type || tc.type || '';
  const toggle = opts.sit ? `toggleSit(this,'${esc(tc.id)}')` : `toggleCase(this,'${esc(tc.id)}')`;
  const fileHint = String(tc.script || tc.key || '').replace(/^sit\/cases\//, '');
  const run = opts.sit
    ? `runSitOne('${esc(tc.name || '')}','${esc(fileHint)}')`
    : `runOne('${esc(tc.id)}')`;
  return `<article class="card-row ${picked} bg-surface-card border border-surface-border rounded-xl px-4 py-3 flex items-start gap-3">
    <label class="mt-1 shrink-0">
      <input type="checkbox" class="rounded border-slate-600" ${pickSet.has(tc.id) ? 'checked' : ''} onchange="${toggle}" ${opts.disableCheck ? 'disabled' : ''} />
    </label>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <p class="font-medium text-sm">${esc(tc.name)}</p>
        ${statusBadge(last?.status)}
        ${type ? `<span class="text-[11px] px-2 py-0.5 rounded bg-surface border border-surface-border text-slate-400">${esc(type)}</span>` : ''}
      </div>
      <p class="mono text-[11px] text-slate-500 mt-1">${esc(tc.key || tc.file || '')}${tc.script ? ' · ' + esc(tc.script) : ''}</p>
      ${tc.description ? `<p class="text-xs text-slate-400 mt-1">${esc(tc.description)}</p>` : ''}
    </div>
    <div class="shrink-0 text-right space-y-2">
      <p class="text-[11px] text-slate-500">${esc(method)}</p>
      <button onclick="${run}" class="text-xs text-accent hover:underline">Run</button>
    </div>
  </article>`;
}

function packCard(pack) {
  const n = pack.cases?.length || 0;
  const fileName = String(pack.file || '').replace(/^sit\/cases\//, '');
  return `<article class="card-row bg-surface-card border border-surface-border rounded-xl px-4 py-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="font-medium text-sm">${esc(pack.file)}</p>
        <p class="mono text-[11px] text-slate-500 mt-1">${esc(pack.app)} · ${esc(pack.type)} / ${esc(pack.group)} · ${esc(pack.method)}</p>
      </div>
      <div class="text-right space-y-1">
        <p class="text-lg font-semibold">${n}</p>
        <p class="text-[11px] text-slate-500">${pack.onDisk ? 'on disk' : 'inventory'}</p>
        <button onclick="runSitFiles('${esc(fileName)}')" class="text-xs text-accent hover:underline">Run pack</button>
      </div>
    </div>
    ${n ? `<ul class="mt-3 space-y-1 text-xs text-slate-300">${pack.cases.slice(0, 8).map(c => `<li class="pl-3 border-l border-surface-border">${esc(c.name)}</li>`).join('')}${n > 8 ? `<li class="text-slate-500 pl-3">+${n - 8} more</li>` : ''}</ul>` : '<p class="text-xs text-slate-500 mt-2">File-level pack</p>'}
  </article>`;
}

function empty(msg) {
  return `<div class="bg-surface-card border border-dashed border-surface-border rounded-xl px-4 py-8 text-sm text-slate-500">${msg}</div>`;
}
