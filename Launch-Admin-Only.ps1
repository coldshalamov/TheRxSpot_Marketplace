#!/usr/bin/env pwsh
# TheRxSpot Marketplace - Admin Only Launcher
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   TheRxSpot Marketplace | Admin-Only Launcher" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
$preferredBackendPort = 9000
$fallbackBackendPort = 9001
$backendPort = $preferredBackendPort

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

function Get-ProcessInfo {
    param([int]$ProcessId)
    try {
        return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    } catch {
        return $null
    }
}

function Should-StopForMarketplace {
    param([object]$ProcessInfo)

    if (-not $ProcessInfo) { return $false }

    $name = if ($ProcessInfo.Name) { $ProcessInfo.Name.ToLowerInvariant() } else { "" }
    $cmd = if ($ProcessInfo.CommandLine) { $ProcessInfo.CommandLine.ToLowerInvariant() } else { "" }
    $repoPath = $repoRoot.ToLowerInvariant()

    if ($name -notin @("node.exe", "node", "powershell.exe", "powershell", "pwsh.exe", "pwsh")) {
        return $false
    }

    if ($cmd.Contains($repoPath)) { return $true }
    if ($cmd.Contains("medusa develop") -or $cmd.Contains("npm run dev")) { return $true }

    return $false
}

function Release-Port-Safely {
    param([int]$Port, [string]$Label)

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique

    if (-not $listeners) {
        Write-Host "OK: Port $Port is available for $Label" -ForegroundColor Green
        return
    }

    foreach ($ownerPid in $listeners) {
        $procInfo = Get-ProcessInfo -ProcessId $ownerPid
        $procName = if ($procInfo -and $procInfo.Name) { $procInfo.Name } else { "PID $ownerPid" }

        if (Should-StopForMarketplace -ProcessInfo $procInfo) {
            Write-Host "WARN: Port $Port is used by marketplace process $procName. Stopping it..." -ForegroundColor Yellow
            Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 800
        } else {
            Write-Host "INFO: Port $Port is used by external process $procName. Leaving it untouched." -ForegroundColor Cyan
        }
    }
}

function Wait-ForBackend {
    param([int]$Port)

    $maxAttempts = 180
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "OK: Backend is healthy on port $Port" -ForegroundColor Green
                return $true
            }
        } catch {
            if ($attempt % 10 -eq 0) {
                Write-Host "Waiting for backend... ($attempt seconds)" -ForegroundColor Gray
            }
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

function Prewarm-Admin {
    param([int]$Port)

    $urls = @(
        "http://localhost:$Port/app",
        "http://localhost:$Port/app/@vite/client",
        "http://localhost:$Port/app/entry.jsx"
    )

    foreach ($url in $urls) {
        try {
            $null = Invoke-WebRequest -Uri $url -TimeoutSec 20 -UseBasicParsing -ErrorAction Stop
        } catch {
            Write-Host "WARN: Prewarm request failed: $url" -ForegroundColor Yellow
        }
    }
}

function Open-AdminUrl {
    param([string]$Url)

    $edgeCommand = Get-Command "msedge.exe" -ErrorAction SilentlyContinue
    if ($edgeCommand) {
        $args = @(
            "--new-window",
            "--inprivate",
            "--disable-extensions",
            $Url
        )
        Start-Process -FilePath $edgeCommand.Source -ArgumentList $args
        return
    }

    Start-Process $Url
}

Write-Host "[1/5] Checking dependencies..." -ForegroundColor Yellow
$pgReady = Test-Port -Port 5432
$redisReady = Test-Port -Port 6379

if (-not $pgReady) {
    Write-Host "ERROR: PostgreSQL is not running on port 5432" -ForegroundColor Red
    Write-Host "Run .\Start-Dependencies.bat first." -ForegroundColor Yellow
    pause
    exit 1
}

if (-not $redisReady) {
    Write-Host "ERROR: Redis is not running on port 6379" -ForegroundColor Red
    Write-Host "Run .\Start-Dependencies.bat first." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "OK: PostgreSQL and Redis are ready" -ForegroundColor Green

Write-Host "[2/5] Resolving backend port..." -ForegroundColor Yellow
Release-Port-Safely -Port $preferredBackendPort -Label "Medusa backend"

$port9000InUse = Get-NetTCPConnection -LocalPort $preferredBackendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($port9000InUse) {
    $ownerPid = $port9000InUse.OwningProcess
    $ownerProcess = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $ownerName = if ($ownerProcess) { $ownerProcess.ProcessName } else { "PID $ownerPid" }
    Write-Host "WARN: Port $preferredBackendPort is still occupied by $ownerName. Using $fallbackBackendPort." -ForegroundColor Yellow
    $backendPort = $fallbackBackendPort
}

Write-Host "[3/5] Ensuring backend build exists..." -ForegroundColor Yellow
$adminBuildIndex = Join-Path $repoRoot ".medusa\server\public\admin\index.html"
if (-not (Test-Path $adminBuildIndex)) {
    Write-Host "First-time setup detected. Running npm run build..." -ForegroundColor Yellow
    Set-Location $repoRoot
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Build failed." -ForegroundColor Red
        pause
        exit 1
    }
}
Write-Host "OK: Admin build is available" -ForegroundColor Green

Write-Host "[4/5] Starting Medusa backend on :$backendPort..." -ForegroundColor Yellow
$backendUrl = "http://localhost:$backendPort"
$storeCors = "http://localhost:8000,http://localhost:8001,https://docs.medusajs.com"
$adminCors = "http://localhost:5173,http://localhost:9000,http://localhost:$backendPort,http://localhost:8000,http://localhost:8001,https://docs.medusajs.com"
$authCors = "http://localhost:5173,http://localhost:9000,http://localhost:$backendPort,http://localhost:8000,http://localhost:8001,https://docs.medusajs.com"

$backendCommand = @"
`$env:PORT='$backendPort'
`$env:MEDUSA_BACKEND_URL='$backendUrl'
`$env:STORE_CORS='$storeCors'
`$env:ADMIN_CORS='$adminCors'
`$env:AUTH_CORS='$authCors'
cd `"$repoRoot`"
npm run dev
"@

$backendProcess = Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCommand -PassThru
Write-Host "Backend process started (PID: $($backendProcess.Id))" -ForegroundColor Gray

if (-not (Wait-ForBackend -Port $backendPort)) {
    Write-Host "ERROR: Backend did not become healthy in time." -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Pre-warming admin assets..." -ForegroundColor Gray
Prewarm-Admin -Port $backendPort

Write-Host "[5/5] Opening Admin URL..." -ForegroundColor Yellow
$adminUrl = "http://localhost:$backendPort/app"
Open-AdminUrl -Url $adminUrl

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "SUCCESS: Admin-only environment is ready" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Admin URL: $adminUrl" -ForegroundColor Yellow
Write-Host ""
