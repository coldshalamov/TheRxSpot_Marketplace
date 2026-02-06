#!/usr/bin/env pwsh

param(
  [int]$BackendPort = 9001,
  [int]$StorefrontPort = 3000,
  [string]$AdminPath = "/app",
  [string[]]$BackendReadyPaths = @("/ready", "/health"),
  [switch]$UseRuntimeConfig = $true,
  [switch]$SkipSchemaContract,
  [switch]$SkipAdminIntegrity,
  [switch]$SkipPortOwnership,
  [int]$RetryCount = 10,
  [int]$RetryDelaySeconds = 2
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runtime = $null

$runtimeHelpersPath = Join-Path $PSScriptRoot "runtime-config.ps1"
if (Test-Path $runtimeHelpersPath) {
  . $runtimeHelpersPath
}

if ($UseRuntimeConfig -and (Get-Command Get-LauncherRuntimeConfig -ErrorAction SilentlyContinue)) {
  $runtime = Get-LauncherRuntimeConfig -RepoRoot $repoRoot
  if ($runtime) {
    $BackendPort = Resolve-LauncherPort -RequestedPort $BackendPort -DefaultPort 9001 -RuntimePort $runtime.BackendPort
    $StorefrontPort = Resolve-LauncherPort -RequestedPort $StorefrontPort -DefaultPort 3000 -RuntimePort $runtime.StorefrontPort
    if ($AdminPath -eq "/app" -and $runtime.AdminPath) {
      $AdminPath = $runtime.AdminPath
    }
  }
}

if (-not $AdminPath.StartsWith("/")) {
  $AdminPath = "/$AdminPath"
}
if ($AdminPath.Length -gt 1 -and $AdminPath.EndsWith("/")) {
  $AdminPath = $AdminPath.TrimEnd("/")
}

function Write-Result {
  param(
    [string]$Label,
    [bool]$Passed,
    [string]$Detail
  )

  if ($Passed) {
    Write-Host "[PASS] $Label - $Detail" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] $Label - $Detail" -ForegroundColor Red
  }
}

function Invoke-Check {
  param(
    [string]$Name,
    [scriptblock]$CheckScript
  )

  try {
    & $CheckScript
    return $true
  } catch {
    Write-Result -Label $Name -Passed $false -Detail $_.Exception.Message
    return $false
  }
}

function Get-PortProcessInfo {
  param(
    [int]$Port
  )

  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listener) {
    return $null
  }

  $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
  return [pscustomobject]@{
    Port = $Port
    Pid = $listener.OwningProcess
    ProcessName = if ($proc) { $proc.ProcessName } else { "<unknown>" }
    Path = if ($proc) { $proc.Path } else { "" }
  }
}

function Assert-Status {
  param(
    [string]$Url,
    [int[]]$ExpectedStatuses,
    [string]$Label
  )

  $lastError = $null
  for ($i = 1; $i -le $RetryCount; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
      $status = [int]$resp.StatusCode
      if ($ExpectedStatuses -contains $status) {
        Write-Result -Label $Label -Passed $true -Detail "$Url -> $status"
        return $resp
      }
      $lastError = "Expected status [$($ExpectedStatuses -join ',')], got $status"
    } catch {
      $response = $_.Exception.Response
      if ($response) {
        $status = [int]$response.StatusCode
        if ($ExpectedStatuses -contains $status) {
          Write-Result -Label $Label -Passed $true -Detail "$Url -> $status"
          return $null
        }
        $lastError = "Expected status [$($ExpectedStatuses -join ',')], got $status"
      } else {
        $lastError = $_.Exception.Message
      }
    }

    Start-Sleep -Seconds $RetryDelaySeconds
  }

  throw "$lastError for $Url"
}

function Assert-PortListening {
  param(
    [int]$Port,
    [string]$Label
  )

  for ($i = 1; $i -le $RetryCount; $i++) {
    $info = Get-PortProcessInfo -Port $Port
    if ($info) {
      Write-Result -Label $Label -Passed $true -Detail "Listening on $Port (PID $($info.Pid), process $($info.ProcessName))"
      return $info
    }
    Start-Sleep -Seconds $RetryDelaySeconds
  }
  throw "No listener found on port $Port"
}

function Assert-ProcessOwnership {
  param(
    [int]$Port,
    [string[]]$AllowedProcesses,
    [string]$Label
  )

  if ($SkipPortOwnership) {
    Write-Result -Label $Label -Passed $true -Detail "Skipped by flag"
    return
  }

  $info = Get-PortProcessInfo -Port $Port
  if (-not $info) {
    throw "No listener found on port $Port"
  }

  $allowed = @($AllowedProcesses | ForEach-Object { $_.ToLowerInvariant() })
  $actual = if ($info.ProcessName) { $info.ProcessName.ToString().ToLowerInvariant() } else { "" }
  if ($allowed -contains $actual) {
    $pathDetail = if ($info.Path) { " ($($info.Path))" } else { "" }
    Write-Result -Label $Label -Passed $true -Detail "Port $Port owned by $($info.ProcessName)$pathDetail"
    return
  }

  throw "Port $Port owned by unexpected process $($info.ProcessName) (PID $($info.Pid)); expected one of: $($AllowedProcesses -join ', ')"
}

