[CmdletBinding()]
param(
  [switch]$Bootstrap,
  [switch]$Desktop,
  [switch]$ResetDesktopData
)

$ErrorActionPreference = 'Stop'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $toolsDir '..')).Path
$envFile = Join-Path $repoRoot '.env'
$logDir = Join-Path $repoRoot '.local\dev-logs'
$runtimeFile = Join-Path $repoRoot '.local\dev-processes.json'
$composeFile = Join-Path $repoRoot 'infra\docker\compose.local.yml'
$npmLocal = Join-Path $repoRoot 'tools\npm-local.cmd'
$nextCmd = Join-Path $repoRoot 'node_modules\.bin\next.cmd'

Set-Location $repoRoot

function Import-DotEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing .env at $Path. Copy .env.example to .env first."
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    $parts = $trimmed -split '=', 2
    if ($parts.Count -ne 2) {
      continue
    }

    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList
  )

  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE`: $FilePath $($ArgumentList -join ' ')"
  }
}

function Test-PortAvailable {
  param([int]$Port)

  $listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Loopback,
    $Port
  )

  try {
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    $listener.Stop()
  }
}

function Wait-Url {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  for ($attempt = 0; $attempt -lt $TimeoutSeconds; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      # The process is still starting.
    }

    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for $Url."
}

function Wait-ContainersHealthy {
  $containerNames = @(
    'qiuai-workos-postgres',
    'qiuai-workos-redis'
  )

  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    $statuses = @(
      foreach ($containerName in $containerNames) {
        (docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $containerName 2>$null).Trim()
      }
    )

    if (
      $statuses.Count -eq $containerNames.Count -and
      ($statuses | Where-Object { $_ -ne 'healthy' }).Count -eq 0
    ) {
      return
    }

    Start-Sleep -Seconds 1
  }

  throw 'Local Docker containers did not become healthy within 60 seconds.'
}

function Start-LoggedCommand {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$CommandLine,
    [hashtable]$EnvironmentOverrides = @{}
  )

  $stdoutPath = Join-Path $logDir "$Name.out.log"
  $stderrPath = Join-Path $logDir "$Name.err.log"
  $resolvedCommandLine = Add-LocalEnvPrelude -CommandLine $CommandLine -Overrides $EnvironmentOverrides

  $process = Start-Process `
    -WindowStyle Hidden `
    -FilePath $env:ComSpec `
    -ArgumentList @('/d', '/s', '/c', $resolvedCommandLine) `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  return [ordered]@{
    name = $Name
    pid = $process.Id
    stdout = $stdoutPath
    stderr = $stderrPath
  }
}

function Format-CmdSet {
  param(
    [string]$Name,
    [string]$Value
  )

  $resolvedValue = if ($null -eq $Value) { '' } else { $Value }
  return 'set "{0}={1}"' -f $Name, $resolvedValue
}

function Add-LocalEnvPrelude {
  param(
    [string]$CommandLine,
    [hashtable]$Overrides = @{}
  )

  $names = @(
    'NODE_ENV',
    'APP_ENV',
    'WORKOS_DEPLOY_TARGET',
    'WORKOS_PERSISTENCE_MODE',
    'DATABASE_URL',
    'REDIS_URL',
    'SERVER_HOST',
    'SERVER_PORT',
    'SERVER_API_BASE_URL',
    'SERVER_INTERNAL_BASE_URL',
    'WORKOS_PUBLIC_BASE_URL',
    'NEXT_PUBLIC_WORKOS_CONSOLE_URL',
    'NEXT_PUBLIC_ADMIN_CONSOLE_URL',
    'WORKOS_BOOTSTRAP_ADMIN_EMAIL',
    'WORKOS_BOOTSTRAP_ADMIN_PASSWORD',
    'ADMIN_CONSOLE_OPERATOR_EMAILS'
  )

  $prefix = @()
  foreach ($name in $names) {
    $value = if ($Overrides.ContainsKey($name)) {
      [string]$Overrides[$name]
    } else {
      [Environment]::GetEnvironmentVariable($name, 'Process')
    }

    if ($null -ne $value) {
      $prefix += Format-CmdSet -Name $name -Value $value
    }
  }

  return (($prefix + $CommandLine) -join ' && ')
}

Import-DotEnv -Path $envFile

if (-not $env:WORKOS_PERSISTENCE_MODE -or $env:WORKOS_PERSISTENCE_MODE -eq 'mock') {
  $env:WORKOS_PERSISTENCE_MODE = 'database'
}
if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = 'postgresql://qiuai:qiuai@127.0.0.1:5432/qiuai_workos'
}
if (-not $env:REDIS_URL) {
  $env:REDIS_URL = 'redis://127.0.0.1:6379/0'
}
if (-not $env:WORKOS_BOOTSTRAP_ADMIN_EMAIL) {
  $env:WORKOS_BOOTSTRAP_ADMIN_EMAIL = 'admin@qiuai.local'
}
if (-not $env:WORKOS_BOOTSTRAP_ADMIN_PASSWORD) {
  $env:WORKOS_BOOTSTRAP_ADMIN_PASSWORD = 'qiuai-dev'
}
if (-not $env:ADMIN_CONSOLE_OPERATOR_EMAILS) {
  $env:ADMIN_CONSOLE_OPERATOR_EMAILS = $env:WORKOS_BOOTSTRAP_ADMIN_EMAIL
}

$env:NODE_ENV = 'development'
$env:APP_ENV = 'local'
$env:WORKOS_DEPLOY_TARGET = 'local'
$env:SERVER_HOST = '127.0.0.1'

$serverPort = 4000
$webPort = 3001
$adminPort = 3200

foreach ($port in @($serverPort, $webPort, $adminPort)) {
  if (-not (Test-PortAvailable -Port $port)) {
    throw "Port $port is already in use. Stop the existing process before starting local Dev."
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker CLI was not found. Install Docker Desktop first.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js was not found. Install Node.js 20 first.'
}
if (-not (Test-Path -LiteralPath $npmLocal)) {
  throw "Missing local npm wrapper: $npmLocal"
}
if (-not (Test-Path -LiteralPath $nextCmd)) {
  throw "Missing Next.js executable: $nextCmd. Run .\tools\npm-local.cmd install first."
}

try {
  Invoke-Checked -FilePath 'docker' -ArgumentList @('info', '--format', '{{.ServerVersion}}')
} catch {
  throw 'Docker Desktop is not running. Start Docker Desktop, then run this script again.'
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Invoke-Checked -FilePath 'docker' -ArgumentList @('compose', '-f', $composeFile, 'up', '-d')
Wait-ContainersHealthy

Invoke-Checked -FilePath $npmLocal -ArgumentList @('run', 'db:migrate:deploy')
if ($Bootstrap) {
  Invoke-Checked -FilePath $npmLocal -ArgumentList @('run', 'db:seed')
}

$apiBaseUrl = "http://127.0.0.1:$serverPort"
$webBaseUrl = "http://127.0.0.1:$webPort"
$adminBaseUrl = "http://127.0.0.1:$adminPort"

$env:SERVER_PORT = "$serverPort"
$env:SERVER_API_BASE_URL = $apiBaseUrl
$env:SERVER_INTERNAL_BASE_URL = $apiBaseUrl
$env:WORKOS_PUBLIC_BASE_URL = $webBaseUrl
$env:NEXT_PUBLIC_WORKOS_CONSOLE_URL = $webBaseUrl
$env:NEXT_PUBLIC_ADMIN_CONSOLE_URL = $adminBaseUrl

$processes = @()
$processes += Start-LoggedCommand `
  -Name 'server' `
  -WorkingDirectory $repoRoot `
  -CommandLine ('call "{0}" run dev:server' -f $npmLocal)

