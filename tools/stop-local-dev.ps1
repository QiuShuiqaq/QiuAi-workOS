[CmdletBinding()]
param(
  [switch]$DownInfra
)

$ErrorActionPreference = 'Stop'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $toolsDir '..')).Path
$runtimeFile = Join-Path $repoRoot '.local\dev-processes.json'
$composeFile = Join-Path $repoRoot 'infra\docker\compose.local.yml'

if (Test-Path -LiteralPath $runtimeFile) {
  $runtime = Get-Content -Raw -LiteralPath $runtimeFile | ConvertFrom-Json

  foreach ($process in @($runtime.processes)) {
    if ($process.pid) {
      & taskkill.exe /PID ([int]$process.pid) /T /F 2>$null | Out-Null
    }
  }

  Remove-Item -Force -LiteralPath $runtimeFile
  Write-Host 'QiuAI WorkOS local Dev processes stopped.'
} else {
  Write-Host 'No tracked QiuAI WorkOS local Dev processes found.'
}

if ($DownInfra) {
  & docker compose -f $composeFile down
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to stop local Docker infrastructure with exit code $LASTEXITCODE."
  }

  Write-Host 'Local Docker infrastructure stopped.'
}
