You are executing task AGENT-T8 (Owner: Codex-ImportAPI, Repo: machining_monitor_server).

## Goal: Add "Import from JSON" API endpoint for machine registration

### Context
- Dashboard admin page at `web/static/index.html` has machine registration UI
- `web/server.py` has `MonitorWebContext` class with machine profile CRUD methods
- `data/machine_connections.json` has machine list with IP, connection_type, controller_type etc.
- Currently `build_scope_bootstrap()` (line ~647) auto-merges machines from json on every call
- User wants: auto-merge should NOT happen; instead a manual "Import from JSON" button triggers it

### Required Changes

#### 1. `machining_monitor_server/web/server.py`
- Add new method `import_machines_from_json(self) -> dict` to MonitorWebContext:
  - Read `self._connections_json` file
  - For each machine in `machine_list`, call `store.upsert_machine_profile()` with:
    - `machine_id`: machine name
    - `controller_type`: from `machine_conn_map[name].preset_controller_type`
    - `connection_type`: from `machine_conn_map[name].connection_type`
  - Also store IP address if the machine_profiles table has an ip column (check schema first)
  - Return `{"ok": True, "imported_count": N, "machines": self.build_machine_admin_payload()}`
- Add POST endpoint `/api/machines/import-json` that calls `import_machines_from_json()`
- Remove or comment out the auto-merge block in `build_scope_bootstrap()` (lines ~647-661) that reads machine_connections.json automatically. Instead, machines should come only from DB (machine_profiles + known_machines from runtime_samples).

#### 2. Check `machining_monitor_server/diagnostics/runtime_history_store.py`
- Verify `upsert_machine_profile` exists and what columns it supports
- If IP column doesn't exist in machine_profiles table, add it via ALTER TABLE + schema update

### Constraints
- ONLY modify files in machining_monitor_server/
- Keep changes minimal
- After editing, verify syntax with python -c
- Print a short summary at the end
