param(
    [string]$ProjectPath = ".",
    [int]$Port = 8011,
    [string]$ApiKey = $env:SERENA_CHATGPT_API_KEY,
    [int]$StartupTimeoutSeconds = 120,
    [int]$ToolTimeoutSeconds = 45,
    [switch]$SkipMemorySync,
    [switch]$UseMcpWriteMemory,
    [string[]]$MemoryNames = @(),
    [switch]$ForceOnboarding,
    [switch]$KeepServerRunning
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
            $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 4
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 650
        }
    }

    return $false
}

function Invoke-SerenaTool {
    param(
        [string]$BaseUrl,
        [string]$ApiKey,
        [string]$ToolPath,
        [object]$Body = $null,
        [int]$TimeoutSec = 45
    )

    $uri = "$BaseUrl/$ToolPath".Replace("//", "/").Replace(":/", "://")
    $headers = @{ Authorization = "Bearer $ApiKey" }

    if ($null -eq $Body) {
        return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -TimeoutSec $TimeoutSec
    }

    return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 30 -Compress) -TimeoutSec $TimeoutSec
}

function Test-OnboardingPerformed {
    param([object]$ResponseObject)

    $raw = ($ResponseObject | ConvertTo-Json -Depth 20 -Compress)
    if ($raw -match "(?i)not\\s+performed|false|not\\s+yet") {
        return $false
    }
    if ($raw -match "(?i)already|performed|true") {
        return $true
    }

    # If we cannot infer clearly, default to true to avoid repeatedly calling onboarding.
    return $true
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    $ApiKey = "serena-secret-key-123456"
}

if (-not (Test-CommandExists "uvx")) {
    throw "Missing required command: uvx"
}

$resolvedProject = (Resolve-Path -Path $ProjectPath).Path
$memoryDir = Join-Path $resolvedProject ".serena\memories"
$localOpenApi = "http://127.0.0.1:$Port/openapi.json"
$localBase = "http://127.0.0.1:$Port"

