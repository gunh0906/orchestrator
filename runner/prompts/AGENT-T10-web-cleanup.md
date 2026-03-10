You are executing task AGENT-T10 (Owner: Codex-WebCleanup, Repo: machining_monitor_server).

## Goal: Clean up web server and API handler dead code

### Context
- web/server.py (~1500 lines) is the HTTP REST server
- web/api/data_collection_handlers.py (~1000 lines) has all data API handlers
- web/api/scope_handlers.py has scope/realtime API handlers
- Some API endpoints may be wired but never called by frontend
- Some handler functions may be imported but unused

### Required Changes

#### 1. `machining_monitor_server/web/server.py`
- Find unused imports
- Find any route handlers that are defined but have no matching frontend call
- Cross-reference with web/static/*.js to find which /api/* endpoints are actually called
- Remove dead route registrations and their handler code
- Check for any duplicate route patterns

#### 2. `machining_monitor_server/web/api/data_collection_handlers.py`
- Find exported functions that are never imported by server.py
- Find internal helper functions that are never called
- Remove dead code
- Remove excessive debug prints

#### 3. Frontend cross-check
- Read web/static/app.js, machine_detail.js, scope_core.js, scope_live.js, scope_snapshot.js
- List all fetch('/api/...') calls
- Compare with registered routes in server.py
- Report any orphaned endpoints (server has route but no frontend calls it)

### Constraints
- ONLY modify files in machining_monitor_server/web/
- Do NOT remove endpoints that might be used by external tools (curl, Postman)
- After editing, verify syntax: python -c "import py_compile; py_compile.compile('web/server.py')"
- Print summary: removed N dead routes, N dead handlers, N dead imports
