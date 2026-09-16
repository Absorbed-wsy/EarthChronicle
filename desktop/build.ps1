param([switch]$LocalTest)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The .NET Framework 4.8 compiler is required on Windows.' }
foreach ($name in @('Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll')) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $name))) { throw ('Missing ' + $name + '. Run powershell -File desktop\prepare.ps1 first.') }
}
$references = @('System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll', 'System.Net.Http.dll', 'System.Web.Extensions.dll', (Join-Path $root 'Microsoft.Web.WebView2.Core.dll'), (Join-Path $root 'Microsoft.Web.WebView2.WinForms.dll'))
$outputName = if ($LocalTest) { 'EarthChronicle.Test.exe' } else { 'EarthChronicle.exe' }
$arguments = @('/nologo', '/target:winexe', '/platform:x64', '/optimize+', ('/out:' + (Join-Path $root $outputName)), ('/win32manifest:' + (Join-Path $PSScriptRoot 'app.manifest')))
if ($LocalTest) { $arguments += '/define:LOCAL_TEST' }
foreach ($reference in $references) { $arguments += '/reference:' + $reference }
$arguments += Join-Path $PSScriptRoot 'EarthChronicle.cs'
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'Native build failed.' }
