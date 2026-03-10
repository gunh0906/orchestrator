You are executing task AGENT-T1 (Owner: Claude-ServerCleanup, Role: Backend-Core, Repo: machining_monitor_server).

## Goal: Remove dead code from server_main.py

### Context
- server_main.py (~1000 lines) is the headless data collection service (HeadlessRuntimeService)
- It polls CNC machines via LSV2/FOCAS/MTConnect and writes telemetry to JSONL + PostgreSQL
- This file has accumulated debug prints and possibly unused code over time

### Steps
1. Read `server_main.py` completely
2. Find and list all `import` statements — check each one is actually used in the file
3. Find all `print(` calls — these should be `logging.*` calls or removed entirely
4. Find any methods defined in HeadlessRuntimeService that are never called (not by timers, signals, or external code)
5. Find commented-out code blocks (3+ consecutive commented lines that are dead code, not documentation)
6. Remove confirmed dead code
7. Verify syntax: `python -c "import py_compile; py_compile.compile('server_main.py')"`

### Constraints
- ONLY modify `machining_monitor_server/server_main.py`
- Do NOT remove timer callbacks or signal handlers even if they look unused (they're connected dynamically)
- Do NOT restructure or refactor — only remove dead code
- Print summary at the end
