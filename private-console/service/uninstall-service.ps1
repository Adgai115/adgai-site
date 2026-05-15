#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$KeepServiceExe
)

$ErrorActionPreference = 'Stop'

$ServiceName = 'AdgaiPrivateConsole'
$ServiceDir = $PSScriptRoot
$WrapperCache = Join-Path $ServiceDir 'WinSW-x64.exe'
$ServiceExe = Join-Path $ServiceDir "$ServiceName.exe"

function Test-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-WinSW {
  param([Parameter(Mandatory)][string]$Action)
  & $ServiceExe $Action
  if ($LASTEXITCODE -ne 0) {
    throw "WinSW action '$Action' failed with exit code $LASTEXITCODE."
  }
}

if (-not (Test-Admin)) {
  throw 'Administrator PowerShell is required to uninstall the Windows service.'
}

if (-not (Test-Path -LiteralPath $ServiceExe)) {
  if (Test-Path -LiteralPath $WrapperCache) {
    Copy-Item -LiteralPath $WrapperCache -Destination $ServiceExe -Force
  } else {
    throw "Service wrapper not found: $ServiceExe"
  }
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $existing) {
  Write-Host "$ServiceName is not installed."
} else {
  if ($existing.Status -ne 'Stopped') {
    Write-Host "Stopping $ServiceName."
    Invoke-WinSW stop
    Start-Sleep -Seconds 1
  }
  Write-Host "Uninstalling $ServiceName."
  Invoke-WinSW uninstall
}

if (-not $KeepServiceExe -and (Test-Path -LiteralPath $ServiceExe)) {
  Remove-Item -LiteralPath $ServiceExe -Force
}

$remaining = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($remaining) {
  Get-Service -Name $ServiceName | Format-Table -AutoSize Name, DisplayName, Status, StartType
  throw "$ServiceName still exists after uninstall."
}

Write-Host "$ServiceName removed."
