#!/usr/bin/env pwsh

function Get-LauncherRuntimeConfig {
  param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
  )

  $configPath = Join-Path $RepoRoot "launcher_assets\runtime-config.js"
  if (-not (Test-Path $configPath)) {
    return $null
  }

  $content = Get-Content $configPath -Raw
  if ([string]::IsNullOrWhiteSpace($content)) {
    return $null
  }

  $backendPort = $null
  $storefrontPort = $null
  $adminPath = $null

  if ($content -match "backendPort\s*:\s*(\d+)") {
    $backendPort = [int]$matches[1]
  }
  if ($content -match "storefrontPort\s*:\s*(\d+)") {
    $storefrontPort = [int]$matches[1]
  }
  if ($content -match "adminPath\s*:\s*`"([^`"]+)`"") {
    $adminPath = $matches[1]
  } elseif ($content -match "adminPath\s*:\s*""([^""]+)""") {
    $adminPath = $matches[1]
  }

  if (-not $adminPath) {
    $adminPath = "/app"
  }
  if (-not $adminPath.StartsWith("/")) {
    $adminPath = "/$adminPath"
  }
  if ($adminPath.Length -gt 1 -and $adminPath.EndsWith("/")) {
    $adminPath = $adminPath.TrimEnd("/")
  }

  return [pscustomobject]@{
    Path = $configPath
    BackendPort = $backendPort
    StorefrontPort = $storefrontPort
    AdminPath = $adminPath
  }
}

function Resolve-LauncherPort {
  param(
    [int]$RequestedPort,
    [int]$DefaultPort,
    [Nullable[int]]$RuntimePort
  )

  # If caller explicitly provided a non-default value, keep it.
  if ($RequestedPort -ne $DefaultPort) {
    return $RequestedPort
  }

  if ($null -ne $RuntimePort -and [int]$RuntimePort -gt 0) {
    return [int]$RuntimePort
  }

  return $DefaultPort
}
