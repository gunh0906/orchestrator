# -*- coding: utf-8 -*-
from __future__ import annotations

import ctypes
import json
import subprocess
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path
from tkinter import BooleanVar, END, StringVar, Text, Tk
from tkinter import messagebox
from tkinter import ttk
from urllib.error import URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
RUN_DASHBOARD_SCRIPT = ROOT / "run_dashboard.ps1"
RUNS_DIR = ROOT / "runs"
GUI_LOG_DIR = RUNS_DIR / "control_gui_logs"

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8877
POLL_INTERVAL_MS = 3000
LOG_MAX_LINES = 160


def _no_window_flags() -> int:
    try:
        return int(getattr(subprocess, "CREATE_NO_WINDOW", 0) or 0)
    except Exception:
        return 0


def _enable_hidpi_windows() -> None:
    try:
        user32 = ctypes.windll.user32
        if hasattr(user32, "SetProcessDpiAwarenessContext"):
            if user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4)):
                return
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
            return
        except Exception:
            pass
        if hasattr(user32, "SetProcessDPIAware"):
            user32.SetProcessDPIAware()
    except Exception:
        return


def _dashboard_url(host: str, port: int) -> str:
    clean_host = _normalized_browser_host(host)
    return f"http://{clean_host}:{int(port)}"


def _normalized_browser_host(host: str) -> str:
    raw = str(host or "").strip()
    low = raw.lower()
    if low in {"", "0.0.0.0", "::", "[::]", "0:0:0:0:0:0:0:0"}:
        return "127.0.0.1"
    return raw


def _shorten_line(text: str, max_chars: int = 120) -> str:
    compact = " ".join(str(text or "").split())
    if len(compact) <= max_chars:
        return compact
    return f"{compact[: max_chars - 3]}..."


def _run_cmd(cmd: list[str], timeout: int = 60) -> tuple[int, str, str]:
    proc = subprocess.run(
        cmd,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=max(1, int(timeout)),
        creationflags=_no_window_flags(),
    )
    return int(proc.returncode), str(proc.stdout or "").strip(), str(proc.stderr or "").strip()


def _is_url_ready(url: str) -> bool:
    req = Request(url, method="GET")
    try:
        with urlopen(req, timeout=1.8) as resp:
            status = int(getattr(resp, "status", 200) or 200)
            return status < 500
    except URLError:
        return False
    except Exception:
        return False


def _wait_url_ready(url: str, timeout_sec: float = 20.0, step_sec: float = 0.6) -> bool:
    deadline = time.monotonic() + max(1.0, float(timeout_sec))
    while time.monotonic() < deadline:
        if _is_url_ready(url):
            return True
        time.sleep(max(0.1, float(step_sec)))
    return False


