param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath,

    [Parameter(Mandatory=$true)]
    [string]$WorkerUrl,

    [Parameter(Mandatory=$true)]
    [string]$UpdaterToken,

    [int]$Port = 8000,
    [string]$SerenaApiKey = "serena-secret-key-123456",
    [string]$OutputDir = "D:\GitHub\serena-gpt-bridge\output"
)

$ErrorActionPreference = "Stop"

function Test-CommandExists {
    param([string]$CommandName)
    return [bool](Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 800
        }
    }

    return $false
}

function Wait-TunnelUrlFromLog {
    param(
        [string]$LogPath,
        [int]$TimeoutSeconds = 60
    )

    $pattern = 'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        if (Test-Path $LogPath) {
            $text = Get-Content -Raw -Path $LogPath -ErrorAction SilentlyContinue
            if ($text) {
                $m = [regex]::Match($text, $pattern)
                if ($m.Success) {
                    return $m.Value
                }
            }
        }
        Start-Sleep -Milliseconds 700
    }

    return $null
}

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "        Serena GPT Bridge (Reusable)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not (Test-CommandExists "uvx")) {
    throw "Missing required command: uvx"
}

$cloudflaredPath = $null
if (Test-CommandExists "cloudflared") {
    $cloudflaredPath = "cloudflared"
} elseif (Test-Path "C:\Users\User\.phone-connect\cloudflared.exe") {
    $cloudflaredPath = "C:\Users\User\.phone-connect\cloudflared.exe"
} else {
    throw "cloudflared not found in PATH or C:\Users\User\.phone-connect\cloudflared.exe"
}

$resolvedProject = (Resolve-Path -Path $ProjectPath).Path
$workerBase = $WorkerUrl.TrimEnd('/')

$sessionId = "{0}_{1}" -f ([IO.Path]::GetFileName($resolvedProject).ToLower().Replace(' ','-')), (Get-Date -Format "yyyyMMdd_HHmmss")
$sessionDir = Join-Path $OutputDir $sessionId
New-Item -ItemType Directory -Force -Path $sessionDir | Out-Null

$mcpoOut = Join-Path $sessionDir "mcpo.out.log"
$mcpoErr = Join-Path $sessionDir "mcpo.err.log"
$tunnelOut = Join-Path $sessionDir "tunnel.out.log"
$tunnelErr = Join-Path $sessionDir "tunnel.err.log"

Write-Host "[1/6] Starting Serena MCPO for project:" -ForegroundColor Gray
Write-Host "      $resolvedProject" -ForegroundColor White

$mcpoArgs = @(
    "mcpo",
    "--port", "$Port",
    "--api-key", "$SerenaApiKey",
    "--",
    "uvx",
    "--from", "git+https://github.com/oraios/serena",
    "serena",
    "start-mcp-server",
    "--context", "chatgpt",
    "--project", "$resolvedProject"
)

$mcpoProc = Start-Process -FilePath "uvx" -ArgumentList $mcpoArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $mcpoOut -RedirectStandardError $mcpoErr

Write-Host "[2/6] Waiting for local OpenAPI endpoint..." -ForegroundColor Gray
$localOpenApi = "http://localhost:$Port/openapi.json"
if (-not (Wait-HttpOk -Url $localOpenApi -TimeoutSeconds 90)) {
    throw "MCPO server did not become ready on $localOpenApi"
}

Write-Host "[3/6] Starting Cloudflare tunnel..." -ForegroundColor Gray
$tunnelArgs = @("tunnel", "--url", "http://localhost:$Port", "--no-autoupdate", "--loglevel", "info")
$tunnelProc = Start-Process -FilePath $cloudflaredPath -ArgumentList $tunnelArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr

Write-Host "[4/6] Reading tunnel URL..." -ForegroundColor Gray
$tunnelUrl = Wait-TunnelUrlFromLog -LogPath $tunnelOut -TimeoutSeconds 90
if (-not $tunnelUrl) {
    throw "Could not detect trycloudflare URL from tunnel log: $tunnelOut"
}
Write-Host "      Tunnel URL: $tunnelUrl" -ForegroundColor Green

