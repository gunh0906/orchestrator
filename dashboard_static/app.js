let cfg=null,timer=null,pmState=null,popupTemplateCache=null;
const prevActivity = {};
const prevStates = {};
const MAX_FEED_LINES = 50;
let notificationsEnabled = false;

/* ── 8-member team roster ── */
const TEAM_ROSTER = [
  { id:'OPUS-1',   engine:'opus',   ver:'4.6', role:'Architect',       hair:'hair-parted',  hairColor:'#374151', skin:'#fcd9bd', shirt:'#2d2d3d', chair:'#b91c1c', badge:'#dc2626' },
  { id:'SONNET-1', engine:'sonnet', ver:'4.6', role:'UI / Design',     hair:'hair-long',    hairColor:'#92400e', skin:'#fde68a', shirt:'#7c3aed', chair:'#8b5cf6', badge:'#7c3aed' },
  { id:'SONNET-2', engine:'sonnet', ver:'4.6', role:'Frontend',        hair:'hair-ponytail',hairColor:'#7c2d12', skin:'#fcd9bd', shirt:'#6d28d9', chair:'#a78bfa', badge:'#7c3aed' },
  { id:'CODEX-1',  engine:'codex',  ver:'5.3', role:'Backend',         hair:'hair-spiky',   hairColor:'#1a1a2e', skin:'#f5cba7', shirt:'#2d4b9b', chair:'#3b82f6', badge:'#2d4b9b' },
  { id:'CODEX-2',  engine:'codex',  ver:'5.3', role:'API / Data',      hair:'hair-curly',   hairColor:'#374151', skin:'#deb887', shirt:'#1e40af', chair:'#60a5fa', badge:'#2d4b9b' },
  { id:'CODEX-3',  engine:'codex',  ver:'5.3', role:'Runtime',         hair:'hair-mohawk',  hairColor:'#1e293b', skin:'#f5cba7', shirt:'#1d4ed8', chair:'#93c5fd', badge:'#2d4b9b' },
  { id:'CODEX-4',  engine:'codex',  ver:'5.3', role:'Infra / DevOps',  hair:'hair-bun',     hairColor:'#0f172a', skin:'#fcd9bd', shirt:'#2563eb', chair:'#3b82f6', badge:'#2d4b9b' },
  { id:'GEMINI-1', engine:'gemini', ver:'3.1', role:'QA / Test',       hair:'hair-short',   hairColor:'#d97706', skin:'#deb887', shirt:'#059669', chair:'#10b981', badge:'#059669' },
];

const BUBBLE_MSGS = {
  'opus':   ['지시 중!','리뷰!','아키텍처..','설계!'],
  'sonnet': ['디자인~','styling!','레이아웃!','UI!'],
  'codex':  ['코딩 중..','building!','fixing..','분석!'],
  'gemini': ['테스트~','검증!','QA!','체크!'],
  'claude': ['리뷰 중..','thinking.','검토!','분석..'],
  'pm':     ['지시 중!','체크!','진행률..','보고서!'],
  'default':['작업 중..','working!','처리!','busy!'],
};

// ── Notifications ──
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => { notificationsEnabled = (p === 'granted'); });
  } else {
    notificationsEnabled = (Notification.permission === 'granted');
  }
}
function notifyStateChange(taskId, oldState, newState) {
  if (!notificationsEnabled || !oldState || oldState === newState) return;
  const icon = newState === 'DONE' ? '✅' : newState === 'FAILED' ? '❌' : newState === 'BLOCKED' ? '⚠️' : '🔄';
  try { new Notification(`${icon} ${taskId}`, { body: `${oldState} → ${newState}`, tag: `w-${taskId}` }); } catch(e) {}
}

// ── Individual worker stop ──
async function stopWorker(taskId, pid) {
  if (!confirm(`${taskId} (PID ${pid}) 를 중지하시겠습니까?`)) return;
  const d = await api('/api/stop-worker', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({task_id:taskId,pid}) });
  setLogText(d.ok ? d.message : `stop failed: ${d.error||''}`);
  await loadRun();
}

// ── Token cost estimation ──
const TOKEN_COSTS = {
  'codex':  { input:2.0, output:8.0 },
  'opus':   { input:15.0, output:75.0 },
  'sonnet': { input:3.0, output:15.0 },
  'gemini': { input:1.25, output:5.0 },
  'default':{ input:2.0, output:8.0 },
};
function estimateCost(engine, tokens) {
  const r = TOKEN_COSTS[engine] || TOKEN_COSTS['default'];
  const inp = Number(tokens?.input||0), out = Number(tokens?.output||0), tot = Number(tokens?.total||0);
  if (inp > 0 && out > 0) return inp/1e6*r.input + out/1e6*r.output;
  if (tot > 0) return tot*0.7/1e6*r.input + tot*0.3/1e6*r.output;
  return 0;
}

