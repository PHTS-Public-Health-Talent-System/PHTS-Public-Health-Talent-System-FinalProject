param(
  [string]$BaseDir = "D:\apps\phts",
  [string]$TargetReleaseId = "",
  [string]$BackendService = "PHTS-Backend",
  [string]$FrontendService = "PHTS-Frontend",
  [string]$HealthUrl = "http://127.0.0.1:4000/health"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[rollback] $Message"
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
  & nssm restart $Name | Out-Null
}

function Invoke-Smoke {
  param([string]$Url)
  $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
  if ($res.StatusCode -ne 200) {
    throw "Smoke check failed for $Url (status=$($res.StatusCode))"
  }
}

$releasesDir = Join-Path $BaseDir "releases"
$currentDir = Join-Path $BaseDir "current"

if (-not (Test-Path $releasesDir)) {
  throw "Releases directory not found: $releasesDir"
}

$releases = Get-ChildItem -Path $releasesDir -Directory | Sort-Object LastWriteTime -Descending
if ($releases.Count -lt 2 -and [string]::IsNullOrWhiteSpace($TargetReleaseId)) {
  throw "No previous release available for rollback."
}

if ([string]::IsNullOrWhiteSpace($TargetReleaseId)) {
  $target = $releases | Select-Object -Skip 1 -First 1
} else {
  $target = $releases | Where-Object { $_.Name -eq $TargetReleaseId } | Select-Object -First 1
}

if (-not $target) {
  throw "Target release not found."
}

Write-Step "Rolling back to release $($target.Name)"
New-Junction -LinkPath $currentDir -TargetPath $target.FullName

Restart-ServiceSafe -Name $BackendService
Restart-ServiceSafe -Name $FrontendService

Start-Sleep -Seconds 3
Invoke-Smoke -Url $HealthUrl

Write-Step "Rollback completed successfully to $($target.Name)"