Write-Host "[5/6] Updating Worker routing target..." -ForegroundColor Gray
$updateUri = "$workerBase/_update"
$updateBody = @{ tunnelUrl = $tunnelUrl } | ConvertTo-Json -Compress
$headers = @{ Authorization = "Bearer $UpdaterToken" }
$updateResp = Invoke-RestMethod -Method Post -Uri $updateUri -Headers $headers -ContentType "application/json" -Body $updateBody

Write-Host "      Worker updated: $($updateResp.ok)" -ForegroundColor Green

Write-Host "[6/6] Generating GPT schema bound to Worker URL..." -ForegroundColor Gray
$schemaObj = Invoke-RestMethod -Method Get -Uri $localOpenApi
$schemaObj.info.title = "Serena Agent API"
$schemaObj.info.description = "OpenAPI schema for Serena coding tools exposed over MCPO."
$schemaObj.info.version = "1.23.1"
$schemaObj.servers = @(@{ url = $workerBase })

foreach ($path in $schemaObj.paths.PSObject.Properties.Name) {
    $methods = $schemaObj.paths.$path
    foreach ($methodName in $methods.PSObject.Properties.Name) {
        $op = $methods.$methodName
        if ($null -eq $op) { continue }

        $op."x-openai-isConsequential" = $false

        if ($op.PSObject.Properties.Name -contains "description") {
            $desc = [string]$op.description
            if ($desc.Length -gt 280) {
                $fallback = if (($op.PSObject.Properties.Name -contains "summary") -and $op.summary) {
                    "$($op.summary)."
                } else {
                    "Tool operation."
                }
                $op.description = $fallback
            }
        }
    }
}

$schemaPath = Join-Path $sessionDir "schema_for_custom_gpt.json"
$latestSchemaPath = Join-Path $OutputDir "schema_for_custom_gpt.latest.json"
$schemaObj | ConvertTo-Json -Depth 100 | Set-Content -Path $schemaPath -Encoding UTF8
$schemaObj | ConvertTo-Json -Depth 100 | Set-Content -Path $latestSchemaPath -Encoding UTF8

$sessionInfo = [ordered]@{
    startedAt = (Get-Date).ToString("o")
    projectPath = $resolvedProject
    localPort = $Port
    localOpenApi = $localOpenApi
    serenaApiKey = $SerenaApiKey
    tunnelUrl = $tunnelUrl
    workerUrl = $workerBase
    mcpoPid = $mcpoProc.Id
    cloudflaredPid = $tunnelProc.Id
    schemaPath = $schemaPath
    latestSchemaPath = $latestSchemaPath
    mcpoOutLog = $mcpoOut
    mcpoErrLog = $mcpoErr
    tunnelOutLog = $tunnelOut
    tunnelErrLog = $tunnelErr
}

$sessionInfoPath = Join-Path $sessionDir "session.json"
$sessionInfo | ConvertTo-Json -Depth 20 | Set-Content -Path $sessionInfoPath -Encoding UTF8
$sessionInfo | ConvertTo-Json -Depth 20 | Set-Content -Path (Join-Path $OutputDir "active-session.json") -Encoding UTF8

Write-Host ""
Write-Host "SUCCESS: Serena bridge is live." -ForegroundColor Green
Write-Host "Stable GPT server URL: $workerBase" -ForegroundColor Cyan
Write-Host "Current tunnel target: $tunnelUrl" -ForegroundColor Cyan
Write-Host "Schema file: $schemaPath" -ForegroundColor Yellow
Write-Host "Latest schema file: $latestSchemaPath" -ForegroundColor Yellow
Write-Host "Bearer API key for GPT Actions: $SerenaApiKey" -ForegroundColor Yellow
Write-Host "Session file: $sessionInfoPath" -ForegroundColor Gray
