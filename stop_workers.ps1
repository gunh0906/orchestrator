param(
    [string]$RunName = ""
)

$ErrorActionPreference = "Stop"

$runsRoot = Join-Path $PSScriptRoot "runs"
if (-not (Test-Path $runsRoot)) {
    Write-Host "[ORCH] runs directory not found: $runsRoot"
    exit 0
}

if ([string]::IsNullOrWhiteSpace($RunName)) {
    $runDir = Get-ChildItem $runsRoot -Directory | Sort-Object Name | Select-Object -Last 1
} else {
    $runPath = Join-Path $runsRoot $RunName
    if (Test-Path $runPath) {
        $runDir = Get-Item $runPath
    } else {
        throw "Run not found: $runPath"
    }
}

if ($null -eq $runDir) {
    Write-Host "[ORCH] no run to stop."
    exit 0
}

$manifestPath = Join-Path $runDir.FullName "manifest.json"
if (-not (Test-Path $manifestPath)) {
    Write-Host "[ORCH] manifest not found: $manifestPath"
    exit 0
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
foreach ($entry in $manifest.started) {
    $procId = $entry.pid
    if (-not $procId) { continue }
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host ("[STOP] {0} pid={1}" -f $entry.task_id, $procId)
        Stop-Process -Id $procId -Force
    } else {
        Write-Host ("[SKIP] {0} pid={1} already exited" -f $entry.task_id, $procId)
    }
}

Write-Host "[ORCH] stop request completed."
