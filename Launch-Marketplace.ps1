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
$preferredStorefrontPort = 8000
$fallbackStorefrontPort = 8001
$storefrontPort = $preferredStorefrontPort

# Step 0: Check Dependencies
Write-Host '[0/5] Checking dependencies...' -ForegroundColor Yellow

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

function Get-ProcessInfo {
    param([int]$ProcessId)
    try {
        return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    } catch {
        return $null
    }
}

function Should-StopForMarketplace {
    param(
        [object]$ProcessInfo
    )

    if (-not $ProcessInfo) {
        return $false
    }

    $name = if ($ProcessInfo.Name) { $ProcessInfo.Name.ToLowerInvariant() } else { "" }
    $cmd = if ($ProcessInfo.CommandLine) { $ProcessInfo.CommandLine.ToLowerInvariant() } else { "" }
    $repoPath = $repoRoot.ToLowerInvariant()

    if ($name -notin @("node.exe", "node", "powershell.exe", "powershell", "pwsh.exe", "pwsh")) {
        return $false
    }

    if ($cmd.Contains($repoPath)) {
        return $true
    }

    if ($cmd.Contains("medusa develop") -or $cmd.Contains("npm run dev") -or $cmd.Contains("next dev")) {
        return $true
    }

    return $false
}

function Release-Port-Safely {
    param(
        [int]$Port,
        [string]$Label
    )

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if (-not $listeners) {
        Write-Host "✅ Port $Port is available for $Label" -ForegroundColor Green
        return
    }

    foreach ($ownerPid in $listeners) {
        $procInfo = Get-ProcessInfo -ProcessId $ownerPid
        $procName = if ($procInfo -and $procInfo.Name) { $procInfo.Name } else { "PID $ownerPid" }

        if (Should-StopForMarketplace -ProcessInfo $procInfo) {
            Write-Host "⚠️  Port $Port is used by marketplace process $procName. Stopping it..." -ForegroundColor Yellow
            Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 800
            Write-Host "✅ Stopped $procName on port $Port" -ForegroundColor Green
        } else {
            Write-Host "ℹ️  Port $Port is used by external process $procName. Leaving it untouched." -ForegroundColor Cyan
        }
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

# Step 1: Release dev ports without touching unrelated apps
Write-Host '[1/5] Checking for running services...' -ForegroundColor Yellow

Release-Port-Safely -Port $preferredBackendPort -Label "Medusa backend"
Release-Port-Safely -Port $preferredStorefrontPort -Label "Storefront"

$port9000InUseAfterStop = Get-NetTCPConnection -LocalPort $preferredBackendPort -ErrorAction SilentlyContinue | Select-Object -First 1
if ($port9000InUseAfterStop) {
    $ownerPid = $port9000InUseAfterStop.OwningProcess
    $ownerProcess = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $ownerName = if ($ownerProcess) { $ownerProcess.ProcessName } else { "PID $ownerPid" }

    Write-Host "⚠️  Port $preferredBackendPort is still occupied by $ownerName. Using fallback port $fallbackBackendPort for Medusa." -ForegroundColor Yellow
    $backendPort = $fallbackBackendPort
}

$port8000InUseAfterStop = Get-NetTCPConnection -LocalPort $preferredStorefrontPort -ErrorAction SilentlyContinue | Select-Object -First 1
if ($port8000InUseAfterStop) {
    $ownerPid = $port8000InUseAfterStop.OwningProcess
    $ownerProcess = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $ownerName = if ($ownerProcess) { $ownerProcess.ProcessName } else { "PID $ownerPid" }

    Write-Host "⚠️  Port $preferredStorefrontPort is still occupied by $ownerName. Using fallback port $fallbackStorefrontPort for storefront." -ForegroundColor Yellow
    $storefrontPort = $fallbackStorefrontPort
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

function Resolve-StorefrontPublishableKey {
    param([string]$RepoRoot)

    try {
        $cliPath = Join-Path $RepoRoot "node_modules\@medusajs\cli\cli.js"
        if (-not (Test-Path $cliPath)) {
            Write-Host "⚠️  Medusa CLI not found at $cliPath" -ForegroundColor Yellow
            return $null
        }

        Push-Location $RepoRoot
        try {
            $output = & node $cliPath exec ./src/scripts/ensure-storefront-publishable-key.ts 2>&1
        } finally {
            Pop-Location
        }
        $keyLine = $output | Where-Object { $_ -like "PUBLISHABLE_KEY=*" } | Select-Object -Last 1

        if ($keyLine) {
            return $keyLine.Substring("PUBLISHABLE_KEY=".Length).Trim()
        }

        Write-Host "⚠️  Could not parse publishable key from script output." -ForegroundColor Yellow
        return $null
    } catch {
        Write-Host "⚠️  Failed to create publishable key automatically: $($_.Exception.Message)" -ForegroundColor Yellow
        return $null
    }
}

if (-not (Wait-ForBackend -Port $backendPort)) {
    Write-Host "Backend did not respond. Check the terminal window for errors." -ForegroundColor Red
    pause
    exit 1
}

# Step 4: Start Next.js Storefront
Write-Host "[4/5] Launching Next.js Storefront (:$storefrontPort)..." -ForegroundColor Green
$storefrontPublishableKey = Resolve-StorefrontPublishableKey -RepoRoot $repoRoot

if (-not $storefrontPublishableKey) {
    Write-Host "❌ Storefront requires a valid Medusa publishable key, but none was resolved." -ForegroundColor Red
    Write-Host "   Run: npm run seed" -ForegroundColor Yellow
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
Start-Process powershell -ArgumentList '-NoExit', '-Command', $storefrontCommand

# Step 5: Open the Control Center
Write-Host '[5/5] Opening Command Center Interface...' -ForegroundColor Green
Start-Sleep -Seconds 3
$launcherUri = "file:///" + (($launcherHtml -replace '\\', '/') -replace ' ', '%20') + "?backendPort=$backendPort&storefrontPort=$storefrontPort"
Start-Process $launcherUri

Write-Host '
===================================================' -ForegroundColor Cyan
Write-Host '✅ All systems deployed successfully!' -ForegroundColor Green
Write-Host '===================================================
' -ForegroundColor Cyan
Write-Host '📊 Monitor the PowerShell windows for startup logs' -ForegroundColor Yellow
Write-Host '🌐 Command Center opening in your browser...' -ForegroundColor Yellow
Write-Host "🔐 Admin URL: $backendUrl/app" -ForegroundColor Yellow
Write-Host "🛍️  Storefront URL: http://localhost:$storefrontPort" -ForegroundColor Yellow
Write-Host '
⏳ Services may take 30-60 seconds to fully initialize' -ForegroundColor Gray
Write-Host ''
