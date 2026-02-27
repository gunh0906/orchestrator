param(
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

$runnerRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$archiveRoot = Join-Path $runnerRoot "archive"
$archiveTasks = Join-Path $archiveRoot "tasks"
$archivePrompts = Join-Path $archiveRoot "prompts"

New-Item -ItemType Directory -Force -Path $archiveTasks | Out-Null
New-Item -ItemType Directory -Force -Path $archivePrompts | Out-Null

function Move-Safe {
    param(
        [string]$SourcePath,
        [string]$DestPath
    )
    if (-not (Test-Path $SourcePath)) { return }
    if ($WhatIf) {
        Write-Host "[WhatIf] move $SourcePath -> $DestPath"
        return
    }
    Move-Item -Force -Path $SourcePath -Destination $DestPath
    Write-Host "[MOVE] $SourcePath -> $DestPath"
}

# Archive legacy ORCH task definitions and keep AGENT active at root.
Get-ChildItem $runnerRoot -Filter "tasks.ORCH-*.json" -File | ForEach-Object {
    Move-Safe -SourcePath $_.FullName -DestPath (Join-Path $archiveTasks $_.Name)
}

# Archive legacy ORCH prompt cards and keep AGENT-T* active at root.
$promptDir = Join-Path $runnerRoot "prompts"
if (Test-Path $promptDir) {
    Get-ChildItem $promptDir -Filter "ORCH-*.md" -File | ForEach-Object {
        Move-Safe -SourcePath $_.FullName -DestPath (Join-Path $archivePrompts $_.Name)
    }
}

# Clear cached bytecode (re-generated automatically).
Get-ChildItem $runnerRoot -Recurse -Directory -Filter "__pycache__" | ForEach-Object {
    if ($WhatIf) {
        Write-Host "[WhatIf] remove $($_.FullName)"
    } else {
        Remove-Item -Recurse -Force $_.FullName
        Write-Host "[DEL] $($_.FullName)"
    }
}

$readme = @'
# Runner Archive

- `tasks/`: archived legacy `tasks.ORCH-*.json`
- `prompts/`: archived legacy `ORCH-*.md`

Active files remain in `runner/`:
- `tasks.AGENT.json`
- `prompts/AGENT-T1.md` ... `prompts/AGENT-T5.md`
'@

if ($WhatIf) {
    Write-Host "[WhatIf] write $archiveRoot\\README.md"
} else {
    $readme | Set-Content -Encoding UTF8 (Join-Path $archiveRoot "README.md")
    Write-Host "[WRITE] $archiveRoot\\README.md"
}

Write-Host "[DONE] runner organization complete"
