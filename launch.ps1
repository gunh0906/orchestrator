param(
    [string]$OrchId = "AGENT",
    [string]$Model = "gpt-5.3-codex",
    [string]$ReasoningEffort = "xhigh",
    [string]$PmRequest = "",
    [int]$MinWorkers = 1,
    [int]$MaxWorkers = 6,
    [switch]$DryRun,
    [switch]$NoBrowser,
    [switch]$Wait,
    [int]$DashboardPort = 8877
)

$ErrorActionPreference = "Stop"

# --- 1. Dashboard check ---
$dashboardRunning = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", $DashboardPort)
    $tcp.Close()
    $dashboardRunning = $true
} catch {
    $dashboardRunning = $false
}

if ($dashboardRunning) {
    Write-Host "[LAUNCH] Dashboard already running on port $DashboardPort - skipping"
} else {
    Write-Host "[LAUNCH] Starting dashboard on port $DashboardPort ..."

    $pythonExe = "python"
    try {
        $pyPath = (Get-Command python -ErrorAction Stop).Source
        if ($pyPath) {
            $candidate = Join-Path (Split-Path -Parent $pyPath) "pythonw.exe"
            if (Test-Path $candidate) {
                $pythonExe = $candidate
            }
        }
    } catch {}

    $dashScript = Join-Path $PSScriptRoot "dashboard.py"
    if (-not (Test-Path $dashScript)) {
        throw "Dashboard script not found: $dashScript"
    }

    Start-Process -FilePath $pythonExe -ArgumentList "`"$dashScript`" --port $DashboardPort" -WindowStyle Hidden
    Write-Host "[LAUNCH] Dashboard started (pid background)"

    # Wait for dashboard to be ready
    $ready = $false
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", $DashboardPort)
            $tcp.Close()
            $ready = $true
            break
        } catch {}
    }
    if ($ready) {
        Write-Host "[LAUNCH] Dashboard ready"
    } else {
        Write-Host "[LAUNCH] WARNING: Dashboard may not be ready yet, continuing anyway"
    }
}

# --- 2. Open browser ---
if (-not $NoBrowser) {
    Write-Host "[LAUNCH] Opening browser -> http://127.0.0.1:$DashboardPort"
    Start-Process "http://127.0.0.1:$DashboardPort"
}

# --- 3. Run workers ---
if ($DryRun) {
    Write-Host "[LAUNCH] DryRun mode - skipping worker launch"
    exit 0
}

if ([string]::IsNullOrWhiteSpace($PmRequest)) {
    Write-Host "[LAUNCH] No PmRequest provided - skipping worker launch"
    exit 0
}

Write-Host "[LAUNCH] Starting workers (OrchId=$OrchId, PmRequest=$PmRequest) ..."
$workerScript = Join-Path $PSScriptRoot "run_workers.ps1"
if (-not (Test-Path $workerScript)) {
    throw "Worker script not found: $workerScript"
}

$workerArgs = @{
    OrchId           = $OrchId
    Model            = $Model
    ReasoningEffort  = $ReasoningEffort
    PmRequest        = $PmRequest
    MinWorkers       = $MinWorkers
    MaxWorkers       = $MaxWorkers
}
if ($Wait) { $workerArgs["Wait"] = $true }

& $workerScript @workerArgs

# --- 4. Post-run: collect results for review ---
if ($Wait) {
    $runDir = Join-Path $PSScriptRoot "runs\$OrchId"
    $resultsFile = Join-Path $PSScriptRoot "results.md"
    $statusFile = Join-Path $PSScriptRoot "status_report.md"

    Write-Host ""
    Write-Host "=========================================="
    Write-Host "[LAUNCH] All workers completed."
    Write-Host "=========================================="
    Write-Host "[LAUNCH] Run dir:       $runDir"
    Write-Host "[LAUNCH] Results:       $resultsFile"
    Write-Host "[LAUNCH] Status report: $statusFile"

    # Show summary of each worker log
    $manifest = Join-Path $runDir "manifest.json"
    if (Test-Path $manifest) {
        $mdata = Get-Content $manifest -Raw | ConvertFrom-Json
        Write-Host ""
        Write-Host "[LAUNCH] Worker results summary:"
        foreach ($w in $mdata.workers) {
            $logFile = Join-Path $runDir "$($w.task_id).log"
            $logSize = if (Test-Path $logFile) { (Get-Item $logFile).Length } else { 0 }
            $status = if ($w.exit_code -eq 0) { "OK" } else { "FAIL(exit=$($w.exit_code))" }
            Write-Host "  $($w.task_id) [$($w.engine)] $status  (log: ${logSize} bytes)"
        }
    }

    Write-Host ""
    Write-Host "[LAUNCH] Ready for review."
}
