# TheRxSpot Marketplace Launch Script
$ErrorActionPreference = 'Stop'

Write-Host '
===================================================' -ForegroundColor Cyan
Write-Host '   TheRxSpot Marketplace | Service Orchestrator' -ForegroundColor Cyan
Write-Host '===================================================
' -ForegroundColor Cyan

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
$storefrontRoot = Join-Path $repoRoot "TheRxSpot_Marketplace-storefront"
$launcherHtml = Join-Path $repoRoot "Marketplace-Launcher.html"
$preferredBackendPort = 9000
$fallbackBackendPort = 9001
$backendPort = $preferredBackendPort

# Step 0: Check Dependencies
Write-Host '[0/4] Checking dependencies...' -ForegroundColor Yellow

# Fast port check function (Test-NetConnection is too slow)
function Test-Port {
    param($Port)
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

$pgReady = Test-Port 5432
$redisReady = Test-Port 6379

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

# Step 1: Kill any existing processes on ports 9000 and 8000
Write-Host '[1/5] Checking for running services...' -ForegroundColor Yellow

$port9000 = Get-NetTCPConnection -LocalPort $preferredBackendPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($port9000) {
    Write-Host "⚠️  Port $preferredBackendPort is in use. Stopping existing process..." -ForegroundColor Yellow
    Stop-Process -Id $port9000 -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host '✅ Stopped existing backend process' -ForegroundColor Green
}

if ($port8000) {
    Write-Host "⚠️  Port 8000 is in use. Stopping existing process..." -ForegroundColor Yellow
    Stop-Process -Id $port8000 -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host '✅ Stopped existing storefront process' -ForegroundColor Green
}

if (-not $port9000 -and -not $port8000) {
    Write-Host '✅ Ports are available' -ForegroundColor Green
}

$port9000InUseAfterStop = Get-NetTCPConnection -LocalPort $preferredBackendPort -ErrorAction SilentlyContinue | Select-Object -First 1
if ($port9000InUseAfterStop) {
    $ownerPid = $port9000InUseAfterStop.OwningProcess
    $ownerProcess = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $ownerName = if ($ownerProcess) { $ownerProcess.ProcessName } else { "PID $ownerPid" }

    Write-Host "⚠️  Port $preferredBackendPort is still occupied by $ownerName. Using fallback port $fallbackBackendPort for Medusa." -ForegroundColor Yellow
    $backendPort = $fallbackBackendPort
}
Write-Host ''

# Step 2: Check if build exists
Write-Host '[2/5] Validating backend build...' -ForegroundColor Yellow
$buildPath = Join-Path $repoRoot ".medusa\server"
$adminPath = Join-Path $buildPath "public\admin\index.html"
if (-not (Test-Path $adminPath)) {
    Write-Host '⚠️  First-time setup detected. Building backend...' -ForegroundColor Yellow
    Write-Host 'This may take 2-3 minutes...
' -ForegroundColor Gray

    Set-Location $repoRoot
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

# Step 3: Start Medusa Backend
Write-Host "[3/5] Launching Medusa Backend (:$backendPort)..." -ForegroundColor Green

$backendUrl = "http://localhost:$backendPort"
$adminCors = "http://localhost:5173,http://localhost:9000,http://localhost:8000,http://localhost:$backendPort,https://docs.medusajs.com"
$authCors = "http://localhost:5173,http://localhost:9000,http://localhost:8000,http://localhost:$backendPort,https://docs.medusajs.com"

$backendCommand = @"
`$env:PORT='$backendPort'
`$env:MEDUSA_BACKEND_URL='$backendUrl'
`$env:ADMIN_CORS='$adminCors'
`$env:AUTH_CORS='$authCors'
cd `"$repoRoot`"
npm run dev
"@

$backendProcess = Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCommand -PassThru

# Wait for Backend to be ready
Write-Host '⏳ Waiting for backend to be ready...' -ForegroundColor Gray

function Wait-ForBackend {
    param(
        [int]$Port
    )

    $maxAttempts = 120  # 2 minutes max
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 1 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Backend is ready!" -ForegroundColor Green
                return $true
            }
        } catch {
            # Not ready yet, keep waiting
        }
        Start-Sleep -Seconds 1
        $attempt++

        # Print progress every 10 seconds
        if ($attempt % 10 -eq 0) {
            Write-Host "⏳ Still waiting... ($attempt seconds)" -ForegroundColor Gray
        }
    }
    Write-Host "❌ Backend failed to start after 2 minutes" -ForegroundColor Red
    return $false
}

if (-not (Wait-ForBackend -Port $backendPort)) {
    Write-Host "Backend did not respond. Check the terminal window for errors." -ForegroundColor Red
    pause
    exit 1
}

# Step 4: Start Next.js Storefront
Write-Host '[4/5] Launching Next.js Storefront (:8000)...' -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$storefrontRoot`"; npm run dev"

# Step 5: Open the Control Center
Write-Host '[5/5] Opening Command Center Interface...' -ForegroundColor Green
Start-Sleep -Seconds 3
$launcherUri = "file:///" + (($launcherHtml -replace '\\', '/') -replace ' ', '%20') + "?backendPort=$backendPort"
Start-Process $launcherUri

Write-Host '
===================================================' -ForegroundColor Cyan
Write-Host '✅ All systems deployed successfully!' -ForegroundColor Green
Write-Host '===================================================
' -ForegroundColor Cyan
Write-Host '📊 Monitor the PowerShell windows for startup logs' -ForegroundColor Yellow
Write-Host '🌐 Command Center opening in your browser...' -ForegroundColor Yellow
Write-Host "🔐 Admin URL: $backendUrl/app" -ForegroundColor Yellow
Write-Host '
⏳ Services may take 30-60 seconds to fully initialize' -ForegroundColor Gray
Write-Host ''