$logDir = Join-Path $env:TEMP ("serena-mcp-init-{0}" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$mcpoOut = Join-Path $logDir "mcpo.out.log"
$mcpoErr = Join-Path $logDir "mcpo.err.log"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "      Serena MCP Initializer (Local)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Project: $resolvedProject" -ForegroundColor Gray
Write-Host "Port: $Port" -ForegroundColor Gray

$mcpoArgs = @(
    "mcpo",
    "--port", "$Port",
    "--api-key", "$ApiKey",
    "--",
    "uvx",
    "--from", "git+https://github.com/oraios/serena",
    "serena",
    "start-mcp-server",
    "--context", "chatgpt",
    "--project", "$resolvedProject"
)

Write-Host "[1/5] Starting local Serena MCP..." -ForegroundColor Gray
$mcpoProc = Start-Process -FilePath "uvx" -ArgumentList $mcpoArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $mcpoOut -RedirectStandardError $mcpoErr

try {
    Write-Host "[2/5] Waiting for OpenAPI readiness..." -ForegroundColor Gray
    if (-not (Wait-HttpOk -Url $localOpenApi -TimeoutSeconds $StartupTimeoutSeconds)) {
        throw "Serena MCP did not become ready at $localOpenApi"
    }

    Write-Host "[3/5] Checking onboarding status..." -ForegroundColor Gray
    $onboardingCheck = Invoke-SerenaTool -BaseUrl $localBase -ApiKey $ApiKey -ToolPath "check_onboarding_performed" -TimeoutSec $ToolTimeoutSeconds
    $alreadyOnboarded = Test-OnboardingPerformed -ResponseObject $onboardingCheck
    $onboardingAction = "already_performed"

    if ($ForceOnboarding -or -not $alreadyOnboarded) {
        Write-Host "      Running onboarding..." -ForegroundColor Yellow
        $onboardingResponse = Invoke-SerenaTool -BaseUrl $localBase -ApiKey $ApiKey -ToolPath "onboarding" -TimeoutSec $ToolTimeoutSeconds
        $onboardingAction = ($onboardingResponse | ConvertTo-Json -Depth 20 -Compress)
    }

    $syncedMemories = @()
    $failedMemories = @()
    if (-not $SkipMemorySync) {
        Write-Host "[4/5] Syncing local memory files to Serena..." -ForegroundColor Gray

        if (-not (Test-Path $memoryDir)) {
            Write-Host "      Memory directory not found: $memoryDir" -ForegroundColor Yellow
        } else {
            $memoryFiles = Get-ChildItem -Path $memoryDir -Filter "*.md" -File | Sort-Object Name
            if ($MemoryNames.Count -gt 0) {
                $lookup = @{}
                foreach ($name in $MemoryNames) {
                    if (-not [string]::IsNullOrWhiteSpace($name)) {
                        $lookup[$name.Trim().ToLowerInvariant()] = $true
                    }
                }

                $memoryFiles = $memoryFiles | Where-Object {
                    $lookup.ContainsKey($_.Name.ToLowerInvariant())
                }
            }

            foreach ($file in $memoryFiles) {
                if (-not $UseMcpWriteMemory) {
                    # Default mode: rely on local .serena/memories files that Serena loads by project activation.
                    $syncedMemories += $file.Name
                    continue
                }

                Write-Host ("      Syncing memory: {0}" -f $file.Name) -ForegroundColor DarkGray
                $content = Get-Content -Raw -Path $file.FullName
                $body = @{
                    memory_file_name = $file.Name
                    content = $content
                }
                try {
                    Invoke-SerenaTool -BaseUrl $localBase -ApiKey $ApiKey -ToolPath "write_memory" -Body $body -TimeoutSec $ToolTimeoutSeconds | Out-Null
                    $syncedMemories += $file.Name
                } catch {
                    $failedMemories += $file.Name
                    Write-Host ("      Failed to sync memory: {0}" -f $file.Name) -ForegroundColor Yellow
                }
            }
        }
    }

    Write-Host "[5/5] Collecting final memory inventory..." -ForegroundColor Gray
    $inventory = Invoke-SerenaTool -BaseUrl $localBase -ApiKey $ApiKey -ToolPath "list_memories" -TimeoutSec $ToolTimeoutSeconds

    $summary = [ordered]@{
        timestamp = (Get-Date).ToString("o")
        projectPath = $resolvedProject
        localBase = $localBase
        port = $Port
        onboardingCheck = ($onboardingCheck | ConvertTo-Json -Depth 20 -Compress)
        onboardingAction = $onboardingAction
        syncedMemoryCount = $syncedMemories.Count
        syncedMemories = $syncedMemories
        failedMemoryCount = $failedMemories.Count
        failedMemories = $failedMemories
        memoryInventory = ($inventory | ConvertTo-Json -Depth 20 -Compress)
        logs = @{
            mcpoOut = $mcpoOut
            mcpoErr = $mcpoErr
        }
    }

    $summaryPath = Join-Path $logDir "initializer-summary.json"
    $summary | ConvertTo-Json -Depth 30 | Set-Content -Path $summaryPath -Encoding UTF8

    Write-Host ""
    Write-Host "Initialization complete." -ForegroundColor Green
    Write-Host "Onboarding check: $($summary.onboardingCheck)" -ForegroundColor Cyan
    Write-Host "Synced memory files: $($syncedMemories.Count)" -ForegroundColor Cyan
    if ($failedMemories.Count -gt 0) {
        Write-Host "Failed memory sync count: $($failedMemories.Count)" -ForegroundColor Yellow
    }
    Write-Host "Summary: $summaryPath" -ForegroundColor Yellow
    Write-Host "Logs: $mcpoOut ; $mcpoErr" -ForegroundColor Gray
}
finally {
    if (-not $KeepServerRunning) {
        if ($mcpoProc -and -not $mcpoProc.HasExited) {
            Stop-Process -Id $mcpoProc.Id -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "Keeping Serena MCP running (PID $($mcpoProc.Id))." -ForegroundColor Yellow
    }
}
