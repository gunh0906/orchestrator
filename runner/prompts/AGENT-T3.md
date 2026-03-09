You are executing task AGENT-T3 (Owner: Codex-AppCleanup, Repo: machining_auto).

Scope paths:
- machining_auto/app_shell.py (MODIFY)
- machining_auto/common/monitor_api.py (MODIFY)

## Goal: Clean up app's server API consumption code and add diagnostic logging

### Background
The machining_auto app gets tool table, preset, and runtime data from the machining_monitor_server
via HTTP API. The current implementation works but has spaghetti code with many nested fallbacks
and unclear error handling.

### Required Changes

#### 1. Add logging to monitor_api.py methods
Every API call must log request and response:
```python
def get_tool_table(self, machine_id: str) -> dict:
    print(f"[monitor-api] GET /api/tool-table/{machine_id}")
    try:
        result = self._request("GET", f"/api/tool-table/{machine_id}")
        print(f"[monitor-api] tool-table response: ok={result.get('ok')} keys={list(result.keys())[:5]}")
        return result
    except Exception as exc:
        print(f"[monitor-api] tool-table FAILED: {exc}")
        raise

def get_preset_data(self, machine_id: str) -> dict:
    print(f"[monitor-api] GET /api/preset/{machine_id}")
    try:
        result = self._request("GET", f"/api/preset/{machine_id}")
        print(f"[monitor-api] preset response: ok={result.get('ok')} keys={list(result.keys())[:5]}")
        return result
    except Exception as exc:
        print(f"[monitor-api] preset FAILED: {exc}")
        raise
```

#### 2. Add logging to _request() base method
```python
def _request(self, method, path, data=None, timeout=10):
    url = f"{self._base}{path}"
    print(f"[monitor-api] {method} {url}")
    # ... existing code ...
    # After getting response:
    print(f"[monitor-api] response status={status_code} body_len={len(body)}")
```

#### 3. Fix `_request_tool_table_now()` in app_shell.py
The response parsing has too many nested fallbacks making it hard to debug.
Simplify the response parsing and add clear logging at each step:

```python
if bool(getattr(self, "_use_server_api_for_runtime", False)):
    try:
        from machining_auto.common.monitor_api import get_api
        from machining_auto.machine_connection.parse.tool_table_types import ToolTableRow, ToolTableStatus

        resp = get_api().get_tool_table(machine)
        print(f"[tool-table] API response: ok={resp.get('ok')}, keys={list(resp.keys())[:5]}")

        if not isinstance(resp, dict) or not (resp.get("status") == "ok" or bool(resp.get("ok"))):
            print(f"[tool-table] API returned non-ok response")
            return  # Don't fall to LSV2

        # Extract tool_table payload - try known key paths
        payload = resp.get("tool_table") or resp.get("data") or resp
        if isinstance(payload, dict) and isinstance(payload.get("tool_table"), dict):
            payload = payload["tool_table"]

        print(f"[tool-table] payload keys={list(payload.keys())[:8] if isinstance(payload, dict) else 'not-dict'}")

        # Extract rows
        rows_src = None
        for key in ("rows", "tool_rows", "tools"):
            candidate = payload.get(key) if isinstance(payload, dict) else None
            if isinstance(candidate, list):
                rows_src = candidate
                break

        print(f"[tool-table] rows found: {len(rows_src) if rows_src else 0}")

        # ... parse rows (keep existing parsing logic) ...
```

#### 4. Fix `_request_rotate_status_now()` in app_shell.py
Same pattern — simplify and add logging:
```python
        resp = get_api().get_preset_data(machine)
        print(f"[preset] API response: ok={resp.get('ok')}, keys={list(resp.keys())[:5]}")

        if not isinstance(resp, dict) or not (resp.get("status") == "ok" or bool(resp.get("ok"))):
            print(f"[preset] API returned non-ok response")
            return  # Don't fall to LSV2

        payload = resp.get("preset") or resp.get("data") or resp
        if isinstance(payload, dict) and isinstance(payload.get("preset"), dict):
            payload = payload["preset"]

        print(f"[preset] payload keys={list(payload.keys())[:8] if isinstance(payload, dict) else 'not-dict'}")
```

#### 5. Verify get_api() singleton initialization
In monitor_api.py, check:
- What base URL is used? (should be http://localhost:8866)
- Is the singleton properly initialized?
- Does _request() handle connection refused gracefully?
- Add try/except around urllib calls with clear error messages

#### 6. Verify the polling timer in app_shell.py
Check that _rotate_poll_timer is started properly and _on_rotate_poll_timeout() fires.
The timer should run regardless of _use_server_api_for_runtime mode.
Add a log: `print(f"[poll] rotate/tool poll fired, calling API...")` in `_on_rotate_poll_timeout()`.

### CRITICAL Rules
1. ONLY modify app_shell.py and monitor_api.py
2. The LSV2 fallback paths must remain for when _use_server_api_for_runtime=False
3. When _use_server_api_for_runtime=True, NEVER fall through to LSV2 — always return after API attempt
4. Keep the existing response parsing logic but add logging around it
5. Do NOT change signal interfaces or method signatures
6. Verify syntax after changes with: python -c "import ast; ast.parse(open('app_shell.py', encoding='utf-8').read())"
