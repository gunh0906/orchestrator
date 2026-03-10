You are executing task AGENT-T4 (Owner: Claude-APICleanup, Role: Backend-API, Repo: machining_monitor_server).

## Goal: Remove dead code from API handler modules

### Context
- web/api/data_collection_handlers.py (~1000 lines) has work order, telemetry, signal, CAM sheet handlers
- web/api/scope_handlers.py has scope/realtime API handlers
- These are imported by web/server.py

### Steps
1. Read `web/api/data_collection_handlers.py` completely
2. Read `web/api/scope_handlers.py` completely
3. Read `web/server.py` import section to see which functions are actually imported
4. Find exported functions that are never imported by server.py (dead exports)
5. Find internal helper functions that are never called within the file
6. Find unused imports
7. Remove debug prints
8. Remove confirmed dead code
9. Verify syntax on both files

### Constraints
- ONLY modify files in `machining_monitor_server/web/api/`
- Do NOT remove functions that server.py imports
- Print summary at the end
