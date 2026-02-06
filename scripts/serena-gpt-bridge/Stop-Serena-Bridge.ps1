param(
    [string]$OutputDir = "D:\GitHub\serena-gpt-bridge\output"
)

$ErrorActionPreference = "Stop"
$activePath = Join-Path $OutputDir "active-session.json"
if (-not (Test-Path $activePath)) {
    Write-Host "No active-session.json found at $activePath" -ForegroundColor Yellow
    exit 0
}

$session = Get-Content -Raw -Path $activePath | ConvertFrom-Json

foreach ($pid in @($session.mcpoPid, $session.cloudflaredPid)) {
    if ($pid) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "Stopped process PID $pid" -ForegroundColor Green
        } catch {
            Write-Host "Process $pid already stopped or not found." -ForegroundColor Yellow
        }
    }
}

$session | Add-Member -NotePropertyName stoppedAt -NotePropertyValue (Get-Date).ToString("o") -Force
$session | ConvertTo-Json -Depth 20 | Set-Content -Path $activePath -Encoding UTF8
Write-Host "Bridge stopped." -ForegroundColor Cyan
