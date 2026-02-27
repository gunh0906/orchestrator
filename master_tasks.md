# Master Task Board

## Rules
- Use ORCH task ids (example: `ORCH-0002-T1`).
- Keep each task scoped and independently testable.
- `status`: `TODO` / `DOING` / `REVIEW` / `DONE`
- Each task has one owner and explicit `repo` + `scope_paths`.

---

## Team Allocation (ORCH-0002)
- PM: Codex-PM (this window)
  - Planning, scope lock, integration decisions, merge gate.
- Worker-1: Codex-A
  - `ORCH-0002-T1` (connection_manager stabilization).
- Worker-2: Claude
  - `ORCH-0002-T2` (UI/QSS parity and layout cleanup).
  - Relay remote incoming commands to PM for triage before execution.
- Worker-3: Codex-B
  - `ORCH-0002-T4` (snapshot/direct search stabilization).
- Worker-4: Codex-C
  - `ORCH-0002-T3` (runtime logging/profile/db unification).
- Worker-5: Codex-D
  - `ORCH-0002-T5` (import/IDE path hardening for connection_manager).
- Worker-6: Codex-E
  - `ORCH-0002-T6` (monitor value-input full-scan verification).

## Command Relay Contract
- Remote/new command intake path: `Claude -> PM`.
- PM decides routing and updates ORCH cards.
- Workers execute only their assigned `scope_paths`.

---

## TODO

### [ORCH-0002-T2] Monitor server UI/QSS parity
- status: DOING
- owner: Claude (UI/Relay)
- repo: `orchestrator`
- scope_paths:
  - `orchestrator/dashboard.py`
- goal:
  - Dashboard left planner UI 정렬/가독성 개선 (겹침/흐트러짐 제거).
  - 로그/문서 보기 사용성 유지.
- done when:
  - 좌측 플래너 그리드가 안정적으로 정렬됨.
  - 공통 해상도에서 버튼/입력 겹침 없음.
  - 로그/문서 보기 동작이 유지됨.

### [ORCH-0002-T3] Fleet runtime logging and machine profile unification
- status: TODO
- owner: Codex-C (Backend/Runtime)
- repo: `machining_monitor_server`
- scope_paths:
  - `machining_monitor_server/runtime/**`
  - `machining_monitor_server/diagnostics/runtime_history_store.py`
- goal:
  - Collect runtime logs for all configured machines.
  - Persist controller/connection profile per machine and keep schema consistent.
  - Branch logic by controller type (TNC640 / iTNC530 / Fanuc-ready separation).
- done when:
  - Runtime samples are written per machine id.
  - Session start/end and offline transitions are logged.
  - No schema mismatch across existing DB.

### [ORCH-0002-T4] Snapshot/direct-address search stabilization
- status: TODO
- owner: Codex-B (Diagnostics/Search)
- repo: `machining_monitor_server`
- scope_paths:
  - `machining_monitor_server/diagnostics/runtime_info_dialog.py`
  - `machining_monitor_server/diagnostics/telemetry_mapping.py`
- goal:
  - Separate auto-extract mode and direct-address mode.
  - Prevent direct-address input from polluting snapshot baseline/compare lifecycle.
  - Improve value search behavior and controls (exact / above / below).
- done when:
  - Direct mode only plots user-added addresses.
  - Snapshot output stays fixed until explicit refresh.
  - Value-search returns deterministic filtered results.

### [ORCH-0002-T5] connection_manager import path hardening
- status: DONE
- owner: Codex-D (Import/IDE)
- repo: `machining_auto`
- scope_paths:
  - `machining_auto/machine_connection/connection_manager.py`
  - `machining_auto/**/__init__.py`
- goal:
  - Remove Pylance missing-import warnings in `connection_manager`.
  - Keep runtime imports valid when workspace root is either `d:\\Development` or `d:\\Development\\machining_auto`.
- done when:
  - Missing-import warnings at lines 12-15 are resolved.
  - `python -m py_compile machining_auto/machine_connection/connection_manager.py` passes.

### [ORCH-0002-T6] Value-input full-scan verification (monitor server)
- status: REVIEW
- owner: Codex-E (ValueScan/Verify)
- repo: `machining_monitor_server`
- scope_paths:
  - `machining_monitor_server/diagnostics/runtime_info_dialog.py`
  - `machining_monitor_server/diagnostics/telemetry_mapping.py`
  - `machining_monitor_server/test_focas_connection.py`
