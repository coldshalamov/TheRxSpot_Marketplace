#!/usr/bin/env pwsh
# Admin Panel Diagnostic Script

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Medusa Admin Panel Diagnostics" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Check if admin panel is built
Write-Host "[1/5] Checking if admin panel is built..." -ForegroundColor Yellow
$adminIndex = Join-Path $repoRoot ".medusa\server\public\admin\index.html"
$adminBuilt = Test-Path $adminIndex

if ($adminBuilt) {
    Write-Host "  ✅ Admin panel files exist at .medusa\server\public\admin\" -ForegroundColor Green
} else {
    Write-Host "  ❌ Admin panel NOT built - need to run 'npm run build'" -ForegroundColor Red
    exit 1
}

# 2. Check config
Write-Host "`n[2/5] Checking medusa-config.ts..." -ForegroundColor Yellow
$configPath = Join-Path $repoRoot "medusa-config.ts"
$configContent = Get-Content $configPath -Raw
if ($configContent -match 'path:\s*"([^"]+)"') {
    $adminPath = $matches[1]
    Write-Host "  ✅ Admin path configured as: $adminPath" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Could not detect admin path in config" -ForegroundColor Yellow
    $adminPath = "/app"
}

# 3. Check if backend is running
Write-Host "`n[3/5] Checking if Medusa backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9000/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✅ Backend is running (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Backend is NOT running on port 9000" -ForegroundColor Red
    Write-Host "     Start it with: npm run dev" -ForegroundColor Yellow
    exit 1
}

# 4. Test admin panel access
Write-Host "`n[4/5] Testing admin panel access at http://localhost:9000$adminPath..." -ForegroundColor Yellow
try {
    $adminResponse = Invoke-WebRequest -Uri "http://localhost:9000$adminPath" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✅ Admin panel accessible (Status: $($adminResponse.StatusCode))" -ForegroundColor Green
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "✅ DIAGNOSIS: Admin panel is working!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nOpen in browser: http://localhost:9000$adminPath" -ForegroundColor Cyan
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "  ❌ Admin panel returns HTTP $statusCode" -ForegroundColor Red

    # 5. Diagnose the issue
    Write-Host "`n[5/5] Diagnosing the issue..." -ForegroundColor Yellow

    # Check if the backend was started before build
    $backendProc = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.StartTime -and $_.StartTime -lt (Get-Item $adminIndex).LastWriteTime
    }

    if ($backendProc) {
        Write-Host "`n========================================" -ForegroundColor Yellow
        Write-Host "⚠️  DIAGNOSIS: Backend was started BEFORE the admin panel was built!" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Yellow
        Write-Host "`n💡 SOLUTION:" -ForegroundColor Cyan
        Write-Host "   1. Stop all PowerShell windows running npm/node" -ForegroundColor White
        Write-Host "   2. Re-run the launcher: .\Launch-Marketplace.bat" -ForegroundColor White
        Write-Host "`n   OR restart just the backend:" -ForegroundColor White
        Write-Host "   - Stop the Medusa backend process" -ForegroundColor White
        Write-Host "   - Run: npm run dev" -ForegroundColor White
    } else {
        Write-Host "`n========================================" -ForegroundColor Red
        Write-Host "❌ DIAGNOSIS: Unknown issue" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "`n💡 POSSIBLE SOLUTIONS:" -ForegroundColor Cyan
        Write-Host "   1. Rebuild the admin panel: npm run build" -ForegroundColor White
        Write-Host "   2. Check environment variables in .env file" -ForegroundColor White
        Write-Host "   3. Look for errors in the Medusa backend console" -ForegroundColor White
        Write-Host "`n   Check the backend logs for errors" -ForegroundColor Yellow
    }
}

Write-Host "`n"
