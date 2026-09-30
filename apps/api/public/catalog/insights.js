'use strict';
/**
 * Quality insights view (#/insights) for the unified console.
 *
 * Loaded before app.js: this file only declares functions and binds listeners,
 * and reads app.js globals (state, el, esc, api, postJson, toast, when, ago,
 * plural, kpi, stat, Charts) at call time. app.js calls renderInsightsView()
 * from renderCurrentView().
 *
 * Insights belong to the application, not to the selected environment: one
 * version covers every environment and the screen compares them. A version is
 * a stored snapshot (facts) plus the review written over it; versions are
 * listed by GET /api/v1/insights and "Refresh insights" POSTs a new one.
 */
const QI_VERDICT={good:['chip-pass','✓','Good'],watch:['chip-warn','!','Watch'],at_risk:['chip-warn','!','At risk'],critical:['chip-fail','✕','Critical']};
const QI_SEVERITY={critical:'chip-fail',high:'chip-fail',medium:'chip-warn',low:'',info:''};
const QI_NATURE={product_defect:'Product defect',test_defect:'Test defect',environment:'Environment',infrastructure:'Infrastructure',test_data:'Test data',unknown:'Unknown'};
const QI_STATUS_SERIES=[['passing','Passing','var(--viz-pass)'],['failing','Failing','var(--viz-fail)'],['other','Other','var(--viz-other)'],['never_run','Never run','var(--viz-never)']];
const QI_TABS=[['failing','Most failures','top_failing'],['regressed','Regressed','regressed'],['flaky','Flaky','flaky'],['always','Never passed','always_failing'],['divergent','Differ by environment','divergent'],['never','Never run','never_run'],['shallow','Shallow checks',null],['slowest','Slowest','slowest']];
const QI_POLL=3000;

