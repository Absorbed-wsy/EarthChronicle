param([switch]$Share, [switch]$Stop, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$nativePath = Join-Path $PSScriptRoot 'EarthChronicle.exe'
if (-not (Test-Path -LiteralPath $nativePath)) { throw 'EarthChronicle.exe is missing. Keep the complete application folder.' }
$nativeArgs = @()
if ($Share) { $nativeArgs += '--share' }
if ($Stop) { $nativeArgs += '--quit' }
if ($NoBrowser) { $nativeArgs += '--background' }
if ($nativeArgs.Count) { Start-Process -FilePath $nativePath -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -ArgumentList $nativeArgs }
else { Start-Process -FilePath $nativePath -WorkingDirectory $PSScriptRoot -WindowStyle Hidden }