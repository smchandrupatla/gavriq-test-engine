/**
 * Guards the shape of the public Overview UI (apps/api/public/catalog/app.js
 * + index.html) around the deploy / cycle / banner chrome. The console runs
 * in the browser, so there is no node-side renderer to drive — these are
 * static source checks that catch regressions in the pieces operators depend
 * on when they trigger a self-test full cycle:
 *   - a big progress tile for a running cycle (preparation + iterations)
 *   - a dismissable terminal cycle banner (completed / failed / cancelled)
 *   - previous deploy-loop + terminal-cycle banners cleared when a new
 *     deploy / cycle / run is kicked off
 *   - env + version live inside the Overview actions bar (not in the top
 *     chrome, where they used to appear)
 *   - Running Now empty-state names the in-flight deploy / cycle instead of
 *     claiming "no runs in progress"
 *   - Generic Search matches across many fields, not just name + key
 *   - defaults for cycle iterations and auto-fix attempts are 1, not 3 / 2
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_JS = readFileSync(path.join(here, '..', 'apps', 'api', 'public', 'catalog', 'app.js'), 'utf8');
const INDEX_HTML = readFileSync(path.join(here, '..', 'apps', 'api', 'public', 'catalog', 'index.html'), 'utf8');

describe('Overview console chrome', () => {
  describe('defaults operators asked for', () => {
    it('seeds cycleIterations at 1 (used to default to 3)', () => {
      assert.match(APP_JS, /cycleRun:null,cycleIterations:1\b/);
    });
    it('seeds autoFixMax at 1 (used to default to 2)', () => {
      assert.match(APP_JS, /autoFix:false,autoFixMax:1\b/);
    });
    it('schedule form seeds autoFixMax at 1 too', () => {
      // The form state is reinitialised on open; both occurrences must agree.
      const hits = APP_JS.match(/autoFix:false,autoFixMax:1\b/g) || [];
      assert.ok(hits.length >= 2, `expected 2+ autoFixMax:1 state inits, got ${hits.length}`);
    });
    it('auto-fix controls label defaults to 1 attempt', () => {
      assert.match(APP_JS, /state\.autoFixMax\|\|1/);
    });
    it('server-side settings fallback for auto_fix_default_max_attempts is 1', () => {
      assert.match(APP_JS, /auto_fix_default_max_attempts\?\?1/);
    });
  });

  describe('top-bar env + version chrome removed', () => {
    it('removes the Env label and visible env select from the top bar', () => {
      assert.doesNotMatch(INDEX_HTML, /id="envLabel"/);
      // envSelect remains in the DOM as a hidden fallback so renderEnvSelect
      // still has somewhere to write; it must be hidden.
      assert.match(INDEX_HTML, /id="envSelect"[^>]*hidden/);
    });
    it('removes the Version label and visible version input from the top bar', () => {
      assert.doesNotMatch(INDEX_HTML, /id="versionLabel"/);
      // appVersionInput must only exist as a hidden state carrier.
      assert.match(INDEX_HTML, /id="appVersionInput" type="hidden"/);
    });
    it('enlarges the application name as a dedicated .app-name chip', () => {
      assert.match(INDEX_HTML, /id="appLabel" class="app-name"/);
      assert.match(INDEX_HTML, /\.topbar \.app-name\{[^}]*font-size:22px/);
    });
    it('global search placeholder is generic', () => {
      assert.match(INDEX_HTML, /id="globalSearch"[^>]*placeholder="Search anything…"/);
    });
    it('syncEnvAndVersionChips is a no-op (nothing to toggle in the top bar any more)', () => {
      const fnMatch = APP_JS.match(/function syncEnvAndVersionChips\(\)\{([\s\S]*?)\n\}/);
      assert.ok(fnMatch, 'syncEnvAndVersionChips function body must be present');
      // Strip comments to check real statements; comments mentioning the
      // hidden carriers are fine, DOM mutation on them is what we are blocking.
      const stripped = fnMatch![1].replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      assert.doesNotMatch(stripped, /show\s*\(|\.hidden\s*=/);
    });
  });

  describe('env + version pickers moved into the Overview actions bar', () => {
    it('renders an envPicker with id=ovEnvSelect', () => {
      assert.match(APP_JS, /id="ovEnvSelect"[^>]*aria-label="Target environment"/);
    });
    it('renders a versionPicker with id=ovVersionSelect', () => {
      assert.match(APP_JS, /id="ovVersionSelect"[^>]*aria-label="Branch \/ tag \/ version to deploy and run"/);
    });
    it('wires both pickers through the content change handler', () => {
      assert.match(APP_JS, /e\.target\.id==='ovEnvSelect'/);
      assert.match(APP_JS, /e\.target\.id==='ovVersionSelect'/);
    });
    it('the Deploy button label no longer bakes in the branch name', () => {
      // Old label was "Deploy ${ref}" — this must be gone.
      assert.doesNotMatch(APP_JS, /`⇪ Deploy \$\{esc\(ref\)\}`/);
      assert.match(APP_JS, /`⇪ Deploy`/);
    });
  });

  describe('cycle progress tile and dismissable banners', () => {
    it('a running cycle renders a big progress tile (not the thin banner)', () => {
      assert.match(APP_JS, /pbar-detail pbar-detail-big pbar-detail-warn[\s\S]*?Cycle \$\{esc\(c\.key\)\}/);
    });
    it('the cycle tile includes a progress-seg bar (defined just above the template)', () => {
      // The function uses `const bar=` with a "progress-seg big" chunk, then
      // interpolates ${bar} into the pbar-detail-big template. Grab the
      // function body by range: from its header to the next top-level
      // function declaration.
      const start = APP_JS.indexOf('function cycleRunHtml()');
      assert.ok(start > -1, 'cycleRunHtml must be present');
      const after = APP_JS.indexOf('\nfunction ', start + 1);
      assert.ok(after > start, 'cycleRunHtml must be followed by another function');
      const body = APP_JS.slice(start, after);
      assert.match(body, /progress-seg big/);
      assert.match(body, /pbar-detail pbar-detail-big pbar-detail-warn/);
    });
    it('terminal cycle banners carry a dismiss (×) button', () => {
      assert.match(APP_JS, /data-action="dismiss-cycle"[^>]*data-id="\$\{esc\(c\.id\)\}"/);
    });
    it('the dismiss action persists via localStorage and clears state.cycleRun', () => {
      assert.match(APP_JS, /action==='dismiss-cycle'[^;]*dismissCycle/);
      assert.match(APP_JS, /DISMISSED_CYCLE_KEY/);
      assert.match(APP_JS, /isCycleDismissed/);
    });
    it('deployLoop banner is also dismissable', () => {
      assert.match(APP_JS, /DISMISSED_LOOP_KEY/);
      assert.match(APP_JS, /isLoopDismissed/);
      assert.match(APP_JS, /dismissLoop\(/);
    });
    it('CSS defines the big-tile styling', () => {
      assert.match(INDEX_HTML, /\.pbar-detail-big\{[^}]*padding:16px 18px/);
      assert.match(INDEX_HTML, /\.pbar-detail-big\.pbar-detail-warn/);
      assert.match(INDEX_HTML, /\.pbar-detail-big\.pbar-detail-fail/);
    });
  });

  describe('new deploy / run clears stale error banners', () => {
    it('deployMain clears state.deployLoop and any terminal cycleRun before posting', () => {
      const fn = APP_JS.match(/async function deployMain\(btn\)\{([\s\S]*?)\n\}/);
      assert.ok(fn, 'deployMain must be present');
      assert.match(fn![1], /state\.deployLoop=null/);
      assert.match(fn![1], /state\.cycleRun&&state\.cycleRun\.status!=='running'[^]*state\.cycleRun=null/);
    });
    it('startCycleRun clears the previous terminal cycleRun and any deploy banner', () => {
      const fn = APP_JS.match(/async function startCycleRun\(btn,opts\)\{([\s\S]*?)\n\}/);
      assert.ok(fn, 'startCycleRun must be present');
      assert.match(fn![1], /state\.deployLoop=null/);
      assert.match(fn![1], /state\.cycleRun=null/);
    });
    it('queueExecution clears a stale deployLoop and terminal cycleRun', () => {
      const fn = APP_JS.match(/async function queueExecution\(body,label\)\{([\s\S]*?)\n\}/);
      assert.ok(fn, 'queueExecution must be present');
      assert.match(fn![1], /state\.deployLoop=null/);
      assert.match(fn![1], /state\.cycleRun[^;]*status!=='running'[^;]*state\.cycleRun=null/);
    });
    it('renderBanner hides deployLoop while a deploy / cycle / run is active', () => {
      const fn = APP_JS.match(/function renderBanner\(\)\{([\s\S]*?)\nconst DISMISSED_LOOP_KEY/);
      assert.ok(fn, 'renderBanner must be followed by DISMISSED_LOOP_KEY');
      assert.match(fn![1], /hasActive/);
      assert.match(fn![1], /state\.deploy&&\(state\.deploy\.status==='queued'\|\|state\.deploy\.status==='deploying'\)/);
      assert.match(fn![1], /state\.cycleRun&&state\.cycleRun\.status==='running'/);
      assert.match(fn![1], /activeRuns\(\)\.length>0/);
    });
  });

  describe('Running Now is now its own page (not an Overview tab)', () => {
    it('Overview no longer renders a Running now tab branch', () => {
      // The whole Running now tab has moved to the sidebar entry
      // #/runs-running (renderHistory). Overview is Summary-only now.
      const start = APP_JS.indexOf('function renderOverview()');
      assert.ok(start > -1);
      const after = APP_JS.indexOf('\nfunction ', start + 1);
      const body = APP_JS.slice(start, after);
      assert.doesNotMatch(body, /tab==='running'/);
    });
  });

  describe('generic search over cases', () => {
    it('filterCases matches across name, key, method, type, tags, suite name, …', () => {
      // The guard: the bits array lists more than two fields.
      assert.match(APP_JS, /const bits=\[c\.name,c\.key,c\.execution_method,c\.test_type,c\.component,c\.environment,c\.visibility/);
      // Suite names + tags are considered too.
      assert.match(APP_JS, /if\(Array\.isArray\(c\.tags\)\)bits\.push\(c\.tags\.join\(' '\)\)/);
      assert.match(APP_JS, /if\(s\)\{bits\.push\(s\.name,s\.key,s\.suite_type\);\}/);
    });
  });

  describe('deploy stage tile auto-expands the active stage', () => {
    it('deployStatusHtml opens the active (or failed) stage automatically', () => {
      const fn = APP_JS.match(/function deployStatusHtml\(\)\{([\s\S]*?)\n\}/);
      assert.ok(fn, 'deployStatusHtml must be present');
      assert.match(fn![1], /stages\.find\(s=>s\.state==='active'\)/);
      assert.match(fn![1], /stages\.find\(s=>s\.state==='failed'\)/);
      assert.match(fn![1], /pbar-detail-big/);
    });
  });

  describe('Create run page (consolidation of run-now + schedule)', () => {
    it('registers the create-run view in parseHash + dispatch', () => {
      assert.match(APP_JS, /v==='create-run'/);
      assert.match(APP_JS, /renderCreateRunView\(\)/);
    });
    it('adds Create run to the Runs sidebar section (no + prefix for consistency)', () => {
      assert.match(APP_JS, /navItem\('create-run',null,'Create run'\)/);
      // The old label with the +, if left behind, would show inconsistent chrome.
      assert.doesNotMatch(APP_JS, /navItem\('create-run',null,'\+ Create run'\)/);
    });
    it('drops the Test runs sidebar entry (consolidated into Overview + All runs)', () => {
      // The old nav line was: navItem('history',null,'Test runs',…).
      assert.doesNotMatch(APP_JS, /navItem\('history',null,'Test runs'/);
    });
    it('schedule form uses a two-level When: Run now vs Schedule, with Once/Repeating nested', () => {
      // Top-level radios
      assert.match(APP_JS, /name="schedWhen" value="now"/);
      assert.match(APP_JS, /name="schedWhen" value="schedule"/);
      // Nested radios appear only when Schedule is picked
      assert.match(APP_JS, /name="schedScheduleType" value="once"/);
      assert.match(APP_JS, /name="schedScheduleType" value="repeat"/);
      // Must NOT still have the old flat "once" + "repeat" top radios
      assert.doesNotMatch(APP_JS, /name="schedWhen" value="once"/);
      assert.doesNotMatch(APP_JS, /name="schedWhen" value="repeat"/);
    });
    it('readSchedForm maps the two-level radios back to f.when', () => {
      const start = APP_JS.indexOf('function readSchedForm()');
      assert.ok(start > -1);
      const after = APP_JS.indexOf('\nfunction ', start + 1);
      const body = APP_JS.slice(start, after > start ? after : start + 4000);
      assert.match(body, /input\[name="schedWhen"\]:checked/);
      assert.match(body, /input\[name="schedScheduleType"\]:checked/);
    });
    it('the Schedule runs page is read-only (no inline form launcher)', () => {
      const start = APP_JS.indexOf('function renderSchedulesView()');
      assert.ok(start > -1);
      const after = APP_JS.indexOf('\nfunction ', start + 1);
      const body = APP_JS.slice(start, after > start ? after : start + 4000);
      // No more conditional render of the schedule form on this page.
      assert.doesNotMatch(body, /scheduleFormHtml\(\)/);
      // It only lists existing schedules; a link invites the user to Create run.
      assert.match(body, /\+ New schedule/);
    });
    it('submit action goes through create-run-save', () => {
      assert.match(APP_JS, /data-action="create-run-save"/);
      assert.match(APP_JS, /action==='create-run-save'/);
      assert.match(APP_JS, /async function saveCreateRun\(btn\)\{/);
    });
    it('saveCreateRun routes to the right endpoint by runType', () => {
      const start = APP_JS.indexOf('async function saveCreateRun(btn){');
      assert.ok(start > -1);
      const after = APP_JS.indexOf('\nfunction ', start + 1);
      const body = APP_JS.slice(start, after > start ? after : start + 6000);
      // Loop + clean cycle → /cycle-runs
      assert.match(body, /\/api\/v1\/cycle-runs/);
      // Deploy variants → /deployments
      assert.match(body, /\/api\/v1\/deployments/);
      // run_only (default) → /executions
      assert.match(body, /\/api\/v1\/runs/);
      // once/repeat → saveSchedule
      assert.match(body, /saveSchedule\(btn,\{silent:true\}\)/);
    });
    it('shows a "View run →" result card after successful creation', () => {
      assert.match(APP_JS, /function createRunResultHtml\(r\)/);
      assert.match(APP_JS, /View run →/);
    });
    it('autogenerates a schedule / run name when the user leaves it blank', () => {
      // readSchedForm populates f.name; saveCreateRun calls autoScheduleName as the fallback for schedule paths.
      assert.match(APP_JS, /if\(!okName\)f\.name=autoScheduleName\(f\)/);
    });
    it('openScheduleForm now defaults to when:"now" and lives at #/create-run', () => {
      const fn = APP_JS.match(/function openScheduleForm\(preset\)\{([\s\S]*?)\n\}/);
      assert.ok(fn);
      assert.match(fn![1], /when:'now'/);
      assert.match(fn![1], /location\.hash='#\/create-run'/);
    });
  });

  describe('Overview page replaces run buttons with + Create run', () => {
    it('runBtn is an anchor to #/create-run instead of a run-all button', () => {
      // Scan the function body by range (template literals break paren matching).
      const start = APP_JS.indexOf('function overviewActionsAndStatusHtml(');
      assert.ok(start > -1, 'overviewActionsAndStatusHtml must be present');
      const after = APP_JS.indexOf('\nfunction renderOverview', start + 1);
      assert.ok(after > start);
      const body = APP_JS.slice(start, after);
      assert.doesNotMatch(body, /data-action="run-all"/);
      assert.doesNotMatch(body, /data-action="run-types"/);
      assert.doesNotMatch(body, /data-action="deploy-main"/);
      assert.match(body, /href="\$\{esc\(createRunHref\)\}"/);
      assert.match(body, /\+ Create run/);
    });
    it('adds a Recent runs section at the bottom of the Summary tab', () => {
      assert.match(APP_JS, /function overviewRecentRunsHtml\(\)/);
      assert.match(APP_JS, /Recent runs<\/h2>/);
      assert.match(APP_JS, /All runs \(\$\{rl\.total\|\|rows\.length\}\) →/);
    });
    it('loadRunsList fetches the grouped run endpoint (/api/v1/ui/run-groups)', () => {
      const start = APP_JS.indexOf('async function loadRunsList(reset){');
      assert.ok(start > -1);
      const after = APP_JS.indexOf('\nfunction ', start + 1);
      const body = APP_JS.slice(start, after > start ? after : start + 2000);
      assert.match(body, /\/api\/v1\/ui\/run-groups/);
      assert.doesNotMatch(body, /\/api\/v1\/ui\/runs['?]/);
      // The three views that depend on this list re-render on each state change.
      assert.match(body, /state\.view==='history'\|\|state\.view==='overview'\|\|state\.view==='runs-all'/);
    });
    it('Overview Recent runs table shows cumulative counts (Done, Pass/Fail/Queued, worker chip)', () => {
      const start = APP_JS.indexOf('function overviewRecentRunsHtml()');
      assert.ok(start > -1, 'overviewRecentRunsHtml must be present');
      const after = APP_JS.indexOf('\nfunction ', start + 1);
      assert.ok(after > start);
      const body = APP_JS.slice(start, after);
      assert.match(body, /Pass \/ Fail \/ Queued/);
      assert.match(body, /cumulative across workers · one row per run/);
      // Worker chip appears when a run has more than one execution.
      assert.match(body, /workers>1/);
      // Queued count chip renders when the number is > 0.
      assert.match(body, /queued\?`<span><span class="kdot other"/);
    });
  });

  // -----------------------------------------------------------------
  // New in this round: tabs cleanup, banner strip fix, defects SPA,
  // insights holistic summary, insights settings.
  // -----------------------------------------------------------------
  describe('Overview drops the Running now and Run by test type tabs', () => {
    it('overviewTabsHtml is now empty (no tab strip)', () => {
      const fn = APP_JS.match(/function overviewTabsHtml\(_?live\)\{([\s\S]*?)\n\}/);
      assert.ok(fn);
      assert.match(fn![1], /return\s*'';/);
      assert.doesNotMatch(fn![1], /data-action="overview-tab"/);
    });
    it('renderOverview no longer branches on tab = running or types', () => {
      const start = APP_JS.indexOf('function renderOverview()');
      assert.ok(start > -1);
      const after = APP_JS.indexOf('\nfunction ', start + 1);
      const body = APP_JS.slice(start, after);
      assert.doesNotMatch(body, /tab==='running'/);
      assert.doesNotMatch(body, /tab==='types'/);
    });
  });

  describe('Banner dismiss clears the strip for real', () => {
    it('banner() hide helper resets both the hidden attribute AND style.display', () => {
      const fn = APP_JS.match(/function banner\(m,opts\)\{([\s\S]*?)\n\}/);
      assert.ok(fn);
      assert.match(fn![1], /const hide=\(\)=>\{[^}]*b\.hidden=true[^}]*b\.style\.display='none'[^}]*\};/);
      assert.match(fn![1], /btn\.onclick=\(\)=>\{dismissLoop\(opts\.dismissKey\);hide\(\);\};/);
    });
  });

  describe('Defects nav routes stay inside the SPA', () => {
    it('sidebar carries SPA nav-items for Defect log and Defect dashboard', () => {
      assert.match(APP_JS, /navItem\('defect-log',null,'Defect log'/);
      assert.match(APP_JS, /navItem\('defect-dashboard',null,'Defect dashboard'\)/);
      assert.doesNotMatch(APP_JS, /href="\/defect-log"/);
      assert.doesNotMatch(APP_JS, /href="\/defect-log#dashboard"/);
    });
    it('renderDefectLogView and renderDefectDashboardView fetch /api/v1/defect-log', () => {
      assert.match(APP_JS, /function renderDefectLogView\(\)/);
      assert.match(APP_JS, /function renderDefectDashboardView\(\)/);
      assert.match(APP_JS, /\/api\/v1\/defect-log\?application=/);
      assert.match(APP_JS, /\/api\/v1\/defect-log\/dashboard\?application=/);
    });
  });

  describe('Quality Insights holistic summary + settings', () => {
    it('loadInsightsSummary fetches /api/v1/ui/insights-summary', () => {
      assert.match(APP_JS, /\/api\/v1\/ui\/insights-summary\?application_key=/);
      assert.match(APP_JS, /function insightsSummaryHtml\(\)/);
    });
    it('insights.js prepends the holistic summary before the versioned review', () => {
      const insightsJs = readFileSync(path.join(here, '..', 'apps', 'api', 'public', 'catalog', 'insights.js'), 'utf8');
      assert.match(insightsJs, /insightsSummaryHtml==='function'/);
      assert.match(insightsJs, /summaryHtml\+qiHtml\(q\)/);
    });
    it('auto-refresh timer reads the interval from localStorage', () => {
      assert.match(APP_JS, /function scheduleInsightsAutoRefresh\(\)/);
      assert.match(APP_JS, /localStorage\.getItem\('te\.insightsRefreshHours'\)/);
    });
    it('renders an Apply button on each recommendation that carries an apply payload', () => {
      // The map over d.recommendations gates on `r.apply` and emits a
      // data-action="apply-rec" button with the base64 payload on data-apply.
      assert.match(APP_JS, /data-action="apply-rec"[^>]*data-apply="\$\{esc\(btoa\(JSON\.stringify\(r\.apply\)\)\)\}"/);
    });
    it('applyRecommendation routes by apply.kind (run-cases, open-case, open-fix-log, enable-auto-fix, show-instructions)', () => {
      const fn = APP_JS.match(/async function applyRecommendation\(node\)\{([\s\S]*?)\n\}/);
      assert.ok(fn, 'applyRecommendation must be present');
      assert.match(fn![1], /apply\.kind==='open-case'/);
      assert.match(fn![1], /apply\.kind==='open-fix-log'/);
      assert.match(fn![1], /apply\.kind==='show-instructions'/);
      assert.match(fn![1], /apply\.kind==='enable-auto-fix'/);
      assert.match(fn![1], /apply\.kind==='run-cases'/);
      // enable-auto-fix path hits /api/v1/settings; run-cases hits /api/v1/executions.
      assert.match(fn![1], /\/api\/v1\/settings/);
      assert.match(fn![1], /postJson\('\/api\/v1\/executions'/);
    });
    it('apply-rec is dispatched through handleAction', () => {
      assert.match(APP_JS, /action==='apply-rec'[^;]*applyRecommendation/);
    });
    it('Config · Quality insights settings page stores locally only', () => {
      assert.match(APP_JS, /function renderConfigInsightsCard\(/);
      assert.match(APP_JS, /navItem\('config-insights',null,'Quality insights'\)/);
      const fn = APP_JS.match(/async function saveInsightsSettings\(btn\)\{([\s\S]*?)\n\}/);
      assert.ok(fn);
      assert.match(fn![1], /localStorage\.setItem\('te\.insightsRefreshHours'/);
      assert.match(fn![1], /localStorage\.setItem\('te\.anthropicKey'/);
      assert.doesNotMatch(fn![1], /\/api\/v1\/settings/);
    });
  });
});
