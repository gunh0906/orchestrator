You are executing task AGENT-T2 (Owner: Claude-FocasCleanup, Role: Backend-Connector, Repo: machining_monitor_server).

## Goal: Remove dead code from focas_connector.py

### Context
- focas_connector.py (~1000 lines) is the Fanuc FOCAS2 DLL wrapper using ctypes
- FocasConnector class wraps Fwlib64.dll calls with high-level Python methods
- focas_test_orchestrator.py uses many of these methods — do NOT remove methods it calls

### Steps
1. Read `focas_connector.py` completely
2. Read `focas_test_orchestrator.py` to know which FocasConnector methods are used
3. Search the entire repo for each public method name to confirm usage (grep for method names in server_main.py, focas_test_orchestrator.py, etc.)
4. Find unused imports
5. Find debug `print(` calls — remove or convert to logging
6. Find duplicate ctypes structure definitions
7. Remove confirmed dead code (methods with zero callers across the entire repo)
8. Verify syntax: `python -c "import py_compile; py_compile.compile('focas_connector.py')"`

### Constraints
- ONLY modify `machining_monitor_server/focas_connector.py`
- Do NOT remove methods called by focas_test_orchestrator.py or server_main.py
- Do NOT restructure — only remove dead code
- Print summary at the end