def _query_processes() -> list[dict[str, str]]:
    ps = r"""
$items = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match '^pythonw?(\.exe)?$' -and
    $null -ne $_.CommandLine -and
    (
        $_.CommandLine -match 'orchestrator[\\/]+dashboard\.py' -or
        $_.CommandLine -match 'runner[\\/]+dispatch\.py' -or
        $_.CommandLine -match 'runner[\\/]+pm_delegate\.py'
    )
} | Select-Object ProcessId, CommandLine
$items | ConvertTo-Json -Depth 4
"""
    proc = subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=20,
        creationflags=_no_window_flags(),
    )
    raw = str(proc.stdout or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if isinstance(parsed, list):
        return [dict(x) for x in parsed if isinstance(x, dict)]
    if isinstance(parsed, dict):
        return [dict(parsed)]
    return []


def _role_from_cmd(cmd: str) -> str:
    text = str(cmd or "").lower()
    if "dashboard.py" in text:
        return "DASHBOARD"
    if "pm_delegate.py" in text:
        return "PM-DELEGATE"
    if "dispatch.py" in text:
        return "DISPATCHER"
    return "PYTHON"


class OrchestratorServerControlApp:
    def __init__(self, root: Tk) -> None:
        self.root = root
        self.root.title("Orchestrator Server Control")
        self._ui_scale = 1.0
        self._setup_window_for_display()

        self._busy = False
        self.status_var = StringVar(value="Status: checking")
        self.count_var = StringVar(value="Dashboard: 0, Dispatchers: 0, PM: 0")
        self.host_var = StringVar(value=DEFAULT_HOST)
        self.port_var = StringVar(value=str(DEFAULT_PORT))
        self.url_var = StringVar(value=f"URL: {_dashboard_url(DEFAULT_HOST, DEFAULT_PORT)}")
        self.auto_open_var = BooleanVar(value=True)

        self._apply_theme()
        self._build_ui()
        self._append_log("Ready")
        self.refresh_status()
        self._schedule_refresh()

    def _setup_window_for_display(self) -> None:
        try:
            dpi = float(self.root.winfo_fpixels("1i"))
            tk_scale = max(1.0, min(1.35, dpi / 96.0))
            self.root.tk.call("tk", "scaling", tk_scale)
        except Exception:
            tk_scale = 1.0

        sw = int(self.root.winfo_screenwidth() or 1920)
        sh = int(self.root.winfo_screenheight() or 1080)
        screen_scale = 1.0
        if sw >= 3840 or sh >= 2160:
            screen_scale = 1.35
        elif sw >= 2560 or sh >= 1440:
            screen_scale = 1.18
        self._ui_scale = max(screen_scale, tk_scale)

        target_w = min(sw - 120, int(1120 * self._ui_scale))
        target_h = min(sh - 120, int(720 * self._ui_scale))
        min_w = max(900, int(840 * self._ui_scale))
        min_h = max(560, int(500 * self._ui_scale))
        self.root.geometry(f"{max(min_w, target_w)}x{max(min_h, target_h)}")
        self.root.minsize(min_w, min_h)

    def _scaled(self, base: int) -> int:
        return max(base, int(round(float(base) * self._ui_scale)))

    def _apply_theme(self) -> None:
        self.root.configure(bg="#eef3fb")
        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except Exception:
            pass

        style.configure(".", background="#eef3fb", foreground="#10274f")
        style.configure("App.TFrame", background="#eef3fb")
        style.configure("Top.TFrame", background="#3152a9")
        style.configure("Card.TFrame", background="#f8fbff")
        style.configure(
            "TopTitle.TLabel",
            background="#3152a9",
            foreground="#ffffff",
            font=("Segoe UI", self._scaled(15), "bold"),
        )
        style.configure(
            "TopMeta.TLabel",
            background="#3152a9",
            foreground="#dfe8ff",
            font=("Segoe UI", self._scaled(10)),
        )
        style.configure(
            "Meta.TLabel",
            background="#f8fbff",
            foreground="#35507e",
            font=("Segoe UI", self._scaled(10)),
        )
        style.configure(
            "Value.TLabel",
            background="#f8fbff",
            foreground="#10274f",
            font=("Segoe UI", self._scaled(10), "bold"),
        )
        style.configure(
            "Section.TLabel",
            background="#f8fbff",
            foreground="#10274f",
            font=("Segoe UI", self._scaled(10), "bold"),
        )
        style.configure(
            "App.TCheckbutton",
            background="#f8fbff",
            foreground="#27406f",
            font=("Segoe UI", self._scaled(9)),
        )

        style.configure(
            "Primary.TButton",
            padding=(self._scaled(11), self._scaled(7)),
            background="#2f5fc9",
            foreground="#ffffff",
            bordercolor="#b6c7e4",
            focusthickness=0,
        )
        style.map("Primary.TButton", background=[("active", "#3c6ddf"), ("pressed", "#214a9d")])

        style.configure(
            "Danger.TButton",
            padding=(self._scaled(11), self._scaled(7)),
            background="#b42318",
            foreground="#ffffff",
            bordercolor="#d06a61",
            focusthickness=0,
        )
        style.map("Danger.TButton", background=[("active", "#c4372b"), ("pressed", "#8f1b12")])

        style.configure(
            "Ghost.TButton",
            padding=(self._scaled(11), self._scaled(7)),
            background="#ffffff",
            foreground="#10274f",
            bordercolor="#b6c7e4",
            focusthickness=0,
        )
        style.map("Ghost.TButton", background=[("active", "#f0f5ff"), ("pressed", "#dce8ff")])

    def _build_ui(self) -> None:
        shell = ttk.Frame(self.root, style="App.TFrame", padding=self._scaled(10))
        shell.pack(fill="both", expand=True)

        top = ttk.Frame(shell, style="Top.TFrame", padding=self._scaled(12))
        top.pack(fill="x")
        ttk.Label(top, text="Orchestrator Server Control", style="TopTitle.TLabel").pack(anchor="w")
        ttk.Label(top, textvariable=self.status_var, style="TopMeta.TLabel").pack(anchor="w", pady=(4, 0))
        ttk.Label(top, textvariable=self.count_var, style="TopMeta.TLabel").pack(anchor="w")

        controls = ttk.Frame(shell, style="Card.TFrame", padding=self._scaled(12))
        controls.pack(fill="x", pady=(self._scaled(10), self._scaled(10)))

        row1 = ttk.Frame(controls, style="Card.TFrame")
        row1.pack(fill="x")
        ttk.Label(row1, text="Host", style="Meta.TLabel").pack(side="left")
        ttk.Entry(row1, textvariable=self.host_var, width=18).pack(side="left", padx=(6, 12))
        ttk.Label(row1, text="Port", style="Meta.TLabel").pack(side="left")
        ttk.Entry(row1, textvariable=self.port_var, width=8).pack(side="left", padx=(6, 12))
        ttk.Label(row1, textvariable=self.url_var, style="Value.TLabel").pack(side="left", padx=(4, 0))

        row2 = ttk.Frame(controls, style="Card.TFrame")
        row2.pack(fill="x", pady=(10, 0))
        self.btn_start = ttk.Button(row2, text="Start Dashboard", command=self.start_dashboard, style="Primary.TButton")
        self.btn_stop = ttk.Button(row2, text="Stop Dashboard", command=self.stop_dashboard, style="Danger.TButton")
        self.btn_restart = ttk.Button(row2, text="Restart Dashboard", command=self.restart_dashboard, style="Primary.TButton")
        self.btn_refresh = ttk.Button(row2, text="Refresh", command=self.refresh_status, style="Ghost.TButton")
        self.btn_open = ttk.Button(row2, text="Open Dashboard", command=self.open_dashboard, style="Ghost.TButton")
        self.btn_runs = ttk.Button(row2, text="Open Runs", command=self.open_runs, style="Ghost.TButton")
        self.btn_logs = ttk.Button(row2, text="Open Logs", command=self.open_logs, style="Ghost.TButton")

        self.btn_start.pack(side="left", padx=(0, 8))
        self.btn_stop.pack(side="left", padx=(0, 8))
        self.btn_restart.pack(side="left", padx=(0, 8))
        self.btn_refresh.pack(side="left", padx=(0, 8))
        self.btn_open.pack(side="left", padx=(0, 8))
        self.btn_runs.pack(side="left", padx=(0, 8))
        self.btn_logs.pack(side="left")

        ttk.Checkbutton(
            controls,
            text="Open dashboard automatically after Start/Restart",
            variable=self.auto_open_var,
            style="App.TCheckbutton",
        ).pack(anchor="w", pady=(10, 0))

        body = ttk.Panedwindow(shell, orient="horizontal")
        body.pack(fill="both", expand=True)

        left = ttk.Frame(body, style="Card.TFrame", padding=self._scaled(10))
        right = ttk.Frame(body, style="Card.TFrame", padding=self._scaled(10))
        body.add(left, weight=3)
        body.add(right, weight=2)

        ttk.Label(left, text="Runtime Processes", style="Section.TLabel").pack(anchor="w")
        self.proc_text = Text(
            left,
            height=12,
            bg="#ffffff",
            fg="#10274f",
            insertbackground="#10274f",
            relief="flat",
            borderwidth=0,
            padx=8,
            pady=8,
            wrap="none",
            font=("Consolas", self._scaled(10)),
        )
        self.proc_text.pack(fill="both", expand=True, pady=(6, 0))
        self.proc_text.configure(state="disabled")

        ttk.Label(right, text="Operation Log", style="Section.TLabel").pack(anchor="w")
        self.log_text = Text(
            right,
            height=12,
            bg="#ffffff",
            fg="#27406f",
            insertbackground="#10274f",
            relief="flat",
            borderwidth=0,
            padx=8,
            pady=8,
            wrap="word",
            font=("Consolas", self._scaled(10)),
        )
        self.log_text.pack(fill="both", expand=True, pady=(6, 0))
        self.log_text.configure(state="disabled")

    def _schedule_refresh(self) -> None:
        self.root.after(POLL_INTERVAL_MS, self._on_refresh_tick)

    def _on_refresh_tick(self) -> None:
        try:
            self.refresh_status()
        finally:
            self._schedule_refresh()

    def _set_busy(self, busy: bool) -> None:
        self._busy = bool(busy)
        state = "disabled" if busy else "normal"
        for btn in (
            self.btn_start,
            self.btn_stop,
            self.btn_restart,
            self.btn_refresh,
            self.btn_open,
            self.btn_runs,
            self.btn_logs,
        ):
            btn.configure(state=state)

    def _append_log(self, text: str) -> None:
        stamp = datetime.now().strftime("%H:%M:%S")
        message = _shorten_line(str(text or "").replace("\r", " ").replace("\n", " "), max_chars=280)
        self.log_text.configure(state="normal")
        self.log_text.insert(END, f"[{stamp}] {message}\n")
        line_count = int(self.log_text.index("end-1c").split(".")[0])
        if line_count > LOG_MAX_LINES:
            trim_to = line_count - LOG_MAX_LINES
            self.log_text.delete("1.0", f"{trim_to + 1}.0")
        self.log_text.see(END)
        self.log_text.configure(state="disabled")

    def _set_proc_text(self, text: str) -> None:
        self.proc_text.configure(state="normal")
        self.proc_text.delete("1.0", END)
        self.proc_text.insert("1.0", str(text or ""))
        self.proc_text.configure(state="disabled")

    def _parse_host_port(self) -> tuple[str, int]:
        host = _normalized_browser_host((self.host_var.get() or DEFAULT_HOST).strip() or DEFAULT_HOST)
        try:
            port = int(str(self.port_var.get() or str(DEFAULT_PORT)).strip())
            if port < 1 or port > 65535:
                raise ValueError
        except Exception:
            raise ValueError("Port must be 1~65535")
        self.url_var.set(f"URL: {_dashboard_url(host, port)}")
        return host, port

    def refresh_status(self) -> None:
        try:
            host, port = self._parse_host_port()
        except ValueError:
            host, port = DEFAULT_HOST, DEFAULT_PORT
            self.url_var.set(f"URL: {_dashboard_url(host, port)}")

        rows = _query_processes()
        dash_rows = [r for r in rows if _role_from_cmd(str(r.get("CommandLine", ""))) == "DASHBOARD"]
        dispatch_rows = [r for r in rows if _role_from_cmd(str(r.get("CommandLine", ""))) == "DISPATCHER"]
        pm_rows = [r for r in rows if _role_from_cmd(str(r.get("CommandLine", ""))) == "PM-DELEGATE"]

        running = bool(dash_rows)
        self.status_var.set("Status: RUNNING" if running else "Status: STOPPED")
        self.count_var.set(
            f"Dashboard: {len(dash_rows)}, Dispatchers: {len(dispatch_rows)}, PM: {len(pm_rows)}"
        )
        self.url_var.set(f"URL: {_dashboard_url(host, port)}")

        if not rows:
            self._set_proc_text("No orchestrator processes.")
            return

        lines = []
        for row in rows:
            pid = str(row.get("ProcessId", "")).strip()
            cmd = str(row.get("CommandLine", "")).strip()
            role = _role_from_cmd(cmd)
            lines.append(f"{role:<11} PID {pid:<8} {_shorten_line(cmd, 130)}")
        self._set_proc_text("\n".join(lines))

    def _run_action_async(self, title: str, action, on_success=None) -> None:
        if self._busy:
            return
        self._set_busy(True)

        def _worker() -> None:
            try:
                ok, msg = action()
                self.root.after(0, lambda: self._append_log(f"{title}: {msg}"))
                if ok and on_success is not None:
                    self.root.after(0, on_success)
            except Exception as exc:
                self.root.after(0, lambda: messagebox.showerror("Error", str(exc)))
            finally:
                self.root.after(0, self._after_action)

        threading.Thread(target=_worker, daemon=True).start()

    def _after_action(self) -> None:
        self._set_busy(False)
        self.refresh_status()

    def _start_dashboard_sync(self) -> tuple[bool, str]:
        if not RUN_DASHBOARD_SCRIPT.exists():
            return False, f"run_dashboard.ps1 not found: {RUN_DASHBOARD_SCRIPT}"

        host, port = self._parse_host_port()
        if any(_role_from_cmd(str(r.get("CommandLine", ""))) == "DASHBOARD" for r in _query_processes()):
            return True, "already running"

        GUI_LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_file = GUI_LOG_DIR / "dashboard_server.log"
        cmd = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(RUN_DASHBOARD_SCRIPT),
            "-Host",
            host,
            "-Port",
            str(port),
        ]
        with log_file.open("a", encoding="utf-8", errors="replace") as fp:
            fp.write(f"\n[{datetime.now().isoformat(timespec='seconds')}] START {' '.join(cmd)}\n")
            subprocess.Popen(
                cmd,
                cwd=str(ROOT),
                stdout=fp,
                stderr=subprocess.STDOUT,
                creationflags=_no_window_flags(),
            )
        time.sleep(1.0)
        is_running = any(
            _role_from_cmd(str(r.get("CommandLine", ""))) == "DASHBOARD" for r in _query_processes()
        )
        if is_running:
            return True, f"started ({_dashboard_url(host, port)})"
        return False, "start requested but dashboard process is not visible yet"

    def _stop_dashboard_sync(self) -> tuple[bool, str]:
        rows = _query_processes()
        dash_pids = []
        for row in rows:
            cmd = str(row.get("CommandLine", ""))
            if _role_from_cmd(cmd) != "DASHBOARD":
                continue
            try:
                pid = int(row.get("ProcessId", 0) or 0)
            except Exception:
                pid = 0
            if pid > 0:
                dash_pids.append(pid)
        dash_pids = sorted(set(dash_pids))
        if not dash_pids:
            return True, "dashboard already stopped"

        killed: list[int] = []
        failed: list[int] = []
        for pid in dash_pids:
            code, _, _ = _run_cmd(["taskkill", "/PID", str(pid), "/T", "/F"], timeout=20)
            if code == 0:
                killed.append(pid)
            else:
                failed.append(pid)
        if failed:
            return False, f"killed={killed} failed={failed}"
        return True, f"killed={killed}"

    def start_dashboard(self) -> None:
        self._run_action_async("START", self._start_dashboard_sync, on_success=self._auto_open_if_enabled)

    def stop_dashboard(self) -> None:
        self._run_action_async("STOP", self._stop_dashboard_sync)

    def restart_dashboard(self) -> None:
        def _action() -> tuple[bool, str]:
            ok1, msg1 = self._stop_dashboard_sync()
            ok2, msg2 = self._start_dashboard_sync()
            return (ok1 and ok2), f"{msg1} / {msg2}"

        self._run_action_async("RESTART", _action, on_success=self._auto_open_if_enabled)

    def _auto_open_if_enabled(self) -> None:
        if self.auto_open_var.get():
            threading.Thread(target=self._open_dashboard_when_ready, daemon=True).start()

    def _open_dashboard_when_ready(self) -> None:
        host, port = self._parse_host_port()
        url = _dashboard_url(host, port)
        _wait_url_ready(url, timeout_sec=24.0, step_sec=0.7)
        self.root.after(0, lambda: self._open_url(url))

    def _open_url(self, url: str) -> None:
        webbrowser.open(url, new=2)
        self._append_log(f"OPEN: {url}")

    def open_dashboard(self) -> None:
        host, port = self._parse_host_port()
        self._open_url(_dashboard_url(host, port))

    def open_runs(self) -> None:
        try:
            RUNS_DIR.mkdir(parents=True, exist_ok=True)
            subprocess.Popen(["explorer", str(RUNS_DIR)])
            self._append_log(f"OPEN RUNS: {RUNS_DIR}")
        except Exception as exc:
            messagebox.showerror("Error", str(exc))

    def open_logs(self) -> None:
        try:
            GUI_LOG_DIR.mkdir(parents=True, exist_ok=True)
            subprocess.Popen(["explorer", str(GUI_LOG_DIR)])
            self._append_log(f"OPEN LOGS: {GUI_LOG_DIR}")
        except Exception as exc:
            messagebox.showerror("Error", str(exc))


def main() -> int:
    _enable_hidpi_windows()
    root = Tk()
    app = OrchestratorServerControlApp(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
