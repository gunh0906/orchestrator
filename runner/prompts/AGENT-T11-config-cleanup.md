You are executing task AGENT-T11 (Owner: Codex-ConfigCleanup, Repo: machining_monitor_server).

## Goal: Clean up configuration, diagnostics, and utility modules

### Context
- config_store.py: JSON config loader
- db_connection.py: PostgreSQL pooling
- path_policy.py: Data directory paths
- diagnostics/: Runtime history, telemetry mapping, PLC symbols, user signals
- connection_settings_dialog.py: PySide6 dialog for machine config
- styles/: QSS/color tokens for desktop UI

### Required Changes

#### 1. Config & DB modules
- `config_store.py`: Remove unused config keys, dead imports, debug prints
- `db_connection.py`: Remove unused connection methods, verify pool is properly managed
- `path_policy.py`: Check if all path constants are actually used by other modules

#### 2. Diagnostics modules
- `diagnostics/telemetry_mapping.py`: Check for unused signal definitions
- `diagnostics/plc_symbol_map.py`: Verify symbols are referenced somewhere
- `diagnostics/user_signal_store.py`: Check if read/write methods are all used
- `diagnostics/runtime_history_store.py`: Find unused DB query methods

#### 3. Desktop UI modules (audit only - do not delete)
- `connection_settings_dialog.py`: Note if it has dead widget code
- `runtime/controller.py`: Note unused signal/slot connections
- `styles/`: Note if color tokens are all referenced in QSS

### Constraints
- ONLY modify files in machining_monitor_server/
- Do NOT delete desktop UI modules (just audit and remove dead code within them)
- After editing, verify syntax on each modified file
- Print summary: list of files modified and what was removed
