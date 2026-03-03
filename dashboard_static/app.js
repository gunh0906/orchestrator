let cfg=null,hist={},timer=null,pmState=null,popupTemplateCache=null;
const POPUP_TEMPLATE_URL='/static/popup.html';
const DEFAULT_MODEL='gpt-5.3-codex';
const DEFAULT_REASON='xhigh';
const POPUP_TEMPLATE_FALLBACK=`<!doctype html><html><head><meta charset="utf-8"><title>__TITLE__</title>
<style>body{margin:0;font-family:'Segoe UI','Noto Sans KR',sans-serif;background:#f1f5f9;color:#0f172a}
.top{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:rgba(255,255,255,0.95);backdrop-filter:blur(8px);border-bottom:1px solid #e2e8f0;color:#0f172a}
.top div:first-child{font-weight:700;font-size:14px}
.btn{height:32px;border:none;border-radius:8px;padding:0 14px;background:#2d4b9b;color:#fff;font-weight:600;cursor:pointer}
.btn:hover{filter:brightness(1.1)}
#txt{width:100%;height:calc(100vh - 48px);box-sizing:border-box;border:0;outline:none;padding:16px;font-family:Consolas,'Courier New',monospace;font-size:12.5px;background:#ffffff;color:#0f172a;white-space:pre;resize:none}</style>
</head><body><div class="top"><div>__TITLE__</div><div><button class="btn" id="copyBtn">Copy</button></div></div>
<textarea id="txt" readonly>__TEXT__</textarea>
<script>document.getElementById('copyBtn').onclick=async()=>{const v=document.getElementById('txt').value;try{await navigator.clipboard.writeText(v);}catch(e){document.getElementById('txt').select();document.execCommand('copy');}};</script>
</body></html>`;
const METHOD_ROLE_MAP={connection:'Core/Connection',ui:'UI/Design',runtime:'Backend/Runtime',diagnostics:'Diagnostics/Search',auth:'Auth/Login',validate:'Validation/QA',integration:'Integration',custom:'Custom'};
const suggestRoleByMethod=(m)=>METHOD_ROLE_MAP[String(m||'').trim().toLowerCase()]||'Worker';
function methodOptions(selected){
  const cur=String(selected||'').trim().toLowerCase();
  const items=['connection','ui','runtime','diagnostics','auth','validate','integration','custom'];
  return items.map(v=>`<option value='${v}' ${cur===v?'selected':''}>${v}</option>`).join('');
}
const q=(s)=>{try{return document.querySelector(s)}catch(e){return null}};
const qa=(s)=>{try{return[...document.querySelectorAll(s)]}catch(e){return[]}};
function setText(sel,text){const el=q(sel);if(el)el.textContent=String(text??'');}
function setVal(sel,val){const el=q(sel);if(el)el.value=String(val??'');}
function getVal(sel,def=''){const el=q(sel);return el?el.value:def;}

