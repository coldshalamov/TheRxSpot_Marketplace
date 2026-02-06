#!/usr/bin/env pwsh
# Admin Panel Diagnostic Script

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Medusa Admin Panel Diagnostics" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeConfigPath = Join-Path $repoRoot "launcher_assets\runtime-config.js"
$defaultCandidatePorts = @(9000, 9001)

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

function Try-GetBackendPortFromRuntimeConfig {
    param([string]$ConfigPath)

    if (-not (Test-Path $ConfigPath)) {
        return $null
    }

    $configContent = Get-Content $ConfigPath -Raw
    if ($configContent -match 'backendPort:\s*(\d+)') {
        return [int]$matches[1]
    }

    return $null
}

function Test-BackendHealth {
    param([int]$Port)

    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Test-AdminPath {
    param(
        [int]$Port,
        [string]$AdminPath
    )

    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port$AdminPath" -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
        return @{
            Success = $true
            StatusCode = $response.StatusCode
            Url = "http://localhost:$Port$AdminPath"
        }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        return @{
            Success = $false
            StatusCode = $statusCode
            Url = "http://localhost:$Port$AdminPath"
        }
    }
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

# 2. Check configured admin path
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

# 3. Determine active backend port
Write-Host "`n[3/5] Detecting active Medusa backend port..." -ForegroundColor Yellow
$runtimePort = Try-GetBackendPortFromRuntimeConfig -ConfigPath $runtimeConfigPath
$candidatePorts = @()
if ($runtimePort) {
    $candidatePorts += $runtimePort
}
$candidatePorts += $defaultCandidatePorts
$candidatePorts = $candidatePorts | Select-Object -Unique

$healthyPorts = @()
foreach ($port in $candidatePorts) {
    if (Test-BackendHealth -Port $port) {
        $healthyPorts += $port
        Write-Host "  [OK] /health is reachable on port $port" -ForegroundColor Green
    } else {
        $owner = Get-PortOwnerName -Port $port
        if ($owner) {
            Write-Host "  [WARN] Port $port is occupied by '$owner' but is not a healthy Medusa backend" -ForegroundColor Yellow
        } else {
            Write-Host "  [INFO] Port $port has no listener" -ForegroundColor Gray
        }
    }
}

if (-not $healthyPorts) {
    Write-Host "  [X] No healthy Medusa backend found on ports: $($candidatePorts -join ', ')" -ForegroundColor Red
    Write-Host "      Start the stack with .\Launch-Marketplace.ps1" -ForegroundColor Yellow
    exit 1
}

$activeBackendPort = $healthyPorts[0]
Write-Host "  [OK] Active backend selected: $activeBackendPort" -ForegroundColor Green

# 4. Test admin panel access on active backend
Write-Host "`n[4/5] Testing admin panel access..." -ForegroundColor Yellow
$adminTest = Test-AdminPath -Port $activeBackendPort -AdminPath $adminPath
if ($adminTest.Success) {
    Write-Host "  [OK] Admin panel accessible (Status: $($adminTest.StatusCode))" -ForegroundColor Green
    Write-Host "  [OK] URL: $($adminTest.Url)" -ForegroundColor Green
} else {
    $statusText = if ($adminTest.StatusCode) { "HTTP $($adminTest.StatusCode)" } else { "no response" }
    Write-Host "  [X] Admin panel failed on active backend ($statusText)" -ForegroundColor Red
}

# 5. Summary and next steps
Write-Host "`n[5/5] Summary..." -ForegroundColor Yellow
if ($adminTest.Success) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "[OK] DIAGNOSIS: Admin panel is working" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nOpen in browser: $($adminTest.Url)" -ForegroundColor Cyan
} else {
    Write-Host "`n========================================" -ForegroundColor Red
    Write-Host "[X] DIAGNOSIS: Backend is up, but admin route is failing" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "`nRecommended checks:" -ForegroundColor Cyan
    Write-Host "  1. Stop all marketplace terminals and rerun .\Launch-Marketplace.ps1" -ForegroundColor White
    Write-Host "  2. Rebuild admin assets with npm run build" -ForegroundColor White
    Write-Host "  3. Confirm medusa-config.ts admin.path still matches your expected route" -ForegroundColor White
}

Write-Host "`n"
