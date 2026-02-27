param(
    [string]$OrchId = "AGENT",
    [string]$Model = "gpt-5.3-codex",
    [string]$ReasoningEffort = "xhigh",
    [switch]$PmDelegate,
    [string]$PmRequest = "",
    [int]$MinWorkers = 1,
    [int]$MaxWorkers = 10,
    [switch]$Wait,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$tasksFile = Join-Path $PSScriptRoot ("runner\tasks.{0}.json" -f $OrchId)
$dispatcher = Join-Path $PSScriptRoot "runner\dispatch.py"
$pmDelegateScript = Join-Path $PSScriptRoot "runner\pm_delegate.py"

if (-not (Test-Path $tasksFile)) {
    throw "Tasks file not found: $tasksFile"
}
if (-not (Test-Path $dispatcher)) {
    throw "Dispatcher not found: $dispatcher"
}
if (($PmDelegate -or -not [string]::IsNullOrWhiteSpace($PmRequest)) -and -not (Test-Path $pmDelegateScript)) {
    throw "PM delegate script not found: $pmDelegateScript"
}

if ($PmDelegate -or -not [string]::IsNullOrWhiteSpace($PmRequest)) {
    Write-Host "[ORCH] PM delegation enabled"
    $pmArgs = @(
        $pmDelegateScript,
        "--tasks-file", $tasksFile,
        "--min-workers", ([Math]::Max(1, $MinWorkers)),
        "--max-workers", ([Math]::Max(1, [Math]::Min(10, $MaxWorkers)))
    )
    if (-not [string]::IsNullOrWhiteSpace($PmRequest)) {
        $pmArgs += @("--request", $PmRequest)
    }
    python @pmArgs
}

$args = @(
    $dispatcher,
    "--tasks-file", $tasksFile,
    "--model", $Model,
    "--reasoning-effort", $ReasoningEffort
)
if ($Wait) { $args += "--wait" }
if ($DryRun) { $args += "--dry-run" }

Write-Host "[ORCH] workspace: $root"
Write-Host "[ORCH] tasks: $tasksFile"
Write-Host "[ORCH] model: $Model / reasoning: $ReasoningEffort"
python @args
