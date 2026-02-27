# Worker Results

## Rules
- Report per task id (`ORCH-xxxx-Tn`).
- Keep summary short: key changes, tests, risk, rollback point.

---

## [ORCH-0002-T1]
- Owner: Core/Connection
- Repo: machining_auto
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [ORCH-0002-T2]
- Owner: UI/Client
- Repo: machining_monitor_server
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [ORCH-0002-T3]
- Owner: Backend/Runtime
- Repo: machining_monitor_server
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [ORCH-0002-T4]
- Owner: Diagnostics/Search
- Repo: machining_monitor_server
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [ORCH-0003-T1]
- Owner: Backend
- Repo: orchestrator
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [ORCH-0003-T2]
- Owner: UI/Relay
- Repo: orchestrator
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [ORCH-0003-T3]
- Owner: Metrics
- Repo: orchestrator
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [ORCH-0003-T4]
- Owner: Planner
- Repo: orchestrator
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [AGENT-T1]
- Owner: Orch/Visibility
- Repo: orchestrator
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [AGENT-T2]
- Owner: Core/Connection
- Repo: machining_auto
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [AGENT-T3]
- Owner: Coolant/530
- Repo: machining_auto + machining_monitor_server
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [AGENT-T4]
- Owner: UI/Design → **Second-pass: UX Review / QA Gate** (Sub Agent: Claude)
- Repo: machining_monitor_server
- Changed files (first pass, AGENT-T4 prior run):
  - `styles/color_tokens.py` — hex_color tokens updated to dark-theme brightness
  - `styles/qss_loader.py` — dark navy QPalette applied
  - `styles/runtime_monitor.qss` — full dark-theme rewrite
- Key changes (5 lines max, first pass):
  1. App palette → dark navy. 2. RotateMonitorTop teal tint. 3. All light widgets → dark. 4. Dark scrollbars. 5. Brightened hex_color tokens.
- Tests run / results (first pass): visual-only; QSS syntax verified.
- Rollback point (commit/PR): pre-change HEAD (37b0e09)

---
### [AGENT-T4 / Second-pass UX Check Report]
**Role:** UX issue review, counterexample scenarios, design consistency audit, structural defect analysis.
**Reviewed files:** `app.py`, `diagnostics/runtime_info_dialog.py`, `runtime/controller.py`, `styles/color_tokens.py`, `styles/runtime_monitor.qss`, `web/static/index.html`, `web/static/app.js`, `web/static/styles.css`

---

#### 1. UX Issues (Severity / User Impact / Reproduction Steps)

**[UX-1] CRITICAL — donut_* and timeline_* color tokens use light-theme RGB values**
- File: `styles/color_tokens.py` lines 28–58
- `donut_bg:(242,245,251,255)` ≈ #f2f5fb (near-white), `donut_card_bg:(248,250,255,255)`, `timeline_bg:(241,245,249,255)` etc. are all light-theme backgrounds.
- The `_TrendPlotWidget` and any donut/timeline QWidget subclasses call `p.fillRect(self.rect(), qcolor("donut_bg"))` → bright white box on dark navy dialog.
- **User impact:** Bright white painting artifacts in dark app; breaks entire visual theme from AGENT-T4 dark-theme work.
- **Repro:** Open app → switch to Scope tab → observe donut/timeline widgets show white background on dark panel.
- **Severity:** CRITICAL (visual regression that undoes AGENT-T4 dark theme).

**[UX-2] HIGH — `_restore_scope_live_graph()` is a no-op on fresh session launch**
- File: `runtime/controller.py` lines 374–420
- The method returns early (`return`) if `_trend_source_mode == "auto"` AND no manual channels — which is exactly the fresh-start state.
- PM requirement "restore realtime graph" is only partially met: this function only handles within-session manual→auto rollback; it does nothing when app is opened fresh.
- **User impact:** Scope tab graph shows "No trend data" after launch even if a machine is connected. Users must manually switch trend mode or connect to see the graph populate.
- **Repro:** Fresh app launch → connect machine → switch to Scope tab → graph empty until data flows in (which is correct), but if user had previously navigated away and returned, no restore logic fires.
- **Severity:** HIGH (realtime graph PM requirement partially unmet).

