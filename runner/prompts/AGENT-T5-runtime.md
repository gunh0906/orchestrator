You are executing task AGENT-T5 (Owner: Codex-RuntimeFix, Repo: machining_monitor_server + machining_auto).

## Goal: Fix program-based runtime display

### Problem
- The runtime display should show how long the CURRENT PROGRAM has been running.
- Currently it may show accumulated daily runtime or incorrect values.
- Need to track program start time and calculate elapsed from that.

### Context: Current Architecture
- `server_main.py` HeadlessRuntimeService collects runtime data every ~1s interval.
- `summary["program_current"]` has the current program name.
- `runtime_samples` table has `run_flag` (1=running, 0=idle) and `epoch`.
- `machining_telemetry` has `program_runtime` (from CNC controller, may be NULL).
- App's `rotate_monitor_panel.py` has `_extract_machine_runtime_seconds()` and a local monotonic timer fallback.

### Required Changes

#### 1. `machining_monitor_server/server_main.py`
- Track program start: when `program_name` changes AND `run_flag==1`, record `self._program_start_epoch = now_epoch`.
- When `run_flag==0` or program changes, reset.
- Add `program_elapsed_sec` to summary: `now_epoch - self._program_start_epoch` (only when running).
- This value flows through jsonl → API → app.

#### 2. `machining_monitor_server/web/api/data_collection_handlers.py`
- In `get_telemetry_latest()`, include `program_elapsed_sec` from `runtime_samples` or compute it:
  - Find the earliest epoch WHERE `machine_id=%s AND run_flag=1 AND program_name=%s` for the current program.
  - Return `program_elapsed_sec = latest_epoch - earliest_epoch`.
  - OR: simpler approach - just pass the `program_runtime` from telemetry + the server-computed `program_elapsed_sec` from summary.

#### 3. `machining_auto/machine_connection/rotate_monitor_panel.py`
- In `_extract_machine_runtime_seconds()`: check `summary.get("program_elapsed_sec")` as the first priority.
- Fallback chain: `program_elapsed_sec` → `program_runtime` → `machining_time_sec` → local timer.

### Constraints
- ONLY modify: `server_main.py`, `data_collection_handlers.py`, `rotate_monitor_panel.py`.
- Keep changes minimal. Do not restructure existing code.
- After editing, verify syntax with `python -c "import ast; ast.parse(open(f).read())"` for each file.
- Print a short summary of what you changed at the end.
