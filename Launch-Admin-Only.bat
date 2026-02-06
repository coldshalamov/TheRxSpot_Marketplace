@echo off
TITLE TheRxSpot Marketplace - Admin Only Launcher
echo ===================================================
echo   TheRxSpot Marketplace Admin Launcher
echo ===================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0Launch-Admin-Only.ps1"
echo.
echo ===================================================
echo Done.
echo ===================================================
pause
