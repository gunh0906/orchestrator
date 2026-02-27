# Orchestrator Runner (Codex Parallel)

This runner starts Codex workers in parallel from one command.

## What it does
- Reads task allocation from `orchestrator/runner/tasks.AGENT.json`.
- Launches each `engine=codex` task with `codex exec` in parallel.
- Writes logs and run manifest under `orchestrator/runs/<ORCH_ID>/` (single active run mode).
- Keeps non-codex lanes (example: `claude-manual`) as manual relay slots.

## Default model profile
- Model: `gpt-5.3-codex`
- Reasoning effort: `xhigh`

## One-command start
```powershell
cd D:\Development
powershell -ExecutionPolicy Bypass -File .\orchestrator\run_workers.ps1 -OrchId AGENT
```

## Start and wait for completion
```powershell
cd D:\Development
powershell -ExecutionPolicy Bypass -File .\orchestrator\run_workers.ps1 -Wait
```

## Dry-run (show launch plan only)
```powershell
cd D:\Development
powershell -ExecutionPolicy Bypass -File .\orchestrator\run_workers.ps1 -DryRun
```

## PM delegation with dynamic worker count (1~10)
```powershell
cd D:\Development
powershell -ExecutionPolicy Bypass -File .\orchestrator\run_workers.ps1 `
  -OrchId AGENT `
  -PmDelegate `
  -PmRequest "ui login dark theme" `
  -MinWorkers 1 `
  -MaxWorkers 6
```

## Check latest run status/logs
```powershell
cd D:\Development
powershell -ExecutionPolicy Bypass -File .\orchestrator\status_workers.ps1
```

## Stop latest run workers
```powershell
cd D:\Development
powershell -ExecutionPolicy Bypass -File .\orchestrator\stop_workers.ps1
```

## Notes
- This is CLI-based parallel execution, not chat-window auto control.
- Claude lane is manual by design in this setup (`engine=claude-manual`).
- Each worker must write outcome to `orchestrator/results.md`.

## Dashboard UI
Start dashboard:

```powershell
cd D:\Development
powershell -ExecutionPolicy Bypass -File .\orchestrator\run_dashboard.ps1
```

Open:

```text
http://127.0.0.1:8877
```

GUI controller (same dashboard tone):

```powershell
cd D:\Development\orchestrator
.\run_server_control_gui.cmd
```

## Runner folder organization
Archive legacy ORCH task/prompt cards and keep AGENT files active:

```powershell
cd D:\Development
powershell -ExecutionPolicy Bypass -File .\orchestrator\runner\organize_runner_files.ps1
```
