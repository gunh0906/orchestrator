You are executing task AGENT-T1 (Owner: Codex-ServerReconnect, Repo: machining_monitor_server).

Scope paths:
- machining_monitor_server/server_main.py (MODIFY)

## Goal: Make server reconnection bulletproof — NEVER stay disconnected permanently

### Background
The server (HeadlessRuntimeService) manages persistent LSV2 connections to CNC machines.
When the connection drops (e.g., another client kicks it), the server must reconnect automatically.

Current reconnection logic has issues:
1. `_on_runtime_error()` only reconnects if error message contains specific keywords
2. If error message doesn't match, it just reschedules the poll (stays on dead connection)
3. No health watchdog — if all signals fail to trigger reconnect, server stays offline forever

### Required Changes

#### 1. Add a connection health watchdog timer
After the connection is established, start a watchdog timer that checks:
- If no successful `_on_runtime_ready` has been received in the last 30 seconds
- AND `_connected` is True
- THEN force a reconnect

Implementation:
```python
# In __init__:
self._last_runtime_success_mono = 0.0
self._watchdog_timer = QTimer(self)
self._watchdog_timer.setSingleShot(False)
self._watchdog_timer.setInterval(15000)  # Check every 15 seconds
self._watchdog_timer.timeout.connect(self._check_connection_health)

# New method:
def _check_connection_health(self) -> None:
    if self._stopped or not self._connected:
        return
    elapsed = time.monotonic() - self._last_runtime_success_mono
    if elapsed > 30.0:
        print(f"[service][watchdog] no runtime data for {elapsed:.0f}s, forcing reconnect machine={self._machine}")
        self._consecutive_runtime_errors = 0
        try:
            self._poll_timer.stop()
        except Exception:
            pass
        self._end_runtime_session(note="watchdog_timeout")
        self._connected = False
        try:
            self._conn_mgr.disconnect_machine()
        except Exception:
            pass
        QTimer.singleShot(3000, self.start)
```

#### 2. Update `_on_runtime_ready` to track success time
```python
def _on_runtime_ready(self, payload: object) -> None:
    self._runtime_inflight = False
    self._consecutive_runtime_errors = 0
    self._last_runtime_success_mono = time.monotonic()  # ADD THIS
    ...
```

#### 3. Update `_on_state_changed` to start/stop watchdog
When connected:
```python
if connected:
    self._last_runtime_success_mono = time.monotonic()
    if not self._watchdog_timer.isActive():
        self._watchdog_timer.start()
    ...
```
When disconnected:
```python
self._watchdog_timer.stop()
```

#### 4. Update `stop()` to stop watchdog
```python
def stop(self):
    ...
    self._watchdog_timer.stop()
    ...
```

#### 5. Add comprehensive logging to connection state transitions
Add print statements at EVERY state transition:
- `[service][state] connected=True/False msg=...`
- `[service][reconnect] reason=... machine=...`
- `[service][watchdog] ...`
- `[service][error] consecutive=N msg=...`

### CRITICAL Rules
1. ONLY modify server_main.py
2. Do NOT change the polling interval or runtime data collection logic
3. Preserve ALL existing signal connections
4. The watchdog should NOT interfere with normal operation
5. Read the file CAREFULLY before editing — understand the full lifecycle
6. Verify syntax after changes with: python -c "import ast; ast.parse(open('server_main.py', encoding='utf-8').read())"
