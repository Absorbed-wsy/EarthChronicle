param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compilerPath)) { throw 'The Windows .NET Framework 4.8 compiler is required.' }
$references = @('System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll', 'System.Net.Http.dll', 'System.Web.Extensions.dll', (Join-Path $projectRoot 'Microsoft.Web.WebView2.Core.dll'), (Join-Path $projectRoot 'Microsoft.Web.WebView2.WinForms.dll'))
foreach ($reference in $references) {
  if ([IO.Path]::IsPathRooted($reference) -and -not (Test-Path -LiteralPath $reference)) { throw ('Missing native dependency: ' + $reference) }
}
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testFolder = Join-Path $temporaryRoot ('earthchronicle-native-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testFolder | Out-Null
try {
  $testExecutable = Join-Path $testFolder 'NativeRegressionTests.exe'
  $arguments = @('/nologo', '/target:exe', '/platform:x64', '/optimize+', '/main:EarthChronicle.NativeRegressionTests', ('/out:' + $testExecutable))
  foreach ($reference in $references) { $arguments += '/reference:' + $reference }
  $arguments += Join-Path $PSScriptRoot 'EarthChronicle.cs'
  $arguments += Join-Path $projectRoot 'tests\NativeRegressionTests.cs'
  & $compilerPath @arguments
  if ($LASTEXITCODE -ne 0) { throw 'Native regression test compilation failed.' }
  # These tests never construct a Form or start the application. Both temporary
  # HTTP listeners bind to 127.0.0.1 and close before the process exits.
  & $testExecutable
  if ($LASTEXITCODE -ne 0) { throw 'Native regression tests failed.' }
} finally {
  $resolvedTestFolder = [IO.Path]::GetFullPath($testFolder)
  $allowedPrefix = $temporaryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $resolvedTestFolder.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.Path]::GetFileName($resolvedTestFolder).StartsWith('earthchronicle-native-test-', [StringComparison]::Ordinal)) { throw 'Refusing cleanup outside the temporary test directory.' }
  if (Test-Path -LiteralPath $resolvedTestFolder) { Remove-Item -LiteralPath $resolvedTestFolder -Recurse -Force }
}
