param(
    [string]$ProjectPath = "."
)

$ErrorActionPreference = "Stop"

$repoRoot = if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) { (Get-Location).Path } else { $PSScriptRoot }
$resolvedProject = (Resolve-Path -Path (Join-Path $repoRoot $ProjectPath)).Path
$runner = Join-Path $repoRoot "scripts\serena-gpt-bridge\Run-Serena-For-GPT.ps1"

if (-not (Test-Path $runner)) {
    throw "Runner script not found: $runner"
}

Write-Host "Launching Serena bridge window..." -ForegroundColor Cyan
Write-Host "Project: $resolvedProject" -ForegroundColor Gray

Start-Process powershell -WindowStyle Normal -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", $runner,
    "-ProjectPath", $resolvedProject
)

Write-Host "A new PowerShell window was started for Serena bridge." -ForegroundColor Green