// ── Config panel toggle ──
function toggleCfg() {
  const body = document.getElementById('cfgBody');
  const icon = document.getElementById('cfgToggle');
  body.classList.toggle('collapsed');
  icon.classList.toggle('collapsed');
}

// ── Canvas scene ──
let _sceneCanvas = null, _sceneAnimTimer = null;

function renderWorkerScene(workers) {
  const scene = document.getElementById('worker-scene');
  if (!scene) return;
  if (!_sceneCanvas) {
    _sceneCanvas = document.createElement('canvas');
    _sceneCanvas.style.cssText = 'width:100%;height:100%;display:block';
    scene.innerHTML = '';
    scene.appendChild(_sceneCanvas);
  }
  const rect = scene.getBoundingClientRect();
  const dpr = devicePixelRatio || 1;
  _sceneCanvas.width = Math.round(rect.width * dpr);
  _sceneCanvas.height = Math.round(rect.height * dpr);
  _sceneCanvas.style.width = rect.width + 'px';
  _sceneCanvas.style.height = rect.height + 'px';
  _sceneCanvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);

  const workerList = (workers||[]).map(w => ({
    task_id: w.task_id||'', engine: String(w.engine||'default').toLowerCase(),
    state: String(w.state||'').toUpperCase(), progress: Number(w.progress||0),
  }));
  const engineMap = {'claude-cli':'opus','claude':'sonnet','claude-manual':'sonnet'};
  const norm = e => engineMap[e]||e;
  const assigned = new Array(TEAM_ROSTER.length).fill(null);
  const used = new Set();
  for (const w of workerList) {
    const eng = norm(w.engine);
    for (let i = 0; i < TEAM_ROSTER.length; i++) {
      if (!assigned[i] && TEAM_ROSTER[i].engine === eng && !used.has(i)) { assigned[i]=w; used.add(i); break; }
    }
  }
  if (pmState) {
    const pi = TEAM_ROSTER.findIndex(r => r.engine==='opus');
    if (pi >= 0 && !assigned[pi]) {
      assigned[pi] = { task_id:`${pmState.orch||'AGENT'}-PM`, engine:'opus',
        state: workerList.some(w=>w.state==='RUNNING')?'RUNNING':'IDLE', progress:Number(pmState.progress||0) };
    }
  }
  _sceneCanvas._roster = TEAM_ROSTER;
  _sceneCanvas._assigned = assigned;
  TAVERN.render(_sceneCanvas, TEAM_ROSTER, assigned, BUBBLE_MSGS);
  if (!_sceneAnimTimer) {
    _sceneAnimTimer = setInterval(() => {
      if (_sceneCanvas?._roster) TAVERN.render(_sceneCanvas, _sceneCanvas._roster, _sceneCanvas._assigned, BUBBLE_MSGS);
    }, 166);
  }
}

// ── Feed ──
function addFeedLine(taskId, message) {
  const feed = document.getElementById('live-feed');
  if (!feed || !message || message === '-') return;
  const time = new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const low = message.toLowerCase();
  const cls = low.includes('error')||low.includes('fail')||low.includes('traceback') ? ' feed-error'
    : low.includes('done')||low.includes('completed')||low.includes('success') ? ' feed-success' : '';
  const el = document.createElement('div');
  el.className = `feed-line recent${cls}`;
  el.innerHTML = `<span class='feed-time'>${time}</span><span class='feed-task'>${taskId}</span><span class='feed-msg'>${message}</span>`;
  setTimeout(() => el.classList.remove('recent'), 3000);
  feed.appendChild(el);
  while (feed.children.length > MAX_FEED_LINES) feed.removeChild(feed.firstChild);
  feed.scrollTop = feed.scrollHeight;
}

const lastLogLines = {};
const workerStartTimes = {};

