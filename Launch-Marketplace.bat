@echo off
TITLE TheRxSpot Marketplace - Command Center
echo ===================================================
echo   TheRxSpot Marketplace Launcher
echo ===================================================
echo.
echo Launching services...
powershell -ExecutionPolicy Bypass -File "%~dp0Launch-Marketplace.ps1"
echo.
echo ===================================================
echo Done. If terminal windows closed unexpectedly,
echo check the logs in the opened terminal sessions.
echo ===================================================
pause
