param(
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $projectRoot "release"
}

$manifestPath = Join-Path $projectRoot "manifest.json"
if (-not (Test-Path $manifestPath)) {
  throw "manifest.json was not found at $manifestPath"
}

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
$extensionSlug =
  (($manifest.name -replace "[^a-zA-Z0-9]+", "-").Trim("-").ToLowerInvariant())

if ([string]::IsNullOrWhiteSpace($extensionSlug)) {
  $extensionSlug = "chrome-extension"
}

$version = [string]$manifest.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw "manifest.json must define a version."
}

$stagingRoot = Join-Path $OutputRoot "package"
$zipPath = Join-Path $OutputRoot "$extensionSlug-v$version.zip"

$runtimeEntries = @(
  "manifest.json",
  "background",
  "content",
  "images",
  "options",
  "popup",
  "shared"
)

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

if (Test-Path $stagingRoot) {
  Remove-Item -Recurse -Force $stagingRoot
}

if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}

New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

foreach ($entry in $runtimeEntries) {
  $sourcePath = Join-Path $projectRoot $entry
  if (-not (Test-Path $sourcePath)) {
    throw "Required runtime path is missing: $entry"
  }

  $destinationPath = Join-Path $stagingRoot $entry
  Copy-Item -Path $sourcePath -Destination $destinationPath -Recurse -Force
}

Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -Force

Write-Output "Release package created."
Write-Output "Staging: $stagingRoot"
Write-Output "Zip: $zipPath"
