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
$preferredBackendPort = 9000
$fallbackBackendPort = 9001
$backendPort = $preferredBackendPort
$preferredStorefrontPort = 8000
$fallbackStorefrontPort = 8001
$storefrontPort = $preferredStorefrontPort

Write-Host "[DEBUG] Repo root: $repoRoot" -ForegroundColor Gray
Write-Host "[DEBUG] Storefront root: $storefrontRoot" -ForegroundColor Gray

function Test-Port {
    param([int]$Port)
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ReceiveTimeout = 1000
        $tcpClient.SendTimeout = 1000
        $result = $tcpClient.BeginConnect("127.0.0.1", $Port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne(1000, $false)
        $tcpClient.Close()
        return $success
    } catch {
        return $false
    }
}


function Wait-ForBackend {
    param([int]$Port)

    $maxAttempts = 120
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "[DEBUG] Backend health check passed on attempt $attempt" -ForegroundColor Gray
                return $true
            }
        } catch {
            if ($attempt % 10 -eq 0) {
                Write-Host "[DEBUG] Waiting for backend... ($attempt seconds)" -ForegroundColor Gray
            }
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

function Resolve-StorefrontPublishableKey {
    try {
        $cliPath = Join-Path $repoRoot "node_modules\@medusajs\cli\cli.js"
        if (-not (Test-Path $cliPath)) {
            Write-Host "[DEBUG] Medusa CLI not found at $cliPath" -ForegroundColor Yellow
            return $null
        }

        Push-Location $repoRoot
        try {
            $output = & node $cliPath exec ./src/scripts/ensure-storefront-publishable-key.ts 2>&1
        } finally {
            Pop-Location
        }
        $keyLine = $output | Where-Object { $_ -like "PUBLISHABLE_KEY=*" } | Select-Object -Last 1

        if ($keyLine) {
            return $keyLine.Substring("PUBLISHABLE_KEY=".Length).Trim()
        }

        Write-Host "[DEBUG] Could not parse publishable key from script output." -ForegroundColor Yellow
        return $null
    } catch {
        Write-Host "[DEBUG] Failed to create publishable key automatically: $($_.Exception.Message)" -ForegroundColor Yellow
        return $null
    }
}

# Step 0: Check dependencies
Write-Host "`n[0/5] Checking dependencies..." -ForegroundColor Yellow
$pgReady = Test-Port -Port 5432
$redisReady = Test-Port -Port 6379

if (-not $pgReady) {
    Write-Host 'ERROR: PostgreSQL is not running on port 5432' -ForegroundColor Red
    Write-Host 'Please run Start-Dependencies.bat first to start PostgreSQL' -ForegroundColor Yellow
    pause
    exit 1
}

if (-not $redisReady) {
    Write-Host 'ERROR: Redis is not running on port 6379' -ForegroundColor Red
    Write-Host 'Please run Start-Dependencies.bat first to start Redis' -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host 'OK: PostgreSQL and Redis are reachable' -ForegroundColor Green

# Step 1: Resolve ports
Write-Host "`n[1/5] Resolving service ports..." -ForegroundColor Yellow
if (Get-NetTCPConnection -LocalPort $preferredBackendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1) {
    Write-Host "[DEBUG] Backend preferred port $preferredBackendPort is in use. Falling back to $fallbackBackendPort." -ForegroundColor Yellow
    $backendPort = $fallbackBackendPort
}

if (Get-NetTCPConnection -LocalPort $preferredStorefrontPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1) {
    Write-Host "[DEBUG] Storefront preferred port $preferredStorefrontPort is in use. Falling back to $fallbackStorefrontPort." -ForegroundColor Yellow
    $storefrontPort = $fallbackStorefrontPort
}

Write-Host "[DEBUG] Selected backend port: $backendPort" -ForegroundColor Gray
Write-Host "[DEBUG] Selected storefront port: $storefrontPort" -ForegroundColor Gray

# Step 2: Ensure backend build exists
Write-Host "`n[2/5] Validating backend build..." -ForegroundColor Yellow
$adminIndexPath = Join-Path $repoRoot ".medusa\server\public\admin\index.html"
if (-not (Test-Path $adminIndexPath)) {
    Write-Host 'First-time setup detected. Building backend...' -ForegroundColor Yellow
    Set-Location $repoRoot
    npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Host 'ERROR: Build failed. Check logs above.' -ForegroundColor Red
        pause
        exit 1
    }
}

Write-Host 'OK: Backend build is available' -ForegroundColor Green

# Step 3: Start Medusa backend
Write-Host "`n[3/5] Launching Medusa Backend (:$backendPort)..." -ForegroundColor Green
$backendUrl = "http://localhost:$backendPort"
$storeCors = "http://localhost:8000,http://localhost:$storefrontPort,https://docs.medusajs.com"
$adminCors = "http://localhost:5173,http://localhost:9000,http://localhost:$backendPort,http://localhost:8000,http://localhost:$storefrontPort,https://docs.medusajs.com"
$authCors = "http://localhost:5173,http://localhost:9000,http://localhost:$backendPort,http://localhost:8000,http://localhost:$storefrontPort,https://docs.medusajs.com"

$backendCommand = @"
`$env:PORT='$backendPort'
`$env:MEDUSA_BACKEND_URL='$backendUrl'
`$env:STORE_CORS='$storeCors'
`$env:ADMIN_CORS='$adminCors'
`$env:AUTH_CORS='$authCors'
cd `"$repoRoot`"
npm run dev
"@

$backendProc = Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCommand -PassThru
Write-Host "[DEBUG] Backend process started: PID $($backendProc.Id)" -ForegroundColor Gray

if (-not (Wait-ForBackend -Port $backendPort)) {
    Write-Host 'ERROR: Backend did not become healthy within 120 seconds.' -ForegroundColor Red
    pause
    exit 1
}

Write-Host 'OK: Backend is healthy' -ForegroundColor Green

# Step 4: Start storefront
Write-Host "`n[4/5] Launching Next.js Storefront (:$storefrontPort)..." -ForegroundColor Green
$storefrontPublishableKey = Resolve-StorefrontPublishableKey
if (-not $storefrontPublishableKey) {
    Write-Host "ERROR: Could not resolve a valid publishable key for storefront." -ForegroundColor Red
    pause
    exit 1
}

$storefrontCommand = @"
`$env:MEDUSA_BACKEND_URL='$backendUrl'
`$env:NEXT_PUBLIC_MEDUSA_BACKEND_URL='$backendUrl'
`$env:NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY='$storefrontPublishableKey'
cd `"$storefrontRoot`"
npm run dev -- -p $storefrontPort
"@
$storefrontProc = Start-Process powershell -ArgumentList '-NoExit', '-Command', $storefrontCommand -PassThru
Write-Host "[DEBUG] Storefront process started: PID $($storefrontProc.Id)" -ForegroundColor Gray

# Step 5: Open launcher
Write-Host "`n[5/5] Opening Command Center Interface..." -ForegroundColor Green
Start-Sleep -Seconds 2
$launcherUri = "file:///" + (($launcherHtml -replace '\\', '/') -replace ' ', '%20') + "?backendPort=$backendPort&storefrontPort=$storefrontPort"
Start-Process $launcherUri

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host 'SUCCESS: All systems launched in debug mode' -ForegroundColor Green
Write-Host '===================================================' -ForegroundColor Cyan
Write-Host "Admin URL: $backendUrl/app" -ForegroundColor Yellow
Write-Host "Storefront URL: http://localhost:$storefrontPort" -ForegroundColor Yellow
Write-Host ''