**[UX-3] HIGH — `tab_history` label defined in two places; flash of wrong label on init**
- File: `diagnostics/runtime_info_dialog.py` line 1697: `addTab(self.tab_history, "가동률 로그")` (Korean)
- File: `runtime/controller.py` line 414: `_set_tab_label("tab_history", "Monitor/Admin")` (English, set by controller)
- Brief render with "가동률 로그" before controller init renames it to "Monitor/Admin".
- If controller is not attached or fails to init, label is wrong indefinitely.
- **User impact:** Label flicker; inconsistency if standalone dialog is opened.
- **Severity:** MEDIUM (visual flicker; incorrect label in edge cases).

**[UX-4] HIGH — Startup prompt (connect-all) fires at 260ms before window is fully rendered**
- File: `app.py` line 138: `QTimer.singleShot(260, ctrl.prompt_startup_connect_all)`
- `QMessageBox.question` is a blocking modal that appears before the main window may have completed its initial paint cycle.
- **User impact:** Modal dialog appears on top of a partially rendered main window; confusing first-run experience.
- **Severity:** HIGH (bad first-run UX).

**[UX-5] MEDIUM — `서버OFF` and `재시작` buttons have same visual style as safe buttons**
- File: `runtime/controller.py` lines 327–335; QSS `RuntimeInlineBtn` objectName used for all fleet buttons
- No visual differentiation between destructive `서버OFF`/`재시작` and informational `설정`/`홈열기`.
- **User impact:** Accidental server stop possible; no color/icon cue to indicate risk level.
- **Severity:** MEDIUM (UX safety issue for operator stations).

**[UX-6] MEDIUM — Session expiry during web form submit silently "succeeds"**
- File: `web/static/app.js` `api()` function lines 59–72
- When session expires, server returns 401 JSON `{ok:false, error:"unauthorized"}` → `!res.ok` (status 401) throws. BUT if server redirects (302) to `/login` before returning 401, browser follows redirect, gets 200 HTML → `body={}`, `!res.ok=false`, `body.ok` is `undefined` ≠ `false` → no error thrown → form appears to succeed.
- **User impact:** Admin saves a user/machine record, form clears, user list appears empty — silent data loss scenario.
- **Repro:** Keep admin web page idle >8h → submit user form → observe password field cleared and empty user list.
- **Severity:** MEDIUM (data-loss perception, confusing UX).

**[UX-7] LOW — Tab naming inconsistency between app and web**
- Web: "가동률" (Korean), "Scope" (English), "관리자" (Korean)
- App: "Scope" (English), "Monitor/Admin" (English)
- Inconsistent language within each surface and between surfaces.
- **Severity:** LOW (cosmetic).

**[UX-8] LOW — After fleet action completes, 서버ON button is re-enabled even if server is running**
- File: `runtime/controller.py` `_sync_fleet_controls()` line 486–503
- `setEnabled((not busy) and script_exists)` — after 서버ON completes, 서버ON is re-enabled even though server is already running. Clicking it again double-starts the server.
- **Severity:** LOW (script likely handles idempotency, but no UI protection).

---

#### 2. Counterexample Scenarios

**[CE-1] Empty machine registry**
- Remove all entries from `data/machine_connections.json`
- Start app → fleet start prompt at 260ms → user clicks YES
- Fleet collectors start with zero machines → web shows "표시할 설비가 없습니다."
- `prompt_startup_connect_all()` has no pre-check for empty machine list
- **Risk:** Misleading prompt asking to start fleet when no machines exist.

**[CE-2] `prompt_startup_connect_all()` fires during inflight fleet action**
- User clicks `서버ON` immediately after window opens (fast click before 260ms)
- Fleet action starts → `_fleet_action_inflight = True`
- At 260ms, `prompt_startup_connect_all()` checks `if self._fleet_action_inflight: return` — silently returns
- User sees no prompt and no feedback that connect-all was skipped
- **Risk:** Silent UX non-event.

