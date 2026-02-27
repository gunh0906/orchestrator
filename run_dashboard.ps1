param(
    [string]$Host = "127.0.0.1",
    [int]$Port = 8877
)

$ErrorActionPreference = "Stop"
python "$PSScriptRoot\dashboard.py" --host $Host --port $Port
