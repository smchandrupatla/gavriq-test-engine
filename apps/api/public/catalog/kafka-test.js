/* "Kafka test" menu for the unified shell.
 * Loaded after app.js and scheduler.js; uses app.js's globals (api, esc, el, toast, navItem, state)
 * and adds itself to window.TE_EXT next to the Scheduler / Defects views.
 *
 * Two on-demand tests, run through the same path as every SIT run (POST /api/v1/sit-runs):
 *   Schedule → Kafka       a schedule created in Sand Bench delivers test messages to Kafka
 *   Data feeder → Kafka    a data feeder created in Sand Bench trickles messages to Kafka
 * Each records checkpoints for Sand Bench and for Kafka Desk and, per message, the ID, what Sand
 * Bench recorded and what Kafka Desk consumed. The menu shows the plan, the live log while a run
 * is going, and the evidence afterwards. */
(function () {
  const VIEWS = { 'kafka-test': null, 'kafka-test-schedule': 'kafka-schedule', 'kafka-test-feeder': 'kafka-data-feeder' };
  const k = { data: null, status: null, history: {}, picked: {}, run: null, timer: null, loadedAt: 0 };

  const css = document.createElement('style');
  css.textContent = [
    '.kt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:16px}',
    '.kt-target{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}',
    '.kt-target h3{margin:0 0 6px;font-size:13px;display:flex;align-items:center;gap:8px}',
    '.kt-dot{width:9px;height:9px;border-radius:50%;background:var(--muted2);flex:0 0 auto}.kt-dot.ok{background:var(--green)}.kt-dot.bad{background:var(--red)}',
    '.kt-case{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:12px}',
    '.kt-case-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}',
    '.kt-case h3{margin:0 0 4px;font-size:15px}',
    '.kt-sys{font-size:10px;letter-spacing:.05em;text-transform:uppercase;border-radius:8px;padding:1px 7px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}',
    '.kt-sys.sand-bench{color:var(--gold-text);border-color:#4a3a1a}.kt-sys.kafka-desk{color:var(--blue);border-color:#24415a}.kt-sys.test-engine{color:var(--muted)}',
    '.kt-cp.failed td{background:var(--red-soft)}.kt-cp.pending td{color:var(--muted)}',
    '.kt-mark{font-weight:700}.kt-mark.passed{color:var(--green)}.kt-mark.failed{color:var(--red)}.kt-mark.pending{color:var(--muted2)}',
    '.kt-log{white-space:pre-wrap;word-break:break-word;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px;max-height:260px;overflow:auto;font-size:12px;margin:0}',
    '.kt-detail{font-size:12px;color:var(--muted);overflow-wrap:anywhere}',
    '.kt-id{font-family:ui-monospace,Consolas,monospace;font-size:12px;overflow-wrap:anywhere}',
  ].join('');
  document.head.appendChild(css);

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' }) : '—');
  const coord = (c) => (c ? esc(c.topic) + ' [' + esc(c.partition) + '] @ ' + esc(c.offset) : '<span class="muted">—</span>');
  const resultBadge = (r) => '<span class="badge ' + (r === 'passed' ? 'passed' : r === 'failed' ? 'failed' : 'never') + '">' + esc(r || 'never run') + '</span>';
  const caseByView = (view) => (k.data ? k.data.cases.find((c) => c.key === VIEWS[view]) : null);

  async function load(force) {
    if (!force && k.data && Date.now() - k.loadedAt < 4000) return;
    const [cases, status] = await Promise.all([api('/api/v1/kafka-test'), api('/api/v1/kafka-test/status').catch(() => null)]);
    k.data = cases.data;
    k.status = status && status.data;
    k.loadedAt = Date.now();
  }

  async function loadHistory(key) {
    try { k.history[key] = (await api('/api/v1/kafka-test/evidence?case=' + encodeURIComponent(key) + '&limit=15')).data; } catch { k.history[key] = []; }
  }

  // ---- running ------------------------------------------------------------------------------
  async function start(files, label) {
    try {
      const res = await fetch('/api/v1/sit-runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files }) });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) { toast('A SIT run is already in progress — wait for it to finish.'); return; }
      if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
      toast('Started: ' + label);
      k.run = { label, files, startedAt: Date.now(), running: true, log: [], currentFile: null };
      poll();
    } catch (e) { toast('Could not start: ' + e.message); }
  }

  function stopPolling() { if (k.timer) { clearInterval(k.timer); k.timer = null; } }

  async function poll() {
    stopPolling();
    const tick = async () => {
      let s;
      try { s = (await api('/api/v1/sit-status')).data || {}; } catch { s = null; }
      if (s && k.run) {
        k.run.running = Boolean(s.running);
        k.run.currentFile = s.currentFile;
        k.run.log = (s.log || []).filter((l) => l.includes('[kafka-test]') || l.startsWith('===') || l.includes('Run finished') || l.includes('not ok') || l.startsWith('ok '));
      }
      const active = state.view && Object.prototype.hasOwnProperty.call(VIEWS, state.view);
      if (k.run && !k.run.running && Date.now() - k.run.startedAt > 3000) {
        stopPolling();
        try { await load(true); await Promise.all((k.data.cases || []).map((c) => loadHistory(c.key))); } catch {}
        k.run.finished = true;
        if (active) renderCurrentView();
        renderSideNav();
        return;
      }
      if (active) renderLive();
    };
    k.timer = setInterval(tick, 2000);
    tick();
  }

  // ---- pieces ---------------------------------------------------------------------------------
  function targetsHtml() {
    const s = k.status;
    if (!s) return '<div class="banner" style="margin:0 0 12px">Could not read the status of the systems the tests need.</div>';
    const row = (ok, title, lines) => '<div class="kt-target"><h3><span class="kt-dot ' + (ok ? 'ok' : 'bad') + '"></span>' + esc(title) + '</h3>' + lines.map((l) => '<div class="kt-detail">' + l + '</div>').join('') + '</div>';
    return '<div class="kt-grid">' +
      row(s.sandBench.reachable && s.sandBench.kafkaDelivers, 'Sand Bench', [
        '<span class="key">' + esc(s.sandBench.base) + '</span>',
        s.sandBench.reachable
          ? (s.sandBench.kafkaDelivers ? 'Kafka channel delivers to a real broker' : '<strong>Kafka is simulated, not delivered</strong> — api and worker need SBE_REDPANDA_PROXY (compose.kafkadesk.yml). Channels: ' + esc(s.sandBench.configuredChannels.join(', ') || 'none'))
          : 'Not reachable' + (s.sandBench.error ? ': ' + esc(s.sandBench.error) : '')]) +
      row(s.kafkaDesk.reachable && s.kafkaDesk.consuming, 'Kafka Desk', [
        '<span class="key">' + esc(s.kafkaDesk.base) + '</span>',
        s.kafkaDesk.reachable
          ? (s.kafkaDesk.consuming ? 'Consuming ' + esc(s.kafkaDesk.topics.join(', ')) + ' · ' + esc(s.kafkaDesk.received) + ' records so far' : '<strong>Not consuming from the broker</strong>' + (s.kafkaDesk.lastError ? ': ' + esc(s.kafkaDesk.lastError) : ''))
          : 'Not reachable' + (s.kafkaDesk.error ? ': ' + esc(s.kafkaDesk.error) : '')]) +
      row(s.sitRunner.reachable, 'Test runner (SIT console)', ['<span class="key">' + esc(s.sitRunner.base) + '</span>', s.sitRunner.reachable ? (s.sitRunner.running ? 'A run is in progress' : 'Idle') : 'Not reachable']) +
      '</div>' +
      (s.ready ? '' : '<div class="banner" style="margin:0 0 12px">Not everything is connected yet, so a run would fail its first checkpoint. Start the three stacks with <code>sh scripts/kafka-stack.sh up</code> (see docs/KAFKA-TEST.md).</div>');
  }

  function liveHtml() {
    if (!k.run) return '';
    const lines = k.run.log.slice(-40).join('\n');
    return '<div class="card" id="kt-live"><div class="card-head"><h2>' + (k.run.running ? 'Running: ' : 'Last run: ') + esc(k.run.label) + '</h2><span class="muted small">' + (k.run.running ? esc(k.run.currentFile || 'starting…') : 'finished') + '</span></div><pre class="kt-log">' + esc(lines || 'Waiting for the first checkpoint…') + '</pre></div>';
  }

  function renderLive() {
    const node = el('kt-live');
    if (!node) return;
    node.outerHTML = liveHtml();
    document.querySelectorAll('[data-kt-run]').forEach((b) => { b.disabled = Boolean(k.run && k.run.running); });
  }

  function checkpointRows(c, evidence) {
    const done = new Map(((evidence && evidence.checkpoints) || []).map((cp) => [cp.id, cp]));
    const rows = c.checkpoints.map((p) => {
      const cp = done.get(p.id);
      return { id: p.id, system: p.system, title: cp ? cp.title : p.title, status: cp ? cp.status : 'pending', detail: cp && cp.detail, at: cp && cp.at };
    });
    // Checkpoints that ran but are not in the plan (a test extended later) still show.
    for (const cp of done.values()) if (!c.checkpoints.some((p) => p.id === cp.id)) rows.push({ ...cp });
    return rows;
  }

  function checkpointTable(c, evidence) {
    const rows = checkpointRows(c, evidence).map((r) =>
      '<tr class="kt-cp ' + esc(r.status) + '"><td><span class="kt-mark ' + esc(r.status) + '">' + (r.status === 'passed' ? '✓' : r.status === 'failed' ? '✗' : '·') + '</span></td>' +
      '<td class="key">' + esc(r.id) + '</td><td><span class="kt-sys ' + esc(r.system) + '">' + esc(r.system.replace('-', ' ')) + '</span></td>' +
      '<td>' + esc(r.title) + (r.detail ? '<div class="kt-detail">' + esc(r.detail) + '</div>' : '') + '</td></tr>').join('');
    return '<div class="table-wrap"><table><thead><tr><th></th><th>Checkpoint</th><th>System</th><th>What must be true</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function messageTable(evidence) {
    const msgs = (evidence && evidence.messages) || [];
    if (!msgs.length) return '<div class="empty">No messages compared yet. They appear here once the run reaches the Kafka Desk checkpoints.</div>';
    const rows = msgs.map((m) =>
      '<tr><td>' + esc(m.ordinal) + '</td><td class="kt-id">' + esc(m.messageId || '(no id — matched by payload)') + '</td>' +
      '<td>' + esc(m.sandBench.status) + '<div class="kt-detail">' + coord(m.sandBench.coordinates) + '</div></td>' +
      '<td>' + (m.kafkaDesk.found ? '<span class="ok-text">consumed</span> (' + esc(m.kafkaDesk.source) + ')' : '<span class="bad-text">not seen</span>') + '<div class="kt-detail">' + coord(m.kafkaDesk.coordinates) + (m.kafkaDesk.seenAt ? ' · ' + esc(fmt(m.kafkaDesk.seenAt)) : '') + '</div></td>' +
      '<td><span class="kt-mark ' + (m.coordinatesMatch ? 'passed' : 'failed') + '">' + (m.coordinatesMatch ? '✓ same' : '✗ differ') + '</span></td></tr>').join('');
    return '<div class="table-wrap"><table><thead><tr><th>#</th><th>Message ID</th><th>Sand Bench recorded</th><th>Kafka Desk consumed</th><th>Offsets</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function summaryLine(c) {
    const l = c.latest;
    if (!l) return '<span class="muted small">Never run</span>';
    return resultBadge(l.result) + ' <span class="muted small">' + esc(fmt(l.finishedAt || l.startedAt)) + ' · ' + esc(l.checkpoints.passed) + '/' + esc(l.checkpoints.total) + ' checkpoints · ' + esc(l.messages) + ' messages</span>';
  }

  // ---- views ---------------------------------------------------------------------------------
  async function renderOverview() {
    el('viewTitle').textContent = 'Kafka test';
    try { await load(true); } catch (e) { el('content').innerHTML = '<div class="empty">Could not load the Kafka test menu: ' + esc(e.message) + '</div>'; return; }
    const busy = k.run && k.run.running;
    el('content').innerHTML =
      '<p class="muted" style="margin-top:0">Proves that what Sand Bench sends to Kafka really arrives in Kafka: each test creates its data in Sand Bench, lets Sand Bench send it, then asks Kafka Desk — which consumes the topic on its own — to confirm every message ID at the same offset. Checkpoints are written for both systems and kept as evidence.</p>' +
      targetsHtml() +
      '<div class="toolbar" style="padding:0 0 12px;border:0"><button class="btn primary" data-kt-run="all"' + (busy ? ' disabled' : '') + '>Run both tests</button><span class="muted small">On demand. Takes about a minute each; a data feeder run trickles its messages over ~12 seconds so you can watch them arrive in Kafka Desk.</span></div>' +
      liveHtml() +
      k.data.cases.map((c) =>
        '<div class="kt-case"><div class="kt-case-head"><div><h3><a href="#/' + (c.key === 'kafka-schedule' ? 'kafka-test-schedule' : 'kafka-test-feeder') + '">' + esc(c.title) + '</a></h3><div class="muted small" style="max-width:640px">' + esc(c.summary) + '</div><div style="margin-top:8px">' + summaryLine(c) + '</div></div>' +
        '<button class="btn sit" data-kt-run="' + esc(c.key) + '"' + (busy || !c.onDisk ? ' disabled' : '') + '>Run</button></div></div>').join('');
    bind();
  }

  async function renderCase(view) {
    try { await load(true); } catch (e) { el('content').innerHTML = '<div class="empty">Could not load: ' + esc(e.message) + '</div>'; return; }
    const c = caseByView(view);
    if (!c) { el('content').innerHTML = '<div class="empty">Unknown Kafka test.</div>'; return; }
    el('viewTitle').textContent = 'Kafka test · ' + c.title;
    if (!k.history[c.key]) await loadHistory(c.key);
    const picked = k.picked[c.key];
    const evidence = picked ? picked.evidence : c.latest && c.latest.evidence;
    const busy = k.run && k.run.running;
    const history = (k.history[c.key] || []).map((h) =>
      '<tr><td>' + esc(fmt(h.startedAt)) + '</td><td>' + resultBadge(h.result) + '</td><td>' + esc(h.checkpoints.passed) + '/' + esc(h.checkpoints.total) + '</td><td>' + esc(h.messages) + '</td><td><button class="btn" data-kt-open="' + esc(h.name) + '">View evidence</button></td></tr>').join('');
    el('content').innerHTML =
      '<div class="kt-case"><div class="kt-case-head"><div><h3>' + esc(c.title) + '</h3><div class="muted small" style="max-width:700px">' + esc(c.summary) + '</div><div style="margin-top:8px">' + summaryLine(c) + '</div></div>' +
      '<button class="btn sit" data-kt-run="' + esc(c.key) + '"' + (busy || !c.onDisk ? ' disabled' : '') + '>Run this test</button></div></div>' +
      targetsHtml() + liveHtml() +
      '<div class="card"><div class="card-head"><h2>Checkpoints</h2><span class="muted small">' + (evidence ? 'Evidence ' + esc(evidence.runId) + ' · ' + esc(fmt(evidence.startedAt)) : 'Plan — not run yet') + '</span></div>' +
      (evidence && evidence.error ? '<div class="banner" style="margin:12px 16px">' + esc(evidence.error) + '</div>' : '') + checkpointTable(c, evidence) + '</div>' +
      '<div class="card"><div class="card-head"><h2>Messages: Sand Bench vs Kafka Desk</h2></div>' + messageTable(evidence) + '</div>' +
      '<div class="card"><div class="card-head"><h2>Earlier runs</h2></div>' + (history ? '<div class="table-wrap"><table><thead><tr><th>Started</th><th>Result</th><th>Checkpoints</th><th>Messages</th><th></th></tr></thead><tbody>' + history + '</tbody></table></div>' : '<div class="empty">No earlier runs.</div>') + '</div>';
    bind(c.key);
  }

  function bind(caseKey) {
    document.querySelectorAll('[data-kt-run]').forEach((b) => {
      b.onclick = () => {
        const key = b.getAttribute('data-kt-run');
        const defs = k.data.cases.filter((c) => key === 'all' || c.key === key);
        k.picked = {};
        start(defs.map((c) => c.file), key === 'all' ? 'both Kafka tests' : defs[0].title).then(() => (caseKey ? renderCase(state.view) : renderOverview()));
      };
    });
    document.querySelectorAll('[data-kt-open]').forEach((b) => {
      b.onclick = async () => {
        try { k.picked[caseKey] = { evidence: (await api('/api/v1/kafka-test/evidence/' + encodeURIComponent(b.getAttribute('data-kt-open')))).data }; renderCase(state.view); } catch (e) { toast(e.message); }
      };
    });
  }

  function dot(c) { return !c || !c.latest ? null : c.latest.result === 'passed' ? 'green' : 'red'; }

  const previous = window.TE_EXT;
  window.TE_EXT = {
    owns: (v) => Object.prototype.hasOwnProperty.call(VIEWS, v) || Boolean(previous && previous.owns(v)),
    nav: (navItem) => {
      const schedule = k.data && k.data.cases.find((c) => c.key === 'kafka-schedule');
      const feeder = k.data && k.data.cases.find((c) => c.key === 'kafka-data-feeder');
      return (previous ? previous.nav(navItem) : '') +
        '<div class="nav-section">Kafka test</div>' +
        navItem('kafka-test', null, 'Overview & run') +
        navItem('kafka-test-schedule', null, 'Schedule → Kafka', null, dot(schedule)) +
        navItem('kafka-test-feeder', null, 'Data feeder → Kafka', null, dot(feeder));
    },
    render: (v) => {
      if (v === 'kafka-test') return renderOverview();
      if (Object.prototype.hasOwnProperty.call(VIEWS, v)) return renderCase(v);
      return previous.render(v);
    },
  };

  // The side menu shows the last result of each test as a dot; fetch it once at load.
  load(true).then(() => { if (typeof renderSideNav === 'function') renderSideNav(); }).catch(() => {});
})();
