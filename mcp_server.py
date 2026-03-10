# -*- coding: utf-8 -*-
"""
Orchestrator MCP Server — Claude Code에서 도구로 직접 호출 가능.
stdio 기반 MCP 프로토콜 (JSON-RPC 2.0).

등록 방법 (~/.claude/settings.json):
  "mcpServers": {
    "orchestrator": {
      "command": "python",
      "args": ["D:/Development/orchestrator/mcp_server.py"]
    }
  }
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent
TASKS_FILE = ROOT / "runner" / "tasks.AGENT.json"
RUNS_ROOT = ROOT / "runs"
RUN_WORKERS = ROOT / "run_workers.ps1"
STOP_WORKERS = ROOT / "stop_workers.ps1"
DISPATCH = ROOT / "runner" / "dispatch.py"
PM_DELEGATE = ROOT / "runner" / "pm_delegate.py"
PROMPTS_DIR = ROOT / "runner" / "prompts"

# ── Engine distribution rule (built from config) ──
_ENGINE_PREFIXES = {"claude": "Claude", "codex": "Codex", "gemini": "Gemini"}

def _build_engine_slots(engines_cfg: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Build ENGINE_SLOTS dynamically from the engines section in tasks JSON."""
    if not engines_cfg:
        # fallback: read from tasks file
        try:
            engines_cfg = _read_json(TASKS_FILE).get("engines", {})
        except Exception:
            engines_cfg = {}

    slots: list[dict[str, Any]] = []
    for engine_name in ("claude", "codex", "gemini"):
        ecfg = engines_cfg.get(engine_name, {})
        if not ecfg.get("enabled", True):
            continue
        count = int(ecfg.get("slots", 2))
        model = ecfg.get("model", "")
        prefix = _ENGINE_PREFIXES.get(engine_name, engine_name.capitalize())
        for _ in range(count):
            slot: dict[str, Any] = {"engine": engine_name, "prefix": prefix}
            if engine_name == "claude" and model:
                slot["claude_model"] = model
            elif engine_name == "codex" and model:
                slot["codex_model"] = model
            elif engine_name == "gemini" and model:
                slot["gemini_model"] = model
            slots.append(slot)

    # Guarantee at least 1 slot (fallback to codex)
    if not slots:
        slots.append({"engine": "codex", "prefix": "Codex"})
    return slots


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _write_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _manifest_path() -> Path | None:
    run_dir = RUNS_ROOT / "AGENT"
    mf = run_dir / "manifest.json"
    return mf if mf.exists() else None


def _ps(script: Path, *extra_args: str, timeout: int = 30) -> str:
    cmd = [
        "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
        "-File", str(script), *extra_args,
    ]
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    r = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8",
        errors="replace", timeout=timeout, cwd=str(WORKSPACE), env=env,
    )
    return (r.stdout + r.stderr).strip()


# ─────────────────────────────────────
# Tool implementations
# ─────────────────────────────────────

