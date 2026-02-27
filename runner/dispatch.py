# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class WorkerRun:
    task_id: str
    owner: str
    role: str
    engine: str
    workspace: str
    command: list[str]
    log_file: Path
    prompt_file: str
    repo: str
    stdin_text: str | None = None
    process: subprocess.Popen[str] | None = None


def _workspace_write_probe(path: Path) -> tuple[bool, str]:
    probe = path / ".orch_write_probe.tmp"
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe.write_text("probe", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return True, "ok"
    except Exception as exc:
        try:
            probe.unlink(missing_ok=True)
        except Exception:
            pass
        return False, str(exc)


def _tail_text(path: Path, max_chars: int = 9000) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""
    if len(text) <= max_chars:
        return text
    return text[-max_chars:]


def _latest_task_log_hint(runs_root: Path, task_id: str) -> str:
    run_dirs = [p for p in runs_root.iterdir() if p.is_dir()] if runs_root.exists() else []
    run_dirs.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    for run_dir in run_dirs[:20]:
        log_file = run_dir / f"{task_id}.log"
        if log_file.exists():
            return _tail_text(log_file, 9000)
    return ""


def _looks_like_readonly_policy(log_text: str) -> bool:
    t = (log_text or "").lower()
    if not t:
        return False
    tokens = [
        "sandbox: read-only",
        "blocked by policy",
        "writes are blocked by policy",
        "apply_patch",
        "read-only policy",
    ]
    return ("sandbox: read-only" in t and "blocked by policy" in t) or (
        "writes are blocked by policy" in t
    ) or ("read-only policy" in t and "cannot" in t)


def _looks_like_token_waste_hint(log_text: str) -> bool:
    t = (log_text or "").lower()
    if not t:
        return False
    tokens = [
        "would you like to proceed?",
        "approval required",
        "permission denied",
        "you've hit your limit",
        "hit your limit",
        "rate limit",
        "quota",
        "insufficient credits",
        "blocked by policy",
    ]
    return any(tok in t for tok in tokens)


def _looks_like_claude_quota_or_prompt_block(log_text: str) -> bool:
    t = (log_text or "").lower()
    if not t:
        return False
    tokens = [
        "would you like to proceed?",
        "you've hit your limit",
        "hit your limit",
        "rate limit",
        "quota",
        "insufficient credits",
        "approval required",
    ]
    return any(tok in t for tok in tokens)


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _resolve_prompt(prompt_file: Path, worker: dict[str, Any]) -> str:
    text = prompt_file.read_text(encoding="utf-8")
    mapping = {
        "{{TASK_ID}}": str(worker.get("task_id", "")),
        "{{OWNER}}": str(worker.get("owner", "")),
        "{{REPO}}": str(worker.get("repo", "")),
        "{{SCOPE_PATHS}}": "\n".join(f"- {p}" for p in worker.get("scope_paths", [])),
        "{{GOAL}}": str(worker.get("goal", "")),
        "{{DONE_WHEN}}": "\n".join(f"- {x}" for x in worker.get("done_when", [])),
    }
    for key, value in mapping.items():
        text = text.replace(key, value)
    return text.strip()


def _with_global_prompt(prompt: str, defaults: dict[str, Any], worker: dict[str, Any]) -> str:
    raw_global = worker.get("global_prompt")
    if raw_global is None:
        raw_global = defaults.get("global_prompt", "")
    global_prompt = str(raw_global or "").strip()
    if not global_prompt:
        return prompt
    return f"{global_prompt}\n\n---\n\n{prompt}".strip()


def _to_list_args(value: Any, default: list[str]) -> list[str]:
    if isinstance(value, list):
        return [str(x) for x in value]
    if isinstance(value, str):
        try:
            return shlex.split(value)
        except Exception:
            return [value]
    return list(default)


def _build_codex_command(
    *,
    workspace: str,
    prompt: str,
    model: str,
    reasoning_effort: str,
    sandbox: str,
    skip_git_repo_check: bool,
    codex_cmd: str = "codex",
    dangerously_bypass: bool = False,
) -> list[str]:
    cmd_bin = str(codex_cmd or "codex").strip() or "codex"
    if not os.path.isabs(cmd_bin):
        probe_names = [cmd_bin, "codex", "codex.cmd", "codex.exe", "codex.ps1"]
        resolved = ""
        for cand in probe_names:
            found = shutil.which(cand)
            if found:
                resolved = found
                break
        if resolved:
            cmd_bin = resolved

    cmd = [
        "exec",
        "-C",
        workspace,
        "--sandbox",
        sandbox,
        "-m",
        model,
        "-c",
        f'model_reasoning_effort="{reasoning_effort}"',
    ]
    if str(cmd_bin).lower().endswith(".ps1"):
        cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", cmd_bin, *cmd]
    else:
        cmd = [cmd_bin, *cmd]
    if dangerously_bypass:
        cmd.append("--dangerously-bypass-approvals-and-sandbox")
    if skip_git_repo_check:
        cmd.append("--skip-git-repo-check")
    cmd.append(prompt)
    return cmd


def _build_claude_command(
    *,
    prompt: str,
    worker: dict[str, Any],
    defaults: dict[str, Any],
) -> tuple[list[str] | None, str | None, str | None]:
    requested_cmd = str(
        worker.get("cli_cmd")
        or defaults.get("claude_cmd")
        or os.environ.get("CLAUDE_CLI_CMD")
        or "claude"
    ).strip()
    if not requested_cmd:
        return None, None, "claude command is empty"

    cmd_bin = requested_cmd
    if not os.path.isabs(cmd_bin):
        probe_names = [cmd_bin]
        probe_names.extend(
            [
                "claude-code",
                "claude-code.cmd",
                "claude-code.ps1",
                "claude-code.exe",
                "claude",
                "claude.cmd",
                "claude.ps1",
                "claude.exe",
            ]
        )
        resolved = ""
        for cand in probe_names:
            found = shutil.which(cand)
            if found:
                resolved = found
                break
        if resolved:
            cmd_bin = resolved

    if not os.path.isabs(cmd_bin) and not shutil.which(cmd_bin):
        return None, None, f"claude command not found: {requested_cmd}"

    args = _to_list_args(
        worker.get("cli_args") if worker.get("cli_args") is not None else defaults.get("claude_args"),
        ["--print", "{prompt}"],
    )
    # Permission handling for unattended worker runs.
    # - claude_auto_approve=True => default to bypassPermissions unless caller set mode explicitly.
    # - claude_permission_mode can force one of Claude's supported permission modes.
    auto_approve = bool(
        worker.get("claude_auto_approve")
        if worker.get("claude_auto_approve") is not None
        else defaults.get("claude_auto_approve", False)
    )
    permission_mode = str(
        worker.get("claude_permission_mode")
        if worker.get("claude_permission_mode") is not None
        else defaults.get("claude_permission_mode", os.environ.get("CLAUDE_PERMISSION_MODE", ""))
    ).strip()
    if auto_approve and not permission_mode:
        permission_mode = "bypassPermissions"

    has_permission_mode_flag = any(a == "--permission-mode" for a in args)
    if permission_mode and not has_permission_mode_flag:
        args = ["--permission-mode", permission_mode, *args]

    dangerously_skip = bool(
        worker.get("claude_dangerously_skip_permissions")
        if worker.get("claude_dangerously_skip_permissions") is not None
        else defaults.get("claude_dangerously_skip_permissions", False)
    )
    if dangerously_skip:
        has_dangerous = any(a == "--dangerously-skip-permissions" for a in args)
        has_allow_dangerous = any(a == "--allow-dangerously-skip-permissions" for a in args)
        if not has_allow_dangerous:
            args = ["--allow-dangerously-skip-permissions", *args]
        if not has_dangerous:
            args = ["--dangerously-skip-permissions", *args]

    use_continue = bool(
        worker.get("cli_continue")
        if worker.get("cli_continue") is not None
        else defaults.get("claude_continue", False)
    )
    resume_id = str(
        worker.get("cli_resume")
        if worker.get("cli_resume") is not None
        else defaults.get("claude_resume", "")
    ).strip()
    has_resume_flag = any(a in {"-c", "--continue", "-r", "--resume"} for a in args)
    if use_continue and not has_resume_flag:
        args = ["--continue", *args]
    if resume_id and not has_resume_flag:
        args = ["--resume", resume_id, *args]

    use_stdin = bool(
        worker.get("cli_stdin")
        if worker.get("cli_stdin") is not None
        else defaults.get("claude_stdin", False)
    )

    command: list[str]
    if cmd_bin.lower().endswith(".ps1"):
        command = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            cmd_bin,
        ]
    else:
        command = [cmd_bin]
    replaced_prompt = False
    for raw in args:
        arg = str(raw)
        if "{prompt}" in arg:
            arg = arg.replace("{prompt}", prompt)
            replaced_prompt = True
        command.append(arg)

    stdin_text: str | None = None
    if not replaced_prompt:
        if use_stdin:
            stdin_text = f"{prompt}\n"
        else:
            command.append(prompt)

    return command, stdin_text, None