function qiState(){return state.insights||(state.insights={app:null,list:null,ai:null,id:null,doc:null,loading:false,error:null,busy:false,tab:'failing',charts:{},timer:null});}
const qiWords=v=>String(v??'').replace(/_/g,' ');
const qiPct=v=>v==null?'—':v+'%';
const qiShort=c=>String(c||'').slice(0,12);
const qiDay=d=>new Date(d+'T12:00:00Z').toLocaleDateString(undefined,{month:'short',day:'numeric'});
function qiChip(v){const c=QI_VERDICT[v];return c?`<span class="chip ${c[0]}"><span aria-hidden="true">${c[1]}</span>${c[2]}</span>`:'';}
function qiHash(b){return b&&b.commit?`<code class="qi-hash" title="${esc(b.commit)}">${esc(qiShort(b.commit))}</code>`:'<span class="muted">not registered</span>';}
function qiList(items,cls){return items&&items.length?`<ul class="qi-list ${cls||''}">${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';}
function qiParas(v){return (Array.isArray(v)?v:[v]).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
async function qiLoad(keepId){
  const q=qiState(),app=state.appKey;
  if(q.loading)return;
  q.loading=true;clearTimeout(q.timer);
  try{
    const res=await api('/api/v1/insights?application_key='+encodeURIComponent(app));
    if(app!==state.appKey)return;
    q.list=res.data||[];q.ai=res.ai||null;q.error=null;
    const wanted=keepId&&q.list.find(r=>r.id===q.id);
    const pick=wanted||q.list.find(r=>r.status==='generating')||q.list.find(r=>r.status==='ready')||q.list[0]||null;
    q.id=pick?pick.id:null;
    if(!pick)q.doc=null;
    else if(!q.doc||q.doc.id!==pick.id||q.doc.status!==pick.status)q.doc=(await api('/api/v1/insights/'+encodeURIComponent(pick.id))).data;
  }catch(e){q.error=e.message;if(q.list===null)q.list=[];}
  finally{
    q.loading=false;
    // A version being written is polled until it settles; the refresh button stays busy meanwhile.
    const pending=(q.list||[]).some(r=>r.status==='generating');
    if(!pending)q.busy=false;
    if(pending&&state.view==='insights')q.timer=setTimeout(()=>qiLoad(true),QI_POLL);
    if(state.view==='insights')renderInsightsView();
  }
}
async function qiRefresh(){
  const q=qiState();
  if(q.busy)return;
  q.busy=true;renderInsightsView();
  try{
    const res=await fetch('/api/v1/insights',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({application_key:state.appKey})});
    const body=await res.json().catch(()=>({}));
    if(!res.ok&&res.status!==409)throw new Error(body.error||('HTTP '+res.status));
    if(body.data){q.id=body.data.id;q.doc=null;}
    toast(res.status===409?'A refresh is already running — showing it':'Writing version '+body.data.version+'…');
  }catch(e){q.busy=false;toast('Refresh failed: '+e.message);}
  while(q.loading)await new Promise(r=>setTimeout(r,100));   // a poll already in flight predates the new version
  await qiLoad(true);
}
async function qiOpen(id){
  const q=qiState();
  if(!id||id===q.id)return;
  q.id=id;q.doc=null;renderInsightsView();
  try{q.doc=(await api('/api/v1/insights/'+encodeURIComponent(id))).data;q.error=null;}catch(e){q.error=e.message;}
  renderInsightsView();
  window.scrollTo(0,0);
}

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------
function qiCaseIds(s){
  const ids=new Map((state.cases||[]).map(c=>[c.key,c.id]));
  const take=rows=>{for(const r of rows||[])if(r&&r.key&&r.id)ids.set(r.key,r.id);};
  const c=s.cases||{};
  [c.top_failing,c.flaky,c.regressed,c.always_failing,c.never_run,c.divergent,c.slowest,s.depth&&s.depth.shallow].forEach(take);
  for(const e of s.environments||[])take(e.top_failing);
  return ids;
}
function qiCaseKeys(keys,ids){
  if(!keys||!keys.length)return '';
  return `<div class="qi-keys">${keys.slice(0,12).map(k=>ids.has(k)?`<button class="case-name key small" data-case="${esc(ids.get(k))}">${esc(k)}</button>`:`<span class="key small">${esc(k)}</span>`).join('')}${keys.length>12?`<span class="muted small">+${keys.length-12} more</span>`:''}</div>`;
}
function qiCaseName(r){return `<button class="case-name" data-case="${esc(r.id)}">${esc(r.name)}</button><div class="key small">${esc(r.key)}</div>`;}
// Delta against the previous version. goodUp says which direction is an improvement; the arrow and sign carry it without colour.
function qiDelta(now,prev,goodUp,unit){
  if(now==null||!prev)return '';
  const d=Math.round((now-prev.value)*10)/10;
  if(!d)return `<span class="qi-delta">no change since v${prev.version}</span>`;
  const good=(d>0)===goodUp;
  return `<span class="qi-delta ${good?'good':'bad'}">${d>0?'▲':'▼'} ${Math.abs(d)}${unit||''} since v${prev.version}</span>`;
}
function qiKpi(label,value,sub,cls,delta){return kpi(label,value,[sub,delta].filter(Boolean).join('<br>'),cls);}
function qiFigure(title,note,name,legend,table){
  const lg=legend?`<span class="legend">${legend.map(([,l,c])=>`<span><i style="background:${c}"></i>${esc(l)}</span>`).join('')}</span>`:(note?`<span class="muted small">${esc(note)}</span>`:'');
  return `<figure class="viz"><figcaption><span>${esc(title)}</span>${lg}</figcaption>${legend&&note?`<div class="muted small qi-note">${esc(note)}</div>`:''}<div class="chart qi-chart" data-qichart="${name}"></div>${table||''}</figure>`;
}
function qiTable(id,label,head,rows){
  return `<details data-keep="qi:${id}"${state.open.has('qi:'+id)?' open':''}><summary>${esc(label)}</summary><div class="table-wrap"><table><thead><tr>${head.map(h=>`<th${h[1]?' class="num"':''}>${esc(h[0])}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></details>`;
}

function qiScoreHtml(s){
  const sc=s.score,tone=v=>v>=85?'pass':v>=50?'warn':'fail';
  return `<div class="qi-score"><div class="qi-hero"><span class="qi-hero-value">${sc.value}</span><span class="qi-hero-of">/ 100</span></div>
    <div class="muted small">Quality score — weighted from the six measures below</div>
    <div class="qi-components">${sc.components.map(c=>`<div class="qi-comp" title="${esc(c.basis)}">
      <span class="qi-comp-label">${esc(c.label)} <span class="muted small">· weight ${c.weight}</span></span><span class="qi-comp-value">${c.value}</span>
      <span class="qi-meter ${tone(c.value)}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c.value}" aria-label="${esc(c.label)}"><i style="width:${Math.max(0,Math.min(100,c.value))}%"></i></span>
      <span class="qi-comp-basis muted small">${esc(c.basis)}</span></div>`).join('')}</div></div>`;
}
function qiEnvCard(e,review,refKey){
  const retired=e.status!=='active',seg=(v,c)=>v?`<span class="seg ${c}" style="flex-grow:${v}"></span>`:'';
  const b=e.deployed_build;
  const build=b?`Build ${qiHash(b)}${[b.ref,b.version].filter(Boolean).map(x=>' · '+esc(x)).join('')}${b.deployed_at?` · deployed ${esc(when(b.deployed_at))}`:''}`:'<span class="qi-warn">No build registered — results here cannot be tied to a commit.</span>';
  const builds=e.builds.length>1||(e.builds[0]&&!e.builds[0].commit&&b)?`<div class="qi-sub"><span class="muted small">Builds tested in the window</span><ul class="qi-builds">${e.builds.map(x=>`<li>${x.commit?`<code class="qi-hash" title="${esc(x.commit)}">${esc(qiShort(x.commit))}</code>`:'<span class="muted">no build recorded</span>'}<span class="muted small">${plural(x.runs,'run')} · ${x.passed} passed · ${x.failed} failed${x.inferred?' · attributed from the deployment record':''}</span></li>`).join('')}</ul></div>`:'';
  const triggers=Object.entries(e.runs_by_trigger).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="tag">${esc(k)} ${v}</span>`).join(' ');
  const flags=[[e.flaky,'flaky'],[e.regressed,'regressed'],[e.always_failing,'never passed'],[e.consistently_passing,'steadily passing']].filter(x=>x[0]).map(x=>`${x[0]} ${x[1]}`).join(' · ');
  const classes=e.failure_classes.slice(0,5).map(f=>`<span class="tag">${esc(qiWords(f.classification))} ${f.count}</span>`).join(' ');
  const top=e.top_failing.length?qiTable('env:'+e.key,`Most frequent failures here (${e.top_failing.length})`,[['Test case'],['Failed',1],['Runs',1],['Cause']],e.top_failing.map(r=>`<tr><td>${qiCaseName(r)}</td><td class="num">${r.failures}</td><td class="num">${r.runs}</td><td class="muted small">${esc(qiWords(r.classification||''))}<div>${esc(r.message||'')}</div></td></tr>`)):'';
  return `<article class="card qi-env${retired?' retired':''}">
    <div class="card-head"><div><h2>${esc(e.name)}</h2><div class="muted small">${esc(e.key)} · ${esc(qiWords(e.env_type))}${e.base_url?' · '+esc(e.base_url):''}</div></div>
      <div class="hp-actions">${e.key===refKey?'<span class="tag" title="The most production-like environment with results: the headline numbers are read from it">reference</span>':''}${retired?'<span class="tag">retired</span>':''}${review?qiChip(review.verdict):''}</div></div>
    <div class="hp-body">
      <div class="qi-build">${build}</div>
      <div class="hp-stats">${stat('Runs',e.runs,`${e.results} results · ${plural(e.days_with_runs,'active day')}`)}${stat('Pass rate',qiPct(e.pass_rate),`${e.passed} passed · ${e.failed} failed${e.other?` · ${e.other} other`:''}`)}${stat('Coverage',e.coverage_pct+'%',`${e.cases_executed} cases have run here`)}${stat('Last run',e.last_run_at?esc(ago(e.last_run_at)):'—',e.last_run_at?esc(when(e.last_run_at)):'nothing in the window')}</div>
      <div class="muted small">Latest result of every case</div>
      <div class="meter qi-envmeter" aria-hidden="true">${seg(e.latest.passing,'pass')}${seg(e.latest.failing,'fail')}${seg(e.latest.other,'other')}${seg(e.latest.never_run,'never')}</div>
      <div class="muted small">${e.latest.passing} passing · ${e.latest.failing} failing${e.latest.other?` · ${e.latest.other} other`:''} · ${e.latest.never_run} never run${flags?' — '+flags:''}</div>
      ${triggers?`<div class="qi-sub"><span class="muted small">Started by</span> ${triggers}</div>`:''}
      ${classes?`<div class="qi-sub"><span class="muted small">Non-passing results</span> ${classes}</div>`:''}
      ${builds}
      ${review?`<div class="qi-review">${qiParas(review.assessment)}${qiList(review.actions,'actions')}</div>`:''}
      ${top}
    </div></article>`;
}
function qiFindingHtml(f,ids,envName){
  return `<li class="qi-finding"><div class="qi-finding-head"><span class="chip ${QI_SEVERITY[f.severity]||''}">${esc(f.severity)}</span><b>${esc(f.title)}</b><span class="tag">${esc(qiWords(f.area))}</span>${f.environment?`<span class="tag">${esc(envName(f.environment))}</span>`:''}</div>
    <p>${esc(f.detail)}</p>${qiList(f.evidence,'evidence')}
    ${f.recommendation?`<p class="qi-rec"><span class="muted small">Recommendation</span> ${esc(f.recommendation)}</p>`:''}${qiCaseKeys(f.case_keys,ids)}</li>`;
}
function qiCaseTabs(s,q){
  const c=s.cases,total={failing:c.top_failing.length,regressed:c.regressed_total,flaky:c.flaky_total,always:c.always_failing_total,divergent:c.divergent_total,never:c.never_run_total,shallow:s.depth.shallow_total,slowest:c.slowest.length};
  const tabs=QI_TABS.map(([id,label])=>`<button class="tab-btn${q.tab===id?' active':''}" data-qi-act="tab" data-tab="${id}">${label} (${total[id]})</button>`).join('');
  const th=cols=>`<thead><tr>${cols.map(h=>`<th${h[1]?' class="num"':''}>${h[0]}</th>`).join('')}</tr></thead>`;
  const runRows=rows=>rows.map(r=>`<tr><td>${qiCaseName(r)}</td><td>${esc(r.environment)}</td><td class="num">${r.failures}</td><td class="num">${r.runs}</td><td>${badge(r.last_status)}</td><td class="muted small">${esc(qiWords(r.classification||''))}<div>${esc(r.message||'')}</div></td></tr>`).join('');
  const runHead=th([['Test case'],['Environment'],['Failed',1],['Runs',1],['Latest'],['Cause']]);
  const liteRows=rows=>rows.map(r=>`<tr><td>${qiCaseName(r)}</td><td>${esc(r.test_type)}</td><td>${esc(r.method||'—')}</td><td>${esc(r.severity||'—')}</td>${r.checks!=null?`<td class="num">${r.checks}</td><td class="num">${r.steps}</td>`:''}</tr>`).join('');
  let note='',body='',shown=0;
  if(q.tab==='never'){note=`No result on ${s.reference_environment?s.reference_environment.name:'any environment'} inside the window.`;shown=c.never_run.length;body=th([['Test case'],['Type'],['Method'],['Severity']])+`<tbody>${liteRows(c.never_run)}</tbody>`;}
  else if(q.tab==='shallow'){note='Cases whose definition states at most one check — usually a status code and nothing about the response.';shown=s.depth.shallow.length;body=th([['Test case'],['Type'],['Method'],['Severity'],['Checks',1],['Steps',1]])+`<tbody>${liteRows(s.depth.shallow)}</tbody>`;}
  else if(q.tab==='divergent'){note='The latest result differs between two live environments.';shown=c.divergent.length;body=th([['Test case'],['Latest result per environment']])+`<tbody>${c.divergent.map(r=>`<tr><td>${qiCaseName(r)}</td><td>${Object.entries(r.statuses).map(([k,v])=>`<span class="qi-pair"><span class="muted small">${esc(k)}</span> ${badge(v)}</span>`).join(' ')}</td></tr>`).join('')}</tbody>`;}
  else if(q.tab==='slowest'){note='Average duration across live environments.';shown=c.slowest.length;body=th([['Test case'],['Method'],['Average',1],['Longest',1],['Runs',1]])+`<tbody>${c.slowest.map(r=>`<tr><td>${qiCaseName(r)}</td><td>${esc(r.method||'—')}</td><td class="num">${esc(secs(r.avg_ms))}</td><td class="num">${esc(secs(r.max_ms))}</td><td class="num">${r.runs}</td></tr>`).join('')}</tbody>`;}
  else{
    const key=QI_TABS.find(t=>t[0]===q.tab)[2],rows=c[key]||[];shown=rows.length;
    note={failing:'Cases with the most failed results on live environments.',regressed:'Passed earlier in the window, failing now.',flaky:'Switched between pass and fail at least twice on one environment.',always:'Ran at least twice and never passed.'}[q.tab];
    body=runHead+`<tbody>${runRows(rows)}</tbody>`;
  }
  const more=total[q.tab]>shown?` · first ${shown} of ${total[q.tab]} shown`:'';
  return `<div class="card"><div class="card-head"><h2>Test cases that need attention</h2><span class="muted small">${plural(c.consistently_passing_total,'case')} passed every time over three or more runs</span></div>
    <div class="tabs qi-tabs">${tabs}</div><div class="toolbar"><span class="muted small">${esc(note)}${more}</span></div>
    ${shown?`<div class="table-wrap"><table>${body}</table></div>`:'<div class="empty">Nothing in this list.</div>'}</div>`;
}
function qiHistoryHtml(q){
  const rows=q.list.map(r=>{const k=r.kpis||{};return `<tr class="clickable${r.id===q.id?' row-running':''}" data-qi-act="open" data-id="${esc(r.id)}"><td><b>v${r.version}</b></td><td>${esc(when(r.created_at))}</td><td>${r.status==='ready'?qiChip(r.verdict):badge(r.status==='generating'?'running':'failed')}</td><td>${esc(r.analyst||'—')}${r.model?`<div class="key small">${esc(r.model)}</div>`:''}</td><td class="num">${k.score??'—'}</td><td class="num">${qiPct(k.pass_rate)}</td><td class="num">${k.coverage_pct!=null?k.coverage_pct+'%':'—'}</td><td class="num">${k.failing_cases??'—'}</td><td class="muted small">${esc(r.headline||r.error||'')}</td></tr>`;}).join('');
  return `<div class="card"><div class="card-head"><h2>Version history</h2><span class="muted small">every refresh adds a version; earlier ones stay readable</span></div><div class="table-wrap"><table><thead><tr><th>Version</th><th>Written</th><th>Verdict</th><th>Analyst</th><th class="num">Score</th><th class="num">Pass rate</th><th class="num">Coverage</th><th class="num">Failing</th><th>Headline</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function qiBodyHtml(q){
  const d=q.doc,s=d.snapshot,a=d.analysis,ids=qiCaseIds(s);
  const ref=s.environments.find(e=>s.reference_environment&&e.key===s.reference_environment.key)||null;
  const envName=k=>{const e=s.environments.find(x=>x.key===k);return e?e.name:k;};
  const prev=key=>d.previous&&d.previous.kpis&&d.previous.kpis[key]!=null?{version:d.previous.version,value:d.previous.kpis[key]}:null;
  const charts=q.charts={};
  let h='';

  if(d.status==='generating')h+=`<div class="card qi-pending"><div class="hp-body"><span class="pulse"></span> <b>Version ${d.version} is being written.</b> The facts below are already final; the review appears here when the analyst finishes${q.ai&&q.ai.available?' (usually one to three minutes)':''}.</div></div>`;
  if(d.status==='failed')h+=`<div class="card qi-notice"><div class="hp-body"><b>Version ${d.version} could not be written:</b> ${esc(d.error||'unknown error')}. The facts below were still recorded.</div></div>`;
  if(d.notice)h+=`<div class="card qi-notice"><div class="hp-body">${esc(d.notice)}</div></div>`;

  // Verdict + score
  h+=`<div class="qi-top"><div class="card qi-verdict"><div class="hp-body">${a?`<div class="qi-verdict-head">${qiChip(a.verdict)}<span class="muted small">Review of ${esc(s.application.name)}</span></div><h2 class="qi-headline">${esc(a.headline)}</h2>${qiParas(a.summary)}`:'<div class="hp-loading"><div class="skel" style="height:28px"></div><div class="skel" style="height:90px"></div></div>'}</div></div>
    <div class="card"><div class="hp-body">${qiScoreHtml(s)}</div></div></div>`;

  // Headline numbers, read from the reference environment
  const b=ref&&(ref.builds.find(x=>x.commit)||ref.deployed_build);
  h+='<div class="kpi-grid">'+
    qiKpi('Pass rate',qiPct(s.kpis.pass_rate),ref?'on '+esc(ref.name):'no results yet',s.kpis.pass_rate==null?'':s.kpis.pass_rate>=95?'green':s.kpis.pass_rate<70?'red':'',qiDelta(s.kpis.pass_rate,prev('pass_rate'),true,' pts'))+
    qiKpi('Coverage',s.kpis.coverage_pct+'%',`${ref?ref.cases_executed:0} of ${s.catalog.active} cases have run`,'',qiDelta(s.kpis.coverage_pct,prev('coverage_pct'),true,' pts'))+
    qiKpi('Failing cases',s.kpis.failing_cases,'latest result failed',s.kpis.failing_cases?'red':'',qiDelta(s.kpis.failing_cases,prev('failing_cases'),false))+
    qiKpi('Flaky cases',s.kpis.flaky_cases,'pass and fail on the same environment',s.kpis.flaky_cases?'amber':'',qiDelta(s.kpis.flaky_cases,prev('flaky_cases'),false))+
    qiKpi('Runs',s.totals.runs,`${s.totals.results} results · ${plural(s.cadence.days_with_runs,'active day')}`,'',qiDelta(s.kpis.runs,prev('runs'),true))+
    qiKpi('Build under test',b&&b.commit?`<span title="${esc(b.commit)}">${esc(qiShort(b.commit))}</span>`:'—',b&&b.commit?esc([b.ref,b.version].filter(Boolean).join(' · ')||'commit')+(ref?' on '+esc(ref.name):''):'no build hash recorded','sm')+
  '</div>';

  if(a&&a.changes_since_last&&a.changes_since_last.length)h+=`<div class="card"><div class="card-head"><h2>What changed since the last review</h2>${d.previous?`<span class="muted small">compared with version ${d.previous.version} · ${esc(when(d.previous.created_at))}</span>`:''}</div><div class="hp-body">${qiList(a.changes_since_last)}</div></div>`;

  // Activity
  const trend=s.trend.map(t=>({id:t.day,key:plural(t.runs,'run'),created_at:t.day+'T12:00:00Z',passed:t.passed,failed:t.failed,other:t.other,runs:t.runs}));
  const title=r=>qiDay(r.id)+' · '+r.key;
  charts.daily={type:'stacked',data:trend,opts:{title}};
  // Same definition as the Pass rate tile: passed ÷ (passed + failed); skipped and cancelled results are not verdicts.
  charts.rate={type:'rate',data:trend.map(t=>({...t,other:0})),opts:{title,noun:'verdicts passed'}};
  const auto=s.cadence.automated_runs,allRuns=auto+s.cadence.manual_runs;
  h+=`<div class="group-head"><h2>How testing is going</h2><span class="muted small">last ${s.window_days} days${s.retention_days?` · runs are kept for ${s.retention_days} days, so older ones are gone`:''} · all environments · days in ${esc(s.time_zone||'UTC')}</span></div>`;
  if(trend.length){
    h+=`<div class="hp-charts">${qiFigure('Results per day',null,'daily',[['passed','Passed','var(--viz-pass)'],['failed','Failed','var(--viz-fail)'],['other','Other (skipped, blocked, cancelled)','var(--viz-other)']],
        qiTable('days',`Daily table (${trend.length})`,[['Day'],['Runs',1],['Passed',1],['Failed',1],['Other',1],['Pass rate',1]],s.trend.slice().reverse().map(t=>`<tr><td>${esc(qiDay(t.day))}</td><td class="num">${t.runs}</td><td class="num">${t.passed}</td><td class="num">${t.failed}</td><td class="num">${t.other}</td><td class="num">${t.passed+t.failed?Math.round(t.passed/(t.passed+t.failed)*100)+'%':'—'}</td></tr>`)))}
      ${qiFigure('Pass rate per day','passed ÷ (passed + failed)','rate')}</div>`;
  }else h+='<div class="card empty">No runs in the window.</div>';
  h+=`<div class="hp-stats qi-activity">${stat('Active days, last 7',s.cadence.days_with_runs_last_7+' / 7','days with at least one run')}${stat('Started by automation',allRuns?Math.round(auto/allRuns*100)+'%':'—',`${auto} of ${allRuns} runs from a schedule, pipeline or API`)}${stat('Schedules enabled',s.cadence.schedules.enabled+' / '+s.cadence.schedules.total,'for this application')}${stat('Verdicts with evidence',s.evidence.verdicts?s.evidence.pct+'%':'—',`${s.evidence.with_evidence} of ${s.evidence.verdicts} pass/fail results`)}</div>`;

  // Environments
  const reviews=new Map(((a&&a.environments)||[]).map(e=>[e.key,e]));
  charts.envs={type:'hbars',data:s.environments.map(e=>({label:e.name+(e.status!=='active'?' (retired)':''),values:e.latest})),opts:{series:QI_STATUS_SERIES}};
  charts.causes={type:'hbars',data:s.failures.classes.map(c=>({label:qiWords(c.classification),values:{count:c.count}})),opts:{series:[['count','Non-passing results','var(--viz-fail)']]}};
  h+=`<div class="group-head"><h2>Environments</h2><span class="muted small">the same case can pass on one environment and fail on another — each is reviewed on its own</span></div>
    <div class="hp-charts qi-even">${qiFigure('Latest result of every case, by environment',null,'envs',QI_STATUS_SERIES)}
      ${s.failures.classes.length?qiFigure('What the failures are','non-passing results on live environments, by classification','causes'):'<figure class="viz"><figcaption><span>What the failures are</span></figcaption><div class="empty">No failures in the window.</div></figure>'}</div>
    <div class="qi-envs">${s.environments.map(e=>qiEnvCard(e,reviews.get(e.key),ref&&ref.key)).join('')}</div>`;

  // Findings
  if(a){
    h+=`<div class="card"><div class="card-head"><h2>Findings</h2><span class="muted small">${plural(a.findings.length,'finding')}, most severe first</span></div>${a.findings.length?`<ol class="qi-findings">${a.findings.map(f=>qiFindingHtml(f,ids,envName)).join('')}</ol>`:'<div class="empty">The review raised no findings.</div>'}</div>`;
    if(a.failure_themes.length)h+=`<div class="card"><div class="card-head"><h2>Nature of the failures</h2><span class="muted small">whether each group points at the product, the tests or the environment</span></div><div class="table-wrap"><table><thead><tr><th>Theme</th><th>Points at</th><th class="num">Results</th><th>What is happening</th></tr></thead><tbody>${a.failure_themes.map(t=>`<tr><td><b>${esc(t.title)}</b>${qiCaseKeys(t.case_keys,ids)}</td><td><span class="tag">${esc(QI_NATURE[t.nature]||t.nature)}</span></td><td class="num">${t.count}</td><td>${esc(t.detail)}</td></tr>`).join('')}</tbody></table></div>
      ${qiTable('signatures',`Recurring failure messages (${s.failures.signatures.length})`,[['Message'],['Classification'],['Results',1],['Cases',1],['Environments']],s.failures.signatures.map(x=>`<tr><td class="key">${esc(x.signature)}</td><td>${esc(qiWords(x.classification))}</td><td class="num">${x.count}</td><td class="num">${x.cases}</td><td class="muted small">${esc(x.environments.join(', '))}</td></tr>`))}</div>`;
  }

  // Coverage and depth
  const types=s.coverage_by_type.slice(0,8),rest=s.coverage_by_type.slice(8);
  if(rest.length)types.push(rest.reduce((t,r)=>({type:`${rest.length} other types`,total:t.total+r.total,passing:t.passing+r.passing,failing:t.failing+r.failing,other:t.other+r.other,never_run:t.never_run+r.never_run}),{total:0,passing:0,failing:0,other:0,never_run:0}));
  charts.types={type:'hbars',data:types.map(t=>({label:qiWords(t.type),values:t})),opts:{series:QI_STATUS_SERIES}};
  charts.depth={type:'hbars',data:s.depth.buckets.map(x=>({label:x.label,values:{count:x.count}})),opts:{series:[['count','Test cases','var(--viz-rate)']]}};
  h+=`<div class="group-head"><h2>Coverage and test depth</h2><span class="muted small">${s.catalog.active} active cases${s.catalog.suites?` in ${plural(s.catalog.suites,'suite')}`:''} · ${s.catalog.with_description_pct}% described · ${s.catalog.with_expected_results_pct}% state expected results</span></div>
    <div class="hp-charts qi-even">${qiFigure('Coverage by test type',ref?'latest result on '+ref.name:null,'types',QI_STATUS_SERIES,
        qiTable('types',`Table by test type (${s.coverage_by_type.length})`,[['Type'],['Cases',1],['Passing',1],['Failing',1],['Other',1],['Never run',1]],s.coverage_by_type.map(t=>`<tr><td>${esc(qiWords(t.type))}</td><td class="num">${t.total}</td><td class="num">${t.passing}</td><td class="num">${t.failing}</td><td class="num">${t.other}</td><td class="num">${t.never_run}</td></tr>`)))}
      ${qiFigure('Checks stated per test case',`average ${s.depth.avg_checks} across ${s.depth.inspectable} step-defined cases`,'depth')}</div>`;
  if(a)h+=`<div class="qi-two"><div class="card"><div class="card-head"><h2>Are the tests testing enough?</h2></div><div class="hp-body">${qiParas(a.test_quality.assessment)}${a.test_quality.strengths.length?`<div class="dlg-h">Strengths</div>${qiList(a.test_quality.strengths)}`:''}${a.test_quality.weaknesses.length?`<div class="dlg-h">Weaknesses</div>${qiList(a.test_quality.weaknesses)}`:''}</div></div>
    <div class="card"><div class="card-head"><h2>Coverage</h2></div><div class="hp-body">${qiParas(a.coverage.assessment)}${a.coverage.gaps.length?`<div class="dlg-h">Gaps</div>${qiList(a.coverage.gaps)}`:''}</div></div></div>`;

  h+=qiCaseTabs(s,q);

  // Suggestions
  if(a&&a.suggestions.length){
    const groups=[['now','Do now'],['next','Do next'],['later','Later']].map(([p,label])=>{const items=a.suggestions.filter(x=>x.priority===p);return items.length?`<div class="dlg-h">${label}</div><ol class="qi-suggest">${items.map(x=>`<li><b>${esc(x.title)}</b> <span class="tag" title="Effort">effort ${esc(x.effort)}</span><p>${esc(x.detail)}</p>${x.impact?`<p class="muted small">Impact: ${esc(x.impact)}</p>`:''}</li>`).join('')}</ol>`:'';}).join('');
    h+=`<div class="card"><div class="card-head"><h2>Suggested improvements</h2><span class="muted small">${plural(a.suggestions.length,'suggestion')}, most valuable first</span></div><div class="hp-body">${groups}</div></div>`;
  }
  return h;
}

function qiHtml(q){
  const appName=(state.applications.find(x=>x.key===state.appKey)||{}).name||state.appKey||'application';
  if(q.list===null)return skeletonHtml();
  const d=q.doc,pending=q.busy||q.list.some(r=>r.status==='generating');
  const analystNote=q.ai?(q.ai.available?`Refresh asks Claude (${esc(q.ai.model)}) to review the latest runs.`:'No AI key is configured on the engine — a refresh is written by the built-in rules. Set ANTHROPIC_API_KEY to have Claude write it.'):'';
  const refresh=`<button class="btn primary" data-qi-act="refresh"${pending?' disabled':''}>${pending?'Refreshing…':q.list.length?'↻ Refresh insights':'Generate insights'}</button>`;
  if(!q.list.length)return `${q.error?`<div class="card empty">Could not load insights: ${esc(q.error)} <button class="btn" data-qi-act="reload">Retry</button></div>`:''}<div class="card empty"><p><b>No insights yet for ${esc(appName)}.</b></p><p>A review covers pass rates, coverage, failure causes, test depth and every environment the application runs on, and is stored as a version you can come back to.</p><p>${refresh}</p><p class="muted small">${analystNote}</p></div>`;
  const versions=q.list.map(r=>`<option value="${esc(r.id)}"${r.id===q.id?' selected':''}>v${r.version} · ${esc(when(r.created_at))}${r.status!=='ready'?' · '+(r.status==='generating'?'writing…':'failed'):''}</option>`).join('');
  const meta=d?`Version ${d.version} · ${d.status==='ready'?'written':'started'} ${esc(when(d.completed_at||d.created_at))}${d.analyst?' by '+esc(d.analyst):''}${d.model?' ('+esc(d.model)+')':''}${d.requested_by&&d.requested_by!=='anonymous'?' · requested by '+esc(d.requested_by):''}${d.snapshot&&d.snapshot.reference_environment?' · reference environment: '+esc(d.snapshot.reference_environment.name):''}`:'';
  return `<div class="group-head first"><div><h2>${esc(appName)} · quality review</h2><div class="muted small">${meta}</div></div>
      <div class="hp-actions"><label class="sr-only" for="qiVersion">Version</label><select id="qiVersion" aria-label="Insight version">${versions}</select>${refresh}</div></div>
    ${q.error?`<div class="card qi-notice"><div class="hp-body">Could not load: ${esc(q.error)} <button class="btn" data-qi-act="reload">Retry</button></div></div>`:''}
    ${d&&d.snapshot?qiBodyHtml(q):'<div class="hp-loading"><div class="skel" style="height:160px"></div><div class="skel" style="height:220px"></div></div>'}
    ${qiHistoryHtml(q)}
    <p class="muted small">${analystNote} Insights describe the whole application; the Env selector above does not filter them.</p>`;
}

// ---------------------------------------------------------------------------
// Render + wiring
// ---------------------------------------------------------------------------
function qiDraw(){
  const q=qiState();
  document.querySelectorAll('#content [data-qichart]').forEach(host=>{const c=q.charts[host.dataset.qichart];if(c&&c.data.length)Charts[c.type](host,c.data,c.opts);});
}
function renderInsightsView(){
  el('viewTitle').textContent='Quality insights';
  if(!state.appKey){el('content').innerHTML=skeletonHtml();return;}   // first paint, before the application list arrives
  const q=qiState();
  if(q.app!==state.appKey){clearTimeout(q.timer);Object.assign(q,{app:state.appKey,list:null,ai:null,id:null,doc:null,error:null,busy:false,loading:false});}
  if(q.list===null&&!q.loading)qiLoad();
  // The console re-renders the current view on every live poll; this view only changes when its own data does.
  const sig=JSON.stringify([q.app,q.id,q.doc&&[q.doc.id,q.doc.status],q.list&&q.list.map(r=>[r.id,r.status]),q.busy,q.error,q.tab,q.ai,state.applications.length,(state.cases||[]).length]);
  const host=el('content'),cur=host.firstElementChild;
  if(cur&&cur.dataset.qi===sig)return;
  const wrap=document.createElement('div');
  wrap.dataset.qi=sig;wrap.innerHTML=qiHtml(q);
  host.replaceChildren(wrap);
  qiDraw();
}
(function(){
  const host=document.getElementById('content');
  host.addEventListener('click',e=>{
    const n=e.target.closest('[data-qi-act]');if(!n||n.disabled)return;
    const act=n.dataset.qiAct,q=qiState();
    if(act==='refresh')qiRefresh();
    else if(act==='reload'){q.list=null;q.error=null;renderInsightsView();}
    else if(act==='tab'){q.tab=n.dataset.tab;renderInsightsView();}
    else if(act==='open'&&!e.target.closest('button'))qiOpen(n.dataset.id);
  });
  host.addEventListener('change',e=>{if(e.target.id==='qiVersion')qiOpen(e.target.value);});
  let t;window.addEventListener('resize',()=>{clearTimeout(t);t=setTimeout(()=>{if(state.view==='insights')qiDraw();},150);});
  window.addEventListener('hashchange',()=>{if(/^#\/insights/.test(location.hash)){const q=qiState();if(q.list!==null&&!q.loading)qiLoad(true);}});
})();