- goal:
  - Verify and fix value-search path so entered values are searched over configured prefixes/ranges (not pseudo-fixed outputs).
  - Keep snapshot and direct/value search behavior separated.
- note:
  - Auto-run temporarily guarded to manual when prior run indicates read-only policy (token waste prevention).
- done when:
  - exact/above/below filters work deterministically.
  - Known live targets (e.g. D148 tool number on iTNC530) are detectable when scan range includes target.
  - Result rows show prefix/address/value and applied filter/range diagnostics.

## DOING

### [ORCH-0002-T1] connection_manager 4-issue stabilization
- status: DOING
- owner: Codex-A (Core/Connection)
- repo: `machining_auto`
- scope_paths:
  - `machining_auto/machine_connection/connection_manager.py`
  - `machining_auto/machine_connection/connectors/heidenhain_lsv2.py` (if required)
- goal:
  - Resolve 4 active failures in connect/disconnect/worker lifecycle.
  - Reduce login/buffer noise during rapid machine switching.
  - Eliminate thread-destroyed warning path.
- acceptance:
  - Repeated machine switch test does not leave dangling worker.
  - Disconnect/reconnect path is deterministic.
  - Error messages are actionable and non-duplicated.

## REVIEW

## DONE

### [ORCH-0002-T5] connection_manager import path hardening
- status: DONE
- owner: Codex-D (Import/IDE)
- repo: `machining_auto`
- result:
  - `connection_manager.py` import block switched to relative-first + string-based absolute fallback.
  - Pylance missing-import warnings target (lines 12-15 class) addressed.
  - Compile check passed: `python -m py_compile machining_auto/machine_connection/connection_manager.py`.

---

## Team Allocation (ORCH-0003)
- PM: Codex-PM (this window)
  - Scope lock, integration decision, launch gate.
- Worker-1: Codex-A
  - `ORCH-0003-T1` Dashboard backend/API extension.
- Worker-2: Claude
  - `ORCH-0003-T2` UI/UX styling and layout fit.
- Worker-3: Codex-B
  - `ORCH-0003-T3` usage metrics/graph and log panel behavior.
- Worker-4: Codex-C
  - `ORCH-0003-T4` planner persistence + worker/role CRUD.

## TODO (ORCH-0003)

### [ORCH-0003-T1] Dashboard API + config endpoints
- status: TODO
- owner: Codex-A (Backend)
- repo: `orchestrator`
- scope_paths:
  - `orchestrator/dashboard.py`
  - `orchestrator/runner/tasks.ORCH-0003.json`
- goal:
  - Add `config load/save` API and ORCH/task discovery endpoints.
  - Keep compatibility with existing `/api/start`, `/api/stop`, `/api/runs`.
- done when:
  - API supports runtime planner persistence per ORCH id.
  - Old start/stop flow still works without UI changes.

### [ORCH-0003-T2] Dashboard UI redesign and usability
- status: TODO
- owner: Claude (UI/Relay)
- repo: `orchestrator`
- scope_paths:
  - `orchestrator/dashboard.py`
- goal:
  - Improve layout and remove visual clutter.
  - Replace black log panel with app-consistent readable style.
- done when:
  - 2K and 4K both readable with no overlay.
  - Top controls and planner are intuitive and aligned.

### [ORCH-0003-T3] Worker utilization graph lane
- status: TODO
- owner: Codex-B (Metrics)
- repo: `orchestrator`
- scope_paths:
  - `orchestrator/dashboard.py`
- goal:
  - Add per-worker CPU/MEM usage bars and trend graph.
  - Show aggregate metrics (running, avg cpu, total mem).
- done when:
  - Worker table includes per-worker metric visualization.
  - Refresh updates trends continuously.

### [ORCH-0003-T4] Worker/role planner CRUD
- status: TODO
- owner: Codex-C (Planner)
- repo: `orchestrator`
- scope_paths:
  - `orchestrator/dashboard.py`
  - `orchestrator/runner/tasks.ORCH-0003.json`
  - `orchestrator/runner/prompts/ORCH-0003-*.md`
- goal:
  - Add UI controls to add/remove workers and assign role/engine/owner.
  - Include `claude-manual` lane in planner and save config.
- done when:
  - User can manage lanes without editing JSON manually.
  - Saved planner re-loads exactly on next launch.
