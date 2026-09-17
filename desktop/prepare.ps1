param([string]$CachePath = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $CachePath) { $CachePath = Join-Path $root '.build-cache' }
$cacheRoot = [IO.Path]::GetFullPath($CachePath)
New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
$curl = (Get-Command curl.exe -ErrorAction Stop).Source
$tar = (Get-Command tar.exe -ErrorAction Stop).Source

function Get-VerifiedDownload([string]$Url, [string]$Name, [string]$Algorithm, [string]$Digest) {
  $cached = Join-Path $cacheRoot $Name
  if ((Test-Path -LiteralPath $cached) -and (Get-FileHash -LiteralPath $cached -Algorithm $Algorithm).Hash -eq $Digest) { return $cached }
  $partial = $cached + '.partial'
  & $curl --fail --location --silent --show-error --connect-timeout 15 --max-time 180 --retry 2 --output $partial $Url
  if ($LASTEXITCODE -ne 0) { throw ('Dependency download failed: ' + $Name + '. You can place the verified archive in ' + $cacheRoot + ' and retry.') }
  if ((Get-FileHash -LiteralPath $partial -Algorithm $Algorithm).Hash -ne $Digest) { throw ('Dependency checksum mismatch: ' + $Name) }
  Move-Item -LiteralPath $partial -Destination $cached -Force
  return $cached
}

# Versions and digests are pinned; no package install scripts or global installs run.
$node = Get-VerifiedDownload 'https://nodejs.org/dist/v24.19.0/win-x64/node.exe' 'node-v24.19.0-win-x64.exe' 'SHA256' '3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'
$sdk = Get-VerifiedDownload 'https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4191.47/microsoft.web.webview2.1.0.4191.47.nupkg' 'microsoft.web.webview2.1.0.4191.47.nupkg' 'SHA256' 'F492BBF547D0DA329553B6727435B677579B1E9F91CC9E4A1AD029366D5F23D0'
$mapLibreDigest = [BitConverter]::ToString([Convert]::FromBase64String('pZIJ1/rsB1jDjT3eBTfMaeSY45lRKdCuZtqXqTnkUrn0UJO9IwtbywT5ym3/cz57MGEELwAwQSYjB/Fj9TlktQ==')).Replace('-', '')
$mapLibre = Get-VerifiedDownload 'https://registry.npmjs.org/maplibre-gl/-/maplibre-gl-6.10.0.tgz' 'maplibre-gl-6.10.0.tgz' 'SHA512' $mapLibreDigest
$scratch = Join-Path $cacheRoot ('extract-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $scratch -Force | Out-Null
try {
  $sdkRoot = Join-Path $scratch 'webview2'
  $mapLibreRoot = Join-Path $scratch 'maplibre'
  New-Item -ItemType Directory -Path $sdkRoot, $mapLibreRoot -Force | Out-Null
  & $tar -xf $sdk -C $sdkRoot
  if ($LASTEXITCODE -ne 0) { throw 'WebView2 extraction failed.' }
  & $tar -xzf $mapLibre -C $mapLibreRoot
  if ($LASTEXITCODE -ne 0) { throw 'MapLibre extraction failed.' }
  foreach ($name in @('Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll')) {
    Copy-Item -LiteralPath (Join-Path $sdkRoot ('lib\net462\' + $name)) -Destination (Join-Path $root $name) -Force
  }
  Copy-Item -LiteralPath (Join-Path $sdkRoot 'runtimes\win-x64\native\WebView2Loader.dll') -Destination $root -Force
  $vendor = Join-Path $root 'public\vendor\maplibre'
  $runtime = Join-Path $root 'runtime'
  New-Item -ItemType Directory -Path $vendor, $runtime -Force | Out-Null
  foreach ($name in @('maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css')) {
    Copy-Item -LiteralPath (Join-Path $mapLibreRoot ('package\dist\' + $name)) -Destination $vendor -Force
  }
  Copy-Item -LiteralPath (Join-Path $mapLibreRoot 'package\LICENSE.txt') -Destination $vendor -Force
  Copy-Item -LiteralPath $node -Destination (Join-Path $runtime 'node.exe') -Force
  $sdkLicenses = Join-Path $root 'licenses\WebView2'
  New-Item -ItemType Directory -Path $sdkLicenses -Force | Out-Null
  foreach ($name in @('LICENSE.txt', 'NOTICE.txt')) { Copy-Item -LiteralPath (Join-Path $sdkRoot $name) -Destination $sdkLicenses -Force }
} finally {
  $resolvedScratch = [IO.Path]::GetFullPath($scratch)
  if (-not $resolvedScratch.StartsWith($cacheRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe extraction cleanup path.' }
  if (Test-Path -LiteralPath $resolvedScratch) { Remove-Item -LiteralPath $resolvedScratch -Recurse -Force }
}
Write-Host 'Dependencies ready: Node 24.19.0, MapLibre GL JS 6.10.0, WebView2 SDK 1.0.4191.47.'
Write-Host 'Next: powershell -File desktop\build.ps1'
