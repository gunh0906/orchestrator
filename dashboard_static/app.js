let cfg=null,hist={},timer=null,pmState=null,popupTemplateCache=null;
const prevActivity = {};
const MAX_FEED_LINES = 30;

const WORKER_ICONS = {
  'codex': '🤖',
  'gemini': '💎',
  'claude-cli': '🧠',
  'claude': '🧠',
  'pm': '👔',
  'manual': '🔧',
  'default': '⚙️'
};

/* Character presets - each worker looks different */
const CHAR_PRESETS = [
  { hair:'hair-short',   hairColor:'#dc2626', skin:'#f5cba7', shirt:'#1e293b', chair:'#ef4444' }, /* PM - red hair, dark suit */
  { hair:'hair-spiky',   hairColor:'#1a1a2e', skin:'#f5cba7', shirt:'#2d4b9b', chair:'#3b82f6' },
  { hair:'hair-long',    hairColor:'#92400e', skin:'#fcd9bd', shirt:'#7c3aed', chair:'#8b5cf6' },
  { hair:'hair-curly',   hairColor:'#374151', skin:'#deb887', shirt:'#059669', chair:'#10b981' },
  { hair:'hair-ponytail',hairColor:'#7c2d12', skin:'#fde68a', shirt:'#0369a1', chair:'#0ea5e9' },
  { hair:'hair-mohawk',  hairColor:'#7c3aed', skin:'#f5cba7', shirt:'#c2410c', chair:'#ea580c' },
  { hair:'hair-bun',     hairColor:'#1e293b', skin:'#fcd9bd', shirt:'#4338ca', chair:'#6366f1' },
  { hair:'hair-parted',  hairColor:'#d97706', skin:'#deb887', shirt:'#0f766e', chair:'#14b8a6' },
];

const BUBBLE_MSGS = {
  'codex':  ['코딩 중..','building!','fixing..','분석!'],
  'gemini': ['디자인~','styling!','CSS!','레이아웃!'],
  'claude': ['리뷰 중..','thinking.','검토!','분석..'],
  'pm':     ['지시 중!','체크!','진행률..','보고서!'],
  'default':['작업 중..','working!','처리!','busy!'],
};

function renderWorkerScene(workers) {
  const scene = document.querySelector('#worker-scene');
  if (!scene) return;

  const pmWorker = pmState ? {
    task_id: `${String(pmState.orch || 'AGENT')}-PM`,
    engine: 'pm',
    state: (workers || []).some(w => String(w.state || '').toUpperCase() === 'RUNNING') ? 'RUNNING' : 'IDLE',
    progress: Number(pmState.progress || 0),
    _isPm: true,
  } : null;

  const workerList = (workers || []).map(w => ({
    task_id: w.task_id || '',
    engine: w.engine || 'default',
    state: String(w.state || '').toUpperCase(),
    progress: Number(w.progress || 0),
  }));

  if (!pmWorker && !workerList.length) {
    scene.innerHTML = '<div style="color:var(--text-mute);font-size:11px;padding:20px;text-align:center">No workers</div>';
    return;
  }

  function charHtml(w, presetIdx, extraClass) {
    const preset = CHAR_PRESETS[presetIdx % CHAR_PRESETS.length];
    const state = w.state;
    let sc = 'is-idle';
    if (state === 'RUNNING') sc = 'is-running';
    else if (state === 'DONE' || state === 'EXITED') sc = 'is-done';

    const name = (w.task_id || '').replace(/^AGENT-/, '');
    const prog = Math.max(0, Math.min(100, w.progress));

    let bubble = '';
    if (state === 'RUNNING') {
      const msgs = BUBBLE_MSGS[w.engine] || BUBBLE_MSGS['default'];
      bubble = `<div class='char-bubble' style='animation-delay:${presetIdx*0.7}s'>${msgs[Math.floor(Date.now()/4000+presetIdx)%msgs.length]}</div>`;
    }

    let zzz = (state === 'DONE' || state === 'EXITED') ? `<div class='char-zzz'>z<span>Z</span><span>z</span></div>` : '';
    const coffee = (state === 'RUNNING') ? `<div class='char-coffee'>☕</div>` : '';

    return `<div class='worker-char ${sc} ${extraClass||''}'>
      <div class='char-person'>
        ${bubble}
        <div class='char-hair ${preset.hair}' style='background:${preset.hairColor}'></div>
        <div class='char-face' style='background:${preset.skin}'>
          <div class='char-eyes'></div>
          <div class='char-mouth'></div>
        </div>
        <div class='char-torso' style='background:${preset.shirt}'>
          <div class='char-arm char-arm-l' style='background:${preset.shirt}'></div>
          <div class='char-arm char-arm-r' style='background:${preset.shirt}'></div>
        </div>
        ${zzz}
      </div>
      <div class='char-chair-back' style='background:${preset.chair}'></div>
      <div class='char-desk'>
        <div class='char-desk-top'></div>
        <div class='char-monitor'>
          <div class='char-screen'>
            <div class='char-screen-line'></div>
            <div class='char-screen-line'></div>
            <div class='char-screen-line'></div>
          </div>
        </div>
        ${coffee}
      </div>
      <div class='char-progress'><span style='width:${prog}%'></span></div>
      <div class='char-label'>${name}</div>
    </div>`;
  }

  // Build rows: PM on top center, workers in rows of 3
  let html = `
    <div class='office-wall'>
      <div class='office-board'></div>
      <div class='office-clock'></div>
      <div class='office-plant office-plant-l'></div>
      <div class='office-plant office-plant-r'></div>
    </div>
    <div class='desk-rows'>
  `;

  // PM row
  if (pmWorker) {
    html += `<div class='desk-row-pm'>${charHtml(pmWorker, 0, 'is-pm')}</div>`;
  }

  // Worker rows (3 per row)
  for (let i = 0; i < workerList.length; i += 3) {
    const row = workerList.slice(i, i + 3);
    html += `<div class='desk-row'>`;
    row.forEach((w, j) => { html += charHtml(w, i + j + 1); });
    html += `</div>`;
  }

  html += `</div>`;
  scene.innerHTML = html;
}

