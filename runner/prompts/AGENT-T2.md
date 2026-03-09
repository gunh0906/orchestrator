You are executing task AGENT-T2 (Owner: Codex-ToolPreset, Repo: machining_monitor_server).

Scope paths:
- machining_monitor_server/server_main.py (MODIFY)
- machining_monitor_server/web/api/data_collection_handlers.py (MODIFY)

## Goal: Make tool table and preset collection WORK reliably and add logging

### Background
The server collects tool table and preset data from CNC machines via LSV2, caches it,
and serves it via API. Currently this system is implemented but NOT working.
We need to add diagnostic logging and fix potential issues.

### Required Changes

#### 1. Add logging to `_collect_tool_and_preset_data()` in server_main.py
EVERY step must print a log line:
```python
def _collect_tool_and_preset_data(self, machine_id: str) -> None:
    print(f"[service][collect] start machine={machine_id} connected={self._connected}")

    if self._stopped or (not self._connected):
        print(f"[service][collect] skip: stopped={self._stopped} connected={self._connected}")
        return
    if _is_fanuc_conn_type(self._conn_type):
        print(f"[service][collect] skip: FANUC type")
        return

    # ... existing config loading ...
    print(f"[service][collect] tool_path={tool_remote_path!r} preset_path={preset_remote_path!r}")

    # Before download:
    print(f"[service][collect] downloading tool table from {tool_remote_path}")

    # After successful download:
    print(f"[service][collect] tool table downloaded, {len(tool_data)} bytes")

    # After parse:
    print(f"[service][collect] tool table parsed, {len(tool_payload.get('rows', []))} rows")

    # After DB persist:
    print(f"[service][collect] tool table persisted to DB")

    # Same for preset...
```

#### 2. Add logging to `_download_remote_file_bytes()` in server_main.py
```python
def _download_remote_file_bytes(self, remote_path: str, *, prefix: str) -> bytes:
    print(f"[service][download] path={remote_path}")
    # Check connection state
    client = getattr(self._conn_mgr, "_client", None)
    con = getattr(client, "con", None)
    print(f"[service][download] client={client is not None} con={con is not None}")
    if con is None:
        print(f"[service][download] FAIL: no active LSV2 session")
        raise RuntimeError("active LSV2 session is not available")
    # ... rest of method ...
```

#### 3. Add logging to the 5-minute trigger in `_on_runtime_ready()`
```python
# Around line 971-978:
self._tool_table_cache_time = getattr(self, "_tool_table_cache_time", 0.0)
now = time.time()
elapsed = now - float(self._tool_table_cache_time or 0.0)
if elapsed > 300.0:
    print(f"[service][collect] triggering collection (elapsed={elapsed:.0f}s)")
    self._tool_table_cache_time = float(now)
    try:
        self._collect_tool_and_preset_data(self._machine)
    except Exception as exc:
        print(f"[service][collect] FAILED: {exc}")
else:
    # Log once per minute that we're waiting
    if int(elapsed) % 60 < int(self._interval_sec) + 1:
        pass  # Don't log every poll, just when triggered
```

#### 4. Verify and fix `_parse_tool_table_bytes()` and `_parse_preset_bytes()`
Read these methods and ensure:
- They handle empty data gracefully
- The parser imports (from machining_auto) have try/except with fallback
- The fallback text parsing works correctly
- Add logging for parse success/failure

#### 5. Add logging to API handlers in data_collection_handlers.py
In `get_tool_table()` and `get_preset_data()`:
```python
def get_tool_table(machine_id: str) -> tuple[dict, int]:
    machine = _norm_text(machine_id)
    print(f"[api][tool-table] request machine={machine}")
    payload, db_err = _load_machine_file_cache(machine, "tool_table")
    print(f"[api][tool-table] cache hit={payload is not None} err={db_err}")
    ...
```

#### 6. Verify _load_machine_file_cache reads from correct table
Read the `_load_machine_file_cache()` function and verify:
- It queries the `machine_file_cache` table
- The SQL query is correct
- It handles missing data gracefully
- Connection pooling is correct (DatabasePool.get_instance())

### CRITICAL Rules
1. ONLY modify server_main.py and data_collection_handlers.py
2. Do NOT change the collection logic — only ADD logging and fix obvious bugs
3. Every print statement should have a clear prefix like [service][collect] or [api][tool-table]
4. Do NOT remove existing functionality
5. Verify syntax after changes
