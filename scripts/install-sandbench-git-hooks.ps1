#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Install the Sand Bench pre-push hook that triggers the test engine on `git push main`.

.DESCRIPTION
  Writes a one-line stub at ../sand-bench-enterprise/.git/hooks/pre-push that
  execs the tracked hook script in this repo (scripts/sandbench-pre-push-hook.sh).
  Idempotent: a re-run overwrites only a stub owned by this installer. A user's
  own pre-push hook is detected and left alone unless -Force is passed.

  The hook itself runs under the Git-for-Windows bundled bash; curl, openssl
  and python ship with it, so no extra install is needed.

.PARAMETER SbRepo
  Path to the Sand Bench checkout. Defaults to ../sand-bench-enterprise relative
  to the engine repo root.

.PARAMETER Force
  Overwrite an existing non-installer pre-push hook.

.PARAMETER Uninstall
  Remove the stub (only if it is the one this installer wrote).

.EXAMPLE
  pwsh scripts/install-sandbench-git-hooks.ps1
  pwsh scripts/install-sandbench-git-hooks.ps1 -SbRepo D:/code/sand-bench-enterprise
  pwsh scripts/install-sandbench-git-hooks.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [string]$SbRepo,
  [switch]$Force,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
$engineRoot = (Resolve-Path (Join-Path $scriptRoot '..')).Path
if (-not $SbRepo) { $SbRepo = Join-Path $engineRoot '..\sand-bench-enterprise' }
$hookScript = Join-Path $scriptRoot 'sandbench-pre-push-hook.sh'
$sbRoot = (Resolve-Path $SbRepo).Path
$hooksDir = Join-Path $sbRoot '.git/hooks'
$hookPath = Join-Path $hooksDir 'pre-push'
$marker = '# gavriq-test-engine pre-push stub v1 -- managed by scripts/install-sandbench-git-hooks.ps1'

if (-not (Test-Path $hookScript)) { throw "Hook script not found: $hookScript" }
if (-not (Test-Path $hooksDir))   { throw "Not a git checkout: $sbRoot (no .git/hooks/)" }

function Test-OurStub {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $false }
  return (Get-Content $Path -Raw -ErrorAction SilentlyContinue) -match [regex]::Escape($marker)
}

if ($Uninstall) {
  if (Test-OurStub $hookPath) {
    Remove-Item $hookPath -Force
    Write-Host "Removed $hookPath"
  } elseif (Test-Path $hookPath) {
    Write-Host "Hook at $hookPath is not ours; leaving it alone. Pass -Force to remove anyway." -ForegroundColor Yellow
  } else {
    Write-Host "No hook installed at $hookPath; nothing to do."
  }
  return
}

if ((Test-Path $hookPath) -and -not (Test-OurStub $hookPath) -and -not $Force) {
  Write-Host "A pre-push hook already exists at $hookPath and is not ours." -ForegroundColor Yellow
  Write-Host "Inspect it and re-run with -Force to overwrite." -ForegroundColor Yellow
  return
}

# Convert the engine repo path to a Git-Bash-friendly POSIX form.
# C:\GitHub\gavriq-test-engine -> /c/GitHub/gavriq-test-engine
$posixEngineRoot = $engineRoot -replace '\\', '/'
if ($posixEngineRoot -match '^([A-Za-z]):(.*)$') {
  $posixEngineRoot = '/' + $Matches[1].ToLower() + $Matches[2]
}

$stub = @"
#!/usr/bin/env bash
$marker
# Chains the Sand Bench deploy-gate chain only; the test-engine trigger lives
# in a tracked script so updates land via `git pull` in the engine repo.
export GAVRIQ_ENGINE_REPO="$posixEngineRoot"
exec bash "$posixEngineRoot/scripts/sandbench-pre-push-hook.sh" "`$@"
"@

# Git for Windows reads the executable bit from the on-disk file; chmod via
# the bundled bash so the hook actually runs.
$stub | Out-File -Encoding ascii -NoNewline:$false -FilePath $hookPath
try { & bash -c "chmod +x '$($hookPath -replace '\\','/')'" 2>$null } catch { }

Write-Host "Installed pre-push hook at:"
Write-Host "  $hookPath"
Write-Host ""
Write-Host "Trigger script:   $hookScript"
Write-Host "Engine URL:       `${TEST_ENGINE_URL:-http://127.0.0.1:8797}"
Write-Host "Project key:      sand-bench"
Write-Host "Branch:           main"
Write-Host ""
Write-Host "The hook fires when `git push` publishes refs/heads/main. It reads"
Write-Host "SAND_BENCH_WEBHOOK_SECRET from your shell env or $engineRoot/.env."
Write-Host ""
Write-Host "To watch what the hook does on each push, set in your shell:"
Write-Host "  export TEST_ENGINE_HOOK_LOG=/tmp/sb-pre-push.log"
Write-Host ""
Write-Host "Uninstall: pwsh $PSCommandPath -Uninstall"