function Assert-BackendReady {
  param(
    [int]$Port,
    [string[]]$Paths
  )

  $lastError = $null
  foreach ($readyPath in $Paths) {
    $normalized = if ($readyPath.StartsWith("/")) { $readyPath } else { "/$readyPath" }
    try {
      Assert-Status -Url "http://localhost:$Port$normalized" -ExpectedStatuses @(200) -Label "Backend ready ($normalized)" | Out-Null
      return
    } catch {
      $lastError = $_.Exception.Message
    }
  }

  throw "No readiness endpoint responded successfully. Tried: $($Paths -join ', '). Last error: $lastError"
}

if ($BackendPort -eq 9000) {
  Write-Host ""
  Write-Host "[FAIL] Backend Port Guard - Port 9000 is reserved for the IDE. Re-run launcher to select a fallback port." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Marketplace Local Smoke Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend Port: $BackendPort | Storefront Port: $StorefrontPort | Admin Path: $AdminPath" -ForegroundColor Yellow
if ($runtime) {
  Write-Host "Runtime config: $($runtime.Path) -> backend $($runtime.BackendPort), storefront $($runtime.StorefrontPort), admin $($runtime.AdminPath)" -ForegroundColor DarkGray
}
Write-Host ""

$allOk = $true

$checks = @(
  @{ Name = "Postgres port"; Script = { Assert-PortListening -Port 5432 -Label "Postgres port" } },
  @{ Name = "Redis port"; Script = { Assert-PortListening -Port 6379 -Label "Redis port" } },
  @{ Name = "Backend listener"; Script = { Assert-PortListening -Port $BackendPort -Label "Backend listener" } },
  @{ Name = "Backend port ownership"; Script = { Assert-ProcessOwnership -Port $BackendPort -AllowedProcesses @("node", "node.exe") -Label "Backend port ownership" } },
  @{ Name = "Backend readiness"; Script = { Assert-BackendReady -Port $BackendPort -Paths $BackendReadyPaths } },
  @{ Name = "Admin shell"; Script = { Assert-Status -Url "http://localhost:$BackendPort$AdminPath" -ExpectedStatuses @(200) -Label "Admin shell" | Out-Null } },
  @{ Name = "Schema contract gate"; Script = {
      if ($SkipSchemaContract) {
        Write-Result -Label "Schema contract gate" -Passed $true -Detail "Skipped by flag"
        return
      }
      $schemaOut = & node "./scripts/smoke/schema-contract-check.mjs" 2>&1
      if ($LASTEXITCODE -ne 0) {
        throw "Schema contract failed: $schemaOut"
      }
      Write-Result -Label "Schema contract gate" -Passed $true -Detail "Database/Redis/schema contract verified"
    }
  },
  @{ Name = "Admin integrity gate"; Script = {
      if ($SkipAdminIntegrity) {
        Write-Result -Label "Admin integrity gate" -Passed $true -Detail "Skipped by flag"
        return
      }
      $env:BACKEND_PORT = "$BackendPort"
      $env:ADMIN_PATH = "$AdminPath"
      $integrityOut = & node "./scripts/smoke/admin-integrity-check.mjs" 2>&1
      if ($LASTEXITCODE -ne 0) {
        throw "Admin integrity failed: $integrityOut"
      }
      Write-Result -Label "Admin integrity gate" -Passed $true -Detail "Admin assets/MIME/bootstrap checks passed"
    }
  },
  @{ Name = "Admin custom orders route"; Script = { Assert-Status -Url "http://localhost:$BackendPort/admin/custom/orders" -ExpectedStatuses @(200, 401, 403) -Label "Custom orders route" | Out-Null } },
  @{ Name = "Admin custom users route"; Script = { Assert-Status -Url "http://localhost:$BackendPort/admin/custom/users" -ExpectedStatuses @(200, 401, 403) -Label "Custom users route" | Out-Null } },
  @{ Name = "Admin custom consultations route"; Script = { Assert-Status -Url "http://localhost:$BackendPort/admin/custom/consultations" -ExpectedStatuses @(200, 401, 403) -Label "Custom consultations route" | Out-Null } },
  @{ Name = "Storefront listener"; Script = { Assert-PortListening -Port $StorefrontPort -Label "Storefront listener" } },
  @{ Name = "Storefront port ownership"; Script = { Assert-ProcessOwnership -Port $StorefrontPort -AllowedProcesses @("node", "node.exe") -Label "Storefront port ownership" } },
  @{ Name = "Storefront home"; Script = { Assert-Status -Url "http://localhost:$StorefrontPort" -ExpectedStatuses @(200, 301, 302, 307, 308) -Label "Storefront home" | Out-Null } }
)

foreach ($c in $checks) {
  $ok = Invoke-Check -Name $c.Name -CheckScript $c.Script
  if (-not $ok) {
    $allOk = $false
  }
}

Write-Host ""
if ($allOk) {
  Write-Host "[PASS] Smoke verification completed with no failures." -ForegroundColor Green
  exit 0
}

Write-Host "[FAIL] Smoke verification found one or more issues." -ForegroundColor Red
exit 1
