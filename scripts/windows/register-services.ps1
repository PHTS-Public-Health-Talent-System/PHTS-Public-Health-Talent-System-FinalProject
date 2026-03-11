param(
  [string]$BaseDir = "D:\apps\phts",
  [string]$NodePath = "C:\Program Files\nodejs\node.exe",
  [string]$BackendService = "PHTS-Backend",
  [string]$FrontendService = "PHTS-Frontend",
  [int]$BackendPort = 4000,
  [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[services] $Message"
}

function Ensure-Service {
  param(
    [string]$Name,
    [string]$AppPath,
    [string]$AppArgs,
    [string]$AppDir,
    [string]$StdOut,
    [string]$StdErr
  )

  $exists = & nssm status $Name 2>$null
  if (-not $?) {
    Write-Step "Installing service: $Name"
    & nssm install $Name $AppPath $AppArgs | Out-Null
  } else {
    Write-Step "Updating service: $Name"
  }

  & nssm set $Name AppDirectory $AppDir | Out-Null
  & nssm set $Name AppExit Default Restart | Out-Null
  & nssm set $Name Start SERVICE_AUTO_START | Out-Null
  & nssm set $Name AppStdout $StdOut | Out-Null
  & nssm set $Name AppStderr $StdErr | Out-Null
  & nssm set $Name AppRotateFiles 1 | Out-Null
  & nssm set $Name AppRotateOnline 1 | Out-Null
  & nssm set $Name AppRotateBytes 10485760 | Out-Null
}

$currentBackendDir = Join-Path $BaseDir "current\backend"
$currentFrontendDir = Join-Path $BaseDir "current\frontend"
$backendLogDir = Join-Path $BaseDir "logs\backend"
$frontendLogDir = Join-Path $BaseDir "logs\frontend"

New-Item -ItemType Directory -Force -Path $backendLogDir | Out-Null
New-Item -ItemType Directory -Force -Path $frontendLogDir | Out-Null

Ensure-Service `
  -Name $BackendService `
  -AppPath $NodePath `
  -AppArgs "dist/index.js" `
  -AppDir $currentBackendDir `
  -StdOut (Join-Path $backendLogDir "stdout.log") `
  -StdErr (Join-Path $backendLogDir "stderr.log")

Ensure-Service `
  -Name $FrontendService `
  -AppPath $NodePath `
  -AppArgs "node_modules\next\dist\bin\next start -p $FrontendPort" `
  -AppDir $currentFrontendDir `
  -StdOut (Join-Path $frontendLogDir "stdout.log") `
  -StdErr (Join-Path $frontendLogDir "stderr.log")

Write-Step "Starting services"
& nssm start $BackendService | Out-Null
& nssm start $FrontendService | Out-Null

Write-Step "Services configured. Backend expected on 127.0.0.1:$BackendPort, Frontend on 127.0.0.1:$FrontendPort"
