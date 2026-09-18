param(
  [switch]$SkipBuild,
  [string]$OutputDirectory = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot)).TrimEnd('\')
$distributionRoot = Join-Path $projectRoot 'dist'
if (-not $OutputDirectory) { $OutputDirectory = $distributionRoot }
$outputPath = [IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\')
if ($outputPath -ne $distributionRoot -and -not $outputPath.StartsWith($distributionRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'The output directory must be dist or a directory inside this project''s dist directory.'
}

function Assert-NoLinks([string]$FilePath) {
  $current = [IO.Path]::GetFullPath($FilePath)
  while ($current) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw ('Packaging paths cannot contain symbolic links or junctions: ' + $current)
      }
    }
    $parent = Split-Path -Parent $current
    if ($parent -eq $current) { break }
    $current = $parent
  }
}

function Assert-File([string]$BasePath, [string]$RelativePath) {
  $file = Join-Path $BasePath $RelativePath
  Assert-NoLinks $file
  if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-Item -LiteralPath $file).Length -eq 0) {
    throw ('Missing or empty release dependency: ' + $RelativePath + '. Restore source assets or run desktop\prepare.ps1 first.')
  }
}

function Copy-ReleaseTree([string]$SourcePath, [string]$DestinationPath) {
  Assert-NoLinks $SourcePath
  if (-not (Test-Path -LiteralPath $SourcePath -PathType Container)) { throw ('Missing release directory: ' + $SourcePath) }
  New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
  foreach ($item in Get-ChildItem -LiteralPath $SourcePath -Force) {
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw ('Release assets cannot be links: ' + $item.FullName) }
    if ($item.PSIsContainer) {
      if ($item.Name -in @('.git', '.build-cache', '.cache', 'cache', 'node_modules', 'tests', '__pycache__', 'coverage')) { continue }
      Copy-ReleaseTree $item.FullName (Join-Path $DestinationPath $item.Name)
    } else {
      if ($item.Name -match '(?i)(\.log|\.sqlite(?:-shm|-wal)?|\.pdb|\.tmp|\.bak|\.ps1|\.cmd|\.bat)$' -or $item.Name -match '^\.env(?:\.|$)') { continue }
      Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $DestinationPath $item.Name)
    }
  }
}

