param(
  [string]$BuildStamp
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pagesPath = Join-Path $repoRoot "work\cloudflare-pages"
$packageJsonPath = Join-Path $repoRoot "package.json"
$artifactRoot = Join-Path $repoRoot "release-artifacts"
$thirdPartyNoticePath = Join-Path $repoRoot "THIRD_PARTY_NOTICES.md"

if (-not (Test-Path -LiteralPath (Join-Path $pagesPath "index.html"))) {
  throw "The Pages build is missing. Run npm.cmd run build:pages first."
}
if (-not (Test-Path -LiteralPath $thirdPartyNoticePath)) {
  throw "The third-party license notice is missing."
}
$thirdPartyNoticeText = Get-Content -LiteralPath $thirdPartyNoticePath -Raw
if ($thirdPartyNoticeText -notmatch 'Copyright \(c\) 2024 My Muscle Contributors' -or
    $thirdPartyNoticeText -notmatch 'Permission is hereby granted, free of charge') {
  throw "The third-party license notice is incomplete."
}

$package = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = [string]$package.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw "package.json does not contain a release version."
}

if ([string]::IsNullOrWhiteSpace($BuildStamp)) {
  $BuildStamp = Get-Date -Format "yyyyMMdd-HHmmss"
}
if ($BuildStamp -notmatch '^\d{8}-\d{6}$') {
  throw "BuildStamp must use yyyyMMdd-HHmmss, for example 20260820-184500."
}

New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
Copy-Item -LiteralPath $thirdPartyNoticePath -Destination (Join-Path $pagesPath "THIRD_PARTY_NOTICES.md") -Force

$releaseName = "Track-II-web-v$version-build-$BuildStamp.zip"
$rollbackName = "Track-II-web-v$version-rollback-$BuildStamp.zip"
$manifestName = "Track-II-web-v$version-build-$BuildStamp.json"
$releasePath = Join-Path $artifactRoot $releaseName
$rollbackPath = Join-Path $artifactRoot $rollbackName
$manifestPath = Join-Path $artifactRoot $manifestName

foreach ($path in @($releasePath, $rollbackPath, $manifestPath)) {
  if (Test-Path -LiteralPath $path) {
    throw "Refusing to overwrite an existing release artifact: $path"
  }
}

$previousRelease = Get-ChildItem -LiteralPath $artifactRoot -Filter "Track-II-web-v*-build-*.zip" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

function Copy-RollbackArchive {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceArchive,
    [Parameter(Mandatory = $true)]
    [string]$DestinationArchive,
    [Parameter(Mandatory = $true)]
    [string]$Stamp
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($SourceArchive)
  try {
    $containsNotice = $null -ne $archive.GetEntry("THIRD_PARTY_NOTICES.md")
  } finally {
    $archive.Dispose()
  }

  if ($containsNotice) {
    Copy-Item -LiteralPath $SourceArchive -Destination $DestinationArchive
    return
  }

  $stagingPath = Join-Path $artifactRoot "rollback-stage-$Stamp"
  New-Item -ItemType Directory -Path $stagingPath -Force | Out-Null
  try {
    Expand-Archive -LiteralPath $SourceArchive -DestinationPath $stagingPath -Force
    Copy-Item -LiteralPath $thirdPartyNoticePath -Destination (Join-Path $stagingPath "THIRD_PARTY_NOTICES.md") -Force
    Compress-Archive -Path (Join-Path $stagingPath "*") -DestinationPath $DestinationArchive -CompressionLevel Optimal
  } finally {
    if (Test-Path -LiteralPath $stagingPath) {
      Remove-Item -LiteralPath $stagingPath -Recurse -Force
    }
  }
}

Compress-Archive -Path (Join-Path $pagesPath "*") -DestinationPath $releasePath -CompressionLevel Optimal

if ($null -ne $previousRelease) {
  Copy-RollbackArchive -SourceArchive $previousRelease.FullName -DestinationArchive $rollbackPath -Stamp $BuildStamp
  $rollbackSource = $previousRelease.Name
} else {
  # The first verified build is also the first safe rollback point.
  Copy-RollbackArchive -SourceArchive $releasePath -DestinationArchive $rollbackPath -Stamp $BuildStamp
  $rollbackSource = $releaseName
}

$manifest = [ordered]@{
  app = "Track II"
  version = $version
  buildStamp = $BuildStamp
  releaseZip = $releaseName
  rollbackZip = $rollbackName
  rollbackSource = $rollbackSource
  createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Output "Release archive: $releasePath"
Write-Output "Rollback archive: $rollbackPath"
Write-Output "Manifest: $manifestPath"
