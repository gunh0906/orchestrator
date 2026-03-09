You are executing task AGENT-T4 (Owner: Codex-CoolantFix, Repo: machining_monitor_server + machining_auto).

## Goal: Fix coolant detailed state display (OUT_OIL/OUT_AIR/IN_OIL etc.) across full pipeline

### Problem
- DB `machining_telemetry` has `coolant_state TEXT` column (already added via ALTER TABLE).
- `server_main.py` writes `coolant_state` once per program, but most rows have NULL.
- API `get_telemetry_latest` returns only the latest row which usually has NULL coolant_state.
- App shows "ON"/"OFF" instead of detailed state like "OUT_OIL+OUT_AIR".

### Required Changes

#### 1. `machining_monitor_server/web/api/data_collection_handlers.py`
- In `get_telemetry_latest()`, after fetching the main telemetry row, if `coolant_state` is NULL or empty:
  - Run a sub-query: `SELECT coolant_state FROM machining_telemetry WHERE machine_id=%s AND coolant_state IS NOT NULL ORDER BY epoch DESC LIMIT 1`
  - Merge the result into the telemetry row dict before returning.
- Add `coolant_state` to `_TELEMETRY_SELECT` (already done, verify it is there).

#### 2. `machining_auto/app_shell.py`
- In `_build_payload_from_api_response()`:
  - `_coolant_state` should use `telemetry_row.get("coolant_state")` first (detailed like "OUT_OIL+OUT_AIR").
  - Fallback to `coolant_on` 0/1 -> "ON"/"OFF" only if coolant_state is empty/null.
  - Put `_coolant_state` in BOTH `summary["coolant_state"]` AND `telemetry["coolant_on"]` (for display fallback).
  - This code already exists but verify it works correctly with the API sub-query above.

### Constraints
- Do NOT modify `server_main.py` coolant collection logic (already correct: periodic PLC read + once-per-program DB write).
- Do NOT modify DB schema.
- ONLY modify: `data_collection_handlers.py` and `app_shell.py`.
- After editing, verify syntax with `python -c "import ast; ast.parse(open(f).read())"` for each file.
- Print a short summary of what you changed at the end.
