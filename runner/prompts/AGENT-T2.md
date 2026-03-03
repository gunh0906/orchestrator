You are executing task {{TASK_ID}} (Owner: {{OWNER}}, Repo: {{REPO}}).

Scope paths:
{{SCOPE_PATHS}}

## 목표: app.js 수정 — 삭제된 HTML 요소 대응 + 워커 테이블 표시 개선

T1에서 HTML의 불필요 요소를 삭제했으므로, app.js에서 해당 요소 참조를 안전하게 처리하고,
워커 상태/토큰 표시를 개선한다.

### 1. 삭제된 HTML 요소 대응 (null-safe 처리)

T1이 삭제한 요소들:
- `#pmNameIn` — savePmName()에서 참조
- `#toolCodex`, `#toolClaude` — refreshTools()에서 참조
- `#auto`, `#sec` — setAuto()에서 참조
- `#model`, `#reason` — ensureCfg(), saveCfg(), startRun()에서 참조
- `#globalPrompt` — ensureCfg(), saveCfg(), setPmDefaultsFromWorkers()에서 참조
- `#wcnt` — applyWorkerCount(), renderCfg(), autoWorkers()에서 참조
- `#sum`, `#roleStats` — renderCfg(), renderRoleSummary()에서 참조
- `#m3` (avg cpu), `#m4` (mem) — loadRun()에서 참조
- `#mb` (manual tbody) — renderManual()에서 참조
- `#pmRuntime` — refreshPm()에서 참조

**처리 방법:**
- `q('#element')` 호출 전에 null 체크 추가, 또는 안전 래퍼 사용:
```javascript
function qs(sel) { return document.querySelector(sel); }
function setText(sel, text) { const el = qs(sel); if (el) el.textContent = text; }
function setVal(sel, val) { const el = qs(sel); if (el) el.value = val; }
function getVal(sel, def='') { const el = qs(sel); return el ? el.value : def; }
```
- 삭제된 요소 참조하는 함수들을 위 래퍼로 교체
- `refreshTools()` — 함수 본체를 빈 함수로 (return만)
- `savePmName()` — 함수 본체를 빈 함수로
- `renderRoleSummary()` — 함수 본체를 빈 함수로
- `renderManual()` — 함수 본체를 빈 함수로
- `setAuto()` — 자동 새로고침 3초 하드코딩 (UI 없이 항상 동작):
```javascript
function setAuto() {
  if (timer) { clearInterval(timer); timer = null; }
  timer = setInterval(() => refreshAll(), 3000);
}
```

### 2. KPI 값 표시 개선 (loadRun 함수)

T1이 KPI를 `#m1`, `#m2`, `#m5`만 남김 (Running, Total, Tokens).
값만 표시하도록 수정:

```javascript
// 기존: q('#m1').textContent=`running:${s.running||0}`;
// 변경:
setText('#m1', String(s.running || 0));
setText('#m2', String(s.total || 0));
setText('#m5', Number(s.tokens_total || 0).toLocaleString());
```

`#m3`, `#m4` 참조 제거.

### 3. 워커 테이블 개선 (renderWorkers 함수)

현재 문제: 토큰 표시 안 됨, Activity가 잘 안 보임.

**변경사항:**
- Token 열: 숫자를 천 단위 쉼표 + 읽기 쉽게 표시 (1234567 → "1,234,567" 또는 "1.2M")
- Activity 열: max-width 넓히기 (260px → 400px), 전체 내용을 title로 표시는 유지
- State 열: 상태별 배경색 추가:
  - RUNNING: 연한 초록 배경 `background:#ecfdf5`
  - EXITED: 연한 노란 배경 `background:#fefce8`
  - ERROR/BLOCKED: 연한 빨간 배경 `background:#fef2f2`
- Progress 바: 퍼센트 텍스트 크기 키우기 (현재 기본 → 14px, font-weight: 700)

**토큰 포맷 함수:**
```javascript
function formatTokens(n) {
  if (n == null) return '-';
  const num = Number(n);
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}
```

### 4. 기본값 하드코딩

삭제된 입력 필드의 기본값을 코드에 하드코딩:
```javascript
const DEFAULT_MODEL = 'gpt-5.3-codex';
const DEFAULT_REASON = 'xhigh';
const DEFAULT_ORCH = 'AGENT';
```

`ensureCfg()`, `saveCfg()`, `startRun()`에서 이 상수 사용.

### 5. 왼쪽 패널 불필요 함수 정리

다음 함수들은 HTML 버튼이 삭제되었으므로 호출되지 않지만, 에러 방지를 위해 **삭제하지 말고 그대로 둘 것** (다른 코드에서 참조 가능):
- `addW()`, `delW()`, `autoWorkers()`, `applyWorkerCount()`
- `enableAll()`, `autoAssignRoles()`, `distributeAndStart()`
- `loadCfg()`, `saveCfg()`

### 주의사항:
- 기존 API 호출 구조 유지
- renderWorkers의 테이블 컬럼 순서/개수는 HTML의 <thead>와 일치해야 함 (T1이 변경 안 했으면 그대로)
- openViewer, viewLog, viewDocs 기능은 그대로 유지
- 에러 없이 동작하도록 모든 null 참조 처리

Constraints:
- ONLY modify dashboard_static/app.js
- Do NOT modify index.html, style.css, popup.html, or dashboard.py
