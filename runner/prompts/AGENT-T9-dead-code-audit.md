You are executing task AGENT-T9 (Owner: Codex-DeadCodeAudit, Repo: machining_monitor_server).

## Goal: Audit and remove dead code from server_main.py and focas_connector.py

### Context
- machining_monitor_server is a CNC machine monitoring system
- server_main.py (~1000 lines) is the headless data collection service
- focas_connector.py (~1000 lines) is the Fanuc FOCAS2 DLL wrapper
- Both files may contain unused functions, debug prints, dead imports

### Required Changes

#### 1. `machining_monitor_server/server_main.py`
- Find and remove any unused import statements
- Find and remove any debug print() calls that should be logging instead
- Find any functions/methods that are defined but never called within the file or by any other file
- Remove commented-out code blocks (more than 3 lines)
- Verify all timer callbacks are actually connected

#### 2. `machining_monitor_server/focas_connector.py`
- Find and remove unused import statements
- Find and remove debug print() calls (replace critical ones with logging if needed)
- Check for duplicate ctypes structure definitions
- Verify all public methods are actually called somewhere in the project
- Search the entire repo for usage: grep for each method name

### Constraints
- ONLY modify files in machining_monitor_server/
- Do NOT remove methods that are used by focas_test_orchestrator.py
- Do NOT restructure or refactor - only remove confirmed dead code
- After editing, verify syntax: python -c "import py_compile; py_compile.compile('server_main.py')"
- Print a summary: removed N dead imports, N dead functions, N debug prints
