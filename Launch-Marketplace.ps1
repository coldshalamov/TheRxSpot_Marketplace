# TheRxSpot Marketplace Launch Script
$ErrorActionPreference = 'Stop'

Write-Host '
===================================================' -ForegroundColor Cyan
Write-Host '   TheRxSpot Marketplace | Service Orchestrator' -ForegroundColor Cyan
Write-Host '===================================================
' -ForegroundColor Cyan

# Step 0: Check Dependencies
Write-Host '[0/4] Checking dependencies...' -ForegroundColor Yellow

$pgReady = $false
$redisReady = $false

try {
    $testPg = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue -InformationLevel Quiet
    $pgReady = $testPg
} catch { }

try {
    $testRedis = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue -InformationLevel Quiet
    $redisReady = $testRedis
} catch { }

if (-not $pgReady) {
    Write-Host '❌ PostgreSQL is not running on port 5432' -ForegroundColor Red
    Write-Host '   Please run Start-Dependencies.bat first to start PostgreSQL' -ForegroundColor Yellow
    Write-Host ''
    pause
    exit 1
}

if (-not $redisReady) {
    Write-Host '❌ Redis is not running on port 6379' -ForegroundColor Red
    Write-Host '   Please run Start-Dependencies.bat first to start Redis' -ForegroundColor Yellow
    Write-Host ''
    pause
    exit 1
}

Write-Host '✅ PostgreSQL: Ready' -ForegroundColor Green
Write-Host '✅ Redis: Ready' -ForegroundColor Green
Write-Host ''

# Step 1: Check if build exists
Write-Host '[1/4] Validating backend build...' -ForegroundColor Yellow
$buildPath = 'd:\GitHub\TheRxSpot_Marketplace\.medusa\server\dist'
if (-not (Test-Path $buildPath)) {
    Write-Host '⚠️  First-time setup detected. Building backend...' -ForegroundColor Yellow
    Write-Host 'This may take 2-3 minutes...
' -ForegroundColor Gray
    
    Set-Location 'd:\GitHub\TheRxSpot_Marketplace'
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host '
❌ Build failed. Please check for errors above.' -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host '
✅ Backend build complete!
' -ForegroundColor Green
} else {
    Write-Host '✅ Backend already built' -ForegroundColor Green
}
Write-Host ''

# Step 2: Start Medusa Backend
Write-Host '[2/4] Launching Medusa Backend (:9000)...' -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd d:\GitHub\TheRxSpot_Marketplace; npm run dev'

# Wait for Backend to initialize
Write-Host '⏳ Waiting for backend to initialize...' -ForegroundColor Gray
Start-Sleep -Seconds 8

# Step 3: Start Next.js Storefront
Write-Host '[3/4] Launching Next.js Storefront (:8000)...' -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd d:\GitHub\TheRxSpot_Marketplace\TheRxSpot_Marketplace-storefront; npm run dev'

# Step 4: Open the Control Center
Write-Host '[4/4] Opening Command Center Interface...' -ForegroundColor Green
Start-Sleep -Seconds 3
Start-Process 'd:\GitHub\TheRxSpot_Marketplace\Marketplace-Launcher.html'

Write-Host '
===================================================' -ForegroundColor Cyan
Write-Host '✅ All systems deployed successfully!' -ForegroundColor Green
Write-Host '===================================================
' -ForegroundColor Cyan
Write-Host '📊 Monitor the PowerShell windows for startup logs' -ForegroundColor Yellow
Write-Host '🌐 Command Center opening in your browser...' -ForegroundColor Yellow
Write-Host '
⏳ Services may take 30-60 seconds to fully initialize' -ForegroundColor Gray
Write-Host ''
