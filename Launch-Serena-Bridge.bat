@echo off
setlocal
set "REPO_ROOT=%~dp0"
powershell -NoExit -ExecutionPolicy Bypass -File "%REPO_ROOT%Launch-Serena-Bridge.ps1" -ProjectPath "."
endlocal
