
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import ctypes
from collections import defaultdict, deque
from ctypes import wintypes
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent.resolve()
RUNS_ROOT = ROOT / "runs"
RUNNER_ROOT = ROOT / "runner"
RUN_SCRIPT = ROOT / "run_workers.ps1"
STOP_SCRIPT = ROOT / "stop_workers.ps1"
PM_SETTINGS_FILE = ROOT / "pm_settings.json"
_CPU_PREV: dict[int, tuple[float, float]] = {}
_PID_CACHE_TS: float = 0.0
_PID_CACHE_SET: set[int] = set()
_PM_CACHE_TS: float = 0.0
_PM_CACHE_DATA: dict[str, Any] | None = None
_DOC_TEXT_CACHE: dict[str, tuple[float, str]] = {}

ORCH_DOCS = [
    ROOT / "inbox.md",
    ROOT / "master_tasks.md",
    ROOT / "status_report.md",
    ROOT / "integration.md",
    ROOT / "results.md",
]


def _read_pm_settings() -> dict[str, Any]:
    try:
        if PM_SETTINGS_FILE.exists():
            data = json.loads(PM_SETTINGS_FILE.read_text(encoding="utf-8-sig"))
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {}


def _no_window_flags() -> int:
    try:
        return int(getattr(subprocess, "CREATE_NO_WINDOW", 0) or 0)
    except Exception:
        return 0


def _save_pm_settings(payload: dict[str, Any]) -> tuple[bool, str]:
    try:
        current = _read_pm_settings()
        current.update(payload)
        PM_SETTINGS_FILE.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
        return True, str(PM_SETTINGS_FILE)
    except Exception as exc:
        return False, str(exc)


def _pm_status() -> dict[str, Any]:
    status_path = ROOT / "status_report.md"
    master_path = ROOT / "master_tasks.md"
    pm_name = "Codex-PM"
    orch = ""
    last_update = ""
    last_line = ""
    counts = {"TODO": 0, "DOING": 0, "REVIEW": 0, "DONE": 0}
    progress = 0.0
    progress_source = "master_tasks"
    settings = _read_pm_settings()
    configured_pm_name = str(settings.get("pm_name", "")).strip()
    if configured_pm_name:
        pm_name = configured_pm_name

    try:
        text = status_path.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"Active ORCH:\s*`?([A-Z0-9_-]+)`?", text)
        if m:
            orch = m.group(1)
        pm_hits = re.findall(r"^\s*-\s*PM:\s*([^\n]+)$", text, flags=re.MULTILINE)
        if pm_hits:
            pm_name = pm_hits[-1].strip() or pm_name
        stamps = re.findall(r"^## \[(.+?)\]", text, flags=re.MULTILINE)
        if stamps:
            last_update = stamps[-1]
        lines = [x.strip() for x in text.splitlines() if x.strip()]
        if lines:
            last_line = lines[-1]
    except Exception:
        pass

    try:
        text = master_path.read_text(encoding="utf-8", errors="replace")
        task_items: list[tuple[str, str]] = []
        for match in re.finditer(
            r"### \[(ORCH-[A-Z0-9_-]+)\](.*?)(?=^### \[|^## |\Z)",
            text,
            flags=re.MULTILINE | re.DOTALL,
        ):
            task_id = str(match.group(1) or "").strip().upper()
            block = str(match.group(2) or "")
            sm = re.search(r"- status:\s*(TODO|DOING|REVIEW|DONE)\b", block, flags=re.IGNORECASE)
            status = str(sm.group(1) if sm else "TODO").upper()
            if task_id:
                task_items.append((task_id, status))

        if orch:
            prefix = f"{orch.upper()}-T"
            task_items = [x for x in task_items if x[0].startswith(prefix)]

        if task_items:
            counts = {"TODO": 0, "DOING": 0, "REVIEW": 0, "DONE": 0}
            for _tid, status in task_items:
                if status in counts:
                    counts[status] += 1
            total = sum(counts.values())
            progress = (counts["DONE"] / total * 100.0) if total > 0 else 0.0
        else:
            for st in counts.keys():
                counts[st] = len(re.findall(rf"- status:\s*{st}\b", text))
            total = sum(counts.values())
            progress = (counts["DONE"] / total * 100.0) if total > 0 else 0.0
    except Exception:
        pass

    # Runtime fallback: if master task status is stale, derive progress from latest run workers.
    try:
        want_orch = _orch_id(orch) if str(orch or "").strip() else ""
        runs = _list_runs(orch_filter=want_orch)
        if not runs and want_orch:
            runs = _list_runs(orch_filter="")
        if runs:
            latest = runs[0]
            if latest.get("orch_id"):
                orch = str(latest.get("orch_id"))
            # Fast path: when latest run already has no running workers, avoid heavy per-worker log scan.
            latest_running = int(latest.get("running", 0) or 0)
            latest_total = int(latest.get("total", 0) or 0)
            if latest_total > 0 and latest_running <= 0:
                progress = 100.0
                progress_source = "runtime_workers_fast"
            else:
                rs = _run_status(str(latest.get("name", "")))
                workers = rs.get("workers", []) if isinstance(rs, dict) else []
                if isinstance(workers, list) and workers:
                    runtime_progress = sum(float(w.get("progress", 0.0) or 0.0) for w in workers) / len(workers)
                    states = {str(w.get("state", "")).upper() for w in workers if isinstance(w, dict)}
                    if states and states.issubset({"DONE", "EXITED"}):
                        runtime_progress = 100.0
                    # PM card reflects actual latest run progress as source of truth.
                    progress = runtime_progress
                    progress_source = "runtime_workers"
            if (not last_update or last_update == "-") and latest.get("mtime"):
                last_update = str(latest.get("mtime"))
    except Exception:
        pass

    pm_pid = int(os.getpid())
    pm_metrics = _proc_metrics(pm_pid)

    return {
        "ok": True,
        "pm_name": pm_name,
        "orch": orch or "-",
        "last_update": last_update or "-",
        "progress": round(progress, 1),
        "progress_source": progress_source,
        "counts": counts,
        "last_line": last_line or "-",
        "pid": pm_pid,
        "metrics": pm_metrics,
    }


def _pm_status_cached(ttl_sec: float = 5.0) -> dict[str, Any]:
    global _PM_CACHE_TS, _PM_CACHE_DATA
    now = time.monotonic()
    if _PM_CACHE_DATA is not None and (now - _PM_CACHE_TS) < max(0.2, float(ttl_sec)):
        return dict(_PM_CACHE_DATA)
    data = _pm_status()
    _PM_CACHE_DATA = dict(data)
    _PM_CACHE_TS = now
    return data


def _orch_id(raw: str) -> str:
    value = re.sub(r"[^A-Z0-9_-]", "", (raw or "").strip().upper())
    return value or "AGENT"


def _tasks_file(orch: str) -> Path:
    return RUNNER_ROOT / f"tasks.{_orch_id(orch)}.json"


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None


def _save_json(path: Path, payload: dict[str, Any]) -> tuple[bool, str]:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return True, str(path)
    except Exception as exc:
        return False, str(exc)


def _safe_resolve(path_raw: str) -> Path | None:
    try:
        candidate = Path(path_raw)
        resolved = candidate.resolve() if candidate.is_absolute() else (WORKSPACE / candidate).resolve()
        resolved.relative_to(WORKSPACE)
        return resolved
    except Exception:
        return None


def _rel(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(WORKSPACE)).replace("\\", "/")
    except Exception:
        return str(path)


def _read_text(path: Path, max_chars: int = 350_000) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return "(binary or unreadable file)"
    if len(text) > max_chars:
        return text[:max_chars] + "\n\n... (truncated)"
    return text