def tool_dispatch(tasks: list[dict[str, str]], request: str = "") -> dict[str, Any]:
    """Create tasks and launch workers. PM decides how many workers (1-8).
    Each task can optionally specify engine/model to override the slot default."""

    if not tasks:
        return {"error": "At least 1 task required"}
    if len(tasks) > 8:
        tasks = tasks[:8]

    cfg = _read_json(TASKS_FILE)
    engines_cfg = cfg.get("engines", {})
    engine_slots = _build_engine_slots(engines_cfg)
    defaults = cfg.get("defaults", {})

    workers = []
    for i, task in enumerate(tasks):
        slot = engine_slots[i % len(engine_slots)]
        task_id = f"AGENT-T{i + 1}"
        role = task.get("role", "General")
        goal = task.get("goal", "")
        scope = task.get("scope_paths", "")
        if isinstance(scope, str):
            scope = [s.strip() for s in scope.split(",") if s.strip()]

        # Allow PM to override engine/model per task
        task_engine = task.get("engine", slot["engine"])
        task_model = task.get("model", "")
        prefix = _ENGINE_PREFIXES.get(task_engine, task_engine.capitalize())

        prompt_file = PROMPTS_DIR / f"{task_id}-auto.md"
        prompt_content = f"""You are executing task {task_id} (Role: {role}).

## Goal: {goal}

### Scope
Files to work on:
{chr(10).join(f'- {p}' for p in scope)}

### Instructions
1. Read each file in scope completely
2. Understand the codebase context around these files
3. Execute the goal described above
4. Verify syntax after editing (python -c or node -c)
5. Print a summary of changes at the end

### Constraints
- ONLY modify files listed in scope
- Verify syntax after editing
"""
        prompt_file.write_text(prompt_content, encoding="utf-8")

        worker: dict[str, Any] = {
            "task_id": task_id,
            "enabled": True,
            "engine": task_engine,
            "owner": f"{prefix}-{role.replace(' ', '')}",
            "role": role,
            "work_method": task.get("work_method", "edit"),
            "repo": task.get("repo", "machining_monitor_server"),
            "scope_paths": [f"{task.get('repo', 'machining_monitor_server')}/{p}" for p in scope],
            "goal": goal,
            "done_when": task.get("done_when", ["task completed", "syntax verified"]),
            "prompt_file": f"orchestrator/runner/prompts/{task_id}-auto.md",
        }
        # Model: task-level > slot default
        if task_engine == "claude":
            worker["claude_model"] = task_model or slot.get("claude_model", "")
        elif task_engine == "codex":
            worker["codex_model"] = task_model or slot.get("codex_model", "")
        elif task_engine == "gemini":
            worker["gemini_model"] = task_model or slot.get("gemini_model", "")
        workers.append(worker)

    cfg["workers"] = workers
    defaults["pm_last_request"] = request
    defaults["pm_last_selected"] = [w["task_id"] for w in workers]
    defaults["pm_last_selected_count"] = len(workers)
    _write_json(TASKS_FILE, cfg)

    # Launch — model/reasoning are now read from engines config per-worker
    codex_cfg = engines_cfg.get("codex", {})
    codex_model = codex_cfg.get("model", "gpt-5.4")
    codex_reasoning = codex_cfg.get("reasoning_effort", "high")
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    subprocess.Popen(
        ["python", str(DISPATCH), "--tasks-file", str(TASKS_FILE),
         "--model", codex_model, "--reasoning-effort", codex_reasoning],
        cwd=str(WORKSPACE), env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    time.sleep(2)

    # Read manifest
    mf = _manifest_path()
    if mf:
        manifest = _read_json(mf)
        started = [
            {"task_id": s["task_id"], "engine": s["engine"], "owner": s["owner"], "pid": s["pid"]}
            for s in manifest.get("started", [])
        ]
        return {"ok": True, "started": started, "dashboard": "http://127.0.0.1:8877"}
    return {"ok": True, "message": "Launched, manifest not yet available"}


import re as _re


def _parse_token_usage(log_text: str, engine: str) -> dict[str, Any] | None:
    """Extract token usage from worker log based on engine type."""
    if not log_text:
        return None
    try:
        if engine == "claude":
            # Claude --output-format json: single JSON line with usage field
            for line in reversed(log_text.strip().splitlines()):
                line = line.strip()
                if line.startswith("{") and '"usage"' in line:
                    data = json.loads(line)
                    usage = data.get("usage", {})
                    model_usage = data.get("modelUsage", {})
                    cost = data.get("total_cost_usd")
                    input_t = usage.get("input_tokens", 0)
                    output_t = usage.get("output_tokens", 0)
                    cache_read = usage.get("cache_read_input_tokens", 0)
                    cache_create = usage.get("cache_creation_input_tokens", 0)
                    return {
                        "input_tokens": input_t,
                        "output_tokens": output_t,
                        "cache_read": cache_read,
                        "cache_create": cache_create,
                        "total_tokens": input_t + output_t + cache_read + cache_create,
                        "cost_usd": cost,
                        "model_usage": model_usage,
                    }
        elif engine == "codex":
            # Codex: "tokens used\n79,853" at end of log
            m = _re.search(r"tokens used\s*\n\s*([\d,]+)", log_text)
            if m:
                total = int(m.group(1).replace(",", ""))
                return {"total_tokens": total}
        elif engine == "gemini":
            # Gemini -o json: JSON object with stats.tokens
            for line in reversed(log_text.strip().splitlines()):
                line = line.strip()
                if line.startswith("{") and '"stats"' in line:
                    data = json.loads(line)
                    tokens = data.get("stats", {}).get("tokens", {})
                    if tokens:
                        return {
                            "input_tokens": tokens.get("inputTokens", 0),
                            "output_tokens": tokens.get("outputTokens", 0),
                            "total_tokens": tokens.get("totalTokens", 0),
                        }
            # Fallback: search for tokens block anywhere in log
            m = _re.search(r'"totalTokens"\s*:\s*(\d+)', log_text)
            if m:
                return {"total_tokens": int(m.group(1))}
    except Exception:
        pass
    return None


def tool_status() -> dict[str, Any]:
    """Check status of all running orchestrator workers (with token usage)."""
    mf = _manifest_path()
    if not mf:
        return {"ok": False, "error": "No active run found"}

    manifest = _read_json(mf)
    results = []
    total_tokens_all = 0
    total_cost_all = 0.0
    for entry in manifest.get("started", []):
        task_id = entry["task_id"]
        pid = entry.get("pid")
        engine = entry.get("engine", "?")
        log_file = Path(entry.get("log_file", ""))

        # Check if process is still running
        alive = False
        if pid:
            try:
                os.kill(pid, 0)
                alive = True
            except (OSError, ProcessLookupError):
                pass

        # Get last few lines of log + token usage
        log_tail = ""
        log_text = ""
        if log_file.exists():
            try:
                log_text = log_file.read_text(encoding="utf-8", errors="replace")
                lines = log_text.strip().splitlines()
                log_tail = "\n".join(lines[-5:]) if lines else ""
            except Exception:
                pass

        token_usage = _parse_token_usage(log_text, engine) if not alive else None
        if token_usage:
            total_tokens_all += token_usage.get("total_tokens", 0)
            total_cost_all += token_usage.get("cost_usd", 0) or 0

        entry_result: dict[str, Any] = {
            "task_id": task_id,
            "engine": engine,
            "owner": entry.get("owner", "?"),
            "pid": pid,
            "alive": alive,
            "state": "RUNNING" if alive else "DONE",
            "log_tail": log_tail,
        }
        if token_usage:
            entry_result["token_usage"] = token_usage
        results.append(entry_result)

    running = sum(1 for r in results if r["alive"])
    done = sum(1 for r in results if not r["alive"])
    return {
        "ok": True,
        "running": running,
        "done": done,
        "total_tokens": total_tokens_all,
        "total_cost_usd": round(total_cost_all, 6) if total_cost_all else None,
        "workers": results,
    }


def tool_stop() -> dict[str, Any]:
    """Stop all running orchestrator workers."""
    mf = _manifest_path()
    if not mf:
        return {"ok": False, "error": "No active run found"}

    manifest = _read_json(mf)
    killed = []
    for entry in manifest.get("started", []):
        pid = entry.get("pid")
        if not pid:
            continue
        try:
            os.kill(pid, 0)  # check alive
            subprocess.run(
                ["taskkill", "/F", "/PID", str(pid)],
                capture_output=True, timeout=5,
            )
            killed.append({"task_id": entry["task_id"], "pid": pid})
        except Exception:
            pass

    return {"ok": True, "killed": killed}


def tool_logs(task_id: str = "AGENT-T1", lines: int = 30) -> dict[str, Any]:
    """Read the last N lines of a worker's log."""
    log_file = RUNS_ROOT / "AGENT" / f"{task_id}.log"
    if not log_file.exists():
        return {"ok": False, "error": f"Log not found: {log_file}"}

    text = log_file.read_text(encoding="utf-8", errors="replace")
    all_lines = text.strip().splitlines()
    tail = all_lines[-lines:] if len(all_lines) > lines else all_lines
    return {"ok": True, "task_id": task_id, "total_lines": len(all_lines), "lines": tail}


def tool_dashboard(action: str = "status") -> dict[str, Any]:
    """Start or check the dashboard (port 8877)."""
    if action == "start":
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
        subprocess.Popen(
            ["python", str(ROOT / "dashboard.py")],
            cwd=str(ROOT), env=env,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return {"ok": True, "url": "http://127.0.0.1:8877"}

    # Check if running
    import urllib.request
    try:
        urllib.request.urlopen("http://127.0.0.1:8877/", timeout=2)
        return {"ok": True, "running": True, "url": "http://127.0.0.1:8877"}
    except Exception:
        return {"ok": True, "running": False, "url": "http://127.0.0.1:8877"}


# ─────────────────────────────────────
# MCP stdio server (JSON-RPC 2.0)
# ─────────────────────────────────────

TOOLS = {
    "orchestrator_dispatch": {
        "description": "Create and launch workers. PM decides count (1-8) and can override engine/model per task. Default engine/model from 'engines' config.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "request": {"type": "string", "description": "Natural language description of the work"},
                "tasks": {
                    "type": "array",
                    "description": "List of task definitions (1-8). Only create as many as needed.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "goal": {"type": "string", "description": "What this worker should accomplish"},
                            "scope_paths": {"type": "string", "description": "Comma-separated file paths relative to repo root"},
                            "role": {"type": "string", "description": "Short role name (e.g. Backend, Frontend, Config)"},
                            "engine": {"type": "string", "enum": ["claude", "codex", "gemini"], "description": "Override engine for this task"},
                            "model": {"type": "string", "description": "Override model for this task (e.g. claude-opus-4-6, gpt-5.4, gemini-2.5-pro)"},
                            "repo": {"type": "string", "description": "Repository name (default: machining_monitor_server)"},
                        },
                        "required": ["goal", "scope_paths"],
                    },
                },
            },
            "required": ["tasks"],
        },
        "fn": tool_dispatch,
    },
    "orchestrator_status": {
        "description": "Check status of all orchestrator workers (running/done, log tails).",
        "inputSchema": {"type": "object", "properties": {}},
        "fn": tool_status,
    },
    "orchestrator_stop": {
        "description": "Stop all running orchestrator workers.",
        "inputSchema": {"type": "object", "properties": {}},
        "fn": tool_stop,
    },
    "orchestrator_logs": {
        "description": "Read the last N lines of a worker's log file.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string", "default": "AGENT-T1"},
                "lines": {"type": "integer", "default": 30},
            },
        },
        "fn": tool_logs,
    },
    "orchestrator_dashboard": {
        "description": "Start or check the orchestrator dashboard (port 8877).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["start", "status"], "default": "status"},
            },
        },
        "fn": tool_dashboard,
    },
}


def _ensure_binary_stdio() -> tuple:
    """Windows에서 stdin/stdout을 바이너리 모드로 전환."""
    stdin = sys.stdin.buffer
    stdout = sys.stdout.buffer
    if sys.platform == "win32":
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    return stdin, stdout


_stdin, _stdout = _ensure_binary_stdio()


def _send(obj: dict[str, Any]) -> None:
    body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
    _stdout.write(header + body)
    _stdout.flush()


def _recv() -> dict[str, Any] | None:
    headers = {}
    while True:
        line = _stdin.readline()
        if not line:
            return None
        line = line.decode("utf-8", errors="replace").strip()
        if not line:
            break
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()

    length = int(headers.get("content-length", 0))
    if length <= 0:
        return None
    body = _stdin.read(length)
    return json.loads(body.decode("utf-8", errors="replace"))


def handle_request(msg: dict[str, Any]) -> dict[str, Any] | None:
    method = msg.get("method", "")
    rid = msg.get("id")
    params = msg.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": rid,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "orchestrator", "version": "1.0.0"},
            },
        }

    if method == "notifications/initialized":
        return None  # notification, no response

    if method == "tools/list":
        tool_list = []
        for name, spec in TOOLS.items():
            tool_list.append({
                "name": name,
                "description": spec["description"],
                "inputSchema": spec["inputSchema"],
            })
        return {"jsonrpc": "2.0", "id": rid, "result": {"tools": tool_list}}

    if method == "tools/call":
        tool_name = params.get("name", "")
        tool_args = params.get("arguments", {})
        spec = TOOLS.get(tool_name)
        if not spec:
            return {
                "jsonrpc": "2.0", "id": rid,
                "result": {"content": [{"type": "text", "text": f"Unknown tool: {tool_name}"}], "isError": True},
            }
        try:
            result = spec["fn"](**tool_args)
            return {
                "jsonrpc": "2.0", "id": rid,
                "result": {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]},
            }
        except Exception as exc:
            return {
                "jsonrpc": "2.0", "id": rid,
                "result": {"content": [{"type": "text", "text": f"Error: {exc}"}], "isError": True},
            }

    # Unknown method
    if rid is not None:
        return {
            "jsonrpc": "2.0", "id": rid,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }
    return None


def main() -> None:
    while True:
        msg = _recv()
        if msg is None:
            break
        response = handle_request(msg)
        if response is not None:
            _send(response)


if __name__ == "__main__":
    main()
