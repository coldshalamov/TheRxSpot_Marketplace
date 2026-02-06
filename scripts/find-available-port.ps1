#!/usr/bin/env pwsh
# Find an available port in a given range

param(
    [int]$StartPort = 9001,
    [int]$EndPort = 9010,
    [string[]]$ReservedPorts = @('9000')  # Ports to never use
)

function Test-PortAvailable {
    param([int]$Port)

    # Check if port is reserved
    if ($ReservedPorts -contains $Port.ToString()) {
        return $false
    }

    # Check if port is in use
    $listener = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING"
    return $null -eq $listener
}

for ($port = $StartPort; $port -le $EndPort; $port++) {
    if (Test-PortAvailable -Port $port) {
        Write-Output $port
        exit 0
    }
}

Write-Error "No available ports found in range $StartPort-$EndPort"
exit 1