**[CE-3] `_runtime_profile()` naming collision**
- File: `controller.py` lines 875–887
- When realtime access is DISABLED: returns `"realtime"` (lightweight scan profile — correct but confusing name)
- When realtime access IS enabled: also returns `"realtime"` (fallthrough)
- The string `"realtime"` is used as a scan profile name but is semantically confusing given the `realtime_access_enabled` permission concept
- **Risk:** Future developer mistakenly treats this as a realtime-access guard and inverts logic.

**[CE-4] Web admin panel on mobile/narrow viewport**
- At `max-width: 1360px`, `admin-shell` collapses to single column (correct)
- But `admin-layout` (user form + user table) also collapses to single column, placing the DELETE button above the table
- At 760px, kpi-grid collapses to 1 column and group-head uses grid-areas (correct)
- **Risk:** Admin user form submit vs table interaction may be awkward on sub-1360px screens.

**[CE-5] `renderMachineAdmin` auto-select first machine on every render**
- If `/api/machines/upsert` is called and response includes updated machine list, `renderMachineAdmin` runs again
- `if !state.selectedMachineId && rows.length → auto-select first` — since `selectedMachineId` was just set to the new machine, this is skipped (correct)
- But if user tries to add a NEW machine and has cleared the form, the next page load/refresh will auto-select the first machine again and re-populate the form
- **Risk:** User loses "new machine" form state on any data refresh.

**[CE-6] Rapid tab switching in web (realtime → fleet → realtime)**
- `setActiveTab('realtime')` → `startRealtime()` → `loadRealtime()` (async, ~200ms)
- User immediately clicks "가동률" tab → `stopRealtime()` clears timer
- User immediately clicks "Scope" tab again → `startRealtime()` starts new timer and new `loadRealtime()`
- First `loadRealtime()` call is still in-flight; no guard against concurrent calls
- Both renders call `tbody.innerHTML = ...` — last one wins, creating a race condition for table content
- **Risk:** Table may briefly show stale data or partial renders.

---

#### 3. Design Consistency Audit

**[DC-1] Color system split: RGBA vs Hex tokens both exist**
- `_COLOR_RGBA` dict (used by `qcolor()`) and `_COLOR_HEX` dict (used by `hex_color()`) are separate
- `qcolor("donut_bg")` returns light-theme white via RGBA
- `hex_color("run_diag_ok")` returns dark-theme green via HEX
- No enforcement that RGBA tokens match dark theme — mixing light RGBA and dark HEX colors
- **Recommendation:** Audit all RGBA tokens for dark-theme compatibility; especially `donut_*` and `timeline_*` groups.

**[DC-2] `RuntimeInlineBtn` QSS covers all title bar buttons uniformly**
- Good for consistency, but prevents per-button danger/warning states
- `서버OFF` should be styled like `btn-danger` (red) matching the web's `.btn-danger` convention

**[DC-3] Web `.tab.is-active` uses `linear-gradient(145deg, #2c5ec8, #1d3c87)` — matches app `admin-nav-btn.is-active` gradient `(145deg, #2f5fc9, #1f438f)` — good consistency**

**[DC-4] Web Scope tab description "관리자 전용 Scope 정보" is inconsistent with app's "Scope" label**
- Web communicates admin-only restriction in the panel subtitle
- App gives no such restriction indication on the Scope tab (because access is already controlled at dialog level via `_realtime_access_enabled`)
- **Minor inconsistency** in how access restriction is communicated.

**[DC-5] Skeleton loading animation exists in web (`@keyframes wave`) but no equivalent in app**
- App shows immediate content or empty state without loading indication
- Not a blocking issue but a parity gap.

---

#### 4. Structural Defects

**[SD-1] CRITICAL — `donut_*`/`timeline_*` RGBA tokens are light-theme values**
- These were not updated in AGENT-T4's dark theme pass
- Any custom-painted widget using `qcolor("donut_bg")` or `qcolor("timeline_bg")` will paint a near-white background on the dark app
- Must be corrected before shipping

