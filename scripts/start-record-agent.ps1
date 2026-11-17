# Start the record agent detached on this Windows host, logging to record-agent.log in the repo root.
# The agent polls the engine for queued recording requests and launches `playwright codegen`
# on this machine so the chosen browser opens on your screen.
#
#   .\scripts\start-record-agent.ps1                         # engine on http://127.0.0.1:8797
#   .\scripts\start-record-agent.ps1 -Engine http://127.0.0.1:8799
#   .\scripts\start-record-agent.ps1 -Stop                   # stop the running agent
param(
  [string]$Engine = $(if ($env:TEST_ENGINE_API) { $env:TEST_ENGINE_API } else { 'http://127.0.0.1:8797' }),
  [switch]$Stop
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root 'record-agent.pid'
$log = Join-Path $root 'record-agent.log'

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
  if ($running) { Stop-Process -Id $running.Id -Force; Write-Host "record agent (pid $($running.Id)) stopped" }
  else { Write-Host 'no record agent running' }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
  return
}
if ($running) { Write-Host "record agent already running (pid $($running.Id)); log: $log"; return }

$tsx = Join-Path $root 'node_modules\tsx\dist\cli.mjs'
if (-not (Test-Path $tsx)) { throw "tsx not installed - run npm install in $root" }
$env:TEST_ENGINE_API = $Engine
$p = Start-Process -FilePath (Get-Command node).Source `
  -ArgumentList @($tsx, (Join-Path $root 'apps\record-agent\src\agent.ts')) `
  -WorkingDirectory $root -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $log -RedirectStandardError (Join-Path $root 'record-agent.err.log')
Set-Content -Path $pidFile -Value $p.Id -Encoding ascii
Write-Host "record agent started (pid $($p.Id)) against $Engine; log: $log"
