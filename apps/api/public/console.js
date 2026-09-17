function toggleCase(el, id) { if (el.checked) selected.add(id); else selected.delete(id); render(); }
function toggleSit(el, id) { if (el.checked) sitSelected.add(id); else sitSelected.delete(id); render(); }

function logRun(msg, source) {
  const line = typeof msg === 'string' ? msg : JSON.stringify(msg);
  state.logLines = [`${new Date().toISOString()}  ${source ? '['+source+'] ' : ''}${line}`, ...state.logLines].slice(0, 200);
  if (state.page === 'log' || state.page === 'overview') render();
}

async function queueRun(body) {
  try {
    const res = await api('/api/v1/executions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    logRun((res.data && res.data.key) || res.key || 'queued', 'engine');
    setTimeout(() => { loadExecutions(); loadCases(); }, 800);
  } catch (err) { logRun(String(err.message || err), 'engine'); }
}

async function runOne(id) { await queueRun({ test_case_ids: [id], environment_id: state.envId || 'local-dev', trigger_source: 'manual' }); }
async function runSelected() {
  if (!selected.size) { logRun('Select at least one repository test case'); go('cases'); return; }
  await queueRun({ test_case_ids: [...selected], environment_id: state.envId || 'local-dev', trigger_source: 'manual' });
}
async function runSmokeSuite() {
  if (!state.suiteId) { logRun('Smoke suite not found — run npm run seed'); return; }
  await queueRun({ test_suite_id: state.suiteId, environment_id: state.envId || 'local-dev', trigger_source: 'manual' });
}

async function sitRun(payload) {
  try {
    const res = await api('/api/v1/sit-runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    logRun(res.data && res.data.via ? ('via ' + res.data.via) : 'accepted', 'sit-runner');
    go('log');
  } catch (err) { logRun(String(err.message || err), 'sit-runner'); go('log'); }
}

async function runSitOne(name, file) {
  const payload = {};
  if (name) payload.caseNames = [name];
  if (file) payload.files = [file];
  await sitRun(payload);
}
async function runSitFiles(file) { await sitRun({ files: [file] }); }
async function runSitAll() {
  const files = (state.sit.files || []).filter(f => state.sitType === 'all' || f.type === state.sitType).map(f => String(f.file || '').replace(/^sit\/cases\//, ''));
  await sitRun({ files });
}
async function runSitSelected() {
  const names = sitCards().filter(c => sitSelected.has(c.id)).map(c => c.name).filter(Boolean);
  if (!names.length) { logRun('Select at least one SIT case'); return; }
  await sitRun({ caseNames: names });
}

async function createSchedule(ev) {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const name = String(fd.get('name') || '').trim();
  const when = String(fd.get('when') || 'every:60');
  const enabled = fd.get('enabled') === 'on';
  const body = { name, enabled };
  if (when.startsWith('after_')) body.event_trigger = when; else body.cron_expression = when;
  try {
    await api('/api/v1/schedules', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    state.schedForm = { name: '', when, enabled: true };
    await loadSchedules();
    render();
  } catch (err) { logRun(String(err.message || err), 'schedules'); }
  return false;
}

async function toggleSchedule(id, enable) {
  try {
    await api('/api/v1/schedules/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: enable }) });
    await loadSchedules(); render();
  } catch (err) { logRun(String(err.message || err), 'schedules'); }
}

async function runSchedule(id) {
  try {
    const res = await api('/api/v1/schedules/' + encodeURIComponent(id) + '/run', { method: 'POST' });
    logRun((res.data && res.data.key) || res.message || 'queued', 'schedules');
    go('runs'); await loadExecutions();
  } catch (err) { logRun(String(err.message || err), 'schedules'); }
}

async function showExec(id) {
  const res = await api('/api/v1/executions/' + encodeURIComponent(id));
  const el = document.getElementById('execDetail');
  if (!el) return;
  el.classList.remove('hidden');
  const data = res.data;
  if (!data) { el.textContent = 'Not found'; return; }
  const results = data.results || [];
  if (!results.length) {
    el.innerHTML = `<p class="mb-2 font-mono">${esc(data.key)} · ${data.status}</p><p class="text-slate-500">No case results yet</p>`;
    return;
  }
  el.innerHTML = `<p class="mb-3 font-mono">${esc(data.key)} · ${statusBadge(data.status)}</p>` + results.map(r => {
    const shots = (r.evidence || []).filter(e => e.evidence_type === 'screenshot' || String(e.content_type||'').startsWith('image'));
    return `<div class="mb-4 p-3 rounded-lg bg-surface border border-surface-border">
      <div class="flex flex-wrap gap-2 items-center mb-1">${statusBadge(r.status)}<span class="text-slate-400">${esc(r.classification || '')}</span><span class="text-slate-500">${r.duration_ms || 0}ms</span></div>
      <p class="mb-2 break-words">${esc(r.message || r.test_case_id || '')}</p>
      ${shots.length ? `<div class="flex flex-wrap gap-2">${shots.map(s => `<a href="${s.url}" target="_blank"><img src="${s.url}" alt="evidence" class="max-h-40 rounded border border-surface-border" /></a>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
}

async function loadHealth() {
  try {
    const h = await api('/health');
    const el = document.getElementById('healthBadge');
    el.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/50 text-emerald-300';
    el.textContent = `ok · v${h.version || '?'}`;
  } catch {
    const el = document.getElementById('healthBadge');
    el.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-900/50 text-rose-300';
    el.textContent = 'unreachable';
  }
}

async function loadDashboard() { try { state.dashboard = (await api('/api/v1/dashboard')).data || {}; } catch { state.dashboard = {}; } }
async function loadReady() { try { state.ready = (await api('/api/v1/release-readiness')).data?.readiness || '—'; } catch { state.ready = '—'; } }
async function loadLastResults() {
  try {
    const res = await api('/api/v1/test-status?application_key=sand-bench');
    state.lastByCaseId = {};
    for (const row of (res.data?.engine_executed || [])) if (row.last_result) state.lastByCaseId[row.id] = row.last_result;
  } catch { state.lastByCaseId = {}; }
}
async function loadCases() {
  await loadLastResults();
  try { state.cases = (await api('/api/v1/test-cases?limit=200')).data || []; } catch { state.cases = []; }
}
async function loadSit() {
  try { state.sit = (await api('/api/v1/sit-catalog')).data || state.sit; } catch {}
  try { state.sitStatus = await api('/api/v1/sit-status'); } catch { state.sitStatus = { reachable: false }; }
}
async function loadEnvAndSuite() {
  try {
    const envs = await api('/api/v1/environments');
    const local = (envs.data || []).find(e => e.key === 'local-dev');
    state.envId = local?.id || local?.key || null;
  } catch {}
  try {
    const suites = await api('/api/v1/suites');
    const smoke = (suites.data || []).find(s => s.key === 'smoke-main-flows');
    state.suiteId = smoke?.id || null;
  } catch {}
}
async function loadWorkers() { try { state.workers = (await api('/api/v1/workers')).data || []; } catch { state.workers = []; } }
async function loadExecutions() { try { state.execs = (await api('/api/v1/executions')).data || []; } catch { state.execs = []; } }
async function loadSchedules() { try { state.schedules = (await api('/api/v1/schedules')).data || []; } catch { state.schedules = []; } }
async function loadBuildStatus() { try { state.build = await api('/api/v1/build-results?application_key=sand-bench'); } catch { state.build = null; }
}

function attachKitStream() {
  if (window.__kitEs) try { window.__kitEs.close(); } catch {}
  try {
    const es = new EventSource('/api/v1/kit-log/stream');
    window.__kitEs = es;
    es.onmessage = (ev) => {
      try {
        const row = JSON.parse(ev.data);
        const stamp = row.t ? new Date(row.t).toISOString() : new Date().toISOString();
        const line = `${stamp}  [${row.source || 'kit'}] ${row.line}`;
        if (state.logLines[0] === line) return;
        state.logLines = [line, ...state.logLines].slice(0, 200);
        if (state.page === 'log') {
          const pre = document.getElementById('kitStream');
          if (pre) pre.textContent = state.logLines.join('\n');
        }
      } catch {}
    };
  } catch {}
}

async function refreshAll() {
  await Promise.all([
    loadHealth(), loadDashboard(), loadReady(), loadCases(), loadSit(),
    loadEnvAndSuite(), loadWorkers(), loadExecutions(), loadSchedules(), loadBuildStatus(),
  ]);
  render();
}

document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => go(b.dataset.nav));
window.addEventListener('hashchange', () => go((location.hash || '#overview').slice(1) || 'overview'));
go(state.page);
attachKitStream();
refreshAll();
setInterval(refreshAll, 15000);
