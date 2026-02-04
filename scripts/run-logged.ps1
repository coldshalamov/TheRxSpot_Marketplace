param(
  [Parameter(Mandatory = $true)]
  [string]$Cmd,

  [string]$Workdir = ".",

  [int]$MaxLines = 80
)

$ErrorActionPreference = "Stop"

# PowerShell 7+ can treat native stderr as PowerShell errors when this is true.
# We want to log stderr output but not fail the wrapper unless the process exits non-zero.
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
  $global:PSNativeCommandUseErrorActionPreference = $false
}

function Append-Progress([string[]]$Lines) {
  $progressPath = Join-Path $PSScriptRoot "..\\progress.txt"
  Add-Content -Encoding Default -Path $progressPath -Value ($Lines -join "`r`n")
  Add-Content -Encoding Default -Path $progressPath -Value ""
}

$timestamp = Get-Date -Format s
$startedIn = (Get-Location).Path

try {
  Set-Location -Path $Workdir
  $global:LASTEXITCODE = 0
  $prevEap = $ErrorActionPreference
  # Don't let native stderr (e.g., npm warnings) terminate this wrapper.
  $ErrorActionPreference = "Continue"
  $output = & { Invoke-Expression $Cmd } 2>&1 | Out-String
  $ErrorActionPreference = $prevEap

  $exitCode = if ($LASTEXITCODE -ne $null) { [int]$LASTEXITCODE } else { 0 }
} catch {
  $exitCode = 1
  $output = ($output + "`r`n" + $_.Exception.ToString()).Trim()
} finally {
  Set-Location -Path $startedIn
}

$status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }

$lines = ($output -split "`r?`n")
if ($lines.Length -gt $MaxLines) {
  if ($exitCode -eq 0) {
    $excerpt = $lines[0..($MaxLines - 1)]
    $excerpt += "...(truncated)"
  } else {
    $excerpt = $lines[($lines.Length - $MaxLines)..($lines.Length - 1)]
    $excerpt = @("...(truncated)") + $excerpt
  }
} else {
  $excerpt = $lines
}

$progressLines = @(
  "[$timestamp] CMD: $Cmd",
  "CWD: $Workdir",
  "RESULT: $status (exit $exitCode)"
)

if ($excerpt -and ($excerpt -join "").Trim().Length -gt 0) {
  $progressLines += "OUTPUT:"
  $progressLines += $excerpt
}

Append-Progress -Lines $progressLines

Write-Output $output
exit $exitCode
