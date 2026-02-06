@echo off
TITLE TheRxSpot Marketplace - Storefront Only Launcher
echo ===================================================
echo   TheRxSpot Marketplace Storefront Launcher
echo ===================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0Launch-Storefront-Only.ps1"
echo.
echo ===================================================
echo Done.
echo ===================================================
pause
