param(
  [string]$DestinationPath = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'EarthChronicle'),
  [ValidateRange(1, 120)][int]$ShutdownTimeoutSeconds = 30
)
$ErrorActionPreference = 'Stop'

function Assert-NoReparsePoint([string]$FilePath, [string]$RootPath) {
  $current = $FilePath
  while ($current.Length -ge $RootPath.Length) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw ('Update paths cannot contain links or junctions: ' + $current) }
    }
    if ($current -eq $RootPath) { break }
    $current = Split-Path -Parent $current
  }
}

function Get-ProjectProcesses {
  $all = @(Get-CimInstance Win32_Process -Filter "Name='EarthChronicle.exe' OR Name='node.exe' OR Name='msedgewebview2.exe'")
  $selected = @{}
  foreach ($process in $all) {
    $identity = [string]$process.ProcessId + ':' + [string]$process.CreationDate
    $projectExecutable = $process.ExecutablePath -and ($process.ExecutablePath -eq $nativePath -or $process.ExecutablePath -eq $runtimePath)
    $projectWebView = $process.Name -eq 'msedgewebview2.exe' -and $process.CommandLine -and $process.CommandLine.IndexOf($webViewProfile, [StringComparison]::OrdinalIgnoreCase) -ge 0
    if ($projectExecutable -or $projectWebView -or $trackedProcesses.ContainsKey($identity)) {
      $selected[[int]$process.ProcessId] = $process
      $trackedProcesses[$identity] = $true
    }
  }
  # Keep tracking WebView children after their native parent disappears.
  # Creation time prevents an unrelated reused PID being mistaken for a child.
  do {
    $added = $false
    foreach ($process in $all) {
      if (-not $selected.ContainsKey([int]$process.ProcessId) -and $selected.ContainsKey([int]$process.ParentProcessId)) {
        $selected[[int]$process.ProcessId] = $process
        $trackedProcesses[([string]$process.ProcessId + ':' + [string]$process.CreationDate)] = $true
        $added = $true
      }
    }
  } while ($added)
  return @($selected.Values)
}