def _tail(path: Path, n: int = 180) -> str:
    if not path.exists():
        return "(no log)"
    max_lines = max(1, int(n))
    try:
        # Fast tail for large files: read backward in chunks until enough lines.
        with path.open("rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            if size <= 0:
                return ""
            pos = size
            chunk = 16384
            data = b""
            while pos > 0 and data.count(b"\n") <= max_lines:
                take = min(chunk, pos)
                pos -= take
                f.seek(pos)
                data = f.read(take) + data
                if len(data) > 2_000_000:
                    break
        text = data.decode("utf-8", errors="replace")
        lines = text.splitlines()
        return "\n".join(lines[-max_lines:])
    except Exception:
        # Safe fallback
        q: deque[str] = deque(maxlen=max_lines)
        with path.open("r", encoding="utf-8", errors="replace") as f:
            for line in f:
                q.append(line.rstrip("\n"))
        return "\n".join(q)


def _pid_running(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        return int(pid) in _running_pid_set()
    except Exception:
        return False


def _running_pid_set(ttl_sec: float = 2.0) -> set[int]:
    global _PID_CACHE_TS, _PID_CACHE_SET
    now = time.monotonic()
    if (now - _PID_CACHE_TS) < max(0.2, float(ttl_sec)):
        return _PID_CACHE_SET

    live: set[int] = set()
    try:
        import psutil  # type: ignore

        live = {int(p) for p in psutil.pids()}
    except Exception:
        try:
            p = subprocess.run(
                ["tasklist", "/FO", "CSV", "/NH"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=_no_window_flags(),
            )
            for row in (p.stdout or "").splitlines():
                cols = [c.strip().strip('"') for c in row.split(",")]
                if len(cols) >= 2 and cols[1].isdigit():
                    live.add(int(cols[1]))
        except Exception:
            live = set()

    _PID_CACHE_SET = live
    _PID_CACHE_TS = now
    return _PID_CACHE_SET


def _proc_metrics(pid: int | None) -> dict[str, Any]:
    out = {"cpu_percent": 0.0, "rss_mb": 0.0, "threads": None}
    if not pid or not _pid_running(pid):
        if pid:
            _CPU_PREV.pop(int(pid), None)
        return out
    try:
        import psutil  # type: ignore

        proc = psutil.Process(int(pid))
        with proc.oneshot():
            cpu_t = float(proc.cpu_times().user + proc.cpu_times().system)
            rss = float(proc.memory_info().rss) / (1024.0 * 1024.0)
            th = int(proc.num_threads())
        now = time.monotonic()
        prev = _CPU_PREV.get(int(pid))
        cpu = 0.0
        if prev:
            dt = max(1e-6, now - prev[0])
            dc = max(0.0, cpu_t - prev[1])
            cpu = min(100.0, dc / (dt * max(int(os.cpu_count() or 1), 1)) * 100.0)
        _CPU_PREV[int(pid)] = (now, cpu_t)
        out["cpu_percent"] = round(cpu, 2)
        out["rss_mb"] = round(rss, 1)
        out["threads"] = th
    except Exception:
        fallback = _proc_metrics_win32(int(pid))
        if fallback is not None:
            cpu_t, rss_mb = fallback
            now = time.monotonic()
            prev = _CPU_PREV.get(int(pid))
            cpu = 0.0
            if prev:
                dt = max(1e-6, now - prev[0])
                dc = max(0.0, cpu_t - prev[1])
                cpu = min(100.0, dc / (dt * max(int(os.cpu_count() or 1), 1)) * 100.0)
            _CPU_PREV[int(pid)] = (now, cpu_t)
            out["cpu_percent"] = round(cpu, 2)
            out["rss_mb"] = round(rss_mb, 1)
    return out


class _FILETIME(ctypes.Structure):
    _fields_ = [("dwLowDateTime", wintypes.DWORD), ("dwHighDateTime", wintypes.DWORD)]


class _PROCESS_MEMORY_COUNTERS(ctypes.Structure):
    _fields_ = [
        ("cb", wintypes.DWORD),
        ("PageFaultCount", wintypes.DWORD),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
    ]


def _proc_metrics_win32(pid: int) -> tuple[float, float] | None:
    if os.name != "nt":
        return None
    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    PROCESS_VM_READ = 0x0010
    h_proc = ctypes.windll.kernel32.OpenProcess(
        PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, False, int(pid)
    )
    if not h_proc:
        return None
    try:
        creation = _FILETIME()
        exit_t = _FILETIME()
        kernel = _FILETIME()
        user = _FILETIME()
        ok_times = ctypes.windll.kernel32.GetProcessTimes(
            h_proc,
            ctypes.byref(creation),
            ctypes.byref(exit_t),
            ctypes.byref(kernel),
            ctypes.byref(user),
        )
        if not ok_times:
            return None
        pmc = _PROCESS_MEMORY_COUNTERS()
        pmc.cb = ctypes.sizeof(_PROCESS_MEMORY_COUNTERS)
        ok_mem = ctypes.windll.psapi.GetProcessMemoryInfo(
            h_proc, ctypes.byref(pmc), ctypes.sizeof(_PROCESS_MEMORY_COUNTERS)
        )
        if not ok_mem:
            return None
        k = (int(kernel.dwHighDateTime) << 32) | int(kernel.dwLowDateTime)
        u = (int(user.dwHighDateTime) << 32) | int(user.dwLowDateTime)
        cpu_total_sec = float(k + u) / 10_000_000.0
        rss_mb = float(pmc.WorkingSetSize) / (1024.0 * 1024.0)
        return cpu_total_sec, rss_mb
    except Exception:
        return None
    finally:
        ctypes.windll.kernel32.CloseHandle(h_proc)


def _load_config(orch: str) -> dict[str, Any]:
    return _read_json(_tasks_file(orch)) or {
        "orch_id": orch,
        "workspace": str(WORKSPACE),
        "defaults": {
            "model": "gpt-5.3-codex",
            "reasoning_effort": "xhigh",
            "global_prompt": "",
            "single_run_dir": True,
            "clean_run_dir": True,
            "prune_legacy_runs": True,
            "history_readonly_guard": True,
            "claude_cmd": "claude",
            "claude_args": ["--print", "{prompt}"],
        },
        "workers": [],
    }


def _worker_map(orch: str) -> dict[str, dict[str, Any]]:
    cfg = _load_config(orch)
    out: dict[str, dict[str, Any]] = {}
    for worker in cfg.get("workers", []) if isinstance(cfg.get("workers", []), list) else []:
        if isinstance(worker, dict):
            out[str(worker.get("task_id", ""))] = worker
    return out


def _list_runs(orch_filter: str = "") -> list[dict[str, Any]]:
    RUNS_ROOT.mkdir(parents=True, exist_ok=True)
    out: list[dict[str, Any]] = []
    run_dirs = [p for p in RUNS_ROOT.iterdir() if p.is_dir()]
    run_dirs.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    now_ts = time.time()
    want_orch = _orch_id(orch_filter) if str(orch_filter or "").strip() else ""
    for idx, run_dir in enumerate(run_dirs):
        manifest = _read_json(run_dir / "manifest.json")
        run_mtime = run_dir.stat().st_mtime
        mtime = datetime.fromtimestamp(run_mtime).strftime("%Y-%m-%d %H:%M:%S")
        if not manifest:
            if want_orch:
                continue
            out.append({"name": run_dir.name, "mtime": mtime, "running": 0, "total": 0, "orch_id": ""})
            continue
        run_orch = str(manifest.get("orch_id", ""))
        if want_orch and _orch_id(run_orch) != want_orch:
            continue
        started = manifest.get("started", [])
        running = 0
        # Keep runs API fast: check pid state only for very recent rows.
        should_probe = idx < 20 or (now_ts - run_mtime) < 6 * 3600
        if should_probe:
            running = sum(1 for e in started if _pid_running(int(e.get("pid")) if e.get("pid") else None))
        out.append({"name": run_dir.name, "mtime": mtime, "running": running, "total": len(started), "orch_id": run_orch})
    return out


def _collect_docs(run_name: str, task_id: str, worker: dict[str, Any]) -> list[dict[str, Any]]:
    run_dir = RUNS_ROOT / run_name
    docs: dict[str, dict[str, Any]] = {}

    def add(path: Path | None, kind: str, label: str) -> None:
        if not path or not path.exists() or not path.is_file():
            return
        key = str(path.resolve()).lower()
        if key in docs:
            return
        docs[key] = {
            "kind": kind,
            "label": label,
            "path": _rel(path),
            "size": int(path.stat().st_size),
            "mtime": datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        }

    log_path = _safe_resolve(str(worker.get("log_file", "")))
    if not log_path:
        log_path = run_dir / f"{task_id}.log"
    add(log_path, "log", log_path.name)

    prompt_path = _safe_resolve(str(worker.get("prompt_file", "")))
    if prompt_path:
        add(prompt_path, "prompt", prompt_path.name)

    add(run_dir / "manifest.json", "manifest", "manifest.json")

    for doc in ORCH_DOCS:
        try:
            if not doc.exists():
                continue
            key = str(doc.resolve()).lower()
            mtime = float(doc.stat().st_mtime)
            cached = _DOC_TEXT_CACHE.get(key)
            if cached is None or float(cached[0]) != mtime:
                _DOC_TEXT_CACHE[key] = (mtime, doc.read_text(encoding="utf-8", errors="replace"))
            if task_id and task_id in _DOC_TEXT_CACHE[key][1]:
                add(doc, "report", doc.name)
        except Exception:
            pass

    result = list(docs.values())
    result.sort(key=lambda x: (x["kind"], x["label"]))
    return result


def _infer_progress(state: str, log_text: str, docs_count: int) -> int:
    p = 10
    st = (state or "").upper()
    if st == "DONE":
        return 100
    if st == "RUNNING":
        p = 55
    elif st == "BLOCKED":
        p = 30
    elif st == "DONE":
        p = 90
    elif st == "FAILED":
        p = 35
    elif st == "EXITED":
        p = 75
    t = (log_text or "").lower()
    for token, delta in [("apply_patch", 10), ("updated the following files", 10), ("success", 5), ("completed", 10), ("done", 10), ("error", -10), ("fail", -10)]:
        if token in t:
            p += delta
    p += min(15, docs_count * 3)
    return max(0, min(100, p))


def _classify_state(*, running: bool, log_text: str) -> str:
    if running:
        return "RUNNING"
    text = (log_text or "").strip()
    if not text:
        return "EXITED"
    t = text.lower()
    fail_tokens = [
        "traceback (most recent call last)",
        "i can't find any task definition file",
        "cannot find any task definition file",
        "[fail]",
        "fatal:",
    ]
    done_tokens = [
        "updated the following files",
        "apply_patch",
        "compile check passed",
        "done",
        "completed",
        "success",
        "changed files",
        "residual risk",
        "runtime risk is low",
    ]
    blocked_tokens = [
        "rejected: blocked by policy",
        "read-only policy",
        "[guard]",
        "switched to manual",
    ]
    if any(token in t for token in fail_tokens):
        return "FAILED"
    if any(token in t for token in done_tokens):
        return "DONE"
    if any(token in t for token in blocked_tokens):
        return "BLOCKED"
    return "DONE"


def _activity_from_log(log_text: str) -> str:
    text = (log_text or "").replace("\r", "")
    if not text.strip():
        return "idle"
    skip = (
        "tokens used",
        "thinking",
        "plan update",
        "exec",
        "codex",
        "success.",
        "done",
        "completed",
    )
    for raw in reversed(text.splitlines()):
        line = raw.strip()
        if not line:
            continue
        low = line.lower()
        if any(low == s or low.startswith(s + " ") for s in skip):
            continue
        if line.startswith(("```", "---", "===", "**")):
            continue
        if len(line) > 88:
            line = line[:85] + "..."
        return line
    return "running"


def _extract_int(raw: str | None) -> int | None:
    if raw is None:
        return None
    s = str(raw).strip().replace(",", "")
    if not s:
        return None
    if not re.fullmatch(r"-?\d+", s):
        return None
    try:
        return int(s)
    except Exception:
        return None


def _token_usage_from_text(log_text: str) -> dict[str, int | None]:
    text = (log_text or "").replace("\r", "")
    if not text.strip():
        return {"input": None, "output": None, "total": None}

    patterns = {
        "input": [
            r"\binput[_\s-]?tokens?\s*[:=]\s*([0-9,]+)",
            r"\bin[_\s-]?tokens?\s*[:=]\s*([0-9,]+)",
        ],
        "output": [
            r"\boutput[_\s-]?tokens?\s*[:=]\s*([0-9,]+)",
            r"\bout[_\s-]?tokens?\s*[:=]\s*([0-9,]+)",
        ],
        "total": [
            r"\btotal[_\s-]?tokens?\s*[:=]\s*([0-9,]+)",
            r"\btokens?\s+used\s*[:=]\s*([0-9,]+)",
            r"\bused\s+tokens?\s*[:=]\s*([0-9,]+)",
            r"\btokens?\s+used\s*\n\s*([0-9,]+)",
            r"\btotal\s*\n\s*([0-9,]+)\s*tokens?",
        ],
    }

    out: dict[str, int | None] = {"input": None, "output": None, "total": None}
    for key, rx_list in patterns.items():
        for rx in rx_list:
            m = re.search(rx, text, flags=re.IGNORECASE)
            if not m:
                continue
            value = _extract_int(m.group(1))
            if value is not None:
                out[key] = value
                break

    if out["total"] is None and out["input"] is not None and out["output"] is not None:
        out["total"] = int(out["input"]) + int(out["output"])

    return out


def _run_status(run_name: str) -> dict[str, Any]:
    manifest = _read_json(RUNS_ROOT / run_name / "manifest.json")
    if not manifest:
        return {"ok": False, "error": "manifest not found", "workers": [], "manual": []}

    orch = str(manifest.get("orch_id", ""))
    workers_cfg = _worker_map(orch)
    workers: list[dict[str, Any]] = []
    running = 0
    total_cpu = 0.0
    total_mem = 0.0
    total_tokens = 0
    by_role: dict[str, list[int]] = defaultdict(list)

    for entry in manifest.get("started", []):
        if not isinstance(entry, dict):
            continue
        task_id = str(entry.get("task_id", ""))
        cfg = workers_cfg.get(task_id, {})
        role = str(entry.get("role", "") or cfg.get("role", "")) or "-"
        owner = str(entry.get("owner", "") or cfg.get("owner", "")) or "-"
        engine = str(entry.get("engine", "") or cfg.get("engine", "")) or "-"
        pid = int(entry.get("pid")) if entry.get("pid") else None
        is_running = _pid_running(pid)
        state = "RUNNING" if is_running else "EXITED"
        metrics = _proc_metrics(pid)

        if state == "RUNNING":
            running += 1
            total_cpu += float(metrics.get("cpu_percent") or 0.0)
            total_mem += float(metrics.get("rss_mb") or 0.0)

        merged = dict(cfg)
        merged.update(entry)
        docs = _collect_docs(run_name, task_id, merged)
        log_path = _safe_resolve(str(merged.get("log_file", "")))
        if not log_path:
            log_path = RUNS_ROOT / run_name / f"{task_id}.log"
        log_tail = _tail(log_path, 400)
        tok = _token_usage_from_text(log_tail)
        tok_total = int(tok["total"]) if tok.get("total") is not None else 0
        total_tokens += tok_total
        state = _classify_state(running=is_running, log_text=log_tail)
        if (not is_running) and engine == "claude-cli" and state == "EXITED":
            # Claude CLI lane is one-shot by design in this runner; treat clean exit as done.
            state = "DONE"
        progress = _infer_progress(state, log_tail, len(docs))
        activity = _activity_from_log(log_tail)
        hint = ""
        if state == "BLOCKED":
            hint = "policy/write blocked; check lane log and guard"
        elif engine == "claude-cli" and state == "DONE":
            hint = "one-shot completed"
        by_role[role].append(progress)

        workers.append(
            {
                "task_id": task_id,
                "owner": owner,
                "role": role,
                "engine": engine,
                "pid": pid,
                "state": state,
                "metrics": metrics,
                "progress": progress,
                "tokens": {
                    "input": tok.get("input"),
                    "output": tok.get("output"),
                    "total": tok.get("total"),
                },
                "activity": activity,
                "docs_count": len(docs),
                "log_file": str(merged.get("log_file", "")),
                "prompt_file": str(merged.get("prompt_file", "")),
                "state_hint": hint,
            }
        )

    role_summary = [
        {"role": role, "progress": round(sum(vals) / max(1, len(vals)), 1), "workers": len(vals)}
        for role, vals in sorted(by_role.items())
    ]

    return {
        "ok": True,
        "orch_id": orch,
        "model": str(manifest.get("model", "")),
        "reasoning_effort": str(manifest.get("reasoning_effort", "")),
        "workers": workers,
        "manual": manifest.get("manual", []),
        "role_summary": role_summary,
        "summary": {
            "running": running,
            "total": len(workers),
            "avg_cpu": round(total_cpu / max(1, running), 1) if running else 0.0,
            "mem_mb": round(total_mem, 1),
            "tokens_total": int(total_tokens),
        },
    }


def _run_documents(run_name: str, task_filter: str | None = None) -> dict[str, Any]:
    manifest = _read_json(RUNS_ROOT / run_name / "manifest.json")
    if not manifest:
        return {"ok": False, "error": "manifest not found", "tasks": []}
    orch = str(manifest.get("orch_id", ""))
    workers_cfg = _worker_map(orch)
    out: list[dict[str, Any]] = []
    for entry in manifest.get("started", []):
        if not isinstance(entry, dict):
            continue
        task_id = str(entry.get("task_id", ""))
        if task_filter and task_id != task_filter:
            continue
        merged = dict(workers_cfg.get(task_id, {}))
        merged.update(entry)
        out.append(
            {
                "task_id": task_id,
                "owner": str(merged.get("owner", "")),
                "role": str(merged.get("role", "")),
                "engine": str(merged.get("engine", "")),
                "documents": _collect_docs(run_name, task_id, merged),
            }
        )
    return {"ok": True, "tasks": out}


def _tool_status() -> dict[str, Any]:
    claude = next(
        (
            n
            for n in [
                "claude-code",
                "claude-code.cmd",
                "claude-code.ps1",
                "claude",
                "claude.cmd",
                "claude.ps1",
            ]
            if shutil.which(n)
        ),
        "",
    )
    return {"ok": True, "codex": bool(shutil.which("codex")), "claude": bool(claude), "claude_cmd": claude or "(not found)"}


def _start(payload: dict[str, Any]) -> dict[str, Any]:
    orch = _orch_id(str(payload.get("orch_id", "AGENT")))
    model = str(payload.get("model", "gpt-5.3-codex"))
    reasoning = str(payload.get("reasoning_effort", "xhigh"))

    if isinstance(payload.get("config"), dict):
        workers = payload["config"].get("workers", [])
        if isinstance(workers, list) and len(workers) > 10:
            return {"ok": False, "error": "workers limit exceeded (max 10)"}
        ok, detail = _save_json(_tasks_file(orch), payload["config"])
        if not ok:
            return {"ok": False, "error": detail}

    cmd = [
        "powershell",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(RUN_SCRIPT),
        "-OrchId",
        orch,
        "-Model",
        model,
        "-ReasoningEffort",
        reasoning,
    ]
    pm_request = str(payload.get("pm_request", "")).strip()
    pm_delegate = bool(payload.get("pm_delegate")) or bool(pm_request)
    min_workers = int(payload.get("min_workers", 1) or 1)
    max_workers = int(payload.get("max_workers", 10) or 10)
    if pm_delegate:
        cmd.append("-PmDelegate")
    if pm_request:
        cmd += ["-PmRequest", pm_request]
    if pm_delegate:
        cmd += ["-MinWorkers", str(max(1, min_workers)), "-MaxWorkers", str(max(1, min(10, max_workers)))]
    if bool(payload.get("dry_run")):
        cmd.append("-DryRun")
    p = subprocess.run(
        cmd,
        cwd=str(WORKSPACE),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=_no_window_flags(),
    )
    return {"ok": p.returncode == 0, "code": p.returncode, "stdout": p.stdout, "stderr": p.stderr}


def _stop(payload: dict[str, Any]) -> dict[str, Any]:
    cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(STOP_SCRIPT)]
    run_name = str(payload.get("run_name", "")).strip()
    if run_name:
        cmd += ["-RunName", run_name]
    p = subprocess.run(
        cmd,
        cwd=str(WORKSPACE),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=_no_window_flags(),
    )
    return {"ok": p.returncode == 0, "code": p.returncode, "stdout": p.stdout, "stderr": p.stderr}


class Handler(BaseHTTPRequestHandler):
    def _json(self, obj: Any, status: int = HTTPStatus.OK) -> None:
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _html(self, html: str) -> None:
        b = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _body(self) -> dict[str, Any]:
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except Exception:
            n = 0
        raw = self.rfile.read(n) if n > 0 else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def do_GET(self) -> None:  # noqa: N802
        p = urlparse(self.path)
        if p.path == "/":
            self._html(INDEX_HTML)
            return
        if p.path == "/api/runs":
            qs = parse_qs(p.query)
            orch = (qs.get("orch") or [""])[0]
            runs = _list_runs(orch_filter=str(orch or ""))
            self._json({"ok": True, "runs": runs, "latest": runs[0]["name"] if runs else ""})
            return
        if p.path == "/api/orch":
            ids = sorted({_orch_id(m.group(1)) for m in [re.match(r"tasks\.(.+)\.json$", x.name) for x in RUNNER_ROOT.glob("tasks.*.json")] if m})
            self._json({"ok": True, "orch_ids": ids})
            return
        if p.path == "/api/tools":
            self._json(_tool_status())
            return
        if p.path == "/api/pm":
            self._json(_pm_status_cached())
            return
        if p.path.startswith("/api/config/"):
            orch = _orch_id(unquote(p.path.split("/api/config/", 1)[1]))
            self._json({"ok": True, "config": _load_config(orch)})
            return
        if p.path.startswith("/api/run/") and p.path.endswith("/status"):
            run_name = unquote(p.path[len("/api/run/") : -len("/status")].strip("/"))
            self._json(_run_status(run_name))
            return
        if p.path.startswith("/api/run/") and p.path.endswith("/documents"):
            run_name = unquote(p.path[len("/api/run/") : -len("/documents")].strip("/"))
            qs = parse_qs(p.query)
            task = (qs.get("task") or [""])[0].strip()
            self._json(_run_documents(run_name, task or None))
            return
        if p.path.startswith("/api/run/") and "/log/" in p.path:
            seg = p.path[len("/api/run/") :]
            run_name, task_id = seg.split("/log/", 1)
            qs = parse_qs(p.query)
            n = int((qs.get("tail") or ["180"])[0])
            manifest = _read_json(RUNS_ROOT / unquote(run_name) / "manifest.json")
            if not manifest:
                self._json({"ok": False, "error": "manifest not found"})
                return
            log_file = next((Path(str(e.get("log_file", ""))) for e in manifest.get("started", []) if str(e.get("task_id", "")) == unquote(task_id)), None)
            if log_file is None:
                self._json({"ok": False, "error": "task not found"})
                return
            self._json({"ok": True, "text": _tail(log_file, n)})
            return
        if p.path == "/api/read":
            qs = parse_qs(p.query)
            path_raw = (qs.get("path") or [""])[0]
            resolved = _safe_resolve(unquote(path_raw))
            if not resolved or not resolved.exists() or not resolved.is_file():
                self._json({"ok": False, "error": "file not found or blocked"}, HTTPStatus.BAD_REQUEST)
                return
            self._json({"ok": True, "path": _rel(resolved), "text": _read_text(resolved)})
            return
        self._json({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        p = urlparse(self.path)
        body = self._body()
        if p.path == "/api/start":
            self._json(_start(body))
            return
        if p.path == "/api/stop":
            self._json(_stop(body))
            return
        if p.path == "/api/pm/save":
            pm_name = str(body.get("pm_name", "")).strip()
            if not pm_name:
                self._json({"ok": False, "error": "pm_name is required"}, HTTPStatus.BAD_REQUEST)
                return
            ok, detail = _save_pm_settings({"pm_name": pm_name})
            self._json({"ok": True, "path": detail} if ok else {"ok": False, "error": detail}, HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST)
            return
        if p.path == "/api/config/save":
            orch = _orch_id(str(body.get("orch_id", "AGENT")))
            config = body.get("config", {})
            if not isinstance(config, dict):
                self._json({"ok": False, "error": "config must be object"}, HTTPStatus.BAD_REQUEST)
                return
            workers = config.get("workers", [])
            if isinstance(workers, list) and len(workers) > 10:
                self._json({"ok": False, "error": "workers limit exceeded (max 10)"}, HTTPStatus.BAD_REQUEST)
                return
            ok, detail = _save_json(_tasks_file(orch), config)
            self._json({"ok": True, "path": detail} if ok else {"ok": False, "error": detail}, HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST)
            return
        self._json({"ok": False, "error": "not found"}, HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args: Any) -> None:
        return

INDEX_HTML = """<!doctype html>
<html lang='ko'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<title>ORCH Dashboard</title>
<style>
:root{--bg:#eef3fb;--card:#f8fbff;--line:#c8d7ef;--text:#10274f;--top1:#1f3f8f;--top2:#3152a9;--ok:#0f8b3d;--bad:#b42318}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Segoe UI',Arial,sans-serif;text-align:center}
.top{height:56px;background:linear-gradient(90deg,var(--top1),var(--top2));color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 12px}
.top .row{justify-content:flex-end}
.wrap{height:calc(100vh - 56px);display:grid;grid-template-columns:minmax(520px,34vw) 1fr;gap:10px;padding:10px;overflow:hidden}
.left{display:grid;grid-template-rows:auto 1fr;gap:10px;min-height:0}.right{display:grid;grid-template-rows:auto 1fr;gap:10px;min-height:0}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px;min-height:0}
.row{display:flex;gap:7px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:center}
input,select,button{height:32px;border:1px solid #b6c7e4;border-radius:8px;padding:0 9px;font-size:13px;color:var(--text);text-align:center}
button{font-weight:700;cursor:pointer}
.tbl{overflow:auto;border:1px solid var(--line);border-radius:8px;background:#fff;min-height:0}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border-bottom:1px solid #e6edfb;padding:6px 8px;text-align:center;vertical-align:middle}
th{position:sticky;top:0;background:#eef4ff;font-weight:800}
.ok{color:var(--ok);font-weight:800}.warn{color:#b26b00;font-weight:800}.bad{color:var(--bad);font-weight:800}
.bar{width:120px;height:9px;border-radius:999px;background:#e4edfc;overflow:hidden;border:1px solid #cedbf3;margin:0 auto}
.bar span{display:block;height:100%}.cpu span{background:#2b67dc}.mem span{background:#19a68a}.prog span{background:#159a6a}
.spark{width:120px;height:22px;margin:0 auto}
.pm{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:8px;align-items:stretch}
.pm .k{font-size:11px;color:#4f6794}
.pm .v{font-size:14px;font-weight:800;color:#10274f}
.pm .cell{border:1px solid #d4e2f7;border-radius:8px;background:#f4f8ff;padding:6px}
.msg{margin-top:8px;min-height:24px;padding:6px 10px;border:1px solid #d4e2f7;border-radius:8px;background:#f4f8ff;color:#27406f;font-size:12px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cfg{overflow:auto;border:1px solid var(--line);border-radius:8px;background:#fff;min-height:0}
.cfr{display:grid;grid-template-columns:32px 52px 122px 88px 120px 118px 108px 88px 1fr 58px;gap:6px;padding:6px;border-bottom:1px solid #e9f0fc;align-items:center;text-align:center}
.cfr input,.cfr select{width:100%;min-width:0}
.head{position:sticky;top:0;background:#eef4ff;font-weight:800;z-index:1}
input[type='checkbox']{width:18px;height:18px;padding:0;margin:0 auto;accent-color:#2b67dc;cursor:pointer}
.role-pill{display:inline-block;border:1px solid #9bb3e7;border-radius:999px;padding:2px 8px;font-size:11px;background:#ecf2ff;margin-right:6px;margin-bottom:4px}
.viewer{display:none}
.doc-item{display:grid;grid-template-columns:84px 1fr 80px 160px 74px;gap:8px;padding:6px 8px;border-bottom:1px solid #e9f0fc;align-items:center;text-align:center}
.doc-item:last-child{border-bottom:none}
.activity{max-width:260px;margin:0 auto;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#27406f;font-size:12px}
</style>
</head>
<body>
<div class='top'>
  <div style='font-size:20px;font-weight:800'>Orchestrator Dashboard</div>
  <div class='row'>
    <input id='pmNameIn' placeholder='PM name' style='width:120px'>
    <button onclick='savePmName()'>SavePM</button>
    <span id='toolCodex'>codex:-</span>
    <span id='toolClaude'>claude:-</span>
    <label>Auto</label><input id='auto' type='checkbox' checked>
    <label>sec</label><input id='sec' type='number' min='1' max='30' value='3' style='width:62px'>
    <button onclick='refreshAll()'>Refresh</button>
  </div>
</div>
<div class='wrap'>
  <div class='left'>
    <div class='card'>
      <div class='row'><input id='orch' value='AGENT' style='width:120px'><select id='run' onchange='loadRun()' style='width:260px'></select></div>
      <div class='row' style='margin-top:8px'><input id='model' value='gpt-5.3-codex' style='width:160px'><input id='reason' value='xhigh' style='width:90px'><button onclick='startRun(false)'>Start</button><button onclick='startRun(true)'>DryRun</button><button onclick='stopRun()'>Stop</button></div>
      <div class='row' style='margin-top:8px'><label style='font-weight:700'>Global Prompt</label><input id='globalPrompt' placeholder='all workers common instruction' style='width:min(680px,95%)'><button onclick='saveCfg()'>ApplyPrompt</button></div>
      <div class='row' style='margin-top:8px'>
        <button onclick='loadCfg()'>LoadCfg</button><button onclick='saveCfg()'>SaveCfg</button>
        <button onclick='addW(\"codex\")'>+Codex</button><button onclick='addW(\"claude-cli\")'>+Claude</button>
        <input id='wcnt' type='number' min='1' max='10' value='6' style='width:70px'>
        <button onclick='applyWorkerCount()'>ApplyCount</button>
        <button onclick='enableAll(true)'>EnableAll</button><button onclick='enableAll(false)'>DisableAll</button>
        <button onclick='autoAssignRoles()'>AutoRole</button>
      </div>
      <div class='row' style='margin-top:8px'><button onclick='distributeAndStart()'>Distribute+Start</button></div>
      <div id='sum' style='margin-top:8px;font-size:12px;color:#4f6794'></div>
      <div id='roleStats' style='margin-top:6px;font-size:12px;color:#4f6794'></div>
    </div>
    <div class='card' style='display:grid;grid-template-rows:auto 1fr;gap:8px;min-height:0'>
      <div style='font-size:14px;font-weight:800'>Worker / Role Planner (max 10)</div>
      <div class='cfg' id='cfg'></div>
    </div>
  </div>
  <div class='right'>
    <div class='card'>
      <div class='row'><div id='m1'>running:0</div><div id='m2'>total:0</div><div id='m3'>avg cpu:0%</div><div id='m4'>mem:0MB</div><div id='m5'>tokens:0</div></div>
      <div class='pm' style='margin-top:8px'>
        <div class='cell'><div class='k'>PM</div><div class='v' id='pmName'>Codex-PM</div></div>
        <div class='cell'><div class='k'>마지막 업데이트</div><div class='v' id='pmLast'>-</div></div>
        <div class='cell'><div class='k'>진행률</div><div class='v' id='pmProg'>0.0%</div></div>
        <div class='cell'><div class='k'>PM cpu/mem/pid</div><div class='v' id='pmRuntime'>0.00% / 0.0MB / -</div></div>
      </div>
      <div id='msg' class='msg'>(status)</div>
    </div>
    <div class='card' style='display:grid;grid-template-rows:minmax(260px,1fr) minmax(90px,160px);gap:10px;min-height:0'>
      <div class='tbl'><table><thead><tr><th>Task</th><th>Owner</th><th>Role</th><th>Engine</th><th>PID</th><th>State</th><th>CPU</th><th>MEM</th><th>Progress</th><th>Tokens</th><th>Activity</th><th>Log</th><th>Docs</th></tr></thead><tbody id='wb'></tbody></table></div>
      <div class='tbl'><table><thead><tr><th>Manual</th><th>Owner</th><th>Role</th><th>Engine</th><th>Repo</th><th>Goal</th></tr></thead><tbody id='mb'></tbody></table></div>
    </div>
  </div>
</div>
<div id='viewer' class='viewer'><div class='viewer-card'><div class='viewer-head'><div id='viewerTitle'>View</div><button onclick='closeViewer()'>Close</button></div><div id='viewerBody' class='viewer-body'>(no data)</div></div></div>
<script>
let cfg=null,hist={},timer=null,pmState=null;
const METHOD_ROLE_MAP={connection:'Core/Connection',ui:'UI/Design',runtime:'Backend/Runtime',diagnostics:'Diagnostics/Search',auth:'Auth/Login',validate:'Validation/QA',integration:'Integration',custom:'Custom'};
const suggestRoleByMethod=(m)=>METHOD_ROLE_MAP[String(m||'').trim().toLowerCase()]||'Worker';
function methodOptions(selected){
  const cur=String(selected||'').trim().toLowerCase();
  const items=['connection','ui','runtime','diagnostics','auth','validate','integration','custom'];
  return items.map(v=>`<option value='${v}' ${cur===v?'selected':''}>${v}</option>`).join('');
}
const q=(s)=>document.querySelector(s),qa=(s)=>[...document.querySelectorAll(s)];
async function api(u,o={}){
  const hasQ = u.includes('?');
  const url = `${u}${hasQ?'&':'?'}_ts=${Date.now()}`;
  const opts = Object.assign({cache:'no-store'}, o||{});
  const r = await fetch(url, opts);
  return await r.json();
}
const esc=(v)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;');
function push(task,cpu,mem){if(!hist[task])hist[task]={cpu:[],mem:[]};hist[task].cpu.push(Number(cpu||0));hist[task].mem.push(Number(mem||0));while(hist[task].cpu.length>40)hist[task].cpu.shift();while(hist[task].mem.length>40)hist[task].mem.shift();}
function spark(task){
  const h=hist[task]||{cpu:[],mem:[]}; const c=h.cpu||[]; const m=h.mem||[];
  if(c.length<2&&m.length<2)return `<svg class='spark' viewBox='0 0 120 22'><line x1='0' y1='18' x2='120' y2='18' stroke='#cbd8f2'/></svg>`;
  const n=Math.max(c.length,m.length), st=120/Math.max(1,n-1);
  const maxv = Math.max(1, ...c.map(v=>Number(v||0)), ...m.map(v=>Number(v||0)));
  const y=(v)=>`${(18-Math.max(0,Math.min(16,(Number(v||0)/maxv)*16))).toFixed(1)}`;
  const pc=c.map((v,i)=>`${(i*st).toFixed(1)},${y(v)}`).join(' ');
  const pm=m.map((v,i)=>`${(i*st).toFixed(1)},${y(v)}`).join(' ');
  return `<svg class='spark' viewBox='0 0 120 22'>
    <polyline fill='none' stroke='#2b67dc' stroke-width='1.4' points='${pc}'/>
    <polyline fill='none' stroke='#19a68a' stroke-width='1.4' points='${pm}'/>
    <line x1='0' y1='18' x2='120' y2='18' stroke='#cbd8f2'/>
  </svg>`;
}
function bar(cls,val){const v=Math.max(0,Math.min(100,Number(val)||0));return `<div class='bar ${cls}'><span style='width:${v}%'></span></div>`;}
function _htmlSafe(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function openViewer(title,text){
  const t = String(text ?? '');
  const win = window.open('', '_blank', 'width=1120,height=820,resizable=yes,scrollbars=yes');
  if(!win){ setLogText('Popup blocked. Allow popups to view logs.'); return; }
  const safeTitle = _htmlSafe(title || 'View');
  const safeText = _htmlSafe(t);
  const popupScript = "<scr"+"ipt>document.getElementById('copyBtn').onclick=async()=>{const v=document.getElementById('txt').value;try{await navigator.clipboard.writeText(v);}catch(e){document.getElementById('txt').select();document.execCommand('copy');}};</scr"+"ipt>";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
  <style>body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#eef3fb;color:#10274f}
  .top{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:#3152a9;color:#fff}
  .btn{height:30px;border:1px solid #b6c7e4;border-radius:8px;padding:0 10px;background:#fff;color:#10274f;font-weight:700;cursor:pointer}
  #txt{width:100%;height:calc(100vh - 48px);box-sizing:border-box;border:0;outline:none;padding:12px;font-family:Consolas,'Courier New',monospace;font-size:12px;background:#f7faff;color:#183059;white-space:pre}</style>
  </head><body><div class="top"><div>${safeTitle}</div><div><button class="btn" id="copyBtn">Copy</button></div></div>
  <textarea id="txt" readonly>${safeText}</textarea>
  ${popupScript}
  </body></html>`;
  win.document.open(); win.document.write(html); win.document.close();
}
function closeViewer(){ return; }
function setDocsText(t){ setLogText(String(t||'')); }
function setLogText(t){
  const el=q('#msg');
  if(!el) return;
  el.textContent=String(t||'');
}
function renderRoleSummary(items){if(!items||!items.length){q('#roleStats').textContent='';return;}q('#roleStats').innerHTML=items.map(x=>`<span class='role-pill'>${esc(x.role)}: ${Number(x.progress||0).toFixed(1)}% (${Number(x.workers||0)})</span>`).join(' ');}

async function refreshTools(){const d=await api('/api/tools');q('#toolCodex').textContent=`codex:${d.codex?'OK':'MISS'}`;q('#toolClaude').textContent=`claude:${d.claude?d.claude_cmd:'MISS'}`;}
async function refreshPm(){
  const d=await api('/api/pm');
  if(!d||!d.ok)return;
  pmState=d;
  q('#pmName').textContent=d.pm_name||'Codex-PM';
  q('#pmNameIn').value=d.pm_name||'Codex-PM';
  q('#pmLast').textContent=d.last_update||'-';
  q('#pmProg').textContent=`${Number(d.progress||0).toFixed(1)}%`;
  const pid = Number(d.pid||0);
  const cpu = Number(d.metrics?.cpu_percent||0).toFixed(2);
  const mem = Number(d.metrics?.rss_mb||0).toFixed(1);
  q('#pmRuntime').textContent=`${cpu}% / ${mem}MB / ${pid||'-'}`;
  if(pid){ setLogText(`PM pid=${pid} cpu=${cpu}% mem=${mem}MB`); }
}
async function savePmName(){const name=(q('#pmNameIn').value||'').trim();if(!name){setLogText('pm name is empty');return;}const d=await api('/api/pm/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pm_name:name})});setLogText(d.ok?`pm saved: ${name}`:`pm save failed: ${d.error||''}`);await refreshPm();}
async function refreshRuns(){
  const orch=(q('#orch').value||'').trim().toUpperCase();
  let d=await api('/api/runs'+(orch?`?orch=${encodeURIComponent(orch)}`:''));
  if((!d.runs||!d.runs.length) && orch){
    d=await api('/api/runs');
    const first=(d.runs||[])[0];
    if(first && first.orch_id){ q('#orch').value=first.orch_id; }
  }
  const s=q('#run'),cur=s.value;
  s.innerHTML='';
  (d.runs||[]).forEach(r=>{
    const o=document.createElement('option');
    o.value=r.name;
    o.textContent=`${r.name} (${r.running}/${r.total})`;
    s.appendChild(o);
  });
  if(cur&&qa('#run option').some(x=>x.value===cur)) s.value=cur;
  else if(d.latest) s.value=d.latest;
}

function mkWorker(i,engine='codex'){
  const orch=(q('#orch').value||'AGENT').trim().toUpperCase();
  const work_method=engine==='claude-cli'?'ui':'connection';
  return {task_id:`${orch}-T${i+1}`,enabled:true,engine:engine,owner:engine==='claude-cli'?'Claude':`Codex-${String.fromCharCode(65+i)}`,role:suggestRoleByMethod(work_method),work_method,repo:'orchestrator',scope_paths:['orchestrator/dashboard.py'],goal:'',done_when:[],prompt_file:`orchestrator/runner/prompts/${orch}-T${i+1}.md`};
}
function ensureCfg(){
  if(cfg) return;
  cfg={orch_id:(q('#orch').value||'AGENT').trim().toUpperCase(),workspace:'d:\\\\Development',defaults:{model:q('#model').value||'gpt-5.3-codex',reasoning_effort:q('#reason').value||'xhigh',global_prompt:(q('#globalPrompt').value||''),sandbox:'workspace-write',approval:'never',search:false,read_only_guard:true,history_readonly_guard:true,single_run_dir:true,clean_run_dir:true,prune_legacy_runs:true,claude_cmd:'claude',claude_continue:true,claude_args:['--print','{prompt}'],claude_stdin:false},workers:[]};
}
function renderCfg(){
  ensureCfg();
  const box=q('#cfg');
  const rows=(cfg.workers||[]).map((w,idx)=>`<div class='cfr'><div>${idx+1}</div><input type='checkbox' data-k='enabled' data-i='${idx}' ${w.enabled!==false?'checked':''}><input data-k='task_id' data-i='${idx}' value='${esc(w.task_id||'')}'><input data-k='owner' data-i='${idx}' value='${esc(w.owner||'')}'><input data-k='role' data-i='${idx}' value='${esc(w.role||'')}'><select data-k='engine' data-i='${idx}'><option value='codex' ${w.engine==='codex'?'selected':''}>codex</option><option value='claude-cli' ${w.engine==='claude-cli'?'selected':''}>claude-cli</option><option value='claude-manual' ${w.engine==='claude-manual'?'selected':''}>claude-manual</option><option value='manual' ${w.engine==='manual'?'selected':''}>manual</option></select><select data-k='work_method' data-i='${idx}'>${methodOptions(w.work_method||'')}</select><input data-k='repo' data-i='${idx}' value='${esc(w.repo||'')}'><input data-k='prompt_file' data-i='${idx}' value='${esc(w.prompt_file||'')}'><button onclick='removeAt(${idx})'>Del</button></div>`).join('');
  box.innerHTML=`<div class='cfr head'><div>#</div><div>on</div><div>task_id</div><div>owner</div><div>role</div><div>engine</div><div>method</div><div>repo</div><div>prompt_file</div><div>act</div></div>${rows || "<div style='padding:10px;color:#5770a0'>no workers</div>"}`;
  box.querySelectorAll('input[data-k],select[data-k]').forEach(el=>{
    el.addEventListener('change', async ()=>{
      const i=Number(el.getAttribute('data-i')||0),k=el.getAttribute('data-k');
      if(!cfg?.workers?.[i]||!k) return;
      if(k==='enabled'){
        cfg.workers[i][k]=el.checked;
        await saveCfg(true);
      } else if(k==='work_method'){
        cfg.workers[i][k]=el.value;
        cfg.workers[i]['role']=suggestRoleByMethod(el.value);
        renderCfg();
      } else {
        cfg.workers[i][k]=el.value;
      }
    });
  });
  q('#sum').textContent=`workers: ${cfg.workers.length}/10 | global_prompt: ${String((cfg.defaults&&cfg.defaults.global_prompt)||'').trim()? 'ON':'OFF'} | dynamic-role: ON`;
}
function renumberTaskIds(){if(!cfg?.workers) return; const orch=(q('#orch').value||cfg.orch_id||'AGENT').trim().toUpperCase(); cfg.workers.forEach((w,i)=>{w.task_id=`${orch}-T${i+1}`;});}
function removeAt(i){if(!cfg?.workers) return; cfg.workers.splice(i,1); renumberTaskIds(); q('#wcnt').value=String(cfg.workers.length); renderCfg();}
function addW(engine='codex'){ensureCfg(); if((cfg.workers||[]).length>=10) return; cfg.workers.push(mkWorker(cfg.workers.length,engine)); renumberTaskIds(); q('#wcnt').value=String(cfg.workers.length); renderCfg();}
function delW(){if(!cfg?.workers?.length) return; cfg.workers.pop(); renumberTaskIds(); q('#wcnt').value=String(cfg.workers.length); renderCfg();}
function autoWorkers(n){
  ensureCfg();
  const m=Math.max(1,Math.min(10,Number(n)||10));
  cfg.workers=[];
  for(let i=0;i<m;i++){cfg.workers.push(mkWorker(i, i===1?'claude-cli':'codex'));}
  renumberTaskIds();
  q('#wcnt').value=String(m);
  renderCfg();
}
function applyWorkerCount(){ensureCfg(); const n=Math.max(1,Math.min(10,Number(q('#wcnt').value||cfg.workers.length||1))); while(cfg.workers.length<n){cfg.workers.push(mkWorker(cfg.workers.length,'codex'));} while(cfg.workers.length>n){cfg.workers.pop();} renumberTaskIds(); renderCfg();}
function enableAll(v){ensureCfg(); cfg.workers.forEach(w=>w.enabled=!!v); renderCfg();}
function autoAssignRoles(){ensureCfg(); cfg.workers.forEach(w=>{const m=w.work_method||(String(w.engine||'').toLowerCase()==='claude-cli'?'ui':'connection'); w.work_method=m; w.role=suggestRoleByMethod(m);}); renderCfg();}
function setPmDefaultsFromWorkers(){ensureCfg(); if(!cfg.defaults) cfg.defaults={}; cfg.defaults.pm_last_selected=cfg.workers.filter(w=>w.enabled!==false).map(w=>w.task_id); cfg.defaults.pm_last_request=q('#globalPrompt').value||'';}
function collectEnabledRoles(){ensureCfg(); const counts={}; cfg.workers.filter(w=>w.enabled!==false).forEach(w=>{const k=String(w.role||'Worker'); counts[k]=(counts[k]||0)+1;}); return Object.entries(counts).map(([k,v])=>`${k}:${v}`).join(', ');}

async function loadCfg(){
  const orch=(q('#orch').value||'AGENT').trim().toUpperCase();
  const d=await api(`/api/config/${encodeURIComponent(orch)}`);
  if(!d.ok){setLogText(`load config failed: ${d.error||''}`); return;}
  cfg=d.config||{};
  q('#orch').value=cfg.orch_id||orch;
  q('#model').value=(cfg.defaults&&cfg.defaults.model)||q('#model').value;
  q('#reason').value=(cfg.defaults&&cfg.defaults.reasoning_effort)||q('#reason').value;
  q('#globalPrompt').value=(cfg.defaults&&cfg.defaults.global_prompt)||'';
  if(!cfg.defaults) cfg.defaults={};
  if(!Array.isArray(cfg.workers)) cfg.workers=[];
  q('#wcnt').value=String(cfg.workers.length||1);
  renderCfg();
}

async function saveCfg(silent=false){
  ensureCfg();
  cfg.orch_id=(q('#orch').value||cfg.orch_id||'AGENT').trim().toUpperCase();
  if(!cfg.defaults) cfg.defaults={};
  cfg.defaults.model=q('#model').value||'gpt-5.3-codex';
  cfg.defaults.reasoning_effort=q('#reason').value||'xhigh';
  cfg.defaults.global_prompt=q('#globalPrompt').value||'';
  cfg.defaults.read_only_guard = cfg.defaults.read_only_guard !== false;
  cfg.defaults.history_readonly_guard = cfg.defaults.history_readonly_guard !== false;
  cfg.defaults.claude_cmd=cfg.defaults.claude_cmd||'claude';
  cfg.defaults.claude_continue = cfg.defaults.claude_continue !== false;
  cfg.defaults.claude_args=Array.isArray(cfg.defaults.claude_args)?cfg.defaults.claude_args:['--print','{prompt}'];
  setPmDefaultsFromWorkers();
  const d=await api('/api/config/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orch_id:cfg.orch_id,config:cfg})});
  if(!silent) setLogText(d.ok?`saved: ${d.path} | roles: ${collectEnabledRoles()}`:`save failed: ${d.error||''}`);
  return !!d.ok;
}

function renderWorkers(arr){
  const body=q('#wb');
  const pmRows = pmState ? [{
    task_id: `${String(pmState.orch||'AGENT')}-PM`,
    owner: String(pmState.pm_name||'Codex-PM'),
    role: 'PM/Orchestrator',
    engine: 'pm',
    pid: Number(pmState.pid||0) || '-',
    state: ((arr||[]).some(x=>String(x.state||'').toUpperCase()==='RUNNING') ? 'RUNNING' : 'IDLE'),
    metrics: pmState.metrics || {cpu_percent:0,rss_mb:0},
    progress: Number(pmState.progress||0),
    tokens: {total: null},
    activity: `progress_source=${String(pmState.progress_source||'master_tasks')}`,
    docs_count: 1,
    _pm: true,
  }] : [];
  const rows = [...pmRows, ...(arr||[])];
  body.innerHTML=rows.map(w=>{
    const cpu=Number(w.metrics?.cpu_percent||0), mem=Number(w.metrics?.rss_mb||0), prog=Number(w.progress||0);
    const state=String(w.state||'').toUpperCase();
    const stClass = (state==='RUNNING' || state==='DONE') ? 'ok' : ((state==='EXITED' || state==='BLOCKED') ? 'warn' : 'bad');
    const stHint = w.state_hint ? `<div style='font-size:11px;color:#5770a0'>${esc(w.state_hint)}</div>` : '';
    const cpuCell = `${bar('cpu',cpu)}<div>${cpu.toFixed(3)}%</div>`;
    const memCell = `${bar('mem',Math.min(100,mem/20))}<div>${mem.toFixed(1)}MB</div>`;
    const tokTotal = w.tokens && w.tokens.total != null ? Number(w.tokens.total) : null;
    const tokenCell = tokTotal == null ? '-' : tokTotal.toLocaleString();
    const logBtn = w._pm
      ? `<button onclick='viewPmLog()'>View</button>`
      : `<button onclick='viewLog(\"${esc(w.task_id)}\")'>View</button>`;
    const docsBtn = w._pm
      ? `<button onclick='viewPmDocs()'>1</button>`
      : `<button onclick='viewDocs(\"${esc(w.task_id)}\")'>${Number(w.docs_count||0)}</button>`;
    return `<tr><td>${esc(w.task_id)}</td><td>${esc(w.owner)}</td><td>${esc(w.role)}</td><td>${esc(w.engine)}</td><td>${w.pid??''}</td><td class='${stClass}'>${esc(state || '-')}</td><td>${cpuCell}</td><td>${memCell}</td><td>${bar('prog',prog)}<div>${prog.toFixed(1)}%</div></td><td>${tokenCell}</td><td><div class='activity' title='${esc(w.activity||'')}'>${esc(w.activity||'-')}</div></td><td>${logBtn}${stHint}</td><td>${docsBtn}</td></tr>`;
  }).join('');
}
function renderManual(arr){
  const body=q('#mb');
  body.innerHTML=(arr||[]).map(w=>`<tr><td>${esc(w.task_id||'')}</td><td>${esc(w.owner||'')}</td><td>${esc(w.role||'')}</td><td>${esc(w.engine||'')}</td><td>${esc(w.repo||'')}</td><td>${esc(w.goal||'')}</td></tr>`).join('');
}

async function loadRun(){
  const run=q('#run').value;
  if(!run){return;}
  const d=await api(`/api/run/${encodeURIComponent(run)}/status`);
  if(!d.ok){setLogText(`status failed: ${d.error||''}`);return;}
  const s=d.summary||{};
  q('#m1').textContent=`running:${s.running||0}`;
  q('#m2').textContent=`total:${s.total||0}`;
  q('#m3').textContent=`avg cpu:${Number(s.avg_cpu||0).toFixed(2)}%`;
  q('#m4').textContent=`mem:${Number(s.mem_mb||0).toFixed(1)}MB`;
  q('#m5').textContent=`tokens:${Number(s.tokens_total||0).toLocaleString()}`;
  renderRoleSummary(d.role_summary||[]);
  renderWorkers(d.workers||[]);
  renderManual(d.manual||[]);
}

async function viewLog(task){
  const run=q('#run').value;
  if(!run||!task) return;
  const d=await api(`/api/run/${encodeURIComponent(run)}/log/${encodeURIComponent(task)}?tail=240`);
  if(!d.ok){setLogText(`log failed: ${d.error||''}`);return;}
  setLogText(`${task} log opened`);
  openViewer(`${task} log`, d.text||'');
}
async function viewDocs(task){
  const run=q('#run').value;
  if(!run||!task) return;
  const d=await api(`/api/run/${encodeURIComponent(run)}/documents?task=${encodeURIComponent(task)}`);
  if(!d.ok){setLogText(`docs failed: ${d.error||''}`);return;}
  const t=(d.tasks||[])[0];
  const docs=t?.documents||[];
  if(!docs.length){openViewer(`${task} docs`, "(no docs)");return;}
  const lines = docs.map(x=>`${x.kind}\t${x.path}\t${x.size}\t${x.mtime}`).join('\\n');
  setLogText(`${task} docs opened (${docs.length})`);
  openViewer(`${task} docs`, lines);
}
async function viewPmLog(){
  const d=await api('/api/read?path='+encodeURIComponent('orchestrator/status_report.md'));
  if(!d.ok){setLogText(`read failed: ${d.error||''}`);return;}
  setLogText('PM status_report opened');
  openViewer('PM Status Report', d.text||'');
}
async function viewPmDocs(){
  const docs=[
    'orchestrator/master_tasks.md',
    'orchestrator/integration.md',
    'orchestrator/inbox.md',
    'orchestrator/results.md',
    'orchestrator/status_report.md',
  ];
  setLogText('PM docs list opened');
  openViewer('PM docs', docs.join('\\n'));
}
async function viewPath(path){
  const d=await api(`/api/read?path=${encodeURIComponent(path)}`);
  if(!d.ok){openViewer('read failed', d.error||'');return;}
  openViewer(d.path||'file', d.text||'');
}

async function startRun(dry=false){
  const ok=await saveCfg(true);
  if(!ok){setLogText('start blocked: config save failed');return;}
  const orch=(q('#orch').value||'AGENT').trim().toUpperCase();
  const maxW=Math.max(1,Math.min(10,Number(q('#wcnt').value||cfg?.workers?.length||1)));
  const d=await api('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orch_id:orch,model:q('#model').value||'gpt-5.3-codex',reasoning_effort:q('#reason').value||'xhigh',pm_request:(q('#globalPrompt').value||'').trim(),pm_delegate:true,min_workers:1,max_workers:maxW,dry_run:!!dry})});
  setLogText((d.stdout||'') + (d.stderr?`\n${d.stderr}`:''));
  await refreshRuns();
  await loadRun();
}
async function distributeAndStart(){await startRun(false);}
async function stopRun(){
  const run=q('#run').value;
  const d=await api('/api/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run_name:run})});
  setLogText((d.stdout||'') + (d.stderr?`\n${d.stderr}`:''));
  await refreshRuns();
  await loadRun();
}

function setAuto(){
  if(timer){clearInterval(timer);timer=null;}
  if(!q('#auto').checked) return;
  const sec=Math.max(1,Math.min(30,Number(q('#sec').value||3)));
  timer=setInterval(()=>refreshAll(), sec*1000);
}
async function refreshAll(){
  const jobs = [refreshTools(), refreshPm(), refreshRuns()];
  await Promise.all(jobs.map(p => p.catch(()=>{})));
  if(!cfg) await loadCfg();
  await loadRun();
}

q('#auto').addEventListener('change',setAuto);
q('#sec').addEventListener('change',setAuto);
window.addEventListener('keydown',(e)=>{if(e.key==='Escape')closeViewer();});
window.addEventListener('load',async()=>{await refreshAll();if(cfg?.workers){q('#wcnt').value=String(cfg.workers.length);}setAuto();});
</script>
</body>
</html>
"""


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Orchestrator Dashboard")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8877)
    args = parser.parse_args()

    host = str(args.host or "127.0.0.1")
    port = int(args.port or 8877)
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"[ORCH] dashboard: http://{host}:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
