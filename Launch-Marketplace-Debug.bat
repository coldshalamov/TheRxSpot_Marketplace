@echo off
TITLE TheRxSpot Marketplace - Command Center (DEBUG)
echo ===================================================
echo   TheRxSpot Marketplace Launcher (DEBUG)
echo ===================================================
echo.
echo Launching services with verbose output...
powershell -ExecutionPolicy Bypass -File "%~dp0Launch-Marketplace-Debug.ps1"
echo.
echo ===================================================
echo Done. If terminal windows closed unexpectedly,
echo check the logs in the opened terminal sessions.
echo ===================================================
pause