try {
  $targetPath = (Resolve-Path -LiteralPath $DestinationPath).Path.TrimEnd([IO.Path]::DirectorySeparatorChar)
  if (-not (Test-Path -LiteralPath (Join-Path $targetPath 'server.mjs') -PathType Leaf)) { throw 'The existing EarthChronicle project was not found.' }
  $payloadPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'files'))
  if (-not (Test-Path -LiteralPath $payloadPath -PathType Container)) { throw 'The update payload is missing.' }
  $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($null -eq $manifest -or $null -eq $manifest.files -or $manifest.files -isnot [Array] -or $manifest.files.Count -eq 0) { throw 'The update manifest must list at least one file.' }
  $entries = [Collections.Generic.List[object]]::new()
  $paths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($entry in $manifest.files) {
    if ($entry.path -isnot [string] -or [string]::IsNullOrWhiteSpace($entry.path) -or $entry.sha256 -isnot [string] -or $entry.sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'The update manifest contains an invalid file entry.' }
    $relative = $entry.path.Replace('/', '\')
    $segments = $relative.Split('\')
    if ([IO.Path]::IsPathRooted($relative) -or $relative -match '[:*?"<>|]' -or @($segments | Where-Object { $_ -eq '' -or $_ -eq '.' -or $_ -eq '..' -or $_ -match '[. ]$' -or $_ -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)' }).Count) { throw ('Unexpected update path: ' + $entry.path) }
    if ($segments[0] -ieq 'data' -or $segments[0] -ieq 'backups') { throw 'User data and backup paths cannot be updated.' }
    if (-not $paths.Add($relative)) { throw ('Duplicate update path: ' + $entry.path) }
    $sourceFile = [IO.Path]::GetFullPath((Join-Path $payloadPath $relative))
    $destinationFile = [IO.Path]::GetFullPath((Join-Path $targetPath $relative))
    if (-not $sourceFile.StartsWith($payloadPath + '\', [StringComparison]::OrdinalIgnoreCase) -or -not $destinationFile.StartsWith($targetPath + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected update path.' }
    Assert-NoReparsePoint $sourceFile $payloadPath
    Assert-NoReparsePoint $destinationFile $targetPath
    if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) { throw ('Missing update file: ' + $entry.path) }
    if ((Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash -ne $entry.sha256) { throw ('Invalid update file: ' + $entry.path) }
    if (Test-Path -LiteralPath $destinationFile -PathType Container) { throw ('A folder occupies the update file path: ' + $entry.path) }
    $parentPath = Split-Path -Parent $destinationFile
    while ($parentPath -ne $targetPath) {
      if (Test-Path -LiteralPath $parentPath -PathType Leaf) { throw ('A file occupies an update folder path: ' + $parentPath) }
      $parentPath = Split-Path -Parent $parentPath
    }
    $entries.Add([pscustomobject]@{ Relative = $relative; Source = $sourceFile; Destination = $destinationFile; Hash = $entry.sha256; Existed = (Test-Path -LiteralPath $destinationFile -PathType Leaf) })
  }
  foreach ($entry in $entries) {
    $parentPath = Split-Path -Parent $entry.Relative
    while ($parentPath) {
      if ($paths.Contains($parentPath)) { throw ('The manifest uses a file as a folder: ' + $parentPath) }
      $parentPath = Split-Path -Parent $parentPath
    }
  }
  $nativePath = Join-Path $targetPath 'EarthChronicle.exe'
  $runtimePath = Join-Path $targetPath 'runtime\node.exe'
  $webViewProfile = Join-Path $targetPath 'data\webview2'
  $databasePath = Join-Path $targetPath 'data\chronicle.sqlite'
  $databaseBackupScript = Join-Path $PSScriptRoot 'backup-database.mjs'
  $backupRoot = Join-Path $targetPath 'backups'
  foreach ($checkedPath in @($nativePath, $runtimePath, $databasePath, $backupRoot)) { Assert-NoReparsePoint $checkedPath $targetPath }
  if (Test-Path -LiteralPath $backupRoot -PathType Leaf) { throw 'A file occupies the backup folder path; the application has not been stopped.' }
  if (Test-Path -LiteralPath $databasePath) {
    if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf) -or -not (Test-Path -LiteralPath $databaseBackupScript -PathType Leaf)) { throw 'The database backup tools are missing; the application has not been stopped.' }
  }

  # No application process is touched until the entire payload is valid.
  $trackedProcesses = @{}
  $running = @(Get-ProjectProcesses)
  if (@($running | Where-Object { $_.ExecutablePath -eq $nativePath }).Count) {
    $null = Start-Process -FilePath $nativePath -ArgumentList '--quit' -WindowStyle Hidden -PassThru
  }
  $deadline = [DateTime]::UtcNow.AddSeconds($ShutdownTimeoutSeconds)
  while (@(Get-ProjectProcesses).Count) {
    if ([DateTime]::UtcNow -ge $deadline) { throw 'EarthChronicle or its WebView/runtime is still running. No application files were changed. Close the application and retry.' }
    Start-Sleep -Milliseconds 200
  }

  $backupFolder = Join-Path $targetPath ('backups\before-update-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
  if (Test-Path -LiteralPath $databasePath) {
    & $runtimePath --no-warnings $databaseBackupScript $databasePath (Join-Path $backupFolder 'chronicle.sqlite')
    if ($LASTEXITCODE -ne 0) { throw 'Database backup failed; no application files were changed.' }
  }
  # Complete every backup before replacing even the first application file.
  foreach ($entry in $entries) {
    if ($entry.Existed) {
      $savedFile = Join-Path $backupFolder $entry.Relative
      New-Item -ItemType Directory -Path (Split-Path -Parent $savedFile) -Force | Out-Null
      Copy-Item -LiteralPath $entry.Destination -Destination $savedFile
      if ((Get-FileHash -LiteralPath $entry.Destination).Hash -ne (Get-FileHash -LiteralPath $savedFile).Hash) { throw ('Backup verification failed: ' + $entry.Relative) }
    }
  }
  $attempted = [Collections.Generic.List[object]]::new()
  $createdDirectories = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  try {
    foreach ($entry in $entries) {
      $parentPath = Split-Path -Parent $entry.Destination
      while ($parentPath -ne $targetPath -and -not (Test-Path -LiteralPath $parentPath)) { $null = $createdDirectories.Add($parentPath); $parentPath = Split-Path -Parent $parentPath }
      New-Item -ItemType Directory -Path (Split-Path -Parent $entry.Destination) -Force | Out-Null
      $attempted.Add($entry)
      Copy-Item -LiteralPath $entry.Source -Destination $entry.Destination -Force
      if ((Get-FileHash -LiteralPath $entry.Destination -Algorithm SHA256).Hash -ne $entry.Hash) { throw ('Copied file verification failed: ' + $entry.Relative) }
    }
  } catch {
    $copyError = $_.Exception.Message
    $rollbackErrors = [Collections.Generic.List[string]]::new()
    for ($index = $attempted.Count - 1; $index -ge 0; $index--) {
      $entry = $attempted[$index]
      try {
        if ($entry.Existed) {
          $savedFile = Join-Path $backupFolder $entry.Relative
          Copy-Item -LiteralPath $savedFile -Destination $entry.Destination -Force
          if ((Get-FileHash -LiteralPath $savedFile).Hash -ne (Get-FileHash -LiteralPath $entry.Destination).Hash) { throw 'Restored file verification failed.' }
        } elseif (Test-Path -LiteralPath $entry.Destination -PathType Leaf) { Remove-Item -LiteralPath $entry.Destination -Force }
      } catch { $rollbackErrors.Add($entry.Relative + ': ' + $_.Exception.Message) }
    }
    foreach ($directory in @($createdDirectories | Sort-Object Length -Descending)) {
      try { if ((Test-Path -LiteralPath $directory -PathType Container) -and @(Get-ChildItem -LiteralPath $directory -Force).Count -eq 0) { Remove-Item -LiteralPath $directory } } catch { $rollbackErrors.Add($_.Exception.Message) }
    }
    if ($rollbackErrors.Count) { throw ($copyError + ' Rollback could not restore every file. Keep the backup at ' + $backupFolder + '. Details: ' + ($rollbackErrors -join '; ')) }
    throw ($copyError + ' All attempted application-file changes were rolled back. Backup: ' + $backupFolder)
  }
  $versionText = if ($manifest.version -is [string] -and -not [string]::IsNullOrWhiteSpace($manifest.version)) { ' to EarthChronicle ' + $manifest.version } else { ' EarthChronicle' }
  Write-Host ('Updated' + $versionText + '. Your database and personal records are preserved.')
  Write-Host ('Project: ' + $targetPath)
  Write-Host ('Backup:  ' + $backupFolder)
  exit 0
} catch { Write-Host ('Update failed: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }
