You are executing task AGENT-T8 (Owner: Claude-FrontendCleanup, Role: Frontend-Web, Repo: machining_monitor_server).

## Goal: Remove dead code from web frontend

### Context
- web/static/app.js: Main app JS (fleet monitoring, admin panels)
- web/static/machine_detail.js: Machine detail page logic
- web/static/scope_core.js: Scope rendering engine (exports via window.__ScopeInternal)
- web/static/scope_live.js: Live scope update logic
- web/static/scope_snapshot.js: Snapshot capture/playback
- web/static/index.html: Main dashboard page
- web/static/styles.css: Styling

### Steps
1. Read each JS file completely
2. For each exported function, check if it's called anywhere (other JS files or HTML onclick handlers)
3. Find unused functions defined but never called
4. Check fetch('/api/...') calls — verify the endpoint exists in web/server.py
5. Find dead CSS rules (classes/IDs not used in any HTML)
6. Remove confirmed dead code
7. Verify JS syntax: no parse errors

### Constraints
- ONLY modify files in `machining_monitor_server/web/static/`
- scope.js has already been deleted — do NOT recreate it
- Do NOT remove functions that are part of window.__ScopeInternal namespace (they may be called cross-file)
- Be conservative with CSS removal
- Print summary at the end
