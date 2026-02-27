
let cfg=null,hist={},timer=null,pmState=null;
const q=(s)=>document.querySelector(s),qa=(s)=>[...document.querySelectorAll(s)];
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
function _htmlSafe(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function openViewer(title,text){
  const t = String(text ?? '');
  const win = window.open('', '_blank', 'width=1120,height=820,resizable=yes,scrollbars=yes');
  if(!win){ setLogText('Popup blocked. Allow popups to view logs.'); return; }
  const safeTitle = _htmlSafe(title || 'View');
  const safeText = _htmlSafe(t);
  const popupScript = "<scr"+"ipt>document.getElementById('copyBtn').onclick=async()=>{const v=document.getElementById('txt').value;try{await navigator.clipboard.writeText(v);}catch(e){document.getElementById('txt').select();document.execCommand('copy');}};</scr"+"ipt>";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
  <style>body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#eef3fb;color:#10274f}
  .top{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:#3152a9;color:#fff}
  .btn{height:30px;border:1px solid #b6c7e4;border-radius:8px;padding:0 10px;background:#fff;color:#10274f;font-weight:700;cursor:pointer}
  #txt{width:100%;height:calc(100vh - 48px);box-sizing:border-box;border:0;outline:none;padding:12px;font-family:Consolas,'Courier New',monospace;font-size:12px;background:#f7faff;color:#183059;white-space:pre}</style>
  </head><body><div class="top"><div>${safeTitle}</div><div><button class="btn" id="copyBtn">Copy</button></div></div>
  <textarea id="txt" readonly>${safeText}</textarea>
  ${popupScript}
  </body></html>`;
  win.document.open(); win.document.write(html); win.document.close();
}
function closeViewer(){ return; }
function setDocsText(t){ setLogText(String(t||'')); }
function setLogText(t){
  const el=q('#msg');
  if(!el) return;
  el.textContent=String(t||'');
}
function renderRoleSummary(items){if(!items||!items.length){q('#roleStats').textContent='';return;}q('#roleStats').innerHTML=items.map(x=>`<span class='role-pill'>${esc(x.role)}: ${Number(x.progress||0).toFixed(1)}% (${Number(x.workers||0)})</span>`).join(' ');}

async function refreshTools(){const d=await api('/api/tools');q('#toolCodex').textContent=`codex:${d.codex?'OK':'MISS'}`;q('#toolClaude').textContent=`claude:${d.claude?d.claude_cmd:'MISS'}`;}
async function refreshPm(){
  const d=await api('/api/pm');
  if(!d||!d.ok)return;
  pmState=d;
  q('#pmName').textContent=d.pm_name||'Codex-PM';
  q('#pmNameIn').value=d.pm_name||'Codex-PM';
  q('#pmLast').textContent=d.last_update||'-';
  q('#pmProg').textContent=`${Number(d.progress||0).toFixed(1)}%`;
}
async function savePmName(){const name=(q('#pmNameIn').value||'').trim();if(!name){setLogText('pm name is empty');return;}const d=await api('/api/pm/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pm_name:name})});setLogText(d.ok?`pm saved: ${name}`:`pm save failed: ${d.error||''}`);await refreshPm();}
async function refreshRuns(){
  const orch=(q('#orch').value||'').trim().toUpperCase();
  let d=await api('/api/runs'+(orch?`?orch=${encodeURIComponent(orch)}`:''));
  if((!d.runs||!d.runs.length) && orch){
    d=await api('/api/runs');
    const first=(d.runs||[])[0];
    if(first && first.orch_id){ q('#orch').value=first.orch_id; }
  }
  const s=q('#run'),cur=s.value;
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
  const orch=(q('#orch').value||'AGENT').trim().toUpperCase();
  return {task_id:`${orch}-T${i+1}`,enabled:true,engine:engine,owner:engine==='claude-cli'?'Claude':`Codex-${String.fromCharCode(65+i)}`,role:engine==='claude-cli'?'UI/Relay':'Worker',repo:'orchestrator',scope_paths:['orchestrator/dashboard.py'],goal:'',done_when:[],prompt_file:`orchestrator/runner/prompts/${orch}-T${i+1}.md`};
}
function ensureCfg(){
  if(cfg) return;
  cfg={orch_id:(q('#orch').value||'AGENT').trim().toUpperCase(),workspace:'d:\\Development',defaults:{model:q('#model').value||'gpt-5.3-codex',reasoning_effort:q('#reason').value||'xhigh',global_prompt:(q('#globalPrompt').value||''),sandbox:'workspace-write',approval:'never',search:false,read_only_guard:true,history_readonly_guard:true,single_run_dir:true,clean_run_dir:true,prune_legacy_runs:true,claude_cmd:'claude',claude_continue:true,claude_args:['--print','{prompt}'],claude_stdin:false},workers:[]};
}
function renderCfg(){
  ensureCfg();
  const box=q('#cfg');
  const rows=(cfg.workers||[]).map((w,idx)=>`<div class='cfr'><div>${idx+1}</div><input type='checkbox' data-k='enabled' data-i='${idx}' ${w.enabled!==false?'checked':''}><input data-k='task_id' data-i='${idx}' value='${esc(w.task_id||'')}'><input data-k='owner' data-i='${idx}' value='${esc(w.owner||'')}'><input data-k='role' data-i='${idx}' value='${esc(w.role||'')}'><select data-k='engine' data-i='${idx}'><option value='codex' ${w.engine==='codex'?'selected':''}>codex</option><option value='claude-cli' ${w.engine==='claude-cli'?'selected':''}>claude-cli</option><option value='claude-manual' ${w.engine==='claude-manual'?'selected':''}>claude-manual</option><option value='manual' ${w.engine==='manual'?'selected':''}>manual</option></select><input data-k='repo' data-i='${idx}' value='${esc(w.repo||'')}'><input data-k='prompt_file' data-i='${idx}' value='${esc(w.prompt_file||'')}'><button onclick='removeAt(${idx})'>Del</button></div>`).join('');
  box.innerHTML=`<div class='cfr head'><div>#</div><div>on</div><div>task_id</div><div>owner</div><div>role</div><div>engine</div><div>repo</div><div>prompt_file</div><div>act</div></div>${rows || "<div style='padding:10px;color:#5770a0'>no workers</div>"}`;
  box.querySelectorAll('input[data-k],select[data-k]').forEach(el=>{
    el.addEventListener('change', async ()=>{
      const i=Number(el.getAttribute('data-i')||0),k=el.getAttribute('data-k');
      if(!cfg?.workers?.[i]||!k) return;
      if(k==='enabled'){
        cfg.workers[i][k]=el.checked;
        await saveCfg(true);
      } else {
        cfg.workers[i][k]=el.value;
      }
    });
  });
  q('#sum').textContent=`workers: ${cfg.workers.length}/10 | global_prompt: ${String((cfg.defaults&&cfg.defaults.global_prompt)||'').trim()? 'ON':'OFF'}`;
}
function removeAt(i){if(!cfg?.workers) return; cfg.workers.splice(i,1); renderCfg();}
function addW(engine='codex'){ensureCfg(); if((cfg.workers||[]).length>=10) return; cfg.workers.push(mkWorker(cfg.workers.length,engine)); renderCfg();}
function delW(){if(!cfg?.workers?.length) return; cfg.workers.pop(); renderCfg();}
function autoWorkers(n){
  ensureCfg();
  const m=Math.max(1,Math.min(10,Number(n)||10));
  cfg.workers=[];
  for(let i=0;i<m;i++){cfg.workers.push(mkWorker(i, i===1?'claude-cli':'codex'));}
  renderCfg();
}

async function loadCfg(){
  const orch=(q('#orch').value||'AGENT').trim().toUpperCase();
  const d=await api(`/api/config/${encodeURIComponent(orch)}`);
  if(!d.ok){setLogText(`load config failed: ${d.error||''}`); return;}
  cfg=d.config||{};
  q('#orch').value=cfg.orch_id||orch;
  q('#model').value=(cfg.defaults&&cfg.defaults.model)||q('#model').value;
  q('#reason').value=(cfg.defaults&&cfg.defaults.reasoning_effort)||q('#reason').value;
  q('#globalPrompt').value=(cfg.defaults&&cfg.defaults.global_prompt)||'';
  if(!cfg.defaults) cfg.defaults={};
  if(!Array.isArray(cfg.workers)) cfg.workers=[];
  renderCfg();
}

async function saveCfg(silent=false){
  ensureCfg();
  cfg.orch_id=(q('#orch').value||cfg.orch_id||'AGENT').trim().toUpperCase();
  if(!cfg.defaults) cfg.defaults={};
  cfg.defaults.model=q('#model').value||'gpt-5.3-codex';
  cfg.defaults.reasoning_effort=q('#reason').value||'xhigh';
  cfg.defaults.global_prompt=q('#globalPrompt').value||'';
  cfg.defaults.read_only_guard = cfg.defaults.read_only_guard !== false;
  cfg.defaults.history_readonly_guard = cfg.defaults.history_readonly_guard !== false;
  cfg.defaults.claude_cmd=cfg.defaults.claude_cmd||'claude';
  cfg.defaults.claude_continue = cfg.defaults.claude_continue !== false;
  cfg.defaults.claude_args=Array.isArray(cfg.defaults.claude_args)?cfg.defaults.claude_args:['--print','{prompt}'];
  const d=await api('/api/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orch_id:cfg.orch_id,config:cfg})});
  if(!silent) setLogText(d.ok?`saved: ${d.path}`:`save failed: ${d.error||''}`);
  return !!d.ok;
}

function renderWorkers(arr){
  const body=q('#wb');
  const pmRows = pmState ? [{
    task_id: `${String(pmState.orch||'AGENT')}-PM`,
    owner: String(pmState.pm_name||'Codex-PM'),
    role: 'PM/Orchestrator',
    engine: 'pm',
    pid: '-',
    state: ((arr||[]).some(x=>String(x.state||'').toUpperCase()==='RUNNING') ? 'RUNNING' : 'IDLE'),
    progress: Number(pmState.progress||0),
    activity: `progress_source=${String(pmState.progress_source||'master_tasks')}`,
    docs_count: 1,
    _pm: true,
  }] : [];
  const rows = [...pmRows, ...(arr||[])];
  body.innerHTML=rows.map(w=>{
    const cpu=Number(w.metrics?.cpu_percent||0), mem=Number(w.metrics?.rss_mb||0), prog=Number(w.progress||0);
    const state=String(w.state||'').toUpperCase();
    const stClass = (state==='RUNNING' || state==='DONE') ? 'ok' : ((state==='EXITED' || state==='BLOCKED') ? 'warn' : 'bad');
    const stHint = w.state_hint ? `<div style='font-size:11px;color:#5770a0'>${esc(w.state_hint)}</div>` : '';
    const cpuCell = w._pm ? `<div>-</div>` : `${bar('cpu',cpu)}<div>${cpu.toFixed(3)}%</div>`;
    const memCell = w._pm ? `<div>-</div>` : `${bar('mem',Math.min(100,mem/20))}<div>${mem.toFixed(1)}MB</div>`;
    const logBtn = w._pm
      ? `<button onclick='viewPmLog()'>View</button>`
      : `<button onclick='viewLog("${esc(w.task_id)}")'>View</button>`;
    const docsBtn = w._pm
      ? `<button onclick='viewPmDocs()'>1</button>`
      : `<button onclick='viewDocs("${esc(w.task_id)}")'>${Number(w.docs_count||0)}</button>`;
    return `<tr><td>${esc(w.task_id)}</td><td>${esc(w.owner)}</td><td>${esc(w.role)}</td><td>${esc(w.engine)}</td><td>${w.pid??''}</td><td class='${stClass}'>${esc(state || '-')}</td><td>${cpuCell}</td><td>${memCell}</td><td>${bar('prog',prog)}<div>${prog.toFixed(1)}%</div></td><td><div class='activity' title='${esc(w.activity||'')}'>${esc(w.activity||'-')}</div></td><td>${logBtn}${stHint}</td><td>${docsBtn}</td></tr>`;
  }).join('');
}
function renderManual(arr){
  const body=q('#mb');
  body.innerHTML=(arr||[]).map(w=>`<tr><td>${esc(w.task_id||'')}</td><td>${esc(w.owner||'')}</td><td>${esc(w.role||'')}</td><td>${esc(w.engine||'')}</td><td>${esc(w.repo||'')}</td><td>${esc(w.goal||'')}</td></tr>`).join('');
}

async function loadRun(){
  const run=q('#run').value;
  if(!run){return;}
  const d=await api(`/api/run/${encodeURIComponent(run)}/status`);
  if(!d.ok){setLogText(`status failed: ${d.error||''}`);return;}
  const s=d.summary||{};
  q('#m1').textContent=`running:${s.running||0}`;
  q('#m2').textContent=`total:${s.total||0}`;
  q('#m3').textContent=`avg cpu:${Number(s.avg_cpu||0).toFixed(2)}%`;
  q('#m4').textContent=`mem:${Number(s.mem_mb||0).toFixed(1)}MB`;
  renderRoleSummary(d.role_summary||[]);
  renderWorkers(d.workers||[]);
  renderManual(d.manual||[]);
}

async function viewLog(task){
  const run=q('#run').value;
  if(!run||!task) return;
  const d=await api(`/api/run/${encodeURIComponent(run)}/log/${encodeURIComponent(task)}?tail=240`);
  if(!d.ok){setLogText(`log failed: ${d.error||''}`);return;}
  setLogText(`${task} log opened`);
  openViewer(`${task} log`, d.text||'');
}
async function viewDocs(task){
  const run=q('#run').value;
  if(!run||!task) return;
  const d=await api(`/api/run/${encodeURIComponent(run)}/documents?task=${encodeURIComponent(task)}`);
  if(!d.ok){setLogText(`docs failed: ${d.error||''}`);return;}
  const t=(d.tasks||[])[0];
  const docs=t?.documents||[];
  if(!docs.length){openViewer(`${task} docs`, "(no docs)");return;}
  const lines = docs.map(x=>`${x.kind}	${x.path}	${x.size}	${x.mtime}`).join('\n');
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
  const orch=(q('#orch').value||'AGENT').trim().toUpperCase();
  const d=await api('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orch_id:orch,model:q('#model').value||'gpt-5.3-codex',reasoning_effort:q('#reason').value||'xhigh',pm_request:(q('#globalPrompt').value||'').trim(),dry_run:!!dry})});
  setLogText((d.stdout||'') + (d.stderr?`
${d.stderr}`:''));
  await refreshRuns();
  await loadRun();
}
async function distributeAndStart(){await startRun(false);}
async function stopRun(){
  const run=q('#run').value;
  const d=await api('/api/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run_name:run})});
  setLogText((d.stdout||'') + (d.stderr?`
${d.stderr}`:''));
  await refreshRuns();
  await loadRun();
}

function setAuto(){
  if(timer){clearInterval(timer);timer=null;}
  if(!q('#auto').checked) return;
  const sec=Math.max(1,Math.min(30,Number(q('#sec').value||3)));
  timer=setInterval(()=>refreshAll(), sec*1000);
}
async function refreshAll(){await refreshTools();await refreshPm();await refreshRuns();if(!cfg) await loadCfg();await loadRun();}

q('#auto').addEventListener('change',setAuto);
q('#sec').addEventListener('change',setAuto);
window.addEventListener('keydown',(e)=>{if(e.key==='Escape')closeViewer();});
window.addEventListener('load',async()=>{await refreshAll();setAuto();});
