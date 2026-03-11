param(
  [string]$SiteName = "PHTS",
  [string]$PhysicalPath = "D:\apps\phts\iis\site",
  [int]$BackendPort = 4000,
  [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

Import-Module WebAdministration

function Write-Step {
  param([string]$Message)
  Write-Host "[iis] $Message"
}

New-Item -ItemType Directory -Force -Path $PhysicalPath | Out-Null

$templatePath = Join-Path $PSScriptRoot "templates\web.config"
if (-not (Test-Path $templatePath)) {
  throw "Template not found: $templatePath"
}

$webConfigPath = Join-Path $PhysicalPath "web.config"
$content = Get-Content $templatePath -Raw
$content = $content.Replace("__BACKEND_PORT__", "$BackendPort")
$content = $content.Replace("__FRONTEND_PORT__", "$FrontendPort")
Set-Content -Path $webConfigPath -Value $content -Encoding UTF8

if (-not (Test-Path "IIS:\AppPools\$SiteName")) {
  Write-Step "Creating app pool $SiteName"
  New-WebAppPool -Name $SiteName | Out-Null
}
Set-ItemProperty "IIS:\AppPools\$SiteName" -Name managedRuntimeVersion -Value ""

if (-not (Test-Path "IIS:\Sites\$SiteName")) {
  Write-Step "Creating IIS site $SiteName on :80"
  New-Website -Name $SiteName -Port 80 -PhysicalPath $PhysicalPath -ApplicationPool $SiteName | Out-Null
} else {
  Write-Step "Updating IIS site $SiteName physical path"
  Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $PhysicalPath
}

Write-Step "IIS configured. Configure TLS binding (443) with hospital certificate manually or via separate script."
