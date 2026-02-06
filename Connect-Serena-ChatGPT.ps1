<#
.SYNOPSIS
    Automates the exposure of a local Serena MCP server to ChatGPT via MCPO and Cloudflare Tunnel.

.DESCRIPTION
    1. Launches Serena MCP via the MCPO adapter on a local port.
    2. Exposes that port to the internet using an ephemeral Cloudflare Tunnel.
    3. Provides instructions for Custom GPT integration.

.PARAMETER Port
    The local port to run MCPO on. Default is 8000.

.PARAMETER ApiKey
    The secret key to secure your MCPO instance. If omitted, uses
    $env:SERENA_CHATGPT_API_KEY, then falls back to a fixed default.

.EXAMPLE
    .\Connect-Serena-ChatGPT.ps1 -Port 8000 -ApiKey "my-secret-key"
#>

param (
    [int]$Port = 8000,
    [string]$ApiKey = $env:SERENA_CHATGPT_API_KEY
)

$ErrorActionPreference = "Stop"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   Serena -> ChatGPT Connection Orchestrator   " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# --- 1. Dependencies Check ---
Write-Host "[1/4] Checking dependencies..." -ForegroundColor Gray

# Check UV
if (!(Get-Command "uv" -ErrorAction SilentlyContinue)) {
    Write-Error "CRITICAL: 'uv' is not installed. Install it from https://github.com/astral-sh/uv"
}

# Check Cloudflared
$cloudflaredPath = "cloudflared"
if (Get-Command "cloudflared" -ErrorAction SilentlyContinue) {
    # It's in the PATH, do nothing
} elseif (Test-Path "C:\Users\User\.phone-connect\cloudflared.exe") {
    $cloudflaredPath = "C:\Users\User\.phone-connect\cloudflared.exe"
} else {
    Write-Warning "WARNING: 'cloudflared' not found in PATH or .phone-connect."
    Write-Host "Download it here: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -ForegroundColor Yellow
    Write-Host "Save it as 'cloudflared.exe' and make sure it is in your PATH."
    return
}

# --- 2. Configuration ---
Write-Host "[2/4] Configuring session..." -ForegroundColor Gray
$DefaultApiKey = "serena-secret-key-123456"
if ([string]::IsNullOrWhitespace($ApiKey)) {
    $ApiKey = $DefaultApiKey
    Write-Host "Using fixed default API key: [HIDDEN]" -ForegroundColor Yellow
} else {
    Write-Host "Using configured API key: [HIDDEN]" -ForegroundColor Yellow
}

$ProjectRoot = $PSScriptRoot
if ([string]::IsNullOrWhitespace($ProjectRoot)) { $ProjectRoot = Get-Location }

# --- 3. Launching Processes ---
Write-Host "[3/4] Launching server and tunnel..." -ForegroundColor Gray

# Create a small helper script for the MCPO window to keep it clean
$mcpoScript = @"
Write-Host "--- SERENA MCPO SERVER ---" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host "Port: $Port"
Write-Host "Auth: Bearer $ApiKey"
Write-Host "--------------------------"
uvx mcpo --port $Port --api-key "$ApiKey" -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context chatgpt --project "$ProjectRoot"
"@

# Start MCPO in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", $mcpoScript -WindowStyle Normal

# Start Cloudflare Tunnel in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- CLOUDFLARE TUNNEL ---' -ForegroundColor Green; & '$cloudflaredPath' tunnel --url http://localhost:$Port" -WindowStyle Normal

# --- 4. Final Instructions ---
Write-Host "[4/4] Finalizing..." -ForegroundColor Gray
Write-Host ""
Write-Host "SUCCESS: Both services are launching in separate windows." -ForegroundColor Green
Write-Host ""
Write-Host "👉 STEP 1: Look at the Cloudflare window and find your address (e.g., https://xyz.trycloudflare.com)" -ForegroundColor White
Write-Host "👉 STEP 2: In ChatGPT (Custom GPT -> Actions), Import URL: <YOUR_URL>/openapi.json" -ForegroundColor White
Write-Host "👉 STEP 3: Edit the JSON to include: 'servers': [{'url': '<YOUR_URL>'}] at the top." -ForegroundColor White
Write-Host "👉 STEP 4: Set Authentication to 'API Key' -> 'Bearer' -> Use: $ApiKey" -ForegroundColor Yellow
Write-Host ""
Write-Host "SECURITY REMINDER: Keep the API Key secret. Only run this while you are actively using ChatGPT with your code." -ForegroundColor Gray
Write-Host "==============================================" -ForegroundColor Cyan