**[SD-2] HIGH — `_restore_scope_live_graph()` guard condition inverted for fresh launch**
- `if mode == "auto" and not manual_channels: return` — this is the normal fresh state
- The function only acts on in-session state transitions, not on actual session restore
- True "restore" (persist and reload graph state across sessions) is not implemented

**[SD-3] MEDIUM — `tab_history` label set in two places (dialog constructor + controller)**
- Creates hidden dependency: dialog relies on controller to set correct tab label
- Standalone dialog testing will show wrong label

**[SD-4] MEDIUM — Connect button toggle state machine fragile**
- `_updating_connect_toggle` flag set at entry and cleared in `finally` block — good
- But `_btn_connect.toggled` signal fires synchronously, so if `_on_connect_toggled` triggers another connect/disconnect action (e.g., via signal), re-entrancy is possible before `_updating_connect_toggle` is cleared

**[SD-5] MEDIUM — No realtime-access guard on `_restore_scope_live_graph()` call path**
- `_apply_app_entry_defaults()` calls `_restore_scope_live_graph()`
- `_restore_scope_live_graph()` internally checks `_is_realtime_access_enabled()`
- But `_is_realtime_access_enabled()` falls back to `return True` if `dialog.is_realtime_access_enabled` is not callable
- If dialog is not fully initialized when controller `__init__` runs, this could incorrectly try to restore graph for a limited-access session

**[SD-6] LOW — Web `loadRealtime()` has no inflight guard**
- `startRealtime()` uses `window.setInterval` (2s) but no check if previous `loadRealtime()` is still pending
- Fast response: fine. Slow/hanging endpoint: multiple concurrent requests pile up
- Add an `_realtimeInflight` flag (like the app's `_runtime_inflight`) to prevent concurrent calls

---

#### 5. PM Handoff

**PM Feedback Requirements Status:**
| Requirement | Status |
|---|---|
| App behaves like web monitor/admin | PARTIAL — tab structure mirrors web, but Monitor/Admin tab label dual-definition is fragile |
| Server ON/OFF in app | DONE — 서버ON/서버OFF/재시작/홈열기 buttons present in title bar |
| Restore realtime graph | PARTIAL — `_TrendPlotWidget` exists, `_restore_scope_live_graph()` only handles within-session mode switches |
| Scope tab naming | DONE — `tab_live` = "Scope" in both app (`addTab`) and web (`data-tab="realtime"` displays "Scope") |
| Ask connect-all on entry | DONE — `prompt_startup_connect_all()` via QTimer(260ms) with QMessageBox |
| Web remains read-only monitor | DONE — web has no fleet server controls; admin controls are data admin only |

**VERDICT:**
```
REWORK

RERUN_OWNER: AGENT-T4 [Sub Agent: Claude]
RERUN_SCOPE:
  - styles/color_tokens.py: donut_* and timeline_* RGBA tokens MUST be updated to dark-theme equivalents (SD-1 / UX-1)
  - runtime/controller.py: _restore_scope_live_graph() should ensure graph is visible/active on Scope tab entry when connected, not just on manual→auto mode switch (UX-2 / SD-2)
  - diagnostics/runtime_info_dialog.py: tab_history initial label should be "Monitor/Admin" directly (not "가동률 로그"), remove dual-definition (UX-3 / SD-3)
  - runtime/controller.py: _sync_fleet_controls() should add danger styling signal for 서버OFF button (UX-5 / DC-2) — at minimum add distinct tooltip or property
  - web/static/app.js: loadRealtime() needs inflight guard to prevent concurrent polling (SD-6)
  - web/static/app.js: api() error handling should detect redirect-to-login (session expiry) scenario and redirect cleanly (UX-6)

HOLD (do not rework, by design):
  - Web Scope tab shows table not graph — this is correct per "web remains read-only monitor" spec
  - Fleet buttons re-enable after action — script idempotency handles double-start safely
```

## [AGENT-T5]
- Owner: Auth/Login
- Repo: machining_monitor_server
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):

## [AGENT-T6]
- Owner: Validation/QA
- Repo: machining_monitor_server + machining_auto + orchestrator
- Changed files:
- Key changes (5 lines max):
- Tests run / results:
- Risk / notes:
- Rollback point (commit/PR):
