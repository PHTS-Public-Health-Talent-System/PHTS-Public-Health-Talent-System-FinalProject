param(
  [Parameter(Mandatory = $true)]
  [string]$ReleaseId,

  [Parameter(Mandatory = $true)]
  [string]$ArtifactPath,

  [string]$BaseDir = "D:\apps\phts",
  [string]$BackendService = "PHTS-Backend",
  [string]$FrontendService = "PHTS-Frontend",
  [string]$HealthUrl = "http://127.0.0.1:4000/health",
  [int]$RetainReleases = 5
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[deploy] $Message"
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function New-Junction {
  param(
    [string]$LinkPath,
    [string]$TargetPath
  )

  if (Test-Path $LinkPath) {
    cmd /c rmdir "$LinkPath" | Out-Null
  }
  cmd /c mklink /J "$LinkPath" "$TargetPath" | Out-Null
}

function Restart-ServiceSafe {
  param([string]$Name)
  Write-Step "Restarting service: $Name"
  & nssm restart $Name | Out-Null
}

function Invoke-Smoke {
  param([string]$Url)
  Write-Step "Running smoke check: $Url"
  $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
  if ($res.StatusCode -ne 200) {
    throw "Smoke check failed for $Url (status=$($res.StatusCode))"
  }
}

Assert-Command "node"
Assert-Command "npm"
Assert-Command "nssm"

$releasesDir = Join-Path $BaseDir "releases"
$sharedDir = Join-Path $BaseDir "shared"
$currentDir = Join-Path $BaseDir "current"
$releaseDir = Join-Path $releasesDir $ReleaseId
$backendDir = Join-Path $releaseDir "backend"
$frontendDir = Join-Path $releaseDir "frontend"
$sharedBackendEnv = Join-Path $sharedDir "backend\.env"
$sharedFrontendEnv = Join-Path $sharedDir "frontend\.env.local"

Write-Step "Preparing directories"
New-Item -ItemType Directory -Force -Path $releasesDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $sharedDir "backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $sharedDir "frontend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BaseDir "logs\backend") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $BaseDir "logs\frontend") | Out-Null

if (-not (Test-Path $ArtifactPath)) {
  throw "Artifact not found: $ArtifactPath"
}

if (Test-Path $releaseDir) {
  throw "Release already exists: $releaseDir"
}

Write-Step "Extracting artifact into $releaseDir"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Expand-Archive -Path $ArtifactPath -DestinationPath $releaseDir -Force

if (-not (Test-Path $backendDir)) {
  throw "backend folder missing in artifact: $backendDir"
}
if (-not (Test-Path $frontendDir)) {
  throw "frontend folder missing in artifact: $frontendDir"
}

if (Test-Path $sharedBackendEnv) {
  Copy-Item $sharedBackendEnv (Join-Path $backendDir ".env") -Force
}
if (Test-Path $sharedFrontendEnv) {
  Copy-Item $sharedFrontendEnv (Join-Path $frontendDir ".env.local") -Force
}

Write-Step "Installing production dependencies"
Push-Location $backendDir
npm ci --omit=dev
Pop-Location

Push-Location $frontendDir
npm ci --omit=dev
Pop-Location

Write-Step "Switching current release to $ReleaseId"
New-Junction -LinkPath $currentDir -TargetPath $releaseDir

Restart-ServiceSafe -Name $BackendService
Restart-ServiceSafe -Name $FrontendService

Start-Sleep -Seconds 3
Invoke-Smoke -Url $HealthUrl

Write-Step "Pruning old releases (retain=$RetainReleases)"
$allReleases = Get-ChildItem -Path $releasesDir -Directory | Sort-Object LastWriteTime -Descending
if ($allReleases.Count -gt $RetainReleases) {
  $toDelete = $allReleases | Select-Object -Skip $RetainReleases
  foreach ($item in $toDelete) {
    if ($item.FullName -ne $releaseDir) {
      Remove-Item -Path $item.FullName -Recurse -Force
    }
  }
}

Write-Step "Deployment completed successfully for release $ReleaseId"