def _write_manifest(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _no_window_flags() -> int:
    try:
        return int(getattr(subprocess, "CREATE_NO_WINDOW", 0) or 0)
    except Exception:
        return 0


def _latest_run_dir(root: Path) -> Path | None:
    if not root.exists():
        return None
    run_dirs = [p for p in root.iterdir() if p.is_dir()]
    if not run_dirs:
        return None
    return sorted(run_dirs, key=lambda p: p.stat().st_mtime, reverse=True)[0]


def _resolve_worker_workspace(base_workspace: str, worker: dict[str, Any]) -> Path:
    repo = str(worker.get("repo", "")).strip()
    base = Path(base_workspace)
    if repo:
        candidate = (base / repo).resolve()
        if candidate.exists():
            return candidate
    return base.resolve()


def _clear_run_dir(run_dir: Path) -> None:
    if not run_dir.exists():
        return
    for child in run_dir.iterdir():
        try:
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                child.unlink(missing_ok=True)
        except Exception:
            pass


def _prune_legacy_run_dirs(runs_root: Path, orch_id: str, keep_dir: Path) -> None:
    prefix = f"{orch_id}_"
    for child in runs_root.iterdir():
        if not child.is_dir():
            continue
        if child.resolve() == keep_dir.resolve():
            continue
        if child.name.startswith(prefix):
            try:
                shutil.rmtree(child, ignore_errors=True)
            except Exception:
                pass


def main() -> int:
    parser = argparse.ArgumentParser(description="ORCH parallel worker dispatcher")
    parser.add_argument("--tasks-file", required=True, help="Path to tasks JSON")
    parser.add_argument("--model", default="gpt-5.3-codex")
    parser.add_argument("--reasoning-effort", default="xhigh")
    parser.add_argument("--wait", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    tasks_file = Path(args.tasks_file).resolve()
    if not tasks_file.exists():
        print(f"[ERROR] tasks file not found: {tasks_file}")
        return 2

    config = _read_json(tasks_file)
    orch_id = str(config.get("orch_id", "AGENT")).strip().upper() or "AGENT"
    workspace = str(config.get("workspace", str(tasks_file.parents[2])))
    defaults = config.get("defaults", {}) if isinstance(config.get("defaults", {}), dict) else {}
    workers = config.get("workers", [])
    if not isinstance(workers, list):
        print("[ERROR] workers must be a list")
        return 2

    sandbox = str(defaults.get("sandbox", "workspace-write"))
    approval = str(defaults.get("approval", "never"))
    search = bool(defaults.get("search", False))
    read_only_guard_default = bool(defaults.get("read_only_guard", True))
    history_readonly_guard_default = bool(defaults.get("history_readonly_guard", True))
    model = args.model or str(defaults.get("model", "gpt-5.3-codex"))
    reasoning_effort = args.reasoning_effort or str(defaults.get("reasoning_effort", "xhigh"))
    codex_cmd_default = str(
        defaults.get("codex_cmd") or os.environ.get("CODEX_CLI_CMD") or "codex"
    ).strip()
    codex_dangerously_bypass_default = bool(defaults.get("codex_dangerously_bypass", False))
    single_run_dir = bool(defaults.get("single_run_dir", True))
    clean_run_dir = bool(defaults.get("clean_run_dir", True))
    prune_legacy_runs = bool(defaults.get("prune_legacy_runs", True))

    runs_root = tasks_file.parents[1] / "runs"
    runs_root.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    if single_run_dir:
        run_dir = runs_root / orch_id
        if clean_run_dir:
            _clear_run_dir(run_dir)
        run_dir.mkdir(parents=True, exist_ok=True)
        if prune_legacy_runs:
            _prune_legacy_run_dirs(runs_root, orch_id, run_dir)
    else:
        run_dir = runs_root / f"{orch_id}_{stamp}"
        run_dir.mkdir(parents=True, exist_ok=True)

    started: list[WorkerRun] = []
    manual_workers: list[dict[str, Any]] = []

    for worker in workers:
        if not isinstance(worker, dict):
            continue
        if not bool(worker.get("enabled", True)):
            continue

        task_id = str(worker.get("task_id", "UNKNOWN"))
        owner = str(worker.get("owner", "UNKNOWN"))
        role = str(worker.get("role", ""))
        engine = str(worker.get("engine", "codex")).lower()

        if engine in {"manual", "claude-manual"}:
            manual_workers.append(worker)
            continue

        worker_workspace = _resolve_worker_workspace(workspace, worker)
        skip_git_check = not (worker_workspace / ".git").exists()

        # Token guard: skip auto-run if this lane repeatedly fails under policy/quota prompts.
        read_only_guard = bool(worker.get("read_only_guard", read_only_guard_default))
        if engine == "codex" and read_only_guard and not args.dry_run:
            can_write, write_msg = _workspace_write_probe(worker_workspace)
            if not can_write:
                worker = dict(worker)
                worker["engine"] = "manual"
                worker["_manual_reason"] = f"workspace write probe failed: {write_msg}"
                manual_workers.append(worker)
                print(f"[GUARD] {task_id}: switched to manual ({worker['_manual_reason']})")
                continue

        history_guard = bool(worker.get("history_readonly_guard", history_readonly_guard_default))
        if history_guard and not args.dry_run:
            hint = _latest_task_log_hint(runs_root, task_id)
            if _looks_like_readonly_policy(hint) and not bool(worker.get("allow_readonly_retry", False)):
                worker = dict(worker)
                worker["engine"] = "manual"
                worker["_manual_reason"] = "previous run indicates read-only/policy block; skipped to avoid token waste"
                manual_workers.append(worker)
                print(f"[GUARD] {task_id}: switched to manual ({worker['_manual_reason']})")
                continue
            if (
                engine in {"claude", "claude-cli"}
                and _looks_like_claude_quota_or_prompt_block(hint)
                and not bool(worker.get("allow_token_retry", False))
            ):
                worker = dict(worker)
                worker["engine"] = "manual"
                worker["_manual_reason"] = "previous run indicates quota/approval block; skipped to avoid token waste"
                manual_workers.append(worker)
                print(f"[GUARD] {task_id}: switched to manual ({worker['_manual_reason']})")
                continue

        prompt_rel = str(worker.get("prompt_file", "")).strip()
        if not prompt_rel:
            print(f"[WARN] {task_id}: prompt_file missing, skipped")
            continue

        prompt_file = Path(prompt_rel)
        if not prompt_file.is_absolute():
            prompt_file = (tasks_file.parents[2] / prompt_file).resolve()
        if not prompt_file.exists():
            print(f"[WARN] {task_id}: prompt file not found: {prompt_file}")
            continue

        prompt = _resolve_prompt(prompt_file, worker)
        prompt = _with_global_prompt(prompt, defaults, worker)
        command: list[str] | None = None
        stdin_text: str | None = None

        if engine == "codex":
            command = _build_codex_command(
                workspace=str(worker_workspace),
                prompt=prompt,
                model=model,
                reasoning_effort=reasoning_effort,
                sandbox=sandbox,
                skip_git_repo_check=skip_git_check,
                codex_cmd=codex_cmd_default,
                dangerously_bypass=codex_dangerously_bypass_default,
            )
        elif engine in {"claude", "claude-cli"}:
            command, stdin_text, err = _build_claude_command(prompt=prompt, worker=worker, defaults=defaults)
            if err:
                print(f"[WARN] {task_id}: {err}; switched to manual")
                worker = dict(worker)
                worker["engine"] = "claude-manual"
                manual_workers.append(worker)
                continue
        else:
            print(f"[WARN] {task_id}: unsupported engine '{engine}', switched to manual")
            worker = dict(worker)
            worker["engine"] = "manual"
            manual_workers.append(worker)
            continue

        if not command:
            print(f"[WARN] {task_id}: empty command; skipped")
            continue

        log_file = run_dir / f"{task_id}.log"
        run = WorkerRun(
            task_id=task_id,
            owner=owner,
            role=role,
            engine=engine,
            workspace=str(worker_workspace),
            command=command,
            log_file=log_file,
            prompt_file=str(prompt_file),
            repo=str(worker.get("repo", "")),
            stdin_text=stdin_text,
        )
        started.append(run)

    manifest: dict[str, Any] = {
        "orch_id": orch_id,
        "timestamp": stamp,
        "tasks_file": str(tasks_file),
        "workspace": workspace,
        "model": model,
        "reasoning_effort": reasoning_effort,
        "approval_note": f"ignored by current codex exec cli: {approval}",
        "search_note": f"ignored by current codex exec cli: {search}",
        "dry_run": bool(args.dry_run),
        "started": [],
        "manual": [],
        "failed": [],
    }
    manifest_file = run_dir / "manifest.json"

    def _touch_manifest() -> None:
        manifest["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        _write_manifest(manifest_file, manifest)

    # Write initial manifest first so dashboard can discover the run immediately.
    _touch_manifest()

    for run in started:
        entry = {
            "task_id": run.task_id,
            "owner": run.owner,
            "role": run.role,
            "engine": run.engine,
            "command": run.command,
            "log_file": str(run.log_file),
            "workspace": run.workspace,
            "prompt_file": run.prompt_file,
            "repo": run.repo,
            "pid": None,
        }
        if args.dry_run:
            print(f"[DRY] {run.task_id} ({run.engine}) -> {' '.join(run.command[:8])} ...")
            manifest["started"].append(entry)
            _touch_manifest()
            continue

        try:
            log_handle = run.log_file.open("w", encoding="utf-8", errors="replace")
            proc = subprocess.Popen(
                run.command,
                cwd=run.workspace,
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE if run.stdin_text else None,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=_no_window_flags(),
            )
            if run.stdin_text and proc.stdin:
                proc.stdin.write(run.stdin_text)
                proc.stdin.close()
            run.process = proc
            entry["pid"] = proc.pid
            manifest["started"].append(entry)
            _touch_manifest()
            print(f"[START] {run.task_id} ({run.engine}) pid={proc.pid} log={run.log_file}")
        except Exception as exc:
            entry["error"] = str(exc)
            manifest["failed"].append(entry)
            _touch_manifest()
            print(f"[FAIL] {run.task_id}: {exc}")

    for worker in manual_workers:
        manifest["manual"].append(worker)
        _touch_manifest()
        print(
            f"[MANUAL] {worker.get('task_id', 'UNKNOWN')} "
            f"owner={worker.get('owner', 'UNKNOWN')} engine={worker.get('engine', 'manual')} "
            f"reason={worker.get('_manual_reason', '-')}"
        )

    _touch_manifest()
    print(f"[INFO] manifest: {manifest_file}")

    if args.dry_run:
        return 0

    if args.wait:
        pending = [r for r in started if r.process is not None]
        while pending:
            time.sleep(1.0)
            next_pending: list[WorkerRun] = []
            for run in pending:
                assert run.process is not None
                code = run.process.poll()
                if code is None:
                    next_pending.append(run)
                    continue
                print(f"[DONE] {run.task_id} exit={code} log={run.log_file}")
                _touch_manifest()
            pending = next_pending
        print("[INFO] all workers finished")
        return 0

    print("[INFO] dispatcher exited without wait; workers continue in background")
    latest = _latest_run_dir(runs_root)
    if latest is not None:
        print(f"[INFO] latest run dir: {latest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
