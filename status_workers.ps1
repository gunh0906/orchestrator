param(
    [string]$OrchId = "",
    [int]$Tail = 30
)

$ErrorActionPreference = "Stop"

$runsRoot = Join-Path $PSScriptRoot "runs"
if (-not (Test-Path $runsRoot)) {
    Write-Host "[ORCH] runs directory not found: $runsRoot"
    exit 0
}

$dirs = Get-ChildItem $runsRoot -Directory
if ($OrchId -and $OrchId.Trim().Length -gt 0) {
    $want = $OrchId.Trim().ToUpper()
    $exact = $dirs | Where-Object { $_.Name.ToUpper() -eq $want }
    if ($exact) {
        $dirs = $exact
    } else {
        $prefix = ($want + "_")
        $dirs = $dirs | Where-Object { $_.Name.ToUpper().StartsWith($prefix) }
    }
}
$latest = $dirs | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($null -eq $latest) {
    if ($OrchId -and $OrchId.Trim().Length -gt 0) {
        Write-Host "[ORCH] no runs found for OrchId=$OrchId"
    } else {
        Write-Host "[ORCH] no runs found."
    }
    exit 0
}

$manifestPath = Join-Path $latest.FullName "manifest.json"
if (-not (Test-Path $manifestPath)) {
    Write-Host "[ORCH] manifest not found in latest run: $($latest.FullName)"
    exit 0
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

Write-Host "[ORCH] latest run: $($latest.Name)"
Write-Host "[ORCH] model: $($manifest.model), reasoning: $($manifest.reasoning_effort)"
Write-Host ""

foreach ($entry in $manifest.started) {
    $task = $entry.task_id
    $procId = $entry.pid
    $log = $entry.log_file
    $proc = $null
    if ($procId) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    }
    $state = if ($proc) { "RUNNING" } else { "EXITED" }
    Write-Host ("[{0}] pid={1} state={2}" -f $task, $procId, $state)
    if (Test-Path $log) {
        Get-Content $log -Tail $Tail
    } else {
        Write-Host "  (no log yet)"
    }
    Write-Host ("-" * 80)
}

if ($manifest.manual.Count -gt 0) {
    Write-Host "[ORCH] manual lanes:"
    foreach ($m in $manifest.manual) {
        Write-Host ("- {0} owner={1} engine={2}" -f $m.task_id, $m.owner, $m.engine)
    }
}
