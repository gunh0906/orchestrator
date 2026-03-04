<!--
dashboard.py structure summary:
- Total lines: 1111
- Main classes: `Handler` (HTTP route handling/response helpers), `_FILETIME`, `_PROCESS_MEMORY_COUNTERS` (Win32 process metric structs)
- Main function groups: PM settings/status (`_read_pm_settings`, `_save_pm_settings`, `_pm_status*`), run/config/doc status (`_load_config`, `_list_runs`, `_run_status`, `_run_documents`, `_start`, `_stop`), utility/process helpers (`_safe_resolve`, `_tail`, `_pid_running`, `_proc_metrics*`), plus `_tool_status` and `main()`
- Static serving root is `STATIC_DIR = ROOT / "dashboard_static"` with `_resolve_static_file()` path normalization + `relative_to(_STATIC_DIR_RESOLVED)` boundary check and file existence checks
- `GET /` returns `index.html` via `_read_static`; `GET /static/<path>` routes to `Handler._static()`, serves bytes with `_STATIC_CONTENT_TYPES` (`.css`, `.js`, `.html`) and falls back to `application/octet-stream` with no-cache headers
-->

You are executing task AGENT-T1 (Owner: Codex-A, Repo: orchestrator).

## Goal: Summarize dashboard.py structure

Read `orchestrator/dashboard.py` and write a brief summary of its structure:
- How many lines
- Main classes/functions
- How static files are served

Write your summary as a comment at the top of this prompt file (AGENT-T1.md).

Constraints:
- ONLY modify orchestrator/runner/prompts/AGENT-T1.md
- Keep it brief (under 20 lines)
