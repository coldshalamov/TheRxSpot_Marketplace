# TheRxSpot Marketplace - Dependency Starter
# This script helps you start PostgreSQL and Redis if they're installed

$ErrorActionPreference = "Continue"

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "   Dependency Check & Startup" -ForegroundColor Cyan
Write-Host "===================================================`n" -ForegroundColor Cyan

# Check for PostgreSQL
Write-Host "Checking PostgreSQL..." -ForegroundColor Yellow
$pgService = Get-Service -Name "*postgresql*" -ErrorAction SilentlyContinue

if ($pgService) {
    if ($pgService.Status -eq "Running") {
        Write-Host "✅ PostgreSQL is already running" -ForegroundColor Green
    } else {
        Write-Host "⚠️  PostgreSQL found but not running. Starting..." -ForegroundColor Yellow
        Start-Service $pgService.Name
        Write-Host "✅ PostgreSQL started" -ForegroundColor Green
    }
} else {
    # Check if Docker Desktop is running (alternative)
    $dockerService = Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
    if ($dockerService -and $dockerService.Status -eq "Running") {
        Write-Host "⚠️  PostgreSQL service not found, but Docker is running." -ForegroundColor Yellow
        Write-Host "   You may be using Docker containers. Checking..." -ForegroundColor Gray
        
        # Check if postgres container exists
        $pgContainer = docker ps -a --filter "name=postgres" --format "{{.Names}}" 2>$null
        if ($pgContainer) {
            $pgStatus = docker ps --filter "name=postgres" --format "{{.Status}}" 2>$null
            if ($pgStatus -like "*Up*") {
                Write-Host "✅ PostgreSQL Docker container is running" -ForegroundColor Green
            } else {
                Write-Host "Starting PostgreSQL Docker container..." -ForegroundColor Yellow
                docker start $pgContainer
                Write-Host "✅ PostgreSQL Docker container started" -ForegroundColor Green
            }
        } else {
            Write-Host "❌ PostgreSQL not found as service or Docker container!" -ForegroundColor Red
            Write-Host "`nPlease install PostgreSQL:" -ForegroundColor Yellow
            Write-Host "  Option 1: Download from https://www.postgresql.org/download/windows/" -ForegroundColor Gray
            Write-Host "  Option 2: Use Docker: docker run -d --name postgres -e POSTGRES_PASSWORD=medusa -p 5432:5432 postgres:15" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ PostgreSQL not found!" -ForegroundColor Red
        Write-Host "`nPlease install PostgreSQL:" -ForegroundColor Yellow
        Write-Host "  Download from https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    }
}

Write-Host ""

# Check for Redis
Write-Host "Checking Redis..." -ForegroundColor Yellow
$redisService = Get-Service -Name "*redis*" -ErrorAction SilentlyContinue

if ($redisService) {
    if ($redisService.Status -eq "Running") {
        Write-Host "✅ Redis is already running" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Redis found but not running. Starting..." -ForegroundColor Yellow
        Start-Service $redisService.Name
        Write-Host "✅ Redis started" -ForegroundColor Green
    }
} else {
    # Check Docker for Redis
    $dockerService = Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
    if ($dockerService -and $dockerService.Status -eq "Running") {
        $redisContainer = docker ps -a --filter "name=redis" --format "{{.Names}}" 2>$null
        if ($redisContainer) {
            $redisStatus = docker ps --filter "name=redis" --format "{{.Status}}" 2>$null
            if ($redisStatus -like "*Up*") {
                Write-Host "✅ Redis Docker container is running" -ForegroundColor Green
            } else {
                Write-Host "Starting Redis Docker container..." -ForegroundColor Yellow
                docker start $redisContainer
                Write-Host "✅ Redis Docker container started" -ForegroundColor Green
            }
        } else {
            Write-Host "❌ Redis not found as service or Docker container!" -ForegroundColor Red
            Write-Host "`nPlease install Redis:" -ForegroundColor Yellow
            Write-Host "  Option 1: Use WSL2 and install Redis" -ForegroundColor Gray
            Write-Host "  Option 2: Use Docker: docker run -d --name redis -p 6379:6379 redis:latest" -ForegroundColor Gray
            Write-Host "  Option 3: Download Memurai (Redis for Windows): https://www.memurai.com/" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Redis not found!" -ForegroundColor Red
        Write-Host "`nPlease install Redis:" -ForegroundColor Yellow
        Write-Host "  Option 1: Use WSL2 and install Redis" -ForegroundColor Gray
        Write-Host "  Option 2: Install Memurai (Redis for Windows): https://www.memurai.com/" -ForegroundColor Gray
    }
}

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host "Dependency check complete!" -ForegroundColor Cyan
Write-Host "===================================================`n" -ForegroundColor Cyan

# Test connections
Write-Host "Testing connections..." -ForegroundColor Yellow

# Test PostgreSQL
$pgConnected = $false
try {
    $testPg = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($testPg.TcpTestSucceeded) {
        Write-Host "✅ PostgreSQL is accessible on port 5432" -ForegroundColor Green
        $pgConnected = $true
    } else {
        Write-Host "⚠️  PostgreSQL port 5432 not responding" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not test PostgreSQL connection" -ForegroundColor Yellow
}

# Test Redis
$redisConnected = $false
try {
    $testRedis = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($testRedis.TcpTestSucceeded) {
        Write-Host "✅ Redis is accessible on port 6379" -ForegroundColor Green
        $redisConnected = $true
    } else {
        Write-Host "⚠️  Redis port 6379 not responding" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not test Redis connection" -ForegroundColor Yellow
}

Write-Host ""

if ($pgConnected -and $redisConnected) {
    Write-Host "🚀 All dependencies are ready! You can now run Launch-Marketplace.bat" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some dependencies are not ready. Please resolve the issues above before launching." -ForegroundColor Yellow
}

Write-Host ""
pause
