# Start the fixer agent detached on this Windows host, logging to fixer-agent.log in the repo root
# (the repo ignores *.log). It polls the engine for fix proposals and invokes the local claude CLI
# to propose test-case patches - see docs or the plan at ~/.claude/plans/snoopy-foraging-simon.md.
#
#   .\scripts\start-fixer-agent.ps1                         # engine on http://127.0.0.1:8797
#   .\scripts\start-fixer-agent.ps1 -Engine http://127.0.0.1:8799
#   .\scripts\start-fixer-agent.ps1 -Stop                   # stop a running agent
param(
  [string]$Engine = $(if ($env:TEST_ENGINE_API) { $env:TEST_ENGINE_API } else { 'http://127.0.0.1:8797' }),
  [switch]$Stop
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root 'fixer-agent.pid'
$log = Join-Path $root 'fixer-agent.log'

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
  if ($running) { Stop-Process -Id $running.Id -Force; Write-Host "fixer agent (pid $($running.Id)) stopped" }
  else { Write-Host 'no fixer agent running' }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
  return
}
if ($running) { Write-Host "fixer agent already running (pid $($running.Id)); log: $log"; return }

$tsx = Join-Path $root 'node_modules\tsx\dist\cli.mjs'
if (-not (Test-Path $tsx)) { throw "tsx not installed - run npm install in $root" }
$env:TEST_ENGINE_API = $Engine
$p = Start-Process -FilePath (Get-Command node).Source `
  -ArgumentList @($tsx, (Join-Path $root 'apps\fixer-agent\src\agent.ts')) `
  -WorkingDirectory $root -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $log -RedirectStandardError (Join-Path $root 'fixer-agent.err.log')
Set-Content -Path $pidFile -Value $p.Id -Encoding ascii
Write-Host "fixer agent started (pid $($p.Id)) against $Engine; log: $log"
