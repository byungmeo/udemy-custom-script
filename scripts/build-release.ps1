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
$extensionName = [string]$manifest.name

if ($extensionName -match "^__MSG_(.+)__$") {
  $messageKey = $Matches[1]
  $defaultLocale = [string]$manifest.default_locale
  $localePath = Join-Path $projectRoot "_locales\$defaultLocale\messages.json"

  if (-not (Test-Path $localePath)) {
    throw "Localized message file was not found: $localePath"
  }

  $localeMessages = Get-Content -Raw -Path $localePath | ConvertFrom-Json
  $localizedEntry = $localeMessages.$messageKey
  $extensionName = [string]$localizedEntry.message
}

$extensionSlug =
  (($extensionName -replace "[^a-zA-Z0-9]+", "-").Trim("-").ToLowerInvariant())

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
  "_locales",
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

$archiveEntries = Get-ChildItem -LiteralPath $stagingRoot -Force | ForEach-Object {
  $_.FullName
}

Compress-Archive -Path $archiveEntries -DestinationPath $zipPath -Force

Write-Output "Release package created."
Write-Output "Staging: $stagingRoot"
Write-Output "Zip: $zipPath"
