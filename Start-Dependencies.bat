@echo off
TITLE TheRxSpot Marketplace - Dependency Starter
echo ===================================================
echo   Checking Database Dependencies
echo ===================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0Start-Dependencies.ps1"
