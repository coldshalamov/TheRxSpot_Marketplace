#!/usr/bin/env pwsh

param(
  [int]$BackendPort = 9000,
  [int]$StorefrontPort = 8000,
  [int]$RetryCount = 10,
  [int]$RetryDelaySeconds = 2
)

$ErrorActionPreference = "Stop"

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
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
      Write-Result -Label $Label -Passed $true -Detail "Listening on $Port (PID $($listener.OwningProcess))"
      return
    }
    Start-Sleep -Seconds $RetryDelaySeconds
  }
  throw "No listener found on port $Port"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Marketplace Local Smoke Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Backend Port: $BackendPort | Storefront Port: $StorefrontPort" -ForegroundColor Yellow
Write-Host ""

$allOk = $true

$checks = @(
  @{ Name = "Postgres port"; Script = { Assert-PortListening -Port 5432 -Label "Postgres port" } },
  @{ Name = "Redis port"; Script = { Assert-PortListening -Port 6379 -Label "Redis port" } },
  @{ Name = "Backend listener"; Script = { Assert-PortListening -Port $BackendPort -Label "Backend listener" } },
  @{ Name = "Backend health"; Script = { Assert-Status -Url "http://localhost:$BackendPort/health" -ExpectedStatuses @(200) -Label "Backend health" | Out-Null } },
  @{ Name = "Admin shell"; Script = { Assert-Status -Url "http://localhost:$BackendPort/app" -ExpectedStatuses @(200) -Label "Admin shell" | Out-Null } },
  @{ Name = "Admin entry"; Script = {
      $entry = Assert-Status -Url "http://localhost:$BackendPort/app/entry.jsx" -ExpectedStatuses @(200) -Label "Admin entry"
      if ($entry.Content -notmatch "@medusajs_dashboard") {
        throw "entry.jsx does not include @medusajs_dashboard import"
      }
      Write-Result -Label "Admin entry content" -Passed $true -Detail "Dashboard bundle import present"
    }
  },
  @{ Name = "Admin custom orders route"; Script = { Assert-Status -Url "http://localhost:$BackendPort/admin/custom/orders" -ExpectedStatuses @(200, 401, 403) -Label "Custom orders route" | Out-Null } },
  @{ Name = "Admin custom users route"; Script = { Assert-Status -Url "http://localhost:$BackendPort/admin/custom/users" -ExpectedStatuses @(200, 401, 403) -Label "Custom users route" | Out-Null } },
  @{ Name = "Admin custom consultations route"; Script = { Assert-Status -Url "http://localhost:$BackendPort/admin/custom/consultations" -ExpectedStatuses @(200, 401, 403) -Label "Custom consultations route" | Out-Null } },
  @{ Name = "Storefront listener"; Script = { Assert-PortListening -Port $StorefrontPort -Label "Storefront listener" } },
  @{ Name = "Storefront home"; Script = { Assert-Status -Url "http://localhost:$StorefrontPort" -ExpectedStatuses @(200) -Label "Storefront home" | Out-Null } }
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
