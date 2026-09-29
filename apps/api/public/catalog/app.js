'use strict';
const TYPES=[
{id:'unit',title:'Unit tests',summary:'Field-level validation in isolation.',category:'qa'},
{id:'integration',title:'Integration tests',summary:'Cross-service message and API flows.',category:'qa'},
{id:'screen',title:'Screen tests',summary:'Console and desk UI flows.',category:'qa'},
{id:'usecase',title:'Use case driven tests',summary:'Control-owner acceptance paths.',category:'qa'},
{id:'regression',title:'Regression tests',summary:'Full suite re-run after changes.',category:'qa'},
{id:'smoke',title:'Smoke tests',summary:'Fast pass/fail gate before a full cycle.',category:'qa'},
{id:'dataQuality',title:'Data quality tests',summary:'Synthetic payload integrity.',category:'qa'},
{id:'selenium-baseline',title:'Selenium Baseline',summary:'Selenium GUI automation baseline checks.',category:'qa'},
{id:'endurance',title:'Endurance tests',summary:'Bounded soak against the stack.',category:'qc'},
{id:'performance',title:'Performance tests',summary:'Latency and throughput benchmarks.',category:'qc'},
{id:'rollingUpgrade',title:'Rolling upgrade tests',summary:'Rule and schema version compatibility.',category:'qc'},
{id:'nonFunctional',title:'Non-functional tests',summary:'Security, resilience, compliance.',category:'qc'},
{id:'vulnerabilityScanning',title:'Vulnerability scanning',summary:'Automated scans for known weaknesses.',category:'qc'},
{id:'penTesting',title:'Penetration tests',summary:'Simulated attacks on console and portals.',category:'qc'},
{id:'compatibility',title:'Compatibility tests',summary:'Cross-version message format checks.',category:'qc'},
{id:'chaos',title:'Chaos & failover tests',summary:'Outage and network-fault injection.',category:'qc'},
{id:'compliance',title:'Compliance tests',summary:'Regulatory rule packs and screening lists.',category:'qc'},
{id:'drRecovery',title:'DR recovery & self-healing',summary:'Failover and automatic recovery.',category:'qc'}
];
const SIT_GROUPS=[
{id:'sit-health',title:'Health',summary:'Post-deploy reachability.',keys:['sit-health']},
{id:'sit-integration',title:'Integration',summary:'MQ, Kafka, API, worker, DB.',keys:['sit-mq','sit-kafka','sit-api','sit-worker','sit-db','sit-use-case-api']},
{id:'sit-gui',title:'GUI / Screens',summary:'Selenium and Playwright UI.',keys:['sit-gui-smoke','sit-ui-eventing','sit-selenium-screens','sit-selenium-fields','sit-selenium-workflows','sit-use-case-ui','sit-official-clicks','sit-feature-access','sit-console-chrome','sit-ui-pages','sit-ui-workflows']},
{id:'sit-e2e',title:'End-to-end',summary:'Full UX paths.',keys:['sit-e2e-ux']},
{id:'sit-security',title:'Security',summary:'Auth, headers, vuln, ZAP, SAST.',keys:['sit-security']},
{id:'sit-agents',title:'Agents',summary:'Agent desk orchestration.',keys:['sit-agents']},
{id:'sit-performance',title:'Performance',summary:'Soak and burst SIT packs.',keys:['sit-91-performance-soak','sit-92-performance-burst']}
];
const CAT={qa:'Quality assurance',qc:'Quality control'};
const TERMINAL=new Set(['passed','failed','skipped','blocked','cancelled','error','timed_out']);
const ACTIVE=new Set(['queued','preparing','running','claiming']);
const FAILED=new Set(['failed','error','timed_out']);
const ROWS=100;                            // case-table rows rendered before "Show more"
const POLL_ACTIVE=3000,POLL_IDLE=15000,POLL_HIDDEN=60000;
const STALL_MS=15*60*1000;                 // active run with no new result for this long is flagged as stalled
const WORKER_FRESH_MS=90*1000;             // workers heartbeat every 15s
const TONES={
  pass:{label:'Passing',icon:'✓',dot:'green'},
  fail:{label:'Failing',icon:'✕',dot:'red'},
  warn:{label:'Needs attention',icon:'!',dot:'amber'},
  never:{label:'Never run',icon:'○',dot:''},
  empty:{label:'No cases',icon:'–',dot:null},
};
const state={
  view:'overview',typeId:null,sitGroupId:null,runId:null,suiteId:null,
  // Application under test: the console is generic — every data call is scoped to appKey.
  appKey:null,applications:[],
  // One lean summary call; case bodies, run results, evidence and history load on demand.
  loaded:false,cases:[],suites:[],environments:[],application:null,typesFromDb:null,build:null,stats:{},idx:null,
  // Live poll (/api/v1/ui/live)
  liveLoaded:false,executions:[],workers:[],since:null,catalogSig:null,liveSig:'',skew:0,lastPoll:null,
  // UI
  envId:null,headed:false,search:'',selected:new Set(),rowLimit:ROWS,tile:null,tiles:new Map(),panels:new Set(),
  history:new Map(),charts:new Map(),open:new Set(),section:null,live:{inRun:new Map(),current:new Set()},
  run:null,evidence:new Map(),buildRows:null,
};
const el=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,opts){const res=await fetch(path,opts);const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body?.error?.message||body?.error||('HTTP '+res.status));return body;}
const postJson=(path,body)=>api(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
function toast(m,href){const n=document.createElement(href?'a':'div');n.className='toast';n.textContent=m;if(href){n.href=href;n.append(' →');}el('toastWrap').appendChild(n);setTimeout(()=>n.remove(),6000);}
function banner(m){const b=el('banner');if(!m){b.hidden=true;return;}b.hidden=false;b.textContent=m;}
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const ms=t=>t?new Date(t).getTime():0;
const serverNow=()=>Date.now()+state.skew;
function ago(t){if(!t)return '—';const s=Math.max(0,(serverNow()-ms(t))/1000);if(s<60)return Math.floor(s)+'s ago';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago';}
function dur(v){if(v==null||v<0)return '—';const s=Math.round(v/1000);if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m '+(s%60)+'s';if(s<86400)return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m';return Math.floor(s/86400)+'d '+Math.floor((s%86400)/3600)+'h';}
const secs=v=>v!=null?(v/1000).toFixed(1)+'s':'—';
const when=t=>t?new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';

// ---------------------------------------------------------------------------
// Catalog model: built once per summary load, so renders never rescan membership.
// ---------------------------------------------------------------------------
function typeList(){return state.typesFromDb||TYPES;}
function typeTitle(id){const t=typeList().find(x=>x.id===id)||TYPES.find(x=>x.id===id);return t?t.title:(id==='other'?'Uncategorised':id);}
function isSitCase(c){const tags=(c.tags||[]).map(t=>String(t).toLowerCase());if(tags.includes('sit'))return true;const k=String(c.key||'');return k.startsWith('SIT-')||k.startsWith('sit-');}
function isSitSuite(s){return String(s.key||'').toLowerCase().startsWith('sit-');}
function typeOfCase(c,types,suiteById){
  if(isSitCase(c))return 'sit';
  const tags=new Set((c.tags||[]).map(t=>String(t).toLowerCase()));
  for(const t of types)if(tags.has(String(t.id).toLowerCase()))return t.id;
  for(const sid of c.suite_ids||[]){
    const s=suiteById.get(sid);if(!s)continue;
    const st=String(s.suite_type||'');
    if(types.some(t=>t.id===st))return st;
    const k=String(s.key||'');
    if(k.startsWith('sb-')){const p=k.split('-');if(p.length>=2&&types.some(t=>t.id===p[1]))return p[1];}
  }
  return 'other';
}
function suitesForType(typeKey){return state.suites.filter(s=>{if(isSitSuite(s))return false;if(String(s.key||'').startsWith('sb-type-'))return false;if(String(s.suite_type||'')===typeKey)return true;return String(s.key||'').startsWith('sb-'+typeKey+'-');});}
function sitSuitesInGroup(g){const keys=new Set((g.keys||[]).map(k=>k.toLowerCase()));return state.suites.filter(s=>{if(!isSitSuite(s))return false;const k=String(s.key||'').toLowerCase();return keys.has(k)||[...keys].some(prefix=>k.startsWith(prefix+'-'));});}
function indexSummary(){
  const caseById=new Map(state.cases.map(c=>[c.id,c]));
  const suiteById=new Map(state.suites.map(s=>[s.id,s]));
  const casesBySuite=new Map(),casesByType=new Map();
  const types=typeList().some(t=>t.id==='selenium-baseline')?typeList():typeList().concat(TYPES.filter(t=>t.id==='selenium-baseline'));
  for(const c of state.cases){
    for(const sid of c.suite_ids||[]){if(!casesBySuite.has(sid))casesBySuite.set(sid,[]);casesBySuite.get(sid).push(c);}
    const t=typeOfCase(c,types,suiteById);
    if(!casesByType.has(t))casesByType.set(t,[]);
    casesByType.get(t).push(c);
  }
  const sitGroupSuites=new Map(),sitGroupCases=new Map();
  for(const g of SIT_GROUPS){
    const suites=sitSuitesInGroup(g);
    const seen=new Map();
    for(const s of suites)for(const c of casesBySuite.get(s.id)||[])seen.set(c.id,c);
    sitGroupSuites.set(g.id,suites);
    sitGroupCases.set(g.id,[...seen.values()]);
  }
  state.idx={caseById,suiteById,casesBySuite,casesByType,sitGroupSuites,sitGroupCases};
}
const casesForType=id=>(state.idx&&state.idx.casesByType.get(id))||[];
const casesInSuite=id=>(state.idx&&state.idx.casesBySuite.get(id))||[];
const sitCases=()=>casesForType('sit');
function filterCases(list){const q=state.search.trim().toLowerCase();if(!q)return list;return list.filter(c=>String(c.name||'').toLowerCase().includes(q)||String(c.key||'').toLowerCase().includes(q));}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------
function appQuery(prefix){return (prefix||'?')+'application_key='+encodeURIComponent(state.appKey||'sand-bench');}
async function loadApplications(){
  try{state.applications=(await api('/api/v1/applications')).data||[];}catch{state.applications=[];}
  if(!state.appKey){
    let saved=null;try{saved=localStorage.getItem('te.app');}catch{}
    state.appKey=(saved&&state.applications.some(a=>a.key===saved))?saved
      :(state.applications.some(a=>a.key==='sand-bench')?'sand-bench':(state.applications[0]&&state.applications[0].key)||'sand-bench');
  }
  renderAppSelect();
}
async function loadSummary(){
  const d=(await api('/api/v1/ui/summary'+appQuery())).data||{};
  state.cases=d.cases||[];state.suites=d.suites||[];state.environments=d.environments||[];
  state.application=d.application||null;state.build=d.build||null;state.stats=d.stats||{};
  const meta=d.application&&d.application.types;
  state.typesFromDb=Array.isArray(meta)&&meta.length?meta.map(t=>({id:t.key,title:t.label||t.key,summary:t.subtitle||'',category:t.category==='qc'?'qc':'qa'})):null;
  if(d.now)state.since=d.now;
  state.loaded=true;state.buildRows=null;
  indexSummary();
  markHistoryStale();
  renderEnvSelect();
}
let polling=false,pollTimer=null;
async function pollLive(){
  if(polling)return;
  polling=true;clearTimeout(pollTimer);
  try{
    const res=await api('/api/v1/ui/live'+appQuery()+(state.since?'&since='+encodeURIComponent(state.since):''));
    await applyLive(res.data||{});
  }catch(e){/* keep the last frame; the health pill shows reachability */}
  finally{
    polling=false;
    const hot=activeRuns().some(e=>!isStalled(e));
    pollTimer=setTimeout(pollLive,document.hidden?POLL_HIDDEN:hot?POLL_ACTIVE:POLL_IDLE);
  }
}
async function applyLive(d){
  const before=new Map(state.executions.map(e=>[e.id,e.status]));
  if(d.now){state.skew=ms(d.now)-Date.now();state.since=d.now;}
  state.executions=d.executions||[];state.workers=d.workers||[];state.liveLoaded=true;state.lastPoll=d.now||new Date().toISOString();
  let dirty=false;
  for(const r of d.changed||[]){
    const c=state.idx&&state.idx.caseById.get(r.test_case_id);
    if(c&&(c.last_status!==r.status||c.last_at!==r.last_at)){c.last_status=r.status;c.last_at=r.last_at;c.last_duration_ms=r.duration_ms;dirty=true;}
  }
  for(const e of state.executions){
    const was=before.get(e.id);
    if(was&&ACTIVE.has(String(was))&&TERMINAL.has(String(e.status))){toast(e.key+' finished: '+e.status,'#/run/'+e.id);markHistoryStale();dirty=true;}
  }
  if(state.catalogSig&&d.catalog_sig&&d.catalog_sig!==state.catalogSig){await loadSummary();dirty=true;}
  if(d.catalog_sig)state.catalogSig=d.catalog_sig;
  if(state.view==='run'&&state.run&&!state.run.error&&ACTIVE.has(String(state.run.status))){
    const prev=JSON.stringify(state.run);await loadRun(state.runId);
    if(JSON.stringify(state.run)!==prev)dirty=true;
  }
  const sig=JSON.stringify([state.executions.map(e=>[e.id,e.status,e.done,e.current_case_id,isStalled(e)]),state.workers.map(workerFresh)]);
  if(sig!==state.liveSig){state.liveSig=sig;dirty=true;}
  renderWorkerPill();renderBanner();
  if(dirty){renderSideNav();renderCurrentView();}
}
async function loadRun(id){
  try{state.run=(await api('/api/v1/ui/executions/'+encodeURIComponent(id))).data;}
  catch(e){state.run={id,error:e.message};}
}
async function loadBuildRows(){
  try{state.buildRows=(await api('/api/v1/build-results'+appQuery())).data||[];}catch{state.buildRows=[];}
  if(state.view==='builds')renderCurrentView();
}
function markHistoryStale(){for(const h of state.history.values())h.stale=true;}
async function loadHistory(tile){
  if(!tile)return;
  const prev=state.history.get(tile.key);
  if(prev&&prev.loading)return;
  state.history.set(tile.key,{...(prev||{}),loading:true});
  let next;
  try{
    const res=tile.kind==='build'
      ?await api('/api/v1/ui/build-history'+appQuery()+'&limit=30')
      :await postJson('/api/v1/ui/history',{case_ids:(tile.cases||[]).map(c=>c.id),limit:30});
    next={data:res.data};
  }catch(e){next={data:prev&&prev.data,error:e.message};}
  state.history.set(tile.key,next);
  if(state.panels.has(tile.key))renderCurrentView();
}
async function loadHealth(){try{const h=await api('/health');el('healthPill').textContent='engine ok · v'+(h.version||'?');el('healthPill').className='pill ok';}catch(e){el('healthPill').textContent='engine unreachable';el('healthPill').className='pill bad';}}

// ---------------------------------------------------------------------------
// Live state helpers
// ---------------------------------------------------------------------------
const activeRuns=()=>state.executions.filter(e=>ACTIVE.has(String(e.status)));
function isStalled(e){return ACTIVE.has(String(e.status))&&serverNow()-ms(e.last_activity_at||e.started_at||e.created_at)>STALL_MS;}
const workerFresh=w=>w.status!=='offline'&&serverNow()-ms(w.last_heartbeat)<WORKER_FRESH_MS;
function liveCaseState(){
  const inRun=new Map(),current=new Set();
  for(const e of activeRuns()){
    if(isStalled(e))continue;
    for(const id of e.case_ids||[])if(inRun.get(id)!=='running')inRun.set(id,e.status==='running'?'running':'queued');
    if(e.current_case_id)current.add(e.current_case_id);
  }
  return {inRun,current};
}
function tileStats(tile){
  if(tile.kind==='build'){
    const b=state.build;
    if(!b)return {total:0,passed:0,failed:0,other:0,never:0,lastAt:null,running:null,tone:'never'};
    const other=Math.max(0,b.total-b.passed-b.failed);
    return {total:b.total,passed:b.passed,failed:b.failed,other,never:0,lastAt:b.reported_at,running:null,tone:b.failed?'fail':b.passed?'pass':other?'warn':'never'};
  }
  const cases=tile.cases||[];
  let passed=0,failed=0,other=0,never=0,lastAt=null,running=null;
  for(const c of cases){
    const s=c.last_status;
    if(!s)never++;else if(FAILED.has(s))failed++;else if(s==='passed')passed++;else other++;
    if(c.last_at&&(!lastAt||c.last_at>lastAt))lastAt=c.last_at;
    const r=state.live.inRun.get(c.id);
    if(r==='running'||(r&&!running))running=r;
  }
  const tone=!cases.length?'empty':failed?'fail':passed?'pass':other?'warn':'never';
  return {total:cases.length,passed,failed,other,never,lastAt,running,tone};
}

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------
function badge(st){if(!st)return '<span class="badge never">Never run</span>';const s=String(st.status||st).toLowerCase();return '<span class="badge '+esc(s)+'">'+esc(s.replace(/_/g,' '))+'</span>';}
function kpi(label,value,sub,cls){return `<div class="kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value ${cls||''}">${value}</div>${sub?`<div class="kpi-sub">${sub}</div>`:''}</div>`;}
function stat(label,value,sub){return `<div class="stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${value}</div>${sub?`<div class="stat-sub">${sub}</div>`:''}</div>`;}
function statsRowHtml(cases,sub){
  const s=tileStats({cases});
  return '<div class="kpi-grid">'+
    kpi('Cases',s.total,esc(sub||''))+
    kpi('Passing',s.passed,'latest result passed',s.passed?'green':'')+
    kpi('Failing',s.failed,'latest result failed',s.failed?'red':'')+
    kpi('Never run',s.never,'no result recorded')+
    kpi('Last run',s.lastAt?`<span data-ago="${esc(s.lastAt)}">${ago(s.lastAt)}</span>`:'—',s.lastAt?esc(when(s.lastAt)):'nothing has run yet','sm')+
  '</div>';
}
function skeletonHtml(){return `<div class="kpi-grid">${'<div class="skel" style="height:84px"></div>'.repeat(6)}</div><div class="stiles">${'<div class="skel"></div>'.repeat(8)}</div>`;}
function legendHtml(){return '<div class="tone-legend" aria-label="Tile colour key"><span><i class="sw tone-pass"></i>Passing — every case that ran passed</span><span><i class="sw tone-fail"></i>Failing — at least one case failed</span><span><i class="sw tone-warn"></i>Needs attention — only skipped or blocked</span><span><i class="sw tone-never"></i>Never run</span><span><span class="pulse"></span>Running now</span></div>';}
function progressHtml(e,cls){
  const done=e.done||0,total=Math.max(e.total||0,done);
  const other=Math.max(0,done-(e.passed||0)-(e.failed||0));
  const rest=total-done;
  const seg=(v,c)=>v>0?`<span class="${c}" style="flex:${v} 1 0"></span>`:'';
  const moving=ACTIVE.has(String(e.status))&&!isStalled(e);
  return `<div class="progress-seg ${cls||''}" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-label="${done} of ${total} cases done">${seg(e.passed,'pass')}${seg(e.failed,'fail')}${seg(other,'other')}${rest>0||!total?`<span class="rest${moving?' running':''}" style="flex:${rest||1} 1 0"></span>`:''}</div>`;
}
function countsHtml(e){const other=Math.max(0,(e.done||0)-(e.passed||0)-(e.failed||0));return `<span class="counts"><span><i class="kdot pass"></i>${e.passed||0} passed</span><span><i class="kdot fail"></i>${e.failed||0} failed</span>${other?`<span><i class="kdot other"></i>${other} other</span>`:''}</span>`;}
function liveHeading(live){return live.some(e=>!isStalled(e))?'Running now':'Stalled runs';}

// ---------------------------------------------------------------------------
// Tiles + per-tile history panel
// ---------------------------------------------------------------------------
function tileHtml(tile){
  state.tiles.set(tile.key,tile);
  const s=tileStats(tile),t=TONES[s.tone],open=state.tile===tile.key;
  const noun=tile.kind==='build'?'results':'cases';
  const counts=tile.kind==='build'&&!state.build?'No build reported yet':[`<b>${s.total}</b> ${noun}`,s.passed&&`${s.passed} passed`,s.failed&&`${s.failed} failed`,s.other&&`${s.other} other`,s.never&&`${s.never} not run`].filter(Boolean).join(' · ');
  const seg=(v,c)=>v?`<span class="seg ${c}" style="flex-grow:${v}"></span>`:'';
  const running=s.running?`<span class="live-chip"><span class="pulse ${s.running}"></span>${s.running==='running'?'Running':'Queued'}</span>`:'';
  return `<button type="button" class="stile tone-${s.tone}${open?' open':''}${s.running?' is-running':''}${tile.accent?' accent-'+tile.accent:''}" data-tile="${esc(tile.key)}" aria-expanded="${open}" title="${esc(tile.sub||'')}">
    <span class="stile-head"><span class="stile-title">${esc(tile.title)}</span><span class="chip chip-${s.tone}"><span aria-hidden="true">${t.icon}</span>${t.label}</span></span>
    <span class="stile-counts">${counts}</span>
    <span class="meter" aria-hidden="true">${seg(s.passed,'pass')}${seg(s.failed,'fail')}${seg(s.other,'other')}${seg(s.never,'never')}</span>
    <span class="stile-foot"><span>${s.lastAt?`Last run <span data-ago="${esc(s.lastAt)}">${ago(s.lastAt)}</span>`:'No runs yet'}</span>${running}</span>
  </button>`;
}
function tileGroupHtml(group){
  if(!group.tiles.length)return '';
  const tiles=group.tiles.map(tileHtml).join('');
  const open=group.tiles.find(t=>t.key===state.tile);
  return `<section class="tile-group"><div class="group-head"><h2>${esc(group.title)}</h2>${group.sub?`<span class="muted small">${esc(group.sub)}</span>`:''}</div><div class="stiles">${tiles}</div>${open?historyPanelHtml(open):''}</section>`;
}
function historyPanelHtml(tile,opts){
  const fixed=opts&&opts.fixed;
  state.tiles.set(tile.key,tile);state.panels.add(tile.key);
  const h=state.history.get(tile.key)||{};
  const s=tileStats(tile);
  const isBuild=tile.kind==='build';
  const rateOf=r=>{const t=r.passed+r.failed+r.other;return t?Math.round(r.passed/t*100):null;};
  const runs=h.data?h.data.runs.slice().reverse():[];                 // oldest -> newest for charts
  let body;
  if(!h.data&&h.error)body=`<div class="empty">Could not load history: ${esc(h.error)} <button class="btn" data-action="retry-history" data-key="${esc(tile.key)}">Retry</button></div>`;
  else if(!h.data)body='<div class="hp-loading"><div class="skel" style="height:78px"></div><div class="skel" style="height:200px"></div></div>';
  else if(!runs.length)body=`<div class="empty">No runs recorded yet for ${isBuild?'this application':'these '+plural(s.total,'case')}.${!isBuild&&s.total?' Use <b>Run</b> above to record the first one.':''}</div>`;
  else{
    const last=h.data.runs[0];
    const rates=runs.map(rateOf).filter(v=>v!=null);
    const avg=rates.length?Math.round(rates.reduce((a,b)=>a+b,0)/rates.length):null;
    const fails=runs.reduce((a,r)=>a+r.failed,0);
    const cid='c'+state.charts.size;
    state.charts.set(cid+'b',{type:'stacked',runs,opts:isBuild?{}:{onSelect:r=>{location.hash='#/run/'+r.id;}}});
    state.charts.set(cid+'r',{type:'rate',runs});
    const noun=isBuild?'build':'run';
    body=`<div class="hp-stats">
        ${stat(`Last ${noun} pass rate`,rateOf(last)==null?'—':rateOf(last)+'%',`${last.passed}/${last.total} passed · ${esc(when(last.created_at))}`)}
        ${stat('Average pass rate',avg==null?'—':avg+'%',`across the last ${plural(runs.length,noun)}`)}
        ${stat('Failures in window',fails,`${plural(runs.filter(r=>r.failed).length,noun)} with a failure`)}
        ${isBuild?stat('Latest build',esc(String(last.key).slice(0,14)),esc([last.branch,last.commit_sha&&String(last.commit_sha).slice(0,8)].filter(Boolean).join(' · ')||'—')):stat('Never run',s.never,`of ${plural(s.total,'case')}`)}
      </div>
      <div class="hp-charts">
        <figure class="viz"><figcaption><span>Results per ${noun}</span><span class="legend"><span><i style="background:var(--viz-pass)"></i>Passed</span><span><i style="background:var(--viz-fail)"></i>Failed</span><span><i style="background:var(--viz-other)"></i>Other (skipped, blocked, cancelled)</span></span></figcaption><div class="chart" data-chart="${cid}b"></div></figure>
        <figure class="viz"><figcaption><span>Pass rate trend</span><span class="muted small">share of cases passed per ${noun}</span></figcaption><div class="chart" data-chart="${cid}r"></div></figure>
      </div>
      ${topFailingHtml(h.data.top_failing||[],isBuild)}
      <details data-keep="runs:${esc(tile.key)}"${state.open.has('runs:'+tile.key)?' open':''}><summary>${isBuild?'Build':'Run'} history table (${runs.length})</summary>${historyTableHtml(h.data.runs,isBuild)}</details>`;
  }
  const details=fixed?'':tile.inline?'<button class="btn" data-action="scroll-details">View cases ↓</button>':tile.href?`<a class="btn" href="${esc(tile.href)}">Open details →</a>`:'';
  const run=isBuild?'':`<button class="btn primary" data-action="run-tile" data-key="${esc(tile.key)}"${s.total?'':' disabled'}>Run ${plural(s.total,'case')}</button>`;
  const close=fixed?'':'<button class="icon-btn" style="display:inline-block" data-action="close-tile" aria-label="Close history">✕</button>';
  return `<div class="card hp tone-${s.tone}" id="${fixed?'hp-'+esc(tile.key):'hp'}">
    <div class="card-head"><div><h2><span class="chip chip-${s.tone}"><span aria-hidden="true">${TONES[s.tone].icon}</span>${TONES[s.tone].label}</span> ${esc(tile.title)} · history</h2>${tile.sub?`<div class="muted small">${esc(tile.sub)}</div>`:''}</div><div class="hp-actions">${run}${details}${close}</div></div>
    <div class="hp-body${h.loading&&h.data?' refreshing':''}">${body}</div></div>`;
}
function topFailingHtml(rows,isBuild){
  if(!rows.length)return '';
  return `<div class="top-fail"><h3>Most frequent failures</h3><ol>${rows.map(r=>`<li>${isBuild?`<span>${esc(r.name||r.key)}</span>`:`<button class="case-name" data-case="${esc(r.test_case_id)}">${esc(r.name)}</button>`}<span class="key small">${esc(r.key)}</span><span class="muted small">failed ${r.failures} of ${plural(r.runs,'run')} · last ${esc(when(r.last_failed_at))}</span></li>`).join('')}</ol></div>`;
}
function historyTableHtml(runs,isBuild){
  const rows=runs.map(r=>{const t=r.passed+r.failed+r.other;return `<tr${isBuild?'':` class="clickable" data-run="${esc(r.id)}"`}><td class="key">${esc(r.key)}</td><td>${esc(when(r.created_at))}</td><td class="num">${r.passed}</td><td class="num">${r.failed}</td><td class="num">${r.other}</td><td class="num">${t?Math.round(r.passed/t*100)+'%':'—'}</td>${isBuild?'':`<td>${badge(r.status)}</td>`}</tr>`;}).join('');
  return `<div class="table-wrap"><table><thead><tr><th>${isBuild?'Build':'Run'}</th><th>Date</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Other</th><th class="num">Pass rate</th>${isBuild?'':'<th>Run status</th>'}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function drawCharts(){document.querySelectorAll('#content [data-chart]').forEach(host=>{const spec=state.charts.get(host.dataset.chart);if(spec&&spec.runs.length)Charts[spec.type](host,spec.runs,spec.opts);});}

// ---------------------------------------------------------------------------
// Case tables
// ---------------------------------------------------------------------------
function caseTable(cases){
  const shown=cases.slice(0,state.rowLimit);
  const rows=shown.map(c=>{
    const st=c.last_status?{status:c.last_status}:null;
    const now=state.live.current.has(c.id),inRun=state.live.inRun.get(c.id);
    const status=now?'<span class="badge running"><span class="pulse running"></span>running</span>':badge(st)+(inRun?` <span class="muted small" title="Part of an active run">· ${inRun==='running'?'in run':'queued'}</span>`:'');
    return `<tr${now?' class="row-running"':''}><td><button class="case-name" data-case="${esc(c.id)}">${esc(c.name)}</button>${c._type==='sit'?' <span class="badge sit">SIT</span>':''}<div class="key small">${esc(c.key)}</div></td><td>${status}</td><td>${esc(c.execution_method||c.test_type||'—')}</td><td>${esc(secs(c.last_duration_ms))}</td><td class="muted small" title="${esc(when(c.last_at))}">${c.last_at?`<span data-ago="${esc(c.last_at)}">${ago(c.last_at)}</span>`:'Never'}</td><td><input type="checkbox" aria-label="Select ${esc(c.name)}" data-sel="${esc(c.id)}"${state.selected.has(c.id)?' checked':''}></td></tr>`;
  }).join('');
  const more=cases.length>shown.length?`<div class="more"><button class="btn" data-action="more">Show ${Math.min(ROWS,cases.length-shown.length)} more</button><span class="muted small">${shown.length} of ${cases.length} shown</span></div>`:'';
  return `<div class="table-wrap"><table><thead><tr><th>Test case</th><th>Status</th><th>Method</th><th>Duration</th><th>Last run</th><th><span class="sr-only">Select</span></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">No cases.</td></tr>'}</tbody></table></div>${more}`;
}
function runSelLabel(){return 'Run selected'+(state.selected.size?' ('+state.selected.size+')':'');}
function caseSectionHtml(o){
  state.section={ids:o.cases.map(c=>c.id),suiteId:o.suiteId||null,label:o.label||o.title};
  const cases=filterCases(o.cases);
  return `<div class="card" id="details"><div class="card-head"><div><h2>${esc(o.title)}</h2>${o.sub?`<div class="muted small">${esc(o.sub)}</div>`:''}</div><div class="hp-actions">${o.clear?'<button class="btn" data-action="clear-suite">Show all cases</button>':''}<button class="btn" data-action="run-selected"${state.selected.size?'':' disabled'}>${runSelLabel()}</button><button class="btn ${o.sit?'sit':'primary'}" data-action="run-section"${o.cases.length?'':' disabled'}>${o.suiteId?'Run suite':'Run all'} (${o.cases.length})</button></div></div><div class="toolbar"><span class="muted small">${plural(cases.length,'case')}${state.search?' matching “'+esc(state.search)+'”':''}</span>${o.note?`<span class="muted small">${esc(o.note)}</span>`:''}</div>${caseTable(cases)}</div>`;
}

// ---------------------------------------------------------------------------
// Live runs (run screen building blocks)
// ---------------------------------------------------------------------------
function liveCardHtml(e){
  const stalled=isStalled(e);
  const cur=e.current_case_id&&state.idx&&state.idx.caseById.get(e.current_case_id);
  const suite=e.test_suite_id&&state.idx&&state.idx.suiteById.get(e.test_suite_id);
  const total=Math.max(e.total||0,e.done||0);
  const noWorker=!state.workers.some(workerFresh);
  const now=e.status==='running'?(cur?`Now running <b>${esc(cur.name)}</b>`:'Finishing up'):e.status==='queued'?(noWorker?'Waiting — no live worker connected':'Waiting for a worker to claim it'):'Preparing';
  return `<article class="live-card${stalled?' stalled':''}" data-run="${esc(e.id)}" tabindex="0" aria-label="Run ${esc(e.key)}, ${esc(e.status)}">
    <div class="live-head"><span class="pulse ${esc(e.status)}"></span><span class="run-key">${esc(e.key)}</span>${badge(e.status)}<span class="muted small">${esc(suite?suite.name:plural(total,'case'))} · ${esc(e.trigger_source||'manual')}</span><span class="live-elapsed" title="Elapsed"><span data-elapsed="${esc(e.started_at||e.created_at)}">${dur(serverNow()-ms(e.started_at||e.created_at))}</span></span></div>
    ${progressHtml(e,'big')}
    <div class="live-meta"><span><b>${e.done||0}</b> / ${total} done</span>${countsHtml(e)}</div>
    <div class="live-now">${stalled?`<span class="stall">Last activity <span data-ago="${esc(e.last_activity_at||e.started_at||e.created_at)}">${ago(e.last_activity_at||e.started_at||e.created_at)}</span> — the worker may have stopped.</span><button class="btn" data-action="cancel-run" data-id="${esc(e.id)}">Cancel run</button>`:now}</div>
  </article>`;
}
function liveStripHtml(){
  const a=activeRuns().filter(e=>!isStalled(e));
  if(!a.length)return '';
  return `<div class="live-strip">${a.slice(0,3).map(e=>`<a class="ls-item" href="#/run/${esc(e.id)}"><span class="pulse ${esc(e.status)}"></span><span class="run-key">${esc(e.key)}</span><span class="muted small">${e.done||0}/${Math.max(e.total||0,e.done||0)} done · ${e.failed||0} failed</span>${progressHtml(e,'thin')}<span class="small">Watch →</span></a>`).join('')}${a.length>3?`<a class="small" href="#/history">+${a.length-3} more running</a>`:''}</div>`;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
function navItem(view,id,label,count,dot,cls){
  const active=(state.view===view&&(view==='type'?state.typeId===id:view==='sit'?state.sitGroupId===id:true))||(view==='history'&&state.view==='run');
  return '<button class="nav-item '+(active?(cls||'active'):'')+'" data-view="'+view+'" data-id="'+esc(id||'')+'">'+(dot!=null?'<span class="nav-dot '+dot+'"></span>':'')+'<span class="nav-label">'+esc(label)+'</span>'+(count!=null?'<span class="nav-count">'+count+'</span>':'')+'</button>';
}
const toneDot=cases=>TONES[tileStats({cases}).tone].dot;
function renderSideNav(){
  const tl=typeList();
  const live=activeRuns().filter(e=>!isStalled(e)).length;
  let h='<div class="nav-section">Workspace</div>';
  h+=navItem('overview',null,'Overview');
  h+=navItem('history',null,live?`Test runs · ${live} live`:'Test runs',state.executions.length||null,live?'blue pulse-dot':null);
  h+=navItem('builds',null,'In-container build',state.build?state.build.total:null,TONES[tileStats({kind:'build'}).tone].dot);
  if(sitCases().length){
    h+='<div class="nav-section">SIT console</div>';
    h+=navItem('sit-all',null,'All SIT cases',sitCases().length,'blue','active-sit');
    for(const g of SIT_GROUPS){const cs=(state.idx&&state.idx.sitGroupCases.get(g.id))||[];h+=navItem('sit',g.id,g.title,cs.length||null,cs.length?toneDot(cs):null,'active-sit');}
  }
  h+='<div class="nav-section">'+CAT.qa+'</div>';
  for(const t of tl.filter(t=>t.category==='qa')){const cs=casesForType(t.id);h+=navItem('type',t.id,t.title,cs.length,toneDot(cs));}
  h+='<div class="nav-section">'+CAT.qc+'</div>';
  for(const t of tl.filter(t=>t.category!=='qa')){const cs=casesForType(t.id);h+=navItem('type',t.id,t.title,cs.length,toneDot(cs));}
  if(!tl.some(t=>t.id==='selenium-baseline')){const bl=casesForType('selenium-baseline');h+='<div class="nav-section">Selenium Baseline</div>';h+=navItem('baseline',null,'Selenium Baseline',bl.length,toneDot(bl));}
  el('sideNav').innerHTML=h;
}
function overviewGroups(){
  const tl=typeList();
  const typeTile=t=>({key:'type:'+t.id,title:t.title,sub:t.summary,cases:casesForType(t.id),href:'#/type/'+encodeURIComponent(t.id)});
  const more=[];
  if(!tl.some(t=>t.id==='selenium-baseline'))more.push({key:'baseline',title:'Selenium Baseline',sub:'Selenium GUI automation baseline checks.',cases:casesForType('selenium-baseline'),href:'#/baseline'});
  more.push({key:'build',kind:'build',title:'In-container build',sub:'Reported by CI; not re-run by the engine.',href:'#/builds'});
  const other=casesForType('other');
  if(other.length)more.push({key:'type:other',title:'Uncategorised',sub:'Cases with no type tag or typed suite.',cases:other,href:'#/type/other'});
  const groups=[];
  if(sitCases().length)groups.push({title:'SIT console',sub:'Post-deploy packs by area',tiles:SIT_GROUPS.map(g=>({key:'sit:'+g.id,title:g.title,sub:g.summary,cases:(state.idx&&state.idx.sitGroupCases.get(g.id))||[],href:'#/sit/'+g.id,accent:'sit'}))});
  groups.push(
    {title:CAT.qa,tiles:tl.filter(t=>t.category==='qa').map(typeTile)},
    {title:CAT.qc,tiles:tl.filter(t=>t.category!=='qa').map(typeTile)},
    {title:'Baselines & builds',tiles:more},
  );
  return groups;
}
function renderOverview(){
  el('viewTitle').textContent='Overview';
  if(!state.loaded){el('content').innerHTML=skeletonHtml();return;}
  const all=tileStats({cases:state.cases});
  const live=activeRuns();
  const hot=live.filter(e=>!isStalled(e)).length;
  const b=state.build;
  const appName=(state.applications.find(a=>a.key===state.appKey)||{}).name||state.appKey||'application';
  let h='';
  if(live.length)h+=`<div class="group-head first"><h2>${liveHeading(live)}</h2><a class="small" href="#/history">Open run screen →</a></div><div class="live-board">${live.map(liveCardHtml).join('')}</div>`;
  h+=`<div class="group-head first"><h2>${esc(appName)}</h2><div class="hp-actions"><button class="btn primary" data-action="run-all"${all.total?'':' disabled'} title="Queue one execution per suite — every runnable case for this application on the selected environment">▶ Run everything (${all.total})</button></div></div>`;
  h+='<div class="kpi-grid">'+
    kpi('All cases',all.total,'in repository')+
    kpi('Passing',all.passed,'latest result passed',all.passed?'green':'')+
    kpi('Failing',all.failed,'latest result failed',all.failed?'red':'')+
    kpi('Never run',all.never,'no result recorded')+
    kpi('Active runs',hot,`${state.stats.runs_7d||0} runs in the last 7 days`,hot?'amber':'')+
    kpi('Last build',b?esc(String(b.build_id).slice(0,14)):'—',b?`${b.passed} passed · ${b.failed} failed (in-container)`:'no CI results yet','sm'+(b&&b.failed?' red':''))+
  '</div>';
  if(state.search)h+=caseSectionHtml({title:'Matching cases',cases:filterCases(state.cases),label:'search results'});
  h+=legendHtml();
  h+=overviewGroups().map(tileGroupHtml).join('');
  el('content').innerHTML=h;
}
function suiteTile(s,accent){return {key:'suite:'+s.id,suiteId:s.id,title:s.name||s.key,sub:s.key,cases:casesInSuite(s.id),inline:true,accent};}
function renderTypeView(typeId){
  const t=typeList().find(x=>x.id===typeId)||{title:typeTitle(typeId),summary:''};
  el('viewTitle').textContent=t.title;
  if(!state.loaded){el('content').innerHTML=skeletonHtml();return;}
  const suites=suitesForType(typeId);
  const typeCases=casesForType(typeId);
  const tiles=suites.length?suites.map(s=>suiteTile(s)):[{key:'type:'+typeId,title:t.title,sub:t.summary,cases:typeCases,inline:true}];
  const sel=suites.find(s=>s.id===state.suiteId)||null;
  el('content').innerHTML=liveStripHtml()+statsRowHtml(typeCases,t.summary)+
    tileGroupHtml({title:suites.length?'Suites':'Cases',sub:suites.length?`${plural(suites.length,'suite')} · select a tile for its run history`:'No suites — grouped by type tag',tiles})+
    caseSectionHtml({title:sel?sel.name:`${t.title} — all cases`,sub:sel?sel.key:'',cases:sel?casesInSuite(sel.id):typeCases,suiteId:sel&&sel.id,clear:!!sel,label:sel?sel.name:t.title});
}
function renderSitView(groupId){
  const g=groupId?SIT_GROUPS.find(x=>x.id===groupId):null;
  el('viewTitle').textContent=g?('SIT · '+g.title):'SIT console · All cases';
  if(!state.loaded){el('content').innerHTML=skeletonHtml();return;}
  let h=liveStripHtml();
  if(!g){
    const tiles=SIT_GROUPS.map(x=>({key:'sit:'+x.id,title:x.title,sub:x.summary,cases:state.idx.sitGroupCases.get(x.id)||[],href:'#/sit/'+x.id,accent:'sit'}));
    h+=statsRowHtml(sitCases(),'imported SIT definitions')+tileGroupHtml({title:'SIT areas',sub:'select a tile for its run history',tiles})+caseSectionHtml({title:'All SIT cases',cases:sitCases(),sit:true,label:'SIT selection'});
  }else{
    const suites=state.idx.sitGroupSuites.get(g.id)||[];
    const groupCases=state.idx.sitGroupCases.get(g.id)||[];
    const sel=suites.find(s=>s.id===state.suiteId)||null;
    const tiles=suites.length?suites.map(s=>suiteTile(s,'sit')):[{key:'sit:'+g.id,title:g.title,sub:g.summary,cases:groupCases,inline:true,accent:'sit'}];
    h+=statsRowHtml(groupCases,g.summary)+tileGroupHtml({title:'SIT suites',sub:suites.length?`${plural(suites.length,'suite')} · select a tile for its run history`:'',tiles})+
      caseSectionHtml({title:sel?(sel.name||sel.key):`${g.title} — all cases`,sub:sel?sel.key:'',cases:sel?casesInSuite(sel.id):groupCases,suiteId:sel&&sel.id,clear:!!sel,sit:true,label:sel?(sel.name||sel.key):'SIT '+g.title,note:suites.length?'':'No SIT suites in this area yet — set IMPORT_SIT=true and redeploy.'});
  }
  el('content').innerHTML=h;
}
function renderHistory(){
  el('viewTitle').textContent='Test runs';
  const live=activeRuns();
  const hot=live.filter(e=>!isStalled(e)).length;
  let h=`<div class="group-head first"><h2>${live.length?liveHeading(live):'Running now'}</h2><span class="muted small">${hot?`${plural(hot,'run')} in progress · updates every ${POLL_ACTIVE/1000}s`:live.length?'No progress reported — cancel or restart the worker':'Nothing in progress'}</span></div>`;
  h+=live.length?`<div class="live-board">${live.map(liveCardHtml).join('')}</div>`:'<div class="card empty">No runs in progress. Start one from any catalog page — it appears here with live per-case progress.</div>';
  if(state.loaded)h+=`<div class="group-head"><h2>History</h2><span class="muted small">every engine-executed case</span></div>`+historyPanelHtml({key:'all',title:'All tests',sub:'Pass/fail per run across the whole repository',cases:state.cases},{fixed:true});
  const rows=state.executions.map(e=>{
    const end=e.finished_at?ms(e.finished_at):null,start=ms(e.started_at||e.created_at);
    const time=ACTIVE.has(String(e.status))?`<span data-elapsed="${esc(e.started_at||e.created_at)}">${dur(serverNow()-start)}</span>`:end?dur(end-start):'—';
    return `<tr class="clickable" data-run="${esc(e.id)}"><td class="key">${esc(e.key)}</td><td>${badge(e.status)}${isStalled(e)?' <span class="muted small">stalled</span>':''}</td><td style="min-width:150px">${progressHtml(e,'thin')}</td><td class="small nowrap">${countsHtml(e)}</td><td class="muted small">${esc(e.trigger_source||'—')}</td><td class="muted small" title="${esc(when(e.created_at))}">${e.created_at?`<span data-ago="${esc(e.created_at)}">${ago(e.created_at)}</span>`:'—'}</td><td class="muted small">${time}</td></tr>`;
  }).join('');
  h+=`<div class="card"><div class="card-head"><h2>Recent executions</h2><span class="muted small">select a run for per-case results</span></div><div class="table-wrap"><table><thead><tr><th>Run</th><th>Status</th><th>Progress</th><th>Results</th><th>Trigger</th><th>Created</th><th>Duration</th></tr></thead><tbody>${rows||'<tr><td colspan="7" class="empty">No executions yet.</td></tr>'}</tbody></table></div></div>`;
  el('content').innerHTML=h;
}
function renderRun(){
  const r=state.run;
  el('viewTitle').textContent='Run';
  if(!r||(r.id!==state.runId&&r.key!==state.runId)){el('content').innerHTML='<div class="skel" style="height:140px;margin-bottom:16px"></div><div class="skel" style="height:320px"></div>';return;}
  if(r.error){el('content').innerHTML=`<div class="card empty">Run not found (${esc(r.error)}). <a href="#/history">Back to test runs</a></div>`;return;}
  el('viewTitle').textContent='Run '+r.key;
  const byCase=new Map();for(const x of r.results)byCase.set(x.test_case_id,x);
  const names=new Map((r.cases||[]).map(c=>[c.id,c]));
  const ids=[...(r.test_case_ids||[])];for(const x of r.results)if(!ids.includes(x.test_case_id))ids.push(x.test_case_id);
  const active=ACTIVE.has(String(r.status));
  const current=r.status==='running'?ids.find(id=>!byCase.has(id)):null;
  const passed=r.results.filter(x=>x.status==='passed').length,failed=r.results.filter(x=>FAILED.has(String(x.status))).length;
  const lastResult=r.results.reduce((m,x)=>Math.max(m,ms(x.finished_at)),0);
  const e={...r,total:ids.length,done:byCase.size,passed,failed,last_activity_at:lastResult?new Date(Math.max(lastResult,ms(r.started_at))).toISOString():r.started_at};
  const stalled=isStalled(e);
  const start=r.started_at||r.created_at;
  const elapsed=active?`<span data-elapsed="${esc(start)}">${dur(serverNow()-ms(start))}</span>`:r.finished_at?dur(ms(r.finished_at)-ms(start)):'—';
  const rows=ids.map(id=>{
    const x=byCase.get(id),c=names.get(id)||(state.idx&&state.idx.caseById.get(id))||{name:id,key:''};
    const s=x?String(x.status):id===current?(stalled?'stalled':'running'):active?'pending':'not run';
    const icon=s==='passed'?'✓':FAILED.has(s)?'✕':s==='running'?'':s==='pending'?'':'–';
    const iconCls=s==='passed'?'passed':FAILED.has(s)?'failed':s==='running'?'running':s==='pending'||s==='stalled'?'pending':'other';
    const ev=x&&state.evidence.get(x.id);
    const evidence=x&&x.evidence_count?`<button class="btn small-btn" data-action="evidence" data-rid="${esc(x.id)}">${ev?'Hide':'Show'} evidence (${x.evidence_count})</button>`:'';
    const shots=ev?`<div class="evidence">${ev.map(v=>{
      const link=v.url&&String(v.content_type||'').startsWith('image')?`<a href="${esc(v.url)}" target="_blank" rel="noopener"><img src="${esc(v.url)}" alt="${esc(v.evidence_type)} evidence" loading="lazy"></a>`:`<a class="tag" href="${esc(v.url||'#')}" target="_blank" rel="noopener">${esc(v.evidence_type)}</a>`;
      const copyBtn=v.url?`<button class="copy-btn" data-action="copy-evidence" data-url="${esc(v.url)}" title="Copy evidence link">Copy</button>`:'';
      return `<div class="evidence-item">${link}${copyBtn}</div>`;
    }).join('')}</div>`:'';
    return `<li class="run-case ${iconCls}"><span class="rc-icon ${iconCls}" aria-hidden="true">${icon}</span><div class="rc-main"><button class="case-name" data-case="${esc(id)}">${esc(c.name)}</button><div class="key small">${esc(c.key)}${x&&x.classification?' · '+esc(String(x.classification).replace(/_/g,' ')):''}</div>${x&&x.message&&s!=='passed'?`<div class="rc-msg">${esc(x.message)}</div>`:''}${evidence}${shots}</div><span>${s==='running'?'<span class="badge running">running</span>':s==='stalled'?'<span class="badge blocked">no progress</span>':s==='pending'?'<span class="badge queued">pending</span>':s==='not run'?'<span class="badge never">not run</span>':badge(s)}</span><span class="muted small rc-dur">${x?secs(x.duration_ms):s==='running'?'…':''}</span></li>`;
  }).join('');
  el('content').innerHTML=`<div class="card run-head">
      <div class="card-head"><div class="live-head">${active&&!stalled?`<span class="pulse ${esc(r.status)}"></span>`:''}<span class="run-key big">${esc(r.key)}</span>${badge(r.status)}${stalled?'<span class="stall">stalled — no new results</span>':''}</div>
        <div class="hp-actions"><a class="btn" href="#/history">← All runs</a><button class="btn" data-action="rerun"${ids.length?'':' disabled'}>Run again</button>${active?`<button class="btn" data-action="cancel-run" data-id="${esc(r.id)}">Cancel</button>`:''}</div></div>
      <div class="run-body">
        ${progressHtml(e,'big')}
        <div class="live-meta"><span><b>${byCase.size}</b> / ${ids.length} done</span>${countsHtml(e)}${current?`<span>Now running <b>${esc((names.get(current)||{}).name||current)}</b></span>`:''}</div>
        <dl class="kv run-kv"><dt>Suite</dt><dd>${esc(r.suite_name||'—')}</dd><dt>Environment</dt><dd>${esc(r.environment_name||'—')}</dd><dt>Trigger</dt><dd>${esc(r.trigger_source||'—')}</dd><dt>Worker</dt><dd class="key">${esc(r.worker_id||(active?'waiting for a worker':'—'))}</dd><dt>Queued</dt><dd>${esc(when(r.created_at))}</dd><dt>Started</dt><dd>${esc(when(r.started_at))}</dd><dt>${active?'Elapsed':'Duration'}</dt><dd>${elapsed}</dd></dl>
      </div></div>
    <div class="card"><div class="card-head"><h2>Cases in this run</h2><span class="muted small">${active&&!stalled?`updates every ${POLL_ACTIVE/1000}s`:active?`checking every ${POLL_IDLE/1000}s`:'final'}</span></div><ol class="run-cases">${rows||'<li class="empty">This run has no cases.</li>'}</ol></div>`;
}
function renderBuilds(){
  el('viewTitle').textContent='In-container build';
  if(!state.loaded){el('content').innerHTML=skeletonHtml();return;}
  const b=state.build;
  const tile={key:'build',kind:'build',title:'In-container build',sub:'Results posted by CI (npm run report:unit-container); the engine does not re-run them.'};
  let h='<div class="kpi-grid">'+
    kpi('Latest build',b?esc(String(b.build_id).slice(0,14)):'—',b?esc(when(b.reported_at)):'no CI results yet','sm')+
    kpi('Passed',b?b.passed:0,'latest build',b&&b.passed?'green':'')+
    kpi('Failed',b?b.failed:0,'latest build',b&&b.failed?'red':'')+
    kpi('Unit',b&&b.unit_total?`${b.unit_passed}/${b.unit_total}`:'—','unit tests passed')+
    kpi('Commit',b&&b.commit_sha?esc(String(b.commit_sha).slice(0,10)):'—',esc((b&&b.branch)||''),'sm')+
  '</div>';
  h+=historyPanelHtml(tile,{fixed:true});
  const rows=state.buildRows;
  const body=rows===null?'<div class="hp-loading"><div class="skel" style="height:160px"></div></div>':rows.length?`<div class="table-wrap"><table><thead><tr><th>Test</th><th>Suite</th><th>Status</th><th>Duration</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.test_name||r.test_key)}<div class="key small">${esc(r.test_key)}</div></td><td>${esc(r.suite||'—')}</td><td>${badge({status:r.status})}</td><td>${esc(secs(r.duration_ms))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No build results yet. From Sand Bench CI or container: <code>npm run report:unit-container</code></div>';
  h+=`<div class="card"><div class="card-head"><h2>Latest build results</h2><span class="muted small">${esc((b&&b.build_id)||'none')}</span></div>${body}</div>`;
  el('content').innerHTML=h;
}
function renderCurrentView(){
  state.tiles=new Map();state.charts=new Map();state.panels=new Set();state.section=null;
  state.live=liveCaseState();
  const v=state.view;
  if(v==='history')renderHistory();
  else if(v==='run')renderRun();
  else if(v==='builds')renderBuilds();
  else if(v==='type')renderTypeView(state.typeId);
  else if(v==='baseline')renderTypeView('selenium-baseline');
  else if(v==='sit'||v==='sit-all')renderSitView(state.sitGroupId);
  else renderOverview();
  drawCharts();
  for(const key of state.panels){const h=state.history.get(key);if(!h||(h.stale&&!h.loading))loadHistory(state.tiles.get(key));}
}
function renderWorkerPill(){const live=state.workers.filter(workerFresh).length;el('workerPill').textContent='workers '+live+' live / '+state.workers.length;el('workerPill').title='Heartbeat within the last '+(WORKER_FRESH_MS/1000)+'s / registered';el('workerPill').className=live?'pill ok':'pill';el('livePill').innerHTML=`<span class="pulse${activeRuns().some(e=>!isStalled(e))?'':' idle'}"></span>updated <span data-ago="${esc(state.lastPoll)}">${ago(state.lastPoll)}</span>`;}
function renderBanner(){
  if(state.loaded&&!state.cases.length)return banner('No test cases in DB. Enable AUTO_SEED / IMPORT_SIT and redeploy.');
  if(state.liveLoaded&&!state.workers.some(workerFresh))return banner('No live worker (no heartbeat in the last 90s) — queued runs will wait until one connects.');
  banner(null);
}
function renderEnvSelect(){
  if(!state.envId){try{state.envId=localStorage.getItem('te.env')||null;}catch{}}
  if(!state.envId||!state.environments.some(e=>e.id===state.envId)){
    // Sensible default per application: the engine tests itself on engine-local,
    // everything else defaults to the containerized-worker environment — the
    // deployed worker runs inside Docker, where 127.0.0.1 is the container
    // itself, not the host, so sand-bench-local only works with a host worker.
    const prefer=state.appKey==='gavriq-test-engine'?['engine-local','sand-bench-local','local-dev']:['sand-bench-container','sand-bench-local','local-dev','sandbox'];
    const hit=prefer.map(k=>state.environments.find(e=>e.key===k)).find(Boolean);
    state.envId=(hit&&hit.id)||(state.environments[0]&&state.environments[0].id)||null;
  }
  el('envSelect').innerHTML=state.environments.map(e=>'<option value="'+esc(e.id)+'"'+(e.id===state.envId?' selected':'')+'>'+esc(e.name||e.key)+'</option>').join('')||'<option value="">None</option>';
}
function renderAppSelect(){
  const sel=el('appSelect');if(!sel)return;
  sel.innerHTML=state.applications.map(a=>'<option value="'+esc(a.key)+'"'+(a.key===state.appKey?' selected':'')+'>'+esc(a.name||a.key)+'</option>').join('')||'<option value="sand-bench">Sand Bench</option>';
}
async function switchApplication(key){
  if(!key||key===state.appKey)return;
  state.appKey=key;
  try{localStorage.setItem('te.app',key);}catch{}
  // Full reset of app-scoped view state; environments stay global.
  Object.assign(state,{loaded:false,cases:[],suites:[],build:null,stats:{},idx:null,tile:null,suiteId:null,selected:new Set(),rowLimit:ROWS,buildRows:null,since:null,catalogSig:null});
  state.history.clear();
  location.hash='#/overview';
  renderSideNav();renderCurrentView();
  try{await loadSummary();}catch(e){banner('Failed to load '+key+': '+e.message);}
  renderSideNav();renderCurrentView();pollLive();
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function openCase(id){
  el('detailTitle').textContent='Loading…';
  el('detailBody').innerHTML='<div class="skel" style="height:160px"></div>';
  if(!el('detail').open)el('detail').showModal();
  try{
    const [res,hist]=await Promise.all([api('/api/v1/test-cases/'+encodeURIComponent(id)),postJson('/api/v1/ui/history',{case_ids:[id],limit:10}).catch(()=>({data:{runs:[]}}))]);
    const c=res.data,lite=state.idx&&state.idx.caseById.get(c.id);
    const suites=((lite&&lite.suite_ids)||[]).map(s=>state.idx.suiteById.get(s)).filter(Boolean);
    const runs=hist.data.runs||[];
    el('detailTitle').textContent=c.name||c.key;
    el('detailBody').innerHTML=`<dl class="kv"><dt>Key</dt><dd class="key">${esc(c.key)}</dd><dt>Status</dt><dd>${badge(lite&&lite.last_status?{status:lite.last_status}:null)}${lite&&lite.last_at?' <span class="muted small">'+esc(when(lite.last_at))+'</span>':''}</dd><dt>Type</dt><dd>${esc(c.test_type||'—')}</dd><dt>Method</dt><dd>${esc(c.execution_method||'—')}</dd><dt>Suites</dt><dd>${suites.map(s=>'<span class="tag">'+esc(s.name)+'</span>').join(' ')||'—'}</dd><dt>Tags</dt><dd>${(c.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join(' ')||'—'}</dd><dt>Description</dt><dd>${esc(c.description||'—')}</dd></dl>
      <h3 class="dlg-h">Recent runs</h3>${runs.length?`<ul class="mini-runs">${runs.map(r=>`<li><a href="#/run/${esc(r.id)}" data-close>${badge(r.failed?'failed':r.passed?'passed':'other')}<span class="key">${esc(r.key)}</span><span class="muted small">${esc(when(r.created_at))}</span></a></li>`).join('')}</ul>`:'<p class="muted small">This case has never run.</p>'}
      <button class="btn primary" id="detailRun">Run this case</button>`;
    el('detailRun').onclick=()=>{runCases([c.id],c.key);el('detail').close();};
  }catch(e){el('detailTitle').textContent='Could not load case';el('detailBody').textContent=e.message;}
}
async function queueExecution(body,label){
  if(!state.envId){toast('No environment available.');return;}
  try{
    const res=await postJson('/api/v1/executions',{...body,environment_id:state.envId,trigger_source:'manual',...(state.headed?{metadata:{headless:false}}:{})});
    toast('Queued '+label+' — '+res.data.key,'#/run/'+res.data.id);
    pollLive();
  }catch(e){toast('Run failed: '+e.message);}
}
function runCases(ids,label){if(ids.length)queueExecution({test_case_ids:ids},label);}
function runSuite(suiteId,ids,label){queueExecution({test_suite_id:suiteId,test_case_ids:ids},label||'suite');}
async function cancelRun(id){
  try{await api('/api/v1/executions/'+encodeURIComponent(id)+'/cancel',{method:'POST'});toast('Cancelled run');}
  catch(e){toast('Cancel failed: '+e.message);}
  if(state.view==='run')await loadRun(state.runId);
  pollLive();
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true;}
  catch{
    try{
      const ta=document.createElement('textarea');
      ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();
      document.execCommand('copy');ta.remove();
      return true;
    }catch{return false;}
  }
}
async function copyEvidence(url,btn){
  if(!url)return;
  const ok=await copyText(url);
  toast(ok?'Evidence link copied':'Copy failed — select and copy manually');
  if(ok&&btn){const prev=btn.textContent;btn.textContent='Copied';btn.disabled=true;setTimeout(()=>{btn.textContent=prev;btn.disabled=false;},1500);}
}
async function toggleEvidence(rid){
  if(state.evidence.has(rid))state.evidence.delete(rid);
  else{try{state.evidence.set(rid,(await api('/api/v1/execution-results/'+encodeURIComponent(rid)+'/evidence')).data||[]);}catch(e){toast('Evidence failed: '+e.message);}}
  renderCurrentView();
}
function toggleTile(key){
  const tile=state.tiles.get(key);
  const opening=state.tile!==key;
  state.tile=opening?key:null;
  if(tile&&tile.suiteId){state.suiteId=opening?tile.suiteId:null;state.selected=new Set();state.rowLimit=ROWS;}
  renderCurrentView();
  if(opening){const p=el('hp');if(p)p.scrollIntoView({behavior:'smooth',block:'nearest'});}
}
function handleAction(action,node){
  const key=node.dataset.key;
  if(action==='close-tile'){const t=state.tiles.get(state.tile);if(t&&t.suiteId)state.suiteId=null;state.tile=null;renderCurrentView();}
  else if(action==='scroll-details'){const d=el('details');if(d)d.scrollIntoView({behavior:'smooth',block:'start'});}
  else if(action==='run-tile'){const t=state.tiles.get(key);if(!t)return;const ids=(t.cases||[]).map(c=>c.id);if(t.suiteId)runSuite(t.suiteId,ids,t.title);else runCases(ids,t.title);}
  else if(action==='retry-history'){state.history.delete(key);renderCurrentView();}
  else if(action==='more'){state.rowLimit+=ROWS;renderCurrentView();}
  else if(action==='clear-suite'){state.suiteId=null;state.tile=null;renderCurrentView();}
  else if(action==='run-selected')runCases([...state.selected],plural(state.selected.size,'case'));
  else if(action==='run-section'&&state.section){const s=state.section;if(s.suiteId)runSuite(s.suiteId,s.ids,s.label);else runCases(s.ids,s.label);}
  else if(action==='cancel-run')cancelRun(node.dataset.id);
  else if(action==='rerun'&&state.run)runCases(state.run.test_case_ids||[],state.run.key);
  else if(action==='evidence')toggleEvidence(node.dataset.rid);
  else if(action==='copy-evidence')copyEvidence(node.dataset.url,node);
  else if(action==='run-all')runEverything(node);
}
async function runEverything(btn){
  if(!state.envId){toast('No environment available.');return;}
  if(btn)btn.disabled=true;
  try{
    const res=await postJson('/api/v1/executions/run-all',{application_key:state.appKey,environment_id:state.envId});
    const d=res.data||{};
    toast(res.message||('Queued '+(d.executions||[]).length+' suite runs ('+(d.total_cases||0)+' cases)'),'#/history');
    pollLive();
  }catch(e){toast('Run everything failed: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}

// ---------------------------------------------------------------------------
// Routing + wiring (event delegation: bound once, survives re-renders)
// ---------------------------------------------------------------------------
function parseHash(){
  const parts=(location.hash||'#/overview').replace(/^#\/?/,'').split('/');
  const v=parts[0]||'overview',arg=parts[1]?decodeURIComponent(parts[1]):null;
  Object.assign(state,{typeId:null,sitGroupId:null,runId:null,suiteId:null,tile:null,selected:new Set(),rowLimit:ROWS});
  if(v==='type'&&arg){state.view='type';state.typeId=arg;}
  else if(v==='sit'){state.view=arg?'sit':'sit-all';state.sitGroupId=arg;}
  else if(v==='run'&&arg){state.view='run';state.runId=arg;}
  else if(v==='history'||v==='builds'||v==='baseline')state.view=v;
  else state.view='overview';
}
async function onRoute(){
  parseHash();renderSideNav();
  const runId=state.runId;
  if(state.view==='builds'&&state.buildRows===null)loadBuildRows();
  renderCurrentView();
  window.scrollTo(0,0);
  if(runId){await loadRun(runId);if(state.runId===runId)renderCurrentView();}
}
async function refreshAll(){
  try{await Promise.all([loadSummary(),pollLive(),loadHealth()]);banner(null);renderBanner();renderSideNav();renderCurrentView();}
  catch(e){banner('Failed to load: '+e.message);}
}
el('menuToggle').onclick=()=>el('sidebar').classList.toggle('open');
el('refreshBtn').onclick=()=>refreshAll();
el('detailClose').onclick=()=>el('detail').close();
el('detailBody').addEventListener('click',e=>{if(e.target.closest('[data-close]'))el('detail').close();else{const c=e.target.closest('[data-case]');if(c)openCase(c.dataset.case);}});
el('envSelect').onchange=()=>{state.envId=el('envSelect').value||null;try{localStorage.setItem('te.env',state.envId||'');}catch{}};
el('headedCheck').onchange=()=>{state.headed=el('headedCheck').checked;try{localStorage.setItem('te.headed',state.headed?'1':'');}catch{}};
el('appSelect').onchange=()=>switchApplication(el('appSelect').value);
el('globalSearch').oninput=debounce(e=>{state.search=e.target.value;state.rowLimit=ROWS;renderCurrentView();},120);
el('sideNav').addEventListener('click',e=>{
  const b=e.target.closest('.nav-item');if(!b)return;
  const v=b.dataset.view,id=b.dataset.id;
  location.hash=v==='type'?'#/type/'+encodeURIComponent(id):v==='sit'?'#/sit/'+encodeURIComponent(id):v==='sit-all'?'#/sit':v==='overview'?'#/overview':'#/'+v;
  el('sidebar').classList.remove('open');
});
const content=el('content');
content.addEventListener('click',e=>{
  const t=e.target;
  const act=t.closest('[data-action]');if(act){if(!act.disabled)handleAction(act.dataset.action,act);return;}
  const tile=t.closest('[data-tile]');if(tile){toggleTile(tile.dataset.tile);return;}
  const cs=t.closest('[data-case]');if(cs){openCase(cs.dataset.case);return;}
  const run=t.closest('[data-run]');if(run&&!t.closest('a,button,input'))location.hash='#/run/'+encodeURIComponent(run.dataset.run);
});
content.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-run]'))location.hash='#/run/'+encodeURIComponent(e.target.dataset.run);});
content.addEventListener('change',e=>{
  const cb=e.target.closest('[data-sel]');if(!cb)return;
  if(cb.checked)state.selected.add(cb.dataset.sel);else state.selected.delete(cb.dataset.sel);
  content.querySelectorAll('[data-action="run-selected"]').forEach(b=>{b.disabled=!state.selected.size;b.textContent=runSelLabel();});
});
content.addEventListener('toggle',e=>{const d=e.target;if(d.dataset&&d.dataset.keep){if(d.open)state.open.add(d.dataset.keep);else state.open.delete(d.dataset.keep);}},true);
window.addEventListener('hashchange',onRoute);
window.addEventListener('resize',debounce(drawCharts,150));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollLive();});
let tick=0;
setInterval(()=>{
  document.querySelectorAll('[data-elapsed]').forEach(n=>{n.textContent=dur(serverNow()-ms(n.dataset.elapsed));});
  if(++tick%5===0)document.querySelectorAll('[data-ago]').forEach(n=>{n.textContent=ago(n.dataset.ago);});
},1000);
(async function init(){
  try{state.headed=!!localStorage.getItem('te.headed');}catch{}
  el('headedCheck').checked=state.headed;
  parseHash();renderSideNav();renderCurrentView();       // skeleton paints before any data arrives
  loadHealth();setInterval(loadHealth,60000);
  try{await loadApplications();await Promise.all([loadSummary(),pollLive()]);}catch(e){banner('Failed to load: '+e.message);return;}
  renderBanner();onRoute();
})();
