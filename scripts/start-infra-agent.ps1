# Start the infra agent detached on this Windows host, logging to infra-agent.log in the repo root
# (the repo ignores *.log). It polls the engine for deploy / teardown / housekeeping jobs and runs
# them with the docker and git installed here - see docs/INFRA-LIFECYCLE.md.
#
#   .\scripts\start-infra-agent.ps1                         # engine on http://127.0.0.1:8797
#   .\scripts\start-infra-agent.ps1 -Engine http://127.0.0.1:8799
#   .\scripts\start-infra-agent.ps1 -Stop                   # stop a running agent
param(
  [string]$Engine = $(if ($env:TEST_ENGINE_API) { $env:TEST_ENGINE_API } else { 'http://127.0.0.1:8797' }),
  [switch]$Stop
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root 'infra-agent.pid'
$log = Join-Path $root 'infra-agent.log'

function Get-AgentProcess {
  if (-not (Test-Path $pidFile)) { return $null }
  $id = Get-Content $pidFile | Select-Object -First 1
  if (-not $id) { return $null }
  $p = Get-Process -Id ([int]$id) -ErrorAction SilentlyContinue
  if ($p -and $p.ProcessName -match 'node') { return $p }
  return $null
}

$running = Get-AgentProcess
if ($Stop) {
  if ($running) { Stop-Process -Id $running.Id -Force; Write-Host "infra agent (pid $($running.Id)) stopped" }
  else { Write-Host 'no infra agent running' }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
  return
}
if ($running) { Write-Host "infra agent already running (pid $($running.Id)); log: $log"; return }

$tsx = Join-Path $root 'node_modules\tsx\dist\cli.mjs'
if (-not (Test-Path $tsx)) { throw "tsx not installed - run npm install in $root" }
$env:TEST_ENGINE_API = $Engine
$p = Start-Process -FilePath (Get-Command node).Source `
  -ArgumentList @($tsx, (Join-Path $root 'apps\infra-agent\src\agent.ts')) `
  -WorkingDirectory $root -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $log -RedirectStandardError (Join-Path $root 'infra-agent.err.log')
Set-Content -Path $pidFile -Value $p.Id -Encoding ascii
Write-Host "infra agent started (pid $($p.Id)) against $Engine; log: $log"
