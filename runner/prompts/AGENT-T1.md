You are executing task {{TASK_ID}} (Owner: {{OWNER}}, Repo: {{REPO}}).

Scope paths:
{{SCOPE_PATHS}}

## 목표: 오케스트레이터 대시보드 HTML/CSS 정리 — 불필요 기능 제거 + 레이아웃 개선

### 제거할 UI 요소 (index.html에서 삭제):

1. **상단 바 오른쪽 영역에서 제거할 것들:**
   - PM name 입력 (`#pmNameIn`) + SavePM 버튼 → 삭제
   - `codex:-` / `claude:-` 툴 상태 표시 (`#toolCodex`, `#toolClaude`) → 삭제
   - Auto 체크박스 (`#auto`) + sec 입력 (`#sec`) → 삭제 (자동 새로고침은 JS에서 기본 3초로 하드코딩할 것이므로 UI만 제거)
   - Refresh 버튼은 **유지**

2. **왼쪽 패널 (설정/컨트롤 카드) 정리:**
   - Model 입력 (`#model`), Reasoning 입력 (`#reason`) → 삭제 (기본값 고정)
   - DryRun 버튼 → 삭제
   - Global Prompt 행 전체 → 삭제 (prompt는 PM이 tasks.json에서 관리)
   - LoadCfg, SaveCfg 버튼 → 삭제
   - `+Codex`, `+Claude` 버튼 → 삭제
   - Worker count 입력 (`#wcnt`) + ApplyCount(Set) 버튼 → 삭제
   - EnableAll, DisableAll, AutoRole 버튼 → 삭제
   - Distribute & Start 버튼 → 삭제
   - `#sum`, `#roleStats` div → 삭제

   **왼쪽 패널에 남길 것:**
   - Orch ID (`#orch`) + Run 선택 (`#run`) + ⟳ 버튼
   - Start 버튼, Stop 버튼
   - Worker / Role Planner 카드 (cfg grid) — **유지** (대기중인 에이전트 보여줌)

3. **하단 Manual Tasks 테이블 제거:**
   - `<div class='tbl'><table>...<tbody id='mb'>...</table></div>` 전체 삭제
   - 오른쪽 카드의 grid-template-rows에서 `minmax(90px,160px)` 제거, 워커 테이블이 전체 공간 사용

4. **오른쪽 KPI 행 간소화:**
   - 현재: `running:0 | total:0 | avg cpu:0% | mem:0MB | tokens:0`
   - 변경: KPI 카드 스타일로 리디자인
   ```html
   <div class="kpi-row">
     <div class="kpi-item"><span class="kpi-label">Running</span><span class="kpi-value" id="m1">0</span></div>
     <div class="kpi-item"><span class="kpi-label">Total</span><span class="kpi-value" id="m2">0</span></div>
     <div class="kpi-item"><span class="kpi-label">Tokens</span><span class="kpi-value" id="m5">0</span></div>
   </div>
   ```
   - avg cpu, mem KPI → 삭제 (테이블에서 이미 보임)

5. **PM 정보 그리드 간소화:**
   - PM cpu/mem/pid 셀 → 삭제
   - 남길 것: PM 이름, 마지막 업데이트, 진행률 (3개만)
   - `.pm` grid를 `repeat(3, 1fr)`로 변경

### CSS 추가/수정 (style.css):

```css
/* KPI row */
.kpi-row {
  display: flex;
  gap: 12px;
  justify-content: flex-start;
}
.kpi-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 20px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  min-width: 100px;
}
.kpi-label { font-size: 11px; color: var(--text-mute); text-transform: uppercase }
.kpi-value { font-size: 20px; font-weight: 800; color: var(--text) }
```

왼쪽 패널 상단 카드가 작아지므로 패딩/간격 조정.

### 주의사항:
- 삭제하는 요소의 id는 app.js에서 참조할 수 있으나, **이 태스크에서는 HTML/CSS만 수정**
- JS 관련 수정은 T2가 처리함
- 기존 id/class 중 남기는 것들은 절대 변경하지 말 것
- 삭제한 요소에 연결된 onclick 핸들러도 HTML에서 같이 삭제됨 (정상)
- A-TECH 디자인 토큰 그대로 유지

Constraints:
- ONLY modify dashboard_static/index.html, dashboard_static/style.css
- Do NOT modify app.js or popup.html or dashboard.py
