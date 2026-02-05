#!/usr/bin/env pwsh
# TheRxSpot Marketplace Launch Script (DEBUG VERSION)
$ErrorActionPreference = 'Stop'

Write-Host '===================================================' -ForegroundColor Cyan
Write-Host '   TheRxSpot Marketplace | Service Orchestrator' -ForegroundColor Cyan
Write-Host '   DEBUG MODE - Verbose Output' -ForegroundColor Yellow
Write-Host '===================================================' -ForegroundColor Cyan

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
$storefrontRoot = Join-Path $repoRoot "TheRxSpot_Marketplace-storefront"
$launcherHtml = Join-Path $repoRoot "Marketplace-Launcher.html"

Write-Host "[DEBUG] Repo root: $repoRoot" -ForegroundColor Gray
Write-Host "[DEBUG] Storefront root: $storefrontRoot" -ForegroundColor Gray

# Step 0: Check Dependencies
Write-Host "`n[0/4] Checking dependencies..." -ForegroundColor Yellow

# Fast port check function
function Test-Port {
    param($Port)
    Write-Host "[DEBUG] Testing port $Port..." -ForegroundColor Gray
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ReceiveTimeout = 1000
        $tcpClient.SendTimeout = 1000
        $result = $tcpClient.BeginConnect("127.0.0.1", $Port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne(1000, $false)
        $tcpClient.Close()
        Write-Host "[DEBUG] Port $Port result: $success" -ForegroundColor Gray
        return $success
    } catch {
        Write-Host "[DEBUG] Port $Port error: $_" -ForegroundColor Red
        return $false
    }
}

Write-Host "[DEBUG] Checking PostgreSQL..." -ForegroundColor Gray
$pgReady = Test-Port 5432
Write-Host "[DEBUG] Checking Redis..." -ForegroundColor Gray
$redisReady = Test-Port 6379

if (-not $pgReady) {
    Write-Host '❌ PostgreSQL is not running on port 5432' -ForegroundColor Red
    Write-Host '   Please run Start-Dependencies.bat first to start PostgreSQL' -ForegroundColor Yellow
    pause
    exit 1
}

if (-not $redisReady) {
    Write-Host '❌ Redis is not running on port 6379' -ForegroundColor Red
    Write-Host '   Please run Start-Dependencies.bat first to start Redis' -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host '✅ PostgreSQL: Ready' -ForegroundColor Green
Write-Host '✅ Redis: Ready' -ForegroundColor Green

# Step 1: Check if build exists
Write-Host "`n[1/4] Validating backend build..." -ForegroundColor Yellow
$buildPath = Join-Path $repoRoot ".medusa\server"
$adminPath = Join-Path $buildPath "public\admin\index.html"

Write-Host "[DEBUG] Checking for: $adminPath" -ForegroundColor Gray

if (-not (Test-Path $adminPath)) {
    Write-Host '⚠️  First-time setup detected. Building backend...' -ForegroundColor Yellow
    Write-Host 'This may take 2-3 minutes...' -ForegroundColor Gray

    Set-Location $repoRoot
    Write-Host "[DEBUG] Running: npm run build" -ForegroundColor Gray
    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n❌ Build failed. Please check for errors above." -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "`n✅ Backend build complete!" -ForegroundColor Green
} else {
    Write-Host '✅ Backend already built' -ForegroundColor Green
}

# Step 2: Start Medusa Backend
Write-Host "`n[2/4] Launching Medusa Backend (:9000)..." -ForegroundColor Green
Write-Host "[DEBUG] Starting backend process..." -ForegroundColor Gray

try {
    $backendProc = Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$repoRoot`"; npm run dev" -PassThru
    Write-Host "[DEBUG] Backend process started: PID $($backendProc.Id)" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Failed to start backend: $_" -ForegroundColor Red
    pause
    exit 1
}

# Wait for Backend to initialize
Write-Host '⏳ Waiting for backend to initialize...' -ForegroundColor Gray
Start-Sleep -Seconds 8
Write-Host "[DEBUG] Backend wait complete" -ForegroundColor Gray

# Step 3: Start Next.js Storefront
Write-Host "`n[3/4] Launching Next.js Storefront (:8000)..." -ForegroundColor Green
Write-Host "[DEBUG] Starting storefront process..." -ForegroundColor Gray

try {
    $storefrontProc = Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$storefrontRoot`"; npm run dev" -PassThru
    Write-Host "[DEBUG] Storefront process started: PID $($storefrontProc.Id)" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Failed to start storefront: $_" -ForegroundColor Red
    pause
    exit 1
}

# Step 4: Open the Control Center
Write-Host "`n[4/4] Opening Command Center Interface..." -ForegroundColor Green
Write-Host "[DEBUG] Waiting 3 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host "[DEBUG] Opening: $launcherHtml" -ForegroundColor Gray
Start-Process $launcherHtml

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host '✅ All systems deployed successfully!' -ForegroundColor Green
Write-Host "===================================================`n" -ForegroundColor Cyan
Write-Host '📊 Monitor the PowerShell windows for startup logs' -ForegroundColor Yellow
Write-Host '🌐 Command Center opening in your browser...' -ForegroundColor Yellow
Write-Host "`n⏳ Services may take 30-60 seconds to fully initialize" -ForegroundColor Gray
Write-Host ''
