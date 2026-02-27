Param()

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

$pythonExe = "python"
try {
    $pyPath = (Get-Command python -ErrorAction Stop).Source
    if ($pyPath) {
        $candidate = Join-Path (Split-Path -Parent $pyPath) "pythonw.exe"
        if (Test-Path $candidate) {
            $pythonExe = $candidate
        }
    }
} catch {
    $pythonExe = "python"
}

& $pythonExe "$root\server_control_gui.py"