async function tailWorkerLogs() {
  const runEl = document.getElementById('run');
  if (!runEl?.value) return;
  const run = runEl.value;
  for (const row of document.querySelectorAll('#wb tr[data-task][data-running]')) {
    const taskId = row.dataset.task;
    try {
      const d = await (await fetch(`/api/run/${encodeURIComponent(run)}/log/${encodeURIComponent(taskId)}?tail=3&_ts=${Date.now()}`,{cache:'no-store'})).json();
      if (!d.ok || !d.text) continue;
      const lines = d.text.trim().split('\n').filter(l=>l.trim());
      const lastSeen = lastLogLines[taskId]||'';
      for (const line of lines) {
        const t = line.trim().substring(0,120);
        if (t && t !== lastSeen) addFeedLine(taskId, t);
      }
      if (lines.length) lastLogLines[taskId] = lines[lines.length-1].trim().substring(0,120);
    } catch(e) {}
  }
}

// ── Helpers ──
function updateKpi(sel, txt) {
  const el = document.querySelector(sel);
  if (!el) return;
  if (el.textContent !== txt) { el.textContent = txt; el.classList.remove('changed'); void el.offsetWidth; el.classList.add('changed'); }
}
const q = s => { try { return document.querySelector(s) } catch(e) { return null } };
const qa = s => { try { return [...document.querySelectorAll(s)] } catch(e) { return [] } };
const setText = (s,t) => { const el=q(s); if(el) el.textContent=String(t??'') };
const setVal = (s,v) => { const el=q(s); if(el) el.value=String(v??'') };
const getVal = (s,d='') => { const el=q(s); return el?el.value:d };
const esc = v => String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const bar = (cls,val) => { const v=Math.max(0,Math.min(100,Number(val)||0)); return `<div class='bar ${cls}'><span style='width:${v}%'></span></div>` };
function formatTokens(n) {
  if (n==null) return '-';
  const v=Number(n);
  return v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':v.toLocaleString();
}
async function api(u,o={}) {
  const url = `${u}${u.includes('?')?'&':'?'}_ts=${Date.now()}`;
  return await (await fetch(url, Object.assign({cache:'no-store'},o))).json();
}
function setLogText(t) { const el=q('#msg'); if(el) el.textContent=String(t||'') }
function _htmlSafe(v) { return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }

