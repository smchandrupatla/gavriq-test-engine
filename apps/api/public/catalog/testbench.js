'use strict';
/**
 * Test bench screens — the Test cases / Test suites / Test runs representation
 * adopted from Sand Bench (its test-cases.html, test-case-form.html,
 * test-suites.html and test-suite-form.html), rendered inside the engine
 * console and backed by routes/test-bench.ts + routes/test-cases.ts.
 *
 *   #/test-cases[/<id>]                 list with stat strip, filters, sort, saved views,
 *                                       compact/cards, insights, CSV export; detail panel
 *   #/test-case-form[/new|edit/<id>|clone/<id>]  the create/edit form
 *   #/test-suites[/<id>]                suites with member cases; run, compose, delete
 *   #/test-suite-form                   create a suite
 *   TB.remarksHtml(run)                 the Remarks section of the run screen
 *   TB.caseBodyHtml(...)                the Details tab of #/case/:id
 *
 * Uses the console's globals from app.js (state, el, esc, api, postJson, toast,
 * badge, when, ago, dur, plural, ms, serverNow, currentEnv, queueExecution).
 */
const TB=(()=>{
const PRIORITIES=['Critical','High','Medium','Low'];
const DURATIONS=['Under 1m','1-5m','5-15m','15-60m','60m+'];
const VISIBILITIES=['Public','Team','Private'];
const TRIAGE=['None','Investigating','Assigned','Issue linked','Resolved'];
const PRIORITY_RANK={Critical:0,High:1,Medium:2,Low:3};
const STEP_TEMPLATES={
  login:[{text:'Open the sign-in page',expected:'The sign-in form is shown',testData:''},{text:'Sign in as the demo operator',expected:'The console opens on the Overview page',testData:'demo operator username and password'}],
  api:[{text:'Ask the service for the record',expected:'It answers OK within the agreed time',testData:'see automation link'},{text:'Check the shape of the answer',expected:'Every expected field is present',testData:''}],
  form:[{text:'Fill the form with valid values and save',expected:'A confirmation is shown and the record exists',testData:''},{text:'Submit the form with invalid values',expected:'The errors are shown next to the fields',testData:''}],
};
const S={
  appKey:null,envId:null,loaded:false,loading:false,error:null,cases:[],summary:{},analytics:null,
  search:'',filters:{status:new Set(),priority:new Set(),owner:new Set(),environment:new Set(),tag:new Set(),flakyOnly:false},
  filtersOpen:false,insightsOpen:false,sortKey:'lastRun',sortDir:'desc',viewMode:'compact',selected:new Set(),savedViews:[],
  currentId:null,detail:null,detailRuns:null,detailAudit:null,detailOpenRemarks:new Set(),
  suites:[],suitesLoaded:false,suiteSearch:'',suiteSel:new Set(),suiteCurrent:null,members:new Set(),memberFilter:'',suiteName:'',
  suiteForm:{name:'',members:new Set(),filter:''},
  form:null,
};
try{S.viewMode=localStorage.getItem('tb_view')||'compact';S.savedViews=JSON.parse(localStorage.getItem('tb_saved_views')||'[]');}catch{}

const CSS=`
.tb-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px}
.tb-stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.tb-stat .l{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.tb-stat .v{font-size:22px;font-weight:600;margin-top:2px}.tb-stat .v small{font-size:11px;color:var(--muted);font-weight:400}
.tb-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.tb-toolbar .spacer{flex:1}
.tb-filters{display:none;flex-wrap:wrap;gap:12px 22px;padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:10px;margin-bottom:12px}
.tb-filters.open{display:flex}
.tb-fg{display:flex;flex-direction:column;gap:6px}.tb-fg .fl{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.tb-fg .opts{display:flex;flex-wrap:wrap;gap:5px;max-width:520px}
.tb-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:14px;padding:3px 10px;font-size:11.5px;color:var(--muted);cursor:pointer;background:var(--panel2);white-space:nowrap}
.tb-chip.on{border-color:var(--gold);color:var(--gold-text);background:var(--gold-soft)}
.tb-chip a{color:inherit}
.tb-active{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.tb-insights{display:none;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-bottom:14px}.tb-insights.open{display:grid}
.tb-ibox{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}.tb-ibox h4{margin:0 0 8px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.tb-trend{display:flex;align-items:flex-end;gap:3px;height:70px}.tb-bar{flex:1;display:flex;flex-direction:column-reverse;height:100%}.tb-bar i{display:block;width:100%}.tb-bar .p{background:var(--viz-pass)}.tb-bar .f{background:var(--viz-fail)}
.tb-mttr{font-size:26px;font-weight:600}
.tb-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.tb-layout.with-detail{grid-template-columns:minmax(0,1fr) minmax(360px,440px)}
@media(max-width:1100px){.tb-layout.with-detail{grid-template-columns:minmax(0,1fr)}}
.tb-main-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--line)}
.tb-sel{font-size:11px;letter-spacing:.06em;color:var(--muted)}
.tb-pri{display:inline-flex;align-items:center;gap:6px;font-size:12px}.tb-pri i{width:7px;height:7px;border-radius:50%;display:inline-block}
.tb-pri.Critical i{background:var(--red)}.tb-pri.High i{background:var(--gold)}.tb-pri.Medium i{background:#9d8cf1}.tb-pri.Low i{background:var(--muted2)}
.tb-flaky{font-size:10px;font-weight:700;color:var(--amber);background:var(--amber-soft);border-radius:8px;padding:1px 6px;margin-left:6px}
.tb-row.active td{background:var(--gold-soft)}
.tb-actions{display:flex;gap:4px;white-space:nowrap}.tb-actions .btn{padding:3px 8px;font-size:12px}
.tb-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;padding:14px}
.tb-card{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;cursor:pointer}
.tb-card:hover{border-color:var(--gold)}.tb-card .obj{font-size:12.5px;color:var(--muted)}
.tb-meta{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:var(--muted)}
.tb-detail{background:var(--panel);border:1px solid var(--line);border-radius:10px;align-self:start;position:sticky;top:70px;max-height:calc(100vh - 90px);overflow:auto}
.tb-dhead{padding:12px 14px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:10px}
.tb-dhead .row{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}.tb-dhead .title{flex:1;min-width:0}.tb-dhead .n{font-weight:600;font-size:15px}.tb-dhead .m{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--muted)}
.tb-section{padding:12px 14px;border-bottom:1px solid var(--line-soft)}.tb-section h3{margin:0 0 8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.tb-section h3 .hint{font-weight:400;text-transform:none;letter-spacing:0;margin-left:6px}
.tb-grid{display:grid;grid-template-columns:1fr;gap:8px}.tb-grid .meta .l{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted2)}.tb-grid .meta .v{font-size:13px;overflow-wrap:anywhere}
.tb-steps{margin:0;padding-left:20px;display:grid;gap:8px}.tb-steps li{font-size:13px}.tb-steps .exp{color:var(--green);font-size:12px}.tb-steps .td{color:var(--muted);font-size:12px}.tb-steps .tech{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;color:var(--muted2);overflow-wrap:anywhere}
.tb-triage{display:flex;flex-wrap:wrap;gap:6px}.tb-triage input,.tb-triage select{flex:1;min-width:120px}
.tb-mini{width:100%;border-collapse:collapse;font-size:12px}.tb-mini th{font-size:10px;text-align:left;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:4px 6px;border-bottom:1px solid var(--line)}.tb-mini td{padding:5px 6px;border-bottom:1px solid var(--line-soft);vertical-align:top}
.tb-mini tr.clickable{cursor:pointer}.tb-mini tr.clickable:hover td{background:var(--panel2)}
.tb-remarks{margin:4px 0 0;padding-left:18px;font-size:12px;color:var(--muted)}.tb-remarks li{margin:2px 0}
.tb-note{border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:12.5px;margin-bottom:6px}.tb-note .who{font-size:10.5px;color:var(--muted);margin-bottom:3px}
.tb-form{max-width:1180px;display:flex;flex-direction:column;gap:14px}
.tb-panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.tb-panel h2{font-size:13.5px;margin:0 0 4px}.tb-panel .hint{font-size:11px;color:var(--muted);margin:0 0 10px}
.tb-req{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
.tb-field{display:flex;flex-direction:column;gap:5px;min-width:0}.tb-field.wide{grid-column:1/-1}
.tb-field label{font-size:10.5px;font-weight:700;letter-spacing:.05em;color:var(--muted);text-transform:uppercase}.tb-field .help{font-size:10.5px;color:var(--muted2);text-transform:none;letter-spacing:0;font-weight:400}
.tb-field input[type=text],.tb-field input[type=url],.tb-field textarea,.tb-field select{width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);padding:8px 10px;border-radius:8px;font:inherit}
.tb-field textarea{min-height:70px;resize:vertical}
.tb-id{display:flex;gap:8px;align-items:center}.tb-id .st{font-size:11px;white-space:nowrap}.tb-id .ok{color:var(--green)}.tb-id .bad{color:var(--red)}
.tb-two{display:grid;grid-template-columns:1.6fr 1fr;gap:14px;align-items:start}@media(max-width:900px){.tb-two{grid-template-columns:1fr}}
.tb-col{display:flex;flex-direction:column;gap:14px}
.tb-tagrow{display:flex;flex-wrap:wrap;gap:6px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--panel2)}.tb-tagrow input{border:0;background:transparent;flex:1;min-width:120px;padding:4px;color:var(--text)}
.tb-tag{font-size:11px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:3px 9px;display:flex;align-items:center;gap:6px}.tb-tag button{background:none;border:0;color:var(--muted);cursor:pointer;padding:0;font-size:11px}
.tb-step{border:1px solid var(--line);border-radius:9px;padding:10px 12px;margin-bottom:10px;background:var(--panel2);display:flex;flex-direction:column;gap:8px}
.tb-step .head{display:flex;justify-content:space-between;align-items:center}.tb-step .num{font-weight:700;font-size:11.5px;color:var(--gold-text)}.tb-step .tools{display:flex;gap:4px}.tb-step .tools .btn{padding:3px 8px;font-size:11px}
.tb-step .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}@media(max-width:800px){.tb-step .grid{grid-template-columns:1fr}}
.tb-step .tech{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;color:var(--muted2);overflow-wrap:anywhere}
.tb-repro{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px;font-family:ui-monospace,Consolas,monospace;font-size:11.5px;white-space:pre-wrap;color:var(--muted);max-height:220px;overflow:auto}
.tb-sticky{display:flex;gap:8px;flex-wrap:wrap;align-items:center;position:sticky;bottom:0;background:var(--panel);border-top:1px solid var(--line);padding:12px 16px;border-radius:0 0 10px 10px}
.tb-validation{border-radius:10px;padding:12px 16px;display:none}.tb-validation.show{display:block}.tb-validation.err{background:var(--red-soft);border:1px solid var(--red)}.tb-validation.warn{background:var(--amber-soft);border:1px solid #5a431a}
.tb-validation ul{margin:6px 0 0;padding-left:18px;font-size:12px}.tb-validation .e{color:var(--red)}.tb-validation .w{color:var(--amber)}
.tb-status{font-size:12.5px;color:var(--green);min-height:1.2em;padding:4px 0}.tb-status.err{color:var(--red)}
.tb-pick{max-height:380px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel2);margin-top:6px}
.tb-pick label{display:flex;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--line-soft);font-size:12.5px;cursor:pointer}.tb-pick label:hover{background:var(--panel)}.tb-pick .cid{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;color:var(--muted);margin-left:auto}
.tb-run-remarks{margin:0;padding-left:18px;font-size:12.5px}.tb-run-remarks li{margin:3px 0}.tb-run-remarks li.fail{color:var(--red)}
.tb-rc{border-bottom:1px solid var(--line-soft);padding:10px 16px}.tb-rc:last-child{border-bottom:none}.tb-rc .head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tb-addrem{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 16px;border-top:1px solid var(--line)}.tb-addrem input{flex:1;min-width:220px;background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:7px 10px;color:var(--text)}
.tb-empty{padding:18px;text-align:center;color:var(--muted)}
`;
function ensureCss(){if(document.getElementById('tb-css'))return;const s=document.createElement('style');s.id='tb-css';s.textContent=CSS;document.head.appendChild(s);}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const q=(sel)=>document.querySelector(sel);
const fmtDur=(v)=>{if(v==null||v==='')return '—';v=Number(v);if(!v)return '0s';if(v<1000)return v+'ms';if(v<60000)return (v/1000).toFixed(1)+'s';return Math.floor(v/60000)+'m '+Math.round((v%60000)/1000)+'s';};
const rel=(t)=>t?`<span data-ago="${esc(t)}" title="${esc(when(t))}">${ago(t)}</span>`:'Never';
function statusOf(c){const s=c.run_status||'Not run';return {label:s,tone:s==='Passed'?'passed':s==='Failed'?'failed':s==='Blocked'?'blocked':'never'};}
function statusPill(c){const s=statusOf(c);const flaky=c.flaky?`<span class="tb-flaky" title="${Math.round((c.failure_rate||0)*100)}% of the last ${c.recent_run_count} runs failed">FLAKY ${Math.round((c.failure_rate||0)*100)}%</span>`:'';return `<span class="badge ${s.tone}">${esc(s.label)}</span>${flaky}`;}
function priPill(p){p=p||'Medium';return `<span class="tb-pri ${esc(p)}"><i></i>${esc(p)}</span>`;}
function resultBadge(r){const t=r==='pass'?'passed':r==='fail'?'failed':r==='blocked'?'blocked':'never';return `<span class="badge ${t}">${esc(r||'—')}</span>`;}
function appQ(){return 'application_key='+encodeURIComponent(state.appKey||'sand-bench')+(state.envId?'&environment_id='+encodeURIComponent(state.envId):'');}
function envOptions(sel){return state.environments.map(e=>`<option value="${esc(e.id)}"${(sel||state.envId)===e.id?' selected':''}>${esc(e.name||e.key)}</option>`).join('')||'<option value="">No environment available</option>';}
function envNameOf(ref){const e=state.environments.find(x=>x.id===ref||x.key===ref);return e?(e.name||e.key):(ref||'—');}
function setStatus(msg,isErr){const n=q('#tb-status');if(!n)return;n.textContent=msg||'';n.classList.toggle('err',!!isErr);}
function tagsOf(c){return Array.isArray(c.tags)?c.tags:[];}
function distinct(field){const set=new Set();for(const c of S.cases){if(field==='tag')tagsOf(c).forEach(t=>set.add(t));else if(c[field])set.add(c[field]);}return [...set].sort();}
function safeUrl(u){u=String(u||'').trim();return /^(https?:\/\/|\/(?!\/)|docs\/|apps\/|sit\/)/i.test(u)?u:'#';}
function linkify(u){if(!u)return '—';const s=String(u);return /^https?:\/\//i.test(s)?`<a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a>`:esc(s);}

// ---------------------------------------------------------------------------
// data
// ---------------------------------------------------------------------------
async function loadCases(force){
  const key=state.appKey+'|'+(state.envId||'');
  if(S.loaded&&!force&&S.appKey+'|'+(S.envId||'')===key)return;
  if(S.loading)return;
  S.loading=true;S.error=null;S.appKey=state.appKey;S.envId=state.envId;
  try{
    const [list,summary]=await Promise.all([
      api('/api/v1/test-cases?'+appQ()+'&limit=1000'),
      api('/api/v1/test-cases/summary?'+appQ()).catch(()=>({})),
    ]);
    S.cases=list.data||[];S.summary=summary||{};S.loaded=true;
  }catch(e){S.error=e.message;S.loaded=true;}
  finally{S.loading=false;}
  if(S.insightsOpen&&!S.analytics)loadAnalytics();
}
async function loadAnalytics(){try{S.analytics=await api('/api/v1/test-cases/analytics?'+appQ());}catch{S.analytics={trend:[],flaky:[],mttrHours:null};}if(state.view==='test-cases')render('test-cases');}
async function loadDetail(id){
  S.currentId=id;S.detail=null;S.detailRuns=null;S.detailAudit=null;
  const lite=S.cases.find(c=>c.id===id||c.key===id);
  if(lite)S.detail={...lite,partial:true};
  try{
    const [full,runs]=await Promise.all([
      api('/api/v1/test-cases/'+encodeURIComponent(id)+'?'+(state.envId?'environment_id='+encodeURIComponent(state.envId):'')),
      api('/api/v1/test-cases/'+encodeURIComponent(id)+'/runs?limit=50'+(state.envId?'&environment_id='+encodeURIComponent(state.envId):'')).catch(()=>({data:[],totals:{}})),
    ]);
    if(S.currentId!==id)return;
    S.detail=full.data;S.detailRuns=runs;
    api('/api/v1/audit').then(a=>{if(S.currentId!==id)return;S.detailAudit=(a.data||[]).filter(r=>String(r.resource_id)===String(S.detail.id)||String(r.resource_id)===String(S.detail.key)).slice(0,20);if(state.view==='test-cases')renderDetailOnly();}).catch(()=>{S.detailAudit=[];});
  }catch(e){if(S.currentId===id)S.detail={id,key:id,name:id,error:e.message};}
  if(state.view==='test-cases')render('test-cases');
}
async function loadSuites(force){
  if(S.suitesLoaded&&!force&&S.appKey===state.appKey)return;
  try{S.suites=(await api('/api/v1/test-suites?application_key='+encodeURIComponent(state.appKey||'sand-bench'))).data||[];S.suitesLoaded=true;}
  catch(e){S.suites=[];S.suitesLoaded=true;S.error=e.message;}
}

// ---------------------------------------------------------------------------
// Test cases — list
// ---------------------------------------------------------------------------
function matchesFilters(c){
  const f=S.filters;
  if(f.status.size&&!f.status.has(statusOf(c).label))return false;
  if(f.priority.size&&!f.priority.has(c.priority_label||'Medium'))return false;
  if(f.owner.size&&!f.owner.has(c.owner))return false;
  if(f.environment.size&&!f.environment.has(c.environment))return false;
  if(f.tag.size&&!tagsOf(c).some(t=>f.tag.has(t)))return false;
  if(f.flakyOnly&&!c.flaky)return false;
  return true;
}
function matchesSearch(c){const s=S.search.trim().toLowerCase();if(!s)return true;return [c.key,c.name,c.objective,c.owner,c.environment,c.component].concat(tagsOf(c)).join(' ').toLowerCase().includes(s);}
function visibleRows(){
  const rows=S.cases.filter(c=>matchesSearch(c)&&matchesFilters(c));
  const dir=S.sortDir==='asc'?1:-1;
  rows.sort((a,b)=>{let av,bv,d=dir;
    if(S.sortKey==='lastRun'){av=a.last_run_at||'';bv=b.last_run_at||'';}
    else if(S.sortKey==='failureRate'){av=a.failure_rate==null?-1:a.failure_rate;bv=b.failure_rate==null?-1:b.failure_rate;}
    else if(S.sortKey==='priority'){av=PRIORITY_RANK[a.priority_label||'Medium'];bv=PRIORITY_RANK[b.priority_label||'Medium'];d=S.sortDir==='asc'?-1:1;}
    else if(S.sortKey==='duration'){av=a.last_run_duration_ms==null?-1:Number(a.last_run_duration_ms);bv=b.last_run_duration_ms==null?-1:Number(b.last_run_duration_ms);}
    else{av=(a.name||a.key||'').toLowerCase();bv=(b.name||b.key||'').toLowerCase();}
    return av<bv?-1*d:av>bv?1*d:0;});
  return rows;
}
function activeFilterParts(){const p=[];for(const k of ['status','priority','owner','environment','tag'])if(S.filters[k].size)p.push(k+': '+[...S.filters[k]].join(', '));if(S.filters.flakyOnly)p.push('flaky only');if(S.search.trim())p.push('search: “'+S.search.trim()+'”');return p;}
function clearFilters(){S.filters={status:new Set(),priority:new Set(),owner:new Set(),environment:new Set(),tag:new Set(),flakyOnly:false};S.search='';}

function stripHtml(){
  const s=S.summary||{};const total=s.total!=null?s.total:S.cases.length;const pct=total?Math.round((s.passing||0)/total*100):0;
  return `<div class="tb-strip" role="group" aria-label="Test case summary">
    <div class="tb-stat"><div class="l">Total</div><div class="v">${total}</div></div>
    <div class="tb-stat"><div class="l">Passing</div><div class="v">${s.passing||0} <small>(${pct}%)</small></div></div>
    <div class="tb-stat"><div class="l">Failing</div><div class="v">${s.failing||0}</div></div>
    <div class="tb-stat"><div class="l">Blocked</div><div class="v">${s.blocked||0}</div></div>
    <div class="tb-stat"><div class="l">Not run</div><div class="v">${s.notRun!=null?s.notRun:'—'}</div></div>
    <div class="tb-stat"><div class="l">Last run</div><div class="v" style="font-size:14px">${s.lastRunAt?rel(s.lastRunAt):'Never'}</div></div>
  </div>`;
}
function toolbarHtml(){
  const sortOpts=[['lastRun','Sort: Last run'],['failureRate','Sort: Failure rate'],['priority','Sort: Priority'],['duration','Sort: Duration'],['alpha','Sort: Alphabetical']];
  return `<div class="tb-toolbar">
    <input type="search" id="tb-search" value="${esc(S.search)}" placeholder="Search ID, title, tag…" aria-label="Search test cases" title="Search by case ID, title, objective or tag (press / to focus)" style="width:260px">
    <button class="btn" data-tb="toggle-filters" aria-expanded="${S.filtersOpen}">Filters</button>
    <select id="tb-sort" aria-label="Sort by">${sortOpts.map(([v,l])=>`<option value="${v}"${S.sortKey===v?' selected':''}>${l}</option>`).join('')}</select>
    <button class="btn" data-tb="sort-dir" title="Toggle sort direction">${S.sortDir==='asc'?'↑':'↓'}</button>
    <select id="tb-saved" aria-label="Saved views"><option value="">Saved views…</option>${S.savedViews.map((v,i)=>`<option value="${i}">${esc(v.name)}</option>`).join('')}</select>
    <button class="btn" data-tb="save-view" title="Save the current filters, sort and search as a reusable view">Save view</button>
    <span class="spacer"></span>
    <button class="btn${S.viewMode==='compact'?' primary':''}" data-tb="view-compact" aria-pressed="${S.viewMode==='compact'}">Compact</button>
    <button class="btn${S.viewMode==='cards'?' primary':''}" data-tb="view-cards" aria-pressed="${S.viewMode==='cards'}">Cards</button>
    <button class="btn" data-tb="toggle-insights" aria-expanded="${S.insightsOpen}">Insights</button>
    <button class="btn" data-tb="export-csv" title="Download the currently filtered list as a CSV file">Export CSV</button>
    <a class="btn" href="#/test-case-form" title="Create a new test case">New test case</a>
  </div>`;
}
function filtersHtml(){
  const group=(id,values,set)=>`<div class="tb-fg"><span class="fl">${id}</span><div class="opts">${values.map(v=>`<span class="tb-chip${set.has(v)?' on':''}" data-tb="filter" data-group="${esc(id)}" data-val="${esc(v)}">${esc(v)}</span>`).join('')||'<span class="muted small">None yet</span>'}</div></div>`;
  return `<div class="tb-filters${S.filtersOpen?' open':''}" id="tb-filter-panel">
    ${group('status',['Passed','Failed','Blocked','Not run'],S.filters.status)}
    ${group('priority',PRIORITIES,S.filters.priority)}
    ${group('owner',distinct('owner'),S.filters.owner)}
    ${group('environment',distinct('environment'),S.filters.environment)}
    ${group('tag',distinct('tag').slice(0,60),S.filters.tag)}
    <div class="tb-fg"><span class="fl">Flakiness</span><div class="opts"><span class="tb-chip${S.filters.flakyOnly?' on':''}" data-tb="flaky-only">Flaky only</span></div></div>
    <div class="tb-fg"><span class="fl">&nbsp;</span><button class="btn" data-tb="clear-filters">Clear all</button></div>
  </div>`;
}
function activeFilterHtml(){const p=activeFilterParts();if(!p.length)return '';return `<div class="tb-active">${p.map(x=>`<span class="tb-chip on">${esc(x)}</span>`).join('')}<span class="tb-chip" data-tb="clear-filters">Clear all ×</span></div>`;}
function insightsHtml(){
  if(!S.insightsOpen)return '';
  const a=S.analytics;
  if(!a)return `<div class="tb-insights open"><div class="tb-ibox"><h4>Failure trend · last 14 days</h4><div class="skel" style="height:70px"></div></div></div>`;
  const trend=a.trend||[];const max=Math.max(1,...trend.map(d=>Number(d.passed)+Number(d.failed)));
  const bars=trend.length?trend.map(d=>{const t=Number(d.passed)+Number(d.failed);return `<div class="tb-bar" title="${esc(String(d.day).slice(0,10))}: ${d.passed} passed, ${d.failed} failed"><i class="p" style="height:${t?Number(d.passed)/max*100:0}%"></i><i class="f" style="height:${t?Number(d.failed)/max*100:0}%"></i></div>`;}).join(''):'<span class="muted small">No runs in the last 14 days.</span>';
  const flaky=(a.flaky||[]).length?a.flaky.map(f=>`<div><a href="#/test-cases/${esc(f.id)}">${esc(f.name)}</a> — ${Math.round(f.failureRate*100)}% fail rate</div>`).join(''):'<span class="muted small">No flaky tests detected.</span>';
  const mttr=a.mttrHours!=null?(a.mttrHours<1?Math.round(a.mttrHours*60)+'m':a.mttrHours.toFixed(1)+'h'):'—';
  return `<div class="tb-insights open">
    <div class="tb-ibox"><h4>Failure trend · last 14 days</h4><div class="tb-trend">${bars}</div><p class="muted small" style="margin:6px 0 0">Teal = passed, red = failed, per day.</p></div>
    <div class="tb-ibox"><h4>Flaky tests</h4>${flaky}</div>
    <div class="tb-ibox"><h4>Mean time to green</h4><div class="tb-mttr">${mttr}</div><p class="muted small" style="margin:4px 0 0">Average time between a failed run and the next passed run of the same case.</p></div>
  </div>`;
}
function rowActions(c){return `<div class="tb-actions"><button class="btn" data-tb="run-one" data-id="${esc(c.id)}" title="Queue a run of this test case"${c.execution_method==='manual'?' disabled':''}>Run</button><button class="btn" data-tb="open-runs" data-id="${esc(c.id)}" title="Open the run history of this test case">Debug</button><a class="btn" href="#/test-case-form/edit/${esc(c.id)}" title="Edit this test case">Edit</a></div>`;}
function tableHtml(rows){
  const all=rows.length>0&&rows.every(c=>S.selected.has(c.id));
  const body=rows.map(c=>`<tr class="tb-row${S.currentId===c.id||S.currentId===c.key?' active':''}" data-tb="open-case" data-id="${esc(c.id)}" tabindex="0">
      <td><input type="checkbox" data-tb-pick="${esc(c.id)}"${S.selected.has(c.id)?' checked':''} aria-label="Select ${esc(c.name)}"></td>
      <td><div>${esc(c.name||c.key)}</div><div class="key small">${esc(c.key)}</div>${tagsOf(c).slice(0,6).map(t=>`<span class="tag">${esc(t)}</span> `).join('')}</td>
      <td>${priPill(c.priority_label)}</td><td>${statusPill(c)}</td>
      <td class="muted small">${esc(c.owner||'—')}</td><td class="muted small">${esc(c.environment||'—')}</td>
      <td class="small">${rel(c.last_run_at)}</td><td class="small">${fmtDur(c.last_run_duration_ms)}</td><td>${rowActions(c)}</td></tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr><th><input type="checkbox" data-tb-pickall="1"${all?' checked':''}${rows.length?'':' disabled'} aria-label="Select all visible"></th><th>ID / Title</th><th>Priority</th><th>Status</th><th>Owner</th><th>Env</th><th>Last run</th><th>Duration</th><th>Actions</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
function cardsHtml(rows){
  return `<div class="tb-cards">${rows.map(c=>`<div class="tb-card" data-tb="open-case" data-id="${esc(c.id)}" tabindex="0">
    <div style="display:flex;justify-content:space-between;gap:8px"><div><div style="font-weight:600">${esc(c.name||c.key)}</div><div class="key small">${esc(c.key)}</div></div>${statusPill(c)}</div>
    <div class="obj">${esc(c.objective||'No objective set.')}</div>
    <div class="tb-meta">${priPill(c.priority_label)}<span>${esc(c.owner||'Unassigned')}</span><span>${esc(c.environment||'—')}</span></div>
    <div class="tb-meta"><span>Last run ${rel(c.last_run_at)}</span><span>${fmtDur(c.last_run_duration_ms)}</span></div>${rowActions(c)}</div>`).join('')}</div>`;
}
function listHtml(){
  const rows=visibleRows();
  if(S.error&&!S.cases.length)return `<div class="card tb-empty">Could not load test cases: ${esc(S.error)}</div>`;
  let body;
  if(!S.cases.length)body=`<div class="tb-empty">No test cases yet. Seed the catalog or create one directly.<br><a class="btn" href="#/test-case-form" style="margin-top:8px;display:inline-block">New test case</a></div>`;
  else if(!rows.length)body=`<div class="tb-empty">No test cases match the current filters.<br><button class="btn" data-tb="clear-filters" style="margin-top:8px">Clear filters</button></div>`;
  else body=S.viewMode==='cards'?cardsHtml(rows):tableHtml(rows);
  return `<section class="card" style="margin:0"><div class="tb-main-head"><span class="tb-sel">${String(S.selected.size).padStart(2,'0')} SELECTED</span><span class="muted small">${plural(rows.length,'case')} shown</span><span class="spacer" style="flex:1"></span>
      <button class="btn" data-tb="clear-sel">Clear selection</button>
      <select id="tb-run-env" title="Environment to run the selected cases against">${envOptions()}</select>
      <button class="btn" data-tb="save-suite"${S.selected.size?'':' disabled'}>Save selected as suite</button>
      <button class="btn primary" data-tb="run-selected"${S.selected.size?'':' disabled'}>Run selected${S.selected.size?' ('+S.selected.size+')':''}</button></div>${body}</section>`;
}

// ---------------------------------------------------------------------------
// Test cases — detail panel (also the body of #/case/:id)
// ---------------------------------------------------------------------------
function stepsListHtml(steps,tech){
  if(!Array.isArray(steps)||!steps.length)return '';
  return `<ol class="tb-steps">${steps.map(s=>{
    if(typeof s==='string')return `<li>${esc(s)}</li>`;
    const tline=tech&&s.action?`<div class="tech">${esc(s.action==='request'?`${s.method||'GET'} ${s.url||s.path||''}`:`${s.action}${s.selector?' '+s.selector:''}${s.value?' '+s.value:''}`)}</div>`:'';
    return `<li>${esc(s.text||s.description||s.action||'')}${s.expected?`<div class="exp">→ ${esc(s.expected)}</div>`:''}${s.testData?`<div class="td">Test data: ${esc(s.testData)}</div>`:''}${(s.attachments||[]).map(a=>`<a class="tag" href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">${esc(a.name)}</a>`).join(' ')}${tline}</li>`;}).join('')}</ol>`;
}
function metaGridHtml(c){
  const pairs=[
    ['Objective',esc(c.objective||'—')],['Preconditions',esc(c.preconditions||'—')],['Test data',esc(c.test_data||c.test_data_ref||'—')],
    ['Automation link',linkify(c.automation_link||c.script)],['Dependencies',(c.dependency_ids||[]).length?c.dependency_ids.map(d=>`<a href="#/test-cases/${encodeURIComponent(d)}">${esc(d)}</a>`).join(', '):'—'],
    ['Method / type',esc((c.execution_method||'—')+' · '+(c.test_type||'—'))],['Component',esc(c.component||'—')],['Environment',esc(c.environment||'—')],
    ['Estimated duration',esc(c.estimated_duration||'—')],['Visibility',esc(c.visibility||'Team')],['Owner',esc(c.owner||'—')],['Severity',esc(c.severity||'—')],
    ['Tags',tagsOf(c).map(t=>`<a class="tag" href="#/tag/${encodeURIComponent(t)}">${esc(t)}</a>`).join(' ')||'—'],
    ['Attachments',(c.attachments||[]).map(a=>`<a class="tag" href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">${esc(a.name)}</a>`).join(' ')||'—'],
    ['Expected result',esc(c.expected_results||'—')],
  ];
  return `<div class="tb-grid">${pairs.map(([l,v])=>`<div class="meta"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('')}</div>`;
}
function triageHtml(c){
  return `<div class="tb-triage"><select id="tb-triage-status">${TRIAGE.map(t=>`<option${(c.triage_status||'None')===t?' selected':''}>${t}</option>`).join('')}</select><input type="text" id="tb-assignee" placeholder="Assignee" value="${esc(c.assignee||'')}"><input type="url" id="tb-issue" placeholder="Linked issue URL" value="${esc(c.linked_issue_url||'')}" style="min-width:180px"><button class="btn" data-tb="save-triage" data-id="${esc(c.id)}">Save</button><button class="btn" data-tb="draft-issue" data-id="${esc(c.id)}" title="Copy a pre-filled issue description to the clipboard">Copy issue draft</button></div>`;
}
function runHistoryHtml(runs){
  if(!runs)return '<div class="skel" style="height:60px"></div>';
  const rows=runs.data||[];const t=runs.totals||{};
  const summary=`Ran ${t.ran||0} · passed ${t.passed||0} · failed ${t.failed||0} · blocked ${t.blocked||0}${t.failureRate!=null?' · '+Math.round(t.failureRate*100)+'% of the last 10 failed':''}`;
  const body=rows.length?rows.map(r=>{const open=S.detailOpenRemarks.has(r.id);return `<tr class="clickable" data-tb="toggle-remarks" data-id="${esc(r.id)}"><td><a href="#/run/${esc(r.execution_id)}" title="Open the run">${esc(r.run_id||r.execution_name||'')}</a></td><td>${resultBadge(r.result)}</td><td>${esc(r.environment||'—')}</td><td>${fmtDur(r.duration_ms)}</td><td class="muted">${rel(r.created_at)}</td></tr>${open?`<tr><td colspan="5"><div class="muted small">Triggered by ${esc(r.triggered_by||'—')} · ${esc(r.channel||'—')} runner · ${plural(r.evidence_count||0,'evidence item')}</div><ul class="tb-remarks">${(r.remarks||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>No remarks recorded.</li>'}</ul></td></tr>`:''}`;}).join(''):'<tr><td colspan="5" class="muted">No runs yet. Run this case to produce evidence.</td></tr>';
  return `<h3>Run history <span class="hint">${esc(summary)}</span></h3><table class="tb-mini"><thead><tr><th>Run</th><th>Result</th><th>Env</th><th>Duration</th><th>When</th></tr></thead><tbody>${body}</tbody></table><p class="muted small" style="margin:6px 0 0">Select a run to see its remarks.</p>`;
}
/** Defects raised against this test case: open the defect by key, jump to the run that raised it, see the fix ref. */
function defectsHtml(defects){
  if(defects===null)return '<div class="skel" style="height:60px"></div>';
  if(!defects.length)return '<h3>Defects</h3><p class="muted small">No defects have been logged against this case. When a run fails, the engine files one automatically and sends it to the implementation manager.</p>';
  const TONE={open:'failed',reopened:'failed',acknowledged:'blocked',in_fix:'blocked',fixed:'passed',verified:'passed',wont_fix:'never'};
  const open=defects.filter(d=>d.status!=='verified'&&d.status!=='wont_fix').length;
  const rows=defects.map(d=>{
    const envLabel=d.environment_name||d.environment_key||'—';
    const fix=d.fix_ref?`<a href="${esc(safeUrl(d.fix_ref))}" target="_blank" rel="noopener" title="Fix / commit">${esc(String(d.fix_ref).slice(-14))}</a>`:'—';
    const runLink=d.execution_id?`<a href="#/run/${esc(d.execution_id)}">${esc(d.execution_key||String(d.execution_id).slice(0,8))}</a>`:'—';
    const badge=`<span class="badge ${TONE[d.status]||'never'}">${esc(d.status||'—')}</span>`;
    const reportLink=d.report_key?` <a class="muted small" href="#/defect-log?report=${esc(d.report_key)}" title="Open the defect report">${esc(d.report_key)}</a>`:'';
    return `<tr><td><a href="#/defect-log?defect=${esc(d.key)}" title="Open the defect log">${esc(d.key)}</a>${reportLink}</td><td>${badge}</td><td>${esc(d.severity||'—')}</td><td>${esc(envLabel)}</td><td>${runLink}</td><td>${fix}</td><td class="muted small">${rel(d.updated_at||d.last_seen||d.created_at)}</td></tr>`;
  }).join('');
  const summary=`${defects.length} total · ${open} open`;
  return `<h3>Defects <span class="hint">${esc(summary)}</span></h3><table class="tb-mini"><thead><tr><th>Key</th><th>Status</th><th>Severity</th><th>Env</th><th>Run</th><th>Fix</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function notesHtml(c){
  const notes=(c.notes||[]).slice().reverse();
  return `<div id="tb-notes">${notes.map(n=>`<div class="tb-note"><div class="who">${esc(n.author)} · ${rel(n.at)}</div>${esc(n.text)}</div>`).join('')||'<p class="muted small">No notes yet.</p>'}</div><div class="tb-triage"><input type="text" id="tb-new-note" placeholder="Add a note…" style="flex:1"><button class="btn" data-tb="add-note" data-id="${esc(c.id)}">Add</button></div>`;
}
function detailBodyHtml(c,opts){
  opts=opts||{};
  const suites=Array.isArray(c.suites)?c.suites:[];
  const watchers=Array.isArray(c.watchers)?c.watchers:[];
  const hasTech=Array.isArray(c.steps)&&c.steps.some(s=>s&&typeof s==='object'&&s.action&&s.action!=='performance');
  const activity=S.detailAudit===null?'<span class="muted small">Loading…</span>':S.detailAudit.length?S.detailAudit.map(r=>`<div class="tb-note"><div class="who">${esc(r.action)} · ${rel(r.created_at)}${r.actor_id?' · '+esc(r.actor_id):''}</div></div>`).join(''):'<span class="muted small">No activity recorded yet.</span>';
  return `
    <div class="tb-section"><h3>Summary</h3>${metaGridHtml(c)}</div>
    ${Array.isArray(c.steps)&&c.steps.length?`<div class="tb-section"><h3>Steps <span class="hint">what is done → what should happen</span></h3>${stepsListHtml(c.steps,hasTech)}</div>`:c.script?`<div class="tb-section"><h3>Steps</h3><p class="muted small">Automated script: <code>${esc(c.script)}</code> — the steps are inside the script.</p></div>`:''}
    <div class="tb-section"><h3>Triage <span class="hint">${esc(c.triage_status&&c.triage_status!=='None'?c.triage_status:'')}</span></h3>${triageHtml(c)}</div>
    <div class="tb-section">${runHistoryHtml(opts.runs)}</div>
    <div class="tb-section">${defectsHtml(opts.defects===undefined?null:opts.defects)}</div>
    <div class="tb-section"><h3>Notes</h3>${notesHtml(c)}</div>
    <div class="tb-section"><h3>Watchers <span class="hint">${watchers.length?'('+watchers.length+' watching)':'(none yet)'}</span></h3><button class="btn" data-tb="toggle-watch" data-id="${esc(c.id)}" data-on="${watchers.includes('console')?'1':''}">${watchers.includes('console')?'Watching ✓':'Watch'}</button></div>
    <div class="tb-section"><h3>Suites containing this case</h3>${suites.length?suites.map(s=>`<a class="tb-chip" href="#/test-suites/${esc(s.id)}">${esc(s.name)}</a> `).join(''):'<span class="muted small">Not in any suite yet.</span>'}</div>
    <div class="tb-section"><h3>Activity</h3>${activity}</div>
    ${(c.flakiness_notes||c.known_workarounds||c.common_failure_causes)?`<div class="tb-section"><h3>Triage notes</h3><div class="tb-grid">${[['Flakiness notes',c.flakiness_notes],['Known workarounds',c.known_workarounds],['Common failure causes',c.common_failure_causes]].filter(p=>p[1]).map(([l,v])=>`<div class="meta"><div class="l">${l}</div><div class="v">${esc(v)}</div></div>`).join('')}</div></div>`:''}
    <div class="tb-section"><h3>Technical description</h3><div class="muted small">${esc(c.description||'—')}</div></div>`;
}
function detailHtml(){
  const c=S.detail;
  if(!c)return '';
  if(c.error)return `<aside class="tb-detail"><div class="tb-dhead"><div class="row"><div class="title"><div class="n">Could not load</div><div class="m">${esc(c.error)}</div></div><button class="btn" data-tb="close-detail" aria-label="Close">✕</button></div></div></aside>`;
  return `<aside class="tb-detail" id="tb-detail" aria-label="Test case details">
    <div class="tb-dhead">
      <div class="row"><div class="title"><div class="n">${esc(c.name||c.key)}</div><div class="m">${esc(c.key)}</div></div><div style="display:flex;gap:4px"><a class="btn" href="#/case/${esc(c.id)}" title="Open as a full page">Open ↗</a><button class="btn" data-tb="close-detail" aria-label="Close details" title="Close (Esc)">✕</button></div></div>
      <div class="row"><select id="tb-detail-env" aria-label="Environment for run" style="min-width:140px">${envOptions()}</select><button class="btn primary" data-tb="run-one" data-id="${esc(c.id)}"${c.execution_method==='manual'?' disabled title="A manual case is run by hand: record the outcome as a note"':''}>Run now</button><a class="btn" href="#/test-case-form/clone/${esc(c.id)}" title="Create a new test case pre-filled from this one">New from this case</a><a class="btn" href="#/test-case-form/edit/${esc(c.id)}">Edit</a></div>
      <div class="row">${statusPill(c)}${priPill(c.priority_label)}<span class="muted small">v${esc(c.version||1)} · ${esc(c.status||c.lifecycle||'')}</span></div>
    </div>
    ${c.partial?'<div class="skel" style="height:120px;margin:12px"></div>':detailBodyHtml(c,{runs:S.detailRuns})}
  </aside>`;
}
function renderDetailOnly(){const host=q('#tb-detail');if(!host)return;const wrap=document.createElement('div');wrap.innerHTML=detailHtml();host.replaceWith(wrap.firstElementChild);}

function renderTestCases(){
  el('viewTitle').textContent='Test cases';
  if(!S.loaded||S.loading&&!S.cases.length){el('content').innerHTML=`<div class="kpi-grid">${'<div class="skel" style="height:70px"></div>'.repeat(6)}</div><div class="skel" style="height:320px"></div>`;return;}
  const open=!!S.detail;
  el('content').innerHTML=`<div class="group-head first"><h2>Test cases</h2><span class="muted small">Reusable checks available for test design and execution · ${esc(state.appKey||'')} on ${esc(envNameOf(state.envId))}</span><span style="flex:1"></span><a class="btn primary" href="#/test-case-form" title="Create a new test case">+ New test case</a></div>
    ${stripHtml()}<p class="tb-status" id="tb-status" role="status" aria-live="polite"></p>${toolbarHtml()}${filtersHtml()}${activeFilterHtml()}${insightsHtml()}
    <div class="tb-layout${open?' with-detail':''}">${listHtml()}${open?detailHtml():''}</div>`;
  const search=q('#tb-search');if(search&&document.activeElement!==search&&S.focusSearch){search.focus();S.focusSearch=false;}
}

// ---------------------------------------------------------------------------
// Test case form
// ---------------------------------------------------------------------------
function blankForm(){return {mode:'create',id:null,etag:null,key:'',keyTouched:false,keyStatus:'',name:'',priority:'Medium',owner:'',component:'',environment:'',estimatedDuration:'',visibility:'Team',tags:[],preconditions:'',steps:[],dependencyIds:[],automationLink:'',testData:'',attachments:[],flakinessNotes:'',knownWorkarounds:'',commonFailureCauses:'',objective:'',lastRun:null,validation:null,saving:false,source:null};}
function slugify(s){return String(s||'').toUpperCase().trim().replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'CASE';}
async function openForm(mode,id){
  S.form={...blankForm(),mode:mode==='edit'?'edit':'create',loading:!!id};
  if(mode==='new'||!id){S.form.owner='';render('test-case-form');return;}
  render('test-case-form');
  try{
    const res=await api('/api/v1/test-cases/'+encodeURIComponent(id));const c=res.data;
    const f=S.form;if(!f)return;
    Object.assign(f,{id:mode==='edit'?c.id:null,etag:c.etag,key:mode==='edit'?c.key:slugify(c.key+'-COPY'),name:mode==='edit'?c.name:(c.name||'Case')+' copy',priority:c.priority_label||'Medium',owner:c.owner||'',component:c.component||'',environment:c.environment||'',estimatedDuration:c.estimated_duration||'',visibility:c.visibility||'Team',tags:tagsOf(c).slice(),preconditions:c.preconditions||'',objective:c.objective||'',
      steps:(Array.isArray(c.steps)?c.steps:[]).map(s=>typeof s==='string'?{text:s,expected:'',testData:'',attachments:[]}:{...s,text:s.text||s.description||'',expected:s.expected||'',testData:s.testData||'',attachments:Array.isArray(s.attachments)?s.attachments:[]}),
      dependencyIds:(c.dependency_ids||[]).slice(),automationLink:c.automation_link||c.script||'',testData:c.test_data||'',attachments:(c.attachments||[]).slice(),flakinessNotes:c.flakiness_notes||'',knownWorkarounds:c.known_workarounds||'',commonFailureCauses:c.common_failure_causes||'',source:c,loading:false,
      lastRun:c.last_run_at?{result:c.run_status,at:c.last_run_at}:null});
    if(mode==='edit')f.keyTouched=true;
  }catch(e){S.form.loading=false;S.form.error=e.message;}
  render('test-case-form');
}
function formVal(id){const n=q('#'+id);return n?n.value:'';}
function readForm(){
  const f=S.form;if(!f)return;
  f.name=formVal('tf-title');if(f.mode==='create')f.key=formVal('tf-id');
  const pr=document.querySelector('input[name=tf-priority]:checked');if(pr)f.priority=pr.value;
  const vis=document.querySelector('input[name=tf-visibility]:checked');if(vis)f.visibility=vis.value;
  f.owner=formVal('tf-owner');f.component=formVal('tf-component');f.environment=formVal('tf-environment');f.estimatedDuration=formVal('tf-duration');
  f.objective=formVal('tf-objective');f.preconditions=formVal('tf-preconditions');f.automationLink=formVal('tf-automation');f.testData=formVal('tf-testdata');
  f.flakinessNotes=formVal('tf-flaky');f.knownWorkarounds=formVal('tf-workarounds');f.commonFailureCauses=formVal('tf-causes');
  document.querySelectorAll('[data-tb-step]').forEach(card=>{const i=Number(card.dataset.tbStep);const s=f.steps[i];if(!s)return;s.text=card.querySelector('[data-f=text]').value;s.expected=card.querySelector('[data-f=expected]').value;s.testData=card.querySelector('[data-f=testData]').value;});
}
function reproText(f){
  return ['Environment: '+(f.environment||'—'),'Command / CI job: '+(f.automationLink||'—'),'Test data: '+(f.testData||'—'),'','Steps:'].concat(f.steps.length?f.steps.map((s,i)=>(i+1)+'. '+(s.text||'(no description)')+(s.expected?' → '+s.expected:'')):['  (none yet)']).join('\n');
}
function validateForm(f){
  const errors=[],warnings=[];
  if(!f.name.trim())errors.push('Title is required.');
  if(f.mode==='create'&&f.keyStatus==='bad')errors.push('Test ID: '+(f.keyStatusText||'not usable')+'.');
  if(!f.objective.trim())warnings.push('No objective yet — say in one plain sentence what this test checks and why it matters.');
  if(!f.steps.length)warnings.push('No steps defined yet — the test cannot be replayed without at least one step.');
  f.steps.forEach((s,i)=>{if(!String(s.text||'').trim())warnings.push('Step '+(i+1)+' has no description.');if(!String(s.expected||'').trim())warnings.push('Step '+(i+1)+' is missing an expected result.');});
  if(!f.testData.trim())warnings.push('No overall test data specified.');
  if(!f.automationLink.trim())warnings.push('No automation link set — this case can only be run manually.');
  return {errors,warnings};
}
function stepCardHtml(s,i,n){
  return `<div class="tb-step" data-tb-step="${i}"><div class="head"><span class="num">Step ${i+1}</span><div class="tools"><button class="btn" data-tb="step-up" data-i="${i}"${i===0?' disabled':''} title="Move this step up">↑</button><button class="btn" data-tb="step-down" data-i="${i}"${i===n-1?' disabled':''} title="Move this step down">↓</button><button class="btn" data-tb="step-remove" data-i="${i}" title="Remove this step">✕</button></div></div>
    <div class="grid"><div class="tb-field"><label>Step</label><input type="text" data-f="text" value="${esc(s.text||'')}" title="What is done in this step, in plain words"></div><div class="tb-field"><label>Expected result</label><input type="text" data-f="expected" value="${esc(s.expected||'')}" title="What should happen if this step passes"></div><div class="tb-field"><label>Test data</label><input type="text" data-f="testData" value="${esc(s.testData||'')}" title="Input data used in this step"></div></div>
    ${s.action&&s.action!=='performance'?`<div class="tech">Runs as: ${esc(s.action==='request'?`${s.method||'GET'} ${s.url||s.path||''}`:`${s.action}${s.selector?' '+s.selector:''}${s.value?' '+s.value:''}`)}</div>`:''}
    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">${(s.attachments||[]).map((a,ai)=>`<span class="tb-tag"><a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">${esc(a.name)}</a><button data-tb="step-rm-att" data-i="${i}" data-ai="${ai}" title="Remove this attachment">✕</button></span>`).join('')}<input type="text" data-mini="name" placeholder="Attachment name" style="width:150px"><input type="url" data-mini="url" placeholder="Attachment URL" style="width:200px"><button class="btn" data-tb="step-add-att" data-i="${i}">Add attachment</button></div></div>`;
}
function renderTestCaseForm(){
  const f=S.form;
  el('viewTitle').textContent=f&&f.mode==='edit'?'Edit test case':'New test case';
  if(!f){el('content').innerHTML='<div class="skel" style="height:300px"></div>';return;}
  if(f.loading){el('content').innerHTML='<div class="skel" style="height:300px"></div>';return;}
  if(f.error){el('content').innerHTML=`<div class="card tb-empty">Could not load the test case (${esc(f.error)}). <a href="#/test-cases">Back to test cases</a></div>`;return;}
  const owners=distinct('owner'),components=distinct('component'),tags=distinct('tag');
  const v=f.validation;
  const chips=(name,values,cur)=>values.map(x=>`<label class="tb-chip${cur===x?' on':''}"><input type="radio" name="${name}" value="${esc(x)}"${cur===x?' checked':''} style="display:none">${name==='tf-priority'?`<i class="tb-pri ${esc(x)}"><i></i></i>`:''}${esc(x)}</label>`).join('');
  const status=f.lastRun?`<span class="badge ${f.lastRun.result==='Passed'?'passed':f.lastRun.result==='Failed'?'failed':f.lastRun.result==='Blocked'?'blocked':'never'}">${esc(f.lastRun.result)}</span> <span class="muted small">${rel(f.lastRun.at)}</span>`:'<span class="badge never">Not run</span>';
  el('content').innerHTML=`<div class="group-head first"><div><div class="muted small" style="letter-spacing:.09em;font-weight:700">${f.mode==='edit'?'EDIT TEST CASE':'NEW TEST CASE'}</div><h2 style="font-size:16px;text-transform:none;letter-spacing:0;color:var(--text)">${esc(f.name||(f.mode==='edit'?f.key:'New test case'))}</h2><div class="muted small">Define a test case in plain language so anyone can read it; the executable detail stays with the steps. It can be grouped into suites and run on demand.</div></div><a class="btn" href="#/test-cases">← All test cases</a></div>
  <div class="tb-form" data-tb-form="1">
    <section class="tb-panel tb-req">
      <div class="tb-field wide"><label for="tf-title">Title</label><input type="text" id="tf-title" value="${esc(f.name)}" placeholder="e.g. Login flow test"><span class="help">Short, specific name. Drives the auto-suggested Test ID below.</span></div>
      <div class="tb-field"><label for="tf-id">Test ID</label><div class="tb-id"><input type="text" id="tf-id" value="${esc(f.key)}"${f.mode==='edit'?' disabled':''}><span class="st ${f.keyStatus==='ok'?'ok':f.keyStatus==='bad'?'bad':''}">${esc(f.keyStatusText||'')}</span></div><span class="help">${f.mode==='edit'?'Test IDs cannot be changed after creation.':'Auto-suggested from the title; editable until saved.'}</span></div>
      <div class="tb-field"><label>Priority</label><div style="display:flex;flex-wrap:wrap;gap:5px">${chips('tf-priority',PRIORITIES,f.priority)}</div></div>
      <div class="tb-field"><label>Status</label><div>${status}</div><span class="help">Read-only — set by run results, not edited here.</span></div>
      <div class="tb-field"><label for="tf-owner">Owner</label><input type="text" id="tf-owner" value="${esc(f.owner)}" list="tf-owner-list"><datalist id="tf-owner-list">${owners.map(o=>`<option value="${esc(o)}">`).join('')}</datalist></div>
      <div class="tb-field"><label for="tf-component">Component</label><input type="text" id="tf-component" value="${esc(f.component)}" list="tf-component-list" placeholder="e.g. API, Web console"><datalist id="tf-component-list">${components.map(o=>`<option value="${esc(o)}">`).join('')}</datalist></div>
      <div class="tb-field"><label for="tf-environment">Environment</label><input type="text" id="tf-environment" value="${esc(f.environment)}" list="tf-env-list" placeholder="environment key"><datalist id="tf-env-list">${state.environments.map(e=>`<option value="${esc(e.key)}">${esc(e.name||'')}</option>`).join('')}</datalist></div>
      <div class="tb-field"><label for="tf-duration">Estimated duration</label><select id="tf-duration"><option value="">—</option>${DURATIONS.map(d=>`<option${f.estimatedDuration===d?' selected':''}>${d}</option>`).join('')}</select></div>
      <div class="tb-field wide"><label>Tags</label><div class="tb-tagrow" id="tf-tags">${f.tags.map((t,i)=>`<span class="tb-tag">${esc(t)}<button data-tb="rm-tag" data-i="${i}" title="Remove this tag">✕</button></span>`).join('')}<input type="text" id="tf-tag-input" list="tf-tag-list" placeholder="Type a tag and press Enter (release, sprint, regression, smoke…)"></div><datalist id="tf-tag-list">${tags.slice(0,80).map(t=>`<option value="${esc(t)}">`).join('')}</datalist></div>
      <div class="tb-field wide"><label>Visibility</label><div style="display:flex;gap:5px">${chips('tf-visibility',VISIBILITIES,f.visibility)}</div></div>
      <div class="tb-field wide"><label for="tf-objective">Objective</label><textarea id="tf-objective" placeholder="In one or two plain sentences: what this test checks and why it matters. No addresses, codes or selectors — those go in the steps.">${esc(f.objective)}</textarea></div>
    </section>
    <div class="tb-two"><div class="tb-col">
      <section class="tb-panel"><h2>Preconditions</h2><p class="hint">What must be true before this test can run.</p><textarea id="tf-preconditions" class="tb-field" style="width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);padding:8px 10px;border-radius:8px;min-height:70px" placeholder="e.g. The demo operator account exists and is not locked.">${esc(f.preconditions)}</textarea></section>
      <section class="tb-panel"><h2>Steps</h2><p class="hint">Numbered steps with an expected result and test data each. Attach reference files by link.</p><div id="tf-steps">${f.steps.map((s,i)=>stepCardHtml(s,i,f.steps.length)).join('')||'<p class="hint">No steps yet — add at least one.</p>'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn" data-tb="add-step">+ Add step</button><select id="tf-template"><option value="">Insert template…</option><option value="login">Login flow</option><option value="api">API smoke</option><option value="form">Form validation</option></select><button class="btn" data-tb="insert-template">Insert</button></div></section>
      <section class="tb-panel"><h2>Dependencies</h2><p class="hint">Related test cases this one depends on.</p><div class="tb-tagrow">${f.dependencyIds.map((d,i)=>`<span class="tb-tag">${esc((S.cases.find(c=>c.id===d||c.key===d)||{}).name||d)}<button data-tb="rm-dep" data-i="${i}">✕</button></span>`).join('')}<input type="text" id="tf-dep-input" list="tf-case-list" placeholder="Search by title or ID, press Enter"></div><datalist id="tf-case-list">${S.cases.slice(0,500).map(c=>`<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</datalist></section>
    </div><div class="tb-col">
      <section class="tb-panel"><h2>Automation link</h2><p class="hint">CI job URL or the exact script/command that runs this case.</p><input type="text" id="tf-automation" value="${esc(f.automationLink)}" placeholder="https://ci.example/job/… or apps/api/src/catalog/…#KEY" style="width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);padding:8px 10px;border-radius:8px"><p style="margin:8px 0 0"><button class="btn" data-tb="validate-link">Validate format</button> <span id="tf-link-status" class="small"></span></p></section>
      <section class="tb-panel"><h2>Repro instructions</h2><p class="hint">Auto-generated from the fields above.</p><div class="tb-repro" id="tf-repro">${esc(reproText(f))}</div><p style="margin:8px 0 0"><button class="btn" data-tb="copy-repro">Copy</button></p></section>
      <section class="tb-panel"><h2>Overall test data</h2><textarea id="tf-testdata" style="width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);padding:8px 10px;border-radius:8px;min-height:70px" placeholder="e.g. demo operator account; one generated message per run">${esc(f.testData)}</textarea></section>
      <section class="tb-panel"><h2>Attachments</h2><p class="hint">Link screenshots, sample data or logs (name + URL — files are not uploaded here).</p><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${f.attachments.map((a,i)=>`<span class="tb-tag"><a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener">${esc(a.name)}</a><button data-tb="rm-att" data-i="${i}">✕</button></span>`).join('')||'<span class="hint">No attachments yet.</span>'}</div><div style="display:flex;gap:6px;flex-wrap:wrap"><input type="text" id="tf-att-name" placeholder="Name" style="flex:1;min-width:120px"><input type="url" id="tf-att-url" placeholder="URL" style="flex:2;min-width:160px"><button class="btn" data-tb="add-att">Add</button></div></section>
      <details class="tb-panel"><summary style="cursor:pointer;font-weight:600;font-size:12.5px">Advanced / triage metadata</summary>
        <div class="tb-field" style="margin-top:8px"><label for="tf-flaky">Flakiness notes</label><textarea id="tf-flaky" placeholder="Known intermittent behaviour">${esc(f.flakinessNotes)}</textarea></div>
        <div class="tb-field" style="margin-top:8px"><label for="tf-workarounds">Known workarounds</label><textarea id="tf-workarounds">${esc(f.knownWorkarounds)}</textarea></div>
        <div class="tb-field" style="margin-top:8px"><label for="tf-causes">Common failure causes</label><textarea id="tf-causes">${esc(f.commonFailureCauses)}</textarea></div></details>
      <section class="tb-panel"><h2>Watchers &amp; notes</h2>${f.mode==='edit'&&f.source?`<p class="hint">${(f.source.watchers||[]).length?(f.source.watchers||[]).length+' watching':'No watchers yet'} · ${plural((f.source.notes||[]).length,'note')} — open the case in Test cases to add notes or watch it.</p>`:'<p class="hint">Save this test case first to add watchers or notes.</p>'}</section>
    </div></div>
    ${f.preview?`<section class="tb-panel"><h2>Preview — how this appears in Test cases</h2><div class="tb-card" style="max-width:360px;cursor:default"><div style="display:flex;justify-content:space-between;gap:8px"><div><div style="font-weight:600">${esc(f.name||'Untitled')}</div><div class="key small">${esc(f.key||'(auto)')}</div></div><span class="badge never">Not run</span></div><div class="obj">${esc(f.objective||f.preconditions||'No objective set.')}</div><div class="tb-meta">${priPill(f.priority)}<span>${esc(f.owner||'Unassigned')}</span><span>${esc(f.environment||'—')}</span></div><div class="tb-meta">${f.tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div></div></section>`:''}
    <div class="tb-validation${v?' show '+(v.errors.length?'err':'warn'):''}" id="tf-validation">${v?`<strong>${v.errors.length?'Fix these before saving:':v.warnings.length?'Non-blocking warnings:':'Looks good — no issues found.'}</strong><ul>${v.errors.map(e=>`<li class="e">${esc(e)}</li>`).join('')}${v.warnings.map(w=>`<li class="w">${esc(w)}</li>`).join('')}</ul>`:''}</div>
    <p class="tb-status" id="tb-status" role="status" aria-live="polite"></p>
    <div class="tb-sticky"><button class="btn" data-tb="preview">Preview</button><button class="btn" data-tb="validate">Validate</button><span style="flex:1"></span><button class="btn" data-tb="save" data-status="draft"${f.saving?' disabled':''}>Save as draft</button><button class="btn" data-tb="save" data-status="active" data-close="1"${f.saving?' disabled':''}>Save and close</button><button class="btn primary" data-tb="save" data-status="active" data-run="1"${f.saving?' disabled':''}>Save and Run</button></div>
  </div>`;
}
const checkKey=debounce(async()=>{
  const f=S.form;if(!f||f.mode!=='create')return;
  const id=formVal('tf-id').trim();
  if(!id){f.keyStatus='';f.keyStatusText='';return;}
  try{const r=await api('/api/v1/test-cases/check-id?id='+encodeURIComponent(id));
    if(!r.validFormat){f.keyStatus='bad';f.keyStatusText='Invalid format';}else if(!r.available){f.keyStatus='bad';f.keyStatusText='Already in use';}else{f.keyStatus='ok';f.keyStatusText='Available';}
  }catch{f.keyStatus='';f.keyStatusText='';}
  const st=q('#tf-id')&&q('#tf-id').nextElementSibling;if(st){st.textContent=f.keyStatusText;st.className='st '+(f.keyStatus==='ok'?'ok':f.keyStatus==='bad'?'bad':'');}
},350);
function formPayload(f){
  return {name:f.name.trim(),id:f.mode==='create'?f.key.trim():undefined,application_key:state.appKey,priority:f.priority,owner:f.owner.trim()||undefined,component:f.component.trim()||undefined,environment:f.environment.trim()||undefined,estimatedDuration:f.estimatedDuration||'',visibility:f.visibility,tags:f.tags,objective:f.objective.trim()||undefined,preconditions:f.preconditions||undefined,
    steps:f.steps.map(s=>({...s,text:String(s.text||'').trim(),expected:String(s.expected||'').trim(),testData:String(s.testData||'').trim(),attachments:s.attachments||[]})),
    dependencyIds:f.dependencyIds,automationLink:f.automationLink.trim()||undefined,testData:f.testData||undefined,attachments:f.attachments,flakinessNotes:f.flakinessNotes||undefined,knownWorkarounds:f.knownWorkarounds||undefined,commonFailureCauses:f.commonFailureCauses||undefined,updated_by:'console',created_by:'console',change_summary:'Edited in the Test case form'};
}
async function saveForm(status,andRun,closeAfter){
  const f=S.form;if(!f)return;readForm();
  f.validation=validateForm(f);
  if(f.validation.errors.length){render('test-case-form');setStatus('Fix the errors above before saving.',true);return;}
  f.saving=true;render('test-case-form');setStatus('Saving…');
  const payload={...formPayload(f),status};
  try{
    let saved;
    if(f.mode==='create'){saved=(await postJson('/api/v1/test-cases',payload)).data;f.mode='edit';f.id=saved.id;f.key=saved.key;f.keyTouched=true;f.etag=saved.etag;history.replaceState(null,'','#/test-case-form/edit/'+encodeURIComponent(saved.id));}
    else{saved=(await api('/api/v1/test-cases/'+encodeURIComponent(f.id),{method:'PUT',headers:{'content-type':'application/json','if-match':f.etag||''},body:JSON.stringify(payload)})).data;f.etag=saved.etag;}
    f.source=saved;f.saving=false;S.loaded=false;
    if(andRun){
      const env=state.envId;
      try{const r=await postJson('/api/v1/test-cases/'+encodeURIComponent(saved.id)+'/run',{environment:env});toast('Saved and run queued for '+saved.key,'#/run/'+r.run.id);pollLive();}
      catch(e){toast('Saved, but could not queue a run: '+e.message);}
    }
    toast('Saved '+saved.key);
    if(closeAfter){location.hash='#/test-cases/'+encodeURIComponent(saved.id);return;}
    render('test-case-form');setStatus('Saved '+saved.key);
  }catch(e){f.saving=false;render('test-case-form');setStatus(e.message,true);}
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------
function suiteStatsHtml(){
  const total=S.suites.length;const covered=new Set();let sum=0;for(const s of S.suites){sum+=(s.case_ids||[]).length;(s.case_ids||[]).forEach(id=>covered.add(id));}
  return `<div class="tb-strip" role="group" aria-label="Test suite summary"><div class="tb-stat"><div class="l">Total suites</div><div class="v">${total}</div></div><div class="tb-stat"><div class="l">Active</div><div class="v">${S.suites.filter(s=>s.status==='active').length}</div></div><div class="tb-stat"><div class="l">Cases covered</div><div class="v">${covered.size}</div></div><div class="tb-stat"><div class="l">Avg. suite size</div><div class="v">${total?(sum/total).toFixed(1):'0'}</div></div></div>`;
}
function casePickHtml(members,filter,prefix){
  const f=(filter||'').toLowerCase().trim();
  const rows=S.cases.filter(c=>!f||(c.name||'').toLowerCase().includes(f)||(c.key||'').toLowerCase().includes(f));
  if(!S.cases.length)return `<p class="muted small" style="margin:6px 4px">No test cases exist yet. <a href="#/test-case-form">Create one</a> first.</p>`;
  const sorted=rows.slice().sort((a,b)=>(members.has(b.id)-members.has(a.id))||(a.key||'').localeCompare(b.key||''));
  return `<div class="tb-pick">${sorted.slice(0,600).map(c=>`<label><input type="checkbox" data-tb-member="${esc(c.id)}" data-prefix="${prefix}"${members.has(c.id)?' checked':''}><span>${esc(c.name)}</span><span class="cid">${esc(c.key)}</span></label>`).join('')}${sorted.length>600?`<p class="muted small" style="padding:6px 10px">${sorted.length-600} more — narrow the filter.</p>`:''}</div>`;
}
function suiteDetailHtml(){
  const s=S.suiteCurrent;if(!s)return '';
  return `<aside class="tb-detail" id="tb-suite-detail"><div class="tb-dhead"><div class="row"><div class="title"><input type="text" id="tb-suite-name" value="${esc(S.suiteName)}" placeholder="Suite name" style="font-size:15px;font-weight:700;width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);padding:6px 8px;border-radius:6px"><div class="m">${esc(s.key)} · ${esc(s.suite_type||'custom')}</div></div></div>
    <div class="row"><select id="tb-suite-env" style="min-width:140px">${envOptions()}</select><button class="btn primary" data-tb="suite-run" data-id="${esc(s.id)}" title="Run all cases in this suite">Run suite</button><button class="btn" data-tb="suite-save" data-id="${esc(s.id)}">Save</button><button class="btn" data-tb="suite-delete" data-id="${esc(s.id)}" style="border-color:var(--red);color:var(--red)">Delete</button><button class="btn" data-tb="suite-close" aria-label="Close">✕</button></div></div>
    <div class="tb-section"><h3>Member cases <span class="hint">(${S.members.size} selected)</span></h3><input type="text" id="tb-member-filter" value="${esc(S.memberFilter)}" placeholder="Filter test cases…" style="width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);padding:7px 10px;border-radius:8px">${casePickHtml(S.members,S.memberFilter,'detail')}</div>
    <div class="tb-section"><h3>Description</h3><div class="muted small">${esc(s.description||'—')}</div></div></aside>`;
}
function renderTestSuites(){
  el('viewTitle').textContent='Test suites';
  if(!S.suitesLoaded||!S.loaded){el('content').innerHTML='<div class="skel" style="height:300px"></div>';return;}
  const f=S.suiteSearch.toLowerCase().trim();
  const rows=S.suites.filter(s=>!f||(s.name||'').toLowerCase().includes(f)||(s.key||'').toLowerCase().includes(f));
  const all=rows.length>0&&rows.every(s=>S.suiteSel.has(s.id));
  const table=rows.length?`<div class="table-wrap"><table><thead><tr><th><input type="checkbox" data-tb-suiteall="1"${all?' checked':''}></th><th>Suite</th><th>Cases</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>${rows.map(s=>`<tr class="tb-row${S.suiteCurrent&&S.suiteCurrent.id===s.id?' active':''}" data-tb="open-suite" data-id="${esc(s.id)}"><td><input type="checkbox" data-tb-suitepick="${esc(s.id)}"${S.suiteSel.has(s.id)?' checked':''}></td><td><div>${esc(s.name||'(untitled)')}</div><div class="key small">${esc(s.key)}</div></td><td>${plural((s.case_ids||[]).length,'case')}</td><td><span class="badge ${s.status==='active'?'passed':'never'}">${esc(s.status||'active')}</span></td><td class="muted small">${esc(when(s.created_at))}</td><td><div class="tb-actions"><button class="btn" data-tb="open-suite" data-id="${esc(s.id)}">Edit</button><a class="btn" href="#/type/${esc(s.suite_type||'other')}/suite/${esc(s.id)}" title="Open this suite's cases and run history">History</a></div></td></tr>`).join('')}</tbody></table></div>`:`<div class="tb-empty">${S.suites.length?'No suites match the search.':'No test suites yet. Group existing test cases into a suite to run them together.'}<br><a class="btn" href="#/test-suite-form" style="margin-top:8px;display:inline-block">New test suite</a></div>`;
  el('content').innerHTML=`<div class="group-head first"><h2>Test suites</h2><span class="muted small">Groups of test cases run together. Open a suite to edit membership or run it.</span></div>${suiteStatsHtml()}<p class="tb-status" id="tb-status" role="status"></p>
    <div class="tb-toolbar"><input type="search" id="tb-suite-search" value="${esc(S.suiteSearch)}" placeholder="Search suite name…" style="width:260px"><span class="spacer"></span><a class="btn" href="#/test-suite-form">New test suite</a></div>
    <div class="tb-layout${S.suiteCurrent?' with-detail':''}"><section class="card" style="margin:0"><div class="tb-main-head"><span class="tb-sel">${String(S.suiteSel.size).padStart(2,'0')} SELECTED</span><span class="spacer" style="flex:1"></span><button class="btn" data-tb="suite-clear-sel">Clear selection</button><button class="btn" data-tb="suite-run-selected"${S.suiteSel.size?'':' disabled'}>Run selected</button><button class="btn" data-tb="suite-compose"${S.suiteSel.size>1?'':' disabled'} title="Combine the selected suites' cases into one new suite">Compose from selected</button><button class="btn" data-tb="suite-delete-selected"${S.suiteSel.size?'':' disabled'} style="border-color:var(--red);color:var(--red)">Delete selected</button></div>${table}</section>${suiteDetailHtml()}</div>`;
}
function openSuite(id){const s=S.suites.find(x=>x.id===id||x.key===id);if(!s)return;S.suiteCurrent=s;S.suiteName=s.name||'';S.members=new Set(s.case_ids||[]);S.memberFilter='';render('test-suites');}
function renderTestSuiteForm(){
  el('viewTitle').textContent='New test suite';
  if(!S.loaded){el('content').innerHTML='<div class="skel" style="height:300px"></div>';return;}
  const f=S.suiteForm;
  el('content').innerHTML=`<div class="group-head first"><h2>New test suite</h2><a class="btn" href="#/test-suites">← All test suites</a></div>
    <div class="tb-form"><section class="tb-panel"><div class="tb-field"><label for="tb-sf-name">Suite name</label><input type="text" id="tb-sf-name" value="${esc(f.name)}" placeholder="e.g. Authentication smoke suite"><span class="help">Name the suite now; add member cases below, or come back later from All test suites.</span></div></section>
    <section class="tb-panel"><div class="tb-field"><label>Member cases <span class="help">(${f.members.size} selected)</span></label><input type="text" id="tb-sf-filter" value="${esc(f.filter)}" placeholder="Filter test cases…">${casePickHtml(f.members,f.filter,'form')}</div></section>
    <p class="tb-status" id="tb-status" role="status"></p><div class="tb-sticky"><button class="btn primary" data-tb="suite-create">Create test suite</button><a class="btn" href="#/test-suites">Cancel</a></div></div>`;
}

// ---------------------------------------------------------------------------
// Run screen — remarks
// ---------------------------------------------------------------------------
function remarksHtml(r){
  const names=new Map((r.cases||[]).map(c=>[c.id,c]));
  const results=(r.results||[]).slice().sort((a,b)=>ms(a.finished_at)-ms(b.finished_at));
  const rows=results.map(x=>{const c=names.get(x.test_case_id)||{name:x.test_case_id,key:''};const list=Array.isArray(x.remarks)&&x.remarks.length?x.remarks:(x.message?String(x.message).split(/;\s+(?=[A-Za-z0-9])/):[]);const bad=x.status!=='passed';
    return `<div class="tb-rc"><div class="head">${badge(x.status)}<b>${esc(c.name)}</b><span class="key small">${esc(c.key)}</span><span class="muted small">${fmtDur(x.duration_ms)}${x.classification?' · '+esc(x.classification):''}</span></div><ul class="tb-run-remarks">${list.map(l=>`<li class="${bad&&/FAILED|Result: (failed|error|timed_out|blocked|skipped)|Not run|Stopped|Cleanup failed/.test(l)?'fail':''}">${esc(l)}</li>`).join('')||'<li class="muted">No remarks recorded.</li>'}</ul></div>`;}).join('');
  const ops=(Array.isArray(r.remarks)?r.remarks:[]).map(x=>`<div class="tb-note"><div class="who">${esc(x.author||'console')} · ${rel(x.at)}</div>${esc(x.text||'')}</div>`).join('');
  return `<div class="card"><div class="card-head"><h2>Remarks</h2><span class="muted small">what happened in each case, in plain words · plus notes from people reviewing the run</span></div>
    ${rows||'<div class="tb-empty">No case has reported yet.</div>'}
    <div style="padding:12px 16px 0"><h3 class="dlg-h">Reviewer remarks</h3>${ops||'<p class="muted small">No remarks added yet.</p>'}</div>
    <div class="tb-addrem"><input type="text" id="tb-remark-text" placeholder="Add a remark about this run… (what you observed, what to do next)"><button class="btn" data-tb="add-run-remark" data-id="${esc(r.id)}">Add remark</button></div></div>`;
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------
async function runOne(id,envId){
  try{const r=await postJson('/api/v1/test-cases/'+encodeURIComponent(id)+'/run',{environment:envId||state.envId,headless:state.headed?false:undefined});toast('Run queued — '+(r.run.name||r.run.key),'#/run/'+r.run.id);pollLive();}
  catch(e){toast('Could not queue run: '+e.message);}
}
async function saveTriage(id){
  const c=S.detail;if(!c)return;
  try{const res=await api('/api/v1/test-cases/'+encodeURIComponent(id)+'/triage',{method:'PATCH',headers:{'content-type':'application/json','if-match':c.etag||''},body:JSON.stringify({triageStatus:formVal('tb-triage-status'),assignee:formVal('tb-assignee'),linkedIssueUrl:formVal('tb-issue')})});
    Object.assign(S.detail,res.data);setStatus('Triage updated');S.loaded=false;await loadCases(true);render('test-cases');}
  catch(e){setStatus('Could not save triage: '+e.message,true);}
}
function issueDraft(c){return 'Title: '+(c.name||c.key)+' is failing\n\nTest case: '+c.key+'\nPriority: '+(c.priority_label||'Medium')+'\nEnvironment: '+(c.environment||'—')+'\nObjective: '+(c.objective||'—')+'\n\nSteps to reproduce:\n'+((c.steps||[]).map((s,i)=>(i+1)+'. '+(typeof s==='string'?s:(s.text||s.description||''))).join('\n')||'See automation link.')+'\n\nAutomation link: '+(c.automation_link||'—');}
async function addNote(id){
  const text=formVal('tb-new-note').trim();if(!text)return;
  try{const res=await postJson('/api/v1/test-cases/'+encodeURIComponent(id)+'/notes',{text,author:'console'});S.detail={...S.detail,...res.data,suites:S.detail.suites};setStatus('Note added');render('test-cases');}
  catch(e){setStatus('Could not add note: '+e.message,true);}
}
async function toggleWatch(id,on){
  try{const res=await postJson('/api/v1/test-cases/'+encodeURIComponent(id)+'/watch',{watch:!on,user:'console'});S.detail.watchers=res.watchers;render('test-cases');}catch(e){setStatus('Could not update watchers: '+e.message,true);}
}
function exportCsv(){
  const cols=['key','name','priority_label','run_status','owner','component','environment','estimated_duration','last_run_at','last_run_duration_ms','objective'];
  const lines=[cols.join(',')].concat(visibleRows().map(r=>cols.map(c=>'"'+String(r[c]==null?'':r[c]).replace(/"/g,'""')+'"').join(',')));
  const blob=new Blob([lines.join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='test-cases-'+Date.now()+'.csv';document.body.appendChild(a);a.click();a.remove();
}
async function saveSelectedAsSuite(){
  const ids=[...S.selected];if(!ids.length)return;const name=(prompt('Name for the new suite:')||'').trim();if(!name)return;
  try{await postJson('/api/v1/test-suites',{name,caseIds:ids,application_key:state.appKey});toast('Saved suite “'+name+'” with '+plural(ids.length,'case'));S.selected=new Set();S.suitesLoaded=false;await loadSummary();renderSideNav();render('test-cases');}
  catch(e){toast('Save suite failed: '+e.message);}
}

async function handle(action,node){
  const id=node.dataset.id;
  switch(action){
    case 'toggle-filters':S.filtersOpen=!S.filtersOpen;render('test-cases');break;
    case 'toggle-insights':S.insightsOpen=!S.insightsOpen;if(S.insightsOpen&&!S.analytics)loadAnalytics();render('test-cases');break;
    case 'filter':{const g=node.dataset.group,v=node.dataset.val;if(S.filters[g].has(v))S.filters[g].delete(v);else S.filters[g].add(v);render('test-cases');break;}
    case 'flaky-only':S.filters.flakyOnly=!S.filters.flakyOnly;render('test-cases');break;
    case 'clear-filters':clearFilters();render('test-cases');break;
    case 'sort-dir':S.sortDir=S.sortDir==='asc'?'desc':'asc';render('test-cases');break;
    case 'view-compact':S.viewMode='compact';try{localStorage.setItem('tb_view','compact');}catch{}render('test-cases');break;
    case 'view-cards':S.viewMode='cards';try{localStorage.setItem('tb_view','cards');}catch{}render('test-cases');break;
    case 'save-view':{const name=(prompt('Name this view:')||'').trim();if(!name)return;S.savedViews.push({name,search:S.search,filters:{status:[...S.filters.status],priority:[...S.filters.priority],owner:[...S.filters.owner],environment:[...S.filters.environment],tag:[...S.filters.tag],flakyOnly:S.filters.flakyOnly},sortKey:S.sortKey,sortDir:S.sortDir});try{localStorage.setItem('tb_saved_views',JSON.stringify(S.savedViews));}catch{}render('test-cases');setStatus('View saved: '+name);break;}
    case 'export-csv':exportCsv();break;
    case 'clear-sel':S.selected=new Set();render('test-cases');break;
    case 'run-selected':{const ids=[...S.selected];if(!ids.length)return;const env=formVal('tb-run-env')||state.envId;try{const r=await postJson('/api/v1/test-cases/run-batch',{ids,environment:env});toast('Queued '+plural(ids.length,'case'),r.runs&&r.runs[0]?'#/run/'+r.runs[0].id:undefined);pollLive();}catch(e){toast('Batch run failed: '+e.message);}break;}
    case 'save-suite':saveSelectedAsSuite();break;
    case 'run-one':{const env=formVal('tb-detail-env')||formVal('tb-run-env')||state.envId;runOne(id,env);break;}
    case 'open-case':location.hash='#/test-cases/'+encodeURIComponent(id);break;
    case 'open-runs':location.hash='#/case/'+encodeURIComponent(id)+'/runs';break;
    case 'close-detail':S.currentId=null;S.detail=null;location.hash='#/test-cases';break;
    case 'toggle-remarks':if(S.detailOpenRemarks.has(id))S.detailOpenRemarks.delete(id);else S.detailOpenRemarks.add(id);renderDetailOnly();break;
    case 'save-triage':saveTriage(id);break;
    case 'draft-issue':{const c=S.detail||S.cases.find(x=>x.id===id);if(!c)return;const ok=await copyText(issueDraft(c));setStatus(ok?'Issue draft copied to clipboard':'Copy failed');break;}
    case 'add-note':addNote(id);break;
    case 'toggle-watch':toggleWatch(id,node.dataset.on==='1');break;
    // form
    case 'add-step':readForm();S.form.steps.push({text:'',expected:'',testData:'',attachments:[]});render('test-case-form');break;
    case 'insert-template':{readForm();const k=formVal('tf-template');if(STEP_TEMPLATES[k])S.form.steps.push(...STEP_TEMPLATES[k].map(s=>({...s,attachments:[]})));render('test-case-form');break;}
    case 'step-up':{readForm();const i=Number(node.dataset.i);const st=S.form.steps;if(i>0){[st[i-1],st[i]]=[st[i],st[i-1]];}render('test-case-form');break;}
    case 'step-down':{readForm();const i=Number(node.dataset.i);const st=S.form.steps;if(i<st.length-1){[st[i+1],st[i]]=[st[i],st[i+1]];}render('test-case-form');break;}
    case 'step-remove':readForm();S.form.steps.splice(Number(node.dataset.i),1);render('test-case-form');break;
    case 'step-add-att':{readForm();const card=node.closest('[data-tb-step]');const n=card.querySelector('[data-mini=name]').value.trim(),u=card.querySelector('[data-mini=url]').value.trim();if(n&&u){const s=S.form.steps[Number(node.dataset.i)];s.attachments=s.attachments||[];s.attachments.push({name:n,url:u});}render('test-case-form');break;}
    case 'step-rm-att':readForm();S.form.steps[Number(node.dataset.i)].attachments.splice(Number(node.dataset.ai),1);render('test-case-form');break;
    case 'rm-tag':readForm();S.form.tags.splice(Number(node.dataset.i),1);render('test-case-form');break;
    case 'rm-dep':readForm();S.form.dependencyIds.splice(Number(node.dataset.i),1);render('test-case-form');break;
    case 'rm-att':readForm();S.form.attachments.splice(Number(node.dataset.i),1);render('test-case-form');break;
    case 'add-att':{readForm();const n=formVal('tf-att-name').trim(),u=formVal('tf-att-url').trim();if(n&&u)S.form.attachments.push({name:n,url:u});render('test-case-form');break;}
    case 'validate-link':{const v=formVal('tf-automation').trim();const st=q('#tf-link-status');if(!st)return;if(!v){st.textContent='Enter a link or command first.';st.style.color='var(--muted)';return;}const isUrl=/^https?:\/\/\S+$/i.test(v);const isScript=/^[\w./-]+\.(spec|test|sit)\.(ts|js|py)(::.*)?$/i.test(v)||/\.feature$/i.test(v)||/^[\w./-]+\.(sh|py|ts|js)(#[\w-]+)?( \(.*\))?$/i.test(v);st.textContent=isUrl||isScript?'✓ Looks like a valid '+(isUrl?'CI job URL':'script path')+' (format check only).':'✗ Does not look like a URL or a recognisable script path.';st.style.color=isUrl||isScript?'var(--green)':'var(--red)';break;}
    case 'copy-repro':{readForm();const ok=await copyText(reproText(S.form));setStatus(ok?'Repro instructions copied':'Copy failed');break;}
    case 'preview':readForm();S.form.preview=!S.form.preview;render('test-case-form');break;
    case 'validate':readForm();S.form.validation=validateForm(S.form);render('test-case-form');break;
    case 'save':saveForm(node.dataset.status||'active',node.dataset.run==='1',node.dataset.close==='1');break;
    // suites
    case 'open-suite':openSuite(id);break;
    case 'suite-close':S.suiteCurrent=null;render('test-suites');break;
    case 'suite-clear-sel':S.suiteSel=new Set();render('test-suites');break;
    case 'suite-save':{const name=formVal('tb-suite-name').trim();if(!name){setStatus('Suite name is required.',true);return;}setStatus('Saving…');try{await api('/api/v1/test-suites/'+encodeURIComponent(id),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({name,caseIds:[...S.members]})});setStatus('Saved.');await loadSuites(true);openSuite(id);await loadSummary();renderSideNav();}catch(e){setStatus('Save failed: '+e.message,true);}break;}
    case 'suite-delete':{if(!confirm('Delete this test suite? This cannot be undone.'))return;try{await api('/api/v1/test-suites/'+encodeURIComponent(id),{method:'DELETE'});toast('Suite deleted');S.suiteCurrent=null;await loadSuites(true);await loadSummary();renderSideNav();render('test-suites');}catch(e){setStatus('Delete failed: '+e.message,true);}break;}
    case 'suite-run':{const env=formVal('tb-suite-env')||state.envId;try{const r=await postJson('/api/v1/test-suites/'+encodeURIComponent(id)+'/run',{environment:env});toast('Queued '+plural(r.outcome.ranCases,'case')+' — '+(r.run.name||r.run.key),'#/run/'+r.run.id);pollLive();}catch(e){setStatus('Run failed: '+e.message,true);}break;}
    case 'suite-run-selected':{const ids=[...S.suiteSel];if(!ids.length)return;try{const r=await postJson('/api/v1/test-suites/run-batch',{ids,environment:state.envId});toast('Queued '+plural(r.runs.length,'suite run'));pollLive();}catch(e){setStatus('Run failed: '+e.message,true);}break;}
    case 'suite-compose':{if(S.suiteSel.size<2){setStatus('Select at least two test suites to compose.',true);return;}const name=(prompt('Name for the combined suite:','Combined suite')||'').trim();if(!name)return;try{const r=await postJson('/api/v1/test-suites/from-suites',{name,suiteIds:[...S.suiteSel]});setStatus('Composed “'+name+'” with '+plural((r.case_ids||[]).length,'case'));S.suiteSel=new Set();await loadSuites(true);await loadSummary();renderSideNav();render('test-suites');}catch(e){setStatus('Compose failed: '+e.message,true);}break;}
    case 'suite-delete-selected':{const ids=[...S.suiteSel];if(!ids.length)return;if(!confirm('Delete '+ids.length+' selected test suite(s)? This cannot be undone.'))return;for(const sid of ids){await api('/api/v1/test-suites/'+encodeURIComponent(sid),{method:'DELETE'}).catch(()=>null);}S.suiteSel=new Set();if(S.suiteCurrent&&ids.includes(S.suiteCurrent.id))S.suiteCurrent=null;await loadSuites(true);await loadSummary();renderSideNav();render('test-suites');setStatus('Deleted '+plural(ids.length,'suite'));break;}
    case 'suite-create':{const name=formVal('tb-sf-name').trim();if(!name){setStatus('Suite name is required.',true);q('#tb-sf-name').focus();return;}setStatus('Creating…');try{const r=await postJson('/api/v1/test-suites',{name,caseIds:[...S.suiteForm.members],application_key:state.appKey});S.suiteForm={name:'',members:new Set(),filter:''};S.suitesLoaded=false;await loadSummary();renderSideNav();location.hash='#/test-suites/'+encodeURIComponent(r.id||(r.data&&r.data.id));}catch(e){setStatus('Create failed: '+e.message,true);}break;}
    // run screen
    case 'add-run-remark':{const text=formVal('tb-remark-text').trim();if(!text)return;try{await postJson('/api/v1/executions/'+encodeURIComponent(id)+'/remarks',{text,author:'console'});toast('Remark added');await loadRun(state.runId);renderCurrentView();}catch(e){toast('Could not add remark: '+e.message);}break;}
  }
}

function wire(){
  if(wire.done)return;wire.done=true;
  const content=el('content');
  content.addEventListener('click',e=>{
    const n=e.target.closest('[data-tb]');if(!n||!content.contains(n))return;
    if(e.target.closest('a,input,select,textarea,button')&&!e.target.closest('button[data-tb],span[data-tb],.tb-chip[data-tb]')&&n.tagName!=='BUTTON'){return;}
    if(n.disabled)return;
    e.preventDefault();handle(n.dataset.tb,n);
  });
  content.addEventListener('change',e=>{
    const t=e.target;
    if(t.id==='tb-sort'){S.sortKey=t.value;render('test-cases');return;}
    if(t.id==='tb-saved'){const v=S.savedViews[Number(t.value)];if(!v)return;S.search=v.search||'';S.filters={status:new Set(v.filters.status),priority:new Set(v.filters.priority),owner:new Set(v.filters.owner),environment:new Set(v.filters.environment),tag:new Set(v.filters.tag),flakyOnly:!!v.filters.flakyOnly};S.sortKey=v.sortKey||'lastRun';S.sortDir=v.sortDir||'desc';render('test-cases');return;}
    if(t.dataset.tbPick){if(t.checked)S.selected.add(t.dataset.tbPick);else S.selected.delete(t.dataset.tbPick);render('test-cases');return;}
    if(t.dataset.tbPickall){visibleRows().forEach(c=>{if(t.checked)S.selected.add(c.id);else S.selected.delete(c.id);});render('test-cases');return;}
    if(t.dataset.tbSuitepick){if(t.checked)S.suiteSel.add(t.dataset.tbSuitepick);else S.suiteSel.delete(t.dataset.tbSuitepick);render('test-suites');return;}
    if(t.dataset.tbSuiteall){const f=S.suiteSearch.toLowerCase().trim();S.suites.filter(s=>!f||(s.name||'').toLowerCase().includes(f)).forEach(s=>{if(t.checked)S.suiteSel.add(s.id);else S.suiteSel.delete(s.id);});render('test-suites');return;}
    if(t.dataset.tbMember){const set=t.dataset.prefix==='form'?S.suiteForm.members:S.members;if(t.checked)set.add(t.dataset.tbMember);else set.delete(t.dataset.tbMember);const hint=content.querySelector(t.dataset.prefix==='form'?'.tb-field .help':'.tb-section h3 .hint');if(hint)hint.textContent='('+set.size+' selected)';return;}
    if(t.closest('[data-tb-form]')){readForm();if(t.name==='tf-priority'||t.name==='tf-visibility'||t.id==='tf-duration')render('test-case-form');const rp=q('#tf-repro');if(rp)rp.textContent=reproText(S.form);}
  });
  content.addEventListener('input',e=>{
    const t=e.target;
    if(t.id==='tb-search'){S.search=t.value;clearTimeout(S.searchTimer);S.searchTimer=setTimeout(()=>{S.focusSearch=true;render('test-cases');},180);return;}
    if(t.id==='tb-suite-search'){S.suiteSearch=t.value;clearTimeout(S.searchTimer);S.searchTimer=setTimeout(()=>{render('test-suites');const n=q('#tb-suite-search');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length);}},180);return;}
    if(t.id==='tb-member-filter'){S.memberFilter=t.value;clearTimeout(S.searchTimer);S.searchTimer=setTimeout(()=>{const host=q('#tb-suite-detail .tb-pick');if(host){const w=document.createElement('div');w.innerHTML=casePickHtml(S.members,S.memberFilter,'detail');host.replaceWith(w.firstElementChild);}},180);return;}
    if(t.id==='tb-sf-filter'){S.suiteForm.filter=t.value;clearTimeout(S.searchTimer);S.searchTimer=setTimeout(()=>{const host=content.querySelector('.tb-pick');if(host){const w=document.createElement('div');w.innerHTML=casePickHtml(S.suiteForm.members,S.suiteForm.filter,'form');host.replaceWith(w.firstElementChild);}},180);return;}
    if(t.id==='tb-sf-name'){S.suiteForm.name=t.value;return;}
    if(t.id==='tb-suite-name'){S.suiteName=t.value;return;}
    if(t.closest('[data-tb-form]')){
      if(t.id==='tf-title'&&S.form&&S.form.mode==='create'&&!S.form.keyTouched){const idn=q('#tf-id');if(idn){idn.value=slugify(t.value);checkKey();}}
      if(t.id==='tf-id'&&S.form){S.form.keyTouched=true;checkKey();}
      if(['tf-environment','tf-automation','tf-testdata'].includes(t.id)||t.dataset.f==='text'||t.dataset.f==='expected'){readForm();const rp=q('#tf-repro');if(rp)rp.textContent=reproText(S.form);}
    }
  });
  content.addEventListener('keydown',e=>{
    const t=e.target;
    if(t.id==='tf-tag-input'&&(e.key==='Enter'||e.key===',')){e.preventDefault();readForm();const v=t.value.trim().replace(/,$/,'');if(v&&!S.form.tags.includes(v))S.form.tags.push(v);render('test-case-form');q('#tf-tag-input')&&q('#tf-tag-input').focus();return;}
    if(t.id==='tf-dep-input'&&e.key==='Enter'){e.preventDefault();readForm();const v=t.value.trim();const hit=S.cases.find(c=>c.key===v||c.id===v||(c.name||'').toLowerCase()===v.toLowerCase());if(hit&&!S.form.dependencyIds.includes(hit.key)){S.form.dependencyIds.push(hit.key);render('test-case-form');q('#tf-dep-input')&&q('#tf-dep-input').focus();}else setStatus('No matching test case found for “'+v+'”',true);return;}
    if(e.key==='Enter'&&t.matches('.tb-row[data-tb],.tb-card[data-tb]')){handle(t.dataset.tb,t);}
  });
  document.addEventListener('keydown',e=>{
    if(state.view!=='test-cases')return;
    const tag=(e.target.tagName||'').toLowerCase();const typing=tag==='input'||tag==='textarea'||tag==='select';
    if(e.key==='/'&&!typing){e.preventDefault();const s=q('#tb-search');if(s)s.focus();}
    else if(e.key==='Escape'&&S.detail){S.currentId=null;S.detail=null;location.hash='#/test-cases';}
  });
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&state.view==='test-case-form'&&S.form){e.preventDefault();saveForm('draft',false,false);}});
}

// ---------------------------------------------------------------------------
// entry points
// ---------------------------------------------------------------------------
async function render(view){
  ensureCss();wire();
  if(view==='test-cases')renderTestCases();
  else if(view==='test-case-form')renderTestCaseForm();
  else if(view==='test-suites')renderTestSuites();
  else if(view==='test-suite-form')renderTestSuiteForm();
}
/** Called by the console router: loads what the view needs, then renders. */
async function route(view,mode,arg){
  ensureCss();wire();
  if(S.appKey!==state.appKey||S.envId!==state.envId){S.loaded=false;S.suitesLoaded=false;S.analytics=null;S.selected=new Set();S.detail=null;S.currentId=null;}
  render(view);
  if(view==='test-cases'){
    await loadCases();render(view);
    if(mode){if(S.currentId!==mode||!S.detail||S.detail.partial)await loadDetail(mode);}
    else if(S.detail){S.detail=null;S.currentId=null;render(view);}
  }else if(view==='test-case-form'){
    await loadCases();
    const m=mode||'new';
    if(!S.form||S.form.routeKey!==m+':'+(arg||'')){await openForm(m,arg);if(S.form)S.form.routeKey=m+':'+(arg||'');}
    else render(view);
  }else if(view==='test-suites'){
    await Promise.all([loadCases(),loadSuites()]);
    if(mode&&(!S.suiteCurrent||(S.suiteCurrent.id!==mode&&S.suiteCurrent.key!==mode)))openSuite(mode);
    else render(view);
  }else if(view==='test-suite-form'){await loadCases();render(view);}
}
/** The Details tab body of #/case/:id, in the Test cases screen representation. */
function caseBodyHtml(c,extras){
  ensureCss();
  // Snapshot the case key on the extras cache so defect queries can scope by case_key (indexed).
  if(S.caseExtras&&S.caseExtras.id===c.id&&!S.caseExtras.caseKey)S.caseExtras.caseKey=c.key;
  const appChip=c.application?`<a class="tb-chip" href="#/overview" title="Application">📦 ${esc(c.application.name||c.application.key)}</a>`:'';
  return `<div class="tb-dhead" style="border-bottom:none"><div class="row">${statusPill(c)}${priPill(c.priority_label)}<span class="muted small">v${esc(c.version||1)} · ${esc(c.status||c.lifecycle||'')} · ${esc(c.execution_method||'')}</span>${appChip}<span style="flex:1"></span><a class="btn" href="#/test-case-form/edit/${esc(c.id)}">Edit</a><a class="btn" href="#/test-case-form/clone/${esc(c.id)}">New from this case</a></div></div>${detailBodyHtml(c,extras||{})}`;
}
/** Run history + defects + audit for #/case/:id: returns what is cached now and re-renders the page when the rest arrives. */
function loadCaseExtras(id){
  if(S.caseExtras&&S.caseExtras.id===id)return S.caseExtras;
  const extras={id,runs:null,defects:null};
  S.caseExtras=extras;S.currentId=id;S.detailAudit=null;
  (async()=>{
    try{extras.runs=await api('/api/v1/test-cases/'+encodeURIComponent(id)+'/runs?limit=50'+(state.envId?'&environment_id='+encodeURIComponent(state.envId):''));}catch{extras.runs={data:[],totals:{}};}
    if(state.view==='case'&&state.caseId===id)renderCurrentView();
    // Defects raised by this case's runs. Scope by case_key when available so the API can hit the index.
    try{
      const q=S.caseExtras&&S.caseExtras.caseKey?('case_key='+encodeURIComponent(S.caseExtras.caseKey)):('test_case_id='+encodeURIComponent(id));
      const res=await api('/api/v1/defects?'+q+'&limit=200');
      extras.defects=res.data||[];
    }catch{extras.defects=[];}
    if(state.view==='case'&&state.caseId===id)renderCurrentView();
    try{const a=await api('/api/v1/audit');S.detailAudit=(a.data||[]).filter(r=>String(r.resource_id)===String(id)).slice(0,20);}catch{S.detailAudit=[];}
    if(state.view==='case'&&state.caseId===id)renderCurrentView();
  })();
  return extras;
}
function invalidate(){S.loaded=false;S.suitesLoaded=false;S.analytics=null;S.caseExtras=null;}
return {render,route,remarksHtml,caseBodyHtml,loadCaseExtras,invalidate,handle,state:S};
})();
