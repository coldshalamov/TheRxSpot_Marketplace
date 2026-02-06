param(
    [string]$ProjectPath = ".",
    [string]$ConfigPath = "D:\GitHub\serena-gpt-bridge\bridge.config.json",
    [string]$OutputDir = "D:\GitHub\serena-gpt-bridge\output"
)

$ErrorActionPreference = "Stop"

function Test-CommandExists {
    param([string]$CommandName)
    return [bool](Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Wait-HttpOk {
    param([string]$Url, [int]$TimeoutSeconds = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) { return $true }
        } catch {}
        Start-Sleep -Milliseconds 700
    }
    return $false
}

function Wait-TunnelUrlFromLog {
    param(
        [string]$StdOutLogPath,
        [string]$StdErrLogPath,
        [int]$TimeoutSeconds = 90
    )
    $pattern = 'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $text = ""

        if (Test-Path $StdOutLogPath) {
            $outText = Get-Content -Raw -Path $StdOutLogPath -ErrorAction SilentlyContinue
            if ($outText) { $text += $outText }
        }

        if (Test-Path $StdErrLogPath) {
            $errText = Get-Content -Raw -Path $StdErrLogPath -ErrorAction SilentlyContinue
            if ($errText) { $text += "`n$errText" }
        }

        if ($text) {
            $m = [regex]::Match($text, $pattern)
            if ($m.Success) { return $m.Value }
        }

        Start-Sleep -Milliseconds 700
    }
    return $null
}

if (-not (Test-Path $ConfigPath)) {
    throw "Missing config: $ConfigPath. Copy bridge.config.json.example to bridge.config.json and fill values once."
}

$cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
if (-not $cfg.workerUrl -or -not $cfg.updaterToken -or -not $cfg.serenaApiKey) {
    throw "Config must contain workerUrl, updaterToken, serenaApiKey."
}

$port = if ($cfg.port) { [int]$cfg.port } else { 8000 }
$workerBase = ([string]$cfg.workerUrl).TrimEnd('/')
$updaterToken = [string]$cfg.updaterToken
$serenaApiKey = [string]$cfg.serenaApiKey
$resolvedProject = (Resolve-Path -Path $ProjectPath).Path

if (-not (Test-CommandExists "uvx")) { throw "Missing command: uvx" }
$cloudflaredPath = if (Test-CommandExists "cloudflared") { "cloudflared" } elseif (Test-Path "C:\Users\User\.phone-connect\cloudflared.exe") { "C:\Users\User\.phone-connect\cloudflared.exe" } else { throw "cloudflared not found" }

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$sessionId = "{0}_{1}" -f ([IO.Path]::GetFileName($resolvedProject).ToLower().Replace(' ', '-')), (Get-Date -Format "yyyyMMdd_HHmmss")
$sessionDir = Join-Path $OutputDir $sessionId
New-Item -ItemType Directory -Force -Path $sessionDir | Out-Null

$mcpoOut = Join-Path $sessionDir "mcpo.out.log"
$mcpoErr = Join-Path $sessionDir "mcpo.err.log"
$tunOut = Join-Path $sessionDir "tunnel.out.log"
$tunErr = Join-Path $sessionDir "tunnel.err.log"

Write-Host "[1/5] Starting Serena for: $resolvedProject" -ForegroundColor Gray
$mcpoArgs = @(
    "mcpo",
    "--port", "$port",
    "--api-key", "$serenaApiKey",
    "--",
    "uvx",
    "--from", "git+https://github.com/oraios/serena",
    "serena",
    "start-mcp-server",
    "--context", "chatgpt",
    "--project", "$resolvedProject"
)
$mcpoProc = Start-Process -FilePath "uvx" -ArgumentList $mcpoArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $mcpoOut -RedirectStandardError $mcpoErr

$localOpenApi = "http://localhost:$port/openapi.json"
Write-Host "[2/5] Waiting for local API..." -ForegroundColor Gray
if (-not (Wait-HttpOk -Url $localOpenApi -TimeoutSeconds 90)) {
    throw "MCPO did not become ready at $localOpenApi"
}

Write-Host "[3/5] Starting tunnel..." -ForegroundColor Gray
$tunArgs = @("tunnel", "--url", "http://localhost:$port", "--no-autoupdate", "--loglevel", "info")
$tunProc = Start-Process -FilePath $cloudflaredPath -ArgumentList $tunArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $tunOut -RedirectStandardError $tunErr

$tunnelUrl = Wait-TunnelUrlFromLog -StdOutLogPath $tunOut -StdErrLogPath $tunErr -TimeoutSeconds 90
if (-not $tunnelUrl) { throw "Tunnel URL not found in $tunOut" }

Write-Host "[4/5] Updating Worker target..." -ForegroundColor Gray
$updateUri = "$workerBase/_update"
$headers = @{ Authorization = "Bearer $updaterToken" }
$body = @{ tunnelUrl = $tunnelUrl } | ConvertTo-Json -Compress
$update = Invoke-RestMethod -Method Post -Uri $updateUri -Headers $headers -ContentType "application/json" -Body $body
if (-not $update.ok) { throw "Worker update failed." }

Write-Host "[5/5] Verifying worker endpoint..." -ForegroundColor Gray
$workerOpenApi = "$workerBase/openapi.json"
if (-not (Wait-HttpOk -Url $workerOpenApi -TimeoutSeconds 30)) {
    throw "Worker did not proxy OpenAPI yet: $workerOpenApi"
}

$session = [ordered]@{
    startedAt = (Get-Date).ToString("o")
    projectPath = $resolvedProject
    workerUrl = $workerBase
    workerOpenApi = $workerOpenApi
    localPort = $port
    tunnelUrl = $tunnelUrl
    serenaApiKey = $serenaApiKey
    mcpoPid = $mcpoProc.Id
    cloudflaredPid = $tunProc.Id
    logs = @{
        mcpoOut = $mcpoOut
        mcpoErr = $mcpoErr
        tunnelOut = $tunOut
        tunnelErr = $tunErr
    }
}

$activePath = Join-Path $OutputDir "active-session.json"
$sessionPath = Join-Path $sessionDir "session.json"
$session | ConvertTo-Json -Depth 20 | Set-Content -Path $activePath -Encoding UTF8
$session | ConvertTo-Json -Depth 20 | Set-Content -Path $sessionPath -Encoding UTF8

Write-Host ""
Write-Host "READY" -ForegroundColor Green
Write-Host "GPT Base URL: $workerBase" -ForegroundColor Cyan
Write-Host "Project: $resolvedProject" -ForegroundColor Cyan
Write-Host "Bearer key: (same value already in bridge.config.json -> serenaApiKey)" -ForegroundColor Yellow
Write-Host "Active session file: $activePath" -ForegroundColor Gray