$webDirectory = Join-Path $repoRoot 'apps\web-console'
$processes += Start-LoggedCommand `
  -Name 'web-console' `
  -WorkingDirectory $webDirectory `
  -CommandLine ('call "{0}" dev --hostname 127.0.0.1 --port {1}' -f $nextCmd, $webPort)

$adminDirectory = Join-Path $repoRoot 'apps\admin-console'
$processes += Start-LoggedCommand `
  -Name 'admin-console' `
  -WorkingDirectory $adminDirectory `
  -CommandLine ('call "{0}" dev --hostname 127.0.0.1 --port {1}' -f $nextCmd, $adminPort)

if ($Desktop) {
  $desktopCommand = if ($ResetDesktopData) {
    'call "{0}" run dev:pc:clean' -f $npmLocal
  } else {
    'call "{0}" run dev:pc' -f $npmLocal
  }

  $processes += Start-LoggedCommand `
    -Name 'pc-app' `
    -WorkingDirectory $repoRoot `
    -CommandLine $desktopCommand `
    -EnvironmentOverrides @{
      WORKOS_PUBLIC_BASE_URL = $apiBaseUrl
      SERVER_API_BASE_URL = $apiBaseUrl
      SERVER_INTERNAL_BASE_URL = $apiBaseUrl
    }
}

$runtime = [ordered]@{
  startedAt = (Get-Date).ToString('o')
  apiBaseUrl = $apiBaseUrl
  webBaseUrl = $webBaseUrl
  adminBaseUrl = $adminBaseUrl
  processes = $processes
}

$runtime | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath $runtimeFile

Wait-Url -Url "$apiBaseUrl/api/v1/health"
Wait-Url -Url $webBaseUrl
Wait-Url -Url $adminBaseUrl

Write-Host ''
Write-Host 'QiuAI WorkOS local Dev started.' -ForegroundColor Green
Write-Host "Web console:   $webBaseUrl"
Write-Host "Admin console: $adminBaseUrl"
Write-Host "API health:    $apiBaseUrl/api/v1/health"
Write-Host "Logs:          $logDir"
Write-Host "Stop:          $toolsDir\stop-local-dev.cmd"
if ($Bootstrap) {
  Write-Host 'Database seed: completed.'
}
if ($Desktop) {
  Write-Host 'PC app:        started.'
}
