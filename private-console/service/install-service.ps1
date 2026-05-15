#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$Reinstall,
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'

$ServiceName = 'AdgaiPrivateConsole'
$ServiceDisplayName = 'Adgai Private Console'
$WinSWVersion = '2.12.0'
$DownloadUrl = "https://github.com/winsw/winsw/releases/download/v$WinSWVersion/WinSW-x64.exe"
$ServiceDir = $PSScriptRoot
$RepoRoot = 'E:\Dev\adgai-site'
$NodePath = 'E:\Dev\nodejs\node.exe'
$DashboardPath = 'E:\Dev\adgai-site\private-console\dashboard-server.mjs'
$DashboardUrl = 'http://127.0.0.1:18666/'
$LogDir = 'E:\Dev\adgai-site\private-console\logs'
$WrapperCache = Join-Path $ServiceDir 'WinSW-x64.exe'
$ServiceExe = Join-Path $ServiceDir "$ServiceName.exe"
$ServiceConfig = Join-Path $ServiceDir "$ServiceName.xml"

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

function Get-ConsoleListener {
  $listeners = Get-NetTCPConnection -LocalPort 18666 -State Listen -ErrorAction SilentlyContinue
  if (-not $listeners) {
    return @()
  }
  return @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
}

function Stop-ExistingConsoleIfOwned {
  $listenerProcessIds = Get-ConsoleListener
  foreach ($listenerProcessId in $listenerProcessIds) {
    if (-not $listenerProcessId) { continue }
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$listenerProcessId" -ErrorAction SilentlyContinue
    $commandLine = [string]$processInfo.CommandLine
    if ($commandLine -like '*private-console*dashboard-server.mjs*') {
      Write-Host "Stopping existing console process on port 18666 (PID $listenerProcessId)."
      Stop-Process -Id $listenerProcessId -Force -ErrorAction Stop
      Start-Sleep -Seconds 1
      continue
    }
    $name = if ($processInfo.Name) { $processInfo.Name } else { 'unknown process' }
    throw "Port 18666 is already in use by PID $listenerProcessId ($name). Stop it before starting $ServiceName."
  }
}

function Wait-ForHttp {
  for ($i = 0; $i -lt 20; $i++) {
    try {
      $response = Invoke-WebRequest -Uri $DashboardUrl -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        Write-Host "HTTP check OK: $DashboardUrl returned 200."
        return
      }
    } catch {
      Start-Sleep -Milliseconds 750
    }
  }
  throw "Service started, but $DashboardUrl did not return 200 in time."
}

if (-not (Test-Admin)) {
  throw 'Administrator PowerShell is required to install or update the Windows service.'
}

if (-not (Test-Path -LiteralPath $RepoRoot)) {
  throw "Repo root not found: $RepoRoot"
}
if (-not (Test-Path -LiteralPath $NodePath)) {
  throw "Node executable not found: $NodePath"
}
if (-not (Test-Path -LiteralPath $DashboardPath)) {
  throw "Dashboard server not found: $DashboardPath"
}
if (-not (Test-Path -LiteralPath $ServiceConfig)) {
  throw "WinSW service config not found: $ServiceConfig"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (-not (Test-Path -LiteralPath $WrapperCache)) {
  Write-Host "Downloading WinSW $WinSWVersion to $WrapperCache"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $DownloadUrl -OutFile $WrapperCache -UseBasicParsing
} else {
  Write-Host "Reusing existing WinSW wrapper: $WrapperCache"
}

Copy-Item -LiteralPath $WrapperCache -Destination $ServiceExe -Force

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing -and $Reinstall) {
  if ($existing.Status -ne 'Stopped') {
    Write-Host "Stopping existing $ServiceName service."
    Invoke-WinSW stop
    Start-Sleep -Seconds 1
  }
  Write-Host "Uninstalling existing $ServiceName service."
  Invoke-WinSW uninstall
  Start-Sleep -Seconds 1
  $existing = $null
}

if (-not $existing) {
  Write-Host "Installing $ServiceDisplayName."
  Invoke-WinSW install
} else {
  Write-Host "$ServiceDisplayName is already installed. Use -Reinstall to reinstall it."
}

if (-not $NoStart) {
  Stop-ExistingConsoleIfOwned
  Write-Host "Starting $ServiceDisplayName."
  Invoke-WinSW start
  $service = Get-Service -Name $ServiceName -ErrorAction Stop
  $service.WaitForStatus('Running', [TimeSpan]::FromSeconds(15))
  Wait-ForHttp
}

Get-Service -Name $ServiceName | Format-Table -AutoSize Name, DisplayName, Status, StartType
