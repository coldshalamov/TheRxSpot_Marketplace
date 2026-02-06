#!/usr/bin/env pwsh
# TheRxSpot Marketplace - Storefront Only Launcher
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   TheRxSpot Marketplace | Storefront-Only Launcher" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
$storefrontRoot = Join-Path $repoRoot "TheRxSpot_Marketplace-storefront"
$preferredStorefrontPort = 8000
$fallbackStorefrontPort = 8001
$storefrontPort = $preferredStorefrontPort
$backendUrl = "http://localhost:9000"

function Get-ProcessInfo {
    param([int]$ProcessId)
    try {
        return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    } catch {
        return $null
    }
}

function Should-StopForStorefront {
    param([object]$ProcessInfo)

    if (-not $ProcessInfo) { return $false }

    $name = if ($ProcessInfo.Name) { $ProcessInfo.Name.ToLowerInvariant() } else { "" }
    $cmd = if ($ProcessInfo.CommandLine) { $ProcessInfo.CommandLine.ToLowerInvariant() } else { "" }
    $repoPath = $repoRoot.ToLowerInvariant()

    if ($name -notin @("node.exe", "node", "powershell.exe", "powershell", "pwsh.exe", "pwsh")) {
        return $false
    }

    if ($cmd.Contains($repoPath) -and $cmd.Contains("next")) { return $true }
    if ($cmd.Contains("npm run dev") -and $cmd.Contains("next")) { return $true }
    return $false
}

function Release-Port-Safely {
    param([int]$Port)

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique

    if (-not $listeners) {
        Write-Host "OK: Port $Port is available" -ForegroundColor Green
        return
    }

    foreach ($ownerPid in $listeners) {
        $procInfo = Get-ProcessInfo -ProcessId $ownerPid
        $procName = if ($procInfo -and $procInfo.Name) { $procInfo.Name } else { "PID $ownerPid" }
        if (Should-StopForStorefront -ProcessInfo $procInfo) {
            Write-Host "WARN: Port $Port is used by storefront process $procName. Stopping it..." -ForegroundColor Yellow
            Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 800
        } else {
            Write-Host "INFO: Port $Port is occupied by external process $procName. Using fallback." -ForegroundColor Cyan
        }
    }
}

function Wait-ForStorefront {
    param([int]$Port)

    $maxAttempts = 180
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listener) {
            Write-Host "OK: Storefront dev server is listening on port $Port" -ForegroundColor Green
            return $true
        }

        if ($attempt % 10 -eq 0) {
            Write-Host "Waiting for storefront... ($attempt seconds)" -ForegroundColor Gray
        }
        Start-Sleep -Seconds 1
    }

    return $false
}

function Resolve-BackendUrl {
    $candidatePorts = @(9000, 9001)
    foreach ($port in $candidatePorts) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$port/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $json = $null
                try {
                    $json = $response.Content | ConvertFrom-Json -ErrorAction Stop
                } catch {
                    continue
                }

                if ($json -and $json.status -eq "healthy") {
                    return "http://localhost:$port"
                }
            }
        } catch {
            # Keep trying next candidate
        }
    }

    return $null
}

function Resolve-StorefrontPublishableKey {
    try {
        $cliPath = Join-Path $repoRoot "node_modules\@medusajs\cli\cli.js"
        if (-not (Test-Path $cliPath)) {
            Write-Host "WARN: Medusa CLI not found at $cliPath" -ForegroundColor Yellow
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

        Write-Host "WARN: Could not parse publishable key from script output." -ForegroundColor Yellow
        return $null
    } catch {
        Write-Host "WARN: Failed to create publishable key automatically: $($_.Exception.Message)" -ForegroundColor Yellow
        return $null
    }
}

Write-Host "[1/3] Resolving storefront port..." -ForegroundColor Yellow
Release-Port-Safely -Port $preferredStorefrontPort

$port8000InUse = Get-NetTCPConnection -LocalPort $preferredStorefrontPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($port8000InUse) {
    $ownerPid = $port8000InUse.OwningProcess
    $ownerProcess = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $ownerName = if ($ownerProcess) { $ownerProcess.ProcessName } else { "PID $ownerPid" }
    Write-Host "WARN: Port $preferredStorefrontPort is still occupied by $ownerName. Using $fallbackStorefrontPort." -ForegroundColor Yellow
    $storefrontPort = $fallbackStorefrontPort
}

Write-Host "[2/3] Starting storefront on :$storefrontPort..." -ForegroundColor Yellow
$backendUrl = Resolve-BackendUrl
if (-not $backendUrl) {
    Write-Host "ERROR: No healthy Medusa backend found on ports 9000 or 9001." -ForegroundColor Red
    Write-Host "Start backend first with .\\Launch-Admin-Only.bat or .\\Launch-Marketplace.bat" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "Using backend URL: $backendUrl" -ForegroundColor Gray
$storefrontPublishableKey = Resolve-StorefrontPublishableKey
if (-not $storefrontPublishableKey) {
    Write-Host "ERROR: Storefront requires a valid Medusa publishable key." -ForegroundColor Red
    Write-Host "Run: npm run seed" -ForegroundColor Yellow
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
$storefrontProcess = Start-Process powershell -ArgumentList '-NoExit', '-Command', $storefrontCommand -PassThru
Write-Host "Storefront process started (PID: $($storefrontProcess.Id))" -ForegroundColor Gray

if (-not (Wait-ForStorefront -Port $storefrontPort)) {
    Write-Host "ERROR: Storefront did not become reachable in time." -ForegroundColor Red
    pause
    exit 1
}

Write-Host "[3/3] Opening storefront..." -ForegroundColor Yellow
$storefrontUrl = "http://localhost:$storefrontPort"
Start-Process $storefrontUrl

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "SUCCESS: Storefront-only environment is ready" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Storefront URL: $storefrontUrl" -ForegroundColor Yellow
Write-Host ""
