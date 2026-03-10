You are executing task AGENT-T3 (Owner: Claude-WebServerCleanup, Role: Backend-Web, Repo: machining_monitor_server).

## Goal: Remove dead code from web/server.py

### Context
- web/server.py (~1500 lines) is the HTTP REST server (MonitorWebServer + MonitorWebContext)
- It handles all API routing, auth, and static file serving
- Some routes may be wired but never called by frontend JS

### Steps
1. Read `web/server.py` completely
2. List all registered routes (GET/POST/PUT endpoints)
3. Read frontend files to cross-reference: `web/static/app.js`, `web/static/machine_detail.js`, `web/static/scope_live.js`
4. Find unused imports
5. Find dead inline handler methods in MonitorWebContext that no route calls
6. Find orphaned routes (endpoint registered but no frontend calls it) — mark as comment but don't remove (might be used by external tools)
7. Remove confirmed dead code (unused private methods, unused imports)
8. Verify syntax: `python -c "import py_compile; py_compile.compile('web/server.py')"`

### Constraints
- ONLY modify `machining_monitor_server/web/server.py`
- Do NOT remove public API endpoints (they might be used by curl/Postman)
- Do NOT restructure — only remove dead code
- Print summary at the end
