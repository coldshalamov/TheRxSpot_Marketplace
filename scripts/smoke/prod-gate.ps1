#!/usr/bin/env pwsh

param(
  [int]$Repeat = 2,
  [string]$ReportsDir = "reports/overnight_10"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$reportsPath = Join-Path $repoRoot $ReportsDir
$tempExecDir = Join-Path $repoRoot ".tmp\prod_hardening_exec"
$logsDir = Join-Path $tempExecDir "logs"
$manifestPath = Join-Path $tempExecDir "manifest.json"
$statePath = Join-Path $tempExecDir "state.json"

New-Item -ItemType Directory -Path $reportsPath -Force | Out-Null
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

$steps = @(
  @{ Name = "refresh:admin"; Command = "set THERXSPOT_NO_BROWSER=1&& powershell -ExecutionPolicy Bypass -File .\Launch-Admin-Only.ps1" },
  @{ Name = "refresh:storefront"; Command = "set THERXSPOT_NO_BROWSER=1&& powershell -ExecutionPolicy Bypass -File .\Launch-Storefront-Only.ps1" },
  @{ Name = "check:schema"; Command = "npm run check:schema" },
  @{ Name = "diagnose:smoke"; Command = "npm run diagnose:smoke" },
  @{ Name = "check:admin-integrity"; Command = "npm run check:admin-integrity" }
)

($steps | ConvertTo-Json -Depth 4) | Set-Content $manifestPath
$state = [ordered]@{
  startedAt = (Get-Date).ToString("o")
  repeat = $Repeat
  steps = @()
}
($state | ConvertTo-Json -Depth 8) | Set-Content $statePath

function Invoke-GateStep {
  param(
    [string]$StepName,
    [string]$Command,
    [int]$Round
  )

  $safeName = $StepName.Replace(":", "_")
  $stdoutPath = Join-Path $logsDir "$safeName.round$Round.stdout.log"
  $stderrPath = Join-Path $logsDir "$safeName.round$Round.stderr.log"

  Write-Host "[$Round/$Repeat] $StepName" -ForegroundColor Yellow
  $start = Get-Date
  $wrapped = "$Command 1> `"$stdoutPath`" 2> `"$stderrPath`""
  & cmd.exe /c $wrapped
  $exitCode = $LASTEXITCODE
  $end = Get-Date

  $entry = [ordered]@{
    round = $Round
    step = $StepName
    command = $Command
    exitCode = [int]$exitCode
    startedAt = $start.ToString("o")
    endedAt = $end.ToString("o")
    durationSeconds = [int]($end - $start).TotalSeconds
    stdout = $stdoutPath
    stderr = $stderrPath
    status = if ($exitCode -eq 0) { "pass" } else { "fail" }
  }

  $stateRaw = Get-Content $statePath -Raw | ConvertFrom-Json
  if (-not ($stateRaw.PSObject.Properties.Name -contains "steps")) {
    $stateRaw | Add-Member -MemberType NoteProperty -Name steps -Value @()
  }
  $stateRaw.steps += [pscustomobject]$entry
  ($stateRaw | ConvertTo-Json -Depth 8) | Set-Content $statePath

  if ($exitCode -ne 0) {
    Write-Host "FAIL: $StepName (round $Round)" -ForegroundColor Red
    Write-Host "stdout: $stdoutPath" -ForegroundColor Gray
    Write-Host "stderr: $stderrPath" -ForegroundColor Gray
    return $false
  }

  Write-Host "PASS: $StepName (round $Round)" -ForegroundColor Green
  return $true
}

$allPass = $true
for ($round = 1; $round -le $Repeat; $round++) {
  foreach ($step in $steps) {
    $ok = Invoke-GateStep -StepName $step.Name -Command $step.Command -Round $round
    if (-not $ok) {
      $allPass = $false
      break
    }
  }
  if (-not $allPass) { break }
}

$finalSummary = Join-Path $reportsPath "prod_gate_summary.json"
$stateFinal = Get-Content $statePath -Raw | ConvertFrom-Json
if (-not ($stateFinal.PSObject.Properties.Name -contains "completedAt")) {
  $stateFinal | Add-Member -MemberType NoteProperty -Name completedAt -Value ""
}
if (-not ($stateFinal.PSObject.Properties.Name -contains "ok")) {
  $stateFinal | Add-Member -MemberType NoteProperty -Name ok -Value $false
}
$stateFinal.completedAt = (Get-Date).ToString("o")
$stateFinal.ok = $allPass
($stateFinal | ConvertTo-Json -Depth 10) | Set-Content $finalSummary

if (-not $allPass) {
  Write-Host ""
  Write-Host "[FAIL] Production gate failed." -ForegroundColor Red
  Write-Host "See state: $statePath" -ForegroundColor Yellow
  Write-Host "See summary: $finalSummary" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "[PASS] Production gate passed." -ForegroundColor Green
Write-Host "Summary: $finalSummary" -ForegroundColor Yellow

# Hardcoded temporary execution artifacts are removed on success.
Remove-Item -Path $tempExecDir -Recurse -Force -ErrorAction SilentlyContinue
exit 0