// ── Popup viewer ──
const POPUP_TEMPLATE_URL='/static/popup.html';
const POPUP_FALLBACK=`<!doctype html><html><head><meta charset="utf-8"><title>__TITLE__</title><style>body{margin:0;font-family:system-ui;background:#f1f5f9;color:#0f172a}.top{height:40px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:#fff;border-bottom:1px solid #e2e8f0}.top div:first-child{font-weight:700;font-size:13px}.btn{height:28px;border:none;border-radius:6px;padding:0 12px;background:#2d4b9b;color:#fff;font-weight:600;cursor:pointer}#txt{width:100%;height:calc(100vh - 40px);border:0;outline:none;padding:12px;font-family:Consolas,monospace;font-size:12px;background:#fff;color:#0f172a;white-space:pre;resize:none}</style></head><body><div class="top"><div>__TITLE__</div><div><button class="btn" id="cb">Copy</button></div></div><textarea id="txt" readonly>__TEXT__</textarea><script>document.getElementById('cb').onclick=async()=>{const v=document.getElementById('txt').value;try{await navigator.clipboard.writeText(v)}catch(e){document.getElementById('txt').select();document.execCommand('copy')}}</script></body></html>`;
function openViewer(title, text) {
  const win = window.open('','_blank','width=1000,height=700,resizable=yes,scrollbars=yes');
  if (!win) { setLogText('Popup blocked'); return }
  const st = _htmlSafe(title||'View'), sx = _htmlSafe(text||'');
  const write = tpl => { const h=(tpl||POPUP_FALLBACK).replaceAll('__TITLE__',st).replaceAll('__TEXT__',sx); win.document.open(); win.document.write(h); win.document.close() };
  if (popupTemplateCache!==null) { write(popupTemplateCache); return }
  fetch(`${POPUP_TEMPLATE_URL}?_ts=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.text():Promise.reject()).then(t=>{popupTemplateCache=t;write(t)}).catch(()=>{popupTemplateCache='';write('')});
}

// ── Settings modal ──
function openSettings() {
  ensureCfg();
  const d = cfg.defaults || {};
  setVal('#setWorkspace', cfg.workspace || 'd:\\Development');
  // General
  setVal('#setReasoning', d.reasoning_effort || 'xhigh');
  setVal('#setGlobalPrompt', d.global_prompt || '');
  setVal('#setReadOnly', d.read_only_guard !== false ? 'true' : 'false');
  // Claude
  setVal('#setClaudeModel', d.claude_model || 'claude-opus-4-6');
  setVal('#setClaudeCmd', d.claude_cmd || 'claude');
  setVal('#setClaudeArgs', Array.isArray(d.claude_args) ? d.claude_args.join(' ') : '--print');
  setVal('#setClaudePermission', d.claude_permission_mode || 'bypassPermissions');
  const cb = (sel, val) => { const el = q(sel); if (el) el.checked = !!val };
  cb('#setStdin', d.claude_stdin);
  cb('#setAutoApprove', d.claude_auto_approve !== false);
  cb('#setContinue', d.claude_continue);
  // Codex
  setVal('#setCodexModel', d.model || 'gpt-5.3-codex');
  setVal('#setSandbox', d.sandbox || 'danger-full-access');
  setVal('#setApproval', d.approval || 'never');
  cb('#setBypass', d.codex_dangerously_bypass);
  // Gemini
  setVal('#setGeminiModel', d.gemini_model || 'gemini-3.1-pro');
  setVal('#setGeminiCmd', d.gemini_cmd || 'gemini');
  // close dir browser
  q('#dirBrowser')?.classList.remove('open');
  q('#settingsOverlay')?.classList.add('open');
}
function closeSettings(e) {
  if (e && e.target && e.target !== q('#settingsOverlay')) return;
  q('#settingsOverlay')?.classList.remove('open');
}
async function saveSettings() {
  ensureCfg();
  if (!cfg.defaults) cfg.defaults = {};
  cfg.workspace = getVal('#setWorkspace', cfg.workspace || 'd:\\Development');
  // General
  cfg.defaults.reasoning_effort = getVal('#setReasoning', 'xhigh');
  cfg.defaults.global_prompt = getVal('#setGlobalPrompt', '');
  cfg.defaults.read_only_guard = getVal('#setReadOnly') === 'true';
  cfg.defaults.history_readonly_guard = cfg.defaults.read_only_guard;
  // Claude
  cfg.defaults.claude_model = getVal('#setClaudeModel', 'claude-opus-4-6');
  cfg.defaults.claude_cmd = getVal('#setClaudeCmd', 'claude');
  const argsStr = getVal('#setClaudeArgs', '--print');
  cfg.defaults.claude_args = argsStr.split(/\s+/).filter(Boolean);
  cfg.defaults.claude_permission_mode = getVal('#setClaudePermission', 'bypassPermissions');
  cfg.defaults.claude_stdin = q('#setStdin')?.checked || false;
  cfg.defaults.claude_auto_approve = q('#setAutoApprove')?.checked !== false;
  cfg.defaults.claude_continue = q('#setContinue')?.checked || false;
  // Codex
  cfg.defaults.model = getVal('#setCodexModel', 'gpt-5.3-codex');
  cfg.defaults.sandbox = getVal('#setSandbox', 'danger-full-access');
  cfg.defaults.approval = getVal('#setApproval', 'never');
  cfg.defaults.codex_dangerously_bypass = q('#setBypass')?.checked || false;
  // Gemini
  cfg.defaults.gemini_model = getVal('#setGeminiModel', 'gemini-2.5-pro');
  cfg.defaults.gemini_cmd = getVal('#setGeminiCmd', 'gemini');
  const ok = await saveCfg(false);
  if (ok) closeSettings();
}

// ── Directory browser ──
async function openDirBrowser() {
  const browser = q('#dirBrowser');
  if (!browser) return;
  if (browser.classList.contains('open')) { browser.classList.remove('open'); return }
  browser.classList.add('open');
  const cur = getVal('#setWorkspace') || 'd:\\Development';
  await browseTo(cur);
}
async function browseTo(dirPath) {
  const list = q('#dirList');
  const bread = q('#dirBreadcrumb');
  if (!list || !bread) return;
  list.innerHTML = '<div class="dir-item" style="color:var(--text-mute)">Loading...</div>';
  try {
    const d = await api(`/api/list-dirs?path=${encodeURIComponent(dirPath)}`);
    if (!d.ok) { list.innerHTML = `<div class="dir-item" style="color:var(--danger)">${d.error||'error'}</div>`; return }
    // breadcrumb
    const parts = d.current.replace(/\\/g,'/').split('/').filter(Boolean);
    let crumb = '';
    const crumbs = [];
    if (d.drives?.length) {
      crumbs.push(`<span onclick="browseTo('${d.drives[0]}')" title="Drives">${parts[0]||'/'}</span>`);
    } else {
      crumbs.push(`<span onclick="browseTo('/')">/</span>`);
    }
    for (let i = 0; i < parts.length; i++) {
      crumb += parts[i] + '/';
      if (i > 0 || !d.drives?.length) {
        crumbs.push(`<span class="sep">/</span><span onclick="browseTo('${crumb.replace(/'/g,"\\'")}')">${parts[i]}</span>`);
      }
    }
    // select current button
    crumbs.push(`<span class="sep" style="margin-left:auto"></span><span onclick="selectDir('${d.current.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}',true)" style="color:var(--ok);font-weight:800" title="Select this folder">&#10003; Select</span>`);
    bread.innerHTML = crumbs.join('');
    // directory listing
    let html = '';
    if (d.parent) {
      html += `<div class="dir-item" onclick="browseTo('${d.parent.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')"><span class="dir-icon">&#128194;</span> ..</div>`;
    }
    if (d.drives?.length > 1) {
      for (const drv of d.drives) {
        html += `<div class="dir-item" onclick="browseTo('${drv.replace(/'/g,"\\'")}')"><span class="dir-icon">&#128187;</span> ${drv}</div>`;
      }
    }
    for (const dir of d.dirs) {
      const p = dir.path.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      html += `<div class="dir-item" ondblclick="browseTo('${p}')" onclick="selectDir('${p}')"><span class="dir-icon">&#128193;</span> ${dir.name}</div>`;
    }
    if (!d.dirs.length && !d.drives?.length) html += '<div class="dir-item" style="color:var(--text-mute)">(empty)</div>';
    list.innerHTML = html;
  } catch(e) {
    list.innerHTML = `<div class="dir-item" style="color:var(--danger)">Failed to load</div>`;
  }
}
function selectDir(dirPath, close) {
  setVal('#setWorkspace', dirPath.replace(/\\\\/g,'\\'));
  // highlight selected
  qa('.dir-item').forEach(el => el.classList.remove('dir-select'));
  if (close) q('#dirBrowser')?.classList.remove('open');
}

