You are executing task AGENT-T7 (Owner: Claude-UICleanup, Role: Frontend-Desktop, Repo: machining_monitor_server).

## Goal: Remove dead code from desktop UI modules

### Context
- runtime/controller.py (~500 lines): MonitorServerController (QObject-based desktop GUI controller)
- runtime/login_utils.py: LSV2 credential builder
- connection_settings_dialog.py: PySide6 dialog for machine connection config

### Steps
1. Read each file completely
2. Find unused imports
3. Find unused signal/slot connections (signals defined but never emitted, or slots never connected)
4. Find dead widget methods (defined but never called)
5. Find debug prints
6. Remove confirmed dead code
7. Verify syntax on each modified file

### Constraints
- ONLY modify the 3 files listed in scope_paths
- Do NOT remove Qt signal definitions (they may be connected by external code)
- Be conservative — desktop UI code often has dynamic connections
- Print summary at the end
