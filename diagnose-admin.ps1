#!/usr/bin/env pwsh
# Admin Panel Diagnostic Script

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Medusa Admin Panel Diagnostics" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$preferredPort = 9000

function Get-PortOwnerName {
    param([int]$Port)
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $listener) {
        return $null
    }

    $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) {
        return $proc.ProcessName
    }

    return "PID $($listener.OwningProcess)"
}

# 1. Check if admin panel is built
Write-Host "[1/5] Checking if admin panel is built..." -ForegroundColor Yellow
$adminIndex = Join-Path $repoRoot ".medusa\server\public\admin\index.html"
$adminBuilt = Test-Path $adminIndex

if ($adminBuilt) {
    Write-Host "  [OK] Admin panel files exist at .medusa\server\public\admin\" -ForegroundColor Green
} else {
    Write-Host "  [X] Admin panel not built - run 'npm run build'" -ForegroundColor Red
    exit 1
}

# 2. Check config
Write-Host "`n[2/5] Checking medusa-config.ts..." -ForegroundColor Yellow
$configPath = Join-Path $repoRoot "medusa-config.ts"
$configContent = Get-Content $configPath -Raw
if ($configContent -match 'path:\s*"([^"]+)"') {
    $adminPath = $matches[1]
    Write-Host "  [OK] Admin path configured as: $adminPath" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Could not detect admin path in config" -ForegroundColor Yellow
    $adminPath = "/app"
}

# 3. Check if backend is running
Write-Host "`n[3/5] Checking if Medusa backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$preferredPort/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "  [OK] Backend health endpoint returned $($response.StatusCode)" -ForegroundColor Green
} catch {
    $ownerName = Get-PortOwnerName -Port $preferredPort
    if ($ownerName) {
        Write-Host "  [X] Port $preferredPort is occupied by '$ownerName' (not Medusa /health)." -ForegroundColor Red
        Write-Host "      This causes the Admin button to open the wrong app (white screen)." -ForegroundColor Yellow
        Write-Host "      Run .\Launch-Marketplace.ps1 to auto-select a valid backend port." -ForegroundColor Yellow
    } else {
        Write-Host "  [X] Backend is not running on port $preferredPort." -ForegroundColor Red
        Write-Host "      Start it with: npm run dev" -ForegroundColor Yellow
    }
    exit 1
}

# 4. Test admin panel access
Write-Host "`n[4/5] Testing admin panel access at http://localhost:$preferredPort$adminPath..." -ForegroundColor Yellow
try {
    $adminResponse = Invoke-WebRequest -Uri "http://localhost:$preferredPort$adminPath" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "  [OK] Admin panel accessible (Status: $($adminResponse.StatusCode))" -ForegroundColor Green
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "[OK] DIAGNOSIS: Admin panel is working on port $preferredPort" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nOpen in browser: http://localhost:$preferredPort$adminPath" -ForegroundColor Cyan
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "  [X] Admin panel returns HTTP $statusCode" -ForegroundColor Red

    # 5. Diagnose the issue
    Write-Host "`n[5/5] Diagnosing the issue..." -ForegroundColor Yellow

    $backendProc = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.StartTime -and $_.StartTime -lt (Get-Item $adminIndex).LastWriteTime
    }

    if ($backendProc) {
        Write-Host "`n========================================" -ForegroundColor Yellow
        Write-Host "[WARN] DIAGNOSIS: Backend was started before the admin panel was built" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Yellow
        Write-Host "`nSOLUTION:" -ForegroundColor Cyan
        Write-Host "  1. Stop all PowerShell windows running npm/node" -ForegroundColor White
        Write-Host "  2. Re-run the launcher: .\Launch-Marketplace.ps1" -ForegroundColor White
        Write-Host "`n  OR restart just the backend:" -ForegroundColor White
        Write-Host "  - Stop the Medusa backend process" -ForegroundColor White
        Write-Host "  - Run: npm run dev" -ForegroundColor White
    } else {
        Write-Host "`n========================================" -ForegroundColor Red
        Write-Host "[X] DIAGNOSIS: Unknown issue" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "`nPOSSIBLE SOLUTIONS:" -ForegroundColor Cyan
        Write-Host "  1. Rebuild the admin panel: npm run build" -ForegroundColor White
        Write-Host "  2. Check environment variables in .env file" -ForegroundColor White
        Write-Host "  3. Look for errors in the Medusa backend console" -ForegroundColor White
    }
}

Write-Host "`n"