// ── Config ──
const DEFAULT_MODEL='gpt-5.3-codex';
const DEFAULT_REASON='xhigh';
const METHOD_ROLE_MAP={connection:'Core/Connection',ui:'UI/Design',runtime:'Backend/Runtime',diagnostics:'Diagnostics/Search',auth:'Auth/Login',validate:'Validation/QA',integration:'Integration',custom:'Custom'};
const suggestRoleByMethod = m => METHOD_ROLE_MAP[String(m||'').trim().toLowerCase()]||'Worker';
function methodOptions(sel) {
  const c=String(sel||'').trim().toLowerCase();
  return ['connection','ui','runtime','diagnostics','auth','validate','integration','custom'].map(v=>`<option value='${v}' ${c===v?'selected':''}>${v}</option>`).join('');
}
function mkWorker(i, engine) {
  const roster = TEAM_ROSTER[i] || {};
  const eng = engine || roster.engine || 'codex';
  const orch=getVal('#orch','AGENT').trim().toUpperCase();
  const pf={codex:'Codex',gemini:'Gemini','claude-cli':'Claude',opus:'Opus',sonnet:'Sonnet'}[eng]||eng;
  const role = roster.role || 'Worker';
  const wm = {Architect:'custom','UI / Design':'ui',Frontend:'ui',Backend:'connection','API / Data':'runtime',Runtime:'runtime','Infra / DevOps':'integration','QA / Test':'validate'}[role] || 'connection';
  return {task_id:`${orch}-T${i+1}`,enabled:true,engine:eng,owner:`${pf}-${roster.id||String.fromCharCode(65+i)}`,role,work_method:wm,repo:'orchestrator',scope_paths:[],goal:'',done_when:[],prompt_file:`orchestrator/runner/prompts/${orch}-T${i+1}.md`};
}
function ensureCfg() {
  if (cfg) return;
  cfg={orch_id:getVal('#orch','AGENT').trim().toUpperCase(),workspace:'d:\\Development',defaults:{model:DEFAULT_MODEL,reasoning_effort:DEFAULT_REASON,global_prompt:'',read_only_guard:true,history_readonly_guard:true,single_run_dir:true,clean_run_dir:true,prune_legacy_runs:true,claude_cmd:'claude',claude_continue:true,claude_args:['--print','{prompt}'],claude_stdin:false},workers:[]};
}
function renderCfg() {
  ensureCfg();
  const box=q('#cfg');
  if(!box) return;
  const rows=(cfg.workers||[]).map((w,i)=>`<div class='cfr'><div>${i+1}</div><input type='checkbox' data-k='enabled' data-i='${i}' ${w.enabled!==false?'checked':''}><input data-k='task_id' data-i='${i}' value='${esc(w.task_id||'')}'><input data-k='owner' data-i='${i}' value='${esc(w.owner||'')}'><input data-k='role' data-i='${i}' value='${esc(w.role||'')}'><select data-k='engine' data-i='${i}'><option value='opus' ${w.engine==='opus'?'selected':''}>opus</option><option value='sonnet' ${w.engine==='sonnet'?'selected':''}>sonnet</option><option value='codex' ${w.engine==='codex'?'selected':''}>codex</option><option value='gemini' ${w.engine==='gemini'?'selected':''}>gemini</option><option value='claude-cli' ${w.engine==='claude-cli'?'selected':''}>claude-cli</option><option value='manual' ${w.engine==='manual'?'selected':''}>manual</option></select><select data-k='work_method' data-i='${i}'>${methodOptions(w.work_method||'')}</select><input data-k='repo' data-i='${i}' value='${esc(w.repo||'')}'><input data-k='prompt_file' data-i='${i}' value='${esc(w.prompt_file||'')}'><button onclick='removeAt(${i})'>✕</button></div>`).join('');
  box.innerHTML=`<div class='cfr head'><div>#</div><div>on</div><div>id</div><div>owner</div><div>role</div><div>engine</div><div>method</div><div>repo</div><div>prompt</div><div></div></div>${rows||"<div style='padding:var(--pad);color:var(--text-mute)'>no workers</div>"}`;
  box.querySelectorAll('input[data-k],select[data-k]').forEach(el=>{
    el.addEventListener('change', async ()=>{
      const i=Number(el.dataset.i||0), k=el.dataset.k;
      if(!cfg?.workers?.[i]||!k) return;
      if(k==='enabled'){ cfg.workers[i][k]=el.checked; await saveCfg(true); }
      else if(k==='work_method'){ cfg.workers[i][k]=el.value; cfg.workers[i].role=suggestRoleByMethod(el.value); renderCfg(); }
      else cfg.workers[i][k]=el.value;
    });
  });
}
function renumberTaskIds() { if(!cfg?.workers) return; const o=getVal('#orch',cfg.orch_id||'AGENT').trim().toUpperCase(); cfg.workers.forEach((w,i)=>{w.task_id=`${o}-T${i+1}`}) }
function removeAt(i) { if(!cfg?.workers) return; cfg.workers.splice(i,1); renumberTaskIds(); renderCfg() }
function addW(engine='codex') { ensureCfg(); if((cfg.workers||[]).length>=8) return; cfg.workers.push(mkWorker(cfg.workers.length,engine)); renumberTaskIds(); renderCfg() }
function delW() { if(!cfg?.workers?.length) return; cfg.workers.pop(); renumberTaskIds(); renderCfg() }
function autoWorkers(n) { ensureCfg(); cfg.workers=[]; const m=Math.max(1,Math.min(8,Number(n)||8)); for(let i=0;i<m;i++) cfg.workers.push(mkWorker(i)); renumberTaskIds(); renderCfg() }
function applyWorkerCount() { ensureCfg(); const n=Math.max(1,Math.min(8,Number(getVal('#wcnt',cfg.workers.length||1)))); while(cfg.workers.length<n) cfg.workers.push(mkWorker(cfg.workers.length,'codex')); while(cfg.workers.length>n) cfg.workers.pop(); renumberTaskIds(); renderCfg() }
function enableAll(v) { ensureCfg(); cfg.workers.forEach(w=>w.enabled=!!v); renderCfg() }
function setPmDefaultsFromWorkers() { ensureCfg(); if(!cfg.defaults) cfg.defaults={}; cfg.defaults.pm_last_selected=cfg.workers.filter(w=>w.enabled!==false).map(w=>w.task_id); cfg.defaults.pm_last_request='' }