function addFeedLine(taskId, message) {
  const feed = document.querySelector('#live-feed');
  if (!feed || !message || message === '-') return;

  const now = new Date();
  const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const line = document.createElement('div');
  line.className = 'feed-line recent';
  line.innerHTML = `<span class='feed-time'>${time}</span><span class='feed-task'>${taskId}</span><span class='feed-msg'>${message}</span>`;
  setTimeout(() => line.classList.remove('recent'), 3000);

  feed.appendChild(line);

  while (feed.children.length > MAX_FEED_LINES) {
    feed.removeChild(feed.firstChild);
  }

  feed.scrollTop = feed.scrollHeight;
}

const lastLogLines = {};
const workerStartTimes = {};

async function tailWorkerLogs() {
  const runEl = document.querySelector('#run');
  if (!runEl || !runEl.value) return;
  const run = runEl.value;

  const rows = document.querySelectorAll('#wb tr');
  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length < 6) continue;
    const taskId = cells[0]?.textContent?.trim();
    const state = cells[5]?.textContent?.trim()?.toUpperCase();
    if (!taskId || state !== 'RUNNING') continue;

    try {
      const d = await fetch(`/api/run/${encodeURIComponent(run)}/log/${encodeURIComponent(taskId)}?tail=3&_ts=${Date.now()}`, {cache:'no-store'});
      const data = await d.json();
      if (!data.ok || !data.text) continue;

      const lines = data.text.trim().split('\n').filter(l => l.trim());
      const lastSeen = lastLogLines[taskId] || '';

      for (const line of lines) {
        const trimmed = line.trim().substring(0, 120);
        if (trimmed && trimmed !== lastSeen) {
          addFeedLine(taskId, trimmed);
        }
      }
      if (lines.length > 0) {
        lastLogLines[taskId] = lines[lines.length - 1].trim().substring(0, 120);
      }
    } catch (e) { /* ignore */ }
  }
}

function updateKpiWithAnimation(selector, newText) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (el.textContent !== newText) {
    el.textContent = newText;
    el.classList.remove('changed');
    void el.offsetWidth;
    el.classList.add('changed');
  }
}
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

    const actText = String(w.activity || '');
    if (actText && actText !== '-' && prevActivity[w.task_id] !== actText) {
      addFeedLine(w.task_id, actText);
      prevActivity[w.task_id] = actText;
    }

    const stClass = (state==='RUNNING' || state==='DONE') ? 'ok' : ((state==='EXITED' || state==='BLOCKED') ? 'warn' : 'bad');
    const stBg = (state==='RUNNING'||state==='DONE') ? 'background:#ecfdf5' : ((state==='EXITED'||state==='BLOCKED') ? 'background:#fefce8' : (state==='ERROR'?'background:#fef2f2':''));
    const stHint = w.state_hint ? `<div style='font-size:11px;color:var(--text-mute)'>${esc(w.state_hint)}</div>` : '';
    
    let stateDisplay = esc(state || '-');
    if (state === 'RUNNING') {
      if (!workerStartTimes[w.task_id]) {
        workerStartTimes[w.task_id] = Date.now();
      }
      const elapsed = Math.floor((Date.now() - workerStartTimes[w.task_id]) / 1000);
      const min = Math.floor(elapsed / 60);
      const sec = elapsed % 60;
      const elapsedStr = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
      stateDisplay = `<span class='state-pulse'></span>${esc(state)} <span class='elapsed'>${elapsedStr}</span>`;
    } else {
      delete workerStartTimes[w.task_id];
    }

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
    
    const progBar = (state === 'RUNNING') ? bar('prog running-shimmer', prog) : bar('prog', prog);
    const actClass = (state === 'RUNNING') ? 'activity is-active' : 'activity';

    return `<tr><td>${esc(w.task_id)}</td><td>${esc(w.owner)}</td><td>${esc(w.role)}</td><td>${esc(w.engine)}</td><td>${w.pid??''}</td><td class='${stClass}' style='${stBg}'>${stateDisplay}</td><td>${cpuCell}</td><td>${memCell}</td><td>${progBar}<div style='font-size:14px;font-weight:700'>${prog.toFixed(1)}%</div></td><td>${tokenCell}</td><td><div class='${actClass}' title='${esc(w.activity||'')}'>${esc(w.activity||'-')}</div></td><td>${logBtn}${stHint}</td><td>${docsBtn}</td></tr>`;
  }).join('');
  renderWorkerScene(arr);
}
function renderManual(arr){}

async function loadRun(){
  const runEl=q('#run');
  if(!runEl||!runEl.value)return;
  const run=runEl.value;
  const d=await api(`/api/run/${encodeURIComponent(run)}/status`);
  if(!d.ok){setLogText(`status failed: ${d.error||''}`);return;}
  const s=d.summary||{};
  updateKpiWithAnimation('#m1',String(s.running||0));
  updateKpiWithAnimation('#m2',String(s.total||0));
  updateKpiWithAnimation('#m5',formatTokens(s.tokens_total||0));
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
  tailWorkerLogs().catch(()=>{});
}

window.addEventListener('keydown',(e)=>{if(e.key==='Escape')closeViewer();});
window.addEventListener('load',async()=>{addFeedLine('SYSTEM', 'Dashboard connected. Monitoring workers...');await refreshAll();setAuto();});
