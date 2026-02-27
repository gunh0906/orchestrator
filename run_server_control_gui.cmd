@echo off
setlocal
set SCRIPT_DIR=%~dp0
start "" /b powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%SCRIPT_DIR%run_server_control_gui.ps1"
endlocal