async function api(u,o={}){
  const hasQ = u.includes('?');
  const url = `${u}${hasQ?'&':'?'}_ts=${Date.now()}`;
  const opts = Object.assign({cache:'no-store'}, o||{});
  const r = await fetch(url, opts);
  return await r.json();
}
const esc=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function push(task,cpu,mem){if(!hist[task])hist[task]={cpu:[],mem:[]};hist[task].cpu.push(Number(cpu||0));hist[task].mem.push(Number(mem||0));while(hist[task].cpu.length>40)hist[task].cpu.shift();while(hist[task].mem.length>40)hist[task].mem.shift();}
function spark(task){
  const h=hist[task]||{cpu:[],mem:[]}; const c=h.cpu||[]; const m=h.mem||[];
  if(c.length<2&&m.length<2)return `<svg class='spark' viewBox='0 0 120 22'><line x1='0' y1='18' x2='120' y2='18' stroke='#cbd8f2'/></svg>`;
  const n=Math.max(c.length,m.length), st=120/Math.max(1,n-1);
  const maxv = Math.max(1, ...c.map(v=>Number(v||0)), ...m.map(v=>Number(v||0)));
  const y=(v)=>`${(18-Math.max(0,Math.min(16,(Number(v||0)/maxv)*16))).toFixed(1)}`;
  const pc=c.map((v,i)=>`${(i*st).toFixed(1)},${y(v)}`).join(' ');
  const pm=m.map((v,i)=>`${(i*st).toFixed(1)},${y(v)}`).join(' ');
  return `<svg class='spark' viewBox='0 0 120 22'>
    <polyline fill='none' stroke='#2b67dc' stroke-width='1.4' points='${pc}'/>
    <polyline fill='none' stroke='#19a68a' stroke-width='1.4' points='${pm}'/>
    <line x1='0' y1='18' x2='120' y2='18' stroke='#cbd8f2'/>
  </svg>`;
}
function bar(cls,val){const v=Math.max(0,Math.min(100,Number(val)||0));return `<div class='bar ${cls}'><span style='width:${v}%'></span></div>`;}
function formatTokens(n){
  if(n==null)return'-';
  const num=Number(n);
  if(num>=1000000)return(num/1000000).toFixed(1)+'M';
  if(num>=1000)return(num/1000).toFixed(1)+'K';
  return num.toLocaleString();
}
function _htmlSafe(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function _renderPopupHtml(safeTitle,safeText,tpl){
  const template = tpl || POPUP_TEMPLATE_FALLBACK;
  return template.replaceAll('__TITLE__', safeTitle).replaceAll('__TEXT__', safeText);
}
function openViewer(title,text){
  const t = String(text ?? '');
  const win = window.open('', '_blank', 'width=1120,height=820,resizable=yes,scrollbars=yes');
  if(!win){ setLogText('Popup blocked. Allow popups to view logs.'); return; }
  const safeTitle = _htmlSafe(title || 'View');
  const safeText = _htmlSafe(t);
  const writePopup = (tpl)=>{
    const html = _renderPopupHtml(safeTitle, safeText, tpl);
    win.document.open();
    win.document.write(html);
    win.document.close();
  };
  if(popupTemplateCache !== null){
    writePopup(popupTemplateCache);
    return;
  }
  fetch(`${POPUP_TEMPLATE_URL}?_ts=${Date.now()}`, {cache:'no-store'})
    .then((r)=>r.ok ? r.text() : Promise.reject(new Error(`popup template ${r.status}`)))
    .then((tpl)=>{popupTemplateCache=tpl;writePopup(tpl);})
    .catch(()=>{popupTemplateCache='';writePopup('');});
}
function closeViewer(){ return; }
function setDocsText(t){ setLogText(String(t||'')); }
function setLogText(t){
  const el=q('#msg');
  if(!el) return;
  el.textContent=String(t||'');
}
function renderRoleSummary(items){}

async function refreshTools(){}
async function refreshPm(){
  const d=await api('/api/pm');
  if(!d||!d.ok)return;
  pmState=d;
  setText('#pmName',d.pm_name||'Codex-PM');
  setText('#pmLast',d.last_update||'-');
  setText('#pmProg',`${Number(d.progress||0).toFixed(1)}%`);
}
async function savePmName(){}
async function refreshRuns(){
  const orch=getVal('#orch','AGENT').trim().toUpperCase();
  let d=await api('/api/runs'+(orch?`?orch=${encodeURIComponent(orch)}`:''));
  if((!d.runs||!d.runs.length) && orch){
    d=await api('/api/runs');
    const first=(d.runs||[])[0];
    if(first && first.orch_id){ setVal('#orch',first.orch_id); }
  }
  const s=q('#run'),cur=s?s.value:'';
  if(!s)return;
  s.innerHTML='';
  (d.runs||[]).forEach(r=>{
    const o=document.createElement('option');
    o.value=r.name;
    o.textContent=`${r.name} (${r.running}/${r.total})`;
    s.appendChild(o);
  });
  if(cur&&qa('#run option').some(x=>x.value===cur)) s.value=cur;
  else if(d.latest) s.value=d.latest;
}

function mkWorker(i,engine='codex'){
  const orch=getVal('#orch','AGENT').trim().toUpperCase();
  const work_method=engine==='claude-cli'?'ui':'connection';
  return {task_id:`${orch}-T${i+1}`,enabled:true,engine:engine,owner:engine==='claude-cli'?'Claude':`Codex-${String.fromCharCode(65+i)}`,role:suggestRoleByMethod(work_method),work_method,repo:'orchestrator',scope_paths:['orchestrator/dashboard.py'],goal:'',done_when:[],prompt_file:`orchestrator/runner/prompts/${orch}-T${i+1}.md`};
}
function ensureCfg(){
  if(cfg) return;
  cfg={orch_id:getVal('#orch','AGENT').trim().toUpperCase(),workspace:'d:\\Development',defaults:{model:DEFAULT_MODEL,reasoning_effort:DEFAULT_REASON,global_prompt:'',sandbox:'workspace-write',approval:'never',search:false,read_only_guard:true,history_readonly_guard:true,single_run_dir:true,clean_run_dir:true,prune_legacy_runs:true,claude_cmd:'claude',claude_continue:true,claude_args:['--print','{prompt}'],claude_stdin:false},workers:[]};
}
function renderCfg(){
  ensureCfg();
  const box=q('#cfg');
  if(!box)return;
  const rows=(cfg.workers||[]).map((w,idx)=>`<div class='cfr'><div>${idx+1}</div><input type='checkbox' data-k='enabled' data-i='${idx}' ${w.enabled!==false?'checked':''}><input data-k='task_id' data-i='${idx}' value='${esc(w.task_id||'')}'><input data-k='owner' data-i='${idx}' value='${esc(w.owner||'')}'><input data-k='role' data-i='${idx}' value='${esc(w.role||'')}'><select data-k='engine' data-i='${idx}'><option value='codex' ${w.engine==='codex'?'selected':''}>codex</option><option value='gemini' ${w.engine==='gemini'?'selected':''}>gemini</option><option value='claude-cli' ${w.engine==='claude-cli'?'selected':''}>claude-cli</option><option value='claude-manual' ${w.engine==='claude-manual'?'selected':''}>claude-manual</option><option value='manual' ${w.engine==='manual'?'selected':''}>manual</option></select><select data-k='work_method' data-i='${idx}'>${methodOptions(w.work_method||'')}</select><input data-k='repo' data-i='${idx}' value='${esc(w.repo||'')}'><input data-k='prompt_file' data-i='${idx}' value='${esc(w.prompt_file||'')}'><button onclick='removeAt(${idx})'>Del</button></div>`).join('');
  box.innerHTML=`<div class='cfr head'><div>#</div><div>on</div><div>task_id</div><div>owner</div><div>role</div><div>engine</div><div>method</div><div>repo</div><div>prompt_file</div><div>act</div></div>${rows || "<div style='padding:10px;color:var(--text-mute)'>no workers</div>"}`;
  box.querySelectorAll('input[data-k],select[data-k]').forEach(el=>{
    el.addEventListener('change', async ()=>{
      const i=Number(el.getAttribute('data-i')||0),k=el.getAttribute('data-k');
      if(!cfg?.workers?.[i]||!k) return;
      if(k==='enabled'){
        cfg.workers[i][k]=el.checked;
        await saveCfg(true);
      } else if(k==='work_method'){
        cfg.workers[i][k]=el.value;
        cfg.workers[i]['role']=suggestRoleByMethod(el.value);
        renderCfg();
      } else {
        cfg.workers[i][k]=el.value;
      }
    });
  });
}
function renumberTaskIds(){if(!cfg?.workers) return; const orch=getVal('#orch',cfg.orch_id||'AGENT').trim().toUpperCase(); cfg.workers.forEach((w,i)=>{w.task_id=`${orch}-T${i+1}`;});}
function removeAt(i){if(!cfg?.workers) return; cfg.workers.splice(i,1); renumberTaskIds(); renderCfg();}
function addW(engine='codex'){ensureCfg(); if((cfg.workers||[]).length>=10) return; cfg.workers.push(mkWorker(cfg.workers.length,engine)); renumberTaskIds(); renderCfg();}
function delW(){if(!cfg?.workers?.length) return; cfg.workers.pop(); renumberTaskIds(); renderCfg();}
function autoWorkers(n){
  ensureCfg();
  const m=Math.max(1,Math.min(10,Number(n)||10));
  cfg.workers=[];
  for(let i=0;i<m;i++){cfg.workers.push(mkWorker(i, i===1?'claude-cli':'codex'));}
  renumberTaskIds();
  renderCfg();
}
function applyWorkerCount(){ensureCfg(); const n=Math.max(1,Math.min(10,Number(getVal('#wcnt',cfg.workers.length||1)))); while(cfg.workers.length<n){cfg.workers.push(mkWorker(cfg.workers.length,'codex'));} while(cfg.workers.length>n){cfg.workers.pop();} renumberTaskIds(); renderCfg();}
function enableAll(v){ensureCfg(); cfg.workers.forEach(w=>w.enabled=!!v); renderCfg();}
function autoAssignRoles(){ensureCfg(); cfg.workers.forEach(w=>{const m=w.work_method||(String(w.engine||'').toLowerCase()==='claude-cli'?'ui':'connection'); w.work_method=m; w.role=suggestRoleByMethod(m);}); renderCfg();}
function setPmDefaultsFromWorkers(){ensureCfg(); if(!cfg.defaults) cfg.defaults={}; cfg.defaults.pm_last_selected=cfg.workers.filter(w=>w.enabled!==false).map(w=>w.task_id); cfg.defaults.pm_last_request='';}
function collectEnabledRoles(){ensureCfg(); const counts={}; cfg.workers.filter(w=>w.enabled!==false).forEach(w=>{const k=String(w.role||'Worker'); counts[k]=(counts[k]||0)+1;}); return Object.entries(counts).map(([k,v])=>`${k}:${v}`).join(', ');}

async function loadCfg(){
  const orch=getVal('#orch','AGENT').trim().toUpperCase();
  const d=await api(`/api/config/${encodeURIComponent(orch)}`);
  if(!d.ok){setLogText(`load config failed: ${d.error||''}`); return;}
  cfg=d.config||{};
  setVal('#orch',cfg.orch_id||orch);
  if(!cfg.defaults) cfg.defaults={};
  if(!Array.isArray(cfg.workers)) cfg.workers=[];
  renderCfg();
}

async function saveCfg(silent=false){
  ensureCfg();
  cfg.orch_id=getVal('#orch',cfg.orch_id||'AGENT').trim().toUpperCase();
  if(!cfg.defaults) cfg.defaults={};
  cfg.defaults.model=DEFAULT_MODEL;
  cfg.defaults.reasoning_effort=DEFAULT_REASON;
  cfg.defaults.global_prompt=cfg.defaults.global_prompt||'';
  cfg.defaults.read_only_guard = cfg.defaults.read_only_guard !== false;
  cfg.defaults.history_readonly_guard = cfg.defaults.history_readonly_guard !== false;
  cfg.defaults.claude_cmd=cfg.defaults.claude_cmd||'claude';
  cfg.defaults.claude_continue = cfg.defaults.claude_continue !== false;
  cfg.defaults.claude_args=Array.isArray(cfg.defaults.claude_args)?cfg.defaults.claude_args:['--print','{prompt}'];
  setPmDefaultsFromWorkers();
  const d=await api('/api/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orch_id:cfg.orch_id,config:cfg})});
  if(!silent) setLogText(d.ok?`saved: ${d.path}`:`save failed: ${d.error||''}`);
  return !!d.ok;
}

function renderWorkers(arr){
  const body=q('#wb');
  if(!body)return;
  const pmRows = pmState ? [{
    task_id: `${String(pmState.orch||'AGENT')}-PM`,
    owner: String(pmState.pm_name||'Codex-PM'),
    role: 'PM/Orchestrator',
    engine: 'pm',
    pid: Number(pmState.pid||0) || '-',
    state: ((arr||[]).some(x=>String(x.state||'').toUpperCase()==='RUNNING') ? 'RUNNING' : 'IDLE'),
    metrics: pmState.metrics || {cpu_percent:0,rss_mb:0},
    progress: Number(pmState.progress||0),
    tokens: {total: null},
    activity: `progress_source=${String(pmState.progress_source||'master_tasks')}`,
    docs_count: 1,
    _pm: true,
  }] : [];
  const rows = [...pmRows, ...(arr||[])];
  body.innerHTML=rows.map(w=>{
    const cpu=Number(w.metrics?.cpu_percent||0), mem=Number(w.metrics?.rss_mb||0), prog=Number(w.progress||0);
    const state=String(w.state||'').toUpperCase();
    const stClass = (state==='RUNNING' || state==='DONE') ? 'ok' : ((state==='EXITED' || state==='BLOCKED') ? 'warn' : 'bad');
    const stBg = (state==='RUNNING'||state==='DONE') ? 'background:#ecfdf5' : ((state==='EXITED'||state==='BLOCKED') ? 'background:#fefce8' : (state==='ERROR'?'background:#fef2f2':''));
    const stHint = w.state_hint ? `<div style='font-size:11px;color:var(--text-mute)'>${esc(w.state_hint)}</div>` : '';
    const cpuCell = `${bar('cpu',cpu)}<div>${cpu.toFixed(1)}%</div>`;
    const memCell = `${bar('mem',Math.min(100,mem/20))}<div>${mem.toFixed(1)}MB</div>`;
    const tokTotal = w.tokens && w.tokens.total != null ? Number(w.tokens.total) : null;
    const tokenCell = formatTokens(tokTotal);
    const logBtn = w._pm
      ? `<button onclick='viewPmLog()'>View</button>`
      : `<button onclick='viewLog("${esc(w.task_id)}")'>View</button>`;
    const docsBtn = w._pm
      ? `<button onclick='viewPmDocs()'>1</button>`
      : `<button onclick='viewDocs("${esc(w.task_id)}")'>${Number(w.docs_count||0)}</button>`;
    return `<tr><td>${esc(w.task_id)}</td><td>${esc(w.owner)}</td><td>${esc(w.role)}</td><td>${esc(w.engine)}</td><td>${w.pid??''}</td><td class='${stClass}' style='${stBg}'>${esc(state || '-')}</td><td>${cpuCell}</td><td>${memCell}</td><td>${bar('prog',prog)}<div style='font-size:14px;font-weight:700'>${prog.toFixed(1)}%</div></td><td>${tokenCell}</td><td><div class='activity' title='${esc(w.activity||'')}'>${esc(w.activity||'-')}</div></td><td>${logBtn}${stHint}</td><td>${docsBtn}</td></tr>`;
  }).join('');
}
function renderManual(arr){}

async function loadRun(){
  const runEl=q('#run');
  if(!runEl||!runEl.value)return;
  const run=runEl.value;
  const d=await api(`/api/run/${encodeURIComponent(run)}/status`);
  if(!d.ok){setLogText(`status failed: ${d.error||''}`);return;}
  const s=d.summary||{};
  setText('#m1',String(s.running||0));
  setText('#m2',String(s.total||0));
  setText('#m5',formatTokens(s.tokens_total||0));
  renderWorkers(d.workers||[]);
}

async function viewLog(task){
  const runEl=q('#run');
  if(!runEl||!runEl.value||!task) return;
  const run=runEl.value;
  const d=await api(`/api/run/${encodeURIComponent(run)}/log/${encodeURIComponent(task)}?tail=240`);
  if(!d.ok){setLogText(`log failed: ${d.error||''}`);return;}
  setLogText(`${task} log opened`);
  openViewer(`${task} log`, d.text||'');
}
async function viewDocs(task){
  const runEl=q('#run');
  if(!runEl||!runEl.value||!task) return;
  const run=runEl.value;
  const d=await api(`/api/run/${encodeURIComponent(run)}/documents?task=${encodeURIComponent(task)}`);
  if(!d.ok){setLogText(`docs failed: ${d.error||''}`);return;}
  const t=(d.tasks||[])[0];
  const docs=t?.documents||[];
  if(!docs.length){openViewer(`${task} docs`, "(no docs)");return;}
  const lines = docs.map(x=>`${x.kind}\t${x.path}\t${x.size}\t${x.mtime}`).join('\n');
  setLogText(`${task} docs opened (${docs.length})`);
  openViewer(`${task} docs`, lines);
}
async function viewPmLog(){
  const d=await api('/api/read?path='+encodeURIComponent('orchestrator/status_report.md'));
  if(!d.ok){setLogText(`read failed: ${d.error||''}`);return;}
  setLogText('PM status_report opened');
  openViewer('PM Status Report', d.text||'');
}
async function viewPmDocs(){
  const docs=[
    'orchestrator/master_tasks.md',
    'orchestrator/integration.md',
    'orchestrator/inbox.md',
    'orchestrator/results.md',
    'orchestrator/status_report.md',
  ];
  setLogText('PM docs list opened');
  openViewer('PM docs', docs.join('\n'));
}
async function viewPath(path){
  const d=await api(`/api/read?path=${encodeURIComponent(path)}`);
  if(!d.ok){openViewer('read failed', d.error||'');return;}
  openViewer(d.path||'file', d.text||'');
}

async function startRun(dry=false){
  const ok=await saveCfg(true);
  if(!ok){setLogText('start blocked: config save failed');return;}
  const orch=getVal('#orch','AGENT').trim().toUpperCase();
  const maxW=Math.max(1,Math.min(10,cfg?.workers?.length||1));
  const d=await api('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orch_id:orch,model:DEFAULT_MODEL,reasoning_effort:DEFAULT_REASON,pm_request:'',pm_delegate:true,min_workers:1,max_workers:maxW,dry_run:!!dry})});
  setLogText((d.stdout||'') + (d.stderr?`\n${d.stderr}`:''));
  await refreshRuns();
  await loadRun();
}
async function distributeAndStart(){await startRun(false);}
async function stopRun(){
  const runEl=q('#run');
  if(!runEl||!runEl.value)return;
  const run=runEl.value;
  const d=await api('/api/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run_name:run})});
  setLogText((d.stdout||'') + (d.stderr?`\n${d.stderr}`:''));
  await refreshRuns();
  await loadRun();
}

function setAuto(){
  if(timer){clearInterval(timer);timer=null;}
  timer=setInterval(()=>refreshAll(), 3000);
}
async function refreshAll(){
  const jobs = [refreshPm(), refreshRuns()];
  await Promise.all(jobs.map(p => p.catch(()=>{})));
  if(!cfg) await loadCfg();
  await loadRun();
}

window.addEventListener('keydown',(e)=>{if(e.key==='Escape')closeViewer();});
window.addEventListener('load',async()=>{await refreshAll();setAuto();});