async function loadCfg() {
  const orch=getVal('#orch','AGENT').trim().toUpperCase();
  const d=await api(`/api/config/${encodeURIComponent(orch)}`);
  if(!d.ok){ setLogText(`config: ${d.error||'fail'}`); return }
  cfg=d.config||{}; setVal('#orch',cfg.orch_id||orch);
  if(!cfg.defaults) cfg.defaults={};
  if(!Array.isArray(cfg.workers)) cfg.workers=[];
  renderCfg();
}
async function saveCfg(silent=false) {
  ensureCfg();
  cfg.orch_id=getVal('#orch',cfg.orch_id||'AGENT').trim().toUpperCase();
  if(!cfg.defaults) cfg.defaults={};
  Object.assign(cfg.defaults, { model:cfg.defaults.model||'gpt-5.3-codex', reasoning_effort:cfg.defaults.reasoning_effort||'xhigh', read_only_guard:cfg.defaults.read_only_guard!==false, history_readonly_guard:cfg.defaults.history_readonly_guard!==false, claude_cmd:cfg.defaults.claude_cmd||'claude', claude_continue:cfg.defaults.claude_continue!==false, claude_args:Array.isArray(cfg.defaults.claude_args)?cfg.defaults.claude_args:['--print','{prompt}'] });
  setPmDefaultsFromWorkers();
  const d=await api('/api/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orch_id:cfg.orch_id,config:cfg})});
  if(!silent) setLogText(d.ok?`saved: ${d.path}`:`save failed: ${d.error||''}`);
  return !!d.ok;
}

// ── Render workers (simplified 7-column table) ──
function renderWorkers(arr) {
  const body = q('#wb');
  if (!body) return;
  const rows = arr || [];
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan='5' style='padding:var(--pad);color:var(--text-mute)'>활성 런이 없습니다</td></tr>`;
    renderWorkerScene([]);
    return;
  }
  body.innerHTML = rows.map(w => {
    const cpu=Number(w.metrics?.cpu_percent||0), mem=Number(w.metrics?.rss_mb||0), prog=Number(w.progress||0);
    const state=String(w.state||'').toUpperCase();
    const actText = String(w.activity||'');
    if (actText && actText!=='-' && prevActivity[w.task_id]!==actText) { addFeedLine(w.task_id, actText); prevActivity[w.task_id]=actText }
    const prev = prevStates[w.task_id];
    if (prev && prev!==state) { notifyStateChange(w.task_id, prev, state); if(state==='DONE'||state==='FAILED') addFeedLine(w.task_id, `▶ ${prev} → ${state}`) }
    prevStates[w.task_id] = state;

    // Worker cell: task_id + role (from roster or engine fallback)
    const rosterMatch = TEAM_ROSTER.find(r => r.engine === String(w.engine||'').toLowerCase());
    const roleText = w.role || (rosterMatch ? rosterMatch.role : w.engine) || w.engine;
    const wCell = `<td class='w-name'><div class='w-id'>${esc(w.task_id)}</div><div class='w-role'>${esc(roleText)}</div></td>`;

    // State cell
    const stClass = (state==='RUNNING'||state==='DONE')?'ok':(state==='EXITED'||state==='BLOCKED')?'warn':'bad';
    let stHtml = esc(state||'-');
    if (state==='RUNNING') {
      if (!workerStartTimes[w.task_id]) workerStartTimes[w.task_id]=Date.now();
      const sec=Math.floor((Date.now()-workerStartTimes[w.task_id])/1000);
      const m=Math.floor(sec/60), s=sec%60;
      stHtml = `<span class='state-pulse'></span>${state} <span class='elapsed'>${m>0?m+'m ':''}${s}s</span>`;
    } else { delete workerStartTimes[w.task_id] }
    const stCell = `<td class='${stClass}'>${stHtml}</td>`;

    // Progress cell
    const pBar = state==='RUNNING' ? bar('prog running-shimmer',prog) : bar('prog',prog);
    const pCell = `<td>${pBar}<div style='font-weight:700'>${prog.toFixed(0)}%</div></td>`;

    // Token cell
    const tokT = w.tokens?.total!=null ? Number(w.tokens.total) : null;
    const cost = estimateCost(w.engine, w.tokens);
    const costS = cost>0 ? `<div style='font-size:var(--fs-xs);color:var(--text-mute)'>$${cost.toFixed(3)}</div>` : '';
    const tCell = `<td>${formatTokens(tokT)}${costS}</td>`;

    // Actions cell
    const stopB = (state==='RUNNING'&&w.pid) ? `<button class='btn-stop-worker' onclick='stopWorker("${esc(w.task_id)}",${w.pid})' title='Stop'>■</button>` : '';
    const logB = `<button class='act-btn' onclick='viewLog("${esc(w.task_id)}")'>Log</button>`;
    const actCell = `<td>${stopB}${logB}</td>`;

    const runAttr = state==='RUNNING' ? ' data-running' : '';
    return `<tr data-task='${esc(w.task_id)}'${runAttr}>${wCell}${stCell}${pCell}${tCell}${actCell}</tr>`;
  }).join('');
  renderWorkerScene(arr);
}

// ── PM & Runs ──
async function refreshPm() {
  const d=await api('/api/pm');
  if(!d?.ok) return;
  pmState=d;
  setText('#pmName', d.pm_name||'Opus-PM');
  setText('#pmProg', `${Number(d.progress||0).toFixed(0)}%`);
}
async function refreshRuns() {
  const orch=getVal('#orch','AGENT').trim().toUpperCase();
  let d=await api('/api/runs'+(orch?`?orch=${encodeURIComponent(orch)}`:''));
  if((!d.runs||!d.runs.length)&&orch){ d=await api('/api/runs'); const f=(d.runs||[])[0]; if(f?.orch_id) setVal('#orch',f.orch_id) }
  const s=q('#run'),cur=s?s.value:'';
  if(!s) return;
  s.innerHTML='';
  (d.runs||[]).forEach(r=>{ const o=document.createElement('option'); o.value=r.name; o.textContent=`${r.name} (${r.running}/${r.total})`; s.appendChild(o) });
  if(cur&&qa('#run option').some(x=>x.value===cur)) s.value=cur;
  else if(d.latest) s.value=d.latest;
}

// ── Load run ──
async function loadRun() {
  const runEl=q('#run');
  if(!runEl?.value) return;
  const d=await api(`/api/run/${encodeURIComponent(runEl.value)}/status`);
  if(!d.ok){ setLogText(`status: ${d.error||'fail'}`); return }
  const s=d.summary||{};
  updateKpi('#m1', String(s.running||0));
  updateKpi('#m2', String(s.total||0));
  updateKpi('#m5', formatTokens(s.tokens_total||0));
  const workers = d.workers||[];
  let totalCost=0;
  for (const w of workers) totalCost += estimateCost(w.engine, w.tokens);
  updateKpi('#m6', totalCost>0 ? `$${totalCost.toFixed(2)}` : '$0');
  renderWorkers(workers);
}

// ── Log / Docs viewers ──
async function viewLog(task) {
  const run=q('#run')?.value; if(!run||!task) return;
  const d=await api(`/api/run/${encodeURIComponent(run)}/log/${encodeURIComponent(task)}?tail=240`);
  if(!d.ok){ setLogText(`log: ${d.error||'fail'}`); return }
  openViewer(`${task} log`, d.text||'');
}
async function viewDocs(task) {
  const run=q('#run')?.value; if(!run||!task) return;
  const d=await api(`/api/run/${encodeURIComponent(run)}/documents?task=${encodeURIComponent(task)}`);
  if(!d.ok){ setLogText(`docs: ${d.error||'fail'}`); return }
  const docs=(d.tasks||[])[0]?.documents||[];
  if(!docs.length){ openViewer(`${task} docs`,'(no docs)'); return }
  openViewer(`${task} docs`, docs.map(x=>`${x.kind}\t${x.path}\t${x.size}\t${x.mtime}`).join('\n'));
}

// ── Start / Stop ──
async function startRun(dry=false, pmReq='') {
  const ok=await saveCfg(true);
  if(!ok){ setLogText('start blocked: config save failed'); return }
  const orch=getVal('#orch','AGENT').trim().toUpperCase();
  const maxW=Math.max(1,Math.min(8,cfg?.workers?.length||1));
  const req=String(pmReq||'').trim();
  const model = cfg?.defaults?.model || 'gpt-5.3-codex';
  const reason = cfg?.defaults?.reasoning_effort || 'xhigh';
  const d=await api('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orch_id:orch,model,reasoning_effort:reason,pm_request:req,pm_delegate:true,min_workers:1,max_workers:maxW,dry_run:!!dry})});
  setLogText((d.stdout||'')+(d.stderr?` ${d.stderr}`:''));
  if(req) addFeedLine('PM',`요청: ${req}`);
  await refreshRuns(); await loadRun();
}
async function startRunWithRequest() { await startRun(false, getVal('#pmReq','').trim()) }
async function stopRun() {
  const run=q('#run')?.value; if(!run) return;
  const d=await api('/api/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run_name:run})});
  setLogText((d.stdout||'')+(d.stderr?` ${d.stderr}`:''));
  await refreshRuns(); await loadRun();
}

// ── Auto refresh ──
function setAuto() { if(timer) clearInterval(timer); timer=setInterval(()=>refreshAll(), 3000) }
async function refreshAll() {
  await Promise.all([refreshPm(), refreshRuns()].map(p=>p.catch(()=>{})));
  if(!cfg) await loadCfg();
  await loadRun();
  tailWorkerLogs().catch(()=>{});
}

window.addEventListener('load', async () => {
  requestNotificationPermission();
  addFeedLine('SYSTEM','Dashboard connected');
  await refreshAll();
  setAuto();
});
