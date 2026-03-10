You are executing task AGENT-T6 (Owner: Claude-DiagCleanup, Role: Infra-Diagnostics, Repo: machining_monitor_server).

## Goal: Remove dead code from diagnostics modules

### Context
- diagnostics/runtime_history_store.py: SQLite-based telemetry DB (RuntimeHistoryStore class)
- diagnostics/telemetry_mapping.py: Machine-specific signal mappings
- diagnostics/plc_symbol_map.py: PLC symbol definitions
- diagnostics/user_signal_store.py: Custom signal templates

### Steps
1. Read each file completely
2. For each public method/function, search the repo for callers
3. Find DB query methods that are never called
4. Find signal definitions that are never referenced
5. Find unused imports
6. Remove confirmed dead code
7. Verify syntax on each modified file

### Constraints
- ONLY modify files in `machining_monitor_server/diagnostics/`
- Do NOT remove methods used by server_main.py, web/server.py, or runtime_info_dialog.py
- Print summary at the end
