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
const ENV_TYPES=['localhost','development','integration','qa','sit','uat','staging','pre_prod','production','docker','kubernetes','aws','azure','gcp','remote'];
const SAFETY_CATEGORIES=['functional_smoke','read_only_api','write_api','load','stress','soak','chaos','destructive_db','security_scan','deployment'];
const SAFETY_DEFAULT={functional_smoke:'allowed',read_only_api:'allowed',write_api:'allowed',load:'allowed',soak:'allowed',chaos:'allowed',security_scan:'allowed',deployment:'allowed',stress:'approval_required',destructive_db:'prohibited'};
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
  run:null,buildRows:null,
  // Deploy to the selected environment: null until triggered, then polled to a terminal status (and through its teardown).
  deploy:null,deployMode:'deploy_run_teardown',
  // Deploy, run, tear down — repeated N times. Comes from /api/v1/ui/live and survives refresh.
  cycleRun:null,cycleIterations:3,
  // Deploy-failure loop for the selected app+env (null when quiet). Comes from /api/v1/ui/live.
  deployLoop:null,
  // Configuration · Infrastructure (managed Docker stacks, lifecycle policy, jobs)
  infra:null,infraSig:'',infraOpenJob:null,
  // Configuration · Applications / Environments maintenance pages
  appFormOpen:false,appForm:{key:'',name:'',description:'',status:'active'},
  envFormOpen:false,envForm:{id:null,key:'',name:'',env_type:'remote',base_url:'',applications:'',api:'',dbviewer:'',testhub:'',tenant:'',username:'',password_env:'',safety:{...SAFETY_DEFAULT}},
  envStatus:new Map(),
  // Inline case detail (replaces the old modal): #/case/:id and #/case/:id/runs
  caseId:null,caseTab:'details',caseDetail:null,
  // Filter views reached from case-detail links
  methodName:null,tagName:null,
  // Configuration page (run retention)
  settings:null,
  // Catalog coverage audit (plain-language fields missing/thin): populated by loadCoverage.
  coverage:null,
  // Test Runs page: full paginated/filterable history (separate from the live poll's capped tail)
  runsFilter:{environment_id:'',status:'',trigger_source:'',application_version:'',from:'',to:''},runsSel:new Set(),runsTab:null,
  appVersion:'main',
  runsList:{rows:[],total:0,offset:0,loading:false,loaded:false},
  // Overview: multi-select test types to run together, and which of its tabs is open
  selectedTypes:new Set(),overviewTab:'summary',
  // Schedule runs: list (null = not loaded) + the create form. "What to run" is a scope, not a saved suite.
  schedules:null,schedFormOpen:false,
  schedForm:{name:'',kind:'all',types:[],suiteId:'',caseText:'',caseKeys:[],envId:'',when:'once',at:'',cron:'0 2 * * *'},
  // Reports: filter form + the last preview
  reportForm:{title:'',appScope:'current',envId:'',kind:'all',types:[],suiteId:'',caseText:'',caseKeys:[],runSel:'last_run',from:'',to:'',status:'all',details:true,evidence:false},
  report:{data:null,loading:false,error:null,busy:''},
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
// Case-detail hyperlinks: which nav destination a case's type/suite resolves to.
function typeIdOfCase(id){if(!state.idx)return null;for(const [tid,list] of state.idx.casesByType){if(list.some(c=>c.id===id))return tid;}return null;}
function caseTypeHref(c){
  const tid=typeIdOfCase(c.id);
  if(!tid)return null;
  if(tid==='sit'){
    for(const g of SIT_GROUPS){if((state.idx.sitGroupCases.get(g.id)||[]).some(x=>x.id===c.id))return {href:'#/sit/'+g.id,label:'SIT · '+g.title};}
    return {href:'#/sit',label:'SIT'};
  }
  if(tid==='selenium-baseline'&&!typeList().some(t=>t.id==='selenium-baseline'))return {href:'#/baseline',label:typeTitle(tid)};
  return {href:'#/type/'+encodeURIComponent(tid),label:typeTitle(tid)};
}
function caseTypeLinkHtml(c){const h=caseTypeHref(c);return h?`<a href="${esc(h.href)}">${esc(h.label)}</a>`:'—';}
function suiteHref(s){
  if(!state.idx)return '#/overview';
  if(isSitSuite(s)){
    for(const g of SIT_GROUPS){if((state.idx.sitGroupSuites.get(g.id)||[]).some(x=>x.id===s.id))return '#/sit/'+g.id+'/suite/'+s.id;}
    return '#/sit';
  }
  for(const t of typeList()){if(suitesForType(t.id).some(x=>x.id===s.id))return '#/type/'+encodeURIComponent(t.id)+'/suite/'+s.id;}
  return '#/type/other';
}
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
// Statuses and history are per environment: the same case can pass on staging and fail on development.
function envQuery(){return state.envId?'&environment_id='+encodeURIComponent(state.envId):'';}
const envStoreKey=()=>'te.env.'+(state.appKey||'sand-bench');
const currentEnv=()=>state.environments.find(e=>e.id===state.envId)||null;
const envName=()=>{const e=currentEnv();return e?(e.name||e.key):'any environment';};
async function loadApplications(){
  try{state.applications=(await api('/api/v1/applications')).data||[];}catch{state.applications=[];}
  if(!state.appKey){
    let saved=null;try{saved=localStorage.getItem('te.app');}catch{}
    state.appKey=(saved&&state.applications.some(a=>a.key===saved))?saved
      :(state.applications.some(a=>a.key==='sand-bench')?'sand-bench':(state.applications[0]&&state.applications[0].key)||'sand-bench');
  }
  renderAppSelect();
}
async function loadSummary(retry){
  if(!state.envId&&!retry){try{state.envId=localStorage.getItem(envStoreKey())||null;}catch{}}
  const sent=state.envId;
  const d=(await api('/api/v1/ui/summary'+appQuery()+envQuery())).data||{};
  state.environments=d.environments||[];
  renderEnvSelect();
  // The environment is only known once the list arrives (first visit, or a saved one that was retired).
  if(state.envId!==sent&&!retry)return loadSummary(true);
  state.cases=d.cases||[];state.suites=d.suites||[];
  state.application=d.application||null;state.build=d.build||null;state.stats=d.stats||{};
  const meta=d.application&&d.application.types;
  state.typesFromDb=Array.isArray(meta)&&meta.length?meta.map(t=>({id:t.key,title:t.label||t.key,summary:t.subtitle||'',category:t.category==='qc'?'qc':'qa'})):null;
  if(d.now)state.since=d.now;
  state.loaded=true;state.buildRows=null;
  indexSummary();
  markHistoryStale();
}
let polling=false,pollTimer=null;
async function pollLive(){
  if(polling)return;
  polling=true;clearTimeout(pollTimer);
  try{
    const env=state.envId;
    const res=await api('/api/v1/ui/live'+appQuery()+envQuery()+(state.since?'&since='+encodeURIComponent(state.since):''));
    const d=res.data||{};
    // A poll answered after the environment changed carries the previous one's statuses.
    if(env!==state.envId)d.changed=[];
    await applyLive(d);
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
  // The selected environment's stack state (up/down/deploying…) rides along with the live poll.
  if(d.environment_deployment!==undefined){const env=currentEnv();if(env&&JSON.stringify(env.deployment||null)!==JSON.stringify(d.environment_deployment)){env.deployment=d.environment_deployment;renderEnvSelect();dirty=true;}}
  // Deploy-failure loop for this app+env (null when quiet): drives the banner so the operator
  // sees retries in flight and the parked state once the cap is reached.
  if(d.environment_deploy_loop!==undefined){
    const prev=state.deployLoop;const next=d.environment_deploy_loop||null;
    if(JSON.stringify(prev||null)!==JSON.stringify(next)){state.deployLoop=next;renderBanner();dirty=true;}
  }
  // Cycle run (deploy, run, tear down — repeated N times) for this app+env.
  if(d.environment_cycle_run!==undefined){
    const prev=state.cycleRun;const next=d.environment_cycle_run||null;
    if(JSON.stringify(prev||null)!==JSON.stringify(next)){
      state.cycleRun=next;
      // When a cycle just completed/failed/cancelled, pick up the latest deployment so stages reflect it.
      if(prev&&prev.status==='running'&&next&&next.status!=='running')loadActiveDeployment();
      // When a new iteration begins (deployment id changed) pull the new deployment in.
      if(prev&&next&&prev.current_deployment_id!==next.current_deployment_id)loadActiveDeployment();
      // Clean-cycle preparation just completed → iteration 1's deploy has started: pick it up.
      if(prev&&next&&prev.preparation_phase&&!next.preparation_phase)loadActiveDeployment();
      renderBanner();dirty=true;
    }
  }
  if(state.view==='config-infra')loadInfra(true);
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
  // Form screens show no live data; re-rendering them on a poll would wipe what is being typed.
  if(dirty){renderSideNav();if(!FORM_VIEWS.has(state.view))renderCurrentView();}
}
const FORM_VIEWS=new Set(['config-retention','config-apps','config-envs','schedules','reports','case','test-cases','test-case-form','test-suites','test-suite-form']);
async function loadRun(id){
  try{
    const [run,ev]=await Promise.all([
      api('/api/v1/ui/executions/'+encodeURIComponent(id)),
      api('/api/v1/executions/'+encodeURIComponent(id)+'/evidence').catch(()=>({data:[]})),
    ]);
    state.run={...run.data,evidence:ev.data||[]};
  }catch(e){state.run={id,error:e.message};}
}
async function loadCaseDetail(id){
  try{
    const [res,hist]=await Promise.all([
      api('/api/v1/test-cases/'+encodeURIComponent(id)),
      postJson('/api/v1/ui/history',{case_ids:[id],limit:20,environment_id:state.envId}).catch(()=>({data:{runs:[]}})),
    ]);
    state.caseDetail={id,case:res.data,runs:hist.data.runs||[]};
  }catch(e){state.caseDetail={id,error:e.message};}
}
async function loadBuildRows(){
  try{state.buildRows=(await api('/api/v1/build-results'+appQuery())).data||[];}catch{state.buildRows=[];}
  if(state.view==='builds')renderCurrentView();
}
async function loadSettings(){
  try{state.settings=(await api('/api/v1/settings')).data;}catch(e){state.settings={error:e.message};}
  if(state.view==='config-retention')renderCurrentView();
}
const RUNS_PAGE=25;
function runsQuery(){
  const f=state.runsFilter;
  let q=appQuery();
  if(f.environment_id)q+='&environment_id='+encodeURIComponent(f.environment_id);
  if(f.status)q+='&status='+encodeURIComponent(f.status);
  if(f.trigger_source)q+='&trigger_source='+encodeURIComponent(f.trigger_source);
  if(f.application_version)q+='&application_version='+encodeURIComponent(f.application_version);
  if(f.from)q+='&from='+encodeURIComponent(f.from);
  if(f.to)q+='&to='+encodeURIComponent(f.to);
  return q;
}
async function loadRunsList(reset){
  if(state.runsList.loading)return;
  const offset=reset?0:state.runsList.offset;
  state.runsList={...state.runsList,loading:true};
  if(state.view==='history')renderCurrentView();
  try{
    const res=await api('/api/v1/ui/runs'+runsQuery()+'&limit='+RUNS_PAGE+'&offset='+offset);
    const rows=reset?(res.data||[]):[...state.runsList.rows,...(res.data||[])];
    state.runsList={rows,total:res.total||0,offset:offset+(res.data||[]).length,loading:false,loaded:true,facets:res.facets||{triggers:[],versions:[]}};
    if(typeof updateAppVersionDatalist==='function')updateAppVersionDatalist();
    if(reset)state.runsSel=new Set();
  }catch(e){state.runsList={...state.runsList,loading:false,loaded:true,error:e.message};}
  if(state.view==='history')renderCurrentView();
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
      :await postJson('/api/v1/ui/history',{case_ids:(tile.cases||[]).map(c=>c.id),limit:30,environment_id:state.envId});
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
  const rows=runs.map(r=>{const t=r.passed+r.failed+r.other;return `<tr${isBuild?'':` class="clickable" data-run="${esc(r.id)}"`}><td>${isBuild?esc(r.key):esc(r.name||r.key)}${isBuild?'':'<div class="key small">'+esc(r.key)+'</div>'}</td><td>${esc(when(r.created_at))}</td><td class="num">${r.passed}</td><td class="num">${r.failed}</td><td class="num">${r.other}</td><td class="num">${t?Math.round(r.passed/t*100)+'%':'—'}</td>${isBuild?'':`<td>${badge(r.status)}</td>`}</tr>`;}).join('');
  return `<div class="table-wrap"><table><thead><tr><th>${isBuild?'Build':'Run'}</th><th>Date</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Other</th><th class="num">Pass rate</th>${isBuild?'':'<th>Run status</th>'}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function drawCharts(){document.querySelectorAll('#content [data-chart]').forEach(host=>{const spec=state.charts.get(host.dataset.chart);if(spec&&spec.runs.length)Charts[spec.type](host,spec.runs,spec.opts);});}

// ---------------------------------------------------------------------------
// Case tables
// ---------------------------------------------------------------------------
function caseTable(cases){
  const shown=cases.slice(0,state.rowLimit);
  const allSelected=shown.length>0&&shown.every(c=>state.selected.has(c.id));
  const rows=shown.map(c=>{
    const st=c.last_status?{status:c.last_status}:null;
    const now=state.live.current.has(c.id),inRun=state.live.inRun.get(c.id);
    const status=now?'<span class="badge running"><span class="pulse running"></span>running</span>':badge(st)+(inRun?` <span class="muted small" title="Part of an active run">· ${inRun==='running'?'in run':'queued'}</span>`:'');
    return `<tr${now?' class="row-running"':''}><td><button class="case-name" data-case="${esc(c.id)}">${esc(c.name)}</button>${c._type==='sit'?' <span class="badge sit">SIT</span>':''}<div class="key small">${esc(c.key)}</div></td><td>${status}</td><td>${esc(c.execution_method||c.test_type||'—')}</td><td>${esc(secs(c.last_duration_ms))}</td><td class="muted small" title="${esc(when(c.last_at))}">${c.last_at?`<span data-ago="${esc(c.last_at)}">${ago(c.last_at)}</span>`:'Never'}</td><td><input type="checkbox" aria-label="Select ${esc(c.name)}" data-sel="${esc(c.id)}"${state.selected.has(c.id)?' checked':''}></td></tr>`;
  }).join('');
  const more=cases.length>shown.length?`<div class="more"><button class="btn" data-action="more">Show ${Math.min(ROWS,cases.length-shown.length)} more</button><span class="muted small">${shown.length} of ${cases.length} shown</span></div>`:'';
  return `<div class="table-wrap"><table><thead><tr><th>Test case</th><th>Status</th><th>Method</th><th>Duration</th><th>Last run</th><th><input type="checkbox" aria-label="Select all shown" data-selall="1"${allSelected?' checked':''}${shown.length?'':' disabled'}></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">No cases.</td></tr>'}</tbody></table></div>${more}`;
}
function runSelLabel(){return 'Run selected'+(state.selected.size?' ('+state.selected.size+')':'');}
function caseSectionHtml(o){
  state.section={ids:o.cases.map(c=>c.id),suiteId:o.suiteId||null,label:o.label||o.title};
  const cases=filterCases(o.cases);
  return `<div class="card" id="details"><div class="card-head"><div><h2>${esc(o.title)}</h2>${o.sub?`<div class="muted small">${esc(o.sub)}</div>`:''}</div><div class="hp-actions">${o.clear?'<button class="btn" data-action="clear-suite">Show all cases</button>':''}<button class="btn" data-action="run-selected"${state.selected.size?'':' disabled'}>${runSelLabel()}</button><button class="btn" data-action="save-suite"${state.selected.size?'':' disabled'}>Save selected as suite${state.selected.size?' ('+state.selected.size+')':''}</button><button class="btn" data-action="schedule" data-what="section"${o.cases.length?'':' disabled'} title="Schedule the selected cases — or this whole list when nothing is selected">Schedule…</button><button class="btn ${o.sit?'sit':'primary'}" data-action="run-section"${o.cases.length?'':' disabled'}>${o.suiteId?'Run suite':'Run all'} (${o.cases.length})</button></div></div><div class="toolbar"><span class="muted small">${plural(cases.length,'case')}${state.search?' matching “'+esc(state.search)+'”':''}</span>${o.note?`<span class="muted small">${esc(o.note)}</span>`:''}</div>${caseTable(cases)}</div>`;
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
  return `<article class="live-card${stalled?' stalled':''}" data-run="${esc(e.id)}" tabindex="0" aria-label="Run ${esc(e.name||e.key)}, ${esc(e.status)}">
    <div class="live-head"><span class="pulse ${esc(e.status)}"></span><span class="run-key">${esc(e.name||e.key)}</span>${badge(e.status)}<span class="muted small">${esc(suite?suite.name:plural(total,'case'))} · ${esc(e.trigger_source||'manual')}</span><span class="live-elapsed" title="Elapsed"><span data-elapsed="${esc(e.started_at||e.created_at)}">${dur(serverNow()-ms(e.started_at||e.created_at))}</span></span></div>
    ${progressHtml(e,'big')}
    <div class="live-meta"><span><b>${e.done||0}</b> / ${total} done</span>${countsHtml(e)}</div>
    <div class="live-now">${stalled?`<span class="stall">Last activity <span data-ago="${esc(e.last_activity_at||e.started_at||e.created_at)}">${ago(e.last_activity_at||e.started_at||e.created_at)}</span> — the worker may have stopped.</span><button class="btn" data-action="cancel-run" data-id="${esc(e.id)}">Cancel run</button>`:now}</div>
  </article>`;
}
function liveStripHtml(){
  const a=activeRuns().filter(e=>!isStalled(e));
  if(!a.length)return '';
  return `<div class="live-strip">${a.slice(0,3).map(e=>`<a class="ls-item" href="#/run/${esc(e.id)}"><span class="pulse ${esc(e.status)}"></span><span class="run-key">${esc(e.name||e.key)}</span><span class="muted small">${e.done||0}/${Math.max(e.total||0,e.done||0)} done · ${e.failed||0} failed</span>${progressHtml(e,'thin')}<span class="small">Watch →</span></a>`).join('')}${a.length>3?`<a class="small" href="#/history">+${a.length-3} more running</a>`:''}</div>`;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
function navItem(view,id,label,count,dot,cls){
  const active=(state.view===view&&(view==='type'?state.typeId===id:view==='sit'?state.sitGroupId===id:true))||(view==='history'&&state.view==='run');
  return '<button class="nav-item '+(active?(cls||'active'):'')+'" data-view="'+view+'" data-id="'+esc(id||'')+'">'+(dot!=null?'<span class="nav-dot '+dot+'"></span>':'')+'<span class="nav-label">'+esc(label)+'</span>'+(count!=null?'<span class="nav-count">'+count+'</span>':'')+'</button>';
}
const toneDot=cases=>TONES[tileStats({cases}).tone].dot;
// Collapsible left-nav sections. The long test-type lists start collapsed so the menu is short;
// the user's open/closed choices are remembered. A section with the active view is forced open.
const NAV_LS='te_nav_collapsed';
let navCollapsed=null;
function navCollapsedSet(){
  if(navCollapsed)return navCollapsed;
  try{const s=JSON.parse(localStorage.getItem(NAV_LS)||'null');navCollapsed=new Set(Array.isArray(s)?s:['qa','qc','sit','baseline']);}
  catch(e){navCollapsed=new Set(['qa','qc','sit','baseline']);}
  return navCollapsed;
}
function toggleNavSection(id){
  const s=navCollapsedSet();
  if(s.has(id))s.delete(id);else s.add(id);
  try{localStorage.setItem(NAV_LS,JSON.stringify([...s]));}catch(e){}
  renderSideNav();
}
function navSection(id,label,items,forceOpen){
  // On the Home view every section is collapsed by default — the home board
  // is the point of the landing, the sidebar is just a map of what's inside.
  const atHome=state.view==='home';
  const col=atHome||(!forceOpen&&navCollapsedSet().has(id));
  return '<button class="nav-sec'+(col?' collapsed':'')+'" data-sec="'+id+'" aria-expanded="'+(!col)+'"><span class="nav-caret">'+(col?'▸':'▾')+'</span><span class="nav-label">'+esc(label)+'</span></button>'
    +'<div class="nav-group"'+(col?' hidden':'')+'>'+items+'</div>';
}
function renderSideNav(){
  const tl=typeList();
  const live=activeRuns().filter(e=>!isStalled(e)).length;
  const V=state.view;
  // Tests: everything about test content (cases, suites, coverage).
  // "New test case" is now a + New button on the Test cases page.
  let h=navSection('tests','Tests',
    navItem('test-cases',null,'Test cases',state.cases.length||null)+
    navItem('test-suites',null,'Test suites',state.suites.length||null)+
    navItem('test-suite-form',null,'New test suite')+
    navItem('catalog-coverage',null,'Catalog coverage',state.coverage?state.coverage.with_findings||null:null,state.coverage&&state.coverage.by_severity.high?'red':state.coverage&&state.coverage.by_severity.medium?'amber':null),
    ['test-cases','test-case-form','test-suites','test-suite-form','catalog-coverage'].includes(V));
  // Runs: everything about running cases (overview, history, schedules, builds).
  h+=navSection('runs','Runs',
    navItem('overview',null,'Overview')+
    navItem('history',null,live?`Test runs · ${live} live`:'Test runs',state.executions.length||null,live?'blue pulse-dot':null)+
    navItem('schedules',null,'Schedule runs',Array.isArray(state.schedules)?state.schedules.filter(s=>s.enabled&&s.application_key===state.appKey).length||null:null)+
    navItem('builds',null,'In-container build',state.build?state.build.total:null,TONES[tileStats({kind:'build'}).tone].dot),
    ['overview','history','run','schedules','builds'].includes(V));
  // Reports: reports, insights and the defect log (defects are the engine's "findings" report).
  h+=navSection('reports','Reports',
    navItem('reports',null,'Reports')+
    navItem('insights',null,'Quality insights')+
    '<a class="nav-item" href="/defect-log" style="text-decoration:none"><span class="nav-label">Defect log</span></a>'+
    '<a class="nav-item" href="/defect-log#dashboard" style="text-decoration:none"><span class="nav-label">Defect dashboard</span></a>',
    ['reports','insights'].includes(V));
  // Settings: retention, applications, environments, infrastructure.
  h+=navSection('settings','Settings',
    navItem('config-retention',null,'Run retention')+
    navItem('config-apps',null,'Applications',state.applications.length||null)+
    navItem('config-envs',null,'Environments',state.environments.length||null)+
    navItem('config-infra',null,'Infrastructure',null,infraNavDot()),
    ['config-retention','config-apps','config-envs','config-infra'].includes(V));
  // The engine's own self-test cases are a single body of QC — they verify
  // the engine itself. Collapse every one of them under Quality control
  // regardless of their test_type's declared category. Any other application
  // keeps the usual QA/QC split.
  const engineOnly=state.appKey==='gavriq-test-engine';
  const typeItem=t=>{const cs=casesForType(t.id);return navItem('type',t.id,t.title,cs.length,toneDot(cs));};
  const qaItems=engineOnly?'':tl.filter(t=>t.category==='qa').map(typeItem).join('');
  const qcTypeItems=engineOnly?tl.map(typeItem).join(''):tl.filter(t=>t.category!=='qa').map(typeItem).join('');
  if(qaItems)h+=navSection('qa',CAT.qa,qaItems);
  // SIT console lives under Quality control. The entries are always shown — an empty list
  // when nothing is seeded is fine; the entry explains what is here.
  const sitAllN=sitCases().length;
  const sitItems=navItem('sit-all',null,'All SIT cases',sitAllN||null,sitAllN?'blue':null,'active-sit')+
    SIT_GROUPS.map(g=>{const cs=(state.idx&&state.idx.sitGroupCases.get(g.id))||[];return navItem('sit',g.id,g.title,cs.length||null,cs.length?toneDot(cs):null,'active-sit');}).join('');
  h+=navSection('qc',CAT.qc,qcTypeItems+sitItems,V==='sit'||V==='sit-all');
  if(!tl.some(t=>t.id==='selenium-baseline')){const bl=casesForType('selenium-baseline');h+=navSection('baseline','Selenium Baseline',navItem('baseline',null,'Selenium Baseline',bl.length,toneDot(bl)),V==='baseline');}
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
  // Engine self-test cases all sit under QC on the Overview tile board, same as the sidebar.
  const engineOnly=state.appKey==='gavriq-test-engine';
  if(engineOnly){
    groups.push({title:CAT.qc,sub:'Engine self-tests',tiles:tl.map(typeTile)});
  }else{
    groups.push(
      {title:CAT.qa,tiles:tl.filter(t=>t.category==='qa').map(typeTile)},
      {title:CAT.qc,tiles:tl.filter(t=>t.category!=='qa').map(typeTile)},
    );
  }
  groups.push({title:'Baselines & builds',tiles:more});
  return groups;
}
function overviewTabsHtml(live){
  const tab=state.overviewTab||'summary';
  const t=(id,label)=>`<button class="tab-btn${tab===id?' active':''}" data-action="overview-tab" data-tab="${id}">${label}</button>`;
  return `<div class="tabs" style="margin-bottom:16px">${t('summary','Summary')}${t('running','Running now'+(live.length?' ('+live.length+')':''))}${t('types','Run by test type')}</div>`;
}
// Deploy actions bar + current deployment progress — shared across every
// overview tab (summary, running, types) so the user never loses sight of the
// current deploy→run→teardown stage, whichever tab they are on. Clicking a
// stage opens its live log or per-case progress right under the bar.
function overviewActionsAndStatusHtml({runAllCount}={}){
  const all=runAllCount==null?tileStats({cases:state.cases}).total:runAllCount;
  const live=activeRuns();
  const appName=(state.applications.find(a=>a.key===state.appKey)||{}).name||state.appKey||'application';
  const env=currentEnv(),managed=!!(env&&env.infra),stackSt=managed?stackState(env):null,ref=(managed&&env.infra.default_ref)||'main';
  const mode=state.deployMode||'deploy_run_teardown';
  const opt=(v,l,t)=>`<option value="${v}"${mode===v?' selected':''} title="${esc(t)}">${l}</option>`;
  const tearBtn=managed&&(stackSt==='up'||stackSt==='failed'||stackSt==='unknown')?`<button class="btn" data-action="infra-teardown" data-id="${esc(env.id)}" data-name="${esc(env.name||env.key)}" data-active="${live.length}" title="Take the Docker stack down now — it is deployed again on the next deploy or run">⏏ Tear down</button>`:'';
  const cyc=state.cycleRun&&state.cycleRun.status==='running';
  const cancelBtn=live.length?`<button class="btn" data-action="cancel-all-runs" title="Cancel every run in progress for ${esc(appName)} on ${esc(envName())}">⏹ Cancel runs (${live.length})</button>`:'';
  const iters=Math.max(1,Math.min(100,state.cycleIterations||3));
  const isLoop=mode==='deploy_run_teardown_loop'||mode==='clean_cycle';
  const iterInput=isLoop||cyc?`<label class="muted small" style="display:inline-flex;align-items:center;gap:4px">× <input type="number" id="cycleIterations" min="1" max="100" value="${iters}" style="width:56px" aria-label="iterations" title="How many deploy → run → tear down cycles"${cyc?' disabled':''}></label>`:'';
  const deployBtnLabel=mode==='clean_cycle'?`▶ Clean cycle (${iters}×)`
    :mode==='deploy_run_teardown_loop'?`▶ Start cycle (${iters}×)`
    :`⇪ Deploy ${esc(ref)}`;
  const deployBtnTitle=mode==='clean_cycle'
    ?`Tear down whatever is there, prune Docker (dangling images, old build cache, stopped containers), then deploy ${esc(ref)} (with every dependency the compose stack brings up), run everything, tear down — repeat ${iters} times`
    :mode==='deploy_run_teardown_loop'
    ?`Deploy ${esc(ref)}, run everything, tear down — repeat ${iters} times (cancel any time)`
    :`Deploy ${esc(ref)} to the selected environment`;
  // "Run by test type" tab: the main run button runs only the selected types,
  // and the Schedule button scopes to those types too. On every other tab it
  // keeps running / scheduling everything for the application.
  const onTypes=state.overviewTab==='types';
  const typesCount=[...(state.selectedTypes||[])].reduce((n,id)=>n+casesForType(id).length,0);
  const runBtn=onTypes
    ? `<button class="btn primary" data-action="run-types"${state.selectedTypes&&state.selectedTypes.size?'':' disabled'} title="Queue one execution per suite within the selected test types on ${esc(envName())}">▶ Run selected types${typesCount?' ('+typesCount+' cases)':''}</button>`
    : `<button class="btn primary" data-action="run-all"${all?'':' disabled'} title="Queue one execution per suite — every runnable case for this application on the selected environment${managed?'. A stack that is down is deployed first and torn down after the run':''}">▶ Run everything (${all})</button>`;
  const schedBtn=onTypes
    ? `<button class="btn" data-action="schedule" data-what="types"${state.selectedTypes&&state.selectedTypes.size?'':' disabled'}>Schedule…</button>`
    : `<button class="btn" data-action="schedule" data-what="all"${all?'':' disabled'}>Schedule…</button>`;
  const head=`<div class="group-head first"><h2>${esc(appName)} <span class="muted small">on ${esc(envName())}</span> ${managed?stackChipHtml(env,'Docker stack: '+stackSt):''}</h2><div class="hp-actions">${runBtn}${schedBtn}${cancelBtn}<select id="deployMode" aria-label="What to do after deploying" title="What happens once the deploy succeeds"${cyc?' disabled':''}>${opt('deploy_run_teardown','Deploy, run, tear down','Deploy, run everything, then take the stack down once the run has finished — whatever the result')}${opt('deploy_run_teardown_loop','Loop: deploy, run, tear down ×N','Deploy, run everything, tear down — then repeat the whole thing N times. Cancel any time.')}${opt('clean_cycle','Clean cycle: teardown + prune, then deploy–run–teardown ×N','Starts clean: tears down whatever is up, prunes Docker (stopped containers, dangling images, build cache), then runs the normal deploy–run–teardown ×N. Dependencies (Kafka, MQ, portals, …) come up as part of the compose deploy.')}${opt('deploy_and_run','Deploy and run','Deploy and run everything; the stack stays up until the idle or max-uptime rule takes it down')}${opt('deploy_only','Deploy only','Deploy and leave the stack up; nothing is run')}</select>${iterInput}<button class="btn" data-action="deploy-main"${state.envId&&!cyc?'':' disabled'} title="${esc(deployBtnTitle)}">${deployBtnLabel}</button>${tearBtn}</div></div>`;
  return head+cycleRunHtml()+deployStatusHtml();
}
function renderOverview(){
  el('viewTitle').textContent='Overview';
  if(!state.loaded){el('content').innerHTML=skeletonHtml();return;}
  const tab=state.overviewTab||'summary';
  const live=activeRuns();
  let h=overviewTabsHtml(live);
  // Shared across every tab: the deploy actions + deploy progress bar — so
  // the deploy→run→teardown stages stay in sight on Running now and Run by
  // test type too, with the same clickable per-stage detail.
  h+=overviewActionsAndStatusHtml();
  if(tab==='running'){
    h+=live.length
      ?`<div class="live-board">${live.map(liveCardHtml).join('')}</div>`
      :'<div class="card empty">No runs in progress. Start one from any catalog page — it appears here with live per-case progress.</div>';
  }else if(tab==='types'){
    h+=typeRunSelectorHtml();
  }else{
    const all=tileStats({cases:state.cases});
    const hot=live.filter(e=>!isStalled(e)).length;
    const b=state.build;
    h+='<div class="kpi-grid">'+
      kpi('All cases',all.total,'in repository')+
      kpi('Passing',all.passed,'latest result passed',all.passed?'green':'')+
      kpi('Failing',all.failed,'latest result failed',all.failed?'red':'')+
      kpi('Never run',all.never,'no result on '+esc(envName()))+
      kpi('Active runs',hot,`${state.stats.runs_7d||0} runs in the last 7 days`,hot?'amber':'')+
      kpi('Last build',b?esc(String(b.build_id).slice(0,14)):'—',b?`${b.passed} passed · ${b.failed} failed (in-container)`:'no CI results yet','sm'+(b&&b.failed?' red':''))+
    '</div>';
    if(state.search)h+=caseSectionHtml({title:'Matching cases',cases:filterCases(state.cases),label:'search results'});
    h+=legendHtml();
    h+=overviewGroups().map(tileGroupHtml).join('');
  }
  el('content').innerHTML=h;
}
function typeRunSelectorHtml(){
  const tl=typeList();
  const rows=tl.map(t=>{
    const n=casesForType(t.id).length;
    return `<label class="type-check"><input type="checkbox" data-typesel="${esc(t.id)}"${state.selectedTypes.has(t.id)?' checked':''}${n?'':' disabled'}> ${esc(t.title)} <span class="muted small">(${n})</span></label>`;
  }).join('');
  const total=[...state.selectedTypes].reduce((n,id)=>n+casesForType(id).length,0);
  // Run / Schedule buttons live in the shared action bar above (one row).
  return `<div class="card"><div class="card-head"><div><h2>Run by test type</h2><div class="muted small">Select one or more test types; use <b>Run selected types</b> above to run every case in them together${total?' ('+total+' cases)':''}.</div></div></div><div class="hp-body"><div class="type-check-grid">${rows}</div></div></div>`;
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
function runsFilterBarHtml(){
  const f=state.runsFilter;
  const envOptions='<option value="">All environments</option>'+state.environments.map(e=>`<option value="${esc(e.id)}"${f.environment_id===e.id?' selected':''}>${esc(e.name||e.key)}</option>`).join('');
  const statuses=['','queued','preparing','running','passed','failed','skipped','blocked','cancelled','error','timed_out'];
  const statusOptions=statuses.map(s=>`<option value="${s}"${f.status===s?' selected':''}>${s?esc(s.replace(/_/g,' ')):'All statuses'}</option>`).join('');
  const facets=(state.runsList&&state.runsList.facets)||{triggers:[],versions:[]};
  const triggers=['',...(facets.triggers||[])];
  const triggerOptions=triggers.map(t=>`<option value="${esc(t)}"${f.trigger_source===t?' selected':''}>${t?esc(t):'All triggers'}</option>`).join('');
  const versions=['',...(facets.versions||[])];
  const versionOptions=versions.map(v=>`<option value="${esc(v)}"${f.application_version===v?' selected':''}>${v?esc(v):'All versions'}</option>`).join('');
  const active=f.environment_id||f.status||f.trigger_source||f.application_version||f.from||f.to;
  return `<div class="toolbar" style="flex-wrap:wrap">
    <select id="runsEnvFilter" aria-label="Filter by environment">${envOptions}</select>
    <select id="runsStatusFilter" aria-label="Filter by status">${statusOptions}</select>
    <select id="runsTriggerFilter" aria-label="Filter by trigger source">${triggerOptions}</select>
    <select id="runsVersionFilter" aria-label="Filter by application version" title="e.g. main, a branch name, a tag — populated from past runs">${versionOptions}</select>
    <input type="date" id="runsFromFilter" value="${esc(f.from)}" aria-label="From date">
    <span class="muted small">to</span>
    <input type="date" id="runsToFilter" value="${esc(f.to)}" aria-label="To date">
    <button class="btn" data-action="apply-run-filters">Apply</button>
    ${active?'<button class="btn" data-action="clear-run-filters">Clear filters</button>':''}
  </div>`;
}
function runsTableHtml(){
  const rl=state.runsList;
  const sel=state.runsSel||new Set();
  const allChecked=rl.rows.length>0&&rl.rows.every(e=>sel.has(e.id));
  const rows=rl.rows.map(e=>{
    const end=e.finished_at?ms(e.finished_at):null,start=ms(e.started_at||e.created_at);
    const running=ACTIVE.has(String(e.status));
    const durVal=running?`<span data-elapsed="${esc(e.started_at||e.created_at)}">${dur(serverNow()-start)}</span>`:end?dur(end-start):'—';
    const picked=sel.has(e.id);
    return `<tr class="clickable${picked?' row-picked':''}" data-run="${esc(e.id)}">
      <td class="runs-pick" onclick="event.stopPropagation()"><input type="checkbox" data-run-pick="${esc(e.id)}"${picked?' checked':''} aria-label="Select run ${esc(e.key)}"></td>
      <td>${esc(e.name||e.key)}<div class="key small">${esc(e.key)}</div></td>
      <td>${badge(e.status)}</td>
      <td style="min-width:150px">${progressHtml(e,'thin')}</td>
      <td class="small nowrap">${countsHtml(e)}</td>
      <td class="muted small">${esc(e.application_name||'—')}</td>
      <td class="muted small">${esc(e.application_version||'—')}</td>
      <td class="muted small">${esc(e.environment_name||'—')}</td>
      <td class="muted small">${esc(e.trigger_source||'—')}</td>
      <td class="muted small" title="${esc(when(e.created_at))}">${e.created_at?`<span data-ago="${esc(e.created_at)}">${ago(e.created_at)}</span>`:'—'}</td>
      <td class="muted small">${e.finished_at?esc(when(e.finished_at)):'—'}</td>
      <td class="muted small">${durVal}</td></tr>`;
  }).join('');
  if(rl.error)return `<div class="empty">Could not load runs: ${esc(rl.error)}</div>`;
  if(!rl.loaded)return '<div class="hp-loading"><div class="skel" style="height:160px"></div></div>';
  if(!rows)return '<div class="empty">No executions match these filters.</div>';
  const batchBar=`<div class="toolbar" style="border:none;padding:6px 0 0;align-items:center">
    <span class="muted small">${sel.size} selected</span>
    <span class="spacer" style="flex:1"></span>
    <button class="btn" data-action="runs-clear-sel"${sel.size?'':' disabled'}>Clear selection</button>
    <button class="btn" data-action="runs-delete-selected"${sel.size?'':' disabled'} style="border-color:var(--red);color:var(--red)">Delete selected${sel.size?' ('+sel.size+')':''}</button>
  </div>`;
  const more=rl.rows.length<rl.total?`<div class="more"><button class="btn" data-action="runs-more"${rl.loading?' disabled':''}>${rl.loading?'Loading…':'Load more'}</button><span class="muted small">${rl.rows.length} of ${rl.total} shown</span></div>`:`<div class="more"><span class="muted small">${plural(rl.total,'run')} total</span></div>`;
  return `${batchBar}<div class="table-wrap"><table><thead><tr><th><input type="checkbox" data-run-pickall="1"${allChecked?' checked':''} aria-label="Select all shown runs"></th><th>Run</th><th>Status</th><th>Progress</th><th>Results</th><th>Application</th><th>App version</th><th>Environment</th><th>Trigger</th><th>Created</th><th>Ended</th><th>Duration</th></tr></thead><tbody>${rows}</tbody></table></div>${more}`;
}
function renderHistory(){
  el('viewTitle').textContent='Test runs';
  const live=activeRuns();
  const hot=live.filter(e=>!isStalled(e)).length;
  // Default tab = Running now if there is anything in flight, else All runs.
  if(!state.runsTab)state.runsTab=live.length?'live':'all';
  const tab=state.runsTab;
  const t=(id,label)=>`<button class="tab-btn${tab===id?' active':''}" data-action="runs-tab" data-tab="${id}">${label}</button>`;
  const tabs=`<div class="tabs" style="margin-bottom:16px">${t('live','Running now'+(hot?' ('+hot+')':''))}${t('history','History')}${t('all','All runs'+(state.runsList&&state.runsList.total?' ('+state.runsList.total+')':''))}</div>`;
  let body;
  if(tab==='live'){
    const head=`<div class="group-head first"><h2>${live.length?liveHeading(live):'Running now'}</h2><div class="hp-actions"><span class="muted small">${hot?`${plural(hot,'run')} in progress · updates every ${POLL_ACTIVE/1000}s`:live.length?'No progress reported — cancel or restart the worker':'Nothing in progress'}</span>${live.length?'<button class="btn" data-action="cancel-all-runs">Cancel all</button>':''}</div></div>`;
    body=head+(live.length?`<div class="live-board">${live.map(liveCardHtml).join('')}</div>`:'<div class="card empty">No runs in progress. Start one from any catalog page — it appears here with live per-case progress.</div>');
  }else if(tab==='history'){
    body=state.loaded
      ?`<div class="group-head first"><h2>History</h2><span class="muted small">every engine-executed case</span></div>`+historyPanelHtml({key:'all',title:'All tests',sub:'Pass/fail per run across the whole repository',cases:state.cases},{fixed:true})
      :'<div class="hp-loading"><div class="skel" style="height:220px"></div></div>';
  }else{
    body=`<div class="group-head first"><h2>All runs</h2><span class="muted small">select a run for per-case results</span></div><div class="card"><div class="card-head"><h2>Filters</h2></div>${runsFilterBarHtml()}${runsTableHtml()}</div>`;
  }
  el('content').innerHTML=tabs+body;
}
function renderRun(){
  const r=state.run;
  el('viewTitle').textContent='Run';
  if(!r||(r.id!==state.runId&&r.key!==state.runId)){el('content').innerHTML='<div class="skel" style="height:140px;margin-bottom:16px"></div><div class="skel" style="height:320px"></div>';return;}
  if(r.error){el('content').innerHTML=`<div class="card empty">Run not found (${esc(r.error)}). <a href="#/history">Back to test runs</a></div>`;return;}
  el('viewTitle').textContent=r.name||('Run '+r.key);
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
  const failMsgs=r.results.filter(x=>x.message&&x.status!=='passed').map(x=>{
    const c=names.get(x.test_case_id)||{name:x.test_case_id,key:''};
    return `<div class="rc-msg"><b>${esc(c.name)}:</b> ${esc(x.message)}</div>`;
  }).join('');
  const evidenceList=r.evidence||[];
  const gallery=evidenceList.length?`<div class="evidence">${evidenceList.map(v=>{
    const c=names.get(v.test_case_id)||{name:v.test_case_id};
    const link=v.url&&String(v.content_type||'').startsWith('image')?`<a href="${esc(v.url)}" target="_blank" rel="noopener"><img src="${esc(v.url)}" alt="${esc(v.evidence_type)} evidence" loading="lazy"></a>`:`<a class="tag" href="${esc(v.url||'#')}" target="_blank" rel="noopener">${esc(v.evidence_type)}</a>`;
    const copyBtn=v.url?`<button class="copy-btn" data-action="copy-evidence" data-url="${esc(v.url)}" title="Copy evidence link">Copy</button>`:'';
    return `<div class="evidence-item">${link}<div class="muted small">${esc(c.name)} · ${esc(v.evidence_type)}</div>${copyBtn}</div>`;
  }).join('')}</div>`:`<div class="empty">${active?'No evidence reported yet.':'No evidence was recorded for this run.'}</div>`;
  el('content').innerHTML=`<div class="card run-head">
      <div class="card-head"><div class="live-head">${active&&!stalled?`<span class="pulse ${esc(r.status)}"></span>`:''}<span class="run-key big">${esc(r.name||r.key)}</span>${badge(r.status)}${stalled?'<span class="stall">stalled — no new results</span>':''}</div>
        <div class="hp-actions"><button class="btn" data-action="nav-back">← Back</button><button class="btn" data-action="rerun"${ids.length?'':' disabled'}>Run again</button>${active?`<button class="btn" data-action="cancel-run" data-id="${esc(r.id)}">Cancel</button>`:''}</div></div>
      <div class="run-body">
        ${progressHtml(e,'big')}
        <div class="live-meta"><span><b>${byCase.size}</b> / ${ids.length} done</span>${countsHtml(e)}${current?`<span>Now running <b>${esc((names.get(current)||{}).name||current)}</b></span>`:''}</div>
        <dl class="kv run-kv"><dt>Suite</dt><dd>${esc(r.suite_name||'—')}</dd><dt>Environment</dt><dd>${esc(r.environment_name||'—')}</dd><dt>Trigger</dt><dd>${esc(r.trigger_source||'—')}</dd><dt>Worker</dt><dd class="key">${esc(r.worker_id||(active?'waiting for a worker':'—'))}</dd><dt>Queued</dt><dd>${esc(when(r.created_at))}</dd><dt>Started</dt><dd>${esc(when(r.started_at))}</dd><dt>Finished</dt><dd>${r.finished_at?esc(when(r.finished_at)):'—'}</dd><dt>${active?'Elapsed':'Duration'}</dt><dd>${elapsed}</dd></dl>
        ${failMsgs}
      </div></div>
    ${TB.remarksHtml(r)}
    <div class="card"><div class="card-head"><h2>Evidence</h2><span class="muted small">${plural(evidenceList.length,'item')} · ${active&&!stalled?`updates every ${POLL_ACTIVE/1000}s`:active?`checking every ${POLL_IDLE/1000}s`:'final'}</span></div><div class="hp-body">${gallery}</div></div>`;
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
function renderCaseView(){
  const d=state.caseDetail;
  el('viewTitle').textContent='Test case';
  if(!d||d.id!==state.caseId){el('content').innerHTML='<div class="skel" style="height:220px"></div>';return;}
  if(d.error){el('content').innerHTML=`<div class="card empty">Could not load case (${esc(d.error)}). <a href="#/overview">Back to overview</a></div>`;return;}
  const c=d.case,lite=state.idx&&state.idx.caseById.get(c.id);
  el('viewTitle').textContent=c.name||c.key;
  const suites=((lite&&lite.suite_ids)||[]).map(s=>state.idx.suiteById.get(s)).filter(Boolean);
  const latestRun=d.runs[0];
  const head=`<div class="card-head"><button class="btn" data-action="nav-back">← Back</button><h2 style="margin:0">${esc(c.name||c.key)}</h2></div>`;
  const tabs=`<div class="tabs">
      <button class="tab-btn${state.caseTab==='details'?' active':''}" data-nav="#/case/${esc(c.id)}">Details</button>
      <button class="tab-btn${state.caseTab==='runs'?' active':''}" data-nav="#/case/${esc(c.id)}/runs">Runs (${d.runs.length})</button>
    </div>`;
  let body;
  if(state.caseTab==='runs'){
    body=d.runs.length
      ?`<div class="run-tiles">${d.runs.map(r=>`<button type="button" class="run-tile" data-run="${esc(r.id)}"><span class="run-tile-name">${esc(r.name||r.key)}</span>${badge(r.failed?'failed':r.passed?'passed':'other')}<span class="muted small">${esc(when(r.created_at))}</span></button>`).join('')}</div>`
      :'<div class="empty">This case has never run.</div>';
  }else{
    // Details in the Test cases screen representation (testbench.js): summary, plain-language
    // steps, triage, run history with remarks, notes, watchers, suites, activity.
    const extras=TB.loadCaseExtras(c.id);
    body=`<div class="hp-body"><dl class="kv">
      <dt>Key</dt><dd class="key">${esc(c.key)}</dd>
      <dt>Status</dt><dd>${latestRun?`<a href="#/run/${esc(latestRun.id)}">${badge(lite&&lite.last_status?{status:lite.last_status}:null)}</a>`:badge(null)}${lite&&lite.last_at?' <span class="muted small">'+esc(when(lite.last_at))+'</span>':''}</dd>
      <dt>Type</dt><dd>${caseTypeLinkHtml(c)}</dd>
      <dt>Method</dt><dd>${c.execution_method?`<a href="#/method/${encodeURIComponent(c.execution_method)}">${esc(c.execution_method)}</a>`:'—'}</dd>
      <dt>Suites</dt><dd>${suites.map(s=>`<a class="tag" href="${esc(suiteHref(s))}">${esc(s.name)}</a>`).join(' ')||'—'}</dd>
    </dl><div class="run-case-bar"><select id="runCaseEnv" aria-label="Environment to run in">${state.environments.map(e=>`<option value="${esc(e.id)}"${e.id===state.envId?' selected':''}>${esc(e.name||e.key)}</option>`).join('')||'<option value="">No environment available</option>'}</select><button class="btn primary" data-action="run-case" data-id="${esc(c.id)}" data-label="${esc(c.key)}"${c.execution_method==='manual'?' disabled title="A manual case is run by hand: record the outcome as a note"':''}>Run this case</button><button class="btn" data-action="schedule" data-what="case" data-key="${esc(c.key)}">Schedule…</button><button class="btn" data-action="report-case" data-key="${esc(c.key)}">Report…</button></div></div>
    ${TB.caseBodyHtml({...c,suites:c.suites||suites},{runs:(extras&&extras.runs)||null,defects:extras?extras.defects:null})}`;
  }
  el('content').innerHTML=`<div class="card">${head}${tabs}${body}</div>`;
}
function renderMethodView(name){
  el('viewTitle').textContent='Method · '+name;
  if(!state.loaded){el('content').innerHTML=skeletonHtml();return;}
  const cases=state.cases.filter(c=>String(c.execution_method||'').toLowerCase()===String(name).toLowerCase());
  el('content').innerHTML=caseSectionHtml({title:name+' cases',cases,label:name});
}
function renderTagView(name){
  el('viewTitle').textContent='Tag · '+name;
  if(!state.loaded){el('content').innerHTML=skeletonHtml();return;}
  const cases=state.cases.filter(c=>(c.tags||[]).includes(name));
  el('content').innerHTML=caseSectionHtml({title:'#'+name,cases,label:name});
}
// Catalog coverage: an audit of every active case against the plain-language fields
// (objective, preconditions, steps, expected result, test data) — so the operator can
// see at a glance which cases need more detail.
async function loadCoverage(){
  if(state.coverage&&state.coverage.loading)return;
  state.coverage={...(state.coverage||{}),loading:true};
  try{
    const d=(await api('/api/v1/test-cases/coverage?application_key='+encodeURIComponent(state.appKey||'sand-bench'))).data||{};
    state.coverage={...d,loading:false,error:null};
  }catch(e){state.coverage={loading:false,error:e.message};}
  if(state.view==='catalog-coverage'){renderSideNav();renderCurrentView();}
}
// Home view — a board of per-application tiles. Lands here when the user
// clicks the GAVRIQ logo in the top-left or lands on /catalog/ without a
// hash. Each tile shows the application's case + run metrics; clicking a
// tile switches the console context to that application and opens its
// Overview.
async function loadApplicationBoard(){
  if(state.appBoard&&state.appBoard.loading)return;
  state.appBoard={...(state.appBoard||{}),loading:true};
  try{
    const apps=state.applications&&state.applications.length?state.applications:((await api('/api/v1/applications')).data||[]);
    const perApp=await Promise.all(apps.map(async(a)=>{
      const [summary,runs]=await Promise.all([
        api('/api/v1/test-cases/summary?application_key='+encodeURIComponent(a.key)).catch(()=>null),
        api('/api/v1/ui/runs?application_key='+encodeURIComponent(a.key)+'&limit=1').catch(()=>null),
      ]);
      return {app:a, summary:summary||{}, runsTotal:(runs&&runs.total)||0, lastRun:runs&&runs.data&&runs.data[0]||null};
    }));
    state.appBoard={rows:perApp,loading:false,loaded:true,error:null};
  }catch(e){state.appBoard={loading:false,loaded:true,error:e.message};}
  if(state.view==='home')renderHomeView();
}
function renderHomeView(){
  el('viewTitle').textContent='Home';
  const b=state.appBoard;
  if(!b){loadApplicationBoard();el('content').innerHTML=skeletonHtml();return;}
  if(b.loading&&!b.rows){el('content').innerHTML=skeletonHtml();return;}
  if(b.error){el('content').innerHTML=`<div class="card empty">Could not load the application board: ${esc(b.error)} <button class="btn" data-action="home-refresh">Retry</button></div>`;return;}
  const rows=b.rows||[];
  const total={apps:rows.length,cases:rows.reduce((n,r)=>n+((r.summary&&r.summary.total)||0),0),runs:rows.reduce((n,r)=>n+(r.runsTotal||0),0)};
  const kpis=`<div class="kpi-grid">${kpi('Applications',total.apps,'onboarded')}${kpi('Test cases',total.cases,'across every application')}${kpi('Test runs',total.runs,'executed so far')}</div>`;
  const tiles=rows.map(r=>{
    const s=r.summary||{};
    const t=s.total||0,p=s.passing||0,f=s.failing||0;
    const rate=t?Math.round(p/t*100):null;
    const tone=f?'red':p===t&&t>0?'green':t?'amber':'never';
    const last=r.lastRun?`Last run ${esc(when(r.lastRun.created_at))} · ${esc(r.lastRun.status||'')}`:'No runs yet';
    return `<button type="button" class="app-tile tone-${tone}" data-action="home-pick" data-app="${esc(r.app.key)}">
      <div class="app-tile-head"><div class="app-tile-title">${esc(r.app.name||r.app.key)}</div><div class="app-tile-sub">${esc(r.app.key)}</div></div>
      <div class="app-tile-kpis"><span><b>${t}</b> cases</span><span><b>${p}</b> passing</span><span><b>${f}</b> failing</span><span><b>${r.runsTotal||0}</b> runs</span></div>
      <div class="app-tile-foot">${rate!=null?`<span class="chip chip-${tone}">${rate}% passing</span>`:'<span class="muted small">no runs yet</span>'}<span class="muted small">${last}</span></div>
    </button>`;
  }).join('')||'<div class="card empty">No applications onboarded yet. Add one in Settings → Applications.</div>';
  el('content').innerHTML=`<div class="group-head first"><h2>GAVRIQ Test Engine</h2><span class="muted small">Pick an application to open its catalog. ${esc(envName())} is selected · ${plural(total.apps,'application')} onboarded.</span><span style="flex:1"></span><button class="btn" data-action="home-refresh" title="Reload the board">Refresh</button></div>
    ${kpis}
    <div class="app-tiles">${tiles}</div>
    <p class="muted small" style="margin-top:14px">Click an application tile above to switch the console's context to it — the sidebar menus will populate with that application's test cases, suites, and runs.</p>`;
}
function renderCoverageView(){
  el('viewTitle').textContent='Catalog coverage · plain-language fields';
  const c=state.coverage;
  if(!c){loadCoverage();el('content').innerHTML=skeletonHtml();return;}
  if(c.loading&&!c.findings){el('content').innerHTML=skeletonHtml();return;}
  if(c.error){el('content').innerHTML=`<div class="card empty">Could not load coverage: ${esc(c.error)}</div>`;return;}
  const sev=(f)=>f.severity==='high'?'red':f.severity==='medium'?'amber':'';
  const rows=(c.findings||[]).map(f=>{
    const miss=f.missing.length?`<span class="chip chip-fail">missing: ${esc(f.missing.join(', '))}</span>`:'';
    const thin=f.thin.length?`<span class="chip chip-warn">thin: ${esc(f.thin.join(', '))}</span>`:'';
    return `<tr><td><a href="#/case/${esc(f.case_id)}">${esc(f.case_key)}</a></td><td>${esc(f.name)}</td><td class="muted small">${esc(f.application)} · ${esc(f.test_type)}</td><td>${miss} ${thin}</td><td><span class="chip chip-${sev(f)||'idle'}">${esc(f.severity)}</span></td></tr>`;
  }).join('')||'<tr><td colspan="5" class="empty">Every active case passes the plain-language audit.</td></tr>';
  const sum=`<div class="kpi-grid">${kpi('Cases audited',c.total,'active cases')}${kpi('Clean',c.clean,'all plain-language fields present',c.clean?'green':'')}${kpi('With findings',c.with_findings,'need review',c.with_findings?'amber':'')}${kpi('High severity',c.by_severity.high,'missing two or more of objective / steps / expected',c.by_severity.high?'red':'')}</div>`;
  el('content').innerHTML=`<div class="card"><div class="card-head"><h2>Catalog coverage</h2><button class="btn" data-action="coverage-refresh">Refresh</button></div><div class="hp-body"><p class="muted small">Every active case is checked for the plain-language fields the Test cases screen expects: <b>Objective</b> (≥ ${esc(c.min_objective_chars)} characters), <b>Preconditions</b>, <b>Steps</b>, <b>Expected result</b>, and <b>Test data</b> (either <code>test_data</code> or <code>test_data_ref</code>). Script-driven cases skip the steps check — their steps live in the automation script. Click a case key to open it and fill in the gaps.</p>${sum}<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Case</th><th>Name</th><th>Application · Type</th><th>Findings</th><th>Severity</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
}
function renderConfigView(){
  el('viewTitle').textContent='Configuration · Run retention';
  const s=state.settings;
  if(!s){el('content').innerHTML=skeletonHtml();return;}
  if(s.error){el('content').innerHTML=`<div class="card empty">Could not load settings: ${esc(s.error)}</div>`;return;}
  const timeouts=s.test_type_timeout_minutes||{};
  const typeRows=Object.keys(timeouts).map(t=>{
    const hours=timeouts[t]/60;
    const label=t.replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());
    return `<tr><td>${esc(label)}</td><td><input type="number" class="timeoutHours" data-type="${esc(t)}" min="0.01" max="168" step="0.25" value="${hours%1===0?hours:hours.toFixed(2)}" style="width:90px"> hours</td></tr>`;
  }).join('');
  el('content').innerHTML=`<div class="card"><div class="card-head"><h2>Run retention</h2></div>
    <div class="hp-body">
      <p class="muted small">Test runs older than this many days are deleted automatically by a routine job, along with their evidence — including runs kept for compliance. Test cases themselves are never deleted. Minimum 5 days.</p>
      <div class="toolbar" style="border:none;padding:0">
        <input type="number" id="retentionDays" min="5" max="365" value="${esc(s.run_retention_days)}" style="width:90px">
        <button class="btn primary" data-action="save-retention">Save</button>
        ${s.updated_at?`<span class="muted small">last changed ${esc(when(s.updated_at))}</span>`:''}
      </div>
      <div id="retentionError" class="field-error" hidden></div>
    </div></div>
    <div class="card" style="margin-top:12px"><div class="card-head"><h2>Test case run timeout</h2></div>
      <div class="hp-body">
        <p class="muted small">A running test case is killed and recorded as "Timed out" once it runs longer than its test type's limit below. Every type defaults to 24 hours.</p>
        <div class="table-wrap"><table><thead><tr><th>Test type</th><th>Timeout</th></tr></thead><tbody>${typeRows}</tbody></table></div>
      </div></div>
    <div class="card" style="margin-top:12px"><div class="card-head"><h2>Failure circuit breaker</h2></div>
      <div class="hp-body">
        <p class="muted small">If this many test cases in a row fail — at the start of a run or partway through it — the rest of that run is stopped instead of continuing to burn through a broken build.</p>
        <div class="toolbar" style="border:none;padding:0">
          <input type="number" id="failureLimit" min="1" max="1000" value="${esc(s.consecutive_failure_limit)}" style="width:90px"> consecutive failures
        </div>
      </div></div>
    <div class="card" style="margin-top:12px"><div class="hp-body">
      <button class="btn primary" data-action="save-timeouts">Save timeout &amp; circuit breaker settings</button>
      <div id="timeoutsError" class="field-error" hidden></div>
    </div></div>`;
}
// ---------------------------------------------------------------------------
// Configuration · Applications and Environments maintenance pages
// ---------------------------------------------------------------------------
function appFormHtml(){
  const f=state.appForm;
  return `<div class="card" data-form="app" style="margin-bottom:12px"><div class="card-head"><h2>New application</h2></div>
    <div class="form-row"><span class="form-label">Key</span><input type="text" id="appKey" value="${esc(f.key)}" placeholder="sand-bench"></div>
    <div class="form-row"><span class="form-label">Name</span><input type="text" id="appName" value="${esc(f.name)}" placeholder="Sand Bench"></div>
    <div class="form-row"><span class="form-label">Description</span><input type="text" id="appDescription" value="${esc(f.description)}" style="width:min(520px,100%)"></div>
    <div class="form-row"><span class="form-label">Status</span><select id="appStatus"><option value="active"${f.status==='active'?' selected':''}>Active</option><option value="inactive"${f.status==='inactive'?' selected':''}>Inactive</option></select></div>
    <div class="form-row"><span></span><div><button class="btn primary" data-action="app-save">Save</button> <button class="btn" data-action="app-new">Cancel</button><div id="appError" class="field-error" hidden></div></div></div>
  </div>`;
}
function renderConfigAppsView(){
  el('viewTitle').textContent='Configuration · Applications';
  const list=state.applications||[];
  let h=`<div class="group-head first"><h2>Applications</h2><div class="hp-actions"><button class="btn primary" data-action="app-new">${state.appFormOpen?'Cancel':'+ New application'}</button></div></div>`;
  if(state.appFormOpen)h+=appFormHtml();
  const rows=list.map(a=>`<tr><td>${esc(a.key)}</td><td>${esc(a.name)}</td><td>${esc(a.status||'active')}</td><td class="muted small">${esc(a.description||'—')}</td></tr>`).join('');
  h+=`<div class="card"><div class="card-head"><h2>Registered applications</h2><span class="muted small">${plural(list.length,'application')}</span></div><div class="table-wrap"><table><thead><tr><th>Key</th><th>Name</th><th>Status</th><th>Description</th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="empty">No applications yet.</td></tr>'}</tbody></table></div></div>`;
  el('content').innerHTML=h;
}
async function saveApplication(btn){
  formError('appError','');
  const key=el('appKey').value.trim(),name=el('appName').value.trim();
  if(!key||!name)return formError('appError','Key and name are required.');
  const description=el('appDescription').value.trim(),status=el('appStatus').value;
  btn.disabled=true;
  try{
    await postJson('/api/v1/applications',{key,name,description:description||null,status});
    toast('Application "'+name+'" added');
    state.appFormOpen=false;
    await loadApplications();
    renderSideNav();renderCurrentView();
  }catch(e){formError('appError','Save failed: '+e.message);btn.disabled=false;}
}
function envFormHtml(){
  const f=state.envForm,inf=f.infra||EMPTY_INFRA_FORM;
  const safetyRow=c=>`<label class="type-check" style="flex-direction:column;align-items:flex-start;gap:2px"><span class="muted small">${esc(c.replace(/_/g,' '))}</span><select id="envSafety_${c}" style="width:160px"><option value="allowed"${f.safety[c]==='allowed'?' selected':''}>Allowed</option><option value="approval_required"${f.safety[c]==='approval_required'?' selected':''}>Approval required</option><option value="prohibited"${f.safety[c]==='prohibited'?' selected':''}>Prohibited</option></select></label>`;
  return `<div class="card" data-form="env" style="margin-bottom:12px"><div class="card-head"><h2>${f.id?'Edit environment · '+esc(f.key):'New environment'}</h2></div>
    <div class="form-row"><span class="form-label">Key</span><input type="text" id="envKey" value="${esc(f.key)}" placeholder="render-cloud"${f.id?' disabled':''}></div>
    <div class="form-row"><span class="form-label">Name</span><input type="text" id="envName" value="${esc(f.name)}" placeholder="Render Cloud"></div>
    <div class="form-row"><span class="form-label">Type</span><select id="envType">${ENV_TYPES.map(t=>`<option value="${esc(t)}"${f.env_type===t?' selected':''}>${esc(t)}</option>`).join('')}</select></div>
    <div class="form-row"><span class="form-label">Web URL</span><input type="text" id="envBaseUrl" value="${esc(f.base_url)}" placeholder="https://sandbench-web.onrender.com/" style="width:min(420px,100%)"></div>
    <div class="form-row"><span class="form-label">API URL</span><input type="text" id="envApi" value="${esc(f.api)}" placeholder="blank if the API is served from the same host as Web" style="width:min(420px,100%)"></div>
    <div class="form-row"><span class="form-label">Database (viewer) URL</span><input type="text" id="envDbviewer" value="${esc(f.dbviewer)}" placeholder="e.g. https://sandbench-dbviewer.onrender.com" style="width:min(420px,100%)"></div>
    <div class="form-row"><span class="form-label">Testhub URL</span><input type="text" id="envTesthub" value="${esc(f.testhub)}" placeholder="optional — only needed for eventing/MQ cases" style="width:min(420px,100%)"></div>
    <div class="form-row"><span class="form-label">Applications</span><input type="text" id="envApps" value="${esc(f.applications)}" placeholder="sand-bench (comma-separated — blank offers it to every application)" style="width:min(420px,100%)"></div>
    <div class="form-row"><span class="form-label">Sign-in tenant</span><input type="text" id="envTenant" value="${esc(f.tenant)}" placeholder="acme-demo"></div>
    <div class="form-row"><span class="form-label">Sign-in username</span><input type="text" id="envUsername" value="${esc(f.username)}" placeholder="operator.acme"></div>
    <div class="form-row"><span class="form-label">Password env var</span><div><input type="text" id="envPasswordEnv" value="${esc(f.password_env)}" placeholder="e.g. SB_RENDER_PASSWORD" style="width:260px"><div class="muted small">Name of an environment variable set on the engine host that holds the real password — the password itself is never stored here. Leave blank if sign-in needs none.</div></div></div>
    <div class="form-row"><span class="form-label">Safety policy</span><div style="display:flex;flex-wrap:wrap;gap:12px">${SAFETY_CATEGORIES.map(safetyRow).join('')}</div></div>
    <div class="form-row"><span class="form-label">Lifecycle</span><div><select id="envInfraDriver"><option value=""${inf.driver?'':' selected'}>Always on — never deployed or torn down from here</option><option value="compose"${inf.driver==='compose'?' selected':''}>Local Docker stack — deployed and torn down by the infra agent</option></select><div class="muted small">A managed stack runs only while it is being tested: deployed on request or when a run needs it, torn down after the run, when idle, or when up too long (Configuration › Infrastructure).</div></div></div>
    <div class="form-row"><span class="form-label">Deploy script</span><input type="text" id="envInfraScript" value="${esc(inf.script)}" placeholder="deploy/staging/deploy.mjs" style="width:min(420px,100%)"></div>
    <div class="form-row"><span class="form-label">Compose project</span><input type="text" id="envInfraProject" value="${esc(inf.compose_project)}" placeholder="sand-bench-staging"></div>
    <div class="form-row"><span class="form-label">Default ref</span><input type="text" id="envInfraRef" value="${esc(inf.default_ref)}" placeholder="main"></div>
    <div class="form-row"><span class="form-label">Teardown hours</span><div><input type="number" id="envInfraIdle" value="${esc(inf.idle_teardown_hours)}" placeholder="policy" min="0" style="width:90px"> idle · <input type="number" id="envInfraMax" value="${esc(inf.max_uptime_hours)}" placeholder="policy" min="0" style="width:90px"> up <span class="muted small">(blank = the lifecycle policy's values)</span></div></div>
    <div class="form-row"><span></span><div><button class="btn primary" data-action="env-save">Save</button> <button class="btn" data-action="env-new">Cancel</button><div id="envError" class="field-error" hidden></div></div></div>
  </div>`;
}
const EMPTY_INFRA_FORM={driver:'',script:'',compose_project:'',default_ref:'',idle_teardown_hours:'',max_uptime_hours:''};
function openEnvForm(env){
  state.envFormOpen=true;
  if(!env){
    state.envForm={id:null,key:'',name:'',env_type:'remote',base_url:'',applications:'',api:'',dbviewer:'',testhub:'',tenant:'',username:'',password_env:'',safety:{...SAFETY_DEFAULT},infra:{...EMPTY_INFRA_FORM}};
  }else{
    const v=(env.config&&env.config.vars)||{};
    const se=(env.config&&env.config.secret_env)||{};
    const apps=(env.config&&env.config.applications)||[];
    const sp=env.safety_policy||{};
    const inf=env.infra||(env.config&&env.config.infra)||{};
    state.envForm={
      id:env.id,key:env.key,name:env.name,env_type:env.env_type||'remote',base_url:env.base_url||'',
      applications:apps.join(', '),
      api:v.api||'',dbviewer:v.dbviewer||'',testhub:v.testhub||'',tenant:v.tenant||'',username:v.username||'',
      password_env:se.password||'',
      safety:Object.fromEntries(SAFETY_CATEGORIES.map(c=>[c,sp[c]||SAFETY_DEFAULT[c]])),
      infra:{driver:inf.driver==='compose'?'compose':'',script:inf.script||'',compose_project:inf.compose_project||'',default_ref:inf.default_ref||'',idle_teardown_hours:inf.idle_teardown_hours??'',max_uptime_hours:inf.max_uptime_hours??''},
    };
  }
  renderCurrentView();
}
function statusChip(label,p){
  if(p===undefined)return'';
  if(p===null)return `<span class="chip">${esc(label)} n/a</span>`;
  return `<span class="chip chip-${p.ok?'pass':'fail'}" title="${esc(p.error||('HTTP '+p.status))}">${esc(label)} ${p.ok?'up':'down'}</span>`;
}
function envStatusHtml(id){
  const st=state.envStatus.get(id);
  const btn=`<button class="btn small-btn" style="margin-top:0" data-action="env-check" data-id="${esc(id)}">${st?'Recheck':'Check status'}</button>`;
  if(!st)return btn;
  if(st.loading)return '<span class="pulse"></span> checking…';
  if(st.error)return `<span class="chip chip-fail">check failed</span> ${btn}`;
  return `${statusChip('Web',st.web)} ${statusChip('API',st.api)} ${statusChip('DB',st.db)} ${btn}`;
}
async function checkEnvStatus(btn){
  const id=btn.dataset.id;
  state.envStatus.set(id,{loading:true});
  renderCurrentView();
  try{
    const res=await api('/api/v1/environments/'+encodeURIComponent(id)+'/status');
    state.envStatus.set(id,res.data);
  }catch(e){
    state.envStatus.set(id,{error:e.message});
  }
  renderCurrentView();
}
function renderConfigEnvsView(){
  el('viewTitle').textContent='Configuration · Environments';
  const list=state.environments||[];
  let h=`<div class="group-head first"><h2>Environments</h2><div class="hp-actions"><button class="btn primary" data-action="env-new">${state.envFormOpen?'Cancel':'+ New environment'}</button></div></div>`;
  if(state.envFormOpen)h+=envFormHtml();
  const rows=list.map(e=>`<tr><td>${esc(e.key)}</td><td>${esc(e.name)}</td><td class="muted small">${esc(e.env_type||'—')}</td><td>${e.base_url?`<a href="${esc(e.base_url)}" target="_blank" rel="noopener">${esc(e.base_url)}</a>`:'—'}</td><td class="muted small">${esc(e.status||'active')}</td><td class="nowrap">${e.infra?stackChipHtml(e,'Managed Docker stack — see Configuration › Infrastructure'):'<span class="muted small">always on</span>'}</td><td class="nowrap">${envStatusHtml(e.id)}</td><td class="nowrap"><button class="btn small-btn" style="margin-top:0" data-action="env-edit" data-id="${esc(e.id)}">Edit</button></td></tr>`).join('');
  h+=`<div class="card"><div class="card-head"><h2>Registered environments</h2><span class="muted small">${plural(list.length,'environment')}</span></div><div class="table-wrap"><table><thead><tr><th>Key</th><th>Name</th><th>Type</th><th>Web URL</th><th>Status</th><th>Stack</th><th>Live check</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="8" class="empty">No environments yet.</td></tr>'}</tbody></table></div></div>`;
  el('content').innerHTML=h;
}
async function saveEnvironment(btn){
  formError('envError','');
  const f=state.envForm;
  const key=f.id?f.key:el('envKey').value.trim();
  const name=el('envName').value.trim();
  if(!key||!name)return formError('envError','Key and name are required.');
  const env_type=el('envType').value,base_url=el('envBaseUrl').value.trim();
  const apiUrl=el('envApi').value.trim(),dbviewer=el('envDbviewer').value.trim(),testhub=el('envTesthub').value.trim();
  const tenant=el('envTenant').value.trim(),username=el('envUsername').value.trim(),passwordEnv=el('envPasswordEnv').value.trim();
  const appsRaw=el('envApps').value.trim();

  const vars={};
  if(base_url)vars.web=base_url;
  if(apiUrl)vars.api=apiUrl;
  if(dbviewer)vars.dbviewer=dbviewer;
  if(testhub)vars.testhub=testhub;
  if(tenant)vars.tenant=tenant;
  if(username)vars.username=username;
  if(passwordEnv)vars.password='';
  const config={};
  if(appsRaw)config.applications=appsRaw.split(',').map(s=>s.trim()).filter(Boolean);
  if(Object.keys(vars).length)config.vars=vars;
  if(passwordEnv)config.secret_env={password:passwordEnv};
  const driver=el('envInfraDriver')?el('envInfraDriver').value:'';
  if(driver==='compose'){
    const script=el('envInfraScript').value.trim();
    if(!/^deploy\/[\w.-]+\/deploy\.mjs$/.test(script))return formError('envError','Deploy script must look like deploy/<name>/deploy.mjs (a script in this repository).');
    const hours=id=>{const v=el(id).value.trim();return v===''?null:Number(v);};
    config.infra={driver:'compose',script,compose_project:el('envInfraProject').value.trim()||null,default_ref:el('envInfraRef').value.trim()||null,idle_teardown_hours:hours('envInfraIdle'),max_uptime_hours:hours('envInfraMax')};
  }else if(f.id&&f.infra&&f.infra.driver){
    config.infra=null; // was managed, no longer: the stack is left as it is and never touched again
  }
  const safety_policy={};
  for(const c of SAFETY_CATEGORIES){const sel=el('envSafety_'+c);if(sel)safety_policy[c]=sel.value;}

  btn.disabled=true;
  try{
    if(f.id){
      await api('/api/v1/environments/'+encodeURIComponent(f.id),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name,env_type,base_url:base_url||null,config,safety_policy})});
      toast('Environment "'+name+'" updated');
    }else{
      await postJson('/api/v1/environments',{key,name,env_type,base_url:base_url||null,config,safety_policy});
      toast('Environment "'+name+'" added');
    }
    state.envFormOpen=false;
    state.envStatus=new Map();
    await loadSummary();
    renderSideNav();renderCurrentView();
  }catch(e){formError('envError','Save failed: '+e.message);btn.disabled=false;}
}
// ---------------------------------------------------------------------------
// Scope picker — "which test cases" — shared by Schedule runs and Reports.
// A scope is a saved selection, not a suite: nothing is created or left behind.
// ---------------------------------------------------------------------------
function findCaseByText(t){const v=String(t||'').trim().toLowerCase();if(!v)return null;return state.cases.find(c=>String(c.key).toLowerCase()===v)||state.cases.find(c=>String(c.name).toLowerCase()===v)||null;}
function scopeCases(f){
  if(f.kind==='types')return [...new Map(f.types.flatMap(t=>casesForType(t)).map(c=>[c.id,c])).values()];
  if(f.kind==='suite')return casesInSuite(f.suiteId);
  if(f.kind==='case'){const c=findCaseByText(f.caseText);return c?[c]:[];}
  if(f.kind==='selected'){const keys=new Set(f.caseKeys);return state.cases.filter(c=>keys.has(c.key));}
  return state.cases;
}
function scopeLabel(f){
  if(f.kind==='types')return 'Test types: '+(f.types.map(typeTitle).join(', ')||'none');
  if(f.kind==='suite'){const s=state.idx&&state.idx.suiteById.get(f.suiteId);return 'Suite: '+(s?(s.name||s.key):'—');}
  if(f.kind==='case'){const c=findCaseByText(f.caseText);return 'Test case: '+(c?c.name:'—');}
  if(f.kind==='selected')return plural(f.caseKeys.length,'selected test case');
  return 'Everything';
}
function scopePickerHtml(prefix,f){
  const kinds=[['all','Everything'],['types','Test types'],['suite','A test suite'],['case','One test case']];
  if(f.caseKeys&&f.caseKeys.length)kinds.push(['selected',plural(f.caseKeys.length,'selected case')]);
  const radios=kinds.map(([k,l])=>`<label class="type-check"><input type="radio" name="${prefix}Kind" value="${k}"${f.kind===k?' checked':''}> ${esc(l)}</label>`).join('');
  let detail='';
  if(f.kind==='types')detail=`<div class="type-check-grid">${typeList().map(t=>{const n=casesForType(t.id).length;return `<label class="type-check"><input type="checkbox" data-scopetype="${prefix}" value="${esc(t.id)}"${f.types.includes(t.id)?' checked':''}${n?'':' disabled'}> ${esc(t.title)} <span class="muted small">(${n})</span></label>`;}).join('')}</div>`;
  else if(f.kind==='suite')detail=state.suites.length?`<select id="${prefix}Suite">${state.suites.map(s=>`<option value="${esc(s.id)}"${f.suiteId===s.id?' selected':''}>${esc(s.name||s.key)} (${casesInSuite(s.id).length})</option>`).join('')}</select>`:'<span class="muted small">No suites yet — select cases in any list and use “Save selected as suite”.</span>';
  else if(f.kind==='case')detail=`<input type="search" id="${prefix}CaseSearch" list="${prefix}CaseList" placeholder="Type a test case name or key…" value="${esc(f.caseText||'')}" style="width:min(520px,100%)"><datalist id="${prefix}CaseList">${state.cases.map(c=>`<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</datalist>${f.caseText&&!findCaseByText(f.caseText)?'<div class="field-error">No test case with that name or key.</div>':''}`;
  return `<div class="form-row"><span class="form-label">Test cases</span><div><div class="radio-row">${radios}</div>${detail?`<div style="margin-top:8px">${detail}</div>`:''}</div></div>`;
}
function readScopeForm(prefix,f){
  const k=document.querySelector(`input[name="${prefix}Kind"]:checked`);
  const prev=f.kind;if(k)f.kind=k.value;
  if(prev!==f.kind){if(f.kind==='suite'&&!f.suiteId&&state.suites[0])f.suiteId=state.suites[0].id;return;}  // detail inputs on screen belong to the previous kind
  const types=[...document.querySelectorAll(`[data-scopetype="${prefix}"]`)];if(types.length)f.types=types.filter(x=>x.checked).map(x=>x.value);
  const s=el(prefix+'Suite');if(s)f.suiteId=s.value;
  const c=el(prefix+'CaseSearch');if(c)f.caseText=c.value;
}
function formError(id,msg){const x=el(id);if(x){x.hidden=!msg;x.textContent=msg||'';}return false;}

// ---------------------------------------------------------------------------
// Schedule runs
// ---------------------------------------------------------------------------
async function loadSchedules(){
  try{state.schedules=(await api('/api/v1/schedules')).data||[];}catch(e){state.schedules={error:e.message};}
  renderSideNav();
  if(state.view==='schedules')renderCurrentView();
}
function scheduleWhat(s){
  const sc=s.scope||{};
  if(sc.label)return sc.label;
  if(sc.suites&&sc.suites.length)return 'Suite: '+sc.suites.join(', ');
  if(sc.case_keys&&sc.case_keys.length)return plural(sc.case_keys.length,'test case');
  if(sc.test_types&&sc.test_types.length)return 'Types: '+sc.test_types.join(', ');
  if(sc.tags&&sc.tags.length)return 'Tags: '+sc.tags.join(', ');
  if(s.application_id)return 'Everything';
  if(s.test_case_ids&&s.test_case_ids.length)return plural(s.test_case_ids.length,'test case');
  return s.test_suite_id?'A test suite':'—';
}
function scheduleWhen(s){
  const e=String(s.cron_expression||'');
  if(/^at:/i.test(e))return 'Once · '+new Date(e.slice(3)).toLocaleString();
  if(/^every:/i.test(e))return 'Every '+e.slice(6)+' min';
  if(e)return 'Repeats · '+e+' ('+(s.time_zone||'UTC')+')';
  return s.event_trigger?'On event · '+s.event_trigger:'—';
}
function openScheduleForm(preset){
  state.schedForm={name:'',kind:'all',types:[],suiteId:'',caseText:'',caseKeys:[],envId:state.envId||'',when:'once',at:'',cron:'0 2 * * *',runType:'run_only',applicationVersion:(state.appVersion||'main'),...(preset||{})};
  state.schedFormOpen=true;
  if(state.view==='schedules')renderCurrentView();else location.hash='#/schedules';
}
function readSchedForm(){
  const f=state.schedForm;if(!el('schedName'))return;
  f.name=el('schedName').value;f.envId=el('schedEnv').value;
  const w=document.querySelector('input[name="schedWhen"]:checked');if(w)f.when=w.value;
  if(el('schedAt'))f.at=el('schedAt').value;
  if(el('schedCron'))f.cron=el('schedCron').value;
  if(el('schedRunType'))f.runType=el('schedRunType').value;
  if(el('schedVersion'))f.applicationVersion=el('schedVersion').value.trim()||'main';
  readScopeForm('sched',f);
}
// Run types shared with the Overview deploy bar — plus "run_only" which just
// queues the run without touching the stack.
const SCHED_RUN_TYPES=[
  ['run_only','Just run (do not touch the stack)'],
  ['deploy_run_teardown','Deploy, run, then tear down'],
  ['deploy_run_teardown_loop','Loop: deploy, run, tear down × N'],
  ['clean_cycle','Clean cycle: tear down + prune, then deploy–run–teardown × N'],
  ['deploy_and_run','Deploy and run (stack stays up afterwards)'],
  ['deploy_only','Deploy only (no run)'],
];
function scheduleFormHtml(){
  const f=state.schedForm;
  const n=scopeCases(f).length;
  const tz=(Array.isArray(state.schedules)&&state.schedules[0]&&state.schedules[0].time_zone)||'UTC';
  const presets=[['0 * * * *','Every hour'],['0 2 * * *','Nightly at 02:00'],['0 9 * * 1','Mondays at 09:00'],['every:30','Every 30 minutes']];
  const whenDetail=f.when==='once'
    ?`<input type="datetime-local" id="schedAt" value="${esc(f.at)}"> <span class="muted small">your local time — runs once, then the schedule is done</span>`
    :`<input type="text" id="schedCron" value="${esc(f.cron)}" style="width:180px"> ${presets.map(([c,l])=>`<button class="btn small-btn" style="margin-top:0" data-action="sched-preset" data-cron="${esc(c)}">${esc(l)}</button>`).join(' ')}<div class="muted small" style="margin-top:6px">Five cron fields (minute hour day month weekday) in ${esc(tz)}, or every:N for every N minutes.</div>`;
  const facetVersions=(state.runsList&&state.runsList.facets&&state.runsList.facets.versions)||[];
  const versionOptions=['main',...facetVersions].filter((v,i,a)=>v&&a.indexOf(v)===i).map(v=>`<option value="${esc(v)}">`).join('');
  return `<div class="card" data-form="sched"><div class="card-head"><h2>Schedule a run</h2><span class="muted small">${esc(state.appKey||'')} · ${plural(n,'test case')} in this selection</span></div>
    <div class="form-row"><span class="form-label">Name</span><input type="text" id="schedName" value="${esc(f.name)}" placeholder="e.g. Nightly smoke on staging" style="width:min(520px,100%)"></div>
    ${scopePickerHtml('sched',f)}
    <div class="form-row"><span class="form-label">Environment</span><div><select id="schedEnv">${state.environments.map(e=>`<option value="${esc(e.id)}"${e.id===f.envId?' selected':''}>${esc(e.name||e.key)}</option>`).join('')||'<option value="">No environment available</option>'}</select></div></div>
    <div class="form-row"><span class="form-label">Run type</span><div><select id="schedRunType">${SCHED_RUN_TYPES.map(([v,l])=>`<option value="${esc(v)}"${f.runType===v?' selected':''}>${esc(l)}</option>`).join('')}</select><div class="muted small" style="margin-top:4px">What the scheduler does when the time comes. "Just run" queues an execution; the others shape the deploy around it (same options as the Overview page).</div></div></div>
    <div class="form-row"><span class="form-label">App version</span><div><input type="text" id="schedVersion" list="schedVersionList" value="${esc(f.applicationVersion||'main')}" placeholder="main" style="width:220px"><datalist id="schedVersionList">${versionOptions}</datalist><div class="muted small" style="margin-top:4px">Branch, tag or version string. Stamped on every run this schedule queues (shown in the App version column).</div></div></div>
    <div class="form-row"><span class="form-label">When</span><div><div class="radio-row"><label class="type-check"><input type="radio" name="schedWhen" value="once"${f.when==='once'?' checked':''}> Once, at a date and time</label><label class="type-check"><input type="radio" name="schedWhen" value="repeat"${f.when==='repeat'?' checked':''}> Repeating</label></div><div style="margin-top:8px">${whenDetail}</div></div></div>
    <div class="form-row"><span></span><div><button class="btn primary" data-action="sched-save">Save schedule</button> <button class="btn" data-action="sched-new">Cancel</button><div id="schedError" class="field-error" hidden></div></div></div>
  </div>`;
}
async function saveSchedule(btn){
  readSchedForm();
  const f=state.schedForm,err=m=>formError('schedError',m);
  err('');
  if(!f.name.trim())return err('Give the schedule a name.');
  if(!f.envId)return err('Choose an environment.');
  const cases=scopeCases(f);
  if(!cases.length)return err('Nothing to run — this selection has no test cases.');
  let cron;
  if(f.when==='once'){
    if(!f.at)return err('Choose the date and time to run.');
    const d=new Date(f.at);
    if(Number.isNaN(d.getTime()))return err('That date and time is not valid.');
    if(d.getTime()<=Date.now())return err('Choose a time in the future.');
    cron='at:'+d.toISOString();
  }else{
    cron=f.cron.trim();
    if(!cron)return err('Enter a cron expression or pick a preset.');
  }
  let scope={};
  if(f.kind==='suite'){const s=state.idx.suiteById.get(f.suiteId);scope={suites:[s.key],label:scopeLabel(f)};}
  else if(f.kind!=='all')scope={case_keys:cases.map(c=>c.key),label:scopeLabel(f)+(f.kind==='types'?' ('+plural(cases.length,'case')+')':'')};
  // Capture the user's Run-type + App-version choices in scope. These are
  // read by the scheduler when it fires: deploy_mode shapes the deploy, and
  // application_version is stamped on each queued run (shown in the App
  // version column + filter on Test runs).
  if(f.runType)scope.run_type=f.runType;
  if(f.applicationVersion&&f.applicationVersion.trim())scope.application_version=f.applicationVersion.trim();
  btn.disabled=true;
  try{
    await postJson('/api/v1/schedules',{name:f.name.trim(),application:state.appKey,environment:f.envId,scope,cron_expression:cron});
    toast('Scheduled “'+f.name.trim()+'”');
    state.schedFormOpen=false;
    await loadSchedules();
  }catch(e){err('Could not save: '+e.message);btn.disabled=false;}
}
async function scheduleAction(kind,node){
  const id=node.dataset.id;
  try{
    if(kind==='toggle')await api('/api/v1/schedules/'+encodeURIComponent(id),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:node.dataset.enabled!=='true'})});
    else if(kind==='delete'){if(!confirm('Delete the schedule “'+node.dataset.name+'”?'))return;await api('/api/v1/schedules/'+encodeURIComponent(id),{method:'DELETE'});toast('Schedule deleted');}
    else if(kind==='run'){const res=await postJson('/api/v1/schedules/'+encodeURIComponent(id)+'/run',{});toast(res.message||'Run queued','#/history');pollLive();}
  }catch(e){toast('Failed: '+e.message);}
  await loadSchedules();
}
function renderSchedulesView(){
  el('viewTitle').textContent='Schedule runs';
  const all=state.schedules;
  if(!state.loaded||all===null){el('content').innerHTML=skeletonHtml();return;}
  let h=`<div class="group-head first"><h2>Scheduled runs <span class="muted small">for ${esc(state.appKey||'')}</span></h2><div class="hp-actions"><button class="btn primary" data-action="sched-new">${state.schedFormOpen?'Close':'+ Schedule a run'}</button></div></div>`;
  if(state.schedFormOpen)h+=scheduleFormHtml();
  if(all.error){el('content').innerHTML=h+`<div class="card empty">Could not load schedules: ${esc(all.error)}</div>`;return;}
  const list=all.filter(s=>!s.application_key||s.application_key===state.appKey);
  const envById=new Map(state.environments.map(e=>[e.id,e]));
  const rows=list.map(s=>{
    const once=/^at:/i.test(String(s.cron_expression||''));
    const done=once&&s.last_run_at;
    const st=done?'<span class="badge passed">done</span>':s.enabled?'<span class="badge running">active</span>':'<span class="badge never">paused</span>';
    const env=envById.get(s.environment_id);
    return `<tr><td>${esc(s.name)}</td><td>${esc(scheduleWhat(s))}</td><td class="muted small">${esc(env?(env.name||env.key):(s.environment_key||'—'))}</td><td class="small">${esc(scheduleWhen(s))}</td><td class="muted small">${s.next_run_at?esc(new Date(s.next_run_at).toLocaleString()):'—'}</td><td class="muted small">${s.last_run_at?esc(new Date(s.last_run_at).toLocaleString()):'Never'}</td><td>${st}</td><td class="nowrap">${done?'':`<button class="btn small-btn" style="margin-top:0" data-action="sched-toggle" data-id="${esc(s.id)}" data-enabled="${s.enabled?'true':'false'}">${s.enabled?'Pause':'Resume'}</button> `}<button class="btn small-btn" style="margin-top:0" data-action="sched-run" data-id="${esc(s.id)}">Run now</button> <button class="btn small-btn" style="margin-top:0" data-action="sched-delete" data-id="${esc(s.id)}" data-name="${esc(s.name)}">Delete</button></td></tr>`;
  }).join('');
  h+=`<div class="card"><div class="card-head"><h2>Schedules</h2><span class="muted small">${plural(list.length,'schedule')} · ${list.filter(s=>s.enabled&&!(/^at:/i.test(String(s.cron_expression||''))&&s.last_run_at)).length} active</span></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>What runs</th><th>Environment</th><th>When</th><th>Next run</th><th>Last run</th><th>State</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="8" class="empty">Nothing is scheduled. Use “Schedule a run”, or the Schedule button next to any Run button.</td></tr>'}</tbody></table></div></div>`;
  el('content').innerHTML=h;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
function readReportForm(){
  const f=state.reportForm;if(!el('repTitle'))return;
  f.title=el('repTitle').value;f.status=el('repStatus').value;
  if(el('repApp'))f.appScope=el('repApp').value;
  if(el('repEnv'))f.envId=el('repEnv').value;
  const rs=document.querySelector('input[name="repRunSel"]:checked');if(rs)f.runSel=rs.value;
  if(el('repFrom'))f.from=el('repFrom').value;
  if(el('repTo'))f.to=el('repTo').value;
  f.details=el('repDetails').checked;f.evidence=el('repEvidence').checked;
  readScopeForm('rep',f);
}
function reportBody(format){
  const f=state.reportForm;
  let scope={kind:'all'};
  if(f.kind==='suite')scope={kind:'suite',suite_id:f.suiteId};
  else if(f.kind!=='all'){
    const cs=scopeCases(f);
    const label=f.kind==='case'?'test case “'+(cs[0]?cs[0].name:'')+'”':f.kind==='types'?'test types '+f.types.map(typeTitle).join(', ')+' ('+plural(cs.length,'case')+')':plural(cs.length,'selected test case');
    scope={kind:'cases',case_ids:cs.map(c=>c.id),label};
  }
  // Across every application the case lists of this one do not apply: the report covers everything.
  const allApps=f.appScope==='all';
  if(allApps)scope={kind:'all'};
  return {application_id:allApps?'all':state.application.id,environment_id:allApps?null:(f.envId||null),scope,run_selection:f.runSel,
    from:f.runSel==='date_range'&&f.from?new Date(f.from+'T00:00:00').toISOString():null,
    to:f.runSel==='date_range'&&f.to?new Date(f.to+'T23:59:59').toISOString():null,
    status:f.status,include_case_details:f.details,include_evidence:f.evidence,title:f.title.trim(),format};
}
function reportReady(){
  readReportForm();
  formError('repError','');
  if(!state.application)return formError('repError','No application loaded.');
  if(state.reportForm.appScope!=='all'&&!scopeCases(state.reportForm).length)return formError('repError','This selection has no test cases — choose something to report on.');
  return true;
}
async function previewReport(){
  if(!reportReady())return;
  state.report={data:null,loading:true,error:null,busy:''};renderCurrentView();
  try{state.report={data:(await postJson('/api/v1/reports',reportBody('json'))).data,loading:false,error:null,busy:''};}
  catch(e){state.report={data:null,loading:false,error:e.message,busy:''};}
  if(state.view==='reports')renderCurrentView();
}
async function downloadReport(format){
  if(!reportReady())return;
  state.report.busy=format;renderCurrentView();
  try{
    const res=await fetch('/api/v1/reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(reportBody(format))});
    if(!res.ok){const b=await res.json().catch(()=>({}));throw new Error(b.error||('HTTP '+res.status));}
    const blob=await res.blob();
    const m=/filename="([^"]+)"/.exec(res.headers.get('content-disposition')||'');
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=m?m[1]:'report.'+format;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
    toast('Report downloaded: '+a.download);
  }catch(e){toast('Report failed: '+e.message);}
  state.report.busy='';
  if(state.view==='reports')renderCurrentView();
}
function reportPreviewHtml(){
  const r=state.report;
  if(r.loading)return '<div class="kpi-grid">'+'<div class="skel" style="height:84px"></div>'.repeat(5)+'</div><div class="skel" style="height:220px"></div>';
  if(r.error)return `<div class="card empty">Could not build the report: ${esc(r.error)}</div>`;
  if(!r.data)return '<div class="card empty">Choose what the report should cover, then Preview — or download it straight away as PDF or CSV.</div>';
  const m=r.data.meta,d=r.data.dashboard,cases=r.data.cases,multi=!!m.all_applications;
  const shown=cases.slice(0,200);
  // A case of another application cannot be opened from here (the console is showing one application at a time).
  const nameCell=c=>multi&&c.application_key!==state.appKey?esc(c.name):`<button class="case-name" data-case="${esc(c.id)}">${esc(c.name)}</button>`;
  const rows=shown.map((c,i)=>{const last=c.runs[0];return `<tr><td class="num">${i+1}</td>${multi?`<td class="muted small">${esc(c.application_name)}</td>`:''}<td>${nameCell(c)}<div class="key small">${esc(c.key)}</div></td><td>${esc(c.test_type)}</td><td>${esc(c.execution_method||'—')}</td><td class="num">${c.runs.length}</td><td>${last?badge(last.status):badge(null)}</td><td class="muted small">${last?esc(last.environment_name||'—'):'—'}</td><td class="muted small">${last?esc(when(last.finished_at)):'—'}</td></tr>`;}).join('');
  const seg=(v,c)=>v?`<span class="seg ${c}" style="flex-grow:${v}"></span>`:'';
  const bd=(title,list)=>`<div class="card"><div class="card-head"><h2>${esc(title)}</h2><span class="muted small">${plural(list.length,'group')}</span></div><div class="table-wrap"><table><thead><tr><th>${esc(title.replace(/^By /,'').replace(/^./,x=>x.toUpperCase()))}</th><th class="num">Runs</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Pass rate</th><th style="width:30%">Result mix</th></tr></thead><tbody>${list.slice(0,15).map(g=>`<tr><td>${esc(g.name)}</td><td class="num">${g.runs}</td><td class="num">${g.passed}</td><td class="num">${g.failed}</td><td class="num">${g.pass_rate==null?'—':g.pass_rate+'%'}</td><td><span class="meter" style="margin-top:6px">${seg(g.passed,'pass')}${seg(g.failed,'fail')}${seg(g.other,'other')}</span></td></tr>`).join('')}${list.length>15?`<tr><td colspan="6" class="muted small">…and ${list.length-15} more in the download</td></tr>`:''}</tbody></table></div></div>`;
  const breakdowns=d.runs?((multi||(d.by_application||[]).length>1?bd('By application',d.by_application):'')+bd('By environment',d.by_environment||[])+((d.by_type||[]).length>1?bd('By test type',d.by_type):'')):'';
  return `<div class="group-head"><h2>${esc(m.title)}</h2><span class="muted small">${esc(m.ref)} · generated ${esc(when(m.generated_at))}</span></div>
    <div class="kpi-grid">${kpi('Test cases',d.cases,`${d.cases_with_runs} with runs · ${d.cases_never_run} never run`)}${kpi('Runs',d.runs,m.filters.run_selection==='last_run'?'latest per case':'in range')}${kpi('Passed',d.passed,'',d.passed?'green':'')}${kpi('Failed',d.failed,d.other?d.other+' other':'',d.failed?'red':'')}${kpi('Pass rate',d.pass_rate==null?'—':d.pass_rate+'%','of passed + failed')}${kpi('Evidence',d.evidence_items,m.filters.include_evidence?'items in report':'not included')}</div>
    <div class="card report-scope"><div class="hp-body"><b>This report covers</b><ul>${m.filters_lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></div></div>
    ${breakdowns}
    <div class="card"><div class="card-head"><h2>Test cases in this report</h2><span class="muted small">${shown.length<cases.length?`first ${shown.length} of ${cases.length} shown — the download has all of them`:plural(cases.length,'case')}</span></div><div class="table-wrap"><table><thead><tr><th>#</th>${multi?'<th>Application</th>':''}<th>Test case</th><th>Type</th><th>Method</th><th class="num">Runs</th><th>Latest result</th><th>Environment</th><th>Finished</th></tr></thead><tbody>${rows||`<tr><td colspan="${multi?9:8}" class="empty">Nothing matches these filters.</td></tr>`}</tbody></table></div></div>`;
}
function renderReportsView(){
  el('viewTitle').textContent='Reports';
  if(!state.loaded){el('content').innerHTML=skeletonHtml();return;}
  const f=state.reportForm,busy=state.report.busy;
  const appName=(state.application&&state.application.name)||state.appKey||'';
  const range=f.runSel==='date_range'?`<div style="margin-top:8px"><input type="date" id="repFrom" value="${esc(f.from)}" aria-label="From date"> <span class="muted small">to</span> <input type="date" id="repTo" value="${esc(f.to)}" aria-label="To date"> <span class="muted small">leave empty for no limit</span></div>`:'';
  const allApps=f.appScope==='all';
  const envRow=allApps
    ?'<div class="form-row"><span class="form-label">Environment</span><div class="muted" style="padding-top:6px">All environments of every application</div></div>'
    :`<div class="form-row"><span class="form-label">Environment</span><div><select id="repEnv"><option value="">All environments</option>${state.environments.map(e=>`<option value="${esc(e.id)}"${e.id===f.envId?' selected':''}>${esc(e.name||e.key)}</option>`).join('')}</select></div></div>`;
  const scopeRow=allApps
    ?'<div class="form-row"><span class="form-label">Test cases</span><div class="muted" style="padding-top:6px">Every test case of every application. To pick types, a suite or one case, choose a single application.</div></div>'
    :scopePickerHtml('rep',f);
  el('content').innerHTML=`<div class="card" data-form="rep"><div class="card-head"><h2>Build a report</h2><span class="muted small">${allApps?plural(state.applications.length,'application'):plural(scopeCases(f).length,'test case')+' in this selection'}</span></div>
    <div class="form-row"><span class="form-label">Title</span><input type="text" id="repTitle" value="${esc(f.title)}" placeholder="${esc(allApps?'All applications':appName)} — Test Report" style="width:min(520px,100%)"></div>
    <div class="form-row"><span class="form-label">Application</span><div><select id="repApp"><option value="current"${allApps?'':' selected'}>${esc(appName)}</option><option value="all"${allApps?' selected':''}>All applications</option></select> <span class="muted small">— for a different single application, switch the App selector at the top</span></div></div>
    ${envRow}
    ${scopeRow}
    <div class="form-row"><span class="form-label">Runs</span><div><div class="radio-row"><label class="type-check"><input type="radio" name="repRunSel" value="last_run"${f.runSel==='last_run'?' checked':''}> Latest run of each test case</label><label class="type-check"><input type="radio" name="repRunSel" value="date_range"${f.runSel==='date_range'?' checked':''}> All runs, optionally between dates</label></div>${range}</div></div>
    <div class="form-row"><span class="form-label">Result</span><div><select id="repStatus"><option value="all"${f.status==='all'?' selected':''}>Passed and failed</option><option value="passed"${f.status==='passed'?' selected':''}>Passed only</option><option value="failed"${f.status==='failed'?' selected':''}>Failed only</option></select></div></div>
    <div class="form-row"><span class="form-label">Include</span><div class="radio-row"><label class="type-check"><input type="checkbox" id="repDetails"${f.details?' checked':''}> Test case details (description, steps, expected results)</label><label class="type-check"><input type="checkbox" id="repEvidence"${f.evidence?' checked':''}> Evidence (screenshots are embedded in the PDF only)</label></div></div>
    <div class="form-row"><span></span><div><button class="btn primary" data-action="report-preview"${busy?' disabled':''}>Preview</button> <button class="btn" data-action="report-download" data-format="pdf"${busy?' disabled':''}>${busy==='pdf'?'Preparing PDF…':'Download PDF'}</button> <button class="btn" data-action="report-download" data-format="csv"${busy?' disabled':''}>${busy==='csv'?'Preparing CSV…':'Download CSV'}</button><div id="repError" class="field-error" hidden></div></div></div>
  </div>${reportPreviewHtml()}`;
}
function renderCurrentView(){
  state.tiles=new Map();state.charts=new Map();state.panels=new Set();state.section=null;
  state.live=liveCaseState();
  const v=state.view;
  if(v==='home')renderHomeView();
  else if(v==='history')renderHistory();
  else if(v==='run')renderRun();
  else if(v==='builds')renderBuilds();
  else if(v==='case')renderCaseView();
  else if(v==='method')renderMethodView(state.methodName);
  else if(v==='tag')renderTagView(state.tagName);
  else if(v==='config-retention')renderConfigView();
  else if(v==='config-apps')renderConfigAppsView();
  else if(v==='config-envs')renderConfigEnvsView();
  else if(v==='config-infra')renderInfraView();
  else if(v==='catalog-coverage')renderCoverageView();
  else if(v==='test-cases'||v==='test-case-form'||v==='test-suites'||v==='test-suite-form')TB.render(v);   // testbench.js
  else if(v==='schedules')renderSchedulesView();
  else if(v==='reports')renderReportsView();
  else if(v==='insights')renderInsightsView();   // insights.js
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
  const dl=state.deployLoop;
  if(dl){
    const envName=dl.environment_name||dl.environment_key;
    if(dl.parked){
      const err=dl.last_error?' Last error: '+String(dl.last_error).slice(0,180):'';
      return banner('Deploy to '+envName+' failed '+dl.retry_count+' times (cap '+dl.retry_cap+'). The loop is paused for offline investigation. Open '+dl.report_key+' for the full timeline.'+err);
    }
    const left=dl.attempts_remaining;const n=dl.retry_count;
    return banner('Deploy to '+envName+' is failing: '+n+' failed attempt'+(n===1?'':'s')+' handed to the implementation manager (report '+dl.report_key+'). '+left+' retry'+(left===1?'':'ies')+' left before the loop is parked.');
  }
  banner(null);
}
// Cycle run status banner (its own strip, so the stage bar stays visible).
function cycleRunHtml(){
  const c=state.cycleRun;if(!c)return'';
  const total=c.iterations_total,done=c.iterations_done;
  const envLabel=c.environment_name||c.environment_key||envName();
  if(c.status==='running'){
    const i=Math.min(total,done+1);
    const prep=c.preparation_phase;
    const phase=prep==='tearing_down'?`Preparation 1/2: tearing the stack down`
      :prep==='pruning'?`Preparation 2/2: pruning Docker (stopped containers, dangling images, build cache)`
      :prep==='ready'?`Preparation complete — queuing iteration 1`
      :`Iteration ${i} of ${total} in flight · ${done} completed`;
    const cleanTag=c.clean_start?' <span class="chip">Clean cycle</span>':'';
    return `<div class="banner" style="margin:0 0 12px;background:var(--amber-50,#fff7ed);border-color:var(--amber,#e0a826)">Cycle ${esc(c.key)} on ${esc(envLabel)}${cleanTag}: ${esc(phase)}. <button class="btn" data-action="cancel-cycle" data-id="${esc(c.id)}">Cancel cycle</button></div>`;
  }
  if(c.status==='completed')return `<div class="banner" style="margin:0 0 12px;background:var(--green-50,#ecfdf5);border-color:var(--green,#17a673)">Cycle ${esc(c.key)} completed: ${total} iteration${total===1?'':'s'} finished on ${esc(envLabel)}.</div>`;
  if(c.status==='failed'){const err=c.last_error?' — '+esc(String(c.last_error).slice(0,180)):'';
    return `<div class="banner" style="margin:0 0 12px;background:var(--red-50,#fef2f2);border-color:var(--red,#d64545)">Cycle ${esc(c.key)} failed at iteration ${done+1} of ${total}${err}</div>`;}
  if(c.status==='cancelled')return `<div class="banner" style="margin:0 0 12px">Cycle ${esc(c.key)} cancelled after ${done} of ${total} iterations.</div>`;
  return '';
}
function renderEnvSelect(){
  if(!state.envId||!state.environments.some(e=>e.id===state.envId)){
    // The list is already scoped to the application. Default to the most
    // stable target it has: staging is a pinned build, the local stacks are
    // rebuilt from a working tree.
    const prefer=['staging','pre_prod','uat','sit','qa','docker','localhost'];
    const hit=prefer.map(t=>state.environments.find(e=>e.env_type===t)).find(Boolean);
    state.envId=(hit&&hit.id)||(state.environments[0]&&state.environments[0].id)||null;
  }
  el('envSelect').innerHTML=state.environments.map(e=>'<option value="'+esc(e.id)+'"'+(e.id===state.envId?' selected':'')+'>'+esc(e.name||e.key)+'</option>').join('')||'<option value="">None</option>';
  const env=currentEnv(),dep=env&&env.deployment;
  el('envSelect').title=env?[env.base_url,dep&&dep.commit?'deployed '+String(dep.commit).slice(0,12)+(dep.ref?' ('+dep.ref+')':''):''].filter(Boolean).join(' · '):'';
}
async function switchEnvironment(id){
  if(id===state.envId)return;
  state.envId=id||null;
  try{localStorage.setItem(envStoreKey(),state.envId||'');}catch{}
  // Every status on screen belongs to the previous environment — including the
  // Test Runs page's own filter, which otherwise silently keeps showing the old
  // environment (or "all") while every other view has already moved on.
  Object.assign(state,{since:null,selected:new Set(),runsFilter:{environment_id:state.envId||'',status:'',trigger_source:'',application_version:'',from:'',to:''},runsList:{rows:[],total:0,offset:0,loading:false,loaded:false},runsSel:new Set()});
  state.history.clear();
  state.deploy=null;state.deployStage=null;state.deployRun=null;state.deployLoop=null;state.cycleRun=null;
  await refreshAll();
  loadActiveDeployment();
}
function renderAppSelect(){
  const sel=el('appSelect');if(!sel)return;
  sel.innerHTML=state.applications.map(a=>'<option value="'+esc(a.key)+'"'+(a.key===state.appKey?' selected':'')+'>'+esc(a.name||a.key)+'</option>').join('')||'<option value="sand-bench">Sand Bench</option>';
}
async function switchApplication(key){
  if(!key||key===state.appKey)return;
  state.appKey=key;
  try{localStorage.setItem('te.app',key);}catch{}
  // Full reset of app-scoped view state, including the environment: each application has its own targets.
  Object.assign(state,{loaded:false,cases:[],suites:[],environments:[],envId:null,build:null,stats:{},idx:null,tile:null,suiteId:null,selected:new Set(),selectedTypes:new Set(),rowLimit:ROWS,buildRows:null,since:null,catalogSig:null,runsFilter:{environment_id:'',status:'',trigger_source:'',application_version:'',from:'',to:''},runsList:{rows:[],total:0,offset:0,loading:false,loaded:false},runsSel:new Set(),
    schedFormOpen:false,report:{data:null,loading:false,error:null,busy:''},
    reportForm:{title:'',appScope:'current',envId:'',kind:'all',types:[],suiteId:'',caseText:'',caseKeys:[],runSel:'last_run',from:'',to:'',status:'all',details:true,evidence:false},
    cycleRun:null,deployLoop:null});
  state.history.clear();
  location.hash='#/overview';
  renderSideNav();renderCurrentView();
  try{await loadSummary();}catch(e){banner('Failed to load '+key+': '+e.message);}
  renderSideNav();renderCurrentView();pollLive();
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function queueExecution(body,label){
  const environmentId=body.environment_id||state.envId;
  if(!environmentId){toast('No environment available.');return;}
  // Stamp the version/branch picked in the top bar into the run's metadata.
  // The App-version column on Test runs reads this; the facets dropdown
  // auto-fills with any value that has been used before.
  const version=currentAppVersion();
  const meta={...(state.headed?{headless:false}:{}),...(version?{application_version:version}:{})};
  const payload={...body,environment_id:environmentId,trigger_source:'manual'};
  if(Object.keys(meta).length)payload.metadata=meta;
  if(version)payload.application_version=version;
  try{
    const res=await postJson('/api/v1/executions',payload);
    toast('Queued '+label+' — '+(res.data.name||res.data.key),'#/run/'+res.data.id);
    pollLive();
  }catch(e){toast('Run failed: '+e.message);}
}
function currentAppVersion(){
  const el=document.getElementById('appVersionInput');
  const v=(el?el.value:state.appVersion||'').trim();
  return v||null;
}
function runCases(ids,label,environmentId){if(ids.length&&!stackDownGuard(environmentId))queueExecution({test_case_ids:ids,...(environmentId?{environment_id:environmentId}:{})},label);}
function runSuite(suiteId,ids,label){if(!stackDownGuard())queueExecution({test_suite_id:suiteId,test_case_ids:ids},label||'suite');}
async function cancelRun(id){
  try{await api('/api/v1/executions/'+encodeURIComponent(id)+'/cancel',{method:'POST'});toast('Cancelled run');}
  catch(e){toast('Cancel failed: '+e.message);}
  if(state.view==='run')await loadRun(state.runId);
  pollLive();
}
async function cancelAllRuns(btn){
  const n=activeRuns().length;
  if(!n)return;
  if(!confirm('Cancel all '+plural(n,'run')+' in progress for '+(state.appKey||'this application')+' on '+envName()+'?'))return;
  if(btn)btn.disabled=true;
  try{
    const res=await postJson('/api/v1/executions/cancel-all',{application_key:state.appKey,environment_id:state.envId});
    toast('Cancelled '+plural(res.data.cancelled,'run'));
    pollLive();
  }catch(e){toast('Cancel all failed: '+e.message);}
  finally{if(btn)btn.disabled=false;}
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
  else if(action==='copy-evidence')copyEvidence(node.dataset.url,node);
  else if(action==='run-all')runEverything(node);
  else if(action==='nav-back')history.back();
  else if(action==='run-case'){const envSel=el('runCaseEnv');runCases([node.dataset.id],node.dataset.label,envSel&&envSel.value||null);}
  else if(action==='save-retention')saveRetention(node);
  else if(action==='save-timeouts')saveTimeouts(node);
  else if(action==='save-suite')saveAsSuite();
  else if(action==='apply-run-filters')applyRunFilters();
  else if(action==='clear-run-filters'){state.runsFilter={environment_id:'',status:'',trigger_source:'',application_version:'',from:'',to:''};loadRunsList(true);}
  else if(action==='runs-more')loadRunsList(false);
  else if(action==='runs-clear-sel'){state.runsSel=new Set();renderCurrentView();}
  else if(action==='runs-delete-selected')deleteSelectedRuns();
  else if(action==='runs-tab'){state.runsTab=node.dataset.tab;renderCurrentView();}
  else if(action==='home-refresh'){state.appBoard=null;loadApplicationBoard();renderCurrentView();}
  else if(action==='home-pick'){const key=node.dataset.app;if(key)switchApplication(key);location.hash='#/overview';}
  else if(action==='run-types')runSelectedTypes();
  else if(action==='overview-tab'){state.overviewTab=node.dataset.tab;renderCurrentView();}
  else if(action==='sched-new'){if(state.schedFormOpen){state.schedFormOpen=false;renderCurrentView();}else openScheduleForm();}
  else if(action==='sched-save')saveSchedule(node);
  else if(action==='sched-preset'){const c=el('schedCron');if(c){c.value=node.dataset.cron;state.schedForm.cron=node.dataset.cron;}}
  else if(action==='sched-toggle')scheduleAction('toggle',node);
  else if(action==='sched-run')scheduleAction('run',node);
  else if(action==='sched-delete')scheduleAction('delete',node);
  else if(action==='schedule')scheduleFrom(node);
  else if(action==='report-preview')previewReport();
  else if(action==='report-download')downloadReport(node.dataset.format);
  else if(action==='report-case'){state.reportForm={...state.reportForm,title:'',appScope:'current',kind:'case',caseText:node.dataset.key,caseKeys:[],runSel:'date_range',from:'',to:'',status:'all',details:true,evidence:true};state.report={data:null,loading:false,error:null,busy:''};location.hash='#/reports';}
  else if(action==='cancel-all-runs')cancelAllRuns(node);
  else if(action==='cancel-cycle')cancelCycleRun(node.dataset.id,node);
  else if(action==='coverage-refresh'){state.coverage=null;loadCoverage();renderCurrentView();}
  else if(action==='deploy-main')deployMain(node);
  else if(action==='deploy-stage'){state.deployStage=state.deployStage===node.dataset.stage?null:node.dataset.stage;renderCurrentView();}
  else if(action==='app-new'){state.appFormOpen=!state.appFormOpen;if(state.appFormOpen)state.appForm={key:'',name:'',description:'',status:'active'};renderCurrentView();}
  else if(action==='app-save')saveApplication(node);
  else if(action==='env-new'){if(state.envFormOpen){state.envFormOpen=false;renderCurrentView();}else openEnvForm(null);}
  else if(action==='env-edit'){const e=state.environments.find(x=>x.id===node.dataset.id);if(e)openEnvForm(e);}
  else if(action==='env-save')saveEnvironment(node);
  else if(action==='env-check')checkEnvStatus(node);
  else if(action==='infra-refresh')loadInfra();
  else if(action==='infra-deploy')infraDeploy(node);
  else if(action==='infra-teardown')infraTeardown(node);
  else if(action==='infra-prune')infraPrune(false);
  else if(action==='infra-prune-preview')infraPrune(true);
  else if(action==='infra-cancel-job')infraCancelJob(node.dataset.id);
  else if(action==='infra-save-policy')saveInfraPolicy(node);
  else if(action==='infra-job-log'){state.infraOpenJob=state.infraOpenJob===node.dataset.id?null:node.dataset.id;renderCurrentView();}
}
// "Schedule" next to a Run button: same selection, run later instead of now.
function scheduleFrom(node){
  const what=node.dataset.what;
  if(what==='types')return openScheduleForm({kind:'types',types:[...state.selectedTypes]});
  if(what==='case')return openScheduleForm({kind:'case',caseText:node.dataset.key,envId:(el('runCaseEnv')&&el('runCaseEnv').value)||state.envId||''});
  if(what==='section'){
    const byId=state.idx.caseById,keysOf=ids=>ids.map(id=>byId.get(id)).filter(Boolean).map(c=>c.key);
    if(state.selected.size)return openScheduleForm({kind:'selected',caseKeys:keysOf([...state.selected])});
    const s=state.section;
    if(s&&s.suiteId)return openScheduleForm({kind:'suite',suiteId:s.suiteId});
    if(s)return openScheduleForm({kind:'selected',caseKeys:keysOf(s.ids)});
  }
  openScheduleForm();
}
function applyRunFilters(){
  state.runsFilter={
    environment_id:el('runsEnvFilter').value,
    status:el('runsStatusFilter').value,
    trigger_source:el('runsTriggerFilter')?el('runsTriggerFilter').value:'',
    application_version:el('runsVersionFilter')?el('runsVersionFilter').value:'',
    from:el('runsFromFilter').value,
    to:el('runsToFilter').value,
  };
  loadRunsList(true);
}
async function deleteSelectedRuns(){
  const ids=[...(state.runsSel||[])];
  if(!ids.length)return;
  const label=plural(ids.length,'run');
  if(!confirm(`Delete ${label}? This also deletes their per-case results and remarks. This cannot be undone.`))return;
  try{
    const res=await postJson('/api/v1/executions/delete-batch',{ids});
    const n=res&&res.data&&res.data.deleted!=null?res.data.deleted:ids.length;
    toast(`Deleted ${plural(n,'run')}`);
    state.runsSel=new Set();
    await loadRunsList(true);
  }catch(e){
    toast('Delete failed: '+e.message);
  }
}
async function runSelectedTypes(){
  const ids=[...new Set([...state.selectedTypes].flatMap(id=>casesForType(id).map(c=>c.id)))];
  if(!ids.length)return;
  const label=state.selectedTypes.size===1?typeTitle([...state.selectedTypes][0]):plural(state.selectedTypes.size,'test type');
  await queueExecution({test_case_ids:ids},label);
  state.selectedTypes=new Set();
  renderCurrentView();
}
async function saveAsSuite(){
  const ids=[...state.selected];
  if(!ids.length)return;
  const name=(prompt('Name for the new suite:')||'').trim();
  if(!name)return;
  const appId=state.application&&state.application.id;
  if(!appId){toast('No application loaded.');return;}
  const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'suite';
  const key='sb-custom-'+slug+'-'+Date.now().toString(36);
  try{
    const suite=await postJson('/api/v1/suites',{key,name,application_id:appId});
    await postJson('/api/v1/suites/'+encodeURIComponent(suite.data.id)+'/cases',{test_case_ids:ids});
    toast('Saved suite “'+name+'” with '+plural(ids.length,'case'));
    state.selected=new Set();
    await loadSummary();
    renderSideNav();renderCurrentView();
  }catch(e){toast('Save suite failed: '+e.message);}
}
function showRetentionError(msg){
  const err=el('retentionError');
  if(!err)return;
  if(!msg){err.hidden=true;err.textContent='';return;}
  err.hidden=false;err.textContent=msg;
}
async function saveRetention(btn){
  showRetentionError(null);
  const raw=el('retentionDays').value;
  const days=Number(raw);
  if(raw===''||!Number.isInteger(days)||days<5||days>365){
    showRetentionError('Enter a whole number of days, minimum 5 (maximum 365).');
    return;
  }
  btn.disabled=true;
  try{
    state.settings=(await api('/api/v1/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({run_retention_days:days})})).data;
    toast('Retention updated to '+days+' days');
    renderCurrentView();
  }catch(e){showRetentionError('Save failed: '+e.message);btn.disabled=false;}
}
function showTimeoutsError(msg){
  const err=el('timeoutsError');
  if(!err)return;
  if(!msg){err.hidden=true;err.textContent='';return;}
  err.hidden=false;err.textContent=msg;
}
async function saveTimeouts(btn){
  showTimeoutsError(null);
  const test_type_timeout_minutes={};
  for(const inp of document.querySelectorAll('.timeoutHours')){
    const hours=Number(inp.value);
    if(!(hours>0)||!Number.isFinite(hours)){showTimeoutsError('Enter a timeout greater than 0 for every test type.');return;}
    test_type_timeout_minutes[inp.dataset.type]=Math.round(hours*60);
  }
  const limit=Number(el('failureLimit').value);
  if(!Number.isInteger(limit)||limit<1||limit>1000){
    showTimeoutsError('Enter a whole number of consecutive failures, 1-1000.');
    return;
  }
  btn.disabled=true;
  try{
    state.settings=(await api('/api/v1/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({test_type_timeout_minutes,consecutive_failure_limit:limit})})).data;
    toast('Timeout and circuit breaker settings saved');
    renderCurrentView();
  }catch(e){showTimeoutsError('Save failed: '+e.message);btn.disabled=false;}
}
async function runEverything(btn){
  if(!state.envId){toast('No environment available.');return;}
  if(btn)btn.disabled=true;
  try{
    const v=currentAppVersion();
    const res=await postJson('/api/v1/executions/run-all',{application_key:state.appKey,environment_id:state.envId,...(v?{application_version:v}:{})});
    const d=res.data||{};
    if(d.deployment){
      // The stack was down: the engine deploys it first, the run follows, and it comes down again afterwards.
      state.deploy=d.deployment;
      toast(res.message||(envName()+' was down — deploying first; the run starts when the deploy succeeds'),'#/config-infra');
      if(res.warning)toast(res.warning,'#/config-infra');
      loadSummary().then(renderCurrentView);
      pollDeployment();
      return;
    }
    toast(res.message||('Queued '+(d.executions||[]).length+' suite runs ('+(d.total_cases||0)+' cases)'),'#/history');
    pollLive();
  }catch(e){toast('Run everything failed: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}

// Deploy to the selected environment, then optionally run once it succeeds and tear the stack down after that run.
let deployPollTimer=null;
// The staged progress of a deploy→run→teardown request, shown on the overview. Each stage is a
// colour-coded segment; clicking one opens its live log (deploy/teardown) or per-case run progress.
// What the engine's cancel rules currently say about this run_group: a short
// chip row the user can glance at to know whether the rolling fail-rate guard
// is quiet, close to tripping, or has fired. Driven by state.settings and the
// run_group's live totals in state.deployRun.
function rollingFailRuleHtml(sum){
  const s=state.settings||{};
  const enabled=s.rolling_fail_cancel_enabled!==false;
  const window=Number(s.rolling_fail_cancel_window)||20;
  const threshold=Number(s.rolling_fail_cancel_threshold_pct)||50;
  const consec=Number(s.consecutive_failure_limit)||20;
  const t=(sum&&sum.totals)||{};
  const reported=Number(t.reported)||0;
  const failed=Number(t.failed)||0;
  const inconc=Number(t.inconclusive)||0;
  const failRate=reported?Math.round(((failed+inconc)/reported)*100):0;
  const belowWindow=reported<window;
  const tripped=enabled&&!belowWindow&&failRate>threshold;
  // Chip tones follow the standard pass/warn/fail palette.
  const rollingTone=!enabled?'muted':tripped?'fail':failRate>=Math.max(10,threshold-10)?'warn':'pass';
  const rollingLabel=!enabled?'disabled':tripped?`tripped — ${failed+inconc}/${reported} failing (${failRate}% > ${threshold}%)`
    :belowWindow?`armed · ${reported}/${window} reported so far (${failRate}% failing)`
    :`still good · ${failRate}% failing of last ${reported} (threshold ${threshold}%)`;
  return `<div class="pbar-rules" title="Rules that cancel the run before every suite has finished">
    <div class="rule-title">Cancel rules</div>
    <div class="rule-chips">
      <span class="rule-chip rule-${rollingTone}"><b>Rolling fail rate</b><span>${esc(rollingLabel)}</span></span>
      <span class="rule-chip rule-muted"><b>Consecutive failures</b><span>cancel at ${consec} in a row</span></span>
    </div>
  </div>`;
}
function deployStages(d){
  const stages=[];
  const dep = d.status==='failed' ? {tone:'fail',state:'failed',label:'Deploy failed'}
    : d.status==='succeeded' ? {tone:'pass',state:'done',label:'Deployed'+(d.commit?' '+String(d.commit).slice(0,8):'')}
    : d.status==='deploying' ? {tone:'warn',state:'active',label:'Deploying '+(d.ref||'main')+'…'}
    : {tone:'',state:'pending',label:d.agent_online===false?'Waiting for an infra agent':'Queued for the infra agent…'};
  stages.push({key:'deploy',name:'Deploy',...dep});

  if(d.mode==='deploy_and_run'){
    const live=activeRuns().find(e=>e.id===d.run_id);
    const sum=state.deployRun&&state.deployRun.run_id===d.run_id?state.deployRun:null;
    let run;
    if(d.status==='failed') run={tone:'',state:'pending',label:'Not started — deploy failed'};
    else if(d.status!=='succeeded') run={tone:'',state:'pending',label:'Waiting for deploy'};
    else if(!d.run_id) run={tone:'fail',state:'failed',label:'No run was queued'};
    else if(live){
      const total=Math.max(live.total||0,live.done||0);
      const pct=total?Math.round((live.done||0)/total*100):0;
      const cur=live.current_case_id&&state.idx&&state.idx.caseById.get(live.current_case_id);
      const suite=live.test_suite_id&&state.idx&&state.idx.suiteById.get(live.test_suite_id);
      const elapsed=live.started_at?dur(serverNow()-ms(live.started_at)):null;
      // "Running — <suite> · case X/Y · <elapsed> · <current case>"
      const parts=[];
      if(suite)parts.push(esc(suite.name||suite.key));
      parts.push(`case ${live.done||0}/${total}`);
      if(elapsed)parts.push(elapsed);
      if(cur)parts.push(esc(cur.name));
      run={tone:'warn',state:'active',pct,label:'Running — '+parts.join(' · ')};
    }
    else if(sum){const t=sum.totals||{};const failed=(t.failed||0)+(t.inconclusive||0);run=failed?{tone:'fail',state:'done',label:`Ran ${t.reported||0}/${t.cases||0} · ${failed} failed`}:{tone:'pass',state:'done',label:`Ran ${t.reported||0}/${t.cases||0} · all passed`};}
    else run={tone:'warn',state:'active',label:'Run queued…'};
    stages.push({key:'run',name:'Run',...run});
  }

  if(d.teardown_after_run){
    const td=d.teardown;
    let tear;
    if(d.status!=='succeeded') tear={tone:'',state:'pending',label:'Waiting'};
    else if(!td) tear={tone:'',state:'pending',label:'Tears down after the run'};
    else if(td.status==='queued'||td.status==='running') tear={tone:'warn',state:'active',label:'Tearing down…'};
    else if(td.status==='succeeded') tear={tone:'pass',state:'done',label:'Torn down'};
    else tear={tone:'fail',state:'failed',label:'Teardown '+td.status};
    stages.push({key:'teardown',name:'Tear down',...tear});
  }
  return stages;
}
function deployStageDetail(d,key,stages){
  const s=stages.find(x=>x.key===key);if(!s)return'';
  let body='';
  if(key==='deploy'){
    const log=d.job&&d.job.log_tail?esc(String(d.job.log_tail).trim()):'';
    body=(d.error?`<div class="small" style="color:var(--red)">${esc(d.error)}</div>`:'')+(log?`<pre class="pbar-log">${log}</pre>`:'<span class="muted small">No deploy log yet.</span>');
  }else if(key==='run'){
    const live=activeRuns().find(e=>e.id===d.run_id);
    const sum=state.deployRun&&state.deployRun.run_id===d.run_id?state.deployRun:null;
    const rulesHtml=rollingFailRuleHtml(sum);
    if(live){
      const total=Math.max(live.total||0,live.done||0);
      const cur=live.current_case_id&&state.idx&&state.idx.caseById.get(live.current_case_id);
      const suite=live.test_suite_id&&state.idx&&state.idx.suiteById.get(live.test_suite_id);
      const elapsed=live.started_at?dur(serverNow()-ms(live.started_at)):'0s';
      const facts=`<div class="pbar-facts"><span><span class="muted small">Suite</span><b>${esc(suite?(suite.name||suite.key):'—')}</b></span><span><span class="muted small">Elapsed</span><b data-elapsed="${esc(live.started_at||live.created_at)}">${elapsed}</b></span><span><span class="muted small">Current case</span><b>${esc(cur?cur.name:(live.status==='queued'?'Waiting for a worker':'Finishing up'))}</b></span></div>`;
      body=`${facts}${progressHtml(live,'big')}<div class="live-meta"><span><b>${live.done||0}</b> / ${total} cases done</span>${countsHtml(live)}</div>${rulesHtml}<a class="small" href="#/run/${esc(live.id)}">Open the live run →</a>`;
    }else if(d.run_id){const t=(sum&&sum.totals)||{};
      body=`<div class="muted small">${sum?`Reported ${t.reported||0} of ${t.cases||0} · ${t.passed||0} passed · ${(t.failed||0)+(t.inconclusive||0)} failed`:'Run finished.'}</div>${rulesHtml}<a class="small" href="#/run/${esc(d.run_id)}">Open the run →</a>`;
    }else body='<span class="muted small">No run was queued for this deployment.</span>';
  }else if(key==='teardown'){
    const td=d.teardown;const log=td&&td.log_tail?esc(String(td.log_tail).trim()):'';
    body=(td&&td.error?`<div class="small" style="color:var(--red)">${esc(td.error)}</div>`:'')+(log?`<pre class="pbar-log">${log}</pre>`:`<span class="muted small">${td?'Teardown '+esc(td.status)+'.':'Teardown runs once every execution of the run has finished.'}</span>`);
  }
  return `<div class="pbar-detail"><div class="pbar-detail-head"><b>${esc(s.name)}</b> — ${esc(s.label)}</div>${body}</div>`;
}
function deployStatusHtml(){
  const d=state.deploy;if(!d)return'';
  const stages=deployStages(d);
  const segs=stages.map(s=>{
    const open=state.deployStage===s.key;
    const pulse=s.state==='active'?'<span class="pulse"></span> ':'';
    const fill=(s.state==='active'&&s.pct!=null)?`<span class="seg-fill" style="width:${s.pct}%"></span>`:'';
    return `<button class="pstage pstage-${s.tone||'idle'} st-${s.state}${open?' open':''}" data-action="deploy-stage" data-stage="${s.key}" title="${esc(s.label)} — click for detail">${fill}<span class="pstage-body">${pulse}<b>${esc(s.name)}</b><span class="pstage-label">${esc(s.label)}</span></span></button>`;
  }).join('<span class="pstage-arrow">›</span>');
  const detail=state.deployStage?deployStageDetail(d,state.deployStage,stages):'';
  return `<div class="pbar-wrap"><div class="pbar">${segs}</div>${detail}</div>`;
}
// Pick up a deployment already in flight for the current environment (started this session, via
// the API, or by the feedback loop) so the overview progress bar shows it and survives a refresh.
async function loadActiveDeployment(){
  if(!state.envId)return;
  try{
    const res=await api('/api/v1/deployments?limit=12');
    const latest=(res.data||[]).filter(d=>d.environment_id===state.envId)[0];
    if(!latest)return;
    const full=(await api('/api/v1/deployments/'+encodeURIComponent(latest.id))).data;
    const td=full.teardown;
    const runLive=full.run_id&&activeRuns().some(e=>e.id===full.run_id);
    const active=full.status==='queued'||full.status==='deploying'
      ||(full.status==='succeeded'&&(runLive||(full.teardown_after_run&&(!td||td.status==='queued'||td.status==='running'))));
    if(active){state.deploy=full;state.deployStage=null;state.deployRun=null;if(!FORM_VIEWS.has(state.view))renderCurrentView();pollDeployment();}
  }catch(e){/* best effort */}
}
async function deployMain(btn){
  if(!state.envId){toast('No environment available.');return;}
  const sel=el('deployMode');
  const choice=(sel&&sel.value)||state.deployMode||'deploy_run_teardown';
  state.deployMode=choice;
  if(choice==='deploy_run_teardown_loop'){return startCycleRun(btn,{clean_start:false});}
  if(choice==='clean_cycle'){return startCycleRun(btn,{clean_start:true});}
  const body={environment_id:state.envId,application:state.appKey,mode:choice==='deploy_only'?'deploy_only':'deploy_and_run',teardown_after_run:choice==='deploy_run_teardown'};
  if(btn)btn.disabled=true;
  state.deployStage=null;state.deployRun=null;
  try{
    const res=await postJson('/api/v1/deployments',body);
    state.deploy=res.data;
    renderCurrentView();
    if(res.warning)toast(res.warning,'#/config-infra');
    if(state.deploy&&state.deploy.status==='failed')toast('Deploy failed: '+(state.deploy.error||'unknown error'));
    else{pollDeployment();loadSummary().then(renderCurrentView);}
  }catch(e){toast('Deploy failed: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
async function startCycleRun(btn,opts){
  const clean=!!(opts&&opts.clean_start);
  const inp=el('cycleIterations');
  const iterations=Math.max(1,Math.min(100,Number(inp&&inp.value)||state.cycleIterations||3));
  state.cycleIterations=iterations;
  const prompt=clean
    ?'Clean cycle on '+envName()+': tear down whatever is there, prune Docker (stopped containers, dangling images, old build cache), then deploy–run–tear down '+iterations+' times. Start?'
    :'Start cycle: deploy, run, tear down — repeated '+iterations+' times on '+envName()+'?';
  if(!confirm(prompt))return;
  if(btn)btn.disabled=true;
  state.deployStage=null;state.deployRun=null;
  try{
    const res=await postJson('/api/v1/cycle-runs',{application:state.appKey,environment:state.envId,iterations,clean_start:clean});
    state.cycleRun=res.data;
    toast(res.message||('Cycle started: '+iterations+' iterations'));
    // For a normal cycle the server has already queued the first deployment; pick it up so the
    // stage bar follows it. For a clean cycle we wait for preparation (teardown + prune) first;
    // once that finishes, the live poll's environment_cycle_run picks up the fresh deployment.
    if(!clean)loadActiveDeployment();
    renderCurrentView();
  }catch(e){toast('Cycle failed to start: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
async function cancelCycleRun(id,btn){
  if(!id||!confirm('Cancel this cycle? Any live run is cancelled; the current teardown is left to finish so the stack lands clean.'))return;
  if(btn)btn.disabled=true;
  try{
    const res=await postJson('/api/v1/cycle-runs/'+encodeURIComponent(id)+'/cancel',{});
    state.cycleRun=res.data;
    toast('Cycle cancelled'+(res.cancelled_runs?' · '+res.cancelled_runs+' run'+(res.cancelled_runs===1?'':'s')+' cancelled':''));
    pollLive();renderCurrentView();
  }catch(e){toast('Cancel failed: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
const deploySig=d=>JSON.stringify([d.status,d.run_id,d.error,d.teardown&&d.teardown.status,d.teardown&&d.teardown.log_tail,d.job&&d.job.log_tail,state.deployStage,state.deployRun&&state.deployRun.totals,activeRuns().find(e=>e.id===d.run_id)]);
async function pollDeployment(){
  if(deployPollTimer)clearTimeout(deployPollTimer);
  const d=state.deploy;
  if(!d||!d.id)return;
  const before=deploySig(d),wasDone=d.status==='succeeded'||d.status==='failed';
  try{
    const res=await api('/api/v1/deployments/'+encodeURIComponent(d.id));
    state.deploy=res.data;
    // Pull the run's own progress so the Run stage can show how far along it is.
    if(state.deploy.run_id){try{const rr=await api('/api/v1/runs/'+encodeURIComponent(state.deploy.run_id));state.deployRun=rr.data;}catch(e){}}
    if(deploySig(state.deploy)!==before&&!FORM_VIEWS.has(state.view))renderCurrentView();
  }catch(e){/* transient — keep last known state and retry */}
  const s=state.deploy;
  const done=s.status==='succeeded'||s.status==='failed';
  if(!done){deployPollTimer=setTimeout(pollDeployment,3000);return;}
  if(!wasDone){
    if(s.status==='succeeded'){toast(s.run_id?'Deploy succeeded — run queued':'Deploy succeeded','#/history');pollLive();}
    else toast('Deploy failed: '+(s.error||'unknown error'));
    loadSummary().then(renderCurrentView);
  }
  // Keep following while the run is still going, or until the teardown has finished.
  const td=s.teardown;
  const runLive=s.run_id&&activeRuns().some(e=>e.id===s.run_id);
  if(s.status==='succeeded'&&runLive){deployPollTimer=setTimeout(pollDeployment,3000);return;}
  if(s.status==='succeeded'&&s.teardown_after_run&&(!td||td.status==='queued'||td.status==='running')){deployPollTimer=setTimeout(pollDeployment,15000);return;}
  if(td&&td.status==='succeeded'&&!(d.teardown&&d.teardown.status==='succeeded')){toast(envName()+' torn down after the run','#/config-infra');loadSummary().then(renderCurrentView);}
}

// ---------------------------------------------------------------------------
// Configuration · Infrastructure — managed Docker stacks: up/down, deploy, tear down, housekeeping
// ---------------------------------------------------------------------------
const STACK_STATE={up:['pass','Up'],down:['','Down'],deploying:['warn','Deploying…'],tearing_down:['warn','Tearing down…'],failed:['fail','Deploy failed'],unknown:['','Unknown']};
function stackState(env){const d=env&&env.deployment,s=d&&d.state;if(STACK_STATE[s])return s;return d&&d.deployed_at?'up':'unknown';}
function stackChipHtml(env,title){if(!env||!env.infra)return'';const s=stackState(env);const [tone,label]=STACK_STATE[s];const pulse=(s==='deploying'||s==='tearing_down')?'<span class="pulse"></span> ':'';return `${pulse}<span class="chip${tone?' chip-'+tone:''}" title="${esc(title||'')}">${esc(label)}</span>`;}
// A single case or suite run goes straight to the queue; on a stack that is down it would only fail.
function stackDownGuard(envId){
  const e=state.environments.find(x=>x.id===(envId||state.envId));
  if(!e||!e.infra)return false;
  const s=stackState(e);
  if(s!=='down'&&s!=='tearing_down'&&s!=='failed')return false;
  toast((e.name||e.key)+' is '+STACK_STATE[s][1].toLowerCase().replace('…','')+' — use Deploy, or Run everything (it deploys first).','#/config-infra');
  return true;
}
function infraNavDot(){const d=state.infra;if(!d||!d.environments)return null;if(d.jobs&&d.jobs.some(j=>j.status==='running'||j.status==='queued'))return 'amber pulse-dot';if(!d.agent_online&&d.environments.length)return 'red';return null;}
function infraFormFocused(){const a=document.activeElement;return !!(a&&a.closest&&a.closest('#infraPolicy'));}
function fromNow(t){const s=(ms(t)-serverNow())/1000;return s<=0?'now':'in '+dur(s*1000);}
const INFRA_NUM=['idle_teardown_hours','max_uptime_hours','prune_every_hours','prune_build_cache_hours','job_timeout_minutes'];
const INFRA_BOOL=['teardown_after_run_default','remove_images_on_teardown','remove_volumes_on_teardown','auto_deploy_when_down'];
async function loadInfra(quiet){
  if(!quiet&&!(state.infra&&state.infra.environments)){state.infra={loading:true};if(state.view==='config-infra')renderCurrentView();}
  try{
    const d=(await api('/api/v1/infra')).data||{};
    const sig=JSON.stringify([d.agent_online,d.environments,(d.jobs||[]).map(j=>[j.id,j.status,j.updated_at]),d.last_prune&&d.last_prune.id]);
    const changed=sig!==state.infraSig;
    state.infraSig=sig;
    state.infra={...d,loading:false,error:null,policyDraft:(state.infra&&state.infra.policyDraft)||null};
    if((changed||!quiet)&&state.view==='config-infra'&&!infraFormFocused()){renderSideNav();renderCurrentView();}
  }catch(e){
    state.infra={...(state.infra||{}),loading:false,error:e.message};
    if(state.view==='config-infra'&&!quiet)renderCurrentView();
  }
}
function readInfraPolicyForm(){
  const d=state.infra;if(!d)return;
  const draft={};
  for(const k of INFRA_NUM){const i=el('ip_'+k);if(i)draft[k]=i.value;}
  for(const k of INFRA_BOOL){const i=el('ip_'+k);if(i)draft[k]=i.checked;}
  d.policyDraft=draft;
}
async function saveInfraPolicy(btn){
  readInfraPolicyForm();
  const draft=(state.infra&&state.infra.policyDraft)||{},body={};
  for(const k of INFRA_NUM)if(draft[k]!==undefined&&draft[k]!=='')body[k]=Number(draft[k]);
  for(const k of INFRA_BOOL)if(draft[k]!==undefined)body[k]=!!draft[k];
  formError('infraPolicyError','');
  btn.disabled=true;
  try{
    const res=await api('/api/v1/infra/policy',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    state.infra.policy=res.data;state.infra.policyDraft=null;
    toast('Lifecycle policy saved');
    await loadInfra(true);renderCurrentView();
  }catch(e){formError('infraPolicyError','Save failed: '+e.message);}
  finally{btn.disabled=false;}
}
async function infraDeploy(node){
  const env=((state.infra&&state.infra.environments)||[]).find(e=>e.id===node.dataset.id);
  if(!env)return;
  node.disabled=true;
  try{
    const res=await postJson('/api/v1/deployments',{environment_id:env.id,application:(env.applications&&env.applications[0])||state.appKey,mode:'deploy_only'});
    toast(res.warning||('Deploy of '+env.name+' queued — the stack stays up afterwards'));
  }catch(e){toast('Deploy failed: '+e.message);}
  await loadInfra(true);renderCurrentView();
}
async function infraTeardown(node){
  const name=node.dataset.name,active=Number(node.dataset.active)||0;
  const policy=(state.infra&&state.infra.policy)||{};
  const what='Containers'+(policy.remove_images_on_teardown===false?'':' and images')+(policy.remove_volumes_on_teardown?' and data volumes':'');
  if(!confirm('Tear down '+name+' now?'+(active?' It has '+plural(active,'run')+' in progress — they will fail.':'')+'\n\n'+what+' are removed. It is deployed again on the next deploy or run.'))return;
  node.disabled=true;
  try{
    const res=await postJson('/api/v1/infra/jobs',{kind:'teardown',environment_id:node.dataset.id,force:active>0});
    toast(res.message||('Teardown of '+name+' queued'),'#/config-infra');
  }catch(e){toast('Teardown failed: '+e.message);}
  await loadInfra(true);
  loadSummary().then(renderCurrentView);
}
async function infraPrune(dry){
  try{
    const res=await postJson('/api/v1/infra/jobs',{kind:'prune',dry_run:!!dry});
    toast(res.message||(dry?'Housekeeping preview queued — see Recent jobs for what it would remove':'Docker housekeeping queued'));
  }catch(e){toast('Housekeeping failed: '+e.message);}
  await loadInfra(true);renderCurrentView();
}
async function infraCancelJob(id){
  try{await postJson('/api/v1/infra/jobs/'+encodeURIComponent(id)+'/cancel',{});toast('Job cancelled');}
  catch(e){toast('Cancel failed: '+e.message);}
  await loadInfra(true);renderCurrentView();
}
function renderInfraView(){
  el('viewTitle').textContent='Configuration · Infrastructure';
  const d=state.infra;
  if(!d||(d.loading&&!d.environments)){el('content').innerHTML=skeletonHtml();return;}
  if(d.error&&!d.environments){el('content').innerHTML=`<div class="card empty">Could not load infrastructure: ${esc(d.error)}</div>`;return;}
  const p={...(d.policy||{}),...(d.policyDraft||{})};
  const agents=d.agents||[],online=agents.filter(a=>a.online);
  const envs=d.environments||[],jobs=d.jobs||[];
  const gb=b=>b!=null?(b/1e9).toFixed(1)+' GB':'—';
  let h=`<div class="group-head first"><h2>Infrastructure</h2><div class="hp-actions"><button class="btn" data-action="infra-refresh">Refresh</button><button class="btn" data-action="infra-prune-preview" title="Report what housekeeping would remove, without removing anything">Preview housekeeping</button><button class="btn primary" data-action="infra-prune" title="Remove stopped containers and unused images of the managed stacks, dangling images and old build cache now">Prune Docker now</button></div></div>`;
  h+=online.length
    ?`<div class="muted small" style="margin:-4px 0 12px">Infra agent ${online.map(a=>`<span class="chip chip-pass">${esc(a.name)}</span> on ${esc(a.host||'?')} · heartbeat ${ago(a.last_heartbeat)}`).join(' · ')}</div>`
    :`<div class="banner" style="margin:0 0 12px">No infrastructure agent is online — deploys, teardowns and housekeeping wait in the queue. Start one on the Docker host: <code>npm run start:infra-agent</code>${agents.length?' (last seen: '+esc(agents[0].name)+' '+ago(agents[0].last_heartbeat)+')':''}</div>`;
  const up=envs.filter(e=>e.state==='up').length,pending=jobs.filter(j=>j.status==='queued'||j.status==='running').length;
  const lp=d.last_prune,lr=lp&&lp.result||{},after=lr.after||{};
  h+='<div class="kpi-grid">'+
    kpi('Managed stacks',envs.length,up+' up · '+envs.filter(e=>e.state==='down').length+' down')+
    kpi('Jobs pending',pending,pending?'queued or running':'nothing to do',pending?'amber':'')+
    kpi('Last housekeeping',lp?ago(lp.finished_at):'—',lp?(lr.dry_run?'preview only':lp.status==='failed'?'failed':'reclaimed '+gb(lr.reclaimed_bytes)):'not yet run','sm'+(lp&&lp.status==='failed'?' red':''))+
    kpi('Docker images',after.images?after.images.total:'—',after.images?gb(after.images.size_bytes)+' · '+esc(after.images.reclaimable)+' reclaimable':'known after housekeeping','sm')+
    kpi('Build cache',after.build_cache?gb(after.build_cache.size_bytes):'—',after.build_cache?esc(after.build_cache.reclaimable)+' reclaimable':'known after housekeeping','sm')+
  '</div>';
  const rows=envs.map(e=>{
    const [tone,label]=STACK_STATE[e.state]||STACK_STATE.unknown;
    const pulse=(e.state==='deploying'||e.state==='tearing_down')?'<span class="pulse"></span> ':'';
    const dep=e.deployed||{};
    const deployed=dep.commit?`${esc(String(dep.commit).slice(0,10))}${dep.ref?' <span class="muted">('+esc(dep.ref)+')</span>':''}<div class="muted small">${e.state==='down'?'torn down '+ago(dep.torn_down_at):'deployed '+ago(dep.deployed_at)}</div>`:'<span class="muted">never deployed from here</span>';
    const next=e.next_teardown?`${e.next_teardown.reason==='idle'?'Idle':'Up too long'} → tear down ${fromNow(e.next_teardown.at)}${e.next_teardown.blocked_by_active_runs?' <span class="muted">(after the run)</span>':''}`:(e.state==='down'?'<span class="muted">stays down until a deploy or a run</span>':'<span class="muted">no rule applies</span>');
    const job=e.pending_job?`<div class="muted small">${esc(e.pending_job.kind)} ${esc(e.pending_job.status)}${e.pending_job.reason?' · '+esc(e.pending_job.reason.replace(/_/g,' ')):''}</div>`:'';
    const busy=e.state==='deploying'||e.state==='tearing_down'||!!e.pending_job;
    const canTear=!busy&&e.state!=='down';
    return `<tr><td><strong>${esc(e.name)}</strong><div class="muted small">${esc(e.key)}${e.compose_project?' · '+esc(e.compose_project):''}</div></td><td class="nowrap">${pulse}<span class="chip${tone?' chip-'+tone:''}">${esc(label)}</span>${job}</td><td>${deployed}</td><td class="muted small">${e.active_runs?plural(e.active_runs,'active run'):(e.last_run_at?'last run '+ago(e.last_run_at):'never run')}</td><td class="small">${next}</td><td class="nowrap"><button class="btn small-btn" style="margin-top:0" data-action="infra-deploy" data-id="${esc(e.id)}"${busy?' disabled':''} title="Deploy ${esc(e.default_ref||'main')} and keep the stack up (nothing is run)">Deploy ${esc(e.default_ref||'main')}</button> <button class="btn small-btn" style="margin-top:0" data-action="infra-teardown" data-id="${esc(e.id)}" data-name="${esc(e.name)}" data-active="${e.active_runs||0}"${canTear?'':' disabled'}>Tear down</button></td></tr>`;
  }).join('');
  h+=`<div class="card"><div class="card-head"><div><h2>Managed stacks</h2><div class="muted small">Local Docker stacks the engine deploys and tears down itself — they run only while they are being tested. Everything else on this machine is left alone.</div></div></div><div class="table-wrap"><table><thead><tr><th>Environment</th><th>State</th><th>Deployed</th><th>Usage</th><th>Next automatic action</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">No managed stacks. Set Lifecycle to “Local Docker stack” on an environment (Configuration › Environments), or run deploy/staging/deploy.mjs deploy — it registers the environment as managed.</td></tr>'}</tbody></table></div></div>`;
  const num=(k,label,hint)=>`<div class="form-row"><span class="form-label">${esc(label)}</span><div><input type="number" id="ip_${k}" min="0" step="1" value="${esc(p[k])}" style="width:110px"> <span class="muted small">${esc(hint)}</span></div></div>`;
  const bool=(k,label,hint)=>`<div class="form-row"><span class="form-label">${esc(label)}</span><div><label class="type-check"><input type="checkbox" id="ip_${k}"${p[k]?' checked':''}> <span class="muted small">${esc(hint)}</span></label></div></div>`;
  h+=`<div class="card" id="infraPolicy"><div class="card-head"><div><h2>Lifecycle policy</h2><div class="muted small">When stacks come down on their own, and how Docker is kept clean</div></div></div><div class="hp-body">
    ${num('idle_teardown_hours','Tear down when idle for','hours without a run since the deploy or the last run (0 = never)')}
    ${num('max_uptime_hours','Tear down when up for','hours since the deploy, as soon as no run is active (0 = never)')}
    ${num('prune_every_hours','Housekeeping every','hours (0 = never): stopped containers and unused images of the managed stacks, dangling images, old build cache')}
    ${num('prune_build_cache_hours','Remove build cache unused for','hours (0 = keep all build cache)')}
    ${num('job_timeout_minutes','Fail a job after','minutes')}
    ${bool('teardown_after_run_default','Tear down after a run','“Deploy and run” takes the stack down once the run has finished, whatever the result')}
    ${bool('remove_images_on_teardown','Remove images on teardown','the stack’s images go with its containers; the next deploy rebuilds from cache')}
    ${bool('remove_volumes_on_teardown','Remove data volumes on teardown','the stack’s database starts empty on the next deploy')}
    ${bool('auto_deploy_when_down','Deploy first when a run finds the stack down','Run everything, schedules and POST /api/v1/runs deploy, run, then tear down')}
    <div class="form-row"><span></span><div><button class="btn primary" data-action="infra-save-policy">Save policy</button><div id="infraPolicyError" class="field-error" hidden></div></div></div>
  </div></div>`;
  const jrows=jobs.map(j=>{
    const tone=j.status==='succeeded'?'pass':j.status==='failed'?'fail':(j.status==='running'||j.status==='queued')?'warn':'';
    const prm=j.params||{},res=j.result||{},rm=res.removed||{};
    const what=j.kind==='prune'?'Housekeeping'+(prm.dry_run?' (preview)':''):j.kind==='deploy'?'Deploy '+esc(prm.ref||''):'Tear down';
    let detail='';
    if(j.kind==='prune'&&j.status==='succeeded')detail=`${(rm.containers||[]).length} containers, ${(rm.images||[]).length} images, ${rm.dangling_images||0} dangling${rm.build_cache?', build cache '+esc(rm.build_cache):''}${res.reclaimed_bytes!=null?' · reclaimed '+gb(res.reclaimed_bytes):''}`;
    else if(j.kind==='deploy'&&j.status==='succeeded')detail=(res.commit?'commit '+esc(String(res.commit).slice(0,10)):'')+(j.run_id?' · <a href="#/history">run →</a>':'');
    else if(j.kind==='teardown'&&j.status==='succeeded'&&res.swept)detail=`${res.swept.containers} containers, ${res.swept.images} images swept${res.script_error?' <span class="muted">(script reported an error; sweep finished the job)</span>':''}`;
    if(j.error)detail+=(detail?' · ':'')+`<span style="color:var(--red)">${esc(String(j.error).split('\n')[0]).slice(0,200)}</span>`;
    const took=j.started_at?dur((j.finished_at?ms(j.finished_at):serverNow())-ms(j.started_at)):'—';
    const open=state.infraOpenJob===j.id;
    const live=j.status==='running'||j.status==='queued';
    return `<tr><td class="nowrap">${live?'<span class="pulse'+(j.status==='queued'?' queued':'')+'"></span> ':''}<span class="chip${tone?' chip-'+tone:''}">${esc(j.status)}</span></td><td>${what}<div class="muted small">${esc((j.reason||'').replace(/_/g,' '))}${j.agent_id?' · '+esc(j.agent_id):''}</div></td><td>${esc(j.environment_name||(j.kind==='prune'?'all managed stacks':'—'))}</td><td class="muted small nowrap">${when(j.created_at)}<div>${took}</div></td><td class="small">${detail||'<span class="muted">—</span>'}</td><td class="nowrap">${j.log_tail?`<button class="btn small-btn" style="margin-top:0" data-action="infra-job-log" data-id="${esc(j.id)}">${open?'Hide log':'Log'}</button>`:''}${j.status==='queued'?` <button class="btn small-btn" style="margin-top:0" data-action="infra-cancel-job" data-id="${esc(j.id)}">Cancel</button>`:''}</td></tr>${open?`<tr><td colspan="6"><pre class="small" style="white-space:pre-wrap;max-height:320px;overflow:auto;margin:0;background:var(--panel2);padding:10px;border-radius:6px">${esc(j.log_tail)}</pre></td></tr>`:''}`;
  }).join('');
  h+=`<div class="card"><div class="card-head"><h2>Recent jobs</h2><span class="muted small">${plural(jobs.length,'job')}</span></div><div class="table-wrap"><table><thead><tr><th>Status</th><th>Job</th><th>Stack</th><th>When</th><th>Result</th><th></th></tr></thead><tbody>${jrows||'<tr><td colspan="6" class="empty">No jobs yet. They appear here when a deploy, teardown or housekeeping is queued.</td></tr>'}</tbody></table></div></div>`;
  el('content').innerHTML=h;
}

// ---------------------------------------------------------------------------
// Routing + wiring (event delegation: bound once, survives re-renders)
// ---------------------------------------------------------------------------
function parseHash(){
  const parts=(location.hash||'#/home').replace(/^#\/?/,'').split('/').map(p=>p?decodeURIComponent(p):p);
  const v=parts[0]||'home',arg=parts[1]||null;
  Object.assign(state,{typeId:null,sitGroupId:null,runId:null,suiteId:null,tile:null,selected:new Set(),rowLimit:ROWS,caseId:null,caseTab:'details',methodName:null,tagName:null,tbMode:null,tbArg:null});
  if(v==='type'&&arg){state.view='type';state.typeId=arg;if(parts[2]==='suite'&&parts[3])state.suiteId=parts[3];}
  // Test bench (testbench.js): #/test-cases[/<id>], #/test-case-form[/new|edit/<id>|clone/<id>], #/test-suites[/<id>], #/test-suite-form
  else if(v==='test-cases'||v==='test-suites'){state.view=v;state.tbMode=arg;}
  else if(v==='test-case-form'){state.view=v;state.tbMode=arg||'new';state.tbArg=parts[2]||null;}
  else if(v==='test-suite-form')state.view=v;
  else if(v==='sit'){state.view=arg?'sit':'sit-all';state.sitGroupId=arg;if(parts[2]==='suite'&&parts[3])state.suiteId=parts[3];}
  else if(v==='run'&&arg){state.view='run';state.runId=arg;}
  else if(v==='case'&&arg){state.view='case';state.caseId=arg;state.caseTab=parts[2]==='runs'?'runs':'details';}
  else if(v==='method'&&arg){state.view='method';state.methodName=arg;}
  else if(v==='tag'&&arg){state.view='tag';state.tagName=arg;}
  else if(v==='home'||v==='history'||v==='builds'||v==='baseline'||v==='config-retention'||v==='config-apps'||v==='config-envs'||v==='config-infra'||v==='schedules'||v==='reports'||v==='insights'||v==='catalog-coverage')state.view=v;
  else state.view='overview';
}
async function onRoute(){
  parseHash();renderSideNav();
  const runId=state.runId,caseId=state.caseId;
  if(state.view==='builds'&&state.buildRows===null)loadBuildRows();
  if(state.view==='config-retention'&&state.settings===null)loadSettings();
  if(state.view==='schedules')loadSchedules();
  if(state.view==='config-infra')loadInfra();
  if(state.view==='history'&&!state.runsList.loaded){if(!state.runsFilter.environment_id)state.runsFilter.environment_id=state.envId||'';loadRunsList(true);}
  renderCurrentView();
  window.scrollTo(0,0);
  if(state.view==='test-cases'||state.view==='test-case-form'||state.view==='test-suites'||state.view==='test-suite-form'){TB.route(state.view,state.tbMode,state.tbArg);return;}
  if(runId){await loadRun(runId);if(state.runId===runId)renderCurrentView();}
  if(caseId&&(!state.caseDetail||state.caseDetail.id!==caseId)){await loadCaseDetail(caseId);if(state.caseId===caseId)renderCurrentView();}
}
async function refreshAll(){
  try{await Promise.all([loadSummary(),pollLive(),loadHealth()]);banner(null);renderBanner();renderSideNav();renderCurrentView();}
  catch(e){banner('Failed to load: '+e.message);}
}
el('menuToggle').onclick=()=>el('sidebar').classList.toggle('open');
el('refreshBtn').onclick=()=>refreshAll();
el('envSelect').onchange=()=>switchEnvironment(el('envSelect').value);
el('headedCheck').onchange=()=>{state.headed=el('headedCheck').checked;try{localStorage.setItem('te.headed',state.headed?'1':'');}catch{}};
// Application version: top-bar input. Hydrates from localStorage (default "main"),
// persists on change, feeds every run / schedule call via currentAppVersion().
(function initAppVersion(){
  const input=el('appVersionInput');if(!input)return;
  try{const saved=localStorage.getItem('te.appVersion');if(saved)input.value=saved;else input.value=state.appVersion||'main';}catch{input.value=state.appVersion||'main';}
  state.appVersion=input.value;
  input.addEventListener('change',()=>{state.appVersion=input.value.trim()||'main';input.value=state.appVersion;try{localStorage.setItem('te.appVersion',state.appVersion);}catch{}});
})();
/** Fill the top-bar version datalist from facets the runs page already returns, so the user sees past versions used. */
function updateAppVersionDatalist(){
  const dl=document.getElementById('appVersionList');if(!dl)return;
  const facets=state.runsList&&state.runsList.facets;
  const versions=facets&&Array.isArray(facets.versions)?facets.versions.filter(Boolean):[];
  dl.innerHTML=['main',...versions].filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<option value="${esc(v)}">`).join('');
}
el('appSelect').onchange=()=>switchApplication(el('appSelect').value);
el('globalSearch').oninput=debounce(e=>{state.search=e.target.value;state.rowLimit=ROWS;renderCurrentView();},120);
el('sideNav').addEventListener('click',e=>{
  const sec=e.target.closest('.nav-sec');
  if(sec){toggleNavSection(sec.dataset.sec);return;}
  const b=e.target.closest('.nav-item');if(!b)return;
  if(b.tagName==='A')return; // a real link (e.g. Defect log) — let the browser follow its href
  const v=b.dataset.view,id=b.dataset.id;
  location.hash=v==='type'?'#/type/'+encodeURIComponent(id):v==='sit'?'#/sit/'+encodeURIComponent(id):v==='sit-all'?'#/sit':v==='overview'?'#/overview':'#/'+v;
  el('sidebar').classList.remove('open');
});
const content=el('content');
content.addEventListener('click',e=>{
  const t=e.target;
  const act=t.closest('[data-action]');if(act){if(!act.disabled)handleAction(act.dataset.action,act);return;}
  const nav=t.closest('[data-nav]');if(nav){location.hash=nav.dataset.nav;return;}
  const rt=t.closest('.run-tile');if(rt){location.hash='#/run/'+encodeURIComponent(rt.dataset.run);return;}
  const tile=t.closest('[data-tile]');if(tile){toggleTile(tile.dataset.tile);return;}
  const cs=t.closest('[data-case]');if(cs){location.hash='#/case/'+encodeURIComponent(cs.dataset.case);return;}
  const run=t.closest('[data-run]');if(run&&!t.closest('a,button,input'))location.hash='#/run/'+encodeURIComponent(run.dataset.run);
});
content.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-run]'))location.hash='#/run/'+encodeURIComponent(e.target.dataset.run);});
content.addEventListener('change',e=>{
  if(e.target.id==='deployMode'){state.deployMode=e.target.value;renderCurrentView();return;}
  if(e.target.id==='cycleIterations'){const n=Math.max(1,Math.min(100,Number(e.target.value)||3));state.cycleIterations=n;e.target.value=String(n);return;}
  if(e.target.closest('#infraPolicy')){readInfraPolicyForm();return;}
  const form=e.target.closest('[data-form]');
  if(form){
    if(form.dataset.form==='sched')readSchedForm();else readReportForm();
    // Text and date fields only sync to state; re-rendering on their blur would swallow the click that caused it.
    if(e.target.matches('input[type=radio],input[type=checkbox],select'))renderCurrentView();
    return;
  }
  if(e.target.matches('#runsEnvFilter,#runsStatusFilter,#runsTriggerFilter,#runsVersionFilter,#runsFromFilter,#runsToFilter')){applyRunFilters();return;}
  const typesel=e.target.closest('[data-typesel]');
  if(typesel){
    if(typesel.checked)state.selectedTypes.add(typesel.dataset.typesel);else state.selectedTypes.delete(typesel.dataset.typesel);
    renderCurrentView();
    return;
  }
  // Runs page: individual + select-all checkboxes.
  const runPick=e.target.closest('[data-run-pick]');
  if(runPick){
    state.runsSel=state.runsSel||new Set();
    if(runPick.checked)state.runsSel.add(runPick.dataset.runPick);else state.runsSel.delete(runPick.dataset.runPick);
    renderCurrentView();
    return;
  }
  const runAll=e.target.closest('[data-run-pickall]');
  if(runAll){
    state.runsSel=state.runsSel||new Set();
    const ids=(state.runsList.rows||[]).map(r=>r.id);
    if(runAll.checked)ids.forEach(id=>state.runsSel.add(id));else ids.forEach(id=>state.runsSel.delete(id));
    renderCurrentView();
    return;
  }
  const all=e.target.closest('[data-selall]');
  if(all){
    const ids=[...all.closest('table').querySelectorAll('[data-sel]')].map(cb=>cb.dataset.sel);
    if(all.checked)ids.forEach(id=>state.selected.add(id));else ids.forEach(id=>state.selected.delete(id));
    renderCurrentView();
    return;
  }
  const cb=e.target.closest('[data-sel]');if(!cb)return;
  if(cb.checked)state.selected.add(cb.dataset.sel);else state.selected.delete(cb.dataset.sel);
  content.querySelectorAll('[data-action="run-selected"]').forEach(b=>{b.disabled=!state.selected.size;b.textContent=runSelLabel();});
  content.querySelectorAll('[data-action="save-suite"]').forEach(b=>{b.disabled=!state.selected.size;b.textContent='Save selected as suite'+(state.selected.size?' ('+state.selected.size+')':'');});
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
  loadActiveDeployment();
})();