function Assert-GlyphBundle([string]$BasePath) {
  $fontPath = Join-Path $BasePath 'public\maps\fonts\noto-sans'
  $manifest = Get-Content -LiteralPath (Join-Path $fontPath 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($manifest.font -ne 'Noto Sans Regular' -or $manifest.license -ne 'OFL-1.1' -or @($manifest.files).Count -ne 256) { throw 'The bundled map font manifest is incomplete.' }
  $ranges = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
  [long]$totalBytes = 0
  [long]$totalGlyphs = 0
  foreach ($entry in $manifest.files) {
    if ($entry.file -notmatch '^(\d+)-(\d+)\.pbf$') { throw ('Invalid map glyph filename: ' + $entry.file) }
    $first = [int]$Matches[1]; $last = [int]$Matches[2]
    if ($first -lt 0 -or $first -gt 65280 -or $first % 256 -ne 0 -or $last -ne $first + 255 -or -not $ranges.Add($entry.file)) { throw ('Invalid or duplicate map glyph range: ' + $entry.file) }
    if ($entry.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or $entry.bytes -le 0 -or $entry.glyphCount -lt 0 -or $entry.glyphCount -gt 256) { throw ('Invalid map glyph metadata: ' + $entry.file) }
    $file = Join-Path $fontPath $entry.file
    Assert-File $BasePath ('public\maps\fonts\noto-sans\' + $entry.file)
    if ((Get-Item -LiteralPath $file).Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.sha256) { throw ('Map glyph checksum mismatch: ' + $entry.file) }
    $totalBytes += $entry.bytes; $totalGlyphs += $entry.glyphCount
  }
  if (@(Get-ChildItem -LiteralPath $fontPath -File -Filter '*.pbf').Count -ne 256 -or $totalBytes -ne $manifest.bytes -or $totalGlyphs -ne $manifest.glyphCount) { throw 'The bundled map font files do not match their manifest.' }
}

Assert-NoLinks $projectRoot
Assert-NoLinks $outputPath
if ((Test-Path -LiteralPath $outputPath) -and -not (Test-Path -LiteralPath $outputPath -PathType Container)) { throw 'The output path must be a directory.' }
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($package.type -ne 'module' -or $package.version -notmatch '^\d+\.\d+\.\d+$') { throw 'package.json must declare type=module and a three-part release version.' }
$version = [Version]$package.version
$releaseVersion = if ($version.Build -eq 0) { '{0}.{1}' -f $version.Major, $version.Minor } else { $package.version }
$archiveName = 'EarthChronicle-v' + $releaseVersion + '-windows-x64.zip'
$archivePath = Join-Path $outputPath $archiveName
$checksumPath = Join-Path $outputPath 'SHA256SUMS.txt'
foreach ($file in @($archivePath, $checksumPath)) {
  Assert-NoLinks $file
  if ((Test-Path -LiteralPath $file) -and -not (Test-Path -LiteralPath $file -PathType Leaf)) { throw ('A release output filename is already a directory: ' + $file) }
}

# Copy only runtime inputs. The personal database and developer workspace are
# outside these roots, so a release never inherits an existing user's library.
$rootFiles = @('EarthChronicle.exe', 'EarthChronicle.exe.config', 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll', 'server.mjs', 'database.mjs', 'package.json', 'LICENSE', 'THIRD-PARTY-NOTICES.md')
$runtimeFiles = @('runtime\node.exe', 'runtime\LICENSE.txt')
$requiredAssets = @(
  'public\index.html', 'public\app.js', 'public\style.css', 'public\domain.js', 'public\map-view.js', 'public\map-style.js',
  'public\data\history.json', 'public\data\catalog.json', 'public\maps\liberty.json', 'public\maps\land.geojson', 'public\maps\countries.geojson', 'public\maps\country-labels.geojson', 'public\maps\places.geojson',
  'public\maps\sprite.json', 'public\maps\sprite.png', 'public\maps\sprite@2x.json', 'public\maps\sprite@2x.png', 'public\maps\fonts\noto-sans\manifest.json',
  'public\vendor\maplibre\maplibre-gl.mjs', 'public\vendor\maplibre\maplibre-gl-shared.mjs', 'public\vendor\maplibre\maplibre-gl-worker.mjs', 'public\vendor\maplibre\maplibre-gl.css', 'public\vendor\maplibre\LICENSE.txt',
  'licenses\WebView2\LICENSE.txt', 'licenses\WebView2\NOTICE.txt', 'licenses\maps\OpenFreeMap-LICENSE.md', 'licenses\maps\OSM-Liberty-LICENSE.md', 'licenses\maps\Maki-LICENSE.txt',
  'licenses\maps\Noto-OFL.txt', 'licenses\maps\NotoCJK-OFL.txt', 'licenses\maps\Noto-NOTICE.txt'
)
foreach ($file in @($rootFiles + $runtimeFiles + $requiredAssets | Where-Object { $_ -ne 'EarthChronicle.exe' })) { Assert-File $projectRoot $file }
if (-not $SkipBuild) { & (Join-Path $PSScriptRoot 'build.ps1') }
Assert-File $projectRoot 'EarthChronicle.exe'
$expectedFileVersion = '{0}.{1}.{2}.0' -f $version.Major, $version.Minor, $version.Build
$actualFileVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo((Join-Path $projectRoot 'EarthChronicle.exe')).FileVersion
if ($actualFileVersion -ne $expectedFileVersion) { throw ('EXE version ' + $actualFileVersion + ' does not match package.json ' + $package.version + '. Rebuild the current release.') }
$serverSource = Get-Content -LiteralPath (Join-Path $projectRoot 'server.mjs') -Raw -Encoding UTF8
$serverVersion = [regex]::Match($serverSource, 'VERSION\s*=\s*[''"](?<version>\d+\.\d+\.\d+)[''"]')
if (-not $serverVersion.Success -or $serverVersion.Groups['version'].Value -ne $package.version) { throw 'The content-server version does not match package.json.' }

New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$stagingName = '.package-' + [Guid]::NewGuid().ToString('N')
$stagingPath = Join-Path $outputPath $stagingName
$applicationPath = Join-Path $stagingPath 'EarthChronicle'
try {
  New-Item -ItemType Directory -Path $applicationPath | Out-Null
  foreach ($file in $rootFiles + $runtimeFiles) {
    $destination = Join-Path $applicationPath $file
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $destination
  }
  foreach ($directory in @('public', 'licenses', 'docs')) { Copy-ReleaseTree (Join-Path $projectRoot $directory) (Join-Path $applicationPath $directory) }
  foreach ($file in $rootFiles + $runtimeFiles + $requiredAssets) { Assert-File $applicationPath $file }
  if (@(Get-ChildItem -LiteralPath (Join-Path $applicationPath 'docs') -File).Count -eq 0) { throw 'The release requires its user documentation.' }
  Assert-GlyphBundle $applicationPath

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $temporaryArchive = Join-Path $stagingPath $archiveName
  $archiveStream = [IO.File]::Open($temporaryArchive, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  $zip = $null
  try {
    $zip = New-Object IO.Compression.ZipArchive($archiveStream, [IO.Compression.ZipArchiveMode]::Create, $true, [Text.Encoding]::UTF8)
    $files = [string[]]@(Get-ChildItem -LiteralPath $applicationPath -Recurse -File | ForEach-Object { $_.FullName })
    [Array]::Sort($files, [StringComparer]::Ordinal)
    foreach ($file in $files) {
      $entryName = 'EarthChronicle/' + $file.Substring($applicationPath.Length + 1).Replace('\', '/')
      $entry = $zip.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
      # Fixed timestamps and ordinal ordering make identical inputs reproducible.
      $entry.LastWriteTime = [DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
      $fileInputStream = [IO.File]::OpenRead($file)
      try {
        $fileOutputStream = $entry.Open()
        try { $fileInputStream.CopyTo($fileOutputStream) } finally { $fileOutputStream.Dispose() }
      } finally { $fileInputStream.Dispose() }
    }
  } finally {
    if ($null -ne $zip) { $zip.Dispose() }
    $archiveStream.Dispose()
  }
  $digest = (Get-FileHash -LiteralPath $temporaryArchive -Algorithm SHA256).Hash.ToLowerInvariant()
  $temporaryChecksum = Join-Path $stagingPath 'SHA256SUMS.txt'
  [IO.File]::WriteAllText($temporaryChecksum, $digest + '  ' + $archiveName + "`n", [Text.Encoding]::ASCII)
  Move-Item -LiteralPath $temporaryArchive -Destination $archivePath -Force
  Move-Item -LiteralPath $temporaryChecksum -Destination $checksumPath -Force
  Write-Host ('Portable release: ' + $archivePath)
  Write-Host ('SHA-256: ' + $digest)
} finally {
  $resolvedStaging = [IO.Path]::GetFullPath($stagingPath).TrimEnd('\')
  if ((Split-Path -Parent $resolvedStaging) -ne $outputPath -or (Split-Path -Leaf $resolvedStaging) -ne $stagingName -or $stagingName -notmatch '^\.package-[a-f0-9]{32}$') { throw 'Unsafe packaging cleanup path.' }
  Assert-NoLinks $resolvedStaging
  if (Test-Path -LiteralPath $resolvedStaging) { Remove-Item -LiteralPath $resolvedStaging -Recurse -Force }
}
